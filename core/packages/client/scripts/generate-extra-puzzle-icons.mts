/**
 * Original structural glyphs for the non-PG scramble catalog.
 * Run from core: pnpm --filter @cuberoot/client exec node scripts/generate-extra-puzzle-icons.mts
 * Append --check to verify the committed SVGs without writing; then regenerate event-icon maps.
 *
 * Cuboid dimensions follow the existing cuboid/floppy previews. Siamese models
 * are unions of two 3³ cubes with the named shared block (not two detached cubes).
 * Their overlap agrees with puzzle-solvers/sia123.ts and /sia222.ts; the 113
 * construction is documented at https://www.jaapsch.net/puzzles/siamese.htm.
 * Bicube joins come from BIC_SOLVED, with the face indices in bicube_svg.ts.
 * Cmetrick's 3×3 ball frame: https://www.jaapsch.net/puzzles/cmetrick.htm.
 * BSq has ordinary Square-1 pieces; only the allowed moves differ (bsq_svg.ts).
 * Super Floppy and Floppy likewise have the same solved 133 outline. Do not
 * invent extra seams merely to distinguish mechanisms with identical shapes.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BIC_SOLVED } from '@cuberoot/puzzle-solvers/bicube';
import { resolveWorkspacePath } from '../../../scripts/resolve-workspace-path.mjs';

type V = [number, number, number];
type P = [number, number];
type Face = { points: V[]; normal: V; plane: number };
const dot = (a: V, b: V) => a.reduce((sum, n, i) => sum + n * b[i], 0);
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v: V): V => v.map(n => n / Math.hypot(...v)) as V;
const fmt = (n: number) => Number(n.toFixed(2));
const area = (p: P[]) => p.reduce((sum, a, i) => { const b = p[(i + 1) % p.length]; return sum + a[0] * b[1] - b[0] * a[1]; }, 0) / 2;
const ccw = (p: P[]) => area(p) > 0 ? p : [...p].reverse();
const path = (p: P[]) => 'M' + p.map(v => v.map(fmt).join(' ')).join('L') + 'Z';
const svg = (content: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="currentColor">${content}</svg>\n`;

function halfPlane(p: P[], a: P, b: P, inside = true): P[] {
  const side = (v: P) => ((b[0] - a[0]) * (v[1] - a[1]) - (b[1] - a[1]) * (v[0] - a[0])) * (inside ? 1 : -1);
  const out: P[] = [];
  for (let i = 0; i < p.length; i++) {
    const from = p[i], to = p[(i + 1) % p.length], d0 = side(from), d1 = side(to);
    if (d0 >= -1e-9) out.push(from);
    if ((d0 > 1e-9 && d1 < -1e-9) || (d0 < -1e-9 && d1 > 1e-9)) {
      const t = d0 / (d0 - d1);
      out.push([from[0] + t * (to[0] - from[0]), from[1] + t * (to[1] - from[1])]);
    }
  }
  return out;
}

function intersection(p: P[], q: P[]): P[] {
  for (let i = 0; i < q.length && p.length; i++) p = halfPlane(p, q[i], q[(i + 1) % q.length]);
  return p;
}

/** Partition a convex polygon outside another convex polygon, without SVG masks. */
function subtract(p: P[], q: P[]): P[][] {
  const out: P[][] = [];
  for (let i = 0; i < q.length && p.length; i++) {
    const a = q[i], b = q[(i + 1) % q.length], outside = halfPlane(p, a, b, false);
    if (outside.length >= 3 && Math.abs(area(outside)) > 1e-7) out.push(outside);
    p = halfPlane(p, a, b);
  }
  return out;
}

/** Offset each convex edge by the same optical gap. */
function inset(poly: P[], gap: number): P[] {
  let result = poly;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
    result = halfPlane(result, [a[0] - dy * gap / length, a[1] + dx * gap / length], [b[0] - dy * gap / length, b[1] + dx * gap / length]);
  }
  return result;
}

function face(axis: number, plane: number, sign: number, a0: number, a1: number, b0: number, b1: number): Face {
  const axes = [0, 1, 2].filter(a => a !== axis);
  const points = [[a0, b0], [a1, b0], [a1, b1], [a0, b1]].map(([a, b]) => {
    const p: V = [0, 0, 0]; p[axis] = plane; p[axes[0]] = a; p[axes[1]] = b; return p;
  });
  const normal: V = [0, 0, 0]; normal[axis] = sign;
  return { points, normal, plane: sign * plane };
}

