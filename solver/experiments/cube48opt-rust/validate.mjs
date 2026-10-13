#!/usr/bin/env node
// Invoke under guard.mts: validation intentionally performs real bounded search.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createOracle, solveCases, VARIANT, TABLE_SIZE } from './oracle.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const MOVES = ['U', 'R', 'F', 'D', 'L', 'B'].flatMap((face) => [face, `${face}2`, `${face}'`]);
const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
async function hashStream(file) { const digest = createHash('sha256'); for await (const chunk of createReadStream(file, { highWaterMark: 4 * 1024 * 1024 })) digest.update(chunk); return digest.digest('hex'); }
const save = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const patternKey = (pattern) => {
  const p = pattern.patternData;
  return JSON.stringify([p.CORNERS.pieces, p.CORNERS.orientation, p.EDGES.pieces, p.EDGES.orientation]);
};

export function shallowCorpus(puzzle) {
  const initial = puzzle.defaultPattern();
  const seen = new Set([patternKey(initial)]);
  const queue = [{ pattern: initial, scramble: '', htm: 0 }];
  const counts = [1, 0, 0, 0];
  for (let index = 0; index < queue.length; index++) {
    const item = queue[index];
    if (item.htm === 3) continue;
    for (const movement of MOVES) {
      const pattern = item.pattern.applyAlg(movement);
      const key = patternKey(pattern);
      if (seen.has(key)) continue;
      seen.add(key);
      const htm = item.htm + 1;
      counts[htm]++;
      queue.push({ pattern, scramble: `${item.scramble} ${movement}`.trim(), htm });
    }
  }
  assert.deepEqual(counts, [1, 18, 243, 3240]);
  return { counts, cases: queue.map(({ scramble, htm }, i) => ({ id: `bfs${i}`, scramble, htm })) };
}

