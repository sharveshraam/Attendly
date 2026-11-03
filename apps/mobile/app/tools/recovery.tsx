import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, EmptyState, ProgressRing, Screen, Text } from '@/components/ui';
import { CoursePicker } from '@/components/domain';
import { useActiveSemester, useCourseStats } from '@/hooks/useAcademicData';
import { useTheme } from '@/theme';

export default function RecoveryCalculator() {
  const { theme } = useTheme();
  const { active } = useActiveSemester();
  const { stats, courses } = useCourseStats(active?.id ?? null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const courseId = selectedId ?? courses[0]?.id ?? null;
  const course = courses.find((c) => c.id === courseId);
  const courseStats = stats.find((s) => s.courseId === courseId);

  if (courses.length === 0) {
    return (
      <Screen contentContainerStyle={styles.empty}>
        <EmptyState icon="trending-up-outline" title="No courses yet" message="Add courses and mark attendance to plan recovery." />
      </Screen>
    );
  }

  return (
    <Screen contentContainerStyle={styles.container}>
      <Text variant="headline" weight="bold">Recovery calculator</Text>
      <Text variant="small" tone="secondary">How many consecutive classes you must attend to reach your target.</Text>

      <CoursePicker courses={courses} selectedId={courseId} onSelect={setSelectedId} />

      {course && courseStats ? (
        <>
          <Card style={styles.mainCard}>
            <ProgressRing percent={courseStats.percent} size={96} color={course.color} caption="current" />
            <View style={styles.mainInfo}>
              {courseStats.recoveryClasses === null ? (
                <>
                  <Text variant="title" weight="bold" tone="danger">Not recoverable</Text>
                  <Text variant="caption" tone="secondary">A 100% target can't be reached after a missed class.</Text>
                </>
              ) : courseStats.recoveryClasses === 0 ? (
                <>
                  <Text variant="title" weight="bold" tone="success">On target</Text>
                  <Text variant="caption" tone="secondary">You're at or above {courseStats.target}%. Keep it up.</Text>
                </>
              ) : (
                <>
                  <Text variant="display" weight="bold" tone="warning">{courseStats.recoveryClasses}</Text>
                  <Text variant="small" tone="secondary">consecutive classes to attend</Text>
                </>
              )}
            </View>
          </Card>

          <Card style={styles.explainCard}>
            <Ionicons name="bulb-outline" size={18} color={theme.colors.secondary} />
            <Text variant="caption" tone="secondary" style={styles.flex}>
              Recovery solves (attended + n) / (counted + n) ≥ target for the smallest whole n. Attending
              extra classes beyond the schedule also counts toward recovery.
            </Text>
          </Card>

          <View style={styles.projectionRow}>
            <Card style={styles.projectionCard}>
              <Text variant="caption" tone="secondary">Attend all remaining</Text>
              <Text variant="title" weight="bold" tone="success">
                {courseStats.projectedBestPercent === null ? '—' : `${courseStats.projectedBestPercent}%`}
              </Text>
            </Card>
            <Card style={styles.projectionCard}>
              <Text variant="caption" tone="secondary">Miss all remaining</Text>
              <Text variant="title" weight="bold" tone="danger">
                {courseStats.projectedWorstPercent === null ? '—' : `${courseStats.projectedWorstPercent}%`}
              </Text>
            </Card>
          </View>
          {courseStats.projectedBestPercent === null ? (
            <Text variant="caption" tone="tertiary">Projections need future schedule data. Add your timetable to enable estimates.</Text>
          ) : (
            <Text variant="caption" tone="tertiary">Estimates based on {courseStats.futureScheduled} remaining scheduled classes.</Text>
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingTop: 16 },
  empty: { flexGrow: 1, justifyContent: 'center' },
  mainCard: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  mainInfo: { flex: 1, gap: 6 },
  explainCard: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  flex: { flex: 1 },
  projectionRow: { flexDirection: 'row', gap: 10 },
  projectionCard: { flex: 1, gap: 6, alignItems: 'center' },
});
