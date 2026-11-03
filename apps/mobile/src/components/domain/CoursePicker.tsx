import React from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme';
import type { Course } from '@/types/domain';

interface CoursePickerProps {
  courses: Course[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function CoursePicker({ courses, selectedId, onSelect }: CoursePickerProps) {
  const { theme } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {courses.map((course) => {
        const selected = course.id === selectedId;
        return (
          <Pressable
            key={course.id}
            onPress={() => onSelect(course.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[
              styles.chip,
              {
                backgroundColor: selected ? theme.colors.primarySoft : theme.colors.surfaceSecondary,
                borderColor: selected ? theme.colors.primary : 'transparent',
              },
            ]}
          >
            <Text variant="small" weight={selected ? 'semiBold' : 'medium'} tone={selected ? 'accent' : 'secondary'} numberOfLines={1}>
              {course.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, maxWidth: 200 },
});
