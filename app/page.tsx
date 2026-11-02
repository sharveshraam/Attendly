import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Dashboard } from "@/components/dashboard";

export default async function Home() {
  let userName: string | null = null;
  let setupMissing = false;
  let overview: { semester: string; courseCount: number; upcoming: number; attendance: number | null } | null = null;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      userName = user.user_metadata?.display_name ?? user.email?.split("@")[0] ?? "student";
      const { data: semesters } = await supabase.from("semesters").select("id,name,start_date,end_date").order("start_date", { ascending: false }).limit(1);
      const active = semesters?.[0];
      if (active) {
        const [{ count: courseCount }, { count: upcoming }, { data: marks }] = await Promise.all([
          supabase.from("courses").select("id", { count: "exact", head: true }).eq("semester_id", active.id),
          supabase.from("calendar_events").select("id", { count: "exact", head: true }).eq("semester_id", active.id).eq("status", "scheduled").gte("starts_at", new Date().toISOString()),
          supabase.from("attendance_records").select("status").in("status", ["present", "absent", "excused"]),
        ]);
        const conducted = marks?.length ?? 0;
        const present = marks?.filter((mark) => mark.status === "present").length ?? 0;
        overview = { semester: active.name, courseCount: courseCount ?? 0, upcoming: upcoming ?? 0, attendance: conducted ? Math.round((present / conducted) * 100) : null };
      }
    }
  } catch { setupMissing = true; }

  return <>
    <Dashboard userName={userName} overview={overview} setupMissing={setupMissing} />
    {!userName && <div className="welcome-actions"><Link className="button button-primary" href="/signup">Create your account <span aria-hidden="true">↗</span></Link><Link className="button button-quiet" href="/login">Sign in</Link></div>}
  </>;
}

