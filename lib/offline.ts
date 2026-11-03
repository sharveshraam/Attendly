/**
 * Offline outbox + private local cache for the web PWA.
 *
 * Privacy rules:
 *  - The service worker caches ONLY static assets; no API response is cached.
 *  - Private data cached here is scoped per user id, is never sent anywhere
 *    except back to the owner's own Supabase rows, and can be disabled/cleared
 *    in Settings. Always cleared on sign-out.
 *  - Every queued attendance mark has a deterministic id (one per event) and a
 *    `baseMarkedAt` version. Sync refuses to overwrite a newer server value
 *    (from the mobile app or another tab) and reports a conflict instead.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AttendanceStatus } from "./types.ts";

const OUTBOX_KEY = "attendly.outbox.v1";
const CACHE_PREFIX = "attendly.cache.v1.";
const NOTES_KEY = "attendly.notes.v1";
const PRIORITY_KEY = "attendly.priority.v1";
const CACHE_ENABLED_KEY = "attendly.cache-enabled.v1";

export interface OutboxOp {
  id: string;
  kind: "attendance.upsert";
  eventId: string;
  status: AttendanceStatus;
  attendedMinutes: number | null;
  note: string | null;
  /** Server row id + `marked_at` observed when the local edit was made. */
  baseRecordId: string | null;
  baseMarkedAt: string | null;
  localMarkedAt: string;
  attempts: number;
  lastError: string | null;
  state: "pending" | "failed" | "conflict";
  /** Set only after the user explicitly chose "keep my offline mark". */
  forceOverwrite?: boolean;
}

export interface SyncResult {
  synced: number;
  conflicts: number;
  failed: number;
  remaining: number;
  messages: string[];
}

function store(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function read<T>(key: string, fallback: T): T {
  const storage = store();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  const storage = store();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded or blocked — online mode still works */
  }
}

export function isOfflineCacheEnabled(): boolean {
  return read<boolean>(CACHE_ENABLED_KEY, true);
}
export function setOfflineCacheEnabled(enabled: boolean): void {
  write(CACHE_ENABLED_KEY, enabled);
  if (!enabled) clearPrivateCache();
}

export function readOps(): OutboxOp[] {
  return read<OutboxOp[]>(OUTBOX_KEY, []);
}
function saveOps(ops: OutboxOp[]): void {
  write(OUTBOX_KEY, ops);
}

/** Enqueue/replace a local attendance mark. One pending edit per event. */
export function enqueueAttendance(input: {
  eventId: string;
  status: AttendanceStatus;
  attendedMinutes?: number | null;
  note?: string | null;
  baseRecordId?: string | null;
  baseMarkedAt?: string | null;
}): OutboxOp {
  const op: OutboxOp = {
    id: `attendance:${input.eventId}`,
    kind: "attendance.upsert",
    eventId: input.eventId,
    status: input.status,
    attendedMinutes: input.attendedMinutes ?? null,
    note: input.note ?? null,
    baseRecordId: input.baseRecordId ?? null,
    baseMarkedAt: input.baseMarkedAt ?? null,
    localMarkedAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
    state: "pending",
  };
  const others = readOps().filter((existing) => existing.id !== op.id);
  saveOps([...others, op]);
  return op;
}

export function removeOp(id: string): void {
  saveOps(readOps().filter((op) => op.id !== id));
}

export function updateOp(id: string, patch: Partial<OutboxOp>): void {
  saveOps(readOps().map((op) => (op.id === id ? { ...op, ...patch } : op)));
}

export function clearOutbox(): void {
  const storage = store();
  storage?.removeItem(OUTBOX_KEY);
}

/** Overlay pending marks onto server records so the UI shows local edits. */
export function pendingMarksByEvent(): Map<string, Pick<OutboxOp, "status" | "attendedMinutes" | "note" | "localMarkedAt">> {
  const map = new Map<string, Pick<OutboxOp, "status" | "attendedMinutes" | "note" | "localMarkedAt">>();
  for (const op of readOps()) {
    if (op.state === "conflict") continue;
    map.set(op.eventId, {
      status: op.status,
      attendedMinutes: op.attendedMinutes,
      note: op.note,
      localMarkedAt: op.localMarkedAt,
    });
  }
  return map;
}

