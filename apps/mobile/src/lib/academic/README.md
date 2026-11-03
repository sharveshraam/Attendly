# Mobile academic-structure integration

This folder is the **Android/iOS half** of the automatic academic-structure
feature. It intentionally contains no React Native / Expo imports, so every
function here is type-checked and parity-tested from the website repository too.

- `index.ts` re-exports `packages/attendly-core` — the *same* pure engine the
  website runs. Never copy a rule into this folder.
- `structure.ts` maps mobile Supabase rows into `EngineInput`, computes expected
  class counts, builds idempotent persistence rows, and calls the shared
  `expected_class_counts` RPC through the signed-in user's RLS client.

## Expo / Metro configuration (required when the mobile tree is checked out)

`apps/mobile/metro.config.js` must let Metro watch the monorepo root so it can
resolve the shared package:

```js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const config = getDefaultConfig(__dirname);
const root = path.resolve(__dirname, '../../..');
config.watchFolders = [root];
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(root, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = false;
module.exports = config;
```

`apps/mobile/tsconfig.json` should add `"@attendly/core": ["../../packages/attendly-core/src/index.ts"]`
under `paths` if you prefer an alias over the relative import used here.

## Screen contract (for the mobile UI)

1. `computeMobileExpectedCounts(...)` returns the same `ScheduleResult` as the
   website; show `countsByCourse`, `totals`, `weeklyDistribution` and
   `semesterProgress`.
2. `fetchExpectedClassCounts(supabase, semesterId, from, to)` is the shared
   server projection; it respects RLS and needs no service-role key.
3. After a human confirms the review screen, call
   `buildMobilePersistencePayload(...)` and upsert each array with
   `onConflict: "semester_id,source_key", ignoreDuplicates: true` (courses,
   rules, events) or `onConflict: "semester_id,day"` (academicDays).
4. Never treat `scheduled` as `conducted`. Only confirmed attendance marks
   change the percentage (canonical `attendance.ts` rules).

No APK was rebuilt or deployed as part of this change.
