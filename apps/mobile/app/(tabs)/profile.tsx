import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Screen, SegmentedControl, Text } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useActiveSemester } from '@/hooks/useAcademicData';
import { useTheme, type ThemePreference } from '@/theme';
import { useSyncStore } from '@/store/useSyncStore';

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: string;
  subtitle?: string;
}

export default function Profile() {
  const router = useRouter();
  const { theme, preference, setPreference } = useTheme();
  const { user, signOut } = useAuth();
  const { active, semesters, setActiveSemester } = useActiveSemester();
  const pending = useSyncStore((s) => s.pending);
  const conflicts = useSyncStore((s) => s.conflicts);

  const name = (user?.user_metadata?.display_name as string) || 'Student';
  const email = user?.email ?? '';

  const menu: MenuItem[] = [
    { icon: 'book-outline', label: 'Courses', route: '/courses', subtitle: 'Manage subjects & targets' },
    { icon: 'briefcase-outline', label: 'Productivity', route: '/productivity', subtitle: 'Assignments, exams, notes' },
    { icon: 'analytics-outline', label: 'Analytics & reports', route: '/analytics' },
    { icon: 'chatbubble-ellipses-outline', label: 'Attendly Assistant', route: '/assistant' },
    { icon: 'notifications-outline', label: 'Notifications', route: '/settings/notifications' },
    { icon: 'sync-outline', label: 'Sync & offline', route: '/settings/sync', subtitle: pending > 0 ? `${pending} pending${conflicts > 0 ? `, ${conflicts} conflicts` : ''}` : 'Up to date' },
    { icon: 'settings-outline', label: 'Settings', route: '/settings' },
  ];

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/welcome');
  };

  return (
    <Screen contentContainerStyle={styles.container}>
      <Text variant="headline" weight="bold">Profile</Text>

      <Card style={styles.profileCard}>
        <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
          <Text variant="headline" weight="bold" tone="inverse">{name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.flex}>
          <Text variant="subtitle" weight="semiBold">{name}</Text>
          <Text variant="small" tone="secondary">{email}</Text>
        </View>
      </Card>

      {semesters.length > 0 ? (
        <Card>
          <Text variant="small" weight="medium" tone="secondary" style={styles.sectionLabel}>Active semester</Text>
          <View style={styles.semesterChips}>
            {semesters.map((semester) => (
              <Pressable
                key={semester.id}
                onPress={() => setActiveSemester(semester.id)}
                style={[styles.semesterChip, { backgroundColor: active?.id === semester.id ? theme.colors.primarySoft : theme.colors.surfaceSecondary, borderColor: active?.id === semester.id ? theme.colors.primary : 'transparent' }]}
              >
                <Text variant="caption" weight={active?.id === semester.id ? 'semiBold' : 'medium'} tone={active?.id === semester.id ? 'accent' : 'secondary'}>{semester.name}</Text>
              </Pressable>
            ))}
          </View>
        </Card>
      ) : (
        <Button label="Set up your semester" icon="rocket-outline" fullWidth onPress={() => router.push('/onboarding')} />
      )}

      <Card>
        <Text variant="small" weight="medium" tone="secondary" style={styles.sectionLabel}>Appearance</Text>
        <SegmentedControl
          options={[{ label: 'System', value: 'system' }, { label: 'Light', value: 'light' }, { label: 'Dark', value: 'dark' }]}
          value={preference}
          onChange={(v) => setPreference(v as ThemePreference)}
        />
      </Card>

      <Card padded={false}>
        {menu.map((item, index) => (
          <Pressable
            key={item.label}
            onPress={() => router.push(item.route as never)}
            style={[styles.menuItem, { borderBottomColor: theme.colors.border, borderBottomWidth: index < menu.length - 1 ? StyleSheet.hairlineWidth : 0 }]}
            accessibilityRole="button"
          >
            <View style={[styles.menuIcon, { backgroundColor: theme.colors.surfaceSecondary }]}>
              <Ionicons name={item.icon} size={18} color={theme.colors.primary} />
            </View>
            <View style={styles.flex}>
              <Text variant="body" weight="medium">{item.label}</Text>
              {item.subtitle ? <Text variant="caption" tone="secondary">{item.subtitle}</Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
          </Pressable>
        ))}
      </Card>

      <Button label="Sign out" icon="log-out-outline" variant="secondary" fullWidth onPress={handleSignOut} />
      <Text variant="caption" tone="tertiary" style={styles.version}>Attendly · v1.0.0</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingTop: 12 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  sectionLabel: { marginBottom: 10 },
  semesterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  semesterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  menuIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  version: { textAlign: 'center', marginTop: 4 },
});
