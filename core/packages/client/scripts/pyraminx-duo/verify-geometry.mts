/**
 * Independent Pyraminx Duo geometry proof, including the rendered finite solids.
 * Run from core/: node --import tsx packages/client/scripts/pyraminx-duo/verify-geometry.mts
 *
 * The oracle below does not import the engine's face partition or mesh builder to
 * construct its collision volumes. It rebuilds the approved 0.4 face partition,
 * uses larger sharp envelopes for both the rounded bodies and raised stickers,
 * and checks the actual rendered triangle meshes are contained in those envelopes.
 * Complete convex-polyhedron SAT tests the envelopes throughout all eight turns.
 * A rigid-motion displacement bound covers the intervals between the samples.
 *
 * This verifies display shells, not any manufacturer's internal mechanism.
 */
import assert from 'node:assert/strict';
import type { ExtrudeGeometry, Mesh } from 'three';
import { DUO_A, DUO_SHELL, buildDuoCore, buildDuoPiece } from '@cuberoot/puzzle-render-core/engine/duo/duoGeometry';

type V = [number, number, number];
type P = [number, number];
type Kind = 'corner' | 'centre';
type Layer = 'body' | 'sticker';
interface Solid {
  vertices: V[];
  normals: V[];
  edges: V[];
  bounds: [number, number][];
  face: number;
  layer: Layer;
}
interface Patch { polygon: V[]; face: number; layer: Layer }
interface Piece { kind: Kind; id: number; name: string; solids: Solid[]; patches: Patch[] }

const VERTICES: V[] = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
const EPS = 1e-8;
const MESH_EPS = 2e-6; // Normalized Float32 mesh coordinates.
const NUMERIC_GUARD = 1e-5;
const STEP_DEGREES = 0.5;
// These deliberately exceed the rendered footprints, including concave fillets.
const ENVELOPE = { bodyInset: 0.02, stickerInset: 0.025, bodyDepth: 0.01, lift: 0.001, stickerDepth: 0.006 };
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = (a: V) => Math.sqrt(dot(a, a));
const unit = (a: V): V => mul(a, 1 / length(a));
const midpoint = (a: V, b: V): V => mul(add(a, b), 0.5);
const cross2 = (a: P, b: P) => a[0] * b[1] - a[1] * b[0];
const sub2 = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1]];

function rotate(p: V, axis: V, angle: number): V {
  return add(add(mul(p, Math.cos(angle)), mul(cross(axis, p), Math.sin(angle))), mul(axis, dot(axis, p) * (1 - Math.cos(angle))));
}

/** Intersection of adjacent parallel edge-offset lines; supports reflex vertices. */
function offset(poly: V[], widths: number[]): V[] {
  const normal = unit(poly.reduce<V>((sum, p, i) => add(sum, cross(p, poly[(i + 1) % poly.length])), [0, 0, 0]));
  return poly.map((p, i) => {
    const previous = (i + poly.length - 1) % poly.length;
    const n0 = cross(normal, unit(sub(p, poly[previous])));
    const n1 = cross(normal, unit(sub(poly[(i + 1) % poly.length], p)));
    const c = dot(n0, n1), denominator = 1 - c * c;
    return add(p, add(mul(n0, (widths[previous] - c * widths[i]) / denominator), mul(n1, (widths[i] - c * widths[previous]) / denominator)));
  });
}

function uniqueAxes(vectors: V[]): V[] {
  const axes: V[] = [];
  for (const v of vectors) {
    if (length(v) < 1e-9) continue;
    const n = unit(v);
    if (!axes.some(a => Math.abs(dot(a, n)) > 1 - 1e-10)) axes.push(n);
  }
  return axes;
}

function bounds(vertices: V[]): [number, number][] {
  return [0, 1, 2].map(i => [Math.min(...vertices.map(p => p[i])), Math.max(...vertices.map(p => p[i]))]);
}

