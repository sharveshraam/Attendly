/**
 * Academic-calendar interpretation and conversion into deterministic day
 * exceptions for the class-count engine.
 *
 * Reads semester boundaries, holidays, exam/vacation periods, special working
 * days, compensatory days, replacement timetables, one-off extra classes and
 * cancellations. Anything it cannot read confidently is returned as an
 * `uncertain` entry with its ORIGINAL text; it never guesses a date, a scope
 * or which timetable a replacement day follows.
 */
import { addDaysKey, eachDateKey, isValidDateKey, weekdayOf } from "./dates.ts";
import { confidenceFor, parseTimeRange, parseWeekday } from "./text.ts";
import type {
  CalendarEntry, CalendarEventType, CalendarExtraction, Confidence,
  DayException, DayScope, WeeklyRule,
} from "./types.ts";

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Parse common institutional date formats into a YYYY-MM-DD key. */
export function normalizeCalendarDate(value: string, defaultYear?: number): string | null {
  const raw = value.trim().replace(/[.,]/g, " ").replace(/\s+/g, " ");
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw) && isValidDateKey(raw)) return raw;
  const numeric = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/.exec(raw);
  if (numeric) {
    const year = Number(numeric[3]);
    const fullYear = year < 100 ? 2000 + year : year;
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    // DD/MM/YYYY is the default (Indian institutional calendars); fall back to
    // MM/DD/YYYY only when the day-first reading is impossible.
    const dayFirst = `${fullYear}-${pad(second)}-${pad(first)}`;
    const monthFirst = `${fullYear}-${pad(first)}-${pad(second)}`;
    if (isValidDateKey(dayFirst)) return dayFirst;
    return isValidDateKey(monthFirst) ? monthFirst : null;
  }
  // "26 Jan 2026" / "Jan 26 2026" / "January 26, 2026"
  const monthFirst = /^([A-Za-z]{3,9})\s+(\d{1,2})(?:\s+(\d{4}))?$/.exec(raw);
  const dayFirst = /^(\d{1,2})\s+([A-Za-z]{3,9})(?:\s+(\d{4}))?$/.exec(raw);
  const match = monthFirst ?? dayFirst;
  if (match) {
    const day = Number(monthFirst ? match[2] : match[1]);
    const month = MONTHS[(monthFirst ? match[1] : match[2] ?? "").toLowerCase()];
    const year = Number(match[3] ?? defaultYear);
    if (month && year) {
      const key = `${year}-${pad(month)}-${pad(day)}`;
      if (isValidDateKey(key)) return key;
    }
  }
  return null;
}

/** Extract the first date (or date range) from a free-text line. */
function datesIn(value: string, defaultYear?: number): { start: string | null; end: string | null } {
  const iso = value.match(/\d{4}-\d{2}-\d{2}/g) ?? [];
  const parsedIso = iso.map((item) => normalizeCalendarDate(item, defaultYear)).filter((item): item is string => item !== null);
  if (parsedIso.length > 0) return { start: parsedIso[0] ?? null, end: parsedIso[parsedIso.length - 1] ?? parsedIso[0] ?? null };
  const patterns = [
    /\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}/g,
    /[A-Za-z]{3,9}\s+\d{1,2}\s+\d{4}/g,
    /\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/g,
  ];
  for (const pattern of patterns) {
    const found = value.match(pattern) ?? [];
    const parsed = found.map((item) => normalizeCalendarDate(item, defaultYear)).filter((item): item is string => item !== null);
    if (parsed.length > 0) return { start: parsed[0] ?? null, end: parsed[parsed.length - 1] ?? parsed[0] ?? null };
  }
  return { start: null, end: null };
}

