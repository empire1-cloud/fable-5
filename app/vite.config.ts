import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the built app works from any subpath or file://
export default defineConfig({
  plugins: [react()],
  base: './',
});
