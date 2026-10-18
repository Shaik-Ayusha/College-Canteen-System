import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, React runs on port 5173 and forwards /api calls to Express on port 3000
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});
