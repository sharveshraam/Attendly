import { getSupabase } from '@/services/supabase/client';
import type { CalendarEventRow, ScheduleChangeLogRow } from '@/types/database';

export async function fetchEvents(semesterId: string): Promise<CalendarEventRow[]> {
  const { data, error } = await getSupabase()
    .from('calendar_events')
    .select('*')
    .eq('semester_id', semesterId)
    .order('starts_at');
  if (error) throw error;
  return data ?? [];
}

export async function fetchUpcomingEvents(semesterId: string, limit = 50): Promise<CalendarEventRow[]> {
  const { data, error } = await getSupabase()
    .from('calendar_events')
    .select('*')
    .eq('semester_id', semesterId)
    .gte('starts_at', new Date().toISOString())
    .order('starts_at')
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export type EventInsert = {
  semester_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  created_by: string;
  kind?: CalendarEventRow['kind'];
  status?: CalendarEventRow['status'];
  course_id?: string | null;
  group_id?: string | null;
  location?: string | null;
  description?: string | null;
  source?: string;
  verification_status?: CalendarEventRow['verification_status'];
};

export async function createEvent(input: EventInsert): Promise<CalendarEventRow> {
  const { data, error } = await getSupabase().from('calendar_events').insert(input).select('*').single();
  if (error) throw error;
  return data;
}

export async function createEvents(inputs: EventInsert[]): Promise<CalendarEventRow[]> {
  if (inputs.length === 0) return [];
  const { data, error } = await getSupabase().from('calendar_events').insert(inputs).select('*');
  if (error) throw error;
  return data ?? [];
}

export async function updateEvent(
  id: string,
  patch: Partial<CalendarEventRow>,
  actorId: string,
): Promise<CalendarEventRow> {
  const { data, error } = await getSupabase()
    .from('calendar_events')
    .update({ ...patch, updated_by: actorId, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await getSupabase().from('calendar_events').delete().eq('id', id);
  if (error) throw error;
}

export async function logScheduleChange(input: {
  event_id?: string | null;
  semester_id: string;
  actor_id: string;
  action: string;
  before_data?: unknown;
  after_data?: unknown;
}): Promise<void> {
  const { error } = await getSupabase().from('schedule_change_log').insert({
    event_id: input.event_id ?? null,
    semester_id: input.semester_id,
    actor_id: input.actor_id,
    action: input.action,
    before_data: (input.before_data ?? null) as never,
    after_data: (input.after_data ?? null) as never,
  });
  if (error) throw error;
}

export async function fetchChangeLog(semesterId: string, limit = 50): Promise<ScheduleChangeLogRow[]> {
  const { data, error } = await getSupabase()
    .from('schedule_change_log')
    .select('*')
    .eq('semester_id', semesterId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
