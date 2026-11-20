import { afterEach, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import * as bodyAsset from '@/app/[lang]/sim/engine/hands/smplxBody';
import * as THREE from 'three';
import Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import Cubelet from '@cuberoot/puzzle-render-core/engine/nxn/cubelet';
import { FACE, STICKER_CORNER_RADIUS, STICKER_INNER } from '@cuberoot/puzzle-render-core/engine/define';
import HandsRig, { gripQuat, type HandDiagnosticFrame } from '@/app/[lang]/sim/engine/hands/handsRig';
import { buildManoHand } from '@/app/[lang]/sim/engine/hands/handModelMano';
import { readDiagnosticPieces, measureIndexContact } from '@/app/[lang]/sim/engine/hands/uContactGeometry';
import { FingerObstacle, FingerSurfaceSampler, FINGER_NAMES } from '@/app/[lang]/sim/engine/hands/fingerCollision';
import { WRIST_LOCAL } from '@/app/[lang]/sim/engine/hands/handModel';

type MaterialEdge = { a: number; b: number; length: number };
const palmLengths = new WeakMap<HandModel, Record<'front' | 'back', MaterialEdge[]>>();
function classifyPalm(model: HandModel): HandModel {
  const mesh = model.meshes[0] as THREE.SkinnedMesh;
  model.group.updateMatrixWorld(true);
  const pos = mesh.geometry.getAttribute('position'), idx = mesh.geometry.index!;
  const lengths = { front: new Map<number, MaterialEdge>(), back: new Map<number, MaterialEdge>() };
  const end = model.fingers.middle.root.getWorldPosition(new THREE.Vector3()).x;
  for(let i=0; i<idx.count; i+=3) {
    const ids = [idx.getX(i),idx.getX(i+1),idx.getX(i+2)];
    const p = ids.map(v => new THREE.Vector3().fromBufferAttribute(pos,v).applyMatrix4(mesh.matrixWorld));
    const triangle = new THREE.Triangle(...p as [THREE.Vector3,THREE.Vector3,THREE.Vector3]);
    const center = triangle.getMidpoint(new THREE.Vector3()), n = triangle.getNormal(new THREE.Vector3());
    const t = (center.x - WRIST_LOCAL.x)/(end-WRIST_LOCAL.x);
    if (t > .03 && t < 1.02 && Math.abs(n.z) > .55) {
      const edges = n.z > 0 ? lengths.front : lengths.back;
      for (let j = 0; j < 3; j++) {
        const k = (j + 1) % 3, length = p[j].distanceTo(p[k]);
        if (Math.abs(p[j].x - p[k].x) <= .65 * length) continue;
        const a = Math.min(ids[j], ids[k]), b = Math.max(ids[j], ids[k]);
        edges.set(a * pos.count + b, { a, b, length });
      }
    }
  }
  palmLengths.set(model, { front: [...lengths.front.values()], back: [...lengths.back.values()] });
  return model;
}

const asset = (side: number) => new URL(`../public/sim/hands/mano/${side === -1 ? 'right' : 'left'}.mano.json`, import.meta.url);
const haveHands = existsSync(asset(-1)) && existsSync(asset(1));
const withHands = it.runIf(haveHands);
vi.mock('@/app/[lang]/sim/engine/hands/handModelMano', async original => ({
  ...await original<typeof import('@/app/[lang]/sim/engine/hands/handModelMano')>(),
  loadManoHand: async (side: 1 | -1, material: THREE.Material) =>
    classifyPalm(buildManoHand(JSON.parse(readFileSync(asset(side), 'utf8')), side, material)),
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

import type { HandModel } from '@/app/[lang]/sim/engine/hands/handModel';

afterEach(() => vi.restoreAllMocks());

function palmEdgeLengths(model: HandModel) {
  const mesh = model.meshes[0] as THREE.SkinnedMesh;
  const positions = mesh.geometry.getAttribute('position');
  const vertices = Array.from({ length: positions.count }, (_, i) =>
    mesh.applyBoneTransform(i, new THREE.Vector3().fromBufferAttribute(positions, i)).applyMatrix4(mesh.matrixWorld));
  const surfaces = palmLengths.get(model)!;
  return [...surfaces.front, ...surfaces.back].map(({ a, b }) => vertices[a].distanceTo(vertices[b]));
}

// Exact union of the fixed slab and rotating outer column, including nails.
function cubePenetration(model: HandModel, angle = 0, side: Side | 'upperWide' = 'R') {
  const c = Math.cos(angle), s = Math.sin(angle);
  model.group.updateMatrixWorld(true);
  const skin = model.meshes[0] as THREE.SkinnedMesh;
  const point = new THREE.Vector3();
  let depth = 0;
  for (const mesh of [skin, ...(model.nailMeshes ?? [])]) {
    const pos = mesh.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      point.fromBufferAttribute(pos, i);
      if (mesh === skin) skin.applyBoneTransform(i, point);
      point.applyMatrix4(mesh.matrixWorld);
      if (angle === 0) {
        depth = Math.max(depth, 96 - Math.max(Math.abs(point.x), Math.abs(point.y), Math.abs(point.z)));
        continue;
      }
      if (side === 'upperWide') {
        const bottom = Math.min(32 - Math.abs(point.y + 64), 96 - Math.abs(point.x), 96 - Math.abs(point.z));
        const top = Math.min(64 - Math.abs(point.y - 32), 96 - Math.abs(c * point.x + s * point.z),
          96 - Math.abs(-s * point.x + c * point.z));
        depth = Math.max(depth, top, bottom);
        continue;
      }
      const x = side === 'R' ? point.x : -point.x;
      const fixed = Math.min(64 - Math.abs(x + 32), 96 - Math.abs(point.y), 96 - Math.abs(point.z));
      const moving = Math.min(32 - Math.abs(x - 64), 96 - Math.abs(c * point.y - s * point.z),
        96 - Math.abs(s * point.y + c * point.z));
      depth = Math.max(depth, moving, fixed);
    }
  }
  return depth;
}

type Side = 'R' | 'L';
const HALF_SUPPORT_SLOTS = { R: ['B3', 'F8', 'F5', 'F2'], L: ['B5', 'F6', 'F3', 'F0'] };

function meshTriangles(geometry: THREE.BufferGeometry, matrix: THREE.Matrix4) {
  const indices = geometry.index!, positions = geometry.getAttribute('position');
  const vertices = Array.from({ length: positions.count }, (_, i) =>
    new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(matrix));
  return Array.from({ length: indices.count / 3 }, (_, i) => {
    const triangle = new THREE.Triangle(vertices[indices.getX(3 * i)], vertices[indices.getX(3 * i + 1)], vertices[indices.getX(3 * i + 2)]);
    return { triangle, box: new THREE.Box3().setFromPoints([triangle.a, triangle.b, triangle.c]) };
  });
}

function checkSeat(frame: HandDiagnosticFrame, side: Side) {
  const hand = frame.hands[side], model = frame.models[side], pose = hand.finalPose!;
  // World coincides with cube space in this fixture. Read the actual mesh
  // bone in hands-only mode and the displayed elbow in full-body mode.
  const forearm = model.forearm!;
  const back = pose.body
    ? new THREE.Vector3(...pose.body.elbow).sub(new THREE.Vector3(...pose.wristCenter)).normalize()
    : forearm.bindDir.clone().applyQuaternion(forearm.bone.quaternion.clone().multiply(forearm.bindQuat.clone().invert()))
      .applyQuaternion(model.group.quaternion).normalize();
  const neutral = forearm.bindDir.clone().applyQuaternion(model.group.quaternion);
  expect(THREE.MathUtils.radToDeg(back.angleTo(neutral)), side + ' seated wrist bend').toBeLessThan(64.1);
  expect(back.x * (side === 'R' ? 1 : -1), side + ' outward elbow').toBeGreaterThan(.6);
  expect(-pose.wrist!.flex).toBeGreaterThan(45);
  expect(Math.abs(pose.wrist!.radialProjection)).toBeLessThan(12);
}

function segments(centers: number[][]) {
  return centers.slice(1).map((end, i) => new THREE.Vector3(...end).distanceTo(new THREE.Vector3(...centers[i])));
}

withHands('holds both standard seats with rigid palms, fixed phalanges and mirrored pad support', async () => {
  const rig = new HandsRig(), cube = new Cube(3);
  try {
    const { x, y, z } = cube.table.groups;
    rig.attachCube({ order: 3, table: { groups: { x, y, z } } });
    rig.setEnabled(true);
    await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
    let frame!: HandDiagnosticFrame;
    rig.subscribeDiagnostics(value => { frame = value; });
    rig.tick(0);
    const sides = ['R', 'L'] as const;
    const pieces = readDiagnosticPieces(cube);
    // Intersect the finger triangles with the beveled black frame itself.
    // A valid sticker witness alone cannot exclude contact by the next facet.
    const frontFrames = new FingerObstacle(pieces.filter(piece => piece.faces.includes(FACE.F))
      .flatMap(piece => meshTriangles(Cubelet._FRAME, piece.matrix)));
    const metrics = sides.map(side => {
      const model = frame.models[side];
      return { side, surface: new FingerSurfaceSampler(model), palm: palmEdgeLengths(model),
        roots: FINGER_NAMES.map(name => model.fingers[name].root.quaternion.clone()),
        lengths: FINGER_NAMES.map(name => segments(frame.hands[side].finalPose!.fingers[name].centers)) };
    });
    let switching = false;
    for (const grip of ['half', 'halfDown', 'half'] as const) {
      rig.regrip(grip);
      for (let step = 0; step < 80; step++) {
        rig.tick(5);
        for (const { side, lengths, surface } of metrics) {
          const pose = frame.hands[side].finalPose!;
          expect(cubePenetration(frame.models[side]), side + grip + step).toBeLessThan(.1);
          expect(pose.wrist!.bend).toBeLessThan(64.1);
          expect(pose.wrist!.radialProjection).toBeGreaterThan(-25.05);
          expect(pose.wrist!.radialProjection).toBeLessThan(40.05);
          FINGER_NAMES.forEach((name, i) => {
            const finger = pose.fingers[name];
            if (name === 'index' || name === 'middle' || name === 'ring') {
              const nail = frame.models[side].nailMeshes!.find(mesh => mesh.userData.nail.finger === name)!;
              const label = side + ' ' + grip + ' ' + name + ' black frame at step ' + step;
              expect(frontFrames.intersections(surface.sample(name)), label).toBe(0);
              expect(frontFrames.intersections(meshTriangles(nail.geometry, nail.matrixWorld)), label + ' nail').toBe(0);
            }
            if (switching && name !== 'pinky') {
              const slot = HALF_SUPPORT_SLOTS[side][i];
              const contact = measureIndexContact(surface.samplePoints(name), pieces);
              expect(contact.contacts.some(c => c.currentSlot === slot), side + ' ' + name + ' ' + step).toBe(true);
            }
            segments(finger.centers).forEach((length, k) => expect(length).toBeCloseTo(lengths[i][k], 3));
            if (name !== 'thumb') {
              expect(Math.abs(finger.root.splay)).toBeLessThan(25);
              expect(Math.abs(finger.root.twist)).toBeLessThan(18);
              expect(Math.abs(finger.middle.splay)).toBeLessThan(.01);
              expect(Math.abs(finger.middle.twist)).toBeLessThan(.01);
            }
            expect(finger.middle.flex).toBeGreaterThan(-7);
            expect(finger.middle.flex).toBeLessThan(name === 'thumb' ? 95 : 130);
            expect(finger.distal.flex).toBeGreaterThan(-9);
            expect(finger.distal.flex).toBeLessThan(100);
          });
        }
      }
      switching = true;
      for (const { side, surface, palm, roots } of metrics) {
        FINGER_NAMES.forEach((name, i) => {
          expect(frame.models[side].fingers[name].root.quaternion.angleTo(roots[i]), side + ' ' + name + ' MCP').toBeLessThan(1e-6);
        });
        checkSeat(frame, side);
        const pose = frame.hands[side].finalPose!;
        expect(Math.abs(pose.fingers.pinky.middle.splay)).toBeLessThan(.01);
        expect(Math.abs(pose.fingers.pinky.middle.twist)).toBeLessThan(.01);
        const current = palmEdgeLengths(frame.models[side]);
        const change = current.map((length, i) => Math.abs(length / palm[i] - 1)).sort((a,b) => a-b);
        expect(change[Math.floor(.95 * change.length)], side + ' palm material edge change vs home').toBeLessThan(.001);
        const contacts = FINGER_NAMES.map(name => measureIndexContact(surface.samplePoints(name), pieces));
        contacts.forEach(c => expect(c.penetration.depthU).toBe(0));
        const slots = HALF_SUPPORT_SLOTS[side];
        // Distance from the F centreline to the index, middle and ring pad
        // contacts. Both hands use the same band, reflected about cube X=0.
        const outwardX = grip === 'half' ? [89.55, 87.31, 91.55] : [73.8, 55, 58.9];
        slots.forEach((slot, i) => {
          const pad = contacts[i].contacts.find(c => c.currentSlot === slot);
          expect(pad, side + ' ' + FINGER_NAMES[i]).toBeDefined();
          if (i === 0) return;
          const x = side === 'R' ? pad!.pointCube[0] : -pad!.pointCube[0];
          expect(Math.abs(x - outwardX[i - 1])).toBeLessThan(.13);
          const name = FINGER_NAMES[i];
          if (grip === 'half' && (name === 'index' || name === 'middle')) {
            // Follow the inner outline as the contact rolls to a neighboring
            // pad vertex. A different witness alone need not move the finger.
            const innerEdge = Math.min(...surface.samplePoints(name).filter(p => p.pad)
              .map(p => p.point.x * (side === 'R' ? 1 : -1)));
            expect(innerEdge).toBeGreaterThan(name === 'index' ? 69.2 : 66.9);
          }
          if (grip === 'half' && name === 'ring') {
            // The same material point stays fixed while the pad swivels.
            expect(pad!.witnessVertex).toBe(side === 'R' ? 758 : 760);
            const mirror = side === 'R' ? 1 : -1;
            const anchor = new THREE.Vector3(mirror * 91.55057, 77.60001, 97.61989);
            const contact = new THREE.Vector3(...pad!.pointCube);
            expect(contact.distanceTo(anchor)).toBeLessThan(.001);
            // Track a second point on the pad to distinguish a swivel from
            // simply leaving the entire ring finger in its previous pose.
            const prior = new THREE.Vector3(mirror * 87.83876, 72.54315, 98.90114).sub(anchor);
            const neighbor = surface.samplePoints('ring').find(p => p.vertex === 759)!.point;
            const expected = prior.applyEuler(new THREE.Euler(
              THREE.MathUtils.degToRad(0.786), mirror * THREE.MathUtils.degToRad(0.092),
              mirror * THREE.MathUtils.degToRad(3.862), 'ZYX',
            ));
            expect(neighbor.sub(contact).distanceTo(expected)).toBeLessThan(.001);
          }
          // Check the rendered color at the actual pad point, including the
          // rounded top of the sticker at the default playback thickness.
          const point = new THREE.Vector3(...pad!.pointCube);
          const ray = new THREE.Raycaster(point.clone().add(new THREE.Vector3(0, 0, Cubelet.SIZE)), new THREE.Vector3(0, 0, -1));
          const [top] = ray.intersectObject(cube.instancedRenderer.staticSticker, false);
          expect(top?.point.z, side + ' ' + slot + ' pad on sticker').toBeGreaterThanOrEqual(point.z);
          // An inscribed round corner keeps the witness off the black seam,
          // even where a nominal square contact would still pass.
          const straight = STICKER_INNER / 2 - STICKER_CORNER_RADIUS;
          const [u, v] = pad!.uvU;
          const cornerDistance = Math.hypot(Math.max(0, Math.abs(u) - straight), Math.max(0, Math.abs(v) - straight));
          expect(STICKER_CORNER_RADIUS - cornerDistance).toBeGreaterThan(.35);
        });
        expect(contacts[4].state).toBe('separated');
        const fingers = FINGER_NAMES.map(name => surface.sample(name));
        fingers.forEach((finger, i) => {
          const obstacle = new FingerObstacle(finger);
          for (const other of fingers.slice(0, i)) expect(obstacle.intersections(other)).toBe(0);
        });
      }
    }
  } finally { rig.dispose(); cube.dispose(); }
});

withHands.each([
  ['R', 1], ['R', -1], ['L', 1], ['L', -1],
] as const)('carries all four original stickers through a half turn (%s, %i)', async (side, dir) => {
  const rig = new HandsRig(), cube = new Cube(3);
  try {
    const { x, y, z } = cube.table.groups;
    rig.attachCube({ order: 3, table: { groups: { x, y, z } } });
    rig.setEnabled(true);
    await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
    let frame!: HandDiagnosticFrame;
    rig.subscribeDiagnostics(value => { frame = value; });
    rig.tick(0);
    const sampler = new FingerSurfaceSampler(frame.models[side]), axis = new THREE.Vector3(-1, 0, 0);
    const fingers = ['thumb', 'index', 'middle', 'ring'] as const;
    const pieces = readDiagnosticPieces(cube);
    const original = fingers.map(name => measureIndexContact(sampler.samplePoints(name), pieces).nearest!.stickerId);
    const samples = () => fingers.map(name => sampler.samplePoints(name).find(p => p.pad)!.point);
    const layer = x[side === 'R' ? 2 : 0];
    expect(layer.drag()).toBe(true);
    let start: THREE.Vector3[] = [];
    for (let step = 1; step <= 60; step++) {
      const angle = dir * Math.PI * step / 60;
      layer.angle = angle;
      rig.tick(5);
      const pads = samples().map(point => point.applyAxisAngle(axis, -angle));
      if (step === 1) start = pads;
      else pads.forEach((point, i) => expect(point.distanceTo(start[i])).toBeLessThan(.001));
    }
    layer.drop();
    let penetration = 0;
    for (let step = 0; step < 60; step++) {
      rig.tick(5);
      penetration = Math.max(penetration, cubePenetration(frame.models[side]));
    }
    expect(penetration).toBeLessThan(.1);
    checkSeat(frame, side);
    const turnedPieces = readDiagnosticPieces(cube);
    fingers.forEach((name, i) => {
      const measurement = measureIndexContact(sampler.samplePoints(name), turnedPieces);
      expect(measurement.contacts.map(c => c.stickerId), name + ' original sticker').toContain(original[i]);
    });
  } finally { rig.dispose(); cube.dispose(); }
});

withHands('pinches F2 and B0 before R2′ and keeps both stickers through the marked u′', async () => {
  const rig = new HandsRig(), cube = new Cube(3);
  try {
    const { x, y, z } = cube.table.groups;
    rig.attachCube({ order: cube.order, table: { groups: { x, y, z } } }); rig.setEnabled(true);
    await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
    let frame!: HandDiagnosticFrame;
    rig.subscribeDiagnostics(value => { frame = value; }); rig.tick(0);
    const model = frame.models.R, sampler = new FingerSurfaceSampler(model);
    const checkPads = (pieces = readDiagnosticPieces(cube)) => {
      for (const [name, id] of [['thumb', 'F2'], ['index', 'B0']] as const) {
        const contacts = measureIndexContact(sampler.samplePoints(name), pieces).contacts;
        expect(contacts.map(c => c.stickerId), name + ' support').toContain(id);
      }
    };
    const leftSampler = new FingerSurfaceSampler(frame.models.L);
    const digitSurfaces = (hand: HandModel, surface: FingerSurfaceSampler) => FINGER_NAMES.map(name => {
      const faces = surface.sample(name);
      const nail = hand.nailMeshes!.find(mesh => mesh.userData.nail.finger === name)!;
      return faces.concat(meshTriangles(nail.geometry, nail.matrixWorld));
    });
    const checkFingerSpacing = (when: string) => {
      const right = digitSurfaces(model, sampler), left = digitSurfaces(frame.models.L, leftSampler);
      for (let i = 0; i < right.length; i++) {
        const obstacle = new FingerObstacle(right[i]);
        for (let j = i + 1; j < right.length; j++) {
          expect(obstacle.intersections(right[j]), when + ' R.' + FINGER_NAMES[i] + '/R.' + FINGER_NAMES[j]).toBe(0);
        }
        for (let j = 0; j < left.length; j++) {
          expect(obstacle.intersections(left[j]), when + ' R.' + FINGER_NAMES[i] + '/L.' + FINGER_NAMES[j]).toBe(0);
        }
      }
    };
    const next = { axis: 'y', layers: [1, 2], dir: -1, quarters: 1, annotation: { finger: 'middle' } } as const;
    const prepare = () => rig.prepareTwist('x', [2], -1, 2, false, undefined, false, undefined, next);
    expect(prepare()).toBe(true);
    rig.tick(0);
    const home = model.group.position.clone();
    checkFingerSpacing('home');
    rig.tick(100);
    expect(model.group.position.y).toBeGreaterThan(home.y);
    expect(rig.prepareTwist('x', [2], 1)).toBe(true);
    for (let i = 0; i < 150; i++) rig.tick(4);
    expect(prepare()).toBe(true);
    rig.tick(0);
    expect(model.group.position.distanceTo(home)).toBeLessThan(1e-6);
    for (let i = 0; i < 64; i++) {
      rig.tick(5);
      if (i % 4 === 0 || i === 63) checkFingerSpacing('lift' + i);
      expect(model.group.position.x).toBeCloseTo(home.x, 7);
      expect(model.group.position.z).toBeCloseTo(home.z, 7);
      expect(cubePenetration(model)).toBeLessThanOrEqual(.1);
    }
    expect(prepare()).toBe(false);
    expect(model.group.position.y - home.y).toBeCloseTo(32, 6);
    checkPads();
    const orientation = (name: typeof FINGER_NAMES[number]) => {
      const f = model.fingers[name];
      return [f.root, f.mid, f.tip].map(j => j.quaternion.clone().normalize());
    };
    const pose = FINGER_NAMES.map(orientation);
    const heldPose = (clearing: boolean) => FINGER_NAMES.forEach((name, i) => {
      const fixed = !clearing || name === 'thumb' || name === 'index';
      orientation(name).forEach((q, j) => expect(q.angleTo(pose[i][j]), name + ' local rotation')
        .toBeLessThan(fixed ? 1e-6 : THREE.MathUtils.degToRad(3)));
    });
    const layer = x[2];
    expect(layer.drag()).toBe(true);
    for (const degree of [.05, ...Array.from({ length: 360 }, (_, i) => (i + 1) / 2)]) {
      layer.angle = -THREE.MathUtils.degToRad(degree); rig.tick(4);
      checkPads(); heldPose(false);
      if (degree % 5 === 0) checkFingerSpacing('R2′ at ' + degree);
      expect(cubePenetration(model, layer.angle), 'R2′ at ' + degree).toBeLessThanOrEqual(.1);
    }
    const wrist = model.group.position.clone();
    layer.drop();
    for (let i = 0; i < 64; i++) {
      rig.tick(5); checkPads(); heldPose(false);
      expect(model.group.position.distanceTo(wrist)).toBeLessThan(.01);
    }
    const wide = () => rig.prepareTwist('y', [1, 2], -1, 1, false, undefined, false, next.annotation, 'right-weld');
    expect(wide()).toBe(true);
    for (let i = 0; i < 100; i++) {
      rig.tick(5); checkPads(); heldPose(true);
      if (i % 4 === 0 || i === 99) checkFingerSpacing('wide' + i);
      expect(cubePenetration(model)).toBeLessThanOrEqual(.1);
    }
    expect(wide()).toBe(false);
    const bottom = readDiagnosticPieces(cube).filter(piece => piece.matrix.elements[13] < -32);
    for (let degree = .25; degree <= 90; degree += .25) {
      const angle = -THREE.MathUtils.degToRad(degree);
      y[1].angle = y[2].angle = angle; rig.tick(0);
      checkPads(bottom); heldPose(true);
      if (degree % 3 === 0) checkFingerSpacing('u′ at ' + degree);
      expect(model.group.position.distanceTo(wrist)).toBeLessThan(.01);
      expect(cubePenetration(model, angle, 'upperWide'), 'u′ at ' + degree).toBeLessThanOrEqual(.1);
    }
    y[1].angle = y[2].angle = 0;
    for (let i = 0; i < 130; i++) {
      rig.tick(4);
      if (i % 5 === 0) checkFingerSpacing('return' + i);
      expect(cubePenetration(model), 'reseating ' + i).toBeLessThanOrEqual(.1);
      const contacts = measureIndexContact(sampler.samplePoints('index'), bottom).contacts;
      expect(contacts.some(c => c.stickerId === 'B0')).toBe(true);
    }
  } finally { rig.dispose(); cube.dispose(); }
});

withHands.each(['half', 'halfDown'] as const)('keeps both hands on their turning column when leaving %s', async grip => {
  const rig = new HandsRig(), cube = new Cube(3);
  try {
    const { x, y, z } = cube.table.groups;
    rig.attachCube({ order: 3, table: { groups: { x, y, z } } });
    rig.setEnabled(true);
    await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
    let frame!: HandDiagnosticFrame;
    rig.subscribeDiagnostics(f => { frame = f; });
    for (const side of ['R', 'L'] as const) for (const sign of [-1, 1]) {
      rig.setGrips(gripQuat(side === 'R' ? grip : 'home'), gripQuat(side === 'L' ? grip : 'home'));
      rig.tick(0);
      const model = frame.models[side], sampler = new FingerSurfaceSampler(model);
      const held = ['thumb', 'index', 'middle', 'ring'] as const;
      const ids = held.map(f => measureIndexContact(sampler.samplePoints(f), readDiagnosticPieces(cube)).nearest!.stickerId);
      const layer = x[side === 'R' ? 2 : 0];
      expect(layer.drag()).toBe(true);
      for (let degrees = .25; degrees <= 90; degrees += .25) {
        const angle = sign * THREE.MathUtils.degToRad(degrees);
        layer.angle = angle; rig.tick(0);
        const pieces = readDiagnosticPieces(cube);
        held.forEach((f, i) => expect(measureIndexContact(sampler.samplePoints(f), pieces).contacts
          .some(c => c.stickerId === ids[i]), side + ' ' + degrees + ' ' + f).toBe(true));
        if (degrees % 5 === 0) {
          const thumb = new FingerObstacle(sampler.sample('thumb'));
          for (const other of ['index', 'middle', 'ring', 'pinky'] as const) {
            expect(thumb.intersections(sampler.sample(other)), side + ' thumb / ' + other).toBe(0);
          }
        }
        expect(cubePenetration(model, angle, side), side + ' ' + degrees).toBeLessThanOrEqual(.1);
      }
      layer.drop(); rig.tick(0);
      for (let i = 0; i < 60; i++) {
        rig.tick(5);
        expect(cubePenetration(model)).toBeLessThanOrEqual(.1);
        const pieces = readDiagnosticPieces(cube);
        expect(held.some(f => measureIndexContact(sampler.samplePoints(f), pieces).contacts.length > 0), side + ' reseat').toBe(true);
      }
    }
  } finally { rig.dispose(); cube.dispose(); }
});

// The licensed one-piece mesh may be installed or supplied separately on a developer machine.
const onePiece = process.env.SMPLX_ONEPIECE_PATH ?? new URL('../public/sim/hands/smplx/onepiece.smplx.json', import.meta.url);
it.runIf(haveHands && existsSync(onePiece))('shares half-grip wrist bend with the displayed shoulder and elbow', async () => {
  vi.spyOn(bodyAsset, 'loadSmplxOnePiece').mockResolvedValue(JSON.parse(readFileSync(onePiece, 'utf8')));
  vi.spyOn(bodyAsset.SmplxBody.prototype, 'bakeTextures').mockResolvedValue(undefined);
  const rig = new HandsRig(), cube = new Cube(3);
  try {
    const { x, y, z } = cube.table.groups;
    rig.attachCube({ order: 3, table: { groups: { x, y, z } } });
    rig.setEnabled(true);
    rig.setFullBody(true);
    await vi.waitFor(() => expect(rig.fullBodyOn).toBe(true));
    let frame!: HandDiagnosticFrame;
    rig.subscribeDiagnostics(value => { frame = value; });
    rig.tick(0);
    const armLengths = (side: Side) => {
      const { body, wristCenter } = frame.hands[side].finalPose!;
      return segments([body!.shoulder, body!.elbow, wristCenter]);
    };
    const bind = { R: armLengths('R'), L: armLengths('L') };
    // The live layer is still carrying the starting grip near 180 degrees.
    // Its moving wrist needs support before the final grip is installed.
    for (const side of ['R', 'L'] as const) {
      const index = side === 'R' ? 2 : 0;
      for (const dir of [1, -1] as const) {
        rig.prepareTwist('x', [index], dir, 2);
        const layer = x[index];
        expect(layer.drag()).toBe(true);
        for (let step = 1; step <= 60; step++) {
          layer.angle = dir * Math.PI * step / 60;
          rig.tick(12);
          const pose = frame.hands[side].finalPose!;
          expect(pose.wrist!.bend, side + ' turning at step ' + step).toBeLessThan(67);
          armLengths(side).forEach((length, k) => expect(length).toBeCloseTo(bind[side][k], 2));
        }
        layer.drop();
        for (let step = 0; step < 30; step++) rig.tick(16);
      }
    }
    for (const grip of ['half', 'halfDown', 'half'] as const) {
      for (const side of ['R', 'L'] as const) {
        const support = side === 'R' ? 'L' : 'R';
        let restingTip: THREE.Vector3 | undefined;
        rig.regrip(grip, side);
        for (let i = 0; i < 30; i++) {
          rig.tick(16);
          if (frame.hands[side].phase === 'regripping') {
            const tip = frame.models[support].fingers.index.tip.getWorldPosition(new THREE.Vector3());
            restingTip ??= tip;
            expect(tip.distanceTo(restingTip), 'resting index during half regrip').toBeLessThan(.001);
          }
          for (const arm of ['R', 'L'] as const) {
            const pose = frame.hands[arm].finalPose!;
            const wrist = pose.wrist!;
            const elbow = new THREE.Vector3(...pose.body!.elbow);
            const upper = elbow.clone().sub(new THREE.Vector3(...pose.body!.shoulder));
            const fore = new THREE.Vector3(...pose.wristCenter).sub(elbow);
            expect(THREE.MathUtils.radToDeg(upper.angleTo(fore))).toBeLessThanOrEqual(150.01);
            expect(Math.abs(wrist.forearmTwist)).toBeLessThanOrEqual(90.001);
            expect(wrist.bend).toBeLessThan(65);
            expect(wrist.radialProjection).toBeGreaterThan(-25.05);
            expect(wrist.radialProjection).toBeLessThan(40.05);
            armLengths(arm).forEach((length, k) => expect(length).toBeCloseTo(bind[arm][k], 2));
          }
        }
        const pose = frame.hands[side].finalPose!;
        const seatedElbow = new THREE.Vector3(...pose.body!.elbow);
        const upper = seatedElbow.clone().sub(new THREE.Vector3(...pose.body!.shoulder));
        const fore = new THREE.Vector3(...pose.wristCenter).sub(seatedElbow);
        expect(THREE.MathUtils.radToDeg(upper.angleTo(fore))).toBeLessThan(147);
        expect(pose.wrist!.twistReference).toBe('upper-arm');
        checkSeat(frame, side);
      }
    }
  } finally {
    rig.dispose();
    cube.dispose();
  }
});
