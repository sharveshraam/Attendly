# Architecture

## Layering

```
app/                      Expo Router routes (screens only — thin)
  (auth)/                 welcome, sign-in, sign-up, forgot/verify
  auth/                   deep-link targets: callback, reset-password
  onboarding/             semester → courses → timetable → review
  (tabs)/                 Home, Calendar, Attendance, Groups, Profile
  courses/ productivity/ groups/ events/ tools/ settings/
  analytics assistant notifications
src/
  components/ui/          design-system primitives (Screen, Button, Card, …)
  components/domain/      domain widgets (CourseCard, MonthGrid, Charts, …)
  hooks/                  React Query + orchestration (useAuth, useOfflineQuery, …)
  services/
    supabase/             client, secure-storage adapter, auth helpers
    api/                  one module per backend area (typed Supabase calls)
    sync.ts               outbox processor + conflict detection
    realtime.ts           Supabase realtime subscriptions
    notifications.ts      local notification scheduling + permissions
    reports.ts            CSV + PDF (expo-print) via native Sharing
    import.ts             CSV → timetable rules / academic days
  database/               expo-sqlite: cache, outbox, notes, assignment_meta
  store/                  Zustand: session, sync status, preferences
  lib/                    PURE logic (no React, no I/O) — heavily unit-tested
    attendance/engine.ts  the attendance mathematics
    schedule/generate.ts  rule expansion, diff, conflict detection
    import/csv.ts         CSV parsing
    notifications/planner.ts  notification planning (quiet hours)
    assistant/answers.ts  deterministic Q&A
    dates.ts validation.ts
  theme/                  exact palette, system/light/dark
  types/                  Database mirror + domain types
```

**Rule of thumb:** screens call hooks; hooks call services; services call Supabase or SQLite. All non-trivial math lives in `src/lib/*` as pure functions so it can be tested without a device or network.

## Data flow

1. **Reads** go through `useOfflineQuery` (a React Query wrapper). It returns the SQLite-cached value instantly as `placeholderData`, then refreshes from Supabase and writes the fresh result back to the cache. Offline, the cached value keeps the UI usable.
2. **Writes** that must work offline (attendance marks, event edits, assignments) are written to the SQLite **outbox** first, applied optimistically to the cache, then replayed by `services/sync.ts` when online.
3. **Realtime** subscriptions invalidate the relevant React Query keys so other devices / group members see changes.

## State

- **React Query** — server/cache state (courses, sessions, stats, groups…). `offlineFirst`, `staleTime 30s`, `gcTime 10m`, `retry 1` (mutations `retry 0`).
- **Zustand** — `useSessionStore` (auth/session), `useSyncStore` (online, pending/conflict counts, last sync), `usePreferencesStore` (local notification settings).
- **SQLite** — durable cache + outbox + local-only notes + assignment priority overlay. WAL mode.

## Attendance semantics (engine)

- `conducted = present + absent + excused`; **denominator = present + absent** (excused is conducted but not counted against you).
- `unmarked` is **never** treated as absent.
- `cancelled` sessions are excluded; a `rescheduled` original is excluded and its replacement counts once.
- A 100% target is unrecoverable after any miss (recovery returns `null`).
- Hours mode uses attended/counted minutes; class mode uses counts.
- Projections: `fixed` assumes all future scheduled classes are attended (best) or missed (worst); `rolling` projects from the recent rate.

## Offline & sync

See [`OFFLINE_SYNC.md`](OFFLINE_SYNC.md). Conflict detection compares the server's `marked_at` / `updated_at` against the version captured when the offline edit was queued; newer server data is never silently overwritten. Conflicts surface in **Settings → Sync** for manual keep/discard.

## Security

- Auth tokens stored via a **chunked** `expo-secure-store` adapter (SecureStore's ~2KB value limit is handled by splitting the session JSON).
- Only the **publishable** key ships in the client. RLS enforces that attendance is owner-private and groups share schedules only.
- No service-role key, no secrets in the repo or bundle.
