/**
 * Automatic academic-structure detection & class calculation — formal tests.
 *
 * All 16 acceptance scenarios plus format adapters, DB-row adapters, caching,
 * incremental recomputation and idempotency. Everything is pure and runs on
 * Node without a browser, Supabase client, service role or network.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8 } from "fflate";
import {
  buildCourses, interpretTimetableGrid, mergeLabBlocks, parseCourseCell,
  refreshSlotIssues,
} from "../lib/academic/grid.ts";
import {
  interpretCalendarGrid, toDayExceptions, replacementDayException,
  additionalClassException, cancellationException, applyTimetableRevision,
  normalizeCalendarDate, detectScope, detectFollowsWeekday,
} from "../lib/academic/calendar.ts";
import {
  computeSchedule, computeScheduleCached, clearScheduleCache,
  scheduleFingerprint, planDate, changedDates, affectedDatesForException,
  affectedDatesForRule, weeklyDistribution, semesterProgress,
} from "../lib/academic/engine.ts";
import {
  courseSourceKey, ruleSourceKey, sessionSourceKey, exceptionSourceKey,
  documentFingerprint,
} from "../lib/academic/idempotency.ts";
import {
  addDaysKey, eachDateKey, weekdayOf, clampRange, normalizeDateKey, isValidDateKey,
} from "../lib/academic/dates.ts";
import { courseKey, detectSessionType, detectRoom, findCourseCode, parseTimeRange } from "../lib/academic/text.ts";
import {
  dayExceptionsFromRows, weeklyRulesFromRows, buildEngineInput,
  toCourseInserts, toRuleInserts, toCalendarExceptionRows, toEventInserts,
  courseKeyForRow,
} from "../lib/academic/bridge.ts";
import { readXlsxGrid, sheetNames, decodeXml } from "../lib/academic/formats/xlsx.ts";
import { readPdfText } from "../lib/academic/formats/pdf.ts";
import { sha256Hex } from "../lib/academic/formats/hash.ts";
import {
  extractAcademicDocument, fromPastedText, interpretDocument, formatOf,
} from "../lib/academic/formats/index.ts";
import type {
  DayException, EngineInput, ExtractedSlot, SessionType, WeeklyRule, CalendarEntry,
} from "../lib/academic/types.ts";
import type { CourseRow, TimetableRuleRow, AcademicDayRow, SemesterRow } from "../lib/types.ts";

/* ------------------------------------------------------------------ fixtures */
const A = "code:MA301";     // Mathematics
const B = "code:PHY301";     // Physics
const C = "code:CS302";      // Programming Lab
const SEMESTER_START = "2026-01-05"; // Monday
const SEMESTER_END = "2026-01-31";   // Saturday (27 days)

function rule(
  id: string, courseKeyValue: string, weekday: number, startTime: string, endTime: string,
  sessionType: SessionType = "lecture", validFrom: string | null = null, validUntil: string | null = null,
): WeeklyRule {
  return { id, courseKey: courseKeyValue, weekday, startTime, endTime, sessionType, validFrom, validUntil };
}

/** Hand-verified fixture: A=3/week (12), B=1/week (4), C=1/week (4) => 20. */
const RULES: WeeklyRule[] = [
  rule("r1", A, 1, "09:00", "10:00"),                    // Mon 09:00
  rule("r2", A, 3, "11:00", "12:00"),                    // Wed 11:00
  rule("r3", A, 1, "14:00", "15:00", "tutorial"),        // Mon 14:00 (same day, second class)
  rule("r4", C, 5, "14:00", "17:00", "lab"),             // Fri 14:00-17:00 (one lab block)
  rule("r5", B, 2, "10:00", "11:00"),                    // Tue 10:00
];
const COURSES = [
  { key: A, name: "Mathematics" }, { key: B, name: "Physics" }, { key: C, name: "Programming Lab" },
];

function base(overrides: Partial<EngineInput> = {}): EngineInput {
  return {
    semesterStart: SEMESTER_START, semesterEnd: SEMESTER_END,
    rules: RULES, exceptions: [], courses: COURSES, targetPercent: 75,
    reality: { asOf: SEMESTER_START, marks: {}, conducted: {} },
    ...overrides,
  };
}

function ex(
  id: string, date: string, type: DayException["type"], priority = 50,
  extra: Partial<DayException> = {},
): DayException {
  return {
    id, date, priority, type, scope: "full_day", followsWeekday: null,
    courseKeys: [], startTime: null, endTime: null, extraRule: null,
    rescheduled: false, confirmed: true, ...extra,
  };
}

function slot(overrides: Partial<ExtractedSlot> = {}): ExtractedSlot {
  return {
    id: "s", raw: "raw", courseName: "Mathematics", courseCode: "MA301", weekday: 1,
    startTime: "09:00", endTime: "10:00", sessionType: "lecture", faculty: null,
    room: null, confidence: "high", issues: [], needsReview: false, ...overrides,
  };
}

