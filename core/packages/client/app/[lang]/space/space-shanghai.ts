import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Water } from 'three/addons/objects/Water.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RIVER_COLORS, type RiverColor, type Vec3, type Weather } from './space-state';
import { createShanghaiBridges, createShanghaiRoads, type ShanghaiRoad } from './space-shanghai-bridges';
import { shanghaiShape as shape, type ShanghaiPolygon as Polygon } from './space-shanghai-geometry';
import { createShanghaiArchitecture, setShanghaiClockTime, SHANGHAI_ARCHITECTURE_IDS, applyPeaceWash } from './space-shanghai-architecture';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { addShanghaiSigns } from './space-shanghai-signs';
import { createBundStreets, createShanghaiQuays, shanghaiStreetMaterial, applyShanghaiMarking } from './space-shanghai-streets';
import { createShanghaiSupertalls, glazing } from './space-shanghai-supertalls';
import { shanghaiWindowTexture, bundStone, roofMetal } from './space-shanghai-facades';
import { applyNewsStone } from './space-shanghai-bund';
import { applyCommercialFixtures } from './space-shanghai-commercial-bank';
import { loadSpaceBlender, SPACE_ASSET_SOURCE } from './space-blender';
import { ShanghaiTraffic } from './space-shanghai-traffic';
import { ShanghaiFacadeLighting } from './space-shanghai-lighting';

type Point = [number, number];
type Road = ShanghaiRoad;
export type ShanghaiData = { version: number; origin: Point; river: Point[]; polygons: Polygon[]; roads: Road[] };
export const SHANGHAI_VIEWS = {
  northBund: { zh: '北外滩', en: 'North Bund', camera: [450, 210, 80], target: [-150, 180, 1650] },
  lujiazui: { zh: '陆家嘴', en: 'Lujiazui', camera: [-1210, 215, 2440], target: [50, 255, 1670] },
  jinmao: { zh: '金茂大厦', en: 'Jin Mao Tower', camera: [-273, 241, 1353], target: [218, 217, 1796] },
  swfc: { zh: '环球金融中心', en: 'World Financial Center', camera: [775, 300, 1215], target: [371, 258, 1871] },
  shanghaiTower: { zh: '上海中心', en: 'Shanghai Tower', camera: [-585, 380, 2498], target: [206, 326, 1982] },
  bund: { zh: '外滩建筑群', en: 'Bund architecture', camera: [-680, 110, 1860], target: [-1340, 35, 1580] },
  peace: { zh: '和平饭店', en: 'Peace Hotel', camera: [-1165, 64, 1475], target: [-1345, 36, 1367] },
  customs: { zh: '江海关', en: 'Customs House', camera: [-1188, 49, 1678], target: [-1301, 37, 1644] },
  hsbc: { zh: '汇丰大楼', en: 'HSBC Building', camera: [-1169, 22, 1765], target: [-1302, 20, 1718] },
  commercialBank: { zh: '通商银行', en: 'Commercial Bank', camera: [-1188.28, 11.28, 1834.96], target: [-1228.35, 10.34, 1853.15] },
  tomson: { zh: '汤臣一品', en: 'Tomson Riviera', camera: [-570, 115, 2260], target: [-185, 80, 2050] },
  tomsonGarden: { zh: '汤臣庭院', en: 'Tomson garden', camera: [-257, 18, 2095], target: [-205, 3, 2064] },
  waibaidu: { zh: '外白渡桥', en: 'Waibaidu Bridge', camera: [-1130, 45, 965], target: [-1272, 10, 900] },
  nanpu: { zh: '南浦大桥', en: 'Nanpu Bridge', camera: [610, 175, 4540], target: [174, 76, 5106] },
  nanpuApproach: { zh: '南浦螺旋引桥', en: 'Nanpu spiral approach', camera: [-455, 165, 4560], target: [-150, 30, 4840] },
  lupu: { zh: '卢浦大桥', en: 'Lupu Bridge', camera: [-2550, 175, 7520], target: [-2160, 62, 6930] },
  xuhui: { zh: '徐汇滨江', en: 'Xuhui waterfront', camera: [-2790, 190, 8560], target: [-4040, 100, 9740] },
  // Xujiahui / South Wanping Road, WGS84 OSM way/1442066946 bounds centre.
  xujiahui: { zh: '徐家汇', en: 'Xujiahui', camera: [-5010, 290, 6900], target: [-5375.8, 25, 6478.1] },
  qiantan: { zh: '前滩', en: 'Qiantan', camera: [-4020, 210, 11100], target: [-2520, 155, 10400] },
  huangpu: { zh: '黄浦江全景', en: 'Huangpu overview', camera: [-7600, 7200, 14400], target: [-1200, 0, 5450] },
} satisfies Record<string, { zh: string; en: string; camera: Vec3; target: Vec3 }>;
export type ShanghaiView = keyof typeof SHANGHAI_VIEWS;

