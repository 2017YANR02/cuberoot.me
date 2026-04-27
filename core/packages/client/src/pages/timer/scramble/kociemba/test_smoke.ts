/**
 * Smoke test for the Kociemba two-phase solver.
 *
 * Runs in Node via `pnpm exec tsx test_smoke.ts`. Bypasses the worker
 * (which uses Vite's ?worker import not available outside the bundler).
 *
 * Generates N random-state cubes; solves each; verifies that applying the
 * inverse-of-solution scramble to a solved cube yields a NON-solved state
 * matching the random cube. Prints scramble length distribution.
 */

import {
  applySequence,
  cloneCubie,
  invertSequence,
  isSolvedCubie,
  parseMoves,
  solvedCubie,
  formatMoves,
  cubieEquals,
} from './cube';
import { buildMoveTables } from './movetables';
import { buildPruneTables } from './prune';
import { solveCube } from './search';
import { randomCubie } from './randomstate';

function ts(): string {
  return `+${(Date.now() - START).toFixed(0).padStart(6)}ms`;
}
const START = Date.now();

async function main(): Promise<void> {
  console.log(`[${ts()}] building move tables…`);
  const mt = buildMoveTables(msg => console.log(`[${ts()}]   ${msg}`));

  console.log(`[${ts()}] building prune tables…`);
  const pt = buildPruneTables(mt, msg => console.log(`[${ts()}]   ${msg}`));

  const N = 100;
  console.log(`[${ts()}] generating ${N} random-state scrambles…`);
  const lengths: number[] = [];
  let failures = 0;

  for (let i = 0; i < N; i++) {
    const target = randomCubie();
    const sol = solveCube(target, mt, pt);

    // Verify: applying solution to target should give solved cube.
    const afterSol = applySequence(cloneCubie(target), sol);
    if (!isSolvedCubie(afterSol)) {
      console.error(`  [${i}] solve verify failed: applying solution to target didn't reach solved`);
      failures++;
      continue;
    }

    // Build scramble = inverse of solution.
    const scrambleSeq = invertSequence(sol);
    const scrambleStr = formatMoves(scrambleSeq);

    // Verify: applying scramble to solved cube should give target.
    const fromSolved = applySequence(solvedCubie(), scrambleSeq);
    if (!cubieEquals(fromSolved, target)) {
      console.error(`  [${i}] scramble verify failed: solved + scramble != target`);
      failures++;
      continue;
    }

    // Verify: parsed scramble string roundtrips.
    const reparsed = parseMoves(scrambleStr);
    if (reparsed.length !== scrambleSeq.length) {
      console.error(`  [${i}] parse roundtrip length mismatch`);
      failures++;
      continue;
    }

    // Verify: not solved (the random cube should be scrambled).
    if (isSolvedCubie(target)) {
      console.warn(`  [${i}] target is solved (zero-length scramble) — rare but valid`);
    }

    lengths.push(scrambleSeq.length);
  }

  console.log(`[${ts()}] verification: ${N - failures}/${N} OK, ${failures} failures`);

  // Length distribution
  const histo: Record<number, number> = {};
  for (const l of lengths) histo[l] = (histo[l] ?? 0) + 1;
  const min = Math.min(...lengths);
  const max = Math.max(...lengths);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;

  console.log(`[${ts()}] scramble length: min=${min} max=${max} mean=${mean.toFixed(2)}`);
  console.log('  histogram:');
  for (let l = min; l <= max; l++) {
    const c = histo[l] ?? 0;
    const bar = '█'.repeat(Math.round(c * 30 / N));
    console.log(`    ${String(l).padStart(2)}: ${String(c).padStart(3)} ${bar}`);
  }

  if (failures > 0) {
    proc?.exit(1);
  }
}

interface ProcLike { exit(code: number): void }
const proc = (globalThis as unknown as { process?: ProcLike }).process;

main().catch(e => {
  console.error(e);
  proc?.exit(1);
});
