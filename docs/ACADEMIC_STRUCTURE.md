# Automatic academic-structure detection & class calculation

_Added 2026-11-03 on `arena/6fedf57b-attendly`._ Full design, verification and
honest limits in one place.

## What it does

A student uploads a weekly timetable and (optionally) an academic calendar.
Attendly interprets them **locally in the browser**, shows every detected course
and exception with the **original extracted text**, lets the user correct or
confirm anything ambiguous, generates the semester's dated sessions from real
calendar dates, and only then writes courses, weekly rules, calendar exceptions
and class events through owner-scoped RLS. The dashboard is populated
automatically; manual course creation, manual weekly counts and manual CSV
import all remain available as fallbacks.

Entry points:

| Where | Path |
| --- | --- |
| 8-step web wizard | `app/(app)/academic/page.tsx` → `components/academic-structure.tsx` |
| Dashboard overview | `components/academic-overview.tsx` (rendered on `/home`) |
| Navigation / onboarding links | `components/app-shell.tsx`, `app/(app)/onboarding/page.tsx` |
| Pure shared engine (web + Android/iOS) | `packages/attendly-core/src/*` |
| Web row/format adapters | `lib/academic/bridge.ts`, `lib/academic/formats/*` |
| Mobile adapter | `apps/mobile/src/lib/academic/{index,structure}.ts` |
| RLS data gateway | `lib/data.ts` |
| Additive migrations | `supabase/migrations/0004…0006_*` |
| Tests | `tests/academic-structure.test.ts`, `tests/mobile-parity.test.ts`, `tests/proxy-routes.test.ts` |

## The eight steps

1. **Upload timetable** — CSV/TSV, `.xlsx`, text-layer PDF, image (local OCR), or
   paste rows. Private provenance copy in the existing `academic-documents`
   bucket; SHA-256 content hash makes repeated uploads idempotent.
2. **Detected courses** — course name, code, faculty, days, weekly session count
   and session types, deduplicated by normalised code (or normalised name when
   there is no code).
3. **Review timetable** — every field and every row is editable; ambiguous rows
   are listed with their original text and must be explicitly confirmed; new
   rows can be added manually.
4. **Upload calendar** — semester bounds, holidays, exams, vacations, closures,
   special working Saturdays and replacement timetables. Skippable.
5. **Review calendar** — full-day vs partial-day holidays (with hours), which
   weekday a replacement day follows, plus one-off additional classes,
   cancellations and reschedules. Unresolved rows stay unsaved.
6. **Generate schedule** — the engine expands the weekly template onto every
   date in the semester and applies exceptions.
7. **Review structure** — course-wise expected counts, weekly distribution,
   first dated sessions, existing-workspace census, then Confirm.
8. **Dashboard ready** — courses, rules, exceptions, dated events, projection
   snapshot and audit log are written; the dashboard shows them.

## Centralised engine

`packages/attendly-core/src/engine.ts` is the **only** place that turns weekly
rules + calendar exceptions into dated sessions and counts. Precedence per date:

1. Explicit one-off additions / replacement-day schedules.
2. Explicit cancellations / partial closures / holidays / exams / vacations.
3. The normal weekly template for the effective weekday.

A "Saturday follows Monday timetable" runs Monday's rules **once** on that
Saturday and suppresses Saturday rules; the original Monday sessions are not
duplicated. Unconfirmed exceptions never change counts. A partial closure with
no hours is ignored with a warning — hours are never invented. Mid-semester
timetable changes use `validFrom`/`validUntil` rule windows
(`applyTimetableRevision`). Expected counts come from generated **dates**, never
`weeks × weekly count`.

Distinct concepts are kept separate: `scheduled`, `conducted`, `attended`,
`absent`, `excused`, `cancelled`, `rescheduled`, `pending`. A timetable entry is
**not** proof a class was conducted; only confirmed marks feed the percentage.
The canonical attendance rules (`packages/attendly-core/src/attendance.ts`, a
verbatim copy of `lib/attendance/engine.ts`) are unchanged: denominator
`present + absent`, `excused` conducted but excluded, `unmarked` never an
absence, cancelled/rescheduled originals excluded, replacement counts once.

Performance: `computeScheduleCached()` fingerprints the input and reuses a
bounded cache; `changedDates()`, `affectedDatesForRule()` and
`affectedDatesForException()` support incremental recomputation; the generated
projection is saved in `semester_snapshots`; the shared
`expected_class_counts(uuid,date,date)` security-invoker RPC gives both apps
the server-side counts without a second expansion. No service-role credential
is used anywhere.

## Formats (all local, no extraction service, no Edge Function)

