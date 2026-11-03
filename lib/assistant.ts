/**
 * Deterministic, on-device Attendly assistant.
 *
 * There is NO AI backend in the live Supabase project (verified: zero Edge
 * Functions). This module answers questions using only the signed-in user's
 * already-loaded, RLS-filtered data and the canonical attendance engine. It
 * never invents numbers and never sees another group member's private data.
 */
import { formatTime, relativeDayLabel, formatDate } from "./dates.ts";
import { summarize } from "./attendance/engine.ts";
import type {
  AssignmentRow,
  CalendarEventRow,
  CourseAttendanceStats,
  CourseRow,
  SemesterRow,
  SessionWithAttendance,
} from "./types.ts";

export interface AssistantData {
  semester: SemesterRow | null;
  courses: CourseRow[];
  sessions: SessionWithAttendance[];
  events: CalendarEventRow[];
  stats: CourseAttendanceStats[];
  assignments: AssignmentRow[];
  now?: number;
}

export interface AssistantAnswer {
  text: string;
  action?: { label: string; href: string };
}

export const QUICK_QUESTIONS = [
  "How is my attendance?",
  "Which course is at risk?",
  "Can I miss tomorrow?",
  "What is my next class?",
  "How many classes to recover?",
  "What assignments are due this week?",
  "Summarize my schedule",
];

function courseName(data: AssistantData, courseId: string | null): string {
  if (!courseId) return "General";
  return data.courses.find((course) => course.id === courseId)?.name ?? "a course";
}

