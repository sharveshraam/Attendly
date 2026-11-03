import type { Metadata } from "next";
import { StaticPage, PolicySection } from "@/components/public-pages";

export const metadata: Metadata = { title: "Privacy policy", description: "What Attendly stores and how it is protected." };

export default function PrivacyPage() {
  return (
    <StaticPage eyebrow="Legal" title="Privacy policy" lead="A plain-language description of the data Attendly stores, who can see it, and the limits of this self-hosted-style setup.">
      <PolicySection title="What is stored">
        <p>Your account email (Supabase Auth), profile display name and timezone, semesters, courses, timetable rules, academic days, calendar events, your private attendance marks, assignments, course notes stored on your device, group memberships, uploaded academic documents, notification preferences and in-app notifications.</p>
      </PolicySection>
      <PolicySection title="Who can see it">
        <p>Personal attendance records, assignments, uploaded documents and notifications are restricted to your own authenticated user by Postgres Row Level Security. Group members can see shared calendar events on a group-linked semester and basic membership information; they cannot see your attendance or analytics. Other users&rsquo; profile names are not readable under the current self-select profile policy.</p>
      </PolicySection>
      <PolicySection title="Where it lives">
        <p>Data is stored in the existing Supabase project (Mumbai, ap-south-1). Uploaded files are stored in a private bucket under a path starting with your user ID. Cached website data is stored in this browser&rsquo;s local storage, is optional, and is cleared when you sign out. The service worker caches only static app assets — never API responses or tokens.</p>
      </PolicySection>
      <PolicySection title="What Attendly does not do">
        <p>It does not sell data, run advertising trackers, expose a service-role key to the browser, or send your academic records to an AI provider. There is currently no external AI, OCR or push-delivery service connected.</p>
      </PolicySection>
      <PolicySection title="Your controls">
        <p>You can export your attendance data and academic calendar from Settings, disable or clear the local offline cache, delete individual courses, assignments and documents, and sign out. Full account deletion requires an authorised server-side operation that is not yet configured; the Settings page states this honestly instead of offering a fake delete button.</p>
      </PolicySection>
      <p style={{ fontSize: 11.5 }}>Last updated: 3 November 2026. This document describes the current build; it is not a substitute for a formal legal review before a public launch.</p>
    </StaticPage>
  );
}
