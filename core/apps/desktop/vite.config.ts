import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  clearScreen: false,
  plugins: [react()],
  worker: { format: 'es' },
  server: {
    port: 1420,
    strictPort: true,
  },
});
