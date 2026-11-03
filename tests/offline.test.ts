import test from "node:test";
import assert from "node:assert/strict";

class MemoryStorage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  key(index: number) { return [...this.map.keys()][index] ?? null; }
  getItem(key: string) { return this.map.get(key) ?? null; }
  setItem(key: string, value: string) { this.map.set(key, value); }
  removeItem(key: string) { this.map.delete(key); }
  clear() { this.map.clear(); }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, "window", { value: { localStorage: storage }, configurable: true, writable: true });
Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true, writable: true });

const {
  enqueueAttendance, readOps, removeOp, pendingMarksByEvent, syncOutbox, resolveConflict,
  readPrivateCache, writePrivateCache, clearPrivateCache, clearAllPrivateLocalData,
  isOfflineCacheEnabled, setOfflineCacheEnabled, readJsonArray, writeJsonArray,
} = await import("../lib/offline.ts");

interface ServerRow { id: string; status: string; marked_at: string | null }
function fakeClient(rows: Map<string, ServerRow>, options: { readError?: string; writeError?: string } = {}) {
  const builder = (table: string) => {
    let filters: Record<string, string> = {};
    const chain: Record<string, unknown> = {
      select() { return chain; },
      eq(column: string, value: string) { filters[column] = value; return chain; },
      async maybeSingle() {
        if (options.readError) return { data: null, error: { message: options.readError } };
        const key = filters.event_id;
        return { data: key && rows.has(key) ? rows.get(key) : null, error: null };
      },
      async upsert(payload: Record<string, unknown>) {
        if (options.writeError) return { data: null, error: { message: options.writeError } };
        const key = String(payload.event_id);
        rows.set(key, {
          id: rows.get(key)?.id ?? `server-${key}`,
          status: String(payload.status),
          marked_at: String(payload.marked_at),
        });
        return { data: null, error: null };
      },
      table,
    };
    return chain;
  };
  return { from: (table: string) => builder(table) };
}

function reset() {
  clearAllPrivateLocalData();
  setOfflineCacheEnabled(true);
}

test("enqueue is idempotent per event and overlays the latest mark", () => {
  reset();
  enqueueAttendance({ eventId: "e1", status: "present" });
  enqueueAttendance({ eventId: "e1", status: "absent" });
  enqueueAttendance({ eventId: "e2", status: "excused" });
  assert.equal(readOps().length, 2);
  assert.equal(pendingMarksByEvent().get("e1")?.status, "absent");
  assert.equal(pendingMarksByEvent().get("e2")?.status, "excused");
});

test("no server row and no base version syncs successfully", async () => {
  reset();
  const rows = new Map<string, ServerRow>();
  enqueueAttendance({ eventId: "e1", status: "present" });
  const result = await syncOutbox(fakeClient(rows) as never, "u1");
  assert.equal(result.synced, 1);
  assert.equal(result.remaining, 0);
  assert.equal(rows.get("e1")?.status, "present");
});

test("read errors keep the operation for retry", async () => {
  reset();
  enqueueAttendance({ eventId: "e1", status: "present" });
  const result = await syncOutbox(fakeClient(new Map(), { readError: "network down" }) as never, "u1");
  assert.equal(result.failed, 1);
  assert.equal(readOps()[0]?.state, "failed");
  assert.equal(readOps()[0]?.attempts, 1);
});

test("a newer server value is never silently overwritten", async () => {
  reset();
  const rows = new Map<string, ServerRow>([["e1", { id: "other-device", status: "absent", marked_at: "2026-11-02T10:00:00Z" }]]);
  enqueueAttendance({ eventId: "e1", status: "present", baseRecordId: "old", baseMarkedAt: "2026-11-01T10:00:00Z" });
  const result = await syncOutbox(fakeClient(rows) as never, "u1");
  assert.equal(result.conflicts, 1);
  assert.equal(result.synced, 0);
  assert.equal(rows.get("e1")?.status, "absent");
  assert.equal(readOps()[0]?.state, "conflict");
  assert.equal(pendingMarksByEvent().has("e1"), false);
});

