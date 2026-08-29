/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(${name}) / <alpha-value>)`

export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // أسطح الصفحة — تنقلب بين النهاري والليلي
        canvas: v('--canvas'),
        surface: v('--surface'),
        line: v('--line'),
        // الأزرق الغامق — اللون الأساسي
        navy: {
          50: v('--navy-50'), 100: v('--navy-100'), 200: v('--navy-200'), 300: v('--navy-300'),
          400: v('--navy-400'), 500: v('--navy-500'), 600: v('--navy-600'), 700: v('--navy-700'),
          800: v('--navy-800'), 900: v('--navy-900'), 950: v('--navy-950'),
        },
        // البرتقالي — لون التمييز
        orange: {
          50: v('--orange-50'), 100: v('--orange-100'), 200: v('--orange-200'), 300: v('--orange-300'),
          400: v('--orange-400'), 500: v('--orange-500'), 600: v('--orange-600'), 700: v('--orange-700'),
          800: v('--orange-800'), 900: v('--orange-900'),
        },
        ink: {
          900: v('--ink-900'), 800: v('--ink-800'), 700: v('--ink-700'),
          500: v('--ink-500'), 400: v('--ink-400'), 300: v('--ink-300'),
        },
      },
      fontFamily: {
        sans: ['Thmanyah Sans', 'system-ui', 'Segoe UI', 'sans-serif'],
        display: ['Thmanyah Head', 'Thmanyah Sans', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        lift: 'var(--shadow-lift)',
        glow: 'var(--shadow-glow)',
      },
      screens: { xs: '420px' },
    },
  },
  plugins: [],
}
