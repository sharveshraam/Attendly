# Attendly — feature status

## Implemented so far

- Responsive light-theme overview dashboard with explicit empty and setup states.
- Supabase SSR email/password sign-in and sign-up starter flows.
- Dashboard summary reads the latest semester, course count, future scheduled events, and the signed-in user's own marks when configured.
- Deterministic attendance calculations for class-count and hour-based inputs; unmarked and excused classes are not treated as absences.
- Core SQL schema for semesters, courses, recurring timetable rules, shared events, personal attendance, groups, assignments, resources, documents, notifications, polls, and snapshots.
- Private attendance RLS, group membership helpers/RPCs, proposal trust states, private document-storage policies, and Realtime publication setup are defined in the migration. The migration still needs to be applied and verified on the new project.

## Not implemented yet

Document extraction/OCR, editable import review, semester/course setup UI, calendar and attendance screens, recurrence generation, calendar editing/history, group invitations and approval UI, assignments/exam planner UI, reports and exports, AI assistant, push notifications, PWA/offline synchronization, settings and account lifecycle workflows, and Vercel deployment.

The product must preserve this invariant: shared schedule data is separate from private personal attendance. See `ATTENDLY_PROGRESS.md` for concrete handoff details.

