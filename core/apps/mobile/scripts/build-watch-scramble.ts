import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

export async function buildWatchScramble(outfile: string) {
  await build({ entryPoints: [fileURLToPath(new URL('../src/watch-scramble-runtime.ts', import.meta.url))],
    outfile, bundle: true, platform: 'neutral', format: 'iife', target: 'es2022', minify: true,
    legalComments: 'inline', conditions: ['import'], mainFields: ['module', 'main'] });
}
