# Offline & Sync

Attendly is offline-first: cached reads keep every screen usable without a network, and writes are queued durably and replayed with conflict detection.

## Storage (expo-sqlite, `attendly-mobile.db`, WAL)

| Table | Purpose |
| --- | --- |
| `cache` | JSON snapshots keyed by React Query key, for instant offline reads |
| `outbox` | Durable queue of pending writes (`pending` / `syncing` / `conflict` / `failed`) |
| `notes` | Local-only notes (no backend table yet) |
| `assignment_meta` | Local priority overlay for assignments (no backend column yet) |

## Read path

`useOfflineQuery(key, fetcher)`:
1. Reads the SQLite cache for `key` and returns it immediately as `placeholderData`.
2. Runs the Supabase fetcher; on success writes the result back to the cache and to React Query.
3. Offline, the cached value remains on screen; a banner (`OfflineBanner`) indicates connectivity.

## Write path (outbox)

Offline-capable mutations enqueue an `OutboxOp`:

```
{ id, kind, payload, baseVersion, status, attempts, lastError, createdAt }
```

Kinds: `attendance.upsert`, `event.update`, `event.insert`, `assignment.upsert`.

The op is applied **optimistically** to the cache so the UI updates instantly, then `services/sync.ts → processOutbox()` replays pending ops when online. `useSyncStore` tracks `pending` / `conflicts` / `lastSyncAt` / `lastError`; the root layout starts a sync listener on connectivity changes.

## Conflict detection (never silently overwrite)

Each op captures a `baseVersion` (the server `marked_at` / `updated_at` at queue time). On replay:

| Kind | Conflict rule | Resolution |
| --- | --- | --- |
| `attendance.upsert` | server `marked_at` > baseVersion | mark `conflict` |
| `event.update` | server `updated_at` > base | mark `conflict` + `logScheduleChange` |
| `event.insert` | idempotent on `(semester, course, starts_at)` | skip if exists |
| `assignment.upsert` | last-write-wins | apply |

- Auto-retry up to `MAX_AUTO_ATTEMPTS = 5`, then `failed`.
- `conflict` and `failed` ops are **manual**: **Settings → Sync** lists them with **Keep my edit** (`retryOp` → re-process) and **Discard** (`discardOp`).
- `useSessions` overlays pending/failed marks onto fetched sessions with a `pendingSync` flag so unsynced marks are visible.

## Realtime

`services/realtime.ts` subscribes to the 6 realtime tables and invalidates React Query keys. Group screens use `subscribeToGroup(groupId)` (returns a cleanup function). This keeps multi-device and group schedule changes fresh without polling.

## Guarantees

- No offline write is lost on app restart (SQLite is durable).
- Newer server data is never silently overwritten by a stale offline edit.
- Attendance remains owner-private throughout; sync never touches another user's records.
