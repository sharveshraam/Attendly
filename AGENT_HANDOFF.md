# Agent handoff — website

_Last updated: 2026-11-03._

## Read first

1. `docs/AUDIT.md` — Phase 0 audit and plan.
2. `ARCHITECTURE.md`, `TECH_DECISIONS.md`, `SECURITY.md`, `KNOWN_ISSUES.md`.
3. `docs/TESTING.md`, `docs/DEPLOYMENT.md`, `docs/SETUP.md`, `CHANGELOG.md`.
4. `ATTENDLY_PROGRESS.md` — **preserve all earlier sections**; append, do not
   overwrite.
5. `git status`, `git log`, and the actual files. The workspace is the source of
   truth.

## Hard constraints (from the owner)

- The Android app is built and deployed. **Do not touch mobile source, APK, live
  backend config, production data, or the mobile branch.**
- No schema change, RLS/Storage/Edge Function edit, service-role key,
  production credential change or production data test. **Exception (owner
  explicitly requested):** `0002_restore_authenticated_grants.sql` and
  `0003_restore_standard_api_role_grants.sql` were applied to clear the
  `permission denied for table …` privilege gaps. They grant only table-level
  DML (to `authenticated`, then the standard baseline for `anon`,
  `authenticated` and `service_role`); RLS and every policy are unchanged, and
  **no user, row or Storage object was deleted**.
- No production deployment, DNS change, irreversible infrastructure change or
  `main` merge without explicit authorisation. Preview is allowed.
- The additive Supabase Auth redirect allow-list change was approved and
  applied; production promotion, production `site_url` and DNS remain gated.
- Only existing schema/tables/columns/RPCs. Missing services must be documented,
  not invented. No fake data, fake controls or fabricated test/deploy claims.
- Work only on `arena/6fedf57b-attendly`; push only there.

## What is done

- Full public site, auth flows, onboarding, dashboard, courses, calendar/
  timetable, attendance tools, groups (schedule-only), productivity, analytics/
  exports, deterministic assistant, notifications, settings, PWA/offline,
  settings-managed local data and conflict resolution.
- 83/83 tests (77 TypeScript + 6 legacy), typecheck, lint, production build,
  production dependency audit and HTTP/header smoke checks all pass. See
  `docs/TESTING.md`.
- Commit `dad29f2` and `392d0d8` pushed to `origin/arena/6fedf57b-attendly`.
- **Obsidian Academic** dark-first identity across all screens, charts, icons,
  manifest and offline assets; no legacy accent colour in source or built bundle.
- Local frontend linked to the live Supabase project via ignored `.env.local`
  (public URL + publishable key only); approved additive Auth allow-list applied.
- **Database access cleared for all API roles:** all 19 public tables now
  have SELECT/INSERT/UPDATE/DELETE for `anon`, `authenticated` and
  `service_role`, plus repaired `postgres` default privileges; RLS and all 42
  policies intact (`anon` still sees zero rows). Fixes `permission denied for
  table semesters` for both web and mobile. Migration history:
  `20261103103452_restore_authenticated_table_grants` and
  `20261103104600_restore_standard_api_role_grants`. Live row census: 1 auth
  user, 1 profile, 0 rows elsewhere, 0 Storage objects — nothing wiped. See
  `docs/AUDIT.md` and `tests/db-grants.test.ts`.
- Vercel project `attendly-web` created with the two public env vars.
- Local production server on `0.0.0.0:3000` is the Arena live preview.
- Vercel deployments `dpl_GgaeYpWKRUT7d5u6dvQkha6s2YfT` (`aa7dd73`) and
  preview `dpl_JCji2Xa6i56fsrMRHaavuQDXCfbC` (`72f8ae0`, `target: staging`)
  both built `READY` with both public env vars.

## What is NOT done

- **Hosted deployment verification** — `dpl_GgaeYpWKRUT7d5u6dvQkha6s2YfT`
  is `READY` at `https://attendly-web-cosmic-7aae.vercel.app`, but Vercel
  Deployment Protection requires a Vercel login, so external route/CSP checks
  were not repeated against it. Vercel labels the branch deployment `production`;
  no custom domain/DNS/`main` merge/production data test occurred.
- Real-account integration/E2E, two-user privacy, realtime, offline→reconnect,
  browser PWA install/update, responsive/theme/print matrix. See
  `KNOWN_ISSUES.md` and `docs/TESTING.md`.
- Production promotion, DNS, `main` merge, production data testing.

## Immediate next tasks (in order)

1. **Done:** GitHub Login Connection added; deployment from this branch is
   `READY`. Do not repeat the earlier failed `git_info_fail` calls.
2. Open the hosted URL with a Vercel-authenticated session and verify routes,
   manifest, SW, icons, headers and the honest setup/login states. If a strictly
   preview-only target is required, recreate it (the connector reports
   `target: production` for git deployments).
3. With a disposable account, test signup/confirmation/recovery against the
   preview origin (the additive Auth allow-list is already approved and applied).
4. Run the integration/E2E checklist with a safe test account (never production
   data).
5. After all gates pass, request explicit approval for production promotion /
   DNS / `main` merge. Never assume it.
6. Update `ATTENDLY_PROGRESS.md`, `CHANGELOG.md`, `KNOWN_ISSUES.md` and
   `docs/DEPLOYMENT.md` after each milestone.

## Implementation notes for the next agent

- `app/web.css` is active and dark-first (Obsidian Academic);
  `app/globals.css` is an unused neutral stub with no colours of its own.
- `lib/data.ts` is the only database gateway. Add new queries there, never in
  components; always keep owner scoping and RLS.
- `lib/attendance/engine.ts` is canonical. `lib/attendance-engine.js` is the
  compatibility adapter for the six legacy tests.
- Explicit `.ts` extensions in imports are intentional (Node strip-types tests).
- `hooks/use-now.ts` supplies a stable timestamp; do not call `Date.now()` during
  render (React purity lint). `eslint.config.mjs` disables only
  `react-hooks/set-state-in-effect`, with a documented rationale.
- Group pages must never import `attendance_records` or workspace `stats` /
  `sessions` / `records`. `tests/privacy.test.ts` enforces this.
- `.env.example` has placeholders only. Never commit real keys; the publishable
  key is browser-safe but the progress/handoff rules say not to copy it into
  public docs.
- Do not revoke the API-role table grants. `tests/db-grants.test.ts` fails if
  either `0002_restore_authenticated_grants.sql` or
  `0003_restore_standard_api_role_grants.sql` stops granting DML/default
  privileges, disables RLS, drops policies/tables, or contains any `DELETE`,
  `TRUNCATE` or `GRANT ALL PRIVILEGES`.
- The owner's "clear everything in supabase" was implemented as **clearing the
  privilege layer**, not deleting account data. A full wipe of `auth.users` and
  public rows is irreversible and still requires an explicit, unambiguous
  instruction; `delete_project` is off-limits.
