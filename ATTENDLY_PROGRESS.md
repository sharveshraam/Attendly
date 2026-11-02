# Attendly — build progress and next-agent handoff

Last updated: 2026-11-03 (Asia/Kolkata)

## User direction

- Build the website first; mobile app work comes later.
- Use `MASTER_BUILD_PROMPT.md` and the supplied starter ZIP as the brief and base.
- Publish the project in a new public GitHub repository under `sharveshraam`.
- Finish the Supabase foundation and connect the applicable website code.
- Keep this handoff current and push it with each meaningful milestone so another agent can continue.
- The synced project `sources/` directory is read-only. It has not been edited.

## Current verified state

### GitHub

- Public repository: [sharveshraam/Attendly](https://github.com/sharveshraam/Attendly)
- Default branch: `main`.
- Most recent previously verified project push: [`40569d0`](https://github.com/sharveshraam/Attendly/commit/40569d080bc2d9df6aa8fb03de4ae81f3ee43cb9). This handoff and the latest Supabase environment-variable compatibility update are being pushed now; update this entry with the new commit SHA after the push.
- `.env.local` is ignored and excluded from repository commits and the hosting ZIP. Never check in the publishable key, database password, service-role secret, or other private credential.

### Supabase project

- The user chose project creation in the `Sharvesh Ram` organization and explicitly confirmed the final creation action.
- Project: `Attendly`; ref `gavlxbxgxdormbfhtzlo`; Mumbai (`ap-south-1`); Free plan; Nano compute.
- Dashboard: <https://supabase.com/dashboard/project/gavlxbxgxdormbfhtzlo>
- Project API URL: `https://gavlxbxgxdormbfhtzlo.supabase.co`
- Supabase Data API is enabled; automatic table exposure is disabled; automatic RLS is on.
- The generated database password is held by Supabase and was not retrieved or copied here. No service-role key was retrieved.
- The project publishable key is configured locally in ignored `attendly/.env.local`, alongside the URL. It is not written into this public Markdown or committed. If another agent needs it locally, inspect the ignored file without printing or sharing the secret. For deployment, add the same two `NEXT_PUBLIC_SUPABASE_*` values as hosting-provider environment variables.
- `lib/supabase/client.ts` and `lib/supabase/server.ts` use the project URL and prefer `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, while retaining compatibility with `NEXT_PUBLIC_SUPABASE_ANON_KEY`. `.env.example` documents the publishable-key variable.

### Database migration and live checks

- `supabase/migrations/0001_attendly_core.sql` was loaded in the project's SQL Editor and executed successfully (`Success. No rows returned`).
- Live read-only catalog checks after migration found **19 public tables and all 19 have RLS enabled**.
- Storage verification found the `academic-documents` bucket and confirmed `public = false`.
- Realtime verification found all six intended tables in `supabase_realtime`: `calendar_events`, `attendance_records`, `group_members`, `calendar_polls`, `calendar_poll_votes`, and `notifications`.
- Migration establishes the core academic, timetable/calendar, attendance, assignments/resources, group collaboration, polls, notifications, and audit/history tables; membership/ownership helpers and RPCs; scoped RLS policies; private Storage policies; and Realtime publication membership. Review the SQL before extending the data model.
- Security choices: private attendance is owner-scoped; group creation assigns its creator the owner role; invite joining uses a controlled RPC that only grants member; role changes are constrained; calendar changes in shared groups require owner/admin approval; group-linked semester and academic content writes are scoped; private document paths require the authenticated user ID in the first folder.

## Website and code delivered so far

- Extracted the supplied Next.js App Router / TypeScript / Tailwind / Supabase SSR starter into `attendly-app/attendly/`; the original archive and synced sources were not changed.
- Replaced the starter placeholder with a responsive dashboard showing real, RLS-filtered Supabase data when a user and semester exist: latest semester, course count, scheduled future class count, and confirmed attendance percentage. Explicit empty/setup states are used; sample metrics are not fabricated.
- Added responsive navigation, overview cards, privacy copy, search dialog, setup prompts, sign-in/sign-up links, and mobile layout.
- Starter email/password login and registration pages remain. Account recovery, logout, and full authenticated navigation flows still need finishing.
- Added deterministic attendance calculations in `lib/attendance-engine.js` and six unit cases in `tests/attendance-engine.test.js`. All six passed using Node's built-in runner through the available JS runtime. Native `npm` is unavailable here, so `npm test`, dependency installation, lint, and Next production build have not run.
- Updated `README.md` and `FEATURES.md` to distinguish implemented screens from planned product scope.

## Current limits and next steps

1. Continue the website: reliable sign-up/login/session redirect, logout and recovery, semester/course creation, real calendar and attendance workflows, assignments, settings, loading/error handling, and accessibility review. Keep all database access behind RLS and avoid fake-success UI.
2. Review migration details against the product requirements and run realistic authenticated-user tests (including two users in different groups) before launch. Catalog checks verify RLS is enabled, not every policy's behavior.
3. Install dependencies / run lint, `npm test`, and a production build in an environment with Node/npm, then fix any issues. The attendance-engine tests already passed independently; the website bundle remains unbuilt.
4. Push this handoff and latest code/environment-name changes to GitHub. Record the resulting commit SHA below.
5. Produce the requested hosting ZIP from the complete source, excluding `.env.local`, `node_modules`, `.next`, and credentials. Include setup instructions and the migration.
6. Deployment has not been attempted; no hosting integration is connected. Do not describe the current partial website as production-ready.

## Latest push log

- Pending at this update: push of the corrected handoff plus Supabase publishable-key variable support. Add commit SHA and verification result after push.

## Handoff rules

- Read this file, `FEATURES.md`, and `README.md`; inspect the working tree before continuing.
- Preserve `sources/` as read-only.
- Update this file after meaningful implementation, verification, external-service, and GitHub push milestones.
- Keep secrets out of public repository files and chat. Supabase publishable keys are browser-safe by design but still must not be copied into this public handoff; service-role/database credentials are strictly private.
- State only what was implemented and verified. Keep the current website scope and remaining work clear.

