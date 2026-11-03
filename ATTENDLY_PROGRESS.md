# Attendly — build progress and next-agent handoff

Last updated: 2026-11-03 (Asia/Kolkata)

## User direction

- Build the website first; mobile app work comes later.
- Use `MASTER_BUILD_PROMPT.md` and the supplied starter ZIP as the brief and base.
- Publish the project in a new public GitHub repository under `sharveshraam`.
- Finish the Supabase foundation and connect the applicable website code.
- Keep this handoff current and push it with each meaningful milestone so another agent can continue.
- The synced project `sources/` directory is read-only. It has not been edited.

## Current verified state

### GitHub

- Public repository: [sharveshraam/Attendly](https://github.com/sharveshraam/Attendly)
- Default branch: `main`.
- Supabase key-variable support was pushed in [`7045bd6`](https://github.com/sharveshraam/Attendly/commit/7045bd6651cf171e0cc8e61e4e9bbf9a0724cf65). This handoff was then published to `main`; the current file history on GitHub is the canonical record for the handoff commit.
- `.env.local` is ignored and excluded from repository commits and the hosting ZIP. Never check in the publishable key, database password, service-role secret, or other private credential.

### Supabase project

- The user chose project creation in the `Sharvesh Ram` organization and explicitly confirmed the final creation action.
- Project: `Attendly`; ref `gavlxbxgxdormbfhtzlo`; Mumbai (`ap-south-1`); Free plan; Nano compute.
- Dashboard: <https://supabase.com/dashboard/project/gavlxbxgxdormbfhtzlo>
- Project API URL: `https://gavlxbxgxdormbfhtzlo.supabase.co`
- Supabase Data API is enabled; automatic table exposure is disabled; automatic RLS is on.
- The generated database password is held by Supabase and was not retrieved or copied here. No service-role key was retrieved.
- The project publishable key is configured locally in ignored `attendly/.env.local`, alongside the URL. It is not written into this public Markdown or committed. If another agent needs it locally, inspect the ignored file without printing or sharing the secret. For deployment, add the same two `NEXT_PUBLIC_SUPABASE_*` values as hosting-provider environment variables.
- `lib/supabase/client.ts` and `lib/supabase/server.ts` use the project URL and prefer `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, while retaining compatibility with `NEXT_PUBLIC_SUPABASE_ANON_KEY`. `.env.example` documents the publishable-key variable.

### Database migration and live checks

- `supabase/migrations/0001_attendly_core.sql` was loaded in the project's SQL Editor and executed successfully (`Success. No rows returned`).
- Live read-only catalog checks after migration found **19 public tables and all 19 have RLS enabled**.
- Storage verification found the `academic-documents` bucket and confirmed `public = false`.
- Realtime verification found all six intended tables in `supabase_realtime`: `calendar_events`, `attendance_records`, `group_members`, `calendar_polls`, `calendar_poll_votes`, and `notifications`.
- Migration establishes the core academic, timetable/calendar, attendance, assignments/resources, group collaboration, polls, notifications, and audit/history tables; membership/ownership helpers and RPCs; scoped RLS policies; private Storage policies; and Realtime publication membership. Review the SQL before extending the data model.
- Security choices: private attendance is owner-scoped; group creation assigns its creator the owner role; invite joining uses a controlled RPC that only grants member; role changes are constrained; calendar changes in shared groups require owner/admin approval; group-linked semester and academic content writes are scoped; private document paths require the authenticated user ID in the first folder.

## Website and code delivered so far

- Extracted the supplied Next.js App Router / TypeScript / Tailwind / Supabase SSR starter into `attendly-app/attendly/`; the original archive and synced sources were not changed.
- Replaced the starter placeholder with a responsive dashboard showing real, RLS-filtered Supabase data when a user and semester exist: latest semester, course count, scheduled future class count, and confirmed attendance percentage. Explicit empty/setup states are used; sample metrics are not fabricated.
- Added responsive navigation, overview cards, privacy copy, search dialog, setup prompts, sign-in/sign-up links, and mobile layout.
- Starter email/password login and registration pages remain. Account recovery, logout, and full authenticated navigation flows still need finishing.
- Added deterministic attendance calculations in `lib/attendance-engine.js` and six unit cases in `tests/attendance-engine.test.js`. All six passed using Node's built-in runner through the available JS runtime. Native `npm` is unavailable here, so `npm test`, dependency installation, lint, and Next production build have not run.
- Updated `README.md` and `FEATURES.md` to distinguish implemented screens from planned product scope.

## Current limits and next steps

1. Continue the website: reliable sign-up/login/session redirect, logout and recovery, semester/course creation, real calendar and attendance workflows, assignments, settings, loading/error handling, and accessibility review. Keep all database access behind RLS and avoid fake-success UI.
2. Review migration details against the product requirements and run realistic authenticated-user tests (including two users in different groups) before launch. Catalog checks verify RLS is enabled, not every policy's behavior.
3. Install dependencies / run lint, `npm test`, and a production build in an environment with Node/npm, then fix any issues. The attendance-engine tests already passed independently; the website bundle remains unbuilt.
4. Push this handoff and latest code/environment-name changes to GitHub. Record the resulting commit SHA below.
5. Created `attendly-app/Attendly-hosting-package.zip`. Archive inspection found 23 entries, including the README, handoff, and migration; `.env.local`, `node_modules`, `.next`, and credentials are excluded. This is a website foundation package, not a verified production build.
6. Deployment has not been attempted; no hosting integration is connected. Do not describe the current partial website as production-ready.

## Latest push log

- 2026-11-03: pushed the publishable-key environment variable example and client/server Supabase helper wiring; confirmed Supabase migration status and security service checks; then pushed this corrected handoff. See the linked code checkpoint above and the current file revision for the handoff update.

## Handoff rules

- Read this file, `FEATURES.md`, and `README.md`; inspect the working tree before continuing.
- Preserve `sources/` as read-only.
- Update this file after meaningful implementation, verification, external-service, and GitHub push milestones.
- Keep secrets out of public repository files and chat. Supabase publishable keys are browser-safe by design but still must not be copied into this public handoff; service-role/database credentials are strictly private.
- State only what was implemented and verified. Keep the current website scope and remaining work clear.


## Website Development Progress

_2026-11-03 · branch `arena/6fedf57b-attendly` · commit `dad29f2`. This section is
additive; all earlier sections above are preserved verbatim._

### What was built

- **Public site:** `/` landing, `/features`, `/about`, `/privacy`, `/terms`,
  `/support` with honest product copy (no invented statistics or testimonials).
- **Auth:** email/password signup + confirmation, sign-in, forgot/reset password,
  verify-email with a real `resend({type:"signup"})` action, `/auth/callback`
  handling PKCE `code`, `token_hash`+`type` and implicit fragments, session
  persistence, protected routes, logout, profile edit. No OAuth invented.
- **App routes:** `/onboarding` wizard, `/home` real-data dashboard, `/calendar`
  (month/week/day/agenda/semester, timetable rules, uploads with human review,
  session generation, history, academic-day classification), `/courses`,
  `/courses/[id]`, `/attendance` (mark/bunk/recovery/what-if/history),
  `/groups`, `/groups/[id]` (shared schedule, proposals, polls, members,
  history — never personal attendance), `/productivity`, `/analytics` (charts,
  heatmap, risk ranking, CSV/ICS/print exports), `/assistant` (deterministic
  on-device), `/notifications`, `/settings`.
- **PWA / offline:** generated manifest, four PNG icons, service worker caching
  static shell only (no API/auth/navigation/token responses), offline page,
  install/update/offline banners, light/dark/system theme, toasts, command
  palette, deterministic attendance outbox with optimistic-concurrency conflict
  handling, per-user private cache cleared on sign-out.
- **Shared logic:** canonical `lib/attendance/engine.ts` matching the mobile app
  plus `lib/attendance-engine.js` adapter; `lib/schedule.ts`, `lib/import/csv.ts`,
  `lib/dates.ts`, `lib/validation.ts`, `lib/reports.ts`, `lib/assistant.ts`,
  `lib/offline.ts`, `lib/data.ts`, `lib/auth.ts`, `hooks/use-workspace.tsx`,
  `hooks/use-now.ts`.
- **Config / assets:** `next.config.ts` security headers + CSP, `proxy.ts` SSR
  guard, `eslint.config.mjs`, `postcss.config.mjs`, `.env.example` placeholders,
  `.gitignore` additions, `engines.node >=22`, `scripts/generate-icons.py`,
  `public/app-icon.svg`, `public/sw.js`, `public/offline.html`.
- **Docs:** `docs/AUDIT.md`, `docs/SETUP.md`, `docs/TESTING.md`,
  `docs/DEPLOYMENT.md`, `ARCHITECTURE.md`, `TECH_DECISIONS.md`,
  `KNOWN_ISSUES.md`, `AGENT_HANDOFF.md`, `CHANGELOG.md`, `SECURITY.md` and a
  README status section.

### Decisions

- Website stays at the repository root; the existing root Next.js skeleton was
  extended rather than duplicated into `apps/web/`.
- **No backend change at all:** no migration, schema edit, RLS/Auth/Storage/Edge
  Function change, production credential change or production data test. All
  queries use the browser publishable key and existing RLS.
- Missing services are documented, not invented: no OCR/AI extraction (zero Edge
  Functions), no web-push sender, no `notes` table, no `assignments.priority`.
  Notes/priority are device-local; the assistant is deterministic; notifications
  are in-app + realtime; non-CSV uploads are private provenance only.
- Group privacy: schedules/events only; attendance, history, analytics and bunk
  data are never loaded in group context.
- Offline writes use deterministic ids, base-version conflict detection and an
  explicit keep-local/discard-local decision before any overwrite.
- Auth redirect allow-list changes and production promotion remain owner-approval
  gated.

### Verification results

- `npm run typecheck`: pass, 0 errors.
- `npm run lint`: pass, 0 warnings/errors.
- `npm test`: **80/80** (74 new TypeScript tests + original 6 legacy tests).
- `npm run test:legacy`: 6/6.
- `npm run build`: pass, Next 16.4.4 Turbopack, 28 routes / 16 static pages.
- `npm audit --omit=dev`: **0 vulnerabilities**. Full audit: 16 moderate dev-only
  advisories; suggested downgrades not applied.
- HTTP smoke check: 27 routes and assets all 200, including all public/auth/app
  routes, `/manifest.webmanifest`, `/sw.js`, `/offline.html` and four PNG icons.
  Security headers, CSP, SW no-cache and manifest content-type verified.
- Local production server on `0.0.0.0:3000` is the Arena live preview; the
  unconfigured-Supabase setup state renders honestly.

### Deployment status

- Vercel project `attendly-web` created with the two public Supabase env vars.
- Two Git-source deployment attempts from this branch failed at initialization
  with `git_info_fail` and were deleted. **No deployment is live and no
  production deployment occurred.**
- A repository link attempt returned: "You need to add a Login Connection to your
  GitHub account first." Hosted preview therefore waits for the owner to add
  that connection (or authorise another deployment path). See
  `docs/DEPLOYMENT.md`.
- Supabase Auth allow-list still contains only localhost and the mobile deep
  links; hosted email confirmation/reset links need an owner-approved additive
  change. No DNS, production promotion, `main` merge or custom domain was done.

### Known issues / incomplete work

- Real-account integration and E2E tests (auth round trip, two-user privacy,
  realtime, offline→reconnect conflict, CSV apply, PWA install/update,
  responsive/theme/print matrix) were not run: no disposable test account and no
  hosted Auth origin. Do not claim them as passing. See `KNOWN_ISSUES.md` and
  `docs/TESTING.md`.
- `app/globals.css` and `components/dashboard.tsx` are preserved legacy files,
  no longer used by the active UI.
- Remote push, server-synced notes/priority, PDF/image/Excel extraction and
  account deletion are unavailable because the backend has no such service.

### Next tasks

1. Owner adds the Vercel ↔ GitHub Login Connection; create a **preview**
   deployment from this branch and verify it.
2. Owner approves adding the preview origin to the Supabase Auth redirect
   allow-list; then test auth with a disposable account.
3. Run the integration/E2E checklist with a safe test account (never production
   data).
4. Only after explicit approval: production promotion, DNS, `main` merge.
5. Append the next milestone here without overwriting earlier sections.

## Obsidian Academic + Supabase link (2026-11-03)

### What changed
- The website's whole theme is now **Obsidian Academic**: dark-first, elegant,
  minimal and premium (Apple dark / Linear / Raycast / high-end financial
  dashboards). Exact palette: Deep Obsidian `#090D14` background, Midnight Slate
  `#101722` surfaces, Elevated Graphite `#182231`, tertiary `#1E2A3C`, primary text
  `#F1F5F9`, secondary `#A5ADBA`, muted `#6E7889`, border `#263244`, dominant muted
  teal `#38B8A5`, soft ice blue `#75B9E7` (info), warm champagne `#D5B77A`
  (warnings/exams), muted red `#E47777` (errors/at-risk).
- Dark is default (`color-scheme: dark`, dark theme/status-bar colour,
  `userInterfaceStyle` dark). `html.light` remains as an optional neutral variant.
  Inter Variable 400–800 is bundled locally so the preview needs no external
  network; system fallback retained.
- Editorial typography (tight display tracking, open caption tracking), crisp 1px
  borders instead of heavy shadows, subtle low-opacity elevation, generous
  spacing, minimal noise, 0.28s screen fade with reduced-motion guard. Teal
  primary buttons use obsidian text, not white.
- Token-driven coverage across every screen — dashboard, auth, attendance,
  calendar, courses, groups, productivity, settings, public pages, notifications,
  analytics, assistant, onboarding, offline/PWA assets, charts and icons. Charts
  use teal trend lines / course bars with champagne target markers. Course colours
  centralised in `lib/theme.ts` (teal shades + three semantic accents, no
  rainbow).
- Website/PWA equivalents of the native touches: obsidian app icon, adaptive and
  splash/notification glyph with a teal calendar-check on deep obsidian; dark
  theme/status-bar colours. Android status/navigation-bar notes were design
  context only — the Android app was not modified.
- **No legacy accent colour** remains: `app/web.css`, legacy `app/globals.css`, manifest,
  icon SVG, four regenerated PNGs, icon generator, offline page, colour arrays,
  legacy dashboard class and test fixtures were all rewritten. Verified by grep
  in source and the rebuilt `.next/static` bundle.

### Supabase / Vercel linking
- Wrote the ignored `.env.local` with the live project's **public** URL and
  publishable key. The local preview now talks to the real project under existing
  RLS; the missing-env setup error is gone. No service-role, secret or database
  credential is present in the repo, browser bundle or these notes.
- Applied the owner-approved **additive** Auth redirect allow-list change:
  kept `http://localhost:3000/**`, `attendly://auth/callback`,
  `attendly://auth/reset-password`; added
  `https://3000-ij82xxqb0js5vttcwapbe.e2b.app/**`,
  `https://attendly-web-cosmic-7aae.vercel.app/**`,
  `https://attendly-web-git-arena-6fedf57b-attendly-cosmic-7aae.vercel.app/**`,
  `https://attendly-*.vercel.app/**`. A fresh `get_auth_config` confirmed
  `site_url=http://localhost:3000` and all other Auth settings unchanged.
- Vercel project `attendly-web` still has the two public env vars and no GitHub
  Login Connection. Hosted preview remains blocked (`git_info_fail`); **no
  deployment is live and no production deployment occurred.** Production
  promotion, DNS, `main` merge and production data testing remain unapproved.

### Verification for this milestone
- `npm run typecheck`, `npm run lint`, `npm test` (80/80), `npm run build`,
  `npm audit --omit=dev` (0 vulnerabilities), 27-route HTTP/header smoke,
  legacy-accent source + bundle grep, manifest/SW/icon checks, and a fresh local
  `/signup` render with the linked Supabase env. Browser auth round trips, PWA
  install/offline, responsive/theme matrix and real-account E2E are **not**
  claimed as verified.
