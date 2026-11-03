import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme';
import { APP_NAME } from '@/constants';

/**
 * Obsidian Academic brand mark: a subtle graphite tile with a muted-teal
 * calendar glyph and a small teal check, paired with an editorial wordmark.
 */
export function Brand({ size = 'md', tagline }: { size?: 'sm' | 'md' | 'lg'; tagline?: string }) {
  const { theme } = useTheme();
  const dims = { sm: 44, md: 60, lg: 78 }[size];
  const iconSize = { sm: 21, md: 29, lg: 38 }[size];
  return (
    <View style={styles.container}>
      <View
        style={[
          styles.logo,
          {
            width: dims,
            height: dims,
            borderRadius: dims * 0.28,
            backgroundColor: theme.colors.surfaceSecondary,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Ionicons name="calendar-outline" size={iconSize} color={theme.colors.primary} />
        <View
          style={[
            styles.check,
            {
              backgroundColor: theme.colors.primary,
              width: dims * 0.36,
              height: dims * 0.36,
              borderRadius: dims * 0.18,
              borderColor: theme.colors.background,
            },
          ]}
        >
          <Ionicons name="checkmark" size={dims * 0.22} color="#090D14" />
        </View>
      </View>
      <Text variant={size === 'lg' ? 'display' : 'headline'} weight="bold" style={styles.wordmark}>
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
  container: { alignItems: 'center', gap: 12 },
  logo: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  check: {
    position: 'absolute',
    right: -5,
    bottom: -5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  wordmark: { letterSpacing: -0.5 },
  tagline: { textAlign: 'center', maxWidth: 260 },
});
