import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Klient leży w client/, a zbudowany trafia do dist/, skąd serwuje go serwer.
// W trybie deweloperskim zapytania /api idą do serwera na porcie 4180.
export default defineConfig({
  root: 'client',
  plugins: [react()],
  build: { outDir: '../dist', emptyOutDir: true },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:4180', changeOrigin: false } },
  },
});
