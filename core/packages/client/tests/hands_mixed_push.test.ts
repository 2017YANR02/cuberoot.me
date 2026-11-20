import { describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import * as THREE from 'three';
import Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import HandsRig, { gripQuat, type HandDiagnosticFrame } from '@/app/[lang]/sim/engine/hands/handsRig';
import { buildManoHand } from '@/app/[lang]/sim/engine/hands/handModelMano';
import { readDiagnosticPieces, measureIndexContact } from '@/app/[lang]/sim/engine/hands/uContactGeometry';
import { FingerObstacle, FINGER_NAMES, FingerSurfaceSampler } from '@/app/[lang]/sim/engine/hands/fingerCollision';
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

describe.skipIf(!existsSync(asset(-1)) || !existsSync(asset(1)))('mixed-grip upward strokes', () => {
  it.each((['R', 'L'] as const).flatMap(side => (['index', 'thumb'] as const).map(finger => ({ side, finger }))))(
    '$side $finger contacts and lifts its rotating sticker', async ({ side, finger }) => {
      const rig = new HandsRig(), cube = new Cube(3);
      try {
        rig.attachCube({ order: 3, table: { groups: { x: cube.table.groups.x, y: cube.table.groups.y, z: cube.table.groups.z } } });
        rig.setEnabled(true);
        await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
        const index = finger === 'index', layer = index ? 1 : 2, sign = side === 'R' ? -1 : 1;
        rig.setGrips(gripQuat((side === 'R') === index ? 'home' : 'down'), gripQuat((side === 'L') === index ? 'home' : 'down'));
        let frame!: HandDiagnosticFrame;
        rig.subscribeDiagnostics(value => { frame = value; });
        expect(rig.prepareTwist('z', [layer], sign)).toBe(true);
        rig.tick(0);
        const model = frame.models[side], sampler = new FingerSurfaceSampler(model);
        const toCube = cube.matrixWorld.clone().invert();
        const sticker = index ? (side === 'R' ? 'R4' : 'L4') : (side === 'R' ? 'D2' : 'D0');
        const other = new FingerSurfaceSampler(frame.models[side === 'R' ? 'L' : 'R']);
        let firstY: number | undefined, lastY = 0;
        const inspect = (press: boolean) => {
          const pieces = readDiagnosticPieces(cube);
          const skin = measureIndexContact(sampler.samplePoints(finger), pieces);
          const nail = measureIndexContact(nailPoints(model, finger, toCube), pieces);
          expect(Math.max(skin.penetration.depthU, nail.penetration.depthU)).toBeLessThanOrEqual(.1);
          const moving = sampler.sample(finger);
          for (const hand of [sampler, other]) for (const fixed of FINGER_NAMES) {
            if (hand === sampler && fixed === finger) continue;
            expect(new FingerObstacle(hand.sample(fixed)).intersections(moving)).toBe(0);
          }
          if (press) {
            const hit = (index ? nail : skin).contacts.find(c => c.stickerId === sticker);
            expect(hit).toBeDefined();
            firstY ??= hit!.pointCube[1];
            lastY = hit!.pointCube[1];
          }
        };
        for (let i = 0; i < 60; i++) { rig.tick(4); inspect(false); }
        expect(rig.prepareTwist('z', [layer], sign)).toBe(false);
        const group = cube.table.groups.z[layer];
        group.drag(); inspect(true);
        for (let degrees = 1; degrees <= 90; degrees++) {
          group.angle = sign * degrees * Math.PI / 180; rig.tick(0);
          inspect(degrees <= (index ? 12 : 25));
        }
        expect(frame.active?.gesture).toMatchObject({ hand: side, finger, style: index ? 'sliceNail' : 'thumbLift' });
        group.drop(); rig.tick(0);
        for (let i = 0; i < 90; i++) { rig.tick(4); inspect(false); }
        expect(lastY).toBeGreaterThan(firstY! + 7);
        expect(frame.hands[side].phase).toBe('stable');
      } finally { rig.dispose(); cube.dispose(); }
    });
});
