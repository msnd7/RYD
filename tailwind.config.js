/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // الأزرق الغامق — اللون الأساسي
        navy: {
          50: '#EEF3F9', 100: '#DAE5F0', 200: '#B2C7DE', 300: '#80A4C8',
          400: '#4E7CAD', 500: '#2B5D91', 600: '#1A4877', 700: '#12395F',
          800: '#0C2A47', 900: '#071B2F', 950: '#04121F',
        },
        // البرتقالي — لون التمييز
        orange: {
          50: '#FFF7EE', 100: '#FFE9D1', 200: '#FFD29E', 300: '#FFB666',
          400: '#FB9B34', 500: '#F0820E', 600: '#D46A04', 700: '#A85206',
          800: '#7C3D07', 900: '#5A2D06',
        },
        ink: { 900: '#0B1F33', 800: '#173250', 700: '#2E4761', 500: '#65798E', 400: '#8397AB', 300: '#A9B9C8' },
        line: '#E3EAF2',
        canvas: '#F4F7FB',
      },
      fontFamily: {
        sans: ['Thmanyah Sans', 'system-ui', 'Segoe UI', 'sans-serif'],
        display: ['Thmanyah Head', 'Thmanyah Sans', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(7,27,47,.04), 0 6px 20px -10px rgba(7,27,47,.16)',
        lift: '0 2px 6px rgba(7,27,47,.06), 0 20px 44px -20px rgba(7,27,47,.30)',
        glow: '0 10px 30px -12px rgba(240,130,14,.55)',
      },
      screens: { xs: '420px' },
    },
  },
  plugins: [],
}
