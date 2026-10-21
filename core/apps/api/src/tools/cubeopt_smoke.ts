import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { assertCubeoptSmokeResult } from '../cubeopt/smoke-contract.js';
import { resolveCubeoptThreads } from '../cubeopt/config.js';

const { values } = parseArgs({
  options: {
    store: { type: 'string' },
    threads: { type: 'string' },
    'boot-timeout-ms': { type: 'string', default: '300000' },
    'solve-timeout-ms': { type: 'string', default: '180000' },
  },
  strict: true,
});

const artifactStore = values.store || process.env.CUBEOPT_ARTIFACT_DIR;
if (!artifactStore) {
  throw new Error('usage: pnpm cubeopt:smoke -- --store <artifact-store>');
}

function positiveInteger(name: 'boot-timeout-ms' | 'solve-timeout-ms'): number {
  const parsed = Number(values[name]);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return parsed;
}

const bootTimeoutMs = positiveInteger('boot-timeout-ms');
const solveTimeoutMs = positiveInteger('solve-timeout-ms');
const threads = resolveCubeoptThreads(values.threads ?? process.env.CUBEOPT_THREADS);

process.env.CUBEOPT_SOLVE_ENABLED = '1';
process.env.CUBEOPT_ARTIFACT_DIR = resolve(artifactStore);
process.env.CUBEOPT_THREADS = String(threads);
process.env.CUBEOPT_BOOT_TIMEOUT_MS = String(bootTimeoutMs);
process.env.CUBEOPT_TIMEOUT_MS = String(solveTimeoutMs);
delete process.env.CUBEOPT_DAEMON_SCRIPT;
delete process.env.CUBEOPT_MODULE;
delete process.env.CUBEOPT_TABLE;

const { solveOptimal } = await import('../cubeopt/daemon.js');
const wallTimeoutMs = bootTimeoutMs + solveTimeoutMs + 5_000;
let wallTimer: NodeJS.Timeout | undefined;
const result = await Promise.race([
  (async () => {
    const first = await solveOptimal('R');
    assertCubeoptSmokeResult(first);
    // Reuse the resident worker and exercise a valid zero-move response.
    const solved = await solveOptimal("R R'");
    if (solved.htm !== 0 || solved.solution !== '') throw new Error('solved-state smoke returned a non-empty solution');
    return first;
  })(),
  new Promise<never>((_resolve, reject) => {
    wallTimer = setTimeout(
      () => reject(new Error(`CubeOpt manager smoke exceeded ${wallTimeoutMs}ms`)),
      wallTimeoutMs,
    );
    wallTimer.unref();
  }),
]).finally(() => {
  if (wallTimer) clearTimeout(wallTimer);
});

assertCubeoptSmokeResult(result);

console.log(JSON.stringify({ ok: true, threads, requests: 2, scramble: 'R', ...result }, null, 2));
process.exit(0);
