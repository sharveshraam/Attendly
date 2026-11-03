"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell, BellRing, Database, Download, HardDriveDownload, Info, Laptop, LogOut, Moon,
  Palette, RefreshCw, ShieldCheck, Sun, Trash2, TriangleAlert, UserRound,
} from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { useTheme, type ThemePreference } from "@/components/theme-provider";
import { usePwa } from "@/components/pwa";
import { useToast } from "@/components/toast";
import { ConfirmDialog, EmptyState, Field, PageHeader, Panel, Segmented } from "@/components/ui";
import { SemesterForm } from "@/components/forms";
import { signOut } from "@/lib/auth";
import { upsertNotificationPreferences, upsertProfile } from "@/lib/data";
import { buildAttendanceCsv, buildCalendarIcs, downloadFile } from "@/lib/reports";
import {
  clearAllPrivateLocalData, clearPrivateCache, isOfflineCacheEnabled, readOps,
  setOfflineCacheEnabled, type OutboxOp,
} from "@/lib/offline";
import { safeParse, notificationPreferencesSchema, profileSchema } from "@/lib/validation";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();
  const toast = useToast();
  const { theme, setTheme } = useTheme();
  const pwa = usePwa();
  const {
    user, profile, semester, semesters, setActiveSemester, courses, events, sessions,
    preferences, refresh, conflicts, resolveConflict, pendingCount, syncNow, syncing,
    lastSyncedAt, offlineView, assignments, stats,
  } = useWorkspace();

  const [profileDraft, setProfileDraft] = useState({ display_name: "", timezone: "Asia/Kolkata" });
  const [prefsDraft, setPrefsDraft] = useState({
    daily_reminder: true, schedule_changes: true, attendance_warnings: true,
    assignment_reminders: true, reminder_time: "07:00", timezone: "Asia/Kolkata",
  });
  const [semesterForm, setSemesterForm] = useState(false);
  const [cacheEnabled, setCacheEnabled] = useState(true);
  const [localReminders, setLocalReminders] = useState(false);
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ops, setOps] = useState<OutboxOp[]>([]);

  useEffect(() => {
    setProfileDraft({ display_name: profile?.display_name ?? "", timezone: profile?.timezone ?? "Asia/Kolkata" });
  }, [profile]);
  useEffect(() => {
    if (preferences) {
      setPrefsDraft({
        daily_reminder: preferences.daily_reminder,
        schedule_changes: preferences.schedule_changes,
        attendance_warnings: preferences.attendance_warnings,
        assignment_reminders: preferences.assignment_reminders,
        reminder_time: preferences.reminder_time.slice(0, 5),
        timezone: preferences.timezone,
      });
    }
  }, [preferences]);
  useEffect(() => {
    setCacheEnabled(isOfflineCacheEnabled());
    try { setLocalReminders(localStorage.getItem("attendly.local-reminders.v1") === "1"); } catch { /* ignore */ }
    setOps(readOps());
  }, [conflicts, pendingCount, syncing]);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    const parsed = safeParse(profileSchema, profileDraft);
    if (!parsed.ok) return toast.error(parsed.error);
    setBusy(true);
    try {
      await upsertProfile(user.id, parsed.data);
      toast.success("Profile updated.");
      await refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not save your profile.");
    } finally {
      setBusy(false);
    }
  }

  async function savePreferences() {
    if (!user) return;
    const parsed = safeParse(notificationPreferencesSchema, prefsDraft);
    if (!parsed.ok) return toast.error(parsed.error);
    setBusy(true);
    try {
      await upsertNotificationPreferences({ user_id: user.id, ...parsed.data });
      toast.success("Notification preferences saved.");
      await refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not save preferences.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleLocalReminders() {
    if (!("Notification" in window)) return toast.error("This browser does not support the Notification API.");
    if (localReminders) {
      try { localStorage.setItem("attendly.local-reminders.v1", "0"); } catch { /* ignore */ }
      setLocalReminders(false);
      toast.info("In-tab reminders turned off.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return toast.error("Notification permission was not granted. No reminders will be shown.");
    try { localStorage.setItem("attendly.local-reminders.v1", "1"); } catch { /* ignore */ }
    setLocalReminders(true);
    toast.success("In-tab reminders enabled. They work only while Attendly is open.");
  }

  async function handleSignOut() {
    const { error } = await signOut();
    if (error) return toast.error(error.message);
    router.push("/");
    router.refresh();
  }

  function exportData() {
    if (semester) {
      downloadFile(`attendly-attendance-${semester.start_date}.csv`, buildAttendanceCsv(semester, sessions.map((s) => ({ event: s.event, record: s.record, courseName: courses.find((c) => c.id === s.event.course_id)?.name ?? "" }))), "text/csv");
      downloadFile("attendly-calendar.ics", buildCalendarIcs(events), "text/calendar");
      toast.success("Attendance CSV and calendar ICS downloaded.");
    }
  }

  return (
    <>
      <PageHeader eyebrow="Account & preferences" title="Settings" subtitle={user?.email ?? "Your Attendly account"} actions={<Link className="btn" href="/analytics">Reports & exports</Link>} />

      <div className="dash-grid">
        <div className="stack">
          <Panel eyebrow="Account" title="Profile">
            <form className="stack" onSubmit={saveProfile}>
              <Field label="Display name"><input className="input" value={profileDraft.display_name} onChange={(e) => setProfileDraft({ ...profileDraft, display_name: e.target.value })} placeholder="Your name" /></Field>
              <Field label="Timezone" hint="Used for class times and reminders."><input className="input" value={profileDraft.timezone} onChange={(e) => setProfileDraft({ ...profileDraft, timezone: e.target.value })} placeholder="Asia/Kolkata" /></Field>
              <div className="faint" style={{ fontSize: 10.5 }}>Email: {user?.email ?? "—"} · Account ID is never shared with group members.</div>
              <button className="btn btn-primary" disabled={busy} type="submit"><UserRound size={14} /> Save profile</button>
            </form>
          </Panel>

          <Panel eyebrow="Academics" title="Semester & targets" action={<button className="btn btn-sm" onClick={() => setSemesterForm(true)}>{semester ? "Edit" : "Create"}</button>}>
            {semesters.length === 0 ? (
              <EmptyState title="No semester yet" description="Create a semester to configure your academic year." action={<button className="btn btn-primary btn-sm" onClick={() => setSemesterForm(true)}>Create semester</button>} />
            ) : (
              <div className="stack">
                <Field label="Active semester"><select className="select" value={semester?.id ?? ""} onChange={(e) => setActiveSemester(e.target.value)}>{semesters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
                <div className="card-flat">
                  <div className="muted" style={{ fontSize: 11.5 }}>{semester?.institution || "No institution set"} · {semester?.start_date} → {semester?.end_date ?? "rolling"}</div>
                  <div style={{ display: "flex", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
                    <span className="badge badge-accent">Default target {semester?.attendance_target ?? 75}%</span>
                    <span className="badge">{semester?.prediction_mode ?? "rolling"} predictions</span>
                    <span className="badge">{courses.length} courses</span>
                  </div>
                </div>
                <Link className="btn btn-sm" href="/courses">Manage per-course targets <Palette size={13} /></Link>
              </div>
            )}
          </Panel>

          <Panel eyebrow="Appearance" title="Theme">
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <Segmented<ThemePreference> label="Theme preference" value={theme} onChange={setTheme} options={[
                { value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "system", label: "System" },
              ]} />
              <span className="muted" style={{ fontSize: 11.5 }}>{theme === "light" ? <Sun size={13} /> : theme === "dark" ? <Moon size={13} /> : <Laptop size={13} />} Preference is saved in this browser.</span>
            </div>
          </Panel>

          <Panel eyebrow="Notifications" title="Preferences">
            <div className="stack" style={{ gap: 10 }}>
              {([
                ["daily_reminder", "Daily class reminder"],
                ["schedule_changes", "Schedule changes"],
                ["attendance_warnings", "Attendance warnings"],
                ["assignment_reminders", "Assignment deadlines"],
              ] as const).map(([key, label]) => (
                <label className="checkbox" key={key}>
                  <input type="checkbox" checked={prefsDraft[key]} onChange={(e) => setPrefsDraft({ ...prefsDraft, [key]: e.target.checked })} />
                  <span style={{ fontSize: 12.5 }}>{label}</span>
                </label>
              ))}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Reminder time"><input className="input" type="time" value={prefsDraft.reminder_time} onChange={(e) => setPrefsDraft({ ...prefsDraft, reminder_time: e.target.value })} /></Field>
                <Field label="Timezone"><input className="input" value={prefsDraft.timezone} onChange={(e) => setPrefsDraft({ ...prefsDraft, timezone: e.target.value })} /></Field>
              </div>
              <button className="btn btn-primary" disabled={busy} onClick={() => void savePreferences()}><Bell size={14} /> Save preferences</button>
              <hr className="divider" />
              <div className="alert">
                <BellRing size={15} />
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: 11.5 }}>In-tab reminders</strong>
                  <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>Shows a browser notification 15 minutes before your next class while Attendly is open. Remote/background push is not configured because no sender service exists.</p>
                </div>
                <button className="btn btn-sm" onClick={() => void toggleLocalReminders()}>{localReminders ? "Turn off" : "Enable"}</button>
              </div>
            </div>
          </Panel>
        </div>

        <div className="stack">
          <Panel eyebrow="Privacy" title="Local data & offline cache">
            <div className="stack" style={{ gap: 10 }}>
              <label className="checkbox">
                <input type="checkbox" checked={cacheEnabled} onChange={(e) => {
                  setCacheEnabled(e.target.checked);
                  setOfflineCacheEnabled(e.target.checked);
                  toast.info(e.target.checked ? "Offline cache enabled." : "Offline cache disabled and cleared.");
                }} />
                <span style={{ fontSize: 12.5 }}>Keep a private offline cache of previously synced schedules and attendance on this device.</span>
              </label>
              <div className="alert" style={{ fontSize: 11.5 }}>
                <ShieldCheck size={15} /> Cached data is scoped to your user ID in browser storage and is cleared on sign-out. The service worker caches static assets only — never API responses, tokens or attendance payloads. On a shared device, disable the cache and sign out.
              </div>
              <div className="card-flat">
                <div className="muted" style={{ fontSize: 11.5 }}>Sync status: <strong style={{ color: "var(--text)" }}>{offlineView ? "offline view" : syncing ? "syncing" : "up to date"}</strong> · {pendingCount} queued operation(s){lastSyncedAt ? ` · last synced ${new Date(lastSyncedAt).toLocaleString()}` : ""}</div>
                <button className="btn btn-sm" style={{ marginTop: 10 }} disabled={syncing} onClick={() => void syncNow()}><RefreshCw size={13} /> Sync now</button>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-sm" onClick={() => { clearPrivateCache(); toast.success("Cached workspace data cleared."); }}>Clear cache</button>
                <button className="btn btn-sm btn-danger" onClick={() => setClearAllOpen(true)}><Trash2 size={13} /> Clear all local data</button>
              </div>
            </div>
          </Panel>

          <Panel eyebrow="Sync" title="Conflict resolution">
            {conflicts.length === 0 && ops.filter((op) => op.state === "failed").length === 0 ? (
              <EmptyState title="No conflicts" description="If another device changes the same attendance mark while you are offline, it appears here for your decision. Nothing is silently overwritten." />
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                {conflicts.map((op) => (
                  <div className="card-flat" key={op.id}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}><TriangleAlert size={14} style={{ color: "var(--warning)" }} /><strong style={{ fontSize: 12 }}>Attendance conflict</strong></div>
                    <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>Your offline mark was <strong>{op.status}</strong>. The server has a newer value. Choose which to keep.</p>
                    <div style={{ display: "flex", gap: 7, marginTop: 8 }}>
                      <button className="btn btn-sm btn-primary" onClick={() => void resolveConflict(op.id, "keep-local")}>Keep my offline mark</button>
                      <button className="btn btn-sm" onClick={() => void resolveConflict(op.id, "discard-local")}>Keep server value</button>
                    </div>
                  </div>
                ))}
                {ops.filter((op) => op.state === "failed").map((op) => (
                  <div className="alert alert-warning" key={op.id} style={{ fontSize: 11 }}>Queued mark failed to sync {op.attempts} time(s): {op.lastError ?? "unknown error"}. It will retry on reconnect.</div>
                ))}
              </div>
            )}
            {ops.length > 0 && <p className="faint" style={{ fontSize: 10.5, marginTop: 10 }}>{ops.length} operation(s) in the local outbox. Each has a deterministic id so retries never create duplicates.</p>}
          </Panel>

          <Panel eyebrow="Progressive Web App" title="Installation & offline">
            <div className="stack muted" style={{ gap: 8, fontSize: 11.5 }}>
              <div>• Service worker: {pwa.swSupported ? "supported and registered" : "unsupported in this browser"}.</div>
              <div>• Install state: {pwa.installed ? "running as an installed app" : pwa.installable ? "install prompt available" : "not installed"}.</div>
              <div>• Offline fallback, static-shell caching, update detection and an attendance outbox are implemented.</div>
              <div>• iOS: use Share → Add to Home Screen. iOS does not expose an install prompt event and restricts background push.</div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              {pwa.installable && <button className="btn btn-sm btn-primary" onClick={() => void pwa.promptInstall()}><Download size={13} /> Install Attendly</button>}
              {pwa.iosGuidance && <span className="badge badge-info">iOS: Share → Add to Home Screen</span>}
            </div>
          </Panel>

          <Panel eyebrow="Your data" title="Export & account">
            <div className="stack" style={{ gap: 8 }}>
              <button className="btn btn-block" onClick={exportData}><HardDriveDownload size={14} /> Export attendance CSV + calendar ICS</button>
              <Link className="btn btn-block" href="/analytics">Full reports (PDF / CSV / ICS)</Link>
              <div className="alert alert-warning" style={{ marginTop: 6 }}>
                <Info size={15} />
                <span style={{ fontSize: 11.5 }}><strong>Account deletion is not available yet.</strong> Deleting an auth user requires a privileged server-side operation; no such RPC or Edge Function exists in the backend, and no service-role key is used by this website. Export your data and sign out instead. A safe deletion flow needs an authorised backend addition.</span>
              </div>
              <button className="btn btn-danger btn-block" onClick={() => void handleSignOut()}><LogOut size={14} /> Sign out</button>
            </div>
          </Panel>

          <Panel eyebrow="Summary" title="Current workspace">
            <div className="muted" style={{ fontSize: 11.5, display: "grid", gap: 6 }}>
              <div><Database size={13} style={{ display: "inline", verticalAlign: "middle" }} /> {courses.length} courses · {events.length} calendar entries · {assignments.length} assignments</div>
              <div>{sessions.length} class sessions · {stats.length} attendance summaries</div>
              <div>{semesters.length} semester(s) · {preferences ? "notification preferences saved" : "notification preferences not yet saved"}</div>
            </div>
          </Panel>
        </div>
      </div>

      {semesterForm && user && (
        <SemesterForm userId={user.id} initial={semester ?? undefined} onSaved={(row) => { setActiveSemester(row.id); void refresh(); }} onClose={() => setSemesterForm(false)} />
      )}
      {clearAllOpen && (
        <ConfirmDialog
          title="Clear all local data?"
          message="This removes cached workspace data, device-local notes, assignment priorities and the pending offline outbox from this browser. Synced Supabase data is not deleted. Unsynchronised attendance marks would be lost."
          confirmLabel="Clear local data"
          danger
          onConfirm={() => { clearAllPrivateLocalData(); setOps([]); setClearAllOpen(false); toast.success("Local data cleared."); }}
          onCancel={() => setClearAllOpen(false)}
        />
      )}
    </>
  );
}
