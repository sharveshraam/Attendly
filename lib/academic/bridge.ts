/**
 * Adapter between the platform-independent academic core and the existing
 * Supabase row shapes. This is the ONLY place that knows about `combineDateTime`
 * or database column names; the core itself stays portable to Android.
 */
import { combineDateTime } from "../dates.ts";
import type { DetectedCourseInsert, DetectedRuleInsert, EventInsert } from "../data.ts";
import type { AcademicDayRow, CourseRow, SemesterRow, TimetableRuleRow } from "../types.ts";
import { courseKey } from "./text.ts";
import { addDaysKey, isValidDateKey } from "./dates.ts";
import { courseSourceKey, ruleSourceKey, sessionSourceKey, exceptionSourceKey } from "./idempotency.ts";
import { computeSchedule } from "./engine.ts";
import { toDayExceptions } from "./calendar.ts";
import type {
  CalendarEntry, DayException, DetectedCourse, EngineInput, ScheduleResult,
  SessionType, WeeklyRule,
} from "./types.ts";

export function courseKeyForRow(course: CourseRow): string {
  return course.source_key ?? courseKey(course.code ?? null, course.name);
}

export function courseSourceKeyFor(semesterId: string, course: DetectedCourse): string {
  return courseSourceKey(semesterId, course.code, course.name);
}

const DB_SESSION_TYPES: SessionType[] = ["lecture", "tutorial", "lab", "practical", "seminar", "unknown"];

function normalizeSessionType(value: string | null | undefined): SessionType {
  return value && DB_SESSION_TYPES.includes(value as SessionType) ? (value as SessionType) : "lecture";
}

export interface ExceptionPayload {
  type?: DayException["type"];
  courseKeys?: string[];
  extraRule?: WeeklyRule | null;
  rescheduled?: boolean;
  priority?: number;
  /** `academic_days` is unique per day, so several exceptions share one row. */
  exceptions?: DayException[];
  original?: string;
  scope?: DayException["scope"];
}

/** Defensive conversion of a stored JSON fragment into an engine exception. */
function payloadToException(row: AcademicDayRow, payload: ExceptionPayload, index: number): DayException {
  const type = payload.type ?? exceptionTypeFor(row) ?? "holiday";
  return {
    id: `${row.source_key ?? `day:${row.id}`}:${index}`,
    date: row.day,
    priority: payload.priority ?? (
      type === "cancelled" ? 200 : type === "additional" ? 150 :
      type === "replacement_day" || type === "special_working" ? 100 :
      type === "timetable_change" ? 90 : 50),
    type,
    scope: payload.scope ?? row.closure_scope ?? "full_day",
    followsWeekday: payload.type ? null : (row.follows_weekday ?? null),
    courseKeys: payload.courseKeys ?? [],
    startTime: payload.type ? null : (row.start_time?.slice(0, 5) ?? null),
    endTime: payload.type ? null : (row.end_time?.slice(0, 5) ?? null),
    extraRule: payload.extraRule ?? null,
    rescheduled: payload.rescheduled ?? false,
    confirmed: row.confirmed !== false,
  };
}

function exceptionTypeFor(row: AcademicDayRow): DayException["type"] | null {
  const payload = (row.extra_data ?? {}) as ExceptionPayload;
  if (payload.type) return payload.type;
  switch (row.exception_type) {
    case "cancelled": return "cancelled";
    case "additional": return "additional";
    case "timetable_change": return "timetable_change";
    case "vacation": return "vacation";
    case "college_event": return "college_event";
    default: break;
  }
  switch (row.kind) {
    case "holiday": return "holiday";
    case "non_instructional": return "non_instructional";
    case "closure": return "closure";
    case "exam": return "exam";
    case "special_working": return "special_working";
    default: return null; // an ordinary instructional day is not an exception
  }
}

/** Convert stored academic_days rows into deterministic engine exceptions. */
export function dayExceptionsFromRows(rows: AcademicDayRow[]): DayException[] {
  const out: DayException[] = [];
  for (const row of rows) {
    if (row.confirmed === false) continue;
    const payload = (row.extra_data ?? {}) as ExceptionPayload;
    if (Array.isArray(payload.exceptions) && payload.exceptions.length > 0) {
      payload.exceptions.forEach((item, index) => {
        // Trust the stored, human-confirmed fragment; only re-attach the date.
        out.push({ ...item, id: `${row.source_key ?? `day:${row.id}`}:${index}`, date: row.day, confirmed: row.confirmed !== false });
      });
      continue;
    }
    const type = exceptionTypeFor(row);
    if (!type || type === "college_event") continue; // informational only
    out.push(payloadToException(row, payload, 0));
  }
  return out;
}

