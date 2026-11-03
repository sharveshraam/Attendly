import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/constants';
import type { PlannedNotification, QuietHours } from '@/lib/notifications/planner';

/**
 * Native notification integration (Expo Notifications).
 *
 * Local notifications (class/exam/assignment reminders, daily summary) are
 * fully implemented and work offline. Remote push delivery requires an Expo
 * push token + a backend sender; the existing push_subscriptions table is shaped
 * for web push, so a mobile token table is proposed in
 * docs/proposed-backend-additions.md (NOT applied). Until that backend exists,
 * push tokens are obtained for readiness but not transmitted to a sender.
 */

export interface LocalNotificationSettings {
  classReminderMinutes: number;
  quietHours: QuietHours | null;
}

const DEFAULT_SETTINGS: LocalNotificationSettings = {
  classReminderMinutes: 15,
  quietHours: { start: '22:00', end: '07:00' },
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function configureNotificationChannels(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Class & deadline reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#8B7CFF',
    });
    await Notifications.setNotificationChannelAsync('updates', {
      name: 'Schedule & group updates',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

export async function getPermissionStatus(): Promise<Notifications.PermissionStatus> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function getLocalSettings(): Promise<LocalNotificationSettings> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.notificationSettings);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<LocalNotificationSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveLocalSettings(settings: LocalNotificationSettings): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.notificationSettings, JSON.stringify(settings));
}

/** Replace all scheduled local notifications with the freshly planned set. */
export async function schedulePlannedNotifications(planned: PlannedNotification[]): Promise<number> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  let scheduled = 0;
  for (const item of planned) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: item.title,
          body: item.body,
          data: { category: item.category, id: item.id },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: item.date,
          channelId: 'reminders',
        },
      });
      scheduled += 1;
    } catch {
      // Skip individual failures (e.g. a date that slipped into the past).
    }
  }
  return scheduled;
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function getScheduledCount(): Promise<number> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all.length;
}

/**
 * Obtain an Expo push token for readiness. Returns null on simulators, when
 * permissions are denied, or when no EAS project id is configured. Remote
 * delivery is intentionally not wired until the backend sender exists.
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;
  const granted = await requestNotificationPermissions();
  if (!granted) return null;
  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    (Constants.expoConfig?.extra?.eas?.projectId as string | undefined);
  if (!projectId) return null;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch {
    return null;
  }
}

export function addNotificationResponseListener(
  handler: (category: string, id: string) => void,
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as { category?: string; id?: string };
    handler(data.category ?? '', data.id ?? '');
  });
  return () => subscription.remove();
}
