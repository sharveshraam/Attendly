import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme';
import { useSyncStore } from '@/store/useSyncStore';

export function OfflineBanner() {
  const { theme } = useTheme();
  const isOnline = useSyncStore((s) => s.isOnline);
  const pending = useSyncStore((s) => s.pending);
  const isSyncing = useSyncStore((s) => s.isSyncing);

  if (isOnline && pending === 0 && !isSyncing) return null;

  const label = !isOnline
    ? `Offline${pending > 0 ? ` · ${pending} change${pending === 1 ? '' : 's'} queued` : ''}`
    : isSyncing
      ? 'Syncing…'
      : `${pending} change${pending === 1 ? '' : 's'} pending sync`;

  return (
    <View style={[styles.banner, { backgroundColor: !isOnline ? theme.colors.warningSoft : theme.colors.infoSoft }]}>
      <Ionicons
        name={!isOnline ? 'cloud-offline-outline' : 'sync-outline'}
        size={14}
        color={!isOnline ? theme.colors.warning : theme.colors.info}
      />
      <Text variant="caption" weight="medium" style={{ color: !isOnline ? theme.colors.warning : theme.colors.info }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 },
});
