# Testing

## Commands and observed results (2026-11-03)

| Command | Result |
| --- | --- |
| `npm run typecheck` | pass, 0 errors |
| `npm run lint` | pass, 0 warnings/errors |
| `npm test` | 74 TypeScript tests + 6 legacy tests: **80/80 pass** |
| `npm run test:legacy` | 6/6 pass |
| `npm run build` | pass; 28 routes, 16 static pages, Turbopack |
| `npm audit --omit=dev` | **0 vulnerabilities** |
| `npm audit` (full) | 16 moderate dev-only advisories (eslint / typescript-eslint / minimatch); `npm audit fix` suggests downgrades and was not applied |
| HTTP smoke test | 27 routes/assets returned 200, including all public/auth/app routes, `/manifest.webmanifest`, `/sw.js`, `/offline.html`, four PNG icons and the SVG icon |

> **After the Supabase link (2026-11-03):** the 10 authenticated app routes now
> correctly return `307` → `/login?next=…` for an anonymous visitor (the server
> client works, `getUser()` is null, `proxy.ts`/layout redirect). Public, auth,
> offline, manifest, SW, SVG and all four PNG assets still return `200`. The
> earlier all-200 row above describes the pre-link build, where the missing env
> produced an explicit setup state instead of a redirect.
| Header check | security headers + CSP present; `/sw.js` no-cache + `Service-Worker-Allowed`; manifest `application/manifest+json` |

## Test files

- `tests/attendance.test.ts` — engine parity with mobile, unmarked/excused/
  cancelled/rescheduled rules, hours mode, bunk/recovery, 100% target, projections,
  risk, what-if scenarios, `percentAfterMissingOne`, legacy adapter agreement.
- `tests/schedule.test.ts` — weekday expansion, idempotency, academic-day
  exclusions, validity windows, rolling semesters, timetable diff, conflicts.
- `tests/csv.test.ts` — RFC-4180 quoting, weekday/time aliases, header validation,
  invalid rows, impossible calendar dates.
- `tests/validation.test.ts` — auth/domain schemas, upload extension/size/MIME.
- `tests/assistant.test.ts` — deterministic answers with synthetic real-shaped
  data; no invented percentages; honest empty/setup states.
- `tests/reports.test.ts` — CSV escaping, ICS, semester summary, HTML escaping in
  printable report.
- `tests/offline.test.ts` — outbox dedupe, overlay, successful sync, read/write
  errors, newer-server conflict, explicit keep-local/discard-local, offline guard,
  per-user cache enable/disable/clear, removal semantics.
- `tests/privacy.test.ts` — static guards: no service-role/privileged secrets in
  browser code, all `attendance_records` access owner-scoped, group schedule
  functions never read attendance, group pages never load private stats, SW
  private/static guards, public-only client config.
- `tests/attendance-engine.test.js` — original six legacy adapter tests.

Run all: `npm test`. Run only the modern suite:
`node --experimental-strip-types --test tests/*.test.ts`.

## Integration / E2E not run

The following require a disposable authenticated test account and a hosted Auth
redirect origin, neither of which was available without owner-approved backend
config changes. They are **not claimed as passing**:

- signup → confirmation → sign-in → session persistence → logout;
- recovery/reset round trip;
- semester/course/timetable/attendance CRUD under RLS with two separate users;
- group privacy: a second member must not see another user's attendance;
- Realtime invalidation across two tabs/devices;
- offline mark → reconnect → sync, including a conflict created by a second
  device;
- CSV upload → human review → apply → generated sessions;
- PWA install, SW update, offline navigation, responsive widths (360/768/1440),
  light/dark theme and print report in real browsers.

Use only safe test accounts/environments. **Never test with real production user
data**, never disable RLS and never apply migrations for tests. When a test
project is available, the recommended order is: auth → single-user CRUD →
two-user privacy → realtime → offline/conflict → browser/PWA matrix.

## Manual smoke checklist (local production server)

```bash
npm run build && npm run start
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/
curl -s http://localhost:3000/manifest.webmanifest | head -c 200
```

All public routes should render, authenticated routes should show the login
redirect or the explicit configuration state, and no page should display
fabricated metrics.
