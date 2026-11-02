# MASTER BUILD PROMPT — ATTENDLY

You are the senior full-stack engineering team responsible for completing Attendly, a production-grade, responsive academic companion SaaS.

Do not reduce scope. Implement every feature in this specification. Work autonomously, inspect the existing codebase first, make changes directly, run tests/builds, fix errors, and provide the final deployable project. Do not ask the user to write code or SQL. Ask only for credentials or account authorization that cannot safely be created on their behalf. Never request passwords or service-role keys in chat.

## Technology and deployment
- Next.js App Router + TypeScript, responsive PWA.
- Supabase Postgres, Auth email/password, Storage, Realtime, RLS.
- Vercel hosting.
- Use current official Supabase docs for SSR cookie handling and current Next.js conventions.
- Pin dependencies and commit lockfile.
- Never expose service-role/secret keys to browser bundles.
- Every public-schema table must have RLS and least-privilege policies.
- Verify all migrations and policies; test user A cannot read user B attendance.

## Product principle
A shared group shares its timetable/calendar only. Each student's attendance, bunk calculations, notes, personal reminders and history remain private unless the student explicitly shares them.

## Complete feature scope — implement ALL

### 1. Accounts and workspaces
- Email/password signup, login, logout, password reset, email confirmation.
- Profile, timezone, account export and deletion.
- Individual workspace and multiple group workspaces.
- Invite links/codes, membership roles (owner/admin/member), join/leave, revoke invites.
- Group permissions, moderation, audit trail, group activity feed.
- Group polls and approval workflow for proposed schedule changes.
- Shared schedule only; no automatic sharing of personal attendance.

### 2. Semester and academic configuration
- Multiple semesters and archived semester history.
- Semester start/end dates; unknown end date rolling mode.
- Per-course attendance thresholds and calculation modes (class count or hours).
- Course types: theory, lab, practical, tutorial, seminar, exam.
- Academic day classifications: instructional, non-instructional, holiday, exam, closure, special working.
- Special Saturdays and institution-specific working-day rules.
- Timezone-aware schedules and daylight/time handling.

### 3. Document ingestion
- Upload timetable and academic calendar in PDF, image, CSV, XLSX.
- OCR/document extraction with AI provider behind server-side adapter.
- Extract course names/codes, weekdays, slots, dates, holidays, instructional days, exam windows, semester boundaries.
- Always show a human review screen before committing extracted data.
- Confidence indicators, corrections, duplicate detection and source provenance.
- Upload a revised calendar later; diff it against current calendar and propose changes without overwriting approved events.
- Keep original documents in private per-user storage paths with storage RLS.

### 4. Calendar and scheduling
- Day/week/month/agenda/semester views.
- Recurring timetable rules expanded into actual dated events.
- Drag-and-drop move/reschedule, add extra class, cancel, replace, edit and delete.
- Recurring exceptions and date-range exceptions.
- Special working days and holidays override normal recurrence appropriately.
- Conflict detector for overlapping events, duplicate sessions and impossible times.
- Compare original timetable to actual schedule.
- Event provenance: recurring rule, manual, imported, AI proposal.
- Verification states: proposed, unverified, confirmed, rejected.
- Undo/redo and calendar version snapshots.
- ICS import/export and Google Calendar integration-ready adapter.
- Exams, practicals, assignments and deadlines.
- Group change feed and per-member notifications.

### 5. Attendance engine
- Mark present, absent, excused, or leave unmarked.
- Never silently convert unmarked to absent.
- Only completed/conducted eligible classes enter the denominator.
- Cancelled events are excluded.
- Extra classes count when conducted.
- Rescheduled event must not double-count.
- Class-count and duration/hour-based policies.
- Per-course percentage, total attended, total conducted, absences, excused, unmarked.
- Minimum attendance configurable per course.
- Maximum safe additional absences.
- Classes/hours required to recover to target.
- Forecast through semester end or rolling estimate when end date unknown.
- Clearly distinguish confirmed totals from estimates.
- Explain calculations and rounding.
- Handle zero denominators, 100% targets, impossible targets, cancelled classes and policy changes safely.
- Attendance history and correction audit trail.

