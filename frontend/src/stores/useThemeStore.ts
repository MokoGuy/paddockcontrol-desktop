import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDarkMode: boolean;
  setIsDarkMode: (isDark: boolean) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'system',
  setTheme: (theme) => set({ theme }),

  isDarkMode: false,
  setIsDarkMode: (isDark) => set({ isDarkMode: isDark }),
}));
