import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, EmptyState, Input, Screen, SegmentedControl, Text } from '@/components/ui';
import { useActiveSemester, useAssignments, useCourses } from '@/hooks/useAcademicData';
import { useAuth } from '@/hooks/useAuth';
import { useForm } from '@/hooks/useForm';
import { assignmentSchema } from '@/lib/validation';
import { createAssignment, deleteAssignment, updateAssignment } from '@/services/api/assignments';
import { getAssignmentPriority, setAssignmentPriority } from '@/database/notes';
import { QUERY_KEYS } from '@/constants';
import { countdownLabel } from '@/lib/dates';
import { useTheme } from '@/theme';
import type { AssignmentStatus } from '@/types/database';

const PRIORITY_TONE = { low: 'neutral', medium: 'info', high: 'danger' } as const;

export default function Assignments() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { active } = useActiveSemester();
  const semesterId = active?.id ?? null;
  const assignmentsQuery = useAssignments(semesterId);
  const coursesQuery = useCourses(semesterId);
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'pending' | 'submitted'>('all');
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const assignments = assignmentsQuery.data ?? [];
  const courses = coursesQuery.data ?? [];
  const form = useForm(assignmentSchema, { title: '', description: '', courseId: '', dueAt: '', status: 'pending' });

  const invalidate = () => semesterId && queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assignments(semesterId) });

  const filtered = assignments.filter((a) =>
    filter === 'all' ? true : filter === 'pending' ? a.status !== 'submitted' : a.status === 'submitted',
  );

  const add = async () => {
    const values = form.validate();
    if (!values || !user || !semesterId) return;
    setBusy(true);
    setError(null);
    try {
      await createAssignment({
        owner_id: user.id,
        semester_id: semesterId,
        title: values.title,
        description: values.description || null,
        course_id: values.courseId || null,
        due_at: values.dueAt ? new Date(values.dueAt).toISOString() : null,
        status: values.status,
      });
      form.reset();
      setShowForm(false);
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the assignment.');
    } finally {
      setBusy(false);
    }
  };

  const cycleStatus = async (id: string, current: AssignmentStatus) => {
    const next: AssignmentStatus = current === 'pending' ? 'in_progress' : current === 'in_progress' ? 'submitted' : 'pending';
    await updateAssignment(id, { status: next });
    invalidate();
  };

  const remove = async (id: string) => {
    await deleteAssignment(id);
    invalidate();
  };

  const courseName = (id: string | null) => courses.find((c) => c.id === id)?.name;

  return (
    <Screen contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text variant="headline" weight="bold">Assignments</Text>
        <Button label={showForm ? 'Close' : 'Add'} icon={showForm ? 'close' : 'add'} size="sm" onPress={() => setShowForm((s) => !s)} />
      </View>

      {showForm ? (
        <Card style={styles.form}>
          <Input label="Title" value={form.values.title} onChangeText={(v) => form.setValue('title', v)} placeholder="e.g. Lab report 3" error={form.errors.title} />
          <Input label="Due date (optional)" value={form.values.dueAt ?? ''} onChangeText={(v) => form.setValue('dueAt', v)} placeholder="YYYY-MM-DDTHH:MM" autoCapitalize="none" error={form.errors.dueAt} hint="ISO format, e.g. 2026-11-10T17:00" />
          <Input label="Description (optional)" value={form.values.description ?? ''} onChangeText={(v) => form.setValue('description', v)} placeholder="Details" multiline numberOfLines={3} />
          {courses.length > 0 ? (
            <View style={styles.courseChips}>
              {courses.map((course) => (
                <Pressable key={course.id} onPress={() => form.setValue('courseId', form.values.courseId === course.id ? '' : course.id)} style={[styles.chip, { backgroundColor: form.values.courseId === course.id ? theme.colors.primarySoft : theme.colors.surfaceSecondary }]}>
                  <Text variant="caption" weight="medium">{course.name}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {error ? <Text variant="small" tone="danger">{error}</Text> : null}
          <Button label="Create assignment" loading={busy} onPress={add} />
        </Card>
      ) : null}

      <SegmentedControl
        options={[{ label: 'All', value: 'all' }, { label: 'Pending', value: 'pending' }, { label: 'Done', value: 'submitted' }]}
        value={filter}
        onChange={setFilter}
      />

      {filtered.length === 0 ? (
        <EmptyState icon="document-text-outline" title="No assignments" message="Add assignments to track deadlines." actionLabel="Add assignment" onAction={() => setShowForm(true)} />
      ) : (
        filtered.map((assignment) => {
          const priority = getAssignmentPriority(assignment.id);
          const overdue = assignment.due_at && assignment.status !== 'submitted' && new Date(assignment.due_at).getTime() < Date.now();
          return (
            <Card key={assignment.id} style={styles.assignmentCard}>
              <View style={styles.assignmentRow}>
                <Pressable onPress={() => cycleStatus(assignment.id, assignment.status)} style={[styles.checkbox, { borderColor: assignment.status === 'submitted' ? theme.colors.success : theme.colors.borderStrong, backgroundColor: assignment.status === 'submitted' ? theme.colors.success : 'transparent' }]} accessibilityLabel="Toggle status">
                  {assignment.status === 'submitted' ? <Ionicons name="checkmark" size={16} color="#FFF" /> : null}
                </Pressable>
                <View style={styles.flex}>
                  <Text variant="body" weight="semiBold" style={assignment.status === 'submitted' ? { textDecorationLine: 'line-through', opacity: 0.6 } : undefined}>{assignment.title}</Text>
                  <View style={styles.metaRow}>
                    {courseName(assignment.course_id) ? <Text variant="caption" tone="secondary">{courseName(assignment.course_id)}</Text> : null}
                    {assignment.due_at ? (
                      <Text variant="caption" tone={overdue ? 'danger' : 'secondary'}>
                        {overdue ? 'Overdue' : `Due in ${countdownLabel(assignment.due_at)}`}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <Pressable onPress={() => remove(assignment.id)} hitSlop={8} accessibilityLabel="Delete assignment">
                  <Ionicons name="trash-outline" size={18} color={theme.colors.textTertiary} />
                </Pressable>
              </View>
              <View style={styles.priorityRow}>
                <Badge label={assignment.status.replace('_', ' ')} tone={assignment.status === 'submitted' ? 'success' : assignment.status === 'in_progress' ? 'info' : 'neutral'} />
                <View style={styles.priorityPicker}>
                  {(['low', 'medium', 'high'] as const).map((p) => (
                    <Pressable key={p} onPress={() => { setAssignmentPriority(assignment.id, p); invalidate(); }} style={[styles.priorityChip, { backgroundColor: priority === p ? theme.colors.primarySoft : 'transparent' }]}>
                      <Text variant="caption" weight={priority === p ? 'semiBold' : 'regular'} tone={priority === p ? 'accent' : 'tertiary'}>{p}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </Card>
          );
        })
      )}
      <Text variant="caption" tone="tertiary">Priority is stored on this device. Cloud sync of priority needs an additive backend column (see docs).</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  form: { gap: 12 },
  courseChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  assignmentCard: { gap: 10, marginBottom: 0 },
  assignmentRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  metaRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
  priorityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priorityPicker: { flexDirection: 'row', gap: 4 },
  priorityChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
});
