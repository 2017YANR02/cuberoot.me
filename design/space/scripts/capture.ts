import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { SpaceRoom } from '../../../core/packages/client/app/[lang]/space/space-room';
import { ShanghaiScene } from '../../../core/packages/client/app/[lang]/space/space-shanghai';
import { ROOMS, type Environment, type RoomStyle } from '../../../core/packages/client/app/[lang]/space/space-state';

// One-time bootstrap from the existing runtime. Subsequent authoring starts in .blend.
const status = document.querySelector('pre')!;
const params = new URLSearchParams(location.search);
const key = params.get('asset') ?? 'modern-original';
const [style, environment] = key.split('-') as [RoomStyle, Environment];
if (key !== 'shanghai' && (!(style in ROOMS) || !['original', 'island', 'shanghai'].includes(environment))) throw new Error('Unknown Space asset');
const errors: string[] = [];
THREE.DefaultLoadingManager.onError = url => errors.push(url);
let root: THREE.Group;
let owner: SpaceRoom | ShanghaiScene;
if (key === 'shanghai') {
  const city = new ShanghaiScene(false, () => {}, 'bootstrap');
  owner = city; await city.ready; root = city.root;
} else {
  const room = new SpaceRoom(style, [], () => {}, environment, 'bootstrap');
  owner = room;
  const camera = new THREE.PerspectiveCamera(); camera.position.set(21, 1, -10);
  room.update(camera, false);
  // Private implementation access is confined to this migration-only tool.
  await Promise.all((room as unknown as { models: Map<string, Promise<unknown>> }).models.values());
  root = room.root;
  root.userData.spaceObstacles = room.obstacles;
  const internal = room as unknown as { roof: THREE.Group; back: THREE.Group; glass: THREE.Material; lights: THREE.RectAreaLight[] };
  internal.roof.userData.spaceRole = 'roof'; internal.back.userData.spaceRole = 'back';
  internal.glass.userData.spaceGlass = true;
  room.floor.userData.spaceRole = 'floor';
  room.surfaces.forEach(o => { o.userData.spaceSurface = true; });
  root.userData.spaceLights = internal.lights.map(o => ({ position: o.position.toArray(), quaternion: o.quaternion.toArray(), color: o.color.toArray(), intensity: o.intensity, width: o.width, height: o.height }));
}
root.name = key;
root.updateMatrixWorld(true);
const textures = new Set<THREE.Texture>();
const nodes: Record<string, unknown>[] = [];
const materialIds = new Map<THREE.Material, string>();
const materialMetadata: Record<string, unknown> = {};
let meshes = 0, triangles = 0, instances = 0;
function visit(object: THREE.Object3D, id: string) {
  const originalUuid = object.uuid;
  object.userData.spaceId = id;
  object.userData.spaceName = object.name;
  object.userData.spaceVisible = object.visible;
  object.userData.spaceRenderOrder = object.renderOrder;
  if (object instanceof THREE.Mesh) {
    meshes++;
    const count = object instanceof THREE.InstancedMesh ? object.count : 1;
    instances += count;
    triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3 * count;
    object.userData.spaceCastShadow = object.castShadow;
    object.userData.spaceReceiveShadow = object.receiveShadow;
    object.userData.spaceInstanceCount = count;
    if (object.type === 'Reflector' || (object as unknown as { isReflector?: boolean }).isReflector) object.userData.spaceRuntime = 'reflection';
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const converted = materials.map(material => {
      if (!materialIds.has(material)) materialIds.set(material, `material-${materialIds.size}`);
      material.userData.spaceMaterialId = materialIds.get(material);
      material.userData.spaceDepthWrite = material.depthWrite;
      material.userData.spaceShaderKey = material.customProgramCacheKey();
      if (material instanceof THREE.ShadowMaterial) object.userData.spaceRuntime = 'shadow';
      materialMetadata[materialIds.get(material)!] = { ...material.userData };
      for (const value of Object.values(material)) if (value instanceof THREE.Texture && value.image) textures.add(value);
      if (material instanceof THREE.ShaderMaterial) {
        object.userData.spaceRuntime = object.userData.spaceRuntime ?? 'shader';
        const color = material.uniforms.color?.value;
        const replacement = new THREE.MeshStandardMaterial({ color: color instanceof THREE.Color ? color : 0x718078, roughness: .24, metalness: .25, side: material.side });
        replacement.userData = { ...material.userData, spaceRuntimeShader: true };
        return replacement;
      }
      return material;
    });
    object.material = Array.isArray(object.material) ? converted : converted[0];
  }
  nodes.push({ id, name: object.name, type: object.type, uuid: originalUuid, parent: object.parent?.userData.spaceId, visible: object.visible, extras: { ...object.userData } });
  object.children.forEach((child, index) => visit(child, `${id}/${index}`));
}
visit(root, 'root');
await Promise.all([...textures].map(texture => {
  const img = texture.image;
  if (!(img instanceof HTMLImageElement) || img.complete) return Promise.resolve();
  return new Promise<void>((resolve, reject) => { img.addEventListener('load', () => resolve(), { once: true }); img.addEventListener('error', () => reject(new Error(img.src)), { once: true }); });
}));
if (errors.length) throw new Error(`Missing source assets: ${errors.join(', ')}`);
const report = { schemaVersion: 2, key, units: 'metres', axis: 'Y_UP', meshes, instances, triangles, nodes, materialMetadata, materialCount: materialIds.size, errors };
status.textContent = `Exporting ${key}: ${meshes} meshes, ${Math.round(triangles)} triangles`;
const binary = params.has('metadata') ? new ArrayBuffer(0) : await new GLTFExporter().parseAsync(root, { binary: true, onlyVisible: false, maxTextureSize: 2048 });
if (!(binary instanceof ArrayBuffer)) throw new Error('Expected binary glTF');
const response = binary.byteLength ? await fetch(`/capture/${key}`, { method: 'POST', body: binary }) : new Response('metadata only');
if (!response.ok) throw new Error(await response.text());
const saved = await fetch(`/report/${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report) });
if (!saved.ok) throw new Error(await saved.text());
status.textContent = JSON.stringify({ ...report, nodes: nodes.length, bytes: binary.byteLength }, null, 2);
(window as unknown as { captureResult: unknown }).captureResult = { key, meshes, instances, triangles, bytes: binary.byteLength, errors };
// Leave resources alive until the next navigation; no disposed textures during export.
void owner;
