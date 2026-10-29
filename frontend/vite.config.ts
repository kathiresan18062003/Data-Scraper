import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backendTarget = process.env.BACKEND_URL || 'http://127.0.0.1:8000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});

