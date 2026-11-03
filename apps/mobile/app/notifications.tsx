import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, EmptyState, Loading, Screen, Text } from '@/components/ui';
import { useMarkNotificationsRead, useNotifications } from '@/hooks/useNotifications';
import { relativeDayLabel } from '@/lib/dates';
import { useTheme } from '@/theme';

const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  class_reminder: 'time-outline',
  daily_reminder: 'sunny-outline',
  assignment: 'document-text-outline',
  exam: 'school-outline',
  schedule_change: 'calendar-outline',
  attendance_warning: 'alert-circle-outline',
  group_update: 'people-outline',
};

export default function Notifications() {
  const { theme } = useTheme();
  const notificationsQuery = useNotifications();
  const markRead = useMarkNotificationsRead();
  const notifications = notificationsQuery.data ?? [];
  const unread = notifications.filter((n) => !n.read_at).length;

  return (
    <Screen contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text variant="headline" weight="bold">Notifications</Text>
        {unread > 0 ? <Button label="Mark all read" size="sm" variant="secondary" onPress={() => markRead.mutate('all')} /> : null}
      </View>

      {notificationsQuery.isLoading ? (
        <Loading />
      ) : notifications.length === 0 ? (
        <EmptyState icon="notifications-outline" title="No notifications" message="Schedule changes, reminders and group updates will appear here." />
      ) : (
        notifications.map((notification) => (
          <Pressable key={notification.id} onPress={() => !notification.read_at && markRead.mutate(notification.id)}>
            <Card style={[styles.notificationCard, !notification.read_at ? { borderColor: theme.colors.primary } : null]}>
              <View style={[styles.iconWrap, { backgroundColor: theme.colors.surfaceSecondary }]}>
                <Ionicons name={CATEGORY_ICON[notification.category] ?? 'notifications-outline'} size={18} color={theme.colors.primary} />
              </View>
              <View style={styles.flex}>
                <View style={styles.titleRow}>
                  <Text variant="small" weight={notification.read_at ? 'medium' : 'semiBold'} style={styles.flex}>{notification.title}</Text>
                  {!notification.read_at ? <View style={[styles.unreadDot, { backgroundColor: theme.colors.primary }]} /> : null}
                </View>
                <Text variant="caption" tone="secondary">{notification.body}</Text>
                <Text variant="caption" tone="tertiary">{relativeDayLabel(notification.created_at)}</Text>
              </View>
            </Card>
          </Pressable>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, paddingTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  notificationCard: { flexDirection: 'row', gap: 12, marginBottom: 0 },
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
});
