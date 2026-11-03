import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, EmptyState, Loading, Screen, Text } from '@/components/ui';
import { CourseCard } from '@/components/domain';
import { useActiveSemester, useCourseStats } from '@/hooks/useAcademicData';

export default function Courses() {
  const router = useRouter();
  const { active } = useActiveSemester();
  const { stats, courses, isLoading } = useCourseStats(active?.id ?? null);

  return (
    <Screen contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text variant="headline" weight="bold">Courses</Text>
        <Button label="Add" icon="add" size="sm" onPress={() => router.push('/courses/edit')} />
      </View>
      <Text variant="small" tone="secondary">{active?.name ?? 'No semester'} · {courses.length} courses</Text>

      {isLoading ? (
        <Loading />
      ) : courses.length === 0 ? (
        <EmptyState icon="book-outline" title="No courses yet" message="Add the subjects you're taking this semester." actionLabel="Add a course" onAction={() => router.push('/courses/edit')} />
      ) : (
        courses.map((course) => {
          const courseStats = stats.find((s) => s.courseId === course.id);
          return courseStats ? (
            <CourseCard key={course.id} course={course} stats={courseStats} onPress={() => router.push(`/courses/${course.id}`)} />
          ) : null;
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
