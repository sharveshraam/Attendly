import React from 'react';
import { Link, Stack } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Screen, Text } from '@/components/ui';
import { useTheme } from '@/theme';

export default function NotFound() {
  const { theme } = useTheme();
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <Screen scroll={false} contentContainerStyle={styles.center}>
        <Text variant="display" weight="bold">404</Text>
        <Text variant="body" tone="secondary" style={styles.message}>
          This screen doesn't exist.
        </Text>
        <Link href="/(tabs)" style={[styles.link, { color: theme.colors.primary }]}>
          <Text variant="body" weight="semiBold" style={{ color: theme.colors.primary }}>
            Go home
          </Text>
        </Link>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center', gap: 12 },
  message: { textAlign: 'center' },
  link: { marginTop: 8 },
});
