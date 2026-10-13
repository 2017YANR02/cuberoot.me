#!/usr/bin/env node
// Guarded, single-pass WCA100 comparison. The parent never allocates a PDB.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants, closeSync, copyFileSync, createReadStream, existsSync, fstatSync, fsyncSync, mkdirSync, openSync, readFileSync, readSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getVariant } from './variants.mjs';

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
    assert(['--variant', '--engine', '--table', '--small', '--wasm', '--out'].includes(key), `Unknown argument: ${key}`);
    assert(!Object.hasOwn(values, key) && args.length && !args[0].startsWith('--'), `Missing or duplicate ${key}`);
    values[key] = args.shift();
  }
  assert(/^[89]$/.test(values['--variant'] ?? ''), 'This comparison permits only Opt8 or Opt9');
  const engine = values['--engine'] ?? 'both';
  assert(['both', 'rust', 'original'].includes(engine), 'engine must be both, rust or original');
  for (const key of ['--table', '--small', '--wasm', '--out']) assert(values[key], `${key} is required`);
  return { variant: Number(values['--variant']), engine,
    table: resolve(values['--table']), small: resolve(values['--small']),
    wasm: resolve(values['--wasm']), out: resolve(values['--out']) };
}

export function readWca100(file = CORPUS) {
  const corpus = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(corpus.schema, 'cuberoot.solver.wca-first100.v1');
  assert.equal(corpus.cases.length, 100);
  assert.equal(corpus.corpusSha256, CORPUS_HASH);
  assert.equal(new Set(corpus.cases.map(row => row.id)).size, 100);
  for (const [index, row] of corpus.cases.entries()) {
    assert.equal(row.sourceLine, index + 1);
    assert(/^\d+$/.test(row.id) && TOKEN_SEQUENCE.test(row.scramble) && !/[\r\n]/.test(row.scramble));
  }
  const canonical = corpus.cases.map(row => `${row.id},${row.scramble}\n`).join('');
  assert.equal(createHash('sha256').update(canonical).digest('hex'), CORPUS_HASH, 'Frozen WCA100 was changed');
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
  assert.equal(process.env.CUBEOPT_VARIANT, String(input.variant));
  await checkSources(input);
  const variant = getVariant(input.variant), lines = [], start = performance.now();
  const artifact = input.artifacts[engine];
  for (const [role, file] of Object.entries(artifact.files))
    assert.equal(await hashFile(file), artifact.sha256[role], `Worker artifact changed: ${role}`);
  const create = (await import(pathToFileURL(artifact.files.wrapper).href)).default;
  const log = line => lines.push(String(line));
  const module = engine === 'rust'
    ? await create({ variant: input.variant, wasmBinary: readFileSync(artifact.files.wasm),
      smallTableBytes: readFileSync(artifact.files.small), print: log, printErr: log })
    : await create({ print: log, printErr: log,
      wasmMemory: new WebAssembly.Memory({ initial: 256n, maximum: BigInt(variant.linearMemoryLimitPages), shared: true, address: 'i64' }) });
  assert.equal(Number(module.get_table_size()), variant.tableBytes);
  assert.equal(module.get_table_name(), variant.tableName);
  const loaded = streamTable(module, input.table, variant.tableBytes, input.tableSha256);
  const initResult = module.init(0, 1);
  if (engine === 'original') {
    assert.equal(initResult, 0, 'Original table adoption failed');
    assert.equal(module.init(-1, 1), 0, 'Original table validation failed');
  } else {
    assert.equal(module.metadata.variant, input.variant);
    assert.equal(module.metadata.threads, 1);
  }
  for (const line of lines) process.stderr.write(line + '\n');
  const ready = { type: 'ready', engine, loaded, loadSeconds: (performance.now() - start) / 1000,
    linearMemoryBytes: module.HEAPU8.byteLength, threads: 1, warmupCases: 0 };
  let index = 0, busy = false;
  process.on('message', async message => {
    try {
      assert(!busy, 'Concurrent worker request'); busy = true;
      if (message.type === 'finish') {
        assert.equal(index, 100, 'A partial pass cannot finish successfully');
        await send({ type: 'finished', engine, cases: index,
          maxRssKiB: process.resourceUsage().maxRSS, linearMemoryBytes: module.HEAPU8.byteLength });
        process.exit(0);
      }
      assert.equal(message.type, 'solve'); assert.equal(message.index, index);
      const item = input.cases[index]; assert(item);
      lines.length = 0;
      const started = performance.now();
      const raw = module.solve_scramble(item.scramble, 1, 1, true);
      const seconds = (performance.now() - started) / 1000;
      const printed = parsePrintedSolution(lines);
      if (engine === 'rust') {
        assert.equal(raw.cancelled, false); assert.equal(raw.contexts, 8);
        assert.equal(raw.length, printed.length); assert.equal(raw.solution.trim(), printed.solution);
        assert.equal(raw.completed_depth, raw.length - 1, 'Rust search did not finish all shorter bounds');
      }
      const response = { type: 'result', engine, index, id: item.id, seconds, ...printed,
        output: [...lines], ...(engine === 'rust' ? { search: raw } : {}) };
      index++; busy = false;
      await send(response);
    } catch (error) {
      process.stderr.write(`${error.stack ?? error}\n`); process.exit(1);
    }
  });
  await send(ready);
}