| Format | Implementation | Honest limit |
| --- | --- | --- |
| CSV / TSV / pasted text | `parseCsv` + shared grid interpreter | — |
| `.xlsx` / `.xlsm` | `fflate` unzip + local OOXML sheet parser | Legacy binary `.xls` is reported as unsupported. |
| PDF | FlateDecode + text-position operator walker | **Text layer only.** Scanned/image-only PDFs return "no readable text" and offer OCR or manual entry. |
| PNG/JPG/WEBP | Local Tesseract.js worker + vendored WASM/`eng.traineddata.gz` | Low-confidence by design: every OCR row requires confirmation. Assets are generated by `npm run vendor:ocr` / `postinstall`, gitignored, and not cached by the service worker. Runtime WASM/browser behaviour was not E2E-verified here. |

`next.config.ts` CSP adds only `'wasm-unsafe-eval'` to `script-src` (no
`unsafe-eval`); `worker-src 'self'` is unchanged.

## Data model (additive only, live project `gavlxbxgxdormbfhtzlo`)

Existing 19 tables, 42 policies, RLS, Storage bucket, Auth settings and API
keys are untouched. Three tested additive migrations:

- `20261103114905_academic_structure_detection` — 24 new nullable/defaulted
  columns on `courses`, `timetable_rules`, `academic_days`, `calendar_events`,
  `document_uploads`; 9 indexes; the `expected_class_counts` RPC.
- `20261103115030_academic_structure_upsert_indexes` — recreates the five
  unique `source_key` indexes **without** a partial predicate so PostgREST can
  infer them as `ON CONFLICT` targets.
- `20261103115301_academic_exception_payload` — `academic_days.extra_data jsonb`.

Local mirrors: `supabase/migrations/0004…0006_*.sql`. Because
`academic_days(semester_id, day)` is unique, several exceptions on one date are
stored as **one** row whose `extra_data.exceptions` holds every confirmed
fragment; both adapters expand it back. Deterministic `source_key`s plus
`ignoreDuplicates` make repeated imports a no-op without overwriting a user's
manual edits.

Verified live after applying: `academic_days.extra_data` is `jsonb`, 9/9 new
indexes present and non-partial, 42 policies, 0 tables with RLS off, RPC
`authenticated` EXECUTE true / `anon` false, migration history has all five
entries, and the row census is unchanged (1 auth user, 1 profile, 0 rows in all
other public tables). A rolled-back PL/pgSQL transaction validated the exact
persistence payload: repeated course/rule/upsert/document inserts stayed at
`1/1/1/1`, cross-midnight `ends_at > starts_at` passed, and the RPC returned
`scheduled=1, attended=1, pending=0, percent=100.0` for a present mark. A
second query confirmed **no test rows remain**.

## Web / Android parity

`lib/academic/{types,dates,text,grid,calendar,engine,idempotency,index}.ts` are
thin re-export shims of `packages/attendly-core`. The mobile adapter imports the
same package, maps the same Supabase rows into the same `EngineInput`, and calls
the same RPC. `tests/mobile-parity.test.ts` asserts:

- web shims contain **no** business logic;
- the shared attendance file is byte-identical to the canonical web engine and
  `summarize()` outputs match;
- web, shared core and mobile produce **identical** `ScheduleResult` values;
- both adapters generate identical `source_key`s, statuses and timestamps;
- the mobile adapter uses the RLS RPC and contains no service-role string.

`apps/mobile/src/lib/academic/README.md` documents the Expo Metro
`watchFolders` / `nodeModulesPaths` configuration needed when the mobile tree
is checked out, and the screen contract.

## Verification

- `npm run typecheck` — clean.
- `npm run lint` — clean (0 warnings).
- `npm test` — 119 TypeScript tests + 6 legacy tests, all passing (29 academic
  scenarios, 6 parity guards, 4 migration guards, 1 proxy guard).
- `npm run build` — 29 routes, including `/academic`.
- `npm audit --omit=dev` — 0 vulnerabilities.
- Local HTTP smoke — public pages 200, private routes 307 →
  `/login?next=…`, CSP unchanged except `'wasm-unsafe-eval'`.

## Honest limits / not claimed

- **No real-account browser E2E** of the wizard, no hosted SSO route check, no
  production deployment, no DNS/main merge, no APK rebuild or deploy.
- **Mobile UI screens and APK were not modified.** The mobile app source tree is
  not checked out on this branch; the shared core and the mobile data-layer
  adapter are implemented, type-checked and parity-tested here, with the Expo
  configuration and screen contract documented. No claim that a mobile screen
  already renders this flow.
- **PDF extraction is text-layer only**; scanned PDFs need image OCR or manual
  entry. **OCR runtime/WASM/browser/Service-Worker behaviour was not verified**
  in a real browser; the service worker caches only the static shell, so
  offline OCR is not claimed.
- A single `academic_days` row per date is kept; conflicting same-day exceptions
  are stored in `extra_data`, not as separate rows.
- `0003` contains broad `anon` DML grants despite the standing "no broad anon
  grants" constraint. This remains **unresolved**; all 42 policies are
  `to authenticated`, so `anon` still sees/writes zero rows. Nothing was
  silently revoked or reapplied.
- Attendance rules, institution-specific attendance policies, Auth settings,
  API keys, RLS policies, Storage objects and production rows were not changed.
