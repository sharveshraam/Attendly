import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Screen, Text } from '@/components/ui';
import { CourseForm } from '@/components/domain/CourseForm';
import { useActiveSemester, useCourses } from '@/hooks/useAcademicData';
import { createCourse, updateCourse } from '@/services/api/courses';
import { QUERY_KEYS } from '@/constants';
import type { CourseInput } from '@/lib/validation';

export default function EditCourse() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { active } = useActiveSemester();
  const coursesQuery = useCourses(active?.id ?? null);
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const existing = id ? (coursesQuery.data ?? []).find((c) => c.id === id) : undefined;

  const submit = async (values: CourseInput) => {
    if (!active) return;
    setSubmitting(true);
    setError(null);
    try {
      if (existing) {
        await updateCourse(existing.id, {
          name: values.name,
          code: values.code || null,
          category: values.category,
          attendance_target: values.attendanceTarget ?? null,
          calculation_mode: values.calculationMode,
          color: values.color,
        });
      } else {
        await createCourse({
          semester_id: active.id,
          name: values.name,
          code: values.code || null,
          category: values.category,
          attendance_target: values.attendanceTarget ?? null,
          calculation_mode: values.calculationMode,
          color: values.color,
        });
      }
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.courses(active.id) });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the course.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen keyboardAvoiding contentContainerStyle={styles.container}>
      <Text variant="headline" weight="bold">{existing ? 'Edit course' : 'New course'}</Text>
      {error ? <Text variant="small" tone="danger">{error}</Text> : null}
      <CourseForm initial={existing} onSubmit={submit} submitting={submitting} submitLabel={existing ? 'Save changes' : 'Create course'} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 18, paddingTop: 16 },
});
