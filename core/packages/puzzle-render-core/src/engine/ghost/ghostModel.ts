/** Adam Cowan's original Ghost Cube, reconstructed from his 2009 3D PDF.
 * Evidence and independent reconstruction: client/scripts/ghost/REFERENCE.md.
 * Coordinates here use the middle layer's mechanism frame, not the outer shell.
 * The PDF supplies stickers; solid cells are the inferred intersections of planes.
 */
import * as THREE from 'three';
import { SIZE } from '../define';
import { polytopeVerts, type Plane } from '../polytopeCut';
import { polyArea2, type V2 } from '../stickerGeom';

export const GHOST_SCALE = SIZE / 19;
export const GHOST_CUT = 9.5 * GHOST_SCALE;
export const GHOST_HALF = 29 * GHOST_SCALE;
export const GHOST_LAYER_ANGLES = [87, 52, 23] as const;
const radians = THREE.MathUtils.degToRad;
const mechanism = new THREE.Matrix4().makeBasis(
  new THREE.Vector3(Math.cos(radians(52)), 0, Math.sin(radians(52))),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(-Math.sin(radians(52)), 0, Math.cos(radians(52))),
);
const toMechanism = mechanism.clone().transpose();
const sourceShell = [
  new THREE.Vector3(0.7986354924797165, 0.6018150464650089, 1.5009330714450797e-9),
  new THREE.Vector3(-0.3804722704578621, 0.504903723683713, 0.7747987359456397),
  new THREE.Vector3(0.4662855365163283, -0.618781770625671, 0.6322079711432301),
];
export const GHOST_SHELL_AXES = sourceShell.map(n => n.clone().transformDirection(toMechanism));
/** Display the solved shell upright, while retaining the skewed mechanism axes. */
export const GHOST_DISPLAY_QUATERNION = new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().makeBasis(...sourceShell as [THREE.Vector3, THREE.Vector3, THREE.Vector3])
    .transpose().multiply(mechanism),
);

export interface GhostFacet {
  face: number;
  normal: THREE.Vector3;
  u: THREE.Vector3;
  v: THREE.Vector3;
  origin: THREE.Vector3;
  raw: V2[];
  sticker: V2[];
}
export interface GhostCell {
  slot: readonly [number, number, number];
  planes: Plane[];
  vertices: THREE.Vector3[];
  facets: GhostFacet[];
}

function clip(poly: V2[], a: number, b: number, d: number): V2[] {
  const out: V2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const dp = a * p[0] + b * p[1] - d, dq = a * q[0] + b * q[1] - d;
    if (dp <= 1e-8) out.push(p);
    if ((dp < -1e-8 && dq > 1e-8) || (dp > 1e-8 && dq < -1e-8)) {
      const t = dp / (dp - dq);
      out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
    }
  }
  return out;
}

function buildCells(): GhostCell[] {
  const cells: GhostCell[] = [];
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
    const angle = radians(GHOST_LAYER_ANGLES[y + 1]);
    const axes = [new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)),
      new THREE.Vector3(0, 1, 0), new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle))]
      .map(n => n.transformDirection(toMechanism));
    const cuts: Plane[] = [];
    [x, y, z].forEach((layer, i) => {
      const n = axes[i];
      if (layer < 1) cuts.push({ n: n.toArray(), d: layer === -1 ? -GHOST_CUT : GHOST_CUT });
      if (layer > -1) cuts.push({ n: n.clone().negate().toArray(), d: layer === 1 ? -GHOST_CUT : GHOST_CUT });
    });
    const planes: Plane[] = GHOST_SHELL_AXES.flatMap(n => [
      { n: n.toArray(), d: GHOST_HALF }, { n: n.clone().negate().toArray(), d: GHOST_HALF },
    ]).concat(cuts);
    const facets: GhostFacet[] = [];
    for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
      const normal = GHOST_SHELL_AXES[axis].clone().multiplyScalar(sign);
      const u = GHOST_SHELL_AXES[(axis + 1) % 3].clone();
      const v = new THREE.Vector3().crossVectors(normal, u);
      const origin = normal.clone().multiplyScalar(GHOST_HALF);
      const polygon = (sticker: boolean): V2[] => {
        const h = GHOST_HALF - (sticker ? 0.5 * GHOST_SCALE : 0);
        let poly: V2[] = [[-h, -h], [h, -h], [h, h], [-h, h]];
        for (const plane of cuts) {
          const n = new THREE.Vector3(...plane.n), a = n.dot(u), b = n.dot(v);
          // Source inset is a cut-plane offset PLUS an in-face border, not centroid shrink.
          const inset = sticker ? GHOST_SCALE * (1 + 0.5 * Math.hypot(a, b)) : 0;
          poly = clip(poly, a, b, plane.d - n.dot(origin) - inset);
        }
        return poly.length >= 3 && polyArea2(poly) > 1e-7 ? poly : [];
      };
      const raw = polygon(false);
      if (raw.length) facets.push({ face: axis * 2 + (sign + 1) / 2, normal, u, v, origin, raw, sticker: polygon(true) });
    }
    cells.push({ slot: [x, y, z], planes, vertices: polytopeVerts(planes), facets });
  }
  return cells;
}

/** Immutable home geometry; all live state lives in piece quaternions. */
export const GHOST_CELLS: readonly GhostCell[] = buildCells();
