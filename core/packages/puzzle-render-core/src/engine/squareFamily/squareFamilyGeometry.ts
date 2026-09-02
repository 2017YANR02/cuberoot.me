/** Three.js geometry for the equal-sector Square-2 / Square-4 family. */
import * as THREE from 'three';
import { STICKER_GAP_DEFAULT } from '../define';
import { extrudeOntoFace, makeSticker, offsetInward, type V2 } from '../stickerGeom';
import { SQ1_COLORS } from '../sq1/sq1Colors';
import type { SquareFamilySpec } from './squareFamilyState';

export const SQUARE_FAMILY_HALF_SIDE = 137.5;
export const SQUARE_FAMILY_LAYER_HEIGHT = 100;
export const SQUARE_FAMILY_MIDDLE_HEIGHT = 75;
export const SQUARE_FAMILY_HALF_MIDDLE = SQUARE_FAMILY_MIDDLE_HEIGHT / 2;

const BODY_MATERIAL = () => new THREE.MeshPhongMaterial({
  color: SQ1_COLORS.BODY,
  side: THREE.DoubleSide,
});
const STICKER_MATERIAL = (color: number) => new THREE.MeshPhongMaterial({
  color,
  side: THREE.DoubleSide,
});
const STICKER_LIFT = 0.6;
const STICKER_DEPTH = 2;
const TOP_INSET = 5;
const SIDE_INSET = 4;
/** 伴图默认 inset 下,每张侧贴纸也从每条边退让 SIDE_INSET 世界单位。 */
const SIDE_SCHEMATIC_INSET_BASIS = SIDE_INSET * 2 / STICKER_GAP_DEFAULT;

export interface UniformPieceBuild {
  pivot: THREE.Object3D;
  probe: THREE.Vector3;
}

export interface UniformMiddleBuild {
  pivot: THREE.Object3D;
  side: 1 | -1;
}

function polygonArea(poly: V2[]): number {
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area / 2;
}

function ccw(poly: V2[]): V2[] {
  return polygonArea(poly) >= 0 ? poly : poly.slice().reverse();
}

/** A y-axis prism. Polygon coordinates are [x,z], CCW when viewed in x/z space. */
function prismGeometry(polyInput: V2[], y0Input: number, y1Input: number, sticker = false): THREE.BufferGeometry {
  const poly = ccw(polyInput);
  const y0 = Math.min(y0Input, y1Input);
  const y1 = Math.max(y0Input, y1Input);
  const positions: number[] = [];
  for (const [x, z] of poly) positions.push(x, y0, z);
  for (const [x, z] of poly) positions.push(x, y1, z);
  const n = poly.length;
  const indices: number[] = [];
  // bottom (-Y), then top (+Y)
  for (let i = 1; i < n - 1; i++) indices.push(0, i, i + 1);
  for (let i = 1; i < n - 1; i++) indices.push(n, n + i + 1, n + i);
  const capsCount = indices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    indices.push(i, n + i, n + j, i, n + j, j);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.clearGroups();
  if (sticker) {
    geometry.addGroup(0, capsCount, 0);
    geometry.addGroup(capsCount, indices.length - capsCount, 1);
  } else {
    geometry.addGroup(0, indices.length, 0);
  }
  return geometry;
}

function squareRay(angle: number): V2 {
  const x = Math.cos(angle);
  const z = Math.sin(angle);
  const radius = SQUARE_FAMILY_HALF_SIDE / Math.max(Math.abs(x), Math.abs(z));
  return [x * radius, z * radius];
}

/** Slot polygons are indexed so top -unit and bottom +unit both move k -> k+unit. */
export function squareFamilySlotPolygon(
  slot: number,
  isTop: boolean,
  spec: SquareFamilySpec,
): V2[] {
  const n = spec.slotsPerLayer;
  const half = n / 2;
  const axis = spec.sliceAxisAngle;
  let low: number;
  let high: number;
  if (isTop) {
    high = axis + Math.PI / 2 - (slot - half) * spec.unitRadians;
    low = high - spec.unitRadians;
  } else {
    low = axis - Math.PI / 2 + slot * spec.unitRadians;
    high = low + spec.unitRadians;
  }
  return ccw([[0, 0], squareRay(low), squareRay(high)]);
}

