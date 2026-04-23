import type { Config } from 'tailwindcss';
import daisyui from 'daisyui';

export default {
  content: [
    './public/**/*.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        felt: '#1a472a',
        'felt-light': '#2d6b45',
        'felt-dark': '#0f2e1a',
        card: '#ffffff',
        'card-playable': '#ffffff',
        'card-unplayable': '#888888',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'sans-serif'],
        serif: ['Cinzel', 'serif'],
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.5s ease-in-out infinite',
        'card-play': 'card-play 0.5s ease-out forwards',
        'trick-collect': 'trick-collect 0.5s ease-in-out forwards',
      },
      keyframes: {
        'pulse-ring': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.15)', opacity: '0.7' },
        },
        'card-play': {
          '0%': { transform: 'translate(var(--from-x), var(--from-y))', opacity: '1' },
          '100%': { transform: 'translate(var(--to-x), var(--to-y))', opacity: '1' },
        },
        'trick-collect': {
          '0%': { transform: 'translate(0, 0) scale(1)', opacity: '1' },
          '100%': { transform: 'translate(var(--target-x), var(--target-y)) scale(0.5)', opacity: '0' },
        },
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        crown: {
          primary: '#1a472a',
          secondary: '#2d6b45',
          accent: '#d4af37',
          neutral: '#1a1a2e',
          'base-100': '#1a472a',
          info: '#3b82f6',
          success: '#22c55e',
          warning: '#f59e0b',
          error: '#ef4444',
        },
      },
    ],
  },
} satisfies Config;