export function answerQuestion(question: string, data: AssistantData): AssistantAnswer {
  const q = question.trim().toLowerCase();
  const now = data.now ?? Date.now();

  if (!data.semester) {
    return {
      text: "Your academic workspace is not set up yet. Add a semester, courses and a timetable first — then I can answer questions about your attendance and schedule.",
      action: { label: "Set up workspace", href: "/onboarding" },
    };
  }

  if (/^(hi|hello|hey|help)\b/.test(q) || q === "") {
    return {
      text: "Hi! I can help with attendance, risk, safe-bunk allowance, recovery, upcoming classes and deadlines. Try one of the suggested questions. Everything I say comes from your own confirmed data and the same calculation engine used across Attendly.",
    };
  }

  if (q.includes("next class") || (q.includes("next") && q.includes("class"))) {
    const next = [...data.sessions]
      .filter((session) => session.event.status === "scheduled" && new Date(session.event.starts_at).getTime() > now)
      .sort((a, b) => a.event.starts_at.localeCompare(b.event.starts_at))[0];
    if (!next) {
      return { text: "You have no upcoming scheduled classes in the loaded timetable.", action: { label: "Open calendar", href: "/calendar" } };
    }
    return {
      text: `Your next class is ${next.event.title} ${relativeDayLabel(next.event.starts_at).toLowerCase()} at ${formatTime(next.event.starts_at)}${next.event.location ? ` in ${next.event.location}` : ""}.`,
      action: { label: "Open calendar", href: "/calendar" },
    };
  }

  if (q.includes("assignment") || q.includes("due") || q.includes("deadline")) {
    const weekEnd = now + 7 * 86_400_000;
    const due = data.assignments.filter(
      (item) => item.status !== "submitted" && item.due_at && new Date(item.due_at).getTime() <= weekEnd,
    );
    if (due.length === 0) {
      return { text: "No assignments are due in the next 7 days.", action: { label: "View assignments", href: "/productivity" } };
    }
    const list = due
      .slice(0, 5)
      .map((item) => `• ${item.title}${item.due_at ? ` (${relativeDayLabel(item.due_at)})` : ""}`)
      .join("\n");
    return {
      text: `${due.length} assignment${due.length === 1 ? "" : "s"} due in the next 7 days:\n${list}`,
      action: { label: "View assignments", href: "/productivity" },
    };
  }

  if (q.includes("recover") || q.includes("how many") || q.includes("reach")) {
    const below = data.stats.filter((stat) => stat.recoveryClasses !== null && stat.recoveryClasses > 0);
    if (below.length === 0) {
      return { text: "All your courses are at or above target — nothing to recover right now." };
    }
    const list = below
      .map((stat) => `• ${courseName(data, stat.courseId)}: attend ${stat.recoveryClasses} more class${stat.recoveryClasses === 1 ? "" : "es"} in a row to reach ${stat.target}%`)
      .join("\n");
    return { text: `To recover:\n${list}`, action: { label: "Recovery calculator", href: "/attendance?tab=recovery" } };
  }

  if (q.includes("risk") || q.includes("which course") || q.includes("worst") || q.includes("danger")) {
    const risky = data.stats.filter((stat) => stat.risk === "at_risk" || stat.risk === "warning");
    if (risky.length === 0) return { text: "No courses are currently at risk. You are on track across the board." };
    const list = risky
      .map((stat) => `• ${courseName(data, stat.courseId)}: ${stat.percent === null ? "no marked classes yet" : `${stat.percent}%`} (target ${stat.target}%)`)
      .join("\n");
    return { text: `${risky.length} course${risky.length === 1 ? "" : "s"} need attention:\n${list}`, action: { label: "View attendance", href: "/attendance" } };
  }

  if (q.includes("miss") || q.includes("bunk") || q.includes("skip") || q.includes("tomorrow")) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowClasses = data.sessions.filter(
      (session) =>
        session.event.status === "scheduled" &&
        new Date(session.event.starts_at).toDateString() === tomorrow.toDateString(),
    );
    if (q.includes("tomorrow") && tomorrowClasses.length === 0) {
      return { text: "You have no classes scheduled tomorrow, so there is nothing to miss." };
    }
    if (q.includes("tomorrow")) {
      const lines = tomorrowClasses.map((session) => {
        const stat = data.stats.find((item) => item.courseId === session.event.course_id);
        const allowance = stat?.bunkAllowance ?? null;
        const verdict =
          allowance === null
            ? "allowance unknown"
            : allowance > 0
              ? `safe to miss (${allowance} in hand)`
              : "not safe to miss";
        return `• ${session.event.title}: ${verdict}`;
      });
      return {
        text: `Tomorrow's classes:\n${lines.join("\n")}\nBased on your current confirmed attendance and target.`,
        action: { label: "Bunk calculator", href: "/attendance?tab=bunk" },
      };
    }
    const total = data.stats.reduce((sum, stat) => sum + (stat.bunkAllowance ?? 0), 0);
    return {
      text: `Across your courses you can safely miss about ${total} more class${total === 1 ? "" : "es"} in total while staying at target. Per-course allowances vary — check the bunk calculator before skipping.`,
      action: { label: "Bunk calculator", href: "/attendance?tab=bunk" },
    };
  }

  if (q.includes("summar") || q.includes("schedule") || q.includes("overview") || q.includes("week")) {
    const upcoming = data.sessions.filter(
      (session) => session.event.status === "scheduled" && new Date(session.event.starts_at).getTime() > now,
    ).length;
    const exams = data.events.filter(
      (event) => event.kind === "exam" && new Date(event.starts_at).getTime() > now,
    ).length;
    return {
      text: `${data.semester.name}: ${data.courses.length} courses, ${upcoming} upcoming classes and ${exams} upcoming exams. ${data.stats.filter((stat) => stat.risk === "at_risk").length} courses are below target. Loaded timetable covers ${formatDate(new Date(now).toISOString())} onward.`,
      action: { label: "Open calendar", href: "/calendar" },
    };
  }

  const overall = summarize({
    sessions: data.sessions.map((session) => ({
      status: session.record?.status ?? "unmarked",
      lifecycle: session.event.status,
    })),
    targetPercent: data.semester.attendance_target,
  });
  if (overall.percent === null) {
    return {
      text: "You have not marked any attendance yet. Mark a few classes and I can tell you how you are doing.",
      action: { label: "Mark attendance", href: "/attendance" },
    };
  }
  const verdict = overall.percent >= data.semester.attendance_target ? "above" : "below";
  return {
    text: `Your overall attendance is ${overall.percent}%, which is ${verdict} your ${data.semester.attendance_target}% target. You have attended ${overall.present} of ${overall.counted} counted classes (${overall.unmarked} unmarked, ${overall.excused} excused).`,
    action: { label: "See analytics", href: "/analytics" },
  };
}
