/** Offline hand-motion validation. Never used in the render loop. */
import * as THREE from 'three';
import type { FingerName, HandModel } from './handModel';

export const FINGER_NAMES: readonly FingerName[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];
export interface SkinTriangle { triangle: THREE.Triangle; box: THREE.Box3 }
interface Node { box: THREE.Box3; children?: [Node, Node]; faces?: SkinTriangle[] }

/** Triangles wholly belonging to a finger exclude the shared palm/web surface.
 * Sampling includes MANO pose-corrective deformation and actual skinning.
 */
export class FingerSurfaceSampler {
  private mesh: THREE.SkinnedMesh;
  private faces = new Map<FingerName, number[][]>();
  private vertices = new Map<FingerName, { index: number; distal: boolean }[]>();
  constructor(private model: HandModel) {
    const mesh = model.meshes.find(m => (m as THREE.SkinnedMesh).isSkinnedMesh) as THREE.SkinnedMesh;
    if (!mesh) throw new Error('Hand has no skinned surface');
    this.mesh = mesh;
    const skin = mesh.geometry.getAttribute('skinIndex'), weight = mesh.geometry.getAttribute('skinWeight');
    const owners: (FingerName | undefined)[] = [];
    for (const name of FINGER_NAMES) this.vertices.set(name, []);
    for (let i = 0; i < skin.count; i++) {
      let k = 0;
      for (let j = 1; j < 4; j++) if (weight.getComponent(i, j) > weight.getComponent(i, k)) k = j;
      const bone = mesh.skeleton.bones[skin.getComponent(i, k)].name;
      const owner = FINGER_NAMES.find(name => bone.startsWith(`${name}-`));
      owners.push(owner);
      if (owner) this.vertices.get(owner)!.push({ index: i, distal: bone.includes('distal') || bone.endsWith('-tip') });
    }
    const index = mesh.geometry.index;
    if (!index) throw new Error('Hand surface must be indexed');
    for (const name of FINGER_NAMES) this.faces.set(name, []);
    for (let i = 0; i < index.count; i += 3) {
      const vertices = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
      const owner = owners[vertices[0]];
      if (owner && vertices.every(v => owners[v] === owner)) this.faces.get(owner)!.push(vertices);
    }
  }
  samplePoints(name: FingerName): { vertex: number; point: THREE.Vector3; pad: boolean }[] {
    this.model.group.updateWorldMatrix(true, false);
    this.model.group.updateMatrixWorld(true);
    const position = this.mesh.geometry.getAttribute('position');
    const toTip = this.model.fingers[name].tip.matrixWorld.clone().invert();
    return this.vertices.get(name)!.map(({ index, distal }) => {
      const point = new THREE.Vector3().fromBufferAttribute(position, index);
      this.mesh.applyBoneTransform(index, point).applyMatrix4(this.mesh.matrixWorld);
      return { vertex: index, point, pad: distal && point.clone().applyMatrix4(toTip).z >= 0 };
    });
  }
  sample(name: FingerName): SkinTriangle[] {
    this.model.group.updateWorldMatrix(true, false);
    this.model.group.updateMatrixWorld(true);
    const positions = this.mesh.geometry.getAttribute('position');
    const cache = new Map<number, THREE.Vector3>();
    const vertex = (i: number) => {
      let v = cache.get(i);
      if (!v) {
        v = new THREE.Vector3().fromBufferAttribute(positions, i);
        this.mesh.applyBoneTransform(i, v).applyMatrix4(this.mesh.matrixWorld);
        cache.set(i, v);
      }
      return v;
    };
    return this.faces.get(name)!.map(face => {
      const triangle = new THREE.Triangle(vertex(face[0]), vertex(face[1]), vertex(face[2]));
      return { triangle, box: new THREE.Box3().setFromPoints([triangle.a, triangle.b, triangle.c]) };
    });
  }
}

