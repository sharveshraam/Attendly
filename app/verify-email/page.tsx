"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MailCheck } from "lucide-react";
import { resendConfirmation } from "@/lib/auth";
import { AuthAside } from "@/components/auth-form";

function VerifyContent() {
  const params = useSearchParams();
  const email = params.get("email") ?? "your inbox";
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function resend() {
    if (!params.get("email")) return;
    setBusy(true);
    const { error } = await resendConfirmation(params.get("email") as string);
    setMessage(error ? error.message : "If that address still needs confirmation, a new confirmation email is on its way.");
    setBusy(false);
  }

  return (
    <div className="auth-card">
      <span className="eyebrow">One more step</span>
      <div className="empty-icon" style={{ margin: "18px 0" }}><MailCheck size={22} /></div>
      <h1 style={{ fontSize: 25 }}>Check your email</h1>
      <p className="muted" style={{ fontSize: 13, lineHeight: 1.7, margin: "10px 0 20px" }}>
        We sent a confirmation link to <strong style={{ color: "var(--text)" }}>{email}</strong>. Email confirmation is enabled on this project, so open that link before signing in.
      </p>
      <div className="alert alert-warning" style={{ marginBottom: 18 }}>
        <span>Confirmation links currently resolve to the project&rsquo;s configured site URL (<code>http://localhost:3000</code>) until the deployed origin is added to the Supabase auth redirect allow-list. This is documented in the deployment guide.</span>
      </div>
      {params.get("email") && (
        <button className="btn btn-block" disabled={busy} onClick={() => void resend()}>{busy ? "Sending…" : "Resend confirmation email"}</button>
      )}
      {message && <p className="muted" style={{ fontSize: 11.5, marginTop: 10 }} role="status">{message}</p>}
      <div style={{ marginTop: 18, textAlign: "center", fontSize: 12 }}>
        <Link href="/login" style={{ color: "var(--accent)" }}>Back to sign in</Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="auth-shell">
      <AuthAside />
      <main className="auth-main">
        <Suspense fallback={<div className="skeleton" style={{ height: 260, width: 420 }} />}>
          <VerifyContent />
        </Suspense>
      </main>
    </div>
  );
}
