import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants';
import { useOfflineQuery } from './useOfflineQuery';
import { useAuth } from './useAuth';
import { useEvents, useAssignments } from './useAcademicData';
import {
  fetchNotificationPreferences,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  upsertNotificationPreferences,
} from '@/services/api/notifications';
import {
  getLocalSettings,
  getPermissionStatus,
  schedulePlannedNotifications,
} from '@/services/notifications';
import { planNotifications } from '@/lib/notifications/planner';
import type { NotificationPreferencesRow, NotificationRow } from '@/types/database';

export function useNotifications() {
  const { user } = useAuth();
  return useOfflineQuery<NotificationRow[]>(QUERY_KEYS.notifications, () => fetchNotifications(), {
    enabled: Boolean(user),
  });
}

export function useNotificationPreferences() {
  const { user } = useAuth();
  return useOfflineQuery<NotificationPreferencesRow | null>(
    QUERY_KEYS.notificationPreferences,
    () => fetchNotificationPreferences(user!.id),
    { enabled: Boolean(user) },
  );
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (prefs: NotificationPreferencesRow) => upsertNotificationPreferences(prefs),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notificationPreferences }),
  });
}

export function useMarkNotificationsRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string | 'all') => {
      if (id === 'all') await markAllNotificationsRead(user!.id);
      else await markNotificationRead(id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications }),
  });
}

/**
 * Re-plan and reschedule local notifications whenever the schedule, assignments
 * or preferences change. Runs only when notification permission is granted.
 */
export function useNotificationScheduler(semesterId: string | null): void {
  const eventsQuery = useEvents(semesterId);
  const assignmentsQuery = useAssignments(semesterId);
  const prefsQuery = useNotificationPreferences();

  useEffect(() => {
    let active = true;
    async function run() {
      const status = await getPermissionStatus();
      if (status !== 'granted') return;
      const events = eventsQuery.data ?? [];
      const assignments = assignmentsQuery.data ?? [];
      const prefs = prefsQuery.data;
      if (!prefs) return;
      const local = await getLocalSettings();
      const planned = planNotifications({
        now: new Date(),
        events: events.map((e) => ({ id: e.id, title: e.title, starts_at: e.starts_at, kind: e.kind, status: e.status })),
        assignments: assignments.map((a) => ({ id: a.id, title: a.title, due_at: a.due_at, status: a.status })),
        prefs,
        classReminderMinutes: local.classReminderMinutes,
        quietHours: local.quietHours,
        horizonDays: 7,
      });
      if (active) await schedulePlannedNotifications(planned);
    }
    void run();
    return () => {
      active = false;
    };
  }, [eventsQuery.data, assignmentsQuery.data, prefsQuery.data]);
}
