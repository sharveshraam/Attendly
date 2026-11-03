import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv, parseTimetableCsv, parseAcademicDaysCsv, parseWeekday, normalizeTime } from "../lib/import/csv.ts";

test("RFC-4180 parsing with quotes and CRLF", () => {
  const rows = parseCsv('a,b,c\r\n"x,y","say ""hi""",z\n');
  assert.deepEqual(rows, [["a", "b", "c"], ["x,y", 'say "hi"', "z"]]);
});

test("weekday aliases and numeric values", () => {
  assert.equal(parseWeekday("Mon"), 1);
  assert.equal(parseWeekday("THURSDAY"), 4);
  assert.equal(parseWeekday("0"), 0);
  assert.equal(parseWeekday("someday"), null);
});

test("time normalisation handles 12-hour and 24-hour input", () => {
  assert.equal(normalizeTime("9:00 AM"), "09:00");
  assert.equal(normalizeTime("1:30 pm"), "13:30");
  assert.equal(normalizeTime("12:00 am"), "00:00");
  assert.equal(normalizeTime("23:59"), "23:59");
  assert.equal(normalizeTime("25:00"), null);
});

test("timetable CSV requires the correct headers", () => {
  const result = parseTimetableCsv("name,day\nDatabases,Mon\n");
  assert.equal(result.rows.length, 0);
  assert.match(result.errors[0]?.message ?? "", /Header/);
});

test("timetable CSV parses valid rows and reports bad ones", () => {
  const csv = "course_code,course_name,weekday,start_time,end_time,location\nCS301,Databases,Mon,09:00,10:00,Lab 2\nMA302,Maths,Tuesday,11:00 am,12:00 pm,R1\nBAD,Broken,Nope,09:00,10:00,\nREV,Reversed,Wed,11:00,10:00,\n";
  const result = parseTimetableCsv(csv);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[1]?.startTime, "11:00");
  assert.equal(result.rows[1]?.endTime, "12:00");
  assert.equal(result.errors.length, 2);
});

test("academic day CSV parses classifications", () => {
  const csv = "date,kind,title\n2026-01-26,holiday,Republic Day\n2026-03-20,exam,Midsem\n2026-13-01,holiday,Bad date\n";
  const result = parseAcademicDaysCsv(csv);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0]?.kind, "holiday");
  assert.equal(result.errors.length, 1);
});
