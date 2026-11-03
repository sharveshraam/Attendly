import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input, Screen, Text } from '@/components/ui';
import { useForm } from '@/hooks/useForm';
import { useAuth } from '@/hooks/useAuth';
import { forgotPasswordSchema } from '@/lib/validation';
import { useTheme } from '@/theme';

export default function ForgotPassword() {
  const router = useRouter();
  const { requestPasswordReset, friendlyAuthError } = useAuth();
  const { theme } = useTheme();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm(forgotPasswordSchema, { email: '' });

  const submit = async () => {
    const values = form.validate();
    if (!values) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await requestPasswordReset(values.email);
      setSent(true);
    } catch (error) {
      setFormError(friendlyAuthError(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <Screen contentContainerStyle={styles.center}>
        <View style={[styles.iconWrap, { backgroundColor: theme.colors.successSoft }]}>
          <Ionicons name="mail-open-outline" size={32} color={theme.colors.success} />
        </View>
        <Text variant="headline" weight="bold" style={styles.centerText}>Check your email</Text>
        <Text variant="body" tone="secondary" style={styles.centerText}>
          We sent a password reset link to {form.values.email}. Open it on this device to set a new
          password.
        </Text>
        <Button label="Back to sign in" variant="secondary" fullWidth onPress={() => router.replace('/(auth)/sign-in')} />
      </Screen>
    );
  }

  return (
    <Screen keyboardAvoiding contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text variant="headline" weight="bold">Reset your password</Text>
        <Text variant="small" tone="secondary">
          Enter your account email and we'll send you a reset link.
        </Text>
      </View>
      <Input
        label="Email"
        value={form.values.email}
        onChangeText={(v) => form.setValue('email', v)}
        placeholder="you@college.edu"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        icon="mail-outline"
        error={form.errors.email}
      />
      {formError ? <Text variant="small" tone="danger">{formError}</Text> : null}
      <Button label="Send reset link" fullWidth size="lg" loading={submitting} onPress={submit} />
      <Button label="Back to sign in" variant="ghost" fullWidth onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', gap: 20 },
  center: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  header: { gap: 6 },
  iconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center', lineHeight: 22 },
});
