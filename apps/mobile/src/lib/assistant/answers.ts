/**
 * Deterministic Attendly Assistant. Answers are computed from the user's own
 * authorized data using the attendance engine — never invented, never sent to an
 * external AI service, and never including other users' private attendance. The
 * assistant only reads and suggests; consequential changes happen on dedicated
 * screens that require explicit user action.
 */
import type { Assignment, CalendarEvent, Course, CourseAttendanceStats, Semester, SessionWithAttendance } from '@/types/domain';
import { summarize } from '@/lib/attendance/engine';
import { formatTime, relativeDayLabel } from '@/lib/dates';

export interface AssistantData {
  semester: Semester | null;
  courses: Course[];
  stats: CourseAttendanceStats[];
  sessions: SessionWithAttendance[];
  assignments: Assignment[];
  events: CalendarEvent[];
}

export interface AssistantAnswer {
  text: string;
  action?: { label: string; route: string };
}

function courseName(data: AssistantData, id: string): string {
  return data.courses.find((c) => c.id === id)?.name ?? 'a course';
}

export function answerQuestion(question: string, data: AssistantData): AssistantAnswer {
  const q = question.toLowerCase().trim();

  if (!data.semester) {
    return { text: 'You have not set up a semester yet. Start setup to add courses and a timetable, and I can answer attendance questions.', action: { label: 'Start setup', route: '/onboarding' } };
  }

  if (/^(hi|hello|hey|help)\b/.test(q) || q === '') {
    return { text: 'Hi! I can help with your attendance. Ask me things like "How is my attendance?", "Which course is at risk?", "Can I miss tomorrow?", "What is my next class?", or "What assignments are due?".' };
  }

  // Next class
  if (q.includes('next class') || (q.includes('next') && q.includes('class'))) {
    const next = data.sessions.find((s) => s.event.status === 'scheduled' && new Date(s.event.starts_at).getTime() > Date.now());
    if (!next) return { text: 'You have no upcoming scheduled classes. Add your timetable to see what is next.', action: { label: 'Open calendar', route: '/(tabs)/calendar' } };
    return { text: `Your next class is ${next.event.title} ${relativeDayLabel(next.event.starts_at).toLowerCase()} at ${formatTime(next.event.starts_at)}${next.event.location ? ` in ${next.event.location}` : ''}.` };
  }

  // Assignments due
  if (q.includes('assignment') || q.includes('due') || q.includes('deadline')) {
    const weekEnd = Date.now() + 7 * 86_400_000;
    const due = data.assignments.filter((a) => a.status !== 'submitted' && a.due_at && new Date(a.due_at).getTime() <= weekEnd);
    if (due.length === 0) return { text: 'No assignments are due in the next 7 days. Nice and clear!', action: { label: 'View assignments', route: '/productivity/assignments' } };
    const list = due.slice(0, 5).map((a) => `• ${a.title}${a.due_at ? ` (${relativeDayLabel(a.due_at)})` : ''}`).join('\n');
    return { text: `${due.length} assignment${due.length === 1 ? '' : 's'} due this week:\n${list}`, action: { label: 'View assignments', route: '/productivity/assignments' } };
  }

  // Recovery
  if (q.includes('recover') || q.includes('how many') || q.includes('reach')) {
    const below = data.stats.filter((s) => s.recoveryClasses !== null && s.recoveryClasses > 0);
    if (below.length === 0) return { text: 'All your courses are at or above target — nothing to recover right now. Keep attending consistently.' };
    const list = below.map((s) => `• ${courseName(data, s.courseId)}: attend ${s.recoveryClasses} more in a row to reach ${s.target}%`).join('\n');
    return { text: `To recover:\n${list}`, action: { label: 'Recovery calculator', route: '/tools/recovery' } };
  }

  // At risk
  if (q.includes('risk') || q.includes('which course') || q.includes('worst') || q.includes('danger')) {
    const risky = data.stats.filter((s) => s.risk === 'at_risk' || s.risk === 'warning');
    if (risky.length === 0) return { text: 'No courses are currently at risk. You are on track across the board.' };
    const list = risky.map((s) => `• ${courseName(data, s.courseId)}: ${s.percent ?? '—'}% (target ${s.target}%)`).join('\n');
    return { text: `${risky.length} course${risky.length === 1 ? '' : 's'} need attention:\n${list}`, action: { label: 'View attendance', route: '/(tabs)/attendance' } };
  }

  // Bunk / can I miss
  if (q.includes('miss') || q.includes('bunk') || q.includes('skip') || q.includes('tomorrow')) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowsClasses = data.sessions.filter((s) => {
      const d = new Date(s.event.starts_at);
      return s.event.status === 'scheduled' && d.toDateString() === tomorrow.toDateString();
    });
    if (q.includes('tomorrow') && tomorrowsClasses.length === 0) {
      return { text: 'You have no classes scheduled tomorrow, so there is nothing to miss.' };
    }
    if (q.includes('tomorrow')) {
      const lines = tomorrowsClasses.map((s) => {
        const stat = data.stats.find((x) => x.courseId === s.event.course_id);
        const allowance = stat?.bunkAllowance ?? null;
        const verdict = allowance === null ? 'allowance unknown' : allowance > 0 ? `safe to miss (${allowance} in hand)` : 'not safe to miss';
        return `• ${s.event.title}: ${verdict}`;
      });
      return { text: `Tomorrow's classes:\n${lines.join('\n')}\nBased on your current attendance and target.`, action: { label: 'Bunk calculator', route: '/tools/bunk' } };
    }
    const total = data.stats.reduce((sum, s) => sum + (s.bunkAllowance ?? 0), 0);
    return { text: `Across your courses you can safely miss about ${total} more class${total === 1 ? '' : 'es'} in total while staying at target. Per-course allowances vary — check the bunk calculator before skipping.`, action: { label: 'Bunk calculator', route: '/tools/bunk' } };
  }

  // Schedule summary
  if (q.includes('summar') || q.includes('schedule') || q.includes('overview') || q.includes('week')) {
    const upcoming = data.sessions.filter((s) => s.event.status === 'scheduled' && new Date(s.event.starts_at).getTime() > Date.now()).length;
    const exams = data.events.filter((e) => e.kind === 'exam' && new Date(e.starts_at).getTime() > Date.now()).length;
    return { text: `${data.semester.name}: ${data.courses.length} courses, ${upcoming} upcoming classes and ${exams} upcoming exams. ${data.stats.filter((s) => s.risk === 'at_risk').length} courses are below target.`, action: { label: 'Open calendar', route: '/(tabs)/calendar' } };
  }

  // Overall attendance (default / "how is my attendance")
  const overall = summarize({
    sessions: data.sessions.map((s) => ({ status: s.record?.status ?? 'unmarked', lifecycle: s.event.status })),
    targetPercent: data.semester.attendance_target,
  });
  if (overall.percent === null) {
    return { text: 'You have not marked any attendance yet. Mark a few classes and I can tell you how you are doing.', action: { label: 'Mark attendance', route: '/(tabs)/attendance' } };
  }
  const verdict = overall.percent >= data.semester.attendance_target ? 'above' : 'below';
  return {
    text: `Your overall attendance is ${overall.percent}%, which is ${verdict} your ${data.semester.attendance_target}% target. You have attended ${overall.present} of ${overall.counted} counted classes (${overall.unmarked} unmarked, ${overall.excused} excused).`,
    action: { label: 'See analytics', route: '/analytics' },
  };
}

export const QUICK_QUESTIONS = [
  'How is my attendance?',
  'Which course is at risk?',
  'Can I miss tomorrow?',
  'What is my next class?',
  'How many classes to recover?',
  'What assignments are due?',
  'Summarize my schedule',
];
