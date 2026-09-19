import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type V = [number, number, number];
type Finish = 'paint' | 'wood' | 'fabric' | 'stone' | 'metal' | 'glaze' | 'light';
const FINISHES: Finish[] = ['paint', 'wood', 'fabric', 'stone', 'metal', 'glaze', 'light'];
// Object pigments, not page/UI colours. One residential material palette across all rooms.
const C = {
  ivory: '#ede2cf', white: '#f8f3e7', wood: '#956b48', walnut: '#60412f',
  sage: '#7d9680', teal: '#305a61', brass: '#bd945b', rose: '#bb8180',
  wine: '#783d42', ink: '#283238', clay: '#c79473', blue: '#8bb6b9',
};

/** Small deterministic, local-only surface maps; furnishings remain actual geometry. */
function surfaceMap(kind: 'wood' | 'fabric' | 'stone') {
  const size = 128, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const noise = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    const n = noise - Math.floor(noise);
    const grain = Math.sin(x * 1.8 + Math.sin(y * 0.025) * 0.8 + Math.sin(x * 0.17));
    const marble = Math.pow(Math.abs(Math.sin(x * 0.028 + y * 0.019 + Math.sin(y * 0.033) * 0.8)), 40);
    const value = kind === 'wood' ? 244 + grain * 4 + n * 5
      : kind === 'fabric' ? 224 + ((x % 4 < 2) !== (y % 4 < 2) ? 20 : 0) + n * 8
        : 251 - marble * 12 - n * 3;
    const i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = value; data[i + 3] = 255;
  }
  const map = new THREE.DataTexture(data, size, size);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.magFilter = THREE.LinearFilter; map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true; map.colorSpace = THREE.SRGBColorSpace; map.needsUpdate = true;
  return map;
}

export function createInteriorMaterials(): THREE.MeshStandardMaterial[] {
  const wood = surfaceMap('wood'), fabric = surfaceMap('fabric'), stone = surfaceMap('stone');
  return FINISHES.map((name) => {
    const map = name === 'wood' ? wood : name === 'fabric' ? fabric : name === 'stone' ? stone : null;
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true, map,
      bumpMap: map, bumpScale: name === 'fabric' ? 0.045 : name === 'wood' ? 0.018 : 0.004,
      roughness: name === 'metal' ? 0.3 : name === 'glaze' ? 0.16 : name === 'stone' ? 0.38 : name === 'fabric' ? 0.98 : 0.78,
      metalness: name === 'metal' ? 0.65 : 0,
      emissive: name === 'light' ? '#ffcc83' : '#000000',
      emissiveIntensity: name === 'light' ? 0.65 : 0,
    });
    material.name = `miniature-${name}`;
    return material;
  });
}

