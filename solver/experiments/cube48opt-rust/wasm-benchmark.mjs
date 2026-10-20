#!/usr/bin/env node
// Guarded, single-pass WCA100 comparison. The parent never allocates a PDB.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants, closeSync, copyFileSync, createReadStream, existsSync, fstatSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, readSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, isAbsolute, resolve } from 'node:path';
import { cpus, release } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getVariant } from './variants.mjs';
import { patchOriginalWrapper } from './original-wasm-compat.mjs';
import { validateRootBoundProof } from './wasm-adapter/shared/cube48opt-rust8.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const CORPUS = resolve(ROOT, 'solver/testdata/benchmarks/wca-first100.json');
const CORPUS_HASH = '92171d593d13982924ed16723f099bd771a873aaa2c30a0e08f319c86b75dcde';
const REFERENCE = resolve(ROOT, '.tmp/cubeopt-reverse/wca100-rust-h10-v2.jsonl');
const TOKEN_SEQUENCE = /^(?:[URFDLB](?:2|')?)(?:\s+[URFDLB](?:2|')?)*$/;
const save = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
async function hashFile(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

/** Pure parsing is also used by the resource guard before it observes memory. */
export function parseWasmBenchmarkArguments(argv) {
  const args = [...argv], values = {};
  while (args.length) {
    const key = args.shift();
    assert(['--variant', '--engine', '--threads', '--table', '--small', '--wasm', '--out', '--cases', '--compiler', '--resume-from'].includes(key), `Unknown argument: ${key}`);
    assert(!Object.hasOwn(values, key) && args.length && !args[0].startsWith('--'), `Missing or duplicate ${key}`);
    values[key] = args.shift();
  }
  assert(/^[1-9]$/.test(values['--variant'] ?? ''), 'This comparison permits Opt1 through Opt9');
  const engine = values['--engine'] ?? 'both';
  const compiler = values['--compiler'];
  if (compiler !== undefined) assert(compiler === 'turbofan' && (
    values['--variant'] === '8' && values['--threads'] === '4' && ['rust','original'].includes(engine)
    || values['--variant'] === '9' && values['--threads'] === '16' && values['--cases'] === '1000' && ['rust','original'].includes(engine)),
    'Compiler override requires the reviewed Opt8 or Opt9 comparison');
  assert(['both', 'rust', 'original'].includes(engine), 'engine must be both, rust or original');
  const threads = values['--threads'] ?? '1';
  assert(['1', '4', '16', '18'].includes(threads), 'threads must be 1, 4, 16 or 18');
  assert(threads !== '4' || values['--variant'] === '8', 'The retained four-thread protocol is Opt8 only');
  for (const key of ['--table', '--small', '--wasm', '--out']) assert(values[key], `${key} is required`);
  const count = Number(values['--cases'] ?? 100);
  assert(count === 100 || (count === 1000 && threads === '16' && values['--variant'] === '9'));
  assert(threads !== '16' || count === 1000);
  if (values['--resume-from']) assert(engine === 'original' && values['--variant'] === '9' && threads === '16' && count === 1000 && compiler === 'turbofan');
  return { ...(values['--resume-from'] ? {resumeFrom:resolve(values['--resume-from'])} : {}), ...(compiler ? {compiler} : {}), variant: Number(values['--variant']), engine, threads: Number(threads), ...(count === 1000 ? { count } : {}),
    table: resolve(values['--table']), small: resolve(values['--small']),
    wasm: resolve(values['--wasm']), out: resolve(values['--out']) };
}

export function assertBenchmarkGuard(config, lock, parentPid) {
  assert.equal(lock.pid, parentPid, 'Run this comparison directly under guard.mts');
  assert.equal(lock.entry, 'wasm-benchmark.mjs');
  // The old guard does not budget/attest shared workers. Parsing a new option
  // alone must not silently enlarge that authorization before policy is updated.
  if (config.threads > 1) assert.equal(lock.wasmThreads, config.threads, 'Guard must explicitly budget and attest the requested WASM solve threads');
}

export function wasmBuildContract(config, build) {
  assert.equal(build.target, 'wasm64-unknown-unknown');
  if (build.schema === 'cuberoot.rust-opt-shared-wasm64.build.v1') {
    assert(config.variant >= 1 && config.variant <= 9, 'Shared WASM supports Opt1–9');
    assert.equal(build.abiVersion, 2); assert([4, 18].includes(build.maxThreads));
    assert(config.threads <= build.maxThreads, 'Requested workers exceed the frozen WASM ABI');
    if (config.threads >= 16) assert(build.verifiedThreadCounts?.includes(18), '18-worker small validation is required');
    assert.equal(build.threads, 4); assert.equal(build.memory64, true); assert.equal(build.sharedTable, true);
    assert(Array.isArray(build.supportedVariants) && build.supportedVariants.includes(config.variant));
    assert(/^[0-9a-f]{64}$/.test(build.workerSha256));
    return { shared: true, wrapper: 'cube48opt-rust8.mjs', worker: 'cube48opt-rust8-worker.mjs' };
  }
  assert.equal(build.schema, 'cuberoot.rust-opt-wasm64.build.v1');
  assert.equal(build.threads, 1); assert.equal(config.threads, 1, 'ABI1 does not implement four-thread solving');
  return { shared: false, wrapper: 'wrapper.mjs' };
}

export function sharedBuildSources(build) {
  const prefix = 'solver/experiments/cube48opt-rust/';
  assert(build.sourceHashes && typeof build.sourceHashes === 'object' && !Array.isArray(build.sourceHashes));
  assert.equal(createHash('sha256').update(JSON.stringify(build.sourceHashes)).digest('hex'), build.sourceDigest,
    'Shared build source digest does not match its frozen file map');
  for (const name of ['wasm-adapter/shared/cube48opt-rust8.mjs', 'wasm-adapter/shared/cube48opt-rust8-worker.mjs',
    'wasm-adapter/shared/src/lib.rs', 'src/search.rs']) assert(Object.hasOwn(build.sourceHashes, prefix + name), `Missing build source: ${name}`);
  if (build.smallCheck?.rootBoundEnabled || build.smallCheck?.rootBoundDiagnostic?.enabled) {
    assert(Object.hasOwn(build.sourceHashes, prefix + 'wasm-adapter/shared/verify-root-bound.mjs'), 'Missing root-bound proof verification source');
  }
  for (const [name, sha] of Object.entries(build.sourceHashes)) {
    assert(name.startsWith(prefix) && !name.split('/').some(part => ['..', '.'].includes(part))
      && /(?:\.(?:rs|mjs|mts)|Cargo\.(?:toml|lock))$/.test(name), `Invalid shared build source: ${name}`);
    assert(/^[0-9a-f]{64}$/.test(sha), `Invalid source digest: ${name}`);
  }
  return build.sourceHashes;
}

export async function initializeBenchmarkModule(module, engine, threads) {
  const result = await module.init(0, threads);
  if (engine === 'original') {
    assert.equal(result, 0, 'Original table adoption failed');
    assert.equal(await module.init(-1, threads), 0, 'Original table validation failed');
  } else {
    assert.equal(module.metadata.threads, threads);
    if (threads > 1) {
      assert.equal(module.metadata.abiVersion, 2); assert.equal(module.metadata.sharedTable, true);
    }
  }
}

export function validateSharedDepthResults(raw, threads) {
  let initialDepth = 0;
  if (['initialDepth', 'skippedDepths', 'rootBoundProof'].some(field => Object.hasOwn(raw, field))) {
    initialDepth = validateRootBoundProof(raw.rootBoundProof, threads);
    assert.equal(raw.initialDepth, initialDepth, 'Initial depth must match both-root proof');
    assert.equal(raw.skippedDepths, initialDepth, 'Skipped depths must match the root proof');
  }
  assert(Number.isSafeInteger(raw.length) && raw.length >= initialDepth && raw.length <= 20);
  assert.equal(raw.workers?.length, threads); assert.equal(raw.depthResults?.length, raw.length - initialDepth + 1);
  const workerNodes = Array(threads).fill(0);
  for (const [offset, shards] of raw.depthResults.entries()) {
    const depth = initialDepth + offset;
    assert.equal(shards.length, threads);
    assert.deepEqual(shards.map(row => row.worker).sort((a, b) => a - b), Array.from({ length: threads }, (_, i) => i));
    for (const shard of shards) {
      assert.equal(shard.depth, depth); assert(Number.isSafeInteger(shard.nodes) && shard.nodes >= 0);
      workerNodes[shard.worker] += shard.nodes;
      if (depth < raw.length) {
        assert.equal(shard.solution, null); assert.equal(shard.cancelled, false); assert.equal(shard.completed, true);
      }
    }
    if (depth === raw.length) assert(shards.some(row => row.solution === raw.solution && !row.cancelled));
  }
  assert.deepEqual(raw.workers, workerNodes);
  assert.equal(raw.nodes, workerNodes.reduce((sum, count) => sum + count, 0));
}

export async function measureBenchmarkCase(module, engine, item, threads, lines, now = () => performance.now()) {
  lines.length = 0;
  const started = now();
  // Await includes dispatch, shard work and the completion barrier for ABI2;
  // synchronous original/ABI1 calls retain the same public-call timing boundary.
  const raw = await module.solve_scramble(item.scramble, threads, 1, true);
  const seconds = (now() - started) / 1000;
  const printed = parsePrintedSolution(lines);
  if (engine === 'rust') {
    assert.equal(raw.cancelled, false); assert.equal(raw.contexts, 8);
    assert.equal(raw.threads, threads);
    assert.equal(raw.length, printed.length); assert.equal(raw.solution.trim(), printed.solution);
    assert.equal(raw.completed_depth, raw.length === 0 ? null : raw.length - 1, 'Rust search did not finish all shorter bounds');
    if (threads > 1) validateSharedDepthResults(raw, threads);
  }
  return { seconds, ...printed, threads, output: [...lines], ...(engine === 'rust' ? { search: raw } : {}) };
}

export function readWca100(file = CORPUS, count = 100) {
  assert([100, 1000].includes(count));
  const expectedHash = count === 100 ? CORPUS_HASH : '5b42a18086b27e974115a73696702017b5dde0a19c9819a77c88c8014d67c8ea';
  const corpus = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(corpus.schema, `cuberoot.solver.wca-first${count}.v1`);
  assert.equal(corpus.cases.length, count);
  assert.equal(corpus.corpusSha256, expectedHash);
  assert.equal(new Set(corpus.cases.map(row => row.id)).size, count);
  for (const [index, row] of corpus.cases.entries()) {
    assert.equal(row.sourceLine, index + 1);
    assert(/^\d+$/.test(row.id) && TOKEN_SEQUENCE.test(row.scramble) && !/[\r\n]/.test(row.scramble));
  }
  const canonical = corpus.cases.map(row => `${row.id},${row.scramble}\n`).join('');
  assert.equal(createHash('sha256').update(canonical).digest('hex'), expectedHash, 'Frozen WCA corpus was changed');
  return corpus;
}

export function parsePrintedSolution(lines) {
  const text = lines.join('\n');
  assert(!/unsolved|Error, solution not correct!/i.test(text), 'Original solver reported failure');
  const solutions = [...text.matchAll(/Solution found!:[ \t]*([^\r\n]*)/g)];
  const lengths = [...text.matchAll(/Cube\d+ finished in (\d+)/g)];
  assert.equal(solutions.length, 1); assert.equal(lengths.length, 1);
  const timer = text.match(/\btt=([0-9.]+) ms/);
  return { solution: solutions[0][1].trim(), length: Number(lengths[0][1]),
    engineReportedSeconds: timer ? Number(timer[1]) / 1000 : null };
}

function copyExclusive(source, destination) {
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination, constants.COPYFILE_EXCL);
}

