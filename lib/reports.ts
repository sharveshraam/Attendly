/** Real exports built from the user's own data (no fabricated numbers). */
import { formatDate, formatDateLong } from "./dates.ts";
import type { AssignmentRow, AttendanceRecordRow, CalendarEventRow, CourseRow, SemesterRow } from "./types.ts";

export function escapeCsv(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: (string | number | null)[][]): string {
  return rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
}

export interface AttendanceExportRow {
  event: CalendarEventRow;
  record: AttendanceRecordRow | null;
  courseName: string;
}

export function buildAttendanceCsv(
  semester: SemesterRow,
  rows: AttendanceExportRow[],
): string {
  const header = [
    "date", "start", "end", "course", "course_code", "event", "event_kind", "event_status",
    "attendance_status", "attended_minutes", "note", "marked_at",
  ];
  const body = rows.map(({ event, record, courseName }) => [
    new Date(event.starts_at).toISOString().slice(0, 10),
    new Date(event.starts_at).toISOString().slice(11, 16),
    new Date(event.ends_at).toISOString().slice(11, 16),
    courseName,
    "",
    event.title,
    event.kind,
    event.status,
    record?.status ?? "unmarked",
    record?.attended_minutes ?? "",
    record?.note ?? "",
    record?.marked_at ?? "",
  ]);
  return toCsv([header, ...body]);
}

export function buildSemesterSummaryCsv(
  semester: SemesterRow,
  courses: { course: CourseRow; percent: number | null; target: number; conducted: number; attended: number; missed: number; unmarked: number; allowance: number | null }[],
): string {
  return toCsv([
    ["semester", "institution", "start_date", "end_date", "default_target"],
    [semester.name, semester.institution ?? "", semester.start_date, semester.end_date ?? "", semester.attendance_target],
    [],
    ["course", "code", "target", "percent", "conducted", "attended", "missed", "unmarked", "safe_bunk_allowance"],
    ...courses.map((item) => [
      item.course.name, item.course.code ?? "", item.target, item.percent ?? "",
      item.conducted, item.attended, item.missed, item.unmarked, item.allowance ?? "",
    ]),
  ]);
}

function icsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function buildCalendarIcs(events: CalendarEventRow[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Attendly//Academic Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@attendly`,
      `DTSTAMP:${icsDate(event.created_at)}`,
      `DTSTART:${icsDate(event.starts_at)}`,
      `DTEND:${icsDate(event.ends_at)}`,
      `SUMMARY:${escapeCsv(event.title).replace(/"/g, "")}`,
    );
    if (event.location) lines.push(`LOCATION:${event.location}`);
    if (event.description) lines.push(`DESCRIPTION:${event.description.replace(/[\r\n]+/g, " ")}`);
    if (event.status === "cancelled") lines.push("STATUS:CANCELLED");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadFile(filename: string, content: string, mime: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Browser "Save as PDF" print view. Uses only the current user's real data. */
export function buildPrintableReport(args: {
  semester: SemesterRow;
  courses: { course: CourseRow; percent: number | null; target: number; conducted: number; attended: number; missed: number; unmarked: number }[];
  assignments: AssignmentRow[];
  generatedAt: string;
}): string {
  const { semester, courses, assignments, generatedAt } = args;
  const rows = courses
    .map(
      (item) => `<tr>
        <td>${escapeHtml(item.course.name)}</td><td>${escapeHtml(item.course.code ?? "—")}</td>
        <td>${item.target}%</td><td>${item.percent === null ? "—" : `${item.percent}%`}</td>
        <td>${item.conducted}</td><td>${item.attended}</td><td>${item.missed}</td><td>${item.unmarked}</td>
      </tr>`,
    )
    .join("");
  const assignmentRows = assignments
    .slice(0, 40)
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.title)}</td><td>${item.due_at ? formatDate(item.due_at) : "—"}</td><td>${escapeHtml(item.status)}</td></tr>`,
    )
    .join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Attendly report — ${escapeHtml(semester.name)}</title>
<style>
  body{font:13px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#172033;margin:36px}
  h1{font-size:24px;letter-spacing:-.03em;margin:0 0 4px} h2{font-size:15px;margin:28px 0 10px}
  .meta{color:#69758d;font-size:11px;margin-bottom:20px}
  table{width:100%;border-collapse:collapse;margin-top:8px} th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #e3e7f0;font-size:11.5px}
  th{font-size:9.5px;text-transform:uppercase;letter-spacing:.08em;color:#69758d;background:#f6f7fb}
  footer{margin-top:32px;font-size:10px;color:#69758d}
  @page{margin:16mm}
</style></head><body>
<h1>Attendly · Semester attendance report</h1>
<div class="meta">${escapeHtml(semester.name)}${semester.institution ? ` · ${escapeHtml(semester.institution)}` : ""} · ${semester.start_date} to ${semester.end_date ?? "rolling"} · Generated ${formatDateLong(generatedAt)}</div>
<h2>Course summary</h2>
<table><thead><tr><th>Course</th><th>Code</th><th>Target</th><th>Attendance</th><th>Conducted</th><th>Attended</th><th>Missed</th><th>Unmarked</th></tr></thead><tbody>${rows || '<tr><td colspan="8">No courses yet.</td></tr>'}</tbody></table>
<h2>Assignments</h2>
<table><thead><tr><th>Title</th><th>Due</th><th>Status</th></tr></thead><tbody>${assignmentRows || '<tr><td colspan="3">No assignments yet.</td></tr>'}</tbody></table>
<footer>Calculated from confirmed attendance marks only. Cancelled classes, rescheduled originals, unmarked sessions and excused sessions are excluded from the percentage denominator. Projections are estimates, not guarantees.</footer>
<script>window.addEventListener('load',function(){setTimeout(function(){window.print()},250)})</script>
</body></html>`;
}

export function openPrintableReport(html: string): void {
  if (typeof window === "undefined") return;
  const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