/** Merge by finish, so hundreds of modeled details cost seven draw calls per room. */
class Interior {
  private parts: THREE.BufferGeometry[][] = FINISHES.map(() => []);
  private shapes = {
    box: new THREE.BoxGeometry(), sphere: new THREE.SphereGeometry(1, 16, 10),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 20),
    cone: new THREE.CylinderGeometry(0.65, 1, 1, 24),
  };
  constructor(readonly walls: [boolean, boolean]) {}

  private put(source: THREE.BufferGeometry, p: V, scale: V, color: string, finish: Finish, r: V = [0, 0, 0]) {
    const g = source.index ? source.toNonIndexed() : source.clone();
    g.clearGroups();
    g.applyMatrix4(new THREE.Matrix4().compose(
      new THREE.Vector3(p[0], p[1] - 0.405, p[2]),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...scale),
    ));
    const rgb = new THREE.Color(color), colors = new Float32Array(g.getAttribute('position').count * 3);
    const pos = g.getAttribute('position');
    // Baked broad corner occlusion supplements real cast shadows, including hidden rear rooms.
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) + 0.405, x = pos.getX(i), z = pos.getZ(i);
      const nearWall = Math.exp(-Math.max(0, z + 0.43) * 16)
        + (this.walls[0] ? Math.exp(-Math.max(0, x + 0.43) * 16) : 0)
        + (this.walls[1] ? Math.exp(-Math.max(0, 0.43 - x) * 16) : 0);
      const ao = Math.max(0.62, 1 - nearWall * 0.105 - Math.exp(-Math.max(0, y) * 15) * 0.09);
      colors[i * 3] = rgb.r * ao; colors[i * 3 + 1] = rgb.g * ao; colors[i * 3 + 2] = rgb.b * ao;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.parts[FINISHES.indexOf(finish)].push(g);
  }
  box(p: V, size: V, color: string, finish: Finish = 'paint', r?: V) { this.put(this.shapes.box, p, size, color, finish, r); }
  soft(p: V, size: V, color: string, finish: Finish = 'fabric', radius = 0.015, r?: V) {
    const g = new RoundedBoxGeometry(...size, 2, radius);
    this.put(g, p, [1, 1, 1], color, finish, r); g.dispose();
  }
  blanket(p: V) {
    const g = new THREE.BoxGeometry(0.51, 0.006, 0.146, 40, 1, 12);
    const positions = g.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), z = positions.getZ(i), edge = Math.max(0, Math.abs(x) - 0.215);
      positions.setXYZ(i, Math.sign(x) * (Math.abs(x) - edge * 0.65),
        positions.getY(i) + Math.sin(x * 110 + z * 3) * 0.0025 - Math.pow(edge / 0.04, 0.65) * 0.075, z);
    }
    g.computeVertexNormals(); this.put(g, p, [1, 1, 1], C.rose, 'fabric'); g.dispose();
  }
  ball(p: V, size: V, color: string, finish: Finish = 'glaze') { this.put(this.shapes.sphere, p, size, color, finish); }
  cylinder(p: V, radius: number, height: number, color: string, finish: Finish = 'wood', r?: V) {
    this.put(this.shapes.cylinder, p, [radius, height, radius], color, finish, r);
  }
  rod(a: V, b: V, radius: number, color = C.brass, finish: Finish = 'metal') {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
    const r = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize()));
    this.cylinder(start.add(end).multiplyScalar(0.5).toArray() as V, radius, delta.length(), color, finish, [r.x, r.y, r.z]);
  }
  ring(p: V, radius: number, thickness: number, color: string, r: V = [Math.PI / 2, 0, 0], finish: Finish = 'metal') {
    const g = new THREE.TorusGeometry(radius, thickness, 6, 32);
    this.put(g, p, [1, 1, 1], color, finish, r); g.dispose();
  }
  vase(x: number, y: number, z: number, size = 1, color = C.ivory) {
    const points = [[0.022, 0], [0.037, 0.018], [0.04, 0.05], [0.02, 0.085], [0.02, 0.103], [0.015, 0.103], [0.015, 0.086]];
    const g = new THREE.LatheGeometry(points.map(([r, h]) => new THREE.Vector2(r * size, h * size)), 24);
    this.put(g, [x, y, z], [1, 1, 1], color, 'glaze'); g.dispose();
  }
  basin(p: V, size: V, color = C.white) {
    // A closed ceramic shell with a rolled rim and a genuinely recessed interior.
    const profile = [[0, 0.01], [0.58, 0.01], [0.76, 0.035], [0.9, 0.15], [0.99, 0.86],
      [1, 0.95], [0.98, 1], [0.9, 1], [0.87, 0.95], [0.83, 0.32], [0.65, 0.22], [0, 0.22]];
    const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 40);
    this.put(g, p, size, color, 'glaze'); g.dispose();
  }
  plant(x: number, y: number, z: number, size = 1) {
    this.vase(x, y, z, size, C.clay);
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4, h = (0.17 + (i % 3) * 0.035) * size;
      const dx = Math.cos(a) * 0.08 * size, dz = Math.sin(a) * 0.08 * size;
      this.rod([x, y + 0.06 * size, z], [x + dx, y + h, z + dz], 0.0025 * size, C.sage, 'paint');
      this.put(this.shapes.sphere, [x + dx, y + h, z + dz], [0.025 * size, 0.056 * size, 0.009 * size], i % 2 ? C.sage : C.teal, 'paint', [0.45, a, -0.5]);
    }
  }
  books(x: number, y: number, z: number, count: number) {
    for (let i = 0; i < count; i++) {
      const h = 0.074 + (i % 3) * 0.015, xx = x + i * 0.031;
      this.box([xx, y + h / 2, z], [0.026, h, 0.073], [C.wine, C.teal, C.ivory, C.wood, C.sage][i % 5], 'fabric');
      for (const yy of [0.012, h - 0.014]) this.box([xx, y + yy, z + 0.038], [0.021, 0.003, 0.0015], C.brass, 'metal');
    }
  }
  frame(x: number, y: number, z: number, w: number, h: number, color = C.walnut) {
    this.box([x, y, z], [w, h, 0.024], color, 'wood');
    this.box([x, y, z + 0.014], [w - 0.016, h - 0.016, 0.008], C.ivory, 'fabric');
    this.ball([x - w * 0.17, y + h * 0.17, z + 0.022], [w * 0.15, h * 0.13, 0.003], C.clay, 'paint');
    this.box([x + w * 0.13, y - h * 0.16, z + 0.023], [w * 0.38, h * 0.27, 0.004], C.teal, 'paint');
    this.box([x - w * 0.18, y - h * 0.25, z + 0.026], [w * 0.25, h * 0.13, 0.003], C.sage, 'paint');
  }
  lamp(x: number, y: number, z: number, h = 0.29, radius = 0.075) {
    this.cylinder([x, y + 0.008, z], radius * 0.65, 0.015, C.brass, 'metal');
    this.rod([x, y + 0.012, z], [x, y + h - 0.045, z], 0.006);
    this.put(this.shapes.cone, [x, y + h - 0.045, z], [radius, 0.09, radius], C.ivory, 'fabric');
    this.ring([x, y + h - 0.089, z], radius, 0.002, C.brass);
    this.ball([x, y + h - 0.082, z], [radius * 0.72, 0.006, radius * 0.72], C.ivory, 'light');
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI / 8;
      this.rod([x + Math.cos(a) * radius, y + h - 0.09, z + Math.sin(a) * radius], [x + Math.cos(a) * radius * 0.65, y + h, z + Math.sin(a) * radius * 0.65], 0.001, C.white, 'fabric');
    }
  }
  rug(x: number, z: number, w: number, d: number, color: string) {
    this.soft([x, 0.024, z], [w, 0.009, d], C.ivory, 'fabric', 0.004);
    this.box([x, 0.030, z], [w - 0.025, 0.003, d - 0.025], color, 'fabric');
    for (const side of [-1, 1]) {
      this.box([x, 0.032, z + side * (d / 2 - 0.035)], [w - 0.04, 0.002, 0.007], C.ivory, 'fabric');
      for (let i = 0; i < 22; i++) this.box([x - w / 2 + 0.015 + i * (w - 0.03) / 21, 0.024, z + side * (d / 2 + 0.006)], [0.004, 0.004, 0.015], C.ivory, 'fabric');
    }
    for (let i = -2; i <= 2; i++) for (const s of [-1, 1]) {
      this.box([x + i * w * 0.145, 0.033, z + s * d * 0.35], [0.027, 0.002, 0.027], C.ivory, 'fabric', [0, Math.PI / 4, 0]);
    }
  }
  cabinet(x: number, z: number, w: number, h: number, d: number, color: string) {
    const finish = color === C.sage ? 'paint' : 'wood';
    this.box([x, h / 2 + 0.035, z], [w, h, d], color, finish);
    this.box([x, h + 0.043, z], [w + 0.015, 0.02, d + 0.015], C.ivory, 'stone');
    const doors = Math.max(1, Math.round(w / 0.17)), dw = w / doors;
    for (let i = 0; i < doors; i++) {
      const xx = x - w / 2 + dw * (i + 0.5);
      this.box([xx, h / 2 + 0.035, z + d / 2 + 0.006], [dw - 0.009, h - 0.013, 0.012], color, 'paint');
      this.box([xx, h / 2 + 0.035, z + d / 2 + 0.013], [dw - 0.035, h - 0.047, 0.006], color, finish);
      this.rod([xx + dw * 0.25, h * 0.53, z + d / 2 + 0.023], [xx + dw * 0.25, h * 0.75, z + d / 2 + 0.023], 0.0035);
    }
    this.box([x, 0.027, z], [w - 0.025, 0.045, d - 0.02], C.walnut, 'wood');
  }
  chair(x: number, z: number, color: string, rotation = 0) {
    // Author locally and transform the newly added geometry as a unit.
    this.group([x, 0, z], rotation, () => {
      for (const xx of [-0.057, 0.057]) for (const zz of [-0.05, 0.05]) this.rod([xx * 1.12, 0.025, zz * 1.12], [xx, 0.18, zz], 0.008, C.walnut, 'wood');
      this.soft([0, 0.18, 0], [0.16, 0.045, 0.155], color);
      this.soft([0, 0.285, -0.067], [0.16, 0.18, 0.04], color, 'fabric', 0.02, [-0.12, 0, 0]);
    });
  }
  group(p: V, angle: number, draw: () => void) {
    const lengths = this.parts.map((parts) => parts.length); draw();
    const transform = new THREE.Matrix4().makeTranslation(p[0], p[1] - 0.405, p[2])
      .multiply(new THREE.Matrix4().makeRotationY(angle)).multiply(new THREE.Matrix4().makeTranslation(0, 0.405, 0));
    for (let i = 0; i < this.parts.length; i++) for (let j = lengths[i]; j < this.parts[i].length; j++) this.parts[i][j].applyMatrix4(transform);
  }
  finish() {
    const batches: THREE.BufferGeometry[] = [], indices: number[] = [];
    this.parts.forEach((parts, i) => { if (parts.length) { batches.push(mergeGeometries(parts)!); indices.push(i); } });
    const geometry = mergeGeometries(batches, true)!;
    geometry.groups.forEach((group, i) => { group.materialIndex = indices[i]; });
    for (const g of [...this.parts.flat(), ...batches, ...Object.values(this.shapes)]) g.dispose();
    return geometry;
  }
}

