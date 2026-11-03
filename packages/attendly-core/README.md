# @attendly/core

The **single source of truth** for Attendly's automatic academic-structure
detection and class calculation. No React, no Supabase, no browser APIs, no
Node APIs, no I/O. The same TypeScript runs on the website and in the
Android/iOS app, which is what guarantees identical expected-class counts.

| Module | Responsibility |
| --- | --- |
| `types.ts` | Shared data shapes (courses, slots, rules, exceptions, sessions, counts). |
| `dates.ts` | UTC date-key arithmetic; no `Date` local-time drift, no DST assumptions. |
| `text.ts` | Weekday, time, course-code, name, session-type, room and faculty detection. |
| `grid.ts` | Row / matrix / transposed / free-text timetable interpretation, lab-block merging, course deduplication, uncertainty flags. |
| `calendar.ts` | Academic-calendar interpretation and deterministic one-date exceptions. |
| `engine.ts` | Generates dated sessions from the weekly template + exceptions; computes scheduled / conducted / attended / absent / cancelled / pending counts. |
| `idempotency.ts` | Deterministic `source_key` builders for courses, rules, sessions, exceptions and uploads. |
| `attendance.ts` | Verbatim copy of the canonical attendance rules (denominator `present + absent`, `excused` excluded, `unmarked` pending). Never edited without changing BOTH apps. |

## Consumers

- **Web:** `lib/academic/*.ts` are thin re-export shims. `lib/academic/bridge.ts`
  and `lib/academic/formats/*` are web-only adapters (Supabase row shapes,
  XLSX/PDF/OCR/hash). The Next.js dashboard and the 8-step wizard import the
  shims, so they execute this exact code.
- **Mobile:** `apps/mobile/src/lib/academic/index.ts` re-exports this package and
  `apps/mobile/src/lib/academic/structure.ts` maps mobile Supabase rows into the
  same `EngineInput`. See that folder's README for the Expo Metro configuration.

## Rules that must not change

1. A weekly timetable entry is a **prediction**, not proof a class was conducted.
   Only confirmed present/absent/excused marks feed the attendance percentage.
2. Expected counts are computed from **generated dates**, never `weeks × weekly count`.
3. Explicit calendar exceptions override the weekly template. A Saturday that
   follows Monday's timetable runs Monday's rules *once* on that Saturday.
4. Ambiguous rows keep their original text and require human confirmation;
   nothing is invented.
5. All persistence uses deterministic `source_key`s and RLS; no service-role
   credentials ever appear in a client.