function renderFaces(faces: Face[], camera: V = [6, 4, 7]): string {
  const view = norm(camera), right = norm(cross([0, 1, 0], view)), up = cross(view, right);
  const project = (v: V): P => [dot(v, right), -dot(v, up)];
  const projected = faces.map(f => f.points.map(project));
  const all = projected.flat(), xs = all.map(p => p[0]), ys = all.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;
  const scale = 88 / Math.max(maxX - minX, maxY - minY);
  const polys = projected.map(p => ccw(p.map(([x, y]): P => [48 + (x - midX) * scale, 48 + (y - midY) * scale])));
  const depth = (f: Face, p: P) => (f.plane - dot(f.normal, right) * ((p[0] - 48) / scale + midX) + dot(f.normal, up) * ((p[1] - 48) / scale + midY)) / dot(f.normal, view);
  const output: P[][] = [];
  for (let i = 0; i < faces.length; i++) {
    let pieces = [inset(polys[i], 0.8)];
    // Remove occluded faces BEFORE emitting. Transparent sticker gaps must not
    // reveal rear stickers in a concave Siamese body.
    for (let j = 0; j < faces.length && pieces.length; j++) {
      if (i === j) continue;
      const overlap = intersection(polys[i], polys[j]);
      if (overlap.length < 3 || Math.abs(area(overlap)) < 1e-7) continue;
      const p: P = [overlap.reduce((s, v) => s + v[0], 0) / overlap.length, overlap.reduce((s, v) => s + v[1], 0) / overlap.length];
      if (depth(faces[j], p) > depth(faces[i], p) + 1e-7) pieces = pieces.flatMap(part => subtract(part, polys[j]));
    }
    output.push(...pieces.filter(p => p.length >= 3 && Math.abs(area(p)) > 0.05));
  }
  return svg(`<path d="${output.map(path).join('')}"/>`);
}

function cuboid(w: number, h: number, d: number): string {
  const faces: Face[] = [];
  for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) faces.push(face(1, h, 1, x, x + 1, z, z + 1));
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) faces.push(face(2, d, 1, x, x + 1, y, y + 1));
  for (let y = 0; y < h; y++) for (let z = 0; z < d; z++) faces.push(face(0, w, 1, y, y + 1, z, z + 1));
  return renderFaces(faces);
}

function siamese(overlap: V): string {
  const offset = overlap.map(n => 3 - n) as V;
  const voxels = new Map<string, { p: V; shared: boolean }>();
  for (const origin of [[0, 0, 0], offset]) for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) for (let z = 0; z < 3; z++) {
    const p: V = [x + origin[0], y + origin[1], z + origin[2]], key = p.join(',');
    voxels.set(key, { p, shared: voxels.has(key) });
  }
  const expected = 54 - overlap[0] * overlap[1] * overlap[2];
  if (voxels.size !== expected) throw new Error('Incorrect Siamese overlap');
  const camera: V = [6, 4, -7];
  const groups = new Map<string, { axis: number; plane: number; sign: number; cells: V[] }>();
  for (const { p, shared } of voxels.values()) for (let axis = 0; axis < 3; axis++) {
    const sign = Math.sign(camera[axis]), next = [...p] as V; next[axis] += sign;
    if (voxels.has(next.join(','))) continue;
    const plane = p[axis] + Number(sign > 0);
    const key = `${axis}:${plane}:${shared ? 'shared' : p.join(',')}`;
    const group = groups.get(key) ?? { axis, plane, sign, cells: [] };
    group.cells.push(p); groups.set(key, group);
  }
  const faces = [...groups.values()].map(({ axis, plane, sign, cells }) => {
    const [a, b] = [0, 1, 2].filter(n => n !== axis);
    return face(axis, plane, sign, Math.min(...cells.map(p => p[a])), Math.max(...cells.map(p => p[a])) + 1, Math.min(...cells.map(p => p[b])), Math.max(...cells.map(p => p[b])) + 1);
  });
  return renderFaces(faces, camera);
}

