import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
}: ButtonProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDisabled = disabled || loading;

  const bg: Record<Variant, string> = {
    primary: c.primary,
    secondary: c.surfaceSecondary,
    ghost: 'transparent',
    danger: c.danger,
  };
  // Dark obsidian text on the lighter dark-mode accents; white on the deeper
  // light-mode accents — keeps contrast high in both themes.
  const onAccent = theme.name === 'dark' ? '#090D14' : '#FFFFFF';
  const fg: Record<Variant, string> = {
    primary: onAccent,
    secondary: c.text,
    ghost: c.primary,
    danger: onAccent,
  };
  const heights: Record<Size, number> = { sm: 38, md: 48, lg: 54 };
  const fontSizes: Record<Size, number> = { sm: 13, md: 15, lg: 16 };
  const iconSizes: Record<Size, number> = { sm: 16, md: 18, lg: 20 };

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg[variant],
          height: heights[size],
          borderRadius: theme.radius.md,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: c.border,
          opacity: isDisabled ? 0.5 : pressed ? 0.88 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          paddingHorizontal: size === 'sm' ? theme.spacing.md : theme.spacing.xl,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg[variant]} size="small" />
      ) : (
        <View style={styles.row}>
          {icon ? <Ionicons name={icon} size={iconSizes[size]} color={fg[variant]} /> : null}
          <Text
            style={[
              styles.label,
              { color: fg[variant], fontSize: fontSizes[size], fontFamily: theme.typography.fontFamily.semiBold },
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { textAlign: 'center' },
});
