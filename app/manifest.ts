import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Attendly — Academic attendance & calendar",
    short_name: "Attendly",
    description: "Your entire academic life, organised around one intelligent calendar.",
    id: "/",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#0B1020",
    theme_color: "#6D5CE7",
    lang: "en",
    dir: "ltr",
    categories: ["education", "productivity", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Today's schedule", short_name: "Today", url: "/calendar?view=day", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Mark attendance", short_name: "Attendance", url: "/attendance", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
