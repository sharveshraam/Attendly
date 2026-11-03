import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, EmptyState, Loading, Screen, Text } from '@/components/ui';
import { useGroups } from '@/hooks/useGroups';
import { useTheme } from '@/theme';

export default function Groups() {
  const router = useRouter();
  const { theme } = useTheme();
  const groupsQuery = useGroups();
  const groups = groupsQuery.data ?? [];

  return (
    <Screen contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text variant="headline" weight="bold">Groups</Text>
        <View style={styles.headerActions}>
          <Button label="Join" icon="enter-outline" size="sm" variant="secondary" onPress={() => router.push('/groups/join')} />
          <Button label="Create" icon="add" size="sm" onPress={() => router.push('/groups/new')} />
        </View>
      </View>

      <Card style={styles.privacyCard}>
        <Ionicons name="lock-closed-outline" size={18} color={theme.colors.secondary} />
        <Text variant="caption" tone="secondary" style={styles.flex}>
          Groups share academic schedules only. Your personal attendance and analytics stay private —
          enforced by database row-level security, not just the UI.
        </Text>
      </Card>

      {groupsQuery.isLoading ? (
        <Loading label="Loading groups…" />
      ) : groups.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="No groups yet"
          message="Create a group for your class or join one with an invite code to share timetables."
          actionLabel="Create a group"
          onAction={() => router.push('/groups/new')}
        />
      ) : (
        groups.map((group) => (
          <Card key={group.id} onPress={() => router.push(`/groups/${group.id}`)} style={styles.groupCard}>
            <View style={styles.groupRow}>
              <View style={[styles.groupIcon, { backgroundColor: theme.colors.primarySoft }]}>
                <Ionicons name="people" size={20} color={theme.colors.primary} />
              </View>
              <View style={styles.flex}>
                <Text variant="body" weight="semiBold">{group.name}</Text>
                <Text variant="caption" tone="secondary">Invite code: {group.invite_code}</Text>
              </View>
              <Badge label={group.role} tone={group.role === 'owner' ? 'primary' : group.role === 'admin' ? 'info' : 'neutral'} />
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerActions: { flexDirection: 'row', gap: 8 },
  privacyCard: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  flex: { flex: 1 },
  groupCard: { marginBottom: 0 },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  groupIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
