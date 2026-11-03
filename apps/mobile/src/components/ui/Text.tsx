import React from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle, type StyleProp } from 'react-native';
import { useTheme } from '@/theme';

type Variant = 'hero' | 'display' | 'headline' | 'title' | 'subtitle' | 'body' | 'small' | 'caption';
type Tone = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'success' | 'warning' | 'danger' | 'inverse';
type Weight = 'regular' | 'medium' | 'semiBold' | 'bold' | 'extraBold';

interface TextProps extends RNTextProps {
  variant?: Variant;
  tone?: Tone;
  weight?: Weight;
  style?: StyleProp<TextStyle>;
}

export function Text({ variant = 'body', tone = 'primary', weight, style, children, ...rest }: TextProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const sizes: Record<Variant, number> = {
    hero: theme.typography.size.hero,
    display: theme.typography.size.display,
    headline: theme.typography.size.headline,
    title: theme.typography.size.title,
    subtitle: theme.typography.size.subtitle,
    body: theme.typography.size.body,
    small: theme.typography.size.small,
    caption: theme.typography.size.caption,
  };
  const tones: Record<Tone, string> = {
    primary: c.text,
    secondary: c.textSecondary,
    tertiary: c.textTertiary,
    accent: c.primary,
    success: c.success,
    warning: c.warning,
    danger: c.danger,
    inverse: '#FFFFFF',
  };
  const defaultWeight: Record<Variant, Weight> = {
    hero: 'extraBold',
    display: 'bold',
    headline: 'bold',
    title: 'semiBold',
    subtitle: 'medium',
    body: 'regular',
    small: 'regular',
    caption: 'medium',
  };
  const resolvedWeight = weight ?? defaultWeight[variant];
  return (
    <RNText
      style={[
        {
          fontSize: sizes[variant],
          color: tones[tone],
          fontFamily: theme.typography.fontFamily[resolvedWeight],
          letterSpacing: theme.typography.letterSpacing[variant],
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
}
