import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, Input, Screen, Text } from '@/components/ui';
import { useForm } from '@/hooks/useForm';
import { eventSchema } from '@/lib/validation';
import { useActiveSemester, useCourses } from '@/hooks/useAcademicData';
import { useAuth } from '@/hooks/useAuth';
import { useInvalidateSemester } from '@/hooks/useAcademicData';
import { createEvent, logScheduleChange } from '@/services/api/events';
import { combineDateTime, toDateKey } from '@/lib/dates';
import { useTheme } from '@/theme';
import type { CalendarEventKind } from '@/types/database';

const KINDS: { value: CalendarEventKind; label: string }[] = [
  { value: 'class', label: 'Class' },
  { value: 'exam', label: 'Exam' },
  { value: 'deadline', label: 'Deadline' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'other', label: 'Event' },
];

export default function NewEvent() {
  const router = useRouter();
  const { theme } = useTheme();
  const { kind: kindParam } = useLocalSearchParams<{ kind?: string }>();
  const { user } = useAuth();
  const { active } = useActiveSemester();
  const coursesQuery = useCourses(active?.id ?? null);
  const invalidate = useInvalidateSemester(active?.id ?? null);
  const courses = coursesQuery.data ?? [];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = toDateKey(new Date());
  const initialKind = (KINDS.find((k) => k.value === kindParam)?.value ?? 'other') as CalendarEventKind;
  const form = useForm(eventSchema, {
    title: '',
    kind: initialKind,
    courseId: '',
    startDate: today,
    startTime: '09:00',
    endDate: today,
    endTime: '10:00',
    location: '',
    description: '',
  });

  const submit = async () => {
    const values = form.validate();
    if (!values || !user || !active) return;
    setBusy(true);
    setError(null);
    try {
      const event = await createEvent({
        semester_id: active.id,
        title: values.title,
        kind: values.kind,
        course_id: values.courseId || null,
        starts_at: combineDateTime(values.startDate, values.startTime),
        ends_at: combineDateTime(values.endDate, values.endTime),
        location: values.location || null,
        description: values.description || null,
        source: 'manual',
        verification_status: 'confirmed',
        created_by: user.id,
      });
      await logScheduleChange({ event_id: event.id, semester_id: active.id, actor_id: user.id, action: 'create', after_data: event });
      invalidate();
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the event.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen keyboardAvoiding contentContainerStyle={styles.container}>
      <Text variant="headline" weight="bold">New event</Text>

      <View style={styles.kindRow}>
        {KINDS.map((k) => (
          <Pressable key={k.value} onPress={() => form.setValue('kind', k.value)} style={[styles.kindChip, { backgroundColor: form.values.kind === k.value ? theme.colors.primarySoft : theme.colors.surfaceSecondary, borderColor: form.values.kind === k.value ? theme.colors.primary : 'transparent' }]}>
            <Text variant="caption" weight={form.values.kind === k.value ? 'semiBold' : 'medium'} tone={form.values.kind === k.value ? 'accent' : 'secondary'}>{k.label}</Text>
          </Pressable>
        ))}
      </View>

      <Input label="Title" value={form.values.title} onChangeText={(v) => form.setValue('title', v)} placeholder="e.g. Midterm exam" error={form.errors.title} />

      {form.values.kind === 'class' && courses.length > 0 ? (
        <View style={styles.courseChips}>
          {courses.map((course) => (
            <Pressable key={course.id} onPress={() => form.setValue('courseId', form.values.courseId === course.id ? '' : course.id)} style={[styles.chip, { backgroundColor: form.values.courseId === course.id ? theme.colors.primarySoft : theme.colors.surfaceSecondary }]}>
              <Text variant="caption" weight="medium">{course.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.row}>
        <Input label="Start date" value={form.values.startDate} onChangeText={(v) => form.setValue('startDate', v)} placeholder="YYYY-MM-DD" autoCapitalize="none" style={styles.half} error={form.errors.startDate} />
        <Input label="Start time" value={form.values.startTime} onChangeText={(v) => form.setValue('startTime', v)} placeholder="09:00" autoCapitalize="none" style={styles.half} error={form.errors.startTime} />
      </View>
      <View style={styles.row}>
        <Input label="End date" value={form.values.endDate} onChangeText={(v) => form.setValue('endDate', v)} placeholder="YYYY-MM-DD" autoCapitalize="none" style={styles.half} error={form.errors.endDate} />
        <Input label="End time" value={form.values.endTime} onChangeText={(v) => form.setValue('endTime', v)} placeholder="10:00" autoCapitalize="none" style={styles.half} error={form.errors.endTime} />
      </View>
      <Input label="Location (optional)" value={form.values.location ?? ''} onChangeText={(v) => form.setValue('location', v)} placeholder="Room / hall" />
      <Input label="Description (optional)" value={form.values.description ?? ''} onChangeText={(v) => form.setValue('description', v)} placeholder="Notes" multiline numberOfLines={3} />

      {error ? <Text variant="small" tone="danger">{error}</Text> : null}
      <Button label="Create event" fullWidth size="lg" loading={busy} onPress={submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16, paddingTop: 16 },
  kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kindChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  courseChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
});
