/**
 * Build SW: bundle src/sw.ts → public/sw.js (with @cuberoot/visualcube inlined).
 *
 * SW 必须是单文件 + 放 public/ 才能由 Vite/HTTP 直接 serve 到 origin root。
 * client 的 build 脚本前置调用本文件。
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

await build({
  entryPoints: [resolve(root, 'src/sw.ts')],
  outfile: resolve(root, 'public/sw.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['chrome90', 'firefox90', 'safari15'],
  minify: true,
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'info',
});
