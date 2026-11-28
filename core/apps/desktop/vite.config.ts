import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  define: command === 'serve' ? { __CUBEROOT_DEV_API_ORIGIN__: 'window.location.origin' } : {},
  clearScreen: false,
  plugins: [react()],
  worker: { format: 'es' },
  server: {
    port: 1420,
    strictPort: true,
    proxy: { '/v1': { target: 'https://api.cuberoot.me', changeOrigin: true } },
  },
}));
