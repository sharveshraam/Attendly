import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme';

export interface TrendPoint {
  label: string;
  value: number | null;
}

/** Simple SVG line/area chart for attendance trends. */
export function TrendChart({ points, height = 160 }: { points: TrendPoint[]; height?: number }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const width = 320;
  const padX = 28;
  const padY = 20;
  const usable = points.filter((p) => p.value !== null) as { label: string; value: number }[];

  if (usable.length === 0) {
    return <View style={[styles.empty, { height }]}><Text variant="small" tone="tertiary">Not enough data for a trend yet.</Text></View>;
  }

  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const stepX = usable.length > 1 ? innerW / (usable.length - 1) : 0;
  const coords = usable.map((p, i) => ({
    x: padX + i * stepX,
    y: padY + innerH - (Math.max(0, Math.min(100, p.value)) / 100) * innerH,
    value: p.value,
    label: p.label,
  }));
  const linePath = coords.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${coords[coords.length - 1]!.x.toFixed(1)},${padY + innerH} L${coords[0]!.x.toFixed(1)},${padY + innerH} Z`;

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        <LinearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.primary} stopOpacity="0.28" />
          <Stop offset="1" stopColor={c.primary} stopOpacity="0.02" />
        </LinearGradient>
      </Defs>
      {[0, 50, 100].map((v) => {
        const y = padY + innerH - (v / 100) * innerH;
        return (
          <React.Fragment key={v}>
            <Line x1={padX} y1={y} x2={width - padX} y2={y} stroke={c.border} strokeWidth={1} />
            <SvgText x={padX - 6} y={y + 3} fontSize={9} fill={c.textTertiary} textAnchor="end">{v}</SvgText>
          </React.Fragment>
        );
      })}
      <Path d={areaPath} fill="url(#trendFill)" />
      <Path d={linePath} fill="none" stroke={c.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((pt, i) => (
        <React.Fragment key={i}>
          <Circle cx={pt.x} cy={pt.y} r={3.5} fill={c.primary} />
          <SvgText x={pt.x} y={height - 4} fontSize={9} fill={c.textTertiary} textAnchor="middle">{pt.label}</SvgText>
        </React.Fragment>
      ))}
    </Svg>
  );
}

export interface CourseBar {
  name: string;
  percent: number | null;
  color: string;
  target: number;
}

/** Horizontal course-wise attendance bars with target markers. */
export function CourseBars({ data }: { data: CourseBar[] }) {
  const { theme } = useTheme();
  const c = theme.colors;
  if (data.length === 0) {
    return <Text variant="small" tone="tertiary">No courses to chart yet.</Text>;
  }
  return (
    <View style={styles.bars}>
      {data.map((bar) => (
        <View key={bar.name} style={styles.barRow}>
          <Text variant="caption" tone="secondary" numberOfLines={1} style={styles.barLabel}>{bar.name}</Text>
          <View style={[styles.barTrack, { backgroundColor: c.surfaceSecondary }]}>
            <View style={[styles.barFill, { width: `${bar.percent ?? 0}%`, backgroundColor: bar.color }]} />
            <View style={[styles.targetMarker, { left: `${bar.target}%`, backgroundColor: c.textTertiary }]} />
          </View>
          <Text variant="caption" weight="semiBold" style={styles.barValue}>{bar.percent === null ? '—' : `${bar.percent}%`}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  bars: { gap: 12 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 90 },
  barTrack: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden', position: 'relative' },
  barFill: { height: 10, borderRadius: 5 },
  targetMarker: { position: 'absolute', top: -2, bottom: -2, width: 2 },
  barValue: { width: 42, textAlign: 'right' },
});