export function replay(puzzle, item, row) {
  assert.equal(typeof row.solution, 'string', `missing solution: ${item.id}`);
  assert(/^(?:[URFDLB](?:2|')?(?:\s+|$))*$/.test(row.solution));
  const length = row.solution ? row.solution.trim().split(/\s+/).length : 0;
  assert.equal(row.length, length, `move count mismatch: ${item.id}`);
  if (item.htm !== undefined) assert.equal(length, item.htm, `optimal distance mismatch: ${item.id}`);
  const state = puzzle.defaultPattern().applyAlg(`${item.scramble} ${row.solution}`).patternData;
  const solved = puzzle.defaultPattern().patternData;
  assert.deepEqual(state.CORNERS, solved.CORNERS, `corners: ${item.id}`);
  assert.deepEqual(state.EDGES, solved.EDGES, `edges: ${item.id}`);
}

function runNative(binary, smallFile, table, cases, contexts, maxDepth, maxNodes, outputPath) {
  const started = performance.now();
  const result = spawnSync(binary, ['solve', smallFile, table, String(contexts), String(maxDepth), String(maxNodes)], {
    input: cases.map((item) => `${item.id}\t${item.scramble}\n`).join(''), encoding: 'utf8', maxBuffer: 24 * 1024 * 1024,
  });
  writeFileSync(outputPath, result.stdout ?? '', { flag: 'wx' });
  writeFileSync(`${outputPath}.stderr`, result.stderr ?? '', { flag: 'wx' });
  assert(!result.error, result.error?.message);
  assert.equal(result.signal, null, `native signal ${result.signal}`);
  assert.equal(result.status, 0, result.stderr);
  const rows = result.stdout.trim().split('\n').map((line) => JSON.parse(line));
  assert.equal(rows.length, cases.length, 'native row coverage');
  const seen = new Set();
  rows.forEach((row, i) => {
    assert.equal(row.id, cases[i].id); assert(!seen.has(row.id)); seen.add(row.id);
    assert.equal(row.contexts, contexts);
    assert.equal(typeof row.cancelled, 'boolean');
    assert(Number.isFinite(row.seconds) && row.seconds >= 0);
    for (const field of ['nodes', 'probes', 'inverse_probes', 'cache_reuses', 'splits', 'face_prunes', 'face_siblings_removed']) {
      assert(Number.isSafeInteger(row[field]) && row[field] >= 0, `invalid ${field}`);
    }
    assert(row.nodes <= maxNodes, 'node budget exceeded');
    assert(row.completed_depth === null || Number.isSafeInteger(row.completed_depth) && row.completed_depth >= 0 && row.completed_depth <= maxDepth);
    if (row.solution !== null) {
      assert.equal(row.cancelled, false, 'cancelled result claimed solved');
      assert(row.completed_depth === null || row.completed_depth < row.length, 'found depth falsely marked exhausted');
    } else assert.equal(row.length, null);
  });
  return { rows, elapsedMs: performance.now() - started };
}

async function main() {
  const [mode, binaryArg, smallArg, tableArg, outArg] = process.argv.slice(2);
  assert(['shallow', 'suite'].includes(mode) && process.argv.length === 7,
    'usage: validate.mjs shallow|suite ABS_NATIVE ABS_SMALL_DIR ABS_TABLE ABS_NEW_OUT_DIR');
  const [binary, small, table, out] = [binaryArg, smallArg, tableArg, outArg].map((arg) => path.resolve(arg));
  assert(!existsSync(out), `refusing to overwrite ${out}`); mkdirSync(out, { recursive: true });
  const { cube3x3x3 } = await import(pathToFileURL(path.join(ROOT, 'core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js')).href);
  const puzzle = await cube3x3x3.kpuzzle();
  const tableManifest = JSON.parse(readFileSync(path.join(path.dirname(table), 'table.json'), 'utf8'));
  const smallManifest = JSON.parse(readFileSync(path.join(small, 'small-tables.json'), 'utf8'));
  assert.equal(tableManifest.schema, `cuberoot.cube48opt${VARIANT.id}.table.v1`);
  assert.equal(tableManifest.wasmSha256, VARIANT.wasmSha256);
  assert.equal(smallManifest.schema, `cuberoot.cube48opt${VARIANT.id}.small-tables.v1`);
  assert.equal(smallManifest.wasmSha256, VARIANT.wasmSha256);
  assert.equal(hash(path.join(small, 'small-memory.bin')), smallManifest.sha256);
  const tableBefore = statSync(table); assert.equal(tableBefore.size, TABLE_SIZE);
  assert.equal(await hashStream(table), tableManifest.tableSha256, 'table SHA-256 mismatch');
  let cases, bfsCounts = null;
  if (mode === 'shallow') {
    const corpus = shallowCorpus(puzzle); cases = corpus.cases; bfsCounts = corpus.counts;
  } else {
    const historical = JSON.parse(readFileSync(path.join(ROOT, 'solver/testdata/benchmarks/h48-h10-2026-10-04.json'), 'utf8'));
    assert.equal(historical.sample.rows.length, 60);
    const real = historical.sample.rows.filter((row) => row.htm === 15);
    assert.equal(real.length, 1, 'historical HTM-15 fixture set changed');
    assert.equal(real[0].id, '3649581001');
    const shorts = ['', 'R2', 'U2', 'F2', "D U'", "R U R' F2", 'R2 U2 F2 D2 L2', "F R U R' U' F'", "R2 F2 U D' L2 B2", "R U2 R' F2 D L2 B'"];
    cases = [...shorts.map((scramble, index) => ({ id: `short${index}`, scramble })), ...real.map((row) => ({ ...row, id: `historical${row.id}` }))];
  }
  const casesPath = path.join(out, 'cases.json'); save(casesPath, { cases, bfsCounts });
  const provenance = { variant: VARIANT.id, native: binary, nativeSha256: hash(binary), table, tableSha256: tableManifest.tableSha256, smallTablesSha256: hash(path.join(small, 'small-memory.bin')), validateSha256: hash(fileURLToPath(import.meta.url)), variantsSha256: hash(path.join(HERE, 'variants.mjs')) };
  save(path.join(out, 'input.json'), { mode, ...provenance, cases: cases.length, bfsCounts, nativeContexts: [1, 8], wasmThreads: 1, wasmGroups: 1, wasmInternalContexts: 8, nativeMaxNodes: mode === 'shallow' ? 50_000 : 50_000_000 });
  const native = [];
  const nodes = mode === 'shallow' ? 50_000 : 50_000_000;
  for (const contexts of [1, 8]) {
    const result = runNative(binary, path.join(small, 'small-memory.bin'), table, cases, contexts, mode === 'shallow' ? 3 : 20, nodes, path.join(out, `native-${contexts}.jsonl`));
    for (let i = 0; i < cases.length; i++) { assert.equal(result.rows[i].cancelled, false, `unexpected budget exhaustion ${cases[i].id}`); replay(puzzle, cases[i], result.rows[i]); }
    native.push(result);
  }
  // These distinguish explicit cancellation from an exhausted depth and a found solution.
  const bounded = [{ id: 'bounded3', scramble: 'R U F', htm: 3 }];
  for (const contexts of [1, 8]) {
    const limited = runNative(binary, path.join(small, 'small-memory.bin'), table, bounded, contexts, 20, 1, path.join(out, `budget-${contexts}.jsonl`)).rows[0];
    assert.equal(limited.cancelled, true); assert.equal(limited.solution, null);
    assert(limited.completed_depth === null || limited.completed_depth < 3);
    const shallow = runNative(binary, path.join(small, 'small-memory.bin'), table, bounded, contexts, 1, 50_000, path.join(out, `depth-${contexts}.jsonl`)).rows[0];
    assert.equal(shallow.cancelled, false); assert.equal(shallow.solution, null); assert.equal(shallow.completed_depth, 1);
  }
  const lines = [];
  const oracle = await createOracle({ log(line) { lines.push(line); } });
  const wasmPath = path.join(out, 'wasm.jsonl');
  await solveCases(oracle, table, casesPath, wasmPath, lines);
  const wasmRows = readFileSync(wasmPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line)).filter((row) => row.type === 'solution');
  assert.equal(wasmRows.length, cases.length);
  for (let i = 0; i < cases.length; i++) {
    assert.equal(wasmRows[i].id, cases[i].id);
    replay(puzzle, cases[i], wasmRows[i]);
    for (const result of native) assert.equal(result.rows[i].length, wasmRows[i].length, `native/WASM length ${cases[i].id}`);
  }
  const tableAfter = statSync(table);
  assert.equal(tableAfter.size, tableBefore.size); assert.equal(tableAfter.mtimeMs, tableBefore.mtimeMs);
  const report = {
    schema: `cuberoot.cube48opt${VARIANT.id}.native-validation.v1`, mode, ...provenance,
    cases: cases.length, independentBfsDistanceCounts: bfsCounts, verifiedSolutions: cases.length * 3,
    native: native.map((run, i) => ({ contexts: [1, 8][i], role: i === 0 ? 'semantic validation' : 'same-context correctness comparison', solved: run.rows.length, elapsedMsIncludingProcess: run.elapsedMs, totalSearchSeconds: run.rows.reduce((sum, row) => sum + row.seconds, 0), geometricMeanSearchSeconds: run.rows.every((row) => row.seconds > 0) ? Math.exp(run.rows.reduce((sum, row) => sum + Math.log(row.seconds), 0) / run.rows.length) : null, nodes: run.rows.reduce((sum, row) => sum + row.nodes, 0) })),
    wasm: { threads: 1, groups: 1, internalContexts: 8, solved: wasmRows.length, totalElapsedMs: wasmRows.reduce((sum, row) => sum + row.elapsedMs, 0), geometricMeanElapsedMs: wasmRows.every((row) => row.elapsedMs > 0) ? Math.exp(wasmRows.reduce((sum, row) => sum + Math.log(row.elapsedMs), 0) / wasmRows.length) : null },
    budgetAndDepthBoundaries: 'passed for native contexts 1 and 8',
    limitations: ['WASM has no public node budget; the outer guard supplies time and resource limits.', 'Native nodes count inspected states; WASM prints its own probe counters. They are not directly comparable.', 'Performance here includes per-case warm-up and is a correctness run, not a controlled speed benchmark.', 'Complete shallow BFS proves only the tested distances; deeper corpus agreement is not a global correctness proof.'],
  };
  save(path.join(out, 'report.json'), report);
  return { mode, out, cases: cases.length, verifiedSolutions: report.verifiedSolutions, nativeNodes: report.native.map((run) => run.nodes) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((result) => process.stdout.write(JSON.stringify(result) + '\n', () => process.exit(0)), (error) => process.stderr.write(`${error.stack ?? error}\n`, () => process.exit(1)));
}
