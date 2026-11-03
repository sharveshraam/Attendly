import type { Metadata } from "next";
import { StaticPage, PolicySection } from "@/components/public-pages";

export const metadata: Metadata = { title: "Support", description: "Getting started and troubleshooting Attendly." };

export default function SupportPage() {
  return (
    <StaticPage eyebrow="Help" title="Support & getting started" lead="Practical answers for setting up Attendly and understanding what is available.">
      <PolicySection title="First steps">
        <p>Create an account and confirm your email, then complete onboarding: semester, courses, timetable and academic calendar. Optional steps can be skipped and configured later in Settings. CSV timetable import shows every parsed row for review before anything is saved.</p>
      </PolicySection>
      <PolicySection title="Why don&rsquo;t I see any attendance?">
        <p>Attendance appears only from your confirmed marks. Unmarked classes are excluded from the percentage by design. Add class sessions in the calendar (or generate them from timetable rules) and mark them in the Attendance section.</p>
      </PolicySection>
      <PolicySection title="Email confirmation link goes to localhost">
        <p>The Supabase project&rsquo;s site URL is currently <code>http://localhost:3000</code>. A deployed origin must be added to the auth redirect allow-list before confirmation links open the hosted website. This is a shared backend configuration change and is documented in the deployment guide.</p>
      </PolicySection>
      <PolicySection title="Installing the PWA">
        <p>On Chrome, Edge and supported Android browsers, use the install prompt shown in the app or your browser&rsquo;s &ldquo;Install app&rdquo; menu. On iOS Safari, use Share → Add to Home Screen. iOS does not expose an install prompt event, and background push is limited by the platform.</p>
      </PolicySection>
      <PolicySection title="Offline & conflicts">
        <p>Attendance marks made offline are queued locally. On reconnect, Attendly compares each queued edit with the server version; if another device changed the same class, the item is flagged as a conflict in Settings → Sync and you choose which value to keep. Nothing is silently overwritten.</p>
      </PolicySection>
      <PolicySection title="Contact">
        <p>This project is maintained in the public GitHub repository <code>sharveshraam/Attendly</code>. For bugs or feature requests, open an issue there with the page, browser and steps to reproduce. Do not include passwords, API keys or personal attendance exports in an issue.</p>
      </PolicySection>
    </StaticPage>
  );
}
