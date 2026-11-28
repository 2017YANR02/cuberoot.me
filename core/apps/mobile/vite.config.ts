import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const resolve = createRequire(import.meta.url).resolve;
const startupMark = readFileSync(new URL('../../assets/brand/CubeRoot-mark.svg', import.meta.url), 'utf8')
  .replace('<g>', '<style>@media (prefers-color-scheme: dark) { path { fill: #fff; } }</style><g>');
const embeddedStyles = readFileSync(resolve('@cuberoot/app-ui/embedded-layout.css'), 'utf8');
const embeddedLayoutScript = readFileSync(resolve('@cuberoot/app-ui/embedded-layout.js'), 'utf8');

export default defineConfig({
  resolve: {
    alias: process.env.CUBEROOT_IOS_BUILD === '1'
      ? { '@cuberoot/timer-ui/typography.css': resolve('@cuberoot/timer-ui/typography-system.css') }
      : {},
  },
  build: {
    // Keep older Android syntax and iOS WebKit prefixes (notably user-select).
    cssTarget: ['chrome103', 'safari15'],
    target: 'chrome103',
  },
  plugins: [react(), {
    name: 'startup-brand',
    transformIndexHtml(_html, { server }) {
      if (!server) return;
      return [{
        tag: 'script',
        injectTo: 'head-prepend',
        // The paired iPhone tunnel is private, but WebKit treats its HTTP origin as non-secure.
        children: `
          if (location.hostname.startsWith('[fd') && !crypto.randomUUID) {
            crypto.randomUUID = () => {
              const bytes = crypto.getRandomValues(new Uint8Array(16));
              bytes[6] = (bytes[6] & 15) | 64;
              bytes[8] = (bytes[8] & 63) | 128;
              const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
              return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
            };
          }
        `,
      }];
    },
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
        source: `(() => { const parentOrigins = ['capacitor://localhost', 'https://localhost']; const styles = ${JSON.stringify(embeddedStyles)};\n${embeddedLayoutScript}\n})();`,
      });
    },
  }],
  worker: { format: 'es' },
});
