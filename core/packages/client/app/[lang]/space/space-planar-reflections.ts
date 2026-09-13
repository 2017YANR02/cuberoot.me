import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const reflecting = new WeakSet<THREE.WebGLRenderer>();

/** Prevent recursive reflection renders across the river, rooms and interiors. */
export function guardPlanarReflection(mirror: Reflector, hidden: readonly THREE.Object3D[] = []) {
  const render = mirror.onBeforeRender;
  mirror.onBeforeRender = (...args) => {
    const renderer = args[0];
    if (reflecting.has(renderer)) return;
    reflecting.add(renderer);
    const visibility = hidden.map(object => object.visible);
    hidden.forEach(object => { object.visible = false; });
    try { render.apply(mirror, args); }
    finally {
      hidden.forEach((object, i) => { object.visible = visibility[i]; });
      reflecting.delete(renderer);
    }
  };
}

/** Extract inward-facing lining facets, retaining the authored holes. */
export function interiorMirrorPlanes(geometry: THREE.BufferGeometry, includeWalls = false, minArea = 4) {
  const position = geometry.getAttribute('position'), index = geometry.index;
  if (!position || position.count < 3) return [];
  geometry.computeBoundingBox();
  const center = geometry.boundingBox!.getCenter(new THREE.Vector3());
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const normal = new THREE.Vector3(), edge = new THREE.Vector3();
  const groups: { plane: THREE.Plane; points: number[]; area: number }[] = [];
  const count = index?.count ?? position.count;
  for (let i = 0; i + 2 < count; i += 3) {
    a.fromBufferAttribute(position, index ? index.getX(i) : i);
    b.fromBufferAttribute(position, index ? index.getX(i + 1) : i + 1);
    c.fromBufferAttribute(position, index ? index.getX(i + 2) : i + 2);
    normal.subVectors(b, a).cross(edge.subVectors(c, a));
    const area = normal.length() / 2;
    if (!Number.isFinite(area) || area < 1e-8) continue;
    normal.normalize();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, a);
    // Y-up glTF; omit panel thickness, outward backs and vertical edge strips.
    if ((!includeWalls && Math.abs(normal.y) < .7) || plane.distanceToPoint(center) <= .001) continue;
    let group = groups.find(g => g.plane.normal.dot(normal) > 1 - 1e-6 && Math.abs(g.plane.distanceToPoint(a)) < .002);
    if (!group) { group = { plane, points: [], area: 0 }; groups.push(group); }
    group.points.push(...a.toArray(), ...b.toArray(), ...c.toArray());
    group.area += area;
  }
  return groups.filter(g => g.area >= minArea).map(g => {
    // Reflector's camera expects local +Z as its plane normal. Move the actual
    // triangles into that basis; a bounding rectangle would cover glass strips.
    const origin = g.plane.projectPoint(center, new THREE.Vector3());
    const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), g.plane.normal);
    const inverse = rotation.clone().invert();
    for (let i = 0; i < g.points.length; i += 3) {
      a.fromArray(g.points, i).sub(origin).applyQuaternion(inverse);
      a.z = 0; a.toArray(g.points, i);
    }
    const part = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(g.points, 3));
    part.computeVertexNormals();
    return { geometry: part, origin, rotation, area: g.area };
  });
}

export class BlenderInteriorMirrors {
  private mirrors: Reflector[] = [];
  private bounds = new THREE.Box3();
  private cameraPosition = new THREE.Vector3();
  private camera?: THREE.Camera;
  private rendered = new Set<Reflector>();
  private probe?: THREE.CubeCamera;
  private probeMaterials: { material: THREE.MeshStandardMaterial; envMap: THREE.Texture | null; intensity: number }[] = [];
  private probeDirty = true;
  private near = false;

  invalidateProbe() { this.probeDirty = true; }

