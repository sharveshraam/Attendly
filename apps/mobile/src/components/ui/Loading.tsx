import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';

export function Loading({ label }: { label?: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.container}>
      <ActivityIndicator color={theme.colors.primary} size="large" />
      {label ? (
        <Text variant="small" tone="secondary" style={styles.label}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

export function Skeleton({ height = 16, width = '100%' }: { height?: number; width?: number | `${number}%` }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        height,
        width,
        borderRadius: theme.radius.sm,
        backgroundColor: theme.colors.skeleton,
        opacity: 0.7,
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 12 },
  label: { marginTop: 4 },
});
