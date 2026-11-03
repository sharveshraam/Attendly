/**
 * All website database access lives here. Every call uses the browser Supabase
 * client with the publishable key; authorization is enforced by the existing
 * RLS policies. No service-role key, no bypass, no invented columns/tables.
 */
import { createClient } from "@/lib/supabase/client";
import { MAX_DOCUMENT_BYTES, validateUpload } from "@/lib/validation";
import type {
  AcademicDayRow,
  AssignmentRow,
  AttendanceRecordRow,
  AttendanceStatus,
  CalendarEventRow,
  CalendarPollRow,
  CalendarPollVoteRow,
  CourseResourceRow,
  CourseRow,
  DocumentKind,
  DocumentUploadRow,
  GroupMemberRow,
  GroupRole,
  GroupRow,
  Json,
  NotificationPreferencesRow,
  NotificationRow,
  ProfileRow,
  ScheduleChangeLogRow,
  SemesterRow,
  TimetableRuleRow,
  VerificationStatus,
} from "@/lib/types";

type Client = ReturnType<typeof createClient>;

export class DataError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = "DataError";
  }
}

function fail(error: { message: string; code?: string } | null): never {
  throw new DataError(error?.message ?? "The request could not be completed.", error?.code);
}

export async function getCurrentUser() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) fail(error);
  return data.user;
}

/* ------------------------------------------------------------------ profile */
export async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await createClient().from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) fail(error);
  return (data as unknown as ProfileRow) ?? null;
}

export async function upsertProfile(
  userId: string,
  patch: { display_name?: string; timezone?: string },
): Promise<ProfileRow> {
  const { data, error } = await createClient()
    .from("profiles")
    .upsert({ id: userId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "id" })
    .select("*")
    .single();
  if (error) fail(error);
  return data as unknown as ProfileRow;
}

/* ---------------------------------------------------------------- semesters */
export async function fetchSemesters(userId: string): Promise<SemesterRow[]> {
  const { data, error } = await createClient()
    .from("semesters")
    .select("*")
    .eq("owner_id", userId)
    .order("start_date", { ascending: false })
    .limit(30);
  if (error) fail(error);
  return (data ?? []) as unknown as SemesterRow[];
}

export async function createSemester(input: {
  owner_id: string;
  name: string;
  institution?: string | null;
  start_date: string;
  end_date?: string | null;
  attendance_target: number;
  prediction_mode: "fixed" | "rolling";
  group_id?: string | null;
}): Promise<SemesterRow> {
  const { data, error } = await createClient().from("semesters").insert(input).select("*").single();
  if (error) fail(error);
  return data as unknown as SemesterRow;
}

export async function updateSemester(id: string, patch: Partial<SemesterRow>): Promise<SemesterRow> {
  const { data, error } = await createClient().from("semesters").update(patch).eq("id", id).select("*").single();
  if (error) fail(error);
  return data as unknown as SemesterRow;
}

/* ------------------------------------------------------------------ courses */
export async function fetchCourses(semesterId: string): Promise<CourseRow[]> {
  const { data, error } = await createClient().from("courses").select("*").eq("semester_id", semesterId).order("name").limit(200);
  if (error) fail(error);
  return (data ?? []) as unknown as CourseRow[];
}

export async function createCourse(input: {
  semester_id: string;
  name: string;
  code?: string | null;
  category?: string;
  attendance_target?: number | null;
  calculation_mode?: "class_count" | "hours";
  color?: string;
}): Promise<CourseRow> {
  const { data, error } = await createClient().from("courses").insert(input).select("*").single();
  if (error) fail(error);
  return data as unknown as CourseRow;
}

export async function updateCourse(id: string, patch: Partial<CourseRow>): Promise<CourseRow> {
  const { data, error } = await createClient().from("courses").update(patch).eq("id", id).select("*").single();
  if (error) fail(error);
  return data as unknown as CourseRow;
}

