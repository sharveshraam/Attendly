import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider, useTheme } from '@/theme';
import { useAuth, useAuthListener } from '@/hooks/useAuth';
import { useActiveSemester } from '@/hooks/useAcademicData';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { useSyncStore } from '@/store/useSyncStore';
import { initSyncCounts, startSyncListener } from '@/services/sync';
import { subscribeToNotifications, subscribeToSemester } from '@/services/realtime';
import { useNotificationScheduler } from '@/hooks/useNotifications';
import { addNotificationResponseListener, configureNotificationChannels } from '@/services/notifications';
import { isSupabaseConfigured } from '@/services/supabase/client';

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'offlineFirst',
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: { networkMode: 'offlineFirst', retry: 0 },
  },
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppShell />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function AppShell() {
  const { theme } = useTheme();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  const { initialized, isAuthenticated, user } = useAuth();
  useAuthListener();
  const hydrate = usePreferencesStore((s) => s.hydrate);
  const router = useRouter();
  const segments = useSegments();
  const queryClient = useQueryClient();
  const { active } = useActiveSemester();
  const semesterId = active?.id ?? null;

  useNotificationScheduler(semesterId);

  useEffect(() => {
    void hydrate();
    initSyncCounts();
    void configureNotificationChannels();
    const stopSync = startSyncListener();
    const stopNotif = addNotificationResponseListener((category) => {
      if (category === 'assignment') router.push('/productivity/assignments');
      else if (category === 'exam') router.push('/productivity/exams');
      else if (category === 'class_reminder' || category === 'daily_reminder') router.push('/(tabs)/calendar');
    });
    return () => {
      stopSync();
      stopNotif();
    };
  }, [hydrate, router]);

  // Realtime subscriptions while authenticated.
  useEffect(() => {
    if (!isAuthenticated || !user || !isSupabaseConfigured) return;
    const stopNotifications = subscribeToNotifications(queryClient, user.id);
    const stopSemester = semesterId ? subscribeToSemester(queryClient, semesterId, user.id) : () => {};
    return () => {
      stopNotifications();
      stopSemester();
    };
  }, [isAuthenticated, user, semesterId, queryClient]);

  // Auth gate.
  useEffect(() => {
    if (!initialized || (!fontsLoaded && !fontError)) return;
    SplashScreen.hideAsync().catch(() => {});
    const inAuthGroup = segments[0] === '(auth)';
    const inAuthFlow = segments[0] === 'auth';
    if (!isAuthenticated && !inAuthGroup && !inAuthFlow && isSupabaseConfigured) {
      router.replace('/(auth)/welcome');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [initialized, fontsLoaded, fontError, isAuthenticated, segments, router]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <>
      <StatusBar style={theme.name === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="auth/callback" />
      </Stack>
    </>
  );
}
