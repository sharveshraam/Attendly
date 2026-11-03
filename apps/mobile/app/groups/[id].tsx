import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, EmptyState, Input, Loading, Screen, SectionHeader, Text } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useGroupEvents, useGroupMembers, useGroupPolls, useGroups } from '@/hooks/useGroups';
import { createPoll, fetchPollVotes, removeMember, setEventVerification, setMemberRole, votePoll } from '@/services/api/groups';
import { subscribeToGroup } from '@/services/realtime';
import { QUERY_KEYS, APP_SCHEME } from '@/constants';
import { formatDate, formatRange } from '@/lib/dates';
import { useTheme } from '@/theme';
import type { CalendarPollRow, GroupRole } from '@/types/database';

export default function GroupDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const groupsQuery = useGroups();
  const membersQuery = useGroupMembers(id);
  const eventsQuery = useGroupEvents(id);
  const pollsQuery = useGroupPolls(id);
  const [pollTitle, setPollTitle] = useState('');
  const [pollOptions, setPollOptions] = useState('');
  const [showPollForm, setShowPollForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [votes, setVotes] = useState<Record<string, number[]>>({});

  const group = (groupsQuery.data ?? []).find((g) => g.id === id);
  const members = membersQuery.data ?? [];
  const events = eventsQuery.data ?? [];
  const polls = pollsQuery.data ?? [];
  const myRole: GroupRole | undefined = group?.role;
  const canManage = myRole === 'owner' || myRole === 'admin';

  useEffect(() => {
    if (!id) return;
    return subscribeToGroup(queryClient, id);
  }, [id, queryClient]);

  useEffect(() => {
    let active = true;
    async function loadVotes() {
      if (polls.length === 0) return;
      const all = await fetchPollVotes(polls.map((p) => p.id));
      if (!active) return;
      const map: Record<string, number[]> = {};
      for (const poll of polls) {
        const pollVotes = all.filter((v) => v.poll_id === poll.id);
        const options = (poll.options as string[]) ?? [];
        map[poll.id] = options.map((_, i) => pollVotes.filter((v) => v.option_index === i).length);
      }
      setVotes(map);
    }
    void loadVotes();
    return () => { active = false; };
  }, [polls]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.group(id) });
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.polls(id) });
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.groups });
  };

  const shareInvite = async () => {
    if (!group) return;
    await Share.share({
      message: `Join my Attendly group "${group.name}" with code ${group.invite_code} (${APP_SCHEME}://groups/join?code=${group.invite_code})`,
    });
  };

  const changeRole = async (userId: string, role: GroupRole) => {
    setError(null);
    try {
      await setMemberRole(id, userId, role);
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the role.');
    }
  };

  const kick = async (userId: string) => {
    await removeMember(id, userId);
    invalidate();
  };

  const leave = async () => {
    if (!user) return;
    await removeMember(id, user.id);
    router.replace('/(tabs)/groups');
  };

  const approve = async (eventId: string, status: 'confirmed' | 'rejected') => {
    if (!user) return;
    await setEventVerification(eventId, status, user.id);
    invalidate();
  };

  const addPoll = async () => {
    if (!user || !pollTitle.trim()) return;
    const options = pollOptions.split('\n').map((o) => o.trim()).filter(Boolean);
    if (options.length < 2) {
      setError('Add at least two options (one per line).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createPoll({ group_id: id, created_by: user.id, title: pollTitle.trim(), options });
      setPollTitle('');
      setPollOptions('');
      setShowPollForm(false);
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the poll.');
    } finally {
      setBusy(false);
    }
  };

  const castVote = async (pollId: string, index: number) => {
    if (!user) return;
    await votePoll(pollId, user.id, index);
    invalidate();
  };

  if (groupsQuery.isLoading) return <Loading />;
  if (!group) {
    return (
      <Screen contentContainerStyle={styles.empty}>
        <EmptyState icon="people-outline" title="Group not found" actionLabel="Back" onAction={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <View style={styles.flex}>
          <Text variant="title" weight="bold" numberOfLines={1}>{group.name}</Text>
          <Text variant="caption" tone="secondary">{members.length} members · you are {myRole}</Text>
        </View>
      </View>

      <Card style={styles.inviteCard}>
        <View style={styles.flex}>
          <Text variant="caption" tone="secondary">Invite code</Text>
          <Text variant="title" weight="bold" style={styles.inviteCode}>{group.invite_code}</Text>
        </View>
        <Button label="Share" icon="share-outline" size="sm" variant="secondary" onPress={shareInvite} />
      </Card>

      <Card style={styles.privacyCard}>
        <Ionicons name="lock-closed-outline" size={16} color={theme.colors.secondary} />
        <Text variant="caption" tone="secondary" style={styles.flex}>
          Only schedules are shared. No member can read another's attendance or private analytics.
        </Text>
      </Card>

      {error ? <Text variant="small" tone="danger">{error}</Text> : null}

      <SectionHeader title="Members" />
      <Card padded={false}>
        {members.map((member, index) => (
          <View key={member.user_id} style={[styles.memberRow, { borderBottomColor: theme.colors.border, borderBottomWidth: index < members.length - 1 ? StyleSheet.hairlineWidth : 0 }]}>
            <View style={[styles.memberAvatar, { backgroundColor: theme.colors.surfaceSecondary }]}>
              <Ionicons name="person" size={16} color={theme.colors.textSecondary} />
            </View>
            <View style={styles.flex}>
              <Text variant="small" weight="medium">
                {member.user_id === user?.id ? 'You' : member.display_name ?? 'Classmate'}
              </Text>
            </View>
            <Badge label={member.role} tone={member.role === 'owner' ? 'primary' : member.role === 'admin' ? 'info' : 'neutral'} />
            {myRole === 'owner' && member.user_id !== user?.id && member.role !== 'owner' ? (
              <View style={styles.memberActions}>
                <Pressable onPress={() => changeRole(member.user_id, member.role === 'admin' ? 'member' : 'admin')} hitSlop={6} accessibilityLabel="Toggle admin">
                  <Ionicons name={member.role === 'admin' ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'} size={18} color={theme.colors.primary} />
                </Pressable>
                <Pressable onPress={() => kick(member.user_id)} hitSlop={6} accessibilityLabel="Remove member">
                  <Ionicons name="person-remove-outline" size={18} color={theme.colors.danger} />
                </Pressable>
              </View>
            ) : null}
          </View>
        ))}
      </Card>

      <SectionHeader title="Shared schedule" />
      {events.length === 0 ? (
        <Card><Text variant="small" tone="secondary">No shared events yet. Group-linked semesters publish their schedule here.</Text></Card>
      ) : (
        events.slice(0, 20).map((event) => (
          <Card key={event.id} style={styles.eventCard}>
            <View style={styles.eventRow}>
              <View style={styles.flex}>
                <Text variant="small" weight="semiBold">{event.title}</Text>
                <Text variant="caption" tone="secondary">{formatDate(event.starts_at)} · {formatRange(event.starts_at, event.ends_at)}</Text>
              </View>
              <Badge
                label={event.verification_status}
                tone={event.verification_status === 'confirmed' ? 'success' : event.verification_status === 'proposed' ? 'warning' : event.verification_status === 'rejected' ? 'danger' : 'neutral'}
              />
            </View>
            {canManage && event.verification_status === 'proposed' ? (
              <View style={styles.approveRow}>
                <Button label="Approve" size="sm" onPress={() => approve(event.id, 'confirmed')} />
                <Button label="Reject" size="sm" variant="secondary" onPress={() => approve(event.id, 'rejected')} />
              </View>
            ) : null}
          </Card>
        ))
      )}

      <SectionHeader title="Polls" actionLabel={showPollForm ? 'Close' : 'New poll'} onAction={() => setShowPollForm((s) => !s)} />
      {showPollForm ? (
        <Card style={styles.pollForm}>
          <Input label="Question" value={pollTitle} onChangeText={setPollTitle} placeholder="e.g. When should we hold the review class?" />
          <Input label="Options (one per line)" value={pollOptions} onChangeText={setPollOptions} placeholder={'Monday 4pm\nTuesday 5pm'} multiline numberOfLines={3} />
          <Button label="Create poll" loading={busy} onPress={addPoll} />
        </Card>
      ) : null}
      {polls.length === 0 ? (
        <Card><Text variant="small" tone="secondary">No polls yet. Create one to coordinate with the group.</Text></Card>
      ) : (
        polls.map((poll) => <PollCard key={poll.id} poll={poll} counts={votes[poll.id] ?? []} onVote={(i) => castVote(poll.id, i)} />)
      )}

      {myRole !== 'owner' ? (
        <Button label="Leave group" icon="exit-outline" variant="secondary" fullWidth onPress={leave} />
      ) : null}
    </Screen>
  );
}

function PollCard({ poll, counts, onVote }: { poll: CalendarPollRow; counts: number[]; onVote: (index: number) => void }) {
  const { theme } = useTheme();
  const options = (poll.options as string[]) ?? [];
  const total = counts.reduce((a, b) => a + b, 0);
  return (
    <Card style={styles.pollCard}>
      <Text variant="body" weight="semiBold">{poll.title}</Text>
      {options.map((option, i) => {
        const count = counts[i] ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <Pressable key={i} onPress={() => onVote(i)} style={styles.pollOption} accessibilityRole="button">
            <View style={[styles.pollBar, { width: `${pct}%`, backgroundColor: theme.colors.primarySoft }]} />
            <Text variant="small" style={styles.pollLabel}>{option}</Text>
            <Text variant="caption" tone="secondary">{count}</Text>
          </Pressable>
        );
      })}
      <Text variant="caption" tone="tertiary">{total} votes</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, paddingTop: 12 },
  empty: { flexGrow: 1, justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  inviteCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  inviteCode: { letterSpacing: 2 },
  privacyCard: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  memberAvatar: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  memberActions: { flexDirection: 'row', gap: 8 },
  eventCard: { gap: 8, marginBottom: 0 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  approveRow: { flexDirection: 'row', gap: 8 },
  pollForm: { gap: 12 },
  pollCard: { gap: 8, marginBottom: 0 },
  pollOption: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, overflow: 'hidden', backgroundColor: 'transparent' },
  pollBar: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 10 },
  pollLabel: { flex: 1 },
});
