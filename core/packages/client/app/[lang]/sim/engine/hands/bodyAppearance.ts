import * as THREE from 'three';

// Authored clothing / hair colors belong to the character, independently of page theme.
const PALETTE = { shirt: 0x416d8c, pants: 0x27364d, shoes: 0x342e2b, hair: 0x30231e };
type Region = keyof typeof PALETTE | 'skin';

/** Signed masks in bind-pose metres. Interpolating their zero crossing gives
 * smooth necklines / cuffs instead of selecting whole triangles along a jagged edge. */
function regionDistance(region: Exclude<Region, 'skin'>, x: number, y: number, z: number): number {
  const shirt = Math.min(y + 0.37, 0.14 - y, 0.315 - Math.abs(x));
  if (region === 'shirt') return shirt;
  if (region === 'pants') return Math.min(-0.37 - y, y + 1.20);
  if (region === 'shoes') return -1.20 - y;
  const front = THREE.MathUtils.smoothstep(z, -0.015, 0.05);
  const hairline = 0.255 + front * (0.09 + 0.012 * Math.sin(x * 35));
  return Math.min(y - hairline, Math.max(0.063 - Math.abs(x), y - 0.335));
}

export function bodyAppearanceRegion(x: number, y: number, z: number): Region {
  for (const region of Object.keys(PALETTE) as Exclude<Region, 'skin'>[]) {
    if (regionDistance(region, x, y, z) >= 0) return region;
  }
  return 'skin';
}

