import { createCourse, createTimetableRule, fetchCourses, fetchTimetableRules, upsertAcademicDays } from '@/services/api/courses';
import { COURSE_COLORS } from '@/components/domain/CourseForm';
import type { AcademicDayDraft, TimetableDraftRow } from '@/types/domain';

export interface ImportSummary {
  createdCourses: number;
  createdRules: number;
  skippedRules: number;
}

/**
 * Import reviewed timetable rows: match or create courses by code/name, then
 * create recurring rules. Idempotent — identical course+weekday+start rules are
 * skipped so re-importing never duplicates the timetable.
 */
export async function importTimetableRows(
  semesterId: string,
  rows: TimetableDraftRow[],
): Promise<ImportSummary> {
  const existingCourses = await fetchCourses(semesterId);
  const existingRules = await fetchTimetableRules(semesterId);
  const ruleKeys = new Set(existingRules.map((r) => `${r.course_id}|${r.weekday}|${r.starts_at.slice(0, 5)}`));
  let createdCourses = 0;
  let createdRules = 0;
  let skippedRules = 0;
  let colorIndex = existingCourses.length;

  const courseByCode = new Map(existingCourses.filter((c) => c.code).map((c) => [c.code!.toLowerCase(), c]));
  const courseByName = new Map(existingCourses.map((c) => [c.name.toLowerCase(), c]));

  for (const row of rows) {
    let course =
      (row.courseCode ? courseByCode.get(row.courseCode.toLowerCase()) : undefined) ??
      courseByName.get(row.courseName.toLowerCase());
    if (!course) {
      course = await createCourse({
        semester_id: semesterId,
        name: row.courseName,
        code: row.courseCode || null,
        color: COURSE_COLORS[colorIndex % COURSE_COLORS.length],
      });
      colorIndex += 1;
      createdCourses += 1;
      if (course.code) courseByCode.set(course.code.toLowerCase(), course);
      courseByName.set(course.name.toLowerCase(), course);
    }
    const key = `${course.id}|${row.weekday}|${row.startTime}`;
    if (ruleKeys.has(key)) {
      skippedRules += 1;
      continue;
    }
    await createTimetableRule({
      semester_id: semesterId,
      course_id: course.id,
      weekday: row.weekday,
      starts_at: row.startTime,
      ends_at: row.endTime,
      location: row.location || null,
    });
    ruleKeys.add(key);
    createdRules += 1;
  }
  return { createdCourses, createdRules, skippedRules };
}

export async function importAcademicCalendar(
  semesterId: string,
  rows: AcademicDayDraft[],
): Promise<number> {
  if (rows.length === 0) return 0;
  await upsertAcademicDays(
    rows.map((r) => ({ semester_id: semesterId, day: r.day, kind: r.kind, title: r.title || null })),
  );
  return rows.length;
}
