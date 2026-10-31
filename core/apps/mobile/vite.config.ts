import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const startupMark = readFileSync(new URL('../../assets/brand/CubeRoot-mark.svg', import.meta.url), 'utf8')
  .replace('<g>', '<style>@media (prefers-color-scheme: dark) { path { fill: #fff; } }</style><g>');

export default defineConfig({
  build: {
    cssTarget: 'chrome103',
    target: 'chrome103',
  },
  plugins: [react(), {
    name: 'startup-brand',
    configureServer(server) {
      server.middlewares.use('/startup-mark.svg', (_request, response) => {
        response.setHeader('Content-Type', 'image/svg+xml');
        response.end(startupMark);
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'startup-mark.svg', source: startupMark });
    },
  }],
  worker: { format: 'es' },
});
