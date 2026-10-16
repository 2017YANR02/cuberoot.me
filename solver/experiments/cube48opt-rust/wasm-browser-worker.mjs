// Dedicated top-level browser compute Worker. No UI, Node imports, or table
// generation. Its owner persists each result before acknowledging the next one.
const CHUNK_BYTES = 8 * 1024 * 1024;
const PAGE_BYTES = 65536;
const TABLE_BYTES = { 8: 7_782_727_680, 9: 15_565_455_360 };
let state = 'idle', pendingControl = null, moduleInstance = null, currentIndex = null;
const post = message => self.postMessage(message);
const check = (condition, message) => { if (!condition) throw new Error(message); };
const digest = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
  .map(value => value.toString(16).padStart(2, '0')).join('');

function sameOriginURL(value) {
  const url = new URL(value, self.location.href);
  check(url.origin === self.location.origin && /^https?:$/.test(url.protocol), 'Benchmark assets must be same-origin HTTP');
  return url.href;
}
function waitFor(type, index) {
  check(!pendingControl, 'An acknowledgement is already pending');
  return new Promise((resolve, reject) => { pendingControl = { type, index, resolve, reject }; });
}
function fail(error) {
  if (state === 'error' || state === 'complete') return;
  const stage = state; state = 'error';
  const pending = pendingControl; pendingControl = null; pending?.reject(error);
  post({ type: 'error', stage, index: currentIndex, message: String(error?.message ?? error), stack: String(error?.stack ?? error) });
  // The harness must still terminate its browser process tree. Original
  // Emscripten owns nested workers which have no exposed close() method.
  Promise.resolve(moduleInstance?.close?.()).catch(() => undefined);
}

async function smallBytes(url) {
  const response = await fetch(sameOriginURL(url), { cache: 'no-store' });
  check(response.ok, `Asset HTTP ${response.status}`);
  const declared = Number(response.headers.get('content-length'));
  check(Number.isSafeInteger(declared) && declared > 0 && declared <= CHUNK_BYTES, 'Small asset length is missing or exceeds 8 MiB');
  const bytes = new Uint8Array(await response.arrayBuffer());
  check(bytes.length === declared, 'Small asset length changed');
  return bytes;
}

async function loadTable(module, config) {
  const pointer = Number(module._get_mem_ptr());
  check(Number.isSafeInteger(pointer) && pointer >= 0, 'Invalid table pointer');
  check(pointer + config.tableBytes <= module.HEAPU8.byteLength, 'Table does not fit the shared linear memory');
  const url = sameOriginURL(config.tableURL);
  for (let offset = 0; offset < config.tableBytes; offset += CHUNK_BYTES) {
    const length = Math.min(CHUNK_BYTES, config.tableBytes - offset), end = offset + length - 1;
    const response = await fetch(url, { cache: 'no-store', headers: { Range: `bytes=${offset}-${end}` } });
    check(response.status === 206, 'Table endpoint must honor a bounded Range request with HTTP 206');
    check(response.headers.get('content-range') === `bytes ${offset}-${end}/${config.tableBytes}`, 'Unexpected table Content-Range');
    check(Number(response.headers.get('content-length')) === length, 'Unexpected table chunk length');
    const expectedHash = response.headers.get('x-content-sha256');
    check(/^[0-9a-f]{64}$/.test(expectedHash ?? ''), 'Table chunk SHA-256 is missing');
    const chunk = new Uint8Array(await response.arrayBuffer());
    check(chunk.length === length && await digest(chunk) === expectedHash, 'Table chunk checksum mismatch');
    module.HEAPU8.set(chunk, pointer + offset);
    post({ type: 'progress', phase: 'table', loadedBytes: offset + length, totalBytes: config.tableBytes });
  }
  return { tablePointer: pointer, loadedBytes: config.tableBytes, chunkBytes: CHUNK_BYTES, chunkSha256Verified: true };
}

