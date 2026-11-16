/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#eef5fe', 100: '#d9e8fc', 500: '#1473e6', 600: '#0d66d0', 700: '#0a54ad', 800: '#08448c' },
        ink: { 900: '#1d1d1d', 700: '#2c2c2c', 500: '#505050', 400: '#6e6e6e' },
        chrome: { 100: '#f5f5f5', 200: '#e9e9e9', 300: '#dadada' },
      },
      fontFamily: { sans: ['"Adobe Clean"', 'Segoe UI', 'Inter', 'system-ui', '-apple-system', 'sans-serif'] },
    },
  },
  plugins: [],
};
