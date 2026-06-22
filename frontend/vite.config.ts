import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Proxy API & static media to Express backend
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/outputs': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/audio': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});