function architecture(b: Interior, scene: number) {
  const tiled = scene === 2 || scene === 3, basement = scene === 5;
  const wallColor = [C.ivory, '#bcc7b1', C.ivory, '#bacbc4', '#c5b6a3', '#af8e73', '#c1b4a1', '#d5bdac', '#b8c4ba'][scene];
  b.box([0, -0.02, 0], [0.936, 0.065, 0.936], C.walnut, 'wood');
  if (tiled) {
    for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) b.box([-0.4 + x * 0.114, 0.016, -0.4 + z * 0.114], [0.11, 0.012, 0.11], (x + z) % 2 ? C.ivory : scene === 2 ? C.sage : '#d2dbd5', 'stone');
  } else {
    for (let row = 0; row < 10; row++) for (let col = 0; col < 3; col++) {
      const x = -0.44 + row * 0.088, z = -0.3 + col * 0.3;
      b.box([x + 0.044, 0.014, z], [0.084, 0.012, 0.296], [C.wood, '#a47c56', '#ad8760', '#8f684b'][(row * 3 + col) % 4], 'wood');
    }
  }
  const wall = (x: number, z: number, angle: number) => b.group([x, 0, z], angle, () => {
    b.box([0, 0.414, 0], [0.936, 0.814, 0.028], wallColor);
    if (basement) {
      for (let row = 0; row < 10; row++) for (let col = 0; col < 7; col++) {
        const xx = -0.396 + col * 0.132 + (row % 2) * 0.025;
        b.box([xx, 0.055 + row * 0.072, 0.017], [0.125, 0.065, 0.009], ['#ae8b70', '#bd9b7e', '#a8876c'][(row + col) % 3]);
      }
    } else {
      b.box([0, 0.13, 0.02], [0.914, 0.24, 0.018], scene === 4 ? C.teal : wallColor);
      for (let i = 0; i < 5; i++) {
        const xx = -0.36 + i * 0.18;
        for (const dx of [-0.071, 0.071]) b.box([xx + dx, 0.135, 0.034], [0.005, 0.17, 0.006], C.ivory);
        for (const yy of [0.05, 0.22]) b.box([xx, yy, 0.034], [0.145, 0.005, 0.006], C.ivory);
      }
      b.box([0, 0.268, 0.03], [0.918, 0.018, 0.032], C.ivory);
    }
    b.box([0, 0.041, 0.03], [0.923, 0.038, 0.035], C.ivory);
    for (let i = 0; i < 3; i++) b.box([0, 0.775 + i * 0.015, 0.018 + i * 0.006], [0.936, 0.016, 0.04 + i * 0.01], C.ivory);
  });
  wall(0, -0.447, 0);
  // Architectural cutaway: keep the rear return and low front wall, exposing furniture.
  for (const [i, sign] of [[0, -1], [1, 1]]) if (b.walls[i]) {
    b.box([sign * 0.447, 0.414, -0.337], [0.028, 0.814, 0.22], wallColor);
    b.box([sign * 0.447, 0.117, 0.11], [0.028, 0.22, 0.674], wallColor);
    b.box([sign * 0.447, 0.234, 0.11], [0.042, 0.02, 0.674], C.ivory);
    b.box([sign * 0.429, 0.041, 0.11], [0.016, 0.038, 0.674], C.ivory);
    for (let j = 0; j < 4; j++) {
      const z = -0.14 + j * 0.16;
      for (const dz of [-0.062, 0.062]) b.box([sign * 0.427, 0.13, z + dz], [0.006, 0.12, 0.005], C.ivory);
      for (const y of [0.07, 0.19]) b.box([sign * 0.427, y, z], [0.006, 0.005, 0.13], C.ivory);
    }
  }
  // Slender architectural cutaway edges, not the previous black wire cages.
  for (const x of [-0.45, 0.45]) for (const z of [-0.45, 0.45]) {
    b.box([x, 0.413, z], [0.025, 0.84, 0.025], C.ivory);
    b.box([x, 0.067, z], [0.034, 0.11, 0.034], C.ivory);
  }
  for (const sign of [-1, 1]) {
    b.box([sign * 0.45, 0.82, 0], [0.025, 0.03, 0.925], C.ivory);
  }
  b.box([0, 0.82, -0.45], [0.925, 0.03, 0.025], C.ivory);
  b.box([0, 0.019, 0.453], [0.936, 0.035, 0.027], C.ivory);
}