function sideForOuterEdge(a: V2, b: V2): { normal: THREE.Vector3; color: number } | null {
  const w = SQUARE_FAMILY_HALF_SIDE;
  const eps = 1e-5;
  if (Math.abs(a[0] - w) < eps && Math.abs(b[0] - w) < eps) {
    return { normal: new THREE.Vector3(1, 0, 0), color: SQ1_COLORS.R };
  }
  if (Math.abs(a[0] + w) < eps && Math.abs(b[0] + w) < eps) {
    return { normal: new THREE.Vector3(-1, 0, 0), color: SQ1_COLORS.L };
  }
  if (Math.abs(a[1] - w) < eps && Math.abs(b[1] - w) < eps) {
    return { normal: new THREE.Vector3(0, 0, 1), color: SQ1_COLORS.F };
  }
  if (Math.abs(a[1] + w) < eps && Math.abs(b[1] + w) < eps) {
    return { normal: new THREE.Vector3(0, 0, -1), color: SQ1_COLORS.B };
  }
  return null;
}

function schematic(
  mesh: THREE.Mesh,
  points: readonly THREE.Vector3[],
  outwardNormal: THREE.Vector3,
): void {
  const edgeA = new THREE.Vector3().subVectors(points[1], points[0]);
  const edgeB = new THREE.Vector3().subVectors(points[2], points[0]);
  const ordered = edgeA.cross(edgeB).dot(outwardNormal) >= 0
    ? points
    : points.slice().reverse();
  mesh.userData.schematicPoly = ordered.flatMap((point) => [point.x, point.y, point.z]);
  mesh.userData.schematicInParent = true;
}

function addHorizontalSticker(
  pivot: THREE.Object3D,
  poly: V2[],
  y: number,
  isTop: boolean,
  key: string,
  bodyMaterial: THREE.Material,
): void {
  const inset = offsetInward(ccw(poly), TOP_INSET);
  const normal = new THREE.Vector3(0, isTop ? 1 : -1, 0);
  const u = new THREE.Vector3(1, 0, 0);
  const v = isTop ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 0, 1);
  const coords = inset.map(([x, z]): V2 => [x, isTop ? -z : z]);
  if (polygonArea(coords) < 0) coords.reverse();
  const geometry = extrudeOntoFace(coords, {
    u,
    v,
    n: normal,
    origin: new THREE.Vector3(0, y + normal.y * STICKER_LIFT, 0),
  }, STICKER_DEPTH);
  const sticker = makeSticker(
    geometry,
    STICKER_MATERIAL(isTop ? SQ1_COLORS.U : SQ1_COLORS.D),
    bodyMaterial,
    { stickerKey: key, simStickerNormal: normal },
  );
  schematic(sticker, poly.map(([x, z]) => new THREE.Vector3(x, y, z)), normal);
  pivot.add(sticker);
}

function addVerticalSticker(
  pivot: THREE.Object3D,
  a: V2,
  b: V2,
  y0: number,
  y1: number,
  key: string,
  bodyMaterial: THREE.Material,
): void {
  const side = sideForOuterEdge(a, b);
  if (!side) return;
  const p0 = new THREE.Vector3(a[0], 0, a[1]);
  const p1 = new THREE.Vector3(b[0], 0, b[1]);
  const center = p0.clone().add(p1).multiplyScalar(0.5);
  const width = Math.max(1, p0.distanceTo(p1) - SIDE_INSET * 2);
  const height = Math.max(1, Math.abs(y1 - y0) - SIDE_INSET * 2);
  const u = new THREE.Vector3(0, 1, 0).cross(side.normal).normalize();
  const v = new THREE.Vector3(0, 1, 0);
  const outline: V2[] = [
    [-width / 2, -height / 2],
    [width / 2, -height / 2],
    [width / 2, height / 2],
    [-width / 2, height / 2],
  ];
  const geometry = extrudeOntoFace(outline, {
    u,
    v,
    n: side.normal,
    origin: center
      .add(new THREE.Vector3(0, (y0 + y1) / 2, 0))
      .addScaledVector(side.normal, STICKER_LIFT),
  }, STICKER_DEPTH);
  const sticker = makeSticker(geometry, STICKER_MATERIAL(side.color), bodyMaterial, {
    stickerKey: key,
    simStickerNormal: side.normal.clone(),
  });
  schematic(sticker, [
    new THREE.Vector3(a[0], y0, a[1]),
    new THREE.Vector3(b[0], y0, b[1]),
    new THREE.Vector3(b[0], y1, b[1]),
    new THREE.Vector3(a[0], y1, a[1]),
  ], side.normal);
  sticker.userData.schematicInsetBasis = SIDE_SCHEMATIC_INSET_BASIS;
  pivot.add(sticker);
}

