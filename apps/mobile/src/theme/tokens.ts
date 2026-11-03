/**
 * Attendly design tokens — "Obsidian Academic".
 * Dark, elegant, minimal, premium. Deep obsidian surfaces, restrained accents,
 * editorial typography. Muted teal is the single dominant accent; ice blue,
 * champagne and muted red are reserved for meaning (info / warning / error).
 */

export const palette = {
  dark: {
    background: '#090D14', // Deep Obsidian
    surface: '#101722', // Midnight Slate
    surfaceSecondary: '#182231', // Elevated Graphite
    surfaceTertiary: '#1E2A3C',
    primary: '#38B8A5', // Muted teal — dominant accent
    primarySoft: 'rgba(56,184,165,0.13)',
    secondary: '#75B9E7', // Soft ice blue
    secondarySoft: 'rgba(117,185,231,0.13)',
    text: '#F1F5F9',
    textSecondary: '#A5ADBA',
    textTertiary: '#6E7889',
    border: '#263244',
    borderStrong: '#34425A',
    success: '#38B8A5',
    successSoft: 'rgba(56,184,165,0.13)',
    warning: '#D5B77A', // Warm champagne
    warningSoft: 'rgba(213,183,122,0.13)',
    danger: '#E47777', // Muted red
    dangerSoft: 'rgba(228,119,119,0.13)',
    info: '#75B9E7',
    infoSoft: 'rgba(117,185,231,0.13)',
    overlay: 'rgba(4,7,12,0.78)',
    tabBar: '#0C1119',
    inputBackground: '#131C2A',
    skeleton: '#182231',
  },
  light: {
    background: '#F6F7F9',
    surface: '#FFFFFF',
    surfaceSecondary: '#F0F2F5',
    surfaceTertiary: '#E7EAEF',
    primary: '#178F7C',
    primarySoft: 'rgba(23,143,124,0.10)',
    secondary: '#2F7FB8',
    secondarySoft: 'rgba(47,127,184,0.10)',
    text: '#101722',
    textSecondary: '#5A6472',
    textTertiary: '#8B94A3',
    border: '#E2E6EC',
    borderStrong: '#CBD2DC',
    success: '#178F7C',
    successSoft: 'rgba(23,143,124,0.10)',
    warning: '#A8823C',
    warningSoft: 'rgba(168,130,60,0.12)',
    danger: '#C25555',
    dangerSoft: 'rgba(194,85,85,0.10)',
    info: '#2F7FB8',
    infoSoft: 'rgba(47,127,184,0.10)',
    overlay: 'rgba(16,23,34,0.45)',
    tabBar: '#FFFFFF',
    inputBackground: '#F0F2F5',
    skeleton: '#E7EAEF',
  },
} as const;

export type ThemeColors = { -readonly [K in keyof typeof palette.dark]: string };
export type ThemeName = 'dark' | 'light';

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  full: 999,
} as const;

export const typography = {
  fontFamily: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semiBold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
    extraBold: 'Inter_800ExtraBold',
  },
  size: {
    caption: 11,
    small: 13,
    body: 15,
    subtitle: 17,
    title: 20,
    headline: 25,
    display: 31,
    hero: 38,
  },
  // Editorial tracking: tight on large display type, open on small labels.
  letterSpacing: {
    hero: -0.9,
    display: -0.7,
    headline: -0.5,
    title: -0.3,
    subtitle: -0.1,
    body: 0,
    small: 0,
    caption: 0.3,
  },
} as const;

export const shadows = {
  card: {
    dark: {
      shadowColor: '#000',
      shadowOpacity: 0.22,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    light: {
      shadowColor: '#101722',
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
  },
} as const;
