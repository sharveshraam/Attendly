import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Input, Screen, Text } from '@/components/ui';
import { Brand } from '@/components/domain/Brand';
import { useForm } from '@/hooks/useForm';
import { useAuth } from '@/hooks/useAuth';
import { signInSchema } from '@/lib/validation';

export default function SignIn() {
  const router = useRouter();
  const { signIn, friendlyAuthError } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm(signInSchema, { email: '', password: '' });

  const submit = async () => {
    const values = form.validate();
    if (!values) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await signIn(values.email, values.password);
      // Auth gate redirects to the app on success.
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
        <Text variant="headline" weight="bold">Welcome back</Text>
        <Text variant="small" tone="secondary">Sign in to continue to Attendly.</Text>
      </View>

      <View style={styles.fields}>
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
          placeholder="Your password"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password"
          icon="lock-closed-outline"
          error={form.errors.password}
        />
        <Pressable onPress={() => router.push('/(auth)/forgot-password')} style={styles.forgot} accessibilityRole="button">
          <Text variant="small" weight="semiBold" tone="accent">Forgot password?</Text>
        </Pressable>
      </View>

      {formError ? <Text variant="small" tone="danger" style={styles.error}>{formError}</Text> : null}

      <Button label="Sign in" fullWidth size="lg" loading={submitting} onPress={submit} />

      <Pressable onPress={() => router.replace('/(auth)/sign-up')} style={styles.switch} accessibilityRole="button">
        <Text variant="small" tone="secondary">
          New to Attendly? <Text variant="small" weight="semiBold" tone="accent">Create an account</Text>
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', gap: 24, paddingVertical: 32 },
  header: { gap: 4, alignItems: 'center' },
  fields: { gap: 16 },
  forgot: { alignSelf: 'flex-end' },
  error: { textAlign: 'center' },
  switch: { alignItems: 'center', paddingVertical: 8 },
});
