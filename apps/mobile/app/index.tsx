import React from 'react';
import { Redirect } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { isSupabaseConfigured } from '@/services/supabase/client';
import { Loading, Screen, Text, Button } from '@/components/ui';
import { useTheme } from '@/theme';

export default function Index() {
  const { initialized, isAuthenticated } = useAuth();
  const { theme } = useTheme();

  if (!isSupabaseConfigured) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center}>
        <Text variant="headline" weight="bold" style={styles.title}>
          Configure Attendly
        </Text>
        <Text variant="body" tone="secondary" style={styles.message}>
          Add your Supabase project URL and publishable key to apps/mobile/.env.local, then restart
          the app. See apps/mobile/README.md for setup steps.
        </Text>
        <View style={[styles.codeBox, { backgroundColor: theme.colors.surfaceSecondary }]}>
          <Text variant="small" tone="secondary" style={styles.code}>
            EXPO_PUBLIC_SUPABASE_URL=...{'\n'}EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
          </Text>
        </View>
      </Screen>
    );
  }

  if (!initialized) return <Loading label="Restoring your session…" />;
  if (isAuthenticated) return <Redirect href="/(tabs)" />;
  return <Redirect href="/(auth)/welcome" />;
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', gap: 16 },
  title: { textAlign: 'center' },
  message: { textAlign: 'center', lineHeight: 22 },
  codeBox: { padding: 16, borderRadius: 12 },
  code: { fontFamily: 'monospace', lineHeight: 20 },
});
