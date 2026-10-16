import { Worker } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';
import { instantiate, INITIAL_BYTES, WORKER_REGION_BYTES, MAX_THREADS } from './cube48opt-rust8-worker.mjs';

export const RUST_OPT_SHARED_ABI = 2;
export const RUST_OPT_SUPPORTED_VARIANTS = Object.freeze([1,2,3,4,5,6,7,8,9]);
const PAGE = 65536;
const MAX_PAGES = 16 * 1024 ** 3 / PAGE;
function integer(value, name, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${name} must be ${min}..${max}`);
  return value;
}
// This is a claim from the checked WASM constructor, not a replacement for a
// pruning-table checksum or independent solution verification. The coordinator
// requires every worker to attest the same immutable root and inverse bounds.
export function validateRootBoundProof(proof, threads, { allowFixture = false } = {}) {
  integer(threads, 'proof threads', 1, MAX_THREADS);
  if (!proof || proof.schema !== 'cuberoot.root-bound-proof.v1') throw new Error('Missing root-bound proof');
  if (proof.source !== 'pdb-forward-inverse' && !(allowFixture && proof.source === 'fixture-orientation-bound'))
    throw new Error('Unsupported root-bound proof source');
  integer(proof.maximum, 'oracle maximum', 10, 13);
  integer(proof.lowerBound, 'root lower bound', 0, proof.maximum);
  if (proof.oracleLookups !== 4 * threads) throw new Error('Root proof must include the independently repeated reads');
  if (!Array.isArray(proof.workers) || proof.workers.length !== threads) throw new Error('Incomplete root-bound worker proofs');
  const seen = new Set();
  const expected = proof.workers[0];
  for (const row of proof.workers) {
    integer(row.worker, 'proof worker', 0, threads - 1);
    integer(row.normal, 'normal root bound', 0, proof.maximum);
    integer(row.inverse, 'inverse root bound', 0, proof.maximum);
    if (seen.has(row.worker)) throw new Error('Duplicate root-bound worker proof');
    seen.add(row.worker);
    if (row.normal !== expected.normal || row.inverse !== expected.inverse) throw new Error('Workers disagree on root bounds');
    if (Math.max(row.normal, row.inverse) !== proof.lowerBound) throw new Error('Initial depth lacks a matching root bound');
  }
  return proof.lowerBound;
}
export function errorFromWorker(message) {
  const context = `worker=${message.worker ?? '?'} operation=${message.operation ?? '?'} depth=${message.depth ?? '-'}`;
  const error = new Error(`Rust WASM ${context}: ${message.error}`);
  error.workerDetails = { worker: message.worker, operation: message.operation, depth: message.depth, heap: message.heap };
  if (message.errorStack) error.stack += `\nWorker stack:\n${message.errorStack}`;
  if (message.heap) error.stack += `\nWorker arena: ${JSON.stringify(message.heap)}`;
  return error;
}
// All stacks/arenas follow the single table, at disjoint page-aligned offsets.
// Check the whole reservation before grow or workers are started. Opt9 + 18
// regions still fits the pinned linker's 16 GiB shared-memory maximum.
export function sharedMemoryLayout(tablePointer, tableBytes, threads) {
  integer(tablePointer, 'table pointer', INITIAL_BYTES, MAX_PAGES * PAGE);
  integer(tableBytes, 'table bytes', 0, MAX_PAGES * PAGE);
  integer(threads, 'threads', 1, MAX_THREADS);
  const regionBase = Math.ceil((tablePointer + tableBytes) / PAGE) * PAGE;
  const requiredBytes = regionBase + threads * WORKER_REGION_BYTES;
  if (requiredBytes > MAX_PAGES * PAGE) throw new Error('Table and worker regions exceed the 16 GiB shared-memory limit');
  return Object.freeze({ regionBase, requiredBytes, workerRegionBytes: WORKER_REGION_BYTES });
}
async function bytes(source) {
  if (source instanceof Uint8Array) return source;
  if (source instanceof ArrayBuffer) return new Uint8Array(source);
  const url = source instanceof URL ? source : new URL(source, import.meta.url);
  if (url.protocol === 'file:') return readFile(url);
  const response = await fetch(url); if (!response.ok) throw new Error(`Asset HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

// One shared linear memory and one immutable pruning table. Each worker has
// its own WASM instance, stack, allocator arena and DepthSearch session.
export default async function createModule(options = {}) {
  const variant = integer(options.variant ?? 8, 'variant', 1, 9);
  const threads = integer(options.threads ?? 4, 'threads', 1, MAX_THREADS);
  const compiled = options.wasmModule ?? await WebAssembly.compile(await bytes(options.wasmBinary
    ?? options.wasmURL ?? new URL('./cube48opt-rust8.wasm', import.meta.url)));
  const memory = new WebAssembly.Memory({ initial: BigInt(INITIAL_BYTES / PAGE), maximum: BigInt(MAX_PAGES), shared: true, address: 'i64' });
  const { instance, api } = await instantiate(compiled, memory);
  const rootBoundEnabled = api.cubeopt_root_bound_enabled?.() === 1;
  if (options.fixtureRootBound && (!options.fixture || !rootBoundEnabled)) throw new Error('Root-bound fixture requires an enabled small-check module');
  const maxThreads = api.cubeopt_max_threads();
  if (threads > maxThreads) throw new Error(`This WASM supports at most ${maxThreads} workers`);
  if (api.cubeopt_supports_variant(variant) !== 1) throw new Error('WASM does not support this variant');
  const tableBytes = Number(api.cubeopt_table_bytes(variant));
  const snapshotBytes = Number(api.cubeopt_snapshot_bytes(variant));
  const tablePointer = Number(api.cubeopt_pdb_ptr());
  const layout = sharedMemoryLayout(tablePointer, options.fixture ? 0 : tableBytes, threads);
  const metadata = Object.freeze({ implementation: 'cuberoot-rust-opt-shared-wasm', abiVersion: 2,
    variant, threads, maxThreads, memory64: true, sharedTable: true, tableBytes, snapshotBytes, rootBoundEnabled,
    workerRegionBytes: layout.workerRegionBytes, reservedMemoryBytes: layout.requiredBytes });
  const workers = [];
  let nextId = 0, ready = false, busy = false, broken = false, initializing, closing;
  const control = new Int32Array(memory.buffer, Number(api.cubeopt_control_ptr()), 2);
  const close = () => {
    if (closing) return closing;
    broken = true; ready = false;
    const error = new Error('Rust worker pool was closed');
    // Termination intentionally suppresses the normal exit failure handler;
    // settle both startup and request promises here before terminating.
    for (const w of workers) {
      w.rejectStartup(error);
      for (const pending of w.pending.values()) pending.reject(error);
      w.pending.clear();
    }
    closing = Promise.all(workers.map(w => w.worker.terminate())).then(() => undefined);
    return closing;
  };
  const call = (w, operation, args = {}) => new Promise((resolve, reject) => {
    const id = ++nextId; w.pending.set(id, { resolve, reject });
    w.worker.postMessage({ id, operation, ...args });
  });
  const module = {
    metadata, wasmModule: compiled, wasmInstance: instance, wasmMemory: memory,
    get HEAPU8() { return new Uint8Array(memory.buffer); },
    get_table_size: () => BigInt(tableBytes),
    get_table_name: () => variant === 1 ? 'h48prun01.dat' : `h48prun31h${variant}.dat`,
    _get_mem_ptr() { if (options.instantiateOnly || options.fixture) throw new Error('No pruning allocation in probe/fixture mode'); return BigInt(tablePointer); },
    async init(generate = 0, requestedThreads = threads) {
      if (generate !== 0) throw new Error('Table generation is not supported');
      if (requestedThreads !== threads) throw new Error(`This instance owns exactly ${threads} workers`);
      if (options.instantiateOnly) throw new Error('Initialization disabled in instantiateOnly probe');
      if (broken) throw new Error('Worker pool is closed or failed');
      if (ready) return metadata;
      if (initializing) return initializing;
      initializing = (async () => {
        if (!options.fixture && api.cubeopt_validate_table(variant) !== 0) throw new Error('Pruning table checksum/distribution validation failed');
        const workerURL = options.workerURL ?? new URL('./cube48opt-rust8-worker.mjs', import.meta.url);
        await Promise.all(Array.from({ length: threads }, (_, index) => new Promise((resolve, reject) => {
          const worker = new Worker(workerURL, { workerData: { compiled, memory, variant, threads, index,
            fixture: !!options.fixture, fixtureRootBound: !!options.fixtureRootBound,
            region: layout.regionBase + index * WORKER_REGION_BYTES } });
          const w = { worker, pending: new Map(), rejectStartup: reject }; workers.push(w);
          const fail = error => { broken = true; reject(error); for (const p of w.pending.values()) p.reject(error); w.pending.clear(); };
          worker.on('error', fail);
          worker.on('exit', code => { if (!broken) fail(new Error(`Rust worker exited: ${code}`)); });
          worker.on('message', message => {
            if (message.ready) { resolve(); return; }
            const pending = w.pending.get(message.id);
            if (!pending) { if (message.error) fail(errorFromWorker(message)); return; }
            w.pending.delete(message.id);
            if (message.error) { const error = errorFromWorker(message); pending.reject(error); fail(error); }
            else pending.resolve(message.value);
          });
        })));
        if (broken) throw new Error('Rust worker pool was closed during initialization');
        ready = true; return metadata;
      })().catch(async error => { await close(); throw error; });
      return initializing;
    },
    async solve(scramble, { maxDepth = 20, contexts = 8, maxNodes = 0, threads: requestedThreads = threads } = {}) {
      if (!ready || broken) throw new Error('Initialize a healthy pool before solving');
      if (busy) throw new Error('One scramble at a time per shared table');
      if (requestedThreads !== threads) throw new Error(`This instance owns exactly ${threads} workers`);
      if (contexts !== 8 || (maxNodes !== 0 && maxNodes !== 0n)) throw new Error('Shared WASM requires contexts=8 and maxNodes=0');
      if (typeof scramble !== 'string') throw new Error('Scramble must be a string');
      integer(maxDepth, 'maxDepth', 0, 20);
      busy = true;
      const start = performance.now();
      const stats = { nodes: 0, probes: 0, jobs: 0, workers: Array(threads).fill(0), depthResults: [] };
      try {
        Atomics.store(control, 0, 0);
        const roots = await Promise.all(workers.map(w => call(w, 'begin', { scramble })));
        let initialDepth = 0;
        if (rootBoundEnabled) {
          const first = roots[0];
          const rootBoundProof = { schema: 'cuberoot.root-bound-proof.v1', source: first.rootBounds?.source,
            lowerBound: first.initialDepth, maximum: first.rootBounds?.maximum, oracleLookups: 4 * threads,
            workers: roots.map(r => ({ worker: r.worker, normal: r.rootBounds?.normal, inverse: r.rootBounds?.inverse })) };
          initialDepth = validateRootBoundProof(rootBoundProof, threads, { allowFixture: !!options.fixtureRootBound });
          if (roots.some(r => r.initialDepth !== initialDepth || r.rootBounds?.source !== rootBoundProof.source
            || r.rootBounds?.maximum !== rootBoundProof.maximum)) throw new Error('Workers disagree on the initial depth proof');
          Object.assign(stats, { initialDepth, skippedDepths: initialDepth, rootBoundProof });
          // These four reads per worker occur during begin, inside the timed
          // solve call; do not hide them from the aggregate lookup count.
          stats.probes += rootBoundProof.oracleLookups;
        }
        for (let depth = initialDepth; depth <= maxDepth; depth++) {
          Atomics.store(control, 0, 0);
          const results = await Promise.all(workers.map(w => call(w, 'depth', { depth })));
          for (const r of results) { stats.nodes += r.nodes; stats.probes += r.probes; stats.jobs += r.jobs; stats.workers[r.worker] += r.nodes; }
          stats.depthResults.push(results);
          const found = results.find(r => r.solution !== null);
          if (found) return { solution: found.solution, length: depth, completed_depth: depth ? depth - 1 : null,
            cancelled: false, contexts: 8, threads, seconds: (performance.now() - start) / 1000, ...stats };
          if (results.some(r => !r.completed || r.cancelled)) throw new Error('Shard cancelled without a verified sibling solution');
        }
        return { solution: null, length: null, completed_depth: maxDepth, cancelled: false,
          contexts: 8, threads, seconds: (performance.now() - start) / 1000, ...stats };
      } catch (error) { await close(); throw error; }
      finally { busy = false; }
    },
    async solve_scramble(scramble, requestedThreads = threads, count = 1, debug = true) {
      if (count !== 1) throw new Error('One scramble per call');
      const result = await module.solve(scramble, { threads: requestedThreads });
      if (result.solution === null) throw new Error('No complete solution');
      if (debug) options.print?.(`Solution found!: ${result.solution}`);
      options.print?.(`Cube1 finished in ${result.length}`);
      return result;
    },
    async fixtureCoordinates(scramble) {
      if (!options.fixture || !ready || busy) throw new Error('Fixture mode only');
      return Promise.all(workers.map(w => call(w, 'coordinate', { scramble })));
    },
    async fixtureDeepPrefixes(scramble) {
      if (!options.fixture || !ready || busy) throw new Error('Fixture mode only');
      Atomics.store(control, 0, 0);
      await Promise.all(workers.map(w => call(w, 'begin', { scramble })));
      const depths = [];
      for (let depth = 0; depth <= 20; depth++) {
        depths.push(await Promise.all(workers.map(w => call(w, 'resource-depth', { depth }))));
      }
      return depths;
    },
    async allocationStats() { if (!ready || busy) throw new Error('Pool must be idle'); return Promise.all(workers.map(w => call(w, 'stats'))); },
    close,
  };
  if (options.instantiateOnly) return module;
  if (options.fixture && typeof api.cubeopt_fixture_create !== 'function') throw new Error('Production module cannot use the fixture oracle');
  if (options.fixtureRootBound && typeof api.cubeopt_fixture_root_bound_create !== 'function') throw new Error('Production module cannot use the root-bound fixture oracle');
  memory.grow(BigInt(layout.requiredBytes / PAGE - INITIAL_BYTES / PAGE));
  const snapshot = await bytes(options.smallTableBytes ?? options.snapshotURL ?? options.smallTableURL
    ?? new URL(`./cube48opt${variant}.small.bin`, import.meta.url));
  if (snapshot.byteLength !== snapshotBytes) throw new Error(`Snapshot must contain ${snapshotBytes} bytes`);
  new Uint8Array(memory.buffer, Number(api.cubeopt_snapshot_ptr()), snapshot.byteLength).set(snapshot);
  return module;
}
