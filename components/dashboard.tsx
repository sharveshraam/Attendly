"use client";

import Link from "next/link";
import { useState } from "react";
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BookOpen, CalendarDays, Check, ChevronDown, CircleHelp, Command, Compass, GraduationCap, LayoutDashboard, ListTodo, LogOut, Menu, Plus, Search, Settings2, ShieldCheck, Sparkles, Users, X } from "lucide-react";

type Overview = { semester: string; courseCount: number; upcoming: number; attendance: number | null } | null;
const nav = [
  { label: "Overview", icon: LayoutDashboard, href: "/" },
  { label: "Calendar", icon: CalendarDays, href: "/calendar" },
  { label: "Attendance", icon: Activity, href: "/attendance" },
  { label: "Courses", icon: BookOpen, href: "/courses" },
  { label: "Planner", icon: ListTodo, href: "/planner" },
  { label: "Study groups", icon: Users, href: "/groups" },
];

export function Dashboard({ userName, overview, setupMissing }: { userName: string | null; overview: Overview; setupMissing: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const displayName = userName ? userName.split(/[._-]/)[0] : "there";
  const today = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date());

  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
      <div className="brand-row"><Link className="brand" href="/"><span className="brand-mark"><GraduationCap size={17} strokeWidth={2.3}/></span> attendly<span className="brand-period">.</span></Link><button aria-label="Close navigation" className="icon-button mobile-close" onClick={() => setMenuOpen(false)}><X size={17}/></button></div>
      <button className="workspace-switch" onClick={() => setNotice("Workspace switching will be available after you add or join a group.")}><span className="workspace-avatar">{overview?.semester.slice(0, 1) ?? "A"}</span><span className="workspace-label"><strong>{overview?.semester ?? "My workspace"}</strong><small>Personal space</small></span><ChevronDown size={15}/></button>
      <div className="nav-caption">Workspace</div>
      <nav className="primary-nav" aria-label="Main navigation">{nav.map(({ label, icon: Icon, href }) => <Link key={label} href={href} onClick={(event) => { if (href !== "/") { event.preventDefault(); setNotice(`${label} is next in your workspace setup. Your account and calendar foundation are ready to connect.`); } setMenuOpen(false); }} className={`nav-link ${label === "Overview" ? "selected" : ""}`}><Icon size={17} strokeWidth={1.9}/><span>{label}</span>{label === "Planner" && <span className="nav-count">0</span>}</Link>)}</nav>
      <div className="nav-caption tools-caption">Personal</div>
      <nav className="primary-nav" aria-label="Personal navigation"><button className="nav-link" onClick={() => setNotice("Your personal notes stay private to your account.")}><Compass size={17}/><span>Notes & resources</span></button><button className="nav-link" onClick={() => setNotice("Analytics will appear when you have attendance records.")}><Activity size={17}/><span>Insights</span></button></nav>
      <div className="sidebar-spacer"/>
      <div className="privacy-card"><span className="privacy-icon"><ShieldCheck size={16}/></span><div><strong>Your data stays yours</strong><small>Personal attendance is private.</small></div></div>
      <button className="profile-button" onClick={() => setNotice(userName ? `Signed in as ${userName}.` : "Create an account to save your academic workspace.")}><span className="profile-avatar">{userName ? displayName.slice(0, 1).toUpperCase() : "G"}</span><span className="profile-copy"><strong>{userName ? displayName : "Guest preview"}</strong><small>{userName ? "Personal account" : "Not signed in"}</small></span><Settings2 size={16}/></button>
    </aside>
    {menuOpen && <button aria-label="Close menu" className="mobile-scrim" onClick={() => setMenuOpen(false)}/>}
    <main className="main-panel">
      <header className="topbar"><div className="topbar-left"><button className="icon-button menu-trigger" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={19}/></button><span className="breadcrumb">Workspace <span>/</span> Overview</span></div><div className="topbar-actions"><button className="search-trigger" onClick={() => setSearchOpen(true)}><Search size={15}/><span>Search anything</span><kbd><Command size={11}/> K</kbd></button><button className="help-trigger" aria-label="Help" onClick={() => setNotice("Attendly keeps shared schedules separate from your personal attendance.")}><CircleHelp size={17}/></button><span className="topbar-divider"/><button className="top-avatar" aria-label="Account" onClick={() => setNotice(userName ? `Signed in as ${userName}.` : "Create an account to save your academic workspace.")}>{userName ? displayName.slice(0, 1).toUpperCase() : "G"}</button></div></header>
      <div className="content-wrap">
        {setupMissing && <div className="setup-banner"><span><ShieldCheck size={17}/></span><div><strong>Connect your academic workspace</strong><p>Add your Supabase project details to load semesters and keep your data private.</p></div><Link href="/signup">Set up account <ArrowRight size={14}/></Link></div>}
        {notice && <div className="inline-notice" role="status"><Sparkles size={15}/><span>{notice}</span><button aria-label="Dismiss" onClick={() => setNotice("")}><X size={15}/></button></div>}
        <div className="page-heading"><div><div className="date-kicker"><span className="status-dot"/>{today}<span className="date-separator">·</span> Your academic overview</div><h1>Good morning, {displayName}<span className="greeting-period">.</span></h1><p className="heading-subtitle">A little clarity for everything on your academic plate.</p></div><button className="button button-primary new-button" onClick={() => setNotice("Set up a semester first. Then you can add courses, classes, and deadlines here.")}><Plus size={16}/> Quick add</button></div>
        <section className="stat-grid" aria-label="Semester summary">
          <article className="stat-card"><div className="stat-card-top"><span>Attendance</span><span className="stat-icon teal"><Activity size={16}/></span></div><div className="stat-value">{overview?.attendance == null ? "—" : `${overview.attendance}%`}</div><div className="stat-foot">{overview?.attendance == null ? "Confirmed classes only" : <><span className="trend-up"><ArrowUpRight size={13}/> On track</span><span>this semester</span></>}</div><div className="stat-track"><span style={{ width: `${overview?.attendance ?? 0}%` }}/></div></article>
          <article className="stat-card"><div className="stat-card-top"><span>Classes ahead</span><span className="stat-icon blue"><CalendarDays size={16}/></span></div><div className="stat-value">{overview ? overview.upcoming : "—"}</div><div className="stat-foot">{overview ? "Scheduled this semester" : "Your schedule at a glance"}</div><div className="mini-bars" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></article>
          <article className="stat-card"><div className="stat-card-top"><span>Courses</span><span className="stat-icon mint"><BookOpen size={16}/></span></div><div className="stat-value">{overview ? overview.courseCount.toString().padStart(2, "0") : "—"}</div><div className="stat-foot">{overview ? "In your current semester" : "Everything in one place"}</div><div className="course-dots"><i/><i/><i/><i/><i/><i/></div></article>
          <article className="stat-card"><div className="stat-card-top"><span>Study rhythm</span><span className="stat-icon amber"><Sparkles size={16}/></span></div><div className="stat-value">{overview ? "Building" : "—"}</div><div className="stat-foot">{overview ? "Keep showing up, one class at a time" : "Small steps make a good semester"}</div><div className="rhythm"><span/><span/><span/><span/><span/><span/><span/></div></article>
        </section>
        <section className="dashboard-grid">
          <article className="panel schedule-panel"><div className="panel-heading"><div><span className="section-overline">The day ahead</span><h2>Today’s schedule</h2></div><button className="text-link" onClick={() => setNotice("Your calendar will fill in once you add a timetable or class.")}>Full calendar <ArrowRight size={14}/></button></div>
            <div className="empty-schedule"><div className="empty-illustration"><div className="empty-cal-top"><span/><span/><span/></div><div className="empty-cal-body"><div/><div/><div/><div/><div/><div/></div><span className="empty-spark">✳</span></div><h3>{overview?.upcoming ? "Your next classes are on the way" : "A calmer week starts here"}</h3><p>Add your timetable once. Attendly will keep your classes, changes, and attendance together.</p><button className="button button-soft" onClick={() => setNotice("Timetable import is part of the next setup step. Your verified schedule will never be imported without your review.")}><Plus size={15}/> Add your timetable</button></div>
          </article>
          <article className="panel focus-panel"><div className="panel-heading"><div><span className="section-overline">Keep it manageable</span><h2>On your radar</h2></div><span className="soft-badge">This week</span></div>
            <div className="radar-empty"><span className="radar-icon"><ListTodo size={19}/></span><div><strong>No deadlines yet</strong><p>Your assignments and exams will show up here.</p></div></div>
            <div className="focus-divider"/><div className="focus-tip"><span className="tip-spark"><Sparkles size={15}/></span><div><span className="tip-label">A note for your semester</span><p>Unmarked classes stay unconfirmed. You’re always in control of your record.</p></div></div>
            <button className="focus-action" onClick={() => setNotice("Your personal attendance remains visible only to you.")}><span>How privacy works</span><ArrowRight size={14}/></button>
          </article>
        </section>
        <section className="bottom-grid"><article className="panel courses-panel"><div className="panel-heading"><div><span className="section-overline">Your semester</span><h2>Course pulse</h2></div><button className="icon-button" aria-label="Course options" onClick={() => setNotice("Course colors and targets can be personalized per semester.")}><Settings2 size={16}/></button></div><div className="course-empty"><span className="course-empty-icon"><BookOpen size={18}/></span><span><strong>{overview ? "No courses added" : "Your courses will live here"}</strong><small>Add a course to start tracking attendance.</small></span><button aria-label="Add course" onClick={() => setNotice("Create a semester to begin adding courses.")}><Plus size={16}/></button></div></article>
          <article className="panel getting-started"><div className="getting-title"><span className="section-overline">A good place to begin</span><span className="step-counter">{overview ? "1 / 3" : "0 / 3"}</span></div><h2>Make this space yours</h2><p>Set up the basics now. Your calendar and attendance will take shape as you go.</p><div className="setup-steps"><button onClick={() => setNotice("Start by naming your semester and choosing a start date. No end date is required.")}><span className={`step-check ${overview ? "done" : ""}`}>{overview ? <Check size={12}/> : "1"}</span><span><strong>Set up a semester</strong><small>Dates, courses, and your target</small></span><ArrowRight size={14}/></button><button onClick={() => setNotice("Review your timetable before anything is added to the calendar.")}><span className="step-check">2</span><span><strong>Bring in your timetable</strong><small>Review every extracted detail</small></span><ArrowRight size={14}/></button><button onClick={() => setNotice("Your personal attendance stays private, even in a shared group.")}><span className="step-check">3</span><span><strong>Invite your study group</strong><small>Share schedules, not attendance</small></span><ArrowRight size={14}/></button></div></article></section>
        <footer className="footer-note"><span>Made for a little more clarity.</span><span><ShieldCheck size={13}/> Private by design</span></footer>
      </div>
    </main>
    {searchOpen && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setSearchOpen(false); }}><div className="search-modal"><div className="search-input-row"><Search size={18}/><input autoFocus placeholder="Search your courses, classes, and notes…" aria-label="Search Attendly" onKeyDown={(e) => { if (e.key === "Escape") setSearchOpen(false); }}/><kbd>ESC</kbd></div><div className="search-empty"><span className="search-empty-icon"><Search size={19}/></span><strong>Search your academic space</strong><p>Your courses, classes, and notes will be searchable here.</p></div><div className="search-modal-footer"><span><kbd>↵</kbd> to open</span><span><kbd>ESC</kbd> to close</span></div></div></div>}
  </div>;
}

