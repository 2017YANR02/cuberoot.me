// Independent reconstruction: pairwise line intersections, not Python polygon clipping.
// From core/: pnpm --filter @cuberoot/client exec tsx scripts/ghost/verify-reference.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Vector3 } from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { polytopeVerts } from '@cuberoot/puzzle-render-core/engine/polytopeCut';

const out = fileURLToPath(new URL('../../../../../.tmp/png/', import.meta.url));
const data = JSON.parse(readFileSync(`${out}ghost-original-analysis.json`, 'utf8'));
const raw = JSON.parse(readFileSync(`${out}ghost-original-extracted.json`, 'utf8'));
assert.equal(raw.source.sha256, 'c70cdc32c4663a9b31983c1c9a7ac3d6e463ba3a037a05d0e77ec702e2109a32');
assert.equal(raw.meshes.length, 327);
const B = data.parameters.shellBasisColumns;
const axes = [0, 1, 2].map(i => B.map(row => row[i]));
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const mul = (a, b) => a.map(v => v * b);
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const hausdorff = (a, b) => Math.max(...a.map(p => Math.min(...b.map(q => distance(p, q)))), ...b.map(p => Math.min(...a.map(q => distance(p, q)))));
for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) assert.ok(Math.abs(dot(axes[i], axes[j]) - Number(i === j)) < 1e-12);
assert.ok(new Vector3(...axes[0]).cross(new Vector3(...axes[1])).distanceTo(new Vector3(...axes[2])) < 1e-12);
assert.deepEqual(data.parameters.thetaByLayerDegrees, [87, 52, 23]);
assert.deepEqual(data.parameters.homeYRotationDegrees, [-35, 0, 29]);
for (const [key, value] of Object.entries({ shellHalfMm: 29, halfCutMm: 9.5, stickerLiftMm: 1, cutInsetMm: 1, stickerInsetMm: 0.5 })) assert.equal(data.parameters[key], value);

function cuts(slot) {
  const angle = (52 - [-35, 0, 29][slot[1] + 1]) * Math.PI / 180;
  const directions = [[Math.cos(angle), 0, Math.sin(angle)], [0, 1, 0], [-Math.sin(angle), 0, Math.cos(angle)]];
  return directions.flatMap((n, i) => {
    const layer = slot[i];
    if (layer === -1) return [{ n, d: -9.5 }];
    if (layer === 1) return [{ n: mul(n, -1), d: -9.5 }];
    return [{ n, d: 9.5 }, { n: mul(n, -1), d: 9.5 }];
  });
}

function polygon(lines) {
  const points = [];
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
    const a = lines[i], b = lines[j];
    const det = a.n[0] * b.n[1] - a.n[1] * b.n[0];
    if (Math.abs(det) < 1e-10) continue;
    const p = [(a.d * b.n[1] - a.n[1] * b.d) / det, (a.n[0] * b.d - a.d * b.n[0]) / det];
    if (lines.every(l => dot(l.n, p) <= l.d + 1e-8) && !points.some(q => distance(p, q) < 1e-8)) points.push(p);
  }
  if (points.length < 3) return [];
  const center = points.reduce((c, p) => c.map((v, i) => v + p[i] / points.length), [0, 0]);
  return points.sort((a, b) => Math.atan2(a[1] - center[1], a[0] - center[0]) - Math.atan2(b[1] - center[1], b[0] - center[0]));
}
const area = p => Math.abs(p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - a[1] * b[0]; }, 0)) / 2;
function faceLines(slot, axis, sign, sticker) {
  const dims = [0, 1, 2].filter(i => i !== axis);
  const h = sticker ? 28.5 : 29;
  const lines = [0, 1].flatMap(i => [-1, 1].map(s => ({ n: [i === 0 ? s : 0, i === 1 ? s : 0], d: h })));
  return lines.concat(cuts(slot).map(({ n, d }) => {
    const projected = dims.map(i => dot(n, axes[i]));
    return { n: projected, d: d - 29 * sign * dot(n, axes[axis]) - (sticker ? 1 + 0.5 * Math.hypot(...projected) : 0) };
  }));
}

