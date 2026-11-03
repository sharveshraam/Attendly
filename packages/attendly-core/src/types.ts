/**
 * Types for the automatic academic-structure pipeline. This file is pure data
 * shapes only; it is mirrored verbatim into the mobile shared core.
 */

export type SessionType = "lecture" | "tutorial" | "lab" | "practical" | "seminar" | "unknown";
export type CalendarEventType =
  | "semester_start" | "semester_end"
  | "holiday" | "institutional_holiday" | "closure"
  | "exam" | "vacation" | "college_event"
  | "special_working" | "compensatory_working"
  | "replacement_day" | "timetable_change" | "other";
export type DayScope = "full_day" | "partial" | "unknown";
export type Confidence = "high" | "medium" | "low";

/** One raw weekly timetable slot as extracted from a document. */
export interface ExtractedSlot {
  /** Stable id inside one extraction (NOT a database id). */
  id: string;
  raw: string;
  courseName: string;
  courseCode: string | null;
  weekday: number | null;
  startTime: string | null;
  endTime: string | null;
  sessionType: SessionType;
  faculty: string | null;
  room: string | null;
  confidence: Confidence;
  /** Reasons this entry needs human confirmation. Empty => reliable. */
  issues: string[];
  /** Set when OCR / a low-quality source produced the entry. */
  needsReview: boolean;
}

/** A course assembled from one or more slots. */
export interface DetectedCourse {
  key: string;
  name: string;
  code: string | null;
  faculty: string | null;
  sessionTypes: SessionType[];
  days: number[];
  /** One entry per weekly session, including repeats on the same day. */
  slots: ExtractedSlot[];
  weeklySessions: number;
  /** Minutes of scheduled teaching per week. */
  weeklyMinutes: number;
  issues: string[];
  needsReview: boolean;
}

export interface TimetableExtraction {
  slots: ExtractedSlot[];
  courses: DetectedCourse[];
  uncertain: ExtractedSlot[];
  /** Original layout as extracted, preserved for audit / review UI. */
  rawGrid: string[][];
  layout: "rows" | "matrix" | "text" | "unknown";
  source: string;
  warnings: string[];
  /** Always true for OCR-derived results; the user must confirm every row. */
  needsReview: boolean;
}

/** A dated exception extracted from an academic calendar. */
export interface CalendarEntry {
  id: string;
  raw: string;
  /** Inclusive start date key. */
  date: string | null;
  /** Inclusive end date key; equal to `date` for a single day. */
  endDate: string | null;
  type: CalendarEventType;
  title: string;
  scope: DayScope;
  /** For replacement days: which weekday's timetable runs on this date. */
  followsWeekday: number | null;
  /** Explicit extra/cancelled sessions attached to an exception. */
  note: string | null;
  confidence: Confidence;
  issues: string[];
  needsReview: boolean;
}

export interface CalendarExtraction {
  entries: CalendarEntry[];
  semesterStart: string | null;
  semesterEnd: string | null;
  uncertain: CalendarEntry[];
  rawGrid: string[][];
  source: string;
  warnings: string[];
  needsReview: boolean;
}

/** A normalised weekly rule as consumed by the class-count engine. */
export interface WeeklyRule {
  id: string;
  courseKey: string;
  weekday: number;
  startTime: string;
  endTime: string;
  sessionType: SessionType;
  /** Inclusive date window for timetable revisions; null = always. */
  validFrom: string | null;
  validUntil: string | null;
}

/** A one-date exception as consumed by the class-count engine. */
export interface DayException {
  id: string;
  date: string;
  /** Higher wins when several exceptions describe the same date. */
  priority: number;
  type:
    | "holiday" | "closure" | "exam" | "vacation" | "college_event" | "non_instructional"
    | "special_working" | "compensatory_working" | "replacement_day"
    | "cancelled" | "additional" | "timetable_change";
  scope: DayScope;
  /** replacement_day / special_working with an explicit weekly template. */
  followsWeekday: number | null;
  /** Course keys explicitly affected. Empty = whole day. */
  courseKeys: string[];
  /** Times affected for partial closures (`HH:mm`). */
  startTime: string | null;
  endTime: string | null;
  /** Explicit one-off session for `additional` / `timetable_change`. */
  extraRule: WeeklyRule | null;
  /** True when this cancellation is a reschedule whose replacement counts once. */
  rescheduled: boolean;
  confirmed: boolean;
}

/** A single generated, dated class session. */
export interface ScheduledSession {
  /** Deterministic idempotency key: courseKey|dateKey|HH:mm|type. */
  key: string;
  courseKey: string;
  date: string;
  startTime: string;
  endTime: string;
  sessionType: SessionType;
  weekday: number;
  /** Which rule or exception produced it. */
  origin: "weekly" | "replacement" | "special_working" | "additional" | "override";
  originId: string;
  /** True when a calendar exception explicitly cancelled it. */
  cancelled: boolean;
  /** True when the event status was changed to rescheduled. */
  rescheduled: boolean;
  /** A replacement session should never duplicate its original. */
  replacesKey: string | null;
}

/** Separate counters. A timetable entry is never proof a class was conducted. */
export interface SessionCounts {
  scheduled: number;
  conducted: number;
  attended: number;
  absent: number;
  excused: number;
  cancelled: number;
  rescheduled: number;
  pending: number;
  remaining: number;
}

export interface CourseCounts extends SessionCounts {
  courseKey: string;
  weeklySessions: number;
  percent: number | null;
  classesRequired: number | null;
  maxMissable: number | null;
}

/** Confirmed real-world status supplied by the attendance system. */
export interface SessionReality {
  /** Session key -> attendance status. Missing => unmarked/pending. */
  marks: Record<string, "present" | "absent" | "excused" | "unmarked">;
  /** Session key -> explicit verified "class was conducted" flag. */
  conducted: Record<string, boolean>;
  /** Date key used as "now" for a deterministic calculation. */
  asOf: string;
}

export interface ScheduleResult {
  sessions: ScheduledSession[];
  countsByCourse: CourseCounts[];
  totals: SessionCounts;
  /** Dates whose generated sessions changed (for incremental recompute). */
  affectedDates: string[];
  warnings: string[];
}

export interface EngineInput {
  semesterStart: string;
  semesterEnd: string;
  rules: WeeklyRule[];
  exceptions: DayException[];
  courses: { key: string; name: string }[];
  targetPercent?: number;
  rangeStart?: string;
  rangeEnd?: string;
  reality?: SessionReality;
  /** Previously generated sessions, for incremental recomputation. */
  previousSessions?: ScheduledSession[];
}
