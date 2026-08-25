import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { promoteCubeoptBundle } from '../src/cubeopt/artifact.mjs';

const { values } = parseArgs({
  options: {
    store: { type: 'string' },
    bundle: { type: 'string' },
  },
  strict: true,
});

if (!values.store || !values.bundle) {
  throw new Error('usage: pnpm cubeopt:promote -- --store <artifact-store> --bundle <bundle-id>');
}

const promoted = await promoteCubeoptBundle(resolve(values.store), values.bundle);
console.log(JSON.stringify({
  promoted: promoted.manifest.bundle,
  variant: promoted.manifest.variant,
  protocol: promoted.manifest.protocol,
  current: promoted.currentPath,
}, null, 2));
