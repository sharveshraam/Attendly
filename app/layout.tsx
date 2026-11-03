import type { Metadata, Viewport } from "next";
import "./web.css";
import "@fontsource-variable/inter";
import { ThemeProvider, THEME_BOOTSTRAP } from "@/components/theme-provider";
import { ToastProvider } from "@/components/toast";
import { PwaProvider } from "@/components/pwa";

export const metadata: Metadata = {
  title: {
    default: "Attendly — Your academic life, organised",
    template: "%s · Attendly",
  },
  description:
    "Attendly keeps your timetable, attendance, safe-bunk allowance, assignments and exams together in one intelligent academic calendar. Works on the web and as an installable app.",
  applicationName: "Attendly",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Attendly", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false, date: false, address: false, email: false },
  icons: {
    icon: [{ url: "/app-icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#090D14",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>
        <ThemeProvider>
          <ToastProvider>
            <PwaProvider>{children}</PwaProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