function printedResult(lines) {
  // Same output grammar and checks as wasm-benchmark.mjs:parsePrintedSolution.
  const text = lines.join('\n');
  check(!/unsolved|Error, solution not correct!/i.test(text), 'Original solver reported failure');
  const solutions = [...text.matchAll(/Solution found!:[ \t]*([^\r\n]*)/g)];
  const lengths = [...text.matchAll(/Cube\d+ finished in (\d+)/g)];
  check(solutions.length === 1 && lengths.length === 1, 'Expected exactly one completed solution');
  const timer = text.match(/\btt=([0-9.]+) ms/);
  return { solution: solutions[0][1].trim(), length: Number(lengths[0][1]),
    engineReportedSeconds: timer ? Number(timer[1]) / 1000 : null };
}

function validateConfig(config) {
  check(config && ['rust', 'original'].includes(config.engine), 'Unknown benchmark engine');
  check([8, 9].includes(config.variant), 'Only Opt8/9 browser comparison is supported');
  check(config.threads === (config.variant === 8 ? 4 : 16), 'Threads must match the fixed 8G/16G protocol');
  const mode = config.mode ?? 'benchmark';
  check(['benchmark', 'capability', 'fixture'].includes(mode), 'Unknown browser mode');
  if (mode !== 'capability') {
    check(Array.isArray(config.cases) && config.cases.length > 0, 'Cases are required');
    check(new Set(config.cases.map(item => item.id)).size === config.cases.length, 'Duplicate case IDs');
    for (const item of config.cases) check(typeof item.id === 'string' && typeof item.scramble === 'string'
      && item.scramble.length <= 4096 && !/[\r\n]/.test(item.scramble), 'Invalid case');
  }
  if (mode === 'benchmark') {
    check(config.tableBytes === TABLE_BYTES[config.variant], 'Wrong table size');
    check(config.cases.length === (config.variant === 8 ? 100 : 1000), 'Wrong fixed corpus length');
  }
  if (mode === 'fixture') {
    check(config.engine === 'rust' && config.cases.length <= 262, 'Fixture mode requires a bounded Rust corpus');
    check(['coordinates', 'solve'].includes(config.fixtureOperation ?? 'coordinates'), 'Unknown fixture operation');
    if (config.fixtureOperation === 'solve') {
      check(Number.isInteger(config.fixtureMaxDepth) && config.fixtureMaxDepth >= 0 && config.fixtureMaxDepth <= 3, 'Fixture depth must be 0..3');
      for (const item of config.cases) check(item.scramble.trim().split(/\s+/).filter(Boolean).length <= 3, 'Shallow fixture input exceeds three moves');
    }
  }
  return mode;
}

