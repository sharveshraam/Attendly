import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthAside, AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div className="auth-shell">
      <AuthAside />
      <main className="auth-main">
        <div className="auth-card">
          <span className="eyebrow">Account recovery</span>
          <h1>Reset your password</h1>
          <p className="muted" style={{ fontSize: 13, marginBottom: 22 }}>We will email you a secure reset link.</p>
          <Suspense fallback={<div className="skeleton" style={{ height: 160 }} />}>
            <AuthForm mode="forgot" />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
