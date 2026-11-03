"use client";

/**
 * Dashboard panel powered by the SAME central engine as the import wizard and
 * the shared Supabase `expected_class_counts` RPC used by the mobile app.
 * Expected classes are schedule predictions; they never imply attendance.
 */
import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, Sparkles } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { useNow } from "@/hooks/use-now";
import { Panel, ProgressBar } from "@/components/ui";
import { computeFromWorkspace } from "@/lib/academic/bridge";
import { semesterProgress, weeklyDistribution } from "@/lib/academic/engine";
import { courseKeyForRow } from "@/lib/academic/bridge";
import { endOfWeekKey, startOfWeekKey, weekdayOf } from "@/lib/academic/dates";
import { WEEKDAYS } from "@/lib/dates";

export function AcademicOverview() {
  const { semester, courses, rules, academicDays, events, sessions, stats } = useWorkspace();
  const now = useNow();
  const today = new Date(now).toISOString().slice(0, 10);
  const result = useMemo(
    () => semester ? computeFromWorkspace({ semester, courses, rules, academicDays, asOf: today }) : null,
    [semester, courses, rules, academicDays, today],
  );
  if (!semester || !result) return null;

  const weekStart = startOfWeekKey(today);
  const weekEnd = endOfWeekKey(today);
  const thisWeek = result.sessions.filter((session) => !session.cancelled && session.date >= weekStart && session.date <= weekEnd);
  const upcoming = result.sessions.filter((session) => !session.cancelled && session.date >= today).slice(0, 4);
  const distribution = weeklyDistribution(result.sessions);
  const maxWeek = Math.max(1, ...Object.values(distribution));
  const progress = semesterProgress(semester.start_date, semester.end_date ?? today, today);
  const holidays = academicDays
    .filter((day) => day.day >= today && ["holiday", "closure", "exam", "non_instructional"].includes(day.kind))
    .sort((a, b) => a.day.localeCompare(b.day)).slice(0, 3);
  const courseById = new Map(courses.map((course) => [course.id, course]));
  const counted = stats.reduce((total, item) => total + (item.counted ?? 0), 0);
  const present = stats.reduce((total, item) => total + (item.present ?? 0), 0);
  const overallPercent = counted > 0 ? Math.round((present / counted) * 1000) / 10 : null;

  return (
    <Panel
      eyebrow="Automatic academic structure"
      title="Your semester at a glance"
      action={<Link className="btn btn-sm btn-ghost" href="/academic">Import / edit <ArrowRight size={13} /></Link>}
    >
      <div className="dash-grid">
        <div className="stack" style={{ gap: 10 }}>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <div><span className="eyebrow">Courses detected</span><div style={{ fontSize: 22, fontWeight: 700 }}>{courses.length}</div></div>
            <div><span className="eyebrow">Classes this week</span><div style={{ fontSize: 22, fontWeight: 700 }}>{thisWeek.length}</div></div>
            <div><span className="eyebrow">Expected this semester</span><div style={{ fontSize: 22, fontWeight: 700 }}>{result.totals.scheduled}</div></div>
            <div><span className="eyebrow">Semester progress</span><div style={{ fontSize: 22, fontWeight: 700 }}>{progress}%</div></div>
          </div>
          <div><ProgressBar value={progress} tone="success" /></div>
          <div className="stack" style={{ gap: 4 }}>
            <span className="eyebrow">Session lifecycle (predicted vs confirmed)</span>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11 }}>
              <span>Scheduled <strong>{result.totals.scheduled}</strong></span>
              <span>Conducted <strong>{result.totals.conducted}</strong></span>
              <span>Attended <strong>{result.totals.attended}</strong></span>
              <span>Missed <strong>{result.totals.absent}</strong></span>
              <span>Pending <strong>{result.totals.pending}</strong></span>
              <span>Remaining <strong>{result.totals.remaining}</strong></span>
              <span>Cancelled <strong>{result.totals.cancelled}</strong></span>
            </div>
            <div style={{ fontSize: 11 }} className="muted">
              To reach {semester.attendance_target}%: <strong>{result.countsByCourse.reduce((total, item) => total + (item.classesRequired ?? 0), 0)}</strong> more attended classes
              {result.countsByCourse.some((item) => item.classesRequired === null) ? " (some courses unrecoverable)" : ""}
              {" · "}max missable <strong>{result.countsByCourse.reduce((total, item) => total + (item.maxMissable ?? 0), 0)}</strong>
              {" · "}current <strong>{stats.length > 0 && overallPercent !== null ? `${overallPercent}%` : "—"}</strong>
            </div>
          </div>
          <div>
            <span className="eyebrow">Weekly class distribution</span>
            <div className="stack" style={{ gap: 5, marginTop: 6 }}>
              {Object.entries(distribution).sort((a, b) => a[0].localeCompare(b[0])).slice(0, 10).map(([week, count]) => (
                <div key={week} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="mono faint" style={{ fontSize: 10, width: 78 }}>{week}</span>
                  <div style={{ flex: 1 }}><ProgressBar value={(count / maxWeek) * 100} tone="success" /></div>
                  <span className="mono" style={{ fontSize: 10, width: 22, textAlign: "right" }}>{count}</span>
                </div>
              ))}
              {Object.keys(distribution).length === 0 && <p className="muted" style={{ fontSize: 11.5 }}>Import a timetable to see the weekly distribution.</p>}
            </div>
          </div>
        </div>

        <div className="stack" style={{ gap: 10 }}>
          <div><span className="eyebrow">Course-wise expected classes</span>
            <div className="stack" style={{ gap: 0, marginTop: 4 }}>
              {courses.length === 0 && <p className="muted" style={{ fontSize: 11.5 }}>No courses detected yet.</p>}
              {courses.slice(0, 6).map((course) => {
                const counts = result.countsByCourse.find((item) => item.courseKey === courseKeyForRow(course));
                const stat = stats.find((item) => item.courseId === course.id);
                return <div className="list-row" key={course.id}>
                  <span className="color-bar" style={{ background: course.color }} />
                  <div className="list-row-main"><strong>{course.name}</strong><small>{counts?.weeklySessions ?? 0}/week · {counts?.scheduled ?? 0} expected · {stat?.percent === null || !stat ? "no confirmed marks" : `${stat.percent}%`}</small></div>
                  <span className="badge badge-accent">{counts?.scheduled ?? 0}</span>
                </div>;
              })}
            </div>
          </div>
          <div><span className="eyebrow">Upcoming classes & academic events</span>
            <div className="stack" style={{ gap: 0, marginTop: 4 }}>
              {upcoming.map((session) => {
                const course = [...courseById.values()].find((item) => courseKeyForRow(item) === session.courseKey);
                return <div className="list-row" key={session.key}>
                  <span className="badge"><CalendarDays size={11} /></span>
                  <div className="list-row-main"><strong>{course?.name ?? session.courseKey.split(":").pop()}</strong><small>{WEEKDAYS[weekdayOf(session.date)]} {session.date} · {session.startTime}</small></div>
                  <span className="badge">{session.origin}</span>
                </div>;
              })}
              {holidays.map((day) => <div className="list-row" key={day.id}>
                <span className="badge badge-warning"><Sparkles size={11} /></span>
                <div className="list-row-main"><strong>{day.title ?? day.kind.replace(/_/g, " ")}</strong><small>{day.day} · {day.kind.replace(/_/g, " ")}</small></div>
              </div>)}
              {upcoming.length === 0 && holidays.length === 0 && <p className="muted" style={{ fontSize: 11.5 }}>No upcoming classes or academic events yet.</p>}
            </div>
          </div>
          <p className="faint" style={{ fontSize: 10.5 }}>
            <BookOpen size={11} /> {events.length} dated events · {sessions.length} class sessions · {academicDays.length} calendar exceptions.
            Expected classes are predictions — only confirmed marks affect attendance.
          </p>
        </div>
      </div>
    </Panel>
  );
}
