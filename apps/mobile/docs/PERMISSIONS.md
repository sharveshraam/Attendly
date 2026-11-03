# Native Permissions

Attendly requests the minimum permissions needed. Each is declared in `app.json` (Expo config plugins) and requested at runtime only when the feature is used.

## Android (`app.json` → `android.permissions`)

| Permission | Why | When requested |
| --- | --- | --- |
| `INTERNET` | Supabase sync | always (install-time) |
| `POST_NOTIFICATIONS` | Local reminders (Android 13+) | when enabling notifications |
| `SCHEDULE_EXACT_ALARM` | Precise class reminders | with notification permission |
| `READ_EXTERNAL_STORAGE` / media | Pick timetable PDF/image/CSV | on document import (scoped via DocumentPicker) |
| `VIBRATE` | Notification vibration | install-time |

Document picking uses `expo-document-picker` (system picker, no broad storage grant) and `expo-file-system` to read the chosen file. Uploads go to the private `academic-documents` bucket under the user's own uid.

## iOS (`app.json` → `ios.infoPlist`)

| Key | Why |
| --- | --- |
| `NSPhotoLibraryUsageDescription` | Choose a timetable image from the library |
| `NSCameraUsageDescription` | (only if camera capture is enabled) scan a timetable |
| `UIBackgroundModes: remote-notification` | Future remote push (local notifications work without it) |

Notifications on iOS use the standard `UNUserNotificationCenter` prompt via `expo-notifications`, triggered from **Settings → Notifications → Enable**.

## What is NOT requested

- No location, contacts, microphone, Bluetooth, or tracking permissions.
- No broad file-system access — only the user-picked document.
- No background location or always-on sensors.

## Privacy notes

- Attendance data is owner-private (RLS). The app never reads another user's attendance.
- Auth tokens live in the device keystore (Android) / keychain (iOS) via `expo-secure-store`.
- Uploaded documents are private and accessed through 1-hour signed URLs.
- Analytics CSV/PDF exports are generated on-device and shared through the native share sheet — nothing is sent to a third party.
