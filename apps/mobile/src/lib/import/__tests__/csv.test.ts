import { parseAcademicCalendarCsv, parseCsv, parseTimetableCsv, parseWeekday } from '../csv';

describe('parseCsv', () => {
  it('parses simple rows', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });
  it('handles quoted fields with commas and escaped quotes', () => {
    expect(parseCsv('name,note\n"Smith, John","He said ""hi"""')).toEqual([
      ['name', 'note'],
      ['Smith, John', 'He said "hi"'],
    ]);
  });
  it('handles CRLF and skips blank lines', () => {
    expect(parseCsv('a,b\r\n1,2\r\n\r\n3,4\r\n')).toEqual([['a', 'b'], ['1', '2'], ['3', '4']]);
  });
});

describe('parseWeekday', () => {
  it('accepts names, abbreviations and numbers', () => {
    expect(parseWeekday('Monday')).toBe(1);
    expect(parseWeekday('mon')).toBe(1);
    expect(parseWeekday('0')).toBe(0);
    expect(parseWeekday('Saturday')).toBe(6);
    expect(parseWeekday('funday')).toBeNull();
  });
});

describe('parseTimetableCsv', () => {
  it('parses a valid timetable with aliases and 12h times', () => {
    const csv = 'course_code,course_name,day,start,end,room\nCS201,Data Structures,Monday,9:00 AM,10:30 AM,Room 204\nCS202,Algorithms,Tue,14:00,15:00,Lab 3';
    const result = parseTimetableCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({ courseCode: 'CS201', courseName: 'Data Structures', weekday: 1, startTime: '09:00', endTime: '10:30', location: 'Room 204' });
    expect(result.rows[1]).toMatchObject({ weekday: 2, startTime: '14:00' });
  });

  it('reports row-level errors without dropping valid rows', () => {
    const csv = 'course_name,weekday,start_time,end_time\nMath,Monday,09:00,10:00\n,Monday,09:00,10:00\nPhysics,Funday,09:00,10:00\nChem,Monday,11:00,10:00';
    const result = parseTimetableCsv(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.errors).toHaveLength(3);
  });

  it('rejects a missing required header', () => {
    const result = parseTimetableCsv('foo,bar\n1,2');
    expect(result.rows).toHaveLength(0);
    expect(result.errors[0]?.message).toMatch(/header/i);
  });
});

describe('parseAcademicCalendarCsv', () => {
  it('parses valid days and rejects unknown kinds', () => {
    const csv = 'date,kind,title\n2026-11-10,holiday,Diwali\n2026-11-11,exam,Midterm\n2026-11-12,party,Celebration';
    const result = parseAcademicCalendarCsv(csv);
    expect(result.rows).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ day: '2026-11-10', kind: 'holiday', title: 'Diwali' });
  });

  it('rejects invalid dates', () => {
    const result = parseAcademicCalendarCsv('date,kind\n10-11-2026,holiday');
    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });
});
