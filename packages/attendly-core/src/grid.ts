/**
 * Layout-agnostic timetable interpretation.
 *
 * Supports the three shapes real institutional timetables actually use:
 *   rows   — one row per session (Day | Time | Course | Code | Faculty | Room)
 *   matrix — time slots down the first column and weekdays across the header
 *            (or the transposed form with weekdays down the first column)
 *   text   — free-form lines such as "Monday 9:00-10:00 Mathematics"
 *
 * Nothing is invented: an unparseable cell becomes an uncertain entry holding
 * its original text, and reliable entries keep processing independently.
 */
import {
  confidenceFor, courseKey, detectRoom, detectSessionType, durationMinutes,
  findCourseCode, hasFacultyTitle, normalizeCode, normalizeCourseName,
  parseTimeRange, parseWeekday, parseWeekdayList, stripLeadingCode,
} from "./text.ts";
import type {
  Confidence, DetectedCourse, ExtractedSlot, SessionType, TimetableExtraction,
} from "./types.ts";

export interface PositionedText {
  x: number;
  y: number;
  text: string;
}

type ColumnKey =
  | "day" | "start" | "end" | "time" | "course" | "code"
  | "faculty" | "room" | "type" | "ignore";

const COLUMN_ALIASES: Record<string, ColumnKey> = {
  day: "day", weekday: "day", days: "day", "day_of_week": "day",
  date: "day", time: "time", slot: "time", period: "time", timings: "time",
  start: "start", from: "start", start_time: "start", starts_at: "start",
  end: "end", to: "end", end_time: "end", ends_at: "end",
  course: "course", subject: "course", course_name: "course", subject_name: "course",
  paper: "course", module: "course", class: "course",
  code: "code", course_code: "code", subject_code: "code", paper_code: "code", code_no: "code",
  faculty: "faculty", staff: "faculty", instructor: "faculty", teacher: "faculty",
  professor: "faculty", name_of_faculty: "faculty", handled_by: "faculty",
  room: "room", venue: "room", location: "room", room_no: "room", hall: "room",
  type: "type", session: "type", session_type: "type", kind: "type", component: "type",
};

function headerKey(value: string): ColumnKey {
  const normalized = value.trim().toLowerCase().replace(/[\s./-]+/g, "_").replace(/^_+|_+$/g, "");
  return COLUMN_ALIASES[normalized] ?? "ignore";
}

function cleanGrid(grid: string[][]): string[][] {
  return grid
    .map((row) => row.map((cell) => (cell ?? "").replace(/\s+/g, " ").trim()))
    .filter((row) => row.some((cell) => cell.length > 0));
}

function countWeekdayHeaders(row: string[]): number {
  return row.reduce((total, cell) => total + (parseWeekdayList(cell).length > 0 ? 1 : 0), 0);
}

function makeSlot(
  id: string,
  raw: string,
  parts: {
    courseName?: string; code?: string | null; weekday?: number | null;
    start?: string | null; end?: string | null; type?: SessionType;
    faculty?: string | null; room?: string | null;
  },
  base: Confidence = "high",
): ExtractedSlot {
  const issues: string[] = [];
  const range = parts.start && parts.end ? { start: parts.start, end: parts.end } : null;
  const courseName = (parts.courseName ?? "").trim();
  const code = parts.code ? normalizeCode(parts.code) : null;
  if (!courseName) issues.push("Course name could not be read.");
  if (parts.weekday === null || parts.weekday === undefined) issues.push("Day could not be read.");
  if (!range) issues.push("Start/end time could not be read.");
  if (code && !/^[A-Z0-9]{4,12}$/.test(code)) issues.push("Course code looks unusual.");
  if (code && courseName && normalizeCode(courseName) === code) {
    issues.push("Only a course code was found; the course name needs confirmation.");
  }
  // Courses without a code, and sessions without an explicit type, are normal:
  // they are matched by name and default to a single lecture session. Neither
  // is an uncertainty requiring human intervention.
  const confidence = confidenceFor(issues, base);
  return {
    id,
    raw,
    courseName,
    courseCode: code,
    weekday: parts.weekday ?? null,
    startTime: range?.start ?? null,
    endTime: range?.end ?? null,
    sessionType: parts.type ?? "unknown",
    faculty: parts.faculty ?? null,
    room: parts.room ?? null,
    confidence,
    issues,
    needsReview: base === "low" || issues.length > 0,
  };
}