function sofa(b: Interior, x: number, z: number, width: number, color: string) {
  for (const xx of [-1, 1]) for (const zz of [-1, 1]) b.cylinder([x + xx * (width / 2 - 0.05), 0.058, z + zz * 0.085], 0.012, 0.075, C.walnut);
  b.soft([x, 0.11, z], [width, 0.09, 0.25], color);
  b.soft([x, 0.25, z - 0.1], [width - 0.04, 0.24, 0.072], color, 'fabric', 0.028, [-0.1, 0, 0]);
  for (const s of [-1, 1]) b.soft([x + s * (width / 2 - 0.03), 0.2, z], [0.073, 0.18, 0.265], color, 'fabric', 0.025);
  for (let i = 0; i < 3; i++) b.soft([x - width * 0.27 + i * width * 0.27, 0.174, z + 0.023], [width * 0.265, 0.07, 0.18], color, 'fabric', 0.018);
  for (let i = 0; i < 5; i++) b.ball([x - width * 0.32 + i * width * 0.16, 0.291, z - 0.059], [0.0035, 0.0035, 0.002], C.walnut, 'fabric');
  b.soft([x - width * 0.27, 0.27, z - 0.045], [0.105, 0.105, 0.04], C.ivory, 'fabric', 0.018, [-0.2, 0.15, 0.2]);
  b.soft([x + width * 0.26, 0.267, z - 0.05], [0.105, 0.108, 0.04], C.rose, 'fabric', 0.017, [-0.2, -0.15, -0.22]);
}

