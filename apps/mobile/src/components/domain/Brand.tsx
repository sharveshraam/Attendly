import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme';
import { APP_NAME } from '@/constants';

export function Brand({ size = 'md', tagline }: { size?: 'sm' | 'md' | 'lg'; tagline?: string }) {
  const { theme } = useTheme();
  const dims = { sm: 44, md: 64, lg: 84 }[size];
  const iconSize = { sm: 22, md: 32, lg: 42 }[size];
  return (
    <View style={styles.container}>
      <View
        style={[
          styles.logo,
          {
            width: dims,
            height: dims,
            borderRadius: dims * 0.3,
            backgroundColor: theme.colors.primary,
          },
        ]}
      >
        <Ionicons name="calendar" size={iconSize} color="#FFFFFF" />
        <View style={[styles.check, { backgroundColor: theme.colors.secondary, width: dims * 0.36, height: dims * 0.36, borderRadius: dims * 0.18 }]}>
          <Ionicons name="checkmark" size={dims * 0.22} color="#0B1020" />
        </View>
      </View>
      <Text variant={size === 'lg' ? 'display' : 'headline'} weight="extraBold">
        {APP_NAME}
      </Text>
      {tagline ? (
        <Text variant="small" tone="secondary" style={styles.tagline}>
          {tagline}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 10 },
  logo: { alignItems: 'center', justifyContent: 'center' },
  check: { position: 'absolute', right: -4, bottom: -4, alignItems: 'center', justifyContent: 'center' },
  tagline: { textAlign: 'center', maxWidth: 260 },
});
