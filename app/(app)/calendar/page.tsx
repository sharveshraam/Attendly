"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Clock3,
  FileUp, History, Layers3, Plus, RotateCcw, Sparkles, Trash2, Undo2,
} from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { useToast } from "@/components/toast";
import {
  ConfirmDialog, EmptyState, ErrorState, Field, LoadingState, Modal, PageHeader, Panel, Segmented,
} from "@/components/ui";
import { EventForm, TimetableRuleForm } from "@/components/forms";
import { TimetableImport } from "@/components/timetable-import";
import { AttendanceMarker } from "@/components/attendance-marker";
import {
  createEvents, deleteEvent, deleteTimetableRule, logScheduleChange, updateEvent, upsertAcademicDays,
} from "@/lib/data";
import { findConflicts, generateSessions, sessionKey } from "@/lib/schedule";
import {
  MONTHS, WEEKDAYS, addDays, formatDate, formatRange, formatTime, isToday,
  monthGrid, toDateKey, weekDays, addMonths, eachDateKey,
} from "@/lib/dates";
import { safeParse, academicDaySchema } from "@/lib/validation";
import type { AcademicDayKind, CalendarEventRow } from "@/lib/types";

type View = "month" | "week" | "day" | "agenda" | "semester";
type Tab = "calendar" | "timetable" | "uploads" | "history";