/**
 * Recompute the structural reasons a slot needs review from its CURRENT field
 * values. Used by the review UI after a human corrects a cell, so a fixed row
 * stops being flagged and an ambiguous row cannot be silently accepted.
 */
export function refreshSlotIssues(slot: ExtractedSlot, base: Confidence = "high"): ExtractedSlot {
  const issues: string[] = [];
  const name = slot.courseName.trim();
  const code = slot.courseCode ? normalizeCode(slot.courseCode) : null;
  if (!name) issues.push("Course name could not be read.");
  if (slot.weekday === null) issues.push("Day could not be read.");
  if (!slot.startTime || !slot.endTime) issues.push("Start/end time could not be read.");
  if (code && !/^[A-Z0-9]{4,12}$/.test(code)) issues.push("Course code looks unusual.");
  if (code && name && normalizeCode(name) === code) issues.push("Only a course code was found; the course name needs confirmation.");
  return {
    ...slot,
    issues,
    confidence: confidenceFor(issues, base),
    needsReview: base === "low" || issues.length > 0,
  };
}

/** Pull a code, session type, room and faculty out of a free-form course cell. */
export function parseCourseCell(cell: string): {
  name: string;
  code: string | null;
  type: SessionType;
  room: string | null;
  faculty: string | null;
} {
  const raw = cell.trim();
  const code = findCourseCode(raw);
  let name = stripLeadingCode(raw, code);
  let type: SessionType = "unknown";
  let room: string | null = null;
  let faculty: string | null = null;

  // Bracketed / trailing session markers: "(Lab)", "L", "[T]", "Lecture".
  const typeMatch = /\((lab|lecture|tutorial|practical|seminar|l|t|p)\)|\[(lab|lecture|tutorial|practical|seminar|l|t|p)\]/i.exec(raw);
  if (typeMatch) {
    type = detectSessionType(typeMatch[1] ?? typeMatch[2] ?? "");
    name = name.replace(typeMatch[0], " ").trim();
  } else {
    const leading = /^(lab|laboratory|practical|tutorial|lecture|seminar)\s*[-:/]\s*/i.exec(name);
    if (leading) {
      type = detectSessionType(leading[1] ?? "");
      name = name.slice(leading[0].length).trim();
    }
  }

  // Split on separators and classify remaining fragments.
  const fragments = name.split(/\s*(?:\/|,|;|\||\n|\(|\[)\s*/).map((part) => part.trim()).filter(Boolean);
  const TYPE_ONLY = new Set([
    "lab", "laboratory", "practical", "practicum", "tutorial", "tut",
    "seminar", "colloquium", "lecture", "theory", "class", "lec", "l", "t", "p",
  ]);
  const kept: string[] = [];
  for (const fragment of fragments) {
    const fragmentType = detectSessionType(fragment);
    const bare = fragment.toLowerCase().replace(/[^a-z]/g, "");
    if (TYPE_ONLY.has(bare)) {
      if (type === "unknown") type = detectSessionType(bare);
      continue; // a standalone type marker is not part of the course name
    }
    // A course whose NAME includes a type word ("Programming Lab") still gets
    // the session type, but the full name is preserved.
    if (fragmentType !== "unknown" && type === "unknown") type = fragmentType;
    if (detectRoom(fragment) && !room) {
      room = fragment.replace(/[)\]]/g, "").trim();
      continue;
    }
    if (hasFacultyTitle(fragment) && !faculty) {
      faculty = fragment.replace(/[)\]]/g, "").trim();
      continue;
    }
    kept.push(fragment.replace(/[)\]]/g, "").trim());
  }
  name = kept.join(" ").replace(/\s+/g, " ").replace(/^[\s,;:/-]+|[\s,;:/-]+$/g, "").trim();
  if (!name && code) name = code;
  return { name, code, type, room, faculty };
}

