/**
 * Pre-bundle cubing.js search-worker into public/cubing-chunks/.
 *
 * Why: Vercel & Next standalone trip on pnpm's `.pnpm/<pkg>@<ver>/node_modules/<pkg>/`
 * layout when esbuild tries to resolve cubing's chunks + transitive deps at request
 * time (random-uint-below, ../puzzle-geometry/, etc.). Building at deploy time once
 * — with esbuild seeing the workspace's real pnpm tree — sidesteps the whole runtime
 * resolve mess. Output sits in public/ (~1.6 MB) → Next serves it as a static asset,
 * no runtime route handler needed.
 *
 * Output dir is .gitignored — regenerated on every `pnpm --filter @cuberoot/client build`.
 */
import { build } from 'esbuild';
import { mkdirSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_NEXT = path.resolve(HERE, '..');
const REPO_ROOT_CORE = path.resolve(CLIENT_NEXT, '..', '..');
const PNPM_DIR = path.join(REPO_ROOT_CORE, 'node_modules', '.pnpm');

// Prefer the patched version (matches what client consumes via pnpm patch);
// fall back to unpatched if no patch installed.
function findCubingRoot() {
  const entries = readdirSync(PNPM_DIR).filter(e => e.startsWith('cubing@'));
  const patched = entries.find(e => e.includes('patch_hash='));
  const pick = patched || entries.find(e => /^cubing@[^_]+$/.test(e));
  if (!pick) throw new Error(`no cubing@* entry found in ${PNPM_DIR}`);
  return path.join(PNPM_DIR, pick, 'node_modules', 'cubing');
}

const cubingRoot = findCubingRoot();
const entry = path.join(cubingRoot, 'dist/lib/cubing/chunks/search-worker-entry.js');
const outDir = path.join(CLIENT_NEXT, 'public', 'cubing-chunks');
const outFile = path.join(outDir, 'search-worker-entry.js');

mkdirSync(outDir, { recursive: true });

console.log(`[build-cubing-worker] cubing: ${cubingRoot}`);
console.log(`[build-cubing-worker] → ${outFile}`);

const r = await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  outfile: outFile,
  platform: 'browser',
  legalComments: 'none',
  // resolve from monorepo root so esbuild sees the pnpm flat tree
  absWorkingDir: REPO_ROOT_CORE,
});

if (r.errors.length) {
  console.error(`[build-cubing-worker] ${r.errors.length} errors`);
  process.exit(1);
}
const kb = (statSync(outFile).size / 1024).toFixed(1);
console.log(`[build-cubing-worker] done — ${kb} KB`);