export async function deleteCourse(id: string): Promise<void> {
  const { error } = await createClient().from("courses").delete().eq("id", id);
  if (error) fail(error);
}

/* -------------------------------------------------------- timetable & days */
export async function fetchTimetableRules(semesterId: string): Promise<TimetableRuleRow[]> {
  const { data, error } = await createClient()
    .from("timetable_rules")
    .select("*")
    .eq("semester_id", semesterId)
    .order("weekday")
    .limit(300);
  if (error) fail(error);
  return (data ?? []) as unknown as TimetableRuleRow[];
}

export async function createTimetableRules(
  rows: Omit<TimetableRuleRow, "id" | "created_at">[],
): Promise<TimetableRuleRow[]> {
  if (rows.length === 0) return [];
  const { data, error } = await createClient().from("timetable_rules").insert(rows).select("*");
  if (error) fail(error);
  return (data ?? []) as unknown as TimetableRuleRow[];
}

export async function updateTimetableRule(
  id: string,
  patch: Partial<Pick<TimetableRuleRow, "course_id" | "weekday" | "starts_at" | "ends_at" | "location" | "valid_from" | "valid_until">>,
): Promise<void> {
  const { error } = await createClient().from("timetable_rules").update(patch).eq("id", id);
  if (error) fail(error);
}

export async function deleteTimetableRule(id: string): Promise<void> {
  const { error } = await createClient().from("timetable_rules").delete().eq("id", id);
  if (error) fail(error);
}

export async function fetchAcademicDays(semesterId: string): Promise<AcademicDayRow[]> {
  const { data, error } = await createClient()
    .from("academic_days")
    .select("*")
    .eq("semester_id", semesterId)
    .order("day")
    .limit(500);
  if (error) fail(error);
  return (data ?? []) as unknown as AcademicDayRow[];
}

export async function upsertAcademicDays(
  rows: { semester_id: string; day: string; kind: AcademicDayRow["kind"]; title?: string | null; notes?: string | null }[],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await createClient().from("academic_days").upsert(rows, { onConflict: "semester_id,day" });
  if (error) fail(error);
}

/* ------------------------------------------------------------------- events */
export interface EventInsert {
  semester_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  created_by: string;
  kind?: CalendarEventRow["kind"];
  status?: CalendarEventRow["status"];
  course_id?: string | null;
  group_id?: string | null;
  location?: string | null;
  description?: string | null;
  source?: string;
  verification_status?: VerificationStatus;
}

export async function fetchEvents(semesterId: string, options?: { from?: string; to?: string; limit?: number }): Promise<CalendarEventRow[]> {
  let query = createClient()
    .from("calendar_events")
    .select("*")
    .eq("semester_id", semesterId)
    .order("starts_at", { ascending: true })
    .limit(options?.limit ?? 1500);
  if (options?.from) query = query.gte("starts_at", options.from);
  if (options?.to) query = query.lte("starts_at", options.to);
  const { data, error } = await query;
  if (error) fail(error);
  return (data ?? []) as unknown as CalendarEventRow[];
}

export async function createEvents(inputs: EventInsert[]): Promise<CalendarEventRow[]> {
  if (inputs.length === 0) return [];
  // Chunk to keep request payloads small and avoid timeouts.
  const chunks: CalendarEventRow[][] = [];
  for (let index = 0; index < inputs.length; index += 100) {
    const { data, error } = await createClient().from("calendar_events").insert(inputs.slice(index, index + 100)).select("*");
    if (error) fail(error);
    chunks.push((data ?? []) as unknown as CalendarEventRow[]);
  }
  return chunks.flat();
}