function slotFromRowParts(
  id: string,
  raw: string,
  dayCell: string,
  timeCell: string,
  startCell: string,
  endCell: string,
  courseCell: string,
  codeCell: string,
  facultyCell: string,
  roomCell: string,
  typeCell: string,
  base: Confidence,
): ExtractedSlot {
  let start: string | null = null;
  let end: string | null = null;
  const combined = parseTimeRange(timeCell) ?? parseTimeRange(`${startCell} - ${endCell}`.trim());
  if (combined) {
    start = combined.start;
    end = combined.end;
  } else {
    const maybeRange = parseTimeRange(startCell);
    if (maybeRange) {
      start = maybeRange.start;
      end = maybeRange.end;
    }
  }
  const parsed = parseCourseCell([courseCell, codeCell].filter(Boolean).join(" "));
  const days = parseWeekdayList(dayCell);
  const weekday = parseWeekday(dayCell) ?? (days.length === 1 ? (days[0] ?? null) : null);
  return makeSlot(id, raw, {
    courseName: parsed.name,
    code: parsed.code ?? findCourseCode(codeCell),
    weekday,
    start,
    end,
    type: typeCell ? detectSessionType(typeCell) : parsed.type,
    faculty: facultyCell || parsed.faculty,
    room: roomCell || parsed.room,
  }, base);
}

/** One row per session. */
function interpretRows(grid: string[][], base: Confidence): ExtractedSlot[] {
  const headerIndex = grid.findIndex((row) => row.some((cell) => headerKey(cell) !== "ignore") && row.filter((cell) => headerKey(cell) !== "ignore").length >= 2);
  const keys: ColumnKey[] = headerIndex >= 0
    ? (grid[headerIndex] ?? []).map(headerKey)
    : (() => {
        // Headerless example: Day | Time | Course.
        const width = Math.max(...grid.map((row) => row.length), 3);
        if (width === 3) return ["day", "time", "course"] as ColumnKey[];
        return ["day", "start", "end", "course", "code", "faculty", "room", "type"].slice(0, width) as ColumnKey[];
      })();
  const dataRows = headerIndex >= 0 ? grid.slice(headerIndex + 1) : grid;
  const get = (row: string[], key: ColumnKey): string => {
    const index = keys.indexOf(key);
    return index >= 0 ? (row[index] ?? "") : "";
  };
  const slots: ExtractedSlot[] = [];
  dataRows.forEach((row, index) => {
    if (row.every((cell) => !cell)) return;
    // A repeated header or a section caption is not a session.
    if (row.some((cell) => headerKey(cell) !== "ignore") && headerIndex >= 0 && parseTimeRange(get(row, "time")) === null && parseTimeRange(get(row, "start")) === null) return;
    const courseCell = get(row, "course");
    const dayCell = get(row, "day");
    const hasTime = get(row, "time") || get(row, "start") || get(row, "end");
    if (!courseCell && !dayCell) return;
    if (!courseCell || !hasTime) return;
    slots.push(slotFromRowParts(
      `row-${index + 1}`,
      row.join(" | "),
      dayCell, get(row, "time"), get(row, "start"), get(row, "end"),
      courseCell, get(row, "code"), get(row, "faculty"), get(row, "room"), get(row, "type"),
      base,
    ));
  });
  return slots;
}

