import { AuthForm } from "@/components/auth-form";
export default function LoginPage() { return <main className="main" style={{maxWidth:460}}><div className="brand">attend<span>ly.</span></div><h1>Welcome back</h1><p className="muted">Sign in to your academic workspace.</p><AuthForm mode="login"/></main>; }

