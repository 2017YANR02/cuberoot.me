/**
 * Pyraminx Duo's eight rigid pieces. The approved face partition is canonical in
 * duo-face.ts; each face patch has a closed, finite radial shell behind it.
 * Keeping the shell shallow lets the centres pass under adjacent corner panels.
 * These are display bodies, not a model of a manufacturer's internal mechanism.
 */
import * as THREE from 'three';
import { DUO_FACE_VERTICES, DUO_VERTEX_AXES } from '@cuberoot/puzzle-solvers/pyraminx-duo';
import { DUO_FACE_COLORS, DUO_FACE_PATCHES, type DuoFacePatch } from '../../duo-face';
import { SIZE } from '../define';
import { extrudeOntoFace, makeSticker, offsetInward, roundCorners, type V2 } from '../stickerGeom';

export const DUO_A = SIZE * 1.5;
/** Dimensions in units of the tetrahedral vertex coordinates (±1). */
export const DUO_SHELL = {
  bodyInset: 0.03,
  bodyDepth: 0.01,
  bodyRound: 0.02,
  stickerInset: 0.04,
  stickerRound: 0.025,
  stickerLift: 0.001,
  stickerDepth: 0.006,
} as const;

export interface DuoPiece {
  pivot: THREE.Object3D;
  group: THREE.Group;
}

function faceBasis(face: number) {
  const vertices = DUO_FACE_VERTICES[face].map(i => new THREE.Vector3(...DUO_VERTEX_AXES[i]).multiplyScalar(DUO_A));
  const side = vertices[1].distanceTo(vertices[2]);
  const n = new THREE.Vector3(...DUO_VERTEX_AXES[face]).negate().normalize();
  const u = vertices[2].clone().sub(vertices[1]).normalize();
  const v = n.clone().cross(u);
  const origin = vertices[0].clone().addScaledVector(u, -side / 2);
  return { u, v, n, origin, side };
}

/** Parallel offsets of the real cut edges; the two outer edges of a corner patch
 * meet the same piece's adjacent faces, so those edges stay joined. */
function bodyOutline(poly: V2[], centre: boolean): V2[] {
  const normals = poly.map((p, i): V2 => {
    const q = poly[(i + 1) % poly.length];
    const length = Math.hypot(q[0] - p[0], q[1] - p[1]);
    return [-(q[1] - p[1]) / length, (q[0] - p[0]) / length];
  });
  const distance = (edge: number) => (centre || (edge !== 0 && edge !== 5) ? DUO_SHELL.bodyInset * DUO_A : 0);
  const inset = poly.map((p, i): V2 => {
    const previous = (i + poly.length - 1) % poly.length;
    const [a, b] = normals[previous], [c, d] = normals[i];
    const h1 = a * p[0] + b * p[1] + distance(previous);
    const h2 = c * p[0] + d * p[1] + distance(i);
    const determinant = a * d - b * c;
    return [(h1 * d - b * h2) / determinant, (a * h2 - h1 * c) / determinant];
  });
  return roundCorners(inset, DUO_SHELL.bodyRound * DUO_A, 26, 8);
}

/** Close a triangulated concave patch between two concentric radial surfaces.
 * ExtrudeGeometry supplies the caps, walls and triangulation; only its depth
 * coordinate is mapped radially, avoiding normal extrusions that cross at edges. */
function radialShell(outline: V2[], basis: ReturnType<typeof faceBasis>): THREE.BufferGeometry {
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, steps: 1 });
  const positions = geometry.getAttribute('position');
  const innerScale = 1 - Math.sqrt(3) * DUO_SHELL.bodyDepth;
  const point = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    const depth = positions.getZ(i);
    point.copy(basis.origin).addScaledVector(basis.u, positions.getX(i)).addScaledVector(basis.v, positions.getY(i));
    point.multiplyScalar(innerScale + depth * (1 - innerScale));
    positions.setXYZ(i, point.x, point.y, point.z);
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function addPatch(group: THREE.Group, face: number, patch: DuoFacePatch, bodyMaterial: THREE.Material): void {
  const basis = faceBasis(face);
  // Flipping the screen-space y coordinate gives an outward CCW face contour.
  const polygon: V2[] = patch.polygon.map(([x, y]) => [x * basis.side, -y * basis.side]);
  const body = new THREE.Mesh(radialShell(bodyOutline(polygon, patch.vertex === null), basis), bodyMaterial);
  body.userData.simRole = 'body';
  group.add(body);

  // Offset the six exact straight edges before rounding. Offsetting an already
  // rounded 60° apex past its fillet radius folds its outline onto itself.
  const outline = roundCorners(offsetInward(polygon, DUO_SHELL.stickerInset * DUO_A), DUO_SHELL.stickerRound * DUO_A, 26, 8);
  const lifted = { ...basis, origin: basis.origin.clone().addScaledVector(basis.n, DUO_SHELL.stickerLift * DUO_A) };
  const geometry = extrudeOntoFace(outline, lifted, DUO_SHELL.stickerDepth * DUO_A);
  const material = new THREE.MeshPhongMaterial({ color: DUO_FACE_COLORS[face], specular: 0x333333, shininess: 35 });
  // Preserve the concave boundary order. Sorting points around a centroid changes
  // these chevrons and would make the schematic disagree with the real stickers.
  const schematicPoly = polygon.flatMap(([x, y]) => basis.origin.clone()
    .addScaledVector(basis.u, x).addScaledVector(basis.v, y)
    .addScaledVector(basis.n, (DUO_SHELL.stickerLift + DUO_SHELL.stickerDepth) * DUO_A).toArray());
  group.add(makeSticker(geometry, material, bodyMaterial, {
    simStickerNormal: basis.n.clone(),
    duoFace: face,
    duoVertex: patch.vertex === null ? null : DUO_FACE_VERTICES[face][patch.vertex],
    stickerKey: `duo:${face}:${patch.vertex ?? 'centre'}`,
    schematicPoly,
  }));
}

export function buildDuoPiece(kind: 'corner' | 'centre', id: number): DuoPiece {
  const pivot = new THREE.Object3D();
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x141414, specular: 0x222222, shininess: 25 });
  if (kind === 'centre') {
    pivot.userData.duoCentre = id;
    addPatch(group, id, DUO_FACE_PATCHES[3], bodyMaterial);
  } else {
    pivot.userData.duoCorner = id;
    for (let face = 0; face < 4; face++) {
      const vertex = DUO_FACE_VERTICES[face].indexOf(id);
      if (vertex >= 0) addPatch(group, face, DUO_FACE_PATCHES[vertex], bodyMaterial);
    }
  }
  pivot.add(group);
  return { pivot, group };
}

export function buildDuoCore(): THREE.Mesh {
  // Its radius is below every shell's inner face; a concentric sphere remains
  // disjoint under all rigid turns and simply darkens the narrow open seams.
  const core = new THREE.Mesh(new THREE.SphereGeometry(DUO_A * 0.54, 32, 24), new THREE.MeshBasicMaterial({ color: 0x0a0a0a }));
  core.userData.simRole = 'core';
  return core;
}