/** Matrix: weekdays across the header, time slots down the first column. */
function interpretMatrix(grid: string[][], base: Confidence): ExtractedSlot[] {
  const headerIndex = grid.findIndex((row) => countWeekdayHeaders(row) >= 2);
  if (headerIndex < 0) return [];
  const header = grid[headerIndex] ?? [];
  const dayColumns: { column: number; weekday: number }[] = [];
  header.forEach((cell, column) => {
    const days = parseWeekdayList(cell);
    const single = parseWeekday(cell);
    const weekday = single ?? (days.length === 1 ? (days[0] ?? null) : null);
    if (weekday !== null) dayColumns.push({ column, weekday });
  });
  if (dayColumns.length === 0) return [];

  const slots: ExtractedSlot[] = [];
  let inheritedTime: { start: string; end: string } | null = null;
  for (let rowIndex = headerIndex + 1; rowIndex < grid.length; rowIndex += 1) {
    const row = grid[rowIndex] ?? [];
    const timeCell = row.find((cell, column) => !dayColumns.some((item) => item.column === column) && parseTimeRange(cell));
    const range = timeCell ? parseTimeRange(timeCell) : null;
    if (range) inheritedTime = { start: range.start, end: range.end };
    if (!inheritedTime) continue;
    for (const { column, weekday } of dayColumns) {
      const cell = row[column] ?? "";
      if (!cell || /^[-–—_.]+$/.test(cell)) continue;
      const parsed = parseCourseCell(cell);
      if (!parsed.name) continue;
      const merged = makeSlot(`cell-${rowIndex}-${column}`, cell, {
        courseName: parsed.name,
        code: parsed.code,
        weekday,
        start: inheritedTime.start,
        end: inheritedTime.end,
        type: parsed.type,
        faculty: parsed.faculty,
        room: parsed.room,
      }, base);
      // Explicit per-cell time overrides the row time (e.g. "Lab 14:00-16:00").
      const inlineRange = parseTimeRange(cell);
      if (inlineRange) {
        merged.startTime = inlineRange.start;
        merged.endTime = inlineRange.end;
        merged.issues = merged.issues.filter((issue) => issue !== "Start/end time could not be read.");
        merged.confidence = confidenceFor(merged.issues, base);
      }
      slots.push(merged);
    }
  }
  return slots;
}

/** Transposed matrix: weekdays down the first column, time slots across. */
function interpretTransposedMatrix(grid: string[][], base: Confidence): ExtractedSlot[] {
  const transposed: string[][] = [];
  const width = Math.max(...grid.map((row) => row.length), 0);
  for (let column = 0; column < width; column += 1) {
    transposed.push(grid.map((row) => row[column] ?? ""));
  }
  return interpretMatrix(transposed, base);
}

/** Free-form text lines: "Monday 9:00-10:00 Mathematics (CS301)". */
export function interpretTextLines(lines: string[], base: Confidence = "medium"): ExtractedSlot[] {
  const slots: ExtractedSlot[] = [];
  lines.forEach((line, index) => {
    const raw = line.trim();
    if (!raw) return;
    const range = parseTimeRange(raw.match(/\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:-|–|—|to)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?/i)?.[0] ?? "");
    const days = parseWeekdayList(raw);
    let rest = raw;
    if (range) rest = rest.replace(raw.match(/\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:-|–|—|to)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?/i)?.[0] ?? "", " ");
    rest = rest.replace(/\b(mon|tue|wed|thu|fri|sat|sun)\w*\b/gi, " ").replace(/\s+/g, " ").trim();
    const parsed = parseCourseCell(rest);
    if (!parsed.name) return;
    slots.push(makeSlot(`text-${index + 1}`, raw, {
      courseName: parsed.name,
      code: parsed.code,
      weekday: days.length === 1 ? (days[0] ?? null) : null,
      start: range?.start ?? null,
      end: range?.end ?? null,
      type: parsed.type,
      faculty: parsed.faculty,
      room: parsed.room,
    }, base));
  });
  return slots;
}

