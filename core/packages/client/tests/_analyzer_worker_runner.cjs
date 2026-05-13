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
// emscripten's NODE branch does `var fs = require("fs")` — expose require to
// global scope so indirect-eval'd loader can find it.
global.require = require;
global.__dirname = __dirname;
global.__filename = __filename;
// importScripts URLs are noop'd because the worker dependency contents are pre-concatenated
// into `code` below. Exception: /analyze-worker/xcross/solver.js needs to be eval'd inline
// so emscripten's `var Module = typeof Module != "undefined" ? Module : {}` picks up the
// pre-configured self.Module instead of creating a new module-local one (which `require`
// would do, breaking the locateFile + onRuntimeInitialized hooks).
let xcrossSolverSource = null;
global.importScripts = (...urls) => {
  for (const url of urls) {
    if (typeof url === 'string' && url.endsWith('/analyze-worker/xcross/solver.js')) {
      if (xcrossSolverSource === null) {
        xcrossSolverSource = fs.readFileSync(path.join(workerData.publicDir, 'xcross', 'solver.js'), 'utf8');
      }
      // Override locateFile BEFORE eval — emscripten's findWasmBinary() is sync and runs
      // during createWasm() at end of module body. __dirname inside eval is the runner's,
      // not the xcross dir, so the default scriptDirectory would point to tests/ and fail.
      self.Module.locateFile = (p) => path.join(workerData.publicDir, 'xcross', p);
      global.Module = self.Module;
      // Indirect eval `(0, eval)(src)` runs in global scope (vs direct eval running in
      // caller's CJS-module scope, where `var Module` would hoist module-local and
      // shadow our globalThis.Module). With indirect eval, `var Module = ...` declares
      // on globalThis and `typeof Module` reuses our pre-set object.
      // eslint-disable-next-line no-eval
      (0, eval)(xcrossSolverSource);
    }
  }
};
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
