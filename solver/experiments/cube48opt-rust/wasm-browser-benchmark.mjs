#!/usr/bin/env node
// Real Chrome benchmark. One dedicated browser, resident shared PDB, durable
// per-case acknowledgement, and no retries. Large runs require guard.mts.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { closeSync, copyFileSync, existsSync, fstatSync, fsyncSync, mkdirSync, openSync, readFileSync, readSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { browserSlotConfig, browserReviewPath } from './wasm-browser-policy.mts';
import { prepareBrowserAdapter } from './wasm-browser-adapter.mjs';
import { parsePrintedSolution, readWca100, validateSharedDepthResults } from './wasm-benchmark.mjs';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../..');
const BASE = resolve(ROOT, '.tmp/cubeopt-reverse');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const save = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const args = process.argv.slice(2), probe = args[0] === '--probe', fixture = args[0] === '--fixture';
const smallRun = probe || fixture, mode = fixture ? 'fixture' : probe ? 'capability' : 'benchmark';
if (smallRun) args.shift();
assert.equal(args.length, 4); assert.equal(args[0], '--slot'); assert.equal(args[2], '--out');
const config = browserSlotConfig(args[1]);
if (fixture) assert.equal(config.engine, 'rust', 'Browser fixtures only use the Rust small-check artifact');
const out = resolve(args[3]);
if (!smallRun) {
  assert.equal(out, config.out);
  assert.equal(process.env.CUBEOPT_BROWSER_REVIEW, browserReviewPath);
  const lock = read(resolve(BASE, 'compute.lock'));
  assert.equal(lock.pid, process.ppid); assert.equal(lock.entry, 'wasm-browser-benchmark.mjs');
  assert.equal(lock.wasmThreads, config.threads); assert.equal(lock.variant, config.variant);
} else assert(out.startsWith(resolve(BASE, 'wasm-browser-probes') + '/'), 'Small checks use a separate evidence directory');
assert(!existsSync(out), 'Never overwrite a browser run');
mkdirSync(out, {recursive: true});
const profile = smallRun ? resolve(out, 'chrome-profile') : config.profilePath;
assert(!existsSync(profile), 'Use a fresh, dedicated Chrome profile');
const adapter = prepareBrowserAdapter({engine: config.engine, wrapperPath: config.wrapper,
  workerPath: resolve(dirname(config.wrapper), 'cube48opt-rust8-worker.mjs'), outDir: resolve(out, 'adapter'), variant: config.variant});
