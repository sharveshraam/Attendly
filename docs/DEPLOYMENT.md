# Deployment

## Policy

- **Preview first.** No production promotion, custom domain/DNS change,
  production database setting change or `main` merge without explicit owner
  authorisation.
- No Supabase migration, database setting, RLS policy, Storage policy or
  Edge Function change was made. The single **owner-approved additive** Auth
  change is the redirect allow-list below; `site_url=http://localhost:3000` and
  every other Auth setting are unchanged. The deployed Android app is untouched.
- Only public/publishable Supabase values belong in Vercel env vars.

## Vercel project state (2026-11-03)

| Item | Value / status |
| --- | --- |
| Vercel account | `jpsharveshraam` (hobby), team `Cosmic` / `cosmic-7aae` |
| Project | `attendly-web`, id `prj_twoeGQ7HA5gfNe474qxk32NtQYfx`, framework `nextjs` |
| Env vars | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (plain, all three targets) |
| Git connection | **Not linked** — owner action required (see blocker below) |
| Deployments | Two attempts from `arena/6fedf57b-attendly` (`dpl_FpfrRcHaLUnXs3aroTd4YR2wsVqN`, `dpl_4RS3ED8rPvBeiFRnSUAFRuLUP8D6`) both ended `ERROR` with `git_info_fail`. Both records were deleted. **No deployment was ever live; no production deployment occurred.** |
| Local link | `.env.local` (gitignored) holds the public project URL and publishable key; the frontend is linked to the live Supabase project under existing RLS |
| Supabase Auth | Additive allow-list extended (see below); `site_url` unchanged |
| Live preview | Local `npm run start` on `0.0.0.0:3000` served through the Arena live preview |

## Blocker

Linking the repository returned:

> `Failed to link sharveshraam/Attendly. You need to add a Login Connection to your GitHub account first.`

Git-source deployments then failed with:

> `Git information retrieval failed for this deployment.`

**Minimum owner action:** add a GitHub Login Connection to the Vercel account
(Vercel → Account Settings → Login Connections → GitHub), or otherwise authorise
the GitHub integration for `sharveshraam/Attendly`. Once that exists, create a
**preview** deployment from `arena/6fedf57b-attendly` and verify it before any
production promotion.

## Steps once authorised

1. Link `sharveshraam/Attendly` to the Vercel project, or create a preview
   deployment from branch `arena/6fedf57b-attendly`.
2. Confirm the two public env vars are present for the preview target.
3. Verify the preview: public pages, `/login`, `/signup`, `/home` setup/login
   behaviour, `/manifest.webmanifest`, `/sw.js`, icons, security headers and CSP.
4. **Already done (owner-approved, additive):** the redirect allow-list now
   includes the Arena preview and Vercel preview aliases, on top of the original
   localhost and mobile deep links:

   - `http://localhost:3000/**`, `attendly://auth/callback`,
   - `attendly://auth/reset-password`,
   - `https://3000-ij82xxqb0js5vttcwapbe.e2b.app/**`,
   - `https://attendly-web-cosmic-7aae.vercel.app/**`,
   - `https://attendly-web-git-arena-6fedf57b-attendly-cosmic-7aae.vercel.app/**`,
   - `https://attendly-*.vercel.app/**`

   `site_url` stays `http://localhost:3000` and no other Auth setting changed.
   `lib/auth.ts` still retries with the configured site URL when GoTrue rejects
   a redirect. A **production** origin or production `site_url` change remains
   gated on explicit owner approval.
5. With a disposable test account, run the integration/E2E checklist in
   `docs/TESTING.md`. Never use real production data.
6. Only after explicit approval: promote to production, add any custom domain
   and DNS, and re-check the Auth allow-list. Do not merge `main` without
   authorisation.

## Build configuration

- `next.config.ts` supplies security headers and CSP; no `vercel.json` is needed
  because Vercel auto-detects Next.js.
- `package.json` declares `engines.node >=22.0.0`. Vercel's project default is
  `26.x`; no successful hosted build has been observed yet.
- `npm run build` is the build command; `npm run start` is only for local serving.
- `.next`, `node_modules`, `.vercel`, `.env*` and `*.tsbuildinfo` are gitignored.

## Rollback

A Vercel preview deployment can be deleted without touching Supabase or the
Android app. Because no schema/config change was made, there is nothing to roll
back in the backend.
