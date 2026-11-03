# Backend Mapping

The mobile app uses the **existing** Supabase schema (`supabase/migrations/0001_attendly_core.sql`) without modification. Project ref `gavlxbxgxdormbfhtzlo` (ap-south-1, PG17), verified live and read-only on 2026-11-03. All 19 tables have RLS enabled.

## Screen → table → API

| Area | Tables / RPCs | API module | Notes |
| --- | --- | --- | --- |
| Auth | `auth.users`, `profiles` | `supabase/auth.ts`, `api/profile.ts` | Email confirmation required; min password 6; `handle_new_user` trigger creates the profile |
| Onboarding | `semesters`, `courses`, `timetable_rules`, `academic_days`, `calendar_events` | `api/semesters.ts`, `api/courses.ts`, `services/import.ts` | CSV import + manual review; sessions generated client-side |
| Calendar | `calendar_events`, `academic_days`, `timetable_rules` | `api/events.ts`, `api/courses.ts` | Recurring rules ≠ dated sessions; day kinds drive badges |
| Attendance | `attendance_records`, `calendar_events` | `api/attendance.ts`, `lib/attendance/engine.ts` | Owner-private; unique `(user_id, event_id)` |
| Courses | `courses`, `timetable_rules`, `course_resources` | `api/courses.ts` | Per-course target + calculation mode |
| Groups | `groups`, `group_members`, `calendar_events`, `calendar_polls`, `calendar_poll_votes` | `api/groups.ts` | `join_group_by_invite`, `set_group_member_role`, `is_group_member`, `can_manage_group` RPCs |
| Assignments | `assignments` | `api/assignments.ts` | No `priority` column → SQLite overlay (see proposed additions) |
| Exams | `calendar_events` (`kind='exam'`) | `api/events.ts` | Exams are events, not a separate table |
| Notes | **local only** (SQLite `notes`) | `database/notes.ts` | No backend notes table (see proposed additions) |
| Documents | `document_uploads`, storage bucket `academic-documents` | `api/documents.ts` | Private bucket, path `<uid>/<name>`, signed URLs 1h |
| Notifications | `notification_preferences`, `notifications` | `api/notifications.ts`, `services/notifications.ts` | Local scheduling; `push_subscriptions` is web-push shaped |
| Analytics | `attendance_records`, `calendar_events`, `courses` | `api/attendance.ts`, `services/reports.ts` | CSV + PDF via native share |
| Snapshots | `semester_snapshots` | `api/semesters.ts` | Stored JSON snapshots |

## RLS facts that shaped the UI

- **`profiles` is SELF-select only.** Other group members' `display_name` resolves to `null` (not an error). The UI renders a "Classmate" fallback. This is expected, not a bug.
- **`attendance_records` is owner-private.** Group views never query or display another member's attendance. Shared group schedules come from `calendar_events` with a `group_id`.
- **Group management** goes through the security-definer RPCs (`set_group_member_role`, etc.) so role checks happen server-side.
- **Storage** bucket `academic-documents` is private; uploads are scoped to `<auth-uid>/…` and read via short-lived signed URLs.

## Enums (mirror in `src/types/database.ts`)

- `attendance_status`: present / absent / excused / unmarked
- `class_status`: scheduled / cancelled / rescheduled / completed
- event `kind`: class / exam / holiday / deadline / other
- `academic_day_kind`: instructional / non_instructional / holiday / exam / closure / special_working
- `group_role`: owner / admin / member

## Realtime

Subscribed tables (6): `calendar_events`, `attendance_records`, `group_members`, `calendar_polls`, `calendar_poll_votes`, `notifications`. Subscriptions invalidate React Query keys; group screens use `subscribeToGroup`.

## Auth configuration (live)

- Email confirmation **ON**, minimum password length **6**, email rate limit **2/hour**.
- `site_url` is `http://localhost:3000` (web dev — **not** changed by this agent).
- `uri_allow_list` was **empty**; the mobile redirect URLs (`attendly://auth/callback`, `attendly://auth/reset-password`) must be present for email links to open the app. See [`BUILD.md`](BUILD.md) → Deep links and the progress log for the additive change made.
