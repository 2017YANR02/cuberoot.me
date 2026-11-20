import { describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import * as THREE from 'three';
import { knuckleStrain } from './handKnuckleStrain';
import { FACE } from '@cuberoot/puzzle-render-core/engine/define';
import { TwistAction } from '@cuberoot/puzzle-render-core/engine/nxn/twister';
import Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import HandsRig, { type HandDiagnosticFrame } from '@/app/[lang]/sim/engine/hands/handsRig';
import { buildManoHand } from '@/app/[lang]/sim/engine/hands/handModelMano';
import { FingerObstacle, FingerSurfaceSampler, FINGER_NAMES } from '@/app/[lang]/sim/engine/hands/fingerCollision';
import { GestureContactTrace, nailPoints } from '@/app/[lang]/sim/engine/hands/gestureContactTrace';
import { measureIndexContact, readDiagnosticPieces } from '@/app/[lang]/sim/engine/hands/uContactGeometry';

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

describe.skipIf(!existsSync(asset(1)))('3×3 M in the two-hand home grip', () => {
  it('plays both half-turn spellings toward the back pad while preserving notation and cube state', async () => {
    for (const token of ['M2', "M2'"]) {
      const cube = new Cube(3), expected = new Cube(3), rig = new HandsRig();
      try {
        const { x, y, z } = cube.table.groups;
        rig.attachCube({ order: 3, table: { groups: { x, y, z } }, twister: cube.twister });
        rig.setEnabled(true);
        await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
        const move = new TwistAction(token);
        expected.twister.twist(move, true, true);
        expect(cube.twister.twist(move, false, false)).toBe(true);
        expect(x[1].targetAngle).toBeCloseTo(Math.PI);
        expect(cube.history.last.value).toBe(move.value);
        cube.twister.finish();
        expect(cube.serializePictureFacelets()).toEqual(expected.serializePictureFacelets());
      } finally {
        rig.dispose();
        cube.dispose();
        expected.dispose();
      }
    }
  });

  it.each([['M', -1, 1], ['M′', 1, 1], ['M2', 1, 2]] as const)(
    '%s seats the correct surface and keeps the other fingertips at their grip points', async (_move, sign, quarters) => {
      const rig = new HandsRig(), cube = new Cube(3);
      const groups = cube.table.groups;
      try {
        rig.attachCube({ order: 3, table: { groups: { x: groups.x, y: groups.y, z: groups.z } }, twister: cube.twister });
        rig.setEnabled(true);
        await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
        let frame!: HandDiagnosticFrame;
        rig.subscribeDiagnostics(value => { frame = value; });
        // The parser supplies the negative x direction for plain M2.
        const inputDirection = quarters === 2 ? -1 : sign;
        expect(rig.prepareTwist('x', [1], inputDirection, quarters)).toBe(true);
        rig.tick(0);
        const left = frame.models.L, skin = new FingerSurfaceSampler(left);
        const identity = new THREE.Matrix4();
        const rightHome = frame.models.R.group.position.clone();
        const leftHome = left.group.position.clone();

        const right = frame.models.R;
        const resting = FINGER_NAMES.filter(name => name !== 'ring' && (quarters === 1 || name !== 'pinky'));
        const joints = FINGER_NAMES.flatMap(name => {
          const chain = (model: typeof left) => {
            const { meta, root, mid, tip } = model.fingers[name];
            return meta ? [meta, root, mid, tip] : [root, mid, tip];
          };
          return [...chain(right), ...(quarters === 1 && name !== 'ring' ? chain(left) : [])];
        });
        const homeRotations = joints.map(joint => joint.quaternion.clone());
        function padCenter(name: typeof FINGER_NAMES[number]) {
          const pad = skin.samplePoints(name).filter(p => p.pad);
          return pad.reduce((center, sample) => center.add(sample.point), new THREE.Vector3()).divideScalar(pad.length);
        }
        const homePads = resting.map(padCenter);
        const ringHome = padCenter('ring');
        const ringStrain = knuckleStrain(left, 'ring');
        const single = quarters === 1;
        const startSticker = sign === -1 ? 'D7' : 'B7';
        const release = 70;
        const degreeStep = single ? .125 : .25;
        const mmPerUnit = 56 / 192;
        const trace = new GestureContactTrace();
        let lastNail: THREE.Vector3 | undefined;
        const pinkyApproach: THREE.Vector3[] = [];

        function check(phase: 'prepare' | 'turn' | 'return', progress: number) {
          expect(frame.grips).toEqual({ L: 'home', R: 'home' });
          expect(frame.models.R.group.position.distanceTo(rightHome)).toBeLessThan(1e-6);
          const at = `${_move} ${phase} ${progress}`;
          joints.forEach((joint, i) => expect(joint.quaternion.angleTo(homeRotations[i]), at).toBeLessThan(1e-6));
          // MANO pose correctives can move a neighbouring skin vertex slightly even on a fixed bone.
          resting.forEach((name, i) => expect(padCenter(name).distanceTo(homePads[i]), `${at} ${name} grip`)
            .toBeLessThan(quarters === 2 ? 2 : .05));
          const strain = ringStrain();
          expect(strain.max, at).toBeLessThan(quarters === 2 ? 3.3 : 2.4);
          expect(strain.min, at).toBeGreaterThan(.12);
          const pieces = readDiagnosticPieces(cube);
          const measurements = FINGER_NAMES.map(name => {
            const skinPoints = skin.samplePoints(name), nailSurface = nailPoints(left, name, identity, single && sign === -1 && name === 'ring');
            return { name, skinPoints, nailSurface, pad: measureIndexContact(skinPoints, pieces),
              nail: measureIndexContact(nailSurface, pieces) };
          });
          for (const f of measurements) {
            // At 56 mm cube scale one model unit is 0.29 mm. Include skin and nail.
            expect(Math.max(f.pad.penetration.depthU, f.nail.penetration.depthU), `${at} ${f.name}`).toBeLessThan(1);
          }
          if (phase === 'turn') {
            const ring = measurements.find(f => f.name === 'ring')!;
            const pinky = measurements.find(f => f.name === 'pinky')!;
            if (single) {
              const stickerIds = sign === -1 ? ['D7', 'D4'] : ['B7'];
              if (progress === 0 || progress === 15 || progress === 45)
                expect(ring.pad.contacts.map(c => c.stickerId), at).toContain(startSticker);
              if (progress <= 60) {
                // Rectangle distance also covers the brief unloading across the D7/D4 seam.
                const strip = pieces.filter(p => p.initial === 1 || (sign === -1 && p.initial === 10))
                  .map(p => ({ ...p, faces: [sign === -1 ? FACE.D : FACE.B] }));
                const nearest = measureIndexContact([...ring.skinPoints, ...ring.nailSurface], strip).nearest;
                expect(nearest!.distanceToRectangleU * mmPerUnit, at).toBeLessThan(2);
              }
              if (progress >= 60 && progress <= release)
                expect(ring.nail.contacts.some(c => stickerIds.includes(c.stickerId)), at).toBe(true);
              if (progress >= release + 1)
                expect([...ring.pad.contacts, ...ring.nail.contacts].some(c => stickerIds.includes(c.stickerId)), at).toBe(false);
            }
            const nail = ring.nailSurface[0].point;
            if (lastNail) {
              const duringRoll = single && progress > 54 && progress <= 60;
              const travelMm = nail.distanceTo(lastNail) * mmPerUnit;
              expect(travelMm, at).toBeLessThan((duringRoll ? 8 : 12) * degreeStep);
            }
            lastNail = nail;
            if (quarters === 2 && progress <= 43)
              expect(ring.pad.contacts.map(c => c.stickerId), at).toContain('B7');
            if (quarters === 2) {
              if (progress <= 90) pinkyApproach.push(padCenter('pinky'));
              if (progress === 90) {
                const target = pinkyApproach[pinkyApproach.length - 1];
                const initialDistance = pinkyApproach[0].distanceTo(target);
                expect(Math.max(...pinkyApproach.map(p => p.distanceTo(target))), at).toBeLessThan(initialDistance + 2);
              }
              if (progress >= 90) {
                expect(padCenter('ring').distanceTo(ringHome), at).toBeLessThan(2);
                const contact = pinky.pad.contacts.find(c => c.stickerId === 'U1');
                expect(contact, at).toBeDefined();
                if (progress === 90) expect(contact!.currentSlot).toBe('B7');
              }
              expect(measurements[0].pad.contacts.map(c => c.stickerId), at).toContain('F3');
              expect(measurements[1].pad.contacts.map(c => c.stickerId), at).toContain('B2');
            }
          }
          const ringSurface = new FingerObstacle(skin.sample('ring'));
          expect(ringSurface.intersections(skin.sample('middle')), at).toBe(0);
          expect(ringSurface.intersections(skin.sample('pinky')), at).toBe(0);
        }

        for (let t = 0; t <= 100; t += 4) {
          rig.tick(t ? 8 : 0);
          check('prepare', t);
        }
        expect(rig.prepareTwist('x', [1], inputDirection, quarters)).toBe(false);
        const group = groups.x[1], leftSeated = left.group.position.clone();
        group.drag();
        for (let degree = 0; degree <= 90 * quarters; degree += degreeStep) {
          group.angle = sign * degree * Math.PI / 180;
          rig.tick(0);
          check('turn', degree);
          if (single) trace.observe(frame, cube);
          expect(left.group.position.distanceTo(leftSeated)).toBeLessThan(1e-6);
        }
        if (single) {
          const active = trace.read().filter(p => p.role === 'active' && p.finger === 'ring');
          expect(active.some(p => p.surface === 'pad' && p.anchor?.stickerId === startSticker)).toBe(true);
          const last = active.at(-1)!;
          expect(last.surface).toBe('nail');
          expect(last.anchor?.stickerId).toBe(sign === -1 ? 'D4' : 'B7');
          expect(last.contacts).toContain(last.anchor!.stickerId);
          expect(THREE.MathUtils.radToDeg(Math.abs(last.angle))).toBeCloseTo(release);
        }
        if (single) {
          // Playback commits between rendered frames and can end just shy of 90°.
          group.angle = sign * THREE.MathUtils.degToRad(89.99);
          rig.tick(0);
          lastNail = nailPoints(left, 'ring', identity, sign === -1)[0].point;
        }
        group.drop();
        const returnStep = single ? 1 : 4;
        for (let t = 0; t <= 100; t += returnStep) {
          rig.tick(t ? 3 * returnStep : 0);
          check('return', t);
          if (single) {
            const nail = nailPoints(left, 'ring', identity, sign === -1)[0].point;
            expect(nail.distanceTo(lastNail!) * mmPerUnit, 'continuous release across commit').toBeLessThan(t ? 1.25 : .001);
            lastNail = nail;
          }
        }
        if (single) expect(padCenter('ring').distanceTo(ringHome) * mmPerUnit).toBeLessThan(.3);
        expect(left.group.position.distanceTo(leftHome)).toBeLessThan(1e-6);
      } finally {
        rig.dispose();
        cube.dispose();
      }
    },
  );
});
