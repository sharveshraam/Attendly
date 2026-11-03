import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants';
import { useOfflineQuery } from './useOfflineQuery';
import { useAuth } from './useAuth';
import {
  createGroup,
  fetchGroupEvents,
  fetchGroupMembers,
  fetchMyGroups,
  fetchPolls,
  joinGroupByInvite,
  type GroupWithRole,
} from '@/services/api/groups';

export function useGroups() {
  const { user } = useAuth();
  return useOfflineQuery<GroupWithRole[]>(QUERY_KEYS.groups, () => fetchMyGroups(user!.id), {
    enabled: Boolean(user),
  });
}

export function useGroupMembers(groupId: string | null) {
  return useOfflineQuery(
    [...QUERY_KEYS.group(groupId ?? 'none'), 'members'] as const,
    () => fetchGroupMembers(groupId!),
    { enabled: Boolean(groupId) },
  );
}

export function useGroupEvents(groupId: string | null) {
  return useOfflineQuery(
    [...QUERY_KEYS.group(groupId ?? 'none'), 'events'] as const,
    () => fetchGroupEvents(groupId!),
    { enabled: Boolean(groupId) },
  );
}

export function useGroupPolls(groupId: string | null) {
  return useOfflineQuery(QUERY_KEYS.polls(groupId ?? 'none'), () => fetchPolls(groupId!), {
    enabled: Boolean(groupId),
  });
}

export function useCreateGroup() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createGroup(name, user!.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.groups }),
  });
}

export function useJoinGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invite: string) => joinGroupByInvite(invite),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.groups }),
  });
}
