import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ command, mode }) => ({
  define: command === 'serve' && mode !== 'test'
    ? { __CUBEROOT_DEV_API_ORIGIN__: 'window.location.origin' }
    : {},
  clearScreen: false,
  plugins: [react()],
  worker: { format: 'es' },
  server: {
    port: 1420,
    strictPort: true,
    proxy: { '/v1': { target: 'https://api.cuberoot.me', changeOrigin: true } },
  },
}));