  constructor(private source: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>, narrow: boolean, lining?: THREE.Mesh) {
    const planes = interiorMirrorPlanes(source.geometry);
    if (lining) {
      source.updateWorldMatrix(true, false); lining.updateWorldMatrix(true, false);
      const geometry = lining.geometry.clone().applyMatrix4(new THREE.Matrix4().copy(source.matrixWorld).invert().multiply(lining.matrixWorld));
      // Broad pier faces share two wall planes. Reject the small end caps, then
      // merge coplanar folded haunches into the existing ceiling reflection.
      const extras = interiorMirrorPlanes(geometry, true, 12);
      geometry.dispose();
      for (const extra of extras) {
        const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(extra.rotation);
        const plane = planes.find(p => new THREE.Vector3(0, 0, 1).applyQuaternion(p.rotation).dot(normal) > 1 - 1e-6 && Math.abs(normal.dot(p.origin.clone().sub(extra.origin))) < .002);
        if (!plane) { planes.push(extra); continue; }
        const basis = new THREE.Matrix4().compose(plane.origin, plane.rotation, new THREE.Vector3(1, 1, 1)).invert()
          .multiply(new THREE.Matrix4().compose(extra.origin, extra.rotation, new THREE.Vector3(1, 1, 1)));
        extra.geometry.applyMatrix4(basis);
        const merged = mergeGeometries([plane.geometry, extra.geometry])!;
        plane.geometry.dispose(); extra.geometry.dispose(); plane.geometry = merged;
      }
      // A static local capture supplies the second reflection's PBR fallback.
      // Capturing only on entry/lighting changes avoids six extra passes per frame.
      this.probe = new THREE.CubeCamera(.05, 20000, new THREE.WebGLCubeRenderTarget(narrow ? 64 : 128, { type: THREE.HalfFloatType }));
      for (const material of new Set([source.material, lining.material])) {
        if (!Array.isArray(material) && (material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
          const standard = material as THREE.MeshStandardMaterial;
          this.probeMaterials.push({ material: standard, envMap: standard.envMap, intensity: standard.envMapIntensity });
        }
      }
    }
    if (planes.length > 8) {
      planes.forEach(p => p.geometry.dispose());
      throw new Error('Authored interior exceeds eight planar reflection surfaces');
    }
    const size = narrow ? 384 : 768;
    for (const plane of planes) {
      const mirror = new Reflector(plane.geometry, { color: source.material.color, textureWidth: size, textureHeight: size, multisample: 0 });
      mirror.position.copy(plane.origin); mirror.quaternion.copy(plane.rotation);
      mirror.name = `${source.name} reflection`;
      mirror.userData.spaceRuntime = 'interior-reflection';
      mirror.visible = false;
      // Keep the original PBR mesh for distant views and secondary reflections.
      const m = mirror.material as THREE.ShaderMaterial;
      // Only separate coplanar surfaces by depth-buffer units. A slope bias
      // pulls grazing mirrors in front of physically nearer recessed lamps.
      m.polygonOffset = true; m.polygonOffsetFactor = 0; m.polygonOffsetUnits = -4;
      m.uniforms.mirrorTexel = { value: new THREE.Vector2(1 / size, 1 / size) };
      m.uniforms.mirrorBlur = { value: source.material.roughness * 12 };
      m.fragmentShader = m.fragmentShader.replace('varying vec4 vUv;', 'varying vec4 vUv; uniform vec2 mirrorTexel; uniform float mirrorBlur;')
        .replace('vec4 base = texture2DProj( tDiffuse, vUv );', `
          vec2 uv = vUv.xy / vUv.w;
          vec2 stepUv = mirrorTexel * mirrorBlur;
          vec4 base = texture2D(tDiffuse, uv) * .5;
          base += (texture2D(tDiffuse, uv + vec2(stepUv.x, 0.)) + texture2D(tDiffuse, uv - vec2(stepUv.x, 0.))
                 + texture2D(tDiffuse, uv + vec2(0., stepUv.y)) + texture2D(tDiffuse, uv - vec2(0., stepUv.y))) * .125;
        `).replace('blendOverlay( base.rgb, color )', 'base.rgb * color');
      // Other overlays contain the main camera's projected textures. Sampling
      // them from a reflected camera causes stale feedback and black cavities.
      guardPlanarReflection(mirror, this.mirrors);
      const reflect = mirror.onBeforeRender;
      mirror.onBeforeRender = (...args) => {
        // Transmission and the main pass share one camera and one mirror image.
        if (args[2] !== this.camera || this.rendered.has(mirror)) return;
        if (this.probeDirty && !reflecting.has(args[0])) this.captureProbe(args[0], args[1]);
        reflect.apply(mirror, args);
        this.rendered.add(mirror);
      };
      source.add(mirror); this.mirrors.push(mirror);
    }
  }

  private captureProbe(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
    if (!this.probe) return;
    const visibility = this.mirrors.map(m => m.visible);
    const target = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), level = renderer.getActiveMipmapLevel();
    const xr = renderer.xr.enabled;
    reflecting.add(renderer);
    this.mirrors.forEach(m => { m.visible = false; });
    this.setProbeMaterials(false); // Never read from the cube target being written.
    this.source.geometry.boundingBox!.getCenter(this.probe.position).applyMatrix4(this.source.matrixWorld);
    try {
      this.probe.update(renderer, scene);
      this.probeDirty = false;
    } finally {
      renderer.setRenderTarget(target, face, level); renderer.xr.enabled = xr;
      this.mirrors.forEach((m, i) => { m.visible = visibility[i]; });
      reflecting.delete(renderer);
      this.setProbeMaterials(!this.probeDirty);
    }
  }

  private setProbeMaterials(active: boolean) {
    for (const saved of this.probeMaterials) {
      const map = active ? this.probe!.renderTarget.texture : saved.envMap;
      if (saved.material.envMap !== map) {
        saved.material.envMap = map;
        saved.material.envMapIntensity = active ? 1 : saved.intensity;
        saved.material.needsUpdate = true;
      }
    }
  }

  update(camera: THREE.Camera) {
    this.camera = camera; this.rendered.clear();
    if (!this.mirrors.length) return;
    this.source.updateWorldMatrix(true, false);
    this.bounds.copy(this.source.geometry.boundingBox!).applyMatrix4(this.source.matrixWorld);
    camera.getWorldPosition(this.cameraPosition);
    const near = this.bounds.distanceToPoint(this.cameraPosition) < 25;
    if (near && !this.near) this.probeDirty = true;
    if (!near) this.setProbeMaterials(false);
    this.near = near;
    for (const mirror of this.mirrors) mirror.visible = near;
  }

  dispose() {
    this.setProbeMaterials(false); this.probe?.renderTarget.dispose(); this.probe = undefined;
    this.probeMaterials.length = 0;
    for (const mirror of this.mirrors) { mirror.removeFromParent(); mirror.geometry.dispose(); mirror.dispose(); }
    this.mirrors.length = 0; this.rendered.clear(); this.camera = undefined;
  }
}
