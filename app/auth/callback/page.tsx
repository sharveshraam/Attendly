"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import { consumeAuthRedirect } from "@/lib/auth";
import { AuthAside } from "@/components/auth-form";

function CallbackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [message, setMessage] = useState("Verifying your link…");

  useEffect(() => {
    let cancelled = false;
    void consumeAuthRedirect().then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setState("error");
        setMessage(result.error ?? "This link could not be verified.");
        return;
      }
      setState("done");
      if (result.type === "recovery") {
        setMessage("Link verified. Redirecting to password reset…");
        window.setTimeout(() => router.replace("/reset-password"), 900);
      } else {
        const next = params.get("next");
        setMessage("Email verified. Opening your workspace…");
        window.setTimeout(() => router.replace(next && next.startsWith("/") ? next : "/home"), 900);
      }
    });
    return () => { cancelled = true; };
  }, [router, params]);

  return (
    <div className="auth-card" style={{ textAlign: "center" }}>
      <div className="empty-icon" style={{ margin: "0 auto 18px" }}>
        {state === "working" ? <Loader2 size={20} className="spin" /> : state === "done" ? <CheckCircle2 size={20} /> : <TriangleAlert size={20} />}
      </div>
      <h1 style={{ fontSize: 23 }}>{state === "error" ? "Link problem" : state === "done" ? "You&rsquo;re verified" : "One moment"}</h1>
      <p className="muted" style={{ fontSize: 13, margin: "10px 0 20px" }}>{message}</p>
      {state === "error" && <Link className="btn btn-primary" href="/login">Back to sign in</Link>}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <div className="auth-shell">
      <AuthAside />
      <main className="auth-main">
        <Suspense fallback={<div className="skeleton" style={{ height: 220, width: 420 }} />}>
          <CallbackContent />
        </Suspense>
      </main>
    </div>
  );
}
