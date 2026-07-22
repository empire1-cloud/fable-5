import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the built app works from any subpath or file://
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    proxy: {
      // All /api/* calls → empire_auto_cofounder FastAPI on :8000
      // e.g. fetch('/api/brief') → http://127.0.0.1:8000/brief
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
