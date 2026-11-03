import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthAside, AuthForm } from "@/components/auth-form";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="auth-shell">
      <AuthAside />
      <main className="auth-main">
        <div className="auth-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="eyebrow">Attendly account</span>
            <ThemeToggle />
          </div>
          <h1>Welcome back</h1>
          <p className="muted" style={{ fontSize: 13, marginBottom: 22 }}>Sign in to your academic workspace.</p>
          <Suspense fallback={<div className="skeleton" style={{ height: 220 }} />}>
            <AuthForm mode="login" />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
