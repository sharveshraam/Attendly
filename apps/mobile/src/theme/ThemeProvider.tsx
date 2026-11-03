import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { palette, radius, shadows, spacing, typography, type ThemeColors, type ThemeName } from './tokens';

export type ThemePreference = 'system' | 'light' | 'dark';

const THEME_KEY = 'attendly.theme.preference';

export interface Theme {
  name: ThemeName;
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  shadow: {
    shadowColor: string;
    shadowOpacity: number;
    shadowRadius: number;
    shadowOffset: { width: number; height: number };
    elevation: number;
  };
}

interface ThemeContextValue {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function buildTheme(name: ThemeName): Theme {
  return {
    name,
    colors: { ...palette[name] },
    spacing,
    radius,
    typography,
    shadow: shadows.card[name],
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('dark');

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(THEME_KEY).then((value) => {
      if (active && (value === 'light' || value === 'dark' || value === 'system')) {
        setPreferenceState(value);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const setPreference = (p: ThemePreference) => {
    setPreferenceState(p);
    void AsyncStorage.setItem(THEME_KEY, p);
  };

  const resolved: ThemeName = preference === 'system' ? (system === 'light' ? 'light' : 'dark') : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: buildTheme(resolved), preference, setPreference }),
    [resolved, preference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

export function useColors(): ThemeColors {
  return useTheme().theme.colors;
}
