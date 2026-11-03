import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Input, Screen, Text } from '@/components/ui';
import { Brand } from '@/components/domain/Brand';
import { useForm } from '@/hooks/useForm';
import { useAuth } from '@/hooks/useAuth';
import { signUpSchema } from '@/lib/validation';

export default function SignUp() {
  const router = useRouter();
  const { signUp, friendlyAuthError } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm(signUpSchema, { displayName: '', email: '', password: '', confirmPassword: '' });

  const submit = async () => {
    const values = form.validate();
    if (!values) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const result = await signUp(values.email, values.password, values.displayName);
      if (result.needsVerification) {
        router.replace({ pathname: '/(auth)/verify-email', params: { email: values.email } });
      }
      // If a session was returned, the auth gate redirects into the app.
    } catch (error) {
      setFormError(friendlyAuthError(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen keyboardAvoiding contentContainerStyle={styles.container}>
      <Brand size="md" />
      <View style={styles.header}>
        <Text variant="headline" weight="bold">Create your account</Text>
        <Text variant="small" tone="secondary">Start tracking your attendance in minutes.</Text>
      </View>

      <View style={styles.fields}>
        <Input
          label="Full name"
          value={form.values.displayName}
          onChangeText={(v) => form.setValue('displayName', v)}
          placeholder="Your name"
          autoCapitalize="words"
          autoComplete="name"
          icon="person-outline"
          error={form.errors.displayName}
        />
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
        <Input
          label="Password"
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
          placeholder="Re-enter your password"
          secureTextEntry
          autoCapitalize="none"
          icon="lock-closed-outline"
          error={form.errors.confirmPassword}
        />
      </View>

      {formError ? <Text variant="small" tone="danger" style={styles.error}>{formError}</Text> : null}

      <Button label="Create account" fullWidth size="lg" loading={submitting} onPress={submit} />

      <Pressable onPress={() => router.replace('/(auth)/sign-in')} style={styles.switch} accessibilityRole="button">
        <Text variant="small" tone="secondary">
          Already have an account? <Text variant="small" weight="semiBold" tone="accent">Sign in</Text>
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', gap: 22, paddingVertical: 32 },
  header: { gap: 4, alignItems: 'center' },
  fields: { gap: 14 },
  error: { textAlign: 'center' },
  switch: { alignItems: 'center', paddingVertical: 8 },
});
