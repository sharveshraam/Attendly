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

- Created the public repository [`sharveshraam/Attendly`](https://github.com/sharveshraam/Attendly) after the user selected `sharveshraam` and public visibility. First commit `3028654b3152af4d41f61a5af00ba90b445d8ff2` currently contains only the starter README; the complete reviewed source tree still needs to be pushed.
- User confirmed they already have a Supabase project. The Supabase project-listing tools returned `Unknown tool` and the Supabase namespace was subsequently removed from available tools. No project ID, URL, or key was retrieved, and no database migration was applied remotely.
- Vercel account/authorization is not connected or checked. No deployment has been attempted.
- `npm install` could not run because `npm` is not installed/available in this environment. Consequently no lockfile, build, or automated verification has been produced yet. Do not claim a successful build.

## Important security review findings

- Fixed in `supabase/migrations/0001_attendly_core.sql`: group-membership helper functions now use narrow `SECURITY DEFINER` lookups with an empty fixed search path to avoid recursive RLS evaluation; group creators become owners automatically; invite joining is via authenticated `join_group_by_invite(text)` and inserts only the `member` role; direct member self-enrollment policy was removed.
- Before applying the migration, continue reviewing all RLS policies, storage setup, and relationship checks. In particular, verify group role lifecycle, storage bucket policies, group calendar approvals, and assignment/course ownership constraints.
- The private attendance table is separate from shared calendar data and its policies remain owner-only.

## Remaining work (in order)

1. Finish security review and correct the migration; add private Storage bucket policies and document a safe first-time setup path.
2. Continue building the website: real semester/course setup, calendar and attendance flows, assignment planner, account recovery/logout, settings, and trustworthy empty/loading/error states. Avoid fake success actions or placeholder data.
3. Add deterministic attendance/semester/calendar logic and requested tests. Run tests/build when Node/npm becomes available; record exact outcomes here.
4. Obtain access to the user's existing Supabase project through the Supabase connector or browser session, inspect it before changes, apply migrations, and record the resulting project ID (never secret keys).
5. Push all reviewed project files including this progress file to `sharveshraam/Attendly`, then verify the resulting repository tree and record its commit SHA.
6. Prepare the final hosting ZIP and deployment configuration; deploy only when required account access is available.

## Handoff rules

- Read this file first and then inspect the current tree/diff before continuing; some work may have advanced since this note.
- Preserve `sources/` as read-only.
- Keep this file updated after each meaningful milestone, blocker, service action, test run, and push. Record dates and concrete results, not assumptions.
- Never paste service-role secrets into this document or the chat. Keep only publishable Supabase configuration in client env variables.
- The requested final product is much larger than the current implementation. Describe only features actually built and verified as complete.