const TYPE_RULES: [RegExp, CalendarEventType][] = [
  [/semester\s*(start|begins|commences)|commencement\s*of\s*classes|classes\s*begin/i, "semester_start"],
  [/semester\s*(end|ends)|last\s*working\s*day|end\s*of\s*semester/i, "semester_end"],
  [/follows?\s*(mon|tue|wed|thu|fri|sat|sun)\w*\s*(timetable|schedule|time\s*table)|(mon|tue|wed|thu|fri|sat|sun)\w*\s*timetable\s*(is\s*)?followed|replacement\s*(working\s*)?day|compensatory\s*(working\s*)?day/i, "replacement_day"],
  [/special\s*working\s*(day|saturday|sunday)|working\s*(saturday|sunday)|extra\s*working\s*day/i, "special_working"],
  [/timetable\s*(change|revision|revised)|revised\s*timetable|new\s*timetable\s*from/i, "timetable_change"],
  [/cancell?ed|cancel\s*class|class\s*suspended|no\s*classes/i, "closure"],
  [/mid[\s-]*sem|end[\s-]*sem|examination|exams?|assessment\s*period/i, "exam"],
  [/(semester|mid[\s-]*term|winter|summer|spring|autumn|diwali|christmas|puja|holi)?\s*(break|vacation|holidays?\s*period|recess)/i, "vacation"],
  [/institutional\s*holiday|college\s*holiday|local\s*holiday/i, "institutional_holiday"],
  [/foundation\s*day|annual\s*day|sports\s*day|cultural\s*event|college\s*event/i, "college_event"],
  [/public\s*holiday|government\s*holiday|national\s*holiday|holiday/i, "holiday"],
  [/additional\s*class|extra\s*class|make[\s-]*up\s*class|compensatory\s*class/i, "other"],
];

export function detectCalendarType(value: string): CalendarEventType {
  for (const [pattern, type] of TYPE_RULES) {
    if (pattern.test(value)) return type;
  }
  return "other";
}

/** "Saturday follows Monday timetable" -> 1 (Monday). */
export function detectFollowsWeekday(value: string): number | null {
  const pattern = /follows?\s*(mon|tue|wed|thu|fri|sat|sun)\w*|(mon|tue|wed|thu|fri|sat|sun)\w*\s*(?:time\s*table|timetable|schedule)\s*(?:will\s*be\s*)?(?:followed|applicable|applies)|(?:as\s*per|per)\s*(mon|tue|wed|thu|fri|sat|sun)\w*/i;
  const match = pattern.exec(value);
  if (!match) return null;
  return parseWeekday(match[1] ?? match[2] ?? match[3] ?? "");
}

export function detectScope(value: string): DayScope {
  if (/half[\s-]*day|partial|forenoon|afternoon|first\s*half|second\s*half|till\s*\d/i.test(value)) return "partial";
  return "full_day";
}

const COLUMN_ALIASES: Record<string, string> = {
  date: "date", day: "date", from: "date", start_date: "date", start: "date",
  end_date: "end", to: "end", until: "end", till: "end",
  kind: "type", type: "type", event: "type", category: "type", classification: "type",
  title: "title", name: "title", description: "title", event_name: "title", holiday: "title",
  scope: "scope", duration: "scope", applies_to: "scope",
  follows: "follows", follows_weekday: "follows", replacement: "follows",
  start_time: "start_time", from_time: "start_time",
  end_time: "end_time", to_time: "end_time",
  notes: "note", note: "note", remarks: "note",
};

function headerKeys(row: string[]): string[] {
  return row.map((cell) => {
    const key = cell.trim().toLowerCase().replace(/[\s./-]+/g, "_").replace(/^_+|_+$/g, "");
    return COLUMN_ALIASES[key] ?? "ignore";
  });
}

function buildEntry(
  id: string,
  raw: string,
  type: CalendarEventType,
  start: string | null,
  end: string | null,
  title: string,
  scope: DayScope,
  followsWeekday: number | null,
  note: string | null,
  base: Confidence,
): CalendarEntry {
  const issues: string[] = [];
  if (!start) issues.push("Date could not be read; enter it manually.");
  if (end && start && end < start) issues.push("End date is before the start date.");
  if (scope === "partial") issues.push("Confirm whether this is a full-day or partial-day closure and which hours are affected.");
  if ((type === "replacement_day" || type === "special_working") && followsWeekday === null) {
    issues.push("Confirm which weekday's timetable applies on this special working day.");
  }
  if (type === "other" && /additional|extra|make[\s-]*up/i.test(raw)) {
    issues.push("Confirm the course, date and time of this one-off class.");
  }
  if (type === "other" && issues.length === 0) issues.push("Event type is unclear; confirm its effect on classes.");
  return {
    id, raw, date: start, endDate: end ?? start, type, title: title || raw.slice(0, 120),
    scope, followsWeekday, note,
    confidence: confidenceFor(issues, base),
    issues,
    needsReview: base === "low" || issues.length > 0,
  };
}

