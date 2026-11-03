import type { AcademicDayDraft, TimetableDraftRow } from '@/types/domain';
import type { AcademicDayKind } from '@/types/database';
import { timeToMinutes } from '@/lib/dates';

/** Minimal RFC-4180 CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < src.length; i += 1) {
    const char = src[i];
    if (inQuotes) {
      if (char === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

const WEEKDAY_LOOKUP: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

export function parseWeekday(value: string): number | null {
  const trimmed = value.trim().toLowerCase();
  if (/^[0-6]$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  return WEEKDAY_LOOKUP[trimmed] ?? null;
}

function normalizeTime(value: string): string | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!match) return null;
  let hour = Number.parseInt(match[1] ?? '0', 10);
  const minute = Number.parseInt(match[2] ?? '0', 10);
  const meridiem = match[3]?.toLowerCase();
  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export interface CsvImportResult<T> {
  rows: T[];
  errors: { line: number; message: string }[];
}

const TIMETABLE_ALIASES: Record<string, keyof TimetableDraftRow> = {
  course_code: 'courseCode', code: 'courseCode',
  course_name: 'courseName', course: 'courseName', name: 'courseName', subject: 'courseName',
  weekday: 'weekday', day: 'weekday',
  start_time: 'startTime', start: 'startTime', from: 'startTime',
  end_time: 'endTime', end: 'endTime', to: 'endTime',
  location: 'location', room: 'location', venue: 'location',
};

/**
 * Parse a timetable CSV. Expected headers (case-insensitive, aliases allowed):
 * course_code, course_name, weekday, start_time, end_time, location
 */
export function parseTimetableCsv(text: string): CsvImportResult<TimetableDraftRow> {
  const grid = parseCsv(text);
  const errors: CsvImportResult<TimetableDraftRow>['errors'] = [];
  const rows: TimetableDraftRow[] = [];
  if (grid.length < 2) {
    return { rows, errors: [{ line: 1, message: 'CSV needs a header row and at least one data row.' }] };
  }
  const header = (grid[0] ?? []).map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const map = header.map((h) => TIMETABLE_ALIASES[h] ?? null);
  if (!map.includes('courseName') || !map.includes('weekday') || !map.includes('startTime') || !map.includes('endTime')) {
    return {
      rows,
      errors: [{ line: 1, message: 'Header must include course_name, weekday, start_time and end_time.' }],
    };
  }

  grid.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const get = (key: keyof TimetableDraftRow): string => {
      const idx = map.indexOf(key);
      return idx >= 0 ? (cells[idx] ?? '').trim() : '';
    };
    const courseName = get('courseName');
    const weekday = parseWeekday(get('weekday'));
    const startTime = normalizeTime(get('startTime'));
    const endTime = normalizeTime(get('endTime'));
    if (!courseName) {
      errors.push({ line, message: 'Missing course name.' });
      return;
    }
    if (weekday === null) {
      errors.push({ line, message: `Invalid weekday "${get('weekday')}".` });
      return;
    }
    if (!startTime || !endTime) {
      errors.push({ line, message: 'Invalid start/end time (use HH:MM or 9:00 AM).' });
      return;
    }
    try {
      if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
        errors.push({ line, message: 'End time must be after start time.' });
        return;
      }
    } catch {
      errors.push({ line, message: 'Invalid time value.' });
      return;
    }
    rows.push({
      id: `csv-${line}`,
      courseCode: get('courseCode'),
      courseName,
      weekday,
      startTime,
      endTime,
      location: get('location'),
    });
  });

  return { rows, errors };
}

const DAY_KINDS: AcademicDayKind[] = [
  'instructional', 'non_instructional', 'holiday', 'exam', 'closure', 'special_working',
];

const DAY_ALIASES: Record<string, keyof AcademicDayDraft> = {
  date: 'day', day: 'day',
  kind: 'kind', type: 'kind', classification: 'kind',
  title: 'title', name: 'title', description: 'title', event: 'title',
};

/** Parse an academic-calendar CSV: date, kind, title. */
export function parseAcademicCalendarCsv(text: string): CsvImportResult<AcademicDayDraft> {
  const grid = parseCsv(text);
  const errors: CsvImportResult<AcademicDayDraft>['errors'] = [];
  const rows: AcademicDayDraft[] = [];
  if (grid.length < 2) {
    return { rows, errors: [{ line: 1, message: 'CSV needs a header row and at least one data row.' }] };
  }
  const header = (grid[0] ?? []).map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const map = header.map((h) => DAY_ALIASES[h] ?? null);
  if (!map.includes('day') || !map.includes('kind')) {
    return { rows, errors: [{ line: 1, message: 'Header must include date and kind.' }] };
  }
  grid.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const get = (key: keyof AcademicDayDraft): string => {
      const idx = map.indexOf(key);
      return idx >= 0 ? (cells[idx] ?? '').trim() : '';
    };
    const day = get('day');
    const kindRaw = get('kind').toLowerCase().replace(/[\s-]+/g, '_');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      errors.push({ line, message: `Invalid date "${day}" (use YYYY-MM-DD).` });
      return;
    }
    if (!DAY_KINDS.includes(kindRaw as AcademicDayKind)) {
      errors.push({ line, message: `Unknown kind "${get('kind')}". Use: ${DAY_KINDS.join(', ')}.` });
      return;
    }
    rows.push({ id: `cal-${line}`, day, kind: kindRaw as AcademicDayKind, title: get('title') });
  });
  return { rows, errors };
}
