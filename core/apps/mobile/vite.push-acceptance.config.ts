import { defineConfig, loadEnv } from 'vite';
import { acceptanceApiOrigin } from './src/push-acceptance/config';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'PUSH_ACCEPTANCE_');
  const origin = acceptanceApiOrigin(process.env.PUSH_ACCEPTANCE_API_ORIGIN ?? env.PUSH_ACCEPTANCE_API_ORIGIN ?? 'http://127.0.0.1:3339');
  return {
    publicDir: false,
    define: { __PUSH_ACCEPTANCE_API_ORIGIN__: JSON.stringify(origin) },
    server: { host: '127.0.0.1', port: 4175, strictPort: true },
    build: { outDir: 'dist-push-acceptance', target: 'chrome103', cssTarget: 'chrome103', emptyOutDir: true },
    plugins: [{
      name: 'isolated-push-acceptance',
      transformIndexHtml: {
        order: 'pre',
        handler: () => `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; connect-src ${origin} ws://127.0.0.1:4175; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
<title>Push acceptance / 推送隔离验收</title><link rel="stylesheet" href="/src/push-acceptance/style.css"></head><body><main id="root"></main><script type="module" src="/src/push-acceptance/main.ts"></script></body></html>`,
      },
      generateBundle() { this.emitFile({ type: 'asset', fileName: 'push-acceptance.json', source: JSON.stringify({ fixture: true, apiOrigin: origin, delivery: 'disabled' }) }); },
    }],
  };
});
