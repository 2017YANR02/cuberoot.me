import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VILLA_ROOMS, type RoomStyle } from './space-state';

const PALETTES = {
  minimal: { sky: 0x9aadb9, ground: 0x7e8986, stone: 0xbcbdb8, frame: 0xc9d0d2, wall: 0xe7e5de, wood: 0x847768, fabric: 0xd6d5cd, mirror: 0x727977, glow: 0xffedce, secondary: 0xe1eeff },
  cyberpunk: { sky: 0x060c17, ground: 0x080e17, stone: 0x20272d, frame: 0x56616b, wall: 0x131c28, wood: 0x18222a, fabric: 0x192730, mirror: 0x121e29, glow: 0x63e3ff, secondary: 0xff518b },
  modern: { sky: 0x8b9ba5, ground: 0x444c40, stone: 0xc7c1b3, frame: 0x4b4941, wall: 0xd4d0c5, wood: 0x625147, fabric: 0xc9c4b9, mirror: 0x5e625b, glow: 0xffd099, secondary: 0xffe0b9 },
} as const;
const EXTRA = {
 vintage: { ...PALETTES.modern, wood: 0x37251d, fabric: 0x74664b, frame: 0x907044, wall: 0xb7aa8f },
 italian: { ...PALETTES.modern, stone: 0xd5c7ac, wall: 0xe4d5bd, wood: 0x836445, fabric: 0xd8c4a4 },
 penthouse: { ...PALETTES.minimal, sky: 0x546777, frame: 0x31383b, wood: 0x504037, fabric: 0xc4bcae },
 japanese: { ...PALETTES.modern, wood: 0xa0845c, stone: 0xb5b3a2, wall: 0xe0dac8, fabric: 0xc5bda6 },
 company: { ...PALETTES.minimal, wood: 0xc5ad86, wall: 0xe5e4dc, frame: 0x3a3d3e, fabric: 0x797d7c }
};


type V = [number, number, number];
export class SpaceRoom {
  readonly root = new THREE.Group();
  readonly palette;
  readonly floor: Reflector;
  readonly surfaces: THREE.Mesh[] = [];
  private roof = new THREE.Group();
  private back = new THREE.Group();
  private mirrors: Reflector[] = [];
  private textures = new Map<string, THREE.Texture>();
  private models = new Map<string, Promise<THREE.Group | null>>();
  private disposed = false;
  private glass = new THREE.MeshPhysicalMaterial({ color: 0xd7e6e5, roughness: 0.07, metalness: 0.15, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide });
  private stone: THREE.MeshStandardMaterial;
  private wall: THREE.MeshStandardMaterial;
  private wood: THREE.MeshStandardMaterial;
  private fabric: THREE.MeshStandardMaterial;
  private metal: THREE.MeshStandardMaterial;
  private dark = new THREE.MeshStandardMaterial({ color: 0x242a2b, roughness: 0.5 });
  private ceramic = new THREE.MeshPhysicalMaterial({ color: 0xf0efdf, roughness: 0.12, clearcoat: 1 });
  private led: THREE.MeshBasicMaterial;
  constructor(readonly style: RoomStyle, private helpers: THREE.Object3D[], private invalidate = () => {}) {
    this.palette = style in PALETTES ? PALETTES[style as keyof typeof PALETTES] : EXTRA[style as keyof typeof EXTRA];
    const p = this.palette;
    if (!('LTC_FLOAT_1' in THREE.UniformsLib)) RectAreaLightUniformsLib.init();
    this.stone = this.material(p.stone, 'marble', 0.25);
    this.wall = new THREE.MeshStandardMaterial({ color: p.wall, roughness: 0.9 });
    this.wood = this.material(p.wood, 'wood', 0.48);
    this.fabric = this.material(p.fabric, 'fabric', 0.95);
    this.metal = new THREE.MeshStandardMaterial({ color: p.frame, metalness: 0.85, roughness: 0.25 });
    this.led = new THREE.MeshBasicMaterial({ color: new THREE.Color(p.glow).multiplyScalar(2.2) });
    this.root.add(this.roof, this.back);
    this.floor = this.mirror(20, 18, [0, 0.014, 0]);
    this.floor.rotation.x = -Math.PI / 2;
    this.surfaces.push(this.floor);
    if (style === 'company') {
      this.floor.visible = false;
      this.company();
    } else this.villa();
    this.landscape();
    this.batch(this.root);
    this.batch(this.roof);
  }

  private material(color: number, kind: 'wood' | 'marble' | 'fabric' | 'carpet' | 'parquet', roughness: number) {
    const material = new THREE.MeshStandardMaterial({ color, roughness });
    const loader = new THREE.TextureLoader();
    for (const channel of ['map', 'normalMap'] as const) {
      const name = kind === 'fabric' || kind === 'carpet' || kind === 'parquet' ? 'v2/' + ({ fabric: 'rough_linen', carpet: 'dirty_carpet', parquet: 'herringbone_parquet' }[kind]) + '-' + (channel === 'map' ? 'Diffuse' : 'nor_gl') + '.jpg' : 'v1/' + (kind === 'wood' ? 'wood_floor' : 'marble_01') + (channel === 'map' ? '-Diffuse.jpg' : '-nor_gl.jpg');
      const texture = this.textures.get(name) ?? loader.load('/assets/space/' + name, () => { if (this.disposed) texture.dispose(); else this.invalidate(); });
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.setScalar(kind === 'fabric' ? 5 : 0.25);
      if (channel === 'map') texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      material[channel] = texture; this.textures.set(name, texture);
    }
    material.normalScale.setScalar(kind === 'fabric' ? 0.25 : 0.3);
    // World-scale UVs keep the veining/wood grain consistent across different furniture sizes.
    material.onBeforeCompile = shader => {
      if (kind === 'fabric' || kind === 'carpet') {
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', THREE.ShaderChunk.map_fragment.replace('diffuseColor *= sampledDiffuseColor;', `sampledDiffuseColor.rgb = vec3(clamp(dot(sampledDiffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)) * ${kind === 'carpet' ? '3.5' : '1.8'}, 0.0, 1.0)); diffuseColor *= sampledDiffuseColor;`));
      }
      if (this.style === 'company' && (kind === 'wood' || kind === 'parquet')) {
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', THREE.ShaderChunk.map_fragment.replace('diffuseColor *= sampledDiffuseColor;', 'sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, vec3(dot(sampledDiffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), 0.25) * 1.6; diffuseColor *= sampledDiffuseColor;'));
      }
      if (kind !== 'fabric') {
        const repeat = kind === 'carpet' ? '1.8' : '0.25';
        shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>\nvec3 wp = (modelMatrix * vec4(position, 1.0)).xyz; vec3 wn = abs(mat3(modelMatrix) * normal); vec2 surfaceUv = wn.y > max(wn.x,wn.z) ? wp.xz : wn.x > wn.z ? wp.zy : wp.xy;\n#ifdef USE_MAP\nvMapUv = surfaceUv * ${repeat};\n#endif\n#ifdef USE_NORMALMAP\nvNormalMapUv = surfaceUv * ${repeat};\n#endif`);
      }
    };
    material.customProgramCacheKey = () => 'space-world-texture-' + kind + (this.style === 'company' ? '-company' : '');
    return material;
  }

