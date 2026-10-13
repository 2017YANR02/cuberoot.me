#!/usr/bin/env node
// Run through guard.mts with CUBEOPT_BACKEND=h10. This never generates tables.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants, closeSync, copyFileSync, createReadStream, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadCases, verify } from './benchmark.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const H10_BYTES = 30_336_314_216;
const CASE_TIMEOUT_MS = 120_000;
const save = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const append = (fd, value) => { writeSync(fd, JSON.stringify(value) + '\n'); fsyncSync(fd); };
const median = values => { const sorted = [...values].sort((a, b) => a - b); const mid = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2; };
const geomean = values => values.every(v => v > 0) ? Math.exp(values.reduce((sum, value) => sum + Math.log(value), 0) / values.length) : null;
async function hashFile(file) { const hash = createHash('sha256'); for await (const chunk of createReadStream(file)) hash.update(chunk); return hash.digest('hex'); }

export function parseArguments(argv = process.argv.slice(2)) {
  assert(argv.length === 4 || argv.length === 5 && argv[4] === '--probe',
    'usage: h10-benchmark.mjs RUST_NATIVE C_NATIVE H10 NEW_OUT_DIR [--probe]');
  const [rust, c, table, out] = argv.slice(0, 4).map(value => path.resolve(value));
  return { rust, c, table, out, probe: argv.length === 5 };
}

function tableIdentity(file) {
  const actual = realpathSync(file), info = statSync(actual);
  assert(info.isFile()); assert.equal(info.size, H10_BYTES, 'H10 file size');
  return { path: actual, size: info.size, dev: info.dev, ino: info.ino, mtimeMs: info.mtimeMs, ctimeMs: info.ctimeMs };
}

function engineArguments(side, table) {
  return side === 'rust' ? ['solve-h10', table, '8', '20', '0'] : ['--benchmark', table, 'unused', '1'];
}

// Each batch has exactly one engine process. time is only a small parent and
// shares the outer guard's process group, so the guard can stop the whole tree.
function session(binary, argv, side, rawFd, requestsFd, stderrFd) {
  const child = spawn('/usr/bin/time', ['-l', binary, ...argv], { stdio: ['pipe', 'pipe', 'pipe'] });
  const launched = performance.now();
  let pending = null, failure = null, requestNumber = 0;
  const rejectPending = error => {
    failure ??= error;
    if (pending) { clearTimeout(pending.timer); const active = pending; pending = null; active.reject(error); }
  };
  const closed = new Promise(resolve => {
    child.on('error', error => rejectPending(error));
    child.on('close', (code, signal) => {
      if (pending) rejectPending(Error(`${side} exited during request: ${code}/${signal}`));
      resolve({ code, signal, processWallSeconds: (performance.now() - launched) / 1000 });
    });
  });
  child.stderr.on('data', chunk => writeSync(stderrFd, chunk));
  const reader = createInterface({ input: child.stdout });
  reader.on('line', line => {
    writeSync(rawFd, line + '\n'); fsyncSync(rawFd);
    const active = pending;
    try {
      assert(active, `unsolicited ${side} output`);
      const raw = JSON.parse(line);
      clearTimeout(active.timer); pending = null;
      active.resolve({ raw, requestNumber: active.number, wallSeconds: (performance.now() - active.started) / 1000 });
    } catch (error) { rejectPending(error); }
  });
  child.stdin.on('error', error => rejectPending(error));
  function descendants() {
    if (!child.pid) return [];
    const family = new Set([child.pid]);
    try {
      const processes = execFileSync('/bin/ps', ['-axo', 'pid,ppid'], { encoding: 'utf8', timeout: 3000 })
        .trim().split('\n').slice(1).map(line => line.trim().split(/\s+/).map(Number));
      for (let changed = true; changed;) {
        changed = false;
        for (const [pid, parent] of processes) if (family.has(parent) && !family.has(pid)) { family.add(pid); changed = true; }
      }
    } catch { /* The outer guard still owns this process group. */ }
    return [...family].reverse();
  }
  return {
    request(item, context, timeoutMs = CASE_TIMEOUT_MS) {
      assert(!pending && !failure && child.exitCode === null && child.signalCode === null);
      const number = requestNumber++;
      append(requestsFd, { requestNumber: number, ...context, id: item.id, scramble: item.scramble, timeoutMs });
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => rejectPending(Error(`${side} timeout (${timeoutMs} ms): ${item.id}`)), timeoutMs);
        pending = { resolve, reject, timer, number, started: performance.now() };
        child.stdin.write(`${item.id}${side === 'c' ? ',' : '\t'}${item.scramble}\n`);
      });
    },
    async close(ok) {
      if (pending) rejectPending(Error(`${side} session closed`));
      const family = ok ? [] : descendants();
      const signal = (pids, kind) => { for (const pid of pids) { try { process.kill(pid, kind); } catch {} } };
      if (ok) child.stdin.end(); else signal(family, 'SIGTERM');
      const timer = setTimeout(() => {
        failure ??= Error(`${side} process did not exit after EOF/termination`);
        signal([...new Set([...family, ...descendants()])], 'SIGKILL');
      }, ok ? 10_000 : 1500);
      const result = await closed; clearTimeout(timer); reader.close(); fsyncSync(stderrFd);
      if (ok) { assert.equal(result.code, 0); assert.equal(result.signal, null); assert(!failure, String(failure)); }
      return result;
    },
  };
}

