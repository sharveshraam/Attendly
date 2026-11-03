/**
 * Typed mirror of the live Attendly Supabase schema
 * (supabase/migrations/0001_attendly_core.sql, verified against project
 * gavlxbxgxdormbfhtzlo on 2026-11-03). Do not invent columns here — extend the
 * migration first, then regenerate these types.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type GroupRole = 'owner' | 'admin' | 'member';
export type CalendarEventKind = 'class' | 'exam' | 'holiday' | 'deadline' | 'other';
export type ClassStatus = 'scheduled' | 'cancelled' | 'rescheduled' | 'completed';
export type AttendanceStatus = 'present' | 'absent' | 'excused' | 'unmarked';
export type AcademicDayKind =
  | 'instructional'
  | 'non_instructional'
  | 'holiday'
  | 'exam'
  | 'closure'
  | 'special_working';
export type PredictionMode = 'fixed' | 'rolling';
export type CalculationMode = 'class_count' | 'hours';
export type DocumentKind = 'timetable' | 'academic_calendar' | 'exam_schedule' | 'other';
export type ExtractionStatus = 'uploaded' | 'processing' | 'review_required' | 'approved' | 'failed';
export type VerificationStatus = 'unverified' | 'proposed' | 'confirmed' | 'rejected';
export type AssignmentStatus = 'pending' | 'in_progress' | 'submitted';

export type ProfileRow = {
  id: string;
  display_name: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export type GroupRow = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
}

export type GroupMemberRow = {
  group_id: string;
  user_id: string;
  role: GroupRole;
  joined_at: string;
}

export type SemesterRow = {
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

export type CourseRow = {
  id: string;
  semester_id: string;
  code: string | null;
  name: string;
  category: string;
  attendance_target: number | null;
  calculation_mode: CalculationMode;
  color: string;
  created_at: string;
}

export type TimetableRuleRow = {
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
}

export type AcademicDayRow = {
  id: string;
  semester_id: string;
  day: string;
  kind: AcademicDayKind;
  title: string | null;
  notes: string | null;
}

export type CalendarEventRow = {
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
}

export type AttendanceRecordRow = {
  id: string;
  user_id: string;
  event_id: string;
  status: AttendanceStatus;
  attended_minutes: number | null;
  note: string | null;
  marked_at: string | null;
}

export type DocumentUploadRow = {
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
}

export type ScheduleChangeLogRow = {
  id: string;
  event_id: string | null;
  semester_id: string;
  actor_id: string;
  action: string;
  before_data: Json | null;
  after_data: Json | null;
  created_at: string;
}

export type AssignmentRow = {
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

export type CourseResourceRow = {
  id: string;
  owner_id: string;
  course_id: string;
  title: string;
  resource_url: string | null;
  storage_path: string | null;
  created_at: string;
}

export type NotificationPreferencesRow = {
  user_id: string;
  daily_reminder: boolean;
  schedule_changes: boolean;
  attendance_warnings: boolean;
  assignment_reminders: boolean;
  reminder_time: string;
  timezone: string;
}

export type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  category: string;
  read_at: string | null;
  created_at: string;
}

export type CalendarPollRow = {
  id: string;
  group_id: string;
  created_by: string;
  title: string;
  options: Json;
  closes_at: string | null;
  created_at: string;
}

export type CalendarPollVoteRow = {
  poll_id: string;
  user_id: string;
  option_index: number;
  created_at: string;
}

export type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  subscription: Json;
  created_at: string;
}

export type SemesterSnapshotRow = {
  id: string;
  semester_id: string;
  created_by: string;
  snapshot_name: string;
  snapshot_data: Json;
  created_at: string;
}

type InsertOf<T, Required extends keyof T> = Pick<T, Required> & Partial<Omit<T, Required>>;
type UpdateOf<T> = Partial<T>;
/** supabase-js requires a Relationships array on every table definition. */
type TableDef<Row, Insert, Update> = { Row: Row; Insert: Insert; Update: Update; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      profiles: TableDef<ProfileRow, InsertOf<ProfileRow, 'id'>, UpdateOf<ProfileRow>>;
      groups: TableDef<GroupRow, InsertOf<GroupRow, 'name' | 'created_by'>, UpdateOf<GroupRow>>;
      group_members: TableDef<GroupMemberRow, InsertOf<GroupMemberRow, 'group_id' | 'user_id'>, UpdateOf<GroupMemberRow>>;
      semesters: TableDef<SemesterRow, InsertOf<SemesterRow, 'owner_id' | 'name' | 'start_date'>, UpdateOf<SemesterRow>>;
      courses: TableDef<CourseRow, InsertOf<CourseRow, 'semester_id' | 'name'>, UpdateOf<CourseRow>>;
      timetable_rules: TableDef<TimetableRuleRow, InsertOf<TimetableRuleRow, 'semester_id' | 'course_id' | 'weekday' | 'starts_at' | 'ends_at'>, UpdateOf<TimetableRuleRow>>;
      academic_days: TableDef<AcademicDayRow, InsertOf<AcademicDayRow, 'semester_id' | 'day' | 'kind'>, UpdateOf<AcademicDayRow>>;
      calendar_events: TableDef<CalendarEventRow, InsertOf<CalendarEventRow, 'semester_id' | 'title' | 'starts_at' | 'ends_at' | 'created_by'>, UpdateOf<CalendarEventRow>>;
      attendance_records: TableDef<AttendanceRecordRow, InsertOf<AttendanceRecordRow, 'user_id' | 'event_id'>, UpdateOf<AttendanceRecordRow>>;
      document_uploads: TableDef<DocumentUploadRow, InsertOf<DocumentUploadRow, 'owner_id' | 'storage_path' | 'file_name' | 'document_kind'>, UpdateOf<DocumentUploadRow>>;
      schedule_change_log: TableDef<ScheduleChangeLogRow, InsertOf<ScheduleChangeLogRow, 'semester_id' | 'actor_id' | 'action'>, UpdateOf<ScheduleChangeLogRow>>;
      assignments: TableDef<AssignmentRow, InsertOf<AssignmentRow, 'owner_id' | 'semester_id' | 'title'>, UpdateOf<AssignmentRow>>;
      course_resources: TableDef<CourseResourceRow, InsertOf<CourseResourceRow, 'owner_id' | 'course_id' | 'title'>, UpdateOf<CourseResourceRow>>;
      notification_preferences: TableDef<NotificationPreferencesRow, InsertOf<NotificationPreferencesRow, 'user_id'>, UpdateOf<NotificationPreferencesRow>>;
      notifications: TableDef<NotificationRow, InsertOf<NotificationRow, 'user_id' | 'title' | 'body' | 'category'>, UpdateOf<NotificationRow>>;
      calendar_polls: TableDef<CalendarPollRow, InsertOf<CalendarPollRow, 'group_id' | 'created_by' | 'title' | 'options'>, UpdateOf<CalendarPollRow>>;
      calendar_poll_votes: TableDef<CalendarPollVoteRow, InsertOf<CalendarPollVoteRow, 'poll_id' | 'user_id' | 'option_index'>, UpdateOf<CalendarPollVoteRow>>;
      push_subscriptions: TableDef<PushSubscriptionRow, InsertOf<PushSubscriptionRow, 'user_id' | 'endpoint' | 'subscription'>, UpdateOf<PushSubscriptionRow>>;
      semester_snapshots: TableDef<SemesterSnapshotRow, InsertOf<SemesterSnapshotRow, 'semester_id' | 'created_by' | 'snapshot_name' | 'snapshot_data'>, UpdateOf<SemesterSnapshotRow>>;
    };
    Views: Record<string, never>;
    Functions: {
      join_group_by_invite: { Args: { invite: string }; Returns: string };
      set_group_member_role: { Args: { target_group: string; target_user: string; target_role: GroupRole }; Returns: undefined };
      is_group_member: { Args: { target_group: string }; Returns: boolean };
      can_manage_group: { Args: { target_group: string }; Returns: boolean };
    };
    Enums: {
      group_role: GroupRole;
      calendar_event_kind: CalendarEventKind;
      class_status: ClassStatus;
      attendance_status: AttendanceStatus;
      academic_day_kind: AcademicDayKind;
    };
    CompositeTypes: Record<string, never>;
  };
}
