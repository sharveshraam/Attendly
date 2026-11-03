import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, EmptyState, Input, Loading, Screen, Text } from '@/components/ui';
import { AttendanceStatusPicker } from '@/components/domain';
import { useActiveSemester, useCourses, useEvents, useSessions, useInvalidateSemester } from '@/hooks/useAcademicData';
import { useMarkAttendance } from '@/hooks/useMarkAttendance';
import { useAuth } from '@/hooks/useAuth';
import { createEvent, deleteEvent, logScheduleChange, updateEvent } from '@/services/api/events';
import { combineDateTime, formatDateLong, formatRange, toDateKey } from '@/lib/dates';
import { useTheme } from '@/theme';
import type { AttendanceStatus } from '@/types/database';

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { active } = useActiveSemester();
  const semesterId = active?.id ?? null;
  const eventsQuery = useEvents(semesterId);
  const coursesQuery = useCourses(semesterId);
  const { sessions } = useSessions(semesterId);
  const mark = useMarkAttendance(semesterId);
  const invalidate = useInvalidateSemester(semesterId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [newDate, setNewDate] = useState(toDateKey(new Date()));
  const [newStart, setNewStart] = useState('09:00');
  const [newEnd, setNewEnd] = useState('10:00');

  const event = (eventsQuery.data ?? []).find((e) => e.id === id);
  const session = sessions.find((s) => s.event.id === id);
  const course = (coursesQuery.data ?? []).find((c) => c.id === event?.course_id);

  if (eventsQuery.isLoading) return <Loading />;
  if (!event || !active || !user) {
    return (
      <Screen contentContainerStyle={styles.empty}>
        <EmptyState icon="calendar-outline" title="Event not found" actionLabel="Back" onAction={() => router.back()} />
      </Screen>
    );
  }

  const isClass = event.kind === 'class';
  const currentStatus: AttendanceStatus = session?.record?.status ?? 'unmarked';

  const doUpdate = async (patch: Parameters<typeof updateEvent>[1], action: string) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await updateEvent(event.id, patch, user.id);
      await logScheduleChange({ event_id: event.id, semester_id: active.id, actor_id: user.id, action, before_data: event, after_data: updated });
      invalidate();
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the event.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    await doUpdate({ status: 'cancelled' }, 'cancel');
  };

  const reschedule = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateEvent(event.id, { status: 'rescheduled', updated_by: user.id, updated_at: new Date().toISOString() }, user.id);
      const replacement = await createEvent({
        semester_id: active.id,
        course_id: event.course_id,
        group_id: event.group_id,
        title: event.title,
        kind: event.kind,
        status: 'scheduled',
        starts_at: combineDateTime(newDate, newStart),
        ends_at: combineDateTime(newDate, newEnd),
        location: event.location,
        description: event.description,
        source: 'reschedule',
        verification_status: event.group_id ? 'proposed' : 'confirmed',
        created_by: user.id,
      });
      await logScheduleChange({ event_id: event.id, semester_id: active.id, actor_id: user.id, action: 'reschedule', before_data: event, after_data: replacement });
      invalidate();
      router.replace(`/events/${replacement.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reschedule.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteEvent(event.id);
      await logScheduleChange({ event_id: null, semester_id: active.id, actor_id: user.id, action: 'delete', before_data: event });
      invalidate();
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete.');
      setBusy(false);
    }
  };

  return (
    <Screen contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text variant="title" weight="bold" style={styles.flex} numberOfLines={1}>{event.title}</Text>
        <Badge label={event.kind} tone="primary" />
      </View>

      <Card style={styles.detailCard}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={18} color={theme.colors.textSecondary} />
          <Text variant="small" style={styles.flex}>{formatDateLong(event.starts_at)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={18} color={theme.colors.textSecondary} />
          <Text variant="small" style={styles.flex}>{formatRange(event.starts_at, event.ends_at)}</Text>
        </View>
        {event.location ? (
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={18} color={theme.colors.textSecondary} />
            <Text variant="small" style={styles.flex}>{event.location}</Text>
          </View>
        ) : null}
        {course ? (
          <View style={styles.detailRow}>
            <View style={[styles.courseDot, { backgroundColor: course.color }]} />
            <Text variant="small" style={styles.flex}>{course.name}</Text>
          </View>
        ) : null}
        {event.description ? <Text variant="small" tone="secondary">{event.description}</Text> : null}
        <View style={styles.badgeRow}>
          <Badge label={event.status} tone={event.status === 'cancelled' ? 'warning' : event.status === 'rescheduled' ? 'info' : 'neutral'} />
          <Badge label={event.verification_status} tone={event.verification_status === 'confirmed' ? 'success' : 'warning'} />
          {session?.pendingSync ? <Badge label="Pending sync" tone="warning" /> : null}
        </View>
      </Card>

      {isClass && event.status === 'scheduled' ? (
        <Card>
          <Text variant="subtitle" weight="semiBold" style={styles.sectionTitle}>Mark attendance</Text>
          <AttendanceStatusPicker
            value={currentStatus}
            onChange={(status) => mark.mutate({ eventId: event.id, status, baseVersion: session?.record?.marked_at })}
          />
          <Text variant="caption" tone="tertiary" style={styles.hint}>
            Unmarked sessions never count as absences. Changes sync automatically and work offline.
          </Text>
        </Card>
      ) : null}

      {error ? <Text variant="small" tone="danger">{error}</Text> : null}

      {isClass && event.status === 'scheduled' ? (
        <View style={styles.actions}>
          <Button label="Cancel class" icon="close-circle-outline" variant="secondary" fullWidth loading={busy} onPress={cancel} />
          <Button label="Reschedule" icon="time-outline" variant="secondary" fullWidth onPress={() => setRescheduling((r) => !r)} />
        </View>
      ) : null}

      {rescheduling ? (
        <Card style={styles.rescheduleForm}>
          <Text variant="subtitle" weight="semiBold">Reschedule to</Text>
          <Input label="New date" value={newDate} onChangeText={setNewDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
          <View style={styles.row}>
            <Input label="Start" value={newStart} onChangeText={setNewStart} placeholder="09:00" autoCapitalize="none" style={styles.half} />
            <Input label="End" value={newEnd} onChangeText={setNewEnd} placeholder="10:00" autoCapitalize="none" style={styles.half} />
          </View>
          <Text variant="caption" tone="tertiary">
            The original session is marked rescheduled (excluded from counts) and a new dated session is
            created, so the class is never counted twice.
          </Text>
          <Button label="Confirm reschedule" loading={busy} onPress={reschedule} />
        </Card>
      ) : null}

      <Button label="Delete event" icon="trash-outline" variant="danger" fullWidth loading={busy} onPress={remove} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingTop: 12 },
  empty: { flexGrow: 1, justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  detailCard: { gap: 10 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  courseDot: { width: 12, height: 12, borderRadius: 6 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  sectionTitle: { marginBottom: 12 },
  hint: { marginTop: 10 },
  actions: { gap: 10 },
  rescheduleForm: { gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
});
