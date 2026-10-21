#!/usr/bin/env node
// Read-only upstream WASM oracle. Generation/solving are explicit, externally monitored modes.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, createReadStream, existsSync, fsyncSync, linkSync, mkdirSync, openSync, readSync, readFileSync, statSync, unlinkSync, writeFileSync, writeSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { availableParallelism } from 'node:os';
import { FUNCTION_SPECS, getVariant, auditBinary } from './variants.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
export const VARIANT = getVariant();
const SOURCE = path.join(ROOT, `core/packages/client/public/cubeopt/cube48opt${VARIANT.id}.wasm`);
const WRAPPER = path.join(ROOT, `core/packages/client/public/cubeopt/cube48opt${VARIANT.id}.mjs`);
export const TABLE_SIZE = VARIANT.tableBytes;
export const TABLE_NAME = VARIANT.tableName;
const EXPECTED_WASM = VARIANT.wasmSha256;
const EXPECTED_WRAPPER = VARIANT.wrapperSha256;
const EXTRA_EXPORTS = Object.fromEntries(Object.entries(FUNCTION_SPECS).map(([name, spec]) => [name, spec.index]));
const schema = (kind) => `cuberoot.cube48opt${VARIANT.id}.${kind}.v1`;
const WINDOW_BYTES = 4 * 1024 * 1024;
const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const json = (data) => JSON.stringify(data, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2) + '\n';

function unsignedLeb(value) {
  assert(Number.isSafeInteger(value) && value >= 0);
  const bytes = [];
  do { const byte = value % 128; value = Math.floor(value / 128); bytes.push(byte | (value ? 128 : 0)); } while (value);
  return Buffer.from(bytes);
}

function readLeb(bytes, cursor) {
  let value = 0, factor = 1;
  for (let count = 0; count < 5; count++) {
    assert(cursor.offset < bytes.length, 'truncated WASM LEB');
    const byte = bytes[cursor.offset++];
    value += (byte & 127) * factor;
    if (!(byte & 128)) return value;
    factor *= 128;
  }
  throw new Error('oversized WASM LEB');
}

// Only the export section is replaced in an in-memory copy. No function, data,
// import, or original file is changed. Function indices are pinned by SHA-256.
export function addOracleExports(original) {
  auditBinary(original, VARIANT);
  const cursor = { offset: 8 };
  while (cursor.offset < original.length) {
    const sectionStart = cursor.offset;
    const id = original[cursor.offset++];
    const length = readLeb(original, cursor);
    const payloadStart = cursor.offset;
    const end = payloadStart + length;
    assert(end <= original.length);
    if (id !== 7) { cursor.offset = end; continue; }
    const count = readLeb(original, cursor);
    const additions = Object.entries(EXTRA_EXPORTS).map(([name, index]) => {
      const encoded = Buffer.from(name);
      return Buffer.concat([unsignedLeb(encoded.length), encoded, Buffer.from([0]), unsignedLeb(index)]);
    });
    const payload = Buffer.concat([unsignedLeb(count + additions.length), original.subarray(cursor.offset, end), ...additions]);
    return Buffer.concat([original.subarray(0, sectionStart), Buffer.from([7]), unsignedLeb(payload.length), payload, original.subarray(end)]);
  }
  throw new Error('upstream WASM has no export section');
}

