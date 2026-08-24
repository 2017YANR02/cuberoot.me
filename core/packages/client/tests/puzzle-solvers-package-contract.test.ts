import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = resolve(HERE, '..');
const PACKAGE_NAME = '@cuberoot/puzzle-solvers';
const require = createRequire(import.meta.url);

function resolvedClockExport(): string {
  return require.resolve(`${PACKAGE_NAME}/clock`);
}

function workerMessage(worker: Worker): Promise<unknown> {
  return new Promise((resolveMessage, reject) => {
    worker.once('message', resolveMessage);
    worker.once('error', reject);
    worker.once('exit', (code) => {
      if (code !== 0) reject(new Error(`Clock worker exited with code ${code}`));
    });
  });
}

describe('@cuberoot/puzzle-solvers package contract', () => {
  it('publishes only the explicit Clock subpath and keeps the root private', () => {
    const resolved = resolvedClockExport();
    const packageJsonPath = resolve(dirname(resolved), '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as Record<string, unknown>;
    expect(packageJson.exports).toEqual({
      './clock': {
        types: './src/clock.ts',
        node: './dist/clock.js',
        default: './src/clock.ts',
      },
    });
    expect(packageJson).not.toHaveProperty('main');
    expect(packageJson).not.toHaveProperty('types');
    expect(packageJson).not.toHaveProperty('dependencies');
    expect(packageJson.sideEffects).toBe(false);
    expect(resolved.replaceAll('\\', '/')).toMatch(/puzzle-solvers\/dist\/clock\.js$/);

    let rootError: NodeJS.ErrnoException | undefined;
    try {
      require.resolve(PACKAGE_NAME);
    } catch (error) {
      rootError = error as NodeJS.ErrnoException;
    }
    expect(rootError?.code).toBe('ERR_PACKAGE_PATH_NOT_EXPORTED');
  });

  it('loads the built Node export in the main thread and a worker', async () => {
    const module = await import(pathToFileURL(resolvedClockExport()).href) as {
      SOLVED_CLOCK: () => unknown;
      solveClock: (state: unknown) => { length: number };
    };
    expect(module.solveClock(module.SOLVED_CLOCK()).length).toBe(0);

    const worker = new Worker(new URL('./puzzle-solvers-clock-worker.mjs', import.meta.url));
    try {
      await expect(workerMessage(worker)).resolves.toBe(0);
    } finally {
      await worker.terminate();
    }
  });

  it('bundles the public subpath for browsers without Node-only dependencies', async () => {
    const result = await build({
      stdin: {
        contents: `import { SOLVED_CLOCK, solveClock } from '${PACKAGE_NAME}/clock'; console.log(solveClock(SOLVED_CLOCK()).length);`,
        resolveDir: CLIENT_ROOT,
        sourcefile: 'puzzle-solvers-browser-smoke.ts',
      },
      bundle: true,
      metafile: true,
      platform: 'browser',
      write: false,
    });
    const inputs = Object.keys(result.metafile?.inputs ?? {}).map((input) => input.replaceAll('\\', '/'));
    expect(inputs.filter((input) => /puzzle-solvers\/src\//.test(input))).toEqual([
      expect.stringMatching(/puzzle-solvers\/src\/clock\.ts$/),
    ]);
    expect(inputs.some((input) => input.startsWith('node:'))).toBe(false);
    expect(result.outputFiles).toHaveLength(1);
  });
});