async function checkSources(input) {
  for (const [file, expected] of Object.entries(input.sourceHashes))
    assert.equal(await hashFile(file), expected, `Benchmark source changed during run: ${file}`);
}

function streamTable(module, file, bytes, expectedHash) {
  const fd = openSync(file, 'r'), hash = createHash('sha256');
  const base = Number(module._get_mem_ptr());
  assert(Number.isSafeInteger(base) && base >= 0);
  const before = fstatSync(fd);
  assert(before.isFile() && before.size === bytes);
  try {
    // A bounded view writes directly into WASM; no second resident table copy.
    for (let offset = 0; offset < bytes;) {
      const target = Buffer.from(module.HEAPU8.buffer, base + offset, Math.min(4 * 2 ** 20, bytes - offset));
      const count = readSync(fd, target, 0, target.length, offset);
      assert(count > 0, 'Unexpected table EOF');
      hash.update(target.subarray(0, count)); offset += count;
    }
    const after = fstatSync(fd);
    assert.equal(after.size, before.size); assert.equal(after.mtimeMs, before.mtimeMs);
  } finally { closeSync(fd); }
  assert.equal(hash.digest('hex'), expectedHash, 'Loaded table differs from the frozen manifest');
  return { bytes, sha256: expectedHash, mtimeMs: before.mtimeMs };
}

