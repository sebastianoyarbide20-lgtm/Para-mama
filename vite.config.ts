import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// base: './' permite publicar la carpeta dist en cualquier hosting estático
// (GitHub Pages, Netlify, una carpeta compartida, etc.)
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 1200,
  },
});
