# Attendly

Attendly is a responsive academic companion starter built with Next.js, TypeScript and Supabase. The architecture is designed for a full-featured attendance, calendar, collaboration and student productivity product.

## Hosting recommendation

- **Frontend:** Vercel (Next.js)
- **Backend:** Supabase (Postgres, Auth, Storage, Realtime)
- **Why:** Supabase removes the need to operate a separate API/database server for the core product. Vercel is a natural fit for Next.js.

## Supabase setup

The Attendly project has been created in Supabase in the Mumbai region. Its project reference and dashboard link are recorded in `ATTENDLY_PROGRESS.md`. The publishable key and API URL belong in `.env.local`, which is ignored by Git. Never put a service-role key or database password in client code or this public repository.

1. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` plus `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the project's API URL and publishable key. The existing local workspace already has these values in its ignored `.env.local`.
2. Apply `supabase/migrations/0001_attendly_core.sql` once in the project's SQL Editor or through the Supabase CLI. It creates the core schema, RLS policies, private `academic-documents` bucket, membership RPCs, and Realtime publication entries.
3. In Supabase Auth settings, set the local site URL to `http://localhost:3000` and add local plus production callback URLs before enabling sign-in on a hosted domain.
4. Confirm every exposed table has RLS enabled and test a second user cannot read personal attendance or documents before adding real student data.

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

