# Attendly website — Phase 0 repository & backend audit

Performed 2026-11-03 on branch `arena/6fedf57b-attendly` (branched from `main` @ `ef2647f`). Read-only with respect to the live Supabase project.

## What actually exists

| Area | Finding |
| --- | --- |
| Branches | `main` (= `ef2647f`), `attendly-website-supabase-foundation` (= `ef2647f`), `arena/7b693859-attendly` (mobile app, 9 commits ahead). This session's branch `arena/6fedf57b-attendly` is based on `main` and contains **no** `apps/mobile/`. |
| Root web app | A **root-level Next.js 16 / React 19 / TypeScript** starter already exists: `app/`, `components/`, `lib/`, `supabase/migrations/`, `tests/`, `package.json`, `proxy.ts`. It is not under `apps/web/`. |
| Existing web functionality | Landing/dashboard hybrid at `app/page.tsx` + `components/dashboard.tsx` (Supabase-aware counts, real RLS-filtered reads), login/signup pages, `lib/supabase/{client,server}.ts`, `lib/attendance-engine.js`, 6 passing unit tests, `proxy.ts` session refresh. No Tailwind dependency is installed even though `app/globals.css` imports it. |
| Documentation | `ATTENDLY_PROGRESS.md`, `README.md`, `FEATURES.md`, `MASTER_BUILD_PROMPT.md`. No `ARCHITECTURE.md`, `TECH_DECISIONS.md`, `KNOWN_ISSUES.md`, `AGENT_HANDOFF.md`, `CHANGELOG.md`, `SECURITY.md` on this branch. |
| Mobile app | Exists only on `arena/7b693859-attendly` (Expo SDK 58, 147 files). Its docs (`BACKEND_MAPPING.md`, `PROPOSED_BACKEND_ADDITIONS.md`) and source were read via `git show` to derive the exact data contract. **Not copied, not modified, not merged.** |
| Supabase project | `gavlxbxgxdormbfhtzlo`, `ap-south-1`, PG 17.11, ACTIVE_HEALTHY. One project only. |

## Live backend verification (read-only SQL catalog queries)

