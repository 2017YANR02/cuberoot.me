import { Group, Matrix4, Mesh, MeshBasicMaterial, Shape, ShapeGeometry, Vector3 } from 'three';
import type Cube from '@/app/[lang]/sim/engine/nxn/cube';
import type Cubelet from '@cuberoot/puzzle-render-core/engine/nxn/cubelet';
import { TwistAction } from '@cuberoot/puzzle-render-core/engine/nxn/twister';
import { SIZE } from '@cuberoot/puzzle-render-core/engine/define';

/** Surface chevrons use the engine's own layer and turn-direction conversion. */
export function attachMoveHintArrows(cube: Cube, move: string, accent: string, secondary?: string): (() => void) & { update: (elapsedMs?: number) => boolean } {
  const rotations = cube.table.convert(new TwistAction(move));
  const first = rotations[0];
  if (!first || !['x', 'y', 'z'].includes(first.group.axis)) return Object.assign(() => {}, { update: () => false });
  const axis = first.group.axis as 'x' | 'y' | 'z';
  const angular = new Vector3();
  angular[axis] = -Math.sign(first.twist);
  const layers = new Set(rotations.map(rotation => rotation.group.layer));
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
  const attached: { arrow: Mesh; cubelet: Cubelet; local: Matrix4; phase: number; colored: boolean }[] = [];
  for (let x = 0; x < cube.order; x++) for (let y = 0; y < cube.order; y++) for (let z = 0; z < cube.order; z++) {
    const coords = { x, y, z };
    if (!layers.has(coords[axis])) continue;
    const cubelet = cube.cubelets.get(x + y * cube.order + z * cube.order * cube.order);
    if (!cubelet) continue;
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
        attached.push({ arrow: chevron, cubelet, local: cubelet.matrix.clone().invert().multiply(chevron.matrix), phase, colored: material === ink });
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
  const matrix = new Matrix4();

  return Object.assign(dispose, { update: (elapsedMs = 0) => {
    let changed = false;
    const active = Object.values(cube.table.groups).flat().filter(slice => slice.cubelets.length > 0);
    const turning = active.length > 0 || cube.twister.backlog > 0;
    if (group.visible === turning) { group.visible = !turning; changed = true; }
    for (const { arrow, cubelet, local, phase, colored } of attached) {
      if (secondary && colored && !turning) {
        const tick = Math.floor(elapsedMs / 750) * Math.sign(angular[axis]);
        const material = ((phase - tick) % 2 + 2) % 2 === 0 ? ink : secondaryInk;
        if (arrow.material !== material) { arrow.material = material; changed = true; }
      }
      matrix.multiplyMatrices(cubelet.matrix, local);
      const slice = active.find(slice => slice.cubelets.includes(cubelet));
      if (slice) matrix.premultiply(slice.matrix);
      if (arrow.matrix.equals(matrix)) continue;
      arrow.matrix.copy(matrix);
      arrow.matrixWorldNeedsUpdate = true;
      changed = true;
    }
    return !!secondary || changed;
  } });
}
