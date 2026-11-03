import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Loading, Screen, Text } from '@/components/ui';
import { exchangeDeepLink, friendlyAuthError } from '@/services/supabase/auth';
import { APP_SCHEME } from '@/constants';

/** Handles email-confirmation deep links (attendly://auth/callback). */
export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function run() {
      try {
        const query = new URLSearchParams(
          Object.entries(params).filter(([, v]) => typeof v === 'string') as [string, string][],
        ).toString();
        const url = `${APP_SCHEME}://auth/callback${query ? `?${query}` : ''}`;
        const session = await exchangeDeepLink(url);
        if (!active) return;
        if (session) router.replace('/(tabs)');
        else setError('This confirmation link is invalid or has expired. Try signing in again.');
      } catch (err) {
        if (active) setError(friendlyAuthError(err));
      }
    }
    void run();
    return () => {
      active = false;
    };
  }, [params, router]);

  if (error) {
    return (
      <Screen contentContainerStyle={styles.center}>
        <Text variant="headline" weight="bold" style={styles.centerText}>Couldn't confirm</Text>
        <Text variant="body" tone="secondary" style={styles.centerText}>{error}</Text>
        <Button label="Back to sign in" fullWidth onPress={() => router.replace('/(auth)/sign-in')} />
      </Screen>
    );
  }

  return <Loading label="Confirming your email…" />;
}

const styles = StyleSheet.create({
  center: { flexGrow: 1, justifyContent: 'center', gap: 16 },
  centerText: { textAlign: 'center', lineHeight: 22 },
});
