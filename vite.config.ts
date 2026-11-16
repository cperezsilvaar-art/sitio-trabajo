import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// VITE_EMBED=1 genera la demo como un único HTML (para publicarla como página de Claude).
const embed = process.env.VITE_EMBED === '1';

export default defineConfig({
  plugins: embed ? [react(), viteSingleFile()] : [react()],
  base: './',
  build: embed
    ? { chunkSizeWarningLimit: 2000 }
    : {
        rollupOptions: {
          output: {
            manualChunks: {
              react: ['react', 'react-dom', 'react-router-dom'],
              docx: ['docxtemplater', 'pizzip'],
            },
          },
        },
        chunkSizeWarningLimit: 700,
      },
  test: { environment: 'node' },
} as never);
