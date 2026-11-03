import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { OfflineBanner } from '@/components/domain/OfflineBanner';
import { View, StyleSheet } from 'react-native';

export default function TabsLayout() {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={styles.flex}>
      <OfflineBanner />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: c.primary,
          tabBarInactiveTintColor: c.textTertiary,
          tabBarStyle: {
            backgroundColor: c.tabBar,
            borderTopColor: c.border,
            borderTopWidth: StyleSheet.hairlineWidth,
            height: 62,
            paddingBottom: 8,
            paddingTop: 6,
          },
          tabBarLabelStyle: { fontSize: 11, fontFamily: theme.typography.fontFamily.medium },
          sceneStyle: { backgroundColor: c.background },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color as string} />,
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: 'Calendar',
            tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={22} color={color as string} />,
          }}
        />
        <Tabs.Screen
          name="attendance"
          options={{
            title: 'Attendance',
            tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'checkmark-done' : 'checkmark-done-outline'} size={22} color={color as string} />,
          }}
        />
        <Tabs.Screen
          name="groups"
          options={{
            title: 'Groups',
            tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'people' : 'people-outline'} size={22} color={color as string} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color as string} />,
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
