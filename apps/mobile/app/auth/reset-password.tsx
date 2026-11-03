import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Input, Loading, Screen, Text } from '@/components/ui';
import { useForm } from '@/hooks/useForm';
import { exchangeDeepLink, friendlyAuthError, updatePassword } from '@/services/supabase/auth';
import { resetPasswordSchema } from '@/lib/validation';
import { APP_SCHEME } from '@/constants';

/** Handles password-recovery deep links (attendly://auth/reset-password). */
export default function ResetPassword() {
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const form = useForm(resetPasswordSchema, { password: '', confirmPassword: '' });

  useEffect(() => {
    let active = true;
    async function run() {
      try {
        const query = new URLSearchParams(
          Object.entries(params).filter(([, v]) => typeof v === 'string') as [string, string][],
        ).toString();
        const url = `${APP_SCHEME}://auth/reset-password${query ? `?${query}` : ''}`;
        const session = await exchangeDeepLink(url);
        if (!active) return;
        if (session) setReady(true);
        else setLinkError('This reset link is invalid or has expired. Request a new one.');
      } catch (err) {
        if (active) setLinkError(friendlyAuthError(err));
      }
    }
    void run();
    return () => {
      active = false;
    };
  }, [params]);

  const submit = async () => {
    const values = form.validate();
    if (!values) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await updatePassword(values.password);
      setDone(true);
    } catch (error) {
      setFormError(friendlyAuthError(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (linkError) {
    return (
      <Screen contentContainerStyle={styles.center}>
        <Text variant="headline" weight="bold" style={styles.centerText}>Link expired</Text>
        <Text variant="body" tone="secondary" style={styles.centerText}>{linkError}</Text>
        <Button label="Request a new link" fullWidth onPress={() => router.replace('/(auth)/forgot-password')} />
      </Screen>
    );
  }

  if (done) {
    return (
      <Screen contentContainerStyle={styles.center}>
        <Text variant="headline" weight="bold" style={styles.centerText}>Password updated</Text>
        <Text variant="body" tone="secondary" style={styles.centerText}>
          Your password has been changed. You're now signed in.
        </Text>
        <Button label="Continue to Attendly" fullWidth onPress={() => router.replace('/(tabs)')} />
      </Screen>
    );
  }

  if (!ready) return <Loading label="Validating reset link…" />;

  return (
    <Screen keyboardAvoiding contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text variant="headline" weight="bold">Set a new password</Text>
        <Text variant="small" tone="secondary">Choose a strong password you haven't used before.</Text>
      </View>
      <Input
        label="New password"
        value={form.values.password}
        onChangeText={(v) => form.setValue('password', v)}
        placeholder="At least 6 characters"
        secureTextEntry
        autoCapitalize="none"
        icon="lock-closed-outline"
        error={form.errors.password}
      />
      <Input
        label="Confirm password"
        value={form.values.confirmPassword}
        onChangeText={(v) => form.setValue('confirmPassword', v)}
        placeholder="Re-enter password"
        secureTextEntry
        autoCapitalize="none"
        icon="lock-closed-outline"
        error={form.errors.confirmPassword}
      />
      {formError ? <Text variant="small" tone="danger">{formError}</Text> : null}
      <Button label="Update password" fullWidth size="lg" loading={submitting} onPress={submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', gap: 18 },
  center: { flexGrow: 1, justifyContent: 'center', gap: 16 },
  header: { gap: 6 },
  centerText: { textAlign: 'center', lineHeight: 22 },
});
