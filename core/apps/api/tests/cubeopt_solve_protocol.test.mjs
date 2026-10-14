import { describe, it, expect } from 'vitest';
import { captureCubeoptOutput, initializeCubeoptSolver, serveCubeoptLines } from '../src/cubeopt/solve-protocol.mjs';

describe('CubeOpt asynchronous worker protocol', () => {
  it('awaits worker initialization, then serializes buffered requests and preserves IDs', async () => {
    const output = captureCubeoptOutput();
    let releaseInit;
    const initGate = new Promise(resolve => { releaseInit = resolve; });
    let active = 0, peak = 0, initialized = false;
    const module = {
      async init(_mode, threads) {
        expect(threads).toBe(4);
        await initGate;
        initialized = true;
      },
      async solve_scramble(scramble, threads) {
        expect(initialized).toBe(true);
        expect(threads).toBe(4);
        active++;
        peak = Math.max(peak, active);
        await new Promise(resolve => setTimeout(resolve, scramble === 'R' ? 5 : 1));
        output.print(`Solution found!: ${scramble}'`);
        output.print('Cube0 finished in 1');
        active--;
      },
    };
    let ready = false;
    const boot = initializeCubeoptSolver(module, 4, output).then(solve => { ready = true; return solve; });
    await Promise.resolve();
    expect(ready).toBe(false);
    releaseInit();
    const solve = await boot, results = [];
    await serveCubeoptLines(['a\tR', 'bad\tx', 'b\tU'], solve, line => results.push(line));
    expect(peak).toBe(1);
    expect(results).toEqual(["a\t1\tR'\n", 'bad\tERROR\tinvalid scramble\n', "b\t1\tU'\n"]);
  });

  it('fails the daemon on a worker error instead of advancing to another request', async () => {
    const visited = [], results = [];
    await expect(serveCubeoptLines(['a\tR', 'b\tU'], async scramble => {
      visited.push(scramble);
      throw new Error('worker stopped');
    }, line => results.push(line))).rejects.toThrow('worker stopped');
    expect(visited).toEqual(['R']);
    expect(results).toEqual(['a\tERROR\tworker stopped\n']);
  });

  it('clears previous output and accepts a solved state with an empty solution', async () => {
    const output = captureCubeoptOutput();
    output.print("Solution found!: R'");
    output.print('Cube0 finished in 1');
    const solve = await initializeCubeoptSolver({ init() {}, solve_scramble() {
      output.print('Solution found!: ');
      output.print('Cube0 finished in 0');
    } }, 1, output);
    const results = [];
    await serveCubeoptLines(["a\tR R'"], solve, line => results.push(line));
    expect(results).toEqual(['a\t0\t\n']);
  });
});
