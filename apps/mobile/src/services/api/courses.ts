import { getSupabase } from '@/services/supabase/client';
import type { CourseRow, TimetableRuleRow, AcademicDayRow } from '@/types/database';

export async function fetchCourses(semesterId: string): Promise<CourseRow[]> {
  const { data, error } = await getSupabase()
    .from('courses')
    .select('*')
    .eq('semester_id', semesterId)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function createCourse(input: {
  semester_id: string;
  name: string;
  code?: string | null;
  category?: string;
  attendance_target?: number | null;
  calculation_mode?: 'class_count' | 'hours';
  color?: string;
}): Promise<CourseRow> {
  const { data, error } = await getSupabase().from('courses').insert(input).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateCourse(id: string, patch: Partial<CourseRow>): Promise<CourseRow> {
  const { data, error } = await getSupabase().from('courses').update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteCourse(id: string): Promise<void> {
  const { error } = await getSupabase().from('courses').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchTimetableRules(semesterId: string): Promise<TimetableRuleRow[]> {
  const { data, error } = await getSupabase()
    .from('timetable_rules')
    .select('*')
    .eq('semester_id', semesterId)
    .order('weekday');
  if (error) throw error;
  return data ?? [];
}

export async function createTimetableRule(input: {
  semester_id: string;
  course_id: string;
  weekday: number;
  starts_at: string;
  ends_at: string;
  location?: string | null;
  valid_from?: string | null;
  valid_until?: string | null;
}): Promise<TimetableRuleRow> {
  const { data, error } = await getSupabase().from('timetable_rules').insert(input).select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteTimetableRule(id: string): Promise<void> {
  const { error } = await getSupabase().from('timetable_rules').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchAcademicDays(semesterId: string): Promise<AcademicDayRow[]> {
  const { data, error } = await getSupabase()
    .from('academic_days')
    .select('*')
    .eq('semester_id', semesterId)
    .order('day');
  if (error) throw error;
  return data ?? [];
}

export async function upsertAcademicDays(
  rows: { semester_id: string; day: string; kind: AcademicDayRow['kind']; title?: string | null; notes?: string | null }[],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await getSupabase()
    .from('academic_days')
    .upsert(rows, { onConflict: 'semester_id,day' });
  if (error) throw error;
}