export function parseResponse(side, response, item) {
  const value = response.raw;
  assert.equal(value.id, item.id);
  assert(Number.isFinite(value.seconds) && value.seconds >= 0);
  assert(Number.isSafeInteger(value.nodes) && value.nodes >= 0);
  if (side === 'rust') {
    assert.equal(value.contexts, 8);
    assert.equal(value.cancelled, false, `Rust cancelled: ${item.id}`);
  } else {
    assert.equal(side, 'c'); assert.equal(value.mode, 'original'); assert.equal(value.run, 0);
    assert.equal(value.index, response.requestNumber); assert.equal(value.verified, true);
    for (const counter of ['cornerLookups', 'cornerPrunes', 'faceCuts', 'bpmxCuts', 'bpmxSkipped', 'recursiveCuts']) assert.equal(value[counter], 0);
  }
  return { solution: value.solution, length: value.length, seconds: value.seconds, nodes: value.nodes,
    wallSeconds: response.wallSeconds, requestNumber: response.requestNumber, raw: value };
}

export function parsePeakRss(stderr) {
  const matches = [...stderr.matchAll(/^\s*(\d+)\s+maximum resident set size\s*$/gm)];
  assert.equal(matches.length, 1, 'missing/ambiguous macOS time -l RSS record');
  const bytes = Number(matches[0][1]); assert(Number.isSafeInteger(bytes) && bytes > 0); return bytes;
}

async function snapshot(out, config) {
  const hashes = {};
  const snapshotRoot = path.join(out, 'source');
  const copy = async relative => {
    const destination = path.join(snapshotRoot, relative); mkdirSync(path.dirname(destination), { recursive: true });
    copyFileSync(path.join(ROOT, relative), destination, constants.COPYFILE_EXCL);
    hashes[relative] = await hashFile(destination);
  };
  const walk = async (relative, accept) => {
    for (const entry of readdirSync(path.join(ROOT, relative), { withFileTypes: true })) {
      const name = path.join(relative, entry.name);
      if (entry.isDirectory()) await walk(name, accept);
      else if (entry.isFile() && accept(entry.name)) await copy(name);
    }
  };
  const research = 'solver/experiments/cube48opt-rust';
  for (const name of ['Cargo.toml', 'Cargo.lock', 'guard.mts', 'h10-benchmark.mjs', 'benchmark.mjs', 'oracle.mjs', 'variants.mjs'])
    if (existsSync(path.join(HERE, name))) await copy(path.join(research, name));
  await walk(path.join(research, 'src'), name => name.endsWith('.rs'));
  await walk('solver/vendor/nissy-core/src', name => /\.[ch]$/.test(name));
  for (const name of ['LICENSE', 'VENDOR.md', 'nissy.h'])
    if (existsSync(path.join(ROOT, 'solver/vendor/nissy-core', name))) await copy(`solver/vendor/nissy-core/${name}`);
  await copy('solver/experiments/h48-corners/bench.c');
  await copy('solver/testdata/benchmarks/h48-h10-2026-10-04.json');
  const binaryHashes = {};
  for (const side of ['rust', 'c']) {
    const retained = path.join(out, `${side}-native`);
    copyFileSync(config[side], retained, constants.COPYFILE_EXCL);
    binaryHashes[side] = await hashFile(retained);
  }
  return { sourceHashes: hashes, binaryHashes };
}

