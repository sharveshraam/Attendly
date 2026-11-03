import { getSupabase } from '@/services/supabase/client';
import type { NotificationPreferencesRow, NotificationRow } from '@/types/database';

export async function fetchNotifications(limit = 100): Promise<NotificationRow[]> {
  const { data, error } = await getSupabase()
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) throw error;
}

export async function fetchNotificationPreferences(userId: string): Promise<NotificationPreferencesRow | null> {
  const { data, error } = await getSupabase()
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertNotificationPreferences(
  prefs: Omit<NotificationPreferencesRow, 'user_id'> & { user_id: string },
): Promise<void> {
  const { error } = await getSupabase()
    .from('notification_preferences')
    .upsert(prefs, { onConflict: 'user_id' });
  if (error) throw error;
}
