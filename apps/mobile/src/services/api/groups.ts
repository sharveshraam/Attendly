import { getSupabase } from '@/services/supabase/client';
import type {
  CalendarEventRow,
  CalendarPollRow,
  CalendarPollVoteRow,
  GroupMemberRow,
  GroupRole,
  GroupRow,
} from '@/types/database';

export interface GroupWithRole extends GroupRow {
  role: GroupRole;
}

export async function fetchMyGroups(userId: string): Promise<GroupWithRole[]> {
  const { data, error } = await getSupabase()
    .from('group_members')
    .select('role, group:groups(*)')
    .eq('user_id', userId);
  if (error) throw error;
  const rows = (data ?? []) as unknown as { role: GroupRole; group: GroupRow | null }[];
  return rows
    .filter((r) => r.group !== null)
    .map((r) => ({ ...(r.group as GroupRow), role: r.role }));
}

export async function createGroup(name: string, userId: string): Promise<GroupRow> {
  // The DB trigger atomically adds the creator as owner.
  const { data, error } = await getSupabase()
    .from('groups')
    .insert({ name, created_by: userId })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function joinGroupByInvite(invite: string): Promise<string> {
  const { data, error } = await getSupabase().rpc('join_group_by_invite', { invite });
  if (error) throw error;
  return data;
}

export interface MemberWithProfile extends GroupMemberRow {
  display_name: string | null;
}

export async function fetchGroupMembers(groupId: string): Promise<MemberWithProfile[]> {
  // profiles RLS is self-select, so other members' display_name resolves to null
  // and is rendered as "Classmate". No cross-user private data is requested.
  const { data, error } = await getSupabase()
    .from('group_members')
    .select('*, profile:profiles(display_name)')
    .eq('group_id', groupId)
    .order('joined_at');
  if (error) throw error;
  const rows = (data ?? []) as unknown as (GroupMemberRow & { profile: { display_name: string | null } | null })[];
  return rows.map((r) => ({ ...r, display_name: r.profile?.display_name ?? null }));
}

export async function setMemberRole(groupId: string, userId: string, role: GroupRole): Promise<void> {
  const { error } = await getSupabase().rpc('set_group_member_role', {
    target_group: groupId,
    target_user: userId,
    target_role: role,
  });
  if (error) throw error;
}

export async function removeMember(groupId: string, userId: string): Promise<void> {
  const { error } = await getSupabase().from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
  if (error) throw error;
}

export async function fetchGroupEvents(groupId: string): Promise<CalendarEventRow[]> {
  const { data, error } = await getSupabase()
    .from('calendar_events')
    .select('*')
    .eq('group_id', groupId)
    .order('starts_at');
  if (error) throw error;
  return data ?? [];
}

export async function setEventVerification(
  eventId: string,
  status: CalendarEventRow['verification_status'],
  actorId: string,
): Promise<void> {
  const { error } = await getSupabase()
    .from('calendar_events')
    .update({ verification_status: status, updated_by: actorId, updated_at: new Date().toISOString() })
    .eq('id', eventId);
  if (error) throw error;
}

export async function fetchPolls(groupId: string): Promise<CalendarPollRow[]> {
  const { data, error } = await getSupabase()
    .from('calendar_polls')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createPoll(input: {
  group_id: string;
  created_by: string;
  title: string;
  options: string[];
  closes_at?: string | null;
}): Promise<CalendarPollRow> {
  const { data, error } = await getSupabase()
    .from('calendar_polls')
    .insert({ ...input, options: input.options as never })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function fetchPollVotes(pollIds: string[]): Promise<CalendarPollVoteRow[]> {
  if (pollIds.length === 0) return [];
  const { data, error } = await getSupabase().from('calendar_poll_votes').select('*').in('poll_id', pollIds);
  if (error) throw error;
  return data ?? [];
}

export async function votePoll(pollId: string, userId: string, optionIndex: number): Promise<void> {
  const { error } = await getSupabase()
    .from('calendar_poll_votes')
    .upsert({ poll_id: pollId, user_id: userId, option_index: optionIndex }, { onConflict: 'poll_id,user_id' });
  if (error) throw error;
}
