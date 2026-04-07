export interface ThemeInfo {
  id: string;
  name: string;
  primaryColor: string;
  bgColor: string;
  description: string;
}

export const AVAILABLE_THEMES: ThemeInfo[] = [
  {
    id: 'golden-ascent',
    name: 'Golden Ascent',
    primaryColor: '#d4af37',
    bgColor: '#0a0a0a',
    description: 'Black & Gold',
  },
  {
    id: 'royal-emerald',
    name: 'Royal Emerald',
    primaryColor: '#22c55e',
    bgColor: '#0a1a0f',
    description: 'Emerald Green',
  },
  {
    id: 'crimson-velvet',
    name: 'Crimson Velvet',
    primaryColor: '#ef4444',
    bgColor: '#1a0a0a',
    description: 'Deep Crimson',
  },
  {
    id: 'midnight-sapphire',
    name: 'Midnight Sapphire',
    primaryColor: '#3b82f6',
    bgColor: '#0a1628',
    description: 'Royal Blue',
  },
  {
    id: 'royal-amethyst',
    name: 'Royal Amethyst',
    primaryColor: '#8b5cf6',
    bgColor: '#1a0a2e',
    description: 'Rich Purple',
  },
];

const THEME_STORAGE_KEY = 'contract-crown-theme';
const DEFAULT_THEME = 'midnight-sapphire';

export class ThemeManager {
  static getTheme(): string {
    if (typeof localStorage === 'undefined') {
      return DEFAULT_THEME;
    }
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (!stored) return DEFAULT_THEME;
    const exists = AVAILABLE_THEMES.find((t) => t.id === stored);
    return exists ? stored : DEFAULT_THEME;
  }

  static setTheme(themeId: string): void {
    const theme = AVAILABLE_THEMES.find((t) => t.id === themeId);
    if (!theme) {
      return;
    }
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', themeId);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, themeId);
    }
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme.bgColor);
    }
  }

  static applyTheme(): void {
    const theme = this.getTheme();
    this.setTheme(theme);
  }

  static getAvailableThemes(): ThemeInfo[] {
    return [...AVAILABLE_THEMES];
  }

  static getCurrentTheme(): ThemeInfo {
    const currentId = this.getTheme();
    return AVAILABLE_THEMES.find((t) => t.id === currentId) || AVAILABLE_THEMES[0];
  }
}