function send(message) {
  return new Promise((done, fail) => process.send(message, error => error ? fail(error) : done()));
}

async function worker(inputFile, engine) {
  assert(process.send && ['rust', 'original'].includes(engine), 'Private worker requires parent IPC');
  const input = JSON.parse(readFileSync(inputFile, 'utf8'));
  const threads = input.threads;
  assert([1, 4, 16, 18].includes(threads));
  assert.equal(process.env.CUBEOPT_VARIANT, String(input.variant));
  await checkSources(input);
  const variant = getVariant(input.variant), lines = [], start = performance.now();
  const artifact = input.artifacts[engine];
  for (const [role, file] of Object.entries(artifact.files))
    assert.equal(await hashFile(file), artifact.sha256[role], `Worker artifact changed: ${role}`);
  const create = (await import(pathToFileURL(artifact.files.wrapper).href)).default;
  const log = line => lines.push(String(line));
  const module = engine === 'rust'
    ? await create({ variant: input.variant, threads, wasmBinary: readFileSync(artifact.files.wasm),
      ...(artifact.files.worker ? { workerURL: pathToFileURL(artifact.files.worker) } : {}),
      smallTableBytes: readFileSync(artifact.files.small), print: log, printErr: log })
    : await create({ print: log, printErr: log,
      wasmMemory: new WebAssembly.Memory(variant.memory64
        ? { initial: 256n, maximum: BigInt(variant.linearMemoryLimitPages), shared: true, address: 'i64' }
        : { initial: 256, maximum: variant.linearMemoryLimitPages, shared: true }) });
  assert.equal(Number(module.get_table_size()), variant.tableBytes);
  assert.equal(module.get_table_name(), variant.tableName);
  const loaded = streamTable(module, input.table, variant.tableBytes, input.tableSha256);
  await initializeBenchmarkModule(module, engine, threads);
  if (engine === 'rust') assert.equal(module.metadata.variant, input.variant);
  for (const line of lines) process.stderr.write(line + '\n');
  const ready = { type: 'ready', engine, loaded, loadSeconds: (performance.now() - start) / 1000,
    linearMemoryBytes: module.HEAPU8.byteLength, threads, warmupCases: 0, execArgv: [...process.execArgv] };
  if (input.compiler === 'turbofan') assert.deepEqual(process.execArgv, ['--no-liftoff']);
  if (input.diagnostic === true) {
    assert.equal(input.schema, 'cuberoot.opt8.production-profile-input.v1');
    assert.equal(input.performanceEligible, false);
    assert.deepEqual(process.execArgv, profilerNodeFlags(input.profiling.logDirectory, engine, true));
    ready.profiler = { kind: 'v8-prof', execArgv: [...process.execArgv], node: process.version,
      v8: process.versions.v8, pid: process.pid, diagnostic: true, performanceEligible: false };
  }
  let index = input.resume?.completedCases ?? 0, busy = false;
  process.on('message', async message => {
    try {
      assert(!busy, 'Concurrent worker request'); busy = true;
      if (message.type === 'finish') {
        assert.equal(index, input.cases.length, 'A partial pass cannot finish successfully');
        if (engine === 'rust' && typeof module.close === 'function') await module.close();
        await send({ type: 'finished', engine, cases: index, threads,
          maxRssKiB: process.resourceUsage().maxRSS, linearMemoryBytes: module.HEAPU8.byteLength });
        process.exit(0);
      }
      assert.equal(message.type, 'solve'); assert.equal(message.index, index);
      const item = input.cases[index]; assert(item);
      const measured = await measureBenchmarkCase(module, engine, item, threads, lines);
      const response = { type: 'result', engine, index, id: item.id, ...measured };
      index++; busy = false;
      await send(response);
    } catch (error) {
      process.stderr.write(`${error.stack ?? error}\n`); process.exit(1);
    }
  });
  await send(ready);
}

