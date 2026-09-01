/** Build the patched cubing.js search worker for any Web/installed host. */
import { build } from 'esbuild';
import { mkdirSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CORE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRelative = process.argv[2];
if (!outputRelative) throw new Error('usage: build-cubing-worker.mjs <output-dir-relative-to-core>');
const outDir = path.resolve(CORE_ROOT, outputRelative);
if (!outDir.startsWith(`${CORE_ROOT}${path.sep}`)) throw new Error('cubing worker output must stay inside core');

const cubingRoot = realpathSync(path.join(CORE_ROOT, 'packages/client/node_modules/cubing'));
const entry = path.join(cubingRoot, 'dist/lib/cubing/chunks/search-worker-entry.js');
const outFile = path.join(outDir, 'search-worker-entry.js');
mkdirSync(outDir, { recursive: true });

const result = await build({
  absWorkingDir: CORE_ROOT,
  bundle: true,
  banner: {
    js: '/* SPDX-License-Identifier: (MPL-2.0 OR GPL-3.0-or-later) AND Unlicense AND Apache-2.0; sources: https://github.com/cubing/cubing.js and https://github.com/lgarron/random-uint-below.js */',
  },
  entryPoints: [entry],
  format: 'esm',
  legalComments: 'eof',
  outfile: outFile,
  platform: 'browser',
  target: 'es2022',
});
if (result.errors.length) throw new Error(`cubing worker build failed with ${result.errors.length} errors`);
console.log(`[build-cubing-worker] ${outputRelative}/search-worker-entry.js ${(statSync(outFile).size / 1024).toFixed(1)} KB`);
