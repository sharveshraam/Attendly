import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { addMonths, format } from 'date-fns';
import { Badge, Button, Card, EmptyState, Screen, SegmentedControl, Text } from '@/components/ui';
import { MonthGrid, SessionCard } from '@/components/domain';
import { useAcademicDays, useActiveSemester, useCourses, useEvents, useSessions } from '@/hooks/useAcademicData';
import { useMarkAttendance } from '@/hooks/useMarkAttendance';
import { addDays, formatDateLong, isSameDay, relativeDayLabel, toDateKey, weekDays } from '@/lib/dates';
import { useTheme } from '@/theme';
import type { AttendanceStatus } from '@/types/database';

type ViewMode = 'month' | 'week' | 'day' | 'agenda';

const DAY_KIND_LABEL: Record<string, string> = {
  instructional: 'Instructional', non_instructional: 'Non-instructional', holiday: 'Holiday',
  exam: 'Exam day', closure: 'Closure', special_working: 'Special working day',
};

export default function Calendar() {
  const router = useRouter();
  const { theme } = useTheme();
  const { active } = useActiveSemester();
  const semesterId = active?.id ?? null;
  const { sessions } = useSessions(semesterId);
  const eventsQuery = useEvents(semesterId);
  const coursesQuery = useCourses(semesterId);
  const daysQuery = useAcademicDays(semesterId);
  const mark = useMarkAttendance(semesterId);
  const [view, setView] = useState<ViewMode>('month');
  const [selected, setSelected] = useState(new Date());
  const [anchor, setAnchor] = useState(new Date());

  const events = eventsQuery.data ?? [];
  const courses = coursesQuery.data ?? [];
  const academicDays = daysQuery.data ?? [];
  const courseColor = (id: string | null) => courses.find((c) => c.id === id)?.color ?? theme.colors.primary;

  const selectedKey = toDateKey(selected);
  const daySessions = useMemo(
    () => sessions.filter((s) => toDateKey(new Date(s.event.starts_at)) === selectedKey),
    [sessions, selectedKey],
  );
  const selectedDayKind = academicDays.find((d) => d.day === selectedKey);
  const agenda = useMemo(
    () => sessions.filter((s) => new Date(s.event.starts_at).getTime() >= Date.now() - 86_400_000).slice(0, 60),
    [sessions],
  );

  const handleMark = (eventId: string, status: AttendanceStatus, base?: string | null) =>
    mark.mutate({ eventId, status, baseVersion: base });

  if (!active) {
    return (
      <Screen contentContainerStyle={styles.empty}>
        <EmptyState icon="calendar-outline" title="No semester yet" message="Set up a semester to see your calendar." actionLabel="Start setup" onAction={() => router.push('/onboarding')} />
      </Screen>
    );
  }

  return (
    <Screen contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text variant="headline" weight="bold">Calendar</Text>
        <Button label="Add" icon="add" size="sm" onPress={() => router.push('/events/new')} />
      </View>

      <SegmentedControl
        options={[{ label: 'Month', value: 'month' }, { label: 'Week', value: 'week' }, { label: 'Day', value: 'day' }, { label: 'Agenda', value: 'agenda' }]}
        value={view}
        onChange={setView}
      />

      {view === 'month' ? (
        <Card>
          <View style={styles.monthNav}>
            <Pressable onPress={() => setAnchor((a) => addMonths(a, -1))} hitSlop={10} accessibilityLabel="Previous month">
              <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
            </Pressable>
            <Text variant="subtitle" weight="semiBold">{format(anchor, 'MMMM yyyy')}</Text>
            <Pressable onPress={() => setAnchor((a) => addMonths(a, 1))} hitSlop={10} accessibilityLabel="Next month">
              <Ionicons name="chevron-forward" size={20} color={theme.colors.text} />
            </Pressable>
          </View>
          <MonthGrid anchor={anchor} selected={selected} onSelect={setSelected} events={events} academicDays={academicDays} courseColor={courseColor} />
        </Card>
      ) : null}

      {view === 'week' ? (
        <Card>
          <View style={styles.weekStrip}>
            {weekDays(selected).map((day) => {
              const isSelected = isSameDay(day, selected);
              return (
                <Pressable key={day.toISOString()} onPress={() => setSelected(day)} style={[styles.weekDay, { backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceSecondary }]}>
                  <Text variant="caption" tone={isSelected ? 'inverse' : 'secondary'}>{format(day, 'EEE')}</Text>
                  <Text variant="body" weight="bold" tone={isSelected ? 'inverse' : 'primary'}>{format(day, 'd')}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
      ) : null}

      {view === 'day' ? (
        <View style={styles.dayNav}>
          <Pressable onPress={() => setSelected((d) => addDays(d, -1))} style={[styles.navBtn, { backgroundColor: theme.colors.surface }]} accessibilityLabel="Previous day">
            <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
          </Pressable>
          <Text variant="subtitle" weight="semiBold">{relativeDayLabel(selected.toISOString())}</Text>
          <Pressable onPress={() => setSelected((d) => addDays(d, 1))} style={[styles.navBtn, { backgroundColor: theme.colors.surface }]} accessibilityLabel="Next day">
            <Ionicons name="chevron-forward" size={20} color={theme.colors.text} />
          </Pressable>
        </View>
      ) : null}

      {view !== 'agenda' ? (
        <>
          <View style={styles.dayHeader}>
            <Text variant="subtitle" weight="semiBold">{formatDateLong(selected.toISOString())}</Text>
            {selectedDayKind ? <Badge label={DAY_KIND_LABEL[selectedDayKind.kind] ?? selectedDayKind.kind} tone={selectedDayKind.kind === 'holiday' ? 'danger' : 'info'} /> : null}
          </View>
          {daySessions.length === 0 ? (
            <Card><Text variant="small" tone="secondary">No classes on this day.</Text></Card>
          ) : (
            daySessions.map((session) => (
              <SessionCard
                key={session.event.id}
                session={session}
                course={courses.find((c) => c.id === session.event.course_id)}
                onMark={(status) => handleMark(session.event.id, status, session.record?.marked_at)}
                onPress={() => router.push(`/events/${session.event.id}`)}
              />
            ))
          )}
        </>
      ) : (
        <>
          <Text variant="subtitle" weight="semiBold" style={styles.agendaTitle}>Upcoming</Text>
          {agenda.length === 0 ? (
            <EmptyState icon="calendar-outline" title="Nothing scheduled" message="Your upcoming classes will appear here." />
          ) : (
            agenda.map((session) => (
              <SessionCard
                key={session.event.id}
                session={session}
                showDate
                course={courses.find((c) => c.id === session.event.course_id)}
                onMark={(status) => handleMark(session.event.id, status, session.record?.marked_at)}
                onPress={() => router.push(`/events/${session.event.id}`)}
              />
            ))
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingTop: 12 },
  empty: { flexGrow: 1, justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  weekStrip: { flexDirection: 'row', gap: 6 },
  weekDay: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: 12 },
  dayNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  agendaTitle: { marginTop: 4 },
});
