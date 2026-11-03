import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme';
import type { AttendanceStatus } from '@/types/database';

const OPTIONS: { status: AttendanceStatus; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { status: 'present', label: 'Present', icon: 'checkmark-circle' },
  { status: 'absent', label: 'Absent', icon: 'close-circle' },
  { status: 'excused', label: 'Excused', icon: 'shield-checkmark' },
  { status: 'unmarked', label: 'Clear', icon: 'remove-circle-outline' },
];

interface Props {
  value: AttendanceStatus;
  onChange: (status: AttendanceStatus) => void;
  compact?: boolean;
}

export function AttendanceStatusPicker({ value, onChange, compact = false }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const toneFor = (status: AttendanceStatus): string => {
    switch (status) {
      case 'present': return c.success;
      case 'absent': return c.danger;
      case 'excused': return c.info;
      default: return c.textTertiary;
    }
  };
  return (
    <View style={styles.row}>
      {OPTIONS.map((option) => {
        const selected = value === option.status;
        const color = toneFor(option.status);
        return (
          <Pressable
            key={option.status}
            onPress={() => onChange(option.status)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            style={[
              styles.option,
              {
                backgroundColor: selected ? `${color}22` : c.surfaceSecondary,
                borderColor: selected ? color : 'transparent',
                paddingVertical: compact ? 8 : 10,
              },
            ]}
          >
            <Ionicons name={option.icon} size={compact ? 16 : 18} color={selected ? color : c.textSecondary} />
            {!compact ? (
              <Text variant="caption" weight={selected ? 'semiBold' : 'medium'} tone={selected ? 'primary' : 'secondary'}>
                {option.label}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  option: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 12, borderWidth: 1 },
});