export async function createOracle({ log = (line) => process.stderr.write(`[wasm] ${line}\n`), smallOnly = false } = {}) {
  const original = readFileSync(SOURCE);
  assert.equal(sha256(readFileSync(WRAPPER)), EXPECTED_WRAPPER, 'upstream wrapper changed: re-audit');
  const patched = addOracleExports(original);
  let rawExports;
  const maximum = smallOnly ? 4096 : VARIANT.linearMemoryLimitPages;
  assert(maximum <= VARIANT.memoryMaximumPages);
  const memoryDescriptor = VARIANT.memory64
    ? { initial: 256n, maximum: BigInt(maximum), shared: true, address: 'i64' }
    : { initial: 256, maximum, shared: true };
  const createModule = (await import(pathToFileURL(WRAPPER).href)).default;
  const module = await createModule({
    print: log, printErr: log,
    // The external guard bounds total RSS and covers synchronous WASM work,
    // workers, pressure and Swapouts. This cap covers only linear memory.
    wasmMemory: new WebAssembly.Memory(memoryDescriptor),
    instantiateWasm(imports, receive) {
      const compiled = new WebAssembly.Module(patched);
      const instance = new WebAssembly.Instance(compiled, imports);
      rawExports = instance.exports;
      receive(instance, compiled);
      return rawExports;
    },
  });
  assert.equal(Number(module.get_table_size()), TABLE_SIZE);
  assert.equal(module.get_table_name(), TABLE_NAME);
  const pointer = (value) => VARIANT.memory64 ? BigInt(value) : value;
  const address = (value) => typeof value === 'bigint' ? Number(value) : value >>> 0;
  const raw = {
    malloc: (size) => address(rawExports.malloc(pointer(size))),
    free: (value) => rawExports.free(pointer(value)),
  };
  for (const [name, spec] of Object.entries(FUNCTION_SPECS)) {
    raw[name] = (...args) => rawExports[name](...args.map((value, i) => spec.parameters[i] === 'p' ? pointer(value) : value));
  }
  return {
    module, raw,
    provenance: { variant: VARIANT.id, memory64: VARIANT.memory64, wasm: SOURCE, wasmSha256: EXPECTED_WASM, wrapper: WRAPPER, wrapperSha256: EXPECTED_WRAPPER, oracleSha256: sha256(readFileSync(fileURLToPath(import.meta.url))), variantsSha256: sha256(readFileSync(path.join(HERE, 'variants.mjs'))), patchedWasmSha256: sha256(patched), extraExports: EXTRA_EXPORTS },
    bytes(start, length) {
      assert(Number.isSafeInteger(start) && Number.isSafeInteger(length) && start >= 0 && length >= 0 && start + length <= module.HEAPU8.byteLength);
      return Buffer.from(module.HEAPU8.buffer, start, length);
    },
  };
}

function freshDirectory(directory) {
  assert(!existsSync(directory), `refusing to overwrite existing directory: ${directory}`);
  mkdirSync(directory, { recursive: true });
}

function saveJson(file, value) { writeFileSync(file, json(value), { flag: 'wx' }); }

// Reuse the same bundle on another machine without trusting recorded absolute
// paths. Stream hashes with bounded memory; never instantiate WASM for reuse.
export async function verifyTableBundle(directory, variant = VARIANT) {
  const tablePath = path.join(directory, variant.tableName);
  const smallPath = path.join(directory, 'small-memory.bin');
  const table = JSON.parse(readFileSync(path.join(directory, 'table.json'), 'utf8'));
  const small = JSON.parse(readFileSync(path.join(directory, 'small-tables.json'), 'utf8'));
  assert.equal(table.schema, `cuberoot.cube48opt${variant.id}.table.v1`, 'wrong table variant');
  assert.equal(small.schema, `cuberoot.cube48opt${variant.id}.small-tables.v1`, 'wrong small-table variant');
  assert.equal(table.wasmSha256, variant.wasmSha256, 'table generator version differs');
  assert.equal(table.wrapperSha256, variant.wrapperSha256, 'table wrapper version differs');
  assert.equal(table.tableBytes, variant.tableBytes, 'wrong table size');
  assert.equal(small.bytes, variant.smallMemoryBytes, 'wrong small-table size');
  for (const [file, bytes, expectedHash] of [
    [tablePath, variant.tableBytes, table.tableSha256],
    [smallPath, variant.smallMemoryBytes, small.sha256],
  ]) {
    assert.match(expectedHash ?? '', /^[a-f0-9]{64}$/, 'missing file checksum');
    const before = statSync(file);
    assert(before.isFile() && before.size === bytes, `incorrect file size: ${file}`);
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(file, { highWaterMark: WINDOW_BYTES })) hash.update(chunk);
    const after = statSync(file);
    assert.equal(after.size, before.size, 'table changed during validation');
    assert.equal(after.mtimeMs, before.mtimeMs, 'table changed during validation');
    assert.equal(hash.digest('hex'), expectedHash, `checksum mismatch: ${file}`);
  }
  return { mode: 'generate', reused: true, out: directory, tablePath, tableBytes: variant.tableBytes, tableSha256: table.tableSha256 };
}