async function run(config) {
  const mode = validateConfig(config), { engine, variant, threads } = config;
  state = 'loading';
  check(self.crossOriginIsolated && typeof SharedArrayBuffer === 'function', 'Cross-origin isolation and SharedArrayBuffer are required');
  const started = performance.now(), lines = [];
  const wasm = await smallBytes(config.wasmURL), wasmSha256 = await digest(wasm);
  const create = (await import(sameOriginURL(config.moduleURL))).default;
  const log = line => lines.push(String(line));
  let memory;
  if (engine === 'rust') {
    moduleInstance = await create({ variant, threads, wasmBinary: wasm, print: log, printErr: log,
      ...(mode === 'capability' ? { instantiateOnly: true } : { snapshotURL: sameOriginURL(config.smallURL) }),
      ...(mode === 'fixture' ? { fixture: true } : {}) });
    memory = moduleInstance.wasmMemory;
  } else {
    memory = new WebAssembly.Memory({ initial: 256n, maximum: 262144n, shared: true, address: 'i64' });
    moduleInstance = await create({ wasmBinary: wasm, wasmMemory: memory, print: log, printErr: log,
      locateFile: () => sameOriginURL(config.wasmURL) });
  }
  const module = moduleInstance;
  check(Number(module.get_table_size()) === TABLE_BYTES[variant], 'Module table size differs from the selected variant');
  check(module.get_table_name() === `h48prun31h${variant}.dat`, 'Module table name differs from the selected variant');
  check(memory.buffer instanceof SharedArrayBuffer, 'Module did not use shared memory');
  const capabilities = { userAgent: navigator.userAgent, hardwareConcurrency: navigator.hardwareConcurrency,
    crossOriginIsolated: self.crossOriginIsolated, sharedMemory: true, memory64: true,
    atomicsWaitAsync: typeof Atomics.waitAsync === 'function', wasmSha256 };
  let loaded = null;
  if (mode === 'benchmark') loaded = await loadTable(module, config);
  if (mode !== 'capability') {
    const initialized = await module.init(0, threads);
    if (engine === 'original') {
      check(initialized === 0 && await module.init(-1, threads) === 0, 'Original table adoption/validation failed');
    } else {
      check(module.metadata.threads === threads && module.metadata.abiVersion === 2 && module.metadata.sharedTable === true, 'Unexpected Rust shared ABI');
    }
  } else check(memory.buffer.byteLength === 256 * PAGE_BYTES, 'Capability mode must remain at 16 MiB without a pruning table');
  state = 'ready';
  const start = waitFor('start');
  post({ type: 'ready', mode, engine, variant, threads, loadSeconds: (performance.now() - started) / 1000,
    tableBytes: mode === 'benchmark' ? config.tableBytes : 0, loaded, linearMemoryBytes: memory.buffer.byteLength,
    metadata: module.metadata ?? null, capabilities, warmupCases: 0, output: [...lines] });
  await start;
  state = 'running';
  let totalSeconds = 0;
  const cases = mode === 'capability' ? [] : config.cases;
  for (const [index, item] of cases.entries()) {
    currentIndex = index; lines.length = 0;
    if (mode === 'fixture') {
      const value = config.fixtureOperation === 'solve'
        ? await module.solve(item.scramble, { threads, maxDepth: config.fixtureMaxDepth })
        : await module.fixtureCoordinates(item.scramble);
      const ack = waitFor('ack', index);
      post({ type: 'fixture', index, id: item.id, scramble: item.scramble, operation: config.fixtureOperation ?? 'coordinates', value });
      await ack; continue;
    }
    const solveStarted = performance.now();
    const raw = await module.solve_scramble(item.scramble, threads, 1, true);
    const seconds = (performance.now() - solveStarted) / 1000;
    const printed = printedResult(lines);
    if (engine === 'rust') {
      check(!raw.cancelled && raw.contexts === 8 && raw.threads === threads, 'Incomplete Rust result');
      check(raw.length === printed.length && raw.solution.trim() === printed.solution, 'Rust printed result differs from its search result');
      check(raw.completed_depth === (raw.length === 0 ? null : raw.length - 1), 'Rust did not exhaust shorter depths');
    }
    totalSeconds += seconds;
    const row = { index, id: item.id, scramble: item.scramble, engine, seconds, ...printed, threads,
      output: [...lines], ...(engine === 'rust' ? { search: raw } : {}) };
    const ack = waitFor('ack', index);
    post({ type: 'result', row });
    await ack;
  }
  state = 'closing';
  await module.close?.();
  state = 'complete';
  post({ type: 'complete', mode, engine, variant, threads, cases: cases.length, totalSeconds, warmupCases: 0 });
}

self.addEventListener('message', event => {
  try {
    const message = event.data;
    if (message?.type === 'start' || message?.type === 'ack') {
      check(pendingControl?.type === message.type && (message.type !== 'ack' || pendingControl.index === message.index), 'Unexpected or out-of-order acknowledgement');
      const pending = pendingControl; pendingControl = null; pending.resolve(); return;
    }
    check(state === 'idle', 'One run per dedicated compute Worker');
    // Accept the explicit command envelope and the agreed direct config form.
    const config = message?.type === 'run' ? message.config : message;
    state = 'validating';
    run(config).catch(fail);
  } catch (error) { fail(error); }
});
self.addEventListener('unhandledrejection', event => { event.preventDefault(); fail(event.reason); });
