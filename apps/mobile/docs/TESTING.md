# Testing

## Run

```bash
npm test          # jest (jest-expo preset)
npm run typecheck # tsc --noEmit
```

## Current result

```
Test Suites: 6 passed, 6 total
Tests:       67 passed, 67 total
```

TypeScript: **clean** (`tsc --noEmit`, exit 0).
Metro export: **both** Android and iOS Hermes bundles produced.

## Coverage by suite

| Suite | File | What it proves |
| --- | --- | --- |
| Attendance engine | `src/lib/attendance/__tests__/engine.test.ts` | 32 tests: conducted/denominator rules, unmarked ≠ absent, excused handling, cancelled/rescheduled exclusion, bunk allowance, recovery (incl. 100%-target unrecoverable), what-if simulation, fixed/rolling projections, hours mode |
| CSV import | `src/lib/import/__tests__/csv.test.ts` | quoted fields, CRLF, weekday aliases, 12h times, row-level errors without dropping valid rows, header validation, academic-day kinds |
| Schedule | `src/lib/schedule/__tests__/generate.test.ts` | rule expansion, holiday/non-instructional skipping, validity windows, idempotent generation, timetable diff (add/remove/change), overlap conflict detection |
| Notification planner | `src/lib/notifications/__tests__/planner.test.ts` | daily summary, class reminders at correct lead time, overnight quiet hours, cancelled-class skipping, assignment reminders, disabled preferences |
| Assistant | `src/lib/assistant/__tests__/answers.test.ts` | deterministic intents, no-semester prompt, overall %, at-risk detection, recovery answers, graceful fallback (never throws) |
| Validation | `src/lib/__tests__/validation.test.ts` | signup (matching passwords, min length 6), semester date order, course color/mode, event time order, invite-code format |

## Philosophy

All business logic lives in `src/lib/*` as **pure functions** with no React, network, or device dependencies, so it is exhaustively unit-testable in CI without an emulator. UI screens are thin wrappers over hooks/services.

## Not covered here (requires device/toolchain)

- Native module behavior on a real device (SecureStore, SQLite, notifications delivery, print/share).
- End-to-end Supabase RLS enforcement (verified live read-only against the real project; full E2E needs a device + test account).
- Remote push delivery (no backend sender / credentials — see `NOTIFICATIONS.md`).

These are documented honestly rather than claimed as passing.
