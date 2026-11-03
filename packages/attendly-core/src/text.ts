/**
 * Format-tolerant text normalisation for academic documents.
 * Pure string logic: no DOM, no Date, no I/O, no framework imports.
 * Every ambiguous parse returns null (never a guess) so callers can flag it.
 */
import type { Confidence, SessionType } from "./types.ts";

const DAY_WORDS: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

/** Parse a single weekday. Accepts names, abbreviations, 0-6 and ISO 1-7. */
export function parseWeekday(value: string): number | null {
  const trimmed = value.trim().toLowerCase().replace(/[.,]/g, "");
  if (!trimmed) return null;
  const direct = DAY_WORDS[trimmed];
  if (direct !== undefined) return direct;
  // Longest prefix match so "Monday/Wednesday" is rejected rather than guessed.
  for (const [word, day] of Object.entries(DAY_WORDS)) {
    if (trimmed === word) return day;
  }
  if (/^[0-6]$/.test(trimmed)) return Number(trimmed);
  return null;
}

/** Extract every weekday mentioned in a cell (e.g. "Mon / Wed", "Mon-Fri"). */
export function parseWeekdayList(value: string): number[] {
  const found = new Set<number>();
  const cleaned = value.toLowerCase().replace(/\./g, "");
  const range = /^(mon|tue|wed|thu|fri|sat|sun)\w*\s*[-–to]+\s*(mon|tue|wed|thu|fri|sat|sun)\w*$/.exec(cleaned.trim());
  if (range) {
    const first = parseWeekday(range[1] ?? "");
    const last = parseWeekday(range[2] ?? "");
    if (first !== null && last !== null && last >= first) {
      for (let day = first; day <= last; day += 1) found.add(day);
      return [...found];
    }
  }
  const tokenPattern = /\b(sun|mon|tue|wed|thu|fri|sat)(?:day|sday|s|nesday|rsday|urday)?\b/g;
  for (const match of cleaned.matchAll(tokenPattern)) {
    const day = parseWeekday(match[1] ?? "");
    if (day !== null) found.add(day);
  }
  return [...found];
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Normalise a wall-clock time to HH:mm. Returns null for anything uncertain. */
export function normalizeTime(value: string, defaultMeridiem?: "am" | "pm"): string | null {
  const raw = value.trim().toLowerCase().replace(/\./g, "").replace(/\s+/g, " ");
  if (!raw) return null;
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/.exec(raw);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? "0");
  const meridiem = match[3]?.replace(/\./g, "") ?? defaultMeridiem;
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return `${pad(hour)}:${pad(minute)}`;
}

export interface TimeRange {
  start: string;
  end: string;
  /** End falls on the following calendar day. */
  crossesMidnight: boolean;
}

const RANGE_SPLIT = /\s*(?:-|–|—|to|till|until)\s*/i;

/**
 * Parse "9:00–10:00", "9-10 AM", "09:00 to 10:30", "2 PM - 3:30 PM".
 * A bare "9:00" returns null (end is unknown and must not be invented).
 */
export function parseTimeRange(value: string): TimeRange | null {
  const raw = value.trim().replace(/\s+/g, " ").replace(/[‐‑‒]/g, "-");
  if (!raw) return null;
  const parts = raw.split(RANGE_SPLIT).filter((part) => part.trim().length > 0);
  if (parts.length !== 2) return null;
  const left = (parts[0] ?? "").trim();
  const right = (parts[1] ?? "").trim();
  // If only one side carries an AM/PM marker, propagate it to the other.
  const leftMeridiem = /(?:a|p)\.?m\.?$/i.test(left) ? (left.toLowerCase().includes("pm") ? "pm" : "am") : undefined;
  const rightMeridiem = /(?:a|p)\.?m\.?$/i.test(right) ? (right.toLowerCase().includes("pm") ? "pm" : "am") : undefined;
  const start = normalizeTime(left, rightMeridiem ?? leftMeridiem);
  const end = normalizeTime(right, leftMeridiem ?? rightMeridiem);
  if (!start || !end) return null;
  return { start, end, crossesMidnight: end <= start };
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number) as [number, number];
  return hours * 60 + minutes;
}

export function durationMinutes(start: string, end: string): number {
  const diff = timeToMinutes(end) - timeToMinutes(start);
  return diff > 0 ? diff : diff + 24 * 60;
}

