/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6fc', 100: '#d7e9f7', 200: '#aed3ef', 300: '#7ab6e3',
          400: '#4295d3', 500: '#1f78bd', 600: '#135e9c', 700: '#0f4c81',
          800: '#0d3f6b', 900: '#0b3358',
        },
        gold: {
          50: '#fff9ec', 100: '#fff0cc', 200: '#ffe099', 300: '#ffc63f',
          400: '#f9ad24', 500: '#f7941e', 600: '#dd7a0b', 700: '#b5762a',
        },
        olive: {
          50: '#f2f9ee', 100: '#e0f1d7', 200: '#c2e4b1', 300: '#9dd184',
          400: '#7cbf5f', 500: '#6ab04a', 600: '#55963a', 700: '#43772f',
        },
        ink: { 900: '#12202e', 700: '#33475b', 500: '#647a91', 300: '#a8b8c8' },
      },
      fontFamily: {
        sans: ['Tajawal', 'Cairo', 'Segoe UI', 'system-ui', 'sans-serif'],
        display: ['Cairo', 'Tajawal', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(16,40,64,.04), 0 8px 24px -12px rgba(16,40,64,.18)',
        lift: '0 2px 6px rgba(16,40,64,.06), 0 18px 40px -18px rgba(16,40,64,.28)',
      },
      borderRadius: { xl2: '1.25rem' },
    },
  },
  plugins: [],
}
