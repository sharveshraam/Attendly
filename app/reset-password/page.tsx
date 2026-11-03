import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthAside, AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Set new password" };

export default function ResetPasswordPage() {
  return (
    <div className="auth-shell">
      <AuthAside />
      <main className="auth-main">
        <div className="auth-card">
          <span className="eyebrow">Account recovery</span>
          <h1>Choose a new password</h1>
          <p className="muted" style={{ fontSize: 13, marginBottom: 22 }}>Set a new password for your Attendly account.</p>
          <Suspense fallback={<div className="skeleton" style={{ height: 200 }} />}>
            <AuthForm mode="reset" />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
