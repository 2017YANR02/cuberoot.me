import { magicPoses, magicStepCount, parseMagicSetup, type MagicPuzzle } from '@cuberoot/puzzle-solvers/magic';
import { magicArtwork, magicLayoutBounds, MAGIC_TILE_COLOR, MAGIC_TILE_EDGE } from './magic-artwork.js';

const PAD = 0.07;
const n = (value: number) => Number(value.toFixed(5));

function layout(puzzle: MagicPuzzle, scramble: string) {
  const direction = parseMagicSetup(scramble, puzzle);
  const poses = magicPoses(puzzle, direction === 'Forward' ? 0 : magicStepCount(puzzle));
  return { poses, direction, ...magicLayoutBounds(poses) };
}

export function magicSvgAspect(puzzle: MagicPuzzle, scramble = ''): number {
  const box = layout(puzzle, scramble);
  return (box.maxX - box.minX + 2 * PAD) / (box.maxY - box.minY + 2 * PAD);
}

/** Complete vector preview of the exact practice starting layout. */
export function renderMagicSvg(puzzle: MagicPuzzle, scramble = ''): string {
  const box = layout(puzzle, scramble);
  const { poses, direction, minX, minY, maxX, maxY } = box;
  const width = maxX - minX + 2 * PAD, height = maxY - minY + 2 * PAD;
  const art = magicArtwork(puzzle);
  const tiles = poses.map((pose, tile) => {
    const side = pose.normal[2] > 0 ? 'front' : 'back';
    const transform = `matrix(${n(pose.right[0])} ${n(-pose.right[1])} ${n(pose.up[0])} ${n(-pose.up[1])} ${n(pose.position[0] - minX + PAD)} ${n(maxY - pose.position[1] + PAD)})`;
    const paths = art[tile][side].map(ink => `<path fill="${ink.color}" d="${ink.polygons.map(poly => `M${poly.map(p => `${n(p[0])},${n(p[1])}`).join('L')}Z`).join('')}"/>`).join('');
    return `<g data-tile="${tile + 1}" data-side="${side}" transform="${transform}"><rect x="-.491" y="-.491" width=".982" height=".982" rx=".025" fill="${MAGIC_TILE_COLOR}" stroke="${MAGIC_TILE_EDGE}" stroke-width=".012"/>${paths}</g>`;
  }).join('');
  const title = `${puzzle === 'magic' ? 'Rubik’s Magic · 8 tiles' : 'Master Magic · 12 tiles'} · ${direction}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(width)} ${n(height)}" width="${n(width * 100)}" height="${n(height * 100)}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%" role="img" aria-label="${title}"><title>${title}</title>${tiles}</svg>`;
}
