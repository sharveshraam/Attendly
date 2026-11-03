import type { Metadata } from "next";
import { StaticPage, PolicySection } from "@/components/public-pages";
import { CheckCircle2 } from "lucide-react";

export const metadata: Metadata = { title: "Features", description: "Everything Attendly does, and what it deliberately does not do." };

export default function FeaturesPage() {
  return (
    <StaticPage eyebrow="Product" title="Everything in one academic workspace" lead="A concrete list of what works today, built on the same Supabase project as the Android app.">
      <PolicySection title="Calendar & scheduling">
        <p>Month, week, day, agenda and semester views. Recurring weekly timetable rules are kept separate from dated class sessions. Add, edit, cancel, reschedule or add extra classes; academic day classifications and conflict detection are built in. Schedule changes are written to an audit log.</p>
      </PolicySection>
      <PolicySection title="Attendance">
        <p>Per-course and overall percentages from confirmed marks. Cancelled and rescheduled originals are excluded, unmarked sessions are never absences, excused sessions are reported separately, and extra classes count once. Class-count and hour-based modes, per-course targets, bunk allowance, recovery planning and a what-if simulator are all deterministic.</p>
      </PolicySection>
      <PolicySection title="Courses, productivity & analytics">
        <p>Course pages show attendance history, upcoming sessions, notes and assignments. Assignments, exams (as calendar events), deadlines and course notes are integrated with the calendar. Analytics include trends, course comparison, a calendar heatmap and CSV / calendar / printable reports.</p>
      </PolicySection>
      <PolicySection title="Groups">
        <p>Create groups, join with an invite code, manage members and share timetables, calendars, polls and approved schedule changes. Group views never query another member&rsquo;s attendance: the restriction is enforced by Supabase RLS, not by hiding a button.</p>
      </PolicySection>
      <PolicySection title="Assistant & notifications">
        <p>A deterministic on-device assistant answers questions about your own attendance, risk, recovery, next class and deadlines using the same calculation engine. No external AI service exists, so no data leaves your account for AI. The notification centre supports read state, filters and realtime updates.</p>
      </PolicySection>
      <PolicySection title="PWA & offline">
        <p>Installable manifest, generated icons, a static-only service worker, offline fallback, install prompt, update detection and a durable offline attendance outbox with conflict detection. Cached private data is user-scoped, optional and cleared on sign-out.</p>
      </PolicySection>
      <div className="alert alert-warning">
        <CheckCircle2 size={16} style={{ flex: "none" }} />
        <div><strong>Honest limits.</strong> No OCR/AI document extraction, no remote push sender, no server-side account deletion RPC, and no backend notes or assignment-priority columns. Those features are documented rather than faked.</div>
      </div>
    </StaticPage>
  );
}
