/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: {
          50: '#fcf8e8',
          100: '#f8efd0',
          200: '#f0de9e',
          300: '#e6c558',
          400: '#d4af37',
          500: '#c39e2e',
          600: '#a8851f',
          700: '#8a6c1a',
          800: '#6b531a',
          900: '#5a471c',
        },
        ink: {
          50: '#f5f5f5',
          100: '#e6e6e6',
          200: '#c8c8c8',
          300: '#9a9a9a',
          400: '#6e6e6e',
          500: '#4a4a4a',
          600: '#333333',
          700: '#1e1e1e',
          800: '#161616',
          900: '#0f0f0f',
          950: '#0a0a0a',
        },
        success: {
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
        },
        warning: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        danger: {
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      boxShadow: {
        gold: '0 0 40px rgba(212, 175, 55, 0.15)',
        'gold-lg': '0 0 60px rgba(212, 175, 55, 0.3)',
        card: '0 8px 32px rgba(0, 0, 0, 0.4)',
        'card-hover': '0 16px 48px rgba(0, 0, 0, 0.5)',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #d4af37 0%, #e6c558 50%, #b8941f 100%)',
        'gold-gradient-soft': 'linear-gradient(135deg, rgba(212,175,55,0.15) 0%, rgba(230,197,88,0.05) 100%)',
        'dark-gradient': 'linear-gradient(180deg, #0f0f0f 0%, #161616 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'slide-down': 'slideDown 0.3s ease-out forwards',
        float: 'float 6s ease-in-out infinite',
        shimmer: 'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { 'background-position': '-200% 0' },
          '100%': { 'background-position': '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
      },
    },
  },
  plugins: [],
};
