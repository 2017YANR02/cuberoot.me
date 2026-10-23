/** Tiny algebra/checkpoint regression only; never enumerates a puzzle graph. */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { puzzles } from 'cubing/puzzles';
import { productCoordinateAllStates, type ProductCoordinateMoves } from './exact-coordinate-bfs.mts';
import { completedProductCoordinates } from './exact-coordinate-checkpoint.mts';
import { pyraminxTipsAllStates, convolvePyraminxTips } from './derive-pyraminx-tips-distribution.mts';
import { validateDinoDownloadLifting } from './dino-exact-distribution.mts';

const directory = mkdtempSync(join(tmpdir(), 'exact-state-stream-check-'));
try {
  const model: ProductCoordinateMoves = { firstCount: 4, secondCount: 2, moveCount: 3,
    firstMoves: Uint8Array.of(1, 2, 0, 2, 0, 1, 0, 1, 2, 3, 3, 3),
    secondMoves: Uint8Array.of(0, 0, 1, 1, 1, 0) };
  const first = completedProductCoordinates(model, { checkpointDirectory: directory });
  assert.equal(first.total, 6); assert.equal(first.distance.length, 8);
  const restored = completedProductCoordinates(model, { checkpointDirectory: directory });
  assert.deepEqual(restored.distance, Buffer.from(first.distance));
  assert.deepEqual(restored.histogram, first.histogram);
  const a = productCoordinateAllStates(model, ['U', "U'", 'R2'], first, m => m === 2 ? 2 : m ^ 1);
  const b = productCoordinateAllStates(model, ['U', "U'", 'R2'], restored, m => m === 2 ? 2 : m ^ 1);
  assert.equal(a.resumeKey, b.resumeKey);
  const all = [...a];
  for (let row = 0; row <= all.length; row++) assert.deepEqual([...b.resume(row)], all.slice(row));
  for (const row of all) assert.equal(row.scramble.split(' ').filter(Boolean).length, row.depth);
  const checkpoint = JSON.parse(readFileSync(join(directory, 'product-checkpoint.json'), 'utf8'));
  const bytes = readFileSync(join(directory, checkpoint.distanceFile)); bytes[1] ^= 1;
  writeFileSync(join(directory, checkpoint.distanceFile), bytes);
  assert.throws(() => completedProductCoordinates(model, { checkpointDirectory: directory }), /checksum mismatch/);

  // A three-state U subgroup supplies a small, genuine Pyraminx core. Its 81
  // relative-tip states verify combination ordering and resume within a core.
  const coreRows = [{ depth: 0, scramble: '' }, { depth: 1, scramble: 'U' }, { depth: 1, scramble: "U'" }];
  const core = { total: 3, resumeKey: 'tiny-U-subgroup', resume: (row: number) => coreRows.slice(row),
    [Symbol.iterator]: () => coreRows[Symbol.iterator]() };
  const combined = pyraminxTipsAllStates(core, 3), rows = [...combined];
  assert.equal(rows.length, 243);
  for (const row of [0, 1, 80, 81, 82, 161, 242, 243]) assert.deepEqual([...combined.resume(row)], rows.slice(row));
  const puzzle = await puzzles.pyraminx.kpuzzle(), seen = new Set<string>(), histogram: number[] = [];
  for (const row of rows) {
    const state = puzzle.defaultPattern().applyAlg(row.scramble);
    seen.add(JSON.stringify(state.patternData)); histogram[row.depth] = (histogram[row.depth] ?? 0) + 1;
    assert.equal(row.scramble.split(' ').filter(Boolean).length, row.depth);
  }
  assert.equal(seen.size, 243); assert.deepEqual(histogram, convolvePyraminxTips([1, 2]));
  const dino = validateDinoDownloadLifting();
  console.log(JSON.stringify({ sparseRows: all.length, resumeBoundaries: 15, corruptedCheckpointRejected: true,
    independentPyraminxStates: seen.size, ...dino }, null, 2));
} finally { rmSync(directory, { recursive: true, force: true }); }
