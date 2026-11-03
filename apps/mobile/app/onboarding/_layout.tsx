import React from 'react';
import { Stack, usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme';
import { usePreferencesStore } from '@/store/usePreferencesStore';

const STEPS = ['index', 'semester', 'courses', 'timetable', 'review'];

export default function OnboardingLayout() {
  const { theme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const setOnboardingSkipped = usePreferencesStore((s) => s.setOnboardingSkipped);
  const current = STEPS.findIndex((s) => pathname.endsWith(`/${s}`) || (s === 'index' && pathname.endsWith('/onboarding')));
  const stepIndex = current < 0 ? 0 : current;

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { paddingTop: theme.spacing.xl }]}>
        <View style={styles.progressRow}>
          {STEPS.map((step, i) => (
            <View
              key={step}
              style={[
                styles.progressBar,
                { backgroundColor: i <= stepIndex ? theme.colors.primary : theme.colors.surfaceSecondary },
              ]}
            />
          ))}
        </View>
        <View style={styles.headerRow}>
          <Text variant="caption" tone="secondary">
            Step {stepIndex + 1} of {STEPS.length}
          </Text>
          <Pressable
            onPress={() => {
              setOnboardingSkipped(true);
              router.replace('/(tabs)');
            }}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text variant="small" weight="semiBold" tone="secondary">Skip for now</Text>
          </Pressable>
        </View>
      </View>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background }, animation: 'slide_from_right' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: 16, gap: 10 },
  progressRow: { flexDirection: 'row', gap: 6 },
  progressBar: { flex: 1, height: 4, borderRadius: 2 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
