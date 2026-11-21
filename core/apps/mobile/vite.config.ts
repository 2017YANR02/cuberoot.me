import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const resolve = createRequire(import.meta.url).resolve;
const startupMark = readFileSync(new URL('../../assets/brand/CubeRoot-mark.svg', import.meta.url), 'utf8')
  .replace('<g>', '<style>@media (prefers-color-scheme: dark) { path { fill: #fff; } }</style><g>');
const embeddedStyles = readFileSync(resolve('@cuberoot/app-ui/embedded-layout.css'), 'utf8');
const embeddedLayoutScript = readFileSync(new URL('./src/embedded-layout.js', import.meta.url), 'utf8');

export default defineConfig({
  build: {
    // Keep older Android syntax and iOS WebKit prefixes (notably user-select).
    cssTarget: ['chrome103', 'safari15'],
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
      this.emitFile({
        type: 'asset',
        fileName: 'embedded-layout.js',
        source: `(() => { const styles = ${JSON.stringify(embeddedStyles)};\n${embeddedLayoutScript}\n})();`,
      });
    },
  }],
  worker: { format: 'es' },
});
