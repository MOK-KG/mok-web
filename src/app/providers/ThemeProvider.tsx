import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { defaultTheme, type ThemeName } from '@/shared/config/tokens';
import { storage } from '@/shared/lib/storage';

const THEME_KEY = 'nok.theme';

/** Выбор пользователя: конкретная тема или «Как в системе» */
export type ThemeMode = ThemeName | 'system';

type ThemeContextValue = {
  /** Что выбрал пользователь */
  mode: ThemeMode;
  /** Тема, которая сейчас на экране */
  theme: ThemeName;
  setMode: (mode: ThemeMode) => void;
  /** Выбрать конкретную тему (переключатель на экране входа) */
  setTheme: (theme: ThemeName) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const readMode = (): ThemeMode => {
  const saved = storage.get(THEME_KEY);
  return saved === 'dark' || saved === 'light' || saved === 'system' ? saved : defaultTheme;
};

const systemQuery = () =>
  typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

const systemTheme = (): ThemeName => (systemQuery()?.matches === false ? 'light' : 'dark');

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(readMode);
  const [system, setSystem] = useState<ThemeName>(systemTheme);
  const theme = mode === 'system' ? system : mode;

  // «Как в системе» следит за настройкой ОС; тема по-прежнему задаётся атрибутом data-theme
  useEffect(() => {
    const query = systemQuery();
    if (!query) return;
    const onChange = () => setSystem(query.matches ? 'dark' : 'light');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    storage.set(THEME_KEY, mode);
  }, [theme, mode]);

  return (
    <ThemeContext.Provider value={{ mode, theme, setMode, setTheme: setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
