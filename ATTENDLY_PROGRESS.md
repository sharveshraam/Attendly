# Attendly — build progress and handoff

Last updated: 2026-11-03 (Asia/Kolkata)

## User direction

- Build the website first; mobile app work comes later.
- Use the supplied Attendly master prompt and `Attendly-Project-Starter.zip` as the product brief and starting point.
- Create a new **public** GitHub repository in the `sharveshraam` account, then push the completed project.
- Use the user's existing Supabase project. Do not ask for passwords or expose service-role keys.
- Keep this file current so another agent can continue if this run ends early.
- The project's synced `sources/` directory is reference-only; do not modify it.

## Current state

- The starter archive was extracted to `attendly-app/attendly/`; original archive and synced `sources/` were left untouched.
- Starter: Next.js App Router, TypeScript, Tailwind, Supabase SSR auth helpers, and one initial SQL migration.
- Replaced the placeholder dashboard with a responsive Attendly workspace overview. It reads the latest semester, course count, upcoming scheduled class count, and the signed-in user's confirmed attendance marks through Supabase; empty states are explicit and do not invent attendance data.
- Added polished navigation, responsive sidebar, overview cards, privacy messaging, search dialog, getting-started steps, and mobile layout.
- Updated the core migration to avoid recursive group-membership RLS checks, make group creators owners, add a safe invite-code join RPC, and prevent users from assigning themselves elevated group roles.
- Authentication pages remain from the starter (email/password login and signup). The dashboard is usable as an empty state without backend credentials.

## External service status

- Created the public repository [`sharveshraam/Attendly`](https://github.com/sharveshraam/Attendly). The full 21-file project tree is on `main`; commit [`a74fdff`](https://github.com/sharveshraam/Attendly/commit/a74fdff497937134c754ca2bca3057c053754292) contains the dashboard and migration changes. GitHub's commit view verified 20 changed file paths; the original README from the initial commit is unchanged.
- Initial connected organization check showed zero projects. After the user directed and confirmed creation, a new project was created in `Sharvesh Ram` (Free plan), with Data API enabled, automatic table exposure disabled, and automatic RLS enabled. See the verified project details immediately below. No migration has been applied remotely yet.
- User confirmed the final Supabase create action. Project creation succeeded; project ID is `gavlxbxgxdormbfhtzlo`, dashboard URL is `https://supabase.com/dashboard/project/gavlxbxgxdormbfhtzlo`, region is Mumbai, and the dashboard is still initializing. The generated database password is retained only by Supabase and is intentionally not copied into chat, the repo, or this handoff. Next retrieve the project API URL and publishable key from Project Settings; record the URL and public key only in an ignored local `.env.local` (or other private local configuration), not this public repository. Never retrieve or record the service-role key unless an actual server-only integration requires it.
- The project is Healthy and the API URL is `https://gavlxbxgxdormbfhtzlo.supabase.co`. The Supabase publishable key (`sb_publishable_…`) is saved with that URL in ignored local `.env.local`; do not copy it into this public progress file or commit it. No service-role key has been retrieved. Project is empty and no migration has been applied yet.
- Added a deterministic attendance engine (`lib/attendance-engine.js`) and six Node built-in unit cases in `tests/attendance-engine.test.js`; wired `npm test` to `node --test`. All six cases passed with Node's built-in test runner through the available JavaScript runtime. The `npm test` script and Next.js production build remain unrun because Windows reports `npm` is unavailable.
- Tightened shared-event RLS so group events must belong to the group's semester; members can create/update their own unverified/proposed changes while group owners/admins can confirm or reject them. Added Realtime publication membership for shared calendar, private attendance, group membership/polls, and user notifications. Updated README and feature-status documentation to clearly distinguish implemented work from the roadmap.
- Supabase migration is still unapplied. The project dashboard is healthy, but loading the full migration into the SQL Editor through the browser stalled before any query text appeared. No SQL was run and no schema changes have been made to Supabase yet.
- Vercel account/authorization is not connected or checked. No deployment has been attempted.
- `npm install` could not run because `npm` is not installed/available in this environment. Consequently no lockfile, build, or automated verification has been produced yet. Do not claim a successful build.

## Important security review findings

- Fixed in `supabase/migrations/0001_attendly_core.sql`: group-membership helper functions now use narrow `SECURITY DEFINER` lookups with an empty fixed search path to avoid recursive RLS evaluation; group creators become owners automatically; invite joining is via authenticated `join_group_by_invite(text)` and inserts only the `member` role; direct member self-enrollment policy was removed; group admins can add members but cannot assign elevated roles; owners can promote/demote members through a restricted RPC; private Storage bucket policies were added; assignment/resource writes are tied to owned semester/course records.
- Before applying the migration, continue reviewing all RLS policies, storage setup, and relationship checks. In particular, verify group role lifecycle, storage bucket policies, group calendar approvals, and assignment/course ownership constraints.
- The private attendance table is separate from shared calendar data and its policies remain owner-only.

## Remaining work (in order)

1. Finish security review and correct the migration; add private Storage bucket policies and document a safe first-time setup path.
2. Continue building the website: real semester/course setup, calendar and attendance flows, assignment planner, account recovery/logout, settings, and trustworthy empty/loading/error states. Avoid fake success actions or placeholder data.
3. Add deterministic attendance/semester/calendar logic and requested tests. Run tests/build when Node/npm becomes available; record exact outcomes here.
4. `.env.local` contains the verified Supabase URL and publishable key. Inspect project state, apply the reviewed SQL migration to this new empty project, and verify table RLS and private Storage policies.
5. Apply and verify the migration on the empty Supabase project, then test auth, RLS isolation, and Realtime. Avoid running SQL until the whole script is present and reviewed in the editor.
6. Continue website features and create real screens/flows; don't leave navigation as informational notices where a real action is expected.
7. Add deterministic semester/calendar logic and requested tests. Run tests/build when Next/npm is available; record exact outcomes here.
8. Push later security and website updates, including this progress file, to `sharveshraam/Attendly`; verify and record each commit.
9. Prepare the final hosting ZIP and deployment configuration; deploy only when required account access is available.

## Handoff rules

- Read this file first and then inspect the current tree/diff before continuing; some work may have advanced since this note.
- Preserve `sources/` as read-only.
- Keep this file updated after each meaningful milestone, blocker, service action, test run, and push. Record dates and concrete results, not assumptions.
- Never paste service-role secrets into this document or the chat. Keep only publishable Supabase configuration in client env variables.
- The requested final product is much larger than the current implementation. Describe only features actually built and verified as complete.