function writeRawExclusive(file, length, chunkAt) {
  assert(!existsSync(file), `refusing to overwrite: ${file}`);
  const temporary = `${file}.partial-${process.pid}`;
  const fd = openSync(temporary, 'wx');
  const hash = createHash('sha256');
  try {
    for (let offset = 0; offset < length;) {
      const chunk = chunkAt(offset, Math.min(WINDOW_BYTES, length - offset));
      hash.update(chunk);
      let written = 0;
      while (written < chunk.length) written += writeSync(fd, chunk, written, chunk.length - written);
      offset += chunk.length;
    }
    fsyncSync(fd);
  } finally { closeSync(fd); }
  // link is atomic and refuses replacement; retain a partial on failure.
  linkSync(temporary, file);
  unlinkSync(temporary);
  return hash.digest('hex');
}

export function loadTable(oracle, tablePath) {
  const before = statSync(tablePath);
  assert.equal(before.size, TABLE_SIZE);
  const rawBase = oracle.module._get_mem_ptr();
  const base = typeof rawBase === 'bigint' ? Number(rawBase) : rawBase >>> 0;
  const fd = openSync(tablePath, 'r');
  const hash = createHash('sha256');
  try {
    for (let offset = 0; offset < TABLE_SIZE;) {
      const target = oracle.bytes(base + offset, Math.min(WINDOW_BYTES, TABLE_SIZE - offset));
      const count = readSync(fd, target, 0, target.length, offset);
      assert(count > 0, 'unexpected EOF');
      hash.update(target.subarray(0, count));
      offset += count;
    }
  } finally { closeSync(fd); }
  const after = statSync(tablePath);
  assert.equal(after.size, before.size);
  assert.equal(after.mtimeMs, before.mtimeMs);
  // Preserve an external SHA-256 regardless of each variant's internal check.
  assert.equal(oracle.module.init(0, 1), 0, 'upstream did not adopt table');
  assert.equal(oracle.module.init(-1, 1), 0);
  return { path: path.resolve(tablePath), size: before.size, mtimeMs: before.mtimeMs, sha256: hash.digest('hex'), base, adoptionThreads: 1, adoptionInitArguments: [0, 1] };
}