function bicube(): string {
  // U, F, R sticker rings from the existing canonical preview, followed by centre.
  const rings = [[0, 1, 2, 5, 8, 7, 6, 3, 4], [6, 7, 8, 13, 20, 19, 18, 11, 12], [8, 5, 2, 15, 22, 21, 20, 13, 14]];
  const positions = [0, 1, 2, 5, 8, 7, 6, 3, 4];
  const faces: Face[] = [];
  rings.forEach((ring, side) => {
    const groups = new Map<number, P[]>();
    ring.forEach((sticker, i) => {
      const label = BIC_SOLVED[sticker], p: P = [positions[i] % 3, Math.floor(positions[i] / 3)];
      groups.set(label, [...(groups.get(label) ?? []), p]);
    });
    for (const cells of groups.values()) {
      const c0 = Math.min(...cells.map(p => p[0])), c1 = Math.max(...cells.map(p => p[0])) + 1;
      const r0 = Math.min(...cells.map(p => p[1])), r1 = Math.max(...cells.map(p => p[1])) + 1;
      if ((c1 - c0) * (r1 - r0) !== cells.length) throw new Error('Non-rectangular Bicube face block');
      if (side === 0) faces.push(face(1, 3, 1, c0, c1, r0, r1));
      if (side === 1) faces.push(face(2, 3, 1, c0, c1, 3 - r1, 3 - r0));
      if (side === 2) faces.push(face(0, 3, 1, 3 - r1, 3 - r0, 3 - c1, 3 - c0));
    }
  });
  return renderFaces(faces);
}

function sliding(n: number): string {
  const cell = 76 / n, parts = ['<rect x="5" y="5" width="86" height="86" rx="5" fill="none" stroke="currentColor" stroke-width="3"/>'];
  for (let i = 0; i < n * n - 1; i++) parts.push(`<rect x="${fmt(10 + (i % n) * cell + 1.5)}" y="${fmt(10 + Math.floor(i / n) * cell + 1.5)}" width="${fmt(cell - 3)}" height="${fmt(cell - 3)}" rx="1.5"/>`);
  return svg(parts.join(''));
}

function squareOne(): string {
  const edge = (degrees: number): P => {
    const angle = degrees * Math.PI / 180, x = Math.cos(angle), y = Math.sin(angle), k = 44 / Math.max(Math.abs(x), Math.abs(y));
    return [48 + x * k, 48 + y * k];
  };
  const angles = [15, 75, 105, 165, 195, 255, 285, 345, 375];
  const pieces = angles.slice(0, -1).map((a, i) => {
    const b = angles[i + 1], p: P[] = [[48, 48], edge(a)];
    for (let corner = 45; corner < 405; corner += 90) if (corner > a && corner < b) p.push(edge(corner));
    p.push(edge(b)); return inset(ccw(p), 1.15);
  });
  return svg(`<path d="${pieces.map(path).join('')}"/>`);
}

function cmetrick(): string {
  const parts = ['<rect x="4.5" y="4.5" width="87" height="87" rx="13" fill="none" stroke="currentColor" stroke-width="3"/>'];
  for (const x of [21, 48, 75]) for (const y of [21, 48, 75]) {
    parts.push(`<circle cx="${x}" cy="${y}" r="10.5" fill="none" stroke="currentColor" stroke-width="4"/>`);
  }
  return svg(parts.join(''));
}

const assets: Record<string, string> = {
  '223': cuboid(2, 3, 2), '133': cuboid(3, 1, 3), '233': cuboid(3, 2, 3),
  '334': cuboid(3, 4, 3), '335': cuboid(3, 5, 3), '336': cuboid(3, 6, 3), '337': cuboid(3, 7, 3),
  sfl: cuboid(3, 1, 3), '8p': sliding(3), '15p': sliding(4), bsq: squareOne(), cm3: cmetrick(), bic: bicube(),
  sia113: siamese([1, 1, 3]), sia123: siamese([1, 2, 3]), sia222: siamese([2, 2, 2]),
};
const out = resolve(import.meta.dirname, '../../..', resolveWorkspacePath('@cuberoot/event-icon'), 'svg/puzzle');
const check = process.argv.includes('--check');
for (const [id, artwork] of Object.entries(assets)) {
  if (/NaN|Infinity|<text|<image/.test(artwork)) throw new Error(`Invalid SVG: ${id}`);
  const file = resolve(out, `${id}.svg`);
  if (check) {
    if (readFileSync(file, 'utf8') !== artwork) throw new Error(`Stale puzzle icon: ${id}`);
  } else writeFileSync(file, artwork);
}
console.log(`${check ? 'Verified' : 'Generated'} ${Object.keys(assets).length} extra structural puzzle icons.`);