function tree(faces: SkinTriangle[]): Node {
  const box = new THREE.Box3();
  for (const face of faces) box.union(face.box);
  if (faces.length <= 12) return { box, faces };
  const size = box.getSize(new THREE.Vector3());
  const axis = size.x > size.y ? (size.x > size.z ? 'x' : 'z') : (size.y > size.z ? 'y' : 'z');
  const sorted = faces.slice().sort((a, b) => (a.box.min[axis] + a.box.max[axis]) - (b.box.min[axis] + b.box.max[axis]));
  const middle = Math.floor(sorted.length / 2);
  return { box, children: [tree(sorted.slice(0, middle)), tree(sorted.slice(middle))] };
}

/** Non-coplanar surface crossing, tested in both edge directions. */
export function trianglesCross(a: THREE.Triangle, b: THREE.Triangle): boolean {
  const ray = new THREE.Ray(), hit = new THREE.Vector3(), direction = new THREE.Vector3();
  for (const [source, target] of [[a, b], [b, a]]) {
    const points = [source.a, source.b, source.c];
    for (let i = 0; i < 3; i++) {
      const start = points[i], end = points[(i + 1) % 3];
      direction.subVectors(end, start);
      const length = direction.length();
      if (length < 1e-8) continue;
      ray.set(start, direction.multiplyScalar(1 / length));
      if (ray.intersectTriangle(target.a, target.b, target.c, false, hit)
        && hit.distanceTo(start) < length - 1e-7 && hit.distanceTo(start) > 1e-7) return true;
    }
  }
  return false;
}

export class FingerObstacle {
  private root: Node;
  constructor(faces: SkinTriangle[]) { this.root = tree(faces); }
  /** Signed nearest-surface distance for calibration; open web boundaries mean
   * this is a search heuristic, not a replacement for surface-crossing checks. */
  clearance(points: THREE.Vector3[], margin = .5): { minimum: number; penalty: number } {
    let minimum = Infinity, penalty = 0;
    const closest = new THREE.Vector3(), normal = new THREE.Vector3(), delta = new THREE.Vector3();
    const barycentric = new THREE.Vector3();
    for (const p of points) {
      const outside = this.root.box.distanceToPoint(p);
      if (outside > margin) { minimum = Math.min(minimum, outside); continue; }
      let distance = Infinity, signed = Infinity;
      const visit = (node: Node) => {
        if (node.box.distanceToPoint(p) > distance) return;
        if (node.children) {
          const [a, b] = node.children;
          if (a.box.distanceToPoint(p) < b.box.distanceToPoint(p)) { visit(a); visit(b); }
          else { visit(b); visit(a); }
        } else for (const { triangle } of node.faces!) {
          triangle.closestPointToPoint(p, closest);
          const d = closest.distanceTo(p);
          if (d < distance) {
            distance = d;
            triangle.getBarycoord(closest, barycentric);
            const interior = Math.min(barycentric.x, barycentric.y, barycentric.z) > 1e-6;
            signed = interior && delta.subVectors(p, closest).dot(triangle.getNormal(normal)) < 0 ? -d : d;
          }
        }
      };
      visit(this.root);
      minimum = Math.min(minimum, signed);
      penalty += Math.max(0, margin - signed) ** 2;
    }
    return { minimum, penalty: penalty / Math.max(1, points.length) };
  }
  intersections(faces: SkinTriangle[], witness?: (a: THREE.Triangle, b: THREE.Triangle) => void): number {
    let count = 0;
    const visit = (face: SkinTriangle, node: Node) => {
      if (!face.box.intersectsBox(node.box)) return;
      if (node.children) { visit(face, node.children[0]); visit(face, node.children[1]); }
      else for (const other of node.faces!) if (face.box.intersectsBox(other.box) && trianglesCross(face.triangle, other.triangle)) {
        count++;
        witness?.(face.triangle, other.triangle);
      }
    };
    for (const face of faces) visit(face, this.root);
    return count;
  }
}
