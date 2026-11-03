"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";
const STORAGE_KEY = "attendly.theme.v1";

type ThemeContextValue = {
  theme: ThemePreference;
  resolved: "light" | "dark";
  setTheme: (value: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * "Obsidian Academic" is dark-first. The root stylesheet is dark by default;
 * only an explicit light preference (or a light OS with "system") adds `.light`.
 * Applied before hydration to avoid a flash of the wrong theme.
 */
export const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}')||'dark';var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var l=t==='light'||(t==='system'&&!m);document.documentElement.classList.toggle('light',l);document.documentElement.style.colorScheme=l?'light':'dark';}catch(e){document.documentElement.style.colorScheme='dark';}})();`;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>("dark");
  const [systemDark, setSystemDark] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
      if (stored === "light" || stored === "dark" || stored === "system") setThemeState(stored);
    } catch {
      /* storage may be blocked; dark default still works */
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(media.matches);
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const resolved: "light" | "dark" = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  useEffect(() => {
    document.documentElement.classList.toggle("light", resolved === "light");
    document.documentElement.style.colorScheme = resolved;
  }, [resolved]);

  const setTheme = useCallback((value: ThemePreference) => {
    setThemeState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => ({ theme, resolved, setTheme }), [theme, resolved, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
