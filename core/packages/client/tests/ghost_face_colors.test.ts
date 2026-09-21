import './_raf_stub';
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import GhostCube from '@cuberoot/puzzle-render-core/engine/ghost/GhostCube';
import { GHOST_DEFAULT_FACE_COLORS, GHOST_FACE_LABELS } from '@cuberoot/puzzle-render-core/engine/ghost/ghostGeometry';
import { GHOST_ALIGN, parseGhostMoves } from '@cuberoot/puzzle-render-core/engine/ghost/ghostState';
import World from '@/app/[lang]/sim/engine/world';
import { attachInteraction } from '@/app/[lang]/sim/worldInteraction';
import { applySettings, DEFAULT_FACE_COLORS, DEFAULT_SETTINGS, loadSettings, saveSettings } from '@/app/[lang]/sim/SettingDrawer';
import { applyHintFacelets } from '@/app/[lang]/sim/engine/hintFacelets';
import { applyEngineBodyOverlay } from '@/app/[lang]/sim/engine/debugColors';
import { deriveRawFaces } from '@/app/[lang]/sim/engine/rawBody';
import { resolveCaps } from '@/app/[lang]/sim/simCaps';
import { exportSimSvgSchematic } from '@/app/[lang]/sim/sim_svg_export_schematic';

function meshes(root: THREE.Object3D, role: string): THREE.Mesh[] {
  const result: THREE.Mesh[] = [];
  root.traverse(o => { if (o instanceof THREE.Mesh && o.userData.simRole === role) result.push(o); });
  return result;
}
const cap = (s: THREE.Mesh): THREE.MeshPhongMaterial => (s.material as THREE.MeshPhongMaterial[])[0];
const faceOf = (s: THREE.Mesh) => GHOST_FACE_LABELS[s.userData.ghostFace as number];
const hex = (s: string) => new THREE.Color(s).getHexString();

