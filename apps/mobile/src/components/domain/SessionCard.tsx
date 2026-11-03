import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Card, Text } from '@/components/ui';
import { useTheme } from '@/theme';
import { formatRange, relativeDayLabel } from '@/lib/dates';
import type { SessionWithAttendance } from '@/types/domain';
import type { AttendanceStatus } from '@/types/database';
import type { Course } from '@/types/domain';

interface SessionCardProps {
  session: SessionWithAttendance;
  course?: Course;
  onMark?: (status: AttendanceStatus) => void;
  onPress?: () => void;
  showDate?: boolean;
}

const STATUS_META: Record<string, { label: string; tone: 'success' | 'danger' | 'info' | 'neutral' | 'warning' }> = {
  present: { label: 'Present', tone: 'success' },
  absent: { label: 'Absent', tone: 'danger' },
  excused: { label: 'Excused', tone: 'info' },
  unmarked: { label: 'Unmarked', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'warning' },
  rescheduled: { label: 'Rescheduled', tone: 'info' },
};

export function SessionCard({ session, course, onMark, onPress, showDate = false }: SessionCardProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { event, effectiveStatus, pendingSync } = session;
  const meta = STATUS_META[effectiveStatus] ?? STATUS_META.unmarked!;
  const isFuture = new Date(event.starts_at).getTime() > Date.now();
  const isCancelled = event.status === 'cancelled' || event.status === 'rescheduled';
  const canMark = !isFuture && !isCancelled && Boolean(onMark);

  return (
    <Card onPress={onPress} style={styles.card} padded={false}>
      <View style={styles.inner}>
        <View style={[styles.accent, { backgroundColor: course?.color ?? c.primary }]} />
        <View style={styles.body}>
          <View style={styles.topRow}>
            <Text variant="caption" tone="secondary">
              {showDate ? `${relativeDayLabel(event.starts_at)} · ` : ''}
              {formatRange(event.starts_at, event.ends_at)}
            </Text>
            {pendingSync ? <Badge label="Pending sync" tone="warning" /> : null}
          </View>
          <Text variant="body" weight="semiBold" numberOfLines={1} style={styles.title}>
            {event.title}
          </Text>
          {event.location ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={13} color={c.textTertiary} />
              <Text variant="caption" tone="tertiary">
                {event.location}
              </Text>
            </View>
          ) : null}

          <View style={styles.bottomRow}>
            <Badge label={meta.label} tone={meta.tone} />
            {canMark ? (
              <View style={styles.actions}>
                <Pressable
                  onPress={() => onMark?.('present')}
                  accessibilityLabel="Mark present"
                  style={[styles.markBtn, { backgroundColor: effectiveStatus === 'present' ? c.successSoft : c.surfaceSecondary }]}
                >
                  <Ionicons name="checkmark" size={18} color={effectiveStatus === 'present' ? c.success : c.textSecondary} />
                </Pressable>
                <Pressable
                  onPress={() => onMark?.('absent')}
                  accessibilityLabel="Mark absent"
                  style={[styles.markBtn, { backgroundColor: effectiveStatus === 'absent' ? c.dangerSoft : c.surfaceSecondary }]}
                >
                  <Ionicons name="close" size={18} color={effectiveStatus === 'absent' ? c.danger : c.textSecondary} />
                </Pressable>
              </View>
            ) : isFuture ? (
              <Text variant="caption" tone="tertiary">Upcoming</Text>
            ) : null}
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 10 },
  inner: { flexDirection: 'row' },
  accent: { width: 4 },
  body: { flex: 1, padding: 14, gap: 6 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { marginTop: 2 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8 },
  markBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
