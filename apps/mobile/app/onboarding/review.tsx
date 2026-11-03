import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, EmptyState, Loading, Screen, Text } from '@/components/ui';
import { useAcademicDays, useActiveSemester, useCourses, useEvents, useTimetableRules } from '@/hooks/useAcademicData';
import { useAuth } from '@/hooks/useAuth';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { findConflicts, generateSessions, sessionKey } from '@/lib/schedule/generate';
import { createEvents } from '@/services/api/events';
import { QUERY_KEYS, WEEKDAYS_SHORT } from '@/constants';
import { formatDate, formatTime } from '@/lib/dates';
import { useTheme } from '@/theme';

export default function OnboardingReview() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { active } = useActiveSemester();
  const semesterId = active?.id ?? null;
  const coursesQuery = useCourses(semesterId);
  const rulesQuery = useTimetableRules(semesterId);
  const daysQuery = useAcademicDays(semesterId);
  const eventsQuery = useEvents(semesterId);
  const queryClient = useQueryClient();
  const setOnboardingSkipped = usePreferencesStore((s) => s.setOnboardingSkipped);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const courses = coursesQuery.data ?? [];
  const rules = rulesQuery.data ?? [];
  const academicDays = daysQuery.data ?? [];
  const events = eventsQuery.data ?? [];
  const isLoading = coursesQuery.isLoading || rulesQuery.isLoading || eventsQuery.isLoading;

  const existingKeys = useMemo(
    () => new Set(events.filter((e) => e.course_id).map((e) => sessionKey(e.course_id!, e.starts_at))),
    [events],
  );

  const generated = useMemo(() => {
    if (!active) return [];
    return generateSessions({ semester: active, rules, courses, academicDays, existingKeys });
  }, [active, rules, courses, academicDays, existingKeys]);

  const conflicts = useMemo(() => findConflicts(generated), [generated]);

  const confirm = async () => {
    if (!active || !user) return;
    setBusy(true);
    setError(null);
    try {
      const inputs = generated.map((s) => ({
        semester_id: active.id,
        course_id: s.courseId,
        title: s.title,
        kind: 'class' as const,
        status: 'scheduled' as const,
        starts_at: s.startsAt,
        ends_at: s.endsAt,
        location: s.location,
        source: 'timetable',
        verification_status: 'confirmed' as const,
        created_by: user.id,
      }));
      // Insert in batches to stay within request limits.
      for (let i = 0; i < inputs.length; i += 100) {
        await createEvents(inputs.slice(i, i + 100));
      }
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.events(active.id) });
      setOnboardingSkipped(true);
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate the schedule.');
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <Loading label="Preparing your schedule…" />;

  return (
    <Screen contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text variant="headline" weight="bold">Review your schedule</Text>
        <Text variant="small" tone="secondary">
          We expanded your weekly timetable into dated classes, skipping holidays and non-instructional
          days. Confirm to create them.
        </Text>
      </View>

      {rules.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title="No timetable yet"
          message="Go back and add classes or import a CSV. You can also skip and set this up later."
          actionLabel="Back to timetable"
          onAction={() => router.back()}
        />
      ) : (
        <>
          <View style={styles.statsRow}>
            <Card style={styles.stat}>
              <Text variant="headline" weight="bold">{generated.length}</Text>
              <Text variant="caption" tone="secondary">new classes</Text>
            </Card>
            <Card style={styles.stat}>
              <Text variant="headline" weight="bold">{courses.length}</Text>
              <Text variant="caption" tone="secondary">courses</Text>
            </Card>
            <Card style={styles.stat}>
              <Text variant="headline" weight="bold" tone={conflicts.length > 0 ? 'warning' : 'primary'}>{conflicts.length}</Text>
              <Text variant="caption" tone="secondary">conflicts</Text>
            </Card>
          </View>

          {conflicts.length > 0 ? (
            <Card style={styles.conflictCard}>
              <View style={styles.conflictHeader}>
                <Ionicons name="warning-outline" size={18} color={theme.colors.warning} />
                <Text variant="small" weight="semiBold" tone="warning">Overlapping classes detected</Text>
              </View>
              {conflicts.slice(0, 4).map((c, i) => (
                <Text key={i} variant="caption" tone="secondary">
                  {formatDate(c.a.startsAt)}: {c.a.title} overlaps {c.b.title}
                </Text>
              ))}
              <Text variant="caption" tone="tertiary">You can still confirm and fix overlaps later.</Text>
            </Card>
          ) : null}

          <Card>
            <Text variant="subtitle" weight="semiBold" style={styles.previewTitle}>Preview (first 12)</Text>
            {generated.slice(0, 12).map((s) => (
              <View key={`${s.courseId}-${s.startsAt}`} style={styles.previewRow}>
                <Text variant="small" weight="medium" style={styles.flex}>{s.title}</Text>
                <Text variant="caption" tone="secondary">{formatDate(s.startsAt)} · {formatTime(s.startsAt)}</Text>
              </View>
            ))}
            {generated.length > 12 ? (
              <Text variant="caption" tone="tertiary" style={styles.more}>+ {generated.length - 12} more classes</Text>
            ) : null}
          </Card>
        </>
      )}

      {error ? <Text variant="small" tone="danger">{error}</Text> : null}

      <Button
        label={generated.length > 0 ? `Confirm & create ${generated.length} classes` : 'Skip to dashboard'}
        fullWidth
        size="lg"
        loading={busy}
        onPress={generated.length > 0 ? confirm : () => { setOnboardingSkipped(true); router.replace('/(tabs)'); }}
      />
      <Button label="Back to timetable" variant="ghost" fullWidth onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16, paddingTop: 24 },
  header: { gap: 6 },
  statsRow: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  conflictCard: { gap: 6 },
  conflictHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewTitle: { marginBottom: 10 },
  previewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, gap: 8 },
  more: { marginTop: 8 },
  flex: { flex: 1 },
});