describe('Ghost shell face colors', () => {
  it('opts in only supported engines and preserves the all-white default', () => {
    for (const kind of ['ghost', 'mirror', 'mirror2', 3] as const) {
      expect(resolveCaps(kind, 'engine').supports.faceColors).toBe(true);
    }
    for (const kind of ['ivy', 'clock', 'megaminx'] as const) {
      expect(resolveCaps(kind, 'engine').supports.faceColors).toBe(false);
    }
    const cube = new GhostCube();
    try {
      const stickers = meshes(cube, 'sticker');
      expect(stickers.length).toBe(55);
      expect(new Set(stickers.map(s => cap(s))).size).toBe(6);
      expect(new Set(stickers.map(s => cap(s).color.getHexString()))).toEqual(new Set(['ffffff']));
    } finally { cube.dispose(); }
  });

  it('maps all six colors to independent solved display normals, then carries colors through moves/reset', () => {
    const cube = new GhostCube(), other = new GhostCube();
    const normals = { U: [0, 1, 0], D: [0, -1, 0], L: [-1, 0, 0], R: [1, 0, 0], F: [0, 0, 1], B: [0, 0, -1] };
    try {
      cube.setFaceColors(DEFAULT_FACE_COLORS);
      const stickers = meshes(cube, 'sticker');
      for (const s of stickers) {
        const n = s.userData.simStickerNormal.clone().applyQuaternion(cube.quaternion) as THREE.Vector3;
        expect(n.distanceTo(new THREE.Vector3(...normals[faceOf(s)]))).toBeLessThan(1e-7);
        expect(cap(s).color.getHexString()).toBe(hex(DEFAULT_FACE_COLORS[faceOf(s)]));
      }
      const original = stickers.map(s => cap(s).color.getHexString());
      cube.applyMovesInstant(parseGhostMoves(`${GHOST_ALIGN} R U F2 M E S x`));
      expect(stickers.map(s => cap(s).color.getHexString())).toEqual(original);
      cube.setFaceColors({ ...DEFAULT_FACE_COLORS, U: '#8800ff' });
      cube.reset();
      for (const s of stickers) {
        expect(cap(s).color.getHexString()).toBe(faceOf(s) === 'U' ? '8800ff' : hex(DEFAULT_FACE_COLORS[faceOf(s)]));
      }
      expect(new Set(meshes(other, 'sticker').map(s => cap(s).color.getHexString()))).toEqual(new Set(['ffffff']));
      expect(DEFAULT_FACE_COLORS.U).toBe('#FFFFFF');
      expect(GHOST_DEFAULT_FACE_COLORS.U).toBe('#FFFFFF');
    } finally { cube.dispose(); other.dispose(); }
  });

  it('applies the separate palette, core color, cached raw shader and hints together without rebuilding materials', () => {
    const world = attachInteraction(new World());
    world.setPuzzle('ghost');
    try {
      const settings = { ...DEFAULT_SETTINGS, coreColor: '#332211', coreStyle: 'raw' as const, coreOpacity: 40, hint: true };
      applySettings(world, settings);
      const bodies = meshes(world.cube, 'body');
      const cached = bodies.map(b => b.userData.simRawMat as THREE.MeshPhongMaterial);
      const uniforms = cached.map(m => {
        const shader = { uniforms: {}, vertexShader: '', fragmentShader: '' } as unknown as Parameters<THREE.Material['onBeforeCompile']>[0];
        m.onBeforeCompile(shader, null as unknown as THREE.WebGLRenderer);
        return shader.uniforms.uRawC.value as THREE.Color[];
      });
      applySettings(world, { ...settings, ghostFaceColors: DEFAULT_FACE_COLORS });
      expect(bodies.map(b => b.userData.simRawMat)).toEqual(cached);
      for (const [i, body] of bodies.entries()) {
        expect((body.material as THREE.Material).opacity).toBe(0.4);
        const faces = deriveRawFaces(body);
        for (const [j, f] of faces.entries()) {
          expect(uniforms[i][j]).toBe(f.c);
          const s = meshes(body.parent!, 'sticker')[j];
          expect(uniforms[i][j].getHexString()).toBe(hex(DEFAULT_FACE_COLORS[faceOf(s)]));
        }
      }
      applySettings(world, { ...settings, coreStyle: 'normal', ghostFaceColors: DEFAULT_FACE_COLORS });
      applyHintFacelets(world.cube, true, '#ffffff');
      for (const s of meshes(world.cube, 'sticker')) {
        expect(s.visible).toBe(true);
        expect(cap(s).color.getHexString()).toBe(hex(DEFAULT_FACE_COLORS[faceOf(s)]));
        expect((s.material as THREE.MeshPhongMaterial[])[1].color.getHexString()).toBe('332211');
        const hint = s.userData.simHint as THREE.Mesh;
        const expected = new THREE.Color(DEFAULT_FACE_COLORS[faceOf(s)]).lerp(new THREE.Color('#ffffff'), 0.65);
        expect((hint.material as THREE.MeshBasicMaterial).color.getHexString()).toBe(expected.getHexString());
      }
      applySettings(world, DEFAULT_SETTINGS);
      expect(new Set(meshes(world.cube, 'sticker').map(s => cap(s).color.getHexString()))).toEqual(new Set(['ffffff']));
    } finally { world.controller.stop(); world.cube.dispose(); }
  });

  it('exports matching six-face colors to the front and back companions before and after a scramble', () => {
    const cube = new GhostCube(), scene = new THREE.Scene();
    scene.add(cube);
    const camera = new THREE.PerspectiveCamera(40, 1, 1, 3000);
    const view = { scene, camera, width: 600, height: 600 };
    try {
      cube.setFaceColors(DEFAULT_FACE_COLORS);
      const draw = (sign: number) => {
        camera.position.set(sign * 400, sign * 300, sign * 500);
        camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
        return exportSimSvgSchematic({ world: view });
      };
      const front = draw(1), back = draw(-1);
      for (const face of ['U', 'R', 'F'] as const) expect(front.toLowerCase()).toContain(hex(DEFAULT_FACE_COLORS[face]));
      for (const face of ['D', 'L', 'B'] as const) expect(back.toLowerCase()).toContain(hex(DEFAULT_FACE_COLORS[face]));
      // Composite engines may have multiple body meshes under one sticker parent.
      const duplicates = meshes(cube, 'body').map(body => {
        const duplicate = body.clone();
        body.parent!.add(duplicate);
        return duplicate;
      });
      applyEngineBodyOverlay(cube, false, false, true);
      expect(draw(1)).toBe(front);
      expect(draw(-1)).toBe(back);
      cube.visible = false;
      expect(draw(1)).not.toContain('<path');
      cube.visible = true;
      for (const duplicate of duplicates) {
        duplicate.userData.simRawMat.dispose();
        duplicate.removeFromParent();
      }
      cube.setCarve(true);
      const carved = draw(1);
      expect(carved).not.toBe(front);
      applyEngineBodyOverlay(cube, false, false, false);
      expect(draw(1)).toBe(carved);
      cube.setCarve(false);
      expect(draw(1)).toBe(front);
      applyEngineBodyOverlay(cube, false, false, true);
      cube.applyMovesInstant(parseGhostMoves(`${GHOST_ALIGN} R U F2`));
      const scrambled = draw(1);
      expect(scrambled).not.toBe(front);
      cube.setFaceColors({ ...DEFAULT_FACE_COLORS, U: '#8800ff' });
      expect((draw(1) + draw(-1)).toLowerCase()).toContain('8800ff');
    } finally { cube.dispose(); }
  });

  it('releases all six per-instance cap materials exactly once', () => {
    const cube = new GhostCube();
    const materials = [...new Set(meshes(cube, 'sticker').map(cap))];
    const disposed = materials.map(m => { const fn = vi.fn(); m.addEventListener('dispose', fn); return fn; });
    cube.setFaceColors(DEFAULT_FACE_COLORS);
    cube.dispose();
    expect(disposed.length).toBe(6);
    for (const fn of disposed) expect(fn).toHaveBeenCalledTimes(1);
  });

  it('migrates old, partial and invalid saved palettes without changing NxN and persists edits', () => {
    const values = new Map<string, string>();
    const localStorage = {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => values.set(k, v),
      removeItem: (k: string) => values.delete(k),
    };
    vi.stubGlobal('window', { localStorage });
    vi.stubGlobal('localStorage', localStorage);
    try {
      for (const palette of [undefined, null, false, '#ff0000', { U: '#123456', D: 'garbage', R: 17, B: '#abc' }]) {
        values.set('sim.settings', JSON.stringify({ faceColors: DEFAULT_FACE_COLORS, ghostFaceColors: palette }));
        const s = loadSettings();
        expect(s.faceColors).toEqual(DEFAULT_FACE_COLORS);
        expect(s.ghostFaceColors).toEqual(palette && typeof palette === 'object'
          ? { ...GHOST_DEFAULT_FACE_COLORS, U: '#123456', B: '#abc' } : GHOST_DEFAULT_FACE_COLORS);
      }
      const edited = { ...DEFAULT_SETTINGS, ghostFaceColors: { ...DEFAULT_FACE_COLORS, U: '#8800ff' } };
      expect(saveSettings(edited)).toBe(true);
      expect(loadSettings().ghostFaceColors).toEqual(edited.ghostFaceColors);
      expect(loadSettings().faceColors).toEqual(DEFAULT_FACE_COLORS);
    } finally { vi.unstubAllGlobals(); }
  });
});
