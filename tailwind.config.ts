import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';
import {
  defaultTheme,
  fontWeights,
  tailwindBorderRadius,
  tailwindColors,
  tailwindSpacing,
  themeVars,
} from './src/shared/config/tokens';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Тёмная тема — через атрибут data-theme на <html>, не через prefers-color-scheme
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    colors: tailwindColors,
    borderRadius: tailwindBorderRadius,
    spacing: tailwindSpacing,
    fontWeight: fontWeights,
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
    },
    extend: {},
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ':root': { ...themeVars(defaultTheme), colorScheme: defaultTheme },
        '[data-theme="dark"]': { ...themeVars('dark'), colorScheme: 'dark' },
        '[data-theme="light"]': { ...themeVars('light'), colorScheme: 'light' },
      });
    }),
  ],
} satisfies Config;
