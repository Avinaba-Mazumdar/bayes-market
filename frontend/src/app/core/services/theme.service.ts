import { Injectable, computed, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'bayesmarket_theme';

@Injectable({
    providedIn: 'root'
})
export class ThemeService {
    readonly theme = signal<Theme>(this.getInitialTheme());

    readonly isDark = computed(() => this.theme() === 'dark');
    readonly isLight = computed(() => this.theme() === 'light');

    constructor() {
        this.applyTheme(this.theme());
    }

    /**
     * Toggles between light and dark themes.
     */
    toggleTheme(): void {
        const nextTheme: Theme = this.theme() === 'dark' ? 'light' : 'dark';
        this.setTheme(nextTheme);
    }

    /**
     * Sets a specific theme ('light' | 'dark').
     */
    setTheme(newTheme: Theme): void {
        this.theme.set(newTheme);
        this.applyTheme(newTheme);
        this.persistTheme(newTheme);
    }

    private getInitialTheme(): Theme {
        if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
            return 'light';
        }

        try {
            const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
            if (savedTheme === 'light' || savedTheme === 'dark') {
                return savedTheme;
            }
        } catch {
            // LocalStorage might be inaccessible (e.g., in strict iframe/privacy mode)
        }

        // Default to light theme as requested
        return 'light';
    }

    private applyTheme(theme: Theme): void {
        if (typeof document !== 'undefined' && document.documentElement) {
            document.documentElement.setAttribute('data-theme', theme);
            document.documentElement.style.colorScheme = theme;
        }
    }

    private persistTheme(theme: Theme): void {
        if (typeof localStorage !== 'undefined') {
            try {
                localStorage.setItem(THEME_STORAGE_KEY, theme);
            } catch {
                // Ignore storage errors
            }
        }
    }
}
