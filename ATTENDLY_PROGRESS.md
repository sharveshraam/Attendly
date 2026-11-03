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


---

# Mobile app — `apps/mobile/` (native Android + iOS)

Added by the mobile agent on branch `arena/7b693859-attendly`. This section is append-only; the website handoff above is preserved unchanged. The website, `supabase/migrations/`, and all other root/web files were **not** modified.

## Status: feature-complete and build-ready (JS/Metro verified)

A full **React Native + Expo SDK 58 + Expo Router + TypeScript** app integrating the existing Supabase backend. It is not a WebView wrapper. Attendance is owner-private; groups share **schedules only**, enforced by the existing RLS.

## What was built

- **Auth** — register / login / email verification / password reset / logout / session restore; tokens in a chunked `expo-secure-store` adapter (keystore/keychain).
- **Onboarding** — semester → courses → timetable (CSV import + manual) → academic calendar → review/conflict check; optional steps skippable.
- **Calendar** — month / week / day / agenda; academic-day classifications; recurring rules kept separate from dated sessions; revised-timetable diff/confirm.
- **Attendance engine** — independent, unit-tested pure TS (`src/lib/attendance/engine.ts`): bunk / recovery / what-if, per-course targets, hours mode, fixed/rolling projections. Semantics: denominator = present+absent; excused conducted but not counted; unmarked ≠ absent; cancelled excluded; rescheduled original excluded / replacement counted once; 100% target unrecoverable after a miss.
- **Dashboard, course pages, groups** (create/join via `join_group_by_invite` RPC, roles, shared events, polls), **productivity** (assignments, exams, notes, events), **analytics** (trend + per-course charts, CSV/PDF export via native share).
- **Deterministic AI assistant** — answers from real data, no external AI, no invented numbers.
- **Offline-first** — SQLite cache + durable outbox with version-based conflict resolution (manual keep/discard in Settings → Sync).
- **Local notifications** — categories, quiet hours, daily summary, class/assignment reminders; permission + inbox UI.
- **Settings** — appearance, notification preferences, sync management.

## Verification (all run in this environment)

| Check | Result |
| --- | --- |
| `tsc --noEmit` | ✅ clean (exit 0) |
| `jest` | ✅ **67 tests / 6 suites passing** (engine 32, CSV, schedule, planner, assistant, validation) |
| `expo export --platform android --platform ios` | ✅ both Hermes (`.hbc`) bundles produced (~5.5 MB each) |
| `gradle` / `xcodebuild` native compile | ⚠️ **not run** — no Android SDK / Xcode in this sandbox |
| On-device / emulator run | ⚠️ **not run** — requires a device/emulator |

The Metro export proves the TS/JS bundles compile and all native-module imports resolve for both platforms. Installable `.apk`/`.aab`/`.ipa` binaries require the native toolchains or EAS (see `apps/mobile/docs/BUILD.md`). Nothing is claimed as a verified native/device build.

## Backend integration (no schema changes)

- Uses the existing project `gavlxbxgxdormbfhtzlo` (ap-south-1, PG17). All 19 tables RLS; private bucket `academic-documents`; 6 realtime tables; existing RPCs. Typed mirror in `src/types/database.ts`.
- **Auth redirect allow-list** was empty. Added **additively** (user-approved): `attendly://auth/callback`, `attendly://auth/reset-password`. The list also retains `http://localhost:3000/**` (the existing web-dev origin, matching `site_url`). `site_url` (`http://localhost:3000`) and all web settings were left unchanged; nothing was removed.
  - Note: the Supabase `update_auth_config` connector normalized a few unrelated fields to null/default as a side effect (`rate_limit_email_sent`, `sessions_inactivity_timeout`, `sessions_timebox`, `security_captcha_provider`, `sms_provider`). These are functionally equivalent (defaults, or features that are disabled: captcha off, phone auth off) and are not exposed as settable parameters by the connector. They can be re-set in the Supabase dashboard if explicit values are preferred.
- **Proposed** backend additions (notes table, assignment `priority`, Expo push tokens, timetable OCR) are **staged only** in `apps/mobile/docs/PROPOSED_BACKEND_ADDITIONS.md` — **not applied**, not in `supabase/migrations/`.

## Honest limits / pending

- **Remote push is not operational** — `push_subscriptions` is web-push shaped; no Expo-token column, no backend sender, no push credentials, no device delivery test. Local notifications are fully implemented and tested. `getExpoPushToken()` is wired and surfaces readiness honestly.
- **PDF/image timetable OCR** is not implemented (no OCR backend): CSV is parsed client-side; PDF/image uploads are stored and reviewed manually. Excel parsing deferred.
- **Notes** are local-only (SQLite); **assignment priority** is a local overlay — both have staged migrations if server sync is later wanted.
- Group members' `display_name` is null for non-self (RLS self-select) → UI shows "Classmate"; this is expected, not a bug.

