#!/usr/bin/env node
// Fixed, small differential corpus. Does not instantiate WASM or load a PDB.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getVariant } from './variants.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const hex = (value, bytes) => assert(typeof value === 'string' && new RegExp(`^[0-9a-f]{${bytes * 2}}$`).test(value), 'invalid oracle hex');

function main() {
  assert.equal(process.argv.length, 6,
    'usage: verify-coordinates.mjs ABS_EXAMPLE_BINARY ABS_SMALL_DIR ABS_HOT_QUERY_JSON ABS_NEW_REPORT_JSON');
  const [binary, smallDir, hotFile, output] = process.argv.slice(2).map((value) => path.resolve(value));
  const variant = getVariant();
  const schema = (name) => `cuberoot.cube48opt${variant.id}.${name}.v1`;
  assert(!existsSync(output), `refusing to overwrite ${output}`);
  const snapshot = path.join(smallDir, 'small-memory.bin');
  const fixtureFile = path.join(smallDir, 'fixtures.json');
  const physicalFile = path.join(smallDir, 'physical-verification.json');
  const metadata = json(path.join(smallDir, 'small-tables.json'));
  const fixtures = json(fixtureFile);
  const hot = json(hotFile);
  const physical = json(physicalFile);
  assert.equal(metadata.schema, schema('small-tables'));
  assert.equal(fixtures.schema, schema('fixtures'));
  assert.equal(hot.schema, schema('hot-query'));
  assert.equal(physical.schema, schema('physical-verification'));
  assert.equal(sha256(path.join(ROOT, `core/packages/client/public/cubeopt/cube48opt${variant.id}.wasm`)), variant.wasmSha256);
  assert.equal(sha256(path.join(ROOT, `core/packages/client/public/cubeopt/cube48opt${variant.id}.mjs`)), variant.wrapperSha256);
  for (const source of [metadata, fixtures, hot]) {
    assert.equal(source.wasmSha256, variant.wasmSha256);
    assert.equal(source.wrapperSha256, variant.wrapperSha256);
  }
  assert.equal(sha256(snapshot), metadata.sha256, 'small-memory SHA-256 mismatch');
  assert.equal(readFileSync(snapshot).length, variant.smallMemoryBytes);
  assert.equal(hot.fixturesSha256, sha256(fixtureFile), 'query/fixture provenance mismatch');
  assert.equal(physical.sourceWasmSha256, variant.wasmSha256, 'physical model WASM provenance');
  assert.equal(physical.fixtureFileSha256, sha256(fixtureFile), 'physical model fixture provenance');
  assert.equal(physical.independentModel, 'cubing.js cube3x3x3');
  assert.equal(physical.fixtures, 407);
  assert.equal(physical.quarterAndHalfTurns, 18);
  assert.equal(physical.twoMoves, 324);
  assert.equal(physical.longScrambles, 64);
  assert.equal(fixtures.fixtures.length, 407, 'complete fixed fixture corpus required');
  assert.equal(hot.rows.length, 407, 'complete fixed hot-query corpus required');
  const rows = new Map();
  for (const row of hot.rows) {
    assert(Number.isInteger(row.index) && row.index >= 0 && row.index < 407);
    assert(!rows.has(row.index), 'duplicate query index');
    for (const index of [row.normal, row.inverse]) assert(Number.isSafeInteger(index) && index >= 0 && index < variant.tableBytes * 4);
    rows.set(row.index, row);
  }
  const input = fixtures.fixtures.map((fixture, index) => {
    assert.equal(fixture.index, index, 'fixture order/coverage');
    const row = rows.get(index);
    assert.equal(row.scramble, fixture.scramble, 'query/fixture scramble mismatch');
    assert(typeof fixture.scramble === 'string' && !/[\t\r\n]/.test(fixture.scramble));
    hex(fixture.cube, 20); hex(fixture.fast, 48);
    assert.equal(fixture.conjugates.length, 48);
    fixture.conjugates.forEach((value) => hex(value, 20));
    return [index, fixture.cube, fixture.fast, ...fixture.conjugates, fixture.scramble, row.normal, row.inverse].join('\t');
  }).join('\n') + '\n';
  const native = spawnSync(binary, [snapshot], { input, env: { ...process.env, CUBEOPT_VARIANT: String(variant.id) }, encoding: 'utf8', maxBuffer: 1024 * 1024, timeout: 30_000 });
  assert(!native.error, native.error?.message);
  assert.equal(native.signal, null, `native signal ${native.signal}`);
  assert.equal(native.status, 0, native.stderr);
  const result = JSON.parse(native.stdout);
  assert(['scalar', 'neon'].includes(result.pairedMoveBackend), 'unknown paired move backend');
  assert.equal(result.coordinateBackend, process.arch === 'arm64' ? 'neon' : 'scalar');
  const oracleIndices = hot.rows.flatMap((row) => [row.normal, row.inverse]);
  const maxObservedIndex = Math.max(...oracleIndices);
  const indicesAboveU32 = oracleIndices.filter((index) => index > 0xffff_ffff).length;
  assert.equal(indicesAboveU32 > 0, variant.id >= 6, 'corpus must cover wide coordinates in Opt6..9');
  assert.deepEqual(result, {
    variant: variant.id,
    states: 407, conjugates: 19_536, inverseMoveIdentities: 7_326,
    coordinateReference: 407, fastScalarCoordinates: 54_538,
    originalHotQueryIndices: 814, solvedIndex: 2, allEqual: true,
    pairedMoveStates: 7_326, pairedMoveBackend: result.pairedMoveBackend,
    coordinateBackend: result.coordinateBackend, maxObservedIndex, indicesAboveU32,
  });
  const report = {
    schema: schema('rust-coordinate-diff'), ...result,
    native: binary, nativeSha256: sha256(binary), wasmSha256: variant.wasmSha256,
    snapshotSha256: metadata.sha256, fixturesSha256: sha256(fixtureFile),
    hotQuerySha256: sha256(hotFile), verifierSha256: sha256(fileURLToPath(import.meta.url)),
    independentModel: physical.independentModel, physicalVerificationSha256: sha256(physicalFile), independentPhysicalStates: physical.fixtures,
    queryMethod: hot.method ?? (hot.table ? 'original step1_query with loaded table' : 'not recorded in oracle output'),
    limitations: ['Only the fixed 407-state corpus and its derived states are checked.', 'Independent physical-model verification is linked by its exact fixture SHA-256; this entry does not rerun cubing.js.', 'Fastcube padding is excluded from WASM comparison; native padding must be zero.', 'This checks coordinates and state arithmetic, not pruning values, search completeness, or speed.'],
  };
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  process.stdout.write(JSON.stringify({ output, ...result }) + '\n');
}

try { main(); } catch (error) { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1; }
