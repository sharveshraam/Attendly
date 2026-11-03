import React from 'react';
import { Badge, type BadgeTone } from '@/components/ui';
import type { CourseAttendanceStats } from '@/types/domain';

const LABELS: Record<CourseAttendanceStats['risk'], { label: string; tone: BadgeTone }> = {
  safe: { label: 'On track', tone: 'success' },
  warning: { label: 'Watch', tone: 'warning' },
  at_risk: { label: 'At risk', tone: 'danger' },
  unknown: { label: 'No data', tone: 'neutral' },
};

export function RiskBadge({ risk }: { risk: CourseAttendanceStats['risk'] }) {
  const { label, tone } = LABELS[risk];
  return <Badge label={label} tone={tone} />;
}
