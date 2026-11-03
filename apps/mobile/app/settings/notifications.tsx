import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Input, Loading, Screen, Text } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useNotificationPreferences, useUpdateNotificationPreferences } from '@/hooks/useNotifications';
import { getLocalSettings, getPermissionStatus, requestNotificationPermissions, saveLocalSettings, getExpoPushToken } from '@/services/notifications';
import { DEFAULT_TIMEZONE } from '@/constants';
import { useTheme } from '@/theme';
import type { NotificationPreferencesRow } from '@/types/database';

export default function NotificationSettings() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const prefsQuery = useNotificationPreferences();
  const updatePrefs = useUpdateNotificationPreferences();
  const [permission, setPermission] = useState<string>('unknown');
  const [local, setLocal] = useState({ classReminderMinutes: 15, quietStart: '22:00', quietEnd: '07:00' });
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getPermissionStatus().then(setPermission);
    void getLocalSettings().then((s) => setLocal({
      classReminderMinutes: s.classReminderMinutes,
      quietStart: s.quietHours?.start ?? '22:00',
      quietEnd: s.quietHours?.end ?? '07:00',
    }));
  }, []);

  const prefs: NotificationPreferencesRow = prefsQuery.data ?? {
    user_id: user?.id ?? '',
    daily_reminder: true,
    schedule_changes: true,
    attendance_warnings: true,
    assignment_reminders: true,
    reminder_time: '07:00',
    timezone: DEFAULT_TIMEZONE,
  };

  const save = async (patch: Partial<NotificationPreferencesRow>) => {
    if (!user) return;
    setSaving(true);
    try {
      await updatePrefs.mutateAsync({ ...prefs, ...patch, user_id: user.id });
    } finally {
      setSaving(false);
    }
  };

  const saveLocal = async (next: typeof local) => {
    setLocal(next);
    await saveLocalSettings({ classReminderMinutes: next.classReminderMinutes, quietHours: { start: next.quietStart, end: next.quietEnd } });
  };

  const requestPermission = async () => {
    const granted = await requestNotificationPermissions();
    setPermission(granted ? 'granted' : 'denied');
    if (granted) {
      const token = await getExpoPushToken();
      setPushToken(token);
    }
  };

  const toggles: { key: keyof NotificationPreferencesRow; label: string; description: string }[] = [
    { key: 'daily_reminder', label: 'Daily summary', description: 'A morning overview of your day' },
    { key: 'schedule_changes', label: 'Schedule changes', description: 'Cancellations, reschedules, extra classes' },
    { key: 'attendance_warnings', label: 'Attendance warnings', description: 'When a course drops below target' },
    { key: 'assignment_reminders', label: 'Assignment reminders', description: 'Before deadlines' },
  ];

  if (prefsQuery.isLoading) return <Loading />;

  return (
    <Screen contentContainerStyle={styles.container}>
      <Text variant="headline" weight="bold">Notifications</Text>

      <Card style={styles.permissionCard}>
        <Ionicons name={permission === 'granted' ? 'notifications' : 'notifications-off-outline'} size={20} color={permission === 'granted' ? theme.colors.success : theme.colors.warning} />
        <View style={styles.flex}>
          <Text variant="small" weight="semiBold">
            {permission === 'granted' ? 'Notifications enabled' : permission === 'denied' ? 'Notifications disabled' : 'Permission not requested'}
          </Text>
          <Text variant="caption" tone="secondary">Local reminders work on this device.</Text>
        </View>
        {permission !== 'granted' ? <Button label="Enable" size="sm" onPress={requestPermission} /> : null}
      </Card>

      <Card padded={false}>
        {toggles.map((toggle, index) => (
          <View key={toggle.key} style={[styles.toggleRow, { borderBottomColor: theme.colors.border, borderBottomWidth: index < toggles.length - 1 ? StyleSheet.hairlineWidth : 0 }]}>
            <View style={styles.flex}>
              <Text variant="body" weight="medium">{toggle.label}</Text>
              <Text variant="caption" tone="secondary">{toggle.description}</Text>
            </View>
            <Switch
              value={Boolean(prefs[toggle.key])}
              onValueChange={(value) => save({ [toggle.key]: value } as Partial<NotificationPreferencesRow>)}
              trackColor={{ true: theme.colors.primary, false: theme.colors.surfaceSecondary }}
              disabled={saving}
            />
          </View>
        ))}
      </Card>

      <Card style={styles.form}>
        <Input label="Daily reminder time" value={prefs.reminder_time} onChangeText={(v) => save({ reminder_time: v })} placeholder="07:00" autoCapitalize="none" hint="24-hour format, HH:MM" />
        <View style={styles.row}>
          <Input label="Class reminder (min before)" value={String(local.classReminderMinutes)} onChangeText={(v) => saveLocal({ ...local, classReminderMinutes: Number.parseInt(v, 10) || 0 })} keyboardType="numeric" style={styles.half} />
        </View>
        <View style={styles.row}>
          <Input label="Quiet hours start" value={local.quietStart} onChangeText={(v) => saveLocal({ ...local, quietStart: v })} placeholder="22:00" autoCapitalize="none" style={styles.half} />
          <Input label="Quiet hours end" value={local.quietEnd} onChangeText={(v) => saveLocal({ ...local, quietEnd: v })} placeholder="07:00" autoCapitalize="none" style={styles.half} />
        </View>
      </Card>

      <Card style={styles.pushCard}>
        <Text variant="small" weight="semiBold">Remote push</Text>
        <Text variant="caption" tone="secondary">
          {pushToken
            ? 'This device has an Expo push token. Remote delivery needs a backend sender (see docs) — local reminders are fully active.'
            : 'Remote push requires an EAS project id and a backend sender. Local notifications are fully implemented; push delivery is documented as pending backend integration.'}
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingTop: 16 },
  permissionCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  form: { gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  pushCard: { gap: 6 },
});
