import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, EmptyState, Screen, Text } from '@/components/ui';
import { useSyncStore } from '@/store/useSyncStore';
import { listOps, retryOp } from '@/database/outbox';
import { discardOp, processOutbox } from '@/services/sync';
import { relativeDayLabel } from '@/lib/dates';
import { useTheme } from '@/theme';
import type { OutboxOp } from '@/types/domain';

const KIND_LABEL: Record<string, string> = {
  'attendance.upsert': 'Attendance mark',
  'event.update': 'Schedule edit',
  'event.insert': 'New class',
  'assignment.upsert': 'Assignment',
};

export default function SyncSettings() {
  const { theme } = useTheme();
  const { isOnline, isSyncing, pending, conflicts, lastSyncAt, lastError } = useSyncStore();
  const [ops, setOps] = useState<OutboxOp[]>(() => listOps());
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => setOps(listOps()), []);

  const syncNow = async () => {
    setBusy(true);
    await processOutbox();
    refresh();
    setBusy(false);
  };

  const retry = (id: string) => {
    retryOp(id);
    void processOutbox().then(refresh);
  };

  const discard = (id: string) => {
    discardOp(id);
    refresh();
  };

  return (
    <Screen contentContainerStyle={styles.container}>
      <Text variant="headline" weight="bold">Sync & offline</Text>

      <Card style={styles.statusCard}>
        <View style={[styles.statusIcon, { backgroundColor: isOnline ? theme.colors.successSoft : theme.colors.warningSoft }]}>
          <Ionicons name={isOnline ? 'cloud-done-outline' : 'cloud-offline-outline'} size={22} color={isOnline ? theme.colors.success : theme.colors.warning} />
        </View>
        <View style={styles.flex}>
          <Text variant="subtitle" weight="semiBold">{isOnline ? 'Online' : 'Offline'}</Text>
          <Text variant="caption" tone="secondary">
            {lastSyncAt ? `Last synced ${relativeDayLabel(lastSyncAt).toLowerCase()}` : 'Not synced yet'}
            {isSyncing ? ' · syncing…' : ''}
          </Text>
        </View>
        <Button label="Sync now" size="sm" loading={busy || isSyncing} onPress={syncNow} disabled={!isOnline} />
      </Card>

      <View style={styles.statsRow}>
        <Card style={styles.stat}>
          <Text variant="headline" weight="bold">{pending}</Text>
          <Text variant="caption" tone="secondary">Pending</Text>
        </Card>
        <Card style={styles.stat}>
          <Text variant="headline" weight="bold" tone={conflicts > 0 ? 'warning' : 'primary'}>{conflicts}</Text>
          <Text variant="caption" tone="secondary">Conflicts</Text>
        </Card>
      </View>

      {lastError ? (
        <Card style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={16} color={theme.colors.danger} />
          <Text variant="caption" tone="secondary" style={styles.flex}>{lastError}</Text>
        </Card>
      ) : null}

      <Text variant="caption" tone="tertiary">
        Changes made offline are queued durably and replayed when you reconnect. Conflicts are detected
        by comparing server versions, so newer server data is never silently overwritten. You can keep
        your local edit (retry) or discard it.
      </Text>

      {ops.length === 0 ? (
        <EmptyState icon="checkmark-done-outline" title="All caught up" message="No pending changes. Your data is synchronized." />
      ) : (
        ops.map((op) => (
          <Card key={op.id} style={styles.opCard}>
            <View style={styles.opRow}>
              <View style={styles.flex}>
                <Text variant="small" weight="semiBold">{KIND_LABEL[op.kind] ?? op.kind}</Text>
                <Text variant="caption" tone="secondary">{relativeDayLabel(op.createdAt)} · {op.attempts} attempt{op.attempts === 1 ? '' : 's'}</Text>
                {op.lastError ? <Text variant="caption" tone="danger" numberOfLines={2}>{op.lastError}</Text> : null}
              </View>
              <Badge label={op.status} tone={op.status === 'conflict' ? 'warning' : op.status === 'failed' ? 'danger' : 'info'} />
            </View>
            {op.status === 'conflict' ? (
              <View style={styles.opActions}>
                <Button label="Keep my edit" size="sm" onPress={() => retry(op.id)} />
                <Button label="Discard" size="sm" variant="secondary" onPress={() => discard(op.id)} />
              </View>
            ) : op.status === 'failed' ? (
              <View style={styles.opActions}>
                <Button label="Retry" size="sm" onPress={() => retry(op.id)} />
                <Button label="Discard" size="sm" variant="secondary" onPress={() => discard(op.id)} />
              </View>
            ) : null}
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingTop: 16 },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  statsRow: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  errorCard: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  opCard: { gap: 10, marginBottom: 0 },
  opRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  opActions: { flexDirection: 'row', gap: 8 },
});