/** A closed triangular radial frustum or normal prism; all its SAT axes are explicit. */
function solid(vertices: V[], face: number, layer: Layer): Solid {
  const faces = [[0, 1, 2], [3, 4, 5], [0, 1, 4, 3], [1, 2, 5, 4], [2, 0, 3, 5]];
  const edges = [[0, 1], [1, 2], [2, 0], [3, 4], [4, 5], [5, 3], [0, 3], [1, 4], [2, 5]];
  return {
    vertices, face, layer, bounds: bounds(vertices),
    normals: uniqueAxes(faces.map(f => cross(sub(vertices[f[1]], vertices[f[0]]), sub(vertices[f[2]], vertices[f[0]])))),
    edges: uniqueAxes(edges.map(e => sub(vertices[e[1]], vertices[e[0]]))),
  };
}

function buildEnvelopes(bodyInset = ENVELOPE.bodyInset): Piece[] {
  const pieces: Piece[] = Array.from({ length: 8 }, (_, i) => ({ kind: i < 4 ? 'corner' : 'centre', id: i % 4, name: `${i < 4 ? 'corner' : 'centre'}${i % 4}`, solids: [], patches: [] }));
  const append = (piece: Piece, poly: V[], face: number) => {
    const corner = piece.kind === 'corner';
    const body = offset(poly, corner ? [0, bodyInset, bodyInset, bodyInset, bodyInset, 0] : [bodyInset, bodyInset, bodyInset]);
    const sticker = offset(poly, poly.map(() => ENVELOPE.stickerInset));
    const normal = mul(VERTICES[face], -1 / Math.sqrt(3));
    piece.patches.push({ polygon: body, face, layer: 'body' }, { polygon: sticker, face, layer: 'sticker' });
    const triangles = corner ? [[0, 1, 3], [1, 2, 3], [0, 3, 5], [3, 4, 5]] : [[0, 1, 2]];
    for (const indices of triangles) {
      const b = indices.map(i => body[i]), s = indices.map(i => sticker[i]);
      piece.solids.push(solid([...b, ...b.map(p => mul(p, 1 - Math.sqrt(3) * ENVELOPE.bodyDepth))], face, 'body'));
      piece.solids.push(solid([...s.map(p => add(p, mul(normal, ENVELOPE.lift + ENVELOPE.stickerDepth))), ...s.map(p => add(p, mul(normal, ENVELOPE.lift)))], face, 'sticker'));
    }
  };
  for (let face = 0; face < 4; face++) {
    const ids = [0, 1, 2, 3].filter(i => i !== face), centre = mul(VERTICES[face], -1 / 3);
    const inner = ids.map(i => add(centre, mul(sub(VERTICES[i], centre), 0.4)));
    append(pieces[face + 4], inner, face);
    ids.forEach((id, j) => {
      const A = VERTICES[id], B = VERTICES[ids[(j + 1) % 3]], C = VERTICES[ids[(j + 2) % 3]];
      const a = inner[j], b = inner[(j + 1) % 3], c = inner[(j + 2) % 3];
      append(pieces[id], [A, midpoint(A, B), midpoint(a, b), a, midpoint(a, c), midpoint(A, C)], face);
    });
  }
  return pieces;
}

function projectionGap(a: Solid, b: Solid, axis: V): number {
  let amin = Infinity, amax = -Infinity, bmin = Infinity, bmax = -Infinity;
  for (const p of a.vertices) { const d = dot(p, axis); amin = Math.min(amin, d); amax = Math.max(amax, d); }
  for (const p of b.vertices) { const d = dot(p, axis); bmin = Math.min(bmin, d); bmax = Math.max(bmax, d); }
  return Math.max(bmin - amax, amin - bmax);
}

/** Positive = a separating interval; negative = strict solid intersection.
 * Once a gap exceeds the existing global minimum, further axes cannot lower it. */
