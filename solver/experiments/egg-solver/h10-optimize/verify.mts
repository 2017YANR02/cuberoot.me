/** Independent replay; only small result files, never the pruning table. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cube3x3x3 } from '../../../../core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js';

type Case = { id: string; scramble: string; optimalLength: number };
export async function verifyResults(path: string, cases: Case[], lanes: number) {
  const rows = readFileSync(path, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
  const totals = rows.filter(row => row.type === 'total'), solved = rows.filter(row => row.type === 'solved');
  assert.equal(rows.length, cases.length + 1); assert.equal(totals.length, 1); assert.equal(solved.length, cases.length);
  const total = totals[0];
  assert.equal(total.cubes, cases.length); assert.equal(total.threads, 16);
  assert.equal(total.concurrency, 1); assert.equal(total.lanes, lanes);
  const model = (await cube3x3x3.kpuzzle()).defaultPattern(), seen = new Set<number>();
  for (const row of solved) {
    assert(Number.isInteger(row.index) && row.index >= 0 && row.index < cases.length && !seen.has(row.index));
    seen.add(row.index);
    const input = cases[row.index];
    assert.equal(row.ok, true); assert.equal(row.length, input.optimalLength, `Nonoptimal result ${input.id}`);
    const moves = row.moves.trim().split(/\s+/).filter(Boolean);
    assert(moves.every((move: string) => /^[URFDLB](?:2|')?$/.test(move)));
    assert.equal(moves.length, row.length);
    assert(model.applyAlg(input.scramble).applyAlg(row.moves).isIdentical(model), `Replay failed ${input.id}`);
    for (const key of ['seconds', 'nodes', 'lookups']) assert(Number.isFinite(row[key]) && row[key] >= 0);
  }
  const times = solved.map(row => row.seconds).sort((a, b) => a - b);
  const sum = (key: string) => solved.reduce((n, row) => n + row[key], 0);
  return { verifiedSolutions: solved.length, searchSeconds: sum('seconds'), p50Seconds: times[Math.ceil(times.length * .5) - 1],
    p95Seconds: times[Math.ceil(times.length * .95) - 1], nodes: sum('nodes'), lookups: sum('lookups'), total };
}
