#!/usr/bin/env node
// Run only under guard.mts. No table generation, implicit retries, or node comparison.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants, closeSync, copyFileSync, createReadStream, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, statSync, writeFileSync, writeSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createOracle, loadTable, TABLE_SIZE, VARIANT } from './oracle.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const NODE_BUDGET = 1_000_000_000;
const save = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const median = (values) => { const sorted = [...values].sort((a, b) => a - b); const m = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2; };
// A zero at timer resolution is reported explicitly, never replaced by epsilon.
const geomean = (values) => values.length && values.every((v) => v > 0) ? Math.exp(values.reduce((sum, v) => sum + Math.log(v), 0) / values.length) : null;
async function hashFile(file) { const hash = createHash('sha256'); for await (const chunk of createReadStream(file)) hash.update(chunk); return hash.digest('hex'); }

export function parseArguments(argv = process.argv.slice(2)) {
  const args = [...argv];
  assert(args.length >= 4, 'usage: benchmark.mjs NATIVE SMALL_DIR TABLE NEW_OUT_DIR [--cases CASES_JSON] [--probe] [--sequential]');
  const [binary, small, table, out] = args.splice(0, 4).map((value) => path.resolve(value));
  let casesFile = null, probe = false, sequential = false;
  while (args.length) {
    const arg = args.shift();
    if (arg === '--probe') { assert(!probe); probe = true; }
    else if (arg === '--sequential') { assert(!sequential); sequential = true; }
    else if (arg === '--cases') { assert(!casesFile && args.length); casesFile = path.resolve(args.shift()); }
    else throw Error(`unknown argument: ${arg}`);
  }
  return { binary, small, table, out, casesFile, probe, sequential };
}

export function loadCases(file, sequential = false) {
  let cases;
  if (file) {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    cases = Array.isArray(data) ? data : data.cases;
  } else {
    const historical = JSON.parse(readFileSync(path.join(ROOT, 'solver/testdata/benchmarks/h48-h10-2026-10-04.json'), 'utf8'));
    assert.equal(historical.sample.rows.length, 60);
    if (sequential) {
      cases = historical.sample.rows.map((row) => ({ ...row, group: 'historical' }));
      assert(cases.every((row) => row.htm >= 15 && row.htm <= 19));
    } else {
      const selected = historical.sample.rows.filter((row) => row.htm <= 17);
      assert.deepEqual([15, 16, 17].map((depth) => selected.filter((row) => row.htm === depth).length), [1, 1, 14]);
      cases = [
        ...selected.map((row) => ({ id: `prefix14_${row.id}`, scramble: row.scramble.trim().split(/\s+/).slice(0, 14).join(' '), group: 'prefix14' })),
        ...selected.filter((row) => row.htm <= 16).map((row) => ({ ...row, id: `historical${row.id}`, group: 'historical' })),
      ];
      assert.equal(cases.length, 18);
    }
  }
  assert(Array.isArray(cases) && cases.length > 0 && cases.length <= 100);
  const ids = new Set();
  for (const item of cases) {
    assert(typeof item.id === 'string' && /^[A-Za-z0-9_-]+$/.test(item.id) && !ids.has(item.id), 'invalid/duplicate case id'); ids.add(item.id);
    assert(typeof item.scramble === 'string' && /^(?:[URFDLB](?:2|')?(?:\s+|$))*$/.test(item.scramble), `invalid scramble: ${item.id}`);
    assert(!/[\r\n]/.test(item.scramble));
    if (item.htm !== undefined) assert(Number.isSafeInteger(item.htm) && item.htm >= 0 && item.htm <= 20);
  }
  return cases;
}

function jsonSession(executable, args, rawFd, stderrFd, side) {
  const child = spawn(executable, args, { stdio: ['pipe', 'pipe', 'pipe'] });
  let pending = null, failure = null;
  const closed = new Promise((resolve) => {
    child.on('error', (error) => { failure = error; pending?.reject(error); });
    child.on('close', (code, signal) => {
      if (pending) { failure = new Error(`${side} exited while solving: code=${code}, signal=${signal}`); pending.reject(failure); }
      resolve({ code, signal });
    });
  });
  child.stderr.on('data', (chunk) => writeSync(stderrFd, chunk));
  const reader = createInterface({ input: child.stdout });
  reader.on('line', (line) => {
    writeSync(rawFd, line + '\n'); fsyncSync(rawFd);
    const active = pending;
    try {
      assert(active, `unsolicited ${side} output`);
      const value = JSON.parse(line);
      pending = null;
      clearTimeout(active.timer);
      active.resolve({ value, wallSeconds: (performance.now() - active.started) / 1000 });
    } catch (error) { failure = error; if (active) { clearTimeout(active.timer); active.reject(error); } }
  });
  return {
    request(item, timeoutMs = 120_000) {
      assert(!pending && !failure && child.exitCode === null);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { failure = new Error(`${side} per-case timeout: ${item.id}`); reject(failure); }, timeoutMs);
        pending = { resolve, reject, timer, started: performance.now() };
        child.stdin.write(`${item.id}\t${item.scramble}\n`, (error) => { if (error) { failure = error; clearTimeout(timer); reject(error); } });
      });
    },
    async close(ok) {
      if (pending) clearTimeout(pending.timer);
      if (ok) child.stdin.end(); else child.kill('SIGTERM');
      const timer = setTimeout(() => child.kill('SIGKILL'), 1500); timer.unref();
      const status = await closed; clearTimeout(timer); reader.close();
      if (ok) { assert.equal(status.code, 0); assert.equal(status.signal, null); assert(!failure); }
    },
  };
}

