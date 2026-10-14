import { isMainThread, parentPort, workerData } from 'node:worker_threads';

export const INITIAL_BYTES = 16 * 1024 * 1024;
export const STACK_BYTES = 2 * 1024 * 1024;
export const TLS_BYTES = 65536;
export const ARENA_BYTES = 64 * 1024 * 1024;
const decoder = new TextDecoder('utf-8', { fatal: true });
const encoder = new TextEncoder();

// Each instance owns one disjoint arena. No global shared allocator lock, and
// no host callback in coordinate calculation or PDB reads. Blocks are reused.
export function allocator(start, bytes) {
  const free = [{ start, end: start + bytes }];
  const live = new Map();
  let highWaterBytes = 0, used = 0;
  return {
    allocate(size64, align64) {
      const size = Number(size64), align = Number(align64);
      if (!Number.isSafeInteger(size) || size <= 0 || !Number.isSafeInteger(align)
          || align <= 0 || align > 65536 || (align & (align - 1)) !== 0) throw new Error('Invalid allocator request');
      for (let i = 0; i < free.length; i++) {
        const b = free[i], p = Math.ceil(b.start / align) * align;
        if (p + size > b.end) continue;
        const replacement = [];
        if (p > b.start) replacement.push({ start: b.start, end: p });
        if (p + size < b.end) replacement.push({ start: p + size, end: b.end });
        free.splice(i, 1, ...replacement);
        live.set(p, { size, align }); used += size;
        highWaterBytes = Math.max(highWaterBytes, used);
        return BigInt(p);
      }
      return 0n;
    },
    deallocate(pointer64, size64, align64) {
      const p = Number(pointer64), block = live.get(p);
      if (!block || block.size !== Number(size64) || block.align !== Number(align64)) throw new Error('Invalid arena deallocation');
      live.delete(p); used -= block.size;
      let i = free.findIndex(b => b.start > p); if (i < 0) i = free.length;
      free.splice(i, 0, { start: p, end: p + block.size });
      if (i > 0 && free[i - 1].end === free[i].start) { free[i - 1].end = free[i].end; free.splice(i--, 1); }
      if (i + 1 < free.length && free[i].end === free[i + 1].start) { free[i].end = free[i + 1].end; free.splice(i + 1, 1); }
    },
    stats: () => ({ highWaterBytes, usedBytes: used, liveBlocks: live.size }),
  };
}

export async function instantiate(compiled, memory, region = null) {
  const heap = allocator(region ? region + TLS_BYTES + STACK_BYTES : 12 * 1024 * 1024,
    region ? ARENA_BYTES : 4 * 1024 * 1024);
  const instance = await WebAssembly.instantiate(compiled, { env: { memory }, host: heap });
  const api = instance.exports;
  if (api.cubeopt_abi_version?.() !== 2 || api.cubeopt_pointer_bytes?.() !== 8
      || api.cubeopt_max_threads?.() !== 4 || !(memory.buffer instanceof SharedArrayBuffer)
      || !(api.__stack_pointer instanceof WebAssembly.Global)
      || !(api.__data_end instanceof WebAssembly.Global)
      || Number(api.__data_end.value) >= 8 * 1024 * 1024
      || Number(api.__tls_size.value) > TLS_BYTES || Number(api.__tls_align.value) > TLS_BYTES) throw new Error('Unexpected shared Rust WASM ABI');
  if (region !== null) {
    api.__stack_pointer.value = BigInt(region + TLS_BYTES + STACK_BYTES);
    api.__wasm_init_tls(BigInt(region));
  }
  return { instance, api, heap };
}

if (!isMainThread) {
  const { compiled, memory, region, index, threads, variant, fixture } = workerData;
  try {
    const { api, heap } = await instantiate(compiled, memory, region);
    const create = fixture ? api.cubeopt_fixture_create : api.cubeopt_create;
    if (typeof create !== 'function') throw new Error('This production module has no fixture oracle');
    const handle = create(index, threads, variant);
    if (handle === 0n) throw new Error('Rust worker initialization failed (snapshot or table validation)');
    const output = () => decoder.decode(new Uint8Array(memory.buffer,
      Number(api.cubeopt_output_ptr(handle)), Number(api.cubeopt_output_len(handle))));
    const checked = code => { if (code !== 0) throw new Error(output() || 'Rust operation failed'); };
    const input = text => {
      const bytes = encoder.encode(text);
      if (bytes.length > 4096) throw new Error('Scramble exceeds 4096 bytes');
      new Uint8Array(memory.buffer, Number(api.cubeopt_input_ptr(handle)), bytes.length).set(bytes);
      return BigInt(bytes.length);
    };
    parentPort.on('message', ({ id, operation, scramble, depth }) => {
      try {
        let value;
        if (operation === 'begin') { checked(api.cubeopt_begin(handle, input(scramble))); value = { worker: index }; }
        else if (operation === 'depth') { checked(api.cubeopt_run_depth(handle, depth)); value = JSON.parse(output()); }
        else if (operation === 'coordinate' && fixture) { checked(api.cubeopt_fixture_coordinate(handle, input(scramble))); value = output(); }
        else if (operation === 'stats') value = heap.stats();
        else throw new Error('Unsupported worker operation');
        parentPort.postMessage({ id, value });
      } catch (error) { parentPort.postMessage({ id, error: String(error?.message ?? error) }); }
    });
    parentPort.postMessage({ ready: true, worker: index, memoryBytes: memory.buffer.byteLength });
  } catch (error) { parentPort.postMessage({ error: String(error?.message ?? error) }); }
}