function living(b: Interior) {
  b.rug(0, 0.07, 0.67, 0.59, C.teal);
  sofa(b, -0.025, -0.21, 0.55, C.ivory);
  b.frame(-0.025, 0.56, -0.417, 0.35, 0.255);
  b.cylinder([0.01, 0.165, 0.14], 0.152, 0.024, C.walnut);
  for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; b.rod([0.01 + Math.cos(a) * 0.11, 0.035, 0.14 + Math.sin(a) * 0.11], [0.01 + Math.cos(a) * 0.08, 0.155, 0.14 + Math.sin(a) * 0.08], 0.009); }
  b.box([-0.025, 0.186, 0.13], [0.11, 0.016, 0.08], C.ivory, 'fabric', [0, 0.18, 0]);
  b.vase(0.07, 0.18, 0.14, 0.55, C.sage);
  b.cylinder([-0.055, 0.206, 0.19], 0.018, 0.028, C.ivory, 'glaze');
  b.chair(-0.28, 0.25, C.rose, Math.PI / 5);
  b.lamp(0.32, 0.02, -0.25, 0.56, 0.085);
  b.plant(0.265, 0.02, 0.21, 1.3);
}

function bedroom(b: Interior) {
  b.rug(0, 0.04, 0.67, 0.70, '#ada68d');
  b.soft([-0.03, 0.3, -0.327], [0.47, 0.47, 0.055], C.sage, 'fabric', 0.04);
  for (let i = 0; i < 7; i++) b.soft([-0.23 + i * 0.066, 0.32, -0.292], [0.06, 0.35, 0.018], C.sage, 'fabric', 0.008);
  b.soft([-0.03, 0.118, 0], [0.44, 0.16, 0.66], C.walnut, 'wood');
  b.soft([-0.03, 0.209, 0], [0.43, 0.08, 0.63], C.white, 'fabric', 0.025);
  b.soft([-0.03, 0.251, 0.08], [0.449, 0.06, 0.47], C.ivory, 'fabric', 0.024);
  b.blanket([-0.03, 0.287, 0.242]);
  for (const x of [-0.14, 0.075]) b.soft([x, 0.271, -0.219], [0.189, 0.067, 0.128], C.white, 'fabric', 0.028, [-0.14, 0, 0]);
  for (const x of [-0.337, 0.281]) {
    b.cabinet(x, -0.253, 0.15, 0.16, 0.16, C.wood);
    b.lamp(x, 0.21, -0.253, 0.225, 0.048);
  }
  b.frame(-0.03, 0.661, -0.418, 0.19, 0.15, C.brass);
  b.soft([0, 0.11, 0.35], [0.38, 0.075, 0.105], C.sage);
  for (const x of [-0.14, 0.14]) b.box([x, 0.06, 0.35], [0.022, 0.1, 0.08], C.walnut, 'wood');
}

function kitchen(b: Interior) {
  b.cabinet(0, -0.3, 0.79, 0.28, 0.21, C.sage);
  for (let row = 0; row < 3; row++) for (let col = 0; col < 9; col++) b.box([-0.356 + col * 0.089, 0.375 + row * 0.055, -0.426], [0.084, 0.049, 0.014], C.white, 'glaze');
  b.box([-0.22, 0.329, -0.3], [0.23, 0.008, 0.16], C.ink, 'glaze');
  b.box([-0.22, 0.177, -0.171], [0.213, 0.212, 0.019], C.ink, 'metal');
  b.box([-0.22, 0.157, -0.159], [0.179, 0.137, 0.008], '#445053', 'glaze');
  b.box([-0.22, 0.158, -0.153], [0.147, 0.103, 0.005], C.ink, 'glaze');
  b.rod([-0.302, 0.239, -0.145], [-0.138, 0.239, -0.145], 0.005);
  for (let i = 0; i < 4; i++) b.cylinder([-0.285 + i * 0.043, 0.27, -0.156], 0.007, 0.008, C.brass, 'metal', [Math.PI / 2, 0, 0]);
  for (const x of [-0.275, -0.165]) for (const z of [-0.345, -0.265]) b.ring([x, 0.337, z], 0.032, 0.004, C.brass);
  b.cylinder([-0.27, 0.365, -0.27], 0.035, 0.05, C.teal, 'glaze');
  b.cylinder([-0.27, 0.393, -0.27], 0.037, 0.009, C.brass, 'metal');
  b.ball([-0.27, 0.404, -0.27], [0.008, 0.009, 0.008], C.walnut);
  b.soft([0.13, 0.334, -0.3], [0.17, 0.012, 0.125], '#aebdbc', 'metal', 0.018);
  b.soft([0.13, 0.34, -0.3], [0.135, 0.007, 0.09], C.ink, 'glaze', 0.018);
  b.rod([0.13, 0.335, -0.382], [0.13, 0.445, -0.382], 0.006);
  b.rod([0.13, 0.445, -0.382], [0.13, 0.445, -0.315], 0.006);
  b.rod([0.13, 0.445, -0.315], [0.13, 0.423, -0.315], 0.006);
  for (const x of [-0.275, 0.275]) {
    b.box([x, 0.639, -0.358], [0.23, 0.215, 0.14], C.sage);
    for (const dx of [-0.058, 0.058]) { b.box([x + dx, 0.64, -0.28], [0.106, 0.199, 0.015], C.sage); b.rod([x + dx, 0.57, -0.265], [x + dx, 0.62, -0.265], 0.003); }
  }
  b.box([-0.03, 0.58, -0.33], [0.18, 0.04, 0.2], C.ivory, 'stone');
  b.box([-0.03, 0.668, -0.377], [0.1, 0.145, 0.095], C.ivory, 'stone');
  b.cabinet(0.02, 0.18, 0.48, 0.28, 0.21, C.teal);
  b.box([0.04, 0.337, 0.18], [0.19, 0.013, 0.125], C.wood, 'wood');
  b.vase(0.17, 0.334, 0.17, 0.65, C.ivory);
  for (let i = 0; i < 3; i++) b.ball([-0.045 + i * 0.04, 0.359, 0.18], [0.019, 0.02, 0.019], i % 2 ? C.clay : C.sage);
  b.plant(0.32, 0.334, -0.29, 0.6);
  b.soft([-0.32, 0.304, 0.023], [0.2, 0.57, 0.2], C.ivory, 'paint', 0.017);
  for (const [y, h] of [[0.416, 0.325], [0.13, 0.22]]) {
    b.soft([-0.32, y, 0.132], [0.193, h, 0.025], C.ivory, 'glaze', 0.011);
    b.rod([-0.248, y + h * 0.12, 0.157], [-0.248, y - h * 0.24, 0.157], 0.004);
  }
  for (const x of [-0.12, 0.14]) { b.cylinder([x, 0.191, 0.374], 0.055, 0.022, C.walnut); for (const dx of [-0.033, 0.033]) b.rod([x + dx, 0.03, 0.374], [x + dx, 0.18, 0.374], 0.006); }
}

