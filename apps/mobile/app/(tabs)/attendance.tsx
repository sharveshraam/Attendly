import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, EmptyState, ProgressRing, Screen, SectionHeader, SegmentedControl, Text } from '@/components/ui';
import { CourseCard, SessionCard } from '@/components/domain';
import { useActiveSemester, useCourseStats, useSessions } from '@/hooks/useAcademicData';
import { useMarkAttendance } from '@/hooks/useMarkAttendance';
import { summarize } from '@/lib/attendance/engine';
import { useTheme } from '@/theme';
import type { AttendanceStatus } from '@/types/database';

type Filter = 'all' | 'risk' | 'safe';
type Sort = 'name' | 'percent' | 'risk';

export default function Attendance() {
  const router = useRouter();
  const { theme } = useTheme();
  const { active } = useActiveSemester();
  const semesterId = active?.id ?? null;
  const { stats, courses } = useCourseStats(semesterId);
  const { sessions } = useSessions(semesterId);
  const mark = useMarkAttendance(semesterId);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('risk');

  const overall = useMemo(() => {
    const engineSessions = sessions.map((s) => ({ status: s.record?.status ?? ('unmarked' as const), lifecycle: s.event.status }));
    return summarize({ sessions: engineSessions, targetPercent: active?.attendance_target ?? 75 });
  }, [sessions, active]);

  const filteredStats = useMemo(() => {
    let list = [...stats];
    if (filter === 'risk') list = list.filter((s) => s.risk === 'at_risk' || s.risk === 'warning');
    if (filter === 'safe') list = list.filter((s) => s.risk === 'safe');
    list.sort((a, b) => {
      if (sort === 'name') {
        const an = courses.find((c) => c.id === a.courseId)?.name ?? '';
        const bn = courses.find((c) => c.id === b.courseId)?.name ?? '';
        return an.localeCompare(bn);
      }
      if (sort === 'percent') return (a.percent ?? -1) - (b.percent ?? -1);
      const rank = { at_risk: 0, warning: 1, unknown: 2, safe: 3 };
      return rank[a.risk] - rank[b.risk];
    });
    return list;
  }, [stats, filter, sort, courses]);

  const needsMarking = useMemo(
    () => sessions.filter((s) => s.effectiveStatus === 'unmarked' && new Date(s.event.starts_at).getTime() <= Date.now()).slice(0, 8),
    [sessions],
  );

  const handleMark = (eventId: string, status: AttendanceStatus, base?: string | null) =>
    mark.mutate({ eventId, status, baseVersion: base });

  if (!active) {
    return (
      <Screen contentContainerStyle={styles.empty}>
        <EmptyState icon="checkmark-done-outline" title="No semester yet" message="Set up a semester to track attendance." actionLabel="Start setup" onAction={() => router.push('/onboarding')} />
      </Screen>
    );
  }

  return (
    <Screen contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text variant="headline" weight="bold">Attendance</Text>
        <Pressable onPress={() => router.push('/analytics')} style={[styles.iconBtn, { backgroundColor: theme.colors.surface }]} accessibilityLabel="Analytics">
          <Ionicons name="analytics-outline" size={20} color={theme.colors.primary} />
        </Pressable>
      </View>

      <Card style={styles.overallCard}>
        <ProgressRing percent={overall.percent} size={92} caption="overall" />
        <View style={styles.overallInfo}>
          <Text variant="subtitle" weight="semiBold">{overall.percent === null ? 'Start marking' : `${overall.percent}% attended`}</Text>
          <Text variant="small" tone="secondary">{overall.present} present · {overall.absent} absent · {overall.excused} excused</Text>
          <Text variant="caption" tone="tertiary">{overall.unmarked} unmarked · {overall.cancelled} cancelled</Text>
        </View>
      </Card>

      <View style={styles.toolsRow}>
        {[
          { label: 'Bunk calculator', icon: 'umbrella-outline' as const, route: '/tools/bunk' },
          { label: 'Recovery', icon: 'trending-up-outline' as const, route: '/tools/recovery' },
          { label: 'What-if', icon: 'git-compare-outline' as const, route: '/tools/what-if' },
        ].map((tool) => (
          <Pressable key={tool.label} onPress={() => router.push(tool.route as never)} style={[styles.tool, { backgroundColor: theme.colors.surface }]} accessibilityRole="button">
            <Ionicons name={tool.icon} size={18} color={theme.colors.secondary} />
            <Text variant="caption" weight="medium" style={styles.toolLabel}>{tool.label}</Text>
          </Pressable>
        ))}
      </View>

      {needsMarking.length > 0 ? (
        <>
          <SectionHeader title="Needs marking" />
          {needsMarking.map((session) => (
            <SessionCard
              key={session.event.id}
              session={session}
              showDate
              course={courses.find((c) => c.id === session.event.course_id)}
              onMark={(status) => handleMark(session.event.id, status, session.record?.marked_at)}
              onPress={() => router.push(`/events/${session.event.id}`)}
            />
          ))}
        </>
      ) : null}

      <SectionHeader title="Courses" />
      <SegmentedControl
        options={[{ label: 'All', value: 'all' }, { label: 'At risk', value: 'risk' }, { label: 'On track', value: 'safe' }]}
        value={filter}
        onChange={setFilter}
      />
      <View style={styles.sortRow}>
        <Text variant="caption" tone="secondary">Sort by</Text>
        {(['risk', 'percent', 'name'] as Sort[]).map((s) => (
          <Pressable key={s} onPress={() => setSort(s)} style={[styles.sortChip, { backgroundColor: sort === s ? theme.colors.primarySoft : theme.colors.surfaceSecondary }]}>
            <Text variant="caption" weight={sort === s ? 'semiBold' : 'medium'} tone={sort === s ? 'accent' : 'secondary'}>{s}</Text>
          </Pressable>
        ))}
      </View>

      {filteredStats.length === 0 ? (
        <EmptyState icon="book-outline" title="No courses" message="Add courses to see attendance here." actionLabel="Manage courses" onAction={() => router.push('/courses')} />
      ) : (
        filteredStats.map((s) => {
          const course = courses.find((c) => c.id === s.courseId);
          return course ? <CourseCard key={s.courseId} course={course} stats={s} onPress={() => router.push(`/courses/${course.id}`)} /> : null;
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingTop: 12 },
  empty: { flexGrow: 1, justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  overallCard: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  overallInfo: { flex: 1, gap: 4 },
  toolsRow: { flexDirection: 'row', gap: 10 },
  tool: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: 14 },
  toolLabel: { textAlign: 'center' },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sortChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
});