/** Clip a source triangle, interpolating all attributes including skinning weights. */
function garmentGeometry(source: THREE.BufferGeometry, region: Exclude<Region, 'skin'>): THREE.BufferGeometry {
  const pos = source.getAttribute('position'), normal = source.getAttribute('normal');
  const weights = source.getAttribute('skinWeight'), bones = source.getAttribute('skinIndex');
  const index = source.getIndex()!;
  type Vertex = { p: THREE.Vector3; n: THREE.Vector3; weights: Map<number, number>; d: number };
  const vertices: number[] = [], normals: number[] = [], si: number[] = [], sw: number[] = [];
  const vertex = (i: number): Vertex => {
    const p = new THREE.Vector3().fromBufferAttribute(pos, i);
    const w = new Map<number, number>();
    for (let k = 0; k < 4; k++) w.set(bones.getComponent(i, k), (w.get(bones.getComponent(i, k)) ?? 0) + weights.getComponent(i, k));
    return { p, n: new THREE.Vector3().fromBufferAttribute(normal, i), weights: w, d: regionDistance(region, p.x, p.y, p.z) };
  };
  const intersect = (a: Vertex, b: Vertex): Vertex => {
    const t = a.d / (a.d - b.d), w = new Map<number, number>();
    for (const [id, weight] of a.weights) w.set(id, weight * (1 - t));
    for (const [id, weight] of b.weights) w.set(id, (w.get(id) ?? 0) + weight * t);
    return { p: a.p.clone().lerp(b.p, t), n: a.n.clone().lerp(b.n, t).normalize(), weights: w, d: 0 };
  };
  const emit = (v: Vertex) => {
    const lift = region === 'hair' ? 0.009 : 0.014;
    vertices.push(...v.p.clone().addScaledVector(v.n, lift).toArray()); normals.push(...v.n.toArray());
    const sorted = [...v.weights].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const total = sorted.reduce((sum, entry) => sum + entry[1], 0);
    for (let k = 0; k < 4; k++) { si.push(sorted[k]?.[0] ?? 0); sw.push((sorted[k]?.[1] ?? 0) / total); }
  };
  for (let i = 0; i < index.count; i += 3) {
    const input = [vertex(index.getX(i)), vertex(index.getX(i + 1)), vertex(index.getX(i + 2))];
    const poly: Vertex[] = [];
    for (let j = 0; j < 3; j++) {
      const a = input[j], b = input[(j + 1) % 3];
      if (a.d >= 0) poly.push(a);
      if ((a.d >= 0) !== (b.d >= 0)) poly.push(intersect(a, b));
    }
    for (let j = 1; j < poly.length - 1; j++) { emit(poly[0]); emit(poly[j]); emit(poly[j + 1]); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  return geo;
}

/** Appearance uses the existing skeleton; it never changes body/hand pose vertices. */
export class BodyAppearance {
  private readonly meshes: THREE.SkinnedMesh[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly features = new THREE.Group();
  private readonly face: THREE.SkinnedMesh;
  private readonly faceMaterial = new THREE.MeshStandardMaterial({
    transparent: true, roughness: 0.85, depthWrite: false, polygonOffset: true,
    polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  private texture: THREE.Texture | null = null;
  private src = '';
  private placement = { x: 0, y: 0, scale: 1 };
  private alignTexture(): void {
    if (!this.texture) return;
    const { x, y, scale } = this.placement;
    this.texture.repeat.setScalar(1 / scale);
    this.texture.offset.set((1 - 1 / scale) / 2 - x, (1 - 1 / scale) / 2 - y);
  }
  private generation = 0;
  private disposed = false;

  constructor(body: THREE.SkinnedMesh, head: THREE.Bone, headOrigin: THREE.Vector3) {
    const source = body.geometry;
    const pos = source.getAttribute('position');
    const index = source.getIndex()!;
    const regions = new Map<Region, number[]>();
    const faceIndices: number[] = [];
    for (let i = 0; i < index.count; i += 3) {
      const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
      const x = ids.reduce((s, j) => s + pos.getX(j), 0) / 3;
      const y = ids.reduce((s, j) => s + pos.getY(j), 0) / 3;
      const z = ids.reduce((s, j) => s + pos.getZ(j), 0) / 3;
      const region = bodyAppearanceRegion(x, y, z);
      if (!regions.has(region)) regions.set(region, []);
      regions.get(region)!.push(...ids);
      if (region === 'skin' && y > 0.195 && y < 0.355 && z > 0.035 && Math.abs(x) < 0.072) faceIndices.push(...ids);
    }
    const makeMesh = (geometry: THREE.BufferGeometry, material: THREE.Material, name: string) => {
      const mesh = new THREE.SkinnedMesh(geometry, material);
      mesh.name = name;
      mesh.bind(body.skeleton, body.bindMatrix);
      mesh.frustumCulled = false;
      mesh.raycast = () => {};
      mesh.layers.enable(1);
      body.add(mesh);
      this.meshes.push(mesh);
      return mesh;
    };
    for (const region of regions.keys()) {
      if (region === 'skin') continue;
      const geo = garmentGeometry(source, region);
      const material = new THREE.MeshStandardMaterial({ color: PALETTE[region], roughness: region === 'hair' ? 0.85 : 1, side: THREE.DoubleSide });
      if (region === 'hair') {
        material.onBeforeCompile = shader => {
          shader.vertexShader = 'varying vec3 vHairPosition;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvHairPosition = position;');
          shader.fragmentShader = 'varying vec3 vHairPosition;\n' + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
            float strand = sin(vHairPosition.x * 2200.0 + sin(vHairPosition.y * 28.0 + vHairPosition.z * 16.0) * 22.0);
            diffuseColor.rgb *= 0.88 + 0.12 * strand;`);
        };
        material.customProgramCacheKey = () => 'person-hair-strands-v1';
      }
      this.materials.push(material);
      makeMesh(geo, material, `person-${region}`);
    }
    // Covered skin is omitted, so the body cannot poke through clothes during posing.
    // Keep source positions / weights intact for the hand correspondence and texture bake.
    const skinIndices: number[] = [];
    for (let i = 0; i < index.count; i += 3) {
      const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
      const covered = (Object.keys(PALETTE) as Exclude<Region, 'skin'>[]).some(region =>
        ids.every(j => regionDistance(region, pos.getX(j), pos.getY(j), pos.getZ(j)) > 0.002));
      if (!covered) skinIndices.push(...ids);
    }
    source.setIndex(skinIndices);

    const faceGeo = source.clone();
    faceGeo.setIndex(faceIndices);
    faceGeo.deleteAttribute('color');
    const faceUV = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      faceUV[i * 2] = (pos.getX(i) + 0.072) / 0.144;
      faceUV[i * 2 + 1] = (pos.getY(i) - 0.195) / 0.16;
    }
    faceGeo.setAttribute('uv', new THREE.BufferAttribute(faceUV, 2));
    this.face = makeMesh(faceGeo, this.faceMaterial, 'person-face-photo');
    this.face.visible = false;
    this.materials.push(this.faceMaterial);

    // A relaxed default face. All features follow the head's existing nod.
    this.features.name = 'person-default-face';
    this.features.position.copy(headOrigin).negate();
    head.add(this.features);
    const dark = new THREE.MeshStandardMaterial({ color: PALETTE.hair, roughness: 0.8 });
    const white = new THREE.MeshStandardMaterial({ color: 0xeee9df, roughness: 0.65 });
    const lips = new THREE.MeshStandardMaterial({ color: 0x9a5c51, roughness: 0.9 });
    this.materials.push(dark, white, lips);
    const ellipsoid = (x: number, y: number, z: number, sx: number, sy: number, sz: number, mat: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), mat);
      mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz);
      mesh.layers.enable(1); mesh.raycast = () => {}; this.features.add(mesh);
    };
    for (const side of [-1, 1]) {
      ellipsoid(side * 0.031, 0.310, 0.074, 0.012, 0.0045, 0.006, white);
      ellipsoid(side * 0.031, 0.310, 0.079, 0.004, 0.004, 0.0015, dark);
      ellipsoid(side * 0.031, 0.337, 0.081, 0.014, 0.0018, 0.002, dark);
    }
    const smile = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.022, 0.250, 0.091), new THREE.Vector3(0, 0.244, 0.109), new THREE.Vector3(0.022, 0.250, 0.091));
    const mouth = new THREE.Mesh(new THREE.TubeGeometry(smile, 24, 0.0012, 8, false), lips);
    mouth.layers.enable(1); mouth.raycast = () => {}; this.features.add(mouth);
  }

  setAvatar(src: string, x = 0, y = 0, scale = 1): void {
    if (this.disposed) return;
    this.placement = { x, y, scale };
    this.alignTexture();
    if (src === this.src) return;
    this.src = src;
    const generation = ++this.generation;
    this.face.visible = false;
    this.features.visible = true;
    this.texture?.dispose();
    this.texture = null;
    this.faceMaterial.map = null;
    this.faceMaterial.needsUpdate = true;
    if (!src) return;
    new THREE.TextureLoader().load(src, (texture) => {
      if (this.disposed || generation !== this.generation) { texture.dispose(); return; }
      texture.colorSpace = THREE.SRGBColorSpace;
      this.texture = texture;
      this.alignTexture();
      this.faceMaterial.map = texture;
      this.faceMaterial.needsUpdate = true;
      this.face.visible = true;
      this.features.visible = false;
    }, undefined, () => { /* Keep the default face if decoding fails. */ });
  }

  dispose(): void {
    this.disposed = true;
    this.generation++;
    this.texture?.dispose();
    for (const mesh of this.meshes) { mesh.geometry.dispose(); mesh.removeFromParent(); }
    this.features.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
    this.features.removeFromParent();
    for (const material of this.materials) material.dispose();
  }
}
