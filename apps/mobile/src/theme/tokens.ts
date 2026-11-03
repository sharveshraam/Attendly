/**
 * Attendly design tokens.
 * Identity: modern academic productivity + minimal futuristic SaaS.
 */

export const palette = {
  dark: {
    background: '#0B1020',
    surface: '#141B2D',
    surfaceSecondary: '#1B2540',
    surfaceTertiary: '#232F52',
    primary: '#8B7CFF',
    primarySoft: 'rgba(139,124,255,0.16)',
    secondary: '#54D6D0',
    secondarySoft: 'rgba(84,214,208,0.14)',
    text: '#F4F5FA',
    textSecondary: '#9AA5BD',
    textTertiary: '#6B7690',
    border: 'rgba(154,165,189,0.16)',
    borderStrong: 'rgba(154,165,189,0.30)',
    success: '#3DDC97',
    successSoft: 'rgba(61,220,151,0.14)',
    warning: '#F5B84C',
    warningSoft: 'rgba(245,184,76,0.14)',
    danger: '#F26D6D',
    dangerSoft: 'rgba(242,109,109,0.14)',
    info: '#5EA2F7',
    infoSoft: 'rgba(94,162,247,0.14)',
    overlay: 'rgba(4,7,16,0.72)',
    tabBar: '#101729',
    inputBackground: '#1B2540',
    skeleton: '#1B2540',
  },
  light: {
    background: '#F6F7FB',
    surface: '#FFFFFF',
    surfaceSecondary: '#EEF0F7',
    surfaceTertiary: '#E4E8F2',
    primary: '#6D5CE7',
    primarySoft: 'rgba(109,92,231,0.10)',
    secondary: '#16B8AD',
    secondarySoft: 'rgba(22,184,173,0.10)',
    text: '#172033',
    textSecondary: '#69758D',
    textTertiary: '#98A1B5',
    border: 'rgba(23,32,51,0.10)',
    borderStrong: 'rgba(23,32,51,0.20)',
    success: '#17A673',
    successSoft: 'rgba(23,166,115,0.10)',
    warning: '#C77E14',
    warningSoft: 'rgba(199,126,20,0.12)',
    danger: '#D64545',
    dangerSoft: 'rgba(214,69,69,0.10)',
    info: '#2F6FD0',
    infoSoft: 'rgba(47,111,208,0.10)',
    overlay: 'rgba(23,32,51,0.45)',
    tabBar: '#FFFFFF',
    inputBackground: '#EEF0F7',
    skeleton: '#E4E8F2',
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
  xl: 24,
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
    headline: 24,
    display: 30,
    hero: 36,
  },
} as const;

export const shadows = {
  card: {
    dark: {
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    light: {
      shadowColor: '#1B2540',
      shadowOpacity: 0.07,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
  },
} as const;
