/** Minimal RFC-4180 CSV parsing + timetable/academic-calendar import. */
import { timeToMinutes } from "../dates.ts";
import type { AcademicDayDraft, TimetableDraftRow } from "../types.ts";

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const source = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else inQuotes = false;
      } else field += char;
      continue;
    }
    if (char === '"') inQuotes = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim().length > 0));
}

/** Reject impossible calendar dates (e.g. 2026-13-01) rather than storing them. */
function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year!, month! - 1, day!));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month! - 1 &&
    parsed.getUTCDate() === day
  );
}

const WEEKDAY_LOOKUP: Record<string, number> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5, sat: 6, saturday: 6,
};

export function parseWeekday(value: string): number | null {
  const trimmed = value.trim().toLowerCase();
  if (/^[0-6]$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  return WEEKDAY_LOOKUP[trimmed] ?? null;
}

export function normalizeTime(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!match) return null;
  let hour = Number.parseInt(match[1] ?? "0", 10);
  const minute = Number.parseInt(match[2] ?? "0", 10);
  const meridiem = match[3]?.toLowerCase();
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export interface CsvImportResult<T> {
  rows: T[];
  errors: { line: number; message: string }[];
}

const TIMETABLE_ALIASES: Record<string, keyof TimetableDraftRow> = {
  course_code: "courseCode", code: "courseCode",
  course_name: "courseName", course: "courseName", name: "courseName", subject: "courseName",
  weekday: "weekday", day: "weekday",
  start_time: "startTime", start: "startTime", from: "startTime",
  end_time: "endTime", end: "endTime", to: "endTime",
  location: "location", room: "location", venue: "location",
};

export function parseTimetableCsv(text: string): CsvImportResult<TimetableDraftRow> {
  const grid = parseCsv(text);
  const rows: TimetableDraftRow[] = [];
  const errors: CsvImportResult<TimetableDraftRow>["errors"] = [];
  if (grid.length < 2) {
    return { rows, errors: [{ line: 1, message: "CSV needs a header row and at least one data row." }] };
  }
  const header = (grid[0] ?? []).map((value) => value.trim().toLowerCase().replace(/\s+/g, "_"));
  const map = header.map((value) => TIMETABLE_ALIASES[value] ?? null);
  for (const required of ["courseName", "weekday", "startTime", "endTime"] as const) {
    if (!map.includes(required)) {
      return { rows, errors: [{ line: 1, message: "Header must include course_name, weekday, start_time and end_time." }] };
    }
  }

  grid.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const get = (key: keyof TimetableDraftRow): string => {
      const column = map.indexOf(key);
      return column >= 0 ? (cells[column] ?? "").trim() : "";
    };
    const courseName = get("courseName");
    const weekday = parseWeekday(get("weekday"));
    const startTime = normalizeTime(get("startTime"));
    const endTime = normalizeTime(get("endTime"));
    if (!courseName) return errors.push({ line, message: "Missing course name." });
    if (weekday === null) return errors.push({ line, message: `Invalid weekday "${get("weekday")}".` });
    if (!startTime || !endTime) return errors.push({ line, message: "Invalid start/end time (use HH:MM or 9:00 AM)." });
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      return errors.push({ line, message: "End time must be after start time." });
    }
    rows.push({
      id: `csv-${line}`,
      courseCode: get("courseCode"),
      courseName,
      weekday,
      startTime,
      endTime,
      location: get("location"),
    });
  });
  return { rows, errors };
}

const DAY_KINDS = new Set(["instructional", "non_instructional", "holiday", "exam", "closure", "special_working"]);

export function parseAcademicDaysCsv(text: string): CsvImportResult<AcademicDayDraft> {
  const grid = parseCsv(text);
  const rows: AcademicDayDraft[] = [];
  const errors: CsvImportResult<AcademicDayDraft>["errors"] = [];
  if (grid.length < 2) return { rows, errors: [{ line: 1, message: "CSV needs a header row and at least one data row." }] };
  const header = (grid[0] ?? []).map((value) => value.trim().toLowerCase().replace(/\s+/g, "_"));
  if (!header.includes("date") || !header.includes("kind")) {
    return { rows, errors: [{ line: 1, message: "Header must include date and kind." }] };
  }
  const dateIndex = header.indexOf("date");
  const kindIndex = header.indexOf("kind");
  const titleIndex = header.indexOf("title");
  grid.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const rawDate = (cells[dateIndex] ?? "").trim();
    const date = isValidDateKey(rawDate) ? rawDate : null;
    const rawKind = (cells[kindIndex] ?? "").trim().toLowerCase().replace(/\s+/g, "_");
    if (!date) return errors.push({ line, message: "Date must be YYYY-MM-DD." });
    if (!DAY_KINDS.has(rawKind)) return errors.push({ line, message: `Unsupported day kind "${rawKind}".` });
    rows.push({
      id: `csv-day-${line}`,
      day: date,
      kind: rawKind as AcademicDayDraft["kind"],
      title: titleIndex >= 0 ? (cells[titleIndex] ?? "").trim() : "",
    });
  });
  return { rows, errors };
}

export const TIMETABLE_CSV_TEMPLATE =
  "course_code,course_name,weekday,start_time,end_time,location\nCS301,Database Systems,Mon,09:00,10:00,Lab 2\nMA302,Probability,Tue,11:00,12:00,Room 14\n";

export const ACADEMIC_DAYS_CSV_TEMPLATE =
  "date,kind,title\n2026-01-26,holiday,Republic Day\n2026-03-20,exam,Mid-semester exams\n";
