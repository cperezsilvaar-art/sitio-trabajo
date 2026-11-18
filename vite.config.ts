import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// VITE_EMBED=1: demo para publicar dentro de Claude. VITE_SINGLE=1: demo portátil (un HTML que se abre con doble clic).
const embed = process.env.VITE_EMBED === '1' || process.env.VITE_SINGLE === '1';

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
