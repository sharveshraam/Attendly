import { getSupabase } from '@/services/supabase/client';
import type { SemesterRow } from '@/types/database';

export async function fetchSemesters(userId: string): Promise<SemesterRow[]> {
  const { data, error } = await getSupabase()
    .from('semesters')
    .select('*')
    .eq('owner_id', userId)
    .order('start_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createSemester(input: {
  owner_id: string;
  name: string;
  institution?: string | null;
  start_date: string;
  end_date?: string | null;
  attendance_target: number;
  prediction_mode: 'fixed' | 'rolling';
  group_id?: string | null;
}): Promise<SemesterRow> {
  const { data, error } = await getSupabase().from('semesters').insert(input).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateSemester(id: string, patch: Partial<SemesterRow>): Promise<SemesterRow> {
  const { data, error } = await getSupabase().from('semesters').update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteSemester(id: string): Promise<void> {
  const { error } = await getSupabase().from('semesters').delete().eq('id', id);
  if (error) throw error;
}
