import { getSupabase } from '@/services/supabase/client';
import type { ProfileRow } from '@/types/database';

export async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await getSupabase().from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateProfile(
  userId: string,
  patch: { display_name?: string; timezone?: string },
): Promise<ProfileRow> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function ensureProfile(userId: string, displayName: string): Promise<void> {
  const supabase = getSupabase();
  const { data } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
  if (!data) {
    await supabase.from('profiles').insert({ id: userId, display_name: displayName });
  }
}