test("keep-local requires an explicit choice and then overwrites once", async () => {
  reset();
  const rows = new Map<string, ServerRow>([["e1", { id: "x", status: "absent", marked_at: "old" }]]);
  enqueueAttendance({ eventId: "e1", status: "present", baseRecordId: "y", baseMarkedAt: "older" });
  await syncOutbox(fakeClient(rows) as never, "u1");
  assert.equal(rows.get("e1")?.status, "absent", "resolution has not happened yet");
  resolveConflict("attendance:e1", "keep-local");
  assert.equal(readOps()[0]?.forceOverwrite, true);
  const result = await syncOutbox(fakeClient(rows) as never, "u1");
  assert.equal(result.synced, 1);
  assert.equal(result.conflicts, 0);
  assert.equal(rows.get("e1")?.status, "present");
  assert.equal(rows.size, 1, "idempotent upsert does not create duplicates");
  assert.equal(readOps().length, 0);
});

test("discard-local removes the queued edit", async () => {
  reset();
  enqueueAttendance({ eventId: "e1", status: "present" });
  resolveConflict("attendance:e1", "discard-local");
  assert.equal(readOps().length, 0);
});

test("offline status prevents all writes and leaves the queue intact", async () => {
  reset();
  const rows = new Map<string, ServerRow>();
  enqueueAttendance({ eventId: "e1", status: "present" });
  Object.defineProperty(globalThis, "navigator", { value: { onLine: false }, configurable: true, writable: true });
  const result = await syncOutbox(fakeClient(rows) as never, "u1");
  Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true, writable: true });
  assert.equal(result.synced, 0);
  assert.equal(result.remaining, 1);
  assert.equal(rows.size, 0);
});

test("private cache is per user and can be disabled", () => {
  reset();
  writePrivateCache("u1", "snapshot", { courses: 2 });
  writePrivateCache("u2", "snapshot", { courses: 9 });
  assert.deepEqual(readPrivateCache<{ courses: number }>("u1", "snapshot")?.value, { courses: 2 });
  assert.deepEqual(readPrivateCache<{ courses: number }>("u2", "snapshot")?.value, { courses: 9 });
  assert.equal(readPrivateCache("u3", "snapshot"), null);
  assert.equal(isOfflineCacheEnabled(), true);
  setOfflineCacheEnabled(false);
  assert.equal(isOfflineCacheEnabled(), false);
  assert.equal(readPrivateCache("u1", "snapshot"), null);
  setOfflineCacheEnabled(true);
  assert.equal(readPrivateCache("u1", "snapshot"), null, "disabling clears cached data");
});

test("clearAllPrivateLocalData removes notes, priorities, cache and outbox", () => {
  reset();
  writeJsonArray("attendly.notes.v1", [{ id: "n1" }]);
  writeJsonArray("attendly.priority.v1", [{ id: "p1" }]);
  writePrivateCache("u1", "snapshot", { a: 1 });
  enqueueAttendance({ eventId: "e1", status: "present" });
  clearAllPrivateLocalData();
  assert.equal(readJsonArray("attendly.notes.v1").length, 0);
  assert.equal(readJsonArray("attendly.priority.v1").length, 0);
  assert.equal(readOps().length, 0);
  assert.equal(readPrivateCache("u1", "snapshot"), null);
});

test("removeOp deletes only the intended operation", () => {
  reset();
  enqueueAttendance({ eventId: "e1", status: "present" });
  enqueueAttendance({ eventId: "e2", status: "absent" });
  removeOp("attendance:e1");
  assert.deepEqual(readOps().map((op) => op.eventId), ["e2"]);
});

test("clearPrivateCache does not discard pending edits", () => {
  reset();
  enqueueAttendance({ eventId: "e1", status: "present" });
  writePrivateCache("u1", "snapshot", { x: 1 });
  clearPrivateCache();
  assert.equal(readOps().length, 1);
});
