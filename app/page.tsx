import Link from "next/link";
import {
  Activity, ArrowRight, BellRing, CalendarDays, CheckCircle2, ClipboardList,
  Download, GraduationCap, Layers3, LockKeyhole, ShieldCheck, Smartphone, Sparkles, Users,
} from "lucide-react";
import { PublicNav, PublicFooter } from "@/components/public-nav";

export default function LandingPage() {
  return (
    <div className="landing">
      <PublicNav />
      <main>
        <section className="landing-wrap hero">
          <div>
            <span className="badge badge-accent"><Sparkles size={12} /> Academic workspace for students</span>
            <h1>Your entire academic life, organised around <em>one intelligent calendar.</em></h1>
            <p className="lead">
              Attendly brings your timetable, attendance, safe-bunk allowance, assignments, exams and study groups together.
              Mark a class on your phone and see it on the web instantly — the same account, the same records.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary" href="/signup">Create your free account <ArrowRight size={15} /></Link>
              <Link className="btn" href="/features">Explore features</Link>
            </div>
            <div className="hero-note"><ShieldCheck size={13} /> Your attendance is private. Groups share schedules, not marks.</div>
          </div>

          <div className="hero-preview" aria-label="Illustration of the Attendly dashboard">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span className="eyebrow">Your academic overview</span>
              <span className="badge">Interface preview</span>
            </div>
            <div className="hero-preview-grid">
              <div className="preview-tile wide">
                <span className="preview-label">Attendance</span>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
                  <div style={{ width: 58, height: 58, borderRadius: "50%", border: "7px solid var(--accent-soft)", borderTopColor: "var(--accent)", display: "grid", placeItems: "center", fontSize: 10, color: "var(--muted)" }}>your %</div>
                  <div style={{ flex: 1 }}>
                    <div className="preview-bar"><span style={{ width: "72%" }} /></div>
                    <div className="preview-bar"><span style={{ width: "58%", background: "var(--accent-2)" }} /></div>
                    <span className="faint" style={{ fontSize: 9.5 }}>Calculated from your confirmed marks</span>
                  </div>
                </div>
              </div>
              <div className="preview-tile"><span className="preview-label">Courses</span><div className="preview-number" style={{ color: "var(--accent-2)" }}>—</div><span className="faint" style={{ fontSize: 9.5 }}>Added by you</span></div>
              <div className="preview-tile wide">
                <span className="preview-label">Today&rsquo;s schedule</span>
                <div className="preview-rows">
                  <div className="preview-row"><i /> Timetable session · time &amp; room from your schedule</div>
                  <div className="preview-row"><i style={{ background: "var(--accent)" }} /> Another class · mark present or absent</div>
                  <div className="preview-row"><i style={{ background: "var(--warning)" }} /> Deadline or exam · from your calendar</div>
                </div>
              </div>
              <div className="preview-tile"><span className="preview-label">Safe to miss</span><div className="preview-number" style={{ color: "var(--accent)" }}>—</div><span className="faint" style={{ fontSize: 9.5 }}>Only when data is sufficient</span></div>
            </div>
            <p className="faint" style={{ fontSize: 10, marginTop: 12, textAlign: "center" }}>Illustration only — real figures appear after you add your semester and mark classes.</p>
          </div>
        </section>

        <section className="section">
          <div className="landing-wrap">
            <div className="section-head">
              <span className="eyebrow">One source of truth</span>
              <h2>Built around the way a semester actually works.</h2>
              <p>Weekly timetable rules stay separate from dated class sessions. Cancelled classes, reschedules, holidays and extra classes are handled explicitly, so your attendance percentage never quietly drifts.</p>
            </div>
            <div className="feature-grid">
              <Feature icon={<CalendarDays size={19} />} title="Intelligent academic calendar" text="Month, week, day, agenda and semester views. Academic day classifications, exam windows, holidays, special working days and one-off events." />
              <Feature icon={<Activity size={19} />} title="Honest attendance engine" text="Attended ÷ conducted. Unmarked is never an absence, cancelled classes are excluded, and a rescheduled class is counted once at its replacement." />
              <Feature icon={<Sparkles size={19} />} title="Bunk, recovery & what-if" text="See how many classes you can safely miss, how many consecutive classes recover your target, and how future scenarios change the result." />
              <Feature icon={<Users size={19} />} title="Groups without oversharing" text="Share timetables, academic calendars and approved schedule changes. Personal attendance, analytics and bunk calculations stay private under RLS." />
              <Feature icon={<ClipboardList size={19} />} title="Assignments, exams & notes" text="Track deadlines, exam countdowns and course notes. Exams are calendar events; everything ties back to the same semester." />
              <Feature icon={<Smartphone size={19} />} title="Web, Android & installable PWA" text="One Supabase account across the website and the Android app. Install Attendly on desktop or mobile and keep cached schedules available offline." />
            </div>
          </div>
        </section>

        <section className="section">
          <div className="landing-wrap demo-grid">
            <div className="surface demo-panel">
              <span className="eyebrow">Attendance tracking</span>
              <h3 style={{ fontSize: 19, margin: "8px 0 12px" }}>Every number is derived from your own marks.</h3>
              <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.7, marginBottom: 16 }}>
                Mark a class present, absent, excused or leave it unmarked. Attendly recalculates immediately, using the same deterministic rules on the website and the mobile app.
              </p>
              <div className="demo-row"><span>Present + absent classes</span><strong>Counted</strong></div>
              <div className="demo-row"><span>Unmarked classes</span><strong>Not counted</strong></div>
              <div className="demo-row"><span>Cancelled / rescheduled originals</span><strong>Excluded</strong></div>
              <div className="demo-row"><span>Excused classes</span><strong>Conducted, excluded from %</strong></div>
              <div className="demo-row"><span>Extra classes</span><strong>Counted once</strong></div>
            </div>
            <div className="surface demo-panel">
              <span className="eyebrow">Smart bunk calculator</span>
              <h3 style={{ fontSize: 19, margin: "8px 0 12px" }}>Know before you skip.</h3>
              <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.7 }}>
                The calculator solves the largest number of further absences that still keeps you at or above your target — per course, with hour-based mode where needed.
              </p>
              <div className="step-list">
                <div className="step">Reads confirmed attendance, not guesses.</div>
                <div className="step">Uses your semester target or a per-course override.</div>
                <div className="step">Shows the result of missing one more class.</div>
                <div className="step">Reports &ldquo;not enough data&rdquo; rather than a misleading allowance.</div>
              </div>
              <Link className="btn btn-soft" href="/signup" style={{ marginTop: 20 }}>Try it with your data <ArrowRight size={14} /></Link>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="landing-wrap">
            <div className="section-head">
              <span className="eyebrow">Document intelligence, with a human in control</span>
              <h2>Bring in your timetable. Review everything.</h2>
              <p>Upload a CSV timetable or academic calendar, or store PDFs and images in your private document folder. Parsed CSV rows are presented for editing before anything is written. There is no OCR or AI extraction service in the backend yet, so PDFs and images are never silently interpreted.</p>
            </div>
            <div className="feature-grid">
              <Feature icon={<Layers3 size={19} />} title="CSV parsing with review" text="Course code, name, weekday, start, end and location are parsed locally. You correct names, times and days before confirming." />
              <Feature icon={<LockKeyhole size={19} />} title="Private document storage" text="PDFs and images go to a private bucket under your user ID. File type, size and extension are validated before upload." />
              <Feature icon={<CheckCircle2 size={19} />} title="Revised timetable diff" text="A new import is compared with your existing rules: added, removed and changed entries are shown before you apply anything." />
            </div>
          </div>
        </section>

        <section className="section">
          <div className="landing-wrap demo-grid">
            <div className="surface demo-panel">
              <span className="eyebrow">Built for every screen</span>
              <h3 style={{ fontSize: 19, margin: "8px 0 12px" }}>One account, three surfaces.</h3>
              <div className="stack" style={{ gap: 10, marginTop: 16 }}>
                <Line icon={<GraduationCap size={16} />} text="Android app — already built and deployed, using the same Supabase tables and RLS." />
                <Line icon={<Download size={16} />} text="Installable PWA — standalone display, offline fallback, update detection and an offline attendance queue." />
                <Line icon={<BellRing size={16} />} text="In-app notification centre — realtime schedule and attendance updates, with category filters." />
              </div>
            </div>
            <div className="surface demo-panel">
              <span className="eyebrow">Privacy is a database rule</span>
              <h3 style={{ fontSize: 19, margin: "8px 0 12px" }}>Not a UI promise.</h3>
              <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.7 }}>
                Attendance records are owner-scoped in Postgres through Row Level Security. Group pages query shared calendar events only; they never request another member&rsquo;s attendance. The website uses the publishable key and never holds a service-role secret.
              </p>
              <div className="alert alert-success" style={{ marginTop: 16 }}><ShieldCheck size={15} /> No testimonials, invented statistics or institutional partnerships. Just the product.</div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="landing-wrap">
            <div className="section-head">
              <span className="eyebrow">Questions</span>
              <h2>Frequently asked.</h2>
            </div>
            <div className="faq">
              <details><summary>Does Attendly replace my college&rsquo;s attendance portal?</summary><p>No. It is a personal planner: you mark your own classes and Attendly calculates from the records you create. It is not an institutional system.</p></details>
              <details><summary>Will my marks sync with the Android app?</summary><p>Yes. Both use the same Supabase project, the same user account and the same tables. A mark made on Android appears on the website and vice versa.</p></details>
              <details><summary>What happens to an unmarked class?</summary><p>Nothing is assumed. Unmarked classes stay out of the percentage denominator until you mark them, so they never become surprise absences.</p></details>
              <details><summary>Can classmates see my attendance?</summary><p>No. Group collaboration shares schedules and approved changes only. Personal attendance is protected by RLS and is never queried in a group view.</p></details>
              <details><summary>Is there an AI that reads my timetable PDF automatically?</summary><p>Not yet. There is no OCR or AI extraction service in the backend. CSV timetables are parsed locally and always reviewed by you; PDFs and images are stored privately for manual review.</p></details>
              <details><summary>Does the PWA work offline?</summary><p>The app shell and previously synchronised schedules are available offline, and attendance marks made offline are queued and reconciled when you reconnect. Private API responses are never cached in the shared service-worker cache.</p></details>
              <details><summary>Are push notifications available?</summary><p>Background push delivery is not configured because no delivery service exists in the backend. The in-app notification centre, realtime updates and optional in-tab reminders are available now.</p></details>
            </div>
          </div>
        </section>

        <section className="section" style={{ borderTop: 0 }}>
          <div className="landing-wrap">
            <div className="cta-band">
              <span className="eyebrow">Ready when you are</span>
              <h2 style={{ fontSize: 30, margin: "10px 0 12px" }}>Start with a semester. Everything else follows.</h2>
              <p className="muted" style={{ maxWidth: 500, margin: "0 auto 22px", fontSize: 13 }}>
                Add your courses, review your timetable and mark your first class. Attendly does the arithmetic.
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <Link className="btn btn-primary" href="/signup">Create your account <ArrowRight size={15} /></Link>
                <Link className="btn" href="/login">Sign in</Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <article className="feature-card">
      <span className="feature-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function Line({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12.5, color: "var(--muted)" }}>
      <span style={{ color: "var(--accent)", flex: "none", marginTop: 2 }}>{icon}</span>
      <span>{text}</span>
    </div>
  );
}