export function queryCoordinates(oracle, tablePath, fixturesPath, outputPath) {
  const table = tablePath ? loadTable(oracle, tablePath) : null;
  oracle.raw.oracle_init_cubeopt();
  const source = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  assert.equal(source.wasmSha256, EXPECTED_WASM);
  assert.equal(source.schema, schema('fixtures'));
  const fixtures = source.fixtures;
  assert(Array.isArray(fixtures) && fixtures.length === 407);
  const layout = VARIANT.context;
  const contextBytes = 8 * layout.bytes;
  const base = oracle.raw.malloc(contextBytes + 128);
  const view = new DataView(oracle.module.HEAPU8.buffer);
  const writePointer = (offset, value) => VARIANT.memory64 ? view.setBigUint64(offset, BigInt(value), true) : view.setUint32(offset, value, true);
  const pointerOffset = VARIANT.smallMemoryBytes;
  const previousPointer = VARIANT.memory64 ? Number(view.getBigUint64(pointerOffset, true)) : view.getUint32(pointerOffset, true);
  if (!table) {
    // In the pinned binaries func37 has no calls or stack-pointer writes. It
    // stores the first coordinate before dereferencing the PDB. An impossible
    // PDB base traps at that dereference, without allocating the real table.
    const impossibleBase = oracle.module.HEAPU8.byteLength;
    assert(VARIANT.memory64 || impossibleBase + TABLE_SIZE <= 2 ** 32, 'PDB address could wrap in memory32');
    writePointer(pointerOffset, impossibleBase);
  }
  const rows = [];
  try {
    for (const fixture of fixtures) {
      const row = { index: fixture.index, scramble: fixture.scramble };
      for (const [flag, name] of [[1, 'normal'], [0, 'inverse']]) {
        oracle.module.HEAPU8.fill(0, base, base + contextBytes + 128);
        for (let context = 0; context < 8; context++) view.setInt32(base + context * layout.bytes + layout.status, 1, true);
        const cubePtr = base + contextBytes + 64;
        oracle.module.HEAPU8.set(Buffer.from(fixture.cube, 'hex'), cubePtr);
        oracle.raw.oracle_cubie2fast(base, cubePtr);
        view.setInt32(base + 60, flag, true);
        writePointer(base + layout.stackPointer, base);
        // Every nonnegative bound exceeds -1. This prevents the normal path
        // from computing a second coordinate on the loaded-table path.
        view.setInt32(base + layout.budget, -1, true);
        view.setInt32(base + layout.status, 0, true);
        view.setBigUint64(base + layout.index, 0xffffffffffffffffn, true);
        if (table) oracle.raw.oracle_step1_query(base, base + contextBytes);
        else {
          assert.throws(() => oracle.raw.oracle_step1_query(base, base + contextBytes),
            (error) => error instanceof WebAssembly.RuntimeError && /memory access out of bounds|out of bounds memory access/i.test(error.message), 'expected first PDB read to trap');
          assert.equal(view.getInt32(base + layout.status, true), 0, 'query reached bound result before trap');
        }
        const coordinate = Number(view.getBigUint64(base + layout.index, true));
        assert(Number.isSafeInteger(coordinate) && coordinate >= 0 && coordinate < TABLE_SIZE * 4);
        if (table) assert(view.getInt32(base + layout.status, true) > 0, 'query did not reject negative budget');
        row[name] = coordinate;
        row[`${name}Bound`] = table ? view.getInt32(base + layout.status, true) - 1 : null;
      }
      rows.push(row);
    }
  } finally { writePointer(pointerOffset, previousPointer); oracle.raw.free(base); }
  const method = table ? 'original step1_query with loaded table' : 'original step1_query coordinate before intentional first-PDB-read OOB trap; no PDB allocated';
  saveJson(outputPath, { schema: schema('hot-query'), ...oracle.provenance, method, table, fixturesSha256: sha256(readFileSync(fixturesPath)), rows });
  return { mode: table ? 'query' : 'query-small', outputPath, rows: rows.length, method };
}

const MOVES = ['U', 'R', 'F', 'D', 'L', 'B'].flatMap((face) => [face, `${face}2`, `${face}'`]);

export function collectFixtures(oracle) {
  const { raw, module } = oracle;
  raw.oracle_init_cubeopt();
  const scratch = raw.malloc(2048);
  assert(scratch > 0);
  const out = [];
  const scrambles = ['', ...MOVES, ...MOVES.flatMap((a) => MOVES.map((b) => `${a} ${b}`))];
  let seed = 0x48480101;
  for (let sample = 0; sample < 64; sample++) {
    const moves = [];
    for (let step = 0; step < 20; step++) {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      moves.push(MOVES[(seed >>> 0) % 18]);
    }
    scrambles.push(moves.join(' '));
  }
  try {
    for (const [index, scramble] of scrambles.entries()) {
      module.HEAPU8.set(Buffer.from(scramble + '\0'), scratch + 256);
      assert.equal(raw.oracle_input_scramble(scratch, scratch + 256), 0);
      module.HEAPU8.fill(0, scratch + 32, scratch + 80);
      raw.oracle_cubie2fast(scratch + 32, scratch);
      const cube = oracle.bytes(scratch, 20).toString('hex');
      const fast = oracle.bytes(scratch + 32, 48).toString('hex');
      const conjugates = [];
      for (let symmetry = 0; symmetry < 48; symmetry++) {
        raw.oracle_corn_conj(scratch, symmetry, scratch + 96);
        raw.oracle_edge_conj(scratch, symmetry, scratch + 96);
        conjugates.push(oracle.bytes(scratch + 96, 20).toString('hex'));
      }
      out.push({ index, scramble, cube, fast, mismatch: raw.oracle_is_solved(scratch), conjugates });
    }
    return { schema: schema('fixtures'), ...oracle.provenance, seed: '0x48480101', cubeBytes: 20, fastBytes: 48, moves: MOVES, fixtures: out };
  } finally { raw.free(scratch); }
}

