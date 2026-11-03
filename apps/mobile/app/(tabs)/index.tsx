import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, EmptyState, Loading, ProgressRing, Screen, SectionHeader, Text } from '@/components/ui';
import { CourseCard, SessionCard, StatCard } from '@/components/domain';
import { useAuth } from '@/hooks/useAuth';
import { useActiveSemester, useAssignments, useCourseStats, useEvents, useSessions } from '@/hooks/useAcademicData';
import { useMarkAttendance } from '@/hooks/useMarkAttendance';
import { summarize } from '@/lib/attendance/engine';
import { countdownLabel, formatTime, isToday } from '@/lib/dates';
import { useTheme } from '@/theme';
import type { AttendanceStatus } from '@/types/database';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Home() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { active, isLoading: semesterLoading } = useActiveSemester();
  const semesterId = active?.id ?? null;
  const { stats, courses, isLoading: statsLoading } = useCourseStats(semesterId);
  const { sessions } = useSessions(semesterId);
  const eventsQuery = useEvents(semesterId);
  const assignmentsQuery = useAssignments(semesterId);
  const mark = useMarkAttendance(semesterId);

  const name = (user?.user_metadata?.display_name as string) || 'there';
  const events = eventsQuery.data ?? [];
  const assignments = assignmentsQuery.data ?? [];

  const overall = useMemo(() => {
    const engineSessions = sessions.map((s) => ({
      status: s.record?.status ?? ('unmarked' as const),
      lifecycle: s.event.status,
    }));
    return summarize({ sessions: engineSessions, targetPercent: active?.attendance_target ?? 75 });
  }, [sessions, active]);

  const todaysClasses = useMemo(
    () => sessions.filter((s) => isToday(new Date(s.event.starts_at)) && s.event.status !== 'cancelled'),
    [sessions],
  );
  const nextClass = useMemo(
    () => sessions.find((s) => s.event.status === 'scheduled' && new Date(s.event.starts_at).getTime() > Date.now()),
    [sessions],
  );
  const atRisk = stats.filter((s) => s.risk === 'at_risk' || s.risk === 'warning');
  const upcomingExams = events
    .filter((e) => e.kind === 'exam' && new Date(e.starts_at).getTime() > Date.now())
    .slice(0, 3);
  const upcomingAssignments = assignments
    .filter((a) => a.status !== 'submitted' && a.due_at && new Date(a.due_at).getTime() > Date.now())
    .slice(0, 3);
  const totalBunk = stats.reduce((sum, s) => sum + (s.bunkAllowance ?? 0), 0);

  const handleMark = (eventId: string, status: AttendanceStatus, baseVersion?: string | null) => {
    mark.mutate({ eventId, status, baseVersion });
  };

  if (semesterLoading) return <Loading label="Loading your semester…" />;

  if (!active) {
    return (
      <Screen contentContainerStyle={styles.emptyContainer}>
        <EmptyState
          icon="rocket-outline"
          title="Welcome to Attendly"
          message="Set up your semester, courses and timetable to start tracking attendance."
          actionLabel="Start setup"
          onAction={() => router.push('/onboarding')}
        />
      </Screen>
    );
  }

  return (
    <Screen contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text variant="caption" tone="secondary">{greeting()},</Text>
          <Text variant="headline" weight="bold" numberOfLines={1}>{name}</Text>
          <Text variant="small" tone="secondary">{active.name}{active.institution ? ` · ${active.institution}` : ''}</Text>
        </View>
        <Pressable onPress={() => router.push('/notifications')} style={[styles.iconBtn, { backgroundColor: theme.colors.surface }]} accessibilityLabel="Notifications">
          <Ionicons name="notifications-outline" size={20} color={theme.colors.text} />
        </Pressable>
      </View>

      <Card style={styles.overallCard}>
        <ProgressRing percent={overall.percent} size={104} caption="overall" />
        <View style={styles.overallInfo}>
          <Text variant="subtitle" weight="semiBold">
            {overall.percent === null ? 'No attendance yet' : overall.percent >= (active.attendance_target) ? 'You’re on track' : 'Below target'}
          </Text>
          <Text variant="small" tone="secondary">
            {overall.present} attended · {overall.absent} missed · {overall.unmarked} unmarked
          </Text>
          <Text variant="caption" tone="tertiary">Target {active.attendance_target}% · {overall.counted} counted classes</Text>
        </View>
      </Card>

      <View style={styles.statsRow}>
        <StatCard label="Today" value={`${todaysClasses.length}`} sublabel="classes" icon="today-outline" />
        <StatCard label="Can miss" value={`${totalBunk}`} sublabel="classes total" icon="umbrella-outline" accent={theme.colors.secondary} />
        <StatCard label="At risk" value={`${atRisk.length}`} sublabel="courses" icon="alert-circle-outline" accent={atRisk.length > 0 ? theme.colors.danger : theme.colors.success} />
      </View>

      <View style={styles.quickActions}>
        {[
          { icon: 'checkmark-done-outline' as const, label: 'Mark', route: '/(tabs)/attendance' },
          { icon: 'calendar-outline' as const, label: 'Calendar', route: '/(tabs)/calendar' },
          { icon: 'analytics-outline' as const, label: 'Analytics', route: '/analytics' },
          { icon: 'chatbubble-ellipses-outline' as const, label: 'Assistant', route: '/assistant' },
        ].map((action) => (
          <Pressable key={action.label} onPress={() => router.push(action.route as never)} style={[styles.quickAction, { backgroundColor: theme.colors.surface }]} accessibilityRole="button">
            <Ionicons name={action.icon} size={20} color={theme.colors.primary} />
            <Text variant="caption" weight="medium">{action.label}</Text>
          </Pressable>
        ))}
      </View>

      {nextClass ? (
        <>
          <SectionHeader title="Next class" />
          <Card style={styles.nextCard}>
            <View style={styles.nextRow}>
              <View style={[styles.nextIcon, { backgroundColor: theme.colors.primarySoft }]}>
                <Ionicons name="time-outline" size={20} color={theme.colors.primary} />
              </View>
              <View style={styles.flex}>
                <Text variant="body" weight="semiBold">{nextClass.event.title}</Text>
                <Text variant="caption" tone="secondary">
                  {formatTime(nextClass.event.starts_at)}{nextClass.event.location ? ` · ${nextClass.event.location}` : ''}
                </Text>
              </View>
              <Text variant="small" weight="semiBold" tone="accent">{countdownLabel(nextClass.event.starts_at)}</Text>
            </View>
          </Card>
        </>
      ) : null}

      <SectionHeader title="Today's classes" actionLabel="See all" onAction={() => router.push('/(tabs)/calendar')} />
      {todaysClasses.length === 0 ? (
        <Card><Text variant="small" tone="secondary">No classes today. Enjoy the break!</Text></Card>
      ) : (
        todaysClasses.slice(0, 4).map((session) => (
          <SessionCard
            key={session.event.id}
            session={session}
            course={courses.find((c) => c.id === session.event.course_id)}
            onMark={(status) => handleMark(session.event.id, status, session.record?.marked_at)}
            onPress={() => router.push(`/events/${session.event.id}`)}
          />
        ))
      )}

      {atRisk.length > 0 ? (
        <>
          <SectionHeader title="Needs attention" actionLabel="Attendance" onAction={() => router.push('/(tabs)/attendance')} />
          {atRisk.slice(0, 3).map((s) => {
            const course = courses.find((c) => c.id === s.courseId);
            return course ? (
              <CourseCard key={s.courseId} course={course} stats={s} onPress={() => router.push(`/courses/${course.id}`)} />
            ) : null;
          })}
        </>
      ) : null}

      {upcomingExams.length > 0 || upcomingAssignments.length > 0 ? (
        <>
          <SectionHeader title="Coming up" actionLabel="Productivity" onAction={() => router.push('/productivity')} />
          <Card style={styles.comingUp}>
            {upcomingExams.map((exam) => (
              <View key={exam.id} style={styles.comingRow}>
                <Ionicons name="school-outline" size={16} color={theme.colors.info} />
                <Text variant="small" style={styles.flex} numberOfLines={1}>{exam.title}</Text>
                <Text variant="caption" tone="secondary">{countdownLabel(exam.starts_at)}</Text>
              </View>
            ))}
            {upcomingAssignments.map((assignment) => (
              <View key={assignment.id} style={styles.comingRow}>
                <Ionicons name="document-text-outline" size={16} color={theme.colors.warning} />
                <Text variant="small" style={styles.flex} numberOfLines={1}>{assignment.title}</Text>
                <Text variant="caption" tone="secondary">{assignment.due_at ? countdownLabel(assignment.due_at) : ''}</Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {statsLoading ? <Loading /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingTop: 12 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  iconBtn: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  overallCard: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  overallInfo: { flex: 1, gap: 4 },
  statsRow: { flexDirection: 'row', gap: 10 },
  quickActions: { flexDirection: 'row', gap: 10 },
  quickAction: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: 16 },
  nextCard: { marginBottom: 4 },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  comingUp: { gap: 12 },
  comingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