function bathroom(b: Interior) {
  for (let row = 0; row < 5; row++) for (let col = 0; col < 8; col++) b.box([-0.38 + col * 0.108, 0.31 + row * 0.09, -0.426], [0.104, 0.085, 0.013], (row + col) % 4 ? '#b4c9bf' : C.ivory, 'glaze');
  b.basin([-0.17, 0.033, 0.10], [0.195, 0.23, 0.27]);
  b.ball([-0.17, 0.205, 0.10], [0.171, 0.003, 0.237], '#95bdbb', 'glaze');
  b.box([-0.17, 0.277, 0.06], [0.397, 0.017, 0.075], C.wood, 'wood');
  b.vase(-0.20, 0.287, 0.06, 0.4, C.white);
  b.rod([-0.35, 0.028, -0.2], [-0.35, 0.365, -0.2], 0.008);
  b.rod([-0.35, 0.365, -0.2], [-0.26, 0.365, -0.2], 0.008);
  b.rod([-0.26, 0.365, -0.2], [-0.26, 0.338, -0.2], 0.008);
  b.cabinet(0.253, -0.295, 0.23, 0.25, 0.225, C.walnut);
  b.basin([0.253, 0.297, -0.28], [0.1, 0.055, 0.085]);
  b.cylinder([0.253, 0.31, -0.28], 0.01, 0.002, C.brass, 'metal');
  b.rod([0.253, 0.294, -0.38], [0.253, 0.4, -0.38], 0.005);
  b.rod([0.253, 0.4, -0.38], [0.253, 0.4, -0.3], 0.005);
  b.ring([0.253, 0.578, -0.408], 0.116, 0.007, C.brass, [0, 0, 0]);
  b.cylinder([0.253, 0.578, -0.408], 0.11, 0.004, '#aabfc1', 'metal', [Math.PI / 2, 0, 0]);
  b.rug(0.205, 0.325, 0.25, 0.17, C.ivory);
  b.soft([0.29, 0.215, 0.026], [0.144, 0.22, 0.079], C.white, 'glaze', 0.014);
  b.soft([0.29, 0.332, 0.026], [0.151, 0.018, 0.085], C.white, 'glaze', 0.007);
  b.cylinder([0.325, 0.344, 0.03], 0.008, 0.005, C.brass, 'metal');
  b.soft([0.29, 0.091, 0.12], [0.08, 0.14, 0.12], C.white, 'glaze', 0.027);
  b.basin([0.29, 0.132, 0.12], [0.086, 0.081, 0.12]);
  b.ball([0.29, 0.221, 0.12], [0.089, 0.009, 0.12], C.white, 'glaze');
  b.rod([-0.32, 0.486, -0.387], [-0.09, 0.486, -0.387], 0.005);
  for (let i = 0; i < 5; i++) b.soft([-0.255 + i * 0.024, 0.407, -0.378 + (i % 2) * 0.003], [0.027, 0.16, 0.02], C.ivory, 'fabric', 0.007);
  b.plant(-0.30, 0.025, -0.33, 0.9);
}

