import { create } from 'zustand';

interface ThemeState {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: (localStorage.getItem('theme') as 'light' | 'dark') || 'dark',
  toggleTheme: () => set((state) => {
    const nextTheme = state.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', nextTheme);
    
    // Update html tag class list
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(nextTheme);

    return { theme: nextTheme };
  }),
  setTheme: (theme) => set(() => {
    localStorage.setItem('theme', theme);
    
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);

    return { theme };
  })
}));

// Initialize theme class on store load
if (typeof window !== 'undefined') {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  const root = window.document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(savedTheme);
}
