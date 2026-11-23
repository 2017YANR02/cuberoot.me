import { BufferGeometry, Curve, DoubleSide, DynamicDrawUsage, Float32BufferAttribute, Group, Matrix4, Mesh, MeshBasicMaterial, Shape, ShapeGeometry, Vector2, Vector3 } from 'three';
import type Cube from '@/app/[lang]/sim/engine/nxn/cube';
import { TwistAction } from '@cuberoot/puzzle-render-core/engine/nxn/twister';
import { SIZE } from '@cuberoot/puzzle-render-core/engine/define';

type MoveHint = (() => void) & { update: (elapsedMs?: number) => boolean };

const ORBIT_PERIOD_MS = 2200;
const ORBIT_EXPONENT = 2.8;
const ARROW_LENGTH = 1 / 6;
const HEAD_LENGTH = 1 / 24;

// A superellipse clears the corners while staying closer to the face centers than a circle.
class OrbitTrack extends Curve<Vector2> {
  private readonly extent: number;

  constructor(halfEdge: number) {
    super();
    this.extent = (halfEdge + SIZE * .07) * 2 ** (1 / ORBIT_EXPONENT);
  }

  override getPoint(t: number, target = new Vector2()): Vector2 {
    const angle = Math.PI / 4 + t * Math.PI * 2;
    const x = Math.cos(angle);
    const y = Math.sin(angle);
    const radius = this.extent / (Math.abs(x) ** ORBIT_EXPONENT + Math.abs(y) ** ORBIT_EXPONENT) ** (1 / ORBIT_EXPONENT);
    return target.set(x * radius, y * radius);
  }
}

function orbitArrowGeometry(track: Curve<Vector2>, halfWidth: number, direction: number, edge = 0) {
  const sections: { distance: number; width: number }[] = [];
  const indices: number[] = [];
  const edgeDistance = edge / track.getLength();
  const addSection = (distance: number, width: number) => {
    const next = sections.length * 2;
    sections.push({ distance, width });
    if (next > 0) indices.push(next - 2, next - 1, next, next - 1, next + 1, next);
  };
  const divisions = 24;
  for (let i = 0; i <= divisions; i++) {
    const progress = i / divisions;
    const distance = -ARROW_LENGTH - edgeDistance + (ARROW_LENGTH + edgeDistance - HEAD_LENGTH) * progress;
    addSection(distance, halfWidth * (.22 + .78 * progress) + edge);
  }
  addSection(-HEAD_LENGTH, halfWidth * 2.25 + edge);
  addSection(edgeDistance, 0);
  // Sampling by distance keeps both the travel speed and arrow length constant.
  const positions = new Float32BufferAttribute(new Float32Array(sections.length * 6), 3).setUsage(DynamicDrawUsage);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', positions);
  geometry.setIndex(indices);
  const point = new Vector2();
  const update = (phase: number) => {
    sections.forEach(({ distance, width }, index) => {
      track.getPointAt((1 + phase + direction * distance) % 1, point);
      positions.setXYZ(index * 2, point.x, point.y, -width);
      positions.setXYZ(index * 2 + 1, point.x, point.y, width);
    });
    positions.needsUpdate = true;
  };
  return { geometry, update };
}

function attachOrbitHint(cube: Cube, axis: 'x' | 'y' | 'z', direction: number, accent: string): MoveHint {
  const halfEdge = cube.order * SIZE / 2;
  const halfWidth = halfEdge * .075;
  const track = new OrbitTrack(halfEdge);
  const ink = orbitArrowGeometry(track, halfWidth, direction);
  const outline = orbitArrowGeometry(track, halfWidth, direction, SIZE * .018);
  const stroke = new MeshBasicMaterial({
    color: accent, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  const border = new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide });
  const group = new Group();
  const positiveAxis = new Vector3();
  positiveAxis[axis] = 1;
  group.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), positiveAxis);
  const arrow = new Mesh(ink.geometry, stroke);
  const edging = new Mesh(outline.geometry, border);
  arrow.frustumCulled = false;
  edging.frustumCulled = false;
  arrow.renderOrder = 1;
  group.add(edging, arrow);
  // Keep the resting y-rotation arrow on the front of the cube.
  const startPhase = axis === 'y' ? .625 : .23;
  let phase = startPhase;
  ink.update(phase);
  outline.update(phase);
  group.visible = cube.twister.backlog === 0;
  cube.add(group);
  return Object.assign(() => {
    cube.remove(group);
    ink.geometry.dispose();
    outline.geometry.dispose();
    stroke.dispose();
    border.dispose();
  }, {
    update: (elapsedMs = 0) => {
      const visible = cube.twister.backlog === 0;
      const nextPhase = (1 + startPhase + direction * (elapsedMs % ORBIT_PERIOD_MS) / ORBIT_PERIOD_MS) % 1;
      const moved = visible && nextPhase !== phase;
      const changed = visible !== group.visible || moved;
      group.visible = visible;
      if (moved) {
        phase = nextPhase;
        ink.update(phase);
        outline.update(phase);
      }
      return changed;
    },
  });
}

