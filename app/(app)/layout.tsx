import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WorkspaceProvider } from "@/hooks/use-workspace";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
  } catch {
    // Missing/invalid public Supabase configuration: show an explicit setup
    // state instead of pretending the workspace is live.
    return (
      <main className="main" style={{ maxWidth: 560, margin: "12vh auto", padding: 24 }}>
        <div className="alert alert-warning">
          <div>
            <strong>Supabase is not configured for this deployment.</strong>
            <p style={{ marginTop: 6 }}>Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> as environment variables, then reload.</p>
          </div>
        </div>
      </main>
    );
  }
  return (
    <WorkspaceProvider>
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
