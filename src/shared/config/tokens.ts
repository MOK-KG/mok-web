/**
 * Токены дизайна НОК КР.
 *
 * Файл продублирован побайтно в web/ и mobile/ (src/shared/config/tokens.ts).
 * При изменении правьте оба приложения.
 */

export const brand = {
  'brand-red': '#E8112D',
  'brand-gold': '#F7C948',
  'brand-navy': '#0A1628',
} as const;

export type ThemeName = 'dark' | 'light';

export type ThemeColorName =
  | 'canvas'
  | 'panel'
  | 'surface'
  | 'card'
  | 'text'
  | 'sub'
  | 'faint'
  | 'dim'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

export const themes: Record<ThemeName, Record<ThemeColorName, string>> = {
  dark: {
    canvas: '#060C17',
    panel: '#0D1626',
    surface: '#121D31',
    card: '#141F35',
    text: '#FFFFFF',
    sub: '#8A96A8',
    faint: '#5A6474',
    dim: '#3E4757',
    success: '#4ADE80',
    warning: '#FBBF24',
    danger: '#FF8A8A',
    info: '#5B9BF3',
  },
  light: {
    canvas: '#EDF1F7',
    panel: '#FFFFFF',
    surface: '#F5F8FC',
    card: '#FFFFFF',
    text: '#0A1628',
    sub: '#5A6474',
    faint: '#7A8699',
    dim: '#94A3B8',
    success: '#15803D',
    warning: '#D97706',
    danger: '#B91C1C',
    info: '#2563EB',
  },
};

export const defaultTheme: ThemeName = 'dark';

/** Имя CSS-переменной для цвета темы: canvas → --color-canvas */
export const colorVar = (name: ThemeColorName) => `--color-${name}`;

/** Переменные темы в виде { '--color-canvas': '#060C17', ... } */
export const themeVars = (theme: ThemeName): Record<string, string> =>
  Object.fromEntries(
    Object.entries(themes[theme]).map(([name, value]) => [colorVar(name as ThemeColorName), value]),
  );

/** Цвета для Tailwind: фиксированные цвета бренда + цвета темы через CSS-переменные */
export const tailwindColors = {
  transparent: 'transparent',
  current: 'currentColor',
  ...brand,
  ...Object.fromEntries(
    (Object.keys(themes.dark) as ThemeColorName[]).map((name) => [name, `var(${colorVar(name)})`]),
  ),
};

/** Скругления, px */
export const radii = [6, 8, 9, 11, 14, 18] as const;

export const tailwindBorderRadius = {
  none: '0px',
  full: '9999px',
  ...Object.fromEntries(radii.map((r) => [String(r), `${r}px`])),
};

/** Отступы кратны 4: p-1 = 4px, p-2 = 8px, ... p-32 = 128px */
const spacingSteps = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32] as const;

export const tailwindSpacing = {
  px: '1px',
  ...Object.fromEntries(spacingSteps.map((s) => [String(s), `${s * 4}px`])),
};

/** Шрифт Inter: Regular, Medium, Semi Bold, Bold */
export const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;
