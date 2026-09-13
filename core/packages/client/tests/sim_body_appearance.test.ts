import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { BodyAppearance, bodyAppearanceRegion } from '@/app/[lang]/sim/engine/hands/bodyAppearance';

function fixture() {
  const geometry = new THREE.BufferGeometry();
  // A sleeve triangle crossing x=.315, plus an exposed face triangle.
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    .28, .02, .05, .35, .02, .05, .28, .06, .05,
    -.03, .28, .08, .03, .28, .08, 0, .32, .08,
  ], 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(Array.from({ length: 6 }, () => [0, 0, 1]).flat(), 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(12), 2));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Array.from({ length: 6 }, () => [0, 1, 0, 0]).flat(), 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(Array.from({ length: 6 }, () => [.75, .25, 0, 0]).flat(), 4));
  geometry.setIndex([0, 1, 2, 3, 4, 5]);
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial());
  const root = new THREE.Bone(), head = new THREE.Bone(); root.add(head); mesh.add(root);
  mesh.updateMatrixWorld(true); mesh.bind(new THREE.Skeleton([root, head]));
  const appearance = new BodyAppearance(mesh, head, new THREE.Vector3());
  return { mesh, appearance };
}
afterEach(() => vi.restoreAllMocks());

describe('clothed simulator character', () => {
  it.each([
    [0, 0, .1, 'shirt'], [.2, .12, 0, 'shirt'], [0, -.6, 0, 'pants'],
    [.1, -1.25, .08, 'shoes'], [0, .41, 0, 'hair'],
    [0, .3, .1, 'skin'], [.085, .28, 0, 'skin'], [.45, .02, .02, 'skin'],
  ] as const)('classifies (%s, %s, %s) as %s', (x, y, z, region) => {
    expect(bodyAppearanceRegion(x, y, z)).toBe(region);
  });

  it('clips sleeves smoothly and retains the original hand/skin correspondence', () => {
    const { mesh, appearance } = fixture();
    expect(mesh.geometry.getAttribute('position').count).toBe(6);
    expect(mesh.geometry.getAttribute('position').getX(1)).toBeCloseTo(.35);
    const shirt = mesh.getObjectByName('person-shirt') as THREE.SkinnedMesh;
    expect(shirt.skeleton).toBe(mesh.skeleton);
    expect(shirt.geometry.getAttribute('position').count).toBe(6);
    const positions = shirt.geometry.getAttribute('position');
    const weights = shirt.geometry.getAttribute('skinWeight');
    for (let i = 0; i < positions.count; i++) {
      expect(positions.getX(i)).toBeLessThanOrEqual(.315001);
      expect(weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i)).toBeCloseTo(1);
    }
    expect([...positions.array].some(x => Math.abs(x - .315) < 1e-6)).toBe(true);
    appearance.dispose();
    expect(mesh.getObjectByName('person-shirt')).toBeUndefined();
  });

  it('does not let a late photo replace a newer photo or resurrect a cleared face', () => {
    const pending: ((texture: THREE.Texture<HTMLImageElement>) => void)[] = [];
    vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation((_url, ready) => {
      pending.push(ready!); return new THREE.Texture<HTMLImageElement>();
    });
    const { mesh, appearance } = fixture();
    const face = mesh.getObjectByName('person-face-photo') as THREE.SkinnedMesh;
    appearance.setAvatar('first'); appearance.setAvatar('second');
    const stale = new THREE.Texture<HTMLImageElement>(), current = new THREE.Texture<HTMLImageElement>();
    const staleDispose = vi.spyOn(stale, 'dispose'), currentDispose = vi.spyOn(current, 'dispose');
    pending[1](current); pending[0](stale);
    expect((face.material as THREE.MeshStandardMaterial).map).toBe(current);
    expect(staleDispose).toHaveBeenCalledOnce();
    appearance.setAvatar('second', .1, -.2, 2);
    expect(pending).toHaveLength(2);
    expect(current.repeat.toArray()).toEqual([.5, .5]);
    expect(current.offset.x).toBeCloseTo(.15);
    expect(current.offset.y).toBeCloseTo(.45);
    appearance.setAvatar('');
    expect(face.visible).toBe(false);
    expect(currentDispose).toHaveBeenCalledOnce();
    appearance.setAvatar('third'); appearance.dispose();
    const late = new THREE.Texture<HTMLImageElement>(), lateDispose = vi.spyOn(late, 'dispose');
    pending[2](late);
    expect(lateDispose).toHaveBeenCalledOnce();
  });
});
