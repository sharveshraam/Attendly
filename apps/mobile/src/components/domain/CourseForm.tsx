import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Input, SegmentedControl, Text } from '@/components/ui';
import { useForm } from '@/hooks/useForm';
import { courseSchema, type CourseInput } from '@/lib/validation';
import { useTheme } from '@/theme';
import type { Course } from '@/types/domain';

export const COURSE_COLORS = ['#38B8A5', '#75B9E7', '#D5B77A', '#E47777', '#7E9BC0', '#6BC5B4', '#C9A86A', '#A8B8C8'];

interface CourseFormProps {
  initial?: Course;
  submitting?: boolean;
  onSubmit: (values: CourseInput) => void;
  submitLabel?: string;
}

export function CourseForm({ initial, submitting, onSubmit, submitLabel = 'Save course' }: CourseFormProps) {
  const { theme } = useTheme();
  const form = useForm(courseSchema, {
    name: initial?.name ?? '',
    code: initial?.code ?? '',
    category: initial?.category ?? 'theory',
    attendanceTarget: initial?.attendance_target ?? undefined,
    calculationMode: initial?.calculation_mode ?? 'class_count',
    color: initial?.color ?? COURSE_COLORS[0]!,
  });

  const submit = () => {
    const values = form.validate();
    if (values) onSubmit(values);
  };

  return (
    <View style={styles.container}>
      <Input label="Course name" value={form.values.name} onChangeText={(v) => form.setValue('name', v)} placeholder="e.g. Data Structures" error={form.errors.name} />
      <Input label="Course code (optional)" value={form.values.code ?? ''} onChangeText={(v) => form.setValue('code', v)} placeholder="e.g. CS201" autoCapitalize="characters" error={form.errors.code} />
      <View style={styles.block}>
        <Text variant="small" weight="medium" tone="secondary">Category</Text>
        <SegmentedControl
          options={[{ label: 'Theory', value: 'theory' }, { label: 'Lab', value: 'lab' }, { label: 'Other', value: 'other' }]}
          value={form.values.category}
          onChange={(v) => form.setValue('category', v)}
        />
      </View>
      <View style={styles.block}>
        <Text variant="small" weight="medium" tone="secondary">Count attendance by</Text>
        <SegmentedControl
          options={[{ label: 'Classes', value: 'class_count' }, { label: 'Hours', value: 'hours' }]}
          value={form.values.calculationMode}
          onChange={(v) => form.setValue('calculationMode', v)}
        />
      </View>
      <Input
        label="Attendance target % (optional)"
        value={form.values.attendanceTarget === undefined ? '' : String(form.values.attendanceTarget)}
        onChangeText={(v) => form.setValue('attendanceTarget', v === '' ? (undefined as never) : (v as never))}
        placeholder="Uses semester default"
        keyboardType="numeric"
        error={form.errors.attendanceTarget}
      />
      <View style={styles.block}>
        <Text variant="small" weight="medium" tone="secondary">Color</Text>
        <View style={styles.swatches}>
          {COURSE_COLORS.map((color) => (
            <Pressable
              key={color}
              onPress={() => form.setValue('color', color)}
              accessibilityLabel={`Select color ${color}`}
              style={[
                styles.swatch,
                { backgroundColor: color, borderColor: form.values.color === color ? theme.colors.text : 'transparent' },
              ]}
            />
          ))}
        </View>
      </View>
      <Button label={submitLabel} fullWidth loading={submitting} onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  block: { gap: 8 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 2 },
});