/**
 * Course codes look like CS301, MA-302, 21CS301, EC 305, CS301A.
 * Must contain at least one digit and at least two leading letters; ordinary
 * words and single letters are never treated as codes.
 */
const CODE_PATTERN = /\b(\d{0,2}[A-Za-z]{2,4}[\s\-_]?\d{2,4}[A-Za-z]?)\b/g;

export function findCourseCode(value: string): string | null {
  const cleaned = value.replace(/[()[\]{}]/g, " ");
  for (const match of cleaned.matchAll(CODE_PATTERN)) {
    const candidate = (match[1] ?? "").trim();
    if (/\d/.test(candidate) && /[A-Za-z]{2}/.test(candidate)) return normalizeCode(candidate);
  }
  return null;
}

export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[\s\-_]/g, "").replace(/[^A-Z0-9]/g, "");
}

/** Strip punctuation/case/whitespace differences for name-based deduplication. */
export function normalizeCourseName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Strip a leading course code from a combined cell such as "CS301 - Database Systems". */
export function stripLeadingCode(value: string, code: string | null): string {
  if (!code) return value.trim();
  const compact = normalizeCode(value.split(/[-–:]/)[0] ?? "");
  if (compact === code) {
    return value.replace(/^[^–\-:]*[–\-:]\s*/, "").trim();
  }
  return value.replace(new RegExp(`\\b${code}\\b`, "i"), "").replace(/^[\s\-–:,/]+|[\s\-–:,/]+$/g, "").trim();
}

/**
 * Stable identity for a course: a normalised code wins over a name. This is
 * what prevents "Mathematics" / "MATHEMATICS " / "MA301 Mathematics" from
 * becoming three different courses.
 */
export function courseKey(code: string | null, name: string): string {
  if (code) return `code:${normalizeCode(code)}`;
  const normalized = normalizeCourseName(name);
  return `name:${normalized || "unknown"}`;
}

const TYPE_RULES: [RegExp, SessionType][] = [
  [/\b(lab(oratory)?|practical|practicum)\b|\blab\b|\(l\)|\bl\/\b/i, "lab"],
  [/\b(tutorial|tut(orial)?)\b|\(t\)|\bt\b/i, "tutorial"],
  [/\b(seminar|colloquium)\b/i, "seminar"],
  [/\b(lecture|theory|class|lec)\b|\(l\)/i, "lecture"],
];

export function detectSessionType(value: string): SessionType {
  const trimmed = value.trim();
  if (!trimmed) return "unknown";
  if (/^l$/i.test(trimmed)) return "lecture";
  if (/^(lab|p)$/i.test(trimmed)) return "lab";
  if (/^t$/i.test(trimmed)) return "tutorial";
  for (const [pattern, type] of TYPE_RULES) {
    if (pattern.test(trimmed)) return type;
  }
  return "unknown";
}

const FACULTY_TITLE = /\b(?:dr|prof|professor|mr|mrs|ms|shri|smt)\.?\s+[A-Za-z]/i;

/** Only explicit titles/initials count. A bare "Database Systems" is a course. */
export function hasFacultyTitle(value: string): boolean {
  return FACULTY_TITLE.test(value.trim()) || /^([A-Z]\.)+\s*[A-Z][A-Za-z.'-]+$/.test(value.trim());
}

export function looksLikeFaculty(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 80) return false;
  return hasFacultyTitle(trimmed);
}

export function detectRoom(value: string): string | null {
  const trimmed = value.trim();
  // A room is a SHORT token: "Lab-3", "LH 2", "Room 101", "Block A".
  // A course name such as "Programming Lab" or "Database Systems" is never a
  // room even though it contains the word "lab".
  if (!trimmed || trimmed.length > 24) return null;
  if (/^(?:room|rm|hall|lh|lab|lecture\s+hall|venue|block)\b[\s:.-]*[A-Za-z0-9-]{1,8}$/i.test(trimmed)) return trimmed;
  if (/^[A-Za-z]{1,4}[- ]?\d{2,4}[A-Za-z]?$/.test(trimmed)) return trimmed;
  return null;
}

export function confidenceFor(issues: string[], base: Confidence = "high"): Confidence {
  if (issues.length >= 2) return "low";
  if (issues.length === 1) return base === "high" ? "medium" : "low";
  return base;
}