- **19 public tables**, all with `relrowsecurity = true`, 1–4 policies each. Column list matches `supabase/migrations/0001_attendly_core.sql` exactly — no extra `notes` table, no `assignments.priority`, no Expo push columns.
- Private Storage bucket `academic-documents` (`public = false`).
- Realtime publication contains exactly 6 tables: `attendance_records`, `calendar_events`, `calendar_poll_votes`, `calendar_polls`, `group_members`, `notifications`.
- **No Edge Functions exist** → no OCR/extraction service, no AI service, no push sender.
- Auth config: email/password ON, email confirmation ON (`mailer_autoconfirm=false`), min password length **6**, `site_url=http://localhost:3000`, allow-list `http://localhost:3000/**,attendly://auth/callback,attendly://auth/reset-password`, email rate limit 2/hour, signup enabled.
- **2026-11-03 update (owner-approved, additive):** the allow-list was extended with the Arena live-preview origin and Vercel preview aliases while preserving all three original entries. Re-read via `get_auth_config` confirmed `site_url`, rate limits, captcha, SMTP, providers, MFA and all other fields unchanged. No other Auth setting changed.
- **2026-11-03 permission defect found and fixed (owner-requested):** all 19 tables had RLS enabled and 42 `authenticated` policies, but the `postgres` default ACL was `anon=Dxtm, authenticated=Dxtm, service_role=Dxtm` — the `arwd` (SELECT/INSERT/UPDATE/DELETE) bits were missing. PostgREST therefore returned `permission denied for table semesters` on every page **before RLS was evaluated**, in both the website and the mobile app (same project). `supabase/migrations/0002_restore_authenticated_grants.sql` grants
SELECT/INSERT/UPDATE/DELETE on all public tables and sequences to
`authenticated` and repairs the `postgres` default ACL for future tables.
RLS stays enabled, all 42 policies are unchanged. Verified by simulating an `authenticated` session with a JWT: reads returned only the caller's own rows, and rolled-back writes succeeded across semesters, courses, events, attendance, assignments, groups, polls, votes, resources, uploads, rules, academic days, change log, notifications, preferences and push subscriptions.
- **2026-11-03 follow-up (owner-requested "clear everything in supabase"):** the first pass left `anon` and `service_role` at `Dxtm`, so anonymous requests still got `permission denied` instead of an empty RLS result and `service_role` could not operate on any table. `supabase/migrations/0003_restore_standard_api_role_grants.sql` (Supabase migration `20261103104600_restore_standard_api_role_grants`) restores the standard baseline `postgres=arwdDxtm, anon=arwdDxtm, authenticated=arwdDxtm, service_role=arwdDxtm` for tables and `rwU` for sequences — identical to this project's `supabase_admin` default ACL — on all current and future public objects. Live re-verification: 19/19 tables with all 4 DML privileges for all 3 roles, 0 RLS-off, 42 public + 4 Storage policies, `SET LOCAL ROLE anon` → 0 rows with no error, random `authenticated` UID → 0 rows, real UID → 1 own profile, `service_role` → queries succeed. Migration history now has exactly two entries (`20261103103452_restore_authenticated_table_grants`, `20261103104600_restore_standard_api_role_grants`). Realtime publication still has 6 tables; the `on_auth_user_created` trigger is enabled; Storage has 1 private bucket and 0 objects; no Edge Functions. **Row census: 1 `auth.users`, 1 `public.profiles`, 0 rows in the other 18 public tables. Nothing was deleted.**
- Existing RPCs: `join_group_by_invite(text)`, `set_group_member_role(uuid,uuid,group_role)`, `is_group_member(uuid)`, `can_manage_group(uuid)`. Trigger `handle_new_user` creates `profiles`.
- RLS facts that constrain the UI: `profiles` is self-select only (other members' names resolve to `null`); `attendance_records` is strictly `user_id = auth.uid()`; group schedules are `calendar_events` rows with `group_id` on a group-linked semester; `assignments`/`course_resources` are owner-only and require an owner-owned semester; `document_uploads` path must start with `<uid>/`.

## Data contract the website must honour

- `semesters` → `courses` → `timetable_rules` (weekly templates, `weekday` 0=Sun..6=Sat, `time` columns) → `calendar_events` (dated sessions, `timestamptz`, `kind`, `status`, `verification_status`).
- Attendance semantics (mobile `src/lib/attendance/engine.ts`, compatible with web `lib/attendance-engine.js`): denominator = present + absent; `excused` conducted but excluded; `unmarked` never in denominator; `cancelled`/`rescheduled` originals excluded so a reschedule counts once at its replacement; extra classes are ordinary dated sessions; hours mode uses event duration / `attended_minutes`; bunk & recovery use epsilon-safe floor/ceil; 100% target becomes unrecoverable after a miss.
- Recurrence expansion honours `academic_days` kinds `holiday|non_instructional|closure|exam` and rule validity windows; idempotent via `courseId|startsAt` keys; revised timetables are diffed by course+weekday+start time.
- Exams are `calendar_events(kind='exam')`; deadlines are assignments/events; notes are **local-only** (no backend table); assignment priority is **not** a column.
- Group privacy is enforced in RLS, not the UI: never query `attendance_records` in a group context.

## Decisions

1. **Keep the website at repository root.** A Next.js App Router app is already established there; creating `apps/web/` would duplicate it and break the existing `proxy.ts`/`tsconfig` paths. The mobile app remains isolated on its own branch. Documented in `TECH_DECISIONS.md`.
2. **No database, migration, RLS, auth, storage, or Edge Function changes.** All web writes go through the browser Supabase client with the publishable key and are constrained by existing RLS. No service-role key anywhere.
3. **No invented endpoints.** Missing OCR/AI/push/notes/priority backends are handled with honest local equivalents (CSV import + human review, deterministic on-device assistant, local notes, local reminders) and documented as limitations.
4. **Preserve existing files.** `lib/attendance-engine.js`, `tests/attendance-engine.test.js`, `lib/supabase/*`, `components/dashboard.tsx` and `app/globals.css` remain. The legacy dashboard's real-data overview behaviour is carried forward into the new `/home` dashboard.
5. **Deployment:** Vercel project + preview deployment from this branch. Production promotion still requires explicit owner approval; the additive Supabase auth redirect URL change was approved and applied (see above).

## Outstanding risks to document, not to "fix" destructively

- Preview origins are now in the auth allow-list, so email confirmation and recovery links can target the Arena/Vercel preview. `site_url` is still `localhost:3000`; a production `site_url` change and production promotion remain owner-approval gated. Live confirmation/reset round trips are still unverified pending a disposable test account.
- Email rate limit is 2/hour; live auth integration tests against production would create real accounts. Tests therefore use pure logic + mocked data layers; live user-flow verification is documented as not run.
- There is no server-side account-deletion RPC. The website will offer data export and a clear, honest unsupported-state explanation rather than a fake delete button.
