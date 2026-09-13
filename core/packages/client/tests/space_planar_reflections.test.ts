import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BlenderInteriorMirrors, guardPlanarReflection, interiorMirrorPlanes } from '@/app/[lang]/space/space-planar-reflections';

function hall() {
  const parts = [-3, 3].map(x => new THREE.PlaneGeometry(4, 6).rotateX(-Math.PI / 2).translate(x, 0, 0));
  parts.push(new THREE.PlaneGeometry(10, 6).rotateX(Math.PI / 2).rotateZ(.2).translate(0, 6, 0));
  // The back of the lining must not allocate another reflection pass.
  parts.push(new THREE.PlaneGeometry(10, 6).rotateX(-Math.PI / 2).rotateZ(.2).translate(0, 6.02, 0));
  const geometry = mergeGeometries(parts)!;
  parts.forEach(p => p.dispose());
  return geometry;
}

describe('authored interior reflections', () => {
  it.each([true, false])('preserves a floor opening and a tilted ceiling (indexed=%s)', indexed => {
    const original = hall(), geometry = indexed ? original : original.toNonIndexed();
    const before = [...geometry.getAttribute('position').array];
    const planes = interiorMirrorPlanes(geometry);
    expect(planes).toHaveLength(2);
    const objects = planes.map(p => {
      const mesh = new THREE.Mesh(p.geometry);
      mesh.position.copy(p.origin); mesh.quaternion.copy(p.rotation); mesh.updateMatrixWorld();
      return mesh;
    });
    const cast = (x: number, y: number, dy: number) => new THREE.Raycaster(new THREE.Vector3(x, y, 0), new THREE.Vector3(0, dy, 0)).intersectObjects(objects);
    expect(cast(0, 1, -1)).toHaveLength(0);
    expect(cast(3, 1, -1)[0].point.y).toBeCloseTo(0, 5);
    expect(cast(2, 1, 1)[0].point.y).toBeCloseTo(6 + 2 * Math.tan(.2), 5);
    expect([...geometry.getAttribute('position').array]).toEqual(before);
    planes.forEach(p => p.geometry.dispose()); geometry.dispose(); original.dispose();
  });

  it('handles empty geometry and small decoration without allocating reflectors', () => {
    expect(interiorMirrorPlanes(new THREE.BufferGeometry())).toEqual([]);
    const geometry = new THREE.BoxGeometry(.1, .1, .1);
    expect(interiorMirrorPlanes(geometry)).toEqual([]); geometry.dispose();
  });

  it('retains window openings and merges coplanar haunches across mesh transforms', () => {
    const source = new THREE.Mesh(hall(), new THREE.MeshStandardMaterial());
    const parts: THREE.BufferGeometry[] = [];
    for (const side of [-1, 1]) for (const x of [-4, 4]) {
      parts.push(new THREE.PlaneGeometry(2, 6).rotateY(side > 0 ? Math.PI : 0).translate(x, 3, side * 3));
    }
    parts.push(new THREE.PlaneGeometry(2, 6).translate(6, 0, 0).rotateX(Math.PI / 2).rotateZ(.2).translate(0, 6, 0));
    const lining = new THREE.Mesh(mergeGeometries(parts)!.translate(-7, 0, 0), new THREE.MeshStandardMaterial());
    lining.position.x = 7;
    const parent = new THREE.Group(); parent.position.set(400, 474, 1800); parent.rotation.y = .58;
    parent.add(source, lining);
    const before = [...lining.geometry.getAttribute('position').array];
    const interior = new BlenderInteriorMirrors(source, true, lining);
    expect(source.children).toHaveLength(4);
    // Test in the source frame; side windows stay open between broad piers.
    parent.position.set(0, 0, 0); parent.rotation.set(0, 0, 0); parent.updateMatrixWorld(true);
    const cast = (x: number) => new THREE.Raycaster(new THREE.Vector3(x, 2, 0), new THREE.Vector3(0, 0, 1)).intersectObjects(source.children);
    expect(cast(0)).toHaveLength(0); expect(cast(4)[0].point.z).toBeCloseTo(3, 5);
    expect([...lining.geometry.getAttribute('position').array]).toEqual(before);
    interior.dispose(); parts.forEach(p => p.dispose());
    for (const m of [source, lining]) { m.geometry.dispose(); m.material.dispose(); }
  });

  it('captures a bounded local fallback on entry or lighting changes, without feedback, and restores it on exit', () => {
    const source = new THREE.Mesh(hall(), new THREE.MeshStandardMaterial());
    const lining = new THREE.Mesh(new THREE.BoxGeometry(.1, .1, .1), new THREE.MeshStandardMaterial());
    const original = new THREE.Texture(); source.material.envMap = original; source.material.envMapIntensity = .4;
    const interior = new BlenderInteriorMirrors(source, true, lining), mirror = source.children[0] as Reflector;
    const camera = new THREE.PerspectiveCamera(60, 1, .05, 1000);
    camera.position.set(3, 2, 0); camera.lookAt(3, 0, 0); camera.updateMatrixWorld(); source.updateMatrixWorld(true);
    let fail = true, targetDisposed = false;
    const capture = vi.spyOn(THREE.CubeCamera.prototype, 'update').mockImplementation(function (this: THREE.CubeCamera) {
      expect(source.material.envMap).toBe(original);
      expect(source.children.every(o => !o.visible)).toBe(true);
      this.renderTarget.addEventListener('dispose', () => { targetDisposed = true; });
      if (fail) throw new Error('capture failed');
    });
    const renderer = {
      xr: { enabled: false }, shadowMap: { autoUpdate: true }, autoClear: true,
      getRenderTarget: () => null, getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0, setRenderTarget: () => {},
      state: { buffers: { depth: { setMask: () => {} } } }, render: () => {},
    } as unknown as THREE.WebGLRenderer;
    const draw = () => mirror.onBeforeRender(renderer, new THREE.Scene(), camera, mirror.geometry, mirror.material as THREE.Material, null!);
    try {
      interior.update(camera); expect(draw).toThrow('capture failed');
      expect(source.material.envMap).toBe(original); expect(mirror.visible).toBe(true);
      fail = false; draw(); expect(source.material.envMap).not.toBe(original);
      expect(source.material.envMapIntensity).toBe(1);
      interior.update(camera); draw(); expect(capture).toHaveBeenCalledTimes(2);
      interior.invalidateProbe(); interior.update(camera); draw(); expect(capture).toHaveBeenCalledTimes(3);
      camera.position.set(0, 0, 100); interior.update(camera);
      expect(source.material.envMap).toBe(original); expect(source.material.envMapIntensity).toBe(.4);
      camera.position.set(3, 2, 0); camera.updateMatrixWorld(); interior.update(camera); draw();
      expect(capture).toHaveBeenCalledTimes(4);
      interior.dispose(); expect(targetDisposed).toBe(true); expect(source.material.envMap).toBe(original);
    } finally {
      capture.mockRestore(); interior.dispose(); original.dispose();
      for (const m of [source, lining]) { m.geometry.dispose(); m.material.dispose(); }
    }
  });

  it('uses transformed source bounds, preserves the fallback and disposes owned GPU resources', () => {
    const mesh = new THREE.Mesh(hall(), new THREE.MeshStandardMaterial());
    mesh.position.set(400, 474, 1800); mesh.rotation.y = .58; mesh.scale.setScalar(1.5);
    const geometry = mesh.geometry, material = mesh.material;
    const interior = new BlenderInteriorMirrors(mesh, true);
    const mirrors = [...mesh.children] as Reflector[];
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(400, 476, 1800); interior.update(camera);
    expect(mirrors.every(m => m.visible)).toBe(true);
    camera.position.set(0, 0, 0); interior.update(camera);
    expect(mirrors.some(m => m.visible)).toBe(false);
    expect(mesh.visible).toBe(true);
    expect(mesh.geometry).toBe(geometry); expect(mesh.material).toBe(material);
    const disposed: string[] = [];
    for (const mirror of mirrors) {
      mirror.geometry.addEventListener('dispose', () => disposed.push('geometry'));
      mirror.getRenderTarget().addEventListener('dispose', () => disposed.push('target'));
    }
    interior.dispose(); interior.dispose();
    expect(mesh.children).toHaveLength(0); expect(disposed.sort()).toEqual(['geometry', 'geometry', 'target', 'target']);
    geometry.dispose(); material.dispose();
  });

  it('stops mutual river/mirror render recursion and releases the guard after failure', () => {
    const renderer = {} as THREE.WebGLRenderer, scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
    const a = new Reflector(new THREE.PlaneGeometry()), b = new Reflector(new THREE.PlaneGeometry());
    const draw = (mirror: Reflector) => mirror.onBeforeRender(renderer, scene, camera, mirror.geometry, mirror.material as THREE.Material, null!);
    let first = 0, second = 0, fail = true;
    a.onBeforeRender = () => { first++; draw(b); if (fail) throw new Error('render failed'); };
    b.onBeforeRender = () => { second++; draw(a); };
    guardPlanarReflection(a); guardPlanarReflection(b);
    expect(() => draw(a)).toThrow('render failed');
    fail = false; draw(b); draw(a);
    expect([first, second]).toEqual([2, 1]);
    for (const m of [a, b]) { m.geometry.dispose(); m.dispose(); }
  });

  it('shares a reflection between transmission and opaque passes, then refreshes after camera movement', () => {
    const mesh = new THREE.Mesh(hall(), new THREE.MeshStandardMaterial());
    const interior = new BlenderInteriorMirrors(mesh, true), mirror = mesh.children[0] as Reflector;
    const camera = new THREE.PerspectiveCamera(60, 1, .05, 1000);
    camera.position.set(3, 2, 0); camera.lookAt(3, 0, 0); camera.updateMatrixWorld(); mesh.updateMatrixWorld(true);
    let renders = 0;
    const renderer = {
      xr: { enabled: false }, shadowMap: { autoUpdate: true }, autoClear: true,
      getRenderTarget: () => null, setRenderTarget: () => {},
      state: { buffers: { depth: { setMask: () => {} } } },
      render: () => { renders++; },
    } as unknown as THREE.WebGLRenderer;
    const draw = (view = camera) => mirror.onBeforeRender(renderer, new THREE.Scene(), view, mirror.geometry, mirror.material as THREE.Material, null!);
    interior.update(camera); draw(); draw(); expect(renders).toBe(1);
    camera.position.x += 1; camera.updateMatrixWorld(); interior.update(camera);
    draw(new THREE.PerspectiveCamera()); expect(renders).toBe(1);
    draw(); draw(); expect(renders).toBe(2);
    interior.dispose(); mesh.geometry.dispose(); mesh.material.dispose();
  });

  it('uses the authored fallback instead of stale opposing mirrors and restores visibility on failure', () => {
    const mirror = new Reflector(new THREE.PlaneGeometry());
    const fallback = new THREE.Mesh(), visible = new THREE.Object3D(), hidden = new THREE.Object3D();
    hidden.visible = false;
    mirror.onBeforeRender = () => {
      expect([visible.visible, hidden.visible, fallback.visible]).toEqual([false, false, true]);
      throw new Error('render failed');
    };
    guardPlanarReflection(mirror, [visible, hidden]);
    expect(() => mirror.onBeforeRender({} as THREE.WebGLRenderer, new THREE.Scene(), new THREE.PerspectiveCamera(), mirror.geometry, mirror.material as THREE.Material, null!)).toThrow('render failed');
    expect([visible.visible, hidden.visible, fallback.visible]).toEqual([true, false, true]);
    mirror.geometry.dispose(); mirror.dispose(); fallback.geometry.dispose(); (fallback.material as THREE.Material).dispose();
  });
});
