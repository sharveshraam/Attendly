import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme';
import { isSameDay, monthGrid, toDateKey } from '@/lib/dates';
import { WEEKDAYS_SHORT } from '@/constants';
import type { AcademicDay, CalendarEvent } from '@/types/domain';

interface MonthGridProps {
  anchor: Date;
  selected: Date;
  onSelect: (date: Date) => void;
  events: CalendarEvent[];
  academicDays: AcademicDay[];
  courseColor: (courseId: string | null) => string;
}

export function MonthGrid({ anchor, selected, onSelect, events, academicDays, courseColor }: MonthGridProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const days = monthGrid(anchor);
  const month = anchor.getMonth();
  const today = new Date();
  const dayKindByDate = new Map(academicDays.map((d) => [d.day, d.kind]));
  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = toDateKey(new Date(event.starts_at));
    const list = eventsByDate.get(key) ?? [];
    list.push(event);
    eventsByDate.set(key, list);
  }

  return (
    <View>
      <View style={styles.weekRow}>
        {WEEKDAYS_SHORT.map((d) => (
          <Text key={d} variant="caption" tone="tertiary" weight="semiBold" style={styles.weekCell}>
            {d[0]}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {days.map((day) => {
          const key = toDateKey(day);
          const inMonth = day.getMonth() === month;
          const isSelected = isSameDay(day, selected);
          const isToday = isSameDay(day, today);
          const dayEvents = eventsByDate.get(key) ?? [];
          const kind = dayKindByDate.get(key);
          const isHoliday = kind === 'holiday' || kind === 'closure' || kind === 'non_instructional';
          return (
            <Pressable
              key={key}
              onPress={() => onSelect(day)}
              accessibilityRole="button"
              accessibilityLabel={day.toDateString()}
              style={[
                styles.cell,
                {
                  backgroundColor: isSelected ? c.primary : 'transparent',
                  borderRadius: theme.radius.sm,
                  opacity: inMonth ? 1 : 0.35,
                },
              ]}
            >
              <Text
                variant="small"
                weight={isToday || isSelected ? 'bold' : 'medium'}
                style={{ color: isSelected ? (theme.name === 'dark' ? '#090D14' : '#FFFFFF') : isHoliday ? c.danger : isToday ? c.primary : c.text }}
              >
                {day.getDate()}
              </Text>
              <View style={styles.dots}>
                {dayEvents.slice(0, 3).map((e) => (
                  <View key={e.id} style={[styles.dot, { backgroundColor: isSelected ? (theme.name === 'dark' ? '#090D14' : '#FFFFFF') : courseColor(e.course_id) }]} />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekCell: { flex: 1, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 0.92, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 4 },
  dots: { flexDirection: 'row', gap: 2, height: 5 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
});
