/**
 * Android/iOS adapter for automatic academic-structure detection.
 *
 * Deliberately free of React Native, Expo and web imports so that:
 *  - the SAME pure engine as the website produces the expected class counts;
 *  - it can be type-checked and parity-tested in this repository;
 *  - no service-role credential is ever needed (all calls are RLS-scoped).
 */
import {
  addDaysKey, computeScheduleCached, courseSourceKey, exceptionSourceKey,
  isValidDateKey, ruleSourceKey, sessionSourceKey, toDayExceptions,
  type DayException, type DetectedCourse, type EngineInput, type ScheduleResult,
  type SessionType, type WeeklyRule,
} from "../../../../../packages/attendly-core/src/index.ts";

/** Minimal shapes matching the live Supabase columns (additive migration 0004). */
export interface MobileCourseRow {
  id: string;
  semester_id: string;
  name: string;
  code: string | null;
  faculty?: string | null;
  source_key?: string | null;
  confirmed_at?: string | null;
}
export interface MobileRuleRow {
  id: string;
  semester_id: string;
  course_id: string;
  weekday: number;
  starts_at: string;
  ends_at: string;
  session_type?: SessionType | null;
  faculty?: string | null;
  source_key?: string | null;
  revision?: string | null;
  valid_from?: string | null;
  valid_until?: string | null;
}
export interface MobileDayRow {
  id: string;
  semester_id: string;
  day: string;
  kind: string;
  title?: string | null;
  follows_weekday?: number | null;
  closure_scope?: "full_day" | "partial" | "unknown" | null;
  start_time?: string | null;
  end_time?: string | null;
  exception_type?: string | null;
  source_key?: string | null;
  confirmed?: boolean | null;
  extra_data?: unknown;
}
export interface MobileSemesterRow {
  id: string;
  start_date: string;
  end_date: string | null;
  attendance_target?: number | null;
}

const SESSION_TYPES: SessionType[] = ["lecture", "tutorial", "lab", "practical", "seminar", "unknown"];

/** Same identity rule as the web bridge: a normalised code wins over a name. */
export function mobileCourseKey(code: string | null, name: string): string {
  if (code) return `code:${code.toUpperCase().replace(/[^A-Z0-9]/g, "")}`;
  return `name:${name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ")}`;
}

export function courseKeyForMobileRow(course: MobileCourseRow): string {
  return course.source_key ?? mobileCourseKey(course.code, course.name);
}

function normalizeType(value: string | null | undefined): SessionType {
  return value && SESSION_TYPES.includes(value as SessionType) ? value as SessionType : "lecture";
}

/** Expand `extra_data.exceptions`; several confirmed exceptions share one day row. */
export function mobileDayExceptions(rows: MobileDayRow[]): DayException[] {
  const out: DayException[] = [];
  for (const row of rows) {
    if (row.confirmed === false || !isValidDateKey(row.day)) continue;
    const payload = (row.extra_data ?? {}) as { exceptions?: DayException[]; type?: DayException["type"] };
    if (Array.isArray(payload.exceptions) && payload.exceptions.length > 0) {
      payload.exceptions.forEach((item, index) => out.push({
        ...item, id: `${row.source_key ?? row.id}:${index}`, date: row.day,
        confirmed: true,
      }));
      continue;
    }
    const type = payload.type ?? (
      row.exception_type === "cancelled" ? "cancelled" :
      row.exception_type === "additional" ? "additional" :
      row.exception_type === "timetable_change" ? "timetable_change" :
      row.kind === "holiday" ? "holiday" :
      row.kind === "closure" ? "closure" :
      row.kind === "exam" ? "exam" :
      row.kind === "special_working" ? "special_working" :
      row.kind === "non_instructional" ? "non_instructional" : null);
    if (!type) continue;
    out.push({
      id: row.source_key ?? `day:${row.id}`, date: row.day,
      priority: type === "cancelled" ? 200 : type === "additional" ? 150 :
        type === "special_working" ? 100 : type === "timetable_change" ? 90 : 50,
      type, scope: row.closure_scope ?? "full_day",
      followsWeekday: row.follows_weekday ?? null, courseKeys: [],
      startTime: row.start_time?.slice(0, 5) ?? null,
      endTime: row.end_time?.slice(0, 5) ?? null,
      extraRule: null, rescheduled: false, confirmed: true,
    });
  }
  return out;
}

