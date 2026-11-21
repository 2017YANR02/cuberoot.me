import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const client = fileURLToPath(new URL('../packages/client/', import.meta.url));
const source = path.join(client, 'lib/video-recon');
const assets = path.join(client, 'public/vendor/video-recon');
const output = path.join(assets, 'workers');
const ort = path.join(client, 'node_modules/onnxruntime-web/dist');
const ortFiles = ['ort-wasm-simd-threaded', 'ort-wasm-simd-threaded.asyncify']
  .flatMap(name => [`${name}.mjs`, `${name}.wasm`]);
const workers = ['inference', 'capture', 'pose', 'move-search', 'move-search-side'];

const { metafile } = await build({
  absWorkingDir: client,
  bundle: true,
  splitting: true,
  minify: true,
  metafile: true,
  entryPoints: Object.fromEntries(workers.map(name => [name, path.join(source, 'engine', `${name}.worker.ts`)])),
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  conditions: ['onnxruntime-web-use-extern-wasm', 'module', 'browser'],
  legalComments: 'eof',
  outdir: output,
});

const files = {
  scheduler: ['pose-fitter/runtime/buffered-pipeline.mjs'],
  policy: ['pose-fitter/runtime/reconstruction-policy.mjs'],
  searchDriver: ['pose-fitter/runtime/incremental-search.mjs', 'pose-fitter/runtime/parallel-search.mjs'],
  frameAdapter: ['engine/pose-fitter.ts'],
  colors: ['engine/cube-colors.ts'],
};
const entries = await Promise.all(Object.entries(files).map(async ([key, inputs]) => {
  const contents = await Promise.all(inputs.map(input => readFile(path.join(source, input), 'utf8')));
  return [key, createHash('sha256').update(contents.join('\n')).digest('hex')];
}));
await writeFile(path.join(output, 'fingerprints.json'), JSON.stringify(Object.fromEntries(entries)));

await mkdir(path.join(assets, 'runtime'), { recursive: true });
await Promise.all(ortFiles.map(file => copyFile(path.join(ort, file), path.join(assets, 'runtime', file))));

const pose = JSON.parse(await readFile(path.join(assets, 'pose/pipeline.json'), 'utf8'));
const runtimeFiles = [
  'models/detector.json', 'pose/pipeline.json',
  ...[pose.rust, pose.opencvModule, pose.opencvWasm, pose.geometry].map(file => `pose/${file}`),
  ...ortFiles.filter(file => file.includes('asyncify')).map(file => `runtime/${file}`),
  ...Object.keys(metafile.outputs).map(file => `workers/${path.basename(file)}`),
  'workers/fingerprints.json',
];
await writeFile(path.join(output, 'assets.json'), JSON.stringify(runtimeFiles));
