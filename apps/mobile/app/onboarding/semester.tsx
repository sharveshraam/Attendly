import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Input, Screen, SegmentedControl, Text } from '@/components/ui';
import { useForm } from '@/hooks/useForm';
import { useAuth } from '@/hooks/useAuth';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { semesterSchema } from '@/lib/validation';
import { createSemester } from '@/services/api/semesters';
import { DEFAULT_ATTENDANCE_TARGET } from '@/constants';
import { toDateKey } from '@/lib/dates';

export default function OnboardingSemester() {
  const router = useRouter();
  const { user } = useAuth();
  const setActiveSemester = usePreferencesStore((s) => s.setActiveSemester);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = toDateKey(new Date());
  const form = useForm(semesterSchema, {
    name: '',
    institution: '',
    startDate: today,
    endDate: '',
    attendanceTarget: DEFAULT_ATTENDANCE_TARGET,
    predictionMode: 'rolling',
  });

  const submit = async () => {
    const values = form.validate();
    if (!values || !user) return;
    setSubmitting(true);
    setError(null);
    try {
      const semester = await createSemester({
        owner_id: user.id,
        name: values.name,
        institution: values.institution || null,
        start_date: values.startDate,
        end_date: values.endDate || null,
        attendance_target: values.attendanceTarget,
        prediction_mode: values.predictionMode,
      });
      setActiveSemester(semester.id);
      router.push('/onboarding/courses');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the semester.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen keyboardAvoiding contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text variant="headline" weight="bold">Your semester</Text>
        <Text variant="small" tone="secondary">
          Set up the current semester. Institution and dates help generate an accurate schedule.
        </Text>
      </View>
      <Input label="Semester name" value={form.values.name} onChangeText={(v) => form.setValue('name', v)} placeholder="e.g. Semester 5" icon="school-outline" error={form.errors.name} />
      <Input label="Institution (optional)" value={form.values.institution ?? ''} onChangeText={(v) => form.setValue('institution', v)} placeholder="Your college / university" icon="business-outline" error={form.errors.institution} />
      <View style={styles.row}>
        <Input label="Start date" value={form.values.startDate} onChangeText={(v) => form.setValue('startDate', v)} placeholder="YYYY-MM-DD" autoCapitalize="none" icon="calendar-outline" error={form.errors.startDate} style={styles.half} />
        <Input label="End date (optional)" value={form.values.endDate ?? ''} onChangeText={(v) => form.setValue('endDate', v)} placeholder="YYYY-MM-DD" autoCapitalize="none" icon="calendar-outline" error={form.errors.endDate} style={styles.half} />
      </View>
      <Input label="Default attendance target (%)" value={String(form.values.attendanceTarget)} onChangeText={(v) => form.setValue('attendanceTarget', v as never)} placeholder="75" keyboardType="numeric" icon="flag-outline" error={form.errors.attendanceTarget} hint="Per-course targets can override this." />
      <View style={styles.modeBlock}>
        <Text variant="small" weight="medium" tone="secondary">Projection mode</Text>
        <SegmentedControl
          options={[{ label: 'Rolling estimate', value: 'rolling' }, { label: 'Fixed semester', value: 'fixed' }]}
          value={form.values.predictionMode}
          onChange={(v) => form.setValue('predictionMode', v)}
        />
        <Text variant="caption" tone="tertiary">
          Rolling projects from scheduled classes; fixed uses the full semester timetable.
        </Text>
      </View>
      {error ? <Text variant="small" tone="danger">{error}</Text> : null}
      <Button label="Continue" fullWidth size="lg" loading={submitting} onPress={submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16, paddingTop: 24 },
  header: { gap: 6 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  modeBlock: { gap: 8 },
});
