/**
 * Pure calendar-date helpers. Every operation is done on `YYYY-MM-DD` keys via
 * Date.UTC, so daylight-saving transitions and the viewer's timezone can never
 * shift a scheduled day. No local Date arithmetic, no I/O, no platform APIs.
 */

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDateKey(value: string): boolean {
  const match = DATE_KEY.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

/** Assert-free variant returning null for invalid input. */
export function normalizeDateKey(value: string): string | null {
  return isValidDateKey(value.trim()) ? value.trim() : null;
}

function toUtc(key: string): number {
  if (!isValidDateKey(key)) throw new RangeError(`Invalid date key: ${key}`);
  const [year, month, day] = key.split("-").map(Number) as [number, number, number];
  return Date.UTC(year, month - 1, day);
}

function fromUtc(ms: number): string {
  const date = new Date(ms);
  return `${String(date.getUTCFullYear()).padStart(4, "0")}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function addDaysKey(key: string, days: number): string {
  return fromUtc(toUtc(key) + days * 86_400_000);
}

/** 0 = Sunday .. 6 = Saturday. */
export function weekdayOf(key: string): number {
  return new Date(toUtc(key)).getUTCDay();
}

export function eachDateKey(start: string, end: string): string[] {
  if (!isValidDateKey(start) || !isValidDateKey(end) || end < start) return [];
  const out: string[] = [];
  let cursor = start;
  // Guard against accidental infinite expansion on a corrupt range.
  let guard = 0;
  while (cursor <= end && guard < 20_000) {
    out.push(cursor);
    cursor = addDaysKey(cursor, 1);
    guard += 1;
  }
  return out;
}

export function daysBetween(start: string, end: string): number {
  if (!isValidDateKey(start) || !isValidDateKey(end)) return 0;
  return Math.round((toUtc(end) - toUtc(start)) / 86_400_000);
}

/** Monday-first week start key. */
export function startOfWeekKey(key: string): string {
  return addDaysKey(key, -((weekdayOf(key) + 6) % 7));
}

export function endOfWeekKey(key: string): string {
  return addDaysKey(startOfWeekKey(key), 6);
}

export function clampRange(start: string, end: string, rangeStart: string, rangeEnd: string): [string, string] {
  const lo = start > rangeStart ? start : rangeStart;
  const hi = end < rangeEnd ? end : rangeEnd;
  return [lo, hi];
}
