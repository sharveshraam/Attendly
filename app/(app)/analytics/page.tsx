"use client";

import { useMemo } from "react";
import { BarChart3, Download, FileText, Printer, TrendingUp } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel, RiskBadge } from "@/components/ui";
import { BarChart, Heatmap, TrendChart, type TrendPoint } from "@/components/charts";
import { addDays, eventMinutes, toDateKey } from "@/lib/dates";
import {
  buildAttendanceCsv, buildCalendarIcs, buildPrintableReport, buildSemesterSummaryCsv,
  downloadFile, openPrintableReport,
} from "@/lib/reports";

export default function AnalyticsPage() {
  const {
    semester, courses, sessions, events, assignments, stats, overall, records,
    loading, error, refresh,
  } = useWorkspace();

  const trend = useMemo<TrendPoint[]>(() => {
    const ordered = sessions
      .filter((session) => session.record && session.record.status !== "unmarked")
      .sort((a, b) => a.event.starts_at.localeCompare(b.event.starts_at));
    return ordered
      .reduce<{ points: TrendPoint[]; present: number; counted: number }>((acc, session) => {
        const present = acc.present + (session.record?.status === "present" ? 1 : 0);
        const counted = acc.counted + (session.record?.status === "present" || session.record?.status === "absent" ? 1 : 0);
        return {
          present,
          counted,
          points: [...acc.points, {
            label: new Date(session.event.starts_at).toLocaleDateString(undefined, { day: "numeric", month: "short" }),
            value: counted === 0 ? null : Math.round((present / counted) * 1000) / 10,
          }],
        };
      }, { points: [], present: 0, counted: 0 })
      .points.slice(-30);
  }, [sessions]);

  const weekly = useMemo(() => {
    const weeks: { label: string; value: number | null }[] = [];
    for (let offset = 7; offset >= 0; offset -= 1) {
      const start = addDays(new Date(), -offset * 7);
      const end = addDays(start, 7);
      const weekSessions = sessions.filter((session) => {
        const time = new Date(session.event.starts_at).getTime();
        return time >= start.getTime() && time < end.getTime() && (session.record?.status === "present" || session.record?.status === "absent");
      });
      const present = weekSessions.filter((s) => s.record?.status === "present").length;
      weeks.push({
        label: start.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
        value: weekSessions.length ? Math.round((present / weekSessions.length) * 1000) / 10 : null,
      });
    }
    return weeks;
  }, [sessions]);

  const heatDays = useMemo(() => {
    const days: { date: string; percent: number | null; title: string }[] = [];
    for (let offset = 89; offset >= 0; offset -= 1) {
      const date = addDays(new Date(), -offset);
      const key = toDateKey(date);
      const daySessions = sessions.filter(
        (s) => toDateKey(new Date(s.event.starts_at)) === key && (s.record?.status === "present" || s.record?.status === "absent"),
      );
      const present = daySessions.filter((s) => s.record?.status === "present").length;
      days.push({
        date: key,
        percent: daySessions.length ? Math.round((present / daySessions.length) * 1000) / 10 : null,
        title: `${key}: ${daySessions.length ? `${present}/${daySessions.length} classes attended` : "no marked classes"}`,
      });
    }
    return days;
  }, [sessions]);

  const riskRanking = useMemo(
    () => [...stats].sort((a, b) => (a.percent ?? 101) - (b.percent ?? 101)),
    [stats],
  );

  function exportAttendanceCsv() {
    if (!semester) return;
    const rows = sessions.map((session) => ({
      event: session.event,
      record: session.record,
      courseName: courses.find((course) => course.id === session.event.course_id)?.name ?? "",
    }));
    const csv = buildAttendanceCsv(semester, rows);
    downloadFile(`attendly-attendance-${semester.start_date}.csv`, csv, "text/csv");
  }

  function exportSummaryCsv() {
    if (!semester) return;
    const csv = buildSemesterSummaryCsv(semester, courses.map((course) => {
      const stat = stats.find((item) => item.courseId === course.id);
      return {
        course,
        percent: stat?.percent ?? null,
        target: stat?.target ?? semester.attendance_target,
        conducted: stat?.conducted ?? 0,
        attended: stat?.present ?? 0,
        missed: stat?.absent ?? 0,
        unmarked: stat?.unmarked ?? 0,
        allowance: stat?.bunkAllowance ?? null,
      };
    }));
    downloadFile(`attendly-semester-summary-${semester.id.slice(0, 8)}.csv`, csv, "text/csv");
  }

  function exportCalendar() {
    downloadFile("attendly-calendar.ics", buildCalendarIcs(events), "text/calendar");
  }

  function printReport() {
    if (!semester) return;
    const html = buildPrintableReport({
      semester,
      generatedAt: new Date().toISOString(),
      assignments,
      courses: courses.map((course) => {
        const stat = stats.find((item) => item.courseId === course.id);
        return {
          course,
          percent: stat?.percent ?? null,
          target: stat?.target ?? semester.attendance_target,
          conducted: stat?.conducted ?? 0,
          attended: stat?.present ?? 0,
          missed: stat?.absent ?? 0,
          unmarked: stat?.unmarked ?? 0,
        };
      }),
    });
    openPrintableReport(html);
  }

  return (
    <>
      <PageHeader
        eyebrow="Reports & insights"
        title="Analytics"
        subtitle="Charts and exports built only from your own confirmed data"
        actions={<>
          <button className="btn" onClick={exportAttendanceCsv} disabled={!semester}><Download size={14} /> Attendance CSV</button>
          <button className="btn" onClick={exportCalendar} disabled={!semester}><FileText size={14} /> Calendar .ics</button>
          <button className="btn btn-primary" onClick={printReport} disabled={!semester}><Printer size={14} /> PDF report</button>
        </>}
      />

      {loading ? <LoadingState rows={5} /> : error ? <ErrorState message={error} retry={() => void refresh()} /> : !semester ? (
        <Panel><EmptyState icon={<BarChart3 size={20} />} title="Nothing to analyse yet" description="Set up a semester and mark some classes first." /></Panel>
      ) : (
        <div className="stack">
          <div className="stat-grid">
            <div className="surface stat"><div className="stat-top">Overall attendance</div><div className="stat-value mono">{overall?.percent === null || !overall ? "—" : `${overall.percent}%`}</div><div className="stat-foot">Confirmed marks only</div></div>
            <div className="surface stat"><div className="stat-top">Marked sessions</div><div className="stat-value mono">{records.length}</div><div className="stat-foot">{overall?.unmarked ?? 0} still unmarked</div></div>
            <div className="surface stat"><div className="stat-top">Courses at risk</div><div className="stat-value mono">{stats.filter((s) => s.risk === "at_risk").length}</div><div className="stat-foot">Below target</div></div>
            <div className="surface stat"><div className="stat-top">Total class minutes</div><div className="stat-value mono">{Math.round(events.filter((e) => e.kind === "class").reduce((sum, e) => sum + eventMinutes(e.starts_at, e.ends_at), 0) / 60)}h</div><div className="stat-foot">Scheduled sessions</div></div>
          </div>

          <div className="dash-grid">
            <Panel eyebrow="Trend" title="Attendance over time" action={<TrendingUp size={15} className="faint" />}>
              <TrendChart points={trend} target={semester.attendance_target} label="Overall attendance trend from confirmed marks" />
            </Panel>
            <Panel eyebrow="Weekly" title="Last 8 weeks">
              <TrendChart points={weekly} target={semester.attendance_target} height={180} label="Weekly attendance percentage" />
            </Panel>
          </div>

          <div className="dash-grid">
            <Panel eyebrow="Comparison" title="Course attendance">
              <BarChart
                target={semester.attendance_target}
                label="Attendance by course"
                items={courses.map((course) => ({
                  label: course.name,
                  value: stats.find((s) => s.courseId === course.id)?.percent ?? null,
                  color: course.color,
                }))}
              />
            </Panel>
            <Panel eyebrow="Risk" title="Courses needing attention">
              {riskRanking.length === 0 ? <EmptyState title="No courses" description="Add courses to see a risk ranking." /> : (
                <div className="stack" style={{ gap: 0 }}>
                  {riskRanking.map((stat) => (
                    <div className="list-row" key={stat.courseId}>
                      <span className="color-bar" style={{ background: courses.find((c) => c.id === stat.courseId)?.color }} />
                      <div className="list-row-main">
                        <strong>{courses.find((c) => c.id === stat.courseId)?.name ?? "Course"}</strong>
                        <small>{stat.percent === null ? "No confirmed marks" : `${stat.percent}%`} · target {stat.target}% · safe to miss {stat.bunkAllowance ?? "—"}</small>
                      </div>
                      <RiskBadge risk={stat.risk} />
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <Panel eyebrow="Last 90 days" title="Attendance calendar heatmap">
            <Heatmap days={heatDays} label="Daily attendance heatmap for the last 90 days" />
            <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap", fontSize: 10.5 }} className="muted">
              <span><i className="dot" style={{ background: "var(--surface-3)", display: "inline-block", marginRight: 5 }} /> No marked classes</span>
              <span><i className="dot" style={{ background: "var(--danger)", display: "inline-block", marginRight: 5 }} /> Below 50%</span>
              <span><i className="dot" style={{ background: "var(--warning)", display: "inline-block", marginRight: 5 }} /> 50–69%</span>
              <span><i className="dot" style={{ background: "var(--accent-2)", display: "inline-block", marginRight: 5 }} /> 70–84%</span>
              <span><i className="dot" style={{ background: "var(--success)", display: "inline-block", marginRight: 5 }} /> 85%+</span>
            </div>
          </Panel>

          <Panel eyebrow="Exports" title="Take your data with you">
            <div className="stack" style={{ gap: 8 }}>
              <div className="list-row"><div className="list-row-main"><strong>Attendance CSV</strong><small>Every dated session with its private mark, note and timestamp.</small></div><button className="btn btn-sm" onClick={exportAttendanceCsv}>Download</button></div>
              <div className="list-row"><div className="list-row-main"><strong>Semester summary CSV</strong><small>Per-course totals, targets and safe-bunk allowances.</small></div><button className="btn btn-sm" onClick={exportSummaryCsv}>Download</button></div>
              <div className="list-row"><div className="list-row-main"><strong>Academic calendar (.ics)</strong><small>Import your scheduled events into another calendar app.</small></div><button className="btn btn-sm" onClick={exportCalendar}>Download</button></div>
              <div className="list-row"><div className="list-row-main"><strong>PDF attendance report</strong><small>Opens a print-ready report; choose &ldquo;Save as PDF&rdquo; in your browser.</small></div><button className="btn btn-sm" onClick={printReport}>Open</button></div>
            </div>
            <p className="faint" style={{ fontSize: 10.5, marginTop: 12 }}>Exports are generated in your browser from real rows. No numbers are fabricated or rounded up to a target.</p>
          </Panel>
        </div>
      )}
    </>
  );
}
