import NetInfo from '@react-native-community/netinfo';
import {
  baseVersionOf,
  conflictCount,
  listOps,
  markOpConflict,
  markOpFailed,
  pendingCount,
  removeOp,
} from '@/database/outbox';
import { cacheSet } from '@/database/cache';
import { STORAGE_KEYS } from '@/constants';
import { useSyncStore } from '@/store/useSyncStore';
import { getSupabase } from '@/services/supabase/client';
import { upsertAttendance } from '@/services/api/attendance';
import { createEvent, logScheduleChange, updateEvent } from '@/services/api/events';
import { createAssignment, updateAssignment } from '@/services/api/assignments';
import type { OutboxOp } from '@/types/domain';
import type { AttendanceStatus, CalendarEventRow } from '@/types/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MAX_AUTO_ATTEMPTS = 5;

function refreshCounts(): void {
  useSyncStore.getState().setCounts(pendingCount(), conflictCount());
}

/**
 * Replay one outbox operation. Returns true when the op is resolved (removed),
 * false when it remains queued (failed/conflict). Conflict detection compares
 * the server's current version against the version captured at enqueue time so
 * stale local edits never silently overwrite newer server data.
 */
async function applyOp(op: OutboxOp): Promise<boolean> {
  const supabase = getSupabase();
  const base = baseVersionOf(op.id);
  const payload = op.payload as Record<string, unknown>;

  switch (op.kind) {
    case 'attendance.upsert': {
      const userId = payload.user_id as string;
      const eventId = payload.event_id as string;
      const { data: server } = await supabase
        .from('attendance_records')
        .select('marked_at')
        .eq('user_id', userId)
        .eq('event_id', eventId)
        .maybeSingle();
      const serverVersion = server?.marked_at ?? null;
      const reference = base ?? op.createdAt;
      if (serverVersion && serverVersion > reference) {
        markOpConflict(op.id, 'This attendance was updated on another device after your edit.');
        return false;
      }
      await upsertAttendance({
        user_id: userId,
        event_id: eventId,
        status: payload.status as AttendanceStatus,
        attended_minutes: (payload.attended_minutes as number | null) ?? null,
        note: (payload.note as string | null) ?? null,
      });
      removeOp(op.id);
      return true;
    }

    case 'event.update': {
      const id = payload.id as string;
      const actorId = payload.actor_id as string;
      const patch = payload.patch as Partial<CalendarEventRow>;
      const { data: server } = await supabase
        .from('calendar_events')
        .select('updated_at')
        .eq('id', id)
        .maybeSingle();
      if (server && base && server.updated_at > base) {
        markOpConflict(op.id, 'This event changed on the server after your edit.');
        return false;
      }
      const updated = await updateEvent(id, patch, actorId);
      await logScheduleChange({
        event_id: id,
        semester_id: updated.semester_id,
        actor_id: actorId,
        action: (payload.action as string) ?? 'update',
        before_data: payload.before_data ?? null,
        after_data: updated,
      });
      removeOp(op.id);
      return true;
    }

    case 'event.insert': {
      const input = payload as unknown as Parameters<typeof createEvent>[0];
      // Idempotency: skip if an identical class session already exists.
      if (input.course_id) {
        const { data: existing } = await supabase
          .from('calendar_events')
          .select('id')
          .eq('semester_id', input.semester_id)
          .eq('course_id', input.course_id)
          .eq('starts_at', input.starts_at)
          .maybeSingle();
        if (existing) {
          removeOp(op.id);
          return true;
        }
      }
      await createEvent(input);
      removeOp(op.id);
      return true;
    }

    case 'assignment.upsert': {
      const id = payload.id as string | undefined;
      if (id) {
        const { id: _omit, ...patch } = payload;
        void _omit;
        await updateAssignment(id, patch as never);
      } else {
        await createAssignment(payload as never);
      }
      removeOp(op.id);
      return true;
    }

    default:
      markOpFailed(op.id, `Unknown operation kind: ${op.kind}`);
      return false;
  }
}

/** Process all pending ops. Safe to call repeatedly; guarded against overlap. */
export async function processOutbox(): Promise<void> {
  const store = useSyncStore.getState();
  if (store.isSyncing) return;
  if (!store.isOnline) {
    refreshCounts();
    return;
  }
  store.setSyncing(true);
  store.setLastError(null);
  try {
    const ops = listOps('pending').concat(listOps('failed').filter((o) => o.attempts < MAX_AUTO_ATTEMPTS));
    for (const op of ops) {
      try {
        await applyOp(op);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        markOpFailed(op.id, message);
        useSyncStore.getState().setLastError(message);
      }
    }
    const now = new Date().toISOString();
    useSyncStore.getState().setLastSync(now);
    void AsyncStorage.setItem(STORAGE_KEYS.lastSyncAt, now);
    cacheSet('sync.lastRun', now);
  } finally {
    useSyncStore.getState().setSyncing(false);
    refreshCounts();
  }
}

export function retryConflictedOp(id: string): void {
  // Re-queue a conflict for another attempt (user chose to keep local edit).
  const { retryOp } = require('@/database/outbox') as typeof import('@/database/outbox');
  retryOp(id);
  refreshCounts();
  void processOutbox();
}

export function discardOp(id: string): void {
  removeOp(id);
  refreshCounts();
}

/** Subscribe to connectivity; flush the outbox when the network returns. */
export function startSyncListener(): () => void {
  const unsubscribe = NetInfo.addEventListener((state) => {
    const online = Boolean(state.isConnected && state.isInternetReachable !== false);
    const wasOffline = !useSyncStore.getState().isOnline;
    useSyncStore.getState().setOnline(online);
    if (online && wasOffline) {
      void processOutbox();
    }
  });
  // Initial state + opportunistic flush.
  void NetInfo.fetch().then((state) => {
    const online = Boolean(state.isConnected && state.isInternetReachable !== false);
    useSyncStore.getState().setOnline(online);
    if (online) void processOutbox();
  });
  return unsubscribe;
}

export function initSyncCounts(): void {
  refreshCounts();
  void AsyncStorage.getItem(STORAGE_KEYS.lastSyncAt).then((value) => {
    if (value) useSyncStore.getState().setLastSync(value);
  });
}