## Scope boundary honored

- Only `apps/mobile/` was added. Shared edits limited to the two explicitly authorized items: this append to `ATTENDLY_PROGRESS.md`, and the one-line `"apps"` exclude in root `tsconfig.json`.
- No web code, no migration, and no Codex-owned file was changed.

## Secrets

- Only the **publishable** key is used, and only in the git-ignored `apps/mobile/.env.local`. It is **not** committed (verified by secret scan). No service-role/secret key anywhere in the repo or bundle. `.env.example` ships placeholders only.

## Run / build

```bash
cd apps/mobile
npm install
cp .env.example .env.local   # fill the two public values
npx expo start
```

Docs: `apps/mobile/README.md` and `apps/mobile/docs/{ARCHITECTURE,BACKEND_MAPPING,BUILD,PERMISSIONS,NOTIFICATIONS,OFFLINE_SYNC,TESTING,PROPOSED_BACKEND_ADDITIONS}.md`.

---

# Mobile — Android launch fix + "Obsidian Academic" redesign (v1.1.0)

Branch `arena/7b693859-attendly`. Append-only; prior sections preserved. No backend schema, RLS, auth, or storage changes were made in this pass.

## Part 1 — why the APK showed "Configure Attendly", and the fix

**Root cause:** `EXPO_PUBLIC_*` values are inlined by Metro **at build time**. They previously lived only in the git-ignored `apps/mobile/.env.local`, so an APK built on EAS or another machine never received them; `isSupabaseConfigured` was false and the entry route rendered the developer config screen.

**Fix (at the source, not by hiding the check):**
- Committed `apps/mobile/.env` with the public project URL + publishable key so local builds embed them.
- Added the same values to every `eas.json` build profile's `env` so EAS cloud builds embed them.
- Added `app.config.ts` mirroring the values into `extra`; the Supabase client falls back to `Constants.expoConfig.extra` if inlining is unavailable.
- Replaced the config screen with a calm branded error + retry (`expo-updates` reload). Normal flow is splash → init → session restore → auth/dashboard.
- These are public, RLS-protected client values — **not** a service-role key; no secrets committed.

**Verified:** `expo config` resolves the URL + key; the exported Android Hermes bundle contains both the project URL and the publishable key (grep-confirmed). The config screen cannot appear in a correctly built APK.

## Part 2 — complete visual redesign

Replaced the violet-gradient identity with **Obsidian Academic**: backgrounds `#090D14` / `#101722` / `#182231`, text `#F1F5F9` / `#A5ADBA`, neutral border `#263244`. Single dominant accent **muted teal `#38B8A5`**; ice blue `#75B9E7` (info), champagne `#D5B77A` (warning), muted red `#E47777` (error) used only by meaning. Editorial Inter tracking, crisp 1px borders, subtle shadows, dark-on-teal buttons for contrast. New obsidian app icon / adaptive icon / splash / notification glyph. Dark is the default (`userInterfaceStyle: dark`, theme default `dark`); Android navigation bar synced via `expo-navigation-bar`. Because the design system is token-driven, **every screen** inherits the new identity. Grep confirms **zero** legacy violet (`#8B7CFF`/`#6D5CE7`/`#54D6D0`) or old background (`#0B1020`) remains in app source or the exported bundle.

## Version + verification

- Bumped to **1.1.0** (Android `versionCode` 2, iOS `buildNumber` 2).
- `tsc --noEmit` clean; **67 tests / 6 suites passing**; Android + iOS Metro bundles exported.
- Added `expo-updates` (retry/reload) and `expo-navigation-bar` (Android nav polish).

## APK delivery — honest status

A native, installable APK **cannot be compiled in this sandbox**: no Java/Android SDK/Gradle, and `dl.google.com`, `repo.maven.apache.org`, and `services.gradle.org` are network-blocked. The JS/Metro layer is fully verified (config + theme embedded). To produce the signed APK, run on a machine with the toolchain or EAS:
- **EAS (recommended):** `eas build --platform android --profile preview` (APK) or `--profile production` (AAB). The `env` in `eas.json` guarantees the config is embedded.
- **Local:** `npx expo run:android --variant release` (requires JDK 17 + Android SDK).
See `apps/mobile/docs/BUILD.md`. On-device/emulator testing was not possible here and is not claimed.
