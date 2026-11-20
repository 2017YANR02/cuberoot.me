import { measureIndexContact } from '@/app/[lang]/sim/engine/hands/uContactGeometry';
import { FACE, STICKER_CORNER_RADIUS, STICKER_INNER } from '@cuberoot/puzzle-render-core/engine/define';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import HandsRig, { gripQuat, type HandDiagnosticFrame, type HandsCubeLike } from '@/app/[lang]/sim/engine/hands/handsRig';
import { buildManoHand, type ManoHandData } from '@/app/[lang]/sim/engine/hands/handModelMano';
import { FingerSurfaceSampler, FingerObstacle, FINGER_NAMES, type SkinTriangle } from '@/app/[lang]/sim/engine/hands/fingerCollision';
import type { FingerName, HandModel } from '@/app/[lang]/sim/engine/hands/handModel';
import type { FingerAnnotation } from '@/lib/alg-finger-marks';
import { homeLeft } from '@/app/[lang]/sim/engine/hands/handPoses';
import { fingerChannels } from '@/app/[lang]/sim/engine/hands/markedFingerMotion';
import { MARKED_FINGER_PROFILES } from '@/app/[lang]/sim/engine/hands/markedFingerPoses';

const files = {
  R: fileURLToPath(new URL('../public/sim/hands/mano/right.mano.json', import.meta.url)),
  L: fileURLToPath(new URL('../public/sim/hands/mano/left.mano.json', import.meta.url)),
};
vi.mock('@/app/[lang]/sim/engine/hands/handModelMano', async original => ({
  ...await original<typeof import('@/app/[lang]/sim/engine/hands/handModelMano')>(),
  loadManoHand: async (side: 1 | -1, material: THREE.Material) =>
    buildManoHand(JSON.parse(readFileSync(files[side === -1 ? 'R' : 'L'], 'utf8')) as ManoHandData, side, material),
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
const rigs: HandsRig[] = [];
afterEach(() => { for (const rig of rigs) rig.dispose(); rigs.length = 0; });

function nailPoints(model: HandModel, finger: FingerName): THREE.Vector3[] {
  const mesh = model.nailMeshes!.find(mesh => mesh.userData.nail.finger === finger)!;
  const position = mesh.geometry.getAttribute('position');
  return Array.from({ length: position.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld));
}

function nailTriangles(model: HandModel, finger: FingerName): SkinTriangle[] {
  const mesh = model.nailMeshes!.find(mesh => mesh.userData.nail.finger === finger)!;
  const points = nailPoints(model, finger), index = mesh.geometry.index!, faces: SkinTriangle[] = [];
  for (let i = 0; i < index.count; i += 3) {
    const triangle = new THREE.Triangle(points[index.getX(i)], points[index.getX(i + 1)], points[index.getX(i + 2)]);
    faces.push({ triangle, box: new THREE.Box3().setFromPoints([triangle.a, triangle.b, triangle.c]) });
  }
  return faces;
}

function contacts(model: HandModel, sampler: FingerSurfaceSampler, finger: FingerName, nail = false) {
  const mesh = nail ? model.nailMeshes!.find(mesh => mesh.userData.nail.finger === finger)!
    : model.meshes.find(mesh => (mesh as THREE.SkinnedMesh).isSkinnedMesh)!;
  const position = mesh.geometry.getAttribute('position'), normal = mesh.geometry.getAttribute('normal');
  const candidates = nail ? nailPoints(model, finger).map((point, vertex) => ({ point, vertex, pad: normal.getZ(vertex) < -.5 }))
    : sampler.samplePoints(finger);
  return candidates.filter(p => p.pad).map(({ point, vertex }) => {
    const n = new THREE.Vector3().fromBufferAttribute(position, vertex).add(new THREE.Vector3().fromBufferAttribute(normal, vertex));
    if (!nail) (mesh as THREE.SkinnedMesh).applyBoneTransform(vertex, n);
    return { point, vertex, normal: n.applyMatrix4(mesh.matrixWorld).sub(point).normalize() };
  });
}

function contactDistance(model: HandModel, sampler: FingerSurfaceSampler, finger: FingerName, nail: boolean, target: THREE.Vector3, normal: THREE.Vector3, facingLimit = -.9): number {
  const mesh = nail ? model.nailMeshes!.find(mesh => mesh.userData.nail.finger === finger)!
    : model.meshes.find(mesh => (mesh as THREE.SkinnedMesh).isSkinnedMesh)!;
  const points = new Map(contacts(model, sampler, finger, nail).map(p => [p.vertex, p]));
  const index = mesh.geometry.index!, triangle = new THREE.Triangle(), closest = new THREE.Vector3(), weights = new THREE.Vector3();
  let distance = Infinity;
  for (let i = 0; i < index.count; i += 3) {
    const a = points.get(index.getX(i)), b = points.get(index.getX(i + 1)), c = points.get(index.getX(i + 2));
    if (!a || !b || !c) continue;
    // The closest point can face away even when a nearby vertex on the
    // same dorsal surface faces the sticker, especially at a nail edge.
    for (const vertex of [a, b, c]) {
      if (vertex.normal.dot(normal) < facingLimit) distance = Math.min(distance, vertex.point.distanceTo(target));
    }
    triangle.set(a.point, b.point, c.point).closestPointToPoint(target, closest);
    triangle.getBarycoord(closest, weights);
    const facing = a.normal.clone().multiplyScalar(weights.x).addScaledVector(b.normal, weights.y).addScaledVector(c.normal, weights.z).normalize();
    if (facing.dot(normal) < facingLimit) distance = Math.min(distance, closest.distanceTo(target));
  }
  return distance;
}

// Exact union of the moving two-layer slab and the stationary third layer.
function penetration(points: readonly THREE.Vector3[], axis: 'y' | 'z', angle: number): number {
  const inverse = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(axis === 'y' ? 0 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0), angle);
  let worst = -Infinity;
  for (const p of points) {
    const q = p.clone().applyQuaternion(inverse);
    const moving = axis === 'y' ? Math.min(96 - Math.abs(q.x), 64 - Math.abs(p.y - 32), 96 - Math.abs(q.z))
      : Math.min(96 - Math.abs(q.x), 96 - Math.abs(q.y), 64 - Math.abs(p.z - 32));
    const fixed = axis === 'y' ? Math.min(96 - Math.abs(p.x), 32 - Math.abs(p.y + 64), 96 - Math.abs(p.z))
      : Math.min(96 - Math.abs(p.x), 96 - Math.abs(p.y), 32 - Math.abs(p.z + 64));
    worst = Math.max(worst, moving, fixed);
  }
  return worst;
}

const cases = [
  { name: 'middle pad B5 to L', annotation: { finger: 'middle' }, axis: 'y', dir: -1, grip: 'halfDown', hand: 'L', finger: 'middle', end: 90 },
  { name: 'middle nail L3 to B', annotation: { finger: 'middle', contact: 'nail' }, axis: 'y', dir: 1, grip: 'down', hand: 'L', finger: 'middle', end: 75 },
  { name: 'lower thumb pushes U5 with the index on D8', annotation: { finger: 'thumb' }, axis: 'z', dir: 1, grip: 'down', hand: 'R', finger: 'thumb', end: 90 },
  { name: 'upper thumb pushes U5 with the index on D8', annotation: { finger: 'thumb' }, axis: 'z', dir: 1, grip: 'up', hand: 'R', finger: 'thumb', end: 90 },
] as const;
const verifiedCases = cases.map(spec => ({ ...spec, mirrored: false }));

it.each(MARKED_FINGER_PROFILES.filter(p => p.side === 'L' && p.finger === 'middle'))(
  '$id lowers the original home grip before the index clears and the middle finger engages', profile => {
    const home = homeLeft().fingers;
    const neutral = FINGER_NAMES.flatMap(name => fingerChannels(home[name]));
    const approach = profile.handApproach!;
    const bottom = Math.min(...approach.map(row => row[2]));
    const seated = approach.findIndex(row => row[2] === bottom);
    expect(bottom).toBeLessThan(0);
    expect(seated).toBeGreaterThan(0);
    expect(approach[0][2]).toBeCloseTo(0, 9);
    for (const [i, row] of approach.entries()) {
      expect([row[1], ...row.slice(3, 7)]).toEqual([0, 0, 0, 0, 0]);
      expect(row.at(-1)).toBe(row[2]);
      expect(row[2]).toBeLessThanOrEqual(approach[Math.max(0, i - 1)][2]);
      if (i <= seated) expect(row.slice(7, 57)).toEqual(neutral);
    }
    const indexSet = approach[seated + 1];
    expect(indexSet.slice(17, 27)).not.toEqual(neutral.slice(10, 20));
    expect(indexSet.slice(27, 37)).toEqual(neutral.slice(20, 30));
    for (const row of [...approach.slice(seated + 1), ...profile.handTurn!]) {
      expect(row[2]).toBe(bottom);
      expect(row.slice(17, 27)).toEqual(indexSet.slice(17, 27));
      expect(row.slice(37, 47)).toEqual(indexSet.slice(37, 47));
    }
    for (const row of [...approach, ...profile.handTurn!, ...profile.handReturn!]) {
      expect(row.slice(7, 17)).toEqual(neutral.slice(0, 10));
      expect(row.slice(47, 57)).toEqual(neutral.slice(40));
    }
    expect(profile.handReturn!.at(-1)!.slice(7, 57)).toEqual(neutral);
  },
);

describe.skipIf(!existsSync(files.R) || !existsSync(files.L))('marked MANO gestures', () => {
  it('uses the left home F′ finger path for the closing wide f′', async () => {
    // Step eleven leaves the left hand in home grip. Compare at equal layer
    // angles and preparation / return times, including the actual hand bones.
    const run = async (layers: number[]) => {
      const rig = new HandsRig(); rigs.push(rig);
      const groups = () => Array.from({ length: 3 }, () => ({ angle: 0 }));
      const cube = { order: 3, table: { groups: { x: groups(), y: groups(), z: groups() } } };
      rig.attachCube(cube); rig.setEnabled(true);
      await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
      rig.setGrips(gripQuat('home'), gripQuat('home'));
      let frame!: HandDiagnosticFrame;
      rig.subscribeDiagnostics(f => { frame = f; });
      const samples: number[][] = [];
      const sample = (dt: number) => {
        rig.tick(dt);
        const hand = frame.models.L;
        samples.push([hand.group, ...FINGER_NAMES.flatMap(name => {
          const f = hand.fingers[name];
          return [f.root, f.mid, f.tip];
        })].flatMap(b => [...b.position.toArray(), ...b.quaternion.toArray()]));
      };
      sample(0);
      expect(rig.prepareTwist('z', layers, -1)).toBe(true);
      for (let i = 0; i < 50; i++) sample(10);
      expect(rig.prepareTwist('z', layers, -1)).toBe(false);
      for (let i = 1; i <= 180; i++) {
        for (const layer of layers) cube.table.groups.z[layer].angle = -i * Math.PI / 360;
        sample(4);
      }
      expect(frame.active?.gesture).toMatchObject({ kind: 'flick', hand: 'L', finger: 'index', style: 'topPush' });
      for (const layer of layers) cube.table.groups.z[layer].angle = 0;
      for (let i = 0; i < 60; i++) sample(10);
      return samples;
    };
    expect(await run([1, 2])).toEqual(await run([2]));
  });

  it.each(['half', 'halfDown'] as const)('slides the opposite %s grip onto the bottom row and can cancel halfway', async grip => {
    const rig = new HandsRig(); rigs.push(rig);
    const layers = () => Array.from({ length: 3 }, () => ({ angle: 0 }));
    const groups = { x: layers(), y: layers(), z: layers() };
    rig.attachCube({ order: 3, table: { groups } }); rig.setEnabled(true);
    await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
    rig.setGrips(gripQuat(grip), gripQuat('home'));
    let frame!: HandDiagnosticFrame;
    rig.subscribeDiagnostics(f => { frame = f; }); rig.tick(0);
    const right = new FingerSurfaceSampler(frame.models.R);
    const faces = [FACE.B, FACE.F].flatMap(face => [-64, 0, 64].map((y, row) => ({
      initial: (face === FACE.B ? 2 : 20) + row * 3, faces: [face],
      matrix: new THREE.Matrix4().makeTranslation(64, y, face === FACE.B ? -64 : 64),
    })));
    const palm = frame.models.R.group, home = palm.position.clone(), orientation = palm.quaternion.clone().normalize();
    const fingers = frame.models.R.fingers;
    const ring = fingers.ring.root.quaternion.clone(), pinky = fingers.pinky.root.quaternion.clone();
    const check = (turn: boolean) => {
      const pieces = turn ? faces.filter(p => p.matrix.elements[13] === -64) : faces;
      expect(palm.position.x).toBeCloseTo(home.x, 7);
      expect(palm.position.z).toBeCloseTo(home.z, 7);
      expect(palm.quaternion.clone().normalize().angleTo(orientation)).toBeLessThan(1e-6);
      if (turn) expect(home.y - palm.position.y).toBeCloseTo(35.6, 6);
      expect(fingers.ring.root.quaternion.angleTo(ring)).toBeLessThan(THREE.MathUtils.degToRad(6));
      expect(fingers.pinky.root.quaternion.angleTo(pinky)).toBeLessThan(THREE.MathUtils.degToRad(2));
      const index = new FingerObstacle([...right.sample('index'), ...nailTriangles(frame.models.R, 'index')]);
      expect(index.intersections([...right.sample('middle'), ...nailTriangles(frame.models.R, 'middle')])).toBe(0);
      for (const finger of FINGER_NAMES) {
        const points = [...right.samplePoints(finger).map(p => p.point), ...nailPoints(frame.models.R, finger)];
        expect(penetration(points, 'y', groups.y[2].angle), finger + ' sliding clearance').toBeLessThanOrEqual(.1);
      }
      for (const [name, sign, slot] of [['thumb', -1, 'B6'], ['middle', 1, 'F8']] as const) {
        const points = right.samplePoints(name);
        // A sliding pad can cross the plastic seam between two stickers.
        const gaps = points.filter(p => p.pad && Math.abs(p.point.x) <= 96 && Math.abs(p.point.y) <= 96)
          .map(p => sign * p.point.z - 96).filter(gap => gap >= 0);
        expect(Math.min(...gaps), name + ' sliding pad').toBeLessThanOrEqual(2.5);
        if (turn) expect(measureIndexContact(points, pieces).contacts.map(c => c.currentSlot)).toContain(slot);
      }
    };
    const prepare = () => rig.prepareTwist('y', [1, 2], -1, 1, false, undefined, false, { finger: 'middle' });
    expect(prepare()).toBe(true);
    for (let i = 0; i < 45; i++) { rig.tick(5); check(false); }
    rig.prepareTwist('x', [2], 1);
    for (let i = 0; i < 140; i++) { rig.tick(5); check(false); }
    expect(frame.models.R.group.position.distanceTo(home)).toBeLessThan(.001);
    expect(prepare()).toBe(true);
    for (let i = 0; i < 110; i++) { rig.tick(5); check(false); }
    expect(prepare()).toBe(false);
    for (let degree = 1; degree <= 90; degree++) {
      groups.y[1].angle = groups.y[2].angle = -THREE.MathUtils.degToRad(degree); rig.tick(0); check(true);
    }
    groups.y[1].angle = groups.y[2].angle = 0;
    for (let i = 0; i < 200; i++) { rig.tick(5); check(false); }
    expect(frame.models.R.group.position.distanceTo(home)).toBeLessThan(.001);
  });

  it.each(verifiedCases)('$name keeps the calibrated contacts and clears the puzzle', async spec => {
    const rig = new HandsRig(); rigs.push(rig);
    const layers = () => Array.from({ length: 3 }, () => ({ angle: 0 }));
    const cube: HandsCubeLike = { order: 3, table: { groups: { x: layers(), y: layers(), z: layers() } } };
    rig.attachCube(cube); rig.setEnabled(true);
    await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
    rig.setGrips(gripQuat(spec.mirrored ? 'home' : spec.grip), gripQuat(spec.mirrored ? spec.grip : 'home'));
    let frame!: HandDiagnosticFrame;
    rig.subscribeDiagnostics(f => { frame = f; }); rig.tick(0);
    const surfaces = { R: new FingerSurfaceSampler(frame.models.R), L: new FingerSurfaceSampler(frame.models.L) };
    const prepare = () => rig.prepareTwist(spec.axis, [1, 2], spec.dir, 1, false, undefined, false, spec.annotation as FingerAnnotation);
    const indexPadCenter = () => {
      const pad = surfaces.L.samplePoints('index').filter(sample => sample.pad);
      return pad.reduce((sum, sample) => sum.add(sample.point), new THREE.Vector3()).divideScalar(pad.length);
    };
    const startingWristFlex = frame.hands.R.finalPose!.wrist!.flex;
    const restingIndex = spec.grip === 'halfDown' ? indexPadCenter() : null;
    const upperIndex = spec.grip === 'up' ? new THREE.Vector3(
      ...MARKED_FINGER_PROFILES.find(p => p.id === 'thumb-pad-wide')!.supportContacts!.index!.point) : null;
    let upperWrist: { position: THREE.Vector3; orientation: THREE.Quaternion; bend: number } | undefined;
    const downNormal = new THREE.Vector3(0, -1, 0);
    const worst = { penetration: -Infinity, phase: '' }, collisions: string[] = [];
    const check = (phase: string, angle: number, crossings: boolean) => {
      if (spec.grip === 'halfDown' && phase.startsWith('turn')) {
        for (const [name, face, z] of [['thumb', FACE.B, -64], ['middle', FACE.F, 64]] as const) {
          const piece = { initial: z < 0 ? 2 : 20, faces: [face], matrix: new THREE.Matrix4().makeTranslation(64, -64, z) };
          expect(measureIndexContact(surfaces.R.samplePoints(name), [piece]).contacts, phase + ' right ' + name).not.toHaveLength(0);
        }
      }
      if (upperIndex) {
        expect(frame.grips.R).toBe('up');
        if (frame.marked) {
          const palm = frame.models.R.group;
          upperWrist ??= { position: palm.position.clone(), orientation: palm.quaternion.clone(), bend: frame.hands.R.wristBend! };
          expect(palm.position.distanceTo(upperWrist.position)).toBeLessThan(1e-7);
          expect(palm.quaternion.equals(upperWrist.orientation)).toBe(true);
          expect(frame.hands.R.wristBend).toBeCloseTo(upperWrist.bend, 8);
        }
        expect(contactDistance(frame.models.R, surfaces.R, 'index', false, upperIndex, downNormal),
          `right index on the same D8 point at ${phase}`).toBeLessThan(2);
      }
      if (restingIndex) {
        // Include setup and recovery: the index can travel with the wrist even
        // when every local joint is locked throughout the actual turn.
        expect(indexPadCenter().distanceTo(restingIndex), `left index excursion at ${phase}`).toBeLessThan(60);
      }
      const all = (['L', 'R'] as const).flatMap(side => FINGER_NAMES.map(finger => ({ side, finger,
        points: [...surfaces[side].samplePoints(finger).map(p => p.point), ...nailPoints(frame.models[side], finger)],
        triangles: crossings ? [...surfaces[side].sample(finger), ...nailTriangles(frame.models[side], finger)] : [],
      })));
      for (const side of ['L', 'R'] as const) {
        const mesh = frame.models[side].meshes.find(m => (m as THREE.SkinnedMesh).isSkinnedMesh)! as THREE.SkinnedMesh;
        const positions = mesh.geometry.getAttribute('position');
        const points = Array.from({ length: positions.count }, (_, i) => {
          const point = new THREE.Vector3().fromBufferAttribute(positions, i);
          return mesh.applyBoneTransform(i, point).applyMatrix4(mesh.matrixWorld);
        });
        const depth = penetration(points, spec.axis, angle);
        if (depth > worst.penetration) { worst.penetration = depth; worst.phase = `${phase} ${side}.skin`; }
      }
      for (const { side, finger, points } of all) {
        const depth = penetration(points, spec.axis, angle);
        if (depth > worst.penetration) { worst.penetration = depth; worst.phase = `${phase} ${side}.${finger}`; }
      }
      if (crossings) {
        for (let i = 0; i < all.length; i++) {
          const obstacle = new FingerObstacle(all[i].triangles);
          for (let j = i + 1; j < all.length; j++) if (obstacle.intersections(all[j].triangles)) {
            collisions.push(`${phase} ${all[i].side}.${all[i].finger}/${all[j].side}.${all[j].finger}`);
          }
        }
      }
    };
    expect(prepare()).toBe(true);
    // Include the real home frame before preparation in the rigid slide comparison.
    const slideSamples: { y: number; bones: THREE.Matrix4[]; bend: number }[] = [];
    for (let i = 0; i <= 130; i++) {
      rig.tick(i === 0 ? 0 : 4);
      check(`prepare ${i}`, 0, i % 5 === 0);
      if (spec.finger === 'middle' && i * 4 <= 120) {
        const hand = frame.models.L;
        const bones = [hand.group, ...Object.values(hand.fingers).flatMap(f => [f.meta, f.root, f.mid, f.tip])]
          .filter(b => !!b).map(b => b.matrixWorld.clone());
        slideSamples.push({ y: hand.group.position.y, bones, bend: frame.hands.L.wristBend! });
      }
    }
    if (slideSamples.length) {
      const start = slideSamples[0];
      expect(start.y - slideSamples.at(-1)!.y).toBeCloseTo(35.6, 6);
      for (const [i, sample] of slideSamples.entries()) {
        expect(sample.y).toBeLessThanOrEqual(slideSamples[Math.max(0, i - 1)].y);
        expect(sample.bend).toBeCloseTo(start.bend, 9);
        for (const [j, bone] of sample.bones.entries()) {
          const translated = start.bones[j].clone();
          translated.elements[13] += sample.y - start.y;
          const error = Math.max(...bone.elements.map((entry, k) => Math.abs(entry - translated.elements[k])));
          expect(error, 'bone follows the vertical slide rigidly').toBeLessThan(1e-8);
        }
      }
    }
    expect(rig.getMarkedMotionProblem()).toBeNull();
    expect(prepare(), JSON.stringify(rig.getMarkedMotionProblem())).toBe(false);
    expect(frame.marked).toMatchObject({ hand: spec.hand, finger: spec.finger, contact: (spec.annotation as FingerAnnotation).contact ?? 'pad' });
    const profile = MARKED_FINGER_PROFILES.find(p => p.id === frame.marked!.profile)!;
    const transform = (v: readonly [number, number, number]) => new THREE.Vector3(v[0] * (spec.mirrored ? -1 : 1), v[1], v[2]);
    const contactReport = { nailAt24_25: 0, largestNailGap: 0, thumbDepthAt55: 0 };
    const contactSamples = (angle: number) => {
      const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, spec.axis === 'y' ? -1 : 0, spec.axis === 'z' ? -1 : 0), angle);
      const target = transform(profile.start).applyQuaternion(rotation);
      const normal = transform(profile.normal).applyQuaternion(rotation);
      const active = frame.models[spec.hand], surface = surfaces[spec.hand];
      if (profile.nailTransfer) {
        const degrees = Math.abs(THREE.MathUtils.radToDeg(angle));
        const [start, transfer, end] = profile.nailTransfer;
        const rolling = degrees > start && degrees < end;
        const patch = (rolling ? [false, true] : [degrees >= transfer])
          .flatMap(nail => contacts(active, surface, spec.finger, nail));
        const inverse = rotation.clone().invert();
        const gap = Math.min(Infinity, ...patch.filter(({ normal: n }) => rolling || n.dot(normal) < -.85)
          .map(({point}) => point.clone().applyQuaternion(inverse))
          .filter(p => p.x > -94 && p.x < -34 && Math.abs(p.y) < 30)
          .map(p => Math.abs(p.z + 96)));
        expect(gap, `B5 ${rolling ? 'roll' : degrees >= transfer ? 'nail' : 'pad'} at ${degrees}°`).toBeLessThan(rolling ? 4 : 3);
      } else if (spec.finger === 'thumb') {
        const index = new FingerObstacle([...surface.sample('index'), ...nailTriangles(active, 'index')]);
        expect(index.intersections([...surface.sample('thumb'), ...nailTriangles(active, 'thumb')]),
          `thumb and index surfaces at ${angle}`).toBe(0);
        const inverse = rotation.clone().invert();
        const distances = contacts(active, surface, 'thumb').filter(p => p.normal.dot(normal) < -.90)
          .map(p => p.point.clone().applyQuaternion(inverse))
          .filter(p => p.x > 33 && p.x < 95 && Math.abs(p.z) < 30)
          .map(p => Math.abs(96 - p.y));
        expect(Math.min(...distances), `thumb pad over moving U5 at ${angle}`).toBeLessThan(3);
        const anchor = new THREE.Vector3(...profile.supportContacts!.index!.point);
        expect(contactDistance(active, surface, 'index', false, anchor, new THREE.Vector3(0, -1, 0)))
          .toBeLessThan(2);
      } else {
        // The curved middle nail rocks onto its dorsal edge and back as the
        // palm stays in home orientation. Track the same physical L3 point
        // against the nail triangles, with square-on contact at both ends.
        const degrees = Math.abs(THREE.MathUtils.radToDeg(angle));
        const facingLimit = degrees < 1e-6 || degrees >= 75 - 1e-6 ? -.90 : -.55;
        const distance = contactDistance(active, surface, spec.finger, true, target, normal, facingLimit);
        contactReport.largestNailGap = Math.max(contactReport.largestNailGap, distance);
        if (Math.abs(degrees - 24.25) < 1e-6) contactReport.nailAt24_25 = distance;
        expect(distance, `contact at ${angle}`).toBeLessThan(3);
      }
      // The block and contact both travel toward the declared adjacent face.
      if (angle !== 0) expect(target.clone().sub(transform(profile.start)).dot(transform(profile.destination))).toBeGreaterThan(0);
      if (spec.finger === 'middle') for (const [finger, z] of [['thumb', 96], ['ring', -96]] as const) {
        const anchor = profile.supportContacts![finger]!;
        const vertex = spec.mirrored ? anchor.mirroredVertex ?? anchor.vertex : anchor.vertex;
        const current = contacts(frame.models[spec.hand], surfaces[spec.hand], finger).find(p => p.vertex === vertex)!;
        expect(current, `${finger} distal-pad material point`).toBeDefined();
        // F6/B8 span [-96,-32] on both in-plane axes; retain 1U edge clearance.
        expect(Math.abs(current.point.x)).toBeGreaterThan(33);
        expect(Math.abs(current.point.x)).toBeLessThan(95);
        expect(current.point.y).toBeGreaterThan(-95);
        expect(current.point.y).toBeLessThan(-33);
        if (finger === 'ring') {
          // The distal pad seats on the colored, rounded B8 face.
          const flat = STICKER_INNER / 2 - STICKER_CORNER_RADIUS;
          const dx = Math.max(0, Math.abs(current.point.x + 64) - flat);
          const dy = Math.max(0, Math.abs(current.point.y + 64) - flat);
          expect(Math.hypot(dx, dy)).toBeLessThan(STICKER_CORNER_RADIUS);
          expect(Math.abs(current.point.z - z)).toBeLessThan(.5);
        }
        // Skin deforms as the distal pad rolls; the same stationary point on
        // the sticker must remain covered by the distal pad throughout.
        const held = transform(anchor.point); held.z = z;
        expect(contactDistance(frame.models[spec.hand], surfaces[spec.hand], finger, false,
          held, new THREE.Vector3(0, 0, Math.sign(z)), -.94), `${finger} fixed sticker contact at ${angle}`).toBeLessThan(3.2);
      }
    };
    contactSamples(0);
    const palms = { R: frame.models.R.group.matrixWorld.clone(), L: frame.models.L.group.matrixWorld.clone() };
    const heldJoints = FINGER_NAMES.filter(name => name !== spec.finger).flatMap(name => {
      const finger = frame.models[spec.hand].fingers[name];
      return [finger.meta, finger.root, finger.mid, finger.tip].filter(joint => !!joint).map(joint => [joint, joint.quaternion.clone()] as const);
    });
    const nailFinger = frame.models[spec.hand].fingers[spec.finger];
    const nailLinks = [nailFinger.meta, nailFinger.root, nailFinger.mid, nailFinger.tip].filter(link => !!link);
    let released: THREE.Quaternion[] | undefined;
    for (let degrees = .25; degrees <= 90; degrees += .25) {
      const angle = spec.dir * degrees * Math.PI / 180;
      cube.table.groups[spec.axis][1].angle = angle; cube.table.groups[spec.axis][2].angle = angle;
      rig.tick(0); check(`turn ${degrees}`, angle, degrees % 2 === 0);
      if (degrees <= spec.end) contactSamples(angle);
      if (spec.end === 75 && degrees === 75) released = nailLinks.map(link => link.quaternion.clone());
      if (released && degrees > 75) {
        nailLinks.forEach((link, i) => expect(link.quaternion.angleTo(released![i]),
          'released nail holds its 75° pose as the layer coasts').toBeLessThan(1e-6));
      }
      if (spec.grip === 'up' && degrees === 55) {
        const points = surfaces.R.samplePoints('thumb').map(sample => sample.point);
        contactReport.thumbDepthAt55 = penetration([...points, ...nailPoints(frame.models.R, 'thumb')], spec.axis, angle);
      }
      if (spec.grip === 'halfDown') {
        expect(frame.hands.R.finalPose!.wrist!.flex).toBeCloseTo(startingWristFlex, 2);
      } else if (spec.finger === 'thumb') {
        expect(frame.hands.R.wristBend!, `right wrist at ${degrees}° of the turn`).toBeLessThan(THREE.MathUtils.degToRad(65));
      }
      for (const side of ['L', 'R'] as const) {
        expect(frame.models[side].group.matrixWorld.elements).toEqual(palms[side].elements);
      }
      for (const [joint, orientation] of heldJoints) expect(joint.quaternion.angleTo(orientation)).toBeLessThan(1e-6);
    }
    cube.table.groups[spec.axis][1].angle = 0; cube.table.groups[spec.axis][2].angle = 0;
    // Playback can notice the commit while preparing the next token, before
    // the next rendered tick. That frame must still display the 90° endpoint.
    rig.prepareTwist('x', [2], 1);
    rig.tick(16);
    if (spec.end === 90) {
      contactSamples(spec.dir * Math.PI / 2);
    } else {
      const backFaceGap = Math.min(...nailPoints(frame.models.L, 'middle').map(point => -96 - point.z));
      expect(backFaceGap, 'nail has lifted from the rear sticker before recovery').toBeGreaterThan(2);
    }
    const activeHand = frame.models[spec.hand];
    const joints = Object.values(activeHand.fingers).flatMap(finger => [finger.root, finger.mid, finger.tip]);
    const previous = joints.map(joint => joint.quaternion.clone());
    let fastest = 0;
    for (let i = 0; frame.marked && i < 1500; i++) {
      rig.tick(1);
      check(`return ${i}`, 0, i % 5 === 0);
      for (let joint = 0; joint < joints.length; joint++) {
        const rotation = joints[joint].quaternion;
        fastest = Math.max(fastest, rotation.angleTo(previous[joint]));
        previous[joint].copy(rotation);
      }
    }
    expect(frame.marked).toBeUndefined();
    if (spec.finger === 'thumb') expect(frame.grips.R).toBe(spec.grip);
    // Bounded per-millisecond increments catch a visible snap even when
    // every pose along the return stays clear of the puzzle.
    expect(fastest, 'maximum local joint rotation in a 1 ms return sample').toBeLessThan(.022);
    if (process.env.MARKED_REPORT) console.log(spec.name, JSON.stringify({ worst, collisions, contactReport }));
    expect(collisions.slice(0, 8)).toEqual([]);
    expect(worst.penetration, worst.phase).toBeLessThanOrEqual(.1);
    if (spec.grip === 'halfDown') {
      const index = frame.models.R.fingers.index.root;
      const previous = index.quaternion.clone();
      rig.prepareTwist('x', [2], 1);
      for (let degrees = 1; degrees <= 35; degrees++) {
        cube.table.groups.x[2].angle = THREE.MathUtils.degToRad(degrees);
        rig.tick(0);
        expect(index.quaternion.angleTo(previous), `right index leaving half grip at ${degrees}°`)
          .toBeLessThan(THREE.MathUtils.degToRad(.95));
        previous.copy(index.quaternion);
      }
      expect(frame.active).toMatchObject({ axis: 'x', cls: 'high', gesture: { kind: 'weld', hands: ['R'] } });
    }
  }, 40000);
});
