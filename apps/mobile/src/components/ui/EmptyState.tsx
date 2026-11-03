import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { Text } from './Text';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = 'sparkles-outline', title, message, actionLabel, onAction }: EmptyStateProps) {
  const { theme } = useTheme();
  return (
    <View style={styles.container}>
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.primarySoft }]}>
        <Ionicons name={icon} size={28} color={theme.colors.primary} />
      </View>
      <Text variant="subtitle" weight="semiBold" style={styles.title}>
        {title}
      </Text>
      {message ? (
        <Text variant="small" tone="secondary" style={styles.message}>
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="secondary" size="sm" style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16, gap: 8 },
  iconWrap: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { textAlign: 'center' },
  message: { textAlign: 'center', maxWidth: 280, lineHeight: 19 },
  action: { marginTop: 8 },
});
