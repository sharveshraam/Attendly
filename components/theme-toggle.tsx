"use client";

import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Laptop;
  return (
    <button className="btn btn-ghost btn-icon" aria-label={`Theme: ${theme}. Click for ${next}.`} title={`Theme: ${theme}`} onClick={() => setTheme(next)}>
      <Icon size={16} />
    </button>
  );
}