export async function updateEvent(id: string, patch: Partial<CalendarEventRow>, actorId: string): Promise<CalendarEventRow> {
  const { data, error } = await createClient()
    .from("calendar_events")
    .update({ ...patch, updated_by: actorId, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) fail(error);
  return data as unknown as CalendarEventRow;
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await createClient().from("calendar_events").delete().eq("id", id);
  if (error) fail(error);
}

export async function logScheduleChange(input: {
  event_id?: string | null;
  semester_id: string;
  actor_id: string;
  action: string;
  before_data?: Json | null;
  after_data?: Json | null;
}): Promise<void> {
  const { error } = await createClient()
    .from("schedule_change_log")
    .insert({
      event_id: input.event_id ?? null,
      semester_id: input.semester_id,
      actor_id: input.actor_id,
      action: input.action,
      before_data: (input.before_data ?? null) as never,
      after_data: (input.after_data ?? null) as never,
    });
  if (error) fail(error);
}

export async function fetchChangeLog(semesterId: string, limit = 60): Promise<ScheduleChangeLogRow[]> {
  const { data, error } = await createClient()
    .from("schedule_change_log")
    .select("*")
    .eq("semester_id", semesterId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail(error);
  return (data ?? []) as unknown as ScheduleChangeLogRow[];
}

/* --------------------------------------------------------------- attendance */
export async function fetchAttendance(userId: string, eventIds: string[]): Promise<AttendanceRecordRow[]> {
  if (eventIds.length === 0) return [];
  const supabase = createClient();
  const out: AttendanceRecordRow[] = [];
  for (let index = 0; index < eventIds.length; index += 150) {
    const { data, error } = await supabase
      .from("attendance_records")
      .select("*")
      .eq("user_id", userId)
      .in("event_id", eventIds.slice(index, index + 150));
    if (error) fail(error);
    out.push(...((data ?? []) as unknown as AttendanceRecordRow[]));
  }
  return out;
}

export async function upsertAttendance(input: {
  user_id: string;
  event_id: string;
  status: AttendanceStatus;
  attended_minutes?: number | null;
  note?: string | null;
  marked_at?: string;
}): Promise<AttendanceRecordRow> {
  const { data, error } = await createClient()
    .from("attendance_records")
    .upsert(
      {
        user_id: input.user_id,
        event_id: input.event_id,
        status: input.status,
        attended_minutes: input.attended_minutes ?? null,
        note: input.note ?? null,
        marked_at: input.marked_at ?? new Date().toISOString(),
      },
      { onConflict: "user_id,event_id" },
    )
    .select("*")
    .single();
  if (error) fail(error);
  return data as unknown as AttendanceRecordRow;
}

export async function deleteAttendance(userId: string, eventId: string): Promise<void> {
  const { error } = await createClient()
    .from("attendance_records")
    .delete()
    .eq("user_id", userId)
    .eq("event_id", eventId);
  if (error) fail(error);
}

/* -------------------------------------------------------------- assignments */
export async function fetchAssignments(semesterId: string): Promise<AssignmentRow[]> {
  const { data, error } = await createClient()
    .from("assignments")
    .select("*")
    .eq("semester_id", semesterId)
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(500);
  if (error) fail(error);
  return (data ?? []) as unknown as AssignmentRow[];
}

export async function createAssignment(input: {
  owner_id: string;
  semester_id: string;
  title: string;
  description?: string | null;
  course_id?: string | null;
  due_at?: string | null;
  status?: AssignmentRow["status"];
}): Promise<AssignmentRow> {
  const { data, error } = await createClient().from("assignments").insert(input).select("*").single();
  if (error) fail(error);
  return data as unknown as AssignmentRow;
}

export async function updateAssignment(id: string, patch: Partial<AssignmentRow>): Promise<AssignmentRow> {
  const { data, error } = await createClient().from("assignments").update(patch).eq("id", id).select("*").single();
  if (error) fail(error);
  return data as unknown as AssignmentRow;
}

export async function deleteAssignment(id: string): Promise<void> {
  const { error } = await createClient().from("assignments").delete().eq("id", id);
  if (error) fail(error);
}

/* --------------------------------------------------------- course resources */
export async function fetchCourseResources(courseIds: string[]): Promise<CourseResourceRow[]> {
  if (courseIds.length === 0) return [];
  const { data, error } = await createClient().from("course_resources").select("*").in("course_id", courseIds).limit(300);
  if (error) fail(error);
  return (data ?? []) as unknown as CourseResourceRow[];
}

export async function deleteCourseResource(id: string): Promise<void> {
  const { error } = await createClient().from("course_resources").delete().eq("id", id);
  if (error) fail(error);
}

/* ------------------------------------------------------------ notifications */
export async function fetchNotifications(limit = 100): Promise<NotificationRow[]> {
  const { data, error } = await createClient()
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail(error);
  return (data ?? []) as unknown as NotificationRow[];
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await createClient().from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  if (error) fail(error);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await createClient()
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) fail(error);
}

export async function fetchNotificationPreferences(userId: string): Promise<NotificationPreferencesRow | null> {
  const { data, error } = await createClient()
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) fail(error);
  return (data as unknown as NotificationPreferencesRow) ?? null;
}

