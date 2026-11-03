import { getDb } from './db';
import type { LocalNote } from '@/types/domain';

/**
 * Local-first notes. The current backend has no notes table, so notes are
 * stored on-device. A proposed additive migration is staged in
 * docs/proposed-backend-additions.md for future cloud sync (not applied).
 */
export function listNotes(semesterId: string | null, courseId?: string | null): LocalNote[] {
  const rows = courseId
    ? getDb().getAllSync<LocalNote>(
        'SELECT id, course_id as courseId, semester_id as semesterId, title, body, created_at as createdAt, updated_at as updatedAt FROM notes WHERE semester_id IS ? AND course_id = ? ORDER BY updated_at DESC',
        [semesterId, courseId],
      )
    : getDb().getAllSync<LocalNote>(
        'SELECT id, course_id as courseId, semester_id as semesterId, title, body, created_at as createdAt, updated_at as updatedAt FROM notes WHERE semester_id IS ? ORDER BY updated_at DESC',
        [semesterId],
      );
  return rows;
}

export function saveNote(note: LocalNote): void {
  getDb().runSync(
    'INSERT INTO notes (id, course_id, semester_id, title, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title = excluded.title, body = excluded.body, course_id = excluded.course_id, updated_at = excluded.updated_at',
    [note.id, note.courseId, note.semesterId, note.title, note.body, note.createdAt, note.updatedAt],
  );
}

export function deleteNote(id: string): void {
  getDb().runSync('DELETE FROM notes WHERE id = ?', [id]);
}

export function setAssignmentPriority(assignmentId: string, priority: 'low' | 'medium' | 'high'): void {
  getDb().runSync(
    'INSERT INTO assignment_meta (assignment_id, priority) VALUES (?, ?) ON CONFLICT(assignment_id) DO UPDATE SET priority = excluded.priority',
    [assignmentId, priority],
  );
}

export function getAssignmentPriority(assignmentId: string): 'low' | 'medium' | 'high' {
  const row = getDb().getFirstSync<{ priority: string }>('SELECT priority FROM assignment_meta WHERE assignment_id = ?', [
    assignmentId,
  ]);
  return (row?.priority as 'low' | 'medium' | 'high') ?? 'medium';
}
