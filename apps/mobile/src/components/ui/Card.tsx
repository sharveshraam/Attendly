import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  elevated?: boolean;
}

export function Card({ children, onPress, style, padded = true, elevated = true }: CardProps) {
  const { theme } = useTheme();
  const base: StyleProp<ViewStyle> = [
    styles.card,
    {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      borderColor: theme.colors.border,
      padding: padded ? theme.spacing.lg : 0,
    },
    elevated ? theme.shadow : null,
    style,
  ];
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [base, { opacity: pressed ? 0.9 : 1 }]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={base}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, overflow: 'hidden' },
});