function reception(b: Interior) {
  b.rug(0, 0.06, 0.68, 0.67, C.wine);
  b.box([0, 0.2, -0.345], [0.37, 0.36, 0.14], C.ivory, 'stone');
  b.box([0, 0.162, -0.268], [0.235, 0.235, 0.02], C.ink);
  b.box([0, 0.394, -0.337], [0.435, 0.037, 0.185], C.ivory, 'stone');
  for (const x of [-0.151, 0.151]) b.box([x, 0.19, -0.254], [0.046, 0.31, 0.055], C.ivory, 'stone');
  for (const x of [-0.055, 0, 0.055]) b.rod([x - 0.026, 0.07, -0.25], [x + 0.025, 0.10, -0.25], 0.014, C.walnut, 'wood');
  for (const x of [-0.05, 0.01, 0.055]) b.ball([x, 0.127, -0.24], [0.018, 0.05, 0.008], '#e5b35e', 'light');
  b.frame(0, 0.611, -0.415, 0.26, 0.26, C.brass);
  for (const x of [-0.15, 0.15]) { b.cylinder([x, 0.428, -0.325], 0.024, 0.03, C.brass, 'metal'); b.cylinder([x, 0.469, -0.325], 0.011, 0.055, C.ivory, 'light'); }
  b.group([-0.25, 0, 0.105], Math.PI / 3, () => sofa(b, 0, 0, 0.28, C.teal));
  b.group([0.25, 0, 0.105], -Math.PI / 3, () => sofa(b, 0, 0, 0.28, C.teal));
  b.cylinder([0, 0.175, 0.16], 0.12, 0.027, C.ivory, 'stone');
  b.cylinder([0, 0.093, 0.16], 0.041, 0.15, C.brass, 'metal');
  b.vase(0, 0.19, 0.16, 0.7, C.wine);
  b.lamp(-0.32, 0.022, -0.27, 0.53, 0.065);
}

function basement(b: Interior) {
  for (const x of [-0.3, 0.3]) {
    b.box([x, 0.34, -0.33], [0.22, 0.62, 0.16], C.walnut, 'wood');
    for (let row = 0; row < 5; row++) {
      b.box([x, 0.083 + row * 0.11, -0.315], [0.222, 0.012, 0.19], C.wood, 'wood');
      for (let col = 0; col < 4; col++) {
        const xx = x - 0.075 + col * 0.05, y = 0.116 + row * 0.11;
        b.cylinder([xx, y, -0.313], 0.018, 0.1, row % 2 ? C.teal : C.wine, 'glaze', [Math.PI / 2, 0, 0]);
        b.cylinder([xx, y, -0.248], 0.008, 0.035, C.walnut, 'glaze', [Math.PI / 2, 0, 0]);
        b.ring([xx, y, -0.236], 0.008, 0.0015, C.brass, [0, 0, 0]);
      }
    }
  }
  b.frame(0, 0.61, -0.415, 0.17, 0.19);
  for (const x of [-0.265, 0.265]) {
    b.cylinder([x, 0.147, 0.19], 0.095, 0.24, C.wood);
    for (const y of [0.05, 0.09, 0.22, 0.26]) b.ring([x, y, 0.19], 0.095, 0.005, C.ink);
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; b.rod([x + Math.cos(a) * 0.096, 0.035, 0.19 + Math.sin(a) * 0.096], [x + Math.cos(a) * 0.096, 0.263, 0.19 + Math.sin(a) * 0.096], 0.002, C.walnut, 'wood'); }
  }
  b.box([0, 0.284, 0.19], [0.75, 0.036, 0.23], C.walnut, 'wood');
  b.vase(-0.12, 0.306, 0.18, 0.8, C.teal);
  for (const x of [0.035, 0.12]) { b.cylinder([x, 0.309, 0.17], 0.024, 0.006, C.brass, 'metal'); b.rod([x, 0.31, 0.17], [x, 0.356, 0.17], 0.003); b.ball([x, 0.373, 0.17], [0.022, 0.023, 0.022], C.rose); }
  for (const x of [-0.34, 0.34]) b.box([x, 0.773, 0], [0.06, 0.061, 0.84], C.walnut, 'wood');
  b.rod([0, 0.80, 0], [0, 0.64, 0], 0.004);
  b.ball([0, 0.61, 0], [0.06, 0.047, 0.06], C.ivory, 'light');
}

function library(b: Interior) {
  b.rug(0, 0.12, 0.60, 0.52, C.wine);
  b.box([0, 0.397, -0.351], [0.79, 0.74, 0.155], C.walnut, 'wood');
  for (const x of [-0.392, -0.137, 0.137, 0.392]) b.box([x, 0.399, -0.276], [0.018, 0.736, 0.178], C.wood, 'wood');
  for (let row = 0; row < 5; row++) {
    const y = 0.06 + row * 0.142;
    b.box([0, y, -0.271], [0.8, 0.017, 0.181], C.wood, 'wood');
    for (const x of [-0.36, -0.1, 0.175]) b.books(x, y + 0.01, -0.26, row % 2 ? 5 : 6);
  }
  b.group([-0.235, 0, 0.1], 0.4, () => sofa(b, 0, 0, 0.31, C.wine));
  b.cylinder([0.16, 0.215, 0.17], 0.13, 0.024, C.walnut);
  b.cylinder([0.16, 0.119, 0.17], 0.03, 0.19, C.brass, 'metal');
  b.box([0.16, 0.241, 0.19], [0.16, 0.019, 0.12], C.ivory, 'fabric', [0, -0.16, 0]);
  b.lamp(0.31, 0.025, -0.07, 0.53, 0.075);
  for (const x of [0.07, 0.19]) b.rod([x, 0.026, -0.11], [x, 0.66, -0.23], 0.008, C.wood, 'wood');
  for (let i = 0; i < 7; i++) b.rod([0.068, 0.08 + i * 0.082, -0.12 - i * 0.0155], [0.192, 0.08 + i * 0.082, -0.12 - i * 0.0155], 0.007, C.wood, 'wood');
}

