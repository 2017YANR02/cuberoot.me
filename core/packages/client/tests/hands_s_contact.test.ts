import { describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import * as THREE from 'three';
import Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import HandsRig, { gripQuat, type HandDiagnosticFrame } from '@/app/[lang]/sim/engine/hands/handsRig';
import { buildManoHand } from '@/app/[lang]/sim/engine/hands/handModelMano';
import { IndexSkinSampler, readDiagnosticPieces, measureIndexContact } from '@/app/[lang]/sim/engine/hands/uContactGeometry';
import { FingerSurfaceSampler, FingerObstacle, FINGER_NAMES } from '@/app/[lang]/sim/engine/hands/fingerCollision';
import { SLICE_INDEX_CONTACT } from '@/app/[lang]/sim/engine/hands/sliceIndexFollow';
import { sliceIndexPose, SLICE_PRESS_END_DEGREES } from '@/app/[lang]/sim/engine/hands/sliceIndexMotion';
import { homeRight } from '@/app/[lang]/sim/engine/hands/handPoses';

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

describe.skipIf(!existsSync(asset(-1)) || !existsSync(asset(1)))('home S / S-prime presses U5 / U3 with the index pad', () => {
  it('limits root and palm twist, and avoids joint-speed spikes through press and release', () => {
    // The former contact-to-90 path reached 3.10 rad of extra MCP twist.
    for (const [, c1, , , splay, twist, ...meta] of SLICE_INDEX_CONTACT) {
      expect(c1).toBeLessThanOrEqual(1.8);
      expect(Math.abs(splay)).toBeLessThanOrEqual(.45);
      expect(Math.abs(twist)).toBeLessThanOrEqual(1.1);
      expect(Math.max(...meta.map(Math.abs))).toBeLessThanOrEqual(.12);
    }
    const rig = new HandsRig(), pose = homeRight().fingers.index, step = .5;
    const home = [...pose.curl, pose.splay, 0, 0, 0, 0];
    let speed = 0, acceleration = 0, previous: number[] | undefined;
    let last = sliceIndexPose(0, 0, 1, home, rig.tuning.push);
    for (let angle = step; angle <= 90; angle += step) {
      const next = sliceIndexPose(angle, 0, 1, home, rig.tuning.push);
      const velocity = next.map((c, i) => (c - last[i]) / step);
      speed = Math.max(speed, ...velocity.map(Math.abs));
      if (previous) acceleration = Math.max(acceleration, ...velocity.map((v, j) => Math.abs(v - previous![j]) / step));
      previous = velocity; last = next;
    }
    expect(speed).toBeLessThan(.09);
    expect(acceleration).toBeLessThan(.1);
    rig.dispose();
  });
  it('retracts before changing a prepared U5 contact to the F-layer U8 contact', async () => {
    const rig = new HandsRig(), cube = new Cube(3);
    try {
      rig.attachCube({ order: 3, table: { groups: { x: cube.table.groups.x, y: cube.table.groups.y, z: cube.table.groups.z } } });
      rig.setEnabled(true);
      await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
      let frame!: HandDiagnosticFrame;
      rig.subscribeDiagnostics(value => { frame = value; });
      expect(rig.prepareTwist('z', [1], 1)).toBe(true);
      for (let i = 0; i < 55; i++) rig.tick(4);
      expect(rig.prepareTwist('z', [1], 1)).toBe(false);
      const prepared = frame.models.R.fingers.index.tip.matrixWorld.elements.slice();
      expect(rig.prepareTwist('z', [2], 1)).toBe(true);
      rig.tick(0);
      expect(frame.models.R.fingers.index.tip.matrixWorld.elements).toEqual(prepared);
      expect(rig.isReachRetreating).toBe(true);
      for (let i = 0; i < 55; i++) rig.tick(4);
      expect(rig.isReachRetreating).toBe(false);
      expect(rig.prepareTwist('z', [2], 1)).toBe(true);
      // F includes a separate lift to clear the edge before approaching U8.
      for (let elapsed = 0; rig.isReachPreparing && elapsed < 240; elapsed += 4) rig.tick(4);
      expect(rig.prepareTwist('z', [2], 1)).toBe(false);
    } finally { rig.dispose(); cube.dispose(); }
  });
  it.each((['R', 'L'] as const).flatMap(side => [
    ...(['home', 'up', 'down', 'half'] as const).map(grip => ({ side, grip, cancelled: false })),
    { side, grip: 'home' as const, cancelled: true },
  ]))(
    '$side presses then releases safely with supporting hand $grip (cancelled=$cancelled)', async ({ side, grip, cancelled }) => {
    const rig = new HandsRig(), cube = new Cube(3);
    try {
      rig.attachCube({ order: 3, table: { groups: { x: cube.table.groups.x, y: cube.table.groups.y, z: cube.table.groups.z } } });
      rig.setEnabled(true);
      await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
      const other = side === 'R' ? 'L' : 'R', sign = side === 'R' ? 1 : -1;
      const sid = side === 'R' ? 'U5' : 'U3';
      rig.setGrips(gripQuat(side === 'R' ? 'home' : grip), gripQuat(side === 'L' ? 'home' : grip));
      let frame!: HandDiagnosticFrame;
      rig.subscribeDiagnostics(value => { frame = value; });
      expect(rig.prepareTwist('z', [1], sign)).toBe(true);
      rig.tick(0);
      const model = frame.models[side], sampler = new IndexSkinSampler(model);
      const surface = new FingerSurfaceSampler(model), support = new FingerSurfaceSampler(frame.models[other]);
      const fixed = [model.group, ...FINGER_NAMES.filter(f => f !== 'index')
        .flatMap(f => [model.fingers[f].root, model.fingers[f].mid, model.fingers[f].tip])];
      const held = fixed.map(part => part.matrixWorld.elements.slice());
      const nail = model.nailMeshes!.find(m => m.userData.nail.finger === 'index')!;
      const nailPoints = () => {
        const p = nail.geometry.getAttribute('position');
        return Array.from({ length: p.count }, (_, vertex) => ({ vertex, pad: false,
          point: new THREE.Vector3().fromBufferAttribute(p, vertex).applyMatrix4(nail.matrixWorld) }));
      };
      const nailFaces = () => {
        const p = nailPoints(), index = nail.geometry.index!, faces = [];
        for (let i = 0; i < index.count; i += 3) {
          const triangle = new THREE.Triangle(p[index.getX(i)].point, p[index.getX(i + 1)].point, p[index.getX(i + 2)].point);
          faces.push({ triangle, box: new THREE.Box3().setFromPoints([triangle.a, triangle.b, triangle.c]) });
        }
        return faces;
      };
      const check = (phase: string, touching: boolean, fingers: boolean) => {
        const pieces = readDiagnosticPieces(cube), skin = measureIndexContact(sampler.sample(cube), pieces);
        expect(skin.penetration.depthU, `${phase}: index / cube`).toBeLessThanOrEqual(.1);
        expect(measureIndexContact(nailPoints(), pieces).penetration.depthU, `${phase}: nail / cube`).toBeLessThanOrEqual(.1);
        // Idle breathing resumes after the gesture has fully finished.
        if (frame.hands[side].phase !== 'stable') for (const [i, part] of fixed.entries()) {
          expect(part.matrixWorld.elements, `${phase}: fixed palm/finger`).toEqual(held[i]);
        }
        if (touching) {
          // Contact may roll between mesh vertices. Sample actual pad edges as
          // well; vertex-only proximity can report a gap through a touching face.
          let contact = skin.contacts.find(c => c.stickerId === sid);
          if (!contact) {
            const points = sampler.sample(cube), key = (p: THREE.Vector3) => p.toArray().map(v => v.toFixed(6)).join(',');
            const pad = new Set(points.filter(p => p.pad).map(p => key(p.point)));
            const samples = [], edges = new Set<string>();
            for (const { triangle } of surface.sample('index')) {
              const p = [triangle.a, triangle.b, triangle.c];
              for (let i = 0; i < 3; i++) {
                const a = p[i], b = p[(i + 1) % 3], edge = [key(a), key(b)].sort().join('|');
                if (!pad.has(key(a)) || !pad.has(key(b)) || edges.has(edge)) continue;
                edges.add(edge);
                for (let t = .125; t < 1; t += .125) samples.push({ vertex: -1, pad: true, point: a.clone().lerp(b, t) });
              }
            }
            contact = measureIndexContact(samples, pieces).contacts.find(c => c.stickerId === sid);
          }
          expect(contact, `${phase}: ${JSON.stringify(skin.nearest)}`).toBeDefined();
          const normal = new THREE.Vector3(0, 0, 1).transformDirection(model.fingers.index.tip.matrixWorld);
          expect(normal.dot(new THREE.Vector3(...contact!.normalCube)), `${phase}: pad faces sticker`).toBeLessThan(-.5);
          expect(measureIndexContact(nailPoints().map(p => ({ ...p, pad: true })), pieces).contacts
            .filter(c => c.stickerId === sid), `${phase}: nail does not drive the sticker`).toEqual([]);
        }
        if (fingers) {
          const skinFaces = surface.sample('index'), nails = nailFaces();
          for (const hand of ['R', 'L'] as const) for (const finger of FINGER_NAMES) {
            if (hand === side && finger === 'index') continue;
            const obstacle = new FingerObstacle((hand === side ? surface : support).sample(finger));
            expect(obstacle.intersections(skinFaces), `${phase}: index / ${hand} ${finger}`).toBe(0);
            expect(obstacle.intersections(nails), `${phase}: nail / ${hand} ${finger}`).toBe(0);
          }
        }
        return skin;
      };
      for (let i = 0; i < 55; i++) { rig.tick(4); check(`prepare ${i}`, false, grip === 'home' && i % 5 === 0); }
      expect(rig.prepareTwist('z', [1], sign)).toBe(false);
      expect(check('start', true, true).contacts.find(c => c.stickerId === sid)?.currentSlot).toBe(sid);
      const s = cube.table.groups.z[1]; s.drag();
      const step = grip === 'home' ? .5 : 2;
      const angles = Array.from({ length: (cancelled ? 30 : 90) / step }, (_, i) => (i + 1) * step);
      if (cancelled) angles.push(...angles.slice(0, -1).reverse());
      for (const degrees of angles) {
        s.angle = sign * degrees * Math.PI / 180; rig.tick(0);
        const skin = check(`S ${degrees}`, degrees <= SLICE_PRESS_END_DEGREES, degrees % 5 === 0);
        // The second half intentionally releases the driving sticker.
        if (degrees >= 60) expect(skin.contacts.filter(c => c.stickerId === sid), `released ${degrees}`).toEqual([]);
      }
      s.drop(); rig.tick(0);
      if (!cancelled) expect(frame.hands[side].decay).toBe(0); // Already released; no extra hover pause.
      expect(rig.prepareTwist('x', [2], 1)).toBe(true); // Wait for index withdrawal before the next wrist turn.
      for (let i = 0; i < 200; i++) { rig.tick(4); check(`return ${i}`, false, i % 10 === 0); }
      expect(frame.grips).toEqual(side === 'R' ? { R: 'home', L: grip } : { L: 'home', R: grip });
      expect(rig.isReachRetreating).toBe(false);
      expect(frame.hands[side].phase).toBe('stable');
    } finally { rig.dispose(); cube.dispose(); }
  }, 30000);
});