const worker = resolve(out, 'wasm-browser-worker.mjs'); copyFileSync(resolve(HERE, 'wasm-browser-worker.mjs'), worker);
const assets = new Map(Object.entries(adapter.files).map(([name, path]) => ['/' + name, path]));
const wasmPath = fixture ? resolve(dirname(config.wasm), 'small-check.wasm') : config.wasm;
const wasmSha256 = fixture ? read(resolve(dirname(config.wasm), 'build-metadata.json')).smallCheckSha256 : config.wasmSha256;
assert(/^[0-9a-f]{64}$/.test(wasmSha256));
assets.set('/compute.mjs', worker); assets.set('/engine.wasm', wasmPath); assets.set('/small', config.small);
assert.equal(sha(readFileSync(wasmPath)), wasmSha256);
const corpus = smallRun ? null : readWca100(config.corpus, config.cases);
const cases = fixture ? [
  {id: 'fixture-1', scramble: 'R', expectedLength: 1},
  {id: 'fixture-2', scramble: 'R U', expectedLength: 2},
  {id: 'fixture-3', scramble: 'R U F', expectedLength: 3},
] : corpus?.cases ?? [];
let puzzle, solved, references;
if (!probe) {
  const {cube3x3x3} = await import(pathToFileURL(resolve(ROOT, 'core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js')).href);
  puzzle = await cube3x3x3.kpuzzle(); solved = puzzle.defaultPattern().patternData;
  if (fixture) {
    // Exhaustive distances through depth 2 independently exclude shorter
    // solutions; each three-move input supplies the remaining upper bound.
    const key = pattern => JSON.stringify([pattern.patternData.CORNERS, pattern.patternData.EDGES]);
    const distances = new Map([[key(puzzle.defaultPattern()), 0]]);
    const moves = [...'URFDLB'].flatMap(face => [face, face + '2', face + "'"]);
    let frontier = [puzzle.defaultPattern()];
    for (let depth = 1; depth <= 2; depth++) {
      const next = [];
      for (const pattern of frontier) for (const move of moves) {
        const child = pattern.applyAlg(move), childKey = key(child);
        if (!distances.has(childKey)) { distances.set(childKey, depth); next.push(child); }
      }
      frontier = next;
    }
    for (const item of cases) {
      const known = distances.get(key(puzzle.defaultPattern().applyAlg(item.scramble)));
      assert.equal(known ?? 3, item.expectedLength);
    }
    references = new Map(cases.map(item => [item.id, item.expectedLength]));
  } else {
    references = new Map(readFileSync(resolve(BASE, 'wca1000-mt16-rust-native-opt9-exp-fixed.jsonl'), 'utf8').trim().split('\n').map(line => {
      const row = JSON.parse(line); assert(!row.cancelled && row.completed_depth === row.length - 1); return [row.id, row.length];
    }));
    assert.equal(references.size, 1000);
    for (const item of cases) assert(references.has(item.id));
  }
}
const rawPath = resolve(out, 'results.jsonl'), rawFd = openSync(rawPath, 'wx');
let tableFd, tableIdentity, tableOffset = 0, tableHash = createHash('sha256'), tableVerified = smallRun;
let manifest;
if (!smallRun) {
  manifest = read(resolve(BASE, `opt${config.variant}-generated/table.json`));
  assert.equal(manifest.tableBytes, config.tableBytes);
  tableFd = openSync(config.table, 'r'); tableIdentity = fstatSync(tableFd);
  assert.equal(tableIdentity.size, config.tableBytes);
}
const eventsFd = openSync(resolve(out, 'events.jsonl'), 'wx');
const event = value => { writeSync(eventsFd, JSON.stringify({at: new Date().toISOString(), ...value}) + '\n'); };
let failure, rejectDone, resolveDone, ready, completion;
const done = new Promise((resolve, reject) => {resolveDone = resolve; rejectDone = reject;});
// An error may arrive while CDP is connecting; keep the rejection observed.
done.catch(() => {});
const fail = error => { if (!failure) {failure = error; event({type: 'host-error', message: String(error.stack ?? error)}); rejectDone(error);} };
const headers = {'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin', 'Cache-Control': 'no-store'};
const server = createServer((req, res) => {
  try {
    assert.equal(req.method, 'GET'); const path = new URL(req.url, 'http://localhost').pathname;
    if (path === '/') {
      const html = '<!doctype html><meta charset="utf-8"><title>CubeRoot Chrome benchmark</title><body><h1>CubeRoot Chrome benchmark</h1><pre id="status">Connecting…</pre></body>';
      res.writeHead(200, {...headers, 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(html)}); res.end(html); return;
    }
    if (path === '/favicon.ico') {res.writeHead(204, headers); res.end(); return;}
    if (path === '/table') {
      assert(!smallRun && tableFd !== undefined, 'A capability/fixture check cannot read the PDB');
      const range = /^bytes=(\d+)-(\d+)$/.exec(req.headers.range ?? ''); assert(range, 'Bounded Range required');
      const start = Number(range[1]), end = Number(range[2]), length = end - start + 1;
      assert.equal(start, tableOffset, 'No repeated or out-of-order table reads');
      assert(Number.isSafeInteger(end) && end < config.tableBytes && length > 0 && length <= 8 * 2 ** 20);
      const bytes = Buffer.allocUnsafe(length); let offset = 0;
      while (offset < length) {const n = readSync(tableFd, bytes, offset, length - offset, start + offset); assert(n > 0); offset += n;}
      tableHash.update(bytes); tableOffset += length;
      if (tableOffset === config.tableBytes) {
        assert.equal(tableHash.digest('hex'), manifest.tableSha256, 'Full table checksum mismatch');
        const after = fstatSync(tableFd);
        for (const key of ['dev', 'ino', 'size', 'mtimeMs']) assert.equal(after[key], tableIdentity[key]);
        tableVerified = true;
      }
      res.writeHead(206, {...headers, 'Content-Type': 'application/octet-stream', 'Content-Length': length,
        'Content-Range': `bytes ${start}-${end}/${config.tableBytes}`, 'X-Content-SHA256': sha(bytes)});
      res.end(bytes); return;
    }
    const asset = assets.get(path);
    if (!asset) {res.writeHead(404, headers); res.end(); return;}
    assert(statSync(asset).size < 8 * 2 ** 20, 'Non-table assets must be bounded');
    const bytes = readFileSync(asset);
    res.writeHead(200, {...headers, 'Content-Type': path.endsWith('.mjs') ? 'text/javascript' : path.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream', 'Content-Length': bytes.length});
    res.end(bytes);
  } catch (error) {res.writeHead(500, headers); res.end(String(error)); fail(error);}
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
mkdirSync(profile, {recursive: true});
const chromeArgs = [`--user-data-dir=${profile}`, '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--disable-background-networking', '--disable-component-update', '--disable-sync',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--window-size=1000,700', origin];
const chromeLog = openSync(resolve(out, 'chrome.stderr.log'), 'wx');
const chrome = spawn(config.chromePath, chromeArgs, {stdio: ['ignore', 'ignore', chromeLog]});
closeSync(chromeLog);
// PID reuse must never turn cleanup into termination of an unrelated process.
// Keep ps birth time plus the exact argv observed for every owned process.
const knownPids = new Map();
let cleaning = false;
function processSnapshot() {
  return execFileSync('ps', ['-axo', 'pid=,ppid=,pgid=,lstart=,command='], {encoding: 'utf8', timeout: 5000}).trim().split('\n').map(line => {
    const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\w{3}\s+\w{3}\s+\d{1,2}\s+\d\d:\d\d:\d\d\s+\d{4})\s+(.*)$/.exec(line);
    return match ? {pid: +match[1], ppid: +match[2], pgid: +match[3], startedAt: match[4], command: match[5]} : null;
  }).filter(Boolean);
}
const sameIdentity = (row, identity) => row && identity && row.startedAt === identity.startedAt && row.command === identity.command;
function collectPids(record = false) {
  const rows = processSnapshot();
  assert(rows.some(row => row.pid === process.pid), 'Process tree observation is incomplete');
  const owned = new Set(rows.filter(row => sameIdentity(row, knownPids.get(row.pid))).map(row => row.pid));
  const remember = row => {knownPids.set(row.pid, {startedAt: row.startedAt, command: row.command}); owned.add(row.pid);};
  const spawned = rows.find(row => row.pid === chrome.pid);
  if (spawned && !knownPids.has(spawned.pid)) {
    assert.equal(spawned.ppid, process.pid, 'Dedicated Chrome is not a child of this runner');
    assert(spawned.command.includes(profile), 'Dedicated Chrome has an unexpected profile');
    remember(spawned);
  }
  let changed;
  do {
    changed = false;
    for (const row of rows) if (!knownPids.has(row.pid) && owned.has(row.ppid)) {remember(row); changed = true;}
  } while (changed);
  // Chrome's crashpad can reparent before the first sample; the unique profile
  // path still identifies this task's helper, never a personal Chrome session.
  for (const row of rows) if (!knownPids.has(row.pid) && row.command.includes(profile)
    && /Google Chrome|chrome_crashpad/.test(row.command)) remember(row);
  const family = new Set([process.pid]);
  do {
    changed = false;
    for (const row of rows) if (!family.has(row.pid) && family.has(row.ppid)) {family.add(row.pid); changed = true;}
  } while (changed);
  const current = rows.filter(row => owned.has(row.pid));
  const escapedRenderers = current.filter(row => /(?:^|\s)--type=renderer(?:\s|$)/.test(row.command) && !family.has(row.pid));
  const changedIdentities = rows.filter(row => knownPids.has(row.pid) && !sameIdentity(row, knownPids.get(row.pid)));
  if (record) event({type: 'process-tree', runnerPid: process.pid, chromePid: chrome.pid,
    allRenderersInGuardTree: escapedRenderers.length === 0, escapedRendererPids: escapedRenderers.map(row => row.pid),
    identityChangedPids: changedIdentities.map(row => row.pid), processes: current});
  if (!cleaning && !completion) {
    assert.equal(changedIdentities.length, 0, 'A tracked Chrome PID changed identity');
    assert.equal(escapedRenderers.length, 0, 'A Chrome renderer escaped the guarded runner process tree');
  }
  return current;
}
const processTimer = setInterval(() => {try {collectPids(true);} catch (error) {fail(error);}}, 1000);
chrome.on('error', fail);
chrome.on('exit', code => {if (!completion && !failure) fail(Error(`Chrome exited before completion: ${code}`));});
let browser, page, messages = Promise.resolve(); const rows = [];
const timeout = setTimeout(() => fail(Error('Chrome benchmark timed out')), smallRun ? 60_000 : 50 * 60_000);
const signal = name => fail(Error(`Interrupted by ${name}; partial results retained, no restart`));
process.on('SIGINT', signal); process.on('SIGTERM', signal);
try {
  const deadline = Date.now() + 30_000, portFile = resolve(profile, 'DevToolsActivePort');
  while (!existsSync(portFile)) {if (failure) throw failure; assert(Date.now() < deadline, 'Chrome CDP port not ready'); await delay(100);}
  const port = Number(readFileSync(portFile, 'utf8').split('\n')[0]); assert(port > 0);
  const require = createRequire(resolve(ROOT, 'core/packages/client/package.json'));
  const {chromium} = require('@playwright/test');
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const context = browser.contexts()[0]; page = context.pages()[0] ?? await context.newPage();
  page.on('pageerror', fail); page.on('crash', () => fail(Error('Chrome renderer crashed')));
  page.on('console', message => event({type: 'console', level: message.type(), message: message.text()}));
  await page.exposeFunction('persistBenchmarkMessage', message => {
    messages = messages.then(async () => {
      if (failure) return;
      if (message.type === 'error') throw Error(`${message.stage}: ${message.message}\n${message.stack}`);
      if (message.type === 'progress') {
        if (message.loadedBytes === message.totalBytes || message.loadedBytes % (512 * 2 ** 20) === 0)
          console.log(JSON.stringify({slot: config.slot, ...message}));
        return;
      }
      if (message.type === 'ready') {
        assert(!ready && tableVerified); assert.equal(message.capabilities.wasmSha256, wasmSha256);
        assert.equal(message.mode, mode);
        if (fixture) {
          assert.equal(message.tableBytes, 0); assert.equal(message.loaded, null);
          assert.equal(message.metadata.threads, config.threads);
          assert(message.linearMemoryBytes < 2 * 2 ** 30, 'Fixture reserved an unexpected large memory');
        }
        ready = message; save(resolve(out, 'ready.json'), ready);
        console.log(JSON.stringify({slot: config.slot, type: 'ready', linearMemoryBytes: message.linearMemoryBytes, loadSeconds: message.loadSeconds}));
        await page.evaluate(() => window.benchmarkWorker.postMessage({type: 'start'})); return;
      }
      if (message.type === 'fixture') {
        assert(fixture, 'Fixture output is not a benchmark result');
        const item = cases[rows.length], search = message.value;
        assert(item && message.index === rows.length && message.id === item.id && message.scramble === item.scramble);
        writeSync(rawFd, JSON.stringify(message) + '\n'); fsyncSync(rawFd);
        assert.equal(message.operation, 'solve'); assert.equal(search.threads, config.threads);
        assert.equal(search.cancelled, false); assert.equal(search.length, references.get(item.id));
        assert.equal(search.completed_depth, search.length - 1);
        assert(/^(?:[URFDLB](?:2|')?)(?:\s+[URFDLB](?:2|')?)*$/.test(search.solution));
        assert.equal(search.solution.trim().split(/\s+/).length, search.length);
        const result = puzzle.defaultPattern().applyAlg(`${item.scramble} ${search.solution}`).patternData;
        for (const orbit of ['CORNERS', 'EDGES']) assert.deepEqual(result[orbit], solved[orbit], `Fixture replay failed: ${item.id}`);
        validateSharedDepthResults(search, config.threads);
        rows.push(message);
        await page.evaluate(index => window.benchmarkWorker.postMessage({type: 'ack', index}), message.index); return;
      }
      if (message.type === 'result') {
        assert(!smallRun, 'Small checks must not produce benchmark rows');
        const row = message.row, item = cases[rows.length];
        assert(item && row.index === rows.length && row.id === item.id && row.scramble === item.scramble);
        // Write the observed solve before validation so failures preserve proof.
        writeSync(rawFd, JSON.stringify(row) + '\n'); fsyncSync(rawFd);
        assert.equal(row.threads, config.threads); assert(Number.isFinite(row.seconds) && row.seconds >= 0);
        const printed = parsePrintedSolution(row.output); assert.equal(row.solution, printed.solution); assert.equal(row.length, printed.length);
        assert(/^(?:[URFDLB](?:2|')?)(?:\s+[URFDLB](?:2|')?)*$/.test(row.solution));
        assert.equal(row.solution.split(/\s+/).length, row.length); assert.equal(row.length, references.get(item.id));
        const result = puzzle.defaultPattern().applyAlg(`${item.scramble} ${row.solution}`).patternData;
        for (const orbit of ['CORNERS', 'EDGES']) assert.deepEqual(result[orbit], solved[orbit], `Independent replay failed: ${item.id}`);
        if (config.engine === 'rust') validateSharedDepthResults(row.search, config.threads);
        rows.push(row);
        if (rows.length % 25 === 0) console.log(JSON.stringify({slot: config.slot, completed: rows.length, cases: cases.length, totalSeconds: rows.reduce((sum, x) => sum + x.seconds, 0)}));
        await page.evaluate(index => window.benchmarkWorker.postMessage({type: 'ack', index}), row.index); return;
      }
      if (message.type === 'complete') {assert.equal(message.cases, cases.length); completion = message; resolveDone(); return;}
      throw Error(`Unknown Worker message: ${message.type}`);
    }).catch(fail);
    return messages;
  });
  await page.goto(origin, {waitUntil: 'load'});
  const environment = await page.evaluate(() => ({userAgent: navigator.userAgent, hardwareConcurrency: navigator.hardwareConcurrency,
    crossOriginIsolated, sharedArrayBuffer: typeof SharedArrayBuffer === 'function'}));
  assert(environment.crossOriginIsolated && environment.sharedArrayBuffer);
  save(resolve(out, 'input.json'), {schema: 'cuberoot.chrome-wasm-run.v1', ...config, mode,
    wasm: wasmPath, wasmSha256, performanceEligible: !smallRun, ...(fixture ? {fixtureOperation: 'solve', fixtureMaxDepth: 3} : {}),
    corpusSha256: corpus?.corpusSha256 ?? null, tableSha256: manifest?.tableSha256 ?? null,
    chrome: {version: browser.version(), pid: chrome.pid, args: chromeArgs, environment}, adapter,
    sourceSha256: sha(readFileSync(fileURLToPath(import.meta.url))), workerSha256: sha(readFileSync(worker)), cases});
  await page.evaluate(runConfig => {
    window.benchmarkWorker = new Worker('/compute.mjs', {type: 'module', name: 'cubeopt-browser-coordinator'});
    window.benchmarkWorker.onmessage = event => {document.getElementById('status').textContent = JSON.stringify(event.data, null, 2).slice(0, 3000); window.persistBenchmarkMessage(event.data);};
    window.benchmarkWorker.onerror = event => window.persistBenchmarkMessage({type: 'error', stage: 'worker', message: event.message});
    window.benchmarkWorker.postMessage({type: 'run', config: runConfig});
  }, {engine: config.engine, variant: config.variant, threads: config.threads, mode,
    ...(fixture ? {fixtureOperation: 'solve', fixtureMaxDepth: 3} : {}),
    cases, tableBytes: smallRun ? 0 : config.tableBytes, tableURL: '/table', smallURL: '/small', wasmURL: '/engine.wasm', moduleURL: '/engine.mjs'});
  await done; await messages;
  assert(!failure && ready && completion && tableVerified); assert.equal(rows.length, cases.length);
  if (fixture) {
    assert.equal(tableOffset, 0); assert.equal(tableFd, undefined); assert.equal(completion.totalSeconds, 0);
    save(resolve(out, 'result.json'), {schema: 'cuberoot.chrome-wasm-fixture.v1', slot: config.slot, runtime: 'Chrome', mode,
      performanceEligible: false, chromeVersion: browser.version(), variant: config.variant, engine: config.engine,
      threads: config.threads, cases: rows.length, verifiedSolutions: rows.length, optimalLengthsMatched: rows.length,
      shortestLengths: cases.map(item => item.expectedLength), proof: 'Independent exhaustive HTM BFS through depth 2 plus input upper bounds',
      pdbAllocatedBytes: 0, pdbReadBytes: tableOffset, wasm: wasmPath, wasmSha256, rawSha256: sha(readFileSync(rawPath))});
  } else {
    const totalSeconds = rows.reduce((sum, row) => sum + row.seconds, 0);
    assert(Math.abs(totalSeconds - completion.totalSeconds) < 1e-8);
    save(resolve(out, 'result.json'), {schema: 'cuberoot.chrome-wasm-result.v1', slot: config.slot, runtime: 'Chrome',
      chromeVersion: browser.version(), variant: config.variant, engine: config.engine, threads: config.threads,
      cases: rows.length, passes: 1, warmupCases: 0, totalSeconds, verifiedSolutions: rows.length,
      optimalLengthsMatched: rows.length, searchNodes: config.engine === 'rust' ? rows.reduce((sum, row) => sum + row.search.nodes, 0) : null,
      corpusSha256: corpus?.corpusSha256 ?? null, wasmSha256, tableSha256: manifest?.tableSha256 ?? null,
      rawSha256: sha(readFileSync(rawPath)), mode});
  }
} catch (error) {
  fail(error); save(resolve(out, 'failure.json'), {message: String(error.stack ?? error), completed: rows.length, at: new Date().toISOString()});
} finally {
  cleaning = true;
  clearTimeout(timeout); clearInterval(processTimer);
  try {collectPids(true);} catch {}
  try {await browser?.close();} catch {}
  const signalOwned = (pid, signal) => {
    const current = processSnapshot().find(row => row.pid === pid);
    if (sameIdentity(current, knownPids.get(pid))) {try {process.kill(pid, signal);} catch {}}
  };
  if (chrome.exitCode === null) signalOwned(chrome.pid, 'SIGTERM');
  for (let tries = 0; tries < 50; tries++) {if (!collectPids().length) break; await delay(100);}
  const remaining = collectPids();
  for (const row of remaining) signalOwned(row.pid, 'SIGKILL');
  if (remaining.length) await delay(250);
  const final = collectPids();
  save(resolve(out, 'cleanup.json'), {knownPids: [...knownPids.keys()], identities: [...knownPids].map(([pid, identity]) => ({pid, ...identity})),
    forcedPids: remaining.map(x => x.pid), remaining: final, completed: new Date().toISOString()});
  if (final.length) failure ??= Error('Dedicated Chrome process cleanup incomplete');
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  if (tableFd !== undefined) closeSync(tableFd); closeSync(rawFd); closeSync(eventsFd);
}
if (failure) {console.error(failure); process.exitCode = 1;}
else console.log(JSON.stringify({slot: config.slot, mode,
  ...(fixture ? {performanceEligible: false, verifiedSolutions: rows.length, threads: config.threads, pdbReadBytes: 0}
    : {totalSeconds: completion.totalSeconds}), cases: rows.length, exitCode: 0}));