export async function upsertNotificationPreferences(
  prefs: NotificationPreferencesRow,
): Promise<void> {
  const { error } = await createClient().from("notification_preferences").upsert(prefs, { onConflict: "user_id" });
  if (error) fail(error);
}

/* ------------------------------------------------------------------- groups */
export interface GroupWithRole extends GroupRow {
  role: GroupRole;
}

export async function fetchMyGroups(userId: string): Promise<GroupWithRole[]> {
  const { data, error } = await createClient().from("group_members").select("role, group:groups(*)").eq("user_id", userId);
  if (error) fail(error);
  const rows = (data ?? []) as unknown as { role: GroupRole; group: GroupRow | null }[];
  return rows
    .filter((row) => row.group !== null)
    .map((row) => ({ ...(row.group as GroupRow), role: row.role }));
}

export async function createGroup(name: string, userId: string): Promise<GroupRow> {
  const { data, error } = await createClient().from("groups").insert({ name, created_by: userId }).select("*").single();
  if (error) fail(error);
  return data as unknown as GroupRow;
}

export async function joinGroupByInvite(invite: string): Promise<string> {
  const { data, error } = await createClient().rpc("join_group_by_invite", { invite });
  if (error) fail(error);
  return data as unknown as string;
}

export async function fetchGroupMembers(groupId: string): Promise<(GroupMemberRow & { display_name: string | null })[]> {
  const { data, error } = await createClient()
    .from("group_members")
    .select("*, profile:profiles(display_name)")
    .eq("group_id", groupId)
    .order("joined_at");
  if (error) fail(error);
  const rows = (data ?? []) as unknown as (GroupMemberRow & { profile: { display_name: string | null } | null })[];
  // profiles is self-select only; other members' names are intentionally null.
  return rows.map((row) => ({ ...row, display_name: row.profile?.display_name ?? null }));
}

export async function setMemberRole(groupId: string, userId: string, role: GroupRole): Promise<void> {
  const { error } = await createClient().rpc("set_group_member_role", {
    target_group: groupId,
    target_user: userId,
    target_role: role,
  });
  if (error) fail(error);
}

export async function removeMember(groupId: string, userId: string): Promise<void> {
  const { error } = await createClient().from("group_members").delete().eq("group_id", groupId).eq("user_id", userId);
  if (error) fail(error);
}

/** Shared SCHEDULE only. This function never queries attendance_records. */
export async function fetchGroupEvents(groupId: string): Promise<CalendarEventRow[]> {
  const { data, error } = await createClient()
    .from("calendar_events")
    .select("*")
    .eq("group_id", groupId)
    .order("starts_at")
    .limit(500);
  if (error) fail(error);
  return (data ?? []) as unknown as CalendarEventRow[];
}

