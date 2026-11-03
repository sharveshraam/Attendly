import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { startOfWeek, format } from 'date-fns';
import { Button, Card, EmptyState, ProgressRing, Screen, SectionHeader, Text } from '@/components/ui';
import { CourseBars, TrendChart, type TrendPoint } from '@/components/domain/Charts';
import { StatCard } from '@/components/domain';
import { useActiveSemester, useCourseStats, useSessions } from '@/hooks/useAcademicData';
import { summarize } from '@/lib/attendance/engine';
import { buildAttendanceCsv, shareCsv, sharePdf, type ReportCourse } from '@/services/reports';
import { useTheme } from '@/theme';

export default function Analytics() {
  const { theme } = useTheme();
  const { active } = useActiveSemester();
  const semesterId = active?.id ?? null;
  const { stats, courses } = useCourseStats(semesterId);
  const { sessions } = useSessions(semesterId);
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const overall = useMemo(() => {
    const engineSessions = sessions.map((s) => ({ status: s.record?.status ?? ('unmarked' as const), lifecycle: s.event.status }));
    return summarize({ sessions: engineSessions, targetPercent: active?.attendance_target ?? 75 });
  }, [sessions, active]);

  const trend = useMemo<TrendPoint[]>(() => {
    const weeks: TrendPoint[] = [];
    const now = new Date();
    for (let i = 7; i >= 0; i -= 1) {
      const weekStart = startOfWeek(new Date(now.getTime() - i * 7 * 86_400_000), { weekStartsOn: 1 });
      const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);
      const weekSessions = sessions.filter((s) => {
        const t = new Date(s.event.starts_at).getTime();
        return t >= weekStart.getTime() && t < weekEnd.getTime();
      });
      const summary = summarize({ sessions: weekSessions.map((s) => ({ status: s.record?.status ?? 'unmarked', lifecycle: s.event.status })), targetPercent: 75 });
      weeks.push({ label: format(weekStart, 'd MMM'), value: summary.percent });
    }
    return weeks;
  }, [sessions]);

  const reportCourses = useMemo<ReportCourse[]>(
    () => courses.map((course) => ({ ...course, stats: stats.find((s) => s.courseId === course.id)! })).filter((c) => c.stats),
    [courses, stats],
  );

  const atRisk = stats.filter((s) => s.risk === 'at_risk').length;
  const totalBunk = stats.reduce((sum, s) => sum + (s.bunkAllowance ?? 0), 0);

  const exportCsv = async () => {
    setExporting('csv');
    setError(null);
    try {
      await shareCsv(`attendly-${active?.name ?? 'report'}.csv`, buildAttendanceCsv(reportCourses));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExporting(null);
    }
  };

  const exportPdf = async () => {
    setExporting('pdf');
    setError(null);
    try {
      await sharePdf('Attendly attendance report', `${active?.name ?? ''} · generated ${format(new Date(), 'd MMM yyyy')}`, reportCourses);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExporting(null);
    }
  };

  if (!active) {
    return (
      <Screen contentContainerStyle={styles.empty}>
        <EmptyState icon="analytics-outline" title="No semester yet" message="Set up a semester to see analytics." />
      </Screen>
    );
  }

  return (
    <Screen contentContainerStyle={styles.container}>
      <Text variant="headline" weight="bold">Analytics</Text>

      <Card style={styles.overallCard}>
        <ProgressRing percent={overall.percent} size={96} caption="overall" />
        <View style={styles.overallInfo}>
          <Text variant="subtitle" weight="semiBold">{active.name}</Text>
          <Text variant="small" tone="secondary">{overall.present} attended · {overall.absent} missed · {overall.unmarked} unmarked</Text>
          <Text variant="caption" tone="tertiary">Target {active.attendance_target}% · {active.prediction_mode} projection</Text>
        </View>
      </Card>

      <View style={styles.statsRow}>
        <StatCard label="At risk" value={`${atRisk}`} sublabel="courses" icon="alert-circle-outline" accent={atRisk > 0 ? theme.colors.danger : theme.colors.success} />
        <StatCard label="Can miss" value={`${totalBunk}`} sublabel="classes total" icon="umbrella-outline" accent={theme.colors.secondary} />
      </View>

      <SectionHeader title="Attendance trend (8 weeks)" />
      <Card><TrendChart points={trend} /></Card>

      <SectionHeader title="Course-wise attendance" />
      <Card>
        <CourseBars data={reportCourses.map((c) => ({ name: c.name, percent: c.stats.percent, color: c.color, target: c.stats.target }))} />
        <Text variant="caption" tone="tertiary" style={styles.legend}>Vertical markers show each course's target.</Text>
      </Card>

      <SectionHeader title="Export" />
      {error ? <Text variant="small" tone="danger">{error}</Text> : null}
      <View style={styles.exportRow}>
        <Button label="CSV data" icon="document-outline" variant="secondary" fullWidth loading={exporting === 'csv'} onPress={exportCsv} style={styles.flex} />
        <Button label="PDF report" icon="print-outline" variant="secondary" fullWidth loading={exporting === 'pdf'} onPress={exportPdf} style={styles.flex} />
      </View>
      <Text variant="caption" tone="tertiary">
        Reports use the native share sheet. Unmarked sessions are excluded from percentages; estimates
        are labelled where schedule data is incomplete.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingTop: 16 },
  empty: { flexGrow: 1, justifyContent: 'center' },
  overallCard: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  overallInfo: { flex: 1, gap: 4 },
  statsRow: { flexDirection: 'row', gap: 10 },
  legend: { marginTop: 12 },
  exportRow: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
});
