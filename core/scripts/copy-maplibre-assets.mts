/** Ship MapLibre's ESM worker beside its shared module for Next bundlers. */
import { copyFileSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const coreRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clientRoot = path.join(coreRoot, 'packages/client');
const packageRoot = realpathSync(path.join(clientRoot, 'node_modules/maplibre-gl'));
const { version } = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Unsupported MapLibre version: ${version}`);
const output = path.join(clientRoot, 'public/maplibre', version);
mkdirSync(output, { recursive: true });
for (const name of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  copyFileSync(path.join(packageRoot, 'dist', name), path.join(output, name));
}
copyFileSync(path.join(packageRoot, 'LICENSE.txt'), path.join(output, 'LICENSE.txt'));
console.log(`[copy-maplibre-assets] /maplibre/${version}/`);
