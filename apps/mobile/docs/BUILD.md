# Building Attendly Mobile

## What was verified in the sandbox

| Check | Result |
| --- | --- |
| `tsc --noEmit` | ✅ clean |
| `jest` | ✅ 67 tests / 6 suites passing |
| `expo export --platform android --platform ios` | ✅ both Hermes (`.hbc`) bundles produced (~5.6 MB each) |
| Supabase URL + publishable key embedded in Android bundle | ✅ verified by inspecting the exported `.hbc` |
| Obsidian theme present / legacy violet absent in bundle | ✅ verified |
| `gradle assembleRelease` / `xcodebuild` | ⚠️ **not run** — no Android SDK, Xcode, or Java here; Google/Gradle/Maven hosts are network-blocked |
| On-device / emulator run | ⚠️ **not run** — requires a device or emulator |

The Metro export proves the JavaScript/TypeScript bundles compile and all native module imports resolve for both platforms. Producing installable `.apk`/`.aab`/`.ipa` binaries requires the native toolchains below.

## Prerequisites

- Node 22+, npm 10+
- For Android: Android Studio + SDK 35, JDK 17, an emulator or device
- For iOS: macOS + Xcode 16, CocoaPods, a simulator or device (Apple Developer account for device builds)
- An Expo account + EAS CLI (`npm i -g eas-cli`) for cloud builds

## Environment / the "Configure Attendly" fix

`EXPO_PUBLIC_*` values are inlined by Metro **at build time**. The earlier APK showed the config
screen because those values lived only in a git-ignored `.env.local`, which an EAS/other-machine
build never saw. The fix makes the public config available to **every** build:

1. **`apps/mobile/.env` (committed)** — public project URL + publishable key. Local builds embed it.
2. **`eas.json` `env` on every profile** — the same values, so EAS cloud builds embed them.
3. **`app.config.ts` → `extra`** — mirrored fallback read via `Constants.expoConfig.extra` in the
   Supabase client if inlining is ever unavailable.

These are **public, RLS-protected client values, not secrets** (never a service-role key).
`.env.local` (git-ignored) still overrides locally. After any rebuild, the app launches into the real
experience; the config screen is replaced by a calm error + retry that should never appear in a
correctly built APK.

> If you rotate the Supabase publishable key, update it in `.env`, `eas.json`, and `.env.example`
> together, then rebuild — an already-installed APK keeps the value it was built with.

## Local development

```bash
npm install
npx expo start            # Expo Go works for most features
```

Features that need a **development build** (custom native code): `expo-secure-store`, `expo-sqlite`, `expo-notifications`, `expo-print`, `expo-sharing`, `expo-file-system`. Expo Go supports these in SDK 58, but for production parity use a dev client:

```bash
npx expo run:android      # generates android/ + builds locally
npx expo run:ios          # generates ios/ + builds locally (macOS)
```

## EAS cloud builds

`eas.json` defines three profiles:

| Profile | Android | iOS | Use |
| --- | --- | --- | --- |
| `development` | dev client, internal | dev client, internal | debugging |
| `preview` | APK, internal | ad-hoc/internal | QA without store |
| `production` | AAB, auto-increment | store, auto-increment | store submission |

```bash
eas login
eas build:configure        # links the EAS project id (writes extra.eas.projectId)
eas build --platform android --profile preview
eas build --platform ios --profile preview
eas submit --platform android   # Play Store
eas submit --platform ios       # App Store Connect
```

**Credentials:** EAS manages signing keys/keystores and iOS provisioning profiles. No secrets are committed. Set `EXPO_PUBLIC_*` env vars in the EAS dashboard (or `eas env:create`) so cloud builds receive them — `.env.local` is not uploaded.

## Deep links

The app scheme is `attendly` (`app.json` → `scheme`). Auth email links must redirect to:

- `attendly://auth/callback` (email verification / magic link)
- `attendly://auth/reset-password` (password recovery)

These map to `app/auth/callback.tsx` and `app/auth/reset-password.tsx` (kept outside the `(auth)` group so the auth gate allows them).

**Supabase auth config:** the project's `uri_allow_list` was empty. The two `attendly://` URLs above were added **additively** (no existing URL removed, `site_url` untouched) so email links can open the app. If you manage auth config separately, ensure these two redirects are present in **Authentication → URL Configuration → Redirect URLs**. The web `site_url` (`http://localhost:3000`) was deliberately left unchanged.

## Bundle identifiers

- Android: `com.sharveshraam.attendly`
- iOS: `com.sharveshraam.attendly`

Change these in `app.json` if you publish under a different identifier, and update the EAS credentials accordingly.

## Troubleshooting

- **`expo install` fails behind a proxy** — versions are fully pinned in `package.json`; use plain `npm install` (this is how the sandbox installed them).
- **SecureStore value too large** — handled by the chunked adapter (`services/supabase/secure-storage.ts`).
- **Missing config screen on launch** — `.env.local` is absent or empty; fill in the two public values.
