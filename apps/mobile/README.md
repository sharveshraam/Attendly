# Attendly Mobile

Native **Android + iOS** attendance and academic planner built with **React Native + Expo (SDK 58) + Expo Router + TypeScript**, backed by the existing Attendly **Supabase** project. This app lives entirely in `apps/mobile/` and does not modify the website or the shared backend schema.

> Attendance is private. Groups share **schedules only** — never attendance. All access is enforced by Supabase Row-Level Security; the client never holds a service-role key.

**Design identity: "Obsidian Academic."** A deep obsidian dark theme (`#090D14` / `#101722` / `#182231`) with a single restrained **muted-teal** accent (`#38B8A5`), editorial Inter typography, subtle borders and minimal visual noise. Ice blue, champagne and muted red are reserved for info / warning / error meaning. No violet gradients.

---

## What's inside

- **Auth** — email/password register, login, email verification, password reset, logout, and secure session restore (chunked `expo-secure-store`, device keystore/keychain).
- **Onboarding** — semester, courses, timetable (CSV import + manual), academic calendar, review/conflict check. Optional steps are skippable.
- **Calendar** — month / week / day / agenda views, academic-day classifications, recurring timetable rules kept separate from dated sessions.
- **Attendance engine** — independent, unit-tested TypeScript logic. Bunk / recovery / what-if calculators, per-course targets, hours mode, fixed/rolling projections.
- **Dashboard, course pages, groups** (invite-code RPC), **productivity** (assignments, exams, notes, events), **analytics** with CSV/PDF export via native sharing.
- **Deterministic AI assistant** — answers from your real data, no external AI, no invented numbers.
- **Offline-first** — SQLite cache + durable sync outbox with version-based conflict resolution.
- **Local notifications** — categories, quiet hours, daily summary, class/assignment reminders.

## Launch flow

Native splash → app init → session restore → **auth screen** (signed out) or **dashboard** (signed in). A build missing its public backend config shows a calm branded error with a retry — never a developer setup screen. With the committed build-time config (below) this error state is not expected in a correctly built APK.

## Quick start

```bash
cd apps/mobile
npm install          # versions are fully pinned in package.json
npx expo start       # dev server (Expo Go / dev client)
```

### Configuration — why the APK no longer shows "Configure Attendly"

`EXPO_PUBLIC_*` values are **inlined by Metro at build time**. Previously they lived only in a git-ignored `.env.local`, so an APK built on EAS or another machine never received them and fell back to the config screen. That is now fixed at the source:

- **`apps/mobile/.env` is committed** with the public project URL + publishable key, so every local build embeds them.
- **`eas.json` sets the same values in each build profile's `env`**, so EAS cloud builds embed them too.
- **`app.config.ts` mirrors them into `extra`**, and the Supabase client falls back to `Constants.expoConfig.extra` if inlining is ever unavailable.

These are **public, RLS-protected client values — not secrets and not a service-role key.** `.env.local` (git-ignored) can still override them locally. Verified: the exported Android Hermes bundle contains both the project URL and the publishable key.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm test` | Jest unit tests (attendance engine, CSV, schedule, planner, assistant, validation) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run bundle:android` / `bundle:ios` | Metro bundle proof (`expo export`) |

## Verified in this environment

- ✅ `tsc --noEmit` — clean
- ✅ `jest` — **67 tests, 6 suites, all passing**
- ✅ `expo export` Android + iOS — both Hermes bundles produced
- ✅ Supabase URL + publishable key **embedded in the Android bundle**; obsidian theme present; legacy violet absent
- ⚠️ Native compile (`gradle` / `xcodebuild`) and on-device runs are **not** possible in this sandbox (no Android SDK / Xcode / Java, and the Google/Gradle/Maven hosts are network-blocked). See [`docs/BUILD.md`](docs/BUILD.md) for the exact local/EAS steps to produce the APK.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — structure, data flow, state, offline
- [`docs/BACKEND_MAPPING.md`](docs/BACKEND_MAPPING.md) — screen → table → API map, RLS notes
- [`docs/BUILD.md`](docs/BUILD.md) — EAS + local builds, credentials, deep links, config fix
- [`docs/PERMISSIONS.md`](docs/PERMISSIONS.md) — native permissions and why
- [`docs/NOTIFICATIONS.md`](docs/NOTIFICATIONS.md) — local vs remote push status
- [`docs/OFFLINE_SYNC.md`](docs/OFFLINE_SYNC.md) — outbox + conflict resolution
- [`docs/TESTING.md`](docs/TESTING.md) — coverage and how to run
- [`docs/PROPOSED_BACKEND_ADDITIONS.md`](docs/PROPOSED_BACKEND_ADDITIONS.md) — **staged, not applied** migrations

## Scope boundary

This mobile agent owns `apps/mobile/` only. The website, `supabase/migrations/`, and root config are owned by the web agent (Codex). Shared edits are limited to the explicitly authorized items: appends to `ATTENDLY_PROGRESS.md` and the one-line `apps` exclude in the root `tsconfig.json`. Proposed backend additions are staged under `docs/` and are **not** applied.
