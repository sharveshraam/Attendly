import { useMutation } from '@tanstack/react-query';
import { enqueueOp } from '@/database/outbox';
import { processOutbox } from '@/services/sync';
import { useAuth } from './useAuth';
import { useInvalidateSemester } from './useAcademicData';
import type { AttendanceStatus } from '@/types/database';

export interface MarkAttendanceInput {
  eventId: string;
  status: AttendanceStatus;
  attendedMinutes?: number | null;
  note?: string | null;
  /** marked_at of the record the user saw, for conflict detection. */
  baseVersion?: string | null;
}

/**
 * Mark attendance offline-first: enqueue a durable op, then attempt to sync.
 * When offline the op stays queued and the session overlay reflects it
 * immediately; it replays automatically on reconnect.
 */
export function useMarkAttendance(semesterId: string | null) {
  const { user } = useAuth();
  const invalidate = useInvalidateSemester(semesterId);
  return useMutation({
    mutationFn: async (input: MarkAttendanceInput) => {
      if (!user) throw new Error('You must be signed in to mark attendance.');
      enqueueOp(
        'attendance.upsert',
        {
          user_id: user.id,
          event_id: input.eventId,
          status: input.status,
          attended_minutes: input.attendedMinutes ?? null,
          note: input.note ?? null,
        },
        input.baseVersion ?? null,
      );
      await processOutbox();
    },
    onSuccess: () => invalidate(),
  });
}
