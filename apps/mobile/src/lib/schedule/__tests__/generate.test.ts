import { diffTimetables, findConflicts, generateSessions, sessionKey } from '../generate';
import type { AcademicDay, Course, TimetableRule } from '@/types/domain';
import type { TimetableDraftRow } from '@/types/domain';

const course: Course = {
  id: 'c1', semester_id: 's1', code: 'CS201', name: 'Data Structures', category: 'theory',
  attendance_target: null, calculation_mode: 'class_count', color: '#8B7CFF', created_at: '',
};

function rule(overrides: Partial<TimetableRule> = {}): TimetableRule {
  return {
    id: 'r1', semester_id: 's1', course_id: 'c1', weekday: 1, starts_at: '09:00:00', ends_at: '10:00:00',
    location: 'Room 204', valid_from: null, valid_until: null, created_at: '', ...overrides,
  };
}

const semester = { id: 's1', start_date: '2026-11-02', end_date: '2026-11-15' }; // Mon Nov 2 .. Sun Nov 15

describe('generateSessions', () => {
  it('expands a weekly rule into dated Monday sessions', () => {
    const sessions = generateSessions({ semester, rules: [rule()], courses: [course], academicDays: [] });
    // Mondays in range: Nov 2, Nov 9
    expect(sessions).toHaveLength(2);
    expect(sessions[0]?.dateKey).toBe('2026-11-02');
    expect(sessions[1]?.dateKey).toBe('2026-11-09');
  });

  it('skips holidays and non-instructional days', () => {
    const days: AcademicDay[] = [
      { id: 'd1', semester_id: 's1', day: '2026-11-02', kind: 'holiday', title: 'Holiday', notes: null },
      { id: 'd2', semester_id: 's1', day: '2026-11-09', kind: 'non_instructional', title: null, notes: null },
    ];
    const sessions = generateSessions({ semester, rules: [rule()], courses: [course], academicDays: days });
    expect(sessions).toHaveLength(0);
  });

  it('honours rule validity windows', () => {
    const sessions = generateSessions({
      semester, rules: [rule({ valid_from: '2026-11-09' })], courses: [course], academicDays: [],
    });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.dateKey).toBe('2026-11-09');
  });

  it('does not duplicate existing sessions (idempotent)', () => {
    const first = generateSessions({ semester, rules: [rule()], courses: [course], academicDays: [] });
    const existing = new Set(first.map((s) => sessionKey(s.courseId, s.startsAt)));
    const second = generateSessions({ semester, rules: [rule()], courses: [course], academicDays: [], existingKeys: existing });
    expect(second).toHaveLength(0);
  });
});

describe('diffTimetables', () => {
  const row = (over: Partial<TimetableDraftRow> = {}): TimetableDraftRow => ({
    id: 'x', courseCode: 'CS201', courseName: 'Data Structures', weekday: 1, startTime: '09:00', endTime: '10:00', location: 'Room 204', ...over,
  });

  it('detects additions, removals and timing changes', () => {
    const before = [row(), row({ id: 'y', weekday: 3, startTime: '14:00', endTime: '15:00' })];
    const after = [row({ endTime: '10:30' }), row({ id: 'z', weekday: 5, startTime: '11:00', endTime: '12:00' })];
    const diff = diffTimetables(before, after);
    expect(diff.added).toHaveLength(1);
    expect(diff.removed).toHaveLength(1);
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0]?.after.endTime).toBe('10:30');
  });

  it('reports no changes for identical timetables', () => {
    const diff = diffTimetables([row()], [row()]);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.changed).toHaveLength(0);
  });
});

describe('findConflicts', () => {
  it('detects overlapping sessions on the same day', () => {
    const sessions = generateSessions({
      semester: { id: 's1', start_date: '2026-11-02', end_date: '2026-11-02' },
      rules: [rule(), rule({ id: 'r2', starts_at: '09:30:00', ends_at: '10:30:00' })],
      courses: [course],
      academicDays: [],
    });
    const conflicts = findConflicts(sessions);
    expect(conflicts).toHaveLength(1);
  });
});
