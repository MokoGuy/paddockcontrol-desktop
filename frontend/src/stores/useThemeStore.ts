import { create } from "zustand";

interface ThemeState {
    isDarkMode: boolean;
    setIsDarkMode: (isDark: boolean) => void;
}

// Initialize isDarkMode from document state
const getInitialDarkMode = (): boolean => {
    if (typeof document !== "undefined") {
        return document.documentElement.classList.contains("dark");
    }
    return false;
};

export const useThemeStore = create<ThemeState>((set) => ({
    isDarkMode: getInitialDarkMode(),
    setIsDarkMode: (isDark) => set({ isDarkMode: isDark }),
}));

// Watch for DOM class changes to keep store in sync
if (typeof document !== "undefined") {
    const observer = new MutationObserver(() => {
        const isDark = document.documentElement.classList.contains("dark");
        useThemeStore.setState({ isDarkMode: isDark });
    });

    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
    });
}
