import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Screen, Text } from '@/components/ui';
import { Brand } from '@/components/domain/Brand';
import { useTheme } from '@/theme';

const FEATURES = [
  { icon: 'checkmark-done-outline' as const, text: 'Track attendance with accurate bunk & recovery math' },
  { icon: 'calendar-outline' as const, text: 'Import your timetable and academic calendar' },
  { icon: 'people-outline' as const, text: 'Share schedules with classmates — attendance stays private' },
  { icon: 'cloud-offline-outline' as const, text: 'Works offline and syncs when you reconnect' },
];

export default function Welcome() {
  const router = useRouter();
  const { theme } = useTheme();
  return (
    <Screen contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Brand size="lg" tagline="Your academic attendance companion" />
      </View>

      <View style={styles.features}>
        {FEATURES.map((feature) => (
          <View key={feature.text} style={styles.featureRow}>
            <View style={[styles.featureIcon, { backgroundColor: theme.colors.primarySoft }]}>
              <Ionicons name={feature.icon} size={18} color={theme.colors.primary} />
            </View>
            <Text variant="small" tone="secondary" style={styles.featureText}>
              {feature.text}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <Button label="Create account" icon="person-add-outline" fullWidth size="lg" onPress={() => router.push('/(auth)/sign-up')} />
        <Button label="I already have an account" variant="secondary" fullWidth size="lg" onPress={() => router.push('/(auth)/sign-in')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', gap: 32, paddingVertical: 40 },
  hero: { alignItems: 'center' },
  features: { gap: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  featureText: { flex: 1, lineHeight: 19 },
  actions: { gap: 12 },
});
