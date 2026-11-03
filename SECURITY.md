# Security model

_Last updated: 2026-11-03._

## Credentials

- The browser uses **only** `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the legacy
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`). These are public by design; the publishable
  key grants no privileges beyond what RLS allows for an authenticated user.
- No service-role key, secret key, database password, JWT secret, AI provider
  key or push-signing key is read, stored or referenced by the website.
  `tests/privacy.test.ts` fails the build if one appears in `app/`, `components/`,
  `lib/`, `hooks/` or `public/`.
- `.env.example` contains placeholders only. `.env`, `.env.local`,
  `.env.*.local`, `.vercel` and `*.tsbuildinfo` are gitignored.

## Authorization

- **RLS is the authority.** Every read/write in `lib/data.ts` goes through the
  browser client; there is no server-side bypass. `proxy.ts` and
  `app/(app)/layout.tsx` are routing guards, not authorization.
- **Table privileges are also required.** PostgreSQL checks table-level
  grants before RLS. This project was created with a `postgres` default ACL that
  omitted `arwd` for `authenticated`, so every request failed with
  `permission denied for table …` on the website and in the mobile app. `supabase/migrations/0002_restore_authenticated_grants.sql` grants
  SELECT/INSERT/UPDATE/DELETE on all public tables and sequences to
  `authenticated` and repairs the `postgres` default ACL for future tables.
  RLS stays enabled, all 42 policies are unchanged, and no grant was added
  to `anon` or `service_role`. `tests/db-grants.test.ts` guards against removing the grants, disabling RLS
  or widening the fix to `anon`/`service_role`.
- `attendance_records` queries always filter by `user_id`; writes include the
  caller's own `user_id`. Group pages never query attendance records.
- `profiles` is self-select only. Other group members are rendered as
  "Classmate"; their attendance, analytics and bunk calculations are never loaded.
- Group sharing is limited to `calendar_events`, polls, votes, members, schedule
  change history and the group-linked semester.
- Private uploads use `${userId}/${uuid}.${ext}` paths in the private
  `academic-documents` bucket. File name, size and declared MIME are validated
  before upload (`lib/validation.ts`, `MAX_DOCUMENT_BYTES`).
- All writes pass Zod validation. No raw user input is concatenated into SQL
  (the Supabase JS client builds parameterised queries).

## Transport and browser hardening

`next.config.ts` sets: `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`,
`Cross-Origin-Opener-Policy: same-origin`,
`Cross-Origin-Resource-Policy: same-origin`,
`Permissions-Policy` (camera/microphone/geolocation/payment/usb denied),
`Strict-Transport-Security` and a CSP with `default-src 'self'`,
`object-src 'none'`, `frame-ancestors 'self' https://*.e2b.app https://*.vercel.app`,
`connect-src 'self' https://*.supabase.co wss://*.supabase.co`, no
`unsafe-eval` and no remote script/style sources. Next's inline bootstrap is the
only reason `unsafe-inline` appears for scripts/styles.

## Caching and offline data

- `public/sw.js` caches only public static shell assets. It refuses to cache
  navigations, `/api/`, `/auth/`, cross-origin requests, requests carrying
  `Authorization`/`Cookie`, and URLs containing `code` or `token_hash`.
  Navigation responses are network-only with an `/offline.html` fallback.
- Private workspace snapshots are per-user `localStorage` entries, optional
  (Settings toggle), cleared on sign-out and never sent to third parties.
- The offline outbox uses deterministic ids and optimistic concurrency. A newer
  server value is never silently overwritten; conflicts require an explicit user
  decision.

## What is NOT protected by this frontend

- There is no server-side rate limiting beyond Supabase Auth's own limits.
- No admin/moderation surface exists; group roles come from existing RLS/RPCs.
- In-app notifications are private per user under RLS; remote push is not
  configured (see `KNOWN_ISSUES.md`).
- The preview origins are already in the Supabase Auth redirect allow-list
  (approved additive change). A production deployment still requires explicit
  owner approval for a production origin and any `site_url` change.

## Reporting

Report security concerns through the support route (`/support`) or the project
owner. Do not include credentials, tokens or production data in a report.