export interface InterpretCalendarOptions {
  source?: string;
  confidence?: Confidence;
  /** Year used when a date omits it; inferred from semester dates when absent. */
  defaultYear?: number;
}

export function interpretCalendarGrid(
  input: string[][] | string,
  options: InterpretCalendarOptions = {},
): CalendarExtraction {
  const base = options.confidence ?? "high";
  const rawGrid = typeof input === "string"
    ? input.split(/\r?\n/).map((line) => line.split(/\t|\s{2,}|,/).map((cell) => cell.trim()))
    : input;
  const grid = rawGrid
    .map((row) => row.map((cell) => (cell ?? "").replace(/\s+/g, " ").trim()))
    .filter((row) => row.some(Boolean));
  const source = options.source ?? "calendar";
  const warnings: string[] = [];
  if (grid.length === 0) {
    return { entries: [], semesterStart: null, semesterEnd: null, uncertain: [], rawGrid: [], source, warnings: ["The calendar contained no readable text."], needsReview: true };
  }
  const entries: CalendarEntry[] = [];
  const headerIndex = grid.findIndex((row) => headerKeys(row).filter((key) => key !== "ignore").length >= 2);
  const keys = headerIndex >= 0 ? headerKeys(grid[headerIndex] ?? []) : [];
  const dataRows = headerIndex >= 0 ? grid.slice(headerIndex + 1) : grid;
  const get = (row: string[], key: string): string => {
    const index = keys.indexOf(key);
    return index >= 0 ? (row[index] ?? "") : "";
  };

  const year = options.defaultYear ?? inferYear(grid.flat().join(" "));

  dataRows.forEach((row, index) => {
    const raw = row.join(" | ").trim();
    if (!raw) return;
    const dateCell = headerIndex >= 0 ? `${get(row, "date")} ${get(row, "end")}` : raw;
    const typeCell = headerIndex >= 0 ? `${get(row, "type")} ${get(row, "title")}` : raw;
    const titleCell = headerIndex >= 0 ? get(row, "title") || get(row, "type") : raw;
    const scopeCell = headerIndex >= 0 ? get(row, "scope") : raw;
    const followsCell = headerIndex >= 0 ? get(row, "follows") : raw;
    const noteCell = headerIndex >= 0 ? get(row, "note") : "";
    const dates = datesIn(dateCell, year);
    const type = detectCalendarType(`${typeCell} ${raw}`);
    const entry = buildEntry(
      `cal-${index + 1}`, raw, type, dates.start, dates.end,
      titleCell.trim(), detectScope(`${scopeCell} ${raw}`),
      detectFollowsWeekday(`${followsCell} ${raw}`),
      noteCell || null,
      base,
    );
    entries.push(entry);
  });

  const semesterStart = entries.find((entry) => entry.type === "semester_start")?.date ?? null;
  const semesterEnd = entries.find((entry) => entry.type === "semester_end")?.date ?? null;
  const uncertain = entries.filter((entry) => entry.needsReview);
  const confirmed = entries.filter((entry) => !entry.needsReview);
  if (uncertain.length > 0) warnings.push(`${uncertain.length} calendar entr${uncertain.length === 1 ? "y needs" : "ies need"} confirmation; they were not applied to the schedule.`);
  if (!semesterStart || !semesterEnd) warnings.push("Semester start/end could not be read from the calendar; keep the dates entered in academic setup or add them manually.");
  if (base === "low") warnings.push("OCR output is inherently uncertain: confirm every calendar entry before saving.");
  return {
    entries: confirmed, semesterStart, semesterEnd, uncertain,
    rawGrid: grid, source, warnings,
    needsReview: base === "low" || uncertain.length > 0,
  };
}

function inferYear(text: string): number | undefined {
  const years = [...text.matchAll(/\b(20\d{2})\b/g)].map((match) => Number(match[1]));
  return years.sort((a, b) => a - b)[0];
}

