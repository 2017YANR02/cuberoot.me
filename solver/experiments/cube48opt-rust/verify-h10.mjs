#!/usr/bin/env node
// Low-memory C/Rust coordinate differential only. Both fixed helper binaries
// read ~2 MB auxiliary data and sampled 64-byte main rows with seek/read.
// No mmap, full-table validation, solver, WASM instance or table generation.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getVariant } from './variants.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const TABLE_BYTES = 30_336_314_216;
const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const json = file => JSON.parse(readFileSync(file, 'utf8'));
const save = (file, data) => writeFileSync(file, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
let output;

function filesUnder(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(file) : entry.isFile() ? [file] : [];
  });
}

function execute(binary, table, input, prefix) {
  const result = spawnSync(binary, [table], { input, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 60_000 });
  writeFileSync(path.join(output, `${prefix}.stdout`), result.stdout ?? '', { flag: 'wx' });
  writeFileSync(path.join(output, `${prefix}.stderr`), result.stderr ?? '', { flag: 'wx' });
  assert(!result.error, result.error?.message);
  assert.equal(result.signal, null, `${prefix} signal`);
  assert.equal(result.status, 0, `${prefix}: ${result.stderr}`);
  return result.stdout;
}

function main() {
  assert.equal(process.argv.length, 7, 'usage: verify-h10.mjs C_ORACLE_BINARY RUST_EXAMPLE_BINARY H10_TABLE OPT1_FIXTURES_JSON NEW_OUT_DIR');
  const [cBinary, rustBinary, table, fixtureFile] = process.argv.slice(2, 6).map(file => realpathSync(file));
  assert.equal(cBinary, path.join(ROOT, '.tmp/cubeopt-reverse/h10-build/h10-oracle'), 'fixed low-memory C helper required');
  assert.equal(rustBinary, path.join(HERE, 'target/release/examples/verify_h10_coordinates'), 'fixed low-memory Rust helper required');
  assert.equal(table, realpathSync(path.join(ROOT, 'solver/tables/h48-nissy-core/h48h10.dat')), 'fixed preserved H10 table required');
  output = path.resolve(process.argv[6]);
  assert(!existsSync(output), `refusing to overwrite ${output}`);
  mkdirSync(output, { recursive: true });
  const before = statSync(table);
  assert(before.isFile()); assert.equal(before.size, TABLE_BYTES);
  const fixtures = json(fixtureFile);
  const physicalFile = path.join(path.dirname(fixtureFile), 'physical-verification.json');
  const physical = json(physicalFile), opt1 = getVariant('1');
  assert.equal(fixtures.schema, 'cuberoot.cube48opt1.fixtures.v1');
  assert.equal(fixtures.wasmSha256, opt1.wasmSha256);
  assert.equal(fixtures.wrapperSha256, opt1.wrapperSha256);
  assert.equal(fixtures.fixtures.length, 407);
  assert.equal(physical.schema, 'cuberoot.cube48opt1.physical-verification.v1');
  assert.equal(physical.sourceWasmSha256, opt1.wasmSha256);
  assert.equal(physical.fixtureFileSha256, sha256(fixtureFile));
  assert.equal(physical.fixtures, 407); assert.equal(physical.quarterAndHalfTurns, 18);
  assert.equal(physical.twoMoves, 324); assert.equal(physical.longScrambles, 64);
  assert.equal(physical.independentModel, 'cubing.js cube3x3x3');
  const input = fixtures.fixtures.map((fixture, i) => {
    assert.equal(fixture.index, i);
    assert(typeof fixture.scramble === 'string' && /^(?:[URFDLB](?:2|')?(?:\s+|$))*$/.test(fixture.scramble));
    assert(!/[\t\r\n]/.test(fixture.scramble));
    return `${i}\t${fixture.scramble}\n`;
  }).join('');
  const sourceFiles = [
    path.join(HERE, 'h10-oracle.c'), path.join(HERE, 'src/h10_coord.rs'),
    path.join(HERE, 'examples/verify_h10_coordinates.rs'), fileURLToPath(import.meta.url),
    path.join(HERE, 'variants.mjs'), path.join(HERE, 'src/cube.rs'),
    ...filesUnder(path.join(ROOT, 'solver/vendor/nissy-core/src')).filter(file => /\.[ch]$/.test(file)),
    path.join(ROOT, 'solver/vendor/nissy-core/LICENSE'), path.join(ROOT, 'solver/vendor/nissy-core/VENDOR.md'),
  ];
  const hashes = {};
  for (const file of sourceFiles) {
    const relative = path.relative(ROOT, file), destination = path.join(output, 'source', relative);
    mkdirSync(path.dirname(destination), { recursive: true }); copyFileSync(file, destination);
    hashes[relative] = sha256(destination);
  }
  const frozenC = path.join(output, 'c-oracle-binary'), frozenRust = path.join(output, 'rust-coordinate-binary');
  copyFileSync(cBinary, frozenC); copyFileSync(rustBinary, frozenRust);
  copyFileSync(fixtureFile, path.join(output, 'fixtures.json'));
  copyFileSync(physicalFile, path.join(output, 'physical-verification.json'));
  writeFileSync(path.join(output, 'cases.tsv'), input, { flag: 'wx' });
  const provenance = {
    schema: 'cuberoot.nissy-h10.coordinate-input.v1', mode: 'small-coordinate-samples',
    cBinary, rustBinary, cBinarySha256: sha256(frozenC), rustBinarySha256: sha256(frozenRust),
    table, tableBefore: { size: before.size, mtimeMs: before.mtimeMs },
    fixtureFile, fixtureFileSha256: sha256(fixtureFile), physicalVerificationSha256: sha256(physicalFile),
    independentModel: physical.independentModel, sourceHashes: hashes,
  };
  save(path.join(output, 'input.json'), provenance);
  const oracle = execute(frozenC, table, input, 'oracle');
  const rows = oracle.trimEnd().split('\n'); assert.equal(rows.length, 814);
  for (const [i, row] of rows.entries()) {
    const fields = row.split('\t'), fixture = fixtures.fixtures[Math.floor(i / 2)];
    assert.equal(fields.length, 64); assert.equal(fields[0], String(fixture.index));
    assert.equal(fields[1], String(i % 2)); assert.equal(fields[2], fixture.scramble);
    assert(/^[a-f0-9]{40}$/.test(fields[3]));
    fields.slice(16).forEach(value => assert(/^[a-f0-9]{24}$/.test(value)));
    fields.slice(4, 16).forEach(value => assert(/^\d+$/.test(value) && Number.isSafeInteger(Number(value))));
  }
  const result = JSON.parse(execute(frozenRust, table, oracle, 'native'));
  assert.equal(result.inputCases, 407); assert.equal(result.normalInverseStates, 814);
  assert.equal(result.edgeTransformations, 39_072); assert.equal(result.leftHalfTurnChecks, 4_884);
  assert.equal(result.sampledMainRows, 814); assert.equal(result.allEqual, true);
  assert.equal(typeof result.h10FastCoordEnabled, 'boolean');
  assert.deepEqual(result.fastScalar, {
    states: 5_698, baseStates: 814, leftHalfTurnStates: 4_884,
    rawEsepComparisons: 5_698, rawEoComparisons: 5_698,
    mainIndexComparisons: 5_698, eoesepIndexComparisons: 5_698,
    edgeTransformations: 273_504,
  });
  assert(Number.isSafeInteger(result.zeroCodes) && result.zeroCodes > 0);
  assert(Number.isSafeInteger(result.nonzeroCodes) && result.nonzeroCodes > 0);
  assert.equal(result.zeroCodes + result.nonzeroCodes, 814);
  const after = statSync(table);
  assert.equal(after.size, before.size); assert.equal(after.mtimeMs, before.mtimeMs);
  save(path.join(output, 'report.json'), {
    schema: 'cuberoot.nissy-h10.coordinate-differential.v1', ...result,
    cBinarySha256: provenance.cBinarySha256, rustBinarySha256: provenance.rustBinarySha256,
    fixtureFileSha256: provenance.fixtureFileSha256, physicalVerificationSha256: provenance.physicalVerificationSha256,
    oracleOutputSha256: sha256(path.join(output, 'oracle.stdout')), sourceHashes: hashes,
    table, tableBytes: before.size, tableSizeAndMtimeUnchanged: true,
    limitations: [
      'Only fixed coordinate fixtures, sampled main rows and auxiliary bounds are checked; no complete PDB scan, solving or performance measurement.',
      'Physical-model evidence is linked to the exact prior cubing.js fixture verification; this script does not repeat that physical-model derivation.',
      'No table SHA-256 is computed here: the 30 GB file is read only at auxiliary segments and 814 individual cache lines per helper.',
      'The independent fixed C helper uses the preserved Nissy implementation; native coordinate and scalar sampled-row decoder are Rust.',
      'Fast/scalar comparisons cover every base state and each of its six left-half-turn states, including all 48 edge transformations. The report records whether the Rust helper enabled h10-fast-coord.',
    ],
  });
  process.stdout.write(JSON.stringify({ output, ...result }) + '\n');
}

try { main(); } catch (error) {
  if (output && existsSync(output) && !existsSync(path.join(output, 'failure.json'))) {
    save(path.join(output, 'failure.json'), { error: error.stack ?? String(error) });
  }
  process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1;
}
