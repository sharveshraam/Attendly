import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthAside, AuthForm } from "@/components/auth-form";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <div className="auth-shell">
      <AuthAside />
      <main className="auth-main">
        <div className="auth-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="eyebrow">Get started</span>
            <ThemeToggle />
          </div>
          <h1>Create your account</h1>
          <p className="muted" style={{ fontSize: 13, marginBottom: 22 }}>Start organising your semester in a couple of minutes.</p>
          <Suspense fallback={<div className="skeleton" style={{ height: 260 }} />}>
            <AuthForm mode="signup" />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
