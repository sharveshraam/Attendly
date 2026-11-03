import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, EmptyState, Screen, Text } from '@/components/ui';
import { CourseForm } from '@/components/domain/CourseForm';
import { useActiveSemester, useCourses } from '@/hooks/useAcademicData';
import { createCourse } from '@/services/api/courses';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants';
import { useTheme } from '@/theme';
import type { CourseInput } from '@/lib/validation';

export default function OnboardingCourses() {
  const router = useRouter();
  const { theme } = useTheme();
  const { active } = useActiveSemester();
  const coursesQuery = useCourses(active?.id ?? null);
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const courses = coursesQuery.data ?? [];

  const addCourse = async (values: CourseInput) => {
    if (!active) return;
    setSubmitting(true);
    setError(null);
    try {
      await createCourse({
        semester_id: active.id,
        name: values.name,
        code: values.code || null,
        category: values.category,
        attendance_target: values.attendanceTarget ?? null,
        calculation_mode: values.calculationMode,
        color: values.color,
      });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.courses(active.id) });
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the course.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text variant="headline" weight="bold">Add your courses</Text>
        <Text variant="small" tone="secondary">Add the subjects you're taking this semester. You can add more later.</Text>
      </View>

      {courses.length > 0 ? (
        <View style={styles.list}>
          {courses.map((course) => (
            <Card key={course.id} style={styles.courseRow} padded={false}>
              <View style={styles.courseInner}>
                <View style={[styles.dot, { backgroundColor: course.color }]} />
                <View style={styles.courseInfo}>
                  <Text variant="body" weight="semiBold">{course.name}</Text>
                  {course.code ? <Text variant="caption" tone="secondary">{course.code}</Text> : null}
                </View>
                <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
              </View>
            </Card>
          ))}
        </View>
      ) : (
        !adding && <EmptyState icon="book-outline" title="No courses yet" message="Add your first course to build your timetable." />
      )}

      {error ? <Text variant="small" tone="danger">{error}</Text> : null}

      {adding ? (
        <Card>
          <CourseForm onSubmit={addCourse} submitting={submitting} submitLabel="Add course" />
          <Button label="Cancel" variant="ghost" fullWidth onPress={() => setAdding(false)} style={styles.cancel} />
        </Card>
      ) : (
        <Button label="Add a course" icon="add" variant="secondary" fullWidth onPress={() => setAdding(true)} />
      )}

      <Button
        label={courses.length > 0 ? 'Continue to timetable' : 'Skip for now'}
        fullWidth
        size="lg"
        onPress={() => router.push('/onboarding/timetable')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16, paddingTop: 24 },
  header: { gap: 6 },
  list: { gap: 10 },
  courseRow: { marginBottom: 0 },
  courseInner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  courseInfo: { flex: 1, gap: 2 },
  cancel: { marginTop: 8 },
});