export function validateShanghaiData(raw: unknown): asserts raw is ShanghaiData {
  const d = raw as ShanghaiData;
  const point = (p: Point) => Array.isArray(p) && p.length === 2 && p.every(n => Number.isFinite(n) && Math.abs(n) < 20000);
  const ring = (p: Point[]) => Array.isArray(p) && p.length >= 3 && p.length < 20000 && p.every(point);
  if (!d || d.version !== 1 || !point(d.origin) || Math.abs(d.origin[0]) > 180 || Math.abs(d.origin[1]) > 90 || !Array.isArray(d.river) || d.river.length < 2 || d.river.length > 20000 || !d.river.every(point) || !d.river.some(p => p[0] !== d.river[0][0] || p[1] !== d.river[0][1]) ||
    !Array.isArray(d.polygons) || !d.polygons.length || d.polygons.length > 50000 || d.polygons.some(p => !p || !ring(p.points) || p.holes !== undefined && (!Array.isArray(p.holes) || p.holes.some(h => !ring(h))) ||
      !['building', 'water', 'green'].includes(p.kind) || p.kind === 'building' && (!Number.isFinite(p.height) || p.height! < 0 || p.height! > 650 || !Number.isFinite(p.minHeight) || p.minHeight! < 0 || p.minHeight! > p.height!)) ||
    !Array.isArray(d.roads) || d.roads.length > 50000 || d.roads.some(r => !r || !Array.isArray(r.points) || r.points.length < 2 || r.points.length > 20000 || !r.points.every(point) || !Number.isFinite(r.width) || r.width <= 0 || r.width > 100 || typeof r.bridge !== 'boolean' || r.layer !== undefined && (!Number.isInteger(r.layer) || r.layer < -5 || r.layer > 5) || r.oneway !== undefined && ![-1,0,1].includes(r.oneway) || r.lanes !== undefined && (!Number.isInteger(r.lanes) || r.lanes < 1 || r.lanes > 12))) throw new Error('Invalid Shanghai map');
}

const landmarks = [
  { x: -365, z: 1280, radius: 78, name: 'Oriental Pearl' },
  { x: 206, z: 1982, radius: 70, name: 'Shanghai Tower' },
  { x: 371, z: 1871, radius: 63, name: 'Shanghai World Financial Center' },
  { x: 218, z: 1796, radius: 51, name: 'Jin Mao Tower' },
];

// Rendering uses local metres with south as +Z. No GCJ/BD tile coordinates are mixed in.
export class ShanghaiScene {
  readonly root = new THREE.Group();
  readonly ready: Promise<void>;
  route: THREE.CurvePath<THREE.Vector3> | null = null;
  cruising = false;
  distance = 0;
  private elapsed = 0;
  private lastTime = 0;
  private abort = new AbortController();
  private disposed = false;
  private water?: Reflector & { material: THREE.ShaderMaterial };
  private boats?: THREE.InstancedMesh;
  private boatDetails: THREE.InstancedMesh[] = [];
  private traffic?: ShanghaiTraffic;
  private night = { value: 0 };
  private timeOfDay = '09:00';
  private textures = new Set<THREE.Texture>();
  private officeWindows = shanghaiWindowTexture(true);
  private homeWindows = shanghaiWindowTexture(false);
  private materials = new Set<THREE.Material>();
  private facadeLighting: ShanghaiFacadeLighting;
  private batches = new Map<string, { geometries: THREE.BufferGeometry[]; material: THREE.Material }>();

  constructor(private narrow: boolean, private changed: () => void, private source: 'blender' | 'bootstrap' = SPACE_ASSET_SOURCE) {
    this.root.name = 'Shanghai Huangpu River';
    this.facadeLighting = new ShanghaiFacadeLighting(narrow);
    this.root.add(this.facadeLighting.root);
    this.textures.add(this.officeWindows); this.textures.add(this.homeWindows);
    this.ready = this.load();
  }

  private material(color: number, metalness = 0, roughness = .8, illumination = 0, target?: THREE.MeshStandardMaterial) {
    const m = target ?? new THREE.MeshStandardMaterial({ color, metalness, roughness });
    m.userData.cityFacadeLight = this.facadeLighting.active;
    if (illumination) {
      m.onBeforeCompile = shader => {
        shader.uniforms.cityNight = this.night;
        shader.fragmentShader = 'uniform float cityNight;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance+=diffuse*cityNight*${illumination.toFixed(3)};`);
      };
      m.customProgramCacheKey = () => `shanghai-illumination-${illumination}`;
    }
    this.materials.add(m); return m;
  }

