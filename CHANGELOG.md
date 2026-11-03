# Changelog

## 2026-11-03 — Clear the remaining Supabase privilege gaps (all API roles)

`0002` fixed signed-in pages but left `anon=Dxtm` and `service_role=Dxtm` on all
19 public tables. An anonymous request still hit `permission denied for table …`
instead of an empty RLS result (session restore / auth callback), and
`service_role` could not run any table operation.

- Applied `supabase/migrations/0003_restore_standard_api_role_grants.sql`
  (Supabase migration `20261103104600_restore_standard_api_role_grants`):
  the standard `arwdDxtm` baseline for `anon`, `authenticated` and
  `service_role` on all public tables/sequences plus `ALTER DEFAULT PRIVILEGES
  FOR ROLE postgres` for future tables and sequences.
- **RLS stays enabled on all 19 tables; all 42 policies unchanged**, all `to
  authenticated`. `anon` sees/writes zero rows — grants, not data access.
  `service_role` bypasses RLS by design (standard Supabase); its key is not used
  by web, mobile or this repo. No user, row, bucket, object, Auth setting, API
  key, schema object or migration was deleted or altered.
- Verified live: 19/19 tables with all four DML privileges for all three roles,
  0 RLS-off, 42 + 4 policies, `postgres` default ACLs now identical to
  `supabase_admin`, `anon` simulation returns 0 rows with no error, real
  `authenticated` simulation returns only its own profile, `service_role`
  simulation succeeds. Row census: 1 auth user, 1 profile, 0 rows elsewhere.
- `tests/db-grants.test.ts` now guards both migrations (6 static tests),
  including that neither ever disables RLS, drops a policy/table, truncates or
  issues `DELETE FROM`.
- No redeploy: web and mobile share this backend. No Vercel, DNS, `main` or
  Deployment Protection change.

## 2026-11-03 — Fix `permission denied for table …` on every page (web + mobile)

### Root cause
All 19 public tables had RLS enabled and 42 correct `authenticated` policies,
but the project's `postgres` default ACL was
`anon=Dxtm, authenticated=Dxtm, service_role=Dxtm` — SELECT/INSERT/UPDATE/DELETE
were absent. PostgreSQL rejects a request on privileges **before** evaluating
RLS, so every signed-in request failed with `permission denied for table
semesters` (and the same on all other pages). The website and the deployed
Android app share this project, so both broke.

### Fixed
- Applied `supabase/migrations/0002_restore_authenticated_grants.sql` (also
  tracked in Supabase migration history as
  `restore_authenticated_table_grants`):
  - `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated`
  - sequence grants for completeness
  - `ALTER DEFAULT PRIVILEGES FOR ROLE postgres …` so future tables keep the grants
- **RLS stays enabled on all 19 tables; all 42 policies are unchanged.** No
  schema, column, policy, data, Auth, Storage or Edge Function change. This
  first pass was scoped to `authenticated`; the follow-up above completes the
  baseline for every API role.
- Added `tests/db-grants.test.ts` (static regression guards).

### Verified against the live project
- Privilege matrix: all 19 tables now allow SELECT/INSERT/UPDATE/DELETE for
  `authenticated`; `anon` still has none; RLS still `true`; policy counts unchanged.
- Simulated `SET LOCAL ROLE authenticated` + synthetic JWT: a random UID saw 0
  rows; the real UID saw exactly its own 1 profile row — so RLS still filters.
- Rolled-back write transaction succeeded across semesters, courses, events,
  attendance, assignments, timetable rules, academic days, uploads, resources,
  change log, notifications, preferences, groups, polls, votes and push
  subscriptions. Post-rollback row counts confirmed **zero test data left**.
- `npm run typecheck`, `npm run lint`, `npm test` (**83/83**), `npm run build`.


## 2026-11-03 — Obsidian Academic + Supabase link (branch `arena/6fedf57b-attendly`)

### Changed
- Replaced the earlier light-first design system with **Obsidian Academic**:
  deep obsidian `#090D14` default background, midnight slate / graphite surfaces,
  one muted-teal `#38B8A5` accent, ice blue `#75B9E7` for info, champagne
  `#D5B77A` for warnings/exams, muted red `#E47777` for errors/at-risk. Dark is
  the default (`color-scheme: dark`, `userInterfaceStyle`/theme colour dark); an
  optional neutral `html.light` variant remains.
- Bundled `@fontsource-variable/inter` locally (400–800 via variable weights),
  tightened large-display tracking, opened caption tracking, switched heavy
  shadows to crisp 1px borders and subtle low-opacity elevation, removed the
  CTA/skeleton gradients, added a 0.28s screen fade with reduced-motion guard.
- Applied the palette token-driven to every screen: public pages, auth,
  onboarding, dashboard, attendance, calendar, courses, groups, productivity,
  settings, notifications, analytics, assistant, offline/PWA assets, charts
  (teal trend lines + champagne target markers) and course colour arrays
  (`lib/theme.ts`). Teal buttons now carry obsidian text.
- Added `public/icons/notification-glyph.svg` (obsidian tile + teal
  calendar-check) wired into in-tab class reminders.
- Regenerated `public/app-icon.svg` and all four PNG icons as an obsidian tile
  with a teal calendar-check; updated `app/manifest.ts`, `public/offline.html`,
  `app/layout.tsx` metadata and the legacy `app/globals.css` stub. No legacy accent
  colour remains in source or the built `.next/static` bundle.

