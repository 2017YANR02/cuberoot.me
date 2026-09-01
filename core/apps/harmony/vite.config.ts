import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'serve' && !isPreview ? '/' : '/app/',
  clearScreen: false,
  plugins: [react()],
  server: {
    port: 1430,
    strictPort: true,
  },
}));
