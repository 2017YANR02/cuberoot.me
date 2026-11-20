import { describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import * as THREE from 'three';
import Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import HandsRig, { gripQuat, type HandDiagnosticFrame } from '@/app/[lang]/sim/engine/hands/handsRig';
import { buildManoHand } from '@/app/[lang]/sim/engine/hands/handModelMano';
import { readDiagnosticPieces, measureIndexContact } from '@/app/[lang]/sim/engine/hands/uContactGeometry';
import { FINGER_NAMES, FingerSurfaceSampler } from '@/app/[lang]/sim/engine/hands/fingerCollision';
import { nailPoints } from '@/app/[lang]/sim/engine/hands/gestureContactTrace';

const asset = (side: number) => new URL(`../public/sim/hands/mano/${side === -1 ? 'right' : 'left'}.mano.json`, import.meta.url);
vi.mock('@/app/[lang]/sim/engine/hands/handModelMano', async original => ({
  ...await original<typeof import('@/app/[lang]/sim/engine/hands/handModelMano')>(),
  loadManoHand: async (side: 1 | -1, material: THREE.Material) =>
    buildManoHand(JSON.parse(readFileSync(asset(side), 'utf8')), side, material),
}));
vi.mock('@/app/[lang]/sim/engine/hands/handModel', async original => ({
  ...await original<typeof import('@/app/[lang]/sim/engine/hands/handModel')>(), makeSkinDetailTexture: () => new THREE.Texture(),
}));
vi.mock('@/app/[lang]/sim/engine/hands/bakeHandTexture', async original => ({
  ...await original<typeof import('@/app/[lang]/sim/engine/hands/bakeHandTexture')>(),
  bakeHandTextures: async () => ({ albedo: new THREE.Texture(), bump: new THREE.Texture(), rough: new THREE.Texture() }),
}));
vi.mock('@/app/[lang]/sim/engine/hands/handSkeleton', async original => ({
  ...await original<typeof import('@/app/[lang]/sim/engine/hands/handSkeleton')>(), addHandSkeleton: vi.fn(),
}));

const cases = (['x', 'y', 'z'] as const).flatMap(axis =>
  ([false, true] as const).flatMap(high =>
    (['home', 'up', 'down', 'half', 'halfDown'] as const).flatMap(grip =>
      ([1, -1] as const).map(dir => ({ axis, high, grip, dir })))));

describe.skipIf(!existsSync(asset(-1)) || !existsSync(asset(1)))('wide-turn stationary layer', () => {
  it.each(cases)('$axis high=$high dir=$dir with $grip hands', async ({ axis, high, grip, dir }) => {
    const cube = new Cube(3), rig = new HandsRig();
    try {
      rig.attachCube({ order: 3, table: { groups: { x: cube.table.groups.x, y: cube.table.groups.y, z: cube.table.groups.z } } });
      rig.setEnabled(true);
      await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
      rig.setGrips(gripQuat(grip), gripQuat(grip));
      let frame!: HandDiagnosticFrame;
      rig.subscribeDiagnostics(f => { frame = f; });
      rig.tick(0);
      const layers = high ? [1, 2] : [0, 1];
      const groups = layers.map(layer => cube.table.groups[axis][layer]);
      const prepare = () => rig.prepareTwist(axis, layers, dir);
      prepare();
      rig.tick(0);
      const plan = frame.wideSupport!;
      const model = frame.models[plan.hand], sampler = new FingerSurfaceSampler(model);
      const frontHome = axis === 'z' && high && grip === 'home';
      const startPalm = model.group.position.clone(), startWrist = model.group.quaternion.clone().normalize();
      const homeJoints = frontHome ? FINGER_NAMES.flatMap(name => {
        const f = model.fingers[name];
        return [f.root, f.mid, f.tip].map(joint => ({ name, joint, start: joint.quaternion.clone().normalize() }));
      }) : [];
      const held = new Map<string, string[]>();
      const inspect = (phase: string, holding: boolean) => {
        if (frontHome && frame.wideSupport) {
          const palm = model.group.position;
          expect(palm.x, phase).toBeCloseTo(startPalm.x, 5);
          expect(palm.z, phase).toBeCloseTo(startPalm.z, 5);
          expect(palm.y - startPalm.y, phase).toBeLessThanOrEqual(2.001);
          if (holding) expect(palm.y - startPalm.y, phase).toBeCloseTo(2, 5);
          expect(model.group.quaternion.clone().normalize().angleTo(startWrist), phase).toBeLessThan(1e-6);
          for (const { name, joint, start } of homeJoints)
            expect(joint.quaternion.clone().normalize().angleTo(start), phase + ' ' + name).toBeLessThan(name === 'thumb' ? .0041 : 1e-6);
        }
        const pieces = readDiagnosticPieces(cube);
        for (const finger of FINGER_NAMES) {
          const skin = measureIndexContact(sampler.samplePoints(finger), pieces);
          const nail = measureIndexContact(nailPoints(model, finger, new THREE.Matrix4()), pieces);
          expect(Math.max(skin.penetration.depthU, nail.penetration.depthU), phase + ' ' + finger).toBeLessThanOrEqual(.1);
          if (!holding || !plan.fingers.includes(finger)) continue;
          const stable = skin.contacts.filter(c => {
            const piece = pieces.find(p => p.initial === c.pieceInitial)!;
            const center = new THREE.Vector3().setFromMatrixPosition(piece.matrix);
            return center[axis] * (high ? -1 : 1) > 32;
          }).map(c => c.stickerId);
          const start = held.get(finger);
          if (start) expect(stable.some(id => start.includes(id)), phase + ' ' + finger).toBe(true);
          else { expect(stable.length, phase + ' ' + finger).toBeGreaterThan(0); held.set(finger, stable); }
        }
      };
      for (let i = 0; i < 64; i++) { rig.tick(8); if (i % 2 === 0) inspect('prepare ' + i, false); }
      expect(prepare()).toBe(false);
      expect(plan.fingers.length).toBeGreaterThanOrEqual(2);
      if (axis === 'x' && (grip === 'home' || grip === 'up' || grip === 'down')) expect(plan.shift).toEqual([0, 0, 0]);
      inspect('seated', true);
      const palm = model.group.position.clone();
      for (const group of groups) group.drag();
      for (let angle = 2; angle <= 90; angle += 2) {
        for (const group of groups) group.angle = dir * THREE.MathUtils.degToRad(angle);
        rig.tick(0);
        expect(model.group.position.distanceTo(palm)).toBeLessThan(.001);
        inspect('turn ' + angle, true);
      }
      for (const group of groups) group.drop();
      for (let i = 0; i < 75; i++) { rig.tick(8); if (i % 2 === 0) inspect('return ' + i, false); }
      expect(frame.wideSupport).toBeUndefined();
    } finally {
      rig.dispose();
      cube.dispose();
    }
  });
});