function summarize(rows, cases, phase, rounds) {
  const selected = rows.filter(row => row.phase === phase);
  assert.equal(selected.length, cases.length * 2 * rounds);
  const totals = {};
  for (const side of ['rust', 'c']) {
    totals[side] = [...new Set(selected.map(row => row.round))].map(round => ({
      round, seconds: selected.filter(row => row.side === side && row.round === round).reduce((sum, row) => sum + row.seconds, 0),
    }));
  }
  const perCase = cases.map(item => {
    const rust = median(selected.filter(row => row.id === item.id && row.side === 'rust').map(row => row.seconds));
    const c = median(selected.filter(row => row.id === item.id && row.side === 'c').map(row => row.seconds));
    return { id: item.id, htm: item.htm, rustMedianSeconds: rust, cMedianSeconds: c, cOverRust: rust > 0 ? c / rust : null };
  });
  const rust = median(totals.rust.map(row => row.seconds)), c = median(totals.c.map(row => row.seconds));
  return { totals, rustMedianTotalSeconds: rust, cMedianTotalSeconds: c, cOverRustTotal: rust > 0 ? c / rust : null,
    cOverRustGeomean: perCase.every(row => row.cOverRust !== null) ? geomean(perCase.map(row => row.cOverRust)) : null, perCase };
}