  private box(w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, parent = this.root, round = 0.025) {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, round > 0.06 ? 3 : 1, Math.min(round, w / 3, h / 3, d / 3)), mat);
    mesh.position.set(x, y, z); mesh.castShadow = mat !== this.glass; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  }
  private cylinder(rt: number, rb: number, h: number, x: number, y: number, z: number, mat: THREE.Material, parent = this.root) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 32), mat);
    mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private sphere(x: number, y: number, z: number, scale: V, mat: THREE.Material, parent = this.root) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), mat);
    mesh.position.set(x, y, z); mesh.scale.set(...scale); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private line(points: V[], radius: number, mat: THREE.Material, parent = this.root) {
    const path = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(path, 24, radius, 8, false), mat);
    mesh.castShadow = true; parent.add(mesh); return mesh;
  }
  private area(position: V, target: V, w: number, h: number, intensity = 4, color: number = this.palette.glow) {
    const light = new THREE.RectAreaLight(color, intensity * (this.style === 'company' ? 0.12 : 0.2), w, h);
    light.position.set(...position); light.lookAt(...target); this.root.add(light);
  }
  private model(name: string, x: number, y: number, z: number, height: number, rotation = 0, planted = false) {
    const holder = new THREE.Group(); holder.position.set(x, y, z); holder.rotation.y = rotation;
    holder.name = name; this.root.add(holder);
    if (!this.models.has(name)) this.models.set(name, new GLTFLoader().loadAsync(`/assets/space/v2/${name}/model.gltf`).then(({ scene }) => {
      if (this.disposed) { this.disposeModel(scene); return null; }
      scene.traverse(o => {
        if (!(o instanceof THREE.Mesh)) return;
        o.castShadow = o.receiveShadow = true;
        if (name === 'throw_pillows_01' && this.style !== 'vintage') {
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m instanceof THREE.MeshStandardMaterial) {
            m.map?.dispose(); m.map = null; m.color.setHex(this.palette.fabric); m.roughness = 1;
          }
        }
      });
      return scene;
    }).catch(error => { console.warn(`Space asset could not load: ${name}`, error); return null; }));
    void this.models.get(name)!.then(source => {
      if (!source || this.disposed) return;
      const object = source.clone(true), bounds = new THREE.Box3().setFromObject(object), size = bounds.getSize(new THREE.Vector3());
      if (planted) object.traverse(o => { if (o.name.endsWith('_pot') || o.name.endsWith('_pebbles')) o.visible = false; });
      if (!Number.isFinite(size.y) || size.y <= 0) return;
      const scale = height / size.y, center = bounds.getCenter(new THREE.Vector3());
      object.scale.multiplyScalar(scale); object.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
      holder.add(object); this.invalidate();
    });
    return holder;
  }
  private disposeModel(root: THREE.Object3D) {
    const textures = new Set<THREE.Texture>();
    root.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      o.geometry.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        for (const value of Object.values(m)) if (value instanceof THREE.Texture) textures.add(value);
        m.dispose();
      }
    });
    textures.forEach(t => t.dispose());
  }
  private platform(w: number, d: number, x: number, y: number, z: number, mat: THREE.Material) {
    const mesh = this.box(w, 0.16, d, x, y - 0.08, z, mat);
    this.surfaces.push(mesh); return mesh;
  }
  private books(x: number, y: number, z: number, n = 7) {
    const colors = [0xa99d87, 0x484e51, 0x845a45, 0xd2c8b5, 0x768279].map(color => new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
    for (let i = 0; i < n; i++) {
      const h = 0.38 + (i * 7 % 5) * 0.055;
      this.box(0.11, h, 0.31, x + i * 0.14, y + h / 2, z, colors[i % colors.length]);
      this.box(0.09, 0.018, 0.004, x + i * 0.14, y + h * 0.7, z + 0.157, this.ceramic);
    }
  }
  private plant(x: number, y: number, z: number, size = 1) {
    this.model(size < 0.6 ? 'potted_plant_02' : 'potted_plant_01', x, y, z, 2.5 * size, x * 0.7);
  }
  private tree(x: number, y: number, z: number, size = 1) {
    this.model('island_tree_02', x, y, z, 3.2 * size, x * 0.7);
  }
  private sofa(x: number, y: number, z: number, width: number, mat = this.fabric) {
    if (this.style === 'vintage' && width > 2) {
      for (const offset of width > 4 ? [-width * 0.26, width * 0.26] : [0]) this.model('sofa_03', x + offset, y, z, 1.1);
      return;
    }
    this.box(width, 0.17, 1.16, x, y + 0.21, z, mat, this.root, 0.08);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.box(0.045, 0.14, 0.045, x + sx * (width / 2 - 0.18), y + 0.07, z + sz * 0.43, this.metal);
    const n = Math.max(1, Math.round(width / 1.05));
    for (let i = 0; i < n; i++) {
      const sx = x - width / 2 + (i + 0.5) * width / n;
      this.box(width / n - 0.022, 0.24, 0.95, sx, y + 0.42, z + 0.08, mat, this.root, 0.11);
      const back = this.box(width / n - 0.025, 0.6, 0.25, sx, y + 0.69, z - 0.43, mat, this.root, 0.115); back.rotation.x = -0.13;
      if (i === 0 || i === n - 1) {
        this.model('throw_pillows_01', sx, y + 0.52, z - 0.13, 0.44, i ? -0.25 : 0.35);
      }
    }
    for (const side of [-1, 1]) this.box(0.2, 0.36, 1.12, x + side * (width / 2 - 0.04), y + 0.46, z, mat, this.root, 0.1);
  }
  private table(x: number, y: number, z: number, w: number, d: number, mat = this.wood) {
    const top = this.box(w, 0.1, d, x, y, z, mat, this.root, 0.07); this.surfaces.push(top);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.box(0.06, y, 0.06, x + sx * (w / 2 - 0.18), y / 2, z + sz * (d / 2 - 0.15), this.dark);
  }
  private bowl(x: number, y: number, z: number, rx: number, rz: number, h: number) {
    const shape = [[0.001, 0.03], [0.72, 0.03], [0.86, 0.12], [0.98, 0.8], [1, 0.96], [0.96, 1], [0.91, 0.95], [0.79, 0.25], [0.62, 0.17], [0.001, 0.17]].map(([r, v]) => new THREE.Vector2(r, v * h));
    const profile = new THREE.SplineCurve(shape).getPoints(64);
    const mesh = new THREE.Mesh(new THREE.LatheGeometry(profile, 96), this.ceramic);
    mesh.position.set(x, y, z); mesh.scale.set(rx, 1, rz); mesh.castShadow = mesh.receiveShadow = true; this.root.add(mesh);
    this.cylinder(0.045, 0.045, 0.01, x, y + h * 0.18, z, this.metal);
  }

  private villa() {
    const { stone, wall, wood, fabric, metal, led } = this;
    this.box(43, 0.5, 31, -9, -0.26, -2.5, stone);
    for (const r of Object.values(VILLA_ROOMS)) {
      this.platform(r.width, r.depth, r.x, r.level * 5, r.z, r === VILLA_ROOMS.bathroom || r === VILLA_ROOMS.interior ? stone : wood);
      this.box(r.width + 0.3, 0.23, r.depth + 0.3, r.x, r.ceiling + 0.1, r.z, wall, this.roof);
      for (const side of [-1, 1]) {
        this.box(r.width + 0.6, 0.18, 0.14, r.x, r.ceiling + 0.27, r.z + side * (r.depth / 2 + 0.18), stone, this.roof);
        this.box(0.14, 0.18, r.depth + 0.6, r.x + side * (r.width / 2 + 0.18), r.ceiling + 0.27, r.z, stone, this.roof);
        this.box(r.width + 0.4, 0.07, 0.12, r.x, r.ceiling - 0.1, r.z + side * (r.depth / 2 + 0.12), metal, this.roof);
      }
      this.box(r.width - 0.8, 0.026, 0.045, r.x, r.ceiling - 0.055, r.z + r.depth / 2 - 0.32, led, this.roof);
      for (const side of [-1, 1]) {
        this.box(r.width - 0.6, 0.14, 0.3, r.x, r.ceiling - 0.15, r.z + side * (r.depth / 2 - 0.18), wall, this.roof);
        this.box(0.3, 0.14, r.depth - 0.6, r.x + side * (r.width / 2 - 0.18), r.ceiling - 0.15, r.z, wall, this.roof);
        this.box(0.025, 0.025, r.depth - 1, r.x + side * (r.width / 2 - 0.36), r.ceiling - 0.07, r.z, led, this.roof);
      }
      for (const dx of [-1, 1]) for (const dz of [-1, 0, 1]) {
        this.cylinder(0.105, 0.105, 0.04, r.x + dx * r.width * 0.32, r.ceiling - 0.04, r.z + dz * r.depth * 0.31, this.dark, this.roof);
        this.cylinder(0.068, 0.068, 0.008, r.x + dx * r.width * 0.32, r.ceiling - 0.064, r.z + dz * r.depth * 0.31, led, this.roof);
      }
      this.area([r.x, r.ceiling - 0.1, r.z], [r.x, r.level * 5, r.z], r.width * 0.7, r.depth * 0.55, 3);
    }
    this.floor.position.y = 0.018;
    const polish = stone.clone(); polish.onBeforeCompile = stone.onBeforeCompile; polish.customProgramCacheKey = stone.customProgramCacheKey; polish.transparent = true; polish.opacity = this.style === 'minimal' ? 0.16 : 0.55; polish.depthWrite = false;
    const film = new THREE.Mesh(new THREE.PlaneGeometry(20, 18), polish); film.rotation.x = -Math.PI / 2; film.position.y = 0.022; film.receiveShadow = true; this.root.add(film);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(20, 18), new THREE.ShadowMaterial({ opacity: 0.3, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.026; shadow.receiveShadow = true; this.root.add(shadow);
    // Continuous rear gallery joins the living room to the study and upper suites.
    this.box(39, 9.5, 0.3, -9.5, 4.75, -16.1, wall);
    this.box(0.3, 7.8, 18, 10.15, 3.9, 0, wall);
    for (let z = -8.85; z < 9; z += 1.8) for (let y = 0.8; y < 7.8; y += 1.6) this.box(0.035, 1.575, 1.775, 10.318, y, z + 0.75, stone);
    this.box(12, 4.7, 0.25, -23, 2.35, -6.1, wood);
    this.box(8.8, 4.4, 0.22, -24.6, 7.2, -4.1, wood);
    this.box(0.25, 4.5, 22, -29.15, 7.25, -5, wall);
    for (const [x, y, z, w, h] of [[0, 3.9, 9, 20, 7.8], [-23, 2.4, 10, 12, 4.8], [-23, 7.2, 10, 12, 4.4]]) {
      this.box(w, h, 0.03, x, y, z, this.glass);
      for (let i = 0; i <= w; i += 3) this.box(0.045, h, 0.075, x - w / 2 + i, y, z, metal);
      for (const edge of [-1, 1]) this.box(w, 0.07, 0.1, x, y + edge * h / 2, z, metal);
    }
    for (const x of [-29, -17, -10, 10]) this.box(0.26, x < -10 ? 9.4 : 7.8, 0.26, x, x < -10 ? 4.7 : 3.9, 9, stone);
    this.box(0.035, 4.5, 16, -29, 2.4, 2, this.glass);
    this.box(0.035, 4.4, 22, -17, 7.2, -5, this.glass);
    for (let z = -15; z <= 9; z += 3) this.box(0.055, 4.4, 0.06, -17, 7.2, z, metal);
    for (let i = 0; i < 25; i++) this.box(0.5, 0.14, 2.9, 9 - i * 0.44, 0.2 + i * 0.2, -12.35, wood);
    for (const z of [-13.85, -10.85]) {
      this.line([[9.2, 1.2, z], [-1.6, 6.1, z]], 0.035, metal);
      for (let i = 0; i < 6; i++) this.box(0.03, 1, 0.03, 9 - i * 2.1, 0.65 + i * 0.955, z, metal);
    }
    this.box(15, 1.1, 0.025, -9.5, 5.65, -9, this.glass);
    this.box(15, 0.04, 0.05, -9.5, 6.2, -9, metal);
    this.box(13, 7.8, 0.22, -3.5, 3.9, -9.1, wood);
    this.box(12, 3.6, 0.08, -3.4, 3.4, -8.96, metal);
    this.mirror(11.8, 3.4, [-3.4, 3.4, -8.9]);
    this.box(12, 0.025, 0.03, -3.4, 5.18, -8.88, led);
    this.sofa(-4.7, 0, -6.6, 4.8);
    this.model('modern_arm_chair_01', -8, 0, -4.1, 0.95, 0.9);
    this.model('modern_arm_chair_01', -7.5, 0, -2.5, 0.95, 1.2);
    this.box(7.2, 0.025, 5, -4.8, 0.045, -4.5, fabric, this.root, 0.1);
    for (const [x, z, r, y] of [[-4.8, -4.2, 1, 0.51], [-3.3, -3.7, 0.65, 0.38]]) {
      this.cylinder(r, r, 0.09, x, y, z, stone); this.cylinder(r * 0.6, r * 0.6, y, x, y / 2, z, metal);
    }
    this.box(0.7, 0.06, 0.5, -4.8, 0.59, -4.2, wood);
    this.cylinder(0.15, 0.21, 0.42, -5.3, 0.75, -4.3, this.ceramic);
    this.plant(8.2, 0, -6.3);
    // Recessed timber fins, a stone hearth and a lit niche give the tall room depth.
    for (let x = -9.8; x < 3; x += 0.16) this.box(0.075, 2.3, 0.1, x, 6.62, -8.91, wood);
    this.box(2.8, 7.8, 0.45, 8.35, 3.9, -8.85, stone);
    this.box(2.4, 0.8, 0.08, 8.35, 0.8, -8.59, this.dark);
    this.box(2.15, 0.015, 0.07, 8.35, 0.48, -8.52, led);
    this.box(3.2, 0.17, 0.85, 8.35, 0.16, -8.52, stone);
    this.area([-4, 4.7, -8.4], [-4, 1, -5.5], 8, 1.5, 9);
    this.area([-9.7, 3.8, -2], [-3, 1.3, -5], 7, 4, 8, 0xcad8e5);
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15 + i * 0.22, 0.025, 8, 80), led);
      ring.rotation.x = Math.PI / 2 + i * 0.16; ring.position.set(-3, 6.1 + i * 0.3, -3.4); this.root.add(ring);
      this.line([[-3, 7.8, -3.4], [-3, 6.2, -3.4]], 0.008, metal);
    }
    // Study: full-height joinery, book spines, reading chair and a working desk.
    this.box(0.1, 4.5, 13.6, -28.93, 2.25, 2, wood);
    const bookCovers = [0x35454b, 0x766343, 0xbeb29a, 0x76574a, 0x878a79].map(color => new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
    for (let z = -4.4; z < 8; z += 2.25) {
      this.box(0.5, 4.5, 0.065, -28.6, 2.25, z, wood);
      for (let y = 0.35; y < 4.1; y += 0.77) {
        this.box(0.7, 0.065, 2.1, -28.5, y, z + 1.08, wood);
        this.box(0.022, 0.015, 2, -28.2, y - 0.04, z + 1.08, led);
        for (let i = 0; i < 9; i++) {
          const h = 0.31 + (i * 7 + Math.round(y * 10)) % 5 * 0.045, bz = z + 0.22 + i * 0.17;
          this.box(0.32, h, 0.115, -28.4, y + 0.04 + h / 2, bz, bookCovers[(i + Math.round(y * 4)) % bookCovers.length]);
          for (const band of [0.11, h - 0.07]) this.box(0.004, 0.012, 0.075, -28.238, y + 0.04 + band, bz, this.ceramic);
        }
      }
    }
    this.area([-28.05, 2.9, 1], [-24, 1.4, 1], 0.5, 8, 7);
    this.box(5.1, 0.024, 4.1, -23.8, 0.022, 0.45, fabric, this.root, 0.1);
    this.table(-23.5, 0.76, 0, 2.6, 1.15);
    this.box(1.15, 0.008, 0.65, -23.35, 0.806, 0.08, this.dark, this.root, 0.04);
    this.box(0.76, 0.44, 0.045, -23.3, 1.14, -0.3, this.dark);
    this.box(0.04, 0.2, 0.04, -23.3, 0.88, -0.3, metal);
    this.box(0.42, 0.018, 0.15, -23.3, 0.825, 0.26, this.dark);
    this.books(-24.6, 0.82, -0.3, 4);
    this.cylinder(0.12, 0.12, 0.025, -22.5, 0.82, -0.32, metal);
    this.line([[-22.5, 0.84, -0.32], [-22.5, 1.45, -0.32], [-22.83, 1.52, -0.22]], 0.014, metal);
    this.cylinder(0.12, 0.21, 0.11, -22.83, 1.48, -0.22, metal);
    this.cylinder(0.19, 0.19, 0.008, -22.83, 1.422, -0.22, led);
    // Plaster reliefs break up the walnut wall without using a remote artwork image.
    for (const x of [-25.4, -21.8]) {
      this.box(2.5, 2.8, 0.075, x, 2.45, -5.91, metal);
      this.box(2.4, 2.7, 0.08, x, 2.45, -5.85, fabric);
      for (let i = 0; i < 8; i++) {
        const relief = new THREE.Mesh(new THREE.TorusGeometry(0.35 + i * 0.07, 0.023, 6, 64, Math.PI * 1.5), this.ceramic);
        relief.position.set(x, 2.45, -5.785); relief.rotation.z = x < -24 ? 0.4 : 2.4; relief.castShadow = relief.receiveShadow = true; this.root.add(relief);
      }
      this.box(2.4, 0.025, 0.05, x, 4.16, -5.7, led);
      this.area([x, 4.05, -5.4], [x, 2.2, -5.9], 2.2, 0.15, 5);
    }
    this.model('modern_arm_chair_01', -23.5, 0, 1.1, 0.94, Math.PI);
    this.sofa(-23.5, 0, 7, 3.6);
    this.plant(-18.5, 0, -3.5, 0.65);
    this.bedroom();
    this.bathroom();
    // Water court, central tree island and a walk across the pool.
    this.box(6, 0.4, 18, -13.5, -0.22, 0, this.dark);
    const water = this.mirror(5.7, 17.7, [-13.5, -0.015, 0]); water.rotation.x = -Math.PI / 2;
    this.box(2.2, 0.3, 2.2, -13.5, 0.08, -3.5, stone); this.plant(-13.5, 0.22, -3.5, 1.4);
    for (let i = 0; i < 5; i++) this.platform(1.1, 1.6, -15.8 + i * 1.15, 0.07, 5, stone);
    this.details();
  }

  private bedroom() {
    const furnitureStart = this.root.children.length;
    this.box(5.5, 1.9, 0.15, -24.3, 6, -3.7, this.fabric, this.root, 0.15);
    this.box(5, 0.35, 6.6, -24.3, 5.25, 0, this.wood, this.root, 0.1);
    this.box(4.7, 0.42, 6.2, -24.3, 5.63, 0, this.ceramic, this.root, 0.2);
    const linen = this.material(0xe2d9c7, 'fabric', 1);
    const duvetGeo = new THREE.PlaneGeometry(6.3, 5.4, 110, 90); duvetGeo.rotateX(-Math.PI / 2);
    const duvetPoints = duvetGeo.attributes.position;
    for (let i = 0; i < duvetPoints.count; i++) {
      const x = duvetPoints.getX(i), z = duvetPoints.getZ(i), over = Math.max(0, Math.abs(x) - 2.24);
      duvetPoints.setX(i, Math.sign(x) * (Math.min(Math.abs(x), 2.24) + Math.sin(Math.min(over, 0.3) / 0.3 * Math.PI / 2) * 0.14));
      duvetPoints.setY(i, -over * 0.9 + 0.025 * Math.sin(x * 4.1 + z * 2.7) + 0.015 * Math.sin(z * 6.3 - x) + 0.065 * Math.exp(-Math.pow((z + 2.4) * 5, 2)));
    }
    duvetGeo.computeVertexNormals(); linen.side = THREE.DoubleSide;
    const duvet = new THREE.Mesh(duvetGeo, linen); duvet.position.set(-24.3, 5.98, 0.5); duvet.castShadow = duvet.receiveShadow = true; this.root.add(duvet);
    const throwGeo = new THREE.PlaneGeometry(6.2, 1.5, 110, 30); throwGeo.rotateX(-Math.PI / 2);
    const p = throwGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), over = Math.max(0, Math.abs(x) - 2.28);
      p.setX(i, Math.sign(x) * (Math.min(Math.abs(x), 2.28) + Math.sin(Math.min(over, 0.3) / 0.3 * Math.PI / 2) * 0.14));
      p.setY(i, 0.022 * Math.sin(x * 3.8 + z * 2) + 0.008 * Math.sin(z * 9 - x * 5) - over * 0.9);
    }
    throwGeo.computeVertexNormals(); const throwMesh = new THREE.Mesh(throwGeo, this.fabric); throwMesh.position.set(-24.3, 6.08, 1.9); throwMesh.castShadow = true; this.root.add(throwMesh);
    for (const x of [-25.5, -23.1]) {
      this.box(1.8, 0.28, 0.98, x, 6, -2.05, linen, this.root, 0.13);
      this.model('throw_pillows_01', x, 6.08, -1.7, 0.55, x < -24 ? 0.15 : -0.12);
    }
    for (const x of [-27.6, -21]) {
      this.box(1.1, 0.65, 1.05, x, 5.43, -2.7, this.wood, this.root, 0.08);
      this.cylinder(0.12, 0.16, 0.35, x, 5.95, -2.7, this.metal);
      this.cylinder(0.25, 0.37, 0.4, x, 6.3, -2.7, linen);
    }
    this.box(4.5, 0.36, 1.1, -24.3, 5.6, 4.2, this.fabric, this.root, 0.12);
    for (const x of [-26, -22.6]) this.box(0.09, 0.5, 0.65, x, 5.25, 4.2, this.metal);
    const suite = new THREE.Group(); suite.position.set(-24.3, 5, -0.5); this.root.add(suite); suite.updateMatrixWorld();
    for (const item of this.root.children.slice(furnitureStart, -1)) suite.attach(item);
    // A super-king bed is 2.35 m wide; preserve human heights while fixing the oversized plan.
    suite.scale.set(0.5, 0.8, 0.48);
    this.box(6.3, 0.024, 5.2, -24.3, 5.03, 0.4, this.fabric);
    for (let x = -27.5; x < -20.8; x += 0.24) this.box(0.09, 2.9, 0.06, x, 6.6, -3.88, this.wood);
    this.box(6.8, 0.022, 0.03, -24.3, 7.92, -3.84, this.led);
    this.area([-24.3, 7.6, -3.7], [-24.3, 5.7, 0], 5, 1, 7);
    for (let z = 0; z < 8; z += 1.2) { this.box(0.72, 3.7, 1.15, -28.45, 7.05, z, this.wood); this.box(0.05, 0.8, 0.035, -28.05, 6.95, z + 0.38, this.metal); }
    this.sofa(-19.4, 5, 7.7, 2);
    this.area([-23, 8.4, 9.2], [-24, 5.8, 0], 10, 2, 4.5, 0xd6e4ff);
    // Pleated sheers keep the view open, with fabric depth at the sides of the glazing.
    for (const x of [-28.1, -17.9]) {
      const geo = new THREE.PlaneGeometry(1.25, 4.1, 48, 1), p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 27) * 0.065);
      geo.computeVertexNormals(); const curtain = new THREE.Mesh(geo, this.material(0xe2ddcf, 'fabric', 1)); curtain.material.side = THREE.DoubleSide; curtain.position.set(x, 7.1, 9.76); curtain.castShadow = true; this.root.add(curtain);
    }
  }

  private bathroom() {
    const y = 5;
    this.box(12, 4.4, 0.13, -23, 7.2, -15.86, this.stone);
    // Large slabs, recessed shelves and a timber screen articulate the spa wall.
    for (let z = -11.2; z <= -4.4; z += 1.7) this.box(0.065, 4.1, 1.68, -28.93, 7.1, z, this.stone);
    this.box(0.08, 0.65, 2.8, -28.83, 6.9, -8.1, this.dark);
    this.box(0.055, 0.025, 2.8, -28.77, 7.19, -8.1, this.led);
    this.box(0.45, 0.08, 2.8, -28.61, 6.59, -8.1, this.wood);
    for (let i = 0; i < 4; i++) this.cylinder(0.055, 0.07, 0.2 + i % 2 * 0.08, -28.48, 6.74, -9 + i * 0.3, i % 2 ? this.ceramic : this.metal);
    this.box(5.8, 0.55, 1.2, -23.1, y + 0.75, -14.8, this.wood, this.root, 0.05);
    this.box(6, 0.11, 1.3, -23.1, y + 1.08, -14.8, this.stone);
    for (let x = -25.8; x < -20.4; x += 0.95) this.box(0.015, 0.43, 0.025, x, 5.75, -14.187, this.dark);
    this.box(5.7, 0.02, 0.03, -23.1, 5.44, -14.2, this.led);
    for (const x of [-24.55, -21.75]) {
      this.bowl(x, y + 1.15, -14.65, 0.58, 0.43, 0.25);
      this.line([[x, 6.1, -15.28], [x, 6.68, -15.28], [x, 6.72, -14.99]], 0.035, this.metal);
      this.box(2.16, 2.12, 0.07, x, 7.68, -15.67, this.led, this.root, 0.12);
      this.mirror(2.04, 1.98, [x, 7.68, -15.61]);
      this.cylinder(0.055, 0.065, 0.19, x + 0.85, 6.34, -14.55, this.ceramic);
      this.box(0.06, 0.025, 0.025, x + 0.85, 6.46, -14.55, this.metal);
    }
    this.bowl(-25.3, 5.04, -7.8, 1.24, 0.63, 0.64);
    this.line([[-25.7, 5.1, -8.95], [-25.7, 6.25, -8.95], [-25.7, 6.35, -8.58]], 0.046, this.metal);
    this.box(0.42, 0.04, 1.4, -25.1, 5.7, -7.8, this.wood);
    for (let i = 0; i < 3; i++) { const towel = this.cylinder(0.095, 0.095, 0.32, -24.97, 5.81 + i * 0.008, -7.57 - i * 0.21, this.fabric); towel.rotation.z = Math.PI / 2; }
    // Walk-in rain shower with a door opening, floor drain, niche and wall controls.
    this.platform(3, 3.5, -27.35, 5.05, -13.65, this.stone);
    this.box(0.025, 3.6, 3.5, -25.8, 6.85, -13.65, this.glass);
    this.box(1.5, 3.6, 0.025, -28, 6.85, -11.9, this.glass);
    this.box(0.04, 3.6, 0.04, -25.8, 6.85, -11.9, this.metal);
    this.box(0.035, 0.55, 0.035, -27.1, 6.5, -11.9, this.metal);
    this.line([[-28.6, 6.1, -14], [-28.6, 8.65, -14], [-27.6, 8.65, -14]], 0.035, this.metal);
    this.cylinder(0.32, 0.32, 0.055, -27.6, 8.63, -14, this.metal);
    this.box(0.02, 0.65, 0.25, -28.8, 6.55, -13.9, this.metal);
    this.box(0.025, 0.5, 0.9, -28.81, 6.9, -12.9, this.dark);
    this.box(0.65, 0.008, 0.045, -27.5, 5.145, -13.8, this.metal);
    // Separate WC, recognisable ceramic bowl/seat and wall flush plate.
    this.box(0.15, 2.6, 3.3, -20.05, 6.3, -12, this.wood);
    this.box(2.9, 2.6, 0.15, -18.5, 6.3, -13.7, this.wood);
    this.box(0.32, 0.25, 0.34, -18.65, 5.35, -13.5, this.ceramic, this.root, 0.1);
    this.bowl(-18.65, 5.26, -13.22, 0.28, 0.41, 0.28);
    const seat = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.025, 12, 64), this.ceramic); seat.rotation.x = Math.PI / 2; seat.scale.y = 1.43; seat.position.set(-18.65, 5.55, -13.22); this.root.add(seat);
    const lid = this.box(0.53, 0.56, 0.04, -18.65, 5.86, -13.6, this.ceramic, this.root, 0.13); lid.rotation.x = -0.09;
    this.box(0.25, 0.14, 0.015, -18.65, 6.3, -13.61, this.metal);
    const paper = this.cylinder(0.1, 0.1, 0.22, -19.9, 5.8, -12.75, this.ceramic); paper.rotation.x = Math.PI / 2;
    this.box(2.7, 0.022, 1.1, -23.1, 5.1, -13.15, this.fabric, this.root, 0.07);
    this.plant(-28.3, 5, -5.3, 0.5);
    this.area([-23, 8.8, -13], [-23, 5.2, -9], 5, 2, 5, 0xffefd7);
    const bathMirror = this.mirror(12, 12, [-23, 5.018, -10]); bathMirror.rotation.x = -Math.PI / 2;
    const film = this.stone.clone(); film.onBeforeCompile = this.stone.onBeforeCompile; film.customProgramCacheKey = this.stone.customProgramCacheKey; film.transparent = true; film.opacity = 0.65; film.depthWrite = false;
    const top = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), film); top.rotation.x = -Math.PI / 2; top.position.set(-23, 5.022, -10); top.receiveShadow = true; this.root.add(top);
  }

  private details() {
    if (this.style === 'italian') {
      // Open-bottom arch profile: the opening remains a passage, not an opaque panel.
      for (const x of [-7.5, -2.5, 2.5, 7.5]) {
        const s = new THREE.Shape(); s.moveTo(-2.5, 0); s.lineTo(-2.5, 7.8); s.lineTo(2.5, 7.8); s.lineTo(2.5, 0); s.lineTo(2.1, 0); s.lineTo(2.1, 4.8); s.absarc(0, 4.8, 2.1, 0, Math.PI, false); s.lineTo(-2.1, 0); s.closePath();
        const arch = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: false, curveSegments: 40 }), this.wall); arch.position.set(x, 0, 8.8); arch.castShadow = true; this.root.add(arch);
      }
      for (let x = -29; x < 10; x += 0.4) this.box(0.2, 0.16, 7.5, x, 9.65, -12.5, this.wood, this.roof, 0.06);
      for (const x of [-8.5, 8.5]) { this.cylinder(0.48, 0.33, 1.2, x, 0.6, 12, this.stone); this.plant(x, 0.4, 12, 0.8); }
    }
    if (this.style === 'vintage') {
      this.cylinder(0.26, 0.28, 0.035, -1.55, 0.04, -6.55, this.metal);
      this.cylinder(0.025, 0.025, 1.65, -1.55, 0.87, -6.55, this.metal);
      this.cylinder(0.22, 0.38, 0.4, -1.55, 1.7, -6.55, new THREE.MeshStandardMaterial({ color: 0xefe1c7, roughness: 0.95, emissive: 0xc68b43, emissiveIntensity: 0.4 }));
      for (let x = -9; x < 9; x += 3) for (const y of [0.3, 2.8, 5.8, 7.5]) this.box(2.75, 0.055, 0.055, x + 1.4, y, -8.92, this.metal);
      for (let x = -9; x < 9; x += 3) this.box(0.055, 7.3, 0.06, x, 3.9, -8.91, this.metal);
      for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; this.line([[-3, 6.6, -3.4], [-3 + Math.cos(a) * 2, 5.8, -3.4 + Math.sin(a) * 2]], 0.035, this.metal); this.sphere(-3 + Math.cos(a) * 2, 5.8, -3.4 + Math.sin(a) * 2, [0.12, 0.25, 0.12], this.led); }
      for (let i = 0; i < 23; i++) this.sphere(-7.8 + i * 0.28, 0.95, -7.01, [0.04, 0.04, 0.02], this.metal);
    }
    if (this.style === 'japanese') {
      for (let x = -29; x <= 10; x += 1.1) this.box(0.13, 0.27, 29, x, 9.6, -3, this.wood, this.roof);
      for (let z = -8; z <= 9; z += 0.33) this.box(0.13, 7.8, 0.08, 9.9, 3.9, z, this.wood);
      for (let x = -28; x < -17; x += 0.5) this.box(0.06, 4.1, 0.09, x, 7.15, 9.85, this.wood);
      for (let i = 0; i < 6; i++) this.sphere(-14 + Math.sin(i) * 1.5, 0.12, -5 + i * 1.4, [0.55, 0.28, 0.36], this.stone);
    }
    if (this.style === 'cyberpunk') {
      const pink = new THREE.MeshBasicMaterial({ color: new THREE.Color(this.palette.secondary).multiplyScalar(2) });
      for (const x of [-29, -17, -10, 10]) this.box(0.055, 9.4, 0.055, x, 4.7, 9.1, pink);
      for (const y of [0.15, 5, 7.8]) this.box(20, 0.035, 0.08, 0, y, 9.15, this.led);
      this.area([-9, 4, -8], [0, 1, 0], 6, 3, 8, this.palette.secondary);
      for (let i = 0; i < 12; i++) this.box(0.025, 1 + i % 4, 0.03, -9 + i * 0.35, 3, -8.85, pink);
    }
    if (this.style === 'minimal') {
      for (const x of [-8, 8]) this.cylinder(0.2, 0.2, 7.8, x, 3.9, 8.8, this.metal);
      this.sphere(6.6, 1.25, -5, [0.8, 1.2, 0.8], new THREE.MeshStandardMaterial({ color: 0xbac5c8, metalness: 1, roughness: 0.1 }));
    }
  }
  private company() {
    // Photo reconstruction, metres inferred from the 600 mm ceiling grid.
    const carpet = this.material(0xb9bdbb, 'carpet', 1);
    const upholstery = this.material(0x8c9293, 'fabric', 1);
    const parquet = this.material(0xf1dfbe, 'parquet', 0.48);
    const jute = this.material(0xc4a168, 'fabric', 1);
    const white = new THREE.MeshStandardMaterial({ color: 0xe0e2dc, roughness: 0.6 });
    const orange = this.material(0xb3693b, 'fabric', 1);
    const lime = this.material(0xa7ac6b, 'fabric', 1);
    // The photographs do not establish the connecting corridor's exact plan.
    this.platform(26.6, 18.4, -12.65, -0.025, 3.6, parquet);
    this.platform(5.4, 6.6, -23, 0, 2, carpet);
    for (const x of [-25.95, 0.65]) this.box(0.15, 3.7, 18.4, x, 1.85, 3.6, white);
    for (const z of [-5.65, 12.85]) this.box(26.6, 3.7, 0.15, -12.65, 1.85, z, white);
    this.box(26.6, 0.1, 18.4, -12.65, 3.75, 3.6, this.dark, this.roof);
    this.box(0.12, 2.75, 6.6, -25.75, 1.375, 2, white);
    this.box(0.12, 2.75, 6.6, -20.25, 1.375, 2, white);
    this.box(0.06, 0.12, 6.6, -20.33, 0.06, 2, this.dark);
    this.box(0.06, 0.12, 6.6, -25.67, 0.06, 2, this.dark);
    const night = new THREE.MeshStandardMaterial({ color: 0x101923, metalness: 0.5, roughness: 0.16 });
    this.box(5.4, 2.7, 0.04, -23, 1.35, -1.3, night);
    const window = this.mirror(5.3, 2.6, [-23, 1.35, -1.265]);
    (window.material as THREE.ShaderMaterial).uniforms.uPolish.value = 0.32;
    (window.material as THREE.ShaderMaterial).uniforms.color.value.setHex(0x080c10);
    const aluminium = new THREE.MeshStandardMaterial({ color: 0xb4b9b6, metalness: 0.65, roughness: 0.33 });
    for (const x of [-25.7, -24, -22.3, -20.3]) this.box(0.055, 2.7, 0.07, x, 1.35, -1.2, aluminium);
    for (const y of [0.28, 0.78, 1.28, 1.78, 2.3]) this.box(5.4, 0.055, 0.075, -23, y, -1.2, aluminium);
    for (const [x, h] of [[-24.8, 0.6], [-23.1, 0.72], [-21.2, 1.12]]) {
      this.box(1.6, h, 0.025, x, 2.7 - h / 2, -1.16, white);
      this.line([[x + 0.76, 2.68, -1.08], [x + 0.76, 1.5, -1.08]], 0.004, this.dark);
    }
    this.cylinder(0.28, 0.28, 2.75, -20.55, 1.375, -0.85, white);
    this.box(5.4, 0.1, 6.6, -23, 2.8, 2, white, this.roof);
    for (let x = -25.7; x < -20.2; x += 0.6) this.box(0.012, 0.018, 6.6, x, 2.738, 2, aluminium, this.roof);
    for (let z = -1.3; z < 5.4; z += 0.6) this.box(5.4, 0.018, 0.012, -23, 2.738, z, aluminium, this.roof);
    for (const z of [0, 2.4, 4.2]) { this.box(0.56, 0.02, 0.56, -23, 2.72, z, this.led, this.roof); this.area([-23, 2.65, z], [-23, 0, z], 2.4, 1.8, 14, 0xf0f3ee); }
    this.area([-23, 0.1, 2], [-23, 2.7, 2], 4, 5, 3, 0xffffff);
    for (let i = 0; i < 5; i++) {
      const side = 0.5 - i * 0.085;
      for (const sign of [-1, 1]) { this.box(side, 0.018, 0.014, -24.5, 2.72 - i * 0.008, 1.2 + sign * side / 2, aluminium, this.roof); this.box(0.014, 0.018, side, -24.5 + sign * side / 2, 2.72 - i * 0.008, 1.2, aluminium, this.roof); }
    }
    const meshPixels = new Uint8Array(64 * 64 * 4);
    for (let i = 0; i < 64 * 64; i++) meshPixels.fill(i % 4 === 0 || Math.floor(i / 64) % 4 === 0 ? 255 : 0, i * 4, i * 4 + 4);
    const meshTexture = new THREE.DataTexture(meshPixels, 64, 64); meshTexture.wrapS = meshTexture.wrapT = THREE.RepeatWrapping; meshTexture.repeat.set(2, 3); meshTexture.generateMipmaps = true; meshTexture.minFilter = THREE.LinearMipmapLinearFilter; meshTexture.needsUpdate = true; this.textures.set('chair-mesh', meshTexture);
    const chairMesh = new THREE.MeshStandardMaterial({ color: 0x202425, roughness: 0.9, alphaMap: meshTexture, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
    const chair = (x: number, z: number, mat = this.dark, angle = 0, swivel = true) => {
      const group = new THREE.Group(); group.position.set(x, 0, z); group.rotation.y = angle; this.root.add(group);
      this.box(0.5, 0.085, 0.48, 0, 0.48, 0, mat, group, 0.09);
      if (!swivel) {
        const backMat = mat.clone(); backMat.side = THREE.DoubleSide; backMat.onBeforeCompile = mat.onBeforeCompile; backMat.customProgramCacheKey = mat.customProgramCacheKey;
        const backGeo = new THREE.CylinderGeometry(0.28, 0.25, 0.3, 48, 4, true, -Math.PI / 2, Math.PI), p = backGeo.attributes.position;
        for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + 0.71 - 0.2 * (p.getY(i) / 0.3 + 0.5) * Math.abs(p.getX(i) / 0.28) ** 3);
        backGeo.computeVertexNormals(); const back = new THREE.Mesh(backGeo, backMat); back.castShadow = back.receiveShadow = true; group.add(back);
        const rim: V[] = Array.from({ length: 25 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 24; return [0.28 * Math.sin(a), 0.86 - 0.2 * Math.abs(Math.sin(a)) ** 3, 0.28 * Math.cos(a)]; });
        this.line(rim, 0.018, mat, group);
      }
      if (swivel) {
        const backGeo = new THREE.PlaneGeometry(0.43, 0.52, 24, 24), p = backGeo.attributes.position;
        for (let i = 0; i < p.count; i++) p.setZ(i, 0.02 * Math.cos(p.getY(i) * 10) - 0.25 * p.getX(i) ** 2);
        backGeo.computeVertexNormals(); const back = new THREE.Mesh(backGeo, chairMesh); back.position.set(0, 0.81, 0.25); back.rotation.x = 0.14; back.castShadow = back.receiveShadow = true; group.add(back);
        this.line([[-0.19, 0.54, 0.21], [-0.235, 0.64, 0.22], [-0.22, 1.02, 0.28], [-0.16, 1.08, 0.29], [0.16, 1.08, 0.29], [0.22, 1.02, 0.28], [0.235, 0.64, 0.22], [0.19, 0.54, 0.21], [-0.19, 0.54, 0.21]], 0.025, this.dark, group);
        this.box(0.42, 0.085, 0.025, 0, 0.63, 0.29, this.dark, group);
        this.cylinder(0.027, 0.04, 0.42, 0, 0.23, 0, aluminium, group);
        for (let i = 0; i < 5; i++) { const a = i * Math.PI * 0.4; this.line([[0, 0.12, 0], [Math.cos(a) * 0.3, 0.08, Math.sin(a) * 0.3]], 0.022, this.dark, group); this.sphere(Math.cos(a) * 0.3, 0.045, Math.sin(a) * 0.3, [0.045, 0.045, 0.035], this.dark, group); }
        for (const dx of [-0.29, 0.29]) { this.box(0.035, 0.2, 0.035, dx, 0.6, 0.05, this.dark, group); this.box(0.06, 0.035, 0.3, dx, 0.71, 0, this.dark, group); }
      } else for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.line([[sx * 0.17, 0.44, sz * 0.16], [sx * 0.27, 0.035, sz * 0.26]], 0.025, white, group);
      this.batch(group);
    };
    // One continuous double-sided island, plus the rear cross desk visible in photo 2.
    this.table(-23.7, 0.74, 2.1, 1.48, 3.95, white);
    this.table(-21.5, 0.74, -0.25, 2.35, 1.15, white);
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
      const x = -23.7 + side * 0.39, z = 0.7 + i * 1.3;
      chair(-23.7 + side * 1.07, z, this.dark, -side * Math.PI / 2);
      const desktopStart = this.root.children.length;
      this.box(0.52, 0.32, 0.027, x + 0.13, 1.04, z - 0.22, this.dark);
      this.box(0.018, 0.2, 0.018, x + 0.13, 0.86, z - 0.22, this.metal);
      this.box(0.3, 0.018, 0.12, x + 0.1, 0.81, z + 0.1, this.dark);
      this.box(0.28, 0.015, 0.2, x - 0.4, 0.8, z + 0.05, white);
      const laptop = this.box(0.3, 0.22, 0.012, x - 0.35, 0.94, z - 0.21, this.metal); laptop.rotation.x = -0.25;
      this.cylinder(0.036, 0.036, 0.18, x + 0.51, 0.87, z - 0.23, i % 2 ? orange : lime);
      this.cylinder(0.035, 0.045, 0.07, x - 0.45, 0.825, z + 0.24, white);
      this.box(0.14, 0.012, 0.075, x + 0.34, 0.81, z + 0.23, this.dark).rotation.y = i * 0.17;
      this.box(0.17, 0.08, 0.09, x - 0.17, 0.84, z - 0.26, i % 2 ? white : orange);
      this.box(0.12, 0.02, 0.055, x - 0.17, 0.889, z - 0.26, white);
      for (let p = 0; p <= i; p++) this.box(0.21, 0.018, 0.28, x - 0.45, 0.81 + p * 0.022, z + 0.26, p % 2 ? white : upholstery).rotation.y = side * 0.12;
      this.cylinder(0.045, 0.047, 0.22, x + 0.32, 0.9, z - 0.35, i === 0 ? lime : white);
      this.cylinder(0.045, 0.045, 0.02, x + 0.32, 1.02, z - 0.35, orange);
      this.line([[x + 0.1, 0.8, z - 0.3], [x + 0.5, 0.7, z - 0.36], [x + 0.45, 0.15, z - 0.4]], 0.006, this.dark);
      const desktop = new THREE.Group(); desktop.position.set(x, 0, z); this.root.add(desktop); desktop.updateMatrixWorld();
      for (const item of this.root.children.slice(desktopStart, -1)) desktop.attach(item);
      desktop.rotation.y = -side * Math.PI / 2;
      this.batch(desktop);
      if (i === 1) {
        const coat = new THREE.PlaneGeometry(0.55, 0.85, 24, 30), positions = coat.attributes.position;
        for (let j = 0; j < positions.count; j++) positions.setZ(j, Math.sin(positions.getX(j) * 30) * 0.025 + Math.sin(positions.getY(j) * 6) * 0.06);
        coat.computeVertexNormals(); const cloth = new THREE.Mesh(coat, upholstery); cloth.material.side = THREE.DoubleSide; cloth.position.set(-23.7 + side * 1.32, 0.75, z); cloth.rotation.y = Math.PI / 2; cloth.castShadow = true; this.root.add(cloth);
      }
      this.box(0.16, 0.42, 0.36, x, 0.23, z + 0.44, this.dark);
      for (let p = 0; p < 3; p++) this.box(0.21, 0.004, 0.28, x + 0.12, 0.81 + p * 0.005, z + 0.22, white).rotation.y = p * 0.09;
    }
    chair(-21.3, 0.8); chair(-21.3, -1.02, this.dark, Math.PI);
    this.box(0.06, 2.7, 2.7, -20.34, 1.35, 0.6, night);
    for (const z of [-0.7, 0.6, 1.9]) this.box(0.34, 2.7, 0.035, -20.5, 1.35, z, aluminium);
    for (const y of [0.15, 0.68, 1.21, 1.74, 2.27]) {
      this.box(0.42, 0.035, 2.7, -20.53, y, 0.6, aluminium);
      for (let i = 0; i < 4; i++) this.box(0.27, 0.28 + i % 2 * 0.08, 0.15, -20.52, y + 0.17, -0.45 + i * 0.28, i % 2 ? orange : jute);
    }
    this.box(5.4, 0.04, 0.05, -23, 2.7, 5.3, this.dark);
    this.box(3.8, 2.7, 0.025, -23.8, 1.35, 5.3, this.glass);
    const frost = new THREE.MeshStandardMaterial({ color: 0xd3d7d3, transparent: true, opacity: 0.74, roughness: 1 });
    this.box(3.8, 1.65, 0.03, -23.8, 0.88, 5.29, frost);
    for (let x = -25.4; x < -22; x += 0.26) this.box(0.07, 0.07, 0.008, x, 1.82, 5.32, white);
    this.box(0.065, 2.7, 0.08, -21.9, 1.35, 5.3, this.dark);
    const door = new THREE.Group(); door.position.set(-20.3, 0, 5.3); door.rotation.y = -1.18; this.root.add(door);
    this.box(1.4, 2.6, 0.055, -0.7, 1.3, 0, this.wood, door);
    this.box(0.16, 0.025, 0.06, -1.22, 1.05, 0.06, this.dark, door);
    this.box(0.38, 0.63, 0.3, -20.65, 0.32, 4.4, white, this.root, 0.06);
    const fan = this.cylinder(0.11, 0.11, 0.025, -20.65, 0.42, 4.57, this.dark); fan.rotation.x = Math.PI / 2;
    // Shared lounge: acoustic ceiling rafts, warm joinery, communal table and soft seating.
    const loungeStart = this.root.children.length, loungeRoofStart = this.roof.children.length;
    this.box(11, 3.5, 0.15, -5, 1.75, -5.55, this.wood);
    for (let x = -10.4; x < 0.4; x += 0.1) this.box(0.035, 3.4, 0.045, x, 1.75, -5.44, this.wood);
    for (const x of [-8, -2]) for (const z of [-2.8, 1, 4]) {
      this.box(3.6, 0.15, 2, x, 3.35, z, white, this.roof, 0.2);
      this.cylinder(0.07, 0.07, 0.22, x, 3.14, z, this.ceramic, this.roof);
      this.area([x, 3.1, z], [x, 0, z], 2, 1.2, 4, 0xffe0b7);
    }
    this.box(10.7, 0.04, 0.055, -5, 3.25, -5.42, this.led);
    for (const x of [-9.6, 0]) this.cylinder(0.32, 0.32, 3.7, x, 1.85, 1, white);
    this.box(0.62, 1.8, 0.6, -9.2, 0.9, -5, white);
    this.box(0.53, 0.65, 0.025, -9.2, 1.15, -4.69, this.dark);
    for (const x of [-9.33, -9.07]) this.cylinder(0.025, 0.025, 0.09, x, 1.18, -4.65, aluminium);
    this.box(0.44, 0.045, 0.16, -9.2, 0.9, -4.62, this.dark);
    for (const x of [-8.1, -6.95]) {
      this.box(0.94, 1.94, 0.7, x, 0.97, -5, x < -7.5 ? white : this.dark, this.root, 0.04);
      this.box(0.79, 1.6, 0.04, x, 0.96, -4.635, night);
      this.box(0.028, 0.5, 0.045, x + 0.35, 1.04, -4.59, aluminium);
      for (let y = 0.35; y < 1.7; y += 0.32) {
        this.box(0.74, 0.018, 0.025, x, y - 0.1, -4.59, aluminium);
        for (let i = 0; i < 5; i++) this.cylinder(0.035, 0.035, 0.16, x - 0.28 + i * 0.14, y, -4.61, i % 2 ? orange : lime);
      }
    }
    this.box(4.9, 1.2, 0.25, -3.5, 1.65, -5.28, this.dark);
    this.box(4.9, 0.035, 0.03, -3.5, 2.23, -5.12, this.led);
    this.box(4.9, 0.06, 0.55, -3.5, 1.07, -5.05, this.wood);
    for (const x of [-8, -2]) {
      this.box(0.035, 0.05, 9, x, 3.6, -0.4, this.dark, this.roof);
      for (const z of [-4, -0.5, 3.4]) this.cylinder(0.06, 0.06, 0.16, x, 3.49, z, this.dark, this.roof);
    }
    const duct = this.cylinder(0.18, 0.18, 10.2, -5, 3.48, -4.2, aluminium, this.roof); duct.rotation.z = Math.PI / 2;
    this.box(7, 0.025, 3.5, -5.1, 0.018, -1.8, this.dark);
    this.box(6.92, 0.008, 3.42, -5.1, 0.034, -1.8, jute);
    const oval = new THREE.Shape(); oval.absellipse(0, 0, 1.95, 0.64, 0, Math.PI * 2, false, 0);
    const communal = new THREE.Mesh(new THREE.ExtrudeGeometry(oval, { depth: 0.055, bevelEnabled: true, bevelThickness: 0.009, bevelSize: 0.009, bevelSegments: 2, steps: 1, curveSegments: 64 }), this.wood);
    communal.rotation.x = -Math.PI / 2; communal.position.set(-5.2, 0.74, -1.8); communal.castShadow = communal.receiveShadow = true; this.root.add(communal); this.surfaces.push(communal);
    for (const x of [-6.5, -3.9]) { this.box(0.08, 0.73, 0.62, x, 0.365, -1.8, this.dark).rotation.z = x < -5 ? -0.15 : 0.15; this.box(0.14, 0.01, 0.075, x, 0.805, -1.8, this.metal); }
    for (let i = 0; i < 3; i++) { chair(-6.3 + i * 1.1, -0.7, i % 2 ? lime : upholstery, 0, false); chair(-6.3 + i * 1.1, -2.9, upholstery, Math.PI, false); }
    this.sofa(-7.4, 0, 2.5, 3.8, upholstery); this.sofa(-4.9, 0, 2.5, 1.3, orange);
    this.cylinder(0.65, 0.65, 0.055, -6.5, 0.46, 3.9, this.dark); this.cylinder(0.15, 0.3, 0.42, -6.5, 0.21, 3.9, this.dark);
    this.cylinder(0.42, 0.42, 0.4, -4.8, 0.2, 4.3, lime);
    this.cylinder(0.38, 0.38, 0.37, -8, 0.19, 4.5, orange);
    const shellMaterial = white.clone(); shellMaterial.side = THREE.DoubleSide;
    const liningMaterial = orange.clone(); liningMaterial.onBeforeCompile = orange.onBeforeCompile; liningMaterial.customProgramCacheKey = orange.customProgramCacheKey; liningMaterial.side = THREE.DoubleSide;
    for (const [scale, mat] of [[1, shellMaterial], [0.97, liningMaterial]] as const) {
      const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32, Math.PI, Math.PI, 0.24, 2.15), mat);
      shell.position.set(-1.8, 0.99, 1); shell.scale.set(0.57 * scale, 0.72 * scale, 0.48 * scale); shell.castShadow = shell.receiveShadow = true; this.root.add(shell);
    }
    this.box(0.78, 0.18, 0.68, -1.8, 0.55, 1.08, orange, this.root, 0.14);
    const backCushion = this.box(0.72, 0.64, 0.2, -1.8, 1.03, 0.66, orange, this.root, 0.18); backCushion.rotation.x = -0.14;
    for (const dx of [-0.4, 0.4]) {
      const arm = this.box(0.14, 0.18, 0.48, -1.8 + dx, 0.7, 1.06, orange, this.root, 0.1); arm.rotation.z = -dx * 0.45;
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.line([[-1.8 + sx * 0.2, 0.5, 1 + sz * 0.18], [-1.8 + sx * 0.33, 0.04, 1 + sz * 0.32]], 0.023, this.dark);
    this.table(-1.9, 0.6, -0.65, 1.2, 0.55); this.box(0.55, 0.08, 0.4, -1.9, 0.68, -0.65, this.dark); this.cylinder(0.17, 0.17, 0.013, -1.9, 0.73, -0.65, this.dark);
    this.box(1.3, 0.76, 0.06, -0.1, 1.2, -2.8, this.dark); this.box(0.05, 0.9, 0.05, -0.1, 0.45, -2.8, this.metal);
    for (const x of [-3, -1.2]) { this.box(1.3, 1.6, 0.25, x, 0.8, 5, carpet, this.root, 0.13); this.box(1.05, 0.3, 0.8, x, 0.5, 4.5, lime, this.root, 0.12); for (const dx of [-0.6, 0.6]) this.box(0.15, 1.5, 0.9, x + dx, 0.8, 4.6, carpet, this.root, 0.1); }
    this.plant(-9, 0, 4.6, 0.65); this.plant(-0.4, 0, -4.8, 0.65);
    // Keep the photographed lounge beside the office and away from the cube exhibition.
    const lounge = new THREE.Group(); lounge.add(...this.root.children.slice(loungeStart)); lounge.position.x = -7; this.root.add(lounge); this.batch(lounge);
    const loungeRoof = new THREE.Group(); loungeRoof.add(...this.roof.children.slice(loungeRoofStart)); loungeRoof.position.x = -7; this.roof.add(loungeRoof); this.batch(loungeRoof);
    // Three phone pods: white rounded frames, grey felt, desk and one stool each.
    this.box(8, 3.7, 0.1, -17, 1.85, 7.8, this.wood);
    this.box(7, 0.12, 3.2, -17, 3.35, 10, white, this.roof, 0.12);
    this.area([-17, 3.2, 11], [-17, 0, 9], 5, 2, 4, 0xffe8d1);
    for (let i = 0; i < 3; i++) {
      const x = -18 + i * 1.5, z = 8.7;
      this.platform(1.3, 1.4, x, 0.06, z, carpet);
      this.box(1.3, 2.25, 0.14, x, 1.18, z - 0.7, white, this.root, 0.1);
      for (const dx of [-0.6, 0.6]) this.box(0.12, 2.3, 1.5, x + dx, 1.2, z, white, this.root, 0.08);
      this.box(1.3, 0.15, 1.5, x, 2.35, z, white, this.root, 0.06);
      this.box(1.02, 2.05, 0.025, x, 1.18, z - 0.615, upholstery);
      for (const dx of [-0.525, 0.525]) {
        this.box(0.025, 2.05, 1.24, x + dx, 1.18, z, upholstery);
        this.box(0.025, 0.025, 1.1, x + dx, 2.25, z, this.led);
      }
      this.box(1.04, 0.025, 0.045, x, 2.25, z + 0.55, this.led);
      this.box(0.38, 0.05, 1, x - 0.32, 1.05, z, white);
      this.cylinder(0.2, 0.2, 0.075, x, 0.7, z, upholstery); this.cylinder(0.028, 0.028, 0.59, x, 0.37, z, this.metal); this.cylinder(0.24, 0.24, 0.035, x, 0.09, z, this.metal);
      this.box(0.045, 0.25, 0.34, x + 0.18, 0.89, z, upholstery, this.root, 0.045);
      const podDoor = new THREE.Group(); podDoor.position.set(x - 0.52, 0, z + 0.72); podDoor.rotation.y = i === 2 ? -1 : 0; this.root.add(podDoor);
      this.box(1.04, 2.1, 0.02, 0.52, 1.2, 0, this.glass, podDoor); this.box(0.025, 0.25, 0.035, 0.9, 1.15, 0.05, this.metal, podDoor);
      this.area([x, 2.2, z], [x, 0, z], 0.9, 0.9, i === 2 ? 6 : 1, 0xf1f0e7);
    }
  }
  private landscape() {
    if (this.style === 'company') return;
    const urban = this.style === 'penthouse' || this.style === 'cyberpunk';
    if (urban) {
      const facades = [0x536779, 0x8b8174, 0x3d464e, 0x7c6252].map((color, variant) => {
        const material = new THREE.MeshStandardMaterial({ color, metalness: variant % 2 ? 0.2 : 0.7, roughness: 0.45 });
        material.onBeforeCompile = shader => {
          shader.vertexShader = 'varying vec3 vFacadePosition; varying vec3 vFacadeNormal;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvFacadePosition = (modelMatrix * vec4(position, 1.0)).xyz; vFacadeNormal = abs(mat3(modelMatrix) * normal);');
          shader.fragmentShader = 'varying vec3 vFacadePosition; varying vec3 vFacadeNormal;\n' + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
            vec2 facadeUv = vec2(vFacadeNormal.x > vFacadeNormal.z ? vFacadePosition.z : vFacadePosition.x, vFacadePosition.y) / vec2(${variant % 2 ? '2.4, 3.5' : '1.5, 3.2'});
            vec2 cell = fract(facadeUv), edge = max(fwidth(facadeUv), vec2(0.006));
            vec2 margin = vec2(${variant % 2 ? '0.2, 0.16' : '0.035, 0.09'});
            vec2 opening = smoothstep(margin, margin + edge, cell) * (1.0 - smoothstep(1.0 - margin - edge, 1.0 - margin, cell));
            float windowMask = opening.x * opening.y * (1.0 - step(0.5, vFacadeNormal.y));
            float suite = fract(sin(dot(floor(facadeUv), vec2(127.1,311.7))) * 43758.5453);
            float occupied = step(${this.style === 'cyberpunk' ? '0.58' : '0.84'}, suite);
            diffuseColor.rgb = mix(diffuseColor.rgb * 0.8, vec3(0.11, 0.16, 0.19) * (0.7 + suite * 0.5), windowMask);
          `);
          shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.78, 0.2, windowMask);');
          shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(${variant % 2 ? '0.8, 0.53, 0.29' : '0.5, 0.64, 0.75'}) * windowMask * occupied * (0.1 + suite * 0.3);`);
        };
        material.customProgramCacheKey = () => 'space-city-facade-' + variant + this.style;
        return material;
      });
      this.box(41, 119, 29, -9, -60, -2.5, facades[0], this.root, 0);
      for (let y = -118; y < 0; y += 3.2) this.box(41.3, 0.16, 29.3, -9, y, -2.5, this.metal, this.root, 0);
      for (let x = -28; x < 11; x += 1.8) this.box(0.07, 118, 0.07, x, -60, 12.1, this.metal);
      for (let gx = -5; gx <= 5; gx++) for (let gz = -5; gz <= 5; gz++) {
        if (Math.abs(gx) <= 1 && Math.abs(gz) <= 1) continue;
        const i = (gx + 5) * 11 + gz + 5, x = gx * 31 - 9, z = gz * 35, h = 25 + (Math.sin(i * 127.1) * 43758.5453 % 1 + 1) % 1 * 112, w = 13 + i % 8, d = 16 + i % 9, facade = facades[i % 4];
        const setback = i % 3 === 0;
        this.box(w, h * (setback ? 0.72 : 1), d, x, -120 + h * (setback ? 0.36 : 0.5), z, facade, this.root, 0);
        if (setback) {
          this.box(w * 0.76, h * 0.28, d * 0.72, x, -120 + h * 0.86, z, facade, this.root, 0);
          this.box(w + 0.5, 0.4, d + 0.5, x, -120 + h * 0.72, z, this.metal, this.root, 0);
        }
        if (i % 5 === 0) {
          this.box(w * 0.55, 5, d * 0.55, x, -117.5 + h, z, facade, this.root, 0);
          this.box(w * 0.3, 4, d * 0.3, x, -113 + h, z, facade, this.root, 0);
        }
        this.box(w * 0.36, 1.8, d * 0.26, x, -119.1 + h, z, this.dark, this.root, 0);
        if (i % 4 === 0) { this.cylinder(1, 1, 2, x + 3, -117.5 + h, z - 3, this.dark); this.cylinder(0.08, 0.08, 7, x, -115.5 + h, z, this.metal); }
        this.box(w + 3, 0.16, d + 3, x, -119.9, z, this.stone, this.root, 0);
      }
      this.box(600, 0.5, 600, 0, -120, 0, this.dark, this.root, 0);
      for (let lane = -5; lane < 5; lane++) {
        this.box(0.12, 0.01, 390, lane * 31 + 6.5, -119.73, 0, this.ceramic, this.root, 0);
        this.box(355, 0.01, 0.12, -9, -119.73, lane * 35 + 17.5, this.ceramic, this.root, 0);
      }
      for (const z of [-18.1, 13.1]) this.box(43, 1.15, 0.025, -9, 0.65, z, this.glass);
      for (const x of [-28, -20, -12, -4, 4]) {
        this.box(3.8, 0.5, 1.3, x, 0.18, 11.6, this.stone);
        this.model('potted_plant_01', x, 0.12, 11.6, 1.9, x, true);
      }
    } else {
      for (const [x, z, size] of [[-39, -20, 2.7], [-28, -30, 3.2], [-12, -28, 2.5], [6, -27, 3], [25, -19, 2.6], [32, 3, 2.8], [-41, 14, 3], [-31, 31, 2.4]]) this.tree(x, -0.6, z, size);
      const ground = new THREE.MeshStandardMaterial({ color: 0x526048, roughness: 1, vertexColors: true });
      const terrain = new THREE.PlaneGeometry(800, 800, 96, 96); terrain.rotateX(-Math.PI / 2);
      const vertices = terrain.getAttribute('position');
      const colors = new Float32Array(vertices.count * 3), tint = new THREE.Color();
      for (let i = 0; i < vertices.count; i++) {
        const x = vertices.getX(i), z = vertices.getZ(i), rise = Math.min(1, Math.max(0, (Math.hypot(x + 9, z + 3) - 65) / 100));
        vertices.setY(i, -0.65 + rise * (13 + 11 * Math.sin(x / 43) * Math.cos(z / 59) + 5 * Math.sin(x / 17 + z / 31)));
        tint.setHSL(0.22, 0.15, 0.48 + 0.08 * Math.sin(x * 0.37) * Math.cos(z * 0.23)); tint.toArray(colors, i * 3);
      }
      terrain.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      terrain.computeVertexNormals();
      const hills = new THREE.Mesh(terrain, ground); hills.receiveShadow = true; this.root.add(hills);
      for (let row = 0; row < 5; row++) for (let col = 0; col < 8; col++) this.box(4.95, 0.15, 2.45, -26.5 + col * 5, -0.42, 14.5 + row * 2.5, this.stone, this.root, 0);
      for (let i = 0; i < 3; i++) this.platform(8, 0.75, 0, -0.04 - i * 0.12, 13.4 + i * 0.8, this.stone);
      for (const x of [-31.8, 15.6]) {
        this.box(2.2, 0.5, 36, x, -0.34, 5, this.stone);
        this.box(1.9, 0.02, 35.7, x, -0.08, 5, this.dark);
        for (let z = -11; z < 23; z += 2.5) this.model('potted_plant_01', x + Math.sin(z) * 0.3, -0.7, z, 2.1 + (z + 11) % 3 * 0.15, z, true);
      }
      const blades: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 9; i++) {
        const blade = new THREE.PlaneGeometry(0.018, 0.55, 1, 5), p = blade.attributes.position;
        for (let v = 0; v < p.count; v++) { const t = p.getY(v) / 0.55 + 0.5; p.setXYZ(v, p.getX(v) * (1 - t), t * (0.28 + i % 4 * 0.06), t * t * (0.16 + i % 3 * 0.06)); }
        blade.rotateY(i * 2.4); blade.computeVertexNormals(); blades.push(blade);
      }
      const grassShape = mergeGeometries(blades); blades.forEach(g => g.dispose());
      const grass = new THREE.InstancedMesh(grassShape, new THREE.MeshStandardMaterial({ color: 0x5e6950, roughness: 1, side: THREE.DoubleSide }), 700);
      const tuft = new THREE.Object3D();
      for (let i = 0; i < 700; i++) {
        tuft.position.set(i % 2 ? -33.8 - i % 17 * 0.14 : 17.6 + i % 17 * 0.14, -0.62, -13 + (i * 31 % 380) * 0.1);
        tuft.rotation.set(0, i * 2.4, 0); tuft.scale.setScalar(0.65 + i % 11 * 0.075); tuft.updateMatrix(); grass.setMatrixAt(i, tuft.matrix);
      }
      grass.castShadow = grass.receiveShadow = true; this.root.add(grass);
    }
  }

  private batch(parent: THREE.Group) {
    const groups = new Map<THREE.Material, THREE.Mesh[]>();
    for (const o of [...parent.children]) if (o instanceof THREE.Mesh && !(o instanceof THREE.InstancedMesh) && o.type !== 'Reflector' && !this.surfaces.includes(o) && !o.userData.spaceBackdrop && !Array.isArray(o.material) && !o.material.transparent) {
      const group = groups.get(o.material) ?? []; group.push(o); groups.set(o.material, group);
    }
    for (const [material, meshes] of groups) {
      if (meshes.length < 2) continue;
      const geometries = meshes.map(m => { m.updateMatrix(); const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); geo.applyMatrix4(m.matrix); return geo; });
      const merged = mergeGeometries(geometries);
      geometries.forEach(g => g.dispose());
      if (!merged) continue;
      for (const mesh of meshes) { mesh.removeFromParent(); mesh.geometry.dispose(); }
      const mesh = new THREE.Mesh(merged, material); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
    }
  }
  private mirror(width: number, height: number, position: [number, number, number], parent = this.root) {
    const horizontal = height >= 10 || position[1] < 0.1;
    const mirror = new Reflector(new THREE.PlaneGeometry(width, height), { color: horizontal ? this.palette.mirror : 0xffffff, textureWidth: 512, textureHeight: 512, clipBias: 0.001, multisample: 0 });
    const material = mirror.material as THREE.ShaderMaterial;
    material.uniforms.uTexel = { value: new THREE.Vector2(1 / 1024, 1 / 1024) };
    material.uniforms.uPolish = { value: horizontal ? 0.58 : 0.94 };
    material.vertexShader = material.vertexShader.replace('varying vec4 vUv;', 'varying vec4 vUv; varying vec3 vMirrorWorld;').replace('vUv =', 'vMirrorWorld = (modelMatrix * vec4(position,1.0)).xyz; vUv =');
    material.fragmentShader = material.fragmentShader.replace('varying vec4 vUv;', 'varying vec4 vUv; varying vec3 vMirrorWorld; uniform vec2 uTexel; uniform float uPolish;').replace('vec4 base = texture2DProj( tDiffuse, vUv );', `
        vec2 uv = vUv.xy / vUv.w;
        vec2 stepUv = uTexel * ${horizontal ? '1.25' : '0.45'};
        vec4 base = texture2D(tDiffuse,uv) * 0.5;
        base += (texture2D(tDiffuse,uv+vec2(stepUv.x,0)) + texture2D(tDiffuse,uv-vec2(stepUv.x,0)) + texture2D(tDiffuse,uv+vec2(0,stepUv.y)) + texture2D(tDiffuse,uv-vec2(0,stepUv.y))) * 0.125;
      `).replace('vec4( blendOverlay( base.rgb, color ), 1.0 )', horizontal ? `vec4(mix(color * (0.45 + 0.08 * sin(vMirrorWorld.x * 1.6 + sin(vMirrorWorld.z * 0.7) * 3.0)), base.rgb, uPolish + 0.25 * pow(1.0 - abs(normalize(cameraPosition-vMirrorWorld).y), 3.0)), 1.0)` : 'vec4(mix(color * 0.28, base.rgb, uPolish), 1.0)');
    mirror.position.set(...position);
    const reflect = mirror.onBeforeRender;
    mirror.onBeforeRender = (...args) => {
      // ponytail: one bounce per mirror; recursive mirror rooms need a pass budget.
      const hidden = [...this.mirrors, ...this.helpers];
      const visibility = hidden.map(o => o.visible);
      hidden.forEach(o => { o.visible = false; });
      try { reflect.apply(mirror, args); }
      finally { hidden.forEach((o, i) => { o.visible = visibility[i]; }); }
    };
    parent.add(mirror);
    this.mirrors.push(mirror);
    return mirror;
  }

  resize(width: number) {
    const size = width < 600 ? 384 : 768;
    for (const mirror of this.mirrors) {
      mirror.getRenderTarget().setSize(size, size);
      (mirror.material as THREE.ShaderMaterial).uniforms.uTexel.value.set(1 / size, 1 / size);
    }
  }

  update(camera: THREE.Camera, cutaway: boolean) {
    this.roof.visible = !cutaway;
    this.back.visible = true;
    for (const mirror of this.mirrors) {
      const distance = camera.position.distanceTo(mirror.position);
      mirror.visible = this.style === 'company' ? mirror !== this.floor && distance < 14 : (mirror === this.floor ? distance < 85 : mirror.position.y > 5 ? distance < 23 : distance < 85);
    }
    this.glass.opacity = cutaway ? 0.035 : 0.075;
  }

  dispose() {
    this.disposed = true;
    this.textures.forEach(t => t.dispose());
    this.root.removeFromParent();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.root.traverse(o => {
      if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
        geometries.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
      }
    });
    for (const mirror of this.mirrors) {
      for (const m of Array.isArray(mirror.material) ? mirror.material : [mirror.material]) materials.delete(m);
      mirror.dispose();
    }
    geometries.forEach(g => g.dispose());
    materials.forEach(m => { for (const value of Object.values(m)) if (value instanceof THREE.Texture) value.dispose(); m.dispose(); });
  }
}