export function profilerNodeFlags(profileDirectory, engine, detached, platform = process.platform) {
  if (profileDirectory === null || profileDirectory === undefined) return [];
  assert.equal(platform, 'linux', 'Profiling real solver sessions is Linux-only');
  assert.equal(engine, 'rust', 'Profiling cannot repeat the original baseline');
  assert.equal(detached, true, 'Profiler requires the remote monitored process group');
  assert(isAbsolute(profileDirectory) && resolve(profileDirectory) === profileDirectory);
  return ['--prof', `--logfile=${resolve(profileDirectory, 'v8.log')}`, '--logfile-per-isolate',
    '--print-wasm-code', '--print-wasm-code-function-index=12'];
}

export function startSession(inputFile, engine, directory, { detached = false, profileDirectory = null } = {}) {
  assert(!detached || process.platform === 'linux', 'Detached remote sessions require Linux');
  const sessionInput = JSON.parse(readFileSync(inputFile, 'utf8'));
  // The Mac18 protocol already has a six-hour whole-run guard deadline.
  // Small tables must not inherit the old Opt8/9 two-minute per-case cutoff.
  const caseTimeoutMs = sessionInput.threads >= 16 ? 6 * 60 * 60_000 : 120_000;
  if (sessionInput.threads >= 16) assert.equal(sessionInput.perCaseTimeoutSeconds, caseTimeoutMs / 1000);
  const nodeFlags = profilerNodeFlags(profileDirectory, engine, detached);
  if (sessionInput.compiler === 'turbofan') {
    assert(process.platform === 'darwin' && profileDirectory === null && (
      sessionInput.variant === 8 && sessionInput.threads === 4 && ['rust','original'].includes(engine)
      || sessionInput.variant === 9 && sessionInput.threads === 16 && sessionInput.cases.length === 1000 && ['rust','original'].includes(engine)));
    nodeFlags.push('--no-liftoff');
  }
  if (profileDirectory !== null) {
    assert.equal(realpathSync(profileDirectory), profileDirectory);
    assert.equal(readdirSync(profileDirectory).length, 0, 'Profiler output must be a fresh directory');
    const input = JSON.parse(readFileSync(inputFile, 'utf8'));
    assert.equal(input.schema, 'cuberoot.opt8.production-profile-input.v1');
    assert.equal(input.diagnostic, true); assert.equal(input.performanceEligible, false);
    assert.equal(input.variant, 8); assert.equal(input.threads, 4);
    assert.equal(input.profiling.logDirectory, profileDirectory);
    assert.deepEqual(input.profiling.nodeFlags, nodeFlags);
  }
  mkdirSync(directory);
  const raw = openSync(resolve(directory, 'raw.jsonl'), 'wx');
  const stdout = openSync(resolve(directory, 'stdout.log'), 'wx');
  const stderr = openSync(resolve(directory, 'stderr.log'), 'wx');
  let pending, failure, ended = false;
  const expect = (type, timeoutMs) => {
    assert(!pending && !failure && !ended);
    return new Promise((done, fail) => {
      const timer = setTimeout(() => { failure = Error(`${engine} ${type} timed out`); pending = null; fail(failure); }, timeoutMs);
      pending = { type, done, fail, timer };
    });
  };
  const ready = expect('ready', 600_000);
  const child = spawn(process.execPath, [...nodeFlags, fileURLToPath(import.meta.url), '--worker', inputFile, engine],
    { stdio: ['ignore', stdout, stderr, 'ipc'], detached,
      env: detached ? { ...process.env, CUBEOPT_VARIANT: '8' } : process.env });
  const terminate = signal => {
    try { if (detached) process.kill(-child.pid, signal); else child.kill(signal); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  };
  const reject = error => {
    failure = error;
    if (pending) { clearTimeout(pending.timer); pending.fail(error); pending = null; }
  };
  const closed = new Promise(done => {
    child.on('error', reject);
    child.on('close', (code, signal) => {
      ended = true;
      if (code !== 0 || signal || pending) reject(Error(`${engine} exited: code=${code}, signal=${signal}`));
      done({ code, signal });
    });
  });
  child.on('message', message => {
    const active = pending;
    try {
      writeSync(raw, JSON.stringify(message) + '\n'); fsyncSync(raw);
      assert(active, `${engine} unsolicited worker message`);
      assert.equal(message.type, active.type); assert.equal(message.engine, engine);
      clearTimeout(active.timer); pending = null; active.done(message);
    } catch (error) { reject(error); }
  });
  return {
    pid: child.pid,
    exit: closed,
    terminate,
    ready,
    request(index) {
      const result = expect('result', caseTimeoutMs);
      child.send({ type: 'solve', index }, error => { if (error) reject(error); });
      return result;
    },
    async finish() {
      const result = expect('finished', 10_000);
      child.send({ type: 'finish' }, error => { if (error) reject(error); });
      const resource = await result, status = await closed;
      assert.equal(status.code, 0); assert.equal(status.signal, null); assert(!failure);
      return resource;
    },
    async close() {
      if (!ended) terminate('SIGTERM');
      const timer = setTimeout(() => terminate('SIGKILL'), 1500);
      await closed; clearTimeout(timer);
      // A failed remote wrapper must not leave descendants alive after its
      // main child exited. Only this explicitly detached process group is ours.
      if (detached) terminate('SIGKILL');
      if (pending) clearTimeout(pending.timer);
      for (const fd of [raw, stdout, stderr]) closeSync(fd);
    },
  };
}

async function main() {
  const config = parseWasmBenchmarkArguments(process.argv.slice(2));
  assert.equal(process.env.CUBEOPT_BACKEND, 'opt');
  assert.equal(process.env.CUBEOPT_VARIANT, String(config.variant));
  const lock = JSON.parse(readFileSync(resolve(ROOT, '.tmp/cubeopt-reverse/compute.lock'), 'utf8'));
  assertBenchmarkGuard(config, lock, process.ppid);
  assert(!existsSync(config.out), `Refusing to overwrite ${config.out}`);
  mkdirSync(dirname(config.out), { recursive: true }); mkdirSync(config.out);
  try {
    const count = config.count ?? 100;
    const corpusPath = count === 100 ? CORPUS : resolve(ROOT, 'solver/testdata/benchmarks/wca-first1000.json');
    const variant = getVariant(config.variant), corpus = readWca100(corpusPath, count);
    const { verify } = await import('./benchmark.mjs');
    const { cube3x3x3 } = await import(pathToFileURL(resolve(ROOT, 'core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js')).href);
    const puzzle = await cube3x3x3.kpuzzle();
    const reference = readFileSync(REFERENCE, 'utf8').trim().split('\n').map(line => JSON.parse(line));
    assert.equal(reference.length, 400);
    const cases = corpus.cases.map((item, index) => {
      if (index >= 100) return { ...item };
      const row = reference[index]; assert.equal(row.id, `r0_${item.id}`); assert.equal(row.cancelled, false);
      verify(puzzle, item, row); return { ...item, htm: row.length };
    });
    let resume, prefixBytes, prefixRows = [];
    if (config.resumeFrom) {
      const previous = JSON.parse(readFileSync(resolve(config.resumeFrom, 'input.json'), 'utf8'));
      assert.equal(previous.corpusSha256, corpus.corpusSha256);
      assert.equal(previous.threads, 16); assert.equal(previous.compiler, 'turbofan');
      assert.equal(previous.artifacts.original.sha256.wasm, variant.wasmSha256);
      assert.equal(previous.artifacts.original.sha256.wrapper, variant.wrapperSha256);
      prefixBytes = readFileSync(resolve(config.resumeFrom, 'original/results.jsonl'));
      assert(prefixBytes.toString().endsWith('\n'));
      prefixRows = prefixBytes.toString().trim().split('\n').map(line => JSON.parse(line));
      assert.equal(prefixRows.length, 431);
      prefixRows.forEach((row, index) => {
        assert.equal(row.index,index); assert.equal(row.id,cases[index].id); assert.equal(row.threads,16);
        assert.equal(row.verified,true); assert(Number.isFinite(row.seconds) && row.seconds >= 0);
        verify(puzzle,cases[index],row);
      });
      resume = { completedCases:431, remainingCases:569, previousDirectory:config.resumeFrom,
        prefixSha256:createHash('sha256').update(prefixBytes).digest('hex'), sessions:2,
        note:'First 431 completed calls retained byte-for-byte; only remaining 569 solved after runtime compatibility fix. Table reload and failed attempt excluded.' };
    }
    const tableBefore = statSync(config.table); assert.equal(tableBefore.size, variant.tableBytes);
    const tableManifest = JSON.parse(readFileSync(resolve(dirname(config.small), 'table.json'), 'utf8'));
    assert.equal(tableManifest.schema, `cuberoot.cube48opt${config.variant}.table.v1`);
    assert.equal(tableManifest.wasmSha256, variant.wasmSha256);
    const tableSha256 = await hashFile(config.table); assert.equal(tableSha256, tableManifest.tableSha256);
    const smallManifest = JSON.parse(readFileSync(resolve(dirname(config.small), 'small-tables.json'), 'utf8'));
    assert.equal(smallManifest.schema, `cuberoot.cube48opt${config.variant}.small-tables.v1`);
    assert.equal(smallManifest.wasmSha256, variant.wasmSha256);
    assert.equal(statSync(config.small).size, variant.smallMemoryBytes);
    assert.equal(await hashFile(config.small), smallManifest.sha256);
    const buildFile = resolve(dirname(config.wasm), 'build-metadata.json');
    const rustBuild = JSON.parse(readFileSync(buildFile, 'utf8'));
    const buildContract = wasmBuildContract(config, rustBuild);
    const rustWrapper = resolve(dirname(config.wasm), buildContract.wrapper);
    assert.equal(await hashFile(config.wasm), rustBuild.wasmSha256);
    assert.equal(statSync(config.wasm).size, rustBuild.wasmBytes);
    assert.equal(await hashFile(rustWrapper), rustBuild.wrapperSha256);
    copyExclusive(buildFile, resolve(config.out, 'rust-build-metadata.json'));
    const artifacts = { rust: { files: {}, sha256: {} }, original: { files: {}, sha256: {} } };
    const sourceFiles = { rust: { wrapper: rustWrapper, wasm: config.wasm, small: config.small },
      original: { wrapper: resolve(ROOT, `core/packages/client/public/cubeopt/cube48opt${config.variant}.mjs`),
        wasm: resolve(ROOT, `core/packages/client/public/cubeopt/cube48opt${config.variant}.wasm`) } };
    if (buildContract.shared) {
      sourceFiles.rust.worker = resolve(dirname(config.wasm), buildContract.worker);
      assert.equal(await hashFile(sourceFiles.rust.worker), rustBuild.workerSha256);
    }
    for (const [engine, files] of Object.entries(sourceFiles)) {
      for (const [role, file] of Object.entries(files)) {
        const filename = engine === 'original' ? `cube48opt${config.variant}.${role === 'wrapper' ? 'mjs' : 'wasm'}`
          : buildContract.shared ? ({ wrapper: buildContract.wrapper, worker: buildContract.worker,
            wasm: 'cube48opt-rust8.wasm', small: 'cube48opt8.small.bin' })[role]
          : `${role}.${role === 'wrapper' ? 'mjs' : role === 'wasm' ? 'wasm' : 'bin'}`;
        const destination = resolve(config.out, 'artifacts', engine, filename);
        copyExclusive(file, destination); artifacts[engine].files[role] = destination;
        artifacts[engine].sha256[role] = await hashFile(destination);
      }
    }
    assert.equal(artifacts.original.sha256.wasm, variant.wasmSha256);
    assert.equal(artifacts.original.sha256.wrapper, variant.wrapperSha256);
    if (resume || config.engine === 'original' && config.variant === 8 && config.threads === 4 && config.compiler === 'turbofan') {
      artifacts.original.upstreamWrapperSha256 = variant.wrapperSha256;
      const wrapper = artifacts.original.files.wrapper;
      writeFileSync(wrapper, patchOriginalWrapper(readFileSync(wrapper, 'utf8')));
      artifacts.original.sha256.wrapper = await hashFile(wrapper);
    }
    assert.equal(artifacts.rust.sha256.wasm, rustBuild.wasmSha256);
    assert.equal(artifacts.rust.sha256.wrapper, rustBuild.wrapperSha256);
    if (buildContract.shared) assert.equal(artifacts.rust.sha256.worker, rustBuild.workerSha256);
    const sourceHashes = {};
    const adapterSources = buildContract.shared ? [] : ['wasm-adapter/wrapper.mjs'];
    for (const name of ['wasm-benchmark.mjs', 'original-wasm-compat.mjs', 'variants.mjs', 'benchmark.mjs', 'oracle.mjs', ...adapterSources]) {
      const file = resolve(HERE, name); sourceHashes[file] = await hashFile(file);
      copyExclusive(file, resolve(config.out, 'source', name));
    }
    if (buildContract.shared) {
      for (const [name, expected] of Object.entries(sharedBuildSources(rustBuild))) {
        // Retained builds must attest their frozen sources, not today's checkout.
        const frozen = resolve(dirname(config.wasm), 'source', name);
        const file = existsSync(frozen) ? frozen : resolve(ROOT, name);
        assert.equal(await hashFile(file), expected, `Shared build source changed since compilation: ${name}`);
        sourceHashes[file] = expected;
        copyExclusive(file, resolve(config.out, 'source/build', name));
      }
    }
    copyExclusive(corpusPath, resolve(config.out, 'cases-source.json'));
    save(resolve(config.out, 'reference-first-pass.json'), reference.slice(0, 100));
    save(resolve(config.out, 'table-manifest.json'), tableManifest);
    save(resolve(config.out, 'small-manifest.json'), smallManifest);
    const schemaVersion = buildContract.shared ? 'v2' : 'v1';
    const input = { schema: `cuberoot.rust-opt-wasm-benchmark-input.${schemaVersion}`, ...config, cases, ...(resume ? {resume} : {}),
      corpusSha256: corpus.corpusSha256, referenceFile: REFERENCE, referenceSha256: await hashFile(REFERENCE),
      tableSha256, artifacts, sourceHashes, rustBuild, threads: config.threads, contexts: 8, warmupCases: 0, measuredPasses: 1,
      method: 'Fresh sequential processes; exact frozen WCA source order; one timed public WASM call per case; no startup solve, warmup or retry',
      measurement: `Monotonic host elapsed seconds surrounding await solve_scramble(scramble,${config.threads},1,true) in both workers; load and independent replay excluded`,
      perCaseTimeoutSeconds: config.threads >= 16 ? 6 * 60 * 60 : 120, startupTimeoutSeconds: 600, node: process.version, execArgv: process.execArgv,
      machine: { platform: process.platform, arch: process.arch, osRelease: release(), cpuModel: cpus()[0]?.model ?? null } };
    const inputFile = resolve(config.out, 'input.json'); save(inputFile, input);
    const summaries = {};
    for (const engine of config.engine === 'both' ? ['rust', 'original'] : [config.engine]) {
      await checkSources(input);
      const directory = resolve(config.out, engine), session = startSession(inputFile, engine, directory), rows = [...prefixRows];
      const results = openSync(resolve(directory, 'results.jsonl'), 'wx');
      if (prefixBytes) { writeSync(results,prefixBytes); fsyncSync(results); }
      try {
        const ready = await session.ready;
        assert.equal(ready.threads, config.threads); assert.equal(ready.warmupCases, 0);
        save(resolve(directory, 'startup.json'), ready);
        for (const [index, item] of cases.entries()) {
          if (index < (resume?.completedCases ?? 0)) continue;
          const result = await session.request(index);
          assert.equal(result.index, index); assert.equal(result.id, item.id);
          assert.equal(result.threads, config.threads);
          assert(Number.isFinite(result.seconds) && result.seconds >= 0);
          verify(puzzle, item, result);
          const row = { ...result, verified: true, optimalLengthMatched: item.htm !== undefined, expectedLength: item.htm ?? null };
          rows.push(row); writeSync(results, JSON.stringify(row) + '\n'); fsyncSync(results);
          process.stderr.write(`[wasm-benchmark] ${engine} ${index + 1}/${count} ${item.id} ${result.seconds.toFixed(6)}s\n`);
        }
        const resource = await session.finish();
        assert.equal(resource.threads, config.threads);
        assert.equal(rows.length, count); await checkSources(input);
        summaries[engine] = { engine, cases: count, verifiedSolutions: count, optimalLengthsMatched: cases.filter(c => c.htm !== undefined).length,
          totalSeconds: rows.reduce((sum, row) => sum + row.seconds, 0),
          peakRssBytes: resource.maxRssKiB * 1024, peakRssMethod: 'Node child resourceUsage().maxRSS, KiB converted to bytes',
          linearMemoryBytes: resource.linearMemoryBytes, loadSeconds: ready.loadSeconds, processExited: true,
          threads: config.threads, warmupCases: 0, measuredPasses: 1, tableSha256, artifacts: artifacts[engine], ...(resume ? {resume} : {}) };
        if (resume) assert.equal(await hashFile(resolve(config.resumeFrom,'original/results.jsonl')),resume.prefixSha256);
        if (engine === 'rust' && config.threads > 1) {
          const workerNodes = Array.from({ length: config.threads }, (_, worker) => rows.reduce((sum, row) => sum + row.search.workers[worker], 0));
          assert(workerNodes.every(count => count > 0), 'All requested workers must have contributed actual search nodes');
          summaries[engine].workerNodes = workerNodes;
          summaries[engine].verifiedDepthBarriers = rows.length;
        }
        save(resolve(directory, 'report.json'), summaries[engine]);
      } finally { await session.close(); closeSync(results); }
    }
    const after = statSync(config.table);
    assert.equal(after.size, tableBefore.size); assert.equal(after.mtimeMs, tableBefore.mtimeMs);
    const ratio = summaries.rust && summaries.original ? summaries.original.totalSeconds / summaries.rust.totalSeconds : null;
    const report = { schema: `cuberoot.rust-opt-wasm-benchmark-report.${schemaVersion}`, variant: config.variant,
      corpusSha256: corpus.corpusSha256, cases: count, threads: config.threads, measuredPasses: 1, warmupCases: 0,
      sameSolveThreadCount: true, compiler: input.compiler ?? "default", machine: input.machine, node: input.node,
      tableSha256, method: input.method, measurement: input.measurement, engines: summaries,
      originalOverRustTotalRatio: ratio, rustFasterOnThisRun: ratio === null ? null : ratio > 1,
      limitations: ['A single pass has no warmup or repetition; performance noise is not estimated.',
        config.threads === 1 ? 'This comparison uses one solve thread. It is not a four-thread production comparison.'
          : `Both engines use ${config.threads} solve threads with one shared table; results describe only the recorded machine/runtime, not an unmeasured server.`,
        'Table loading, checksum validation and independent solution replay are excluded from solve seconds.',
        'Every solution is replayed independently. Only the first 100 have retained H10 reference lengths; additional cases require cross-engine length comparison.',
        'An individual engine report remains valid when a later engine fails; never rerun or overwrite it implicitly.'] };
    save(resolve(config.out, 'report.json'), report); process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } catch (error) {
    save(resolve(config.out, 'failure.json'), { failedAt: new Date().toISOString(), error: String(error.stack ?? error), partialResultsPreserved: true });
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const task = process.argv[2] === '--worker' ? worker(process.argv[3], process.argv[4]) : main();
  task.catch(error => { process.stderr.write(`${error.stack ?? error}\n`); process.exit(1); });
}
