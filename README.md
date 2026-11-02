# Attendly

Attendly is a responsive academic companion starter built with Next.js, TypeScript and Supabase. The architecture is designed for a full-featured attendance, calendar, collaboration and student productivity product.

## Hosting recommendation

- **Frontend:** Vercel (Next.js)
- **Backend:** Supabase (Postgres, Auth, Storage, Realtime)
- **Why:** Supabase removes the need to operate a separate API/database server for the core product. Vercel is a natural fit for Next.js.

## Supabase-first setup

1. Create a Supabase project in your account.
2. Open **SQL Editor** in the Supabase dashboard.
3. Run `supabase/migrations/0001_attendly_core.sql`.
4. In **Project Settings → API**, copy the Project URL and publishable/anon key.
5. Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
6. In Supabase Auth settings, configure the site URL and allowed redirect URLs for localhost and your eventual Vercel domain.
7. Create a private Storage bucket named `academic-documents`. Add policies restricting each user's folder to their own auth UID before enabling uploads.

**Important:** This package cannot create a Supabase cloud project inside your account without an authorized Supabase connection. Never share your account password or service-role key in chat. The service-role key must remain server-only.

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

The roadmap also includes calendar imports/exports, drag-and-drop scheduling, schedule conflict detection, AI document comparison, what-if simulation, attendance forecasting/recovery planning, analytics/heatmaps, PWA/offline support, push delivery, command palette, backups and multi-semester reporting.

This initial package is a foundation, not a claim that every roadmap feature is already implemented. The complete production system still needs the remaining application screens, server-side workflows, storage policies, push delivery service, document extraction pipeline, tests and deployment verification.

## Security model

- Attendance rows are user-owned and have private RLS policies.
- Group calendar events are separate from attendance rows.
- Group membership controls access to shared schedules.
- No service-role key is used in browser code.
- Review and test RLS policies before storing real student data.

