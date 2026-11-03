import type {
  AcademicDayRow,
  AssignmentRow,
  AttendanceRecordRow,
  AttendanceStatus,
  CalendarEventRow,
  CourseRow,
  SemesterRow,
  TimetableRuleRow,
} from './database';

export type Semester = SemesterRow;
export type Course = CourseRow;
export type CalendarEvent = CalendarEventRow;
export type AttendanceRecord = AttendanceRecordRow;
export type TimetableRule = TimetableRuleRow;
export type AcademicDay = AcademicDayRow;
export type Assignment = AssignmentRow;

/** A dated class session joined with the signed-in user's private mark. */
export interface SessionWithAttendance {
  event: CalendarEvent;
  record: AttendanceRecord | null;
  /** Effective status used by the engine (event-level overrides applied). */
  effectiveStatus: AttendanceStatus | 'cancelled' | 'rescheduled';
  pendingSync?: boolean;
}

export interface CourseAttendanceStats {
  courseId: string;
  target: number;
  mode: 'class_count' | 'hours';
  conducted: number;
  attended: number;
  missed: number;
  excused: number;
  unmarked: number;
  cancelled: number;
  rescheduled: number;
  percent: number | null;
  /** Classes that can be missed while staying >= target (null when unknown). */
  bunkAllowance: number | null;
  /** Consecutive future classes to attend to reach target (null = impossible/unknown). */
  recoveryClasses: number | null;
  /** Projected percent if all remaining scheduled classes are attended (estimate). */
  projectedBestPercent: number | null;
  /** Projected percent if all remaining scheduled classes are missed (estimate). */
  projectedWorstPercent: number | null;
  futureScheduled: number;
  risk: 'safe' | 'warning' | 'at_risk' | 'unknown';
  attendedUnits: number;
  countedUnits: number;
}

export interface TimetableDraftRow {
  id: string;
  courseCode: string;
  courseName: string;
  weekday: number;
  startTime: string;
  endTime: string;
  location: string;
}

export interface AcademicDayDraft {
  id: string;
  day: string;
  kind: AcademicDayRow['kind'];
  title: string;
}

export interface ScheduleDiff {
  added: TimetableDraftRow[];
  removed: TimetableDraftRow[];
  changed: { before: TimetableDraftRow; after: TimetableDraftRow }[];
}

export type SyncOpKind =
  | 'attendance.upsert'
  | 'event.update'
  | 'event.insert'
  | 'assignment.upsert';

export interface OutboxOp {
  id: string;
  kind: SyncOpKind;
  payload: Json;
  createdAt: string;
  attempts: number;
  lastError: string | null;
  status: 'pending' | 'failed' | 'conflict';
}

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface LocalNote {
  id: string;
  courseId: string | null;
  semesterId: string | null;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}
