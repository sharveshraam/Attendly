import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Card, EmptyState, Screen, Text } from '@/components/ui';
import { CoursePicker } from '@/components/domain';
import { useActiveSemester, useCourseStats, useSessions } from '@/hooks/useAcademicData';
import { simulate, summarize } from '@/lib/attendance/engine';
import { useTheme } from '@/theme';

interface StepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  max?: number;
}

function Stepper({ label, value, onChange, max }: StepperProps) {
  const { theme } = useTheme();
  return (
    <View style={styles.stepper}>
      <Text variant="small" weight="medium" style={styles.flex}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable onPress={() => onChange(Math.max(0, value - 1))} style={[styles.stepBtn, { backgroundColor: theme.colors.surfaceSecondary }]} accessibilityLabel={`Decrease ${label}`}>
          <Ionicons name="remove" size={18} color={theme.colors.text} />
        </Pressable>
        <Text variant="body" weight="bold" style={styles.stepValue}>{value}</Text>
        <Pressable onPress={() => onChange(max === undefined ? value + 1 : Math.min(max, value + 1))} style={[styles.stepBtn, { backgroundColor: theme.colors.surfaceSecondary }]} accessibilityLabel={`Increase ${label}`}>
          <Ionicons name="add" size={18} color={theme.colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

export default function WhatIf() {
  const { theme } = useTheme();
  const { active } = useActiveSemester();
  const semesterId = active?.id ?? null;
  const { stats, courses } = useCourseStats(semesterId);
  const { sessions } = useSessions(semesterId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [attend, setAttend] = useState(0);
  const [miss, setMiss] = useState(0);
  const [extra, setExtra] = useState(0);
  const [cancel, setCancel] = useState(0);
  const courseId = selectedId ?? courses[0]?.id ?? null;
  const course = courses.find((c) => c.id === courseId);
  const courseStats = stats.find((s) => s.courseId === courseId);

  const base = useMemo(() => {
    if (!courseStats || !courseId) return null;
    return summarize({
      sessions: sessions.filter((s) => s.event.course_id === courseId).map((s) => ({ status: s.record?.status ?? 'unmarked', lifecycle: s.event.status })),
      targetPercent: courseStats.target,
      mode: courseStats.mode,
      futureUnits: courseStats.futureScheduled > 0 ? courseStats.futureScheduled : null,
    });
  }, [sessions, courseId, courseStats]);

  const result = useMemo(() => (base ? simulate(base, { attendFuture: attend, missFuture: miss, extraAttended: extra, cancelFuture: cancel }) : null), [base, attend, miss, extra, cancel]);

  if (courses.length === 0) {
    return (
      <Screen contentContainerStyle={styles.empty}>
        <EmptyState icon="git-compare-outline" title="No courses yet" message="Add courses to simulate attendance scenarios." />
      </Screen>
    );
  }

  return (
    <Screen contentContainerStyle={styles.container}>
      <Text variant="headline" weight="bold">What-if simulator</Text>
      <Text variant="small" tone="secondary">Model future scenarios. Calculations are deterministic — no invented values.</Text>

      <CoursePicker courses={courses} selectedId={courseId} onSelect={(id) => { setSelectedId(id); setAttend(0); setMiss(0); setExtra(0); setCancel(0); }} />

      {base && courseStats ? (
        <>
          <Card style={styles.resultCard}>
            <Text variant="caption" tone="secondary">Projected attendance</Text>
            <Text variant="hero" weight="extraBold" tone={result?.meetsTarget ? 'success' : result?.valid ? 'danger' : 'secondary'}>
              {result?.percent === null || result?.percent === undefined ? '—' : `${result.percent}%`}
            </Text>
            {result?.valid ? (
              <Badge label={result.meetsTarget ? `Meets ${courseStats.target}% target` : `Below ${courseStats.target}% target`} tone={result.meetsTarget ? 'success' : 'danger'} />
            ) : (
              <Text variant="caption" tone="warning">{result?.reason}</Text>
            )}
            <Text variant="caption" tone="tertiary">
              Now {courseStats.percent ?? '—'}% · {result?.remainingFutureUnits ?? '—'} classes still ahead
            </Text>
          </Card>

          <Card style={styles.controls}>
            <Stepper label="Attend future classes" value={attend} onChange={setAttend} max={courseStats.futureScheduled} />
            <Stepper label="Miss future classes" value={miss} onChange={setMiss} max={courseStats.futureScheduled} />
            <Stepper label="Attend extra classes" value={extra} onChange={setExtra} />
            <Stepper label="Cancel future classes" value={cancel} onChange={setCancel} max={courseStats.futureScheduled} />
          </Card>

          {courseStats.futureScheduled === 0 ? (
            <Text variant="caption" tone="tertiary">
              No future scheduled classes found, so only extra-class scenarios can be simulated. Add your
              timetable to model attending/missing scheduled classes.
            </Text>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingTop: 16 },
  empty: { flexGrow: 1, justifyContent: 'center' },
  resultCard: { alignItems: 'center', gap: 8 },
  controls: { gap: 14 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 28, textAlign: 'center' },
});