/**
 * Synchronize pending attendance marks. Uses optimistic concurrency:
 * `baseMarkedAt` must match the server row, otherwise the op is flagged as a
 * conflict and the user decides which value to keep. No silent overwrites.
 */
export async function syncOutbox(supabase: SupabaseClient, userId: string): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, conflicts: 0, failed: 0, remaining: 0, messages: [] };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    result.remaining = readOps().length;
    return result;
  }

  for (const op of readOps()) {
    if (op.state === "conflict") {
      result.conflicts += 1;
      continue;
    }
    const { data: server, error: readError } = await supabase
      .from("attendance_records")
      .select("id,status,marked_at")
      .eq("user_id", userId)
      .eq("event_id", op.eventId)
      .maybeSingle();

    if (readError) {
      updateOp(op.id, { attempts: op.attempts + 1, lastError: readError.message, state: "failed" });
      result.failed += 1;
      result.messages.push(`Could not read the server value for one class: ${readError.message}`);
      continue;
    }

    const serverMarkedAt = server?.marked_at ?? null;
    if (!op.forceOverwrite && server && (server.id !== op.baseRecordId || serverMarkedAt !== op.baseMarkedAt)) {
      updateOp(op.id, {
        state: "conflict",
        lastError: "This class was changed on another device after your offline edit.",
      });
      result.conflicts += 1;
      result.messages.push("One attendance mark conflicts with a newer change from another device. Review it in Settings → Sync.");
      continue;
    }

    const { error: writeError } = await supabase.from("attendance_records").upsert(
      {
        user_id: userId,
        event_id: op.eventId,
        status: op.status,
        attended_minutes: op.attendedMinutes,
        note: op.note,
        marked_at: op.localMarkedAt,
      },
      { onConflict: "user_id,event_id" },
    );
    if (writeError) {
      updateOp(op.id, { attempts: op.attempts + 1, lastError: writeError.message, state: "failed" });
      result.failed += 1;
      result.messages.push(`Could not sync one attendance mark: ${writeError.message}`);
      continue;
    }
    removeOp(op.id);
    result.synced += 1;
  }
  result.remaining = readOps().length;
  return result;
}

/** Resolve a conflict by keeping the local value, discarding it, or retrying. */
export function resolveConflict(opId: string, choice: "keep-local" | "discard-local"): void {
  if (choice === "discard-local") {
    removeOp(opId);
    return;
  }
  // The user explicitly chose the local value: allow exactly one overwrite,
  // still through the same idempotent upsert used for every other mark.
  updateOp(opId, {
    state: "pending", baseRecordId: null, baseMarkedAt: null, lastError: null,
    attempts: 0, forceOverwrite: true,
  });
}

/** Last successfully synchronized snapshot, used only while offline. */
export function writePrivateCache<T>(userId: string, key: string, value: T): void {
  if (!isOfflineCacheEnabled()) return;
  write(`${CACHE_PREFIX}${userId}.${key}`, { savedAt: new Date().toISOString(), value });
}

export function readPrivateCache<T>(userId: string, key: string): { savedAt: string; value: T } | null {
  if (!isOfflineCacheEnabled()) return null;
  return read<{ savedAt: string; value: T } | null>(`${CACHE_PREFIX}${userId}.${key}`, null);
}

export function clearPrivateCache(): void {
  const storage = store();
  if (!storage) return;
  try {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (key && key.startsWith(CACHE_PREFIX)) storage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

export function clearAllPrivateLocalData(): void {
  const storage = store();
  if (!storage) return;
  clearPrivateCache();
  storage.removeItem(NOTES_KEY);
  storage.removeItem(PRIORITY_KEY);
  storage.removeItem(OUTBOX_KEY);
}

/* ---- Device-local notes & assignment priority (no backend columns exist) ---- */
export function readJsonArray<T>(key: string): T[] {
  return read<T[]>(key, []);
}
export function writeJsonArray<T>(key: string, value: T[]): void {
  write(key, value);
}
export const NOTES_STORAGE_KEY = NOTES_KEY;
export const PRIORITY_STORAGE_KEY = PRIORITY_KEY;