/** Move hints use the engine's own layer and turn-direction conversion. */
export function attachMoveHintArrows(cube: Cube, move: string, accent: string, secondary?: string, style?: 'orbit'): MoveHint {
  const rotations = cube.table.convert(new TwistAction(move));
  const first = rotations[0];
  if (!first || !['x', 'y', 'z'].includes(first.group.axis)) return Object.assign(() => {}, { update: () => false });
  const axis = first.group.axis as 'x' | 'y' | 'z';
  const angular = new Vector3();
  angular[axis] = -Math.sign(first.twist);
  const layers = new Set(rotations.map(rotation => rotation.group.layer));
  if (style === 'orbit' && /^[xyz]/.test(move) && layers.size === cube.order) {
    return attachOrbitHint(cube, axis, angular[axis], accent);
  }
  const half = (cube.order - 1) / 2;
  const normals = [new Vector3(1, 0, 0), new Vector3(-1, 0, 0),
    new Vector3(0, 1, 0), new Vector3(0, -1, 0), new Vector3(0, 0, 1), new Vector3(0, 0, -1)];
  const shape = new Shape();
  const points = [[-.21, -.09], [0, .12], [.21, -.09], [.14, -.16], [0, -.02], [-.14, -.16]];
  const between = (a: number[], b: number[], t: number) => [
    (a[0] + (b[0] - a[0]) * t) * SIZE, (a[1] + (b[1] - a[1]) * t) * SIZE,
  ] as const;
  shape.moveTo(...between(points.at(-1)!, points[0], .8));
  points.forEach((point, index) => {
    shape.lineTo(...between(points[(index + points.length - 1) % points.length], point, .8));
    const end = between(point, points[(index + 1) % points.length], .2);
    shape.quadraticCurveTo(point[0] * SIZE, point[1] * SIZE, ...end);
  });
  shape.closePath();
  const geometry = new ShapeGeometry(shape);
  // Read the site's accent token at the host; white edging stays legible on every sticker.
  const outline = new MeshBasicMaterial({ color: 0xffffff });
  const ink = new MeshBasicMaterial({ color: accent });
  const secondaryInk = new MeshBasicMaterial({ color: secondary ?? accent });
  const group = new Group();
  group.visible = cube.twister.backlog === 0;
  const coloredArrows: { arrow: Mesh; phase: number }[] = [];
  // A hint marks layer positions. The stickers occupying them can change during the previous turn.
  for (let x = 0; x < cube.order; x++) for (let y = 0; y < cube.order; y++) for (let z = 0; z < cube.order; z++) {
    const coords = { x, y, z };
    if (!layers.has(coords[axis])) continue;
    // Whole-cube turns use a single central band rather than covering every sticker.
    if (layers.size === cube.order && coords[axis] !== Math.floor(half)) continue;
    for (const normal of normals) {
      if (normal[axis] !== 0) continue;
      const faceAxis = normal.x ? 'x' : normal.y ? 'y' : 'z';
      if (coords[faceAxis] !== (normal[faceAxis] > 0 ? cube.order - 1 : 0)) continue;
      const position = new Vector3(x - half, y - half, z - half).multiplyScalar(SIZE);
      position[faceAxis] = normal[faceAxis] * (cube.order * SIZE / 2 + 5);
      const tangent = angular.clone().cross(position);
      tangent.addScaledVector(normal, -tangent.dot(normal)).normalize();
      const right = tangent.clone().cross(normal).normalize();
      const basis = new Matrix4().makeBasis(right, tangent, normal);
      const angle = axis === 'x' ? Math.atan2(position.z, position.y) : axis === 'y' ? Math.atan2(position.x, position.z) : Math.atan2(position.y, position.x);
      const phase = Math.round(angle / (2 * Math.PI) * 4 * cube.order);
      for (const [material, scale, offset] of [[outline, 1.2, 0], [ink, .85, .6]] as const) {
        const chevron = new Mesh(geometry, material);
        chevron.position.copy(position).addScaledVector(normal, offset);
        chevron.setRotationFromMatrix(basis);
        chevron.scale.setScalar(scale);
        chevron.updateMatrix();
        chevron.matrixAutoUpdate = false;
        if (material === ink) coloredArrows.push({ arrow: chevron, phase });
        group.add(chevron);
      }
    }
  }
  group.updateMatrix();
  cube.add(group);
  const dispose = () => {
    cube.remove(group);
    geometry.dispose();
    outline.dispose();
    ink.dispose();
    secondaryInk.dispose();
  };
  return Object.assign(dispose, { update: (elapsedMs = 0) => {
    let changed = false;
    const turning = cube.twister.backlog > 0;
    if (group.visible === turning) { group.visible = !turning; changed = true; }
    if (secondary && !turning) {
      const tick = Math.floor(elapsedMs / 750) * Math.sign(angular[axis]);
      for (const { arrow, phase } of coloredArrows) {
        const material = ((phase - tick) % 2 + 2) % 2 === 0 ? ink : secondaryInk;
        if (arrow.material !== material) { arrow.material = material; changed = true; }
      }
    }
    return !!secondary || changed;
  } });
}
