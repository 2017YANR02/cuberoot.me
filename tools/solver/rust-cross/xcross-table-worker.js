// Separate owned workers let the page stop both network and synchronous WASM.
// Both routes produce the exact same canonical .bin, including its header.
const HASH = '10f83b03eb6c1ed542a852697d627af00d8650fe1cd5fa30a1942c413124622e';
const LENGTH = 54743056;
const CACHE = 'cuberoot-solver-tables-v1';
const KEY = new URL(`./tables/pt_cross_C4E0.bin?sha256=${HASH}`, self.location.href).href;
let pendingCache = null;
let started = false;

async function verify(bytes) {
  if (bytes.byteLength !== LENGTH) throw new Error('XCross table size mismatch');
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  if (Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('') !== HASH) {
    throw new Error('XCross table checksum mismatch');
  }
  return bytes;
}
async function cached() {
  try {
    const cache = await caches.open(CACHE);
    const response = await cache.match(KEY);
    if (!response) return null;
    try { return await verify(await response.arrayBuffer()); }
    catch { await cache.delete(KEY); }
  } catch { /* Private mode / quota / unavailable storage: race normally. */ }
  return null;
}
function progress(value) { self.postMessage({ type: 'progress', progress: value }); }
async function download(url) {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`XCross download: ${response.status}`);
  let loaded = 0;
  let lastReport = 0;
  const total = Number(response.headers.get('content-length')) || 0;
  progress({ download: 'running', loaded, total });
  const stream = response.body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      loaded += chunk.byteLength;
      if (performance.now() - lastReport > 80) {
        lastReport = performance.now();
        progress({ download: 'running', loaded, total });
      }
      controller.enqueue(chunk);
    },
  })).pipeThrough(new DecompressionStream('gzip'));
  const bytes = await new Response(stream).arrayBuffer();
  progress({ download: 'verifying', loaded, total: total || loaded });
  return verify(bytes);
}
async function generate(msg) {
  const mod = await import(msg.glueUrl);
  await mod.default({ module_or_path: msg.wasmUrl });
  const bytes = mod.generate_xcross_table(() => {});
  progress({ generation: 'verifying' });
  return verify(bytes.buffer);
}
self.onmessage = async ({ data: msg }) => {
  if (msg.type === 'persist') {
    try {
      if (pendingCache) await (await caches.open(CACHE)).put(KEY, pendingCache);
    } catch { /* Persistence is optional and must not fail the usable table. */ }
    self.postMessage({ type: 'stored' });
    self.close();
    return;
  }
  if (msg.type !== 'start' || started) return;
  started = true;
  try {
    let bytes;
    let source;
    if (msg.mode === 'download') {
      let cacheTimer;
      try {
        bytes = await Promise.race([
          cached(),
          new Promise((resolve) => { cacheTimer = setTimeout(() => resolve(null), 200); }),
        ]);
      } finally { clearTimeout(cacheTimer); }
      if (bytes) source = 'cache';
      else {
        self.postMessage({ type: 'cache_miss' });
        bytes = await download(msg.tableUrl);
        source = 'download';
      }
    } else {
      bytes = await generate(msg);
      source = 'generated';
    }
    // Response snapshots the bytes before ownership transfers. Persist only after
    // the coordinator accepts this route; losers never write over the winner.
    if (source !== 'cache' && typeof caches !== 'undefined') pendingCache = new Response(bytes);
    self.postMessage({ type: 'ready', bytes, source }, [bytes]);
  } catch (error) {
    self.postMessage({ type: 'error', error: String(error) });
    self.close();
  }
};