/* =============================================================== 1..6 extraction */
test("1. normal weekly timetable extraction (rows, codes, faculty, rooms)", () => {
  const csv = [
    "Day,Time,Course,Code,Faculty,Room,Type",
    "Monday,9:00-10:00,Mathematics,MA301,Dr Rao,LH-1,Lecture",
    "Wednesday,11:00-12:00,Physics,PHY301,Dr Menon,LH-2,Lab",
    "Friday,14:00-17:00,Programming Lab,CS302,Dr Nair,Lab-3,Lab",
  ].join("\n");
  const result = interpretTimetableGrid(csv);
  assert.equal(result.layout, "rows");
  assert.equal(result.slots.length, 3);
  assert.equal(result.uncertain.length, 0);
  assert.equal(result.courses.length, 3);
  const math = result.courses.find((course) => course.code === "MA301");
  assert.ok(math);
  assert.equal(math.name, "Mathematics");
  assert.deepEqual(math.days, [1]);
  assert.equal(math.weeklySessions, 1);
  assert.equal(math.faculty, "Dr Rao");
  assert.equal(math.slots[0]?.room, "LH-1");
  assert.equal(math.slots[0]?.sessionType, "lecture");
  const programming = result.courses.find((course) => course.code === "CS302");
  assert.equal(programming?.name, "Programming Lab");
  assert.equal(programming?.sessionTypes[0], "lab");
  assert.equal(programming?.weeklyMinutes, 180);
});

test("2. a course with multiple classes per week keeps every session", () => {
  const courses = buildCourses([
    slot({ id: "1", weekday: 1, startTime: "09:00", endTime: "10:00" }),
    slot({ id: "2", weekday: 3, startTime: "11:00", endTime: "12:00" }),
    slot({ id: "3", weekday: 5, startTime: "14:00", endTime: "15:00" }),
  ]);
  assert.equal(courses.length, 1);
  assert.equal(courses[0]?.weeklySessions, 3);
  assert.deepEqual(courses[0]?.days, [1, 3, 5]);
  assert.equal(computeSchedule(base()).countsByCourse.find((item) => item.courseKey === A)?.scheduled, 12);
});

test("3. duplicate names with identical codes merge into one course", () => {
  const courses = buildCourses([
    slot({ id: "1", courseName: "Mathematics", courseCode: "MA301", weekday: 1 }),
    slot({ id: "2", courseName: "MATHEMATICS", courseCode: "ma-301", weekday: 3 }),
    slot({ id: "3", courseName: "MA301 Mathematics", courseCode: "MA 301", weekday: 5 }),
  ]);
  assert.equal(courses.length, 1);
  assert.equal(courses[0]?.code, "MA301");
  assert.equal(courses[0]?.weeklySessions, 3);
  assert.equal(courseKey("ma-301", "MATHEMATICS"), courseKey("MA301", "Mathematics"));
});

test("4. courses without a code are keyed by a normalised name", () => {
  const courses = buildCourses([
    slot({ id: "1", courseName: "Database Systems", courseCode: null, weekday: 1 }),
    slot({ id: "2", courseName: "DATABASE  SYSTEMS", courseCode: null, weekday: 3 }),
  ]);
  assert.equal(courses.length, 1);
  assert.equal(courses[0]?.code, null);
  assert.equal(courses[0]?.key, "name:database systems");
  assert.equal(courses[0]?.weeklySessions, 2);
});

test("5. multiple sessions of the SAME course on the same day are both counted", () => {
  const courses = buildCourses([
    slot({ id: "1", weekday: 1, startTime: "09:00", endTime: "10:00" }),
    slot({ id: "2", weekday: 1, startTime: "14:00", endTime: "15:00", sessionType: "tutorial" }),
  ]);
  assert.equal(courses.length, 1);
  assert.equal(courses[0]?.weeklySessions, 2);
  const result = computeSchedule(base({ rules: [
    rule("a", A, 1, "09:00", "10:00"), rule("b", A, 1, "14:00", "15:00", "tutorial"),
  ] }));
  assert.equal(result.sessions.length, 8); // 4 Mondays x 2 sessions
  assert.equal(result.sessions.filter((item) => item.date === "2026-01-05").length, 2);
  assert.equal(new Set(result.sessions.map((item) => item.key)).size, 8);
});

