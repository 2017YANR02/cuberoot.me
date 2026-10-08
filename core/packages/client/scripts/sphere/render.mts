/** Actual sphere-cubie engine snapshots, without a browser or WebGL.
 * Run from core: node --import tsx packages/client/scripts/sphere/render.mts
 * SVG lighting is the simulator exporter's Lambert approximation of the GPU view.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import sharp from 'sharp';
import World from '@cuberoot/puzzle-render-core/engine/world';
import type Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';

const coreRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const output = resolve(coreRoot, '.tmp/png/sphere');
mkdirSync(output, { recursive: true });
// The client package is not ESM. Bundle its TS adapter as ESM so Node can consume
// the shared engine's import-only WASM package without changing production exports.
const exporter = resolve(coreRoot, 'packages/client/node_modules/.cache/sphere-svg-export.mjs');
await build({
  entryPoints: [resolve(coreRoot, 'packages/client/app/[lang]/sim/sim_svg_export.ts')],
  outfile: exporter, bundle: true, packages: 'external', platform: 'node', format: 'esm', logLevel: 'silent',
});
const { exportSimSvg } = await import(pathToFileURL(exporter).href);
const world = new World();
world.setPuzzle('sphere');
world.width = 900;
world.height = 800;
world.resize();
const cube = world.cube as Cube;

async function snapshot(name: string): Promise<void> {
  const svg = exportSimSvg({ world, background: '#f6f8fb' });
  writeFileSync(resolve(output, `${name}.svg`), svg);
  await sharp(Buffer.from(svg)).png().toFile(resolve(output, `${name}.png`));
}

await snapshot('solved');
const right = cube.table.face('R')!;
right.drag();
for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
  right.angle = Math.PI / 2 * fraction;
  await snapshot(`R-${Math.round(fraction * 100)}`);
}
right.drop();
cube.twister.setup("R U R' F2 D L2 U' B R2 F' U2");
await snapshot('scrambled');
world.disposeSphereCube();
console.log(`Wrote solved, scrambled and five actual turn frames to ${output}`);
