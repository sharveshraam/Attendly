"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Activity, Calculator, Info, RotateCcw, Sparkles, TrendingUp } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { EmptyState, ErrorState, Field, LoadingState, PageHeader, Panel, RiskBadge, Segmented } from "@/components/ui";
import { AttendanceMarker } from "@/components/attendance-marker";
import { BarChart } from "@/components/charts";
import { summarize, simulate, percentAfterMissingOne } from "@/lib/attendance/engine";
import { eventMinutes, formatDate, formatTime } from "@/lib/dates";
import type { AttendanceSummary } from "@/lib/attendance/engine";

type Tab = "mark" | "bunk" | "recovery" | "whatif" | "history";

function AttendanceContent() {
  const params = useSearchParams();
  const initial = (params.get("tab") as Tab) || "mark";
  const [tab, setTab] = useState<Tab>(["mark", "bunk", "recovery", "whatif", "history"].includes(initial) ? initial : "mark");
  const { semester, courses, sessions, stats, overall, loading, error, refresh } = useWorkspace();
  const [courseFilter, setCourseFilter] = useState("all");
  const [showUnmarkedOnly, setShowUnmarkedOnly] = useState(false);
  const [scenarioCourse, setScenarioCourse] = useState("");
  const [scenario, setScenario] = useState({ attendFuture: 0, missFuture: 0, extraAttended: 0, cancelFuture: 0 });

  function courseSummary(courseId: string): AttendanceSummary | null {
    const course = courses.find((item) => item.id === courseId);
    if (!course) return null;
    const courseSessions = sessions.filter((session) => session.event.course_id === courseId);
    const future = courseSessions.filter(
      (session) => session.event.status === "scheduled" && new Date(session.event.starts_at).getTime() > Date.now(),
    );
    const mode = course.calculation_mode;
    const futureUnits = mode === "hours"
      ? future.reduce((sum, session) => sum + eventMinutes(session.event.starts_at, session.event.ends_at), 0)
      : future.length;
    return summarize({
      sessions: courseSessions.map((session) => ({
        status: session.record?.status ?? "unmarked",
        lifecycle: session.event.status,
        scheduledMinutes: eventMinutes(session.event.starts_at, session.event.ends_at),
        attendedMinutes: session.record?.attended_minutes ?? null,
      })),
      targetPercent: course.attendance_target ?? semester?.attendance_target ?? 75,
      mode,
      futureUnits: future.length > 0 || courseSessions.length > 0 ? futureUnits : null,
    });
  }

  const filteredSessions = useMemo(() => sessions.filter((session) => {
    if (courseFilter !== "all" && session.event.course_id !== courseFilter) return false;
    if (showUnmarkedOnly && (session.record?.status ?? "unmarked") !== "unmarked") return false;
    return true;
  }), [sessions, courseFilter, showUnmarkedOnly]);

  const markedHistory = sessions
    .filter((session) => session.record && session.record.status !== "unmarked")
    .sort((a, b) => b.event.starts_at.localeCompare(a.event.starts_at));

  const selectedCourseId = scenarioCourse || courses[0]?.id || "";
  const base = selectedCourseId ? courseSummary(selectedCourseId) : null;
  const whatIf = base ? simulate(base, scenario) : null;
  const leastFlexible = [...stats].filter((s) => s.bunkAllowance !== null).sort((a, b) => (a.bunkAllowance ?? 0) - (b.bunkAllowance ?? 0))[0];

  return (
    <>
      <PageHeader
        eyebrow="Attendance engine"
        title="Attendance"
        subtitle="Confirmed marks only · unmarked classes never become absences automatically"
        actions={<Link className="btn" href="/calendar"><Activity size={14} /> Calendar</Link>}
      />
      <div style={{ marginBottom: 14 }}>
        <Segmented<Tab>
          label="Attendance tools"
          value={tab}
          onChange={setTab}
          options={[
            { value: "mark", label: "Mark classes" },
            { value: "bunk", label: "Bunk calculator" },
            { value: "recovery", label: "Recovery" },
            { value: "whatif", label: "What-if" },
            { value: "history", label: "History" },
          ]}
        />
      </div>

      {loading ? <LoadingState rows={5} /> : error ? <ErrorState message={error} retry={() => void refresh()} /> : !semester ? (
        <Panel><EmptyState title="No semester yet" description="Set up a semester before tracking attendance." action={<Link className="btn btn-primary" href="/onboarding">Start onboarding</Link>} /></Panel>
      ) : (
        <>
          {tab === "mark" && (
            <Panel
              eyebrow="Your classes"
              title="Mark attendance"
              action={<label className="checkbox muted" style={{ fontSize: 11.5 }}><input type="checkbox" checked={showUnmarkedOnly} onChange={(e) => setShowUnmarkedOnly(e.target.checked)} /> Unmarked only</label>}
            >
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <select className="select" style={{ maxWidth: 240 }} value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} aria-label="Filter by course">
                  <option value="all">All courses</option>
                  {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
                </select>
                <span className="badge">{filteredSessions.length} session(s)</span>
                {sessions.some((s) => s.pendingSync) && <span className="badge badge-warning">Some marks are queued offline</span>}
              </div>
              {filteredSessions.length === 0 ? (
                <EmptyState title="No classes to show" description="Generate sessions from your timetable rules or add a class in the calendar." action={<Link className="btn btn-primary btn-sm" href="/calendar?tab=timetable">Timetable</Link>} />
              ) : (
                <div className="table-wrap">
                  <table className="data">
                    <thead><tr><th>Date</th><th>Class</th><th>Status</th><th>Mark</th></tr></thead>
                    <tbody>
                      {filteredSessions.slice(0, 120).map((session) => (
                        <tr key={session.event.id}>
                          <td>{formatDate(session.event.starts_at)}<div className="faint" style={{ fontSize: 10 }}>{formatTime(session.event.starts_at)}</div></td>
                          <td>
                            <strong>{session.event.title}</strong>
                            <div className="faint" style={{ fontSize: 10 }}>{courses.find((c) => c.id === session.event.course_id)?.name ?? "No course"} · {session.event.status}</div>
                          </td>
                          <td><span className={`badge ${session.record?.status === "present" ? "badge-success" : session.record?.status === "absent" ? "badge-danger" : ""}`}>{session.record?.status ?? "unmarked"}{session.pendingSync ? " · pending" : ""}</span></td>
                          <td><AttendanceMarker session={session} compact /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="faint" style={{ fontSize: 10.5, marginTop: 12 }}>Showing up to 120 sessions. Use the course filter for large semesters.</p>
            </Panel>
          )}

          {tab === "bunk" && (
            <div className="stack">
              <div className="stat-grid">
                <div className="surface stat"><div className="stat-top">Overall attendance</div><div className="stat-value mono">{overall?.percent === null || !overall ? "—" : `${overall.percent}%`}</div><div className="stat-foot">Target {semester.attendance_target}%</div></div>
                <div className="surface stat"><div className="stat-top">Confirmed classes</div><div className="stat-value mono">{overall?.counted ?? 0}</div><div className="stat-foot">{overall?.present ?? 0} attended · {overall?.absent ?? 0} missed</div></div>
                <div className="surface stat"><div className="stat-top">If you miss one more</div><div className="stat-value mono">{overall ? (percentAfterMissingOne(overall) ?? "—") : "—"}{overall && percentAfterMissingOne(overall) !== null ? "%" : ""}</div><div className="stat-foot">Projected overall percentage</div></div>
                <div className="surface stat"><div className="stat-top">Least flexibility</div><div className="stat-value" style={{ fontSize: 15 }}>{leastFlexible ? courses.find((c) => c.id === leastFlexible.courseId)?.name ?? "Course" : "—"}</div><div className="stat-foot">{leastFlexible?.bunkAllowance ?? "—"} class(es) in hand</div></div>
              </div>
              <Panel eyebrow="Per course" title="Safe bunk allowance">
                {stats.length === 0 ? <EmptyState title="No courses" description="Add courses first." /> : (
                  <div className="table-wrap">
                    <table className="data">
                      <thead><tr><th>Course</th><th>Attendance</th><th>Target</th><th>Safe to miss</th><th>After one more absence</th><th>Risk</th></tr></thead>
                      <tbody>
                        {stats.map((stat) => {
                          const summary = courseSummary(stat.courseId);
                          const afterOne = summary ? percentAfterMissingOne(summary) : null;
                          return (
                            <tr key={stat.courseId}>
                              <td>{courses.find((c) => c.id === stat.courseId)?.name ?? "Course"}</td>
                              <td>{stat.percent === null ? "—" : `${stat.percent}%`}</td>
                              <td>{stat.target}%</td>
                              <td><strong>{stat.bunkAllowance === null ? "Not enough data" : stat.bunkAllowance}</strong></td>
                              <td>{afterOne === null ? "—" : `${afterOne}%`}</td>
                              <td><RiskBadge risk={stat.risk} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="alert" style={{ marginTop: 14, fontSize: 11.5 }}>
                  <Info size={15} /> Allowance is the largest number of further absences that keeps <code>attended / (conducted + x) ≥ target</code>. It is reported as &ldquo;not enough data&rdquo; when schedule information is incomplete or the target is unreachable.
                </div>
              </Panel>
            </div>
          )}

          {tab === "recovery" && (
            <div className="stack">
              <Panel eyebrow="Planning" title="Attendance recovery">
                {stats.length === 0 ? <EmptyState title="No courses" description="Add courses first." /> : (
                  <div className="table-wrap">
                    <table className="data">
                      <thead><tr><th>Course</th><th>Now</th><th>Target</th><th>Consecutive classes needed</th><th>If all remaining attended</th><th>If all remaining missed</th></tr></thead>
                      <tbody>
                        {stats.map((stat) => (
                          <tr key={stat.courseId}>
                            <td>{courses.find((c) => c.id === stat.courseId)?.name ?? "Course"}</td>
                            <td>{stat.percent === null ? "—" : `${stat.percent}%`}</td>
                            <td>{stat.target}%</td>
                            <td><strong>{stat.recoveryClasses === null ? "Not recoverable / unknown" : stat.recoveryClasses}</strong></td>
                            <td>{stat.projectedBestPercent === null ? "—" : `${stat.projectedBestPercent}%`}</td>
                            <td>{stat.projectedWorstPercent === null ? "—" : `${stat.projectedWorstPercent}%`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="alert alert-warning" style={{ marginTop: 14, fontSize: 11.5 }}>
                  <RotateCcw size={15} /> Projections use your currently scheduled future classes{` (${semester.prediction_mode} mode)`}. They are estimates, not guarantees; extra classes and cancellations change them.
                </div>
              </Panel>
              <Panel eyebrow="Visual" title="Projected best case by course">
                <BarChart
                  target={semester.attendance_target}
                  label="Projected attendance if every remaining scheduled class is attended"
                  items={stats.map((stat) => ({
                    label: courses.find((c) => c.id === stat.courseId)?.name ?? "Course",
                    value: stat.projectedBestPercent,
                    color: courses.find((c) => c.id === stat.courseId)?.color,
                  }))}
                />
              </Panel>
            </div>
          )}

          {tab === "whatif" && (
            <Panel eyebrow="Simulation" title="What-if simulator" action={<span className="badge badge-accent"><Calculator size={12} /> Never changes real records</span>}>
              <div className="stack" style={{ gap: 14 }}>
                <div className="alert"><Sparkles size={15} /> Scenarios are computed from your confirmed marks and scheduled future classes. Nothing here is written to Supabase.</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
                  <Field label="Course"><select className="select" value={selectedCourseId} onChange={(e) => setScenarioCourse(e.target.value)}>{courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select></Field>
                  <Field label="Attend future classes"><input className="input" type="number" min="0" value={scenario.attendFuture} onChange={(e) => setScenario({ ...scenario, attendFuture: Math.max(0, Number(e.target.value) || 0) })} /></Field>
                  <Field label="Miss future classes"><input className="input" type="number" min="0" value={scenario.missFuture} onChange={(e) => setScenario({ ...scenario, missFuture: Math.max(0, Number(e.target.value) || 0) })} /></Field>
                  <Field label="Extra classes attended"><input className="input" type="number" min="0" value={scenario.extraAttended} onChange={(e) => setScenario({ ...scenario, extraAttended: Math.max(0, Number(e.target.value) || 0) })} /></Field>
                  <Field label="Cancel future classes"><input className="input" type="number" min="0" value={scenario.cancelFuture} onChange={(e) => setScenario({ ...scenario, cancelFuture: Math.max(0, Number(e.target.value) || 0) })} /></Field>
                </div>
                {base && (
                  <p className="muted" style={{ fontSize: 11.5 }}>
                    Baseline: {base.percent === null ? "no confirmed marks" : `${base.percent}%`} · {base.futureUnits === null ? "future schedule unknown" : `${base.futureUnits} future ${base.mode === "hours" ? "minutes" : "classes"}`} · target {base.targetPercent}%
                  </p>
                )}
                {whatIf && (
                  whatIf.valid ? (
                    <div className="stat-grid">
                      <div className="surface stat"><div className="stat-top">Projected attendance</div><div className="stat-value mono">{whatIf.percent === null ? "—" : `${whatIf.percent}%`}</div><div className="stat-foot">{whatIf.meetsTarget === null ? "No data" : whatIf.meetsTarget ? "At or above target" : "Below target"}</div></div>
                      <div className="surface stat"><div className="stat-top">Counted units</div><div className="stat-value mono">{whatIf.countedUnits}</div><div className="stat-foot">{whatIf.attendedUnits} attended</div></div>
                      <div className="surface stat"><div className="stat-top">Safe to miss after</div><div className="stat-value mono">{whatIf.bunkAllowance ?? "—"}</div><div className="stat-foot">Further absences</div></div>
                      <div className="surface stat"><div className="stat-top">Recovery needed</div><div className="stat-value mono">{whatIf.recoveryClasses ?? "—"}</div><div className="stat-foot">Consecutive classes</div></div>
                    </div>
                  ) : (
                    <div className="alert alert-warning"><Info size={15} /> {whatIf.reason}</div>
                  )
                )}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-sm" onClick={() => setScenario({ attendFuture: 0, missFuture: 1, extraAttended: 0, cancelFuture: 0 })}>Miss one class</button>
                  <button className="btn btn-sm" onClick={() => setScenario({ attendFuture: 0, missFuture: 3, extraAttended: 0, cancelFuture: 0 })}>Miss three</button>
                  <button className="btn btn-sm" onClick={() => setScenario({ attendFuture: base?.futureUnits ?? 0, missFuture: 0, extraAttended: 0, cancelFuture: 0 })}>Attend everything</button>
                  <button className="btn btn-sm" onClick={() => setScenario({ attendFuture: 0, missFuture: 0, extraAttended: 2, cancelFuture: 0 })}>Two extra classes</button>
                  <button className="btn btn-sm btn-ghost" onClick={() => setScenario({ attendFuture: 0, missFuture: 0, extraAttended: 0, cancelFuture: 0 })}>Reset</button>
                </div>
              </div>
            </Panel>
          )}

          {tab === "history" && (
            <Panel eyebrow="Audit" title="Attendance history" action={<Link className="btn btn-sm btn-ghost" href="/analytics">Charts <TrendingUp size={13} /></Link>}>
              {markedHistory.length === 0 ? <EmptyState title="No marks yet" description="Mark a class in the first tab to build your history." /> : (
                <div className="table-wrap">
                  <table className="data">
                    <thead><tr><th>Date</th><th>Course</th><th>Session</th><th>Status</th><th>Marked at</th><th>Note</th></tr></thead>
                    <tbody>
                      {markedHistory.slice(0, 200).map((session) => (
                        <tr key={session.event.id}>
                          <td>{formatDate(session.event.starts_at)}</td>
                          <td>{courses.find((c) => c.id === session.event.course_id)?.name ?? "—"}</td>
                          <td>{session.event.title}</td>
                          <td><span className={`badge ${session.record?.status === "present" ? "badge-success" : session.record?.status === "absent" ? "badge-danger" : "badge-warning"}`}>{session.record?.status}</span></td>
                          <td>{session.record?.marked_at ? new Date(session.record.marked_at).toLocaleString() : "—"}</td>
                          <td>{session.record?.note ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}
        </>
      )}
    </>
  );
}

export default function AttendancePage() {
  return (
    <Suspense fallback={<div className="skeleton" style={{ height: 500, borderRadius: 16 }} />}>
      <AttendanceContent />
    </Suspense>
  );
}