export function dumpSmallTables(oracle, outDirectory) {
  oracle.raw.oracle_init_cubeopt();
  const binary = path.join(outDirectory, 'small-memory.bin');
  const hash = writeRawExclusive(binary, VARIANT.smallMemoryBytes, (offset, length) => oracle.bytes(offset, length));
  const metadata = {
    schema: schema('small-tables'), ...oracle.provenance,
    file: binary, bytes: VARIANT.smallMemoryBytes, sha256: hash, byteOrder: 'little-endian',
    // These are addresses within this pinned WASM snapshot, not Rust pointers.
    regions: VARIANT.regions,
    moveCubies: Array.from({ length: 18 }, (_, i) => oracle.bytes(VARIANT.regions.moveCubies.offset + 20 * i, 20).toString('hex')),
    symmetryCubies: Array.from({ length: 48 }, (_, i) => oracle.bytes(VARIANT.regions.symmetryCubies.offset + 20 * i, 20).toString('hex')),
    symmetryInverse: Array.from(oracle.bytes(VARIANT.regions.symmetryInverse.offset, 48)),
  };
  saveJson(path.join(outDirectory, 'small-tables.json'), metadata);
  return metadata;
}

// Establish physical piece/turn conventions independently of the Rust port.
// Orientation gauges are derived by following one piece through its finite
// move graph, then tested against every complete WASM state in the corpus.
export async function verifyFixtureStates(directory) {
  const data = JSON.parse(readFileSync(path.join(directory, 'fixtures.json'), 'utf8'));
  const small = JSON.parse(readFileSync(path.join(directory, 'small-tables.json'), 'utf8'));
  assert.equal(data.wasmSha256, EXPECTED_WASM);
  assert.equal(small.wasmSha256, EXPECTED_WASM);
  assert.equal(data.schema, schema('fixtures')); assert.equal(small.schema, schema('small-tables'));
  assert.equal(data.fixtures.length, 407);
  const { cube3x3x3 } = await import(pathToFileURL(path.join(ROOT, 'core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js')).href);
  const puzzle = await cube3x3x3.kpuzzle();
  const physicalMoves = MOVES.map((move) => puzzle.defaultPattern().applyAlg(move).patternData);
  const rawMoves = small.moveCubies.map((hex) => Buffer.from(hex, 'hex'));
  const mappings = {};
  for (const [orbit, count, radix, offset] of [['CORNERS', 8, 3, 0], ['EDGES', 12, 2, 8]]) {
    const piece = (byte) => orbit === 'CORNERS' ? byte & 7 : byte >> 1;
    const orientation = (byte) => orbit === 'CORNERS' ? byte >> 3 : byte & 1;
    const sourceKey = (position) => [0, 3, 6, 9, 12, 15].map((m) => Number(piece(rawMoves[m][offset + position]) !== position)).join('');
    const targetKey = (position) => [0, 3, 6, 9, 12, 15].map((m) => Number(physicalMoves[m][orbit].pieces[position] !== position)).join('');
    const targetKeys = Array.from({ length: count }, (_, i) => targetKey(i));
    assert.equal(new Set(targetKeys).size, count);
    const positions = Array.from({ length: count }, (_, i) => targetKeys.indexOf(sourceKey(i)));
    assert.equal(new Set(positions).size, count); assert(!positions.includes(-1));
    const orientationMap = Array.from({ length: count }, () => Array.from({ length: count }, () => Array(radix).fill(null)));
    for (let identity = 0; identity < count; identity++) {
      const queue = [[identity, 0, positions[identity], 0]];
      orientationMap[identity][identity][0] = 0;
      for (let cursor = 0; cursor < queue.length; cursor++) {
        const [oldPos, oldOri, physicalPos, physicalOri] = queue[cursor];
        for (let m = 0; m < 18; m++) {
          const nextPos = Array.from({ length: count }, (_, i) => i).find((i) => piece(rawMoves[m][offset + i]) === oldPos);
          const nextOri = (oldOri + orientation(rawMoves[m][offset + nextPos])) % radix;
          const nextPhysicalPos = physicalMoves[m][orbit].pieces.indexOf(physicalPos);
          const nextPhysicalOri = (physicalOri + physicalMoves[m][orbit].orientation[nextPhysicalPos]) % radix;
          assert.equal(positions[nextPos], nextPhysicalPos, `${orbit} move permutation mismatch`);
          const saved = orientationMap[nextPos][identity][nextOri];
          if (saved !== null) { assert.equal(saved, nextPhysicalOri, `${orbit} inconsistent orientation gauge`); continue; }
          orientationMap[nextPos][identity][nextOri] = nextPhysicalOri;
          queue.push([nextPos, nextOri, nextPhysicalPos, nextPhysicalOri]);
        }
      }
      assert.equal(queue.length, count * radix);
    }
    mappings[orbit] = { positions, orientationMap };
    for (const fixture of data.fixtures) {
      const bytes = Buffer.from(fixture.cube, 'hex');
      assert.equal(bytes.length, 20);
      const expected = puzzle.defaultPattern().applyAlg(fixture.scramble).patternData[orbit];
      const pieces = Array(count), orientations = Array(count);
      for (let i = 0; i < count; i++) {
        const id = piece(bytes[offset + i]), ori = orientation(bytes[offset + i]);
        assert(id < count && ori < radix);
        pieces[positions[i]] = positions[id];
        orientations[positions[i]] = orientationMap[i][id][ori];
      }
      assert.deepEqual(pieces, expected.pieces, `${orbit} pieces fixture ${fixture.index}`);
      assert.deepEqual(orientations, expected.orientation, `${orbit} orientation fixture ${fixture.index}`);
    }
  }
  const report = { schema: schema('physical-verification'), variant: VARIANT.id, fixtures: 407, quarterAndHalfTurns: 18, twoMoves: 324, longScrambles: 64, independentModel: 'cubing.js cube3x3x3', sourceWasmSha256: EXPECTED_WASM, fixtureFileSha256: sha256(readFileSync(path.join(directory, 'fixtures.json'))), mappings };
  saveJson(path.join(directory, 'physical-verification.json'), report);
  return { mode: 'verify-small', directory, verified: 407, cornerPositions: mappings.CORNERS.positions, edgePositions: mappings.EDGES.positions };
}