async function main() {
  assert.equal(process.env.CUBEOPT_BACKEND, 'h10', 'Run through guard.mts with CUBEOPT_BACKEND=h10');
  assert.equal(process.platform, 'darwin', 'time -l RSS units in this protocol are macOS bytes');
  const config = parseArguments(), { out, probe } = config;
  assert(!existsSync(out), 'output directory must be new');
  const identity = tableIdentity(config.table); config.table = identity.path;
  const cases = loadCases(null, true); assert.equal(cases.length, 60);
  mkdirSync(out, { recursive: true });
  const provenance = await snapshot(out, config);
  const { cube3x3x3 } = await import(pathToFileURL(path.join(ROOT, 'core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js')).href);
  const puzzle = await cube3x3x3.kpuzzle();
  const method = 'one H10 file; one resident engine; fresh process per batch; alternating whole-batch order';
  save(path.join(out, 'input.json'), { schema: 'cuberoot.h10-rust-c.benchmark-input.v1', method, ...config, cases, ...provenance,
    tableIdentity: identity, tableSha256: null, tableHashPolicy: 'No full-table rehash; same canonical file identity/size/timestamps checked before and after every batch',
    solvingThreads: { rust: 1, c: 1 }, rustContexts: 8, rustMaxNodes: 0, cBuildRequired: 'bench.c compiled with H48_ORIGINAL against unmodified solver/vendor/nissy-core',
    warmupRounds: probe ? 0 : 1, perProcessWarmupRounds: probe ? 0 : 1, measurementRounds: probe ? 1 : 3,
    perCaseTimeoutMs: CASE_TIMEOUT_MS, startupTimeoutMs: 600_000, nodeAcceptanceLimit: null,
    timing: 'Self-reported search seconds only; startup/load/request wall time and independent replay excluded from primary comparison',
    rss: '/usr/bin/time -l per batch; macOS maximum resident set size in bytes; outer guard also samples the whole process tree',
  });
  const rowsFd = openSync(path.join(out, 'results.jsonl'), 'wx');
  const rows = [], batches = [], lengths = new Map();
  let current = null;
  try {
    for (let round = 0; round < (probe ? 1 : 4); round++) {
      const phase = probe ? 'probe' : round === 0 ? 'warmup' : 'measure';
      const order = round & 1 ? ['c', 'rust'] : ['rust', 'c'];
      for (const [position, side] of order.entries()) {
        assert.deepEqual(tableIdentity(config.table), identity, 'H10 file changed');
        const binary = path.join(out, `${side}-native`);
        assert.equal(await hashFile(binary), provenance.binaryHashes[side], `${side} retained binary changed`);
        const batch = path.join(out, `round-${round}-${phase}`, side); mkdirSync(batch, { recursive: true });
        const fds = ['raw.jsonl', 'requests.jsonl', 'stderr.log'].map(name => openSync(path.join(batch, name), 'wx'));
        const engine = session(binary, engineArguments(side, config.table), side, ...fds);
        let complete = false;
        const attempt = async (item, context, startup = false) => {
          current = { round, phase, side, position, order, ...context, id: item.id };
          let result;
          try {
            const response = await engine.request(item, current, startup ? 600_000 : CASE_TIMEOUT_MS);
            result = parseResponse(side, response, item); verify(puzzle, item, result);
            if (lengths.has(item.id)) assert.equal(result.length, lengths.get(item.id), `cross-engine/round distance: ${item.id}`);
            else lengths.set(item.id, result.length);
            const row = { ...current, ...result, verified: true };
            if (startup) save(path.join(batch, 'startup.json'), { ...row, excludedFromResults: true });
            else { rows.push(row); append(rowsFd, row); }
          } catch (error) {
            const failed = { ...current, ...(result ?? {}), verified: false, error: String(error.stack ?? error) };
            if (startup) save(path.join(batch, 'startup-failure.json'), failed); else append(rowsFd, failed);
            throw error;
          }
        };
        try {
          await attempt({ id: 'cuberootStartup', scramble: '', htm: 0 }, { phase: 'startup', batchPhase: phase }, true);
          if (!probe) for (const [caseIndex, item] of cases.entries())
            await attempt(item, { phase: 'process-warmup', batchPhase: phase, caseIndex });
          for (const [caseIndex, item] of cases.entries()) await attempt(item, { phase, caseIndex });
          const exit = await engine.close(true); complete = true;
          assert.deepEqual(tableIdentity(config.table), identity, 'H10 file changed');
          const summary = { round, phase, side, cases: cases.length, processWarmupCases: probe ? 0 : cases.length,
            ...exit, processExited: true, peakRssBytes: parsePeakRss(readFileSync(path.join(batch, 'stderr.log'), 'utf8')) };
          save(path.join(batch, 'complete.json'), summary); batches.push(summary);
        } finally {
          if (!complete) await engine.close(false);
          for (const fd of fds) closeSync(fd);
        }
      }
      process.stderr.write(`[h10-benchmark] ${phase} round ${round} complete: all ${cases.length} cases per engine\n`);
    }
    assert.equal(rows.length, probe ? 120 : 960);
    const report = { schema: 'cuberoot.h10-rust-c.benchmark-report.v1', method, mode: probe ? 'probe' : 'benchmark',
      cases: cases.length, verifiedSolutions: rows.length, startupChecks: batches.length,
      measuredSolutions: probe ? 120 : 360, tableIdentity: identity, ...provenance, batches,
      ...summarize(rows, cases, probe ? 'probe' : 'measure', probe ? 1 : 3), limitations: [
        'Rust and C use the same H10 file and one solving CPU thread. Rust has eight interleaved contexts; those are not eight threads. Search implementations and node-counter definitions differ.',
        'Compare only self-reported search seconds. Rust times solve(); C times nissy_solve(). Loading, IPC, parent replay and startup wall time are separate and excluded.',
        probe ? 'Probe runs all 60 cases once per engine with no corpus warmup; it is a correctness/resource check, not the final performance estimate.' : 'Every new process verifies a full 60-case warmup before its pass. The first whole round is also excluded. Three measured rounds alternate whole-engine order; this differs from per-case interleaving or persistent-process protocols.',
        'Both native node limits are disabled for this comparison. Counters have different meanings and impose no cross-engine acceptance threshold. The parent enforces 120 seconds per case and 600 seconds for startup; the outer guard enforces its run deadline.',
        'All historical HTM 15–19 cases stay in original order. Known optimal lengths and cross-engine lengths must match, and every solution is independently replayed with cubing.js. This is finite corpus evidence.',
        'Table identity/timestamps are checked, not cryptographically rehashed. These checks detect ordinary replacement/modification, not adversarial same-metadata edits. Binary/source SHA256 snapshots are retained; caller build provenance must establish which source produced each binary.',
        'C output must identify the original mode and report no experiment counters. That is a protocol check, not proof of build provenance. The C binary must be built with H48_ORIGINAL from unmodified vendor sources.',
        'time -l records each batch maximum resident set size; this differs from simultaneous aggregate RSS. C mmap and Rust storage may account for file-backed pages differently; the outer guard monitors process-tree RSS and system headroom.',
        'Any timeout, cancellation, process failure or invalid solution aborts the run and preserves raw output, request context and the failed result. No case is skipped or retried.',
      ] };
    save(path.join(out, 'report.json'), report);
    return { out, mode: report.mode, cases: cases.length, verifiedSolutions: rows.length, rustMedianTotalSeconds: report.rustMedianTotalSeconds,
      cMedianTotalSeconds: report.cMedianTotalSeconds, cOverRustTotal: report.cOverRustTotal };
  } catch (error) {
    save(path.join(out, 'failure.json'), { error: String(error.stack ?? error), current, completedRows: rows.length, completedBatches: batches, preservePartialResults: true });
    throw error;
  } finally { closeSync(rowsFd); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(result => process.stdout.write(JSON.stringify(result) + '\n', () => process.exit(0)),
    error => process.stderr.write(`${error.stack ?? error}\n`, () => process.exit(1)));
}
