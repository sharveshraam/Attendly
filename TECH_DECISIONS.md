# Technical decisions

_Last updated: 2026-11-03. All decisions are scoped to the website; the live
backend and deployed Android app were left untouched._

| # | Decision | Rationale / trade-off |
| --- | --- | --- |
| 1 | Keep the website at the repository root instead of creating `apps/web/`. | `docs/AUDIT.md` found an existing root Next.js skeleton with `app/`, `lib/supabase/*`, package config and a migration. Duplicating it would create two competing apps. Web-specific code is isolated in new root-level `components/`, `hooks/`, `lib/*` modules, `tests/*`, `public/*` and `docs/*` instead. |
| 2 | No migration, no schema change, no RLS/Auth/Storage/Edge Function edit. | The backend is live and used by the deployed Android app. 143 public columns across 19 RLS-enabled tables were catalogued read-only; the website uses only those. Any additive Auth allow-list change is owner-approval gated. |
| 3 | Browser publishable/anon key only; authorization via existing RLS. | No service-role key, database password or privileged secret exists in the repo or browser. `tests/privacy.test.ts` fails if one is referenced. |
| 4 | One canonical pure attendance engine, ported from mobile. | Avoids divergent maths between clients. The legacy adapter keeps the original six tests valid; 74 new TypeScript tests cover parity, what-if, hours, risk, schedule, CSV, validation, exports, offline and privacy. |
| 5 | No invented backend services. | The live project has zero Edge Functions, no `notes` table, no `assignments.priority` column and no web-push sender. Notes and assignment priority are **device-local**; the assistant is deterministic/on-device; notifications are in-app + realtime; PDF/image/Excel are private uploads with human CSV review instead of fake OCR. |
| 6 | Client-side CSV parsing with mandatory human review. | Without an extraction service, silently guessing timetable rows would corrupt schedules. The UI shows parsed rows, errors and a diff before any write. |
| 7 | Timetable generation is idempotent and diff-based. | `courseId\|startsAt` keys prevent duplicates on retry; revised timetables are compared by course + weekday + start time; academic-day classifications suppress classes. |
| 8 | Offline writes use an outbox with optimistic concurrency. | Deterministic ids prevent duplicate submissions; `baseRecordId`/`baseMarkedAt` detect changes from another device/tab; conflicts are surfaced rather than silently overwriting; keep-local requires explicit confirmation. |
| 9 | Service worker caches static shell only. | Caching navigation or Supabase API responses would risk leaking private data or serving stale auth state. Per-user cache lives in `localStorage`, is optional, and is cleared on sign-out. |
| 10 | Email/password auth only. | Live Auth has external providers disabled and email confirmation enabled. Implemented: signup + confirmation, resend confirmation, sign-in, recovery/reset, PKCE/token-hash/implicit redirects, session persistence, logout, profile, protected routes. No OAuth invented. |
| 11 | `app/manifest.ts` is the manifest source; no static duplicate. | Next generates `/manifest.webmanifest`; `metadata.manifest` points to it. A separate static file would drift. |
| 12 | CSP with `frame-ancestors` instead of `X-Frame-Options: DENY`. | Modern clickjacking protection that still allows Arena/Vercel preview dashboards to embed the site. `connect-src` is restricted to self + `*.supabase.co`; no `unsafe-eval`. |
| 13 | ESLint 9 flat config; one compiler advisory rule disabled. | `react-hooks/set-state-in-effect` conflicts with legitimate mount-time data loading, browser-only API reads after hydration and transient UI resets on route change. All other Next/react-hooks rules stay on; lint passes with zero warnings. |
| 14 | Node's built-in test runner with `--experimental-strip-types`. | No extra test framework dependency; TypeScript modules are tested directly with explicit `.ts` imports. `npm test` runs 74 new + 6 legacy tests. |
| 15 | Vercel preview only; production promotion approval-gated. | Creating a Vercel project and env config is allowed; no DNS, production DB change or production promotion was performed. See `docs/DEPLOYMENT.md` for the current blocker. |
| 16 | Preserve original files. | `app/globals.css`, `components/dashboard.tsx`, `lib/supabase/*`, `supabase/migrations/0001_attendly_core.sql`, `tests/attendance-engine.test.js` and all older docs remain. `app/web.css` is the active stylesheet; the legacy CSS is unused but not deleted. |
