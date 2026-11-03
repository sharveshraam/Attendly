/**
 * "Obsidian Academic" token-driven palette.
 *
 * Muted teal (#38B8A5) is the single dominant accent. The ice blue, champagne
 * and muted red values exist only for information, warnings/exams and
 * at-risk/error states respectively — never as decoration. Course colours are
 * teal shades plus those three semantic accents, so there is no rainbow.
 */
export const COURSE_COLORS = [
  "#38B8A5", // muted teal — brand / primary
  "#2C9E8E", // deep teal
  "#5CCABB", // light teal
  "#7FE0D1", // pale teal
  "#1F7A70", // darkest teal
  "#75B9E7", // soft ice blue — info / secondary data
  "#D5B77A", // warm champagne — warnings / exams
  "#E47777", // muted red — errors / at-risk
] as const;

export const SURFACE = {
  obsidian: "#090D14",
  midnight: "#101722",
  graphite: "#182231",
  tertiary: "#1E2A3C",
  border: "#263244",
} as const;

export const TEXT = {
  primary: "#F1F5F9",
  secondary: "#A5ADBA",
  muted: "#6E7889",
} as const;

export const ACCENT = {
  teal: "#38B8A5",
  ice: "#75B9E7",
  champagne: "#D5B77A",
  red: "#E47777",
} as const;
