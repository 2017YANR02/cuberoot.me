/**
 * Worker entry for analyzer regression tests. Runs in a real Node
 * worker_threads thread (not vm sandbox), so JIT optimizations apply
 * — ~5-10x faster than vm-based execution.
 *
 * Shims the classic Web Worker API the analyzer scripts expect:
 *   - importScripts() → noop (we concat all dependency JS files manually)
 *   - postMessage(m)  → parentPort.postMessage
 *   - self            → globalThis
 *   - onmessage = fn  → parentPort.on('message', fn-with-{data:...})
 *
 * MUST be .cjs (CommonJS) so direct eval runs in sloppy mode and the
 * worker scripts' implicit-global assignments (`onmessage = ...`,
 * `totalnumcross = 0` style) work as they do in classic workers.
 */
const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');

global.self = global;
global.importScripts = () => {};
global.postMessage = (m) => parentPort.postMessage(m);

// Some legacy anti-debug paths probe these — shim with permissive defaults.
global.window = global;
global.location = { host: 'localhost' };

// Bare `onmessage = handler` in worker code becomes a global property.
// We capture via property setter and forward parent's parentPort.on('message')
// to it (with the classic-worker {data} envelope shape).
let onmessageHandler = null;
Object.defineProperty(global, 'onmessage', {
  configurable: true,
  set(fn) { onmessageHandler = fn; },
  get() { return onmessageHandler; },
});

const { publicDir, workerFile } = workerData;
const code = ['hs.js', 'zbh.js', 'boohoo.js', workerFile]
  .map((f) => fs.readFileSync(path.join(publicDir, f), 'utf8'))
  .join('\n;\n');

// Direct eval in CJS module scope = sloppy mode. Top-level `let`/`class`
// declarations in the eval'd code share scope with each other (they're all
// in the same eval block) which is what classic-worker importScripts gets you.
eval(code);

parentPort.on('message', (data) => {
  if (onmessageHandler) onmessageHandler({ data });
});
