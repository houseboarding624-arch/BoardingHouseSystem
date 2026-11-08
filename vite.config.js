import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// VITE_BASE is "/<repo-name>/" on GitHub Pages (set by the deploy workflow) and "/" everywhere else.
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: {
    port: 5173,
    // Local development: forward /api to the Express backend so cookies stay same-origin.
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
