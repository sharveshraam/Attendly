import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, EmptyState, Input, Screen, Text } from '@/components/ui';
import { useActiveSemester, useCourses } from '@/hooks/useAcademicData';
import { deleteNote, listNotes, saveNote } from '@/database/notes';
import { useTheme } from '@/theme';
import type { LocalNote } from '@/types/domain';

export default function Notes() {
  const { theme } = useTheme();
  const { active } = useActiveSemester();
  const coursesQuery = useCourses(active?.id ?? null);
  const courses = coursesQuery.data ?? [];
  const [notes, setNotes] = useState<LocalNote[]>(() => listNotes(active?.id ?? null));
  const [editing, setEditing] = useState<LocalNote | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [courseId, setCourseId] = useState<string | null>(null);

  const refresh = useCallback(() => setNotes(listNotes(active?.id ?? null)), [active?.id]);

  const openNew = () => {
    setEditing(null);
    setTitle('');
    setBody('');
    setCourseId(null);
    setShowForm(true);
  };

  const openEdit = (note: LocalNote) => {
    setEditing(note);
    setTitle(note.title);
    setBody(note.body);
    setCourseId(note.courseId);
    setShowForm(true);
  };

  const save = () => {
    if (!title.trim()) return;
    const now = new Date().toISOString();
    const note: LocalNote = {
      id: editing?.id ?? `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      courseId,
      semesterId: active?.id ?? null,
      title: title.trim(),
      body: body.trim(),
      createdAt: editing?.createdAt ?? now,
      updatedAt: now,
    };
    saveNote(note);
    setShowForm(false);
    refresh();
  };

  const remove = (id: string) => {
    deleteNote(id);
    refresh();
  };

  const courseName = (id: string | null) => courses.find((c) => c.id === id)?.name;

  return (
    <Screen contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text variant="headline" weight="bold">Notes</Text>
        <Button label="Add" icon="add" size="sm" onPress={openNew} />
      </View>
      <Text variant="caption" tone="tertiary">
        Notes are stored on this device (local-first). Cloud sync needs an additive backend table — see docs.
      </Text>

      {showForm ? (
        <Card style={styles.form}>
          <Input label="Title" value={title} onChangeText={setTitle} placeholder="Note title" />
          <Input label="Note" value={body} onChangeText={setBody} placeholder="Write your note…" multiline numberOfLines={5} />
          {courses.length > 0 ? (
            <View style={styles.courseChips}>
              {courses.map((course) => (
                <Pressable key={course.id} onPress={() => setCourseId(courseId === course.id ? null : course.id)} style={[styles.chip, { backgroundColor: courseId === course.id ? theme.colors.primarySoft : theme.colors.surfaceSecondary }]}>
                  <Text variant="caption" weight="medium">{course.name}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={styles.formActions}>
            <Button label="Cancel" variant="ghost" onPress={() => setShowForm(false)} />
            <Button label={editing ? 'Save changes' : 'Save note'} onPress={save} />
          </View>
        </Card>
      ) : null}

      {notes.length === 0 ? (
        <EmptyState icon="create-outline" title="No notes yet" message="Capture quick notes and organize them by course." actionLabel="Add a note" onAction={openNew} />
      ) : (
        notes.map((note) => (
          <Card key={note.id} onPress={() => openEdit(note)} style={styles.noteCard}>
            <View style={styles.noteHeader}>
              <Text variant="body" weight="semiBold" style={styles.flex}>{note.title}</Text>
              <Pressable onPress={() => remove(note.id)} hitSlop={8} accessibilityLabel="Delete note">
                <Ionicons name="trash-outline" size={18} color={theme.colors.textTertiary} />
              </Pressable>
            </View>
            {note.body ? <Text variant="small" tone="secondary" numberOfLines={3}>{note.body}</Text> : null}
            {courseName(note.courseId) ? <Badge label={courseName(note.courseId)!} tone="primary" /> : null}
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  form: { gap: 12 },
  courseChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  noteCard: { gap: 8, marginBottom: 0 },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
});
