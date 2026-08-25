import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { prepareCubeoptArtifact } from './lib/prepare-cubeopt-artifact.mjs';

function parseCliOptions() {
  const { values } = parseArgs({
    options: {
      store: { type: 'string' },
      bundle: { type: 'string' },
      module: { type: 'string' },
      wasm: { type: 'string' },
      table: { type: 'string' },
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
    wasmPath: values.wasm,
    tablePath: values.table,
    sourceUrl: values['source-url'],
    sourceRevision: values['source-revision'],
    sourceBuildCommand: values['source-build-command'],
  };
}

const isMain = typeof process.argv[1] === 'string'
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const result = await prepareCubeoptArtifact(parseCliOptions());
  console.log(`published immutable ${result.artifact.manifest.bundle} at ${result.finalDir}`);
}
