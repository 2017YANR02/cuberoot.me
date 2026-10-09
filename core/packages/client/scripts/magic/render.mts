/** Real Magic panel geometry and fixed ink snapshots, without WebGL.
 * Run from core: node --import tsx packages/client/scripts/magic/render.mts
 * Render-only layer spacing does not model nylon tension or contact forces.
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import sharp from 'sharp';
import World from '@cuberoot/puzzle-render-core/engine/world';
import MagicCube from '@cuberoot/puzzle-render-core/engine/magic/MagicCube';
import tweener from '@cuberoot/puzzle-render-core/engine/tweener';
import { timing } from '@cuberoot/puzzle-render-core/engine/tweenTiming';
import { renderMagicSvg } from '@cuberoot/puzzle-render-core/magic-svg';
import { magicStepCount, type MagicPuzzle } from '@cuberoot/puzzle-solvers/magic';

const coreRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const output = resolve(coreRoot, '.tmp/png/magic');
mkdirSync(output, { recursive: true });
const exporter = resolve(coreRoot, 'packages/client/node_modules/.cache/magic-svg-export.mjs');
await build({
  entryPoints: [resolve(coreRoot, 'packages/client/app/[lang]/sim/sim_svg_export.ts')],
  outfile: exporter, bundle: true, packages: 'external', platform: 'node', format: 'esm', logLevel: 'silent',
});
const { exportSimSvg } = await import(pathToFileURL(exporter).href);
const world = new World();
world.width = 900;
world.height = 700;
const sheets: { input: Buffer; top: number; left: number }[] = [];
let row = 0;
for (const puzzle of ['magic', 'mmagic'] as const satisfies readonly MagicPuzzle[]) {
  world.setPuzzle(puzzle);
  world.resize();
  assert(world.cube instanceof MagicCube, 'World and public entry must share the MagicCube constructor');
  const cube = world.cube;
  cube.twister.setup('Forward');
  assert(cube.twister.twist({ kind: 'fold', dir: 1 }, false, false));
  tweener.update(timing.frames / 2);
  assert(cube.positionOnRoute > 0 && cube.positionOnRoute < 1, 'World must share the public animation clock');
  cube.twister.finish();
  for (const direction of ['Forward', 'Backward'] as const) {
    const svg = renderMagicSvg(puzzle, `${puzzle === 'mmagic' ? 'M ' : ''}${direction}`);
    const name = `${puzzle}-${direction}`;
    writeFileSync(resolve(output, `${name}.svg`), svg);
    const png = await sharp(Buffer.from(svg)).resize(750, 620, { fit: 'contain', background: '#f6f8fb' }).png().toBuffer();
    writeFileSync(resolve(output, `${name}.png`), png);
    sheets.push({ input: png, top: row * 680 + 60, left: direction === 'Forward' ? 0 : 750 });
    sheets.push({ input: Buffer.from(`<svg width="750" height="60"><text x="28" y="40" font-family="sans-serif" font-size="26" fill="#171b25">${name}</text></svg>`), top: row * 680, left: direction === 'Forward' ? 0 : 750 });
  }
  row++;
  const positions = puzzle === 'magic' ? [0, 0.25, 0.5, 0.75, 1, 4, 7.5, 10.5, 12] : [0, 0.5, 1, 8.5, 12, 18, 20.5, 22.5, 23];
  for (const position of positions) {
    cube.renderPosition(position);
    const svg = exportSimSvg({ world, background: '#f6f8fb' });
    const name = `${puzzle}-step-${position}`;
    writeFileSync(resolve(output, `${name}.svg`), svg);
    await sharp(Buffer.from(svg)).png().toFile(resolve(output, `${name}.png`));
  }
  assert(positions.at(-1) === magicStepCount(puzzle));
}
await sharp({ create: { width: 1500, height: 1360, channels: 4, background: '#f6f8fb' } })
  .composite(sheets).png().toFile(resolve(output, 'practice-layouts.png'));
world.disposeMagicCubes();
console.log(`Wrote four practice layouts and 18 real engine frames to ${output}`);