  private facade(color: number, glass: boolean, tower = false, target?: THREE.MeshStandardMaterial) {
    const m = this.material(color, glass ? .58 : .06, glass ? .3 : .83, 0, target);
    m.onBeforeCompile = shader => {
      shader.uniforms.cityNight = this.night;
      shader.uniforms.cityWindows = { value: glass ? this.officeWindows : this.homeWindows };
      shader.vertexShader = 'attribute vec3 buildingData; varying vec3 cityBuilding,cityPosition,cityNormal; varying vec2 cityUV;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ncityPosition=(modelMatrix*vec4(position,1.)).xyz; cityNormal=normalize(mat3(modelMatrix)*normal); cityUV=uv; cityBuilding=buildingData;');
      shader.fragmentShader = 'varying vec3 cityBuilding,cityPosition,cityNormal; varying vec2 cityUV; uniform float cityNight; uniform sampler2D cityWindows;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        vec2 facadeUV=${tower ? 'cityUV' : 'vec2(abs(cityNormal.x)>.6?cityPosition.z:cityPosition.x,cityPosition.y)'}/vec2(${glass ? '2.8,3.8' : '3.4,3.2'});
        vec2 edge=abs(fract(facadeUV)-.5), aa=fwidth(facadeUV);
        float resolved=1.-smoothstep(.3,.85,max(aa.x,aa.y));
        float windowMask=(1.-smoothstep(.39-aa.x,.39+aa.x,edge.x))*(1.-smoothstep(.36-aa.y,.36+aa.y,edge.y));
        windowMask=mix(.5616,windowMask,resolved)*(1.-smoothstep(.5,.85,abs(cityNormal.y)));
        diffuseColor.rgb*=mix(1.,${glass ? '.66' : '.32'},windowMask);
        // Each footprint owns a seed, height and base. Offices light up in floor
        // groups; homes in separate rooms, with one colour temperature per block.
        // Keep the per-building atlas offset constant across every triangle.
        float seed=floor(cityBuilding.x+.5), localHeight=max(0.,cityPosition.y-cityBuilding.z);
        float office=step(65.,cityBuilding.y);
        float lit=texture2D(cityWindows,(facadeUV+vec2(mod(seed,32.),floor(seed/32.)))/vec2(32.,64.)).r;
        vec3 lampColor=mix(vec3(1.,.66,.34),vec3(.65,.82,1.),step(.57,fract(seed*.017)) * office);
        float wall=1.-smoothstep(.5,.85,abs(cityNormal.y));
        float crownDistance=abs(localHeight-cityBuilding.y+1.2);
        float crownAA=max(fwidth(localHeight),.2);
        float crown=(1.-smoothstep(.35,.35+crownAA,crownDistance))*min(1.,1.4/crownAA)*office*step(.72,fract(seed*.031));
      `);
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float occupancy=mix(.12,1.,smoothstep(.15,.85,fract(seed*.043)));
        totalEmissiveRadiance+=cityNight*wall*(lampColor*lit*.09*occupancy + vec3(1.,.52,.18)*crown*.9 + vec3(.055,.029,.012)*exp(-localHeight*.14));
      `);
    };
    m.customProgramCacheKey = () => `shanghai-facade-${glass}-${tower}`;
    return m;
  }

  private batch(key: string, geometry: THREE.BufferGeometry, material: THREE.Material) {
    // All batches share the same attributes; indexed shapes become triangle soup once.
    if (geometry.index) { const g = geometry.toNonIndexed(); geometry.dispose(); geometry = g; }
    geometry.clearGroups();
    const b = this.batches.get(key) ?? { geometries: [], material }; b.geometries.push(geometry); this.batches.set(key, b);
  }

  private flush() {
    for (const { geometries, material } of this.batches.values()) {
      const geometry = mergeGeometries(geometries); geometries.forEach(g => g.dispose());
      if (!geometry) throw new Error('Shanghai geometry merge failed');
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; this.root.add(mesh);
    }
    this.batches.clear();
  }

  private async load() {
    try {
      const response = await fetch('/assets/space/shanghai-v1/huangpu.json?v=20260908-traffic', { signal: this.abort.signal });
      if (!response.ok) throw new Error(`Shanghai map HTTP ${response.status}`);
      const data: unknown = await response.json(); validateShanghaiData(data);
      if (this.disposed) return;
      this.route = new THREE.CurvePath();
      for (let i = 1; i < data.river.length; i++) this.route.add(new THREE.LineCurve3(new THREE.Vector3(data.river[i - 1][0], 0, data.river[i - 1][1]), new THREE.Vector3(data.river[i][0], 0, data.river[i][1])));
      if (this.source === 'blender') { await this.loadBlender(data); return; }
      const facades = [this.facade(0xc2beb0, false), this.facade(0xa4a49b, false), this.facade(0x7e9caa, true), this.facade(0xadb7b6, true)];
      const grass = this.material(0x536548), pavement = this.material(0x9a9788);
      // Draw the city ground as a background, before water and structures, without
      // storing depth: at city distances the buffer cannot reliably distinguish
      // the river from the ground only 0.5 m below it, even with tessellation.
      pavement.depthWrite = false;
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(200000, 200000), pavement);
      ground.renderOrder = -1;
      ground.rotation.x = -Math.PI / 2; ground.position.set(-2000, -1, 6000); ground.receiveShadow = true; this.root.add(ground);
      const waters: THREE.Shape[] = [];
      for (let i = 0; i < data.polygons.length; i++) {
        const p = data.polygons[i], [x, z] = p.points[0];
        if (p.kind === 'water') { waters.push(shape(p)); continue; }
        if (p.kind === 'building' && SHANGHAI_ARCHITECTURE_IDS.has(p.id)) continue;
        if (p.kind === 'building' && landmarks.some(l => p.points.every(([px, pz]) => Math.hypot(px - l.x, pz - l.z) < l.radius))) continue;
        if (p.kind === 'building' && p.height! <= p.minHeight!) continue;
        const geometry = p.kind === 'building' ? new THREE.ExtrudeGeometry(shape(p), { depth: p.height! - p.minHeight!, bevelEnabled: false, steps: 1 }) : new THREE.ShapeGeometry(shape(p));
        geometry.rotateX(-Math.PI / 2); geometry.translate(0, p.kind === 'building' ? -.65 + p.minHeight! : -.75, 0);
        if (p.kind === 'building') {
          const values = new Float32Array(geometry.attributes.position.count * 3);
          const seed = [...p.id].reduce((hash, c) => (hash * 31 + c.charCodeAt(0)) % 9973, 0);
          for (let j = 0; j < values.length; j += 3) values.set([seed, p.height! - p.minHeight!, p.minHeight! - .65], j);
          geometry.setAttribute('buildingData', new THREE.BufferAttribute(values, 3));
        }
        const variant = p.kind === 'green' ? 4 : p.height! > 65 ? 2 + i % 2 : i % 2;
        this.batch(`${Math.floor(x / 2000)}:${Math.floor(z / 2000)}:${variant}`, geometry, p.kind === 'green' ? grass : facades[variant]);
        if (i % 700 === 699) { await new Promise(resolve => setTimeout(resolve, 0)); if (this.disposed) return; }
      }
      this.root.add(createShanghaiRoads(data.roads, this.material.bind(this)));
      this.root.add(createBundStreets(data.roads, data.polygons, this.material.bind(this)));
      this.root.add(createShanghaiQuays(data.polygons, this.material.bind(this)));
      this.traffic = new ShanghaiTraffic(data.roads, this.material.bind(this), this.narrow);
      this.root.add(this.traffic.root);
      this.flush();
      const normals = await new THREE.TextureLoader().loadAsync('/assets/space/shanghai-v1/waternormals.jpg');
      if (this.disposed) { normals.dispose(); return; }
      this.textures.add(normals);
      this.makeWater(waters, normals); this.makeLandmarks(this.material(0xadb7b6, .58, .3));
      this.root.add(createShanghaiBridges(this.material.bind(this)));
      const architecture = createShanghaiArchitecture(data.polygons, this.material.bind(this), data.roads);
      this.root.add(architecture);
      this.facadeLighting.register(architecture);
      const fontResponse = await fetch('/assets/space/shanghai-v1/sign-font.json?v=20260908b', { signal: this.abort.signal });
      if (!fontResponse.ok) throw new Error(`Bund sign font HTTP ${fontResponse.status}`);
      const fontData = await fontResponse.json();
      if (this.disposed) return;
      addShanghaiSigns(architecture, new FontLoader().parse(fontData), this.material.bind(this));
      this.makeTrees(data.polygons, grass); this.makeBoats();
      this.changed();
    } catch (error) { if (!this.disposed) { this.dispose(); throw error; } }
  }

  private async loadBlender(data: ShanghaiData) {
    const { scene } = await loadSpaceBlender('shanghai');
    // Attach first so the same disposer owns even an interrupted or failed load.
    this.root.add(scene);
    if (this.disposed) { this.dispose(); return; }
    if (scene.userData.space_contract !== 2) throw new Error('Shanghai needs Blender contract 2');
    this.root.userData.spaceSource = 'blender';
    const nodes = new Map<string, THREE.Object3D>();
    scene.traverse(o => {
      nodes.set(o.userData.spaceId, o);
      if (typeof o.userData.spaceName === 'string') o.name = o.userData.spaceName;
      // Legacy bootstrap predates spaceName. glTF sanitizes spaces in node names.
      if (/^Customs_(hour|minute)_hand$/.test(o.name)) o.name = o.name.replaceAll('_', ' ');
      if (typeof o.userData.spaceVisible === 'boolean') o.visible = o.userData.spaceVisible;
      if (Number.isFinite(o.userData.spaceRenderOrder)) o.renderOrder = o.userData.spaceRenderOrder;
      if (!(o instanceof THREE.Mesh)) return;
      o.castShadow = o.userData.spaceCastShadow === true;
      o.receiveShadow = o.userData.spaceReceiveShadow === true;
      for (const [from, to] of [['_buildingdata', 'buildingData'], ['_bundbuildingid', 'bundBuildingId'], ['_bundlighttop', 'bundLightTop']]) {
        const attribute = o.geometry.getAttribute(from);
        if (attribute) o.geometry.setAttribute(to, attribute);
      }
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        this.materials.add(m);
        for (const value of Object.values(m)) if (value instanceof THREE.Texture) this.textures.add(value);
      }
    });
    // Stable IDs belong to the one-time migration contract, independent of
    // artist renaming/reordering. Their geometry remains editable in the source.
    const pool = nodes.get('root/0'), traffic = nodes.get('root/5');
    const water = nodes.get('root/131'), boats = ['149', '150', '151', '152'].map(id => nodes.get(`root/${id}`));
    if (!pool || !traffic || !(water instanceof THREE.Mesh) || boats.some(o => !(o instanceof THREE.InstancedMesh))) throw new Error(`Missing Shanghai animation bindings: ${[pool, traffic, water, ...boats].map(o => `${o?.userData.spaceId}:${o?.type}`).join(', ')}`);
    pool.removeFromParent();
    scene.updateWorldMatrix(true, true);
    const bank = [...nodes.values()].find(o => o.userData.bundNumber === 6);
    const polygon = data.polygons.find(p => p.id === 'way/178408827');
    const bankWidth = bank?.userData.frontage as number;
    const annex = bank && polygon ? polygon.points.map(([x, z]) => bank.worldToLocal(new THREE.Vector3(x, 0, z))).filter(p => p.x > bankWidth / 2 - .2 && p.z < -.5) : [];
    const left = Math.min(...annex.map(p => p.x)), right = Math.max(...annex.map(p => p.x)), wingZ = Math.min(...annex.map(p => p.z));
    if (![bankWidth, left, right, wingZ].every(Number.isFinite) || right - left < 1) throw new Error('Invalid Commercial Bank lighting binding');
    const bankLights = { width: bankWidth, axes: bank!.userData.groundOpeningCenters as number[], wingAxes: [.24, .5, .76].map(t => THREE.MathUtils.lerp(left, right, t)), wingZ };
    for (const m of this.materials) {
      if (typeof m.userData.spaceDepthWrite === 'boolean') m.depthWrite = m.userData.spaceDepthWrite;
      if (m instanceof THREE.MeshStandardMaterial && !m.userData.spaceRuntimeShader) this.restoreBlenderMaterial(m, bankLights);
    }
    this.traffic = new ShanghaiTraffic(data.roads, this.material.bind(this), this.narrow, traffic);
    this.root.add(this.traffic.root);
    this.boats = boats[0] as THREE.InstancedMesh;
    this.boatDetails = boats.slice(1) as THREE.InstancedMesh[];
    for (const part of this.boatDetails) part.instanceMatrix = this.boats.instanceMatrix;
    const normals = await new THREE.TextureLoader().loadAsync('/assets/space/shanghai-v1/waternormals.jpg');
    this.textures.add(normals);
    if (this.disposed) { this.dispose(); return; }
    this.makeWater(water.geometry, normals);
    this.water!.position.copy(water.position); this.water!.quaternion.copy(water.quaternion); this.water!.scale.copy(water.scale);
    this.water!.renderOrder = water.renderOrder;
    water.parent!.add(this.water!); water.removeFromParent();
    this.facadeLighting.register(scene);
    this.changed();
  }

  private restoreBlenderMaterial(m: THREE.MeshStandardMaterial, bank: { width: number; axes: number[]; wingAxes: number[]; wingZ: number }) {
    const key = String(m.userData.spaceShaderKey ?? '').replace(/^traffic-/, '');
    const factory = (color: number, metal?: number, rough?: number, light?: number) => this.material(color, metal, rough, light, m);
    const facade = /^shanghai-facade-(true|false)-(true|false)$/.exec(key);
    const stone = /-bund-stone-shadowed-([\d.]+)-(true|false)-([\d.,]*)-([\d.]+)/.exec(key);
    const roof = /-bund-roof-shadowed-([\d.]+)-([\d.]+)/.exec(key);
    const street = /-bund-street-(true|false)-(true|false)/.exec(key);
    const tower = /-supertall-glass-([\d.]+)-([\d.]+)-(true|false)/.exec(key);
    if (facade) this.facade(m.color.getHex(), facade[1] === 'true', facade[2] === 'true', m);
    else if (stone) {
      bundStone(factory, m.color.getHex(), Number(stone[1]), stone[2] === 'true', stone[3] ? stone[3].split(',').map(Number) : [], Number(stone[4]));
      if (key.endsWith('-peace-riverfront-wash')) applyPeaceWash(m);
      if (key.endsWith('-news-two-stone-zones')) applyNewsStone(m);
      if (key.includes('-commercial-bank-fixtures-')) applyCommercialFixtures(m, bank.width, bank.axes, bank.wingAxes, bank.wingZ);
    } else if (roof) roofMetal(factory, m.color.getHex(), Number(roof[1]), Number(roof[2]));
    else if (street) shanghaiStreetMaterial(factory, street[1] === 'true', street[2] === 'true');
    else if (tower) glazing(factory, this.officeWindows, m.color.getHex(), Number(tower[1]), Number(tower[2]), tower[3] === 'true');
    else if (key.endsWith('-bund-marking-aa')) applyShanghaiMarking(m);
    else if (key === 'oriental-pearl-led') this.pearlMaterial(m);
    else if (key === 'shanghai-lit-boat-cabin') this.cabinMaterial(m);
    else {
      const illumination = /^shanghai-illumination-([\d.]+)$/.exec(key);
      if (illumination) factory(m.color.getHex(), m.metalness, m.roughness, Number(illumination[1]));
      else if (key && !key.includes('onBeforeCompile') && !key.includes('trafficVisibility')) throw new Error(`Unsupported Blender material: ${key}`);
    }
    m.needsUpdate = true;
  }

  private makeWater(shapes: THREE.Shape[] | THREE.BufferGeometry, normals: THREE.Texture) {
    // Three.js Water's bundled normal map is served locally, including mipmaps.
    normals.wrapS = normals.wrapT = THREE.RepeatWrapping; normals.anisotropy = 4; normals.needsUpdate = true;
    const geometry = shapes instanceof THREE.BufferGeometry ? shapes : new THREE.ShapeGeometry(shapes);
    const template = new Water(geometry, { waterNormals: normals, waterColor: 0x4d5746, sunColor: 0xffebca, sunDirection: new THREE.Vector3(-.5, .55, .5).normalize(), distortionScale: 1.2, fog: true });
    // Reuse Water's shader with Reflector's public dispose/getRenderTarget lifecycle.
    // The template is never rendered and therefore allocates no GPU render target.
    const source = template.material;
    const uniforms = { ...source.uniforms }; delete uniforms.mirrorSampler;
    // Reflector already includes modelMatrix in textureMatrix; Water normally does not.
    const vertexShader = source.vertexShader.replace('mirrorCoord = textureMatrix * mirrorCoord;', 'mirrorCoord = textureMatrix * vec4( position, 1.0 );');
    this.water = new Reflector(geometry, { textureWidth: this.narrow ? 512 : 1024, textureHeight: this.narrow ? 512 : 1024, multisample: 0,
      shader: { name: 'HuangpuWater', uniforms: { ...uniforms, riverSlope: { value: .28 }, riverTint: { value: 0 }, riverNight: this.night, tDiffuse: { value: null }, color: { value: new THREE.Color() } }, vertexShader,
        fragmentShader: ('uniform float riverSlope, riverTint, riverNight;\n' + source.fragmentShader).replaceAll('mirrorSampler', 'tDiffuse')
          // Retain metre-scale ripples and add a resolved, broader wave scale so
          // night reflections break up even from the high drone viewpoints.
          .replace('vec4 noise = getNoise( worldPosition.xz * size );', 'vec4 noise = mix(getNoise(worldPosition.xz*size),getNoise(worldPosition.xz*2.4),.45);')
          .replace('( 0.001 + 1.0 / distance )', '( 0.004 + 1.0 / distance )')
          .replace('noise.xzy * vec3( 1.5, 1.0, 1.5 )', 'noise.xzy * vec3( riverSlope, 1.0, riverSlope )')
          .replace('* waterColor;', '* waterColor * mix(1.0, 0.06, riverNight);')
          // Filter diffuse sunlight through the chosen water tint, while leaving
          // surface reflections/specular highlights and the natural preset intact.
          .replace('sunColor * diffuseLight * 0.3', 'sunColor * diffuseLight * mix(vec3(0.3), waterColor * 0.8, riverTint)') } }) as Reflector & { material: THREE.ShaderMaterial };
    source.dispose();
    const m = this.water.material as THREE.ShaderMaterial; m.lights = true; m.fog = true; m.uniforms.normalSampler.value = normals;
    const reflect = this.water.onBeforeRender.bind(this.water);
    this.water.onBeforeRender = (...args) => { m.uniforms.eye.value.setFromMatrixPosition(args[2].matrixWorld); reflect(...args); };
    this.water.rotation.x = -Math.PI / 2; this.water.position.y = -.5; this.water.userData.spaceBackdrop = true; m.uniforms.size.value = 48;
    this.root.add(this.water);
  }

  private mesh(g: THREE.BufferGeometry, m: THREE.Material, position: Vec3, group: THREE.Group = this.root) {
    const mesh = new THREE.Mesh(g, m); mesh.castShadow = mesh.receiveShadow = true; mesh.position.set(...position); group.add(mesh); return mesh;
  }
  private beam(a: Vec3, b: Vec3, radius: number, material: THREE.Material, group: THREE.Group = this.root) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), d = end.clone().sub(start);
    const mesh = this.mesh(new THREE.CylinderGeometry(radius, radius, d.length(), 8), material, start.add(end).multiplyScalar(.5).toArray(), group);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return mesh;
  }

  private pearlMaterial(target?: THREE.MeshStandardMaterial) {
    const pearl = this.material(0xc3629a, .55, .34, .008, target);
    const compilePearl = pearl.onBeforeCompile;
    pearl.onBeforeCompile = (shader, renderer) => {
      compilePearl.call(pearl, shader, renderer);
      shader.vertexShader = 'varying vec2 pearlUV; varying vec3 pearlViewNormal;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\npearlUV=uv; pearlViewNormal=normalize(normalMatrix*normal);');
      shader.fragmentShader = 'varying vec2 pearlUV; varying vec3 pearlViewNormal;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        vec2 led=pearlUV*vec2(96.,48.); vec2 pixel=max(fwidth(led),vec2(.001));
        vec2 edge=abs(fract(led)-.5);
        float dots=(1.-smoothstep(.075,.075+pixel.x,edge.x))*(1.-smoothstep(.075,.075+pixel.y,edge.y));
        dots=mix(.0225,dots,1.-smoothstep(.15,.55,max(pixel.x,pixel.y)));
        // Photo reference shows discrete LEDs on a dark shell. Preserve their
        // integrated energy at distance instead of flooding the whole sphere.
        float facing=pow(abs(normalize(pearlViewNormal).z),.65);
        vec3 ledColor=mix(vec3(.035,.22,1.),vec3(.1,.8,.7),smoothstep(.18,.7,pearlUV.y));
        ledColor=mix(ledColor,vec3(.8,.025,.24),smoothstep(.72,.95,pearlUV.y));
        totalEmissiveRadiance+=cityNight*ledColor*dots*3.2*facing;
      `);
    };
    pearl.customProgramCacheKey = () => 'oriental-pearl-led';
    return pearl;
  }

  private makeLandmarks(silver: THREE.Material) {
    const concrete = this.material(0xd8d3c2, .1, .65, .065), pearl = this.pearlMaterial();
    const coolLight = this.material(0x3158ed, .25, .4, 5);
    this.root.add(createShanghaiSupertalls(this.material.bind(this), this.officeWindows));
    const oriental = new THREE.Group(); oriental.name = landmarks[0].name; oriental.position.set(-365, -.65, 1280); this.root.add(oriental);
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3;
      this.beam([Math.cos(a) * 67, 0, Math.sin(a) * 67], [Math.cos(a) * 10, 100, Math.sin(a) * 10], 6, concrete, oriental);
      this.beam([Math.cos(a) * 8, 105, Math.sin(a) * 8], [Math.cos(a) * 8, 350, Math.sin(a) * 8], 4.5, concrete, oriental);
      this.beam([Math.cos(a) * 12, 113, Math.sin(a) * 12], [Math.cos(a) * 12, 345, Math.sin(a) * 12], .65, coolLight, oriental);
    }
    for (const [height, radius] of [[93, 25], [272, 22.5], [350, 7]]) { const sphere = this.mesh(new THREE.SphereGeometry(radius, 40, 24), pearl, [0, height, 0], oriental); const ring = new THREE.TorusGeometry(radius * 1.006, .22, 6, 48); this.mesh(ring, coolLight, [0, height, 0], oriental).rotation.x = Math.PI / 2; sphere.name = 'Observation sphere'; }
    this.mesh(new THREE.CylinderGeometry(.3, 4, 118, 12), concrete, [0, 409, 0], oriental);
    // Landmark silhouettes are authored approximations at OSM positions, not surveyed meshes.
    this.mesh(new THREE.SphereGeometry(87, 48, 20), silver, [-991, 20, 6952]).scale.set(1, .26, .82);
    const chinaRed = this.material(0x963d30, .2, .6);
    for (let i = 0; i < 7; i++) this.mesh(new THREE.BoxGeometry(70 + i * 12, 5, 66 + i * 11), chinaRed, [-878, 20 + i * 6, 7460]);
    for (const x of [-903, -853]) for (const z of [7435, 7485]) this.mesh(new THREE.BoxGeometry(10, 25, 10), chinaRed, [x, 12, z]);
  }

  private makeTrees(polygons: Polygon[], material: THREE.Material) {
    const positions: Vec3[] = [];
    for (const p of polygons) {
      if (p.kind !== 'green') continue;
      const s = shape(p), geometry = new THREE.ShapeGeometry(s), vertices = geometry.attributes.position, index = geometry.index!;
      // Seed trees at triangle centroids: never scatter across a park's holes or the river.
      for (let i = 0; i < index.count && positions.length < (this.narrow ? 1200 : 2800); i += 3) {
        const a = new THREE.Vector3().fromBufferAttribute(vertices, index.getX(i)), b = new THREE.Vector3().fromBufferAttribute(vertices, index.getX(i + 1)), c = new THREE.Vector3().fromBufferAttribute(vertices, index.getX(i + 2));
        if (b.clone().sub(a).cross(c.clone().sub(a)).length() < 50) continue;
        const center = a.add(b).add(c).multiplyScalar(1 / 3); positions.push([center.x, 3, -center.y]);
      }
      geometry.dispose();
    }
    const trees = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), material, positions.length), matrix = new THREE.Object3D();
    positions.forEach((p, i) => { matrix.position.set(...p); matrix.scale.set(2.7 + i % 3, 4 + i % 3, 2.8 + i % 2); matrix.rotation.y = i * 2.4; matrix.updateMatrix(); trees.setMatrixAt(i, matrix.matrix); });
    this.root.add(trees);
  }

  private cabinMaterial(target?: THREE.MeshStandardMaterial) {
    const cabin = this.material(0x244653,.2,.3,.001,target), compile = cabin.onBeforeCompile;
    cabin.onBeforeCompile = (shader, renderer) => {
      compile.call(cabin, shader, renderer);
      shader.vertexShader = 'varying float cabinAlong,cabinWall;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ncabinAlong=(abs(normal.x)>.5?position.z:position.x)/2.8; cabinWall=1.-abs(normal.y);');
      shader.fragmentShader = 'varying float cabinAlong,cabinWall;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float frame=abs(fract(cabinAlong)-.5), aa=max(fwidth(cabinAlong),.001);
        float windowLight=mix(.7,1.-smoothstep(.35-aa,.35+aa,frame),1.-smoothstep(.3,1.,aa));
        totalEmissiveRadiance+=vec3(1.,.65,.3)*cityNight*1.8*windowLight*cabinWall;
      `);
    };
    cabin.customProgramCacheKey = () => 'shanghai-lit-boat-cabin';
    return cabin;
  }

  private makeBoats() {
    const hull = new THREE.Shape([[-6,-24],[6,-24],[6,16],[3,25],[0,29],[-3,25],[-6,16]].map(([x,z]) => new THREE.Vector2(x,-z)));
    const geometry = new THREE.ExtrudeGeometry(hull, { depth: 4, bevelEnabled: false }); geometry.rotateX(-Math.PI / 2); geometry.translate(0,-2,0);
    this.boats = new THREE.InstancedMesh(geometry, this.material(0x334347, .3, .4), 12);
    this.root.add(this.boats);
    const deck = new THREE.BoxGeometry(10,3,34); deck.translate(0,3,-3);
    const windows = new THREE.BoxGeometry(8.8,2.2,25); windows.translate(0,5.6,-5);
    const roof = new THREE.BoxGeometry(10, .7, 29); roof.translate(0,7,-4);
    const cabin = this.cabinMaterial();
    for (const [g,m] of [[deck,this.material(0xd9d9cd,.2,.45,.2)],[windows,cabin],[roof,this.material(0xe1e1d5,.2,.5,.15)]] as const) {
      const mesh = new THREE.InstancedMesh(g,m,12); mesh.instanceMatrix = this.boats.instanceMatrix;
      this.boatDetails.push(mesh); this.root.add(mesh);
    }
  }

  setWeather(weather: Weather, night: number, sunDirection: THREE.Vector3, riverColor: RiverColor = 'huangpu', timeOfDay?: string) {
    this.night.value = night;
    this.traffic?.setWeather(night, ['drizzle','rain','downpour','thunderstorm','typhoon'].includes(weather) ? 1 : 0);
    if (timeOfDay !== undefined) this.timeOfDay = timeOfDay;
    setShanghaiClockTime(this.root, this.timeOfDay);
    if (!this.water) return;
    const storm = ['typhoon', 'thunderstorm', 'downpour'].includes(weather);
    const rippled = ['windy', 'rain', 'drizzle'].includes(weather);
    this.water.material.uniforms.riverSlope.value = storm ? .9 : rippled ? .65 : .4;
    this.water.material.uniforms.distortionScale.value = storm ? 8 : rippled ? 4 : 1.8;
    const tint = this.water.material.uniforms.waterColor.value as THREE.Color;
    this.water.material.uniforms.riverTint.value = Number(riverColor !== 'huangpu');
    tint.setHex(RIVER_COLORS[riverColor].color);
    if (storm) {
      if (riverColor === 'huangpu') tint.setHex(0x364740);
      else tint.multiplyScalar(.65);
    }
    this.water.material.uniforms.sunDirection.value.copy(sunDirection);
    this.water.material.uniforms.sunColor.value.setHex(storm ? 0x788a92 : 0xffebca).multiplyScalar(THREE.MathUtils.smoothstep(sunDirection.y, 0, .18));
  }

  update(time: number, motion: boolean, camera: THREE.PerspectiveCamera, target: THREE.Vector3) {
    const dt = this.lastTime ? Math.min(.1, (time - this.lastTime) / 1000) : 0; this.lastTime = time;
    if (motion) this.elapsed += dt;
    if (this.water) this.water.material.uniforms.time.value = this.elapsed * .65;
    this.traffic?.update(this.elapsed);
    const shadowChanged = this.facadeLighting?.update(camera, this.night.value) ?? false;
    if (!this.route) return shadowChanged;
    const length = this.route.getLength();
    if (this.cruising) {
      this.distance = Math.min(length, this.distance + dt * 95);
      const p = this.route.getPoint(Math.min(.999, this.distance / length)), ahead = this.route.getPoint(Math.min(1, (this.distance + 460) / length));
      camera.position.set(p.x, 165, p.z); target.set(ahead.x, 125, ahead.z); camera.lookAt(target);
      if (this.distance >= length - 1) { this.cruising = false; this.changed(); }
    }
    if (this.boats) {
      const m = new THREE.Object3D();
      for (let i = 0; i < this.boats.count; i++) {
        const t = (i / this.boats.count + this.elapsed * (i % 2 ? -.0005 : .0006) + 1) % 1, p = this.route.getPoint(t), dir = this.route.getTangent(t);
        m.position.set(p.x + dir.z * (i % 2 ? 65 : -65), 1.7, p.z - dir.x * (i % 2 ? 65 : -65)); m.rotation.y = Math.atan2(dir.x, dir.z) + (i % 2 ? Math.PI : 0); m.scale.setScalar(.65 + i % 3 * .17); m.updateMatrix(); this.boats.setMatrixAt(i, m.matrix);
      }
      this.boats.instanceMatrix.needsUpdate = true; this.boats.computeBoundingSphere();
      this.boatDetails.forEach(mesh => mesh.computeBoundingSphere());
    }
    return shadowChanged;
  }

  dispose() {
    this.disposed = true; this.cruising = false; this.abort.abort(); this.root.removeFromParent();
    this.batches.forEach(b => b.geometries.forEach(g => g.dispose())); this.batches.clear();
    this.root.traverse(o => {
      if (o instanceof THREE.Mesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) this.materials.add(m); }
      if (o instanceof THREE.InstancedMesh) o.dispose();
    });
    // Reflector owns the reflection framebuffer as well as its color texture.
    this.water?.dispose();
    this.facadeLighting.dispose();
    this.materials.forEach(m => m.dispose()); this.textures.forEach(t => t.dispose()); this.root.clear();
  }
}
