import './_raf_stub';
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import Cube from '@/app/[lang]/sim/engine/nxn/cube';
import { __PERF_FLAGS } from '@/app/[lang]/sim/engine/nxn/instanced';
import { exportSimSvg, simSceneSignature } from '@/app/[lang]/sim/sim_svg_export';
import { exportSimSvgBsp } from '@/app/[lang]/sim/sim_svg_export_bsp';
import { CUBER_APPEARANCE } from '@/app/[lang]/sim/engine/define';
import World from '@/app/[lang]/sim/engine/world';
import { attachInteraction } from '@/app/[lang]/sim/worldInteraction';
import { applySettings, DEFAULT_SETTINGS, DEFAULT_FACE_COLORS, loadSettings } from '@/app/[lang]/sim/SettingDrawer';

describe('upstream cuber appearance', () => {
  it('keeps static/moving materials in sync without changing another cube or body', () => {
    const a = new Cube(3), b = new Cube(3);
    try {
      a.instancedRenderer.stickerEmission = 0.5;
      for (const mesh of [a.instancedRenderer.staticSticker, a.instancedRenderer.movingSticker]) {
        const mat = mesh.material as THREE.Material;
        expect(mat.userData.simStickerEmission).toBe(0.5);
        expect(mat.toneMapped).toBe(false);
      }
      expect(b.instancedRenderer.stickerEmission).toBe(0);
      expect((a.instancedRenderer.staticFrame.material as THREE.Material).userData.simStickerEmission).toBeUndefined();
      a.instancedRenderer.stickerEmission = 0;
      expect((a.instancedRenderer.staticSticker.material as THREE.Material).toneMapped).toBe(true);
    } finally { a.dispose(); b.dispose(); }
  });

  it('preserves the unlit high-order path without allocating a large cube', () => {
    const threshold = __PERF_FLAGS.superOrderThreshold;
    __PERF_FLAGS.superOrderThreshold = 3;
    let cube: Cube | undefined;
    try {
      cube = new Cube(3);
      cube.instancedRenderer.stickerEmission = 0.5;
      expect((cube.instancedRenderer.staticSticker.material as THREE.MeshBasicMaterial).isMeshBasicMaterial).toBe(true);
      expect(cube.instancedRenderer.stickerEmission).toBe(0);
    } finally { cube?.dispose(); __PERF_FLAGS.superOrderThreshold = threshold; }
  });

  it('exports per-instance red/green fill at the same linear brightness through both SVG paths', () => {
    const cube = new Cube(2);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(90, 1, 1, 1000);
    camera.position.z = 100;
    camera.updateProjectionMatrix();
    const geometry = new THREE.PlaneGeometry(30, 30);
    const mesh = new THREE.InstancedMesh(geometry, cube.instancedRenderer.staticSticker.material, 2);
    mesh.setMatrixAt(0, new THREE.Matrix4().makeTranslation(-25, 0, 0));
    mesh.setMatrixAt(1, new THREE.Matrix4().makeTranslation(25, 0, 0));
    mesh.setColorAt(0, new THREE.Color(1, 0, 0));
    mesh.setColorAt(1, new THREE.Color(0, 1, 0));
    scene.add(mesh, new THREE.AmbientLight(0xffffff, CUBER_APPEARANCE.ambient));
    const world = { scene, camera, width: 200, height: 200 };
    try {
      scene.updateMatrixWorld(true);
      const before = simSceneSignature(world);
      cube.instancedRenderer.stickerEmission = 0.5;
      expect(simSceneSignature(world)).not.toBe(before);
      // Upstream additive Lambert: ambient / π + emissiveIntensity.
      const brightness = 0.9 / Math.PI + 0.5;
      for (const exportSvg of [exportSimSvg, exportSimSvgBsp]) {
        const svg = exportSvg({ world });
        expect(svg).toContain(`#${new THREE.Color(brightness, 0, 0).getHexString()}`);
        expect(svg).toContain(`#${new THREE.Color(0, brightness, 0).getHexString()}`);
        expect(svg).not.toContain('#ffffff');
      }
    } finally { mesh.dispose(); geometry.dispose(); cube.dispose(); }
  });

  it('applies upstream lighting and plastic, then restores the rig for other surfaces', () => {
    const world = attachInteraction(new World());
    const initialCube = world.cube;
    const other = new Cube(3);
    try {
      applySettings(world, DEFAULT_SETTINGS);
      expect(world.ambient.intensity).toBe(0.9);
      expect(world.directional.intensity).toBe(0.25);
      const cube = world.cube as Cube;
      const plastic = cube.instancedRenderer.staticFrame.material as THREE.MeshPhongMaterial;
      expect(plastic.color.getHexString()).toBe('17181c');
      expect(plastic.specular.getHexString()).toBe('8a94a6');
      expect(plastic).not.toBe(other.instancedRenderer.staticFrame.material);
      applySettings(world, { ...DEFAULT_SETTINGS, coreOpacity: 50 });
      expect(plastic.opacity).toBe(0.5);
      expect(plastic.transparent).toBe(true);
      applySettings(world, { ...DEFAULT_SETTINGS, coreStyle: 'raw' });
      expect(world.ambient.intensity).toBe(Math.PI * 0.75);
      expect(cube.instancedRenderer.stickerEmission).toBe(0);
      applySettings(world, DEFAULT_SETTINGS);
      expect(world.ambient.intensity).toBe(0.9);
      world.setPuzzle('sq1');
      applySettings(world, DEFAULT_SETTINGS);
      expect(world.ambient.intensity).toBe(Math.PI * 0.75);
    } finally { world.controller.stop(); world.cube.dispose(); if (world.cube !== initialCube) initialCube.dispose(); other.dispose(); }
  });

  it('defaults to WCA and preserves saved face colours during core migration', () => {
    const read = (settings: object) => {
      vi.stubGlobal('window', { localStorage: { getItem: (key: string) => key === 'sim.settings' ? JSON.stringify(settings) : null } });
      return loadSettings();
    };
    try {
      expect(DEFAULT_SETTINGS.faceColors).toEqual(DEFAULT_FACE_COLORS);
      expect(read({}).faceColors).toEqual(DEFAULT_FACE_COLORS);
      expect(read({ faceColors: DEFAULT_FACE_COLORS, coreColor: '#202020' }).faceColors).toEqual(DEFAULT_FACE_COLORS);
      expect(read({ faceColors: CUBER_APPEARANCE.faces }).faceColors).toEqual(CUBER_APPEARANCE.faces);
      const custom = { ...DEFAULT_FACE_COLORS, U: '#abc123' };
      const migrated = read({ faceColors: custom, coreColor: '#123456' });
      expect(migrated.faceColors).toEqual(custom);
      expect(migrated.coreColor).toBe('#123456');
      expect(read({ ...DEFAULT_SETTINGS, faceColors: DEFAULT_FACE_COLORS }).faceColors).toEqual(DEFAULT_FACE_COLORS);
    } finally { vi.unstubAllGlobals(); }
  });
});
