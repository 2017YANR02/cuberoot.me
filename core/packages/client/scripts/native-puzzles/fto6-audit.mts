/** Independent sixth-division construction; deliberately does not import cubing.js.
 * Run from the client: node scripts/native-puzzles/fto6-audit.mts [output-directory]
 * Generates a repeatable cut diagram and a machine-readable geometry audit.
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type Vec3 = readonly [number, number, number];
type Triangle = readonly [Vec3, Vec3, Vec3];
const layers = 6;
const faces: Vec3[] = [];
for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) faces.push([x, y, z]);
const axes = faces.filter(([x]) => x === 1);
const cuts = [-2 / 3, -1 / 3, 0, 1 / 3, 2 / 3];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const multiply = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0],
];
function triangles(n: number): Triangle[] {
  const point = (i: number, j: number): Vec3 => [i / n, j / n, 1 - (i + j) / n];
  const result: Triangle[] = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) {
    result.push([point(i, j), point(i + 1, j), point(i, j + 1)]);
    if (i + j < n - 1) result.push([point(i + 1, j), point(i + 1, j + 1), point(i, j + 1)]);
  }
  return result;
}
const patches = faces.flatMap((face, faceIndex) => triangles(layers).map(triangle => {
  const points = triangle.map((p): Vec3 => [p[0] * face[0], p[1] * face[1], p[2] * face[2]]);
  const center = multiply(points.reduce(add, [0, 0, 0]), 1 / 3);
  const signature = axes.map(a => cuts.filter(c => dot(a, center) > c + 1e-9).length).join(',');
  return { faceIndex, points, center, signature };
}));
assert.equal(patches.length, 288);
const pieceFacelets = new Map<string, number>();
for (const p of patches) pieceFacelets.set(p.signature, (pieceFacelets.get(p.signature) ?? 0) + 1);
const counts: Record<string, number> = {};
for (const n of pieceFacelets.values()) counts[n] = (counts[n] ?? 0) + 1;
assert.deepEqual(counts, { 1: 168, 2: 48, 4: 6 });
assert.equal(pieceFacelets.size, 222);
// Every small triangle must lie on one side of every physical cutting plane.
for (const p of patches) for (const a of axes) for (const c of cuts) {
  const distances = p.points.map(v => dot(a, v) - c);
  assert(!(Math.min(...distances) < -1e-9 && Math.max(...distances) > 1e-9));
}
function rotate(v: Vec3, normal: Vec3, angle: number): Vec3 {
  const axis = multiply(normal, 1 / Math.sqrt(3));
  return add(add(multiply(v, Math.cos(angle)), multiply(cross(axis, v), Math.sin(angle))),
    multiply(axis, dot(axis, v) * (1 - Math.cos(angle))));
}
const key = (v: Vec3): string => v.map(x => Math.round(x * 1e9)).join(',');
const keys = new Set(patches.map(p => key(p.center)));
let rotationChecks = 0;
for (const axis of faces) for (let depth = 1; depth <= 3; depth++) for (const power of [-1, 1]) {
  const lower = 1 - depth / 3, upper = 1 - (depth - 1) / 3;
  for (const p of patches) {
    const distance = dot(axis, p.center);
    if (distance > lower + 1e-9 && distance < upper - 1e-9) {
      assert(keys.has(key(rotate(p.center, axis, power * 2 * Math.PI / 3))));
      rotationChecks++;
    }
  }
}
assert.equal(rotationChecks, 1728);
function grid(n: number, color: string, width: number): string {
  const project = ([, y, z]: Vec3): readonly [number, number] => [80 + 500 * (y + 0.5 * z), 550 - 433.0127018922193 * z];
  return triangles(n).map(points => `<polygon points="${points.map(p => project(p).map(v => v.toFixed(3)).join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="${width}"/>`).join('');
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="690" viewBox="0 0 760 690">
<rect width="760" height="690" fill="white"/>
<g font-family="sans-serif" fill="#111"><text x="38" y="38" font-size="24">FTO: 4-layer baseline / 6-layer proposed</text><text x="38" y="69" font-size="16">One regular triangular face; all eight faces use identical cuts</text></g>
<path d="M80 555H580M75 550L330 112L585 550" fill="none" stroke="#bbb" stroke-dasharray="6 6"/>
${grid(4, '#111', 1.2)}${grid(6, '#198754', 2.1)}
<path d="M80 550L580 550L330 116.987298107781L80 550" fill="none" stroke="#1769aa" stroke-width="3"/>
<g font-family="sans-serif" font-size="16"><text x="38" y="601" fill="#111">Black: existing 4-layer grid (not retained)</text><text x="38" y="625" fill="#198754">Green: 36 equal-area triangles per face; 288 facelets total</text><text x="38" y="649" fill="#1769aa">Blue: unchanged boundary; cuts 0, +/-1/3, +/-2/3</text></g></svg>`;
const output = process.argv[2] ? resolve(process.argv[2]) : fileURLToPath(new URL('../../../../.tmp/fto6/', import.meta.url));
mkdirSync(output, { recursive: true });
const report = { layers, faceCount: faces.length, facelets: patches.length, visiblePieces: pieceFacelets.size,
  byStickerCount: counts, cuts, rotationChecks, scope: 'Independent surface/cut/rotation oracle, not cubing.js or browser validation' };
writeFileSync(resolve(output, 'fto6-outlines.svg'), svg);
writeFileSync(resolve(output, 'geometry-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
