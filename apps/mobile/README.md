# Attendly Mobile

Native **Android + iOS** attendance and academic planner built with **React Native + Expo (SDK 58) + Expo Router + TypeScript**, backed by the existing Attendly **Supabase** project. This app lives entirely in `apps/mobile/` and does not modify the website or the shared backend schema.

> Attendance is private. Groups share **schedules only** — never attendance. All access is enforced by Supabase Row-Level Security; the client never holds a service-role key.

---

## What's inside

- **Auth** — email/password register, login, email verification, password reset, logout, and secure session restore (chunked `expo-secure-store`, device keystore/keychain).
- **12-step onboarding** — semester, courses, timetable (CSV import + manual), academic calendar, review/conflict check. Optional steps are skippable.
- **Calendar** — month / week / day / agenda views, academic-day classifications, recurring timetable rules kept separate from dated sessions.
- **Attendance engine** — independent, unit-tested TypeScript logic. Bunk / recovery / what-if calculators, per-course targets, hours mode, fixed/rolling projections.
- **Dashboard, course pages, groups** (invite-code RPC), **productivity** (assignments, exams, notes, events), **analytics** with CSV/PDF export via native sharing.
- **Deterministic AI assistant** — answers from your real data, no external AI, no invented numbers.
- **Offline-first** — SQLite cache + durable sync outbox with version-based conflict resolution.
- **Local notifications** — categories, quiet hours, daily summary, class/assignment reminders.

## Quick start

```bash
cd apps/mobile
npm install                 # versions are fully pinned in package.json
cp .env.example .env.local  # then fill in the two public values (see below)
npx expo start              # dev server (Expo Go / dev client)
```

### Environment

Only **public** (browser-safe, RLS-protected) values are needed. Never put a service-role or secret key here.

```
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

`.env.local` is git-ignored at every level. If the values are missing the app shows a configuration screen instead of crashing.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm test` | Jest unit tests (attendance engine, CSV, schedule, planner, assistant, validation) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run export:android` / `export:ios` | Metro bundle proof (`expo export`) |
| `npm run build:android` / `build:ios` | EAS native build (requires EAS login + credentials) |

## Verified in this environment

- ✅ `tsc --noEmit` — clean
- ✅ `jest` — **67 tests, 6 suites, all passing**
- ✅ `expo export --platform android --platform ios` — both Hermes bundles produced
- ⚠️ Native compile (`gradle` / `xcodebuild`) and on-device runs are **not** possible in this sandbox (no Android SDK / Xcode). See [`docs/BUILD.md`](docs/BUILD.md) for the exact local/EAS steps.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — structure, data flow, state, offline
- [`docs/BACKEND_MAPPING.md`](docs/BACKEND_MAPPING.md) — screen → table → API map, RLS notes
- [`docs/BUILD.md`](docs/BUILD.md) — EAS + local builds, credentials, deep links
- [`docs/PERMISSIONS.md`](docs/PERMISSIONS.md) — native permissions and why
- [`docs/NOTIFICATIONS.md`](docs/NOTIFICATIONS.md) — local vs remote push status
- [`docs/OFFLINE_SYNC.md`](docs/OFFLINE_SYNC.md) — outbox + conflict resolution
- [`docs/TESTING.md`](docs/TESTING.md) — coverage and how to run
- [`docs/PROPOSED_BACKEND_ADDITIONS.md`](docs/PROPOSED_BACKEND_ADDITIONS.md) — **staged, not applied** migrations

## Scope boundary

This mobile agent owns `apps/mobile/` only. The website, `supabase/migrations/`, and root config are owned by the web agent (Codex). The only shared edits made here were explicitly authorized: an append to `ATTENDLY_PROGRESS.md` and a one-line `apps` exclude in the root `tsconfig.json`. Proposed backend additions are staged under `docs/` and are **not** applied.
