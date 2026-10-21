import { parseArgs } from 'node:util';
import { prepareCubeoptArtifact } from './lib/prepare-cubeopt-artifact.mjs';

function parseCliOptions() {
  const { values } = parseArgs({
    options: {
      store: { type: 'string' },
      bundle: { type: 'string' },
      module: { type: 'string' },
      binary: { type: 'string' },
      wasm: { type: 'string' },
      engine: { type: 'string', default: 'emscripten' },
      worker: { type: 'string' },
      snapshot: { type: 'string' },
      table: { type: 'string' },
      'link-table': { type: 'boolean', default: false },
      'source-url': { type: 'string' },
      'source-revision': { type: 'string' },
      'source-build-command': { type: 'string' },
    },
    strict: true,
  });
  return {
    storeDir: values.store,
    bundle: values.bundle,
    modulePath: values.module,
    binaryPath: values.binary,
    wasmPath: values.wasm,
    engine: values.engine,
    workerPath: values.worker,
    snapshotPath: values.snapshot,
    tablePath: values.table,
    linkTable: values['link-table'],
    sourceUrl: values['source-url'],
    sourceRevision: values['source-revision'],
    sourceBuildCommand: values['source-build-command'],
  };
}

// Node resolves import.meta.url through the production dist symlink, while
// argv keeps the symlink path. Let Node identify the entry module itself.
if (import.meta.main) {
  const result = await prepareCubeoptArtifact(parseCliOptions());
  console.log(`published immutable ${result.artifact.manifest.bundle} at ${result.finalDir}`);
}
