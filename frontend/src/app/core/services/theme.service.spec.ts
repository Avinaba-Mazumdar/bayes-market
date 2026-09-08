import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
    const THEME_KEY = 'bayesmarket_theme';

    beforeEach(() => {
        localStorage.clear();
        document.documentElement.removeAttribute('data-theme');
    });

    afterEach(() => {
        localStorage.clear();
        document.documentElement.removeAttribute('data-theme');
    });

    it('should initialize with default "light" theme when localStorage is empty', () => {
        const service = TestBed.inject(ThemeService);
        expect(service.theme()).toBe('light');
        expect(service.isLight()).toBe(true);
        expect(service.isDark()).toBe(false);
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('should respect "dark" theme if saved in localStorage', () => {
        localStorage.setItem(THEME_KEY, 'dark');
        const service = TestBed.inject(ThemeService);
        expect(service.theme()).toBe('dark');
        expect(service.isDark()).toBe(true);
        expect(service.isLight()).toBe(false);
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('should toggle theme from light to dark and back', () => {
        const service = TestBed.inject(ThemeService);
        expect(service.theme()).toBe('light');

        service.toggleTheme();
        expect(service.theme()).toBe('dark');
        expect(service.isDark()).toBe(true);
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        expect(localStorage.getItem(THEME_KEY)).toBe('dark');

        service.toggleTheme();
        expect(service.theme()).toBe('light');
        expect(service.isLight()).toBe(true);
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
        expect(localStorage.getItem(THEME_KEY)).toBe('light');
    });

    it('should set specific theme directly', () => {
        const service = TestBed.inject(ThemeService);
        service.setTheme('dark');
        expect(service.theme()).toBe('dark');
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

        service.setTheme('light');
        expect(service.theme()).toBe('light');
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });
});
