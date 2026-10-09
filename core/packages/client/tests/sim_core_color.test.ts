import './_raf_stub';
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import GhostCube from '@cuberoot/puzzle-render-core/engine/ghost/GhostCube';
import World from '@/app/[lang]/sim/engine/world';
import { attachInteraction } from '@/app/[lang]/sim/worldInteraction';
import { applySettings, DEFAULT_SETTINGS } from '@/app/[lang]/sim/SettingDrawer';
import { applyEngineBodyOverlay, DEBUG_BODY_MAT, DEBUG_CORE_MAT, HOLLOW_MAT } from '@/app/[lang]/sim/engine/debugColors';
import { applyCoreOpacity } from '@/app/[lang]/sim/engine/coreOpacity';

function meshes(root: THREE.Object3D, role: string): THREE.Mesh[] {
  const result: THREE.Mesh[] = [];
  root.traverse(o => { if (o instanceof THREE.Mesh && o.userData.simRole === role) result.push(o); });
  return result;
}
const color = (material: THREE.Material) => (material as THREE.MeshPhongMaterial).color.getHexString();

describe('engine core color', () => {
  it('wires Ghost settings through all 27 bodies and 55 sticker walls without recoloring white caps', () => {
    const world = attachInteraction(new World());
    world.setPuzzle('ghost');
    try {
      for (const coreColor of ['#0000ff', '#00D800', DEFAULT_SETTINGS.coreColor]) {
        applySettings(world, { ...DEFAULT_SETTINGS, coreColor });
        const bodies = [...meshes(world.cube, 'body'), ...meshes(world.cube, 'core')];
        expect(bodies.length).toBe(27);
        expect(new Set(bodies.map(b => color(b.material as THREE.Material)))).toEqual(new Set([coreColor.slice(1).toLowerCase()]));
        const stickers = meshes(world.cube, 'sticker');
        expect(stickers.length).toBe(55);
        for (const sticker of stickers) {
          const [cap, wall] = sticker.material as THREE.Material[];
          expect(color(cap)).toBe('ffffff');
          expect(color(wall)).toBe(coreColor.slice(1).toLowerCase());
        }
      }
    } finally {
      world.controller.stop();
      world.cube.dispose();
    }
  });

  it('isolates shared source materials across roots and handles arrays and untagged meshes', () => {
    const source = new THREE.MeshPhongMaterial({ color: '#202020' });
    const roots = [new THREE.Group(), new THREE.Group()];
    for (const root of roots) {
      const body = new THREE.Mesh(new THREE.BoxGeometry(), [source, source]);
      body.userData.simRole = 'body';
      root.add(body, new THREE.Mesh(new THREE.BoxGeometry(), source));
    }
    applyEngineBodyOverlay(roots[0], false, false, false, '#0000ff');
    applyEngineBodyOverlay(roots[1], false, false, false, '#00D800');
    expect(color(source)).toBe('202020');
    for (const [i, root] of roots.entries()) {
      const body = root.children[0] as THREE.Mesh;
      const materials = body.material as THREE.Material[];
      expect(materials[0]).toBe(materials[1]);
      expect(color(materials[0])).toBe(i === 0 ? '0000ff' : '00d800');
      expect((root.children[1] as THREE.Mesh).material).toBe(source);
      const dispose = vi.fn();
      materials[0].addEventListener('dispose', dispose);
      applyEngineBodyOverlay(root, true, false, false, '#ff0000');
      body.geometry.dispose();
      expect(dispose).toHaveBeenCalledTimes(1);
    }
    source.dispose();
    expect(() => applyEngineBodyOverlay(new THREE.Group(), false, false, false, '#0000ff')).not.toThrow();
  });

  it('keeps raw > debug > hollow > colored base and restores the latest color', () => {
    const cube = new GhostCube();
    const body = meshes(cube, 'body')[0], core = meshes(cube, 'core')[0];
    try {
      applyEngineBodyOverlay(cube, false, false, false, '#0000ff');
      const plastic = body.material;
      applyEngineBodyOverlay(cube, true, true, false, '#00D800');
      expect(body.material).toBe(DEBUG_BODY_MAT);
      expect(core.material).toBe(DEBUG_CORE_MAT);
      applyEngineBodyOverlay(cube, true, false, false, '#00D800');
      expect(body.material).toBe(HOLLOW_MAT);
      applyEngineBodyOverlay(cube, true, true, true, '#00D800');
      expect(body.material).toBe(body.userData.simRawMat);
      expect(core.material).toBe(DEBUG_CORE_MAT);
      expect(meshes(cube, 'sticker').every(s => !s.visible)).toBe(true);
      applyEngineBodyOverlay(cube, false, false, false, '#00D800');
      expect(body.material).toBe(plastic);
      expect(color(body.material as THREE.Material)).toBe('00d800');
      expect(color(core.material as THREE.Material)).toBe('00d800');
      expect(meshes(cube, 'sticker').every(s => s.visible)).toBe(true);
      expect(color(DEBUG_BODY_MAT)).toBe('00e0d0');
      expect(color(DEBUG_CORE_MAT)).toBe('ff2bd6');
      expect(color(HOLLOW_MAT)).toBe('808080');
    } finally { cube.dispose(); }
  });

  it('refreshes cached translucent colors, preserves raw shaders and releases owned copies', () => {
    const cube = new GhostCube();
    const body = meshes(cube, 'body')[0];
    applyEngineBodyOverlay(cube, false, false, false, '#0000ff');
    applyCoreOpacity(cube, 50);
    const translucent = body.material as THREE.Material;
    expect(color(translucent)).toBe('0000ff');
    applyEngineBodyOverlay(cube, false, false, false, '#00D800');
    applyCoreOpacity(cube, 50);
    expect(body.material).toBe(translucent);
    expect(color(translucent)).toBe('00d800');
    expect(translucent.opacity).toBe(0.5);
    applyCoreOpacity(cube, 100);
    expect(color(body.material as THREE.Material)).toBe('00d800');
    expect((body.material as THREE.Material).opacity).toBe(1);
    expect((meshes(cube, 'sticker')[0].material as THREE.Material[])[1].opacity).toBe(1);
    const disposed = vi.fn();
    translucent.addEventListener('dispose', disposed);
    applyEngineBodyOverlay(cube, false, false, true, '#00D800');
    const raw = body.material as THREE.Material;
    applyCoreOpacity(cube, 50);
    expect((body.material as THREE.Material).onBeforeCompile).toBe(raw.onBeforeCompile);
    expect((body.material as THREE.Material).customProgramCacheKey()).toBe(raw.customProgramCacheKey());
    const rawDisposed = vi.fn();
    (body.material as THREE.Material).addEventListener('dispose', rawDisposed);
    applyEngineBodyOverlay(cube, true, false, false, '#00D800');
    cube.dispose();
    expect(disposed).toHaveBeenCalledTimes(1);
    expect(rawDisposed).toHaveBeenCalledTimes(1);
  });
});
