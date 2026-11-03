import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Input, Screen, Text } from '@/components/ui';
import { useForm } from '@/hooks/useForm';
import { useAuth } from '@/hooks/useAuth';
import { profileSchema } from '@/lib/validation';
import { updateProfile } from '@/services/api/profile';
import { DEFAULT_TIMEZONE } from '@/constants';

function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

export default function OnboardingProfile() {
  const router = useRouter();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm(profileSchema, {
    displayName: (user?.user_metadata?.display_name as string) ?? '',
    timezone: deviceTimezone(),
  });

  const submit = async () => {
    const values = form.validate();
    if (!values || !user) return;
    setSubmitting(true);
    setError(null);
    try {
      await updateProfile(user.id, { display_name: values.displayName, timezone: values.timezone });
      router.push('/onboarding/semester');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen keyboardAvoiding contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text variant="headline" weight="bold">Let's set up your profile</Text>
        <Text variant="small" tone="secondary">Tell us what to call you. You can change this later.</Text>
      </View>
      <Input
        label="Display name"
        value={form.values.displayName}
        onChangeText={(v) => form.setValue('displayName', v)}
        placeholder="Your name"
        autoCapitalize="words"
        icon="person-outline"
        error={form.errors.displayName}
      />
      <Input
        label="Timezone"
        value={form.values.timezone}
        onChangeText={(v) => form.setValue('timezone', v)}
        placeholder="Asia/Kolkata"
        autoCapitalize="none"
        icon="time-outline"
        hint="Used for class times and reminders."
        error={form.errors.timezone}
      />
      {error ? <Text variant="small" tone="danger">{error}</Text> : null}
      <Button label="Continue" fullWidth size="lg" loading={submitting} onPress={submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 18, paddingTop: 24 },
  header: { gap: 6 },
});
