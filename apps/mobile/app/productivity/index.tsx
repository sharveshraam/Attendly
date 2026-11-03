import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, Screen, Text } from '@/components/ui';
import { useActiveSemester, useAssignments, useEvents } from '@/hooks/useAcademicData';
import { countdownLabel } from '@/lib/dates';
import { useTheme } from '@/theme';

export default function Productivity() {
  const router = useRouter();
  const { theme } = useTheme();
  const { active } = useActiveSemester();
  const assignmentsQuery = useAssignments(active?.id ?? null);
  const eventsQuery = useEvents(active?.id ?? null);
  const assignments = assignmentsQuery.data ?? [];
  const events = eventsQuery.data ?? [];
  const pendingAssignments = assignments.filter((a) => a.status !== 'submitted').length;
  const upcomingExams = events.filter((e) => e.kind === 'exam' && new Date(e.starts_at).getTime() > Date.now());
  const nextExam = upcomingExams[0];

  const items = [
    { icon: 'document-text-outline' as const, label: 'Assignments', subtitle: `${pendingAssignments} pending`, route: '/productivity/assignments', color: theme.colors.warning },
    { icon: 'school-outline' as const, label: 'Examinations', subtitle: nextExam ? `Next in ${countdownLabel(nextExam.starts_at)}` : `${upcomingExams.length} upcoming`, route: '/productivity/exams', color: theme.colors.info },
    { icon: 'create-outline' as const, label: 'Notes', subtitle: 'Local-first, organized by course', route: '/productivity/notes', color: theme.colors.secondary },
    { icon: 'calendar-outline' as const, label: 'Academic events', subtitle: 'Workshops, seminars, deadlines', route: '/events/new?kind=other', color: theme.colors.primary },
  ];

  return (
    <Screen contentContainerStyle={styles.container}>
      <Text variant="headline" weight="bold">Productivity</Text>
      <Text variant="small" tone="secondary">Stay on top of deadlines, exams and notes.</Text>
      <View style={styles.grid}>
        {items.map((item) => (
          <Pressable key={item.label} onPress={() => router.push(item.route as never)} style={styles.gridItem} accessibilityRole="button">
            <Card style={styles.card}>
              <View style={[styles.iconWrap, { backgroundColor: `${item.color}22` }]}>
                <Ionicons name={item.icon} size={22} color={item.color} />
              </View>
              <Text variant="body" weight="semiBold">{item.label}</Text>
              <Text variant="caption" tone="secondary">{item.subtitle}</Text>
            </Card>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingTop: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridItem: { width: '48%' },
  card: { gap: 8, minHeight: 130 },
  iconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