function CalendarContent() {
  const params = useSearchParams();
  const initialTab = (params.get("tab") as Tab) || "calendar";
  const initialView = (params.get("view") as View) || "month";
  const {
    semester, courses, events, rules, academicDays, changeLog, sessions, user,
    loading, error, refresh,
  } = useWorkspace();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>(["calendar", "timetable", "uploads", "history"].includes(initialTab) ? initialTab : "calendar");
  const [view, setView] = useState<View>(["month", "week", "day", "agenda", "semester"].includes(initialView) ? initialView : "month");
  const [anchor, setAnchor] = useState(new Date());
  const [selected, setSelected] = useState<CalendarEventRow | null>(null);
  const [eventForm, setEventForm] = useState<{ initial?: CalendarEventRow; defaultStart?: string } | null>(null);
  const [ruleForm, setRuleForm] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CalendarEventRow | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newStart, setNewStart] = useState("");
  const [dayForm, setDayForm] = useState(false);
  const [dayDraft, setDayDraft] = useState({ day: toDateKey(new Date()), kind: "holiday" as AcademicDayKind, title: "" });
  const [busy, setBusy] = useState(false);

  const eventsForDate = useMemo(() => {
    const map = new Map<string, CalendarEventRow[]>();
    for (const event of events) {
      const key = toDateKey(new Date(event.starts_at));
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [events]);
  const dayKinds = useMemo(() => new Map(academicDays.map((day) => [day.day, day])), [academicDays]);

  const generated = useMemo(() => {
    if (!semester || rules.length === 0) return { sessions: [], conflicts: [] };
    const existingKeys = new Set(
      events.filter((event) => event.kind === "class" && event.course_id).map((event) => sessionKey(event.course_id as string, event.starts_at)),
    );
    const sessionsToCreate = generateSessions({ semester, rules, courses, academicDays, existingKeys });
    return { sessions: sessionsToCreate, conflicts: findConflicts(sessionsToCreate) };
  }, [semester, rules, courses, academicDays, events]);

  function shift(direction: number) {
    setAnchor((current) => {
      if (view === "month" || view === "semester") return addMonths(current, direction);
      if (view === "week") return addDays(current, direction * 7);
      return addDays(current, direction);
    });
  }

  async function applyGeneration() {
    if (!user || !semester || generated.sessions.length === 0) return;
    setBusy(true);
    try {
      const inputs = generated.sessions.map((session) => ({
        semester_id: semester.id,
        course_id: session.courseId,
        title: session.title,
        kind: "class" as const,
        status: "scheduled" as const,
        starts_at: session.startsAt,
        ends_at: session.endsAt,
        location: session.location,
        created_by: user.id,
        source: "timetable",
        verification_status: "confirmed" as const,
      }));
      await createEvents(inputs);
      await logScheduleChange({ semester_id: semester.id, actor_id: user.id, action: "sessions.generated", after_data: { count: inputs.length } as never });
      toast.success(`${inputs.length} class sessions created. Existing sessions were not duplicated.`);
      setGenerateOpen(false);
      await refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not generate sessions.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelEvent() {
    if (!selected || !user || !semester) return;
    setBusy(true);
    try {
      await updateEvent(selected.id, { status: "cancelled" }, user.id);
      await logScheduleChange({
        event_id: selected.id, semester_id: semester.id, actor_id: user.id, action: "event.cancelled",
        before_data: { id: selected.id, status: selected.status, title: selected.title } as never,
        after_data: { id: selected.id, status: "cancelled", title: selected.title } as never,
      });
      toast.success("Class cancelled. It will be excluded from attendance calculations.");
      setSelected(null);
      await refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not cancel the class.");
    } finally {
      setBusy(false);
    }
  }

  async function rescheduleEvent(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !user || !semester || !newStart) return;
    const start = new Date(newStart);
    const duration = new Date(selected.ends_at).getTime() - new Date(selected.starts_at).getTime();
    const end = new Date(start.getTime() + duration);
    if (Number.isNaN(start.getTime()) || end <= start) return toast.error("Choose a valid new start time.");
    setBusy(true);
    try {
      await updateEvent(selected.id, { status: "rescheduled" }, user.id);
      await createEvents([{
        semester_id: semester.id,
        course_id: selected.course_id,
        title: selected.title,
        kind: selected.kind,
        status: "scheduled",
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        location: selected.location,
        description: selected.description,
        created_by: user.id,
        source: "reschedule",
        verification_status: "confirmed",
      }]);
      await logScheduleChange({
        event_id: selected.id, semester_id: semester.id, actor_id: user.id, action: "event.rescheduled",
        before_data: { id: selected.id, starts_at: selected.starts_at } as never,
        after_data: { starts_at: start.toISOString(), ends_at: end.toISOString() } as never,
      });
      toast.success("Original marked rescheduled; replacement session created. Only the replacement counts.");
      setRescheduleOpen(false);
      setSelected(null);
      await refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not reschedule.");
    } finally {
      setBusy(false);
    }
  }

  async function removeEvent() {
    if (!deleteTarget || !user || !semester) return;
    setBusy(true);
    try {
      await logScheduleChange({
        semester_id: semester.id, actor_id: user.id, action: "event.deleted",
        before_data: { id: deleteTarget.id, title: deleteTarget.title, starts_at: deleteTarget.starts_at } as never,
      });
      await deleteEvent(deleteTarget.id);
      toast.success("Calendar entry deleted.");
      setDeleteTarget(null);
      setSelected(null);
      await refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not delete the entry.");
    } finally {
      setBusy(false);
    }
  }

  async function undoChange(logId: string, eventId: string | null) {
    if (!user || !semester || !eventId) return toast.error("This change has no event to restore.");
    try {
      await updateEvent(eventId, { status: "scheduled" }, user.id);
      toast.success("Class restored to scheduled.");
      void logId;
      await refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not undo.");
    }
  }

  async function saveDay(event: React.FormEvent) {
    event.preventDefault();
    if (!semester) return;
    const parsed = safeParse(academicDaySchema, { day: dayDraft.day, kind: dayDraft.kind, title: dayDraft.title || null, notes: null });
    if (!parsed.ok) return toast.error(parsed.error);
    try {
      await upsertAcademicDays([{ semester_id: semester.id, ...parsed.data }]);
      toast.success("Academic day classification saved.");
      setDayForm(false);
      await refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not save the day.");
    }
  }

  const title = view === "month" || view === "semester"
    ? `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`
    : view === "week"
      ? `${formatDate(weekDays(anchor)[0]?.toISOString() ?? new Date().toISOString())} – ${formatDate(weekDays(anchor)[6]?.toISOString() ?? new Date().toISOString())}`
      : formatDate(anchor.toISOString());

  const semesterWeeks = useMemo(() => {
    if (!semester) return [];
    const end = semester.end_date ?? toDateKey(addMonths(new Date(semester.start_date), 4));
    const keys = eachDateKey(semester.start_date, end);
    const weeks: { label: string; total: number; classes: number; exams: number }[] = [];
    for (let i = 0; i < keys.length; i += 7) {
      const chunk = keys.slice(i, i + 7);
      const inWeek = events.filter((event) => chunk.includes(toDateKey(new Date(event.starts_at))));
      weeks.push({
        label: chunk[0] ?? "",
        total: inWeek.length,
        classes: inWeek.filter((event) => event.kind === "class").length,
        exams: inWeek.filter((event) => event.kind === "exam").length,
      });
    }
    return weeks;
  }, [semester, events]);

  return (
    <>
      <PageHeader
        eyebrow="Academic calendar"
        title="Calendar"
        subtitle={semester ? `${semester.name} · recurring rules stay separate from dated sessions` : "Set up a semester to use the calendar."}
        actions={<>
          <button className="btn" disabled={!semester || rules.length === 0} onClick={() => setGenerateOpen(true)}><Sparkles size={14} /> Generate sessions{generated.sessions.length ? ` (${generated.sessions.length})` : ""}</button>
          <button className="btn btn-primary" disabled={!semester} onClick={() => setEventForm({ defaultStart: anchor.toISOString() })}><Plus size={14} /> Add entry</button>
        </>}
      />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <Segmented<Tab>
          label="Calendar section"
          value={tab}
          onChange={setTab}
          options={[
            { value: "calendar", label: "Calendar" },
            { value: "timetable", label: "Timetable" },
            { value: "uploads", label: "Upload & review" },
            { value: "history", label: "History" },
          ]}
        />
      </div>

      {loading ? <LoadingState rows={5} /> : error ? <ErrorState message={error} retry={() => void refresh()} /> : !semester ? (
        <Panel><EmptyState icon={<CalendarDays size={20} />} title="No semester configured" description="Create a semester in onboarding first." action={<Link className="btn btn-primary" href="/onboarding">Start onboarding</Link>} /></Panel>
      ) : (
        <>
          {tab === "calendar" && (
            <>
              <div className="cal-toolbar">
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <button className="btn btn-sm" onClick={() => shift(-1)} aria-label="Previous period"><ChevronLeft size={14} /></button>
                  <strong style={{ fontSize: 14, minWidth: 160, textAlign: "center" }}>{title}</strong>
                  <button className="btn btn-sm" onClick={() => shift(1)} aria-label="Next period"><ChevronRight size={14} /></button>
                  <button className="btn btn-sm btn-ghost" onClick={() => setAnchor(new Date())}>Today</button>
                </div>
                <Segmented<View>
                  label="Calendar view"
                  value={view}
                  onChange={setView}
                  options={[
                    { value: "month", label: "Month" }, { value: "week", label: "Week" },
                    { value: "day", label: "Day" }, { value: "agenda", label: "Agenda" },
                    { value: "semester", label: "Semester" },
                  ]}
                />
              </div>

              {view === "month" && (
                <div className="cal-grid">
                  {WEEKDAYS.map((day) => <div className="cal-weekday" key={day}>{day}</div>)}
                  {monthGrid(anchor).map((date) => {
                    const key = toDateKey(date);
                    const dayEvents = (eventsForDate.get(key) ?? []).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
                    const classification = dayKinds.get(key);
                    return (
                      <div className={`cal-cell ${date.getMonth() !== anchor.getMonth() ? "outside" : ""} ${isToday(date) ? "today" : ""}`} key={key}>
                        <div className="cal-date">
                          <span>{date.getDate()}</span>
                          {classification && <span className="day-kind">{classification.kind.replace(/_/g, " ")}</span>}
                        </div>
                        {dayEvents.slice(0, 3).map((event) => (
                          <button
                            key={event.id}
                            className={`cal-event ${event.status === "cancelled" ? "cancelled" : ""} ${event.kind === "exam" ? "exam" : ""} ${event.kind === "holiday" ? "holiday" : ""}`}
                            style={{ borderLeftColor: courses.find((c) => c.id === event.course_id)?.color }}
                            onClick={() => setSelected(event)}
                          >
                            {formatTime(event.starts_at)} {event.title}
                          </button>
                        ))}
                        {dayEvents.length > 3 && <button className="cal-more" onClick={() => { setAnchor(date); setView("day"); }}>+{dayEvents.length - 3} more</button>}
                      </div>
                    );
                  })}
                </div>
              )}

              {view === "week" && (
                <div className="cal-grid">
                  {weekDays(anchor).map((date) => <div className="cal-weekday" key={toDateKey(date)}>{WEEKDAYS[date.getDay()]} {date.getDate()}</div>)}
                  {weekDays(anchor).map((date) => {
                    const key = toDateKey(date);
                    const dayEvents = eventsForDate.get(key) ?? [];
                    return (
                      <div className={`cal-cell ${isToday(date) ? "today" : ""}`} key={key} style={{ minHeight: 220 }}>
                        {dayEvents.length === 0 && <span className="faint" style={{ fontSize: 10 }}>No events</span>}
                        {dayEvents.map((event) => (
                          <button key={event.id} className={`cal-event ${event.status === "cancelled" ? "cancelled" : ""}`} onClick={() => setSelected(event)}>
                            {formatTime(event.starts_at)} {event.title}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}

              {view === "day" && (
                <Panel title={formatDate(anchor.toISOString())} eyebrow="Day view">
                  {(eventsForDate.get(toDateKey(anchor)) ?? []).length === 0 ? (
                    <EmptyState title="Nothing scheduled" description="Add a class or generate sessions from your timetable." />
                  ) : (
                    <div className="stack" style={{ gap: 0 }}>
                      {(eventsForDate.get(toDateKey(anchor)) ?? []).map((event) => {
                        const session = sessions.find((item) => item.event.id === event.id);
                        return (
                          <div className="list-row" key={event.id}>
                            <span className="color-bar" style={{ background: courses.find((c) => c.id === event.course_id)?.color ?? "var(--accent)" }} />
                            <div className="list-row-main">
                              <button style={{ background: "none", border: 0, padding: 0, textAlign: "left" }} onClick={() => setSelected(event)}><strong>{event.title}</strong></button>
                              <small>{formatRange(event.starts_at, event.ends_at)} · {event.kind} · {event.status}{event.location ? ` · ${event.location}` : ""}</small>
                            </div>
                            {session && <AttendanceMarker session={session} compact />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Panel>
              )}

              {view === "agenda" && (
                <Panel title="Upcoming agenda" eyebrow="Next 30 days">
                  {Array.from({ length: 30 }, (_, i) => addDays(anchor, i)).filter((date) => (eventsForDate.get(toDateKey(date)) ?? []).length > 0).length === 0 ? (
                    <EmptyState title="No upcoming events" description="Add classes or generate sessions from your timetable." />
                  ) : (
                    Array.from({ length: 30 }, (_, i) => addDays(anchor, i)).filter((date) => (eventsForDate.get(toDateKey(date)) ?? []).length > 0).map((date) => (
                      <div className="agenda-day" key={toDateKey(date)}>
                        <div className="agenda-date">{WEEKDAYS[date.getDay()]}<br /><strong>{date.getDate()} {MONTHS[date.getMonth()].slice(0, 3)}</strong></div>
                        <div>
                          {(eventsForDate.get(toDateKey(date)) ?? []).map((event) => (
                            <button key={event.id} className="btn btn-block btn-ghost" style={{ justifyContent: "flex-start", marginBottom: 4 }} onClick={() => setSelected(event)}>
                              <span className="badge">{formatTime(event.starts_at)}</span>
                              <span style={{ flex: 1, textAlign: "left" }}>{event.title}</span>
                              <span className={`badge ${event.kind === "exam" ? "badge-danger" : ""}`}>{event.kind}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </Panel>
              )}

              {view === "semester" && (
                <Panel title="Semester overview" eyebrow={semester.name}>
                  {semesterWeeks.length === 0 ? <EmptyState title="No semester range" description="Add semester dates." /> : (
                    <div className="table-wrap">
                      <table className="data">
                        <thead><tr><th>Week starting</th><th>Total entries</th><th>Classes</th><th>Exams</th><th>Load</th></tr></thead>
                        <tbody>
                          {semesterWeeks.map((week) => (
                            <tr key={week.label}>
                              <td>{week.label}</td><td>{week.total}</td><td>{week.classes}</td><td>{week.exams}</td>
                              <td><div className="progress" style={{ width: 120 }}><span style={{ width: `${Math.min(100, week.total * 4)}%` }} /></div></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Panel>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                <button className="btn btn-sm" onClick={() => setDayForm(true)}><CalendarDays size={13} /> Classify academic day</button>
                <button className="btn btn-sm btn-ghost" onClick={() => setTab("timetable")}><Layers3 size={13} /> Weekly rules ({rules.length})</button>
                <button className="btn btn-sm btn-ghost" onClick={() => setTab("uploads")}><FileUp size={13} /> Upload timetable</button>
              </div>
              {academicDays.length > 0 && (
                <Panel title="Academic day classifications" style={{ marginTop: 14 }}>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                    {academicDays.slice(0, 30).map((day) => (
                      <span className="badge badge-warning" key={day.id}>{day.day} · {day.title || day.kind.replace(/_/g, " ")}</span>
                    ))}
                  </div>
                </Panel>
              )}
            </>
          )}

          {tab === "timetable" && (
            <Panel
              eyebrow="Weekly templates"
              title="Recurring timetable rules"
              action={<button className="btn btn-sm btn-primary" disabled={courses.length === 0} onClick={() => setRuleForm(true)}><Plus size={13} /> Add rule</button>}
            >
              <div className="alert" style={{ marginBottom: 14, fontSize: 11.5 }}>
                <Layers3 size={15} /> Rules are templates. Use <strong>Generate sessions</strong> to create dated classes. Regenerating never duplicates existing sessions.
              </div>
              {rules.length === 0 ? (
                <EmptyState title="No weekly rules" description="Add a rule or import a CSV timetable." action={<button className="btn btn-primary btn-sm" onClick={() => setTab("uploads")}>Import timetable</button>} />
              ) : (
                <div className="table-wrap">
                  <table className="data">
                    <thead><tr><th>Course</th><th>Day</th><th>Time</th><th>Location</th><th>Validity</th><th /></tr></thead>
                    <tbody>
                      {rules.map((rule) => (
                        <tr key={rule.id}>
                          <td>{courses.find((c) => c.id === rule.course_id)?.name ?? "Unknown course"}</td>
                          <td>{WEEKDAYS[rule.weekday]}</td>
                          <td>{rule.starts_at.slice(0, 5)} – {rule.ends_at.slice(0, 5)}</td>
                          <td>{rule.location ?? "—"}</td>
                          <td>{rule.valid_from ?? "—"} {rule.valid_until ? `→ ${rule.valid_until}` : ""}</td>
                          <td>
                            <button className="btn btn-ghost btn-sm" aria-label="Delete rule" onClick={async () => {
                              try { await deleteTimetableRule(rule.id); toast.success("Rule removed."); await refresh(); }
                              catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not remove rule."); }
                            }}><Trash2 size={13} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {generated.conflicts.length > 0 && (
                <div className="alert alert-warning" style={{ marginTop: 14 }}>
                  <AlertTriangle size={15} /> {generated.conflicts.length} overlapping session pair(s) detected in the generated timetable. Review the rules before generating.
                </div>
              )}
            </Panel>
          )}

          {tab === "uploads" && (
            <Panel eyebrow="Document intelligence" title="Upload, review and confirm">
              {user ? (
                <TimetableImport semesterId={semester.id} userId={user.id} courses={courses} rules={rules} onDone={() => void refresh()} />
              ) : (
                <div className="alert alert-warning">Your session is still loading. Refresh this page before uploading a document.</div>
              )}
            </Panel>
          )}

          {tab === "history" && (
            <Panel eyebrow="Audit trail" title="Schedule change history">
              {changeLog.length === 0 ? (
                <EmptyState icon={<History size={20} />} title="No changes recorded" description="Creates, edits, cancellations, reschedules and generation are logged here." />
              ) : (
                <div className="stack" style={{ gap: 0 }}>
                  {changeLog.map((item) => {
                    const before = item.before_data as Record<string, unknown> | null;
                    const after = item.after_data as Record<string, unknown> | null;
                    const eventId = (after?.id ?? before?.id ?? item.event_id) as string | null;
                    return (
                      <div className="list-row" key={item.id}>
                        <span className="badge badge-info">{item.action.replace(/[._]/g, " ")}</span>
                        <div className="list-row-main">
                          <strong>{String(after?.title ?? before?.title ?? item.action)}</strong>
                          <small>{new Date(item.created_at).toLocaleString()}{after?.count ? ` · ${String(after.count)} sessions` : ""}</small>
                        </div>
                        {item.action === "event.cancelled" && eventId && (
                          <button className="btn btn-sm btn-soft" onClick={() => void undoChange(item.id, eventId)}><Undo2 size={13} /> Undo</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          )}
        </>
      )}

      {selected && (
        <Modal title={selected.title} onClose={() => setSelected(null)}>
          <div className="stack">
            <div className="card-flat">
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span className="badge badge-accent">{selected.kind}</span>
                <span className={`badge ${selected.status === "cancelled" ? "badge-danger" : "badge-success"}`}>{selected.status}</span>
                {selected.verification_status !== "confirmed" && <span className="badge badge-warning">{selected.verification_status}</span>}
              </div>
              <p style={{ marginTop: 10, fontSize: 13 }}><Clock3 size={13} style={{ display: "inline", verticalAlign: "middle" }} /> {formatDate(selected.starts_at)} · {formatRange(selected.starts_at, selected.ends_at)}</p>
              {selected.location && <p className="muted" style={{ fontSize: 12, marginTop: 5 }}>Location: {selected.location}</p>}
              {selected.description && <p className="muted" style={{ fontSize: 12, marginTop: 5 }}>{selected.description}</p>}
              <p className="faint" style={{ fontSize: 10.5, marginTop: 8 }}>Source: {selected.source} · Course: {courses.find((c) => c.id === selected.course_id)?.name ?? "None"}</p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-sm" onClick={() => { setEventForm({ initial: selected }); setSelected(null); }}>Edit</button>
              <button className="btn btn-sm" disabled={selected.status === "cancelled"} onClick={() => { setNewStart(""); setRescheduleOpen(true); setSelected(selected); }}><RotateCcw size={13} /> Reschedule</button>
              <button className="btn btn-sm btn-soft" disabled={selected.status === "cancelled"} onClick={() => void cancelEvent()}>Cancel class</button>
              <button className="btn btn-sm btn-danger" onClick={() => { setDeleteTarget(selected); setSelected(null); }}><Trash2 size={13} /> Delete</button>
            </div>
          </div>
        </Modal>
      )}

      {rescheduleOpen && selected && (
        <Modal title="Reschedule class" onClose={() => { setRescheduleOpen(false); setSelected(null); }}>
          <form className="stack" onSubmit={rescheduleEvent}>
            <p className="muted" style={{ fontSize: 12.5 }}>The original session is marked <strong>rescheduled</strong> (excluded from attendance) and a replacement dated session is created. Only the replacement counts.</p>
            <Field label="New start"><input className="input" type="datetime-local" required value={newStart} onChange={(e) => setNewStart(e.target.value)} /></Field>
            <button className="btn btn-primary btn-block" disabled={busy} type="submit">Create replacement</button>
          </form>
        </Modal>
      )}

      {eventForm && semester && user && (
        <EventForm
          semesterId={semester.id}
          userId={user.id}
          courses={courses}
          initial={eventForm.initial}
          defaultStart={eventForm.defaultStart}
          onSaved={() => void refresh()}
          onClose={() => setEventForm(null)}
        />
      )}
      {ruleForm && semester && <TimetableRuleForm semesterId={semester.id} courses={courses} onSaved={() => void refresh()} onClose={() => setRuleForm(false)} />}

      {generateOpen && semester && (
        <Modal title="Generate class sessions" onClose={() => setGenerateOpen(false)}>
          <div className="stack">
            <p className="muted" style={{ fontSize: 12.5 }}>
              Expand {rules.length} weekly rule(s) into dated class sessions for {semester.name}. Academic day classifications (holidays, exams, closures) are honoured and existing sessions are skipped by course + start time.
            </p>
            <div className="alert alert-accent"><strong>{generated.sessions.length}</strong> new session(s) will be created.</div>
            {generated.conflicts.length > 0 && (
              <div className="alert alert-warning"><AlertTriangle size={15} /> {generated.conflicts.length} overlapping session pair(s) detected. You can still generate, then resolve conflicts manually.</div>
            )}
            {generated.sessions.length > 0 && (
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Date</th><th>Course</th><th>Time</th></tr></thead>
                  <tbody>{generated.sessions.slice(0, 8).map((session) => (
                    <tr key={`${session.courseId}-${session.startsAt}`}>
                      <td>{session.dateKey}</td><td>{session.title}</td><td>{formatTime(session.startsAt)} – {formatTime(session.endsAt)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            <button className="btn btn-primary btn-block" disabled={busy || generated.sessions.length === 0} onClick={() => void applyGeneration()}>
              {busy ? "Generating…" : `Confirm and generate ${generated.sessions.length} session(s)`}
            </button>
          </div>
        </Modal>
      )}

      {dayForm && (
        <Modal title="Classify an academic day" onClose={() => setDayForm(false)}>
          <form className="stack" onSubmit={saveDay}>
            <Field label="Date"><input className="input" type="date" required value={dayDraft.day} onChange={(e) => setDayDraft({ ...dayDraft, day: e.target.value })} /></Field>
            <Field label="Classification">
              <select className="select" value={dayDraft.kind} onChange={(e) => setDayDraft({ ...dayDraft, kind: e.target.value as AcademicDayKind })}>
                {(["instructional", "non_instructional", "holiday", "exam", "closure", "special_working"] as const).map((k) => <option key={k} value={k}>{k.replace(/_/g, " ")}</option>)}
              </select>
            </Field>
            <Field label="Label" hint="Optional"><input className="input" value={dayDraft.title} onChange={(e) => setDayDraft({ ...dayDraft, title: e.target.value })} placeholder="Republic Day" /></Field>
            <button className="btn btn-primary btn-block" type="submit">Save classification</button>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete calendar entry?"
          message={`This permanently removes ${deleteTarget.title} and any attendance marks linked to it. Use Cancel class instead if you only want to exclude it from calculations.`}
          confirmLabel="Delete entry"
          danger
          onConfirm={() => void removeEvent()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="skeleton" style={{ height: 500, borderRadius: 16 }} />}>
      <CalendarContent />
    </Suspense>
  );
}
