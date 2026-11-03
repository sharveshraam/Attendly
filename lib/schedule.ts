/**
 * Recurring timetable expansion, revised-timetable diffing and conflict
 * detection. Pure logic — mirrors apps/mobile/src/lib/schedule/generate.ts.
 *
 * Weekly template rules are NEVER stored as dated sessions directly; this
 * module expands them into idempotent `calendar_events` proposals which the
 * user must confirm before they are written.
 */
import { addMonths, combineDateTime, eachDateKey, fromDateKey, toDateKey } from "./dates.ts";
import type { AcademicDayKind, AcademicDayRow, CourseRow, ScheduleDiff, TimetableDraftRow, TimetableRuleRow } from "./types.ts";

const NON_CLASS_KINDS: AcademicDayKind[] = ["holiday", "non_instructional", "closure", "exam"];

export interface GeneratedSession {
  courseId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
  dateKey: string;
}

export interface GenerateOptions {
  semester: { id: string; start_date: string; end_date: string | null };
  rules: TimetableRuleRow[];
  courses: CourseRow[];
  academicDays: AcademicDayRow[];
  rangeStart?: string;
  rangeEnd?: string;
  existingKeys?: Set<string>;
}

export function sessionKey(courseId: string, startsAt: string): string {
  return `${courseId}|${startsAt}`;
}

export function generateSessions(options: GenerateOptions): GeneratedSession[] {
  const { semester, rules, courses, academicDays, existingKeys } = options;
  const start = options.rangeStart ?? semester.start_date;
  const end = options.rangeEnd ?? semester.end_date ?? toDateKey(addMonths(fromDateKey(start), 4));
  const courseById = new Map(courses.map((course) => [course.id, course]));
  const dayKindByDate = new Map(academicDays.map((day) => [day.day, day.kind]));
  const out: GeneratedSession[] = [];
  const seen = new Set<string>();

  for (const dateKey of eachDateKey(start, end)) {
    const weekday = fromDateKey(dateKey).getDay();
    const kind = dayKindByDate.get(dateKey);
    if (kind && NON_CLASS_KINDS.includes(kind)) continue;

    for (const rule of rules) {
      if (rule.weekday !== weekday) continue;
      if (rule.valid_from && dateKey < rule.valid_from) continue;
      if (rule.valid_until && dateKey > rule.valid_until) continue;
      const course = courseById.get(rule.course_id);
      if (!course) continue;
      const startsAt = combineDateTime(dateKey, rule.starts_at.slice(0, 5));
      const endsAt = combineDateTime(dateKey, rule.ends_at.slice(0, 5));
      const key = sessionKey(rule.course_id, startsAt);
      if (seen.has(key) || existingKeys?.has(key)) continue;
      seen.add(key);
      out.push({ courseId: rule.course_id, title: course.name, startsAt, endsAt, location: rule.location, dateKey });
    }
  }
  return out.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

function ruleSignature(row: TimetableDraftRow): string {
  return `${row.courseCode}|${row.courseName}|${row.weekday}|${row.startTime}`;
}

export function diffTimetables(before: TimetableDraftRow[], after: TimetableDraftRow[]): ScheduleDiff {
  const beforeMap = new Map(before.map((row) => [ruleSignature(row), row]));
  const afterMap = new Map(after.map((row) => [ruleSignature(row), row]));
  const added: TimetableDraftRow[] = [];
  const removed: TimetableDraftRow[] = [];
  const changed: ScheduleDiff["changed"] = [];

  for (const [signature, row] of afterMap) {
    const previous = beforeMap.get(signature);
    if (!previous) added.push(row);
    else if (previous.endTime !== row.endTime || previous.location !== row.location) {
      changed.push({ before: previous, after: row });
    }
  }
  for (const [signature, row] of beforeMap) {
    if (!afterMap.has(signature)) removed.push(row);
  }
  return { added, removed, changed };
}

export function findConflicts(sessions: GeneratedSession[]): { a: GeneratedSession; b: GeneratedSession }[] {
  const byDate = new Map<string, GeneratedSession[]>();
  for (const session of sessions) {
    const list = byDate.get(session.dateKey) ?? [];
    list.push(session);
    byDate.set(session.dateKey, list);
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
