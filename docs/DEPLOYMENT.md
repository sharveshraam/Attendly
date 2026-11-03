# Deployment

## Policy

- **Preview first.** No production promotion, custom domain/DNS change,
  production database setting change or `main` merge without explicit owner
  authorisation.
- No schema change, RLS policy edit, Storage policy change, Edge Function
  change or production data test was made. Three **owner-approved additive**
  changes exist: the Auth redirect allow-list below (`site_url` and all other
  Auth settings unchanged), `0002_restore_authenticated_grants.sql` (restores
  the missing `authenticated` table-level DML grants) and
  `0003_restore_standard_api_role_grants.sql` (completes the standard baseline
  for `anon`, `authenticated` and `service_role`). No RLS policy was altered and
  no user, row or Storage object was deleted. All were needed to make the app
  usable; they are database-side, so **no redeploy is required**. The deployed
  Android app source is untouched; it benefits from the same backend fix.
- Only public/publishable Supabase values belong in Vercel env vars.

## Vercel project state (2026-11-03)

| Item | Value / status |
| --- | --- |
| Vercel account | `jpsharveshraam` (hobby), team `Cosmic` / `cosmic-7aae` |
| Project | `attendly-web`, id `prj_twoeGQ7HA5gfNe474qxk32NtQYfx`, framework `nextjs` |
| Env vars | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (plain, all three targets) |
| Git connection | **Not linked** — owner action required (see blocker below) |
| Deployments | Two early attempts ended `ERROR` with `git_info_fail` and were deleted. `dpl_GgaeYpWKRUT7d5u6dvQkha6s2YfT` (`aa7dd73`, ~45s, reported `production`/`PROMOTED`) and `dpl_JCji2Xa6i56fsrMRHaavuQDXCfbC` (`72f8ae0`, ~16s, `target: staging`, environment `preview`, `STAGED`) are both `READY`. |
| Local link | `.env.local` (gitignored) holds the public project URL and publishable key; the frontend is linked to the live Supabase project under existing RLS |
| Supabase Auth | Additive allow-list extended (see below); `site_url` unchanged |
| Live preview | Local `npm run start` on `0.0.0.0:3000` served through the Arena live preview |

## Earlier blocker — resolved

Linking the repository originally returned:

> `Failed to link sharveshraam/Attendly. You need to add a Login Connection to your GitHub account first.`

and Git-source deployments failed with `git_info_fail`. The owner added the
GitHub Login Connection; a deployment from `arena/6fedf57b-attendly` with the
numeric `repoId` then built successfully.

## Current deployment

**Hosted deployment now exists.** Deployment
`dpl_GgaeYpWKRUT7d5u6dvQkha6s2YfT` from branch `arena/6fedf57b-attendly` at
`aa7dd7347d79bf1d263d5ca9d7df229cb3126c2c` built in ~45s and is `READY`.
URLs: `https://attendly-web-cosmic-7aae.vercel.app`,
`https://attendly-web-git-arena-6fedf57b-attendly-cosmic-7aae.vercel.app`,
`https://attendly-3qy7527yx-cosmic-7aae.vercel.app`. Vercel Deployment
Protection is on, so an unauthenticated fetch redirects to Vercel login; only
Vercel-authenticated viewers can open it from here. Vercel labels the
deployment `target: production` / `PROMOTED` even though it was built from the
feature branch — no custom domain, DNS change, `main` merge or production data
test was performed.

The two public Supabase env vars were present in both builds (`build.env`).
The Supabase Auth allow-list already contains the branch and project aliases.
The current **preview** deployment is `dpl_JCji2Xa6i56fsrMRHaavuQDXCfbC` at
`https://attendly-mmqleg474-cosmic-7aae.vercel.app` (`target: staging`,
`readySubstate: STAGED`, OIDC environment `preview`). Vercel's project
`ssoProtection` is `all_except_custom_domains`, which is why an unauthenticated
fetch of any `*.vercel.app` URL here redirects to Vercel login.

> Note: Vercel reported `target: production` / `PROMOTED` for the first branch
> deployment even though it came from `arena/6fedf57b-attendly`. No custom
> domain, DNS change, `main` merge or production data test was performed; the
> second deployment is a proper preview target.

## Steps once authorised

1. Link `sharveshraam/Attendly` to the Vercel project, or create a preview
   deployment from branch `arena/6fedf57b-attendly`.
2. Confirm the two public env vars are present for the preview target.
3. Verify the deployment: public pages, `/login`, `/signup`, `/home`
   login redirect, `/manifest.webmanifest`, `/sw.js`, icons, security headers and
   CSP. **Not yet done from outside Vercel** because Deployment Protection
   requires a Vercel login; the local production build passed all these checks.
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
   The new `attendly-*.vercel.app` deployment URL is also covered by the wildcard
   entry. `lib/auth.ts` still retries with the configured site URL when GoTrue
   rejects a redirect. A **production** origin or production `site_url` change
   remains gated on explicit owner approval.
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
- Vercel built with Node `26.x` and both public Supabase env vars in ~45s.
- `.next`, `node_modules`, `.vercel`, `.env*` and `*.tsbuildinfo` are gitignored.

## Rollback

A Vercel preview deployment can be deleted without touching Supabase or the
Android app. Because no schema/config change was made, there is nothing to roll
back in the backend.
