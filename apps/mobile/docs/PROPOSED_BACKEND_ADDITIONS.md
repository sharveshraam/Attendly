# Proposed Backend Additions (STAGED — NOT APPLIED)

These are **proposals only**. They are **not** applied to the live project and are **not** placed in `supabase/migrations/` (that directory is owned by the web agent). Each requires the owner's explicit authorization before applying. They exist so the mobile app's local-only features can later become server-backed without inventing schema at runtime.

The mobile app works **today** without any of these, using client-side fallbacks noted below.

---

## 1. Notes table (currently local-only)

**Today:** notes live in SQLite (`database/notes.ts`); they do not sync across devices.

```sql
-- PROPOSED — not applied
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  semester_id uuid references public.semesters(id) on delete cascade,
  title text not null default '',
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.notes enable row level security;
create policy "notes_owner_all" on public.notes
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
```

## 2. Assignment priority (currently a SQLite overlay)

**Today:** priority is stored locally in `assignment_meta`; the `assignments` table has no priority column.

```sql
-- PROPOSED — not applied
alter table public.assignments
  add column if not exists priority smallint not null default 2
  check (priority between 1 and 3); -- 1 high, 2 medium, 3 low
```

## 3. Expo push tokens (remote push is not operational)

**Today:** `push_subscriptions` is web-push shaped (`endpoint`, `subscription`). Remote push needs Expo tokens + a sender. See `NOTIFICATIONS.md`.

```sql
-- PROPOSED — not applied
alter table public.push_subscriptions
  add column if not exists expo_push_token text,
  add column if not exists platform text check (platform in ('ios','android'));
-- Plus: an Edge Function / pg_cron sender that reads tokens and calls the Expo Push API.
-- Plus: EAS project id + push credentials configured, and a physical-device delivery test.
```

## 4. Timetable OCR / extraction (currently CSV + manual review)

**Today:** PDF/image timetable import is **not** auto-extracted (no OCR backend). CSV is parsed client-side; PDF/image uploads are stored and reviewed manually. Excel parsing is deferred.

```sql
-- PROPOSED — not applied (design sketch)
-- An Edge Function `extract-timetable` that:
--   1. reads a document_uploads row (PDF/image) via signed URL,
--   2. runs OCR / a vision model,
--   3. writes structured rows to document_uploads.extracted_data (jsonb)
--      and sets extraction_status = 'completed'.
-- The mobile review screen already reads extracted_data when present.
```

---

## Applied separately (additive auth config, not a migration)

The Supabase **auth redirect allow-list** was empty. Two mobile redirect URLs were added **additively** so email verification / password-reset links can open the app:

- `attendly://auth/callback`
- `attendly://auth/reset-password`

`site_url` (`http://localhost:3000`) and all other auth settings were left **unchanged**. This is a project configuration change, not a schema migration, and removes nothing. See `BUILD.md` → Deep links.
