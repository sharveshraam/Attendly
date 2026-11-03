# Attendly

Attendly is a responsive academic companion starter built with Next.js, TypeScript and Supabase. The architecture is designed for a full-featured attendance, calendar, collaboration and student productivity product.

## Current website status (2026-11-03)

The website is now a full Next.js 16 App Router application at the repository
root, sharing the **existing live Supabase project** with the deployed Android
app. It includes the public site, email/password auth and recovery, onboarding,
dashboard, calendar/timetable upload with human review, attendance tools,
courses, groups (schedule-only sharing), productivity, analytics/exports,
notifications, a deterministic on-device assistant, settings, and an installable
PWA with an offline outbox and conflict handling. The original starter files are
preserved; `app/web.css` is the active stylesheet. The identity is **Obsidian
Academic** — a dark-first, token-driven system with one muted-teal accent, Inter
typography, crisp 1px borders and subtle screen fades across every screen,
chart, icon and offline asset. No legacy accent colour remains in source
or the built bundle.

Verified: `npm run typecheck`, `npm run lint`, `npm test` (83/83),
`npm run build`, `npm audit --omit=dev` (0 vulnerabilities) and HTTP/header
smoke checks. The local frontend is linked to the live Supabase project through
the ignored `.env.local`, and the owner-approved additive Auth redirect
allow-list now covers the Arena and Vercel preview origins (`site_url` and every
other Auth setting unchanged). No migration, schema, RLS, Storage or Edge
Function change was made; `0002_restore_authenticated_grants.sql` restores the
missing `authenticated` table grants (RLS and all 42 policies intact), which
fixes `permission denied for table …` on every page in both web and mobile.
Vercel deployments of this branch are `READY` at
`https://attendly-web-cosmic-7aae.vercel.app` and the preview URL
`https://attendly-mmqleg474-cosmic-7aae.vercel.app` (Vercel SSO Deployment
Protection is on, so a Vercel login is required). No custom domain, DNS change,
`main` merge or production data test was performed.

Start here: `docs/SETUP.md`, `docs/TESTING.md`, `docs/DEPLOYMENT.md`. Architecture,
decisions, limits and handoff: `ARCHITECTURE.md`, `TECH_DECISIONS.md`,
`KNOWN_ISSUES.md`, `AGENT_HANDOFF.md`, `SECURITY.md`, `CHANGELOG.md`,
`ATTENDLY_PROGRESS.md` (section "Website Development Progress").

> The older "Implemented in the current website" paragraph below describes the
> original starter and is superseded by this section.

## Hosting recommendation

- **Frontend:** Vercel (Next.js)
- **Backend:** Supabase (Postgres, Auth, Storage, Realtime)
- **Why:** Supabase removes the need to operate a separate API/database server for the core product. Vercel is a natural fit for Next.js.

## Supabase setup

The Attendly project has been created in Supabase in the Mumbai region. Its project reference and dashboard link are recorded in `ATTENDLY_PROGRESS.md`. The publishable key and API URL belong in `.env.local`, which is ignored by Git. Never put a service-role key or database password in client code or this public repository.

1. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` plus `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the project's API URL and publishable key. The existing local workspace already has these values in its ignored `.env.local`.
2. Apply `supabase/migrations/0001_attendly_core.sql` once in the project's SQL Editor or through the Supabase CLI. It creates the core schema, RLS policies, private `academic-documents` bucket, membership RPCs, and Realtime publication entries.
3. In Supabase Auth settings, set the local site URL to `http://localhost:3000` and add local plus production callback URLs before enabling sign-in on a hosted domain.
4. Apply `supabase/migrations/0002_restore_authenticated_grants.sql` once. It grants SELECT/INSERT/UPDATE/DELETE on the public tables to `authenticated` (already applied to the live project). Without it PostgREST returns `permission denied for table …` before RLS is evaluated — this was the cause of the same error on the website and in the mobile app.
5. Confirm every exposed table has RLS enabled and test a second user cannot read personal attendance or documents before adding real student data.

## Run locally

Requires Node.js 22+.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

## Deploy to Vercel

1. Push this project to a GitHub repository.
2. Import the repository into Vercel.
3. Add the same environment variables in Vercel Project Settings.
4. Deploy.
5. Add the Vercel production URL to Supabase Auth's allowed URLs.

## Product scope

The database foundation includes:
- Email/password auth profile records
- Semesters, courses, recurring timetable rules
- Instructional/non-instructional day classification
- Shared calendar events and schedule change history
- Private per-user attendance records
- Group workspaces, memberships, polls and votes
- Timetable/calendar document metadata and extraction review state
- Assignments, course resources and semester snapshots
- Notification preferences, notification inbox and push subscriptions

Implemented in the current website: a Supabase-aware overview, responsive dashboard navigation, explicit setup states, and deterministic attendance calculations with unit cases. Calendar import, document extraction, group approval UI, PWA/offline work, reports, AI, notifications, and most scheduling/productivity screens remain future work.

See `ATTENDLY_PROGRESS.md` for current status and next steps. This project is not yet a complete production application.

## Security model

- Attendance rows are user-owned and have private RLS policies.
- Group calendar events are separate from attendance rows.
- Group membership controls access to shared schedules.
- No service-role key is used in browser code.
- Review and test RLS policies before storing real student data.

