// Contract Crown Theme Manager Tests
// Task 34.8: Theme System Unit Tests

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThemeManager, AVAILABLE_THEMES } from '@src/ui/theme-manager.js';

describe('ThemeManager (Task 34)', () => {
  const STORAGE_KEY = 'contract-crown-theme';

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('34.6: Theme Manager Utility', () => {
    describe('getTheme', () => {
      it('returns default theme when no theme is stored', () => {
        const theme = ThemeManager.getTheme();
        expect(theme).toBe('golden-ascent');
      });

      it('returns stored theme from localStorage', () => {
        localStorage.setItem(STORAGE_KEY, 'crimson-velvet');
        const theme = ThemeManager.getTheme();
        expect(theme).toBe('crimson-velvet');
      });

      it('returns default theme for unknown stored value', () => {
        localStorage.setItem(STORAGE_KEY, 'nonexistent-theme');
        const theme = ThemeManager.getTheme();
        expect(theme).toBe('golden-ascent');
      });
    });

    describe('setTheme', () => {
      it('applies valid theme to document element', () => {
        ThemeManager.setTheme('midnight-sapphire');
        expect(document.documentElement.getAttribute('data-theme')).toBe('midnight-sapphire');
      });

      it('persists theme to localStorage', () => {
        ThemeManager.setTheme('royal-amethyst');
        expect(localStorage.getItem(STORAGE_KEY)).toBe('royal-amethyst');
      });

      it('updates meta theme-color tag', () => {
        let metaTag = document.querySelector('meta[name="theme-color"]');
        if (!metaTag) {
          metaTag = document.createElement('meta');
          metaTag.setAttribute('name', 'theme-color');
          document.head.appendChild(metaTag);
        }
        ThemeManager.setTheme('golden-ascent');
        expect(metaTag.getAttribute('content')).toBe('#0a0a0a');
      });

      it('does nothing for invalid theme id', () => {
        ThemeManager.setTheme('invalid-theme');
        expect(document.documentElement.getAttribute('data-theme')).toBeNull();
      });
    });

    describe('applyTheme', () => {
      it('applies default theme on first load', () => {
        ThemeManager.applyTheme();
        expect(document.documentElement.getAttribute('data-theme')).toBe('golden-ascent');
      });

      it('applies stored theme on subsequent loads', () => {
        localStorage.setItem(STORAGE_KEY, 'royal-emerald');
        ThemeManager.applyTheme();
        expect(document.documentElement.getAttribute('data-theme')).toBe('royal-emerald');
      });
    });

    describe('getAvailableThemes', () => {
      it('returns all 5 themes', () => {
        const themes = ThemeManager.getAvailableThemes();
        expect(themes.length).toBe(5);
      });

      it('includes golden-ascent theme with correct colors', () => {
        const themes = ThemeManager.getAvailableThemes();
        const goldenAscent = themes.find((t) => t.id === 'golden-ascent');
        expect(goldenAscent).toBeDefined();
        expect(goldenAscent?.primaryColor).toBe('#d4af37');
        expect(goldenAscent?.bgColor).toBe('#0a0a0a');
      });

      it('includes royal-emerald theme', () => {
        const themes = ThemeManager.getAvailableThemes();
        const emerald = themes.find((t) => t.id === 'royal-emerald');
        expect(emerald).toBeDefined();
        expect(emerald?.primaryColor).toBe('#22c55e');
      });

      it('includes crimson-velvet theme', () => {
        const themes = ThemeManager.getAvailableThemes();
        const crimson = themes.find((t) => t.id === 'crimson-velvet');
        expect(crimson).toBeDefined();
        expect(crimson?.primaryColor).toBe('#ef4444');
      });

      it('includes midnight-sapphire theme', () => {
        const themes = ThemeManager.getAvailableThemes();
        const sapphire = themes.find((t) => t.id === 'midnight-sapphire');
        expect(sapphire).toBeDefined();
        expect(sapphire?.primaryColor).toBe('#3b82f6');
      });

      it('includes royal-amethyst theme', () => {
        const themes = ThemeManager.getAvailableThemes();
        const amethyst = themes.find((t) => t.id === 'royal-amethyst');
        expect(amethyst).toBeDefined();
        expect(amethyst?.primaryColor).toBe('#8b5cf6');
      });
    });

    describe('getCurrentTheme', () => {
      it('returns golden-ascent as current theme by default', () => {
        const current = ThemeManager.getCurrentTheme();
        expect(current.id).toBe('golden-ascent');
      });

      it('returns correct theme after setTheme', () => {
        ThemeManager.setTheme('crimson-velvet');
        const current = ThemeManager.getCurrentTheme();
        expect(current.id).toBe('crimson-velvet');
      });
    });

    describe('theme data integrity', () => {
      it('all themes have required fields', () => {
        const themes = ThemeManager.getAvailableThemes();
        for (const theme of themes) {
          expect(theme.id).toBeDefined();
          expect(theme.name).toBeDefined();
          expect(theme.primaryColor).toBeDefined();
          expect(theme.bgColor).toBeDefined();
          expect(theme.description).toBeDefined();
        }
      });

      it('all theme IDs are unique', () => {
        const themes = ThemeManager.getAvailableThemes();
        const ids = themes.map((t) => t.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
      });
    });
  });

  describe('34.8: Felt grid theme variables change per theme', () => {
    it('felt grid CSS variables are defined in each theme block', () => {
      const { readFileSync } = require('fs');
      const cssPath = require('path').join(process.cwd(), 'src/ui/styles/main.css');
      const cssContent = readFileSync(cssPath, 'utf-8');
      
      const themeFeltColors: Record<string, { bg: string; gradient: string }> = {
        'golden-ascent': { bg: '#1a1a1a', gradient: '#2a2a2a' },
        'royal-emerald': { bg: '#1a472a', gradient: '#2d6b45' },
        'crimson-velvet': { bg: '#2a1515', gradient: '#3d1f1f' },
        'midnight-sapphire': { bg: '#1e3a5f', gradient: '#2a4a6f' },
        'royal-amethyst': { bg: '#3b1a6e', gradient: '#4a2a7e' },
      };

      for (const [theme, colors] of Object.entries(themeFeltColors)) {
        expect(cssContent).toContain(`--felt-bg: ${colors.bg}`);
        expect(cssContent).toContain(`--felt-bg-gradient: ${colors.gradient}`);
      }
    });

    it('felt grid variables are defined in each theme block separately', () => {
      const { readFileSync } = require('fs');
      const cssPath = require('path').join(process.cwd(), 'src/ui/styles/main.css');
      const cssContent = readFileSync(cssPath, 'utf-8');
      const themes = ['golden-ascent', 'royal-emerald', 'crimson-velvet', 'midnight-sapphire', 'royal-amethyst'];

      for (const theme of themes) {
        const themeStartIndex = cssContent.indexOf(`[data-theme="${theme}"]`);
        const nextThemeStartIndex = cssContent.indexOf('[data-theme="', themeStartIndex + 1);
        const themeBlock = cssContent.substring(themeStartIndex, nextThemeStartIndex > themeStartIndex ? nextThemeStartIndex : cssContent.length);
        expect(themeBlock).toContain('--felt-bg:');
        expect(themeBlock).toContain('--felt-bg-gradient:');
      }
    });

    it('game-theme card variables remain constant across all themes', () => {
      const { readFileSync } = require('fs');
      const cssPath = require('path').join(process.cwd(), 'src/ui/styles/main.css');
      const cssContent = readFileSync(cssPath, 'utf-8');
      
      expect(cssContent).toContain('--game-card-bg: #ffffff');
      expect(cssContent).toContain('--game-card-border: #d4af37');
      expect(cssContent).toContain('--game-accent-ring: #d4af37');
    });

    it('game-theme card variables are only in :root, not in app-theme blocks', () => {
      const { readFileSync } = require('fs');
      const cssPath = require('path').join(process.cwd(), 'src/ui/styles/main.css');
      const cssContent = readFileSync(cssPath, 'utf-8');
      const appThemes = ['royal-emerald', 'crimson-velvet', 'midnight-sapphire', 'royal-amethyst'];

      for (const theme of appThemes) {
        const themeStartIndex = cssContent.indexOf(`[data-theme="${theme}"]`);
        const nextThemeStartIndex = cssContent.indexOf('[data-theme="', themeStartIndex + 1);
        const themeBlock = cssContent.substring(themeStartIndex, nextThemeStartIndex > themeStartIndex ? nextThemeStartIndex : cssContent.length);
        expect(themeBlock).not.toContain('--game-card-bg:');
        expect(themeBlock).not.toContain('--game-accent-ring:');
      }
    });
  });
});
