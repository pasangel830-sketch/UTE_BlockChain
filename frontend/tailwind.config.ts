import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0A2540',
        amberx: '#9B1B30',
        gold: '#C5A572',
        cream: '#F4F1EA',
        paper: '#FFFEFB',
        crimson: '#9B1B30',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'ui-serif', 'Georgia', 'serif'],
      },
      boxShadow: {
        official: '0 1px 2px rgba(10,37,64,0.06), 0 8px 24px rgba(10,37,64,0.06)',
        'official-lg': '0 12px 40px rgba(10,37,64,0.12)',
      },
      keyframes: {
        'page-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'hairline': {
          '0%': { transform: 'scaleX(0.4)', opacity: '0.5' },
          '100%': { transform: 'scaleX(1)', opacity: '1' },
        },
      },
      animation: {
        'page-in': 'page-in 0.45s ease-out both',
        'fade-in': 'fade-in 0.5s ease-out both',
        hairline: 'hairline 0.7s ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
