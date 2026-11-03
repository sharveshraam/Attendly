import type { Metadata } from "next";
import { StaticPage, PolicySection } from "@/components/public-pages";
import { BookOpen, ShieldCheck } from "lucide-react";

export const metadata: Metadata = { title: "About", description: "Why Attendly exists and how it is built." };

export default function AboutPage() {
  return (
    <StaticPage eyebrow="About" title="A calmer semester, by design" lead="Attendly is a personal academic companion for university and college students. It is not an administration portal, and it does not claim to be one.">
      <PolicySection title="The idea">
        <p>A semester is a collection of small, repeated decisions: do I have class now, did I attend, can I afford to miss one, what is due next. Attendly keeps those decisions in one place and does the arithmetic carefully, so you are not reconstructing your attendance from memory at the end of term.</p>
      </PolicySection>
      <PolicySection title="How it is built">
        <p>The website is a Next.js App Router application in TypeScript with Tailwind CSS, hosted on Vercel. It talks to an existing Supabase project that also powers the Android application. Authentication, storage and all data access are constrained by Row Level Security. There is no separate website backend and no duplicate attendance system.</p>
      </PolicySection>
      <PolicySection title="Privacy first">
        <p><BookOpen size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Academic schedules can be shared with a study group. <ShieldCheck size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Attendance marks, personal analytics and bunk calculations are never shared. The website uses only the publishable client key; no service-role secret is present in the browser bundle.</p>
      </PolicySection>
      <PolicySection title="No invented claims">
        <p>Attendly does not publish testimonials, customer counts, institutional partnerships or performance statistics that cannot be verified. Product previews on this site are labelled illustrations; every number inside the signed-in application comes from your own records.</p>
      </PolicySection>
    </StaticPage>
  );
}
