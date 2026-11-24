import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { knuckleStrain } from './handKnuckleStrain';
import HandsRig, { gripQuat, type HandsCubeLike } from '@/app/[lang]/sim/engine/hands/handsRig';
import { buildManoHand, type ManoHandData } from '@/app/[lang]/sim/engine/hands/handModelMano';
import { IndexSkinSampler, measureIndexContact, type FingerPoint } from '@/app/[lang]/sim/engine/hands/uContactGeometry';
import { segmentAxialRotation, type FingerName, type HandModel } from '@/app/[lang]/sim/engine/hands/handModel';
import { FingerSurfaceSampler, FingerObstacle, FINGER_NAMES } from '@/app/[lang]/sim/engine/hands/fingerCollision';
import type Cube from '@/app/[lang]/sim/engine/nxn/cube';

import { alignFrontIndex, easeFingerKnuckle } from '@/app/[lang]/sim/engine/hands/frontKnuckle';

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
  ...await original<typeof import('@/app/[lang]/sim/engine/hands/handModel')>(),
  makeSkinDetailTexture: () => new THREE.Texture(),
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

// Rotating front slab and stationary rear slab cover all 27 ideal cubie boxes.
function penetration(points: FingerPoint[], angle: number): number {
  let worst = -Infinity;
  const c = Math.cos(angle), s = Math.sin(angle);
  for (const { point: p } of points) {
    const x = p.x * c - p.y * s, y = p.x * s + p.y * c;
    worst = Math.max(worst,
      Math.min(96 - Math.abs(x), 96 - Math.abs(y), 32 - Math.abs(p.z - 64)),
      Math.min(96 - Math.abs(p.x), 96 - Math.abs(p.y), 64 - Math.abs(p.z + 32)));
  }
  return worst;
}

// Contact uses the outward nail surface; clearance uses the complete nail mesh.
function sampleNail(model: HandModel, name: FingerName) {
  const nail = model.nailMeshes!.find(mesh => mesh.userData.nail.finger === name)!;
  nail.updateWorldMatrix(true, false);
  const positions = nail.geometry.getAttribute('position');
  const normals = nail.geometry.getAttribute('normal');
  return Array.from({ length: positions.count }, (_, vertex) => ({
    vertex, pad: normals.getZ(vertex) < -.5,
    point: new THREE.Vector3().fromBufferAttribute(positions, vertex).applyMatrix4(nail.matrixWorld),
  }));
}

function nailFaces(model: HandModel, name: FingerName) {
  const points = sampleNail(model, name);
  const index = model.nailMeshes!.find(mesh => mesh.userData.nail.finger === name)!.geometry.index!;
  return Array.from({ length: index.count / 3 }, (_, face) => {
    const a = points[index.getX(face * 3)].point, b = points[index.getX(face * 3 + 1)].point;
    const c = points[index.getX(face * 3 + 2)].point;
    return { triangle: new THREE.Triangle(a, b, c), box: new THREE.Box3().setFromPoints([a, b, c]) };
  });
}

// Adjacent MANO triangles on the creases found in F playback. The last
// patch on each hand spans the knuckle that folds during the pad-to-nail roll.
// Each tuple lists an oriented shared edge and its two opposite vertices.
function indexFoldAngles(model: HandModel, side: 'R' | 'L') {
  const patches = side === 'R' ? [[77, 195, 196, 322], [65, 64, 363, 63], [248, 4712, 250, 4714]]
    : [[72, 194, 323, 193], [266, 242, 241, 265], [4709, 251, 250, 4716]];
  const mesh = model.meshes[0] as THREE.SkinnedMesh;
  const positions = mesh.geometry.getAttribute('position');
  const points = Array.from({ length: 4 }, () => new THREE.Vector3());
  const edge = new THREE.Vector3(), first = new THREE.Vector3(), second = new THREE.Vector3();
  return () => patches.map(vertices => {
    vertices.forEach((vertex, i) => mesh.applyBoneTransform(vertex, points[i].fromBufferAttribute(positions, vertex)));
    edge.subVectors(points[1], points[0]);
    first.crossVectors(edge, points[2].sub(points[0]));
    second.crossVectors(points[3].sub(points[0]), edge);
    return THREE.MathUtils.radToDeg(first.angleTo(second));
  });
}

