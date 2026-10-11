import { create } from 'zustand';

export type Theme = 'light' | 'dark';
const THEME_KEY = 'theme';
const savedTheme = (): Theme | null => {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch { return null; }
};
const persistTheme = (theme: Theme) => { try { localStorage.setItem(THEME_KEY, theme); } catch { /* Theme still applies for this session. */ } };
const systemTheme = (): Theme => window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
const initialTheme = (): Theme => {
  return savedTheme() || systemTheme();
};
const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
  root.style.colorScheme = theme;
};

interface ThemeState {
  theme: Theme;
  hasExplicitPreference: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initialTheme(),
  hasExplicitPreference: savedTheme() !== null,
  toggleTheme: () => set((state) => {
    const theme = state.theme === 'light' ? 'dark' : 'light';
    persistTheme(theme);
    applyTheme(theme);
    return { theme, hasExplicitPreference: true };
  }),
  setTheme: (theme) => {
    persistTheme(theme);
    applyTheme(theme);
    set({ theme, hasExplicitPreference: true });
  },
}));

applyTheme(useThemeStore.getState().theme);
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', (event) => {
    if (!useThemeStore.getState().hasExplicitPreference) {
      const theme = event.matches ? 'light' : 'dark';
      applyTheme(theme);
      useThemeStore.setState({ theme });
    }
  });
}