function separation(a: Solid, b: Solid, cutoff = Infinity): number {
  let gap = -Infinity;
  for (let i = 0; i < 3; i++) {
    gap = Math.max(gap, b.bounds[i][0] - a.bounds[i][1], a.bounds[i][0] - b.bounds[i][1]);
    if (gap > EPS && gap >= cutoff) return gap;
  }
  for (const axis of [...a.normals, ...b.normals]) {
    gap = Math.max(gap, projectionGap(a, b, axis));
    if (gap > EPS && gap >= cutoff) return gap;
  }
  for (const ae of a.edges) for (const be of b.edges) {
    const axis = cross(ae, be);
    if (length(axis) < 1e-9) continue;
    gap = Math.max(gap, projectionGap(a, b, unit(axis)));
    if (gap > EPS && gap >= cutoff) return gap;
  }
  return gap;
}

function rotated(s: Solid, axis: V, angle: number): Solid {
  const vertices = s.vertices.map(p => rotate(p, axis, angle));
  return { ...s, vertices, bounds: bounds(vertices), normals: s.normals.map(p => rotate(p, axis, angle)), edges: s.edges.map(p => rotate(p, axis, angle)) };
}

function inside(point: P, polygon: P[]): boolean {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j], e = sub2(b, a), d = sub2(point, a);
    const t = (d[0] * e[0] + d[1] * e[1]) / (e[0] ** 2 + e[1] ** 2);
    if (t >= -MESH_EPS && t <= 1 + MESH_EPS && Math.hypot(d[0] - t * e[0], d[1] - t * e[1]) < MESH_EPS) return true;
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
}

/** Split at every boundary crossing, so testing endpoints alone cannot miss a notch. */
function segmentInside(a: P, b: P, polygon: P[]): boolean {
  const direction = sub2(b, a), cuts = [0, 1];
  for (let i = 0; i < polygon.length; i++) {
    const c = polygon[i], d = polygon[(i + 1) % polygon.length], edge = sub2(d, c), denominator = cross2(direction, edge);
    if (Math.abs(denominator) < 1e-12) continue;
    const offset = sub2(c, a), t = cross2(offset, edge) / denominator, s = cross2(offset, direction) / denominator;
    if (t > 0 && t < 1 && s >= 0 && s <= 1) cuts.push(t);
  }
  cuts.sort((x, y) => x - y);
  return cuts.every((t, i) => {
    const u = i ? (t + cuts[i - 1]) / 2 : t;
    return inside([a[0] + direction[0] * u, a[1] + direction[1] * u], polygon);
  });
}

function vertexKey(p: V): string { return p.map(x => Math.round(x * 1e6)).join(','); }
function meshVertices(mesh: Mesh): V[] {
  const p = mesh.geometry.getAttribute('position');
  return Array.from({ length: p.count }, (_, i): V => [p.getX(i) / DUO_A, p.getY(i) / DUO_A, p.getZ(i) / DUO_A]);
}