export function mobileWeeklyRules(rules: MobileRuleRow[], courses: MobileCourseRow[]): WeeklyRule[] {
  const byId = new Map(courses.map((course) => [course.id, courseKeyForMobileRow(course)]));
  return rules.map((row) => ({
    id: row.source_key ?? `rule:${row.id}`,
    courseKey: byId.get(row.course_id) ?? row.course_id,
    weekday: row.weekday,
    startTime: row.starts_at.slice(0, 5),
    endTime: row.ends_at.slice(0, 5),
    sessionType: normalizeType(row.session_type),
    validFrom: row.valid_from ?? null,
    validUntil: row.valid_until ?? null,
  }));
}

export interface MobileStructureOptions {
  semester: MobileSemesterRow;
  courses: MobileCourseRow[];
  rules: MobileRuleRow[];
  academicDays: MobileDayRow[];
  asOf?: string;
  marks?: Record<string, "present" | "absent" | "excused" | "unmarked">;
  previousSessions?: ScheduleResult["sessions"];
}

/** One engine input, shared with the website and the Supabase RPC. */
export function buildMobileEngineInput(options: MobileStructureOptions): EngineInput {
  const { semester } = options;
  const end = semester.end_date ?? (() => {
    const date = new Date(`${semester.start_date}T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + 4);
    return date.toISOString().slice(0, 10);
  })();
  return {
    semesterStart: semester.start_date,
    semesterEnd: end,
    courses: options.courses.map((course) => ({ key: courseKeyForMobileRow(course), name: course.name })),
    rules: mobileWeeklyRules(options.rules, options.courses),
    exceptions: mobileDayExceptions(options.academicDays),
    targetPercent: semester.attendance_target ?? 75,
    ...(options.asOf || options.marks ? {
      reality: { asOf: options.asOf ?? semester.start_date, marks: options.marks ?? {}, conducted: {} },
    } : {}),
    ...(options.previousSessions ? { previousSessions: options.previousSessions } : {}),
  };
}

/** Cached so a revisit never re-parses or re-expands the semester. */
export function computeMobileExpectedCounts(options: MobileStructureOptions): ScheduleResult {
  return computeScheduleCached(buildMobileEngineInput(options));
}

/* ---------------------------------------------------------- persistence rows */
export interface MobilePersistencePayload {
  courses: Record<string, unknown>[];
  rules: Record<string, unknown>[];
  academicDays: Record<string, unknown>[];
  events: Record<string, unknown>[];
}

/** Every row carries a deterministic source_key; repeated uploads are idempotent. */
export function buildMobilePersistencePayload(input: {
  semesterId: string;
  userId: string;
  importId: string | null;
  courses: DetectedCourse[];
  calendarEntries?: Parameters<typeof toDayExceptions>[0];
  manualExceptions?: DayException[];
  result: ScheduleResult;
  courseIdBySourceKey: Map<string, string>;
  colors?: readonly string[];
  source?: string;
}): MobilePersistencePayload {
  const confirmedAt = new Date().toISOString();
  const colors = input.colors ?? ["#38B8A5", "#2C9E8E", "#5CCABB", "#7FE0D1", "#1F7A70"];
  const courses = input.courses.map((course, index) => ({
    semester_id: input.semesterId,
    name: course.name,
    code: course.code,
    faculty: course.faculty,
    category: course.sessionTypes.includes("lab") ? "lab" : "theory",
    color: colors[index % colors.length] ?? "#38B8A5",
    calculation_mode: "class_count",
    source_key: courseSourceKey(input.semesterId, course.code, course.name),
    detection_source: input.source ?? "mobile",
    confirmed_at: confirmedAt,
  }));
  const rules: Record<string, unknown>[] = [];
  for (const course of input.courses) {
    const key = courseSourceKey(input.semesterId, course.code, course.name);
    const courseId = input.courseIdBySourceKey.get(key);
    if (!courseId) continue;
    for (const slot of course.slots) {
      if (slot.weekday === null || !slot.startTime || !slot.endTime) continue;
      const sessionType = slot.sessionType === "unknown" ? "lecture" : slot.sessionType;
      rules.push({
        semester_id: input.semesterId, course_id: courseId, weekday: slot.weekday,
        starts_at: slot.startTime, ends_at: slot.endTime,
        location: slot.room || null, faculty: slot.faculty || course.faculty || null,
        session_type: sessionType, revision: "base",
        valid_from: input.result.sessions[0]?.date ?? null,
        valid_until: input.result.sessions[input.result.sessions.length - 1]?.date ?? null,
        source_key: ruleSourceKey(input.semesterId, key, slot.weekday, slot.startTime, sessionType, "base"),
      });
    }
  }
  const all = [
    ...toDayExceptions(input.calendarEntries ?? []).exceptions,
    ...(input.manualExceptions ?? []),
  ].sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  const byDate = new Map<string, DayException[]>();
  for (const exception of all) {
    if (!isValidDateKey(exception.date)) continue;
    byDate.set(exception.date, [...(byDate.get(exception.date) ?? []), exception]);
  }
  const academicDays = [...byDate].map(([day, exceptions]) => ({
    semester_id: input.semesterId, day,
    kind: exceptions[exceptions.length - 1]?.type === "holiday" ? "holiday" : "instructional",
    title: exceptions.map((item) => item.type).join(", ") || null,
    follows_weekday: exceptions.find((item) => item.followsWeekday !== null)?.followsWeekday ?? null,
    closure_scope: "full_day", start_time: null, end_time: null,
    exception_type: exceptions.length > 1 ? "multiple" : exceptions[0]?.type ?? null,
    source_key: exceptionSourceKey(input.semesterId, day, "exceptions", exceptions.map((item) => item.id).sort().join("|")),
    confirmed: true, extra_data: { exceptions },
  }));
  const courseIdByKey = new Map<string, string>();
  const nameByKey = new Map<string, string>();
  for (const course of input.courses) {
    const key = courseSourceKey(input.semesterId, course.code, course.name);
    const id = input.courseIdBySourceKey.get(key);
    if (id) { courseIdByKey.set(key, id); nameByKey.set(key, course.name); }
  }
  const events = input.result.sessions.map((session) => {
    const endsOnNextDay = session.endTime <= session.startTime;
    return {
      semester_id: input.semesterId,
      course_id: courseIdByKey.get(session.courseKey) ?? null,
      title: nameByKey.get(session.courseKey) ?? session.courseKey,
      kind: "class",
      status: session.cancelled ? "cancelled" : session.rescheduled ? "rescheduled" : "scheduled",
      starts_at: combineDateTimeMobile(session.date, session.startTime),
      ends_at: combineDateTimeMobile(endsOnNextDay ? addDaysKey(session.date, 1) : session.date, session.endTime),
      created_by: input.userId,
      source: "academic-structure",
      verification_status: "confirmed",
      source_key: sessionSourceKey(input.semesterId, session.courseKey, session.date, session.startTime, session.sessionType),
      session_date: session.date,
      session_type: session.sessionType,
      origin: session.origin,
      import_id: input.importId,
    };
  });
  return { courses, rules, academicDays, events };
}

/** Matches `lib/dates.ts#combineDateTime`: device-local wall clock -> ISO. */
export function combineDateTimeMobile(dateKey: string, timeKey: string): string {
  const [year, month, day] = dateKey.split("-").map((part) => Number.parseInt(part, 10));
  const [hour, minute] = timeKey.split(":").map((part) => Number.parseInt(part, 10));
  const date = new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0, 0, 0);
  return date.toISOString();
}

/* --------------------------------------------------------------- shared RPC */
export interface ExpectedClassCountRow {
  course_id: string;
  scheduled: number;
  cancelled: number;
  rescheduled: number;
  attended: number;
  absent: number;
  excused: number;
  pending: number;
  attended_percent: number | null;
}

/** RLS-safe server projection: security-invoker RPC, never a service role. */
export async function fetchExpectedClassCounts(
  client: { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> },
  semesterId: string,
  from?: string | null,
  to?: string | null,
): Promise<ExpectedClassCountRow[]> {
  const { data, error } = await client.rpc("expected_class_counts", {
    p_semester: semesterId, p_from: from ?? null, p_to: to ?? null,
  });
  if (error) throw new Error(error.message);
  return (Array.isArray(data) ? data : []) as ExpectedClassCountRow[];
}