// Decode original caps independently of Python's SVD / area-based cap selection.
const sources = new Map();
for (const mesh of raw.meshes) {
  const body = Number(mesh.ancestors.find(n => /^segment_body\d+$/.test(n)).slice(12));
  if (!sources.has(body)) sources.set(body, []);
  sources.get(body).push(...mesh.positions.map(p => mul(p, 1000)));
}
assert.equal(sources.size, 55);
const caps = [...sources].map(([body, points]) => {
  const local = points.map(p => axes.map(n => dot(n, p)));
  const candidates = [0, 1, 2].flatMap(axis => [-1, 1].map(sign => ({ axis, sign }))).filter(({ axis, sign }) => local.every(p => Math.abs(p[axis] - sign * 30.05) < 0.05001));
  assert.equal(candidates.length, 1);
  const { axis, sign } = candidates[0], dims = [0, 1, 2].filter(i => i !== axis);
  assert.ok(local.every(p => Math.min(Math.abs(p[axis] - sign * 30), Math.abs(p[axis] - sign * 30.1)) < 5e-6));
  const cap = [];
  for (const p of local.filter(p => Math.abs(p[axis] - sign * 30) < 5e-6)) {
    const q = dims.map(i => p[i]);
    if (!cap.some(v => distance(v, q) < 1e-6)) cap.push(q);
  }
  return { body, axis, sign, points: cap };
});

let volume = 0, count = 0, maxError = 0, visible = 0;
const surface = new Map(), matched = new Set();
for (const cell of data.cells) {
  const shell = axes.flatMap(n => [-1, 1].map(sign => ({ n: mul(n, sign), d: 29 })));
  const vertices = polytopeVerts(shell.concat(cuts(cell.slot)));
  assert.equal(vertices.length, cell.vertices.length);
  assert.ok(hausdorff(vertices.map(v => v.toArray()), cell.vertices) < 1e-8);
  const geometry = new ConvexGeometry(vertices), p = geometry.getAttribute('position');
  let cellVolume = 0;
  for (let i = 0; i < p.count; i += 3) {
    const a = new Vector3().fromBufferAttribute(p, i), b = new Vector3().fromBufferAttribute(p, i + 1), c = new Vector3().fromBufferAttribute(p, i + 2);
    cellVolume += a.dot(b.cross(c)) / 6;
  }
  geometry.dispose();
  assert.ok(Math.abs(cellVolume - cell.volumeMm3) < 0.002); // THREE uses float32 positions.
  volume += cellVolume;
  let cellPatches = 0;
  for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
    const polygonRaw = polygon(faceLines(cell.slot, axis, sign, false));
    const sticker = polygon(faceLines(cell.slot, axis, sign, true));
    const key = `${axis}/${sign}`, row = surface.get(key) ?? { patches: 0, stickers: 0, area: 0 };
    if (polygonRaw.length) { row.patches++; row.area += area(polygonRaw); count++; cellPatches++; }
    if (sticker.length) {
      row.stickers++;
      const matches = caps.filter(c => c.axis === axis && c.sign === sign).map(c => ({ ...c, error: hausdorff(sticker, c.points) })).sort((a, b) => a.error - b.error);
      const match = matches[0];
      assert.ok(match.error < 5e-6, JSON.stringify({ slot: cell.slot, axis, sign, error: match.error }));
      assert.equal(sticker.length, match.points.length);
      assert.ok(!matched.has(match.body));
      matched.add(match.body);
      maxError = Math.max(maxError, match.error);
    }
    surface.set(key, row);
  }
  visible += Number(cellPatches > 0);
}
assert.equal(data.cells.length, 27);
assert.equal(visible, 26);
assert.equal(count, 59);
assert.equal(matched.size, 55);
assert.ok(Math.abs(volume - 58 ** 3) < 0.02);
for (const [key, row] of surface) {
  assert.ok(Math.abs(row.area - 58 ** 2) < 1e-7);
  const [axis, sign] = key.split('/').map(Number), expected = data.checks.coverage.find(c => c.axis === axis && c.sign === sign);
  assert.equal(row.patches, expected.patches);
  assert.equal(row.stickers, expected.stickers);
}
console.log(JSON.stringify({ cells: data.cells.length, visible, surfacePatches: count, matchedStickers: matched.size, maxVertexErrorMm: maxError, volumeMm3: volume, faces: Object.fromEntries(surface) }, null, 2));