### Linked
- Wrote the ignored `.env.local` with the live project's **public** URL and
  publishable key, so the local preview is linked to Supabase under existing RLS.
- Applied the owner-approved **additive** Auth redirect allow-list: Arena preview
  origin + Vercel preview aliases added; original localhost/mobile entries and
  `site_url=http://localhost:3000` preserved; all other Auth settings unchanged.

### Deployed
- The GitHub Login Connection is now available. `dpl_GgaeYpWKRUT7d5u6dvQkha6s2YfT`
  built `READY` in ~45s from `aa7dd73` with both public env vars:
  `https://attendly-web-cosmic-7aae.vercel.app` and the branch alias. A second
  deployment `dpl_JCji2Xa6i56fsrMRHaavuQDXCfbC` from `72f8ae0` is the current
  **preview** (`target: staging`, environment `preview`, `STAGED`) at
  `https://attendly-mmqleg474-cosmic-7aae.vercel.app`. Vercel SSO Deployment
  Protection requires a Vercel login to open them; Vercel labels the first
  branch deployment `target: production` / `PROMOTED`.

### Still not done
- No custom domain, DNS change, `main` merge, production data testing,
  real-account auth/E2E or browser PWA/responsive verification.


## 2026-11-03 — Website implementation (branch `arena/6fedf57b-attendly`)

### Added
- Public site: landing, features, about, privacy, terms, support.
- Auth: email/password signup + confirmation, sign-in, forgot/reset password,
  verify-email with real confirmation resend, `/auth/callback` for PKCE,
  `token_hash`+`type` and implicit redirects, session persistence and sign-out.
- Authenticated app: onboarding wizard, dashboard, courses + course detail,
  calendar (month/week/day/agenda/semester, timetable rules, uploads, session
  generation, history, academic days), attendance (mark/bunk/recovery/what-if/
  history), groups (create/join, shared schedule, proposals, polls, members,
  history), productivity (assignments, exams, device-local notes/priority,
  events), analytics (charts, heatmap, risk ranking, CSV/ICS/print exports),
  deterministic on-device assistant, notification center, settings.
- PWA: `app/manifest.ts`, four generated PNG icons, `public/sw.js` (static-shell
  only), `public/offline.html`, `/offline`, install/update/offline banners,
  dark-first theme, toasts, command palette.
- Domain modules: canonical attendance engine + legacy adapter, schedule
  generation/diff/conflicts, RFC-4180 CSV parsers, date helpers, Zod validation,
  CSV/ICS/printable reports, deterministic assistant, offline outbox/private
  cache, single `lib/data.ts` gateway, `hooks/use-workspace.tsx`.
- Tests: 74 new TypeScript tests (attendance, schedule, CSV, validation,
  assistant, reports, offline, privacy) plus the original 6 legacy tests.
- Config: `next.config.ts` security headers/CSP, `proxy.ts` SSR guard,
  `eslint.config.mjs`, `postcss.config.mjs`, `.env.example` placeholders,
  `.gitignore` additions, `engines.node >=22`.
- Docs: `docs/AUDIT.md`, `ARCHITECTURE.md`, `TECH_DECISIONS.md`,
  `KNOWN_ISSUES.md`, `AGENT_HANDOFF.md`, `SECURITY.md`, `CHANGELOG.md`,
  `docs/SETUP.md`, `docs/TESTING.md`, `docs/DEPLOYMENT.md`, plus a new
  `ATTENDLY_PROGRESS.md` section and a README status section.

### Changed
- Upgraded to Next 16.4.4 / React 19.2.0 / Tailwind 4.3.4 / zod 4.6.7 and added
  `@supabase/ssr`, `lucide-react`; removed the Next 16.0.0 and zod <4.6.6
  advisories by upgrading.
- `app/layout.tsx` now imports `app/web.css` and wires theme, toast and PWA
  providers; `tsconfig.json` gained `allowImportingTsExtensions` and Next's
  generated settings.
- Replaced `X-Frame-Options: DENY` with a CSP `frame-ancestors` rule that still
  allows preview dashboards.

### Fixed during implementation
- JSX generic syntax in three pages, `Panel` style prop, nullable semester in
  calendar, timetable rule null defaults, invalid calendar dates in CSV import,
  duplicate `className`, unused imports, mislabeled "resend email" action,
  empty `userId` on calendar uploads, and the keep-local conflict path (now a
  single idempotent upsert through the outbox).

### Verified
- `npm run typecheck`, `npm run lint` (0 warnings), `npm test` (80/80),
  `npm run test:legacy` (6/6), `npm run build` (28 routes), `npm audit
  --omit=dev` (0 vulnerabilities), and HTTP 200 smoke checks for 27 routes and
  assets including manifest, SW, icons and headers.
- Local `npm run start` on `0.0.0.0:3000` is the Arena live preview; the
  unconfigured-Supabase setup state renders honestly.

### Not done / blocked
- No Supabase writes, migrations, RLS/Storage/Edge Function changes. The
  approved additive Auth allow-list change above is the sole Auth config edit.
- No production deployment, DNS change, `main` merge or production data test.
- Vercel project `attendly-web` created with public env vars; two early
  Git-source deployment attempts failed at `git_info_fail` and were deleted.
  **Superseded by the section above:** the GitHub Login Connection was later
  added and a deployment built `READY`. The preview Auth redirect allow-list
  change is done (approved).

## Earlier history

See `ATTENDLY_PROGRESS.md` for the original skeleton, migration, live checks and
mobile-app work by other agents. Those sections are preserved verbatim.
