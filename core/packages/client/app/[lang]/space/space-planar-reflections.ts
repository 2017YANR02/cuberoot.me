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
  const position = geometry.getAttribute('position'), index = geometry.index, uv = geometry.getAttribute('uv');
  if (!position || position.count < 3) return [];
  geometry.computeBoundingBox();
  const center = geometry.boundingBox!.getCenter(new THREE.Vector3());
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const normal = new THREE.Vector3(), edge = new THREE.Vector3();
  const groups: { plane: THREE.Plane; points: number[]; uv: number[]; area: number }[] = [];
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
    if (!group) { group = { plane, points: [], uv: [], area: 0 }; groups.push(group); }
    group.points.push(...a.toArray(), ...b.toArray(), ...c.toArray());
    for (let j = i; j < i + 3; j++) {
      const vertex = index ? index.getX(j) : j;
      group.uv.push(uv?.getX(vertex) ?? 0, uv?.getY(vertex) ?? 0);
    }
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
    part.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
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
  private bounceTarget?: THREE.WebGLCubeRenderTarget;
  private probeMaterials: { material: THREE.MeshStandardMaterial; envMap: THREE.Texture | null; intensity: number }[] = [];
  private probeDirty = true;
  private lightingReady = true;
  private near = false;

  invalidateProbe() { this.probeDirty = true; }

  constructor(private source: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>, narrow: boolean, lining?: THREE.Mesh, fixtures: readonly THREE.MeshStandardMaterial[] = []) {
    const surfaces = (geometry: THREE.BufferGeometry, material: THREE.MeshStandardMaterial, walls = false) =>
      interiorMirrorPlanes(geometry, walls, walls ? 12 : 4).map(plane => {
        const count = plane.geometry.getAttribute('position').count;
        const finish = [], color = [];
        const uv = plane.geometry.getAttribute('uv');
        material.normalMap?.updateMatrix();
        const point = new THREE.Vector2();
        for (let i = 0; i < count; i++) {
          finish.push(material.normalMap ? material.normalScale.x : 0, material.normalMap ? material.normalScale.y : 0, material.roughness);
          color.push(...material.color.toArray());
          if (material.normalMap) { point.set(uv.getX(i), uv.getY(i)).applyMatrix3(material.normalMap.matrix); uv.setXY(i, point.x, point.y); }
        }
        plane.geometry.setAttribute('mirrorFinish', new THREE.Float32BufferAttribute(finish, 3));
        plane.geometry.setAttribute('mirrorColor', new THREE.Float32BufferAttribute(color, 3));
        return { ...plane, normalMap: material.normalMap };
      });
    const planes = surfaces(source.geometry, source.material);
    if (lining) {
      source.updateWorldMatrix(true, false); lining.updateWorldMatrix(true, false);
      const geometry = lining.geometry.clone().applyMatrix4(new THREE.Matrix4().copy(source.matrixWorld).invert().multiply(lining.matrixWorld));
      // Broad pier faces share two wall planes. Reject the small end caps, then
      // merge coplanar folded haunches into the existing ceiling reflection.
      const extras = surfaces(geometry, lining.material as THREE.MeshStandardMaterial, true);
      geometry.dispose();
      for (const extra of extras) {
        const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(extra.rotation);
        const plane = planes.find(p => p.normalMap === extra.normalMap && new THREE.Vector3(0, 0, 1).applyQuaternion(p.rotation).dot(normal) > 1 - 1e-6 && Math.abs(normal.dot(p.origin.clone().sub(extra.origin))) < .002);
        if (!plane) { planes.push(extra); continue; }
        const basis = new THREE.Matrix4().compose(plane.origin, plane.rotation, new THREE.Vector3(1, 1, 1)).invert()
          .multiply(new THREE.Matrix4().compose(extra.origin, extra.rotation, new THREE.Vector3(1, 1, 1)));
        extra.geometry.applyMatrix4(basis);
        const merged = mergeGeometries([plane.geometry, extra.geometry])!;
        plane.geometry.dispose(); extra.geometry.dispose(); plane.geometry = merged;
      }
      // Two independent captures let the PBR fallback receive light reflected
      // by the room. Cache both across frames; never sample the active target.
      this.probe = new THREE.CubeCamera(.05, 20000, new THREE.WebGLCubeRenderTarget(narrow ? 64 : 128, { type: THREE.HalfFloatType }));
      this.bounceTarget = this.probe.renderTarget.clone();
      // Include only materials owned by this room; shared exterior finishes
      // must retain their outdoor environment when the interior is active.
      for (const material of new Set([source.material, lining.material, ...fixtures])) {
        if (!Array.isArray(material) && (material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
          const standard = material as THREE.MeshStandardMaterial;
          this.probeMaterials.push({ material: standard, envMap: standard.envMap, intensity: standard.envMapIntensity });
        }
      }
    }
    if (planes.length > 8) {
      planes.forEach(p => p.geometry.dispose());
      this.probe?.renderTarget.dispose(); this.bounceTarget?.dispose();
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
      const varyings = 'varying vec2 metalUv; varying vec3 metalPosition, metalFinish, metalColor;';
      m.vertexShader = m.vertexShader.replace('varying vec4 vUv;', `varying vec4 vUv; ${varyings} attribute vec3 mirrorFinish, mirrorColor;`)
        .replace('void main() {', 'void main() { metalUv = uv; metalPosition = position; metalFinish = mirrorFinish; metalColor = mirrorColor;');
      m.uniforms.metalNormal = { value: plane.normalMap };
      if (plane.normalMap) m.defines.METAL_NORMAL = '';
      m.fragmentShader = m.fragmentShader.replace('varying vec4 vUv;', `varying vec4 vUv; ${varyings} uniform vec2 mirrorTexel; uniform sampler2D metalNormal; uniform mat4 textureMatrix;`)
        .replace('vec4 base = texture2DProj( tDiffuse, vUv );', `
          vec4 projected = vUv;
          #ifdef METAL_NORMAL
            vec2 du = dFdx(metalUv), dv = dFdy(metalUv);
            float determinant = du.x * dv.y - du.y * dv.x;
            // Collapsed UVs deliberately keep smooth floor tiles undistorted.
            if (abs(determinant) > 1e-12) {
              vec3 dx = dFdx(metalPosition), dy = dFdy(metalPosition);
              vec3 tangent = normalize(dx * dv.y - dy * du.y) * sign(determinant);
              vec3 bitangent = normalize(dy * du.x - dx * dv.x) * sign(determinant);
              vec2 slope = (texture2D(metalNormal, metalUv).xy * 2. - 1.) * metalFinish.xy;
              // First-order planar approximation at an estimated 2 m optical
              // distance. The perturbation stays in the authored UV basis.
              projected += textureMatrix * vec4(2. * (tangent * slope.x + bitangent * slope.y), 0.);
            }
          #endif
          vec2 uv = clamp(projected.xy / projected.w, mirrorTexel, vec2(1.) - mirrorTexel);
          vec2 stepUv = mirrorTexel * metalFinish.z * 12.;
          vec4 base = texture2D(tDiffuse, uv) * .5;
          base += (texture2D(tDiffuse, uv + vec2(stepUv.x, 0.)) + texture2D(tDiffuse, uv - vec2(stepUv.x, 0.))
                 + texture2D(tDiffuse, uv + vec2(0., stepUv.y)) + texture2D(tDiffuse, uv - vec2(0., stepUv.y))) * .125;
        `).replace('blendOverlay( base.rgb, color )', 'base.rgb * metalColor');
      // Other overlays contain the main camera's projected textures. Sampling
      // them from a reflected camera causes stale feedback and black cavities.
      guardPlanarReflection(mirror, this.mirrors);
      const reflect = mirror.onBeforeRender;
      mirror.onBeforeRender = (...args) => {
        // Transmission and the main pass share one camera and one mirror image.
        if (args[2] !== this.camera || this.rendered.has(mirror)) return;
        if (this.probeDirty && this.lightingReady && !reflecting.has(args[0])) this.captureProbe(args[0], args[1]);
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
      this.setProbeMaterials(true);
      // Read the completed first cube while writing the other. The second
      // capture is still a local approximation, not recursive planar tracing.
      const first = this.probe.renderTarget;
      this.probe.renderTarget = this.bounceTarget!; this.bounceTarget = first;
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

  update(camera: THREE.Camera, lightingReady = true) {
    this.camera = camera; this.rendered.clear();
    this.lightingReady = lightingReady;
    // The shared light pool fades between buildings. Capturing before its
    // transition completes would leave a dim environment cached indefinitely.
    if (!lightingReady) this.probeDirty = true;
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
    this.bounceTarget?.dispose(); this.bounceTarget = undefined;
    this.probeMaterials.length = 0;
    for (const mirror of this.mirrors) { mirror.removeFromParent(); mirror.geometry.dispose(); mirror.dispose(); }
    this.mirrors.length = 0; this.rendered.clear(); this.camera = undefined;
  }
}
