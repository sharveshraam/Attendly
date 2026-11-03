"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity, BarChart3, Bell, BookOpen, CalendarDays, Check, ChevronDown, ClipboardList,
  Command, Home, LayoutGrid, LogOut, Menu, Moon, RefreshCw, Search, Settings2, ShieldCheck,
  Sparkles, Sun, Users, WifiOff, X, Laptop, WandSparkles,
} from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { useTheme } from "@/components/theme-provider";
import { usePwa } from "@/components/pwa";
import { useToast } from "@/components/toast";
import { CommandPalette } from "@/components/command-palette";
import { NotificationCenter } from "@/components/notification-center";
import { signOut } from "@/lib/auth";
import { clearPrivateCache } from "@/lib/offline";

const NAV = [
  { label: "Home", href: "/home", icon: Home },
  { label: "Academic structure", href: "/academic", icon: WandSparkles },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Courses", href: "/courses", icon: BookOpen },
  { label: "Attendance", href: "/attendance", icon: Activity },
  { label: "Groups", href: "/groups", icon: Users },
  { label: "Productivity", href: "/productivity", icon: ClipboardList },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "AI Assistant", href: "/assistant", icon: Sparkles },
  { label: "Settings", href: "/settings", icon: Settings2 },
] as const;

const MOBILE_NAV = [
  { label: "Home", href: "/home", icon: Home },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Attendance", href: "/attendance", icon: Activity },
  { label: "Courses", href: "/courses", icon: BookOpen },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { online } = usePwa();
  const toast = useToast();
  const {
    user, profile, semester, loading, error, refresh, syncing, pendingCount,
    conflicts, offlineView, unreadCount, syncNow, sessions,
  } = useWorkspace();

  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const activeLabel = useMemo(() => {
    if (pathname.startsWith("/courses/")) return "Course";
    const match = NAV.find((item) => pathname.startsWith(item.href));
    return match?.label ?? "Workspace";
  }, [pathname]);

  useEffect(() => { setMenuOpen(false); setProfileOpen(false); }, [pathname]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((value) => !value);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /** Honest in-tab reminders while the app is open (no remote push sender exists). */
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    let enabled = false;
    try { enabled = localStorage.getItem("attendly.local-reminders.v1") === "1"; } catch { /* ignore */ }
    if (!enabled || Notification.permission !== "granted") return;
    const now = Date.now();
    const next = sessions.find(
      (session) => session.event.status === "scheduled" && new Date(session.event.starts_at).getTime() > now,
    );
    if (!next) return;
    const target = new Date(next.event.starts_at).getTime() - 15 * 60_000;
    const delay = target - now;
    if (delay <= 0 || delay > 12 * 3_600_000) return;
    const timer = window.setTimeout(() => {
      try {
        new Notification("Class starting soon", {
          body: `${next.event.title} at ${new Date(next.event.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}${next.event.location ? ` · ${next.event.location}` : ""}`,
          tag: `attendly-${next.event.id}`,
          icon: "/icons/notification-glyph.svg",
        });
      } catch { /* ignore */ }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [sessions]);

  async function handleSignOut() {
    setSigningOut(true);
    const { error: signOutError } = await signOut();
    clearPrivateCache();
    if (signOutError) {
      toast.error(signOutError.message);
      setSigningOut(false);
      return;
    }
    toast.success("Signed out. Your synced data is safe in Supabase.");
    router.push("/");
    router.refresh();
  }

  const displayName =
    profile?.display_name ||
    (user?.user_metadata?.display_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "Student";
  const initial = displayName.slice(0, 1).toUpperCase();

  const themeIcon = theme === "light" ? <Sun size={15} /> : theme === "dark" ? <Moon size={15} /> : <Laptop size={15} />;
  const nextTheme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`} aria-label="Main navigation">
        <div className="sidebar-head">
          <Link className="brand" href="/home">
            <span className="brand-mark"><LayoutGrid size={17} /></span>
            attendly<span className="brand-dot">.</span>
          </Link>
        </div>
        <div className="sidebar-scroll">
          <div className="nav-caption">Workspace</div>
          <nav aria-label="Workspace">
            {NAV.slice(0, 7).map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || (item.href !== "/home" && pathname.startsWith(item.href));
              return (
                <Link key={item.href} className={`nav-item ${active ? "active" : ""}`} href={item.href} aria-current={active ? "page" : undefined}>
                  <Icon size={16} /> {item.label}
                  {item.href === "/groups" && conflicts.length > 0 && <span className="nav-count">{conflicts.length}</span>}
                </Link>
              );
            })}
          </nav>
          <div className="nav-caption">Tools</div>
          <nav aria-label="Tools">
            {NAV.slice(7).map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Link key={item.href} className={`nav-item ${active ? "active" : ""}`} href={item.href} aria-current={active ? "page" : undefined}>
                  <Icon size={16} /> {item.label}
                </Link>
              );
            })}
            <button className="nav-item" style={{ width: "100%", border: 0, background: "transparent" }} onClick={() => setSearchOpen(true)}>
              <Command size={16} /> Search <span className="nav-count">⌘K</span>
            </button>
          </nav>
        </div>
        <div className="sidebar-foot">
          <div className="privacy-note">
            <ShieldCheck size={15} style={{ flex: "none" }} />
            <span><strong>Private by design.</strong> Your attendance is visible only to you — groups share schedules, never marks.</span>
          </div>
          <div style={{ position: "relative" }}>
            <button className="profile-btn" aria-expanded={profileOpen} onClick={() => setProfileOpen((value) => !value)}>
              <span className="avatar">{initial}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ display: "block", fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</strong>
                <small className="faint" style={{ fontSize: 10 }}>{semester?.name ?? "No semester yet"}</small>
              </span>
              <ChevronDown size={14} className="faint" />
            </button>
            {profileOpen && (
              <div className="surface" style={{ position: "absolute", bottom: "calc(100% + 8px)", left: 0, right: 0, padding: 6, boxShadow: "var(--shadow-lg)", zIndex: 30 }}>
                <Link className="btn btn-ghost btn-block" style={{ justifyContent: "flex-start" }} href="/settings"><Settings2 size={14} /> Settings</Link>
                <button className="btn btn-ghost btn-block" style={{ justifyContent: "flex-start" }} onClick={() => setTheme(nextTheme)}>{themeIcon} Theme: {theme}</button>
                <button className="btn btn-ghost btn-block" style={{ justifyContent: "flex-start", color: "var(--danger)" }} disabled={signingOut} onClick={() => void handleSignOut()}>
                  <LogOut size={14} /> {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {menuOpen && <div className="drawer-backdrop" onClick={() => setMenuOpen(false)} />}

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button className="btn btn-ghost btn-icon menu-trigger" aria-label="Open navigation" onClick={() => setMenuOpen(true)}>
              <Menu size={18} />
            </button>
            <div className="crumb">Workspace <span> / </span> <strong>{activeLabel}</strong></div>
          </div>
          <div className="topbar-right">
            <button className="search-trigger" onClick={() => setSearchOpen(true)}>
              <Search size={14} /> <span>Search anything</span> <kbd>⌘K</kbd>
            </button>
            <button
              className="btn btn-ghost btn-sm"
              title={offlineView ? "Showing cached data" : "Sync status"}
              onClick={() => void syncNow()}
              disabled={syncing}
            >
              {!online || offlineView ? <WifiOff size={14} /> : syncing ? <RefreshCw size={14} className="spin" /> : <Check size={14} />}
              <span style={{ fontSize: 10.5 }}>
                {!online || offlineView ? "Offline" : syncing ? "Syncing" : pendingCount > 0 ? `${pendingCount} pending` : "Synced"}
              </span>
            </button>
            <button className="btn btn-ghost btn-icon" aria-label={`Theme: ${theme}. Click to change.`} onClick={() => setTheme(nextTheme)}>
              {themeIcon}
            </button>
            <button className="btn btn-ghost btn-icon" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} style={{ position: "relative" }} onClick={() => setNotificationsOpen(true)}>
              <Bell size={17} />
              {unreadCount > 0 && <span className="dot" style={{ position: "absolute", top: 6, right: 7, background: "var(--danger)" }} />}
            </button>
            <button className="avatar avatar-sm" aria-label="Account menu" onClick={() => setProfileOpen((value) => !value)}>{initial}</button>
          </div>
        </header>

        {error && (
          <div style={{ padding: "10px 26px 0" }}>
            <div className="alert alert-danger">
              <span style={{ flex: 1 }}>{error}</span>
              <button className="btn btn-sm" onClick={() => void refresh()}>Retry</button>
            </div>
          </div>
        )}

        <div className="content">
          {loading && (
            <div style={{ marginBottom: 14 }} className="alert alert-accent">
              <RefreshCw size={14} className="spin" /> Loading your Supabase workspace…
            </div>
          )}
          {children}
        </div>
      </main>

      <nav className="bottom-nav" aria-label="Mobile navigation">
        {MOBILE_NAV.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/home" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
              <Icon size={19} /> {item.label}
            </Link>
          );
        })}
        <button onClick={() => setMenuOpen(true)} aria-label="More navigation" style={{ border: 0, background: "transparent", color: "var(--muted)", display: "grid", justifyItems: "center", gap: 2, fontSize: 9.5, padding: "4px 0" }}>
          <Menu size={19} /> More
        </button>
      </nav>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <NotificationCenter open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </div>
  );
}