/** Convert stored weekly rules into engine rules. */
export function weeklyRulesFromRows(rules: TimetableRuleRow[], courses: CourseRow[]): WeeklyRule[] {
  const byId = new Map(courses.map((course) => [course.id, courseKeyForRow(course)]));
  return rules.map((rule) => ({
    id: rule.source_key ?? `rule:${rule.id}`,
    courseKey: byId.get(rule.course_id) ?? rule.course_id,
    weekday: rule.weekday,
    startTime: rule.starts_at.slice(0, 5),
    endTime: rule.ends_at.slice(0, 5),
    sessionType: normalizeSessionType(rule.session_type),
    validFrom: rule.valid_from,
    validUntil: rule.valid_until,
  }));
}

export interface BuildEngineOptions {
  semester: SemesterRow;
  courses: CourseRow[];
  rules: TimetableRuleRow[];
  academicDays: AcademicDayRow[];
  asOf?: string;
  marks?: Record<string, "present" | "absent" | "excused" | "unmarked">;
  previousSessions?: ScheduleResult["sessions"];
}

/** Single entry: identical engine input on every page and for the RPC. */
export function buildEngineInput(options: BuildEngineOptions): EngineInput {
  const { semester, courses, rules, academicDays } = options;
  const end = semester.end_date ?? defaultEnd(semester.start_date);
  return {
    semesterStart: semester.start_date,
    semesterEnd: end,
    courses: courses.map((course) => ({ key: courseKeyForRow(course), name: course.name })),
    rules: weeklyRulesFromRows(rules, courses),
    exceptions: dayExceptionsFromRows(academicDays),
    targetPercent: Number(semester.attendance_target ?? 75),
    ...(options.asOf || options.marks ? {
      reality: { asOf: options.asOf ?? semester.start_date, marks: options.marks ?? {}, conducted: {} },
    } : {}),
    ...(options.previousSessions ? { previousSessions: options.previousSessions } : {}),
  };
}

function defaultEnd(start: string): string {
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 4);
  return date.toISOString().slice(0, 10);
}

export function computeFromWorkspace(options: BuildEngineOptions): ScheduleResult {
  return computeSchedule(buildEngineInput(options));
}

/** Course rows for the review-confirm step. Idempotent `source_key` per course. */
export function toCourseInserts(
  semesterId: string,
  courses: DetectedCourse[],
  colors: readonly string[],
  detectionSource: string,
): DetectedCourseInsert[] {
  const confirmedAt = new Date().toISOString();
  return courses.map((course, index) => ({
    semester_id: semesterId,
    name: course.name,
    code: course.code,
    faculty: course.faculty,
    category: course.sessionTypes.includes("lab") || course.sessionTypes.includes("practical") ? "lab" :
      course.sessionTypes.includes("tutorial") ? "tutorial" : "theory",
    color: colors[index % colors.length] ?? "#38B8A5",
    calculation_mode: "class_count" as const,
    source_key: courseSourceKeyFor(semesterId, course),
    detection_source: detectionSource,
    confirmed_at: confirmedAt,
  }));
}

/** Weekly rule rows. One row per extracted slot, including same-day repeats. */
export function toRuleInserts(
  semesterId: string,
  courses: DetectedCourse[],
  courseIdBySourceKey: Map<string, string>,
  semesterStart: string,
  semesterEnd: string,
  revision = "base",
): DetectedRuleInsert[] {
  const rows: DetectedRuleInsert[] = [];
  for (const course of courses) {
    const courseId = courseIdBySourceKey.get(courseSourceKeyFor(semesterId, course));
    if (!courseId) continue;
    for (const slot of course.slots) {
      if (slot.weekday === null || !slot.startTime || !slot.endTime) continue;
      rows.push({
        semester_id: semesterId,
        course_id: courseId,
        weekday: slot.weekday,
        starts_at: slot.startTime,
        ends_at: slot.endTime,
        location: slot.room || null,
        faculty: slot.faculty || course.faculty || null,
        session_type: slot.sessionType === "unknown" ? "lecture" : slot.sessionType,
        revision,
        valid_from: semesterStart,
        valid_until: semesterEnd,
        source_key: ruleSourceKey(semesterId, courseSourceKeyFor(semesterId, course), slot.weekday, slot.startTime, slot.sessionType, revision),
      });
    }
  }
  return rows;
}

