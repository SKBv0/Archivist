import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 6173,
    strictPort: true,
    watch: {
      ignored: [
        '**/archive/**',
        '**/db.json',
        '**/.git/**'
      ]
    }
  }
});