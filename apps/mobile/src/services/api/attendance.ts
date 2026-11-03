import { getSupabase } from '@/services/supabase/client';
import type { AttendanceRecordRow, AttendanceStatus } from '@/types/database';

export async function fetchAttendance(userId: string, eventIds: string[]): Promise<AttendanceRecordRow[]> {
  if (eventIds.length === 0) return [];
  const { data, error } = await getSupabase()
    .from('attendance_records')
    .select('*')
    .eq('user_id', userId)
    .in('event_id', eventIds);
  if (error) throw error;
  return data ?? [];
}

export async function upsertAttendance(input: {
  user_id: string;
  event_id: string;
  status: AttendanceStatus;
  attended_minutes?: number | null;
  note?: string | null;
}): Promise<AttendanceRecordRow> {
  const { data, error } = await getSupabase()
    .from('attendance_records')
    .upsert(
      {
        user_id: input.user_id,
        event_id: input.event_id,
        status: input.status,
        attended_minutes: input.attended_minutes ?? null,
        note: input.note ?? null,
        marked_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,event_id' },
    )
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAttendance(userId: string, eventId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('attendance_records')
    .delete()
    .eq('user_id', userId)
    .eq('event_id', eventId);
  if (error) throw error;
}
