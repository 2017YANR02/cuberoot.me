import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { brotliCompress, constants, gzip } from 'node:zlib';
import { build } from 'esbuild';

const packageRoot = resolve(import.meta.dirname, '..');
const sharedEntry = fileURLToPath(import.meta.resolve('@cuberoot/shared/timer/manual-entry'));
const workerSource = join(import.meta.dirname, 'douyin-wca-scramble-worker.mjs');
const nativeRuntime = join(import.meta.dirname, 'douyin-wca-scramble-runtime.mjs');
const nativeSvgDocument = join(import.meta.dirname, 'douyin-cubing-svg-document.mjs');

function extract(text, pattern, label) {
  const value = pattern.exec(text)?.[1];
  if (!value) throw new Error(`cubing.js Worker layout changed: ${label}`);
  return value;
}

function replace(text, pattern, replacement, label) {
  const next = text.replace(pattern, replacement);
  if (next === text) throw new Error(`cubing.js Worker layout changed: ${label}`);
  return next;
}

async function readCubingWorker(scrambleEntry) {
  // Follow the installed Worker entry's imports. The generated chunk names
  // change between versions, while the public package entry is stable.
  const chunks = join(dirname(dirname(scrambleEntry)), 'chunks');
  const workerEntry = join(chunks, 'search-worker-entry.js');
  const worker = await readFile(workerEntry, 'utf8');
  const insideFile = join(chunks, extract(worker, /import\("\.\/(inside-[\w-]+\.js)"\)/, 'inside worker'));
  const inside = await readFile(insideFile, 'utf8');
  const twipsFile = join(chunks, extract(inside, /import\("\.\/(twips-[\w-]+\.js)"\)/, 'Twips glue'));
  const twips = await readFile(twipsFile, 'utf8');
  const wasmChunk = extract(twips, /import\("\.\/(twips_wasm_bg-[\w-]+\.js)"\)/, 'Twips binary');
  const wasmFile = join(chunks, wasmChunk);
  const embeddedWasm = await readFile(wasmFile, 'utf8');
  const wasm = Buffer.from(extract(embeddedWasm, /__toBinary\("([\w+/=]+)"\)/, 'Twips base64'), 'base64');
  if (!wasm.subarray(0, 4).equals(Buffer.from([0, 97, 115, 109]))) throw new Error('Invalid cubing.js WASM');

  // Preserve cubing's dispatch and scramble algorithms. Replace the Comlink
  // transport and browser WASM loader with the native Worker bindings.
  const insideBridge = replace(inside, /expose\(insideAPI\);/, 'setDebugMeasurePerf(false);\nexport { randomScrambleForEvent };', 'Comlink exposure');
  const twipsBridge = replace(twips,
    /const wasmUint8Array = \(await import\("\.\/twips_wasm_bg-[\w-]+\.js"\)\)\.default;\s*await twips_wasm_default\(\{ module_or_path: wasmUint8Array\.buffer \}\);/,
    `const { instance, module } = await instantiateNativeScrambleWasm(__wbg_get_imports(), () => import("./${wasmChunk}"));\n    __wbg_finalize_init(instance, module);`,
    'Twips WASM initialization');
  const compressedWasm = await promisify(gzip)(wasm, { level: 9 });
  return { workerEntry, insideFile, insideBridge, twipsFile, twipsBridge, wasmFile, wasm, compressedWasm };
}

async function readCubingSvgAnimator(path) {
  const source = await readFile(path, 'utf8');
  const begin = '// src/cubing/twisty/views/2D/TwistyAnimatedSVG.ts';
  const start = source.indexOf(begin);
  const end = source.indexOf('\n// src/cubing/twisty/', start + begin.length);
  if (start < 0 || end < 0) throw new Error('cubing.js SVG Animator layout changed');
  return `import { svgAnimatorDocument as document } from 'cubing-native-svg-document';
    ${source.slice(start, end)}
    export { TwistyAnimatedSVG };`;
}

