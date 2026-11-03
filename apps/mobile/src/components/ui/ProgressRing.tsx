import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '@/theme';
import { Text } from './Text';

interface ProgressRingProps {
  percent: number | null;
  size?: number;
  strokeWidth?: number;
  color?: string;
  caption?: string;
}

export function ProgressRing({ percent, size = 96, strokeWidth = 9, color, caption }: ProgressRingProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = percent === null ? 0 : Math.max(0, Math.min(100, percent));
  const offset = circumference - (clamped / 100) * circumference;
  const ringColor = color ?? (percent === null ? c.textTertiary : percent >= 75 ? c.success : percent >= 60 ? c.warning : c.danger);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={c.surfaceSecondary} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text variant="title" weight="bold" style={{ fontSize: size * 0.24 }}>
        {percent === null ? '—' : `${percent}%`}
      </Text>
      {caption ? (
        <Text variant="caption" tone="secondary" style={{ fontSize: size * 0.11 }}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}
