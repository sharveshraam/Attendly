"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, Eye, EyeOff, LayoutGrid, Loader2, LockKeyhole } from "lucide-react";
import { consumeAuthRedirect, errorMessage, sendPasswordReset, signIn, signUp, updatePassword } from "@/lib/auth";
import { safeParse, loginSchema, signupSchema, forgotPasswordSchema, resetPasswordSchema } from "@/lib/validation";

export type AuthMode = "login" | "signup" | "forgot" | "reset";

const COPY: Record<AuthMode, { title: string; subtitle: string; submit: string }> = {
  login: { title: "Welcome back", subtitle: "Sign in to your academic workspace.", submit: "Sign in" },
  signup: { title: "Create your account", subtitle: "Start organising your semester in a couple of minutes.", submit: "Create account" },
  forgot: { title: "Reset your password", subtitle: "We will email you a secure reset link.", submit: "Send reset link" },
  reset: { title: "Choose a new password", subtitle: "Set a new password for your Attendly account.", submit: "Update password" },
};

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const params = useSearchParams();
  const copy = COPY[mode];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [resetReady, setResetReady] = useState(mode !== "reset");

  useEffect(() => {
    if (mode !== "reset") return;
    let cancelled = false;
    void consumeAuthRedirect().then((result) => {
      if (cancelled) return;
      if (result.ok) setResetReady(true);
      else setMessage(result.error ?? "This reset link could not be verified.");
    });
    return () => { cancelled = true; };
  }, [mode]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setSuccess(false);
    setFieldErrors({});

    const payload = { email, password, confirmPassword, displayName };
    const schema =
      mode === "login" ? loginSchema
        : mode === "signup" ? signupSchema
          : mode === "forgot" ? forgotPasswordSchema
            : resetPasswordSchema;
    const parsed = safeParse(schema, payload);
    if (!parsed.ok) {
      const key = parsed.error.split(":")[0] ?? "";
      setFieldErrors({ [key]: parsed.error });
      setMessage(parsed.error);
      return;
    }

    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await signIn(email, password);
        if (error) throw error;
        const next = params.get("next");
        router.push(next && next.startsWith("/") ? next : "/home");
        router.refresh();
        return;
      }
      if (mode === "signup") {
        const { data, error } = await signUp(email, password, displayName || email.split("@")[0]);
        if (error) throw error;
        if (data.session) {
          router.push("/onboarding");
          router.refresh();
        } else {
          router.push(`/verify-email?email=${encodeURIComponent(email)}`);
        }
        return;
      }
      if (mode === "forgot") {
        const { error } = await sendPasswordReset(email);
        if (error) throw error;
        setSuccess(true);
        setMessage("If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.");
        return;
      }
      // reset
      if (!resetReady) {
        setMessage("Waiting for the reset link to be verified. Open the link from your email again.");
        return;
      }
      const { error } = await updatePassword(password);
      if (error) throw error;
      setSuccess(true);
      setMessage("Password updated. You can now sign in with your new password.");
      window.setTimeout(() => router.push("/login"), 1800);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const passwordField = (
    <label className="field">
      <span>{mode === "reset" ? "New password" : "Password"}</span>
      <div style={{ position: "relative" }}>
        <input
          className="input"
          required
          minLength={6}
          type={showPassword ? "text" : "password"}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          style={{ paddingRight: 40 }}
        />
        <button
          type="button"
          aria-label={showPassword ? "Hide password" : "Show password"}
          className="btn btn-ghost btn-icon"
          style={{ position: "absolute", right: 2, top: 2, minHeight: 36, width: 34 }}
          onClick={() => setShowPassword((value) => !value)}
        >
          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
    </label>
  );

  return (
    <form className="stack" onSubmit={submit} style={{ gap: 14 }}>
      {mode === "signup" && (
        <label className="field">
          <span>Display name</span>
          <input className="input" maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="e.g. Sharvesh" autoComplete="name" />
          <span className="field-hint">Optional — used in your dashboard greeting.</span>
        </label>
      )}
      {mode !== "reset" && (
        <label className="field">
          <span>Email</span>
          <input className="input" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@university.edu" autoComplete="email" />
          {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
        </label>
      )}
      {mode !== "forgot" && passwordField}
      {(mode === "signup" || mode === "reset") && (
        <label className="field">
          <span>Confirm password</span>
          <input className="input" required minLength={6} type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
          {fieldErrors.confirmPassword && <span className="field-error">{fieldErrors.confirmPassword}</span>}
        </label>
      )}

      {message && (
        <div className={`alert ${success ? "alert-success" : "alert-danger"}`} role="status">
          {success ? <CheckCircle2 size={15} style={{ flex: "none" }} /> : <LockKeyhole size={15} style={{ flex: "none" }} />}
          <span>{message}</span>
        </div>
      )}

      <button className="btn btn-primary btn-block" type="submit" disabled={busy || (mode === "reset" && !resetReady)} style={{ minHeight: 42 }}>
        {busy ? <Loader2 size={15} className="spin" /> : null}
        {busy ? "Please wait…" : copy.submit}
        {!busy && <ArrowRight size={15} />}
      </button>

      <div className="muted" style={{ fontSize: 11.5, textAlign: "center", display: "grid", gap: 6 }}>
        {mode === "login" && <><Link href="/forgot-password">Forgot your password?</Link><span>New to Attendly? <Link href="/signup" style={{ color: "var(--accent)" }}>Create an account</Link></span></>}
        {mode === "signup" && <span>Already have an account? <Link href="/login" style={{ color: "var(--accent)" }}>Sign in</Link></span>}
        {(mode === "forgot" || mode === "reset") && <Link href="/login">Back to sign in</Link>}
        {mode === "signup" && <span style={{ fontSize: 10.5 }}>Email confirmation is enabled. Passwords must be at least 6 characters.</span>}
      </div>
    </form>
  );
}

export function AuthAside() {
  return (
    <aside className="auth-aside">
      <Link className="brand" href="/">
        <span className="brand-mark"><LayoutGrid size={17} /></span>
        attendly<span className="brand-dot">.</span>
      </Link>
      <div>
        <span className="eyebrow">Why Attendly</span>
        <h2 style={{ fontSize: 26, margin: "10px 0 14px", maxWidth: 380 }}>Your semester, without the guesswork.</h2>
        <div className="auth-aside-points">
          <div className="auth-point"><CheckCircle2 size={16} /> One account for the website and the Android app.</div>
          <div className="auth-point"><CheckCircle2 size={16} /> Attendance maths that never assumes an unmarked class is an absence.</div>
          <div className="auth-point"><CheckCircle2 size={16} /> Group schedules shared safely — personal marks stay private.</div>
          <div className="auth-point"><CheckCircle2 size={16} /> Installable PWA with offline attendance sync.</div>
        </div>
      </div>
      <p className="faint" style={{ fontSize: 11 }}>Private by design · Protected by Supabase Row Level Security</p>
    </aside>
  );
}
