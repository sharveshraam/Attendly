import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Attendly — Academic companion",
  description: "Your intelligent academic calendar and attendance companion."
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

