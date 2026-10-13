// This adapter executes the Rust kernel in a memory64 WebAssembly instance.
// It implements only single-threaded, pre-generated Opt1–9 table loading.
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

async function bytesFrom(source) {
  if (source instanceof Uint8Array) return source;
  if (source instanceof ArrayBuffer) return new Uint8Array(source);
  const url = source instanceof URL ? source : new URL(source, import.meta.url);
  if (url.protocol === 'file:' && typeof process !== 'undefined' && process.versions?.node) {
    const { readFile } = await import('node:fs/promises');
    return readFile(url);
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Cannot load ${url}: HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

function integer(value, name, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  }
  return value;
}

function oneThread(threads) {
  if (threads !== 1) throw new Error('Rust WASM Opt currently supports exactly one solve thread');
}

/**
 * Loading is deliberately split: create -> host streams into HEAPU8 at
 * _get_mem_ptr() -> init(0, 1). No table generation or hidden repeat runs.
 * For a small compile/ABI probe use instantiateOnly:true; it allocates no PDB.
 */
export default async function createRustOptModule(options = {}) {
  const variant = integer(options.variant ?? 9, 'variant', 1, 9);
  const print = options.print ?? (() => {});
  const wasmSource = options.wasmBinary ?? options.wasmURL
    ?? new URL('./cube48opt_rust_wasm.wasm', import.meta.url);
  const compiled = options.wasmModule ?? await WebAssembly.compile(await bytesFrom(wasmSource));
  const instance = await WebAssembly.instantiate(compiled, {});
  const api = instance.exports;
  if (!(api.memory instanceof WebAssembly.Memory) || api.cubeopt_abi_version() !== 1
      || api.cubeopt_pointer_bytes() !== 8 || api.cubeopt_threads() !== 1) {
    throw new Error('Unexpected Rust Opt WASM ABI; a memory64 single-threaded build is required');
  }
  const address = (value) => {
    const result = Number(value);
    if (!Number.isSafeInteger(result) || result < 0) throw new Error('Unsafe WASM memory address');
    return result;
  };
  const output = () => decoder.decode(new Uint8Array(
    api.memory.buffer, address(api.cubeopt_output_ptr()), address(api.cubeopt_output_len()),
  ));
  const checked = (result) => {
    if (result !== 0) throw new Error(output() || `Rust WASM operation failed: ${result}`);
  };
  const tableBytes = address(api.cubeopt_table_bytes(variant));
  const snapshotBytes = address(api.cubeopt_snapshot_bytes(variant));
  const metadata = Object.freeze({
    implementation: 'cuberoot-rust-opt-wasm', abiVersion: 1,
    variant, memory64: true, threads: 1, tableBytes, snapshotBytes,
  });
  let tablePointer = 0n;
  let allocated = false;
  const writeInput = (scramble) => {
    if (typeof scramble !== 'string') throw new TypeError('scramble must be a string');
    const bytes = encoder.encode(scramble);
    const capacity = address(api.cubeopt_input_capacity());
    if (bytes.length > capacity) throw new Error(`Scramble exceeds the ${capacity}-byte input limit`);
    new Uint8Array(api.memory.buffer, address(api.cubeopt_input_ptr()), bytes.length).set(bytes);
    return BigInt(bytes.length);
  };
  const assertReady = () => {
    if (!api.cubeopt_ready()) throw new Error('Stream the table and call init(0, 1) before solving');
  };
  const module = {
    metadata, wasmModule: compiled, wasmInstance: instance, wasmMemory: api.memory,
    get HEAPU8() { return new Uint8Array(api.memory.buffer); },
    get_table_size: () => BigInt(tableBytes),
    get_table_name: () => variant === 1 ? 'h48prun01.dat' : `h48prun31h${variant}.dat`,
    _get_mem_ptr() {
      if (!allocated) throw new Error('PDB allocation is disabled in instantiateOnly mode');
      return tablePointer;
    },
    init(generate = 0, threads = 1) {
      oneThread(threads);
      if (generate !== 0) throw new Error('Rust WASM loads existing tables; generation is not supported');
      if (!allocated) throw new Error('PDB allocation is disabled in instantiateOnly mode');
      if (!api.cubeopt_ready()) checked(api.cubeopt_finalize());
      return metadata;
    },
    query(scramble) {
      assertReady();
      checked(api.cubeopt_query(writeInput(scramble)));
      return JSON.parse(output());
    },
    solve(scramble, { contexts = 8, maxDepth = 20, maxNodes = 0n, threads = 1 } = {}) {
      assertReady();
      oneThread(threads);
      if (contexts !== 1 && contexts !== 8) throw new Error('contexts must be 1 or 8');
      integer(maxDepth, 'maxDepth', 0, 20);
      if (typeof maxNodes === 'number') integer(maxNodes, 'maxNodes', 0, Number.MAX_SAFE_INTEGER);
      const budget = BigInt(maxNodes);
      if (budget < 0n || budget > 0xffffffffffffffffn) throw new Error('maxNodes must fit an unsigned 64-bit integer');
      const inputLength = writeInput(scramble);
      const start = performance.now();
      checked(api.cubeopt_solve(inputLength, contexts, maxDepth, budget));
      const seconds = (performance.now() - start) / 1000;
      return { ...JSON.parse(output()), seconds };
    },
    solve_scramble(scramble, threads = 1, count = 1, debug = true) {
      oneThread(threads);
      if (count !== 1) throw new Error('Rust WASM accepts exactly one scramble per call');
      const result = module.solve(scramble, { threads });
      if (result.cancelled || result.solution === null) throw new Error('Search did not produce a complete solution');
      if (debug) print(`Solution found!: ${result.solution}`);
      print(`Cube1 finished in ${result.length}`);
      return result;
    },
  };
  if (options.instantiateOnly) return module;
  const snapshot = await bytesFrom(options.smallTableBytes ?? options.smallTableURL
    ?? new URL(`./cube48opt${variant}.small.bin`, import.meta.url));
  if (snapshot.byteLength !== snapshotBytes) throw new Error(`Opt${variant} snapshot must have ${snapshotBytes} bytes`);
  checked(api.cubeopt_init_alloc(variant, BigInt(snapshot.byteLength)));
  new Uint8Array(api.memory.buffer, address(api.cubeopt_snapshot_ptr()), snapshot.byteLength).set(snapshot);
  tablePointer = api.cubeopt_pdb_ptr();
  if (address(api.cubeopt_pdb_len()) !== tableBytes) throw new Error('Unexpected allocated PDB length');
  allocated = true;
  return module;
}