### 6. What-if simulator and planning
- Simulate absences, extra classes, holidays, reschedules and new working days.
- Simulations never mutate actual calendar or attendance.
- Compare baseline vs scenario by course and semester.
- Save named scenarios privately.
- Recovery planner with upcoming class dates and attendance outcomes.
- Conservative, expected and optimistic forecasts, with assumptions visible.

### 7. Analytics
- Course risk ranking based on threshold margin and future schedule, not percentage alone.
- Attendance heatmap.
- Weekly/monthly/semester trends.
- Course comparison.
- Attendance forecast charts and scenario comparisons.
- Downloadable PDF and Excel semester reports.
- Multi-semester history and trends.
- Privacy mode to hide sensitive metrics on screen.

### 8. Notifications and PWA
- Installable PWA with manifest, icons and service worker.
- Responsive laptop/tablet/mobile experience.
- Offline shell and offline attendance queue with safe conflict resolution.
- Web push subscriptions and server-side push delivery.
- Daily attendance reminders, schedule changes, cancellations, extra classes, threshold warnings, recovery reminders and assignment deadlines.
- User-configurable categories, quiet hours, timezone and reminder time.
- iOS install-to-home-screen guidance where needed.
- Never promise push delivery when browser permission or platform support is unavailable.

### 9. Student productivity
- Assignment tracker with due dates, status, course association and reminders.
- Exam planner and countdowns.
- Course notes/resources with private storage.
- Weekly insights and study planning.
- Course-specific organization.

### 10. AI academic assistant
- Natural-language questions about timetable, classes, attendance, risks and deadlines.
- Natural-language calendar change proposals.
- AI must call deterministic server-side tools for calculations; never invent percentages or events.
- Ask for confirmation before applying changes.
- Explain source and assumptions.
- Summarize weekly schedule changes.
- Detect revised academic calendar differences.
- AI provider abstraction; API keys server-only; rate limits and usage controls.

### 11. Premium UX
- Beautiful polished dark/light/system themes.
- Responsive dashboard and customizable widgets.
- Command palette (Ctrl/Cmd+K).
- Keyboard shortcuts and quick attendance widget.
- Custom course colors.
- Useful empty/loading/error states.
- Accessible controls and keyboard navigation.
- Fast search across courses, events, notes and assignments.
- Privacy mode.
- Consistent design tokens and mobile navigation.

### 12. Reliability, security and operations
- RLS on every exposed table; explicit grants only where needed.
- Validate authorization server-side for all mutations.
- Group membership checks on every shared resource.
- Private storage buckets and ownership policies.
- Rate limits for invites, AI calls and document uploads.
- Input validation, file type/size limits and safe parsing.
- Audit logs for calendar and attendance edits.
- Backups/export and account deletion workflow.
- Error monitoring and structured logs without sensitive data.
- Unit tests for attendance math and calendar recurrence.
- Integration tests for RLS, groups, and schedule sync.
- End-to-end tests for signup, semester setup, calendar edit and attendance marking.
- Accessibility checks and responsive viewport tests.

## Required delivery
1. Finish the app end-to-end; do not leave dead buttons or fake success states.
2. Implement Supabase schema/migrations and storage policies.
3. Provide `.env.example` with placeholders only.
4. Provide Vercel configuration and deployment documentation.
5. Run typecheck, lint, unit tests and production build; fix failures.
6. Provide a concise feature completion matrix distinguishing implemented, tested and externally configured.
7. Never claim live deployment or cloud project provisioning unless verified.
8. If credentials or cloud account authorization are missing, finish all code/configuration possible and request only the minimum safe account authorization needed.

