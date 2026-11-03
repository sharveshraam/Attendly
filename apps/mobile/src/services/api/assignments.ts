import { getSupabase } from '@/services/supabase/client';
import type { AssignmentRow, AssignmentStatus } from '@/types/database';

export async function fetchAssignments(semesterId: string): Promise<AssignmentRow[]> {
  const { data, error } = await getSupabase()
    .from('assignments')
    .select('*')
    .eq('semester_id', semesterId)
    .order('due_at', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function createAssignment(input: {
  owner_id: string;
  semester_id: string;
  title: string;
  description?: string | null;
  course_id?: string | null;
  due_at?: string | null;
  status?: AssignmentStatus;
}): Promise<AssignmentRow> {
  const { data, error } = await getSupabase().from('assignments').insert(input).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateAssignment(id: string, patch: Partial<AssignmentRow>): Promise<AssignmentRow> {
  const { data, error } = await getSupabase().from('assignments').update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteAssignment(id: string): Promise<void> {
  const { error } = await getSupabase().from('assignments').delete().eq('id', id);
  if (error) throw error;
}