/** Map confirmed entries into flat, dated, deterministic day exceptions. */
export function toDayExceptions(entries: CalendarEntry[]): { exceptions: DayException[]; warnings: string[] } {
  const exceptions: DayException[] = [];
  const warnings: string[] = [];
  for (const entry of entries) {
    if (entry.needsReview || !entry.date) continue;
    if (entry.type === "semester_start" || entry.type === "semester_end" || entry.type === "college_event" || entry.type === "other") continue;
    const end = entry.endDate && entry.endDate >= entry.date ? entry.endDate : entry.date;
    const dates = eachDateKey(entry.date, end);
    const type: DayException["type"] =
      entry.type === "holiday" || entry.type === "institutional_holiday" ? "holiday" :
      entry.type === "closure" ? "closure" :
      entry.type === "exam" ? "exam" :
      entry.type === "vacation" ? "vacation" :
      entry.type === "special_working" || entry.type === "compensatory_working" ? "special_working" :
      entry.type === "replacement_day" ? "replacement_day" : "timetable_change";
    if (dates.length > 400) {
      warnings.push(`"${entry.title}" spans more than 400 days; it was truncated to protect the schedule.`);
      dates.length = 400;
    }
    const times = parseOneOffTimes(entry);
    dates.forEach((date) => {
      exceptions.push({
        id: `${entry.id}:${date}`,
        date,
        priority: entry.type === "replacement_day" || entry.type === "special_working" ? 100 :
          entry.type === "timetable_change" ? 90 : 50,
        type,
        scope: entry.scope,
        followsWeekday: entry.followsWeekday,
        courseKeys: [],
        startTime: times.start,
        endTime: times.end,
        // One-off classes always come from the explicitly confirmed UI action,
        // never from a guessed course in free text.
        extraRule: null,
        rescheduled: false,
        confirmed: true,
      });
    });
  }
  return { exceptions, warnings };
}

function parseOneOffTimes(entry: CalendarEntry): { start: string | null; end: string | null } {
  const range = parseTimeRange(entry.raw);
  if (!range) return { start: null, end: null };
  return { start: range.start, end: range.end };
}

/** A confirmed cancellation/reschedule expressed directly by the user. */
export function cancellationException(
  id: string,
  date: string,
  courseKey: string | null,
  startTime: string | null,
  endTime: string | null,
  rescheduled: boolean,
): DayException {
  return {
    id, date, priority: 200, type: "cancelled",
    scope: courseKey || startTime ? "partial" : "full_day",
    followsWeekday: null,
    courseKeys: courseKey ? [courseKey] : [],
    startTime, endTime, extraRule: null,
    rescheduled, confirmed: true,
  };
}

/** One-time additional class, explicitly confirmed. */
export function additionalClassException(
  id: string,
  courseKey: string,
  date: string,
  startTime: string,
  endTime: string,
): DayException {
  return {
    id, date, priority: 150, type: "additional", scope: "partial",
    followsWeekday: null, courseKeys: [courseKey],
    startTime, endTime,
    extraRule: {
      id: `${id}-rule`, courseKey, weekday: weekdayOf(date),
      startTime, endTime, sessionType: "lecture",
      validFrom: date, validUntil: date,
    },
    rescheduled: false, confirmed: true,
  };
}

/** Special working day that runs another weekday's timetable exactly once. */
export function replacementDayException(
  id: string,
  date: string,
  followsWeekday: number,
): DayException {
  return {
    id, date, priority: 120, type: "replacement_day", scope: "full_day",
    followsWeekday, courseKeys: [], startTime: null, endTime: null,
    extraRule: null, rescheduled: false, confirmed: true,
  };
}

/** Expand a weekly rule revision into two validity-windowed rule sets. */
export function applyTimetableRevision(
  oldRules: WeeklyRule[],
  newRules: WeeklyRule[],
  effectiveDate: string,
): WeeklyRule[] {
  const closed = oldRules.map((rule) => ({ ...rule, validUntil: addDaysKey(effectiveDate, -1) }));
  const opened = newRules.map((rule) => ({ ...rule, validFrom: effectiveDate }));
  return [...closed, ...opened];
}
