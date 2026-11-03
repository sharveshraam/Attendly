import React, { useCallback, useState } from 'react';
import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import * as Updates from 'expo-updates';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { isSupabaseConfigured } from '@/services/supabase/client';
import { Button, Loading, Screen, Text } from '@/components/ui';
import { Brand } from '@/components/domain/Brand';
import { useTheme } from '@/theme';

/**
 * Application entry. Normal flow: native splash → session restore → auth screen
 * (unauthenticated) or dashboard (authenticated). A build that is missing its
 * public backend configuration shows a calm, branded error with a retry — never
 * a developer setup screen. With the committed build-time config this state is
 * not expected to appear in a correctly built APK.
 */
export default function Index() {
  const { initialized, isAuthenticated } = useAuth();
  const { theme } = useTheme();
  const [retrying, setRetrying] = useState(false);

  const retry = useCallback(async () => {
    setRetrying(true);
    try {
      await Updates.reloadAsync();
    } catch {
      setRetrying(false);
    }
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <Screen scroll={false} contentContainerStyle={styles.center}>
        <Brand size="md" />
        <View style={[styles.errorIcon, { backgroundColor: theme.colors.dangerSoft }]}>
          <Ionicons name="cloud-offline-outline" size={26} color={theme.colors.danger} />
        </View>
        <Text variant="title" weight="semiBold" style={styles.centerText}>
          We couldn’t start Attendly
        </Text>
        <Text variant="body" tone="secondary" style={styles.centerText}>
          The app couldn’t load its backend configuration. Please try again. If this keeps happening,
          reinstall the app or contact support.
        </Text>
        <Button label="Try again" icon="refresh" loading={retrying} onPress={retry} fullWidth />
      </Screen>
    );
  }

  if (!initialized) return <Loading label="Restoring your session…" />;
  if (isAuthenticated) return <Redirect href="/(tabs)" />;
  return <Redirect href="/(auth)/welcome" />;
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'stretch', gap: 16, paddingHorizontal: 28 },
  centerText: { textAlign: 'center', lineHeight: 22 },
  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 8,
  },
});
