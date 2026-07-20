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
// into `code` below. Two exceptions need inline eval at the call site:
//   - /analyze-worker/xcross/solver.js — emscripten's `var Module = ...` must pick up our
//     pre-configured self.Module (indirect eval into global scope, not CJS-module scope).
//   - /analyze-worker/pseudo/pseudo-wrapped.js — emscripten wrapped in an IIFE so its var-
//     declarations stay local; we still eval inline so its sync wasm load picks the right
//     locateFile (and the test always overrides locateFile to point at fs paths).
let xcrossSolverSource = null;
let pseudoWrappedSource = null;
let eoCrossWrappedSource = null;
let pairWrappedSource = null;
let pseudoPairWrappedSource = null;
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
    } else if (typeof url === 'string' && url.endsWith('/analyze-worker/pseudo-cross/pseudo-wrapped.js')) {
      if (pseudoWrappedSource === null) {
        pseudoWrappedSource = fs.readFileSync(path.join(workerData.publicDir, 'pseudo-cross','pseudo-wrapped.js'), 'utf8');
      }
      self.PseudoModuleStash.locateFile = (p) => path.join(workerData.publicDir, 'pseudo-cross',p);
      // eslint-disable-next-line no-eval
      (0, eval)(pseudoWrappedSource);
    } else if (typeof url === 'string' && url.endsWith('/analyze-worker/eocross/solver-wrapped.js')) {
      if (eoCrossWrappedSource === null) {
        eoCrossWrappedSource = fs.readFileSync(path.join(workerData.publicDir, 'eocross', 'solver-wrapped.js'), 'utf8');
      }
      self.EOCrossStash.locateFile = (p) => path.join(workerData.publicDir, 'eocross', p);
      // eslint-disable-next-line no-eval
      (0, eval)(eoCrossWrappedSource);
    } else if (typeof url === 'string' && url.endsWith('/analyze-worker/pair/pairing_solver-wrapped.js')) {
      if (pairWrappedSource === null) {
        pairWrappedSource = fs.readFileSync(path.join(workerData.publicDir, 'pair', 'pairing_solver-wrapped.js'), 'utf8');
      }
      self.PairingStash.locateFile = (p) => path.join(workerData.publicDir, 'pair', p);
      // eslint-disable-next-line no-eval
      (0, eval)(pairWrappedSource);
    } else if (typeof url === 'string' && url.endsWith('/analyze-worker/pseudo-pair/pseudoPairingSolver-wrapped.js')) {
      if (pseudoPairWrappedSource === null) {
        pseudoPairWrappedSource = fs.readFileSync(path.join(workerData.publicDir, 'pseudo-pair', 'pseudoPairingSolver-wrapped.js'), 'utf8');
      }
      self.PseudoPairingStash.locateFile = (p) => path.join(workerData.publicDir, 'pseudo-pair', p);
      // eslint-disable-next-line no-eval
      (0, eval)(pseudoPairWrappedSource);
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
// eslint-disable-next-line no-eval -- that shared sloppy-mode scope IS the point
eval(code);

parentPort.on('message', (data) => {
  if (onmessageHandler) onmessageHandler({ data });
});
