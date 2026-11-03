import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, EmptyState, ProgressRing, Screen, Text } from '@/components/ui';
import { CoursePicker, RiskBadge } from '@/components/domain';
import { useActiveSemester, useCourseStats } from '@/hooks/useAcademicData';
import { percentAfterMissingOne, summarize } from '@/lib/attendance/engine';
import { useSessions } from '@/hooks/useAcademicData';
import { useTheme } from '@/theme';

export default function BunkCalculator() {
  const { theme } = useTheme();
  const { active } = useActiveSemester();
  const semesterId = active?.id ?? null;
  const { stats, courses } = useCourseStats(semesterId);
  const { sessions } = useSessions(semesterId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const courseId = selectedId ?? courses[0]?.id ?? null;
  const course = courses.find((c) => c.id === courseId);
  const courseStats = stats.find((s) => s.courseId === courseId);

  const summary = useMemo(() => {
    if (!courseStats || !courseId) return null;
    return summarize({
      sessions: sessions.filter((s) => s.event.course_id === courseId).map((s) => ({ status: s.record?.status ?? 'unmarked', lifecycle: s.event.status })),
      targetPercent: courseStats.target,
      mode: courseStats.mode,
      futureUnits: courseStats.futureScheduled,
    });
  }, [sessions, courseId, courseStats]);

  const ranked = useMemo(
    () => [...stats].filter((s) => s.percent !== null).sort((a, b) => (a.bunkAllowance ?? 0) - (b.bunkAllowance ?? 0)),
    [stats],
  );

  if (courses.length === 0) {
    return (
      <Screen contentContainerStyle={styles.empty}>
        <EmptyState icon="umbrella-outline" title="No courses yet" message="Add courses and mark attendance to calculate bunk allowance." />
      </Screen>
    );
  }

  const afterMiss = summary ? percentAfterMissingOne(summary) : null;

  return (
    <Screen contentContainerStyle={styles.container}>
      <Text variant="headline" weight="bold">Bunk calculator</Text>
      <Text variant="small" tone="secondary">How many classes you can safely miss while staying at or above target.</Text>

      <CoursePicker courses={courses} selectedId={courseId} onSelect={setSelectedId} />

      {course && courseStats && summary ? (
        <Card style={styles.mainCard}>
          <ProgressRing percent={courseStats.percent} size={96} color={course.color} caption={course.name} />
          <View style={styles.mainInfo}>
            <Text variant="display" weight="bold" tone={courseStats.bunkAllowance === 0 ? 'danger' : 'success'}>
              {courseStats.bunkAllowance === null ? '—' : courseStats.bunkAllowance}
            </Text>
            <Text variant="small" tone="secondary">classes you can still miss</Text>
            <RiskBadge risk={courseStats.risk} />
          </View>
        </Card>
      ) : null}

      {courseStats ? (
        <View style={styles.detailCards}>
          <Card style={styles.detailCard}>
            <Ionicons name="arrow-down-circle-outline" size={18} color={theme.colors.warning} />
            <Text variant="small" weight="semiBold">If you miss the next class</Text>
            <Text variant="title" weight="bold">{afterMiss === null ? '—' : `${afterMiss}%`}</Text>
            <Text variant="caption" tone="secondary">Target {courseStats.target}%</Text>
          </Card>
          <Card style={styles.detailCard}>
            <Ionicons name="calendar-outline" size={18} color={theme.colors.info} />
            <Text variant="small" weight="semiBold">Remaining scheduled</Text>
            <Text variant="title" weight="bold">{courseStats.futureScheduled}</Text>
            <Text variant="caption" tone="secondary">{courseStats.futureScheduled === 0 ? 'No future data — estimate limited' : 'classes ahead'}</Text>
          </Card>
        </View>
      ) : null}

      {courseStats?.bunkAllowance === null ? (
        <Card style={styles.warningCard}>
          <Ionicons name="information-circle-outline" size={16} color={theme.colors.warning} />
          <Text variant="caption" tone="secondary" style={styles.flex}>
            Future schedule data is incomplete, so a reliable bunk allowance can't be computed yet. Add
            your timetable for accurate projections.
          </Text>
        </Card>
      ) : null}

      <Text variant="subtitle" weight="semiBold" style={styles.sectionTitle}>Least flexibility first</Text>
      {ranked.map((s) => {
        const c = courses.find((x) => x.id === s.courseId);
        return c ? (
          <Card key={s.courseId} style={styles.rankCard}>
            <View style={[styles.dot, { backgroundColor: c.color }]} />
            <Text variant="small" weight="medium" style={styles.flex} numberOfLines={1}>{c.name}</Text>
            <Text variant="small" tone="secondary">{s.percent}%</Text>
            <Text variant="small" weight="bold" tone={(s.bunkAllowance ?? 0) === 0 ? 'danger' : 'primary'}>
              {s.bunkAllowance === null ? '—' : `${s.bunkAllowance} left`}
            </Text>
          </Card>
        ) : null;
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingTop: 16 },
  empty: { flexGrow: 1, justifyContent: 'center' },
  mainCard: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  mainInfo: { flex: 1, gap: 6 },
  detailCards: { flexDirection: 'row', gap: 10 },
  detailCard: { flex: 1, gap: 6 },
  warningCard: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  flex: { flex: 1 },
  sectionTitle: { marginTop: 4 },
  rankCard: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 0 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