function dining(b: Interior) {
  b.rug(0, 0.06, 0.7, 0.66, C.sage);
  b.cabinet(0, -0.345, 0.65, 0.19, 0.135, C.walnut);
  b.frame(0, 0.52, -0.415, 0.35, 0.25);
  b.vase(-0.23, 0.25, -0.34, 0.8, C.sage); b.vase(0.24, 0.25, -0.34, 0.6, C.rose);
  b.soft([0, 0.295, 0.07], [0.5, 0.033, 0.30], C.walnut, 'wood', 0.014);
  for (const x of [-0.185, 0.185]) for (const z of [-0.025, 0.165]) b.rod([x, 0.035, z], [x, 0.29, z], 0.013, C.walnut, 'wood');
  for (const x of [-0.135, 0.135]) for (const s of [-1, 1]) {
    b.chair(x, 0.07 + s * 0.23, C.ivory, s < 0 ? Math.PI : 0);
    b.cylinder([x, 0.317, 0.07 + s * 0.077], 0.048, 0.008, C.ivory, 'glaze');
    b.ring([x, 0.324, 0.07 + s * 0.077], 0.036, 0.002, C.brass);
    b.rod([x + 0.061, 0.321, 0.025 + s * 0.077], [x + 0.061, 0.321, 0.115 + s * 0.077], 0.002);
  }
  b.vase(0, 0.319, 0.07, 0.65, C.ivory);
  for (const dx of [-0.024, 0, 0.02]) { b.rod([0, 0.365, 0.07], [dx, 0.48, 0.075], 0.002, C.sage, 'paint'); b.ball([dx, 0.48, 0.075], [0.018, 0.017, 0.019], C.rose); }
  b.rod([0, 0.81, 0.07], [0, 0.68, 0.07], 0.005);
  b.ring([0, 0.66, 0.07], 0.14, 0.007, C.brass);
  for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; b.ball([Math.cos(a) * 0.14, 0.642, 0.07 + Math.sin(a) * 0.14], [0.034, 0.036, 0.034], C.ivory, 'light'); }
}

function conservatory(b: Interior) {
  // Deep, framed bay glazing, with separate mullions and gathered linen curtains.
  b.box([0, 0.49, -0.419], [0.57, 0.50, 0.027], C.walnut, 'wood');
  b.box([0, 0.49, -0.398], [0.525, 0.459, 0.01], '#b3d0c8', 'glaze');
  for (const x of [-0.26, 0, 0.26]) b.box([x, 0.49, -0.383], [0.016, 0.473, 0.025], C.ivory);
  for (const y of [0.267, 0.49, 0.723]) b.box([0, y, -0.383], [0.535, 0.016, 0.025], C.ivory);
  b.box([0, 0.251, -0.36], [0.60, 0.025, 0.10], C.ivory, 'stone');
  b.rod([-0.37, 0.752, -0.336], [0.37, 0.752, -0.336], 0.007);
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) b.soft([s * (0.27 + i * 0.018), 0.47, -0.335 + (i % 2) * 0.012], [0.023, 0.51, 0.03], C.ivory, 'fabric', 0.01);
  b.rug(0.025, 0.13, 0.57, 0.50, C.ivory);
  b.group([-0.17, 0, 0.065], 0.3, () => sofa(b, 0, 0, 0.33, C.sage));
  b.cylinder([0.19, 0.17, 0.17], 0.105, 0.021, C.wood);
  for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; b.rod([0.19 + Math.cos(a) * 0.08, 0.025, 0.17 + Math.sin(a) * 0.08], [0.19, 0.16, 0.17], 0.007); }
  b.books(0.13, 0.188, 0.16, 3);
  b.plant(0.245, 0.025, -0.23, 1.5); b.plant(-0.30, 0.027, 0.30, 1);
  b.plant(-0.13, 0.266, -0.35, 0.65);
}

export const INTERIOR_SCENES = ['living', 'bedroom', 'kitchen', 'bathroom', 'reception', 'basement', 'library', 'dining', 'conservatory'] as const;
const DRAW_ROOMS = [living, bedroom, kitchen, bathroom, reception, basement, library, dining, conservatory];

export function buildInterior(scene: number, walls: [boolean, boolean]) {
  if (!Number.isInteger(scene) || scene < 0 || scene >= DRAW_ROOMS.length) throw new Error('Invalid interior scene');
  const b = new Interior(walls);
  architecture(b, scene); DRAW_ROOMS[scene](b);
  return b.finish();
}