/** Cluster positioned text (PDF text layer / OCR words) into a grid. */
export function positionedTextToGrid(items: PositionedText[], rowTolerance = 4): string[][] {
  const sorted = [...items].filter((item) => item.text.trim()).sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: PositionedText[][] = [];
  for (const item of sorted) {
    const line = lines[lines.length - 1];
    if (line && Math.abs((line[0]?.y ?? item.y) - item.y) <= rowTolerance) line.push(item);
    else lines.push([item]);
  }
  // Derive global column boundaries from x starts so sparse cells stay aligned.
  const starts = sorted.map((item) => item.x).sort((a, b) => a - b);
  const boundaries: number[] = [];
  for (const x of starts) {
    if (boundaries.length === 0 || x - (boundaries[boundaries.length - 1] ?? 0) > 12) boundaries.push(x);
  }
  const columnOf = (x: number): number => {
    let index = 0;
    while (index < boundaries.length - 1 && Math.abs(x - (boundaries[index] ?? 0)) > Math.abs(x - (boundaries[index + 1] ?? 0))) index += 1;
    return index;
  };
  return lines.map((line) => {
    const cells = new Map<number, string>();
    for (const item of line.sort((a, b) => a.x - b.x)) {
      const column = columnOf(item.x);
      cells.set(column, `${cells.get(column) ?? ""} ${item.text}`.trim());
    }
    const width = Math.max(...[...cells.keys()].map((key) => key + 1), 1);
    return Array.from({ length: width }, (_, index) => cells.get(index) ?? "");
  });
}

