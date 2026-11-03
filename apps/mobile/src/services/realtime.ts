import type { QueryClient } from '@tanstack/react-query';
import { getSupabase } from '@/services/supabase/client';
import { QUERY_KEYS } from '@/constants';

/**
 * Realtime subscriptions. Supabase evaluates each table's SELECT RLS per user,
 * so a member only ever receives rows they are authorized to see (their own
 * attendance, shared group schedules, their own notifications).
 */
export function subscribeToSemester(
  queryClient: QueryClient,
  semesterId: string,
  userId: string,
): () => void {
  const supabase = getSupabase();
  const channel = supabase
    .channel(`semester:${semesterId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'calendar_events', filter: `semester_id=eq.${semesterId}` },
      () => {
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.events(semesterId) });
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.changeLog(semesterId) });
      },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'attendance_records', filter: `user_id=eq.${userId}` },
      () => {
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.attendance(semesterId) });
      },
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribeToNotifications(queryClient: QueryClient, userId: string): () => void {
  const supabase = getSupabase();
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      () => {
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications });
      },
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribeToGroup(queryClient: QueryClient, groupId: string): () => void {
  const supabase = getSupabase();
  const channel = supabase
    .channel(`group:${groupId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'group_members', filter: `group_id=eq.${groupId}` },
      () => {
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.group(groupId) });
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.groups });
      },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'calendar_polls', filter: `group_id=eq.${groupId}` },
      () => {
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.polls(groupId) });
      },
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
