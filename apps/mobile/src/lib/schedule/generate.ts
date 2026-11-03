import type { AcademicDay, Course, Semester, TimetableDraftRow, TimetableRule, ScheduleDiff } from '@/types/domain';
import type { AcademicDayKind } from '@/types/database';
import { combineDateTime, eachDateKey, fromDateKey, toDateKey } from '@/lib/dates';

/** Day kinds on which regular classes do NOT run. */
const NON_CLASS_KINDS: AcademicDayKind[] = ['holiday', 'non_instructional', 'closure', 'exam'];

export interface GeneratedSession {
  courseId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
  dateKey: string;
}

export interface GenerateOptions {
  semester: Pick<Semester, 'id' | 'start_date' | 'end_date'>;
  rules: TimetableRule[];
  courses: Course[];
  academicDays: AcademicDay[];
  /** Inclusive range override; defaults to the semester range. */
  rangeStart?: string;
  rangeEnd?: string;
  /** Existing event start keys (courseId|startsAt) to avoid duplicates. */
  existingKeys?: Set<string>;
}

export function sessionKey(courseId: string, startsAt: string): string {
  return `${courseId}|${startsAt}`;
}

/**
 * Expand recurring weekly rules into dated class sessions, honouring academic
 * day classifications and rule validity windows. Pure and idempotent: callers
 * pass existingKeys so re-running never creates duplicates.
 */
export function generateSessions(options: GenerateOptions): GeneratedSession[] {
  const { semester, rules, courses, academicDays, existingKeys } = options;
  const start = options.rangeStart ?? semester.start_date;
  const end = options.rangeEnd ?? semester.end_date ?? toDateKey(addMonths(fromDateKey(start), 4));
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const dayKindByDate = new Map(academicDays.map((d) => [d.day, d.kind]));
  const out: GeneratedSession[] = [];
  const seen = new Set<string>();

  for (const dateKey of eachDateKey(start, end)) {
    const date = fromDateKey(dateKey);
    const weekday = date.getDay();
    const dayKind = dayKindByDate.get(dateKey);
    if (dayKind && NON_CLASS_KINDS.includes(dayKind)) continue;

    for (const rule of rules) {
      if (rule.weekday !== weekday) continue;
      if (rule.valid_from && dateKey < rule.valid_from) continue;
      if (rule.valid_until && dateKey > rule.valid_until) continue;
      const course = courseById.get(rule.course_id);
      if (!course) continue;
      const startsAt = combineDateTime(dateKey, rule.starts_at);
      const endsAt = combineDateTime(dateKey, rule.ends_at);
      const key = sessionKey(rule.course_id, startsAt);
      if (seen.has(key)) continue;
      if (existingKeys?.has(key)) continue;
      seen.add(key);
      out.push({
        courseId: rule.course_id,
        title: course.name,
        startsAt,
        endsAt,
        location: rule.location,
        dateKey,
      });
    }
  }
  return out.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function ruleSignature(row: TimetableDraftRow): string {
  return `${row.courseCode}|${row.courseName}|${row.weekday}|${row.startTime}`;
}

/**
 * Compare an existing timetable against a revised import. Matching is by
 * course + weekday + start time; a changed end time/location is a "change".
 */
export function diffTimetables(before: TimetableDraftRow[], after: TimetableDraftRow[]): ScheduleDiff {
  const beforeMap = new Map(before.map((r) => [ruleSignature(r), r]));
  const afterMap = new Map(after.map((r) => [ruleSignature(r), r]));
  const added: TimetableDraftRow[] = [];
  const removed: TimetableDraftRow[] = [];
  const changed: ScheduleDiff['changed'] = [];

  for (const [sig, row] of afterMap) {
    const prev = beforeMap.get(sig);
    if (!prev) {
      added.push(row);
    } else if (prev.endTime !== row.endTime || prev.location !== row.location) {
      changed.push({ before: prev, after: row });
    }
  }
  for (const [sig, row] of beforeMap) {
    if (!afterMap.has(sig)) removed.push(row);
  }
  return { added, removed, changed };
}

/** Detect overlapping sessions on the same date (conflict detection). */
export function findConflicts(sessions: GeneratedSession[]): { a: GeneratedSession; b: GeneratedSession }[] {
  const byDate = new Map<string, GeneratedSession[]>();
  for (const s of sessions) {
    const list = byDate.get(s.dateKey) ?? [];
    list.push(s);
    byDate.set(s.dateKey, list);
  }
  const conflicts: { a: GeneratedSession; b: GeneratedSession }[] = [];
  for (const list of byDate.values()) {
    const sorted = [...list].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const a = sorted[i];
        const b = sorted[j];
        if (!a || !b) continue;
        if (b.startsAt < a.endsAt) conflicts.push({ a, b });
      }
    }
  }
  return conflicts;
}
