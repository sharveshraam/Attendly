import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from '@/components/ui';
import { RiskBadge } from './RiskBadge';
import { useTheme } from '@/theme';
import type { Course, CourseAttendanceStats } from '@/types/domain';

interface CourseCardProps {
  course: Course;
  stats: CourseAttendanceStats;
  onPress?: () => void;
}

export function CourseCard({ course, stats, onPress }: CourseCardProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const percent = stats.percent;
  const barColor = percent === null ? c.textTertiary : percent >= stats.target ? c.success : percent >= stats.target - 15 ? c.warning : c.danger;

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: course.color }]} />
        <View style={styles.titleWrap}>
          <Text variant="body" weight="semiBold" numberOfLines={1}>
            {course.name}
          </Text>
          {course.code ? (
            <Text variant="caption" tone="secondary">
              {course.code}
            </Text>
          ) : null}
        </View>
        <RiskBadge risk={stats.risk} />
      </View>

      <View style={styles.percentRow}>
        <Text variant="title" weight="bold">
          {percent === null ? '—' : `${percent}%`}
        </Text>
        <Text variant="caption" tone="secondary">
          {stats.attended}/{stats.conducted} attended · target {stats.target}%
        </Text>
      </View>

      <View style={[styles.track, { backgroundColor: c.surfaceSecondary }]}>
        <View style={[styles.fill, { width: `${percent ?? 0}%`, backgroundColor: barColor }]} />
      </View>

      <View style={styles.footer}>
        <Text variant="caption" tone="secondary">
          {stats.bunkAllowance === null
            ? 'Bunk allowance: —'
            : `Can miss ${stats.bunkAllowance} more`}
        </Text>
        {stats.recoveryClasses !== null && stats.recoveryClasses > 0 ? (
          <Text variant="caption" tone="warning">
            Attend {stats.recoveryClasses} to recover
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  titleWrap: { flex: 1, gap: 2 },
  percentRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
