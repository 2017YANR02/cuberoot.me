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

const PUBLIC_SUBPATHS = [
  'bicube',
  'bsq',
  'cm3',
  'clock',
  'crz3a',
  'ctico',
  'cstimer-nonwca',
  'cstimer-gsolver',
  'cube-moves',
  'cube222',
  'gear',
  'cuboid233',
  'cuboid334',
  'cuboid335',
  'cuboid336',
  'cuboid337',
  'heli',
  'helicv',
  'ivy',
  'piece-blocks',
  'skewb',
  'timer-by-steps',
  'timer-333-cube',
  'timer-333-step',
  'timer-333-thistle',
  'timer-small-hints',
  'kociemba/cube',
  'kociemba/coords',
  'kociemba/movetables',
  'kociemba/prune',
  'kociemba/randomstate',
  'kociemba/search',
  'pyra',
  'sia123',
  'sia222',
  'ssq1',
  'sq2',
  'stm',
  'stm-cube',
] as const;

const SOURCE_BASENAME: Partial<Record<typeof PUBLIC_SUBPATHS[number], string>> = {
  stm: 'stm-solver',
};

function resolvedExport(subpath: typeof PUBLIC_SUBPATHS[number]): string {
  return require.resolve(`${PACKAGE_NAME}/${subpath}`);
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
  it('publishes only explicit solver subpaths and keeps the root private', () => {
    const resolved = resolvedExport('clock');
    const packageJsonPath = resolve(dirname(resolved), '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as Record<string, unknown>;
    expect(packageJson.exports).toEqual(Object.fromEntries(PUBLIC_SUBPATHS.map((subpath) => [
      `./${subpath}`,
      {
        types: `./src/${SOURCE_BASENAME[subpath] ?? subpath}.ts`,
        node: `./dist/${SOURCE_BASENAME[subpath] ?? subpath}.js`,
        default: `./src/${SOURCE_BASENAME[subpath] ?? subpath}.ts`,
      },
    ])));
    expect(packageJson).not.toHaveProperty('main');
    expect(packageJson).not.toHaveProperty('types');
    expect(packageJson.dependencies).toEqual({ cstimer_module: '^0.1.5' });
    expect(packageJson.sideEffects).toBe(false);
    for (const subpath of PUBLIC_SUBPATHS) {
      expect(resolvedExport(subpath).replaceAll('\\', '/')).toMatch(
        new RegExp(`puzzle-solvers/dist/${SOURCE_BASENAME[subpath] ?? subpath}\\.js$`),
      );
    }

    let rootError: NodeJS.ErrnoException | undefined;
    try {
      require.resolve(PACKAGE_NAME);
    } catch (error) {
      rootError = error as NodeJS.ErrnoException;
    }
    expect(rootError?.code).toBe('ERR_PACKAGE_PATH_NOT_EXPORTED');
  });

  it('loads built Node exports in the main thread and Clock in a worker', async () => {
    const module = await import(pathToFileURL(resolvedExport('clock')).href) as {
      SOLVED_CLOCK: () => unknown;
      solveClock: (state: unknown) => { length: number };
    };
    expect(module.solveClock(module.SOLVED_CLOCK()).length).toBe(0);
    const sq2 = await import(pathToFileURL(resolvedExport('sq2')).href) as {
      solveSq2: (scramble: string) => { length: number };
    };
    expect(sq2.solveSq2('').length).toBe(0);
    const bySteps = await import(pathToFileURL(resolvedExport('timer-by-steps')).href) as {
      generateTimerNon222ByStepsScramble: (
        filter: { event: 'gear'; metric: 'ftm'; lo: number; hi: number },
        random: () => number,
      ) => string;
      timerNon222StepMetricOfScramble: (
        event: 'gear',
        metric: 'ftm',
        scramble: string,
      ) => number | null;
    };
    const gear = bySteps.generateTimerNon222ByStepsScramble({
      event: 'gear', metric: 'ftm', lo: 4, hi: 4,
    }, () => 0);
    expect(bySteps.timerNon222StepMetricOfScramble('gear', 'ftm', gear)).toBe(4);
    const smallHints = await import(pathToFileURL(resolvedExport('timer-small-hints')).href) as {
      solveTimerSmallHints: (
        event: '222',
        scramble: string,
      ) => { full: { length: number }; faces: readonly unknown[] };
    };
    const hint = smallHints.solveTimerSmallHints('222', 'R U');
    expect(hint.full.length).toBe(2);
    expect(hint.faces).toHaveLength(6);
    const timer333 = await import(pathToFileURL(resolvedExport('timer-333-step')).href) as {
      METHOD_REGISTRY: readonly { id: string }[];
      solveByMethodId: (scramble: string, methodId: 'petrus') => { totalMoves: number };
    };
    expect(timer333.METHOD_REGISTRY.map((method) => method.id)).toEqual([
      'cfop', 'roux', 'petrus', 'zz', 'eodr', 'thistle',
    ]);
    expect(timer333.solveByMethodId("R U R' U'", 'petrus').totalMoves).toBe(0);

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
        contents: `import { SOLVED_CLOCK, solveClock } from '${PACKAGE_NAME}/clock'; import { solveSq2 } from '${PACKAGE_NAME}/sq2'; import { generateTimerNon222ByStepsScramble } from '${PACKAGE_NAME}/timer-by-steps'; import { METHOD_REGISTRY } from '${PACKAGE_NAME}/timer-333-step'; console.log(solveClock(SOLVED_CLOCK()).length, solveSq2('').length, generateTimerNon222ByStepsScramble, METHOD_REGISTRY.length);`,
        resolveDir: CLIENT_ROOT,
        sourcefile: 'puzzle-solvers-browser-smoke.ts',
      },
      bundle: true,
      metafile: true,
      platform: 'browser',
      write: false,
    });
    const inputs = Object.keys(result.metafile?.inputs ?? {}).map((input) => input.replaceAll('\\', '/'));
    const packageInputs = inputs.filter((input) => /puzzle-solvers\/src\//.test(input));
    expect(packageInputs.length).toBeGreaterThanOrEqual(7);
    expect(packageInputs).toEqual(expect.arrayContaining([
      expect.stringMatching(/puzzle-solvers\/src\/clock\.ts$/),
      expect.stringMatching(/puzzle-solvers\/src\/sq2\.ts$/),
      expect.stringMatching(/puzzle-solvers\/src\/timer-by-steps\.ts$/),
      expect.stringMatching(/puzzle-solvers\/src\/timer-333-step\.ts$/),
      expect.stringMatching(/puzzle-solvers\/src\/timer-333-cube\.ts$/),
      expect.stringMatching(/puzzle-solvers\/src\/timer-333-thistle\.ts$/),
      expect.stringMatching(/puzzle-solvers\/src\/cube-moves\.ts$/),
    ]));
    expect(inputs.some((input) => input.startsWith('node:'))).toBe(false);
    expect(result.outputFiles).toHaveLength(1);
  });
});
