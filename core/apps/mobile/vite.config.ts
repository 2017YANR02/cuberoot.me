import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    cssTarget: 'chrome103',
    target: 'chrome103',
  },
  plugins: [react()],
});
