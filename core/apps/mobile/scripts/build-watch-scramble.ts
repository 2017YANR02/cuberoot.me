import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Bundle the installed cubing.js worker algorithm unchanged, without Web Worker transport. */
export async function buildWatchScramble(outfile: string) {
  const mobile = fileURLToPath(new URL('..', import.meta.url));
  const chunks = resolve(dirname(fileURLToPath(import.meta.resolve('cubing/scramble'))), '../chunks');
  const worker = await readFile(resolve(chunks, 'search-worker-entry.js'), 'utf8');
  const insideName = worker.match(/\.\/(inside-[^"']+\.js)/)?.[1];
  if (!insideName) throw new Error('cubing worker layout changed');
  const inside = await readFile(resolve(chunks, insideName), 'utf8');
  const providerName = inside.match(/import\s*\{[^}]*\brandom333Scramble\b[^}]*\}\s*from\s*"\.\/([^\"]+)"/s)?.[1];
  if (!providerName) throw new Error('cubing 333 provider missing');
  const provider = resolve(chunks, providerName);
  await build({ entryPoints: [resolve(mobile, 'src/watch-scramble-runtime.ts')], outfile,
    bundle: true, platform: 'neutral', format: 'iife', target: 'es2022', minify: true,
    legalComments: 'inline', conditions: ['import'], mainFields: ['module', 'main'],
    plugins: [{ name: 'watch-cubing-worker-transport', setup(builder) {
      builder.onResolve({ filter: /^watch-cubing-333$/ }, () => ({ path: provider }));
    } }],
  });
}
