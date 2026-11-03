import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  parse,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

export const DATE_FMT = 'yyyy-MM-dd';
export const TIME_FMT = 'HH:mm';

export function toDateKey(date: Date): string {
  return format(date, DATE_FMT);
}

export function fromDateKey(key: string): Date {
  return parse(key, DATE_FMT, new Date());
}

export function toTimeKey(date: Date): string {
  return format(date, TIME_FMT);
}

/** Parse "HH:mm" or "HH:mm:ss" into minutes since midnight. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map((part) => Number.parseInt(part, 10));
  if (Number.isNaN(h ?? NaN) || Number.isNaN(m ?? NaN)) {
    throw new RangeError(`Invalid time: ${time}`);
  }
  return (h ?? 0) * 60 + (m ?? 0);
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Combine a date key and a time key into a local ISO-like timestamp. */
export function combineDateTime(dateKey: string, timeKey: string): string {
  const date = fromDateKey(dateKey);
  const [h, m] = timeKey.split(':').map((p) => Number.parseInt(p, 10));
  date.setHours(h ?? 0, m ?? 0, 0, 0);
  return date.toISOString();
}

export function formatTime(iso: string): string {
  return format(parseISO(iso), 'h:mm a');
}

export function formatDate(iso: string): string {
  return format(parseISO(iso), 'EEE, d MMM');
}

export function formatDateLong(iso: string): string {
  return format(parseISO(iso), 'EEEE, d MMMM yyyy');
}

export function formatRange(startIso: string, endIso: string): string {
  return `${formatTime(startIso)} – ${formatTime(endIso)}`;
}

export function weekdayOf(date: Date): number {
  return date.getDay();
}

export function daysBetween(startKey: string, endKey: string): number {
  return differenceInCalendarDays(fromDateKey(endKey), fromDateKey(startKey));
}

export function eachDateKey(startKey: string, endKey: string): string[] {
  const start = fromDateKey(startKey);
  const end = fromDateKey(endKey);
  if (end < start) return [];
  return eachDayOfInterval({ start, end }).map(toDateKey);
}

export function monthGrid(anchor: Date): Date[] {
  const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end });
}

export function weekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

export function relativeDayLabel(iso: string): string {
  const date = parseISO(iso);
  const today = new Date();
  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, addDays(today, 1))) return 'Tomorrow';
  if (isSameDay(date, addDays(today, -1))) return 'Yesterday';
  return format(date, 'EEE, d MMM');
}

export function countdownLabel(targetIso: string): string {
  const target = parseISO(targetIso);
  const diffMs = target.getTime() - Date.now();
  if (diffMs <= 0) return 'Now';
  const days = Math.floor(diffMs / 86_400_000);
  const hours = Math.floor((diffMs % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export { addDays, format, isSameDay, parseISO, parse };