/** Merge contiguous lab slots of the same course into one session. */
export function mergeLabBlocks(slots: ExtractedSlot[]): ExtractedSlot[] {
  const order = ["lecture", "tutorial", "lab", "practical", "seminar", "unknown"];
  const sorted = [...slots].sort((a, b) =>
    (a.weekday ?? 9) - (b.weekday ?? 9) ||
    (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99") ||
    order.indexOf(a.sessionType) - order.indexOf(b.sessionType),
  );
  const out: ExtractedSlot[] = [];
  for (const slot of sorted) {
    const previous = out[out.length - 1];
    const isLab = slot.sessionType === "lab" || slot.sessionType === "practical";
    const previousIsLab = previous && (previous.sessionType === "lab" || previous.sessionType === "practical");
    if (
      previous && previousIsLab && isLab &&
      previous.weekday === slot.weekday &&
      previous.startTime && previous.endTime && slot.startTime && slot.endTime &&
      previous.endTime === slot.startTime &&
      courseKey(previous.courseCode, previous.courseName) === courseKey(slot.courseCode, slot.courseName)
    ) {
      previous.endTime = slot.endTime;
      previous.raw = `${previous.raw} + ${slot.raw}`;
      previous.issues = [...new Set([...previous.issues, "Merged contiguous lab block into one scheduled session."])];
      continue;
    }
    out.push({ ...slot, issues: [...slot.issues] });
  }
  return out;
}

/** Group reliable slots into deduplicated courses. */
export function buildCourses(slots: ExtractedSlot[]): DetectedCourse[] {
  const groups = new Map<string, ExtractedSlot[]>();
  for (const slot of slots) {
    if (!slot.courseName) continue;
    const key = courseKey(slot.courseCode, slot.courseName);
    const list = groups.get(key) ?? [];
    list.push(slot);
    groups.set(key, list);
  }
  const courses: DetectedCourse[] = [];
  for (const [key, group] of groups) {
    const name = pickDisplayName(group.map((slot) => slot.courseName));
    const code = group.find((slot) => slot.courseCode)?.courseCode ?? null;
    const faculty = group.find((slot) => slot.faculty)?.faculty ?? null;
    const sessionTypes = [...new Set(group.map((slot) => slot.sessionType))];
    const days = [...new Set(group.map((slot) => slot.weekday).filter((day): day is number => day !== null))].sort();
    const weeklyMinutes = group.reduce((total, slot) =>
      total + (slot.startTime && slot.endTime ? durationMinutes(slot.startTime, slot.endTime) : 0), 0);
    const issues = [...new Set(group.flatMap((slot) => slot.issues))];
    courses.push({
      key,
      name,
      code,
      faculty,
      sessionTypes,
      days,
      slots: [...group].sort((a, b) => (a.weekday ?? 9) - (b.weekday ?? 9) || (a.startTime ?? "").localeCompare(b.startTime ?? "")),
      weeklySessions: group.length,
      weeklyMinutes,
      issues,
      needsReview: group.some((slot) => slot.needsReview),
    });
  }
  return courses.sort((a, b) => a.name.localeCompare(b.name));
}

function pickDisplayName(names: string[]): string {
  const candidates = names.filter(Boolean);
  if (candidates.length === 0) return "";
  // Prefer the longest properly-cased variant, preserving the original spelling.
  return [...candidates].sort((a, b) => {
    const score = (value: string) => (value.length * 2) + (/[a-z]/.test(value) && /[A-Z]/.test(value) ? 5 : 0);
    return score(b) - score(a);
  })[0] ?? candidates[0] ?? "";
}

export interface InterpretOptions {
  source?: string;
  /** "low" forces every row into human review (used for OCR). */
  confidence?: Confidence;
  /** Skip the matrix interpreter when the source is known to be row-based. */
  forceLayout?: "rows" | "matrix" | "text";
}

/** Main entry: pick a layout, extract slots, dedupe, flag uncertainty. */
export function interpretTimetableGrid(
  input: string[][] | string,
  options: InterpretOptions = {},
): TimetableExtraction {
  const base = options.confidence ?? "high";
  const rawGrid = typeof input === "string"
    ? input.split(/\r?\n/).map((line) => line.split(/\t|\s{2,}|,/).map((cell) => cell.trim()))
    : cleanGrid(input);
  const grid = cleanGrid(rawGrid);
  const source = options.source ?? "document";
  const warnings: string[] = [];
  if (grid.length === 0) {
    return { slots: [], courses: [], uncertain: [], rawGrid: grid, layout: "unknown", source, warnings: ["The document contained no readable text."], needsReview: true };
  }

  let layout: TimetableExtraction["layout"] = "unknown";
  let slots: ExtractedSlot[] = [];

  const weekdayHeaderRows = grid.filter((row) => countWeekdayHeaders(row) >= 2).length;
  if (options.forceLayout === "text") {
    layout = "text";
    slots = interpretTextLines(grid.map((row) => row.join(" ")), base === "high" ? "medium" : base);
  } else if (options.forceLayout === "matrix" || (weekdayHeaderRows > 0 && options.forceLayout !== "rows")) {
    layout = "matrix";
    slots = interpretMatrix(grid, base);
    if (slots.length === 0) {
      const transposed = interpretTransposedMatrix(grid, base);
      if (transposed.length > slots.length) slots = transposed;
    }
    if (slots.length === 0) {
      warnings.push("A weekday header was found but no sessions could be placed; falling back to row interpretation.");
      slots = interpretRows(grid, base);
      layout = "rows";
    }
  } else {
    layout = "rows";
    slots = interpretRows(grid, base);
    if (slots.length === 0) {
      const matrix = interpretMatrix(grid, base);
      if (matrix.length > 0) {
        slots = matrix;
        layout = "matrix";
      } else {
        slots = interpretTextLines(grid.map((row) => row.join(" ")), "medium");
        layout = "text";
      }
    }
  }

  const merged = mergeLabBlocks(slots);
  const reliable = merged.filter((slot) => slot.weekday !== null && slot.startTime && slot.endTime && slot.courseName);
  const uncertain = merged.filter((slot) => !reliable.includes(slot));
  const courses = buildCourses(reliable);
  if (uncertain.length > 0) warnings.push(`${uncertain.length} entr${uncertain.length === 1 ? "y" : "ies"} need manual confirmation and were not added to any course.`);
  if (base === "low") warnings.push("OCR output is inherently uncertain: confirm every row before saving.");
  return {
    slots: merged,
    courses,
    uncertain,
    rawGrid: grid,
    layout,
    source,
    warnings,
    needsReview: base === "low" || uncertain.length > 0 || courses.some((course) => course.needsReview),
  };
}

/** Re-export for callers that only need normalisation helpers. */
export { normalizeCourseName, normalizeCode };