// Most finger pairs are far apart. Build the triangle hierarchy only for
// overlapping world-space bounds, including both the skin and nail.
function posedFinger(surface: FingerSurfaceSampler, model: HandModel, name: FingerName) {
  const skin = surface.sample(name);
  const nail = model.nailMeshes!.find(mesh => mesh.userData.nail.finger === name)!;
  if (!nail.geometry.boundingBox) nail.geometry.computeBoundingBox();
  const box = nail.geometry.boundingBox!.clone().applyMatrix4(nail.matrixWorld);
  for (const face of skin) box.union(face.box);
  // Snapshot the nail as well: the passive hand is sampled in four distinct grips.
  const faces = skin.concat(nailFaces(model, name));
  let obstacle: FingerObstacle | undefined;
  return { box, faces, obstacle: () => obstacle ??= new FingerObstacle(faces) };
}

describe.skipIf(!existsSync(files.R) || !existsSync(files.L))('F-layer MANO contact with fixed palm', () => {
  it('preserves the MCP, PIP and distal frame when sharing roll at a flexed knuckle', () => {
    const model = buildManoHand(JSON.parse(readFileSync(files.R, 'utf8')), -1, new THREE.MeshStandardMaterial());
    const finger = model.fingers.index;
    finger.root.quaternion.copy(finger.rootBase).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(.8, -1.2, .52, 'YZX')));
    finger.mid.rotation.set(0, -.65, 0);
    const centers = [finger.root, finger.mid, finger.tip].map(joint => joint.getWorldPosition(new THREE.Vector3()));
    const distal = finger.tip.getWorldQuaternion(new THREE.Quaternion());
    const localAxial = () => segmentAxialRotation(finger.rootBase.clone().invert().multiply(finger.root.quaternion), finger.mid.position)!;
    const before = Math.abs(localAxial());
    easeFingerKnuckle(finger, 1);
    expect(Math.abs(localAxial())).toBeLessThan(before);
    const grip = { curl: [0, 0, 0] as [number, number, number], splay: 0, twist: .6 };
    const gripFrame = finger.rootBase.clone().multiply(new THREE.Quaternion().setFromEuler(
      new THREE.Euler(grip.twist * model.side, 0, 0, 'YZX')));
    const gripRoll = () => Math.abs(segmentAxialRotation(gripFrame.clone().invert().multiply(finger.root.quaternion), finger.mid.position)!);
    const beforeAlignment = gripRoll();
    // This artificial pose has already used the PIP hinge allowance.
    expect(Math.abs(alignFrontIndex(finger, grip, model.side, 1))).toBeGreaterThan(.1);
    expect(gripRoll()).toBeCloseTo(beforeAlignment, 8);
    for (const [i, joint] of [finger.root, finger.mid, finger.tip].entries()) {
      expect(joint.getWorldPosition(new THREE.Vector3()).distanceTo(centers[i])).toBeLessThan(1e-8);
    }
    expect(finger.tip.getWorldQuaternion(new THREE.Quaternion()).angleTo(distal)).toBeLessThan(1e-6);

    finger.mid.rotation.set(0, -.65, 0);
    const tip = finger.tip.getWorldPosition(new THREE.Vector3()), nailFrame = finger.tip.getWorldQuaternion(new THREE.Quaternion());
    alignFrontIndex(finger, grip, model.side, 1);
    expect(gripRoll()).toBeLessThan(beforeAlignment);
    expect(finger.tip.getWorldPosition(new THREE.Vector3()).distanceTo(tip)).toBeLessThan(1e-8);
    expect(finger.tip.getWorldQuaternion(new THREE.Quaternion()).angleTo(nailFrame)).toBeLessThan(1e-6);
  });
  it('continues a fast manual F2 across 90° from a partially reached pose', async () => {
    const rig = new HandsRig(); rigs.push(rig);
    const layers = () => Array.from({ length: 3 }, () => ({ angle: 0 }));
    const cube: HandsCubeLike = { order: 3, table: { groups: { x: layers(), y: layers(), z: layers() } } };
    rig.attachCube(cube); rig.setEnabled(true);
    await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
    let model!: HandModel;
    rig.subscribeDiagnostics(frame => { model = frame.models.R; });
    cube.table.groups.z[2].angle = Math.PI / 2;
    rig.tick(35);
    const finger = model.fingers.index;
    const tip = finger.tip.getWorldPosition(new THREE.Vector3());
    const knuckle = finger.root.quaternion.clone();
    cube.table.groups.z[2].angle += .0001;
    rig.tick(0);
    expect(finger.root.quaternion.angleTo(knuckle)).toBeLessThan(.001);
    expect(finger.tip.getWorldPosition(new THREE.Vector3()).distanceTo(tip)).toBeLessThan(.1);
  });
  it.each((['R', 'L'] as const).flatMap(side => (['home', 'down'] as const).flatMap(grip => [1, 2].map(quarters => ({ side, grip, quarters })))))('$side $grip contact and finger separation for $quarters quarters', async ({ side, grip, quarters }) => {
    const rig = new HandsRig(); rigs.push(rig);
    const layers = () => Array.from({ length: 3 }, () => ({ angle: 0 }));
    const cube: HandsCubeLike = { order: 3, table: { groups: { x: layers(), y: layers(), z: layers() } } };
    rig.attachCube(cube); rig.setEnabled(true);
    await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
    rig.setGrips(gripQuat(side === 'R' ? grip : 'half'), gripQuat(side === 'L' ? grip : 'half'));
    let models!: Record<'R' | 'L', HandModel>;
    rig.subscribeDiagnostics(frame => { models = frame.models; });
    const sign = side === 'R' ? 1 : -1;
    rig.prepareTwist('z', [2], sign, quarters);
    rig.tick(0);
    const sampler = new IndexSkinSampler(models[side]);
    const coordinateFrame = new THREE.Object3D() as unknown as Cube;
    const sample = () => sampler.sample(coordinateFrame);
    const surfaces = { R: new FingerSurfaceSampler(models.R), L: new FingerSurfaceSampler(models.L) };
    const workingGrip = quarters === 2 ? 'down' : grip;
    const moving = quarters === 2 ? ['index', 'middle'] as const : ['index'] as const;
    const other = side === 'R' ? 'L' : 'R';
    // The selected F gesture must also clear the passive hand in every grip.
    const supporting: ReturnType<typeof posedFinger>[] = [];
    for (const supportGrip of ['home', 'up', 'down', 'half'] as const) {
      rig.setGrips(gripQuat(side === 'R' ? grip : supportGrip), gripQuat(side === 'L' ? grip : supportGrip));
      rig.tick(0);
      supporting.push(...FINGER_NAMES.map(name => posedFinger(surfaces[other], models[other], name)));
    }
    rig.setGrips(gripQuat(side === 'R' ? grip : 'half'), gripQuat(side === 'L' ? grip : 'half'));
    rig.prepareTwist('z', [2], sign, quarters);
    rig.tick(0);
    // The contact trace is relative to the seated palm.
    while (rig.isRegripping) rig.tick(8);
    rig.prepareTwist('z', [2], sign, quarters);
    rig.tick(0);
    const strain = moving.map(name => knuckleStrain(models[side], name));
    const folds = workingGrip === 'home' && quarters === 1 ? indexFoldAngles(models[side], side) : null;
    const gripFold = folds?.().at(-1) ?? 0;
    const checkFingers = (phase: string, withdrawing = false) => {
      if (folds) {
        const angles = folds();
        for (const angle of angles) expect(angle, phase + ' index skin fold').toBeLessThan(95);
        expect(angles.at(-1)! - gripFold, phase + ' added knuckle fold').toBeLessThan(30.1);
      }
      const homeReturn = workingGrip === 'home' && withdrawing;
      for (const sample of strain) {
        const { min, max } = sample();
        expect(min, phase + ' knuckle compression').toBeGreaterThan(.30);
        if (homeReturn) expect(max, phase + ' returning knuckle stretch').toBeLessThanOrEqual(quarters === 1 ? 1.50 : 1.92);
        expect(max, phase + ' knuckle stretch').toBeLessThan(workingGrip === 'home' ? 2.1 : 3.2);
      }
      for (const name of moving) {
        const finger = models[side].fingers[name];
        if (name === 'index') {
          const q = finger.mid.quaternion;
          const hingeSwing = 2 * Math.atan2(Math.hypot(q.x, q.z), Math.hypot(q.w, q.y));
          expect(THREE.MathUtils.radToDeg(hingeSwing), phase + ' PIP off-hinge swing')
            .toBeLessThan(homeReturn && quarters === 1 ? 3 : 10.5);
        }
        const local = finger.rootBase.clone().invert().multiply(finger.root.quaternion);
        const angles = new THREE.Euler().setFromQuaternion(local, 'YZX');
        const axial = segmentAxialRotation(local, finger.mid.position);
        expect(axial, phase + ' defined MCP axis').not.toBeNull();
        expect(Math.abs(THREE.MathUtils.radToDeg(axial!)), phase + ' ' + name + ' MCP axial roll').toBeLessThan(29);
        expect(Math.abs(THREE.MathUtils.radToDeg(angles.x)), phase + ' ' + name + ' MCP twist').toBeLessThan(31);
        expect(Math.abs(THREE.MathUtils.radToDeg(angles.y)), phase + ' ' + name + ' MCP flexion').toBeLessThan(90);
        expect(Math.abs(THREE.MathUtils.radToDeg(angles.z)), phase + ' MCP splay').toBeLessThan(homeReturn ? 8 : 30);
        if (homeReturn) expect(Math.abs(THREE.MathUtils.radToDeg(axial!)), phase + ' return axial roll').toBeLessThan(12);
      }
      const posed = Object.fromEntries(FINGER_NAMES.map(name => [name, posedFinger(surfaces[side], models[side], name)]));
      for (const name of moving) {
        for (const fixed of FINGER_NAMES) {
          if (fixed === name || (name === 'middle' && fixed === 'index')) continue;
          if (!posed[fixed].box.intersectsBox(posed[name].box)) continue;
          expect(posed[fixed].obstacle().intersections(posed[name].faces), `${phase}: ${name}/${fixed}`).toBe(0);
        }
        for (const fixed of supporting) {
          if (fixed.box.intersectsBox(posed[name].box)) {
            expect(fixed.obstacle().intersections(posed[name].faces), `${phase}: ${name}/support`).toBe(0);
          }
        }
      }
    };
    const checkMiddle = (angle: number, phase: string) => {
      if (workingGrip !== 'down' || quarters !== 2) return;
      const middle = [...surfaces[side].samplePoints('middle'), ...sampleNail(models[side], 'middle')];
      expect(penetration(middle, angle), phase + ' middle/cube').toBeLessThanOrEqual(.1);
    };
    const palm = models[side].group.matrixWorld.clone();
    let worst = -Infinity;
    for (let i = 0; i < 100; i++) {
      rig.tick(4);
      checkMiddle(0, `prepare ${i}`);
      expect(penetration(sampleNail(models[side], 'index'), 0), `prepare nail ${i}`).toBeLessThanOrEqual(.1);
      worst = Math.max(worst, penetration(sample(), 0));
      if (i % 5 === 0) checkFingers(`prepare ${i}`);
    }
    expect(rig.isReachPreparing).toBe(false);
    const sid = side === 'R' ? 'U8' : 'U6';
    const depthSamples: number[][] = [[], []];
    const tip = models[side].fingers.index.tip, tipPosition = new THREE.Vector3();
    for (let degrees = 0; degrees <= 90; degrees += .125) {
      const angle = sign * degrees * Math.PI / 180;
      cube.table.groups.z[2].angle = angle; rig.tick(0);
      const points = sample();
      if (workingGrip === 'home') {
        const depth = tip.getWorldPosition(tipPosition).z;
        if (degrees >= 18 && degrees <= 42) depthSamples[0].push(depth);
        if (degrees >= 58 && degrees <= 82) depthSamples[1].push(depth);
      }
      if (degrees % .25 === 0) checkFingers(`turn ${degrees}`);
      checkMiddle(angle, `turn ${degrees}`);
      const matrix = new THREE.Matrix4().makeRotationZ(-angle)
        .multiply(new THREE.Matrix4().makeTranslation(sign * 64, 64, 64));
      const nailSkin = sampleNail(models[side], 'index');
      expect(penetration(nailSkin, angle), `turn nail ${degrees}`).toBeLessThanOrEqual(.1);
      const sticker = [{ initial: side === 'R' ? 26 : 24, matrix, faces: [3] }];
      if (degrees === 60) expect(measureIndexContact(points, sticker, 28).contacts.some(c => c.stickerId === sid),
        sid + ' pad at nail handoff').toBe(true);
      // By the end of the rollover window the facing nail surface alone
      // carries the sticker. A nearby palmar vertex must not mask a missed nail.
      if (degrees >= 75) expect(measureIndexContact(points, sticker, 28).contacts.some(c => c.stickerId === sid),
        sid + ' pad has rolled off at ' + degrees).toBe(false);
      const contact = measureIndexContact(degrees < 60 ? points : nailSkin, sticker, 28);
      expect(contact.contacts.some(c => c.stickerId === sid), `${sid} at ${degrees} degrees: ${JSON.stringify(contact.nearest)}`).toBe(true);
      worst = Math.max(worst, penetration(points, angle));
      expect(penetration(points, angle), `index/cube at ${degrees}`).toBeLessThanOrEqual(.1);
      expect(models[side].group.matrixWorld.elements).toEqual(palm.elements);
    }
    if (workingGrip === 'home') {
      // Z is tangent to this sticker throughout an F turn. Excess travel
      // catches a reversal even when every frame still touches the sticker.
      for (const [phase, depths] of depthSamples.entries()) {
        const travel = depths.slice(1).reduce((sum, z, i) => sum + Math.abs(z - depths[i]), 0);
        const net = Math.abs(depths.at(-1)! - depths[0]);
        expect(travel - net, phase === 0 ? 'pad backtracking' : 'nail backtracking').toBeLessThan(phase === 0 ? 11 : 2);
      }
    }
    // Second quarter releases the index while F2 / F2-prime continues moving.
    for (let degrees = 90.125; degrees <= quarters * 90; degrees += .125) {
      const angle = sign * degrees * Math.PI / 180;
      cube.table.groups.z[2].angle = angle; rig.tick(0);
      expect(penetration(sampleNail(models[side], 'index'), angle), `withdraw nail ${degrees}`).toBeLessThanOrEqual(.1);
      worst = Math.max(worst, penetration(sample(), angle));
      if (degrees % .25 === 0) checkFingers(`withdraw ${degrees}`, true);
      if (workingGrip === 'down') {
        const middle = surfaces[side].samplePoints('middle');
        checkMiddle(angle, `relay ${degrees}`);
        // After the first quarter, the original UFL/UFR side sticker faces up.
        const matrix = new THREE.Matrix4().makeRotationZ(-angle)
          .multiply(new THREE.Matrix4().makeTranslation(-sign * 64, 64, 64));
        const contact = measureIndexContact(middle, [{ initial: side === 'R' ? 24 : 26, matrix, faces: [side === 'R' ? 0 : 1] }]);
        expect(contact.contacts.length, `middle at ${degrees} degrees: ${JSON.stringify(contact.nearest)}`).toBeGreaterThan(0);
      }
    }
    cube.table.groups.z[2].angle = 0;
    for (let i = 0; i < 180; i++) {
      rig.tick(4);
      expect(penetration(sampleNail(models[side], 'index'), 0), `return nail ${i}`).toBeLessThanOrEqual(.1);
      worst = Math.max(worst, penetration(sample(), 0));
      checkMiddle(0, `return ${i}`);
      checkFingers(`return ${i}`, true);
    }
    // Ideal sharp boxes are stricter than the rendered rounded body; tolerance is 0.1 U.
    expect(worst).toBeLessThanOrEqual(.1);
  });
  it.each([1, 2])('mirrors down-grip F and F-prime for %s quarters, including return', async quarters => {
    const states: { rig: HandsRig; cube: HandsCubeLike; model: HandModel; sign: number }[] = [];
    for (const side of ['R', 'L'] as const) {
      const rig = new HandsRig(); rigs.push(rig);
      const layers = () => Array.from({ length: 3 }, () => ({ angle: 0 }));
      const cube: HandsCubeLike = { order: 3, table: { groups: { x: layers(), y: layers(), z: layers() } } };
      rig.attachCube(cube); rig.setEnabled(true);
      await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
      rig.setGrips(gripQuat('down'), gripQuat('down'));
      let model!: HandModel;
      rig.subscribeDiagnostics(frame => { model = frame.models[side]; });
      rig.prepareTwist('z', [2], side === 'R' ? 1 : -1, quarters); rig.tick(0);
      states.push({ rig, cube, model, sign: side === 'R' ? 1 : -1 });
    }
    const check = () => {
      for (const { model } of states) model.group.updateWorldMatrix(true, true);
      for (const name of ['index', 'middle'] as const) {
        for (const joint of ['root', 'mid', 'tip'] as const) {
          const right = states[0].model.fingers[name][joint].getWorldPosition(new THREE.Vector3());
          const left = states[1].model.fingers[name][joint].getWorldPosition(new THREE.Vector3());
          right.x *= -1;
          expect(right.distanceTo(left), `${name}.${joint}`).toBeLessThan(.002);
        }
      }
    };
    for (let degrees = 2; degrees <= quarters * 90; degrees += 2) {
      for (const { rig, cube, sign } of states) {
        cube.table.groups.z[2].angle = sign * degrees * Math.PI / 180; rig.tick(4);
      }
      check();
    }
    for (const { cube } of states) cube.table.groups.z[2].angle = 0;
    for (let i = 0; i < 74; i++) { for (const { rig } of states) rig.tick(4); check(); }
  });

});