export function buildUniformSquarePiece(
  slot: number,
  isTop: boolean,
  spec: SquareFamilySpec,
): UniformPieceBuild {
  const poly = squareFamilySlotPolygon(slot, isTop, spec);
  const y0 = isTop ? SQUARE_FAMILY_HALF_MIDDLE : -SQUARE_FAMILY_HALF_MIDDLE - SQUARE_FAMILY_LAYER_HEIGHT;
  const y1 = isTop ? SQUARE_FAMILY_HALF_MIDDLE + SQUARE_FAMILY_LAYER_HEIGHT : -SQUARE_FAMILY_HALF_MIDDLE;
  const pivot = new THREE.Object3D();
  const bodyMaterial = BODY_MATERIAL();
  const body = new THREE.Mesh(prismGeometry(poly, y0, y1), bodyMaterial);
  body.userData.simRole = 'body';
  body.userData.schematicBody = true;
  pivot.add(body);
  addHorizontalSticker(pivot, poly, isTop ? y1 : y0, isTop, `${isTop ? 'U' : 'D'}${slot}`, bodyMaterial);
  addVerticalSticker(pivot, poly[1], poly[2], y0, y1, `S${isTop ? 'U' : 'D'}${slot}`, bodyMaterial);

  const probe = new THREE.Vector3(
    poly.reduce((sum, p) => sum + p[0], 0) / poly.length,
    (y0 + y1) / 2,
    poly.reduce((sum, p) => sum + p[1], 0) / poly.length,
  );
  return { pivot, probe };
}

function clipHalfSquare(axis: THREE.Vector2, keepPositive: boolean): V2[] {
  let poly: V2[] = [
    [-SQUARE_FAMILY_HALF_SIDE, -SQUARE_FAMILY_HALF_SIDE],
    [SQUARE_FAMILY_HALF_SIDE, -SQUARE_FAMILY_HALF_SIDE],
    [SQUARE_FAMILY_HALF_SIDE, SQUARE_FAMILY_HALF_SIDE],
    [-SQUARE_FAMILY_HALF_SIDE, SQUARE_FAMILY_HALF_SIDE],
  ];
  const signed = ([x, z]: V2) => (x * axis.x + z * axis.y) * (keepPositive ? 1 : -1);
  const out: V2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const da = signed(a);
    const db = signed(b);
    if (da >= 0) out.push(a);
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  poly = out;
  return ccw(poly);
}

export function buildUniformSquareMiddle(spec: SquareFamilySpec): UniformMiddleBuild[] {
  const axis = new THREE.Vector2(Math.cos(spec.sliceAxisAngle), Math.sin(spec.sliceAxisAngle));
  return ([1, -1] as const).map((side) => {
    const poly = clipHalfSquare(axis, side === 1);
    const pivot = new THREE.Object3D();
    const bodyMaterial = BODY_MATERIAL();
    const body = new THREE.Mesh(
      prismGeometry(poly, -SQUARE_FAMILY_HALF_MIDDLE, SQUARE_FAMILY_HALF_MIDDLE),
      bodyMaterial,
    );
    body.userData.simRole = 'body';
    body.userData.schematicBody = true;
    pivot.add(body);
    let stickerIndex = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      if (!sideForOuterEdge(a, b)) continue;
      addVerticalSticker(
        pivot,
        a,
        b,
        -SQUARE_FAMILY_HALF_MIDDLE,
        SQUARE_FAMILY_HALF_MIDDLE,
        `M${side === 1 ? 'P' : 'N'}${stickerIndex++}`,
        bodyMaterial,
      );
    }
    return { pivot, side };
  });
}

export { SQ1_COLORS as SQUARE_FAMILY_COLORS };
