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
- No migration, schema change, RLS/Auth/Storage/Edge Function edit, service-role
  key, production credential change or production data test.
- No production deployment, DNS change, irreversible infrastructure change or
  `main` merge without explicit authorisation. Preview is allowed.
- Additive Supabase Auth redirect allow-list changes need owner approval.
- Only existing schema/tables/columns/RPCs. Missing services must be documented,
  not invented. No fake data, fake controls or fabricated test/deploy claims.
- Work only on `arena/6fedf57b-attendly`; push only there.

## What is done

- Full public site, auth flows, onboarding, dashboard, courses, calendar/
  timetable, attendance tools, groups (schedule-only), productivity, analytics/
  exports, deterministic assistant, notifications, settings, PWA/offline,
  settings-managed local data and conflict resolution.
- 80/80 tests, typecheck, lint, production build, production dependency audit
  and HTTP/header smoke checks all pass. See `docs/TESTING.md`.
- Commit `dad29f2` pushed to `origin/arena/6fedf57b-attendly`.
- Vercel project `attendly-web` created with the two public env vars.
- Local production server on `0.0.0.0:3000` is the Arena live preview.

## What is NOT done

- **Hosted preview deployment** — blocked by a missing Vercel ↔ GitHub Login
  Connection (`git_info_fail`). Two failed deployment records were deleted; no
  deployment is live. See `docs/DEPLOYMENT.md`.
- **Supabase Auth redirect allow-list** — hosted origin absent, waiting for owner
  approval.
- Real-account integration/E2E, two-user privacy, realtime, offline→reconnect,
  browser PWA install/update, responsive/theme/print matrix. See
  `KNOWN_ISSUES.md` and `docs/TESTING.md`.
- Production promotion, DNS, `main` merge, production data testing.

## Immediate next tasks (in order)

1. Ask the owner for the minimum authorisation: add the GitHub Login Connection
   in Vercel (or approve an alternative preview deployment path). Do not retry
   the exact failed `create_deployment` / `create_project` calls.
2. Once authorised, create a **preview** deployment from this branch; verify
   routes, manifest, SW, icons, headers and the honest setup/login states.
3. Request approval to add the preview origin to the Supabase Auth redirect
   allow-list; only then test signup/confirmation/recovery with a disposable
   account.
4. Run the integration/E2E checklist with a safe test account (never production
   data).
5. After all gates pass, request explicit approval for production promotion /
   DNS / `main` merge. Never assume it.
6. Update `ATTENDLY_PROGRESS.md`, `CHANGELOG.md`, `KNOWN_ISSUES.md` and
   `docs/DEPLOYMENT.md` after each milestone.

## Implementation notes for the next agent

- `app/web.css` is active; `app/globals.css` is legacy/unused but preserved.
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