function startSession(inputFile, engine, directory) {
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
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--worker', inputFile, engine],
    { stdio: ['ignore', stdout, stderr, 'ipc'] });
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
    writeSync(raw, JSON.stringify(message) + '\n'); fsyncSync(raw);
    const active = pending;
    try {
      assert(active, `${engine} unsolicited worker message`);
      assert.equal(message.type, active.type); assert.equal(message.engine, engine);
      clearTimeout(active.timer); pending = null; active.done(message);
    } catch (error) { reject(error); }
  });
  return {
    ready,
    request(index) {
      const result = expect('result', 120_000);
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
      if (!ended) child.kill('SIGTERM');
      const timer = setTimeout(() => child.kill('SIGKILL'), 1500);
      await closed; clearTimeout(timer);
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
  assert.equal(lock.pid, process.ppid, 'Run this comparison directly under guard.mts');
  assert.equal(lock.entry, 'wasm-benchmark.mjs');
  assert(!existsSync(config.out), `Refusing to overwrite ${config.out}`);
  mkdirSync(dirname(config.out), { recursive: true }); mkdirSync(config.out);
  try {
    const variant = getVariant(config.variant), corpus = readWca100();
    const { verify } = await import('./benchmark.mjs');
    const { cube3x3x3 } = await import(pathToFileURL(resolve(ROOT, 'core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js')).href);
    const puzzle = await cube3x3x3.kpuzzle();
    const reference = readFileSync(REFERENCE, 'utf8').trim().split('\n').map(line => JSON.parse(line));
    assert.equal(reference.length, 400);
    const cases = corpus.cases.map((item, index) => {
      const row = reference[index]; assert.equal(row.id, `r0_${item.id}`); assert.equal(row.cancelled, false);
      verify(puzzle, item, row); return { ...item, htm: row.length };
    });
    const tableBefore = statSync(config.table); assert.equal(tableBefore.size, variant.tableBytes);
    const tableManifest = JSON.parse(readFileSync(resolve(dirname(config.table), 'table.json'), 'utf8'));
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
    const rustWrapper = resolve(dirname(config.wasm), 'wrapper.mjs');
    assert.equal(rustBuild.schema, 'cuberoot.rust-opt-wasm64.build.v1');
    assert.equal(rustBuild.target, 'wasm64-unknown-unknown'); assert.equal(rustBuild.threads, 1);
    assert.equal(await hashFile(config.wasm), rustBuild.wasmSha256);
    assert.equal(statSync(config.wasm).size, rustBuild.wasmBytes);
    assert.equal(await hashFile(rustWrapper), rustBuild.wrapperSha256);
    copyExclusive(buildFile, resolve(config.out, 'rust-build-metadata.json'));
    const artifacts = { rust: { files: {}, sha256: {} }, original: { files: {}, sha256: {} } };
    const sourceFiles = { rust: { wrapper: rustWrapper, wasm: config.wasm, small: config.small },
      original: { wrapper: resolve(ROOT, `core/packages/client/public/cubeopt/cube48opt${config.variant}.mjs`),
        wasm: resolve(ROOT, `core/packages/client/public/cubeopt/cube48opt${config.variant}.wasm`) } };
    for (const [engine, files] of Object.entries(sourceFiles)) {
      for (const [role, file] of Object.entries(files)) {
        const filename = engine === 'original' ? `cube48opt${config.variant}.${role === 'wrapper' ? 'mjs' : 'wasm'}` : `${role}.${role === 'wrapper' ? 'mjs' : role === 'wasm' ? 'wasm' : 'bin'}`;
        const destination = resolve(config.out, 'artifacts', engine, filename);
        copyExclusive(file, destination); artifacts[engine].files[role] = destination;
        artifacts[engine].sha256[role] = await hashFile(destination);
      }
    }
    assert.equal(artifacts.original.sha256.wasm, variant.wasmSha256);
    assert.equal(artifacts.original.sha256.wrapper, variant.wrapperSha256);
    assert.equal(artifacts.rust.sha256.wasm, rustBuild.wasmSha256);
    assert.equal(artifacts.rust.sha256.wrapper, rustBuild.wrapperSha256);
    const sourceHashes = {};
    for (const name of ['wasm-benchmark.mjs', 'variants.mjs', 'benchmark.mjs', 'oracle.mjs', 'wasm-adapter/wrapper.mjs']) {
      const file = resolve(HERE, name); sourceHashes[file] = await hashFile(file);
      copyExclusive(file, resolve(config.out, 'source', name));
    }
    copyExclusive(CORPUS, resolve(config.out, 'cases-source.json'));
    save(resolve(config.out, 'reference-first-pass.json'), reference.slice(0, 100));
    save(resolve(config.out, 'table-manifest.json'), tableManifest);
    save(resolve(config.out, 'small-manifest.json'), smallManifest);
    const input = { schema: 'cuberoot.rust-opt-wasm-benchmark-input.v1', ...config, cases,
      corpusSha256: CORPUS_HASH, referenceFile: REFERENCE, referenceSha256: await hashFile(REFERENCE),
      tableSha256, artifacts, sourceHashes, rustBuild, threads: 1, contexts: 8, warmupCases: 0, measuredPasses: 1,
      method: 'Fresh sequential processes; exact WCA100 order; one timed public WASM call per case; no startup solve, warmup or retry',
      measurement: 'Monotonic host elapsed seconds surrounding solve_scramble(scramble,1,1,true) in both workers; load and independent replay excluded',
      perCaseTimeoutSeconds: 120, startupTimeoutSeconds: 600, node: process.version, execArgv: process.execArgv };
    const inputFile = resolve(config.out, 'input.json'); save(inputFile, input);
    const summaries = {};
    for (const engine of config.engine === 'both' ? ['rust', 'original'] : [config.engine]) {
      await checkSources(input);
      const directory = resolve(config.out, engine), session = startSession(inputFile, engine, directory), rows = [];
      const results = openSync(resolve(directory, 'results.jsonl'), 'wx');
      try {
        const ready = await session.ready; save(resolve(directory, 'startup.json'), ready);
        for (const [index, item] of cases.entries()) {
          const result = await session.request(index);
          assert.equal(result.index, index); assert.equal(result.id, item.id);
          assert(Number.isFinite(result.seconds) && result.seconds >= 0);
          verify(puzzle, item, result);
          const row = { ...result, verified: true, optimalLengthMatched: true, expectedLength: item.htm };
          rows.push(row); writeSync(results, JSON.stringify(row) + '\n'); fsyncSync(results);
          process.stderr.write(`[wasm-benchmark] ${engine} ${index + 1}/100 ${item.id} ${result.seconds.toFixed(6)}s\n`);
        }
        const resource = await session.finish();
        assert.equal(rows.length, 100); await checkSources(input);
        summaries[engine] = { engine, cases: 100, verifiedSolutions: 100, optimalLengthsMatched: 100,
          totalSeconds: rows.reduce((sum, row) => sum + row.seconds, 0),
          peakRssBytes: resource.maxRssKiB * 1024, peakRssMethod: 'Node child resourceUsage().maxRSS, KiB converted to bytes',
          linearMemoryBytes: resource.linearMemoryBytes, loadSeconds: ready.loadSeconds, processExited: true,
          threads: 1, warmupCases: 0, measuredPasses: 1, tableSha256, artifacts: artifacts[engine] };
        save(resolve(directory, 'report.json'), summaries[engine]);
      } finally { await session.close(); closeSync(results); }
    }
    const after = statSync(config.table);
    assert.equal(after.size, tableBefore.size); assert.equal(after.mtimeMs, tableBefore.mtimeMs);
    const ratio = summaries.rust && summaries.original ? summaries.original.totalSeconds / summaries.rust.totalSeconds : null;
    const report = { schema: 'cuberoot.rust-opt-wasm-benchmark-report.v1', variant: config.variant,
      corpusSha256: CORPUS_HASH, cases: 100, threads: 1, measuredPasses: 1, warmupCases: 0,
      tableSha256, method: input.method, measurement: input.measurement, engines: summaries,
      originalOverRustTotalRatio: ratio, rustFasterOnThisRun: ratio === null ? null : ratio > 1,
      limitations: ['A single pass has no warmup or repetition; performance noise is not estimated.',
        'This comparison uses one solve thread. It is not a four-thread production comparison.',
        'Table loading, checksum validation and independent solution replay are excluded from solve seconds.',
        'Every solution is replayed independently and its length matched to the retained verified H10 first pass; this is not an independent proof of optimality.',
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
