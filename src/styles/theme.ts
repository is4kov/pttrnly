export const breakpoints = {
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

export type Breakpoint = keyof typeof breakpoints;

/** Media query helpers — never write raw query strings in components. */
export const media = {
  from: (bp: Breakpoint) => `@media (min-width: ${String(breakpoints[bp])}px)`,
  upTo: (bp: Breakpoint) => `@media (max-width: ${String(breakpoints[bp] - 1)}px)`,
  reducedMotion: '@media (prefers-reduced-motion: reduce)',
} as const;

export type ThemeName = 'light' | 'dark';

export type AppTheme = {
  name: ThemeName;
  colors: {
    bg: string;
    surface: string;
    /** One step short of `surface` — for hover on something not yet selected. */
    surfaceMuted: string;
    border: string;
    text: string;
    textMuted: string;
    accent: string;
    focus: string;
  };
  /** Spacing scale in px. Named rather than indexed so noUncheckedIndexedAccess stays happy. */
  space: {
    none: number;
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  radii: { sm: string; md: string; lg: string; pill: string };
  /** Minimum touch target — see CLAUDE.md "Mobile". */
  hitTarget: string;
  z: { base: number; sheet: number; popover: number; toast: number };
  breakpoints: typeof breakpoints;
  media: typeof media;
};

const shared = {
  space: { none: 0, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radii: { sm: '4px', md: '8px', lg: '16px', pill: '999px' },
  hitTarget: '44px',
  z: { base: 0, sheet: 100, popover: 200, toast: 300 },
  breakpoints,
  media,
} satisfies Omit<AppTheme, 'name' | 'colors'>;

export const lightTheme: AppTheme = {
  ...shared,
  name: 'light',
  colors: {
    bg: '#ffffff',
    surface: '#f4f4f5',
    surfaceMuted: '#fafafa',
    border: '#d4d4d8',
    text: '#18181b',
    textMuted: '#52525b',
    accent: '#4f46e5',
    focus: '#4f46e5',
  },
};

export const darkTheme: AppTheme = {
  ...shared,
  name: 'dark',
  colors: {
    bg: '#09090b',
    surface: '#18181b',
    surfaceMuted: '#111114',
    border: '#3f3f46',
    text: '#fafafa',
    textMuted: '#a1a1aa',
    accent: '#a5b4fc',
    focus: '#a5b4fc',
  },
};
