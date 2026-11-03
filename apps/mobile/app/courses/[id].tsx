import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, EmptyState, Loading, ProgressRing, Screen, SectionHeader, Text } from '@/components/ui';
import { RiskBadge, SessionCard } from '@/components/domain';
import { useActiveSemester, useAssignments, useCourseStats, useSessions, useTimetableRules } from '@/hooks/useAcademicData';
import { useMarkAttendance } from '@/hooks/useMarkAttendance';
import { percentAfterMissingOne } from '@/lib/attendance/engine';
import { summarize } from '@/lib/attendance/engine';
import { WEEKDAYS_SHORT } from '@/constants';
import { formatRange } from '@/lib/dates';
import { useTheme } from '@/theme';
import type { AttendanceStatus } from '@/types/database';

export default function CourseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { active } = useActiveSemester();
  const semesterId = active?.id ?? null;
  const { stats, courses, isLoading } = useCourseStats(semesterId);
  const { sessions } = useSessions(semesterId);
  const rulesQuery = useTimetableRules(semesterId);
  const assignmentsQuery = useAssignments(semesterId);
  const mark = useMarkAttendance(semesterId);
  const [tab, setTab] = useState<'history' | 'schedule'>('history');

  const course = courses.find((c) => c.id === id);
  const courseStats = stats.find((s) => s.courseId === id);
  const courseSessions = useMemo(
    () => sessions.filter((s) => s.event.course_id === id).sort((a, b) => b.event.starts_at.localeCompare(a.event.starts_at)),
    [sessions, id],
  );
  const courseRules = (rulesQuery.data ?? []).filter((r) => r.course_id === id);
  const courseAssignments = (assignmentsQuery.data ?? []).filter((a) => a.course_id === id);

  const summary = useMemo(() => {
    if (!courseStats) return null;
    return summarize({
      sessions: courseSessions.map((s) => ({ status: s.record?.status ?? 'unmarked', lifecycle: s.event.status })),
      targetPercent: courseStats.target,
      mode: courseStats.mode,
    });
  }, [courseSessions, courseStats]);

  if (isLoading) return <Loading />;
  if (!course || !courseStats) {
    return (
      <Screen contentContainerStyle={styles.empty}>
        <EmptyState icon="book-outline" title="Course not found" actionLabel="Back to courses" onAction={() => router.back()} />
      </Screen>
    );
  }

  const afterMiss = summary ? percentAfterMissingOne(summary) : null;

  return (
    <Screen contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <View style={[styles.dot, { backgroundColor: course.color }]} />
        <View style={styles.flex}>
          <Text variant="title" weight="bold" numberOfLines={1}>{course.name}</Text>
          {course.code ? <Text variant="caption" tone="secondary">{course.code} · {course.category}</Text> : null}
        </View>
        <Pressable onPress={() => router.push(`/courses/edit?id=${course.id}`)} hitSlop={10} accessibilityLabel="Edit course">
          <Ionicons name="create-outline" size={22} color={theme.colors.primary} />
        </Pressable>
      </View>

      <Card style={styles.summaryCard}>
        <ProgressRing percent={courseStats.percent} size={100} color={course.color} caption="attendance" />
        <View style={styles.summaryInfo}>
          <RiskBadge risk={courseStats.risk} />
          <Text variant="small" tone="secondary">Target {courseStats.target}% · {course.calculation_mode === 'hours' ? 'hour-based' : 'class-based'}</Text>
          <Text variant="caption" tone="tertiary">
            {courseStats.bunkAllowance === null ? 'Bunk allowance unknown' : `Can miss ${courseStats.bunkAllowance} more`}
            {afterMiss !== null ? ` · next miss → ${afterMiss}%` : ''}
          </Text>
        </View>
      </Card>

      <View style={styles.statGrid}>
        {[
          { label: 'Conducted', value: courseStats.conducted },
          { label: 'Attended', value: courseStats.attended },
          { label: 'Missed', value: courseStats.missed },
          { label: 'Unmarked', value: courseStats.unmarked },
          { label: 'Excused', value: courseStats.excused },
          { label: 'Cancelled', value: courseStats.cancelled },
        ].map((stat) => (
          <Card key={stat.label} style={styles.statCell}>
            <Text variant="title" weight="bold">{stat.value}</Text>
            <Text variant="caption" tone="secondary">{stat.label}</Text>
          </Card>
        ))}
      </View>

      {courseStats.recoveryClasses !== null && courseStats.recoveryClasses > 0 ? (
        <Card style={styles.recoveryCard}>
          <Ionicons name="trending-up-outline" size={18} color={theme.colors.warning} />
          <Text variant="small" style={styles.flex}>
            Attend the next <Text variant="small" weight="bold" tone="warning">{courseStats.recoveryClasses}</Text> classes consecutively to reach {courseStats.target}%.
          </Text>
        </Card>
      ) : null}

      {courseStats.projectedBestPercent !== null ? (
        <Text variant="caption" tone="tertiary">
          Estimate: attend all remaining → {courseStats.projectedBestPercent}% · miss all → {courseStats.projectedWorstPercent}%
        </Text>
      ) : (
        <Text variant="caption" tone="tertiary">Projections unavailable — future schedule data is incomplete.</Text>
      )}

      <View style={styles.tabRow}>
        {(['history', 'schedule'] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, { borderBottomColor: tab === t ? theme.colors.primary : 'transparent' }]}>
            <Text variant="small" weight={tab === t ? 'semiBold' : 'medium'} tone={tab === t ? 'accent' : 'secondary'}>
              {t === 'history' ? 'Attendance history' : 'Weekly schedule'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'history' ? (
        courseSessions.length === 0 ? (
          <EmptyState icon="time-outline" title="No sessions yet" message="Classes appear here once your timetable is generated." />
        ) : (
          courseSessions.slice(0, 40).map((session) => (
            <SessionCard
              key={session.event.id}
              session={session}
              showDate
              course={course}
              onMark={(status: AttendanceStatus) => mark.mutate({ eventId: session.event.id, status, baseVersion: session.record?.marked_at })}
              onPress={() => router.push(`/events/${session.event.id}`)}
            />
          ))
        )
      ) : courseRules.length === 0 ? (
        <EmptyState icon="calendar-outline" title="No recurring classes" message="Add classes to this course's weekly timetable." />
      ) : (
        courseRules.map((rule) => (
          <Card key={rule.id} style={styles.ruleCard}>
            <Badge label={WEEKDAYS_SHORT[rule.weekday] ?? ''} tone="primary" />
            <Text variant="small" weight="medium" style={styles.flex}>{rule.starts_at.slice(0, 5)}–{rule.ends_at.slice(0, 5)}</Text>
            {rule.location ? <Text variant="caption" tone="secondary">{rule.location}</Text> : null}
          </Card>
        ))
      )}

      {courseAssignments.length > 0 ? (
        <>
          <SectionHeader title="Assignments" />
          {courseAssignments.map((assignment) => (
            <Card key={assignment.id} style={styles.assignmentCard}>
              <Ionicons name="document-text-outline" size={16} color={theme.colors.warning} />
              <Text variant="small" style={styles.flex} numberOfLines={1}>{assignment.title}</Text>
              <Badge label={assignment.status.replace('_', ' ')} tone={assignment.status === 'submitted' ? 'success' : 'neutral'} />
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingTop: 12 },
  empty: { flexGrow: 1, justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  flex: { flex: 1 },
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  summaryInfo: { flex: 1, gap: 6 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCell: { width: '31%', alignItems: 'center', gap: 2, paddingVertical: 12 },
  recoveryCard: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tabRow: { flexDirection: 'row', gap: 16, marginTop: 4 },
  tab: { paddingBottom: 8, borderBottomWidth: 2 },
  ruleCard: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 0 },
  assignmentCard: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 0 },
});
