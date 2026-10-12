import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { defaultTheme, type ThemeName } from '@/shared/config/tokens';
import { storage } from '@/shared/lib/storage';

const THEME_KEY = 'nok.theme';

type ThemeContextValue = {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const readTheme = (): ThemeName => {
  const saved = storage.get(THEME_KEY);
  return saved === 'dark' || saved === 'light' ? saved : defaultTheme;
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>(readTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    storage.set(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