export async function buildDouyinWcaScramble(outputRoot) {
  const output = resolve(outputRoot, 'workers/wca-scramble.js');
  await mkdir(dirname(output), { recursive: true });
  let cubing;
  let puzzlesEntry;
  let twistyEntry;
  let svgAnimator;
  const { metafile } = await build({
    absWorkingDir: packageRoot,
    entryPoints: [workerSource],
    outfile: output,
    format: 'cjs',
    platform: 'browser',
    target: 'chrome91',
    bundle: true,
    minify: true,
    metafile: true,
    inject: [nativeRuntime],
    define: { Worker: 'undefined', window: 'undefined' },
    supported: { 'dynamic-import': false },
    plugins: [{
      name: 'cubing-native-worker',
      setup(plugin) {
        const resolveDependency = path => plugin.resolve(path, { kind: 'import-statement', resolveDir: dirname(sharedEntry) });
        plugin.onStart(async () => {
          // Resolve the same package installation used by the shared timer.
          const [entry, puzzles, twisty] = await Promise.all(['cubing/scramble', 'cubing/puzzles', 'cubing/twisty'].map(resolveDependency));
          const errors = [...entry.errors, ...puzzles.errors, ...twisty.errors];
          if (errors.length) return { errors };
          puzzlesEntry = puzzles.path;
          twistyEntry = twisty.path;
          cubing = await readCubingWorker(entry.path);
          svgAnimator = await readCubingSvgAnimator(twistyEntry);
        });
        plugin.onResolve({ filter: /^cubing-native-inside$/ }, () => ({ path: cubing.insideFile }));
        plugin.onResolve({ filter: /^cubing-native-puzzles$/ }, () => ({ path: puzzlesEntry }));
        plugin.onResolve({ filter: /^cubing-native-svg-animator$/ }, () => ({ path: twistyEntry }));
        plugin.onResolve({ filter: /^cubing-native-svg-document$/ }, () => ({ path: nativeSvgDocument }));
        plugin.onLoad({ filter: /[/\\]twisty[/\\]index\.js$/ }, ({ path }) => {
          if (path === twistyEntry) return { contents: svgAnimator };
        });
        plugin.onLoad({ filter: /(?:(?:inside|twips|twips_wasm_bg)-[\w-]+|search-worker-entry)\.js$/ }, ({ path }) => {
          if (path === cubing.insideFile) return { contents: cubing.insideBridge };
          if (path === cubing.twipsFile) return { contents: cubing.twipsBridge };
          if (path === cubing.wasmFile) return { contents: cubing.compressedWasm, loader: 'binary' };
          // Cubing's graph also includes its browser worker discovery helper.
          // This worker already runs inside the native host, which cannot nest Workers.
          if (path === cubing.workerEntry) return { contents: 'export const WORKER_ENTRY_FILE_URL = undefined;' };
        });
        plugin.onLoad({ filter: /[/\\]cstimer_module[/\\]cstimer_module\.js$/ }, async ({ path }) => ({
          // csTimer tests for a browser Worker and publishes helpers on `self`.
          // Give its CommonJS bundle a private equivalent without replacing
          // the real Mini Program worker's message listener.
          contents: `class WorkerGlobalScope {}
            const self = new WorkerGlobalScope();
            let $, kernel;
            Object.defineProperties(self, {
              $: { get: () => $, set: value => { $ = value; } },
              kernel: { get: () => kernel, set: value => { kernel = value; } },
            });
            ${await readFile(path, 'utf8')}`,
        }));
      },
    }],
    logLevel: 'silent',
  });
  const compressed = await promisify(brotliCompress)(cubing.wasm, { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } });
  await writeFile(join(outputRoot, 'workers/wca-scramble.wasm.br'), compressed);
  return [import.meta.filename, cubing.workerEntry, cubing.wasmFile, ...Object.keys(metafile.inputs).map(path => resolve(packageRoot, path))];
}
