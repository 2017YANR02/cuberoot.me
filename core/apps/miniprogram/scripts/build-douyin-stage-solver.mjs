import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { brotliCompress, constants, gzip } from 'node:zlib';
import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '../../../../tools/solver/rust-cross');
const files = {
  glue: join(root, 'cross_solver.js'),
  webWorker: join(root, 'cross-solver-worker.js'),
  wasm: join(root, 'cross_solver_bg.wasm'),
  crossTable: join(root, 'tables/pt_cross.bin.gz'),
  worker: join(import.meta.dirname, 'douyin-stage-solver-worker.mjs'),
  runtime: join(import.meta.dirname, 'douyin-stage-solver-runtime.mjs'),
};

export const DOUYIN_STAGE_SOLVER_INPUTS = [import.meta.filename, ...Object.values(files)];

export async function buildDouyinStageSolver(outputRoot) {
  const workerFile = resolve(outputRoot, 'workers/stage-solver.js');
  await mkdir(dirname(workerFile), { recursive: true });
  const wasm = await readFile(files.wasm);
  await Promise.all([
    build({
      absWorkingDir: resolve(import.meta.dirname, '..'),
      entryPoints: [files.worker],
      outfile: workerFile,
      platform: 'browser',
      target: 'chrome91',
      format: 'cjs',
      bundle: true,
      minify: true,
      inject: [files.runtime],
      loader: { '.gz': 'binary' },
      plugins: [{
        name: 'stage-solver-worker-wasm',
        setup(builder) {
          builder.onResolve({ filter: /^stage-solver-worker-wasm$/ }, ({ path }) => ({ path, namespace: 'stage-solver' }));
          builder.onLoad({ filter: /.*/, namespace: 'stage-solver' }, async () => ({
            contents: await promisify(gzip)(wasm),
            loader: 'binary',
          }));
        },
      }],
      supported: { 'dynamic-import': false },
      define: { self: 'undefined' },
      logLevel: 'silent',
    }),
    promisify(brotliCompress)(wasm, { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } })
      .then(contents => writeFile(resolve(outputRoot, 'workers/stage-solver.wasm.br'), contents)),
  ]);
  return DOUYIN_STAGE_SOLVER_INPUTS;
}