/** Academic-day rows for confirmed calendar entries.
 *
 * `academic_days` has a UNIQUE (semester_id, day) constraint. Several
 * exceptions on one date (e.g. a holiday AND a one-off extra class) are stored
 * as one row whose `extra_data.exceptions` holds every confirmed fragment, so
 * no calendar exception is silently overwritten. The row's plain columns still
 * describe the highest-priority exception for the existing calendar UI.
 */
export function toCalendarExceptionRows(
  semesterId: string,
  entries: CalendarEntry[],
  manual: DayException[],
): import("../data.ts").CalendarExceptionInsert[] {
  const all = [
    ...toDayExceptions(entries).exceptions,
    ...manual,
  ].sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  const byDate = new Map<string, DayException[]>();
  for (const exception of all) {
    if (!isValidDateKey(exception.date)) continue;
    byDate.set(exception.date, [...(byDate.get(exception.date) ?? []), exception]);
  }
  const rows: import("../data.ts").CalendarExceptionInsert[] = [];
  for (const [day, exceptions] of byDate) {
    const primary = exceptions[exceptions.length - 1]!;
    const working = exceptions.find((item) => item.followsWeekday !== null);
    const kind: import("../types.ts").AcademicDayRow["kind"] =
      primary.type === "special_working" || primary.type === "compensatory_working" || primary.type === "replacement_day" ? "special_working" :
      primary.type === "holiday" ? "holiday" :
      primary.type === "exam" ? "exam" :
      primary.type === "closure" || primary.type === "vacation" || primary.type === "cancelled" ? "closure" :
      primary.type === "non_instructional" ? "non_instructional" : "instructional";
    rows.push({
      semester_id: semesterId,
      day,
      kind,
      title: exceptions.map((item) => item.type.replace(/_/g, " ")).filter((value, index, list) => list.indexOf(value) === index).join(", ") || null,
      notes: null,
      follows_weekday: working?.followsWeekday ?? null,
      closure_scope: primary.scope === "unknown" ? "full_day" : primary.scope,
      start_time: primary.startTime,
      end_time: primary.endTime,
      exception_type: exceptions.length > 1 ? "multiple" : primary.type,
      source_key: exceptionSourceKey(semesterId, day, "exceptions", exceptions.map((item) => item.id).sort().join("|")),
      confirmed: true,
      extra_data: { exceptions } as never,
    });
  }
  return rows;
}

/** Materialise the computed schedule as idempotent `calendar_events` rows. */
export function toEventInserts(
  result: ScheduleResult,
  context: {
    semesterId: string;
    userId: string;
    importId: string | null;
    courseIdByKey: Map<string, string>;
    courseNameByKey: Map<string, string>;
  },
): EventInsert[] {
  return result.sessions.map((session) => {
    const courseId = context.courseIdByKey.get(session.courseKey) ?? null;
    return {
      semester_id: context.semesterId,
      course_id: courseId,
      title: context.courseNameByKey.get(session.courseKey) ?? session.courseKey,
      kind: "class" as const,
      status: session.cancelled ? "cancelled" as const : session.rescheduled ? "rescheduled" as const : "scheduled" as const,
      starts_at: combineDateTime(session.date, session.startTime),
      // A session may cross midnight (e.g. 23:00-00:30); keep the end on the
      // following date so the database `ends_at > starts_at` check holds.
      ends_at: combineDateTime(
        session.endTime <= session.startTime ? addDaysKey(session.date, 1) : session.date,
        session.endTime,
      ),
      created_by: context.userId,
      source: "academic-structure",
      verification_status: "confirmed" as const,
      source_key: sessionSourceKey(context.semesterId, session.courseKey, session.date, session.startTime, session.sessionType),
      session_date: session.date,
      session_type: session.sessionType,
      origin: session.origin,
      import_id: context.importId,
    };
  });
}
