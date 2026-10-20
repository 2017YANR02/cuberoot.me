// Generate an isolated browser transport around frozen benchmark artifacts.
// This never compiles/instantiates WASM, loads a PDB, or edits the frozen source.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mailboxFixed, mailboxOld, patchOriginalWrapper } from './original-wasm-compat.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const here = dirname(fileURLToPath(import.meta.url));

// Node's Worker API is the only changed host boundary. Search, depth barriers,
// cancellation, allocation, and table validation stay in the frozen modules.
const shim = String.raw`const NativeWorker = globalThis.Worker;
const listenersKey = '__cubeoptBrowserWorkerData';
export const isMainThread = !Object.hasOwn(globalThis, listenersKey);
export const workerData = isMainThread ? undefined : globalThis[listenersKey];
export const parentPort = isMainThread ? null : {
  on(type, listener) {
    if (type !== 'message') throw new Error('Unsupported parentPort event: ' + type);
    globalThis.addEventListener('message', event => listener(event.data));
    return this;
  },
  postMessage(value) { globalThis.postMessage(value); },
};
export async function readFile() { throw new Error('Browser adapter cannot read file: URLs'); }
export class Worker {
  constructor(moduleURL, { workerData }) {
    this.listeners = new Map();
    this.terminated = false;
    this.worker = new NativeWorker(new URL('./worker-bootstrap.mjs', import.meta.url),
      { type: 'module', name: 'cuberoot-search-' + workerData.index });
    this.worker.addEventListener('message', event => this.emit('message', event.data));
    this.worker.addEventListener('messageerror', () => this.emit('error', new Error('Worker message could not be deserialized')));
    this.worker.addEventListener('error', event => {
      event.preventDefault();
      this.emit('error', event.error ?? new Error(event.message || 'Browser Worker failed'));
    });
    this.worker.postMessage({ type: 'cubeopt-browser-init', moduleURL: new URL(moduleURL, import.meta.url).href, workerData });
  }
  on(type, listener) {
    if (!['message', 'error', 'exit'].includes(type)) throw new Error('Unsupported Worker event: ' + type);
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener); this.listeners.set(type, listeners);
    return this;
  }
  emit(type, value) { for (const listener of this.listeners.get(type) ?? []) listener(value); }
  postMessage(value) {
    if (this.terminated) throw new Error('Browser Worker was terminated');
    this.worker.postMessage(value);
  }
  async terminate() {
    if (this.terminated) return 0;
    this.terminated = true; this.worker.terminate();
    this.emit('exit', 0); return 0;
  }
}
`;

const bootstrap = String.raw`globalThis.addEventListener('message', async event => {
  try {
    const { type, moduleURL, workerData } = event.data ?? {};
    if (type !== 'cubeopt-browser-init') throw new Error('Missing Worker initialization message');
    const url = new URL(moduleURL, import.meta.url);
    if (url.origin !== location.origin) throw new Error('Worker module must be same-origin');
    Object.defineProperty(globalThis, '__cubeoptBrowserWorkerData', { value: workerData });
    await import(url.href);
  } catch (error) {
    globalThis.postMessage({ error: String(error?.message ?? error), errorStack: String(error?.stack ?? error), operation: 'browser-bootstrap' });
  }
}, { once: true });
`;

function replaceOnce(source, before, after) {
  assert.equal(source.split(before).length, 2, `Frozen adapter boundary changed: ${before}`);
  return source.replace(before, after);
}

