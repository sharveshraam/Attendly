import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';

interface Option<T extends string> {
  label: string;
  value: T;
}

interface SegmentedControlProps<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={[styles.container, { backgroundColor: c.surfaceSecondary, borderRadius: theme.radius.md }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[
              styles.segment,
              {
                backgroundColor: selected ? c.surface : 'transparent',
                borderRadius: theme.radius.sm,
              },
              selected ? theme.shadow : null,
            ]}
          >
            <Text
              variant="small"
              weight={selected ? 'semiBold' : 'medium'}
              tone={selected ? 'primary' : 'secondary'}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', padding: 4, gap: 4 },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
});