export async function solveCases(oracle, tablePath, casesPath, outputPath, lines) {
  const parsed = JSON.parse(readFileSync(casesPath, 'utf8'));
  const cases = Array.isArray(parsed) ? parsed : parsed.cases;
  assert(Array.isArray(cases) && cases.length > 0);
  const seen = new Set();
  for (const item of cases) {
    assert(typeof item.id === 'string' && !seen.has(item.id)); seen.add(item.id);
    assert(typeof item.scramble === 'string' && /^(?:[URFDLB](?:2|')?(?:\s+|$))*$/.test(item.scramble));
    if (item.htm !== undefined) assert(Number.isSafeInteger(item.htm) && item.htm >= 0 && item.htm <= 20);
  }
  const table = loadTable(oracle, tablePath);
  const { cube3x3x3 } = await import(pathToFileURL(path.join(ROOT, 'core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js')).href);
  const puzzle = await cube3x3x3.kpuzzle();
  const solved = puzzle.defaultPattern().patternData;
  const fd = openSync(outputPath, 'wx');
  try {
    writeSync(fd, JSON.stringify({ type: 'metadata', schema: schema('solve'), ...oracle.provenance, table, cases: cases.length, threads: 1, groups: 1, metric: 'HTM' }) + '\n');
    for (const item of cases) {
      lines.length = 0;
      const start = performance.now();
      const result = oracle.module.solve_scramble(item.scramble, 1, 1, true);
      const elapsedMs = performance.now() - start;
      const output = lines.join('\n');
      assert(!/unsolved|Error, solution not correct!/i.test(output), `WASM failure for ${item.id}`);
      const found = [...output.matchAll(/Solution found!:[ \t]*([^\r\n]*)/g)];
      const lengths = [...output.matchAll(/Cube\d+ finished in (\d+)/g)];
      assert.equal(found.length, 1, `missing/ambiguous solution for ${item.id}`);
      assert.equal(lengths.length, 1, `missing/ambiguous completion for ${item.id}`);
      const solution = found[0][1].trim();
      assert(/^(?:[URFDLB](?:2|')?(?:\s+|$))*$/.test(solution), `non-HTM output for ${item.id}: ${solution}`);
      const length = solution ? solution.split(/\s+/).length : 0;
      assert.equal(length, Number(lengths[0][1]));
      if (item.htm !== undefined) assert.equal(length, item.htm, `known optimal length mismatch for ${item.id}`);
      const actual = puzzle.defaultPattern().applyAlg(`${item.scramble} ${solution}`).patternData;
      assert.deepEqual(actual.CORNERS, solved.CORNERS, `corners not solved for ${item.id}`);
      assert.deepEqual(actual.EDGES, solved.EDGES, `edges not solved for ${item.id}`);
      writeSync(fd, JSON.stringify({ type: 'solution', id: item.id, scramble: item.scramble, solution, length, expectedHtm: item.htm ?? null, verified: true, elapsedMs, returnValue: result, output: lines.slice() }) + '\n');
      fsyncSync(fd);
    }
  } finally { closeSync(fd); }
  const after = statSync(tablePath);
  assert.equal(after.size, table.size); assert.equal(after.mtimeMs, table.mtimeMs);
  return { mode: 'solve', cases: cases.length, verified: cases.length, output: outputPath, tableSha256: table.sha256 };
}

async function main() {
  const [mode = 'inspect', ...args] = process.argv.slice(2);
  // The public native `init` command uses the existing guarded generation
  // entry. Historical research commands retain their fresh-directory contract.
  const reuse = mode === 'generate' && args.length === 2 && args[1] === '--reuse';
  if (reuse) {
    args.pop();
    const directory = path.resolve(args[0]);
    if (existsSync(directory)) {
      process.stderr.write(`Checking existing Opt${VARIANT.id} tables: ${directory}\n`);
      try { return await verifyTableBundle(directory); }
      catch (error) {
        throw new Error(`Existing table directory is incomplete or invalid: ${directory}. Files were preserved; select a new --out directory to generate again. ${error.message}`);
      }
    }
    // Fail before creating an output directory if checkout assets are missing
    // or changed. createOracle repeats this check before instantiation.
    auditBinary(readFileSync(SOURCE), VARIANT);
    assert.equal(sha256(readFileSync(WRAPPER)), EXPECTED_WRAPPER, 'upstream wrapper changed: re-audit');
  }
  if (mode === 'inspect') {
    assert.equal(args.length, 0);
    const original = readFileSync(SOURCE);
    const patched = addOracleExports(original);
    assert.equal(sha256(readFileSync(WRAPPER)), EXPECTED_WRAPPER);
    return { mode, variant: VARIANT, source: SOURCE, sourceSha256: sha256(original), wrapperSha256: EXPECTED_WRAPPER, originalBytes: original.length, patchedBytes: patched.length, tableName: TABLE_NAME, tableBytes: TABLE_SIZE, extraExports: EXTRA_EXPORTS, instantiated: false };
  }
  if (mode === 'verify-small') {
    assert.equal(args.length, 1);
    return verifyFixtureStates(path.resolve(args[0]));
  }
  assert(['small', 'generate', 'solve', 'query', 'query-small'].includes(mode), 'usage: oracle.mjs inspect | small OUT_DIR | generate OUT_DIR | solve TABLE CASES_JSON OUT_JSONL | query TABLE FIXTURES_JSON OUT_JSON | query-small FIXTURES_JSON OUT_JSON');
  assert.equal(args.length, mode === 'solve' || mode === 'query' ? 3 : mode === 'query-small' ? 2 : 1);
  if (mode === 'small' || mode === 'generate') freshDirectory(path.resolve(args[0]));
  const lines = [];
  const threadText = process.env.CUBEOPT_THREADS ?? '1';
  assert(/^[1-9][0-9]*$/.test(threadText));
  const threads = Number(threadText);
  assert(Number.isSafeInteger(threads) && threads <= availableParallelism(), 'CUBEOPT_THREADS exceeds availableParallelism');
  const oracle = await createOracle({ smallOnly: mode === 'small' || mode === 'query-small', log(line) { lines.push(line); process.stderr.write(`[wasm] ${line}\n`); } });
  if (mode === 'solve') return solveCases(oracle, path.resolve(args[0]), path.resolve(args[1]), path.resolve(args[2]), lines);
  if (mode === 'query') return queryCoordinates(oracle, path.resolve(args[0]), path.resolve(args[1]), path.resolve(args[2]));
  if (mode === 'query-small') return queryCoordinates(oracle, null, path.resolve(args[0]), path.resolve(args[1]));
  const out = path.resolve(args[0]);
  if (mode === 'small') {
    const metadata = dumpSmallTables(oracle, out);
    const fixtures = collectFixtures(oracle);
    saveJson(path.join(out, 'fixtures.json'), fixtures);
    return { mode, out, memoryBytes: oracle.module.HEAPU8.byteLength, smallTablesSha256: metadata.sha256, fixtures: fixtures.fixtures.length };
  }
  const started = performance.now();
  assert.equal(oracle.module.init(-1, 1), 1, 'fresh module unexpectedly has a table');
  assert.equal(oracle.module.init(1, threads), 0, 'generation failed');
  assert.equal(oracle.module.init(-1, 1), 0);
  const generationMs = performance.now() - started;
  const rawBase = oracle.module._get_mem_ptr();
  const base = typeof rawBase === 'bigint' ? Number(rawBase) : rawBase >>> 0;
  const tablePath = path.join(out, TABLE_NAME);
  const hash = writeRawExclusive(tablePath, TABLE_SIZE, (offset, length) => oracle.bytes(base + offset, length));
  const manifest = { schema: schema('table'), ...oracle.provenance, tablePath, tableBytes: TABLE_SIZE, tableSha256: hash, base, generationMs, threads, generationThreads: threads, generationInitArguments: [1, threads], wasmMemoryBytes: oracle.module.HEAPU8.byteLength, logs: lines };
  saveJson(path.join(out, 'table.json'), manifest);
  dumpSmallTables(oracle, out);
  return { mode, out, tablePath, tableBytes: TABLE_SIZE, tableSha256: hash, generationMs, wasmMemoryBytes: oracle.module.HEAPU8.byteLength };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((result) => {
    const summary = process.argv.at(-1) === '--reuse'
      ? `${result.reused ? 'Verified existing tables' : 'Tables generated'}: Opt${VARIANT.id}\n${result.tablePath}\n${path.join(result.out, 'small-memory.bin')}\n`
      : JSON.stringify(result) + '\n';
    process.stdout.write(summary, () => process.exit(0));
  }, (error) => {
    process.stderr.write(`${error.stack ?? error}\n`, () => process.exit(1));
  });
}
