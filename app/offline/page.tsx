import Link from "next/link";
import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="auth-main" style={{ minHeight: "100vh" }}>
      <div className="auth-card" style={{ textAlign: "center" }}>
        <div className="empty-icon" style={{ margin: "0 auto 18px" }}><WifiOff size={22} /></div>
        <h1 style={{ fontSize: 24 }}>You&rsquo;re offline</h1>
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.7, margin: "10px 0 20px" }}>
          Attendly couldn&rsquo;t reach the network. Previously synchronised schedules, courses and attendance marks are available on this device, and offline marks are queued for automatic sync. Nothing has been lost.
        </p>
        <Link className="btn btn-primary" href="/home">Try again</Link>
      </div>
    </main>
  );
}
