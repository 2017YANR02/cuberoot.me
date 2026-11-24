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
  it.each((['R', 'L'] as const).flatMap(side => [
    { side, finger: 'thumb' as const, grip: 'down' as const },
    ...(['home', 'up', 'down'] as const).map(grip => ({ side, finger: 'index' as const, grip })),
  ]))('$side $finger tracks the rotating sticker from $grip', async ({ side, finger, grip }) => {
      const rig = new HandsRig(), cube = new Cube(3);
      try {
        rig.attachCube({ order: 3, table: { groups: { x: cube.table.groups.x, y: cube.table.groups.y, z: cube.table.groups.z } } });
        rig.setEnabled(true);
        await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
        const index = finger === 'index', layer = index ? 1 : 2, sign = side === 'R' ? -1 : 1;
        const supportGrip = grip === 'home' ? 'down' : 'home';
        rig.setGrips(gripQuat(side === 'R' ? grip : supportGrip), gripQuat(side === 'L' ? grip : supportGrip));
        const prepare = () => rig.prepareTwist('z', [layer], sign, 1, false, undefined, false,
          index && grip !== 'home' ? { contact: 'nail' } : undefined);
        let frame!: HandDiagnosticFrame;
        rig.subscribeDiagnostics(value => { frame = value; });
        expect(prepare()).toBe(true);
        rig.tick(0);
        const model = frame.models[side], sampler = new FingerSurfaceSampler(model);
        const toCube = cube.matrixWorld.clone().invert();
        const sticker = index ? (side === 'R' ? 'R1' : 'L1') : (side === 'R' ? 'D2' : 'D0');
        const other = new FingerSurfaceSampler(frame.models[side === 'R' ? 'L' : 'R']);
        const plate = model.nailMeshes!.find(mesh => mesh.userData.nail.finger === 'index')!;
        // Track one material point on the distal edge. The two nail meshes have opposite column order.
        const { nailPlateVertexCount, freeEdgeVertexStart } = plate.geometry.userData;
        const columns = (2 * nailPlateVertexCount - freeEdgeVertexStart) / 2;
        const tipVertex = nailPlateVertexCount - Math.ceil(columns / 2) + (side === 'R' ? 4 : -4);
        const bearing = new THREE.Vector3(side === 'R' ? 96 : -96, 37.4, -5);
        const joint = model.fingers.index;
        const axialAngle = () => new THREE.Euler().setFromQuaternion(
          joint.rootBase.clone().invert().multiply(joint.root.quaternion), 'YZX').x;
        let seatedTwist = 0;
        const seatedWrist = new THREE.Quaternion();
        const contactEnd = 54;
        let nailInSeatedPalm: THREE.Vector3 | undefined;
        let seatedPoint: THREE.Vector3 | undefined;
        let firstY: number | undefined, lastY = 0;
        const inspect = (press: boolean) => {
          const pieces = readDiagnosticPieces(cube);
          const skin = measureIndexContact(sampler.samplePoints(finger), pieces);
          const nailSamples = nailPoints(model, finger, toCube);
          const nail = measureIndexContact(nailSamples, pieces);
          expect(Math.max(skin.penetration.depthU, nail.penetration.depthU)).toBeLessThanOrEqual(.1);
          const moving = sampler.sample(finger);
          for (const hand of [sampler, other]) for (const fixed of FINGER_NAMES) {
            if (hand === sampler && fixed === finger) continue;
            expect(new FingerObstacle(hand.sample(fixed)).intersections(moving)).toBe(0);
          }
          if (index && frame.active) {
            expect(frame.grips[side]).toBe('home');
            expect(THREE.MathUtils.radToDeg(model.group.quaternion.angleTo(seatedWrist))).toBeLessThan(10.1);
            expect(axialAngle()).toBeCloseTo(seatedTwist, 6);
            const degree = THREE.MathUtils.radToDeg(Math.abs(cube.table.groups.z[layer].angle));
            if (degree > contactEnd + 12) expect(nail.contacts.some(c => c.stickerId === sticker)).toBe(false);
          }
          if (press) {
            if (index) {
              const point = nailSamples[tipVertex].point;
              if (!seatedPoint) {
                seatedPoint = point.clone();
                nailInSeatedPalm = model.group.worldToLocal(point.clone());
                expect(point.distanceTo(bearing)).toBeLessThan(2);
              }
              const angle = -cube.table.groups.z[layer].angle;
              const target = seatedPoint.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), angle);
              const local = point.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), -angle);
              expect(Math.hypot(local.y - seatedPoint.y, local.z - seatedPoint.z)).toBeLessThan(.15);
              expect(Math.abs(local.x) - 96).toBeGreaterThanOrEqual(0);
              expect(Math.abs(local.x) - 96).toBeLessThan(2.5);
              expect(point.distanceTo(target)).toBeLessThan(2);
              if (Math.abs(THREE.MathUtils.radToDeg(angle)) >= contactEnd - 1e-7) {
                const chord = target.clone().sub(seatedPoint);
                const wristOnly = model.group.localToWorld(nailInSeatedPalm!.clone());
                const fingerTravel = point.clone().sub(wristOnly).dot(chord.clone().normalize());
                expect(fingerTravel).toBeGreaterThan(.65 * chord.length());
              }
            }
            const hit = (index ? nail : skin).contacts.find(c => c.stickerId === sticker);
            expect(hit).toBeDefined();
            firstY ??= hit!.pointCube[1];
            lastY = hit!.pointCube[1];
          }
        };
        let ticks = 0;
        while (prepare()) { expect(++ticks).toBeLessThan(360); rig.tick(4); inspect(false); }
        seatedTwist = axialAngle();
        seatedWrist.copy(model.group.quaternion);
        const group = cube.table.groups.z[layer];
        group.drag(); inspect(true);
        for (let degrees = index ? .25 : 1; degrees <= 90; degrees += index ? .25 : 1) {
          group.angle = sign * degrees * Math.PI / 180; rig.tick(0);
          inspect(degrees <= (index ? contactEnd : 25));
        }
        expect(frame.active?.gesture).toMatchObject({ hand: side, finger, style: index ? 'sliceNail' : 'thumbLift' });
        group.drop(); rig.tick(0);
        ticks = 0;
        do {
          rig.tick(4); inspect(false); expect(++ticks).toBeLessThan(360);
        } while (rig.isReachRetreating || rig.isRegripping || frame.hands[side].phase !== 'stable');
        expect(frame.grips[side]).toBe(grip);
        expect(lastY).toBeGreaterThan(firstY! + 7);
        expect(frame.hands[side].phase).toBe('stable');
      } finally { rig.dispose(); cube.dispose(); }
    });

  it.each(['R', 'L'] as const)('seats the lower %s hand for U and restores it before the next F', async hand => {
    const rig = new HandsRig(), cube = new Cube(3);
    try {
      const { x, y, z } = cube.table.groups, other = hand === 'R' ? 'L' : 'R', sign = hand === 'R' ? 1 : -1;
      rig.attachCube({ order: 3, table: { groups: { x, y, z } } });
      rig.setEnabled(true);
      await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
      rig.setGrips(gripQuat(hand === 'R' ? 'down' : 'up'), gripQuat(hand === 'L' ? 'down' : 'up'));
      let frame!: HandDiagnosticFrame;
      rig.subscribeDiagnostics(f => { frame = f; }); rig.tick(0);
      const wrist = frame.hands[hand].wristAngle;
      const prepare = (axis: 'y' | 'z', dir: 1 | -1) => {
        let ticks = 0;
        while (rig.prepareTwist(axis, [2], dir)) {
          rig.tick(4); expect(++ticks).toBeLessThan(400);
          expect(frame.grips[other]).toBe('up');
        }
      };
      prepare('y', sign);
      expect(frame.grips[hand]).toBe('home');
      y[2].drag();
      for (let k = 1; k <= 90; k++) { y[2].angle = THREE.MathUtils.degToRad(k * sign); rig.tick(4); }
      expect(frame.active?.gesture).toMatchObject({ hand, finger: 'index', style: 'indexHook' });
      y[2].drop();
      for (let i = 0; i < 200; i++) rig.tick(4);
      expect(frame.hands[hand].wristAngle).toBeCloseTo(wrist, 8);
      expect(frame.grips[hand]).toBe('down');
      for (const dir of [1, -1] as const) {
        const model = frame.models[other];
        const bones = [model.group, ...FINGER_NAMES.flatMap(n => {
          const f = model.fingers[n]; return [f.root, f.mid, f.tip];
        })];
        prepare('z', dir);
        z[2].drag();
        const poses = bones.map(b => b.quaternion.clone().normalize());
        const position = model.group.position.clone();
        const surface = new FingerSurfaceSampler(model);
        const toCube = cube.matrixWorld.clone().invert();
        for (let k = 1; k <= 90; k++) {
          z[2].angle = THREE.MathUtils.degToRad(k * dir); rig.tick(4);
          for (const [j, bone] of bones.entries()) expect(bone.quaternion.clone().normalize().angleTo(poses[j])).toBeLessThan(1e-6);
          expect(model.group.position.distanceTo(position)).toBeLessThan(1e-6);
          const pieces = readDiagnosticPieces(cube);
          for (const finger of FINGER_NAMES) {
            const skinAndNail = [...surface.samplePoints(finger), ...nailPoints(model, finger, toCube)];
            expect(measureIndexContact(skinAndNail, pieces).penetration.depthU).toBeLessThanOrEqual(.1);
          }
        }
        expect(frame.active?.gesture).toMatchObject({ hand, style: dir === sign ? 'downPush' : 'thumbLift' });
        z[2].drop();
        for (let i = 0; i < 180; i++) rig.tick(4);
      }
    } finally { rig.dispose(); cube.dispose(); }
  });

  it.each(['up', 'down'] as const)('seats ordinary S quarters when both hands start away from home (%s)', async left => {
    const rig = new HandsRig(), cube = new Cube(3);
    try {
      const { x, y, z } = cube.table.groups;
      rig.attachCube({ order: 3, table: { groups: { x, y, z } } }); rig.setEnabled(true);
      await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
      let frame!: HandDiagnosticFrame;
      rig.subscribeDiagnostics(f => { frame = f; });
      for (const right of ['up', 'down'] as const) for (const dir of [1, -1] as const) {
        const driver = dir > 0 ? 'R' : 'L', support = dir > 0 ? 'L' : 'R';
        rig.setGrips(gripQuat(right), gripQuat(left)); rig.tick(0);
        let ticks = 0;
        while (rig.prepareTwist('z', [1], dir)) { rig.tick(4); expect(++ticks).toBeLessThan(360); }
        expect(frame.grips[driver]).toBe('home');
        expect(frame.grips[support]).toBe(support === 'R' ? right : left);
        z[1].drag(); z[1].angle = dir * Math.PI / 2; rig.tick(0);
        expect(frame.active?.gesture).toMatchObject({ hand: driver, style: 'topPush' });
        z[1].drop(); ticks = 0;
        do { rig.tick(4); expect(++ticks).toBeLessThan(360); }
        while (rig.isReachRetreating || rig.isRegripping || frame.hands[driver].phase !== 'stable');
        expect(frame.grips).toEqual({ L: left, R: right });
        cube.reset();
      }
    } finally { rig.dispose(); cube.dispose(); }
  });

  it('restores a temporarily seated thumb when the prepared step is replaced', async () => {
    const rig = new HandsRig(), cube = new Cube(3);
    try {
      const { x, y, z } = cube.table.groups;
      rig.attachCube({ order: 3, table: { groups: { x, y, z } } }); rig.setEnabled(true);
      await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
      rig.setGrips(gripQuat('up'), gripQuat('home'));
      let frame!: HandDiagnosticFrame;
      rig.subscribeDiagnostics(f => { frame = f; }); rig.tick(0);
      const original = frame.hands.R.wristAngle;
      const prepare = () => rig.prepareTwist('z', [2], -1, 1, false, undefined, false, { finger: 'thumb' });
      expect(prepare()).toBe(true);
      for (let i = 0; i < 180; i++) rig.tick(4);
      prepare();
      expect(frame.grips.R).toBe('down');
      expect(rig.prepareTwist('y', [2], 1)).toBe(true);
      for (let i = 0; i < 240; i++) rig.tick(4);
      expect(frame.grips).toEqual({ L: 'home', R: 'up' });
      expect(frame.hands.R.wristAngle).toBeCloseTo(original, 8);
      expect(frame.hands.R.phase).toBe('stable');
    } finally { rig.dispose(); cube.dispose(); }
  });

  it.each((['home', 'up', 'down'] as const).flatMap(L => (['home', 'up', 'down'] as const).map(R => ({ L, R }))))(
    'catches the second S sticker with the same nail from left $L and right $R', async ({ L, R }) => {
      const rig = new HandsRig(), cube = new Cube(3);
      try {
        const { x, y, z } = cube.table.groups;
        rig.attachCube({ order: 3, table: { groups: { x, y, z } } }); rig.setEnabled(true);
        await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
        let frame!: HandDiagnosticFrame;
        rig.subscribeDiagnostics(f => { frame = f; });
        for (const sign of [1, -1] as const) {
          const side = sign > 0 ? 'L' : 'R', support = sign > 0 ? 'R' : 'L';
          rig.setGrips(gripQuat(R), gripQuat(L)); rig.tick(0);
          const model = frame.models[side], surface = new FingerSurfaceSampler(model);
          const supportSurface = new FingerSurfaceSampler(frame.models[support]);
          const entryWrist = frame.hands[side].wristAngle;
          const checkClear = () => {
            expect(frame.grips[support]).toBe(support === 'R' ? R : L);
            expect(new FingerObstacle(surface.sample('middle')).intersections(surface.sample('index'))).toBe(0);
          };
          let ticks = 0;
          while (rig.prepareTwist('z', [1], sign, 2, false, undefined, false, { contact: 'nail' })) {
            rig.tick(4); checkClear(); expect(++ticks).toBeLessThan(360);
          }
          const homeWrist = model.group.quaternion.clone();
          const inverse = cube.matrixWorld.clone().invert();
          const anchor = new THREE.Vector2();
          z[1].drag();
          for (let deg = 0; deg <= 180; deg += (deg >= 84 && deg < 96) ? .25 : 1) {
            z[1].angle = sign * THREE.MathUtils.degToRad(deg); rig.tick(0); checkClear();
            expect(frame.grips[side]).toBe('home');
            expect(THREE.MathUtils.radToDeg(model.group.quaternion.angleTo(homeWrist))).toBeLessThan(10.1);
            const pieces = readDiagnosticPieces(cube), nail = nailPoints(model, 'index', inverse);
            expect(measureIndexContact([...surface.samplePoints('index'), ...nail], pieces).penetration.depthU).toBeLessThanOrEqual(.1);
            if (deg % 45 === 0) {
              const supportCount = FINGER_NAMES.filter(finger => measureIndexContact(supportSurface.samplePoints(finger), pieces)
                .contacts.some(c => Math.floor(c.pieceInitial / 9) !== 1)).length;
              expect(supportCount).toBeGreaterThanOrEqual(2);
            }
            if (deg <= 54 || deg >= 90 && deg <= 144) {
              // Corresponding material vertices on the two mirrored MANO nail edges.
              const tip = nail[side === 'R' ? 686 : 678];
              const sid = deg < 90 ? side + '1' : side === 'R' ? 'D5' : 'D3';
              const contact = measureIndexContact([{ ...tip, pad: true }], pieces).contacts.find(c => c.stickerId === sid);
              expect(contact, side + ' at ' + deg).toBeDefined();
              const uv = new THREE.Vector2(...contact!.uvU);
              if (deg === 0 || deg === 90) anchor.copy(uv);
              expect(uv.distanceTo(anchor)).toBeLessThan(.15);
            }
          }
          expect(frame.active?.gesture).toMatchObject({ hand: side, finger: 'index', style: 'sliceNailDouble' });
          z[1].drop(); ticks = 0;
          do {
            rig.tick(4); checkClear(); expect(++ticks).toBeLessThan(360);
          } while (rig.isReachRetreating || rig.isRegripping || frame.hands[side].phase !== 'stable');
          expect(frame.grips).toEqual({ L, R });
          expect(frame.hands[side].wristAngle).toBeCloseTo(entryWrist, 8);
          cube.reset();
        }
      } finally { rig.dispose(); cube.dispose(); }
    });

  it.each((['home', 'up', 'down'] as const).flatMap(L => (['home', 'up', 'down'] as const).map(R => ({ L, R }))))(
    'keeps the marked U double on both stickers from left $L and right $R', async ({ L, R }) => {
      const rig = new HandsRig(), cube = new Cube(3);
      try {
        const { x, y, z } = cube.table.groups;
        rig.attachCube({ order: 3, table: { groups: { x, y, z } } }); rig.setEnabled(true);
        await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
        let frame!: HandDiagnosticFrame;
        rig.subscribeDiagnostics(f => { frame = f; });
        for (const dir of [1, -1] as const) {
          const hand = dir === 1 ? 'R' : 'L', other = hand === 'R' ? 'L' : 'R';
          rig.setGrips(gripQuat(R), gripQuat(L)); rig.tick(0);
          const wrist = frame.hands[hand].wristAngle, supportGrip = frame.grips[other];
          const model = frame.models[hand], surface = new FingerSurfaceSampler(model);
          const checkClear = () => {
            const middle = new FingerObstacle(surface.sample('middle'));
            expect(middle.intersections(surface.sample('index'))).toBe(0);
            expect(middle.intersections(surface.sample('ring'))).toBe(0);
            expect(frame.grips[other]).toBe(supportGrip);
          };
          let ticks = 0;
          while (rig.prepareTwist('y', [2], dir, 2, false, undefined, false, { finger: 'middle' })) {
            expect(++ticks).toBeLessThan(360); rig.tick(4); checkClear();
          }
          expect(frame.grips[hand]).toBe('home');
          y[2].drag();
          for (let angle = .25; angle <= 180; angle += angle === .25 ? .75 : angle >= 86 && angle < 94 ? .25 : 1) {
            y[2].angle = THREE.MathUtils.degToRad(dir * angle); rig.tick(0); checkClear();
            const pieces = readDiagnosticPieces(cube);
            if (angle <= 90) {
              const lead = angle < 60 ? surface.samplePoints('index') : nailPoints(model, 'index', new THREE.Matrix4());
              expect(measureIndexContact(lead, pieces).contacts.map(c => c.stickerId), 'index ' + angle).toContain(dir > 0 ? 'B0' : 'B2');
            }
            if (angle >= 90) {
              const relay = measureIndexContact(surface.samplePoints('middle'), pieces);
              expect(relay.contacts.map(c => c.stickerId), 'middle ' + angle).toContain(dir > 0 ? 'L0' : 'R2');
            }
          }
          expect(frame.active?.gesture).toMatchObject({ hand, finger: 'index', finger2: 'middle' });
          y[2].drop(); ticks = 0;
          do {
            rig.tick(4); checkClear(); expect(++ticks).toBeLessThan(360);
          } while (rig.isReachRetreating || rig.isRegripping || frame.hands[hand].phase !== 'stable');
          expect(frame.grips).toEqual({ L, R });
          expect(frame.hands[hand].wristAngle).toBeCloseTo(wrist, 8);
          cube.reset();
        }
      } finally { rig.dispose(); cube.dispose(); }
    });

  it.each((['home', 'up', 'down'] as const).flatMap(L => (['home', 'up', 'down'] as const).map(R => ({ L, R }))))(
    'annotated F, S and U quarters restore left $L and right $R', async ({ L, R }) => {
      const rig = new HandsRig(), cube = new Cube(3);
      try {
        const { x, y, z } = cube.table.groups;
        rig.attachCube({ order: 3, table: { groups: { x, y, z } } });
        rig.setEnabled(true);
        await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
        let frame!: HandDiagnosticFrame;
        rig.subscribeDiagnostics(f => { frame = f; });
        for (const [axis, layer] of [['z', 1], ['z', 2], ['y', 2]] as const) for (const dir of [-1, 1] as const) {
          const upper = axis === 'y', index = layer === 1;
          const hand = (dir > 0) === upper ? 'R' : 'L';
          const finger = upper ? 'middle' : index ? 'index' : 'thumb';
          const mark = index ? { contact: 'nail' as const } : { finger: upper ? 'middle' as const : 'thumb' as const };
          rig.setGrips(gripQuat(R), gripQuat(L)); rig.tick(0);
          const wristAngle = frame.hands[hand].wristAngle;
          const model = frame.models[hand], other = hand === 'R' ? 'L' : 'R';
          const surfaces = { L: new FingerSurfaceSampler(frame.models.L), R: new FingerSurfaceSampler(frame.models.R) };
          const inspect = (phase: string, degree?: number) => {
            const at = `${L}/${R} ${finger} ${hand} ${phase}`;
            expect(frame.grips[other], at).toBe(other === 'R' ? R : L);
            if (index && degree !== undefined) expect(frame.grips[hand], at).toBe('home');
            const obstacle = new FingerObstacle(surfaces[hand].sample(finger));
            for (const side of ['L', 'R'] as const) for (const fixed of FINGER_NAMES) {
              if (side !== hand || fixed !== finger)
                expect(obstacle.intersections(surfaces[side].sample(fixed)), at + ' ' + side + fixed).toBe(0);
            }
            if (index && degree !== undefined) {
              const pieces = readDiagnosticPieces(cube);
              const anchored = FINGER_NAMES.filter(name =>
                measureIndexContact(surfaces[other].samplePoints(name), pieces).contacts
                  .some(contact => Math.abs(Math.floor(contact.pieceInitial / 9) - 1) === 1));
              expect(anchored.length, at + ' static row support').toBeGreaterThanOrEqual(2);
            }
            const contactEnd = upper ? 90 : index ? 54 : 25;
            if (degree !== undefined && degree <= contactEnd) {
              const skin = surfaces[hand].samplePoints(finger);
              const nail = nailPoints(model, finger, cube.matrixWorld.clone().invert());
              const points = upper && degree >= 58 && degree < 60 ? [...skin, ...nail]
                : index || upper && degree >= 60 ? nail : skin;
              const sticker = upper ? (hand === 'R' ? 'B0' : 'B2') : index ? (hand === 'R' ? 'R1' : 'L1') : (hand === 'R' ? 'D2' : 'D0');
              expect(measureIndexContact(points, readDiagnosticPieces(cube)).contacts.map(c => c.stickerId), at).toContain(sticker);
            }
          };
          let ticks = 0;
          while (rig.prepareTwist(axis, [layer], dir, 1, false, undefined, false, mark)) {
            expect(++ticks).toBeLessThan(360);
            rig.tick(4); inspect('prepare ' + ticks);
          }
          const group = cube.table.groups[axis][layer];
          group.drag();
          for (let degree = 1; degree <= 90; degree++) {
            group.angle = THREE.MathUtils.degToRad(dir * degree);
            rig.tick(0); inspect('turn ' + degree, degree);
          }
          expect(frame.active?.gesture).toMatchObject({ hand, finger, style: upper ? 'marked' : index ? 'sliceNail' : 'thumbLift' });
          group.drop();
          let recoveryTicks = 0;
          do {
            rig.tick(4); inspect('return ' + recoveryTicks);
            expect(++recoveryTicks).toBeLessThan(360);
          } while (rig.isReachRetreating || rig.isRegripping || frame.hands[hand].phase !== 'stable');
          expect(frame.grips).toEqual({ L, R });
          expect(frame.hands[hand].wristAngle).toBeCloseTo(wristAngle, 8);
          expect(frame.hands[hand].phase).toBe('stable');
          cube.reset();
        }
      } finally { rig.dispose(); cube.dispose(); }
    });
});
