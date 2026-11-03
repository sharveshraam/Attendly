"use client";

import Link from "next/link";
import {
  Activity, ArrowRight, BookOpen, CalendarDays, ClipboardList, GraduationCap, Plus,
  ShieldCheck, Sparkles, TriangleAlert, Users,
} from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { useNow } from "@/hooks/use-now";
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel, ProgressBar, RiskBadge, StatCard } from "@/components/ui";
import { ProgressRing } from "@/components/charts";
import { AttendanceMarker } from "@/components/attendance-marker";
import { AcademicOverview } from "@/components/academic-overview";
import { greeting, formatDate, formatTime, isToday, relativeDayLabel, countdownLabel } from "@/lib/dates";

export default function HomePage() {
  const {
    user, profile, semester, courses, events, sessions, stats, overall, assignments,
    academicDays, changeLog, loading, error, refresh, offlineView, lastSyncedAt,
  } = useWorkspace();

  const now = useNow();
  const displayName = profile?.display_name || user?.email?.split("@")[0] || "there";
  const todayEvents = events
    .filter((event) => isToday(event.starts_at) && event.status !== "cancelled")
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const todaySessions = sessions.filter((session) => isToday(session.event.starts_at));
  const nextClass = sessions.find(
    (session) => session.event.status === "scheduled" && new Date(session.event.starts_at).getTime() > now,
  );
  const upcomingExams = events
    .filter((event) => event.kind === "exam" && new Date(event.starts_at).getTime() > now)
    .slice(0, 4);
  const dueAssignments = assignments
    .filter((item) => item.status !== "submitted" && item.due_at && new Date(item.due_at).getTime() > now)
    .sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""))
    .slice(0, 4);
  const atRisk = stats.filter((stat) => stat.risk === "at_risk" || stat.risk === "warning");
  const totalAllowance = stats.reduce((sum, stat) => sum + (stat.bunkAllowance ?? 0), 0);
  const needsRecovery = stats.filter((stat) => stat.recoveryClasses !== null && stat.recoveryClasses > 0);
  const upcomingDays = events
    .filter((event) => new Date(event.starts_at).getTime() > now)
    .slice(0, 5);

  return (
    <>
      <PageHeader
        eyebrow={`${greeting()} · ${formatDate(new Date().toISOString())}`}
        title={`${greeting()}, ${displayName}.`}
        subtitle={semester ? `${semester.name}${semester.institution ? ` · ${semester.institution}` : ""}` : "Set up your semester to get started."}
        actions={<>
          <Link className="btn" href="/calendar"><CalendarDays size={14} /> Calendar</Link>
          <Link className="btn" href="/onboarding"><Plus size={14} /> Set up semester</Link>
          <Link className="btn btn-primary" href="/academic"><Sparkles size={14} /> Import timetable</Link>
        </>}
      />

      {offlineView && (
        <div className="alert alert-warning" style={{ marginBottom: 14 }}>
          <span>Showing your last synchronised data from this device{lastSyncedAt ? ` (${new Date(lastSyncedAt).toLocaleString()})` : ""}. Changes made while offline are queued.</span>
        </div>
      )}

      {loading ? <LoadingState /> : error ? <ErrorState message={error} retry={() => void refresh()} /> : !semester ? (
        <Panel>
          <EmptyState
            icon={<GraduationCap size={20} />}
            title="Your workspace is ready for a semester"
            description="Add a semester, your courses and a timetable. Attendly will only show numbers that come from your own records."
            action={<Link className="btn btn-primary" href="/onboarding">Start onboarding <ArrowRight size={14} /></Link>}
          />
        </Panel>
      ) : (
        <div className="stack">
          <div className="stat-grid">
            <StatCard label="Overall attendance" value={overall?.percent === null || !overall ? "—" : `${overall.percent}%`} foot={overall && overall.percent !== null ? `${overall.present} of ${overall.counted} counted classes` : "No confirmed marks yet"} icon={<Activity size={16} />} progress={overall?.percent ?? 0} tone={(overall?.percent ?? 0) >= semester.attendance_target ? "success" : "danger"} />
            <StatCard label="Safe to miss" value={stats.length === 0 ? "—" : totalAllowance} foot={stats.length === 0 ? "Add courses first" : "Total across courses · check per course"} icon={<Sparkles size={16} />} />
            <StatCard label="Courses at risk" value={atRisk.length} foot={atRisk.length ? "See recovery suggestions below" : "All courses on track"} icon={<TriangleAlert size={16} />} tone={atRisk.length ? "danger" : "success"} />
            <StatCard label="Today's classes" value={todaySessions.length} foot={todaySessions.length ? "Mark them below" : "Nothing scheduled today"} icon={<CalendarDays size={16} />} />
          </div>

          <AcademicOverview />

          <div className="dash-grid">
            <Panel
              eyebrow="The day ahead"
              title="Today's schedule"
              action={<Link className="btn btn-sm btn-ghost" href="/calendar?view=day">Full calendar <ArrowRight size={13} /></Link>}
            >
              {todayEvents.length === 0 ? (
                <EmptyState icon={<CalendarDays size={20} />} title="No classes scheduled today" description="Your timetable sessions, exams and one-off events will appear here." action={<Link className="btn btn-soft btn-sm" href="/calendar">Open calendar</Link>} />
              ) : (
                <div className="stack" style={{ gap: 0 }}>
                  {todayEvents.map((event) => {
                    const session = todaySessions.find((item) => item.event.id === event.id);
                    const course = courses.find((item) => item.id === event.course_id);
                    return (
                      <div className="list-row" key={event.id}>
                        <span className="color-bar" style={{ background: course?.color ?? "var(--accent)" }} />
                        <div className="list-row-main">
                          <strong>{event.title}</strong>
                          <small>{formatTime(event.starts_at)} – {formatTime(event.ends_at)}{event.location ? ` · ${event.location}` : ""} · {event.kind}</small>
                        </div>
                        {session ? <AttendanceMarker session={session} compact /> : <span className="badge">{event.status}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>

            <div className="stack">
              <Panel eyebrow="At a glance" title="Attendance health">
                <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                  <ProgressRing value={overall?.percent ?? null} size={112} label="Overall attendance" />
                  <div style={{ flex: 1 }}>
                    <div className="muted" style={{ fontSize: 11.5 }}>Target</div>
                    <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.04em" }}>{semester.attendance_target}%</div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>
                      {overall?.unmarked ?? 0} unmarked · {overall?.excused ?? 0} excused · {overall?.cancelled ?? 0} cancelled
                    </div>
                  </div>
                </div>
                <hr className="divider" />
                {needsRecovery.length === 0 ? (
                  <div className="alert alert-success" style={{ fontSize: 11.5 }}><ShieldCheck size={15} /> No recovery needed right now.</div>
                ) : (
                  <div className="stack" style={{ gap: 8 }}>
                    {needsRecovery.slice(0, 3).map((stat) => (
                      <div key={stat.courseId} className="alert alert-warning" style={{ fontSize: 11.5 }}>
                        <span><strong>{courses.find((c) => c.id === stat.courseId)?.name ?? "Course"}</strong>: attend {stat.recoveryClasses} more in a row to reach {stat.target}%.</span>
                      </div>
                    ))}
                    <Link className="btn btn-sm btn-soft" href="/attendance?tab=recovery">Recovery calculator <ArrowRight size={13} /></Link>
                  </div>
                )}
              </Panel>

              <Panel eyebrow="Quick actions" title="Get things done">
                <div className="stack" style={{ gap: 7 }}>
                  <Link className="btn btn-block" style={{ justifyContent: "flex-start" }} href="/attendance"><Activity size={14} /> Mark attendance</Link>
                  <Link className="btn btn-block" style={{ justifyContent: "flex-start" }} href="/courses"><BookOpen size={14} /> Manage courses</Link>
                  <Link className="btn btn-block" style={{ justifyContent: "flex-start" }} href="/productivity"><ClipboardList size={14} /> Add assignment</Link>
                  <Link className="btn btn-block" style={{ justifyContent: "flex-start" }} href="/groups"><Users size={14} /> Study groups</Link>
                </div>
              </Panel>
            </div>
          </div>

          <div className="dash-grid">
            <Panel eyebrow="Your semester" title="Course attendance" action={<Link className="btn btn-sm btn-ghost" href="/courses">All courses <ArrowRight size={13} /></Link>}>
              {courses.length === 0 ? (
                <EmptyState icon={<BookOpen size={20} />} title="No courses yet" description="Add a course to start tracking attendance per subject." action={<Link className="btn btn-primary btn-sm" href="/onboarding">Add courses</Link>} />
              ) : (
                <div className="stack" style={{ gap: 0 }}>
                  {courses.map((course) => {
                    const stat = stats.find((item) => item.courseId === course.id);
                    return (
                      <div className="list-row" key={course.id}>
                        <span className="color-bar" style={{ background: course.color }} />
                        <div className="list-row-main">
                          <Link href={`/courses/${course.id}`}><strong>{course.name}</strong></Link>
                          <small>{stat?.percent === null || !stat ? "No confirmed marks" : `${stat.percent}% · ${stat.present}/${stat.counted} attended`} · target {stat?.target ?? semester.attendance_target}%</small>
                          <div style={{ marginTop: 7 }}><ProgressBar value={stat?.percent ?? 0} tone={stat?.risk === "at_risk" ? "danger" : stat?.risk === "warning" ? "warning" : "success"} /></div>
                        </div>
                        <RiskBadge risk={stat?.risk ?? "unknown"} />
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>

            <div className="stack">
              <Panel eyebrow="Coming up" title="Exams & deadlines">
                {upcomingExams.length === 0 && dueAssignments.length === 0 ? (
                  <EmptyState title="Nothing due soon" description="Upcoming exams and assignment deadlines appear here." />
                ) : (
                  <div className="stack" style={{ gap: 0 }}>
                    {upcomingExams.map((exam) => (
                      <div className="list-row" key={exam.id}>
                        <span className="badge badge-danger">Exam</span>
                        <div className="list-row-main"><strong>{exam.title}</strong><small>{relativeDayLabel(exam.starts_at)} · {formatTime(exam.starts_at)}</small></div>
                        <span className="badge mono">{countdownLabel(exam.starts_at)}</span>
                      </div>
                    ))}
                    {dueAssignments.map((item) => (
                      <div className="list-row" key={item.id}>
                        <span className="badge badge-accent">Due</span>
                        <div className="list-row-main"><strong>{item.title}</strong><small>{relativeDayLabel(item.due_at as string)}</small></div>
                        <span className="badge mono">{countdownLabel(item.due_at as string)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel eyebrow="Academic calendar" title="Next on the calendar">
                {upcomingDays.length === 0 ? (
                  <EmptyState title="No upcoming events" description="Generate sessions from your timetable or add an event." />
                ) : (
                  <div className="stack" style={{ gap: 0 }}>
                    {upcomingDays.map((event) => (
                      <div className="list-row" key={event.id}>
                        <span className="badge">{event.kind}</span>
                        <div className="list-row-main"><strong>{event.title}</strong><small>{relativeDayLabel(event.starts_at)} · {formatTime(event.starts_at)}</small></div>
                      </div>
                    ))}
                  </div>
                )}
                {academicDays.length > 0 && <p className="faint" style={{ fontSize: 10.5, marginTop: 10 }}>{academicDays.length} academic day classification{academicDays.length === 1 ? "" : "s"} configured.</p>}
              </Panel>
            </div>
          </div>

          <Panel eyebrow="Recent activity" title="Schedule history" action={<Link className="btn btn-sm btn-ghost" href="/calendar?tab=history">View all <ArrowRight size={13} /></Link>}>
            {changeLog.length === 0 ? (
              <p className="muted" style={{ fontSize: 12 }}>No schedule changes recorded yet. Edits and cancellations are logged here.</p>
            ) : (
              <div className="stack" style={{ gap: 0 }}>
                {changeLog.slice(0, 5).map((item) => (
                  <div className="list-row" key={item.id}>
                    <span className="badge badge-info">{item.action.replace(".", " ")}</span>
                    <div className="list-row-main"><strong>{String((item.after_data as Record<string, unknown> | null)?.title ?? item.action)}</strong><small>{new Date(item.created_at).toLocaleString()}</small></div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <p className="faint" style={{ fontSize: 10.5, textAlign: "center", marginTop: 6 }}>
            Confirmed marks only. Unmarked classes are never treated as absences; cancelled and rescheduled originals are excluded.
          </p>
        </div>
      )}
    </>
  );
}
