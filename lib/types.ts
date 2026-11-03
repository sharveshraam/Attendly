/**
 * Exact mirror of the live Supabase schema in
 * supabase/migrations/0001_attendly_core.sql (verified read-only on 2026-11-03).
 * Do not add columns here that do not exist in the database.
 */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json | undefined };

export type GroupRole = "owner" | "admin" | "member";
export type CalendarEventKind = "class" | "exam" | "holiday" | "deadline" | "other";
export type ClassStatus = "scheduled" | "cancelled" | "rescheduled" | "completed";
export type AttendanceStatus = "present" | "absent" | "excused" | "unmarked";
export type AcademicDayKind =
  | "instructional"
  | "non_instructional"
  | "holiday"
  | "exam"
  | "closure"
  | "special_working";
export type CalculationMode = "class_count" | "hours";
export type PredictionMode = "fixed" | "rolling";
export type VerificationStatus = "unverified" | "proposed" | "confirmed" | "rejected";
export type AssignmentStatus = "pending" | "in_progress" | "submitted";
export type SessionType = "lecture" | "tutorial" | "lab" | "practical" | "seminar" | "unknown";
export type DocumentKind = "timetable" | "academic_calendar" | "exam_schedule" | "other";
export type ExtractionStatus = "uploaded" | "processing" | "review_required" | "approved" | "failed";

export interface ProfileRow {
  id: string;
  display_name: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}
export interface GroupRow {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
}
export interface GroupMemberRow {
  group_id: string;
  user_id: string;
  role: GroupRole;
  joined_at: string;
}
export interface SemesterRow {
  id: string;
  owner_id: string;
  group_id: string | null;
  name: string;
  institution: string | null;
  start_date: string;
  end_date: string | null;
  attendance_target: number;
  prediction_mode: PredictionMode;
  created_at: string;
}
export interface CourseRow {
  id: string;
  semester_id: string;
  code: string | null;
  name: string;
  category: string;
  attendance_target: number | null;
  calculation_mode: CalculationMode;
  color: string;
  created_at: string;
  /** Added by migration 0004 — optional so pre-0004 rows still type-check. */
  faculty?: string | null;
  source_key?: string | null;
  detection_source?: string | null;
  confirmed_at?: string | null;
}
export interface TimetableRuleRow {
  id: string;
  semester_id: string;
  course_id: string;
  weekday: number;
  starts_at: string;
  ends_at: string;
  location: string | null;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
  session_type?: SessionType;
  faculty?: string | null;
  source_key?: string | null;
  revision?: string;
}
export interface AcademicDayRow {
  id: string;
  semester_id: string;
  day: string;
  kind: AcademicDayKind;
  title: string | null;
  notes: string | null;
  follows_weekday?: number | null;
  closure_scope?: "full_day" | "partial" | "unknown";
  start_time?: string | null;
  end_time?: string | null;
  exception_type?: string | null;
  source_key?: string | null;
  confirmed?: boolean;
  extra_data?: Json | null;
}
export interface CalendarEventRow {
  id: string;
  semester_id: string;
  group_id: string | null;
  course_id: string | null;
  title: string;
  kind: CalendarEventKind;
  status: ClassStatus;
  starts_at: string;
  ends_at: string;
  location: string | null;
  description: string | null;
  source: string;
  verification_status: VerificationStatus;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  source_key?: string | null;
  session_date?: string | null;
  session_type?: SessionType;
  origin?: string | null;
  import_id?: string | null;
}
export interface AttendanceRecordRow {
  id: string;
  user_id: string;
  event_id: string;
  status: AttendanceStatus;
  attended_minutes: number | null;
  note: string | null;
  marked_at: string | null;
}
export interface DocumentUploadRow {
  id: string;
  owner_id: string;
  semester_id: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  document_kind: DocumentKind;
  extraction_status: ExtractionStatus;
  extracted_data: Json | null;
  created_at: string;
  content_hash?: string | null;
  confirmed_at?: string | null;
  import_batch_id?: string | null;
  sheet_index?: number | null;
}
export interface ScheduleChangeLogRow {
  id: string;
  event_id: string | null;
  semester_id: string;
  actor_id: string;
  action: string;
  before_data: Json | null;
  after_data: Json | null;
  created_at: string;
}
export interface AssignmentRow {
  id: string;
  owner_id: string;
  semester_id: string;
  course_id: string | null;
  title: string;
  description: string | null;
  due_at: string | null;
  status: AssignmentStatus;
  created_at: string;
}
export interface CourseResourceRow {
  id: string;
  owner_id: string;
  course_id: string;
  title: string;
  resource_url: string | null;
  storage_path: string | null;
  created_at: string;
}
export interface NotificationPreferencesRow {
  user_id: string;
  daily_reminder: boolean;
  schedule_changes: boolean;
  attendance_warnings: boolean;
  assignment_reminders: boolean;
  reminder_time: string;
  timezone: string;
}
export interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  body: string;
  category: string;
  read_at: string | null;
  created_at: string;
}
export interface CalendarPollRow {
  id: string;
  group_id: string;
  created_by: string;
  title: string;
  options: Json;
  closes_at: string | null;
  created_at: string;
}
export interface CalendarPollVoteRow {
  poll_id: string;
  user_id: string;
  option_index: number;
  created_at: string;
}
export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  subscription: Json;
  created_at: string;
}
export interface SemesterSnapshotRow {
  id: string;
  semester_id: string;
  created_by: string;
  snapshot_name: string;
  snapshot_data: Json;
  created_at: string;
}

/** A dated class session joined with the signed-in user's PRIVATE mark. */
export interface SessionWithAttendance {
  event: CalendarEventRow;
  record: AttendanceRecordRow | null;
  effectiveStatus: AttendanceStatus | "cancelled" | "rescheduled";
  pendingSync: boolean;
}

export interface CourseAttendanceStats {
  courseId: string;
  target: number;
  mode: CalculationMode;
  present: number;
  absent: number;
  excused: number;
  unmarked: number;
  cancelled: number;
  rescheduled: number;
  conducted: number;
  counted: number;
  percent: number | null;
  bunkAllowance: number | null;
  recoveryClasses: number | null;
  projectedBestPercent: number | null;
  projectedWorstPercent: number | null;
  futureScheduled: number;
  risk: "safe" | "warning" | "at_risk" | "unknown";
  attendedUnits: number;
  countedUnits: number;
  futureUnits: number | null;
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
  kind: AcademicDayKind;
  title: string;
}

export interface ScheduleDiff {
  added: TimetableDraftRow[];
  removed: TimetableDraftRow[];
  changed: { before: TimetableDraftRow; after: TimetableDraftRow }[];
}

/** Device-local note. There is NO notes table in the live schema. */
export interface LocalNote {
  id: string;
  courseId: string | null;
  semesterId: string | null;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

/** Device-local assignment priority overlay (no priority column in schema). */
export type LocalPriority = 1 | 2 | 3;
