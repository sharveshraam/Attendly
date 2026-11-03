import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, Input, Screen, Text } from '@/components/ui';
import { useActiveSemester, useCourses, useTimetableRules } from '@/hooks/useAcademicData';
import { importAcademicCalendar, importTimetableRows } from '@/services/import';
import { deleteTimetableRule } from '@/services/api/courses';
import { parseAcademicCalendarCsv, parseTimetableCsv } from '@/lib/import/csv';
import { QUERY_KEYS, WEEKDAYS_SHORT } from '@/constants';
import { useTheme } from '@/theme';
import type { AcademicDayDraft, TimetableDraftRow } from '@/types/domain';

export default function OnboardingTimetable() {
  const router = useRouter();
  const { theme } = useTheme();
  const { active } = useActiveSemester();
  const semesterId = active?.id ?? null;
  const coursesQuery = useCourses(semesterId);
  const rulesQuery = useTimetableRules(semesterId);
  const queryClient = useQueryClient();
  const courses = coursesQuery.data ?? [];
  const rules = rulesQuery.data ?? [];

  const [draft, setDraft] = useState<TimetableDraftRow[] | null>(null);
  const [calDraft, setCalDraft] = useState<AcademicDayDraft[] | null>(null);
  const [importErrors, setImportErrors] = useState<{ line: number; message: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [manual, setManual] = useState({ courseId: '', weekday: 1, startTime: '09:00', endTime: '10:00', location: '' });

  const invalidate = () => {
    if (!semesterId) return;
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.rules(semesterId) });
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.courses(semesterId) });
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.academicDays(semesterId) });
  };

  const pickTimetable = async () => {
    setMessage(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const text = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.UTF8 });
    const parsed = parseTimetableCsv(text);
    setDraft(parsed.rows);
    setCalDraft(null);
    setImportErrors(parsed.errors);
  };

  const pickCalendar = async () => {
    setMessage(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'text/plain'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const text = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.UTF8 });
    const parsed = parseAcademicCalendarCsv(text);
    setCalDraft(parsed.rows);
    setDraft(null);
    setImportErrors(parsed.errors);
  };

  const confirmImport = async () => {
    if (!semesterId) return;
    setBusy(true);
    setMessage(null);
    try {
      if (draft) {
        const summary = await importTimetableRows(semesterId, draft);
        setMessage(`Imported ${summary.createdRules} classes (${summary.createdCourses} new courses, ${summary.skippedRules} duplicates skipped).`);
        setDraft(null);
      } else if (calDraft) {
        const count = await importAcademicCalendar(semesterId, calDraft);
        setMessage(`Imported ${count} academic calendar days.`);
        setCalDraft(null);
      }
      setImportErrors([]);
      invalidate();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  };

  const addManual = async () => {
    if (!semesterId || !manual.courseId) {
      setMessage('Pick a course first.');
      return;
    }
    setBusy(true);
    try {
      const { createTimetableRule } = await import('@/services/api/courses');
      await createTimetableRule({
        semester_id: semesterId,
        course_id: manual.courseId,
        weekday: manual.weekday,
        starts_at: manual.startTime,
        ends_at: manual.endTime,
        location: manual.location || null,
      });
      invalidate();
      setMessage('Class added to your weekly timetable.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not add the class.');
    } finally {
      setBusy(false);
    }
  };

  const removeRule = async (id: string) => {
    await deleteTimetableRule(id);
    invalidate();
  };

  const courseName = (id: string) => courses.find((c) => c.id === id)?.name ?? 'Course';

  return (
    <Screen contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text variant="headline" weight="bold">Build your timetable</Text>
        <Text variant="small" tone="secondary">
          Import a CSV, add classes manually, or skip and do it later. PDF/image OCR needs a backend
          extraction service (see docs); CSV import works fully on-device.
        </Text>
      </View>

      <View style={styles.importButtons}>
        <Button label="Upload timetable CSV" icon="document-outline" variant="secondary" fullWidth onPress={pickTimetable} />
        <Button label="Upload academic calendar CSV" icon="calendar-outline" variant="secondary" fullWidth onPress={pickCalendar} />
      </View>

      {importErrors.length > 0 ? (
        <Card style={styles.errorCard}>
          <Text variant="small" weight="semiBold" tone="danger">Some rows need attention:</Text>
          {importErrors.slice(0, 6).map((e) => (
            <Text key={`${e.line}-${e.message}`} variant="caption" tone="secondary">Line {e.line}: {e.message}</Text>
          ))}
        </Card>
      ) : null}

      {(draft || calDraft) ? (
        <Card>
          <Text variant="subtitle" weight="semiBold">
            Review {draft ? `${draft.length} classes` : `${calDraft!.length} calendar days`}
          </Text>
          <ScrollView style={styles.preview} nestedScrollEnabled>
            {draft?.map((row) => (
              <View key={row.id} style={styles.previewRow}>
                <Text variant="small" weight="medium" style={styles.flex}>{row.courseName}</Text>
                <Text variant="caption" tone="secondary">{WEEKDAYS_SHORT[row.weekday]} {row.startTime}–{row.endTime}</Text>
              </View>
            ))}
            {calDraft?.map((row) => (
              <View key={row.id} style={styles.previewRow}>
                <Text variant="small" weight="medium" style={styles.flex}>{row.day}</Text>
                <Badge label={row.kind.replace('_', ' ')} tone="info" />
              </View>
            ))}
          </ScrollView>
          <View style={styles.previewActions}>
            <Button label="Cancel" variant="ghost" onPress={() => { setDraft(null); setCalDraft(null); setImportErrors([]); }} />
            <Button label="Confirm import" loading={busy} onPress={confirmImport} />
          </View>
        </Card>
      ) : null}

      <Card>
        <Text variant="subtitle" weight="semiBold" style={styles.manualTitle}>Add a class manually</Text>
        {courses.length === 0 ? (
          <Text variant="small" tone="secondary">Add courses first to build a timetable.</Text>
        ) : (
          <View style={styles.gap}>
            <View style={styles.courseChips}>
              {courses.map((course) => (
                <Pressable
                  key={course.id}
                  onPress={() => setManual((m) => ({ ...m, courseId: course.id }))}
                  style={[styles.chip, { backgroundColor: manual.courseId === course.id ? theme.colors.primarySoft : theme.colors.surfaceSecondary, borderColor: manual.courseId === course.id ? theme.colors.primary : 'transparent' }]}
                >
                  <Text variant="caption" weight={manual.courseId === course.id ? 'semiBold' : 'medium'}>{course.name}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.weekdayRow}>
              {WEEKDAYS_SHORT.map((day, i) => (
                <Pressable
                  key={day}
                  onPress={() => setManual((m) => ({ ...m, weekday: i }))}
                  style={[styles.weekday, { backgroundColor: manual.weekday === i ? theme.colors.primary : theme.colors.surfaceSecondary }]}
                >
                  <Text variant="caption" weight="semiBold" tone={manual.weekday === i ? 'inverse' : 'secondary'}>{day}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.row}>
              <Input label="Start" value={manual.startTime} onChangeText={(v) => setManual((m) => ({ ...m, startTime: v }))} placeholder="09:00" autoCapitalize="none" style={styles.half} />
              <Input label="End" value={manual.endTime} onChangeText={(v) => setManual((m) => ({ ...m, endTime: v }))} placeholder="10:00" autoCapitalize="none" style={styles.half} />
            </View>
            <Input label="Location (optional)" value={manual.location} onChangeText={(v) => setManual((m) => ({ ...m, location: v }))} placeholder="Room 204" />
            <Button label="Add class" variant="secondary" loading={busy} onPress={addManual} />
          </View>
        )}
      </Card>

      {rules.length > 0 ? (
        <Card>
          <Text variant="subtitle" weight="semiBold" style={styles.manualTitle}>Weekly timetable ({rules.length})</Text>
          {rules.map((rule) => (
            <View key={rule.id} style={styles.ruleRow}>
              <View style={styles.flex}>
                <Text variant="small" weight="medium">{courseName(rule.course_id)}</Text>
                <Text variant="caption" tone="secondary">{WEEKDAYS_SHORT[rule.weekday]} · {rule.starts_at.slice(0, 5)}–{rule.ends_at.slice(0, 5)}</Text>
              </View>
              <Pressable onPress={() => removeRule(rule.id)} hitSlop={8} accessibilityLabel="Remove class">
                <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
              </Pressable>
            </View>
          ))}
        </Card>
      ) : null}

      {message ? <Text variant="small" tone="secondary">{message}</Text> : null}

      <Button label="Review & generate schedule" fullWidth size="lg" onPress={() => router.push('/onboarding/review')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16, paddingTop: 24 },
  header: { gap: 6 },
  importButtons: { gap: 10 },
  errorCard: { gap: 4 },
  preview: { maxHeight: 200, marginTop: 10 },
  previewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, gap: 8 },
  previewActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  manualTitle: { marginBottom: 12 },
  gap: { gap: 12 },
  courseChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  weekdayRow: { flexDirection: 'row', gap: 6 },
  weekday: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  flex: { flex: 1 },
});
