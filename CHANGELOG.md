# Changelog

## 2026-11-03 — Website implementation (branch `arena/6fedf57b-attendly`)

### Added
- Public site: landing, features, about, privacy, terms, support.
- Auth: email/password signup + confirmation, sign-in, forgot/reset password,
  verify-email with real confirmation resend, `/auth/callback` for PKCE,
  `token_hash`+`type` and implicit redirects, session persistence and sign-out.
- Authenticated app: onboarding wizard, dashboard, courses + course detail,
  calendar (month/week/day/agenda/semester, timetable rules, uploads, session
  generation, history, academic days), attendance (mark/bunk/recovery/what-if/
  history), groups (create/join, shared schedule, proposals, polls, members,
  history), productivity (assignments, exams, device-local notes/priority,
  events), analytics (charts, heatmap, risk ranking, CSV/ICS/print exports),
  deterministic on-device assistant, notification center, settings.
- PWA: `app/manifest.ts`, four generated PNG icons, `public/sw.js` (static-shell
  only), `public/offline.html`, `/offline`, install/update/offline banners,
  theme (light/dark/system), toasts, command palette.
- Domain modules: canonical attendance engine + legacy adapter, schedule
  generation/diff/conflicts, RFC-4180 CSV parsers, date helpers, Zod validation,
  CSV/ICS/printable reports, deterministic assistant, offline outbox/private
  cache, single `lib/data.ts` gateway, `hooks/use-workspace.tsx`.
- Tests: 74 new TypeScript tests (attendance, schedule, CSV, validation,
  assistant, reports, offline, privacy) plus the original 6 legacy tests.
- Config: `next.config.ts` security headers/CSP, `proxy.ts` SSR guard,
  `eslint.config.mjs`, `postcss.config.mjs`, `.env.example` placeholders,
  `.gitignore` additions, `engines.node >=22`.
- Docs: `docs/AUDIT.md`, `ARCHITECTURE.md`, `TECH_DECISIONS.md`,
  `KNOWN_ISSUES.md`, `AGENT_HANDOFF.md`, `SECURITY.md`, `CHANGELOG.md`,
  `docs/SETUP.md`, `docs/TESTING.md`, `docs/DEPLOYMENT.md`, plus a new
  `ATTENDLY_PROGRESS.md` section and a README status section.

### Changed
- Upgraded to Next 16.4.4 / React 19.2.0 / Tailwind 4.3.4 / zod 4.6.7 and added
  `@supabase/ssr`, `lucide-react`; removed the Next 16.0.0 and zod <4.6.6
  advisories by upgrading.
- `app/layout.tsx` now imports `app/web.css` and wires theme, toast and PWA
  providers; `tsconfig.json` gained `allowImportingTsExtensions` and Next's
  generated settings.
- Replaced `X-Frame-Options: DENY` with a CSP `frame-ancestors` rule that still
  allows preview dashboards.

### Fixed during implementation
- JSX generic syntax in three pages, `Panel` style prop, nullable semester in
  calendar, timetable rule null defaults, invalid calendar dates in CSV import,
  duplicate `className`, unused imports, mislabeled "resend email" action,
  empty `userId` on calendar uploads, and the keep-local conflict path (now a
  single idempotent upsert through the outbox).

### Verified
- `npm run typecheck`, `npm run lint` (0 warnings), `npm test` (80/80),
  `npm run test:legacy` (6/6), `npm run build` (28 routes), `npm audit
  --omit=dev` (0 vulnerabilities), and HTTP 200 smoke checks for 27 routes and
  assets including manifest, SW, icons and headers.
- Local `npm run start` on `0.0.0.0:3000` is the Arena live preview; the
  unconfigured-Supabase setup state renders honestly.

### Not done / blocked
- No Supabase writes, migrations, RLS/Auth/Storage/Edge Function changes.
- No production deployment, DNS change, `main` merge or production data test.
- Vercel project `attendly-web` created with public env vars; two Git-source
  deployment attempts failed at `git_info_fail` and were deleted. A GitHub Login
  Connection must be added to the Vercel account before a hosted preview can be
  built. Hosted Auth redirect allow-list change needs owner approval.

## Earlier history

See `ATTENDLY_PROGRESS.md` for the original skeleton, migration, live checks and
mobile-app work by other agents. Those sections are preserved verbatim.