function nativeSession(binary, small, table, rawFd, stderrFd) {
  return jsonSession(binary, ['solve', small, table, '8', '20', String(NODE_BUDGET)], rawFd, stderrFd, 'native');
}

function parseNative(response, item) {
  const value = response.value;
  assert.equal(value.id, item.id); assert.equal(value.contexts, 8);
  assert.equal(value.cancelled, false, `native node budget exhausted: ${item.id}; this is not an unsolvability claim`);
  assert(Number.isSafeInteger(value.nodes) && value.nodes >= 0 && value.nodes <= NODE_BUDGET);
  assert(Number.isFinite(value.seconds) && value.seconds >= 0);
  return { solution: value.solution, length: value.length, seconds: value.seconds, wallSeconds: response.wallSeconds };
}

export function verify(puzzle, item, result) {
  assert(typeof result.solution === 'string' && /^(?:[URFDLB](?:2|')?(?:\s+|$))*$/.test(result.solution));
  const length = result.solution.trim() ? result.solution.trim().split(/\s+/).length : 0;
  assert.equal(result.length, length);
  if (item.htm !== undefined) assert.equal(length, item.htm, `known optimal distance: ${item.id}`);
  const actual = puzzle.defaultPattern().applyAlg(`${item.scramble} ${result.solution}`).patternData;
  const solved = puzzle.defaultPattern().patternData;
  assert.deepEqual(actual.CORNERS, solved.CORNERS, `corners: ${item.id}`);
  assert.deepEqual(actual.EDGES, solved.EDGES, `edges: ${item.id}`);
}

function parseWasm(lines, wallSeconds) {
  const output = lines.join('\n');
  assert(!/unsolved|Error, solution not correct!/i.test(output));
  const solutions = [...output.matchAll(/Solution found!:[ \t]*([^\r\n]*)/g)];
  const finished = [...output.matchAll(/Cube\d+ finished in (\d+),[^\r\n]*?\btt=([0-9.]+) ms/g)];
  assert.equal(solutions.length, 1); assert.equal(finished.length, 1);
  const seconds = Number(finished[0][2]) / 1000;
  assert(Number.isFinite(seconds) && seconds >= 0);
  return { solution: solutions[0][1].trim(), length: Number(finished[0][1]), seconds, wallSeconds };
}

// The parent must not instantiate WASM in sequential mode. This private worker
// shares the native line protocol and is always awaited before the next batch.
async function wasmWorker(table, expectedHash) {
  assert(table && /^[a-f0-9]{64}$/.test(expectedHash ?? ''));
  const lines = [];
  const oracle = await createOracle({ log(line) { lines.push(line); process.stderr.write(`${line}\n`); } });
  const loaded = loadTable(oracle, table); assert.equal(loaded.sha256, expectedHash);
  let first = true;
  for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
    const tab = line.indexOf('\t'); assert(tab > 0);
    const id = line.slice(0, tab), scramble = line.slice(tab + 1);
    assert(/^[A-Za-z0-9_-]+$/.test(id));
    assert(/^(?:[URFDLB](?:2|')?(?:\s+|$))*$/.test(scramble));
    lines.length = 0;
    const started = performance.now(); oracle.module.solve_scramble(scramble, 1, 1, true);
    const engineWallSeconds = (performance.now() - started) / 1000;
    const response = { id, output: [...lines], engineWallSeconds, ...(first ? { oracle: oracle.provenance, loaded } : {}) };
    await new Promise((resolve, reject) => process.stdout.write(JSON.stringify(response) + '\n', (error) => error ? reject(error) : resolve()));
    first = false;
  }
}

export function sequentialOrder(round) {
  assert(Number.isSafeInteger(round) && round >= 0);
  return round & 1 ? ['wasm', 'native'] : ['native', 'wasm'];
}

async function sequentialBatches(config, cases, puzzle, tableHash, sourceHashes, record) {
  const { out, small, table, probe } = config;
  for (let round = 0; round < (probe ? 1 : 4); round++) {
    const phase = probe ? 'probe' : round === 0 ? 'warmup' : 'measure';
    const order = sequentialOrder(round);
    for (const [position, side] of order.entries()) {
      // A long run must not silently switch its worker implementation between
      // batches if a developer edits the live research scripts.
      for (const relative of ['benchmark.mjs', 'oracle.mjs', 'variants.mjs']) {
        assert.equal(await hashFile(path.join(HERE, relative)), sourceHashes[relative], `source changed during run: ${relative}`);
      }
      const batch = path.join(out, `round-${round}-${phase}`, side); mkdirSync(batch, { recursive: true });
      const rawFd = openSync(path.join(batch, 'raw.jsonl'), 'wx');
      const stderrFd = openSync(path.join(batch, 'stderr.log'), 'wx');
      const session = side === 'native'
        ? nativeSession(path.join(out, 'native-binary'), path.join(small, 'small-memory.bin'), table, rawFd, stderrFd)
        : jsonSession(process.execPath, [fileURLToPath(import.meta.url), '--wasm-worker', table, tableHash], rawFd, stderrFd, 'wasm');
      let closed = false;
      const parse = (response, item) => {
        if (side === 'native') return parseNative(response, item);
        assert.equal(response.value.id, item.id);
        assert(Number.isFinite(response.value.engineWallSeconds) && response.value.engineWallSeconds >= 0);
        return { ...parseWasm(response.value.output, response.wallSeconds), engineWallSeconds: response.value.engineWallSeconds };
      };
      try {
        // This request absorbs loading. It is retained but never counted among
        // measured cases; it does not claim to warm up a deep search or the JIT.
        const startup = { id: 'cuberootStartup', scramble: '', htm: 0 };
        const response = await session.request(startup, 600_000);
        const result = parse(response, startup); verify(puzzle, startup, result);
        if (side === 'wasm') {
          assert.equal(response.value.oracle.variant, VARIANT.id);
          assert.equal(response.value.oracle.oracleSha256, sourceHashes['oracle.mjs']);
          assert.equal(response.value.oracle.variantsSha256, sourceHashes['variants.mjs']);
        }
        save(path.join(batch, 'startup.json'), { round, phase, side, ...result, raw: response.value, verified: true, excludedFromResults: true });
        if (!probe) {
          for (const [caseIndex, item] of cases.entries()) {
            const result = parse(await session.request(item), item);
            record({ round, phase: 'process-warmup', batchPhase: phase, caseIndex, side, position, order }, item, result);
          }
        }
        for (const [caseIndex, item] of cases.entries()) {
          const result = parse(await session.request(item), item);
          record({ round, phase, caseIndex, side, position, order }, item, result);
        }
        await session.close(true); closed = true;
        save(path.join(batch, 'complete.json'), { round, phase, side, cases: cases.length, processWarmupCases: probe ? 0 : cases.length, processExited: true });
      } finally {
        if (!closed) await session.close(false);
        closeSync(rawFd); closeSync(stderrFd);
      }
    }
    process.stderr.write(`[benchmark] ${phase} round ${round} complete: ${cases.length} cases per engine\n`);
  }
}

function summarize(rows, cases, phase) {
  const measured = rows.filter((row) => row.phase === phase);
  const perCase = cases.map((item) => {
    const result = { id: item.id, group: item.group ?? 'custom', htm: item.htm ?? null };
    for (const side of ['native', 'wasm']) {
      const values = measured.filter((row) => row.id === item.id && row.side === side);
      assert.equal(values.length, phase === 'probe' ? 1 : 3);
      result[side] = { secondsByRound: values.map((row) => row.seconds), wallSecondsByRound: values.map((row) => row.wallSeconds), medianSeconds: median(values.map((row) => row.seconds)), geometricMeanSeconds: geomean(values.map((row) => row.seconds)), medianWallSeconds: median(values.map((row) => row.wallSeconds)) };
    }
    result.wasmOverNativeMedianRatio = result.native.medianSeconds > 0 ? result.wasm.medianSeconds / result.native.medianSeconds : null;
    return result;
  });
  const groups = Object.create(null);
  for (const group of ['all', ...new Set(perCase.map((row) => row.group))]) {
    const selected = group === 'all' ? perCase : perCase.filter((row) => row.group === group);
    const groupRows = measured.filter((row) => selected.some((item) => item.id === row.id));
    const result = { cases: selected.length };
    for (const side of ['native', 'wasm']) {
      const totals = [...new Set(groupRows.map((row) => row.round))].map((round) => groupRows.filter((row) => row.side === side && row.round === round).reduce((sum, row) => sum + row.seconds, 0));
      result[side] = { totalSecondsByRound: totals, medianRoundTotalSeconds: median(totals), sumOfCaseMediansSeconds: selected.reduce((sum, row) => sum + row[side].medianSeconds, 0), geometricMeanCaseMedianSeconds: geomean(selected.map((row) => row[side].medianSeconds)) };
    }
    result.wasmOverNativeTotalRatio = result.native.medianRoundTotalSeconds > 0 ? result.wasm.medianRoundTotalSeconds / result.native.medianRoundTotalSeconds : null;
    result.geometricMeanPairedRatio = geomean(selected.map((row) => row.wasmOverNativeMedianRatio ?? 0));
    groups[group] = result;
  }
  return { groups, perCase };
}

async function main() {
  const config = parseArguments();
  const { binary, small, table, out, probe, sequential } = config;
  assert(!existsSync(out), `refusing to overwrite ${out}`); mkdirSync(out, { recursive: true });
  const cases = loadCases(config.casesFile, sequential);
  const tableBefore = statSync(table); assert.equal(tableBefore.size, TABLE_SIZE);
  const tableManifest = JSON.parse(readFileSync(path.join(path.dirname(table), 'table.json'), 'utf8'));
  assert.equal(tableManifest.schema, `cuberoot.cube48opt${VARIANT.id}.table.v1`);
  assert.equal(tableManifest.wasmSha256, VARIANT.wasmSha256);
  const tableHash = await hashFile(table); assert.equal(tableHash, tableManifest.tableSha256);
  const smallFile = path.join(small, 'small-memory.bin');
  const smallManifest = JSON.parse(readFileSync(path.join(small, 'small-tables.json'), 'utf8'));
  assert.equal(smallManifest.schema, `cuberoot.cube48opt${VARIANT.id}.small-tables.v1`);
  assert.equal(smallManifest.wasmSha256, VARIANT.wasmSha256);
  assert.equal(await hashFile(smallFile), smallManifest.sha256);
  const snapshot = path.join(out, 'source'); mkdirSync(snapshot);
  const sourceFiles = ['Cargo.toml', 'oracle.mjs', 'variants.mjs', 'benchmark.mjs', ...readdirSync(path.join(HERE, 'src')).filter((name) => name.endsWith('.rs')).map((name) => `src/${name}`)];
  const hashes = {};
  for (const relative of sourceFiles) {
    const target = path.join(snapshot, relative); mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(path.join(HERE, relative), target, constants.COPYFILE_EXCL); hashes[relative] = await hashFile(target);
  }
  for (const [extension, expectedHash] of [['wasm', VARIANT.wasmSha256], ['mjs', VARIANT.wrapperSha256]]) {
    const relative = `upstream/cube48opt${VARIANT.id}.${extension}`;
    const target = path.join(snapshot, relative); mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(path.join(ROOT, `core/packages/client/public/cubeopt/cube48opt${VARIANT.id}.${extension}`), target, constants.COPYFILE_EXCL);
    hashes[relative] = await hashFile(target); assert.equal(hashes[relative], expectedHash);
  }
  const retainedBinary = path.join(out, 'native-binary'); copyFileSync(binary, retainedBinary, constants.COPYFILE_EXCL);
  const nativeHash = await hashFile(retainedBinary);
  const { cube3x3x3 } = await import(pathToFileURL(path.join(ROOT, 'core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js')).href);
  const puzzle = await cube3x3x3.kpuzzle();
  const method = sequential ? 'one resident table; fresh engine processes per round; alternating whole-batch order' : 'two persistent engines; per-case alternating order';
  const lines = [];
  // Sequential execution keeps all table memory in exactly one live child.
  const oracle = sequential ? null : await createOracle({ log(line) { lines.push(line); } });
  if (oracle) { const loaded = loadTable(oracle, table); assert.equal(loaded.sha256, tableHash); }
  const corpusPath = config.casesFile ?? path.join(ROOT, 'solver/testdata/benchmarks/h48-h10-2026-10-04.json');
  copyFileSync(corpusPath, path.join(out, 'cases-source.json'), constants.COPYFILE_EXCL);
  save(path.join(out, 'table-manifest.json'), tableManifest);
  save(path.join(out, 'small-manifest.json'), smallManifest);
  save(path.join(out, 'input.json'), { schema: `cuberoot.cube48opt${VARIANT.id}.benchmark-input.v1`, variant: VARIANT.id, method, ...config, cases, casesSourceSha256: await hashFile(path.join(out, 'cases-source.json')), nativeBinarySha256: nativeHash, sourceHashes: hashes, smallTableSha256: await hashFile(smallFile), tableSha256: tableHash, tableBefore: { size: tableBefore.size, mtimeMs: tableBefore.mtimeMs }, oracle: oracle?.provenance ?? { variant: VARIANT.id, wasmSha256: VARIANT.wasmSha256, wrapperSha256: VARIANT.wrapperSha256, processProvenance: 'round-N-phase/wasm/startup.json' }, warmupRounds: probe ? 0 : 1, perProcessWarmupRounds: sequential && !probe ? 1 : 0, measurementRounds: probe ? 1 : 3, nativeContexts: 8, wasmThreads: 1, wasmGroups: 1, wasmInternalContexts: 8, nativeMaxNodes: NODE_BUDGET, perCaseTimeoutSeconds: sequential ? 120 : null, startupTimeoutSeconds: sequential ? 600 : null, pairOrder: sequential ? 'round-parity alternates whole-engine batches' : 'xor-id-utf8-plus-round-parity', measurement: 'native solve() elapsed vs WASM printed tt; loading and independent replay excluded; request wall times retained separately' });
  const rowsFd = openSync(path.join(out, 'results.jsonl'), 'wx');
  const legacyFds = [];
  let native = null, nativeClosed = false;
  const rows = [], lengths = new Map();
  const record = (context, item, result) => {
    verify(puzzle, item, result);
    if (lengths.has(item.id)) assert.equal(result.length, lengths.get(item.id), `cross-engine/round distance: ${item.id}`); else lengths.set(item.id, result.length);
    const row = { ...context, id: item.id, group: item.group ?? 'custom', ...result, verified: true };
    assert(Number.isFinite(row.wallSeconds) && row.wallSeconds >= 0);
    rows.push(row); writeSync(rowsFd, JSON.stringify(row) + '\n'); fsyncSync(rowsFd);
  };
  try {
    if (sequential) {
      await sequentialBatches(config, cases, puzzle, tableHash, hashes, record);
    } else {
      const openLog = (name) => { const fd = openSync(path.join(out, name), 'wx'); legacyFds.push(fd); return fd; };
      const nativeFd = openLog('native-raw.jsonl'), stderrFd = openLog('native-stderr.log'), wasmFd = openLog('wasm-raw.jsonl');
      native = nativeSession(retainedBinary, smallFile, table, nativeFd, stderrFd);
      for (let round = 0; round < (probe ? 1 : 4); round++) {
        const phase = probe ? 'probe' : round === 0 ? 'warmup' : 'measure';
        for (const [caseIndex, item] of cases.entries()) {
          const parity = Buffer.from(item.id).reduce((value, byte) => value ^ byte, 0);
          const order = (parity + round) & 1 ? ['wasm', 'native'] : ['native', 'wasm'];
          for (const [position, side] of order.entries()) {
            let result;
            if (side === 'native') {
              result = parseNative(await native.request(item), item);
            } else {
              lines.length = 0;
              const started = performance.now(); oracle.module.solve_scramble(item.scramble, 1, 1, true);
              const wallSeconds = (performance.now() - started) / 1000;
              writeSync(wasmFd, JSON.stringify({ round, phase, id: item.id, output: lines }) + '\n'); fsyncSync(wasmFd);
              result = parseWasm(lines, wallSeconds);
            }
            record({ round, phase, caseIndex, side, position, order }, item, result);
          }
        }
        process.stderr.write(`[benchmark] ${phase} round ${round} complete: ${cases.length} cases per engine\n`);
      }
      await native.close(true); nativeClosed = true;
    }
    assert.equal(rows.length, cases.length * 2 * (probe ? 1 : 4) * (sequential && !probe ? 2 : 1));
    const tableAfter = statSync(table); assert.equal(tableAfter.size, tableBefore.size); assert.equal(tableAfter.mtimeMs, tableBefore.mtimeMs);
    const report = { schema: `cuberoot.cube48opt${VARIANT.id}.benchmark-report.v1`, variant: VARIANT.id, method, mode: probe ? 'probe' : 'benchmark', cases: cases.length, verifiedSolutions: rows.length, warmupExcluded: !probe, perProcessWarmupRounds: sequential && !probe ? 1 : 0, measuredRounds: probe ? 1 : 3, nativeBinarySha256: nativeHash, tableSha256: tableHash, ...summarize(rows, cases, probe ? 'probe' : 'measure'), limitations: [
      'Self-reported search seconds are the primary comparison: native wraps solve(); WASM tt covers its search job and is rounded to 0.001 ms. Neither includes table loading or independent verification.',
      sequential ? 'Each engine batch starts a fresh process. Its separate solved startup request includes loading wall time and is excluded from result rows; later request wall times include IPC. The startup check does not warm deep searches or the JIT.' : 'Additional wall times include native request/response IPC or WASM public-call overhead; the first native request also includes loading. Tiny cases are dominated by overhead.',
      sequential ? (probe ? 'This resource probe uses fresh processes without a corpus warmup.' : 'Engine/JIT state does not survive between batches. Every fresh process therefore completes and verifies a full-corpus process-warmup before its timed pass; those rows and the global first-round warmup are excluded. This does not prove the JIT has reached a steady state. Do not combine this protocol with persistent-engine per-case interleaved results.') : 'Two engines remain resident and per-case order alternates; this protocol is different from fresh-process whole-batch sequencing.',
      'WASM public API fixes its internal pipeline to eight contexts and exposes no node budget. Native is limited to 1e9 nodes per case; both engines use one OS solving thread. The outer guard limits runtime and aggregate RSS.',
      sequential ? 'Every case has a 120-second parent-enforced timeout after a separately limited 600-second startup. Any timeout, budget exhaustion, or failed verification fails the run and preserves partial outputs; no case is skipped or retried.' : 'Native has a 120-second request timeout; synchronous WASM is bounded by the outer guard.',
      sequential && !config.casesFile ? 'All 60 historical HTM 15–19 cases are retained in their original order, without selection by observed speed. Results cover this variant and corpus, not all random states or Nissy H10.' : 'The exact input corpus and its source are retained. Results cover only the reported variant and cases, not all random states or Nissy H10.',
      'Native and WASM node counters have different definitions and are not compared.',
      'A probe has no warm-up and is only a resource/time check, not a final performance estimate.',
    ] };
    save(path.join(out, 'report.json'), report);
    return { out, mode: report.mode, cases: cases.length, verifiedSolutions: rows.length, historical: report.groups.historical ?? null, all: report.groups.all };
  } catch (error) {
    save(path.join(out, 'failure.json'), { error: String(error.stack ?? error), completedRows: rows.length, preservePartialResults: true });
    throw error;
  } finally {
    if (native && !nativeClosed) await native.close(false);
    for (const fd of [rowsFd, ...legacyFds]) closeSync(fd);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const work = process.argv[2] === '--wasm-worker'
    ? wasmWorker(process.argv[3], process.argv[4])
    : main();
  work.then((result) => result === undefined ? process.exit(0) : process.stdout.write(JSON.stringify(result) + '\n', () => process.exit(0)), (error) => process.stderr.write(`${error.stack ?? error}\n`, () => process.exit(1)));
}
