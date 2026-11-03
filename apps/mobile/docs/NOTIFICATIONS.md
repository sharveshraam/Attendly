# Notifications

## Status: local notifications fully implemented; remote push pending backend

| Capability | Status |
| --- | --- |
| Local class reminders (N minutes before) | ✅ implemented + tested (planner) |
| Daily summary at a chosen time | ✅ implemented + tested |
| Assignment reminders (day before due) | ✅ implemented + tested |
| Quiet hours (overnight windows) | ✅ implemented + tested |
| Category channels (reminders HIGH / updates) | ✅ implemented |
| Permission request + status UI | ✅ implemented |
| Notification inbox (`notifications` table) | ✅ implemented |
| **Remote push delivery** | ⚠️ **not operational** — needs backend sender + credentials + device test |

## How local notifications work

1. `services/notifications.ts` sets up Android channels (`reminders` = HIGH, `updates` = default) and the iOS presentation options (`shouldShowBanner`, `shouldShowList`).
2. `lib/notifications/planner.ts` is a **pure** function: given `now`, upcoming events, assignments, preferences, reminder lead time, and quiet hours, it returns a list of `{ date, category, title, body }` to schedule. It is unit-tested (overnight quiet windows, cancelled-class skipping, disabled preferences).
3. The scheduler (`useNotificationScheduler`, wired in the root layout) cancels stale scheduled notifications and re-schedules a rolling **7-day horizon** whenever data or preferences change.
4. A notification only fires if **both** the OS permission is granted **and** a `notification_preferences` row exists. The settings screen upserts defaults so the scheduler is never a silent no-op.

## Preferences

Stored in `notification_preferences` (server) + local settings (Zustand/SQLite):

- `daily_reminder`, `schedule_changes`, `attendance_warnings`, `assignment_reminders` (booleans)
- `reminder_time` (HH:MM, default 07:00)
- Local: `classReminderMinutes` (default 15), quiet hours (default 22:00–07:00)

## Why remote push is not claimed operational

- The existing `push_subscriptions` table is **web-push shaped** (`endpoint`, `subscription` JSON) — it does not store Expo push tokens.
- There is **no backend sender** (Edge Function / cron) that reads subscriptions and delivers pushes.
- No EAS project id / push credentials are configured, and no physical-device delivery test was performed.

`getExpoPushToken()` is implemented and will return a token on a device with an EAS project id, and the settings screen surfaces readiness honestly. To make remote push live, apply the staged migration in [`PROPOSED_BACKEND_ADDITIONS.md`](PROPOSED_BACKEND_ADDITIONS.md) (Expo token column), add a sender, configure credentials, and test on a device. **None of that is claimed done here.**

## SDK 58 specifics handled

- `expo-notifications`: iOS options use `shouldShowBanner` / `shouldShowList` (the older `shouldShowAlert` is deprecated).
- Date triggers require `type: SchedulableTriggerInputTypes.DATE`.
- `expo-file-system` legacy APIs are imported from `expo-file-system/legacy`.
