import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Screen, SegmentedControl, Text } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useActiveSemester } from '@/hooks/useAcademicData';
import { useTheme, type ThemePreference } from '@/theme';
import { APP_NAME } from '@/constants';

export default function Settings() {
  const router = useRouter();
  const { theme, preference, setPreference } = useTheme();
  const { signOut } = useAuth();
  const { active } = useActiveSemester();

  const links = [
    { icon: 'notifications-outline' as const, label: 'Notification preferences', route: '/settings/notifications' },
    { icon: 'sync-outline' as const, label: 'Sync & offline data', route: '/settings/sync' },
    { icon: 'calendar-outline' as const, label: 'Manage timetable', route: '/onboarding/timetable' },
    { icon: 'school-outline' as const, label: 'Semesters & courses', route: '/courses' },
    { icon: 'analytics-outline' as const, label: 'Analytics & reports', route: '/analytics' },
  ];

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/welcome');
  };

  return (
    <Screen contentContainerStyle={styles.container}>
      <Text variant="headline" weight="bold">Settings</Text>

      <Card>
        <Text variant="small" weight="medium" tone="secondary" style={styles.label}>Appearance</Text>
        <SegmentedControl
          options={[{ label: 'System', value: 'system' }, { label: 'Light', value: 'light' }, { label: 'Dark', value: 'dark' }]}
          value={preference}
          onChange={(v) => setPreference(v as ThemePreference)}
        />
      </Card>

      {active ? (
        <Card>
          <Text variant="small" weight="medium" tone="secondary" style={styles.label}>Current semester</Text>
          <Text variant="body" weight="semiBold">{active.name}</Text>
          <Text variant="caption" tone="secondary">
            Target {active.attendance_target}% · {active.prediction_mode} projection{active.institution ? ` · ${active.institution}` : ''}
          </Text>
        </Card>
      ) : null}

      <Card padded={false}>
        {links.map((link, index) => (
          <Pressable
            key={link.label}
            onPress={() => router.push(link.route as never)}
            style={[styles.linkRow, { borderBottomColor: theme.colors.border, borderBottomWidth: index < links.length - 1 ? StyleSheet.hairlineWidth : 0 }]}
            accessibilityRole="button"
          >
            <Ionicons name={link.icon} size={18} color={theme.colors.primary} />
            <Text variant="body" weight="medium" style={styles.flex}>{link.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
          </Pressable>
        ))}
      </Card>

      <Card style={styles.aboutCard}>
        <Text variant="small" weight="semiBold">About {APP_NAME}</Text>
        <Text variant="caption" tone="secondary">
          Version 1.0.0 · Your attendance is private and protected by row-level security. Groups share
          schedules only. Sessions are stored in the device keystore/keychain.
        </Text>
      </Card>

      <Button label="Sign out" icon="log-out-outline" variant="secondary" fullWidth onPress={handleSignOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingTop: 16 },
  label: { marginBottom: 10 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  flex: { flex: 1 },
  aboutCard: { gap: 6 },
});
