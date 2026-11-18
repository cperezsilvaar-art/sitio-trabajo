/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Azul institucional de Farmatodo (isologo #0f2a78) y un tono más claro para enlaces y acentos.
        brand: { 50: '#eef2fb', 100: '#d7e0f5', 500: '#1d4fb8', 600: '#163f99', 700: '#0f2a78', 800: '#0b2160' },
        ink: { 900: '#1d1d1d', 700: '#2c2c2c', 500: '#505050', 400: '#6e6e6e' },
        chrome: { 100: '#f5f5f5', 200: '#e9e9e9', 300: '#dadada' },
      },
      fontFamily: { sans: ['"Adobe Clean"', 'Segoe UI', 'Inter', 'system-ui', '-apple-system', 'sans-serif'] },
    },
  },
  plugins: [],
};
