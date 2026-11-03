import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, EmptyState, Screen, Text } from '@/components/ui';
import { useActiveSemester, useEvents } from '@/hooks/useAcademicData';
import { countdownLabel, formatDateLong, formatRange } from '@/lib/dates';
import { deleteEvent } from '@/services/api/events';
import { useInvalidateSemester } from '@/hooks/useAcademicData';
import { useTheme } from '@/theme';
import { Pressable } from 'react-native';

export default function Exams() {
  const router = useRouter();
  const { theme } = useTheme();
  const { active } = useActiveSemester();
  const semesterId = active?.id ?? null;
  const eventsQuery = useEvents(semesterId);
  const invalidate = useInvalidateSemester(semesterId);
  const exams = (eventsQuery.data ?? [])
    .filter((e) => e.kind === 'exam')
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const now = Date.now();

  const remove = async (id: string) => {
    await deleteEvent(id);
    invalidate();
  };

  return (
    <Screen contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text variant="headline" weight="bold">Examinations</Text>
        <Button label="Add" icon="add" size="sm" onPress={() => router.push('/events/new?kind=exam')} />
      </View>

      {exams.length === 0 ? (
        <EmptyState icon="school-outline" title="No exams yet" message="Add exam dates to see countdowns and reminders." actionLabel="Add exam" onAction={() => router.push('/events/new?kind=exam')} />
      ) : (
        exams.map((exam) => {
          const upcoming = new Date(exam.starts_at).getTime() > now;
          return (
            <Card key={exam.id} style={styles.examCard}>
              <View style={styles.examRow}>
                <View style={[styles.iconWrap, { backgroundColor: theme.colors.infoSoft }]}>
                  <Ionicons name="school-outline" size={20} color={theme.colors.info} />
                </View>
                <View style={styles.flex}>
                  <Text variant="body" weight="semiBold">{exam.title}</Text>
                  <Text variant="caption" tone="secondary">{formatDateLong(exam.starts_at)}</Text>
                  <Text variant="caption" tone="tertiary">{formatRange(exam.starts_at, exam.ends_at)}{exam.location ? ` · ${exam.location}` : ''}</Text>
                </View>
                <Pressable onPress={() => remove(exam.id)} hitSlop={8} accessibilityLabel="Delete exam">
                  <Ionicons name="trash-outline" size={18} color={theme.colors.textTertiary} />
                </Pressable>
              </View>
              <View style={styles.examFooter}>
                <Badge label={upcoming ? `In ${countdownLabel(exam.starts_at)}` : 'Completed'} tone={upcoming ? 'info' : 'neutral'} />
                <Pressable onPress={() => router.push(`/events/${exam.id}`)} hitSlop={8}>
                  <Text variant="caption" weight="semiBold" tone="accent">Details</Text>
                </Pressable>
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  examCard: { gap: 10, marginBottom: 0 },
  examRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 2 },
  examFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
