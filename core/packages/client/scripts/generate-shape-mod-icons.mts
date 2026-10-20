/**
 * Original shape-mod glyphs; no photographed/vector artwork is copied.
 * Run from core: pnpm --filter @cuberoot/client exec node scripts/generate-shape-mod-icons.mts
 * Add --check to compare the committed SVGs without writing.
 *
 * Axis: ordinary 3x3 cutting planes rotated 60 degrees about (1,1,1).
 * https://twistypuzzles.com/app/museum/museum_showitem.php?pkey=1598
 * Windmill: two cube cut axes rotated 30 degrees about the third.
 * https://www.robspuzzlepage.com/rearrangement.htm
 * Mastermorphix: the 3x3's six Cartesian cuts intersect a tetrahedral shell;
 * each face has 3 tips, 3 half-centres, 3 edges and one flat corner (10 cells).
 * This is the retail shape mod, not either of the named PG morphix variants.
 * https://www.cs.brandeis.edu/~storer/JimPuzzles/RUBIK/Mastermorphix/Mastermorphix.pdf
 * Sphere uses the site's sphere-cubie model, not a spherical outer shell:
 * packages/puzzle-render-core/src/engine/nxn/cubelet.ts (SPHERE_RADIUS).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveWorkspacePath } from '../../../scripts/resolve-workspace-path.mjs';

type Point = [number, number];
type Line = [number, number, number];
const EPS = 1e-8;
const fmt = (value: number) => Number(value.toFixed(2));
const area = (poly: Point[]) => poly.reduce((sum, point, index) => {
  const next = poly[(index + 1) % poly.length];
  return sum + point[0] * next[1] - next[0] * point[1];
}, 0) / 2;

/** Half-plane clipping preserves the actual intersections of the cutting lines. */
function clip(poly: Point[], [a, b, c]: Line, side: number): Point[] {
  const output: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const dp = side * (a * p[0] + b * p[1] - c);
    const dq = side * (a * q[0] + b * q[1] - c);
    if (dp >= -EPS) output.push(p);
    if ((dp < -EPS && dq > EPS) || (dp > EPS && dq < -EPS)) {
      const t = dp / (dp - dq);
      output.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
    }
  }
  return output;
}

function cut(poly: Point[], lines: Line[]): Point[][] {
  return lines.reduce((cells, line) => cells.flatMap(cell => [clip(cell, line, 1), clip(cell, line, -1)])
    .filter(cell => cell.length >= 3 && Math.abs(area(cell)) > EPS), [poly]);
}

/** Inset straight edges by a fixed screen-space distance to keep clear seams. */
function inset(poly: Point[], gap: number): Point[] {
  const sign = Math.sign(area(poly));
  return poly.map((p, i) => {
    const previous = poly[(i + poly.length - 1) % poly.length];
    const next = poly[(i + 1) % poly.length];
    const u: Point = [p[0] - previous[0], p[1] - previous[1]];
    const v: Point = [next[0] - p[0], next[1] - p[1]];
    const lu = Math.hypot(...u), lv = Math.hypot(...v);
    const nu: Point = [-u[1] / lu * sign, u[0] / lu * sign];
    const nv: Point = [-v[1] / lv * sign, v[0] / lv * sign];
    const divisor = 1 + nu[0] * nv[0] + nu[1] * nv[1];
    return [p[0] + gap * (nu[0] + nv[0]) / divisor, p[1] + gap * (nu[1] + nv[1]) / divisor];
  });
}

function glyph(cells: Point[][], project: (p: Point) => Point, expected: number): string {
  if (cells.length !== expected) throw new Error(`Expected ${expected} face cells, got ${cells.length}`);
  const polygons = cells.map(cell => cell.map(project));
  const points = polygons.flat();
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = 88 / Math.max(maxX - minX, maxY - minY);
  const paths = polygons.map(poly => {
    const screen: Point[] = poly.map(([x, y]) => [48 + (x - (minX + maxX) / 2) * scale, 48 + (y - (minY + maxY) / 2) * scale]);
    return `M${inset(screen, 1.1).map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join('L')}Z`;
  });
  const svg = wrap(`<path d="${paths.join('')}"/>`);
  if (/NaN|Infinity/.test(svg)) throw new Error('Invalid projected shape-mod icon');
  return svg;
}

function wrap(body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="currentColor">${body}</svg>\n`;
}

const square: Point[] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
const cuts = [-1 / 3, 1 / 3];
// R_(1,1,1)(60 degrees) has cyclic rows (2,-1,2)/3. Intersect with z=1.
const axis = cut(square, [[2 / 3, -1 / 3, 2 / 3], [2 / 3, 2 / 3, -1 / 3], [-1 / 3, 2 / 3, 2 / 3]]
  .flatMap(([x, y, z]) => cuts.map(offset => [x, y, offset - z] as Line)));
const angle = Math.PI / 6, c = Math.cos(angle), s = Math.sin(angle);
const windmill = cut(square, [[c, s], [-s, c]].flatMap(([x, y]) => cuts.map(offset => [x, y, offset] as Line)));
// Face x+y+z=-2 of the tetrahedral shell, using (x,y) as face coordinates.
const morphix = cut([[-2, -2], [2, -2], [-2, 2]], [
  ...cuts.map(offset => [1, 0, offset] as Line),
  ...cuts.map(offset => [0, 1, offset] as Line),
  ...cuts.map(offset => [1, 1, -2 - offset] as Line),
]);

const icons = {
  axis: glyph(axis, ([x, y]) => [x, -y], 7),
  windmill: glyph(windmill, ([x, y]) => [x, -y], 9),
  'mastermorphix-shape': glyph(morphix, ([x, y]) => [(x - y) / Math.sqrt(2), (2 + 3 * (x + y)) / Math.sqrt(6)], 10),
  sphere: wrap([18, 48, 78].flatMap(y => [18, 48, 78].map(x => `<circle cx="${x}" cy="${y}" r="13"/>`)).join('')),
  // Eight facelets surround the genuine missing centre; no filled background.
  void: wrap([0, 1, 2].flatMap(row => [0, 1, 2].flatMap(col => row === 1 && col === 1 ? []
    : [`<rect x="${5 + col * 30}" y="${5 + row * 30}" width="26" height="26" rx="1.4"/>`])).join('')),
};

const root = resolve(import.meta.dirname, '../../..', resolveWorkspacePath('@cuberoot/event-icon'), 'svg/puzzle');
const check = process.argv.includes('--check');
for (const [name, svg] of Object.entries(icons)) {
  const path = resolve(root, `${name}.svg`);
  if (check) {
    if (readFileSync(path, 'utf8') !== svg) throw new Error(`Stale shape-mod icon: ${name}`);
  } else writeFileSync(path, svg);
}
console.log(`${check ? 'Verified' : 'Generated'} ${Object.keys(icons).length} shape-mod icons.`);