export function adaptRustSources(wrapper, worker) {
  let browserWrapper = replaceOnce(wrapper, "import { Worker } from 'node:worker_threads';",
    "import { Worker } from './worker-shim.mjs';");
  browserWrapper = replaceOnce(browserWrapper, "import { readFile } from 'node:fs/promises';",
    "import { readFile } from './worker-shim.mjs';");
  assert(browserWrapper.includes("from './cube48opt-rust8-worker.mjs';"), 'Unexpected frozen worker import');
  let browserWorker = replaceOnce(worker,
    "import { isMainThread, parentPort, workerData } from 'node:worker_threads';",
    "import { isMainThread, parentPort, workerData } from './worker-shim.mjs';");
  // Browser TextDecoder rejects SharedArrayBuffer views. Copy only the bounded
  // JSON output, never the shared table; the search/measurement boundary stays.
  browserWorker = replaceOnce(browserWorker,
    'const output = () => decoder.decode(new Uint8Array(memory.buffer,\n      Number(api.cubeopt_output_ptr(handle)), Number(api.cubeopt_output_len(handle))));',
    'const output = () => decoder.decode(new Uint8Array(new Uint8Array(memory.buffer,\n      Number(api.cubeopt_output_ptr(handle)), Number(api.cubeopt_output_len(handle)))));');
  assert(!/from ['"]node:/.test(browserWrapper + browserWorker), 'Unadapted Node import');
  return { wrapper: browserWrapper, worker: browserWorker };
}

/** Creates new files only. The caller serves these files and its frozen WASM. */
export function prepareBrowserAdapter({ engine, wrapperPath, workerPath, outDir, variant }) {
  assert(['rust', 'original'].includes(engine), 'Unknown engine');
  wrapperPath = resolve(wrapperPath); outDir = resolve(outDir);
  assert.notEqual(outDir, dirname(wrapperPath), 'Do not write inside a frozen artifact directory');
  const sourceWrapper = readFileSync(wrapperPath, 'utf8');
  const sources = { wrapper: { path: wrapperPath, sha256: hash(sourceWrapper) } };
  const contents = {};
  let compatibility = null;
  if (engine === 'rust') {
    assert(workerPath, 'Frozen Rust worker is required');
    workerPath = resolve(workerPath);
    const sourceWorker = readFileSync(workerPath, 'utf8');
    sources.worker = { path: workerPath, sha256: hash(sourceWorker) };
    const adapted = adaptRustSources(sourceWrapper, sourceWorker);
    contents['engine.mjs'] = adapted.wrapper;
    contents['cube48opt-rust8-worker.mjs'] = adapted.worker;
    contents['worker-shim.mjs'] = shim;
    contents['worker-bootstrap.mjs'] = bootstrap;
  } else {
    variant ??= Number(/^cube48opt([89])\.mjs$/.exec(basename(wrapperPath))?.[1]);
    assert([8, 9].includes(variant), 'Original browser adapter requires Opt8 or Opt9');
    assert(sourceWrapper.includes(`new URL("cube48opt${variant}.mjs", import.meta.url)`), 'Unexpected original pthread module URL');
    let adapted;
    if (sourceWrapper.includes(mailboxOld)) {
      adapted = patchOriginalWrapper(sourceWrapper);
      compatibility = 'private-mailbox-fix';
    } else {
      assert.equal(sourceWrapper.split(mailboxFixed).length, 2, 'Unknown original mailbox patch');
      assert(sourceWrapper.includes('if (ENVIRONMENT_IS_NODE) process.stderr.write("[cubeopt-pthread] "'), 'Unknown pthread diagnostic patch');
      adapted = sourceWrapper;
      compatibility = 'retained-private-mailbox-fix';
    }
    contents['engine.mjs'] = adapted;
    // Upstream's nested pthread imports this basename. Both aliases are exact
    // copies of the same patched glue; the upstream WASM is never rewritten.
    contents[`cube48opt${variant}.mjs`] = adapted;
    sources.compatibility = { path: resolve(here, 'original-wasm-compat.mjs'),
      sha256: hash(readFileSync(resolve(here, 'original-wasm-compat.mjs'))) };
  }
  const generator = fileURLToPath(import.meta.url);
  sources.generator = { path: generator, sha256: hash(readFileSync(generator)) };
  const manifestPath = resolve(outDir, 'browser-adapter.json');
  for (const name of [...Object.keys(contents), 'browser-adapter.json'])
    assert(!existsSync(resolve(outDir, name)), `Browser adapter output already exists: ${name}`);
  mkdirSync(outDir, { recursive: true });
  const files = {}, sha256 = {};
  for (const [name, content] of Object.entries(contents)) {
    const path = resolve(outDir, name);
    writeFileSync(path, content, { flag: 'wx' }); files[name] = path; sha256[name] = hash(content);
  }
  const manifest = { schema: 'cuberoot.wasm-browser-adapter.v1', engine, ...(variant ? { variant } : {}),
    compatibility, sources, files, sha256, changes: engine === 'rust'
      ? ['Node Worker transport import', 'Node file-URL rejection import', 'Worker parent-port transport import',
        'Copy the small shared JSON output view before browser TextDecoder.decode']
      : ['private JS mailbox compatibility fix; unchanged upstream WASM'],
    browserExitBoundary: 'The harness owns and must terminate the dedicated Chrome process tree.' };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  return { ...manifest, manifestPath };
}
