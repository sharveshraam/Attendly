import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  style?: StyleProp<ViewStyle>;
}

export function Badge({ label, tone = 'neutral', style }: BadgeProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const tones: Record<BadgeTone, { bg: string; fg: string }> = {
    success: { bg: c.successSoft, fg: c.success },
    warning: { bg: c.warningSoft, fg: c.warning },
    danger: { bg: c.dangerSoft, fg: c.danger },
    info: { bg: c.infoSoft, fg: c.info },
    primary: { bg: c.primarySoft, fg: c.primary },
    neutral: { bg: c.surfaceSecondary, fg: c.textSecondary },
  };
  const { bg, fg } = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <Text style={[styles.text, { color: fg, fontFamily: theme.typography.fontFamily.semiBold }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  text: { fontSize: 11, letterSpacing: 0.2 },
});