function verifyMesh(mesh: Mesh, patch: Patch): { triangles: number; points: Map<string, V> } {
  const vertices = meshVertices(mesh), edges = new Map<string, number>(), points = new Map(vertices.map(p => [vertexKey(p), p]));
  const normal = mul(VERTICES[patch.face], -1 / Math.sqrt(3));
  const origin = patch.polygon[0], u = unit(sub(patch.polygon[1], origin)), v = cross(normal, u);
  const flat = (p: V): P => [dot(sub(p, origin), u), dot(sub(p, origin), v)];
  const polygon = patch.polygon.map(flat);
  const projected = vertices.map(p => {
    if (patch.layer === 'body') {
      const radial = -dot(VERTICES[patch.face], p);
      assert.ok(radial >= 1 - Math.sqrt(3) * ENVELOPE.bodyDepth - MESH_EPS && radial <= 1 + MESH_EPS, 'Body exceeds the certified radial thickness');
      return flat(mul(p, 1 / radial));
    }
    const elevation = dot(normal, p) - 1 / Math.sqrt(3);
    assert.ok(elevation >= ENVELOPE.lift - MESH_EPS && elevation <= ENVELOPE.lift + ENVELOPE.stickerDepth + MESH_EPS, 'Sticker exceeds the certified normal thickness');
    return flat(sub(p, mul(normal, elevation)));
  });
  assert.ok(projected.every(p => inside(p, polygon)), `Rendered ${patch.layer} vertex is outside its independent envelope`);
  for (let i = 0; i < vertices.length; i += 3) {
    for (const [a, b] of [[i, i + 1], [i + 1, i + 2], [i + 2, i]]) {
      assert.ok(segmentInside(projected[a], projected[b], polygon), 'A rendered triangle crosses the approved concave notch');
      const key = [vertexKey(vertices[a]), vertexKey(vertices[b])].sort().join('|');
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  assert.ok([...edges.values()].every(count => count === 2), `Rendered ${patch.layer} is not a closed triangle mesh`);
  // The actual extrusion outline must itself be simple. Reversing offset/round
  // order can create tiny loops even when a triangulator happens to hide them.
  const shape = (mesh.geometry as ExtrudeGeometry).parameters.shapes;
  assert.ok(!Array.isArray(shape));
  const outline = shape.getPoints().map(p => [p.x / DUO_A, p.y / DUO_A] as P);
  for (let i = 0; i < outline.length; i++) for (let j = i + 2; j < outline.length; j++) {
    if (i === 0 && j === outline.length - 1) continue;
    const a = outline[i], b = outline[(i + 1) % outline.length], c = outline[j], d = outline[(j + 1) % outline.length];
    const ab = sub2(b, a), cd = sub2(d, c), denominator = cross2(ab, cd);
    if (Math.abs(denominator) < 1e-12) continue;
    const ac = sub2(c, a), t = cross2(ac, cd) / denominator, s = cross2(ac, ab) / denominator;
    assert.ok(!(t > EPS && t < 1 - EPS && s > EPS && s < 1 - EPS), `Rendered ${patch.layer} outline self-intersects`);
  }
  return { triangles: vertices.length / 3, points };
}

function verifyRenderedMeshes(pieces: Piece[]) {
  let meshes = 0, triangles = 0, connectedCornerPairs = 0;
  for (const piece of pieces) {
    const actual = buildDuoPiece(piece.kind, piece.id), bodyPoints: Map<string, V>[] = [];
    assert.equal(actual.group.children.length, piece.kind === 'corner' ? 6 : 2);
    for (let i = 0; i < actual.group.children.length; i += 2) {
      const body = actual.group.children[i] as Mesh, sticker = actual.group.children[i + 1] as Mesh;
      const face = sticker.userData.duoFace as number;
      assert.equal(body.userData.simRole, 'body');
      assert.equal(sticker.userData.simRole, 'sticker');
      assert.ok(Array.isArray(sticker.material));
      assert.equal(sticker.material[1], body.material, 'Sticker side walls must use the same black body material');
      for (const [mesh, layer] of [[body, 'body'], [sticker, 'sticker']] as const) {
        const patch = piece.patches.find(p => p.face === face && p.layer === layer);
        assert.ok(patch, 'Engine face/piece placement differs from the independent partition');
        const result = verifyMesh(mesh, patch);
        meshes++; triangles += result.triangles;
        if (layer === 'body') bodyPoints.push(result.points);
      }
    }
    // Adjacent faces of a corner share a positive-area radial wall. This catches
    // accidentally insetting the two exterior tetrahedron edges as cut seams.
    for (let i = 0; i < bodyPoints.length; i++) for (let j = i + 1; j < bodyPoints.length; j++) {
      // A quantized hash can split near-identical Float32 points across a bin
      // boundary. Use an actual distance for independently transformed faces.
      const shared = [...bodyPoints[i].values()].filter(p => [...bodyPoints[j].values()].some(q => length(sub(p, q)) < MESH_EPS));
      assert.ok(shared.length >= 4, 'The three corner panels are disconnected');
      assert.ok(shared.some(a => shared.some(b => length(cross(sub(a, shared[0]), sub(b, shared[0]))) > 1e-5)), 'Corner panels share no finite-area wall');
      connectedCornerPairs++;
    }
    actual.group.traverse(obj => { const mesh = obj as Mesh; if (mesh.isMesh) { mesh.geometry.dispose(); for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose(); } });
  }
  const core = buildDuoCore(), coreRadius = Math.max(...meshVertices(core).map(length));
  const shellInnerRadius = 1 / Math.sqrt(3) - ENVELOPE.bodyDepth;
  assert.ok(coreRadius + NUMERIC_GUARD < shellInnerRadius, 'The core sphere enters a rotating display shell');
  core.geometry.dispose();
  return { meshes, triangles, connectedCornerPairs, coreRadius, shellInnerRadius };
}

function verifyTurns(pieces: Piece[]) {
  const reports = [];
  for (let axisId = 0; axisId < 4; axisId++) for (const sign of [1, -1]) {
    const axis = unit(VERTICES[axisId]);
    const moving = pieces.filter(p => p.kind === 'corner' ? p.id === axisId : p.id !== axisId);
    const fixed = pieces.filter(p => !moving.includes(p));
    let radius = 0;
    for (const p of moving) for (const s of p.solids) for (const v of s.vertices) radius = Math.max(radius, Math.sqrt(Math.max(0, dot(v, v) - dot(v, axis) ** 2)));
    let closest = { gap: Infinity, degrees: 0, moving: '', stationary: '', movingLayer: '' as Layer | '', staticLayer: '' as Layer | '' };
    for (let degrees = 0; degrees <= 120; degrees += STEP_DEGREES) {
      const angle = degrees * sign * Math.PI / 180;
      for (const mp of moving) {
        const solids = mp.solids.map(s => rotated(s, axis, angle));
        for (const fp of fixed) for (const a of solids) for (const b of fp.solids) {
          const gap = separation(a, b, Math.max(0, closest.gap));
          assert.ok(gap > 0, `Solid intersection: axis ${axisId}, ${degrees * sign} degrees, ${mp.name}/${fp.name}`);
          if (gap < closest.gap) closest = { gap, degrees, moving: mp.name, stationary: fp.name, movingLayer: a.layer, staticLayer: b.layer };
        }
      }
    }
    // Every angle is at most half a sample step from a checked pose. Any point
    // moves by at most 2*r*sin(delta/2), including points inside each convex cell.
    const intervalDisplacement = 2 * radius * Math.sin(STEP_DEGREES * Math.PI / 720);
    const continuousLowerBound = closest.gap - intervalDisplacement - NUMERIC_GUARD;
    assert.ok(continuousLowerBound > 0, 'Samples alone do not certify the interval between poses');
    reports.push({ axis: axisId, sign, closest, maximumAxisRadius: radius, intervalDisplacement, continuousLowerBound });
  }
  return reports;
}

// A no-gap shell is a known invalid construction. This non-vacuity check must
// find an actual positive-volume collision using the same independent SAT oracle.
function verifyNegativeControl() {
  const pieces = buildEnvelopes(0), axis = unit(VERTICES[0]);
  const movingCentre = pieces[7].solids.filter(s => s.layer === 'body').map(s => rotated(s, axis, 40 * Math.PI / 180));
  const fixedCorner = pieces[2].solids.filter(s => s.layer === 'body');
  const overlap = Math.min(...movingCentre.flatMap(a => fixedCorner.map(b => separation(a, b))));
  assert.ok(overlap < -0.001, 'Negative control did not detect the known no-gap shell collision');
  return overlap;
}

assert.deepEqual(DUO_SHELL, { bodyInset: 0.03, bodyDepth: 0.01, bodyRound: 0.02, stickerInset: 0.04, stickerRound: 0.025, stickerLift: 0.001, stickerDepth: 0.006 }, 'Shell dimensions changed: independently recertify the envelope');
const pieces = buildEnvelopes();
const rendered = verifyRenderedMeshes(pieces);
const negativeControl = verifyNegativeControl();
const turns = verifyTurns(pieces);
console.log(JSON.stringify({ status: 'passed', normalizedVertexScale: 1, stepDegrees: STEP_DEGREES, envelope: ENVELOPE, rendered, negativeControl, minimumContinuousSeparation: Math.min(...turns.map(t => t.continuousLowerBound)), turns }, null, 2));
