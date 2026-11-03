# Known issues and honest limits

_Last updated: 2026-11-03._ Nothing in this file is "complete but undocumented".
Features with a missing backend dependency are explicitly listed as unavailable.

## Hosted deployment / owner-authorization items

1. **Vercel hosted deployment exists but is externally unverified.** Two early
   deployment attempts failed at initialization with `git_info_fail` because the
   Vercel ↔ GitHub Login Connection was missing; both records were deleted. The
   owner added the connection, and `dpl_GgaeYpWKRUT7d5u6dvQkha6s2YfT` built
   `READY` from `aa7dd73` with both public env vars. The URL is behind Vercel
   Deployment Protection (Vercel login required), so external route/header
   verification against it is still outstanding. Vercel labels that branch
   deployment `target: production` / `PROMOTED`; no custom domain, DNS, `main`
   merge or production data test occurred. The local production server remains
   the Arena live preview.
2. **Resolved — preview Auth origins are allowed.** The owner approved an
   additive allow-list change; it now contains `http://localhost:3000/**`, `attendly://auth/callback`,
   `attendly://auth/reset-password`,
   `https://3000-ij82xxqb0js5vttcwapbe.e2b.app/**`,
   `https://attendly-web-cosmic-7aae.vercel.app/**`,
   `https://attendly-web-git-arena-6fedf57b-attendly-cosmic-7aae.vercel.app/**`,
   `https://attendly-*.vercel.app/**`.
   `site_url` remains `http://localhost:3000` and all other Auth settings are
   unchanged. A real hosted deployment still has to exist and be verified;
   production origins and a production `site_url` change remain gated. Email
   confirmation/reset round trips with a disposable account are still unverified.
3. **Production promotion, custom domains/DNS and production data testing are
   intentionally not done.** No `main` merge, no alias promotion, no DNS edit.

## Missing backend capabilities (deliberately not invented)

4. **No OCR / AI document extraction.** The live project has zero Edge Functions.
   PDF, image and Excel timetable/calendar files are uploaded to the private
   `academic-documents` bucket for provenance only; only CSV is parsed, and every
   parsed row requires human review before any write. The Settings/Support/docs
   state this. No fake extraction result is shown.
5. **No web-push sender.** `push_subscriptions` exists but there is no sender
   service. Notifications are in-app with Realtime invalidation and an optional
   in-tab reminder. Remote push is documented as unavailable.
6. **No `notes` table.** Course notes are device-local (`localStorage`), clearly
   labelled, and are not synced or shared. They can be cleared in Settings.
7. **No `assignments.priority` column.** Priority is a device-local overlay; the
   backend `assignments.status` remains restricted to
   `pending | in_progress | submitted`.
8. **No account-deletion endpoint.** Settings shows an honest explanation and a
   link to support instead of a non-functional button.
9. **The AI Assistant is deterministic and local.** It uses the canonical engine
   and the user's already-loaded RLS-filtered data; it does not call an external
   model and does not modify data. It is labelled as such in the UI.

## Verification not yet possible in this environment

10. **No end-to-end test with a real authenticated account.** There is no safe
    test account and no hosted Auth redirect origin. All writes were therefore
    verified structurally (unit tests, TypeScript, lint, build, HTTP smoke tests
    of public/setup states), not against production user data. Integration tests
    for auth/session/course/timetable/attendance/group/privacy/realtime/offline
    against a disposable test project remain a pre-launch task.
11. **Offline/PWA behaviour is unit-tested but not browser-verified with the live
    backend.** `lib/offline.ts` and `syncOutbox()` have 12 passing unit tests
    (dedupe, conflicts, keep/discard, per-user cache, offline guard), and the
    service worker's cache guards have a static test. Actual SW registration,
    install prompt, update banner, offline queue → reconnect sync, responsive
    layout and the dark-first (optional light) theme were not exercised in a real browser here.
12. **Responsive/theme/manifest checks are code + HTTP level.** CSS media queries,
    theme bootstrap and icons exist; a manual device/browser matrix (iOS Safari
    install, Android Chrome install, 360px/768px/1440px widths, print report) is
    still recommended.

## Smaller implementation notes

13. `app/globals.css` (original starter CSS) is preserved but unused;
    `app/web.css` is the active stylesheet. `components/dashboard.tsx` is the
    original skeleton component, superseded by `app/(app)/home/page.tsx`.
14. Calendar "undo" restores a cancelled event's status; a reschedule is undone
    by editing the event again rather than by a one-click snapshot restore.
15. `npm audit` reports 16 moderate advisories in dev-only tooling
    (eslint / typescript-eslint / minimatch). `npm audit --omit=dev` reports **0**
    vulnerabilities; the suggested `npm audit fix` is a downgrade and was not
    applied.
16. Vercel's project default Node version is `26.x`. `package.json` now declares
    `engines.node >=22.0.0`; this was verified locally on Node 22.22.3, not on
    Vercel's 26.x builder (no successful hosted build yet).