export async function setEventVerification(
  eventId: string,
  status: VerificationStatus,
  actorId: string,
): Promise<void> {
  const { error } = await createClient()
    .from("calendar_events")
    .update({ verification_status: status, updated_by: actorId, updated_at: new Date().toISOString() })
    .eq("id", eventId);
  if (error) fail(error);
}

export async function fetchPolls(groupId: string): Promise<CalendarPollRow[]> {
  const { data, error } = await createClient()
    .from("calendar_polls")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) fail(error);
  return (data ?? []) as unknown as CalendarPollRow[];
}

export async function createPoll(input: {
  group_id: string;
  created_by: string;
  title: string;
  options: string[];
  closes_at?: string | null;
}): Promise<CalendarPollRow> {
  const { data, error } = await createClient()
    .from("calendar_polls")
    .insert({ ...input, options: input.options as never })
    .select("*")
    .single();
  if (error) fail(error);
  return data as unknown as CalendarPollRow;
}

export async function fetchPollVotes(pollIds: string[]): Promise<CalendarPollVoteRow[]> {
  if (pollIds.length === 0) return [];
  const { data, error } = await createClient().from("calendar_poll_votes").select("*").in("poll_id", pollIds);
  if (error) fail(error);
  return (data ?? []) as unknown as CalendarPollVoteRow[];
}

export async function votePoll(pollId: string, userId: string, optionIndex: number): Promise<void> {
  const { error } = await createClient()
    .from("calendar_poll_votes")
    .upsert({ poll_id: pollId, user_id: userId, option_index: optionIndex }, { onConflict: "poll_id,user_id" });
  if (error) fail(error);
}

/* ---------------------------------------------------------------- documents */
const BUCKET = "academic-documents";

export async function uploadDocument(
  userId: string,
  semesterId: string | null,
  file: File,
  kind: DocumentKind,
): Promise<DocumentUploadRow> {
  const check = validateUpload({ name: file.name, size: file.size, type: file.type });
  if (!check.ok) throw new DataError(check.error);
  if (file.size > MAX_DOCUMENT_BYTES) throw new DataError("File is larger than 10 MB.");

  const supabase = createClient();
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const objectName = `${userId}/${random}.${check.extension}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(objectName, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (uploadError) fail(uploadError);

  const { data, error } = await supabase
    .from("document_uploads")
    .insert({
      owner_id: userId,
      semester_id: semesterId,
      storage_path: objectName,
      file_name: file.name.slice(0, 200),
      mime_type: file.type || null,
      document_kind: kind,
      extraction_status: "uploaded",
    })
    .select("*")
    .single();
  if (error) fail(error);
  return data as unknown as DocumentUploadRow;
}

export async function fetchDocuments(semesterId: string | null): Promise<DocumentUploadRow[]> {
  let query = createClient().from("document_uploads").select("*").order("created_at", { ascending: false }).limit(100);
  if (semesterId) query = query.eq("semester_id", semesterId);
  const { data, error } = await query;
  if (error) fail(error);
  return (data ?? []) as unknown as DocumentUploadRow[];
}

export async function updateDocumentExtraction(
  id: string,
  status: DocumentUploadRow["extraction_status"],
  extractedData?: Json | null,
): Promise<void> {
  const { error } = await createClient()
    .from("document_uploads")
    .update({ extraction_status: status, extracted_data: (extractedData ?? null) as never })
    .eq("id", id);
  if (error) fail(error);
}

export async function documentSignedUrl(storagePath: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await createClient().storage.from(BUCKET).createSignedUrl(storagePath, expiresIn);
  if (error) fail(error);
  return data.signedUrl;
}

export async function deleteDocument(row: DocumentUploadRow): Promise<void> {
  const supabase = createClient();
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([row.storage_path]);
  if (storageError) fail(storageError);
  const { error } = await supabase.from("document_uploads").delete().eq("id", row.id);
  if (error) fail(error);
}

/* ------------------------------------------------------------------ helpers */
export function client(): Client {
  return createClient();
}
