// Exact positive-Z source sticker polygons, projected onto the canonical icon square.
// From core: pnpm -F @cuberoot/client exec tsx scripts/ghost/icon.mjs
import { GHOST_CELLS, GHOST_SCALE } from '@cuberoot/puzzle-render-core/engine/ghost/ghostModel';
const paths = GHOST_CELLS.flatMap(c => c.facets).filter(f => f.face === 5 && f.sticker.length)
  .map(f => `<polygon points="${f.sticker.map(([u, v]) =>
    `${(250 + u / GHOST_SCALE * 8).toFixed(3)},${(250 - v / GHOST_SCALE * 8).toFixed(3)}`).join(' ')}"/>`);
console.log(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500">\n${paths.join('\n')}\n</svg>`);
