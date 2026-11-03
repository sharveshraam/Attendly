import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Screen, Text } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/theme';

export default function VerifyEmail() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { resendVerification, friendlyAuthError } = useAuth();
  const { theme } = useTheme();
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const resend = async () => {
    if (!email) return;
    setResending(true);
    setMessage(null);
    try {
      await resendVerification(email);
      setMessage('Verification email sent again.');
    } catch (error) {
      setMessage(friendlyAuthError(error));
    } finally {
      setResending(false);
    }
  };

  return (
    <Screen contentContainerStyle={styles.center}>
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.primarySoft }]}>
        <Ionicons name="mail-outline" size={32} color={theme.colors.primary} />
      </View>
      <Text variant="headline" weight="bold" style={styles.centerText}>Verify your email</Text>
      <Text variant="body" tone="secondary" style={styles.centerText}>
        We sent a confirmation link to {email ?? 'your email'}. Tap it to activate your account, then
        sign in.
      </Text>
      {message ? <Text variant="small" tone="secondary" style={styles.centerText}>{message}</Text> : null}
      <Button label="Resend email" variant="secondary" fullWidth loading={resending} onPress={resend} />
      <Button label="Go to sign in" fullWidth onPress={() => router.replace('/(auth)/sign-in')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  iconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center', lineHeight: 22 },
});
