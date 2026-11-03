import type { Metadata } from "next";
import { StaticPage, PolicySection } from "@/components/public-pages";

export const metadata: Metadata = { title: "Terms of service", description: "Terms for using Attendly." };

export default function TermsPage() {
  return (
    <StaticPage eyebrow="Legal" title="Terms of service" lead="Attendly is a personal planning tool. It is provided as-is, without warranties, and is not an official academic record.">
      <PolicySection title="Using the service">
        <p>You are responsible for the accuracy of the timetable, attendance marks and deadlines you enter. Attendance calculations are deterministic but depend on the data you provide. Always confirm critical attendance decisions with your institution&rsquo;s official records.</p>
      </PolicySection>
      <PolicySection title="Not an institutional system">
        <p>Attendly is not affiliated with, endorsed by, or a replacement for any university, college or attendance authority. It does not issue official attendance certificates or guarantees about academic eligibility.</p>
      </PolicySection>
      <PolicySection title="Availability">
        <p>The website depends on the existing Supabase project and Vercel hosting. Offline features work from cached data on your device; synchronisation requires a network connection. Background push delivery is not currently configured.</p>
      </PolicySection>
      <PolicySection title="Accounts">
        <p>Keep your password private. Do not share an account. You may export your data and stop using the service at any time. Account deletion currently requires an authorised server-side operation.</p>
      </PolicySection>
      <PolicySection title="Changes">
        <p>This is an actively developed project. Features described as unavailable in the documentation may be added later; this page will be updated when that happens.</p>
      </PolicySection>
      <p style={{ fontSize: 11.5 }}>Last updated: 3 November 2026.</p>
    </StaticPage>
  );
}
