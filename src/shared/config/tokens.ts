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
  | 'info'
  | 'line'
  | 'control'
  | 'control-active'
  | 'danger-soft'
  | 'danger-line'
  | 'warning-soft'
  | 'warning-line'
  | 'popover'
  | 'popover-active'
  | 'row-highlight'
  | 'column'
  | 'chip'
  | 'chip-text'
  | 'danger-chip'
  | 'warning-chip'
  | 'warning-text'
  | 'info-chip'
  | 'info-text'
  | 'muted-chip'
  | 'info-line'
  | 'tone-blue'
  | 'tone-amber'
  | 'tone-red'
  | 'tone-purple'
  | 'tone-green'
  | 'tone-violet'
  | 'tone-orange'
  | 'tone-gold'
  | 'tone-cyan'
  | 'tone-blue-bg'
  | 'tone-amber-bg'
  | 'tone-red-bg'
  | 'tone-purple-bg'
  | 'tone-green-bg'
  | 'tone-violet-bg'
  | 'tone-orange-bg'
  | 'tone-gold-bg'
  | 'tone-cyan-bg';

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
    // Из макета Figma (экран входа)
    line: 'rgba(255, 255, 255, 0.08)',
    control: '#131E31',
    'control-active': '#22314D',
    'danger-soft': '#1E1013',
    'danger-line': 'rgba(232, 17, 45, 0.35)',
    'warning-soft': '#1C1A10',
    'warning-line': 'rgba(247, 201, 72, 0.28)',
    // Из макета Figma (выпадающие меню и уведомления)
    popover: '#1A2438',
    'popover-active': '#25334E',
    'row-highlight': 'rgba(255, 255, 255, 0.025)',
    // Из макета Figma (доска задач)
    column: '#0B1220',
    chip: '#1A2436',
    'chip-text': '#5A6474',
    'danger-chip': '#2A1215',
    'warning-chip': '#221E0C',
    'warning-text': '#FBBF24',
    'info-chip': '#131E30',
    'info-text': '#7FA8D9',
    'muted-chip': '#141C2C',
    'info-line': 'rgba(91, 155, 243, 0.28)',
    // Оттенки проектов и аватаров: цвет и фон
    'tone-blue': '#5B9BF3',
    'tone-blue-bg': '#1E3A5F',
    'tone-amber': '#FBBF24',
    'tone-amber-bg': '#3F2E1E',
    'tone-red': '#F08080',
    'tone-red-bg': '#3F1E24',
    'tone-purple': '#D48BE0',
    'tone-purple-bg': '#3A1E3F',
    'tone-green': '#4ADE80',
    'tone-green-bg': '#1E3F2A',
    'tone-violet': '#A78BFA',
    'tone-violet-bg': '#2A2346',
    'tone-orange': '#FB923C',
    'tone-orange-bg': '#3F2A1E',
    'tone-gold': '#F7C948',
    'tone-gold-bg': '#3A3315',
    'tone-cyan': '#22D3EE',
    'tone-cyan-bg': '#163A40',
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
    // Из макета Figma (экран входа)
    line: 'rgba(10, 22, 40, 0.1)',
    control: '#EDF1F6',
    'control-active': '#FFFFFF',
    'danger-soft': '#FEF2F2',
    'danger-line': 'rgba(232, 17, 45, 0.3)',
    'warning-soft': '#FFFBEB',
    'warning-line': 'rgba(247, 201, 72, 0.4)',
    // Из макета Figma (выпадающие меню и уведомления)
    popover: '#FFFFFF',
    'popover-active': '#EDF1F6',
    'row-highlight': 'rgba(10, 22, 40, 0.03)',
    // Из макета Figma (доска задач)
    column: '#F5F8FC',
    chip: '#EFF2F7',
    'chip-text': '#5A6474',
    'danger-chip': '#FEE2E2',
    'warning-chip': '#FEF3C7',
    'warning-text': '#B45309',
    'info-chip': '#DBEAFE',
    'info-text': '#1D4ED8',
    'muted-chip': '#F4F6F9',
    'info-line': 'rgba(37, 99, 235, 0.3)',
    // Оттенки проектов и аватаров: цвет и фон
    'tone-blue': '#1D4ED8',
    'tone-blue-bg': '#DBEAFE',
    'tone-amber': '#B45309',
    'tone-amber-bg': '#FEF3C7',
    'tone-red': '#B91C1C',
    'tone-red-bg': '#FEE2E2',
    'tone-purple': '#7E22CE',
    'tone-purple-bg': '#F3E8FF',
    'tone-green': '#16A34A',
    'tone-green-bg': '#DCFCE7',
    'tone-violet': '#7C3AED',
    'tone-violet-bg': '#EDE9FE',
    'tone-orange': '#EA580C',
    'tone-orange-bg': '#FFEDD5',
    'tone-gold': '#CA8A04',
    'tone-gold-bg': '#FEF9C3',
    'tone-cyan': '#0891B2',
    'tone-cyan-bg': '#CFFAFE',
  },
};

export const defaultTheme: ThemeName = 'dark';

/** Оттенки для проектов и аватаров (классы text-tone-*, bg-tone-*-bg) */
export const toneNames = [
  'blue',
  'amber',
  'red',
  'purple',
  'green',
  'violet',
  'orange',
  'gold',
  'cyan',
] as const;

export type Tone = (typeof toneNames)[number];

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

/** Скругления, px. 12 и 24 — из макета Figma (кнопки, нижняя панель), в ТЗ их не было */
export const radii = [6, 8, 9, 11, 12, 14, 18, 24] as const;

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
