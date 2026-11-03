import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PublicNav, PublicFooter } from "@/components/public-nav";

export function StaticPage({ eyebrow, title, lead, children }: {
  eyebrow: string; title: string; lead: string; children: React.ReactNode;
}) {
  return (
    <div className="landing">
      <PublicNav />
      <main className="landing-wrap" style={{ paddingTop: 64, paddingBottom: 72, maxWidth: 860 }}>
        <span className="eyebrow">{eyebrow}</span>
        <h1 style={{ fontSize: "clamp(30px, 4vw, 44px)", letterSpacing: "-0.05em", margin: "12px 0 14px" }}>{title}</h1>
        <p className="muted" style={{ fontSize: 15, lineHeight: 1.75, marginBottom: 36 }}>{lead}</p>
        <div className="stack" style={{ gap: 26, fontSize: 13.5, lineHeight: 1.8, color: "var(--muted)" }}>
          {children}
        </div>
        <div className="cta-band" style={{ marginTop: 48, textAlign: "left", padding: 28 }}>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>See it with your own data</h2>
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 16 }}>Create an account, add a semester, and Attendly will show only real numbers from your records.</p>
          <Link className="btn btn-primary" href="/signup">Get started <ArrowRight size={14} /></Link>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

export function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 style={{ fontSize: 18, color: "var(--text)", marginBottom: 8 }}>{title}</h2>
      {children}
    </section>
  );
}
