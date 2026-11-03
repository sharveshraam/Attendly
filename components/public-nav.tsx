import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export function PublicNav() {
  return (
    <header className="landing-nav">
      <div className="landing-nav-inner">
        <Link className="brand" href="/">
          <span className="brand-mark"><LayoutGrid size={17} /></span>
          attendly<span className="brand-dot">.</span>
        </Link>
        <nav className="landing-links" aria-label="Public navigation">
          <Link href="/features">Features</Link>
          <Link href="/about">About</Link>
          <Link href="/support">Support</Link>
          <Link href="/privacy">Privacy</Link>
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ThemeToggle />
          <Link className="btn btn-sm" href="/login">Sign in</Link>
          <Link className="btn btn-sm btn-primary" href="/signup">Get started</Link>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="landing-footer">
      <div className="landing-wrap footer-grid">
        <div>
          <div className="brand" style={{ fontSize: 15 }}><span className="brand-mark" style={{ width: 26, height: 26 }}><LayoutGrid size={14} /></span> attendly<span className="brand-dot">.</span></div>
          <p style={{ marginTop: 10, maxWidth: 320 }}>Your entire academic life, organised around one intelligent calendar.</p>
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <Link href="/features">Features</Link>
          <Link href="/about">About</Link>
          <Link href="/support">Support</Link>
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <Link href="/privacy">Privacy policy</Link>
          <Link href="/terms">Terms of service</Link>
          <Link href="/settings">Account settings</Link>
        </div>
        <div style={{ fontSize: 11, maxWidth: 220 }}>
          © {new Date().getFullYear()} Attendly. Built for students, not institutions.
          <br />Attendance data stays private to each account.
        </div>
      </div>
    </footer>
  );
}