test("6. a contiguous lab block is ONE session, not one per hour", () => {
  const merged = mergeLabBlocks([
    slot({ id: "1", weekday: 5, startTime: "14:00", endTime: "15:00", sessionType: "lab" }),
    slot({ id: "2", weekday: 5, startTime: "15:00", endTime: "16:00", sessionType: "lab" }),
    slot({ id: "3", weekday: 5, startTime: "16:00", endTime: "17:00", sessionType: "lab" }),
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.startTime, "14:00");
  assert.equal(merged[0]?.endTime, "17:00");
  assert.equal(computeSchedule(base()).countsByCourse.find((item) => item.courseKey === C)?.scheduled, 4);
});

test("6b. extraction never mistakes a course containing 'Lab' for a room", () => {
  const parsed = parseCourseCell("CS302 Programming Lab");
  assert.equal(parsed.name, "Programming Lab");
  assert.equal(parsed.code, "CS302");
  assert.equal(parsed.type, "lab");
  assert.equal(detectRoom("Programming Lab"), null);
  assert.equal(detectRoom("Lab-3"), "Lab-3");
  assert.equal(detectRoom("LH 2"), "LH 2");
  assert.equal(detectRoom("Database Systems"), null);
  assert.equal(detectSessionType("(T)"), "tutorial");
  assert.equal(findCourseCode("21CS301 - Database Systems"), "21CS301");
  const range = parseTimeRange("9:30am-11am");
  assert.equal(range?.start, "09:30");
  assert.equal(range?.end, "11:00");
});

test("6c. ambiguous rows keep their original text and can be confirmed", () => {
  const codeOnly = slot({ courseName: "CS302", courseCode: "CS302", issues: ["Only a course code was found; the course name needs confirmation."], needsReview: true });
  assert.equal(refreshSlotIssues(codeOnly).needsReview, true);
  const fixed = refreshSlotIssues({ ...codeOnly, courseName: "Programming Lab" });
  assert.deepEqual(fixed.issues, []);
  assert.equal(fixed.needsReview, false);
  const ocr = refreshSlotIssues({ ...fixed, raw: "Monday 9-10 CS301" }, "low");
  assert.equal(ocr.needsReview, true, "low-confidence OCR still requires confirmation");
  assert.equal(codeOnly.raw, "raw", "original text is never discarded");
});

/* =============================================================== 7..12 calendar & engine */
test("7. a full-day holiday removes that date's classes", () => {
  const result = computeSchedule(base({ exceptions: [ex("h", "2026-01-12", "holiday")] }));
  assert.equal(result.sessions.length, 18);           // 20 - 2 Monday sessions
  assert.equal(result.totals.scheduled, 18);
  assert.equal(result.countsByCourse.find((item) => item.courseKey === A)?.scheduled, 10);
  assert.equal(result.sessions.some((item) => item.date === "2026-01-12"), false);
});

test("8. a special working Saturday follows Monday's timetable exactly once", () => {
  const result = computeSchedule(base({ exceptions: [
    ex("rep", "2026-01-17", "replacement_day", 120, { followsWeekday: 1 }),
  ] }));
  const saturday = result.sessions.filter((item) => item.date === "2026-01-17");
  assert.equal(saturday.length, 2);                    // Monday's 2 A sessions
  assert.deepEqual(saturday.map((item) => item.startTime), ["09:00", "14:00"]);
  assert.ok(saturday.every((item) => item.origin === "replacement"));
  assert.equal(result.sessions.length, 22);            // +2, no Friday lab duplicated
  assert.equal(result.sessions.filter((item) => item.date === "2026-01-12").length, 2, "original Monday is NOT duplicated");
  // An explicit closure on that Saturday is overridden by the working day.
  const both = computeSchedule(base({ exceptions: [
    ex("rep", "2026-01-17", "replacement_day", 120, { followsWeekday: 1 }),
    ex("h", "2026-01-17", "holiday", 50),
  ] }));
  assert.equal(both.sessions.filter((item) => item.date === "2026-01-17").length, 2);
});

test("9. semester bounds are inclusive and no outside date is generated", () => {
  const result = computeSchedule(base({ semesterStart: "2026-01-12", semesterEnd: "2026-01-18" }));
  assert.equal(result.sessions.length, 5);            // Mon 2 + Tue 1 + Wed 1 + Fri 1
  assert.ok(result.sessions.every((item) => item.date >= "2026-01-12" && item.date <= "2026-01-18"));
  assert.equal(result.countsByCourse.find((item) => item.courseKey === A)?.scheduled, 3);
  assert.equal(result.countsByCourse.find((item) => item.courseKey === C)?.scheduled, 1);
});

test("10. a mid-semester timetable revision uses validity windows", () => {
  const revised = applyTimetableRevision(
    [rule("r1", A, 1, "09:00", "10:00"), rule("r2", A, 3, "11:00", "12:00")],
    [rule("r1b", A, 1, "08:00", "09:00"), rule("r6", A, 4, "10:00", "11:00")],
    "2026-01-19",
  );
  assert.equal(revised.length, 4);
  assert.ok(revised.slice(0, 2).every((item) => item.validUntil === "2026-01-18"));
  assert.ok(revised.slice(2).every((item) => item.validFrom === "2026-01-19"));
  const result = computeSchedule(base({ rules: [...RULES.slice(2), ...revised] }));
  const early = result.sessions.filter((item) => item.courseKey === A && item.date < "2026-01-19");
  const late = result.sessions.filter((item) => item.courseKey === A && item.date >= "2026-01-19");
  assert.ok(early.some((item) => item.startTime === "09:00"));
  assert.ok(late.some((item) => item.startTime === "08:00"));
  assert.ok(late.some((item) => item.weekday === 4));
  assert.equal(early.some((item) => item.startTime === "08:00"), false);
});

test("11. an explicit cancellation is recorded, not silently deleted", () => {
  const result = computeSchedule(base({ exceptions: [
    ex("c", "2026-01-19", "cancelled", 200, { courseKeys: [A], startTime: "09:00", endTime: "10:00", scope: "partial" }),
  ] }));
  assert.equal(result.sessions.length, 20, "the cancelled original is preserved");
  assert.equal(result.totals.scheduled, 19);
  assert.equal(result.totals.cancelled, 1);
  assert.equal(result.countsByCourse.find((item) => item.courseKey === A)?.scheduled, 11);
  assert.equal(result.sessions.find((item) => item.date === "2026-01-19" && item.startTime === "09:00")?.cancelled, true);
});

test("12. repeated uploads are idempotent (stable source keys, no duplicates)", () => {
  assert.equal(courseSourceKey("sem", "MA-301", "Mathematics"), courseSourceKey("sem", "MA301", "MATHEMATICS"));
  assert.notEqual(courseSourceKey("sem", "MA301", "Mathematics"), courseSourceKey("sem", null, "Mathematics"));
  assert.equal(ruleSourceKey("sem", A, 1, "09:00", "lecture", "base"), ruleSourceKey("sem", A, 1, "09:00", "lecture", "base"));
  assert.equal(sessionSourceKey("sem", A, "2026-01-05", "09:00", "lecture"), sessionSourceKey("sem", A, "2026-01-05", "09:00", "lecture"));
  assert.notEqual(exceptionSourceKey("sem", "2026-01-26", "holiday", "A"), exceptionSourceKey("sem", "2026-01-26", "holiday", "B"));
  assert.equal(documentFingerprint("u", "timetable", "hash"), documentFingerprint("u", "timetable", "hash"));
  const first = computeSchedule(base());
  const second = computeSchedule(base());
  assert.deepEqual(second, first);
  assert.equal(new Set(first.sessions.map((item) => item.key)).size, first.sessions.length);
  assert.deepEqual(changedDates(first.sessions, second.sessions), []);
});

/* =============================================================== 13..16 ambiguity, attendance, dates, manual counts */
test("13. missing/ambiguous calendar info is flagged, never guessed", () => {
  const extraction = interpretCalendarGrid([
    ["date", "type", "title", "scope", "follows"],
    ["2026-01-26", "holiday", "Republic Day", "full_day", ""],
    ["", "holiday", "Unclear holiday", "full_day", ""],
    ["2026-01-31", "special_working", "Working Saturday", "unknown", ""],
    ["2026-02-02", "special_working", "Follows Monday", "full_day", "Monday"],
    ["2026-02-10", "other", "Extra class", "full_day", ""],
  ], { defaultYear: 2026 });
  assert.ok(extraction.uncertain.length >= 3, "unknown date, unknown scope and unclear type are all flagged");
  assert.ok(extraction.uncertain.every((entry) => entry.raw.length > 0), "original text is preserved");
  const { exceptions } = toDayExceptions(extraction.entries);
  assert.ok(exceptions.every((item) => item.confirmed));
  assert.equal(exceptions.some((item) => item.date === ""), false);
  assert.equal(exceptions.some((item) => item.scope === "unknown"), false, "unconfirmed entries are NOT applied");
  // A partial closure without hours is ignored with an explicit warning.
  const partial = computeSchedule(base({ exceptions: [
    ex("p", "2026-01-12", "holiday", 50, { scope: "partial" }),
  ] }));
  assert.equal(partial.sessions.length, 20);
  assert.ok(partial.warnings.some((warning) => /without times/.test(warning)));
  const withHours = computeSchedule(base({ exceptions: [
    ex("p", "2026-01-12", "holiday", 50, { scope: "partial", startTime: "09:00", endTime: "10:00" }),
  ] }));
  assert.equal(withHours.totals.cancelled, 1);
  assert.equal(withHours.sessions.find((item) => item.date === "2026-01-12" && item.startTime === "14:00")?.cancelled, false);
  // Unconfirmed exceptions have no effect.
  assert.equal(computeSchedule(base({ exceptions: [{ ...ex("h", "2026-01-12", "holiday"), confirmed: false }] })).sessions.length, 20);
  assert.equal(normalizeCalendarDate("26/01/2026"), "2026-01-26");
  assert.equal(normalizeCalendarDate("Jan 26, 2026"), "2026-01-26");
  assert.equal(detectScope("partial holiday"), "partial");
  assert.equal(detectFollowsWeekday("Saturday follows Monday timetable"), 1);
});

test("14. attendance integration: only confirmed marks affect the percentage", () => {
  const plain = computeSchedule(base());
  assert.equal(plain.totals.conducted, 0, "a timetable entry is NOT proof of a conducted class");
  assert.equal(plain.totals.pending, 20);
  const marks: Record<string, "present" | "absent" | "excused" | "unmarked"> = {};
  for (const session of plain.sessions.slice(0, 3)) marks[session.key] = "present";
  marks[plain.sessions[4]!.key] = "absent";
  marks[plain.sessions[5]!.key] = "excused";
  marks[plain.sessions[6]!.key] = "unmarked";
  const result = computeSchedule(base({ reality: { asOf: "2026-01-31", marks, conducted: {} } }));
  assert.equal(result.totals.attended, 3);
  assert.equal(result.totals.absent, 1);
  assert.equal(result.totals.excused, 1);
  assert.equal(result.totals.conducted, 5, "excused is conducted but excluded from the denominator");
  // Sorted sessions: A Mon 09:00, A Mon 14:00, B Tue 10:00, A Wed 11:00,
  // C Fri 14:00, A Mon 09:00 (excused), A Mon 14:00 (unmarked).
  const maths = result.countsByCourse.find((item) => item.courseKey === A);
  const physics = result.countsByCourse.find((item) => item.courseKey === B);
  const lab = result.countsByCourse.find((item) => item.courseKey === C);
  assert.equal(maths?.percent, 100, "2 present + 1 excused => 100% (excused excluded from denominator)");
  assert.equal(physics?.percent, 100, "1 present => 100%");
  assert.equal(lab?.percent, 0, "1 absent => 0%");
  assert.equal(result.totals.pending, 15, "unmarked is pending, never an absence");
});

test("15. date keys are timezone-independent and honour year/month boundaries", () => {
  assert.equal(weekdayOf("2026-01-05"), 1);
  assert.equal(weekdayOf("2026-01-31"), 6);
  assert.equal(weekdayOf("2026-03-01"), 0);
  assert.equal(addDaysKey("2026-12-31", 1), "2027-01-01");
  assert.equal(addDaysKey("2024-02-28", 1), "2024-02-29", "leap year");
  assert.equal(addDaysKey("2026-03-01", -1), "2026-02-28");
  assert.equal(eachDateKey("2026-12-30", "2027-01-02").join(","), "2026-12-30,2026-12-31,2027-01-01,2027-01-02");
  assert.deepEqual(clampRange("2026-01-05", "2026-01-31", "2026-01-20", "2026-02-20"), ["2026-01-20", "2026-01-31"]);
  assert.equal(normalizeDateKey("2026-01-05"), "2026-01-05");
  assert.equal(normalizeDateKey("5/1/2026"), null);
  assert.equal(normalizeCalendarDate("5/1/2026"), "2026-01-05");
  assert.equal(isValidDateKey("2026-02-30"), false);
  const boundary = computeSchedule(base({ semesterStart: "2026-12-28", semesterEnd: "2027-01-03" }));
  assert.equal(boundary.sessions.length, 5);          // Mon 2 + Tue 1 + Wed 1 + Fri 1
  assert.ok(boundary.sessions.every((item) => item.date >= "2026-12-28" && item.date <= "2027-01-03"));
});

test("16. full hand-verified semester count (holidays + replacement + extra + cancellation)", () => {
  // Hand count for 2026-01-05..2026-01-31:
  //   A = 12 (Mon x4 twice, Wed x4); B = 4 (Tue); C = 4 (Fri) => 20 normal.
  //   Holiday 12 Jan (Mon) removes A's 2            => 18
  //   Exam 27 Jan (Tue) removes B's 1               => 17
  //   Replacement Sat 17 Jan follows Mon adds A x2  => 19
  //   One-off B class on Sun 11 Jan                 => 20
  //   Cancel A Mon 09:00 on 26 Jan                 => 19 scheduled + 1 cancelled
  const exceptions: DayException[] = [
    ex("holiday", "2026-01-12", "holiday"),
    ex("exam", "2026-01-27", "exam"),
    replacementDayException("rep", "2026-01-17", 1),
    additionalClassException("extra", B, "2026-01-11", "16:00", "17:00"),
    cancellationException("cancel", "2026-01-26", A, "09:00", "10:00", false),
  ];
  const result = computeSchedule(base({ exceptions }));
  assert.equal(result.sessions.length, 20);
  assert.equal(result.sessions.filter((item) => !item.cancelled).length, 19);
  assert.equal(result.sessions.filter((item) => item.cancelled).length, 1);
  assert.equal(result.totals.scheduled, 19);
  assert.equal(result.totals.cancelled, 1);
  assert.equal(result.sessions.filter((item) => item.date === "2026-01-12").length, 0);
  assert.equal(result.sessions.filter((item) => item.date === "2026-01-27").length, 0);
  assert.equal(result.sessions.filter((item) => item.date === "2026-01-17" && item.origin === "replacement").length, 2);
  assert.equal(result.sessions.filter((item) => item.date === "2026-01-11" && item.origin === "additional").length, 1);
});

/* =============================================================== engine extras */
test("hand-verified exact totals from generated DATES, not weeks x weekly count", () => {
  const exceptions: DayException[] = [
    ex("holiday", "2026-01-12", "holiday"),
    ex("exam", "2026-01-27", "exam"),
    replacementDayException("rep", "2026-01-17", 1),
    additionalClassException("extra", B, "2026-01-11", "16:00", "17:00"),
    cancellationException("cancel", "2026-01-26", A, "09:00", "10:00", false),
  ];
  const result = computeSchedule(base({ exceptions }));
  assert.equal(result.sessions.length, 20);        // 20 normal -2 -1 +2 +1 (cancellation flags an existing original)
  assert.equal(result.totals.scheduled, 19);
  assert.equal(result.totals.cancelled, 1);
  assert.equal(result.countsByCourse.find((item) => item.courseKey === A)?.scheduled, 11);
  assert.equal(result.countsByCourse.find((item) => item.courseKey === B)?.scheduled, 4);
  assert.equal(result.countsByCourse.find((item) => item.courseKey === C)?.scheduled, 4);
  assert.equal(result.countsByCourse.reduce((total, item) => total + item.scheduled, 0), 19);
  assert.notEqual(19, Math.ceil(eachDateKey(SEMESTER_START, SEMESTER_END).length / 7) * RULES.length);
  // Week of Mon 5 Jan: A Mon x2, B Tue, A Wed, C Fri, plus the one-off Sunday
  // class (Sunday belongs to the Monday-start week) = 6.
  assert.equal(weeklyDistribution(result.sessions)["2026-01-05"], 6);
  assert.equal(semesterProgress(SEMESTER_START, SEMESTER_END, SEMESTER_START), 4);
  assert.equal(semesterProgress(SEMESTER_START, SEMESTER_END, SEMESTER_END), 100);
});

test("caching, fingerprints and incremental recomputation", () => {
  clearScheduleCache();
  const input = base();
  const a = computeScheduleCached(input);
  const b = computeScheduleCached(input);
  assert.equal(a, b, "identical inputs reuse the cached result object");
  assert.equal(scheduleFingerprint(input), scheduleFingerprint(base()));
  assert.notEqual(scheduleFingerprint(input), scheduleFingerprint(base({ targetPercent: 80 })));
  assert.deepEqual(affectedDatesForException(ex("h", "2026-01-12", "holiday")), ["2026-01-12"]);
  assert.deepEqual(affectedDatesForRule(RULES[0]!, SEMESTER_START, SEMESTER_END),
    ["2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26"]);
  const holiday = computeSchedule(base({ exceptions: [ex("h", "2026-01-12", "holiday")] }));
  assert.deepEqual(changedDates(a.sessions, holiday.sessions), ["2026-01-12"]);
  assert.ok(holiday.affectedDates.length > 1, "without previousSessions every generated date is reported");
  const incremental = computeSchedule({ ...input, exceptions: [ex("h", "2026-01-12", "holiday")], previousSessions: a.sessions });
  assert.deepEqual(incremental.affectedDates, ["2026-01-12"]);
  const plan = planDate("2026-01-17", [replacementDayException("rep", "2026-01-17", 1)]);
  assert.equal(plan.effectiveWeekday, 1);
  assert.equal(plan.suppressAll, false);
});

/* =============================================================== format adapters */
function xlsxBytes(): Uint8Array {
  const cells = (row: number, values: string[]) => values.map((value, column) =>
    `<c r="${String.fromCharCode(65 + column)}${row}" t="inlineStr"><is><t>${value}</t></is></c>`).join("");
  const sheet = `<?xml version="1.0"?><worksheet><sheetData>` +
    `<row r="1">${cells(1, ["Day", "Time", "Course", "Code"])}</row>` +
    `<row r="2">${cells(2, ["Monday", "9:00-10:00", "Mathematics", "MA301"])}</row>` +
    `<row r="3">${cells(3, ["Wednesday", "11:00-12:00", "Physics", "PHY301"])}</row>` +
    `</sheetData></worksheet>`;
  return zipSync({
    "xl/workbook.xml": strToU8(`<workbook><sheets><sheet name="Timetable" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    "xl/worksheets/sheet1.xml": strToU8(sheet),
  });
}

test("local XLSX reader reconstructs a matrix grid without a spreadsheet library", () => {
  const bytes = xlsxBytes();
  assert.deepEqual(sheetNames(bytes), ["Timetable"]);
  const grid = readXlsxGrid(bytes, 1);
  assert.equal(grid.length, 3);
  assert.deepEqual(grid[1], ["Monday", "9:00-10:00", "Mathematics", "MA301"]);
  assert.equal(decodeXml("A &amp; B &lt; C &gt; D"), "A & B < C > D");
});

test("multi-sheet workbooks can be re-read by the chosen sheet index", async () => {
  const cells = (row: number, values: string[]) => values.map((value, column) =>
    `<c r="${String.fromCharCode(65 + column)}${row}" t="inlineStr"><is><t>${value}</t></is></c>`).join("");
  const sheet = (first: string) => `<?xml version="1.0"?><worksheet><sheetData><row r="1">${cells(1, [first, "X"])}</row></sheetData></worksheet>`;
  const bytes = zipSync({
    "xl/workbook.xml": strToU8(`<workbook><sheets><sheet name="Timetable" sheetId="1" r:id="rId1"/><sheet name="Calendar" sheetId="2" r:id="rId2"/></sheets></workbook>`),
    "xl/worksheets/sheet1.xml": strToU8(sheet("Monday")),
    "xl/worksheets/sheet2.xml": strToU8(sheet("2026-01-26")),
  });
  assert.deepEqual(sheetNames(bytes), ["Timetable", "Calendar"]);
  assert.equal(readXlsxGrid(bytes, 2)[0]?.[0], "2026-01-26");
  const file = {
    name: "book.xlsx", size: bytes.byteLength,
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    text: async () => "", arrayBuffer: async () => bytes.buffer.slice(0) as ArrayBuffer,
  };
  const first = await extractAcademicDocument(file);
  assert.equal(first.sheetNames.length, 2);
  assert.equal(first.grid[0]?.[0], "Monday");
  assert.ok(first.warnings.some((warning) => /2 sheets/.test(warning)));
  const second = await extractAcademicDocument(file, { sheet: 2 });
  assert.equal(second.grid[0]?.[0], "2026-01-26");
  assert.equal(second.contentHash, first.contentHash, "same file hashes identically");
});

test("CSV / Excel / PDF / image formats route through one local extractor", async () => {
  assert.equal(formatOf("Time Table.XLSX"), "xlsx");
  assert.equal(formatOf("scan.PNG"), "image");
  assert.equal(formatOf("legacy.xls"), "xls");
  const csvFile = {
    name: "timetable.csv", size: 1, type: "text/csv",
    text: async () => "Day,Time,Course,Code\nMonday,9:00-10:00,Mathematics,MA301",
    arrayBuffer: async () => new TextEncoder().encode("Day,Time,Course,Code\nMonday,9:00-10:00,Mathematics,MA301").buffer,
  };
  const doc = await extractAcademicDocument(csvFile);
  assert.equal(doc.format, "csv");
  assert.equal(doc.unavailable, null);
  const extraction = interpretDocument(doc, "timetable");
  assert.equal("courses" in extraction && extraction.courses.length, 1);
  const pasted = await fromPastedText("Day,Time,Course,Code\nMonday,9:00-10:00,Mathematics,MA301", "timetable");
  assert.equal(pasted.contentHash, doc.contentHash, "identical content hashes identically");
  const xls = await extractAcademicDocument({ ...csvFile, name: "old.xls", arrayBuffer: async () => new ArrayBuffer(4) });
  assert.ok(xls.unavailable?.includes("xls"));
  const hash = await sha256Hex(new Uint8Array([1, 2, 3]));
  assert.equal(hash, await sha256Hex(new Uint8Array([1, 2, 3])));
  assert.notEqual(hash, await sha256Hex(new Uint8Array([1, 2, 4])));
});

test("PDF-reconstructed rows always require human confirmation", async () => {
  const content = "BT /F1 12 Tf 50 700 Td (Monday) Tj 100 0 Td (9:00-10:00) Tj 200 0 Td (Mathematics) Tj ET";
  const pdf = `%PDF-1.4\n1 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n%%EOF`;
  const bytes = new TextEncoder().encode(pdf);
  const doc = await extractAcademicDocument({
    name: "timetable.pdf", size: bytes.length, type: "application/pdf",
    text: async () => "", arrayBuffer: async () => bytes.buffer.slice(0) as ArrayBuffer,
  });
  assert.equal(doc.format, "pdf");
  assert.equal(doc.unavailable, null);
  assert.equal(doc.confidence, "low");
  assert.equal(doc.needsReview, true);
  assert.ok(doc.warnings.some((warning) => /confirmation/i.test(warning)));
  const extraction = interpretDocument(doc, "timetable");
  assert.equal("slots" in extraction && extraction.needsReview, true);
  assert.ok("slots" in extraction && extraction.slots.every((item) => item.needsReview));
});

test("PDF text-layer extraction is positional and honest about scanned PDFs", () => {
  const content = "BT /F1 12 Tf 50 700 Td (Monday) Tj 100 0 Td (Mathematics) Tj ET";
  const pdf = `%PDF-1.4\n1 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n%%EOF`;
  const result = readPdfText(new TextEncoder().encode(pdf));
  assert.equal(result.warnings.length, 0);
  assert.equal(result.streamCount, 1);
  assert.equal(result.items.length, 2);
  assert.ok(result.text.includes("Monday") && result.text.includes("Mathematics"));
  const scanned = readPdfText(new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<< /Subtype /Image >>\nstream\n\x00\x01\x02\nendstream\n%%EOF"));
  assert.equal(scanned.items.length, 0);
  assert.ok(scanned.warnings[0]?.includes("scanned PDF"));
});

/* =============================================================== DB adapters */
function dbCourse(overrides: Partial<CourseRow> = {}): CourseRow {
  return {
    id: "c-a", semester_id: "sem", code: "MA301", name: "Mathematics", category: "theory",
    attendance_target: null, calculation_mode: "class_count", color: "#38B8A5",
    created_at: "2026-01-01T00:00:00Z", ...overrides,
  };
}
function dbRule(overrides: Partial<TimetableRuleRow> = {}): TimetableRuleRow {
  return {
    id: "r1", semester_id: "sem", course_id: "c-a", weekday: 1,
    starts_at: "09:00", ends_at: "10:00", location: "LH-1",
    valid_from: null, valid_until: null, created_at: "2026-01-01T00:00:00Z", ...overrides,
  };
}
function dbDay(overrides: Partial<AcademicDayRow> = {}): AcademicDayRow {
  return {
    id: "d1", semester_id: "sem", day: "2026-01-12", kind: "holiday",
    title: "Republic Day", notes: null, ...overrides,
  };
}
function dbSemester(): SemesterRow {
  return {
    id: "sem", owner_id: "u1", name: "Odd Semester 2026", institution: null,
    start_date: SEMESTER_START, end_date: SEMESTER_END, attendance_target: 75,
    prediction_mode: "fixed", group_id: null, created_at: "2026-01-01T00:00:00Z",
  };
}

test("DB rows convert into the SAME engine input as the review wizard", () => {
  const courses = [dbCourse(), dbCourse({ id: "c-b", code: "PHY301", name: "Physics" })];
  const rules = [dbRule(), dbRule({ id: "r2", course_id: "c-b", weekday: 2, starts_at: "10:00", ends_at: "11:00" })];
  const input = buildEngineInput({ semester: dbSemester(), courses, rules, academicDays: [] });
  assert.equal(input.courses.length, 2);
  assert.equal(input.rules.length, 2);
  assert.equal(input.rules[0]?.courseKey, "code:MA301");
  assert.equal(courseKeyForRow(dbCourse({ source_key: "sem:course:code:MA301" })), "sem:course:code:MA301");
  assert.equal(weeklyRulesFromRows(rules, courses)[0]?.sessionType, "lecture");
  const fromDb = computeSchedule(input);
  const direct = computeSchedule(base({ rules: [
    rule("r1", A, 1, "09:00", "10:00"), rule("r2", B, 2, "10:00", "11:00"),
  ], courses: COURSES.slice(0, 2) }));
  assert.deepEqual(fromDb.sessions.map((item) => item.key), direct.sessions.map((item) => item.key));
});

test("several exceptions on ONE date share a row via extra_data (no silent overwrite)", () => {
  const entries: CalendarEntry[] = [{
    id: "e1", raw: "2026-01-12 | holiday | College closed", date: "2026-01-12", endDate: "2026-01-12",
    type: "holiday", title: "College closed", scope: "full_day", followsWeekday: null,
    note: null, confidence: "high", issues: [], needsReview: false,
  }];
  const manual = [
    additionalClassException("extra", B, "2026-01-12", "16:00", "17:00"),
    cancellationException("cancel", "2026-01-19", A, "09:00", "10:00", false),
  ];
  const rows = toCalendarExceptionRows("sem", entries, manual);
  assert.equal(rows.length, 2, "one row per date, despite three exceptions");
  const byDate = new Map(rows.map((row) => [row.day, row]));
  const firstPayload = byDate.get("2026-01-12")?.extra_data as unknown as { exceptions: DayException[] };
  assert.equal(firstPayload.exceptions.length, 2, "holiday + one-off class on the same date are both stored");
  const secondPayload = byDate.get("2026-01-19")?.extra_data as unknown as { exceptions: DayException[] };
  assert.equal(secondPayload.exceptions.length, 1);
  const restored = dayExceptionsFromRows(rows.map((row, index) => ({
    ...dbDay({ day: row.day }),
    id: `d${index}`,
    source_key: row.source_key,
    extra_data: row.extra_data ?? null,
  } as unknown as AcademicDayRow)));
  assert.equal(restored.length, 3);
  assert.deepEqual(restored.map((item) => item.type).sort(), ["additional", "cancelled", "holiday"]);
  const result = computeSchedule(base({ exceptions: restored }));
  assert.equal(result.sessions.filter((item) => item.date === "2026-01-12" && item.origin === "additional").length, 1);
  assert.equal(result.sessions.filter((item) => item.date === "2026-01-12" && item.origin === "weekly").length, 0,
    "the full-day holiday suppresses the normal weekly template");
  assert.equal(result.sessions.filter((item) => item.date === "2026-01-19" && item.cancelled).length, 1,
    "the cancellation is preserved on its own date");
  assert.equal(result.totals.cancelled, 1);
});

test("idempotent DB insert builders produce deterministic keys and safe times", () => {
  const courses = buildCourses([slot({ weekday: 1 }), slot({ id: "2", weekday: 3, startTime: "11:00", endTime: "12:00" })]);
  const inserts = toCourseInserts("sem", courses, ["#A", "#B"], "test.csv");
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0]?.source_key, "sem:course:code:MA301");
  assert.equal(inserts[0]?.confirmed_at !== null, true);
  const ids = new Map([[inserts[0]!.source_key!, "c-a"]]);
  const rules = toRuleInserts("sem", courses, ids, SEMESTER_START, SEMESTER_END);
  assert.equal(rules.length, 2);
  assert.equal(new Set(rules.map((item) => item.source_key)).size, 2);
  const result = computeSchedule(base());
  const events = toEventInserts({
    ...result,
    sessions: [{ ...result.sessions[0]!, startTime: "23:00", endTime: "00:30" }],
  }, {
    semesterId: "sem", userId: "u1", importId: null,
    courseIdByKey: new Map([[A, "c-a"]]), courseNameByKey: new Map([[A, "Mathematics"]]),
  });
  assert.equal(events.length, 1);
  assert.ok(new Date(events[0]!.ends_at).getTime() > new Date(events[0]!.starts_at).getTime(), "cross-midnight session is valid");
  assert.equal(events[0]?.status, "scheduled");
  assert.match(String(events[0]?.source_key ?? ""), /^sem:session:/);
});

test("institution-specific matrix layout and Monday-Saturday weekdays", () => {
  const grid = [
    ["Time", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    ["9:00-10:00", "MA301 Mathematics", "", "PHY301 Physics", "", "", ""],
    ["11:00-12:00", "", "", "CS301 Database Systems", "", "", ""],
    ["14:00-17:00", "", "", "", "", "CS302 Programming Lab", ""],
  ];
  const result = interpretTimetableGrid(grid);
  assert.equal(result.layout, "matrix");
  assert.equal(result.slots.length, 4);
  assert.equal(result.courses.length, 4);
  assert.equal(result.courses.find((item) => item.code === "CS301")?.name, "Database Systems");
  assert.equal(result.courses.find((item) => item.code === "CS302")?.sessionTypes[0], "lab");
  assert.deepEqual(result.courses.find((item) => item.code === "MA301")?.days, [1]);
  assert.equal(result.uncertain.length, 0);
});
