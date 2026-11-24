import { describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { knuckleStrain } from './handKnuckleStrain';
import Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import { TwistAction } from '@cuberoot/puzzle-render-core/engine/nxn/twister';
import tweener from '@cuberoot/puzzle-render-core/engine/tweener';
import { thumbComparisons } from '@/app/[lang]/sim/grips/contactComparisons';
import { atlasCatalog, gripNames, moves } from '@/app/[lang]/sim/grips/catalog';
import HandsRig, { gripQuat, simulateGrips, type Axis, type HandGesture, type HandDiagnosticFrame } from '@/app/[lang]/sim/engine/hands/handsRig';
import { buildManoHand } from '@/app/[lang]/sim/engine/hands/handModelMano';
import { fingerBearing, strokeTangent } from '@/app/[lang]/sim/engine/hands/strokeGeometry';
import { IndexSkinSampler, readDiagnosticPieces, measureIndexContact } from '@/app/[lang]/sim/engine/hands/uContactGeometry';
import { GestureContactTrace } from '@/app/[lang]/sim/engine/hands/gestureContactTrace';
import { UContactRecorder } from '@/app/[lang]/sim/engine/hands/uContactRecorder';
import { FingerSurfaceSampler, FingerObstacle, FINGER_NAMES } from '@/app/[lang]/sim/engine/hands/fingerCollision';

import { homeLeft } from '@/app/[lang]/sim/engine/hands/handPoses';
import { segmentAxialRotation } from '@/app/[lang]/sim/engine/hands/handModel';

const asset = (side: number) => new URL(`../public/sim/hands/mano/${side === -1 ? 'right' : 'left'}.mano.json`, import.meta.url);
const haveBothHands = existsSync(asset(-1)) && existsSync(asset(1));
const withHands = it.runIf(haveBothHands);

withHands.each([
  { move: 'U2', side: 'R', dir: 1, R: 'home', L: 'down' },
  { move: "U2'", side: 'L', dir: -1, R: 'down', L: 'home' },
] as const)('hands marked $move from $side index nail to ring nail with the other wrist down', async ({ move, side, dir, R, L }) => {
  const rig = new HandsRig(), cube = new Cube(3);
  try {
    const { x, y, z } = cube.table.groups;
    rig.attachCube({ order: 3, table: { groups: { x, y, z } }, twister: cube.twister });
    rig.setEnabled(true);
    await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
    let frame!: HandDiagnosticFrame;
    rig.subscribeDiagnostics(value => { frame = value; });
    rig.setGrips(gripQuat(R), gripQuat(L));
    rig.tick(0);
    const prepare = () => rig.prepareTwist('y', [2], dir, 2, false, undefined, false, { contact: 'nail' });
    for (let i = 0; i < 120 && prepare(); i++) rig.tick(8);
    expect(prepare()).toBe(false);

    const [{ group }] = cube.table.convert(new TwistAction(move));
    const model = frame.models[side];
    const vertical = new THREE.Vector3(0, 1, 0);
    group.drag();
    for (let angle = 0; angle <= 180; angle++) {
      group.angle = dir * THREE.MathUtils.degToRad(Math.max(.001, angle));
      rig.tick(8);
      expect(frame.active?.gesture).toMatchObject({ kind: 'flick', hand: side, finger: 'index', finger2: 'ring' });
      expect(frame.grips).toEqual({ R, L });
      model.group.updateWorldMatrix(true, true);
      const fingers = angle === 90 ? ['index', 'ring'] : [angle < 90 ? 'index' : 'ring'];
      for (const finger of fingers) {
        const nail = model.nailMeshes!.find(mesh => mesh.userData.nail.finger === finger)!;
        // Undo this finger's quadrant to measure against the sticker it picked up on the back corner.
        const travel = THREE.MathUtils.degToRad(angle - (finger === 'ring' ? 90 : 0));
        const patch = nailVertices(nail).map(point => point.applyAxisAngle(vertical, dir * travel))
          .filter(point => Math.abs(point.x - dir * 64) <= 30 && Math.abs(point.y - 64) <= 30);
        const gap = Math.min(...patch.map(point => -96 - point.z));
        expect(gap, finger + ' at ' + angle).toBeGreaterThanOrEqual(0);
        expect(gap, finger + ' at ' + angle).toBeLessThanOrEqual(2.5);
      }
    }
    group.drop();
  } finally { rig.dispose(); cube.dispose(); }
});

withHands.each([
  { move: 'F', supportGrip: 'home' }, { move: 'F', supportGrip: 'down' },
  { move: "F'", supportGrip: 'home' }, { move: "F'", supportGrip: 'down' },
] as const)('drives underlined $move on the same sticker with the supporting wrist $supportGrip', async ({ move, supportGrip }) => {
  const clockwise = move === 'F', dir = clockwise ? 1 : -1;
  const finger = clockwise ? 'index' : 'thumb', hand = clockwise ? 'R' : 'L';
  const other = clockwise ? 'L' : 'R', grips = { [hand]: 'home', [other]: supportGrip };
  const rig = new HandsRig(), cube = new Cube(3);
  try {
    const { x, y, z } = cube.table.groups;
    rig.attachCube({ order: 3, table: { groups: { x, y, z } }, twister: cube.twister });
    rig.setEnabled(true);
    await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
    let frame!: HandDiagnosticFrame;
    rig.subscribeDiagnostics(value => { frame = value; });
    rig.setGrips(gripQuat(clockwise ? 'home' : supportGrip), gripQuat(clockwise ? supportGrip : 'home'));
    rig.tick(0);
    const prepare = () => rig.prepareTwist('z', [2], dir, 1, false, undefined, false, { contact: 'nail' });
    const fixed = clockwise ? [frame.models.R.group, ...frame.models.R.nailMeshes!.filter(nail => nail.userData.nail.finger !== 'index')] : [];
    const startingPose = fixed.map(part => part.matrixWorld.clone());
    const checkRightGrip = () => fixed.forEach((part, i) => expect(part.matrixWorld.elements).toEqual(startingPose[i].elements));
    for (let i = 0; i < 120 && prepare(); i++) {
      rig.tick(8);
      checkRightGrip();
    }
    expect(prepare()).toBe(false);

    const [{ group }] = cube.table.convert(new TwistAction(move));
    const model = frame.models[hand], skin = new FingerSurfaceSampler(model);
    const nail = model.nailMeshes!.find(mesh => mesh.userData.nail.finger === finger)!;
    const support = new FingerSurfaceSampler(frame.models[other]);
    const supportNail = frame.models[other].nailMeshes!.find(mesh => mesh.userData.nail.finger === 'thumb')!;
    const front = new THREE.Vector3(0, 0, 1);
    const supportPose = clockwise ? frame.models.L.nailMeshes!.map(mesh => mesh.matrixWorld.clone()) : [];
    group.drag();
    for (let degrees = 0; degrees <= 90; degrees++) {
      group.angle = dir * THREE.MathUtils.degToRad(Math.max(.001, degrees));
      rig.tick(8);
      checkRightGrip();
      supportPose.forEach((matrix, i) => expect(frame.models.L.nailMeshes![i].matrixWorld.elements).toEqual(matrix.elements));
      expect(frame.grips).toEqual(grips);
      expect(frame.active?.gesture).toMatchObject({ hand, finger, style: clockwise ? 'frontIndexNail' : 'frontThumbNail' });
      const pad = skin.samplePoints(finger).filter(sample => sample.pad).map(sample => sample.point);
      const gap = (vertices: THREE.Vector3[]) => Math.min(...vertices
        .map(point => point.applyAxisAngle(front, group.angle))
        .filter(point => clockwise
          ? Math.abs(point.x - 64) <= 30 && Math.abs(point.z - 64) <= 30
          : Math.abs(point.x + 64) <= 30 && Math.abs(point.y) <= 30)
        .map(point => (clockwise ? point.y : point.z) - 96));
      const nailGap = gap(nailVertices(nail));
      expect(nailGap).toBeGreaterThanOrEqual(0);
      expect(nailGap).toBeLessThanOrEqual(2.5);
      expect(nailGap).toBeLessThan(gap(pad));
      const supportThumb = support.samplePoints('thumb').map(sample => sample.point).concat(nailVertices(supportNail));
      const point = new THREE.Vector3();
      let depth = 0;
      for (const piece of readDiagnosticPieces(cube)) {
        const inverse = piece.matrix.clone().invert();
        for (const vertex of supportThumb) {
          point.copy(vertex).applyMatrix4(inverse);
          depth = Math.max(depth, beveledPieceDepth(Math.abs(point.x), Math.abs(point.y), Math.abs(point.z)));
        }
      }
      expect(depth, 'support thumb at ' + degrees).toBe(0);
    }
    group.drop();
    if (clockwise) {
      for (let i = 0; i < 35; i++) {
        rig.tick(8);
        checkRightGrip();
      }
    }
  } finally { rig.dispose(); cube.dispose(); }
});

it('isolates axial roll from swing around an oblique binding segment', () => {
  const axis = new THREE.Vector3(3, -2, 1);
  const along = axis.clone().normalize();
  const across = new THREE.Vector3().crossVectors(along, new THREE.Vector3(0, 1, 0)).normalize();
  const swing = new THREE.Quaternion().setFromAxisAngle(across, 1.9);
  const roll = new THREE.Quaternion().setFromAxisAngle(along, -.42);
  expect(segmentAxialRotation(swing.clone().multiply(roll), axis)).toBeCloseTo(-.42, 10);
  expect(segmentAxialRotation(swing, axis)).toBeCloseTo(0, 10);
  expect(segmentAxialRotation(swing.setFromAxisAngle(across, Math.PI), axis)).toBeNull();
});

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

// Signed distance to the face, edge and corner planes of the 64-unit render mesh.
function beveledPieceDepth(x: number, y: number, z: number) {
  return Math.min(32 - Math.max(x, y, z), (61 - Math.max(x + y, y + z, x + z)) / Math.SQRT2,
    (90 - x - y - z) / Math.sqrt(3));
}

function nailVertices(nail: THREE.Mesh) {
  const positions = nail.geometry.getAttribute('position');
  return Array.from({ length: positions.count }, (_, i) =>
    new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(nail.matrixWorld));
}

function nailSurface(nail: THREE.Mesh, points = nailVertices(nail)) {
  const normals = nail.geometry.getAttribute('normal');
  return points.map((point, vertex) => ({ point, vertex, pad: normals.getZ(vertex) < -.5 }));
}

function nailFacesFromPoints(nail: THREE.Mesh, points = nailVertices(nail)) {
  const index = nail.geometry.index!, faces = [];
  for (let i = 0; i < index.count; i += 3) {
    const triangle = new THREE.Triangle(points[index.getX(i)], points[index.getX(i + 1)], points[index.getX(i + 2)]);
    faces.push({ triangle, box: new THREE.Box3().setFromPoints([triangle.a, triangle.b, triangle.c]) });
  }
  return faces;
}

describe.runIf(haveBothHands)('R U anticipation with real MANO skin', () => {
  it("holds the left home grip and the right F8/B6 pinch through the seven-step ring flick", async () => {
    const cube = new Cube(3), reference = new Cube(3), rig = new HandsRig();
    try {
      const { x, y, z } = cube.table.groups;
      rig.attachCube({ order: 3, table: { groups: { x, y, z } }, twister: cube.twister });
      rig.setEnabled(true);
      await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
      let frame!: HandDiagnosticFrame;
      rig.subscribeDiagnostics(next => { frame = next; });
      rig.bindRightPinch(cube, 0);
      rig.tick(0);
      const skin = new FingerSurfaceSampler(frame.models.R);
      const support = new FingerSurfaceSampler(frame.models.L);
      const home = homeLeft(3);
      const checkGrip = () => {
        expect(frame.grips.L).toBe('home');
        expect(frame.models.L.group.position.toArray()).toEqual(home.pos.toArray());
        expect(frame.models.L.group.quaternion.toArray()).toEqual(home.quat.toArray());
        const pieces = readDiagnosticPieces(cube);
        for (const [finger, slot] of [['thumb', 'F3'], ['middle', 'B5']] as const) {
          const hits = measureIndexContact(support.samplePoints(finger), pieces).contacts;
          expect(hits.map(hit => hit.currentSlot), finger).toContain(slot);
        }
        for (const [finger, sticker] of [['thumb', 'F8'], ['middle', 'B6']] as const) {
          const hits = measureIndexContact(skin.samplePoints(finger), pieces).contacts;
          expect(hits.map(hit => hit.stickerId), finger).toContain(sticker);
        }
        return pieces;
      };
      const moves = ['R2', "U'", "S'", "U2'", 'S', "U'", 'R2'];
      for (const [step, move] of moves.entries()) {
        const action = new TwistAction(move);
        const [{ group, twist }] = cube.table.convert(action);
        const prepare = () => rig.prepareRightPinch(cube, step)
          || rig.prepareTwist(group.axis as Axis, [group.layer], twist > 0 ? 1 : -1, Math.abs(twist));
        for (let i = 0; i < 180 && prepare(); i++) { rig.tick(16); checkGrip(); }
        expect(prepare()).toBe(false);
        expect(cube.twister.twist(action, false, false, 45)).toBe(true);
        let ringDriving = false;
        for (let i = 0; cube.busy && i < 100; i++) {
          tweener.update(1);
          rig.tick(16);
          const pieces = checkGrip();
          if (step === 4 && frame.active && Math.abs(frame.active.angle) <= Math.PI / 4) {
            expect(frame.active.gesture).toMatchObject({ kind: 'flick', hand: 'R', finger: 'ring' });
            const hits = measureIndexContact(skin.samplePoints('ring'), pieces).contacts;
            expect(hits.map(hit => hit.stickerId)).toContain('U5');
            ringDriving = true;
          }
        }
        if (step === 4) expect(ringDriving).toBe(true);
        reference.twister.twist(action, true, false);
        expect(cube.serializePictureFacelets()).toEqual(reference.serializePictureFacelets());
        for (let i = 0; i < 50; i++) rig.tick(16);
        checkGrip();
      }
    } finally { rig.dispose(); cube.dispose(); reference.dispose(); }
  });

  it('restores the two physical pinch contacts when seeking on a scrambled cube', async () => {
    const rig = new HandsRig(), cube = new Cube(3);
    try {
      const { x, y, z } = cube.table.groups;
      rig.attachCube({ order: 3, table: { groups: { x, y, z } }, twister: cube.twister });
      rig.setEnabled(true);
      await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
      let frame!: HandDiagnosticFrame;
      rig.subscribeDiagnostics(next => { frame = next; });
      const moves = ['R2', "U'", "S'", "U2'", 'S', "U'", 'R2'];
      const leftHome = homeLeft(3);
      const expected = new Map<string, string>();
      for (const step of [0, 5, 2, 7, 4, 1, 6, 3]) {
        cube.twister.setup("B D' F R");
        for (const token of moves.slice(0, step)) cube.twister.twist(new TwistAction(token), true, true);
        const home = new THREE.Quaternion();
        rig.setGrips(home, home);
        rig.bindRightPinch(cube, step);
        rig.tick(0);
        expect(frame.models.L.group.position.toArray()).toEqual(leftHome.pos.toArray());
        expect(frame.models.L.group.quaternion.toArray()).toEqual(leftHome.quat.toArray());
        const skin = new FingerSurfaceSampler(frame.models.R), pieces = readDiagnosticPieces(cube);
        for (const [finger, slot] of [['thumb', 'F8'], ['middle', 'B6']] as const) {
          const { contacts } = measureIndexContact(skin.samplePoints(finger), pieces);
          if (!step) expected.set(finger, contacts.find(c => c.currentSlot === slot)!.stickerId);
          expect(contacts.map(c => c.stickerId)).toContain(expected.get(finger));
        }
      }
    } finally { rig.dispose(); cube.dispose(); }
  });

  it.each([2, 4] as const)('drives the plain thumb comparison with the opposing index pad on order %i', async order => {
    const rig = new HandsRig(), cube = new Cube(order);
    try {
      const { x, y, z } = cube.table.groups;
      rig.attachCube({ order, table: { groups: { x, y, z } }, twister: cube.twister });
      rig.setEnabled(true);
      await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
      let frame!: HandDiagnosticFrame;
      rig.subscribeDiagnostics(value => { frame = value; });
      for (const dir of [1, -1] as const) {
        const move = dir === 1 ? 'F' : "F'";
        const example = thumbComparisons[order][move]!;
        const hand = dir === 1 ? 'R' : 'L';
        rig.setGrips(gripQuat('home'), gripQuat('home'));
        rig.tick(16);
        const model = frame.models[hand];
        const skin = new FingerSurfaceSampler(model);
        const nail = model.nailMeshes!.find(mesh => mesh.userData.nail.finger === 'index')!;
        cube.updateWorldMatrix(true, false);
        const toCube = cube.matrixWorld.clone().invert();
        const measure = () => {
          const surface = skin.samplePoints('index').concat(nailVertices(nail).map((point, vertex) => ({ point, vertex, pad: false })));
          for (const sample of surface) sample.point.applyMatrix4(toCube);
          return measureIndexContact(surface, readDiagnosticPieces(cube), 32 * (1 - cube.instancedRenderer.stickerGap));
        };
        const prepare = () => rig.prepareTwist('z', [order - 1], dir, 1, false);
        for (let i = 0; i < 120 && prepare(); i++) {
          rig.tick(16);
          if (order === 4) expect(measure().penetration.depthU, 'approach ' + move + ' ' + i).toBeLessThanOrEqual(.1);
        }
        expect(prepare()).toBe(false);
        expect(cube.twister.twist(new TwistAction(example.reference), false, false, 360, 'linear')).toBe(true);
        let drivenFrames = 0;
        for (let tick = 0; cube.busy && tick <= 360; tick++) {
          tweener.update(1);
          rig.tick(16);
          if (!cube.busy) break;
          const degrees = THREE.MathUtils.radToDeg(Math.abs(z[order - 1].angle));
          expect(frame.active?.gesture).toMatchObject({ hand, finger: 'index', style: 'topPush' });
          const measurement = measure();
          if (order === 4) expect(measurement.penetration.depthU, move + ' at ' + degrees).toBeLessThanOrEqual(.1);
          if (degrees <= 60) {
            expect(measurement.contacts.map(c => c.stickerId), move + ' at ' + degrees).toContain(example.ordinary.cues[0].sticker);
            drivenFrames++;
          }
        }
        expect(cube.busy).toBe(false);
        expect(drivenFrames).toBeGreaterThan(235);
        for (let i = 0; i < 80; i++) {
          rig.tick(16);
          if (order === 4) expect(measure().penetration.depthU, 'return ' + move + ' ' + i).toBeLessThanOrEqual(.1);
        }
        cube.reset();
      }
    } finally { rig.dispose(); cube.dispose(); }
  });

  it.each([2, 4] as const)('honours the thumb mark and samples its front corner on order %i', async order => {
    const rig = new HandsRig(), cube = new Cube(order);
    try {
      const { x, y, z } = cube.table.groups;
      rig.attachCube({ order, table: { groups: { x, y, z } }, twister: cube.twister });
      rig.setEnabled(true);
      await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
      const trace = new GestureContactTrace();
      rig.subscribeDiagnostics(frame => trace.observe(frame, cube));
      for (const dir of [1, -1] as const) {
        const pose = simulateGrips([{ side: 'L', grip: 'home' }, { side: 'R', grip: 'home' }], order);
        rig.setGrips(pose.R, pose.L, pose.wristAngles);
        const prepare = () => rig.prepareTwist('z', [order - 1], dir, 1, false, undefined, false, { finger: 'thumb' });
        for (let i = 0; i < 80 && prepare(); i++) rig.tick(16);
        expect(rig.getMarkedMotionProblem()).toBeNull();
        expect(prepare()).toBe(false);
        const hand = dir === 1 ? 'L' : 'R';
        expect(rig.gripNames()[hand]).toBe('down');
        trace.clear();
        cube.twister.twist(new TwistAction(dir === 1 ? 'F' : "F'"), false, false, 90);
        for (let i = 0; cube.busy && i < 180; i++) { tweener.update(1); rig.tick(16); }
        const start = thumbComparisons[order][dir === 1 ? 'F' : "F'"]!.marked.cues[0].sticker;
        expect(trace.read().some(row => row.role === 'active' && row.hand === hand && row.finger === 'thumb'
          && Math.abs(row.angle) <= Math.PI / 8 && row.surface === 'pad' && row.geometry.contact?.sticker === start)).toBe(true);
        for (let i = 0; i < 80; i++) rig.tick(16);
        expect(rig.gripNames()).toEqual({ L: 'home', R: 'home' });
        expect(rig.prepareTwist('z', [order - 1], dir, 1, false, undefined, false,
          { finger: 'thumb', contact: 'nail' })).toBe(true);
        expect(rig.getMarkedMotionProblem()).toBe('unsupported-grip');
        cube.reset();
      }
      if (order === 4) {
        for (const layers of [[1], [2], [1, 2]]) {
          expect(rig.prepareTwist('x', layers, 1, 2, false, undefined, false, { contact: 'nail' })).toBe(true);
          expect(rig.getMarkedMotionProblem()).toBe('unsupported-grip');
        }
      }
      // Lower half turns have neither an explicit middle relay nor a nail stroke.
      for (const mark of [{ finger: 'middle' }, { contact: 'nail' }] as const) {
        expect(rig.prepareTwist('y', [0], 1, 2, false, undefined, false, mark)).toBe(true);
        expect(rig.getMarkedMotionProblem()).toBe('unsupported-grip');
      }
      for (const [layers, quarters] of [[[order - 1], 2], [[order - 2, order - 1], 1], [[order - 2], 1]] as const) {
        expect(rig.prepareTwist('z', [...layers], 1, quarters, false, undefined, false, { finger: 'thumb' })).toBe(true);
        expect(rig.getMarkedMotionProblem()).toBe('unsupported-grip');
      }
    } finally { rig.dispose(); cube.dispose(); }
  });

  it.each([2, 4] as const)('replays the order-%i atlas with physical sticker identities', async order => {
    const rig = new HandsRig(), cube = new Cube(order), reference = new Cube(order);
    const audit = process.env.SIM_ORDER_ATLAS_AUDIT;
    const catalog = atlasCatalog[order];
    const subset = process.env.SIM_ORDER_ATLAS_MOVES?.split(',');
    const cases = audit ? catalog.moves.filter(move => !subset || subset.includes(move)) : (order === 2 ? ['D2', "D2'", 'F2', 'B2', 'U2', 'z2']
      : ['D2', '2D2', 'Fw2', 'Dw2', 'Bw2', '2R2', '3Uw', 'M', 'x2']);
    const starts = audit ? gripNames : ['home'] as const;
    const report = [];
    try {
      const { x, y, z } = cube.table.groups;
      rig.attachCube({ order, table: { groups: { x, y, z } }, twister: cube.twister });
      rig.setEnabled(true);
      await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
      const trace = new GestureContactTrace();
      rig.subscribeDiagnostics(frame => { if (frame.active) trace.observe(frame, cube); });
      const expected = new Map(cases.map(move => {
        reference.reset();
        reference.twister.twist(new TwistAction(move), true, false);
        return [move, reference.serializePictureFacelets()];
      }));
      for (const L of starts) for (const R of starts) for (const move of cases) {
        cube.reset();
        const pose = simulateGrips([{ side: 'L', grip: L }, { side: 'R', grip: R }], order);
        rig.setGrips(pose.R, pose.L, pose.wristAngles);
        trace.clear();
        rig.tick(0);
        const action = new TwistAction(move), turns = cube.table.convert(action);
        const { group, twist } = turns[0], layers = turns.map(t => t.group.layer);
        const prepare = () => rig.prepareTwist(group.axis as Axis, layers, twist > 0 ? 1 : -1, Math.abs(twist));
        for (let i = 0; i < 100 && prepare(); i++) rig.tick(40);
        expect(prepare(), [order, L, R, move].join('/')).toBe(false);
        const ready = rig.gripNames();
        expect(cube.twister.twist(action, false, false, 20)).toBe(true);
        let gesture: HandGesture | null = null;
        for (let i = 0; cube.busy && i < 80; i++) {
          tweener.update(1);
          rig.tick(16);
          gesture = rig.activeGesture ?? gesture;
        }
        expect(cube.serializePictureFacelets()).toEqual(expected.get(move));
        expect(gesture).toBeTruthy();
        for (let i = 0; i < 100 && (i < 12 || rig.isRegripping || rig.isReachRetreating); i++) rig.tick(40);
        if (gesture?.kind === 'flick') expect(rig.gripNames()).toEqual({ L, R });
        const samples = trace.read().filter(s => s.geometry.contact);
        const driven = samples.filter(s => s.role === 'active');
        const contacts = [...new Set(driven.map(s => s.quarter + '/' + s.finger + '/' + s.geometry.contact!.sticker))];
        for (const s of samples) expect(Number(s.geometry.contact!.sticker.slice(1))).toBeLessThan(order * order);
        const support = [...new Set(samples.filter(s => s.role === 'support').map(s => s.geometry.contact!.sticker))];
        const observed = new Set(driven.filter(s => s.driving).map(s => s.quarter)).size;
        const handoff = gesture?.kind === 'flick' && gesture.finger2 ? [0, 1].every(quarter => driven.some(s =>
          s.quarter === quarter && Math.abs(Math.abs(s.angle) - Math.PI / 2) <= Math.PI / 12)) : null;
        const complete = gesture?.kind === 'weld' || observed === Math.abs(twist);
        report.push({ L, R, move, layers, ready, gesture, contacts, support, handoff, complete });
        if (!audit && gesture?.kind === 'flick') expect(complete, [order, move, contacts].join(' ')).toBe(true);
      }
      if (audit) writeFileSync(audit + '-' + order + '.json', JSON.stringify(report));
    } finally { rig.dispose(); cube.dispose(); reference.dispose(); }
  }, process.env.SIM_ORDER_ATLAS_AUDIT ? 3600000 : 90000);

  it('plays the grip atlas with contact in every driving quarter and restores each temporary grip', async () => {
    const rig = new HandsRig(), cube = new Cube(3), reference = new Cube(3);
    try {
      const { x, y, z } = cube.table.groups;
      rig.attachCube({ order: 3, table: { groups: { x, y, z } }, twister: cube.twister });
      rig.setEnabled(true);
      await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
      let frame!: HandDiagnosticFrame;
      const unsubscribe = rig.subscribeDiagnostics(value => { frame = value; });
      rig.tick(0);
      unsubscribe();
      const samplers = { L: new FingerSurfaceSampler(frame.models.L), R: new FingerSurfaceSampler(frame.models.R) };
      const expected = new Map(moves.map(move => {
        reference.reset();
        reference.twister.twist(new TwistAction(move), true, false);
        return [move, reference.serializePictureFacelets()];
      }));

      const report: object[] = [];
      let played = 0;
      for (const L of gripNames) for (const R of gripNames) for (const move of moves) {
        const label = [L, R, move].join(' / ');
        cube.reset();
        const pose = simulateGrips([{ side: 'L', grip: L }, { side: 'R', grip: R }], 3);
        rig.setGrips(pose.R, pose.L, pose.wristAngles);
        rig.tick(0);
        const entry = process.env.SIM_STROKE_AUDIT ? rig.readHandGeometry() : undefined;
        const action = new TwistAction(move), turns = cube.table.convert(action);
        const { group, twist } = turns[0], layers = turns.map(t => t.group.layer);
        const moving = new Set(turns.flatMap(turn => turn.group.indices));
        const prepare = () => rig.prepareTwist(group.axis as Axis, layers, twist > 0 ? 1 : -1, Math.abs(twist));
        for (let i = 0; i < 100 && prepare(); i++) rig.tick(40);
        expect(rig.getMarkedMotionProblem(), label).toBeNull();
        expect(prepare(), label).toBe(false);
        const ready = rig.gripNames();
        expect(cube.twister.twist(action, false, false, 30), label).toBe(true);
        let gesture: HandGesture | null = null;
        const gaps: number[] = [];
        const samplesPerQuarter: number[] = [];
        const strokes: { degrees: number; gap: number; sticker: string; point: number[]; tangent: number[];
          finger: string; pad: number[]; distal: number[]; uv: number[]; surface: string }[] = [];
        const targetGaps: number[] = [];
        let ranked: typeof rig.strokeCandidates;
        let target: typeof rig.activeBearing;
        for (let i = 0; cube.busy && i < 100; i++) {
          tweener.update(1);
          rig.tick(16);
          gesture = rig.activeGesture ?? gesture;
          if (gesture?.kind !== 'flick') continue;
          // Sample inside each driving window. The thumb lift releases after 25 degrees.
          target = rig.activeBearing ?? target;
          ranked = rig.strokeCandidates ?? ranked;
          const degrees = THREE.MathUtils.radToDeg(Math.abs(group.angle));
          const quarter = Math.floor(degrees / 90);
          const phase = degrees - 90 * quarter;
          const earlyDrive = phase >= 8 && phase <= 44;
          // A pad can roll onto the finite sticker after crossing its border.
          // Record this separately from the original early-window proximity check.
          const lateWitness = phase > 44 && phase < 85 && !strokes[quarter];
          if (quarter >= Math.abs(twist) || (!earlyDrive && !lateWitness)) continue;
          const digit = quarter === 1 && gesture.finger2 ? gesture.finger2 : gesture.finger;
          const samples = samplers[gesture.hand].samplePoints(digit);
          const nail = frame.models[gesture.hand].nailMeshes!.find(mesh => mesh.userData.nail.finger === digit)!;
          samples.push(...nailVertices(nail).map((point, vertex) => ({ point, vertex: -1 - vertex, pad: true })));
          const pieces = readDiagnosticPieces(cube).filter(piece => moving.has(piece.initial));
          const contact = measureIndexContact(samples, pieces, 32 * (1 - cube.instancedRenderer.stickerGap));
          if (earlyDrive) {
            gaps[quarter] = Math.min(gaps[quarter] ?? Infinity, contact.nearest!.distanceToRectangleU);
            samplesPerQuarter[quarter] = (samplesPerQuarter[quarter] ?? 0) + 1;
          }
          let witness = contact.contacts.toSorted((a, b) => a.gapU - b.gapU).at(0);
          if (target) {
            // Follow the same physical face from the start of THIS quarter.
            const angle = (twist > 0 ? -1 : 1) * THREE.MathUtils.degToRad(phase);
            const axisVector = new THREE.Vector3();
            axisVector[group.axis as Axis] = 1;
            const center = target.center.clone().applyAxisAngle(axisVector, angle);
            const normal = target.normal.clone().applyAxisAngle(axisVector, angle);
            const piece = pieces.find(candidate => {
              const offset = new THREE.Vector3().setFromMatrixPosition(candidate.matrix).sub(center)
                .addScaledVector(normal, 32).applyAxisAngle(axisVector, -angle);
              return Math.max(Math.abs(offset.x), Math.abs(offset.y), Math.abs(offset.z)) < 32;
            });
            expect(piece, label + ' bearing belongs to the moving slab').toBeDefined();
            const targetContact = measureIndexContact(samples, [piece!], 32 * (1 - cube.instancedRenderer.stickerGap));
            const matching = targetContact.contacts.find(c => new THREE.Vector3(...c.normalCube).dot(normal) > .99);
            witness = matching;
            if (earlyDrive) targetGaps[quarter] = Math.min(targetGaps[quarter] ?? Infinity, matching?.distanceToRectangleU ?? Infinity);
          }
          if (witness && witness.distanceToRectangleU < (strokes[quarter]?.gap ?? Infinity)) {
            const nearest = witness;
            const b = fingerBearing(frame.models[gesture.hand], digit, cube.matrixWorld.clone().invert());
            strokes[quarter] = { degrees, gap: nearest.distanceToRectangleU, sticker: nearest.stickerId, point: nearest.pointCube,
              uv: nearest.uvU, surface: nearest.witnessVertex < 0 ? 'nail' : 'pad', distal: b.distal.toArray(), pad: b.pad.toArray(),
              finger: digit, tangent: strokeTangent(group.axis as Axis, twist, new THREE.Vector3(...nearest.pointCube)).toArray() };
          }
        }
        expect(cube.busy, label).toBe(false);
        expect(gesture, label).toBeTruthy();
        expect(cube.serializePictureFacelets(), label).toEqual(expected.get(move));
        rig.tick(40);
        for (let i = 0; i < 100 && (i < 12 || rig.isRegripping || rig.isReachRetreating); i++) rig.tick(40);
        expect(rig.isRegripping || rig.isReachRetreating, label).toBe(false);
        if (gesture?.kind === 'flick') {
          expect(gaps, label).toHaveLength(Math.abs(twist));
          if (Math.abs(twist) === 2) {
            if (/^[ES]/.test(move)) {
              expect(gesture, label).toMatchObject({ finger: 'index', style: 'sliceNailDouble' });
            } else {
              const pair = /^[BD]/.test(move) ? ['pinky', 'ring'] : move.startsWith('M')
                ? ['ring', 'pinky'] : ['index', 'middle'];
              expect([gesture.finger, gesture.finger2], label).toEqual(pair);
            }
          }
          for (let quarter = 0; quarter < Math.abs(twist); quarter++) {
            expect(strokes[quarter], label + ' contact on a moving sticker in quarter ' + (quarter + 1)).toBeDefined();
            expect(samplesPerQuarter[quarter], label).toBeGreaterThan(1);
            expect(gaps[quarter], label + ' quarter ' + (quarter + 1)).toBeLessThan(2.5);
          }
          if (target) for (let quarter = 0; quarter < Math.abs(twist); quarter++) {
            expect(targetGaps[quarter], label + ' calibrated sticker quarter ' + (quarter + 1)).toBeLessThan(2.5);
          }
          expect(rig.gripNames(), label).toEqual({ L, R });
          if (/^Fw?2'?$/.test(move)) {
            const side = move.endsWith("'") ? 'L' : 'R';
            expect(gesture, label).toMatchObject({ hand: side, finger: 'index', finger2: 'middle', style: 'downPush' });
            expect(ready, label).toEqual({ L, R, [side]: 'down' });
          }
        }
        if (process.env.SIM_STROKE_AUDIT) report.push({ L, R, move, entry, ready, gesture, ranked,
          target, targetGaps, strokes, end: rig.gripNames() });
        played++;
      }
      expect(played).toBe(1800);
      if (process.env.SIM_STROKE_AUDIT) writeFileSync(process.env.SIM_STROKE_AUDIT, JSON.stringify(report));
    } finally { rig.dispose(); cube.dispose(); reference.dispose(); }
  }, 240000);

  it.each([['down', 'up', 'Fw'], ['up', 'down', 'Bw']] as const)(
    'checks the bearing and stationary support of the competing wide strokes from %s / %s for %s',
    async (L, R, move) => {
      const rig = new HandsRig(), cube = new Cube(3);
      try {
        const { x, y, z } = cube.table.groups;
        rig.attachCube({ order: 3, table: { groups: { x, y, z } }, twister: cube.twister });
        rig.setEnabled(true);
        await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
        const pose = simulateGrips([{ side: 'L', grip: L }, { side: 'R', grip: R }], 3);
        rig.setGrips(pose.R, pose.L, pose.wristAngles);
        let frame!: HandDiagnosticFrame;
        rig.subscribeDiagnostics(value => { frame = value; });
        rig.tick(0);
        const turns = cube.table.convert(new TwistAction(move));
        const { twist } = turns[0], dir = twist > 0 ? 1 : -1;
        const prepare = () => rig.prepareTwist('z', turns.map(t => t.group.layer), dir);
        for (let i = 0; i < 160 && prepare(); i++) rig.tick(16);
        expect(prepare()).toBe(false);
        const samplers = { R: new FingerSurfaceSampler(frame.models.R), L: new FingerSurfaceSampler(frame.models.L) };
        const moving = new Set(turns.flatMap(t => t.group.indices));
        const nail = frame.models.R.nailMeshes!.find(m => m.userData.nail.finger === 'thumb')!;
        for (const t of turns) t.group.drag();
        const loadedSticker = move === 'Fw' ? 'U5' : 'D5';
        for (let degree = 0; degree <= 90; degree += degree >= 13 && degree < 18 ? .25 : 1) {
          for (const t of turns) t.group.angle = dir * THREE.MathUtils.degToRad(Math.max(.001, degree));
          rig.tick(8);
          expect(rig.activeGesture).toMatchObject({ kind: 'flick', hand: 'R', finger: 'thumb' });
          expect(rig.strokeCandidates).toHaveLength(2);
          const pieces = readDiagnosticPieces(cube);
          const skin = samplers.R.samplePoints('thumb');
          expect(measureIndexContact(skin.concat(nailSurface(nail)), pieces).penetration.depthU,
            move + ' thumb at ' + degree).toBeLessThanOrEqual(.1);
          const contact = measureIndexContact(skin, pieces.filter(p => moving.has(p.initial)),
            32 * (1 - cube.instancedRenderer.stickerGap));
          expect(contact.contacts.some(c => c.stickerId === loadedSticker),
            move + ' ' + loadedSticker + ' at ' + degree).toBe(true);
          if (degree % 5 === 0) {
            const stationary = pieces.filter(p => !moving.has(p.initial));
            const support = frame.wideSupport!;
            expect(support.hand).toBe('L');
            for (const digit of support.fingers) {
              const contact = measureIndexContact(samplers.L.samplePoints(digit), stationary);
              expect(contact.contacts.length, move + ' fixed ' + digit + ' at ' + degree).toBeGreaterThan(0);
            }
            const obstacle = new FingerObstacle(samplers.R.sample('thumb').concat(nailFacesFromPoints(nail)));
            for (const side of ['L', 'R'] as const) for (const digit of FINGER_NAMES) {
              if (side === 'R' && digit === 'thumb') continue;
              const plate = frame.models[side].nailMeshes!.find(m => m.userData.nail.finger === digit)!;
              expect(obstacle.intersections(samplers[side].sample(digit).concat(nailFacesFromPoints(plate))),
                move + ' ' + side + digit + ' at ' + degree).toBe(0);
            }
          }
        }
        for (const t of turns) t.group.drop();
        for (let i = 0; i < 120; i++) rig.tick(8);
        expect(rig.gripNames()).toEqual({ L, R });
      } finally { rig.dispose(); cube.dispose(); }
    });

  it.each(['E', "E'", 'E2', "E2'"])('moves the index nail with each loaded quarter of %s', async move => {
    const rig = new HandsRig(), cube = new Cube(3);
    try {
      const { x, y, z } = cube.table.groups;
      rig.attachCube({ order: 3, table: { groups: { x, y, z } }, twister: cube.twister });
      rig.setEnabled(true);
      await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
      let frame!: HandDiagnosticFrame;
      rig.subscribeDiagnostics(value => { frame = value; });
      const [{ group, twist }] = cube.table.convert(new TwistAction(move));
      const dir = twist > 0 ? 1 : -1, side = dir > 0 ? 'R' : 'L';
      const prepare = () => rig.prepareTwist('y', [group.layer], dir, Math.abs(twist));
      for (let i = 0; i < 100 && prepare(); i++) rig.tick(25);
      expect(prepare()).toBe(false);
      expect(frame.grips[side]).toBe('down');
      const nail = frame.models[side].nailMeshes!.find(mesh => mesh.userData.nail.finger === 'index')!;
      const { nailPlateVertexCount, freeEdgeVertexStart } = nail.geometry.userData;
      const columns = (2 * nailPlateVertexCount - freeEdgeVertexStart) / 2;
      const tip = nailPlateVertexCount - Math.ceil(columns / 2) + (side === 'R' ? 4 : -4);
      const axis = new THREE.Vector3(0, -1, 0);
      let bearing = new THREE.Vector3();
      group.drag();
      for (let deg = 0; deg <= 90 * Math.abs(twist); deg++) {
        group.angle = dir * THREE.MathUtils.degToRad(Math.max(.001, deg));
        rig.tick(8);
        const phase = deg % 90;
        if (phase > 54 || deg === 90 * Math.abs(twist)) continue;
        const point = new THREE.Vector3().fromBufferAttribute(nail.geometry.getAttribute('position'), tip)
          .applyMatrix4(nail.matrixWorld);
        if (phase === 0) bearing = point.clone();
        const target = bearing.clone().applyAxisAngle(axis, dir * THREE.MathUtils.degToRad(phase));
        expect(point.distanceTo(target), move + ' at ' + deg).toBeLessThan(2);
      }
      group.drop();
    } finally { rig.dispose(); cube.dispose(); }
  });

  it.each([
    ['F2', 'R', 'index', 'middle'], ["F2'", 'L', 'index', 'middle'],
    ['Fw2', 'R', 'index', 'middle'], ["Fw2'", 'L', 'index', 'middle'],
    ['D2', 'L', 'pinky', 'ring'], ["D2'", 'R', 'pinky', 'ring'],
    ['B', 'L', 'ring', undefined], ["B'", 'R', 'ring', undefined],
    ['B2', 'L', 'pinky', 'ring'], ["B2'", 'R', 'pinky', 'ring'],
    ['Uw', 'R', 'index', undefined], ["Uw'", 'L', 'index', undefined],
  ] as const)('seats, drives and restores the two home wrists for %s', async (move, side, first, second) => {
    const rig = new HandsRig(), cube = new Cube(3);
    try {
      const { x, y, z } = cube.table.groups;
      rig.attachCube({ order: cube.order, table: { groups: { x, y, z } }, twister: cube.twister });
      rig.setEnabled(true);
      await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
      let frame!: HandDiagnosticFrame;
      rig.subscribeDiagnostics(value => { frame = value; });
      rig.tick(0);
      const turns = cube.table.convert(new TwistAction(move));
      const [{ group, twist }] = turns, layers = turns.map(t => t.group.layer);
      const axis = group.axis as 'y' | 'z', dir = twist > 0 ? 1 : -1;
      const back = move.startsWith('B'), front = move.startsWith('F'), wide = axis === 'y' && layers.length === 2;
      const other = side === 'R' ? 'L' : 'R', model = frame.models[side], skin = new FingerSurfaceSampler(model);
      const prepare = () => rig.prepareTwist(axis, layers, dir, Math.abs(twist));
      const y0 = { L: frame.models.L.group.position.y, R: frame.models.R.group.position.y };
      const lowerFingersClear = () => {
        if (wide || front) return;
        const shape = (finger: 'pinky' | 'ring') => skin.sample(finger).concat(
          nailFacesFromPoints(model.nailMeshes!.find(mesh => mesh.userData.nail.finger === finger)!));
        expect(new FingerObstacle(shape('ring')).intersections(shape('pinky')), move + ' at ' + frame.active?.angle).toBe(0);
      };
      for (let i = 0; i < 200 && prepare(); i++) {
        rig.tick(8);
        lowerFingersClear();
      }
      expect(prepare()).toBe(false);
      expect(frame.grips).toMatchObject({ [side]: axis === 'z' ? 'down' : 'home', [other]: 'home' });
      if (wide) for (const hand of ['L', 'R'] as const)
        expect(frame.models[hand].group.position.y - y0[hand]).toBeCloseTo(-35.6, 0);

      const axisVector = new THREE.Vector3(0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);
      const fromDown = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
      const half = 32 * (1 - cube.instancedRenderer.stickerGap);
      const outside = (x: number) => Math.max(0, Math.abs(x) - half);
      const gap = (finger: typeof first | NonNullable<typeof second>, angle: number) => {
        const points = skin.samplePoints(finger).filter(v => v.pad).map(v => v.point);
        const nail = model.nailMeshes!.find(mesh => mesh.userData.nail.finger === finger)!;
        return Math.min(...points.concat(nailVertices(nail)).map(p => {
          p.applyAxisAngle(axisVector, dir * THREE.MathUtils.degToRad(angle));
          if (back) p.applyQuaternion(fromDown);
          const dx = outside(p.x - dir * 64);
          if (wide) return Math.hypot(dx, outside(p.y), p.z + 96);
          if (front) return Math.hypot(dx, p.y - 96, outside(p.z - 64));
          return Math.hypot(dx, p.y + 96, outside(p.z + 64));
        }));
      };
      const tip = model.fingers.pinky.tip;
      const start = tip.getWorldPosition(new THREE.Vector3());
      let firstTravel = 0;
      for (const t of turns) t.group.drag();
      for (let deg = 0; deg <= Math.abs(twist) * 90; deg++) {
        for (const t of turns) t.group.angle = dir * THREE.MathUtils.degToRad(Math.max(.001, deg));
        rig.tick(8);
        expect(frame.active?.gesture).toMatchObject({ kind: 'flick', hand: side, finger: first, ...(second && { finger2: second }) });
        if (deg <= 90) {
          expect(gap(first, deg), move + ' first finger at ' + deg).toBeLessThan(2.5);
          firstTravel = Math.max(firstTravel, tip.getWorldPosition(new THREE.Vector3()).distanceTo(start));
        }
        if (second && deg >= 90) expect(gap(second, deg - 90), move + ' relay at ' + deg).toBeLessThan(2.5);
        if (front && layers.length === 2) {
          const pieces = readDiagnosticPieces(cube);
          for (const digit of FINGER_NAMES) {
            const nail = model.nailMeshes!.find(mesh => mesh.userData.nail.finger === digit)!;
            const surface = skin.samplePoints(digit).concat(nailSurface(nail));
            expect(measureIndexContact(surface, pieces).penetration.depthU, move + ' ' + digit + ' at ' + deg)
              .toBeLessThan(.1);
          }
        }
        if (first === 'pinky' && deg >= 72 && deg <= 102) {
          const inverse = readDiagnosticPieces(cube).map(piece => piece.matrix.clone().invert());
          for (const digit of ['ring', 'pinky'] as const) {
            const nail = model.nailMeshes!.find(mesh => mesh.userData.nail.finger === digit)!;
            const surface = skin.samplePoints(digit).map(p => p.point).concat(nailVertices(nail));
            let depth = 0;
            for (const matrix of inverse) for (const point of surface) {
              const local = point.clone().applyMatrix4(matrix);
              depth = Math.max(depth, beveledPieceDepth(Math.abs(local.x), Math.abs(local.y), Math.abs(local.z)));
            }
            expect(depth, move + ' ' + digit + ' at ' + deg).toBeLessThan(.1);
          }
        }
        lowerFingersClear();
      }
      if (first === 'pinky') expect(firstTravel).toBeGreaterThan(64); // more than one cubie width
      for (const t of turns) t.group.drop();
      for (let i = 0; i < 120; i++) {
        rig.tick(8);
        lowerFingersClear();
      }
      expect(frame.grips).toEqual({ L: 'home', R: 'home' });
      expect(rig.isRegripping || rig.isReachRetreating).toBe(false);
    } finally { rig.dispose(); cube.dispose(); }
  });

  const sidePushCases = [2, 3, 4].flatMap(order =>
    ([["D'", 'L'], ['D', 'R'], ["U'", 'R'], ['U', 'L']] as const).map(([move, side]) =>
      ({ order, move, side, marked: false, supportGrip: 'home' as 'home' | 'up' | 'down', label: `pushes ${move}p from the outer side sticker through a quarter turn on ${order}×${order}` })));
  for (const [move, side] of [['U', 'L'], ["U'", 'R']] as const) {
    for (const supportGrip of ['home', 'up', 'down'] as const) {
      sidePushCases.push({ order: 3, move, side, marked: true, supportGrip, label: `underlined ${move} with ${supportGrip} support` });
    }
  }
  it.each(sidePushCases)('$label', async ({ order, move, side, marked, supportGrip }) => {
    const rig = new HandsRig(), cube = new Cube(order);
    try {
      const { x, y, z } = cube.table.groups;
      rig.attachCube({ order, table: { groups: { x, y, z } }, twister: cube.twister });
      rig.setEnabled(true);
      await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
      let frame!: HandDiagnosticFrame;
      rig.subscribeDiagnostics(value => { frame = value; });
      const [{ group, twist }] = cube.table.convert(new TwistAction(move));
      const dir = twist > 0 ? 1 : -1;
      const upper = move.startsWith('U');
      const finger = upper ? 'index' : 'ring';
      const prepare = () => rig.prepareTwist('y', [upper ? order - 1 : 0], dir, 1, !marked, undefined, false, marked ? { contact: 'nail' } : undefined);
      const rightGrip = side === 'L' ? supportGrip : 'home';
      const leftGrip = side === 'R' ? supportGrip : 'home';
      rig.setGrips(gripQuat(rightGrip), gripQuat(leftGrip), undefined, !marked);
      rig.tick(0);
      const model = frame.models[side], skin = new FingerSurfaceSampler(model);
      const nail = model.nailMeshes!.find(m => m.userData.nail.finger === finger)!;
      const yAxis = new THREE.Vector3(0, 1, 0);
      const cubieHalf = 32 * cube.scale.x;
      const half = cubieHalf * (1 - cube.instancedRenderer.stickerGap);
      const row = (upper ? 1 : -1) * (96 - cubieHalf);
      const column = order === 3 ? 0 : cubieHalf;
      const toCube = cube.matrix.clone().invert();
      const point = new THREE.Vector3();
      const wrists = [frame.models.L.group, frame.models.R.group];
      const wristStarts = wrists.map(wrist => wrist.matrixWorld.clone());
      const stationaryMiddleJoints = [frame.models.L, frame.models.R].flatMap(hand => {
        const { meta, root, mid, tip } = hand.fingers.middle;
        return (meta ? [meta, root, mid, tip] : [root, mid, tip]).map(joint => [joint, joint.quaternion.clone()] as const);
      });
      const checkSupportPose = () => {
        for (const [joint, start] of stationaryMiddleJoints) expect(joint.quaternion.equals(start)).toBe(true);
        wrists.forEach((wrist, i) => {
          wrist.updateWorldMatrix(true, false);
          // The complete transform fixes both the position and the orientation.
          wrist.matrixWorld.elements.forEach((value, j) =>
            expect(value).toBeCloseTo(wristStarts[i].elements[j], 6));
        });
      };
      let sharedContact = false;
      const checkSideContact = (angle: number) => {
        const degrees = THREE.MathUtils.radToDeg(Math.abs(angle));
        const gap = (vertices: THREE.Vector3[]) => Math.min(...vertices
          .map(p => p.applyAxisAngle(yAxis, angle))
          .filter(p => Math.abs(p.y - row) <= half && Math.abs(p.z - column) <= half)
          .map(p => -dir * p.x - 96));
        const pad = gap(skin.samplePoints(finger).filter(v => v.pad).map(v => v.point));
        const plate = gap(nailVertices(nail));
        const seated = (distance: number) => distance >= .4 && distance < 2.5;
        const label = move + ' contact at ' + degrees + '° (nail ' + plate + ', pad ' + pad + ')';
        expect(seated(plate) || seated(pad), label).toBe(true);
        if (degrees <= 45) {
          expect(seated(plate), label).toBe(true);
          expect(plate, label).toBeLessThan(pad);
        } else if (degrees >= 60) {
          expect(seated(pad), label).toBe(true);
          expect(pad, label).toBeLessThan(plate);
        } else if (seated(plate) && seated(pad)) {
          sharedContact = true;
        }
        if (degrees < 1) expect(pad).toBeGreaterThan(2.5);
        if (degrees > 89) expect(plate).toBeGreaterThan(2.5);
      };
      const support = frame.models[side === 'L' ? 'R' : 'L'];
      const supportSkin = new FingerSurfaceSampler(support);
      const checkClearance = (phase: string, sampleOthers: boolean) => {
        const inverses = readDiagnosticPieces(cube).map(piece => piece.matrix.clone().invert().multiply(toCube));
        const points = skin.samplePoints(finger).map(v => v.point).concat(nailVertices(nail));
        let depth = 0;
        for (const matrix of inverses) for (const vertex of points) {
          point.copy(vertex).applyMatrix4(matrix);
          depth = Math.max(depth, cube.scale.x * beveledPieceDepth(Math.abs(point.x), Math.abs(point.y), Math.abs(point.z)));
        }
        expect(depth, move + ' ' + phase).toBeLessThanOrEqual(.5);
        const shape = (name: 'index' | 'middle' | 'pinky' | 'ring') => skin.sample(name).concat(nailFacesFromPoints(
          model.nailMeshes!.find(mesh => mesh.userData.nail.finger === name)!));
        const activeFinger = new FingerObstacle(shape(finger));
        expect(activeFinger.intersections(shape('middle')), phase).toBe(0);
        if (!upper) expect(activeFinger.intersections(shape('pinky')), phase).toBe(0);
        if (sampleOthers) {
          expect(new FingerObstacle(shape('middle')).intersections(shape(upper ? 'ring' : 'index')), phase).toBe(0);
          for (const [hand, surface] of [[model, skin], [support, supportSkin]] as const) {
            for (const digit of FINGER_NAMES) {
              if (hand === model && digit === finger) continue;
              const otherNail = hand.nailMeshes!.find(mesh => mesh.userData.nail.finger === digit)!;
              const vertices = surface.samplePoints(digit).map(v => v.point).concat(nailVertices(otherNail));
              let inside = 0;
              for (const mat of inverses) for (const vertex of vertices) {
                point.copy(vertex).applyMatrix4(mat);
                inside = Math.max(inside, cube.scale.x * beveledPieceDepth(Math.abs(point.x), Math.abs(point.y), Math.abs(point.z)));
              }
              const label = move + ' ' + phase + ' ' + (hand === model ? 'active ' : 'support ') + digit;
              expect(inside, label).toBeLessThanOrEqual(.5);
              expect(activeFinger.intersections(surface.sample(digit).concat(nailFacesFromPoints(otherNail))), label).toBe(0);
            }
          }
        }
      };
      for (let i = 0; i < 200 && prepare(); i++) {
        rig.tick(8);
        checkSupportPose();
        checkClearance('prepare ' + i, i % 5 === 0);
      }
      expect(prepare()).toBe(false);
      checkSideContact(0);
      const supportStart = support.fingers.thumb.tip.getWorldPosition(new THREE.Vector3());
      group.drag();
      for (let degree = 0; degree <= 90; degree += .5) {
        group.angle = dir * THREE.MathUtils.degToRad(Math.max(.001, degree));
        rig.tick(8);
        expect(frame.active?.gesture).toMatchObject({ hand: side, finger, style: upper ? 'upPush' : 'lowerPush' });
        if (order !== 2 || upper) expect(support.fingers.thumb.tip.getWorldPosition(point).distanceTo(supportStart)).toBeLessThan(.5);
        checkSupportPose();
        checkClearance('turn ' + degree, degree % 5 === 0);
        checkSideContact(group.angle);
      }
      expect(sharedContact).toBe(true);
      group.drop();
      for (let i = 0; i < 120; i++) {
        rig.tick(8);
        if (rig.isReachRetreating) checkSupportPose();
        checkClearance('release ' + i, i % 5 === 0 && i <= 45);
      }
      expect(frame.grips).toEqual({ L: leftGrip, R: rightGrip });
      expect(rig.isReachRetreating).toBe(false);
    } finally { rig.dispose(); cube.dispose(); }
  });

  it('keeps explicit push, FTN and finger constraints ahead of the ordinary home rule', async () => {
    const rig = new HandsRig(), cube = new Cube(3);
    try {
      const { x, y, z } = cube.table.groups;
      rig.attachCube({ order: cube.order, table: { groups: { x, y, z } }, twister: cube.twister });
      rig.setEnabled(true);
      await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
      expect(rig.prepareTwist('z', [0], -1, 2, true)).toBe(true);
      expect(rig.getMarkedMotionProblem()).toBe('unsupported-grip');
      expect(rig.prepareTwist('z', [0], -1, 2, false, undefined, false, undefined, undefined, true)).toBe(true);
      expect(rig.getMarkedMotionProblem()).toBe('unsupported-grip');
      expect(rig.prepareTwist('z', [0], -1, 2, false, undefined, false, { finger: 'thumb' })).toBe(true);
      expect(rig.getMarkedMotionProblem()).toBe('unsupported-grip');
      for (const extra of [{ finger: 'middle' }, { contact: 'nail' }] as const) {
        expect(rig.prepareTwist('y', [0], 1, 1, true, undefined, false, extra)).toBe(true);
        expect(rig.getMarkedMotionProblem()).toBe('unsupported-grip');
      }
      expect(rig.prepareTwist('y', [0], 1, 1, true, undefined, false, undefined, undefined, true)).toBe(true);
      expect(rig.getMarkedMotionProblem()).toBe('unsupported-grip');
      rig.setGrips(gripQuat('up'), gripQuat('home'));
      expect(rig.prepareTwist('y', [0], 1, 1, true)).toBe(true);
      expect(rig.getMarkedMotionProblem()).toBe('unsupported-grip');
      expect(rig.isRegripping).toBe(false);
      expect(rig.activeGesture).toBeNull();
    } finally { rig.dispose(); cube.dispose(); }
  });

  it.each([['L', -1, 58, 360], ['R', 1, 61, 362]] as const)(
    'keeps the %s index PIP open and both fingers clear through the U relay and withdrawal',
    async (side, direction, c, d) => {
      const rig = new HandsRig(), cube = new Cube(3);
      try {
        const { x, y, z } = cube.table.groups;
        rig.attachCube({ order: 3, table: { groups: { x, y, z } } });
        rig.setEnabled(true);
        await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
        let frame!: HandDiagnosticFrame;
        rig.subscribeDiagnostics(value => { frame = value; });
        rig.tick(0);
        // These are the welded MANO triangles that pinched as the lead
        // finger withdrew. The UV copies differ on the mirrored hand.
        const mesh = frame.models[side].meshes[0] as THREE.SkinnedMesh;
        const position = mesh.geometry.getAttribute('position');
        const vertices = [60, 64, c, d];
        const points = vertices.map(() => new THREE.Vector3());
        const edge = new THREE.Vector3(), first = new THREE.Vector3(), second = new THREE.Vector3();
        const angle = () => {
          vertices.forEach((vertex, i) => mesh.applyBoneTransform(vertex, points[i].fromBufferAttribute(position, vertex)));
          edge.subVectors(points[1], points[0]);
          first.crossVectors(edge, points[2].sub(points[0]));
          second.crossVectors(points[3].sub(points[0]), edge);
          return THREE.MathUtils.radToDeg(first.angleTo(second));
        };
        const surface = new FingerSurfaceSampler(frame.models[side]);
        const nailMesh = (name: typeof FINGER_NAMES[number]) =>
          frame.models[side].nailMeshes!.find(mesh => mesh.userData.nail.finger === name)!;
        const driving = ['index', 'middle'] as const;
        const nailInHand = (name: typeof driving[number]) => frame.models[side].group.matrixWorld.clone().invert().multiply(nailMesh(name).matrixWorld);
        const restingNails = driving.map(nailInHand);
        const checkSeparation = (phase: string, returning = false) => {
          const digits = FINGER_NAMES.map(name => {
            const faces = surface.sample(name).concat(nailFacesFromPoints(nailMesh(name)));
            const bounds = new THREE.Box3();
            for (const face of faces) bounds.union(face.box);
            return { name, faces, bounds };
          });
          for (const name of driving) {
            const finger = digits.find(digit => digit.name === name)!;
            if (returning) {
              // The cube is aligned again after the half turn. Check the full skin and nail shell.
              let depth = 0;
              for (const { triangle } of finger.faces) {
                for (const p of [triangle.a, triangle.b, triangle.c]) {
                  depth = Math.max(depth, 96 - Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)));
                }
              }
              expect(depth, phase + ' ' + name + ' / cube').toBeLessThanOrEqual(.5);
            }
            for (const other of digits) {
              if (other.name === name || (name === 'middle' && other.name === 'index')) continue;
              if (!finger.bounds.intersectsBox(other.bounds)) continue;
              expect(new FingerObstacle(other.faces).intersections(finger.faces),
                phase + ' ' + name + ' / ' + other.name).toBe(0);
            }
          }
        };
        const index = frame.models[side].fingers.index;
        const mcp = new THREE.Vector3(), pip = new THREE.Vector3();
        const elevation = () => {
          index.root.getWorldPosition(mcp);
          index.mid.getWorldPosition(pip);
          return THREE.MathUtils.radToDeg(Math.asin(pip.sub(mcp).normalize().y));
        };
        const resting = angle(), upper = cube.table.groups.y[2];
        rig.prepareTwist('y', [2], direction, 2);
        upper.drag();
        for (let degrees = 1; degrees <= 180; degrees++) {
          upper.angle = direction * THREE.MathUtils.degToRad(degrees);
          rig.tick(0);
          checkSeparation('turn at ' + degrees);
          if (degrees >= 90) expect(elevation(), 'lead clearance at ' + degrees).toBeLessThan(27);
          expect(angle() - resting, 'turn at ' + degrees).toBeLessThan(40);
        }
        expect(frame.active?.gesture).toMatchObject({ style: 'hook', finger: 'index', finger2: 'middle' });
        upper.drop();
        let returning = 0;
        for (let ms = 0; ms < 400; ms++) {
          rig.tick(1);
          if (frame.hands[side].phase === 'returning') {
            returning++;
            checkSeparation('return at ' + ms, true);
            expect(elevation(), 'lead return at ' + ms).toBeLessThan(50);
          }
          expect(angle() - resting, 'return at ' + ms).toBeLessThan(40);
        }
        expect(returning).toBeGreaterThan(0);
        expect(frame.hands[side].phase).toBe('stable');
        driving.forEach((name, i) => nailInHand(name).elements.forEach((v, j) =>
          expect(v).toBeCloseTo(restingNails[i].elements[j], 5)));
      } finally { rig.dispose(); cube.dispose(); }
    },
  );

  it.each([['R', 1, 'B0'], ['L', -1, 'B2']] as const)('home %s index rolls to the nail on the same sticker', async (side, direction, sticker) => {
    const rig = new HandsRig(), cube = new Cube(3);
    try {
      const { x, y, z } = cube.table.groups;
      rig.attachCube({ order: 3, table: { groups: { x, y, z } } });
      rig.setEnabled(true);
      await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
      let frame!: HandDiagnosticFrame;
      rig.subscribeDiagnostics(f => { frame = f; }); rig.tick(0);
      rig.prepareTwist('y', [2], direction);
      const u = cube.table.groups.y[2], model = frame.models[side];
      const surface = new FingerSurfaceSampler(model);
      const nail = model.nailMeshes!.find(n => n.userData.nail.finger === 'index')!;
      const half = 32 * (1 - cube.instancedRenderer.stickerGap);
      u.drag();
      for (let degrees = .25; degrees <= 90; degrees += .25) {
        u.angle = direction * THREE.MathUtils.degToRad(degrees); rig.tick(0);
        const pieces = readDiagnosticPieces(cube);
        const pad = measureIndexContact(surface.samplePoints('index'), pieces, half);
        const shell = measureIndexContact(nailSurface(nail), pieces, half);
        expect(Math.max(pad.penetration.depthU, shell.penetration.depthU), String(degrees)).toBeLessThanOrEqual(.1);
        if (degrees <= 65) expect(pad.contacts.some(c => c.stickerId === sticker), 'pad at ' + degrees).toBe(true);
        if (degrees >= 65) expect(shell.contacts.some(c => c.stickerId === sticker), 'nail at ' + degrees).toBe(true);
      }
      u.drop(); rig.tick(0);
      const pieces = readDiagnosticPieces(cube);
      for (let i = 0; i < 100; i++) {
        rig.tick(4);
        const points = [...surface.samplePoints('index'), ...nailSurface(nail)];
        expect(measureIndexContact(points, pieces, half).penetration.depthU, 'return at ' + i).toBeLessThanOrEqual(.1);
      }
    } finally { rig.dispose(); cube.dispose(); }
  });

  it.each([1, -1] as const)('stages the pocket relay continuously during an unhinted drag in direction %i', async direction => {
    const rig = new HandsRig(), cube = new Cube(2);
    try {
      const { x, y, z } = cube.table.groups;
      rig.attachCube({ order: cube.order, table: { groups: { x, y, z } } });
      rig.setEnabled(true);
      await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
      let frame!: HandDiagnosticFrame;
      rig.subscribeDiagnostics(value => { frame = value; });
      rig.tick(0);
      for (const side of ['L', 'R'] as const) {
        const model = frame.models[side], skin = new FingerSurfaceSampler(model);
        const surface = (name: 'middle' | 'ring') => skin.sample(name).concat(nailFacesFromPoints(
          model.nailMeshes!.find(mesh => mesh.userData.nail.finger === name)!));
        expect(new FingerObstacle(surface('ring')).intersections(surface('middle'))).toBe(0);
      }
      const group = cube.table.groups.y[1];
      group.drag();
      const side = direction > 0 ? 'R' : 'L';
      const sample = (degrees: number) => {
        group.angle = direction * THREE.MathUtils.degToRad(degrees);
        rig.tick(16);
        expect(frame.active?.gesture).toMatchObject({ hand: side, finger: 'index', finger2: 'middle' });
        return frame.models[side].fingers.middle.root.quaternion.clone();
      };
      const before = sample(89.9), after = sample(90.1);
      expect(before.angleTo(after)).toBeLessThan(.04);
      expect(sample(165).angleTo(after)).toBeGreaterThan(.1);
      expect(sample(89.9).angleTo(before)).toBeLessThan(.001);
      group.drop();
    } finally { rig.dispose(); cube.dispose(); }
  });

  it.each([-1, 1] as const)('lowers the pocket palm before D2 and hands its lower sticker to the ring in direction %i', async dir => {
    const rig = new HandsRig(), cube = new Cube(2);
    try {
      const { x, y, z } = cube.table.groups;
      rig.attachCube({ order: 2, table: { groups: { x, y, z } } });
      rig.setEnabled(true);
      await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
      let frame!: HandDiagnosticFrame;
      rig.subscribeDiagnostics(value => { frame = value; });
      rig.tick(0);
      const side = dir < 0 ? 'L' : 'R', model = frame.models[side], skin = new FingerSurfaceSampler(model);
      const supportModel = frame.models[side === 'L' ? 'R' : 'L'];
      const supportSkin = new FingerSurfaceSampler(supportModel);
      const start = model.group.position.y;
      for (let i = 0; i < 100 && rig.prepareTwist('y', [0], dir, 2); i++) rig.tick(8);
      expect(model.group.position.y).toBeLessThan(start - 5);
      expect(y[0].angle).toBe(0);
      y[0].drag();
      cube.updateMatrixWorld(true);
      const point = new THREE.Vector3();
      for (let degrees = 1; degrees <= 180; degrees++) {
        y[0].angle = dir * THREE.MathUtils.degToRad(degrees);
        rig.tick(8);
        expect(frame.active?.gesture).toMatchObject({ hand: side, finger: 'pinky', finger2: 'ring' });
        if (degrees >= 60 && degrees <= 102 && degrees % 3 === 0) {
          for (const name of ['thumb', 'index', 'middle'] as const) {
            const held = supportSkin.sample(name).concat(nailFacesFromPoints(
              supportModel.nailMeshes!.find(mesh => mesh.userData.nail.finger === name)!));
            const moving = skin.sample(name).concat(nailFacesFromPoints(
              model.nailMeshes!.find(mesh => mesh.userData.nail.finger === name)!));
            expect(new FingerObstacle(held).intersections(moving), 'hands overlap at ' + degrees).toBe(0);
          }
        }
        const digit = degrees <= 90 ? 'pinky' : 'ring';
        const corner = (degrees <= 90) === (side === 'L') ? 0 : 1;
        const target = readDiagnosticPieces(cube).find(piece => piece.initial === corner)!;
        const inverse = cube.matrixWorld.clone().multiply(target.matrix).invert();
        const nail = model.nailMeshes!.find(mesh => mesh.userData.nail.finger === digit)!;
        const samples = skin.samplePoints(digit).map(v => v.point).concat(nailVertices(nail));
        const half = 32 * (1 - cube.instancedRenderer.stickerGap);
        let gap = Infinity;
        for (const vertex of samples) {
          point.copy(vertex).applyMatrix4(inverse);
          gap = Math.min(gap, Math.hypot(point.y + 32, Math.max(0, Math.abs(point.x) - half),
            Math.max(0, Math.abs(point.z) - half)) * cube.scale.x);
        }
        expect(gap, digit + ' on the rotating D sticker at ' + degrees).toBeLessThan(3);
      }
      y[0].drop();
      for (let i = 0; i < 100; i++) rig.tick(8);
      expect(frame.grips[side]).toBe('home');
      expect(Math.abs(model.group.position.y - start)).toBeLessThan(2);
    } finally { rig.dispose(); cube.dispose(); }
  });

  it.each([2, 3, 4])('plays a written U2 as a left index–middle relay on order %i', async order => {
    const rig = new HandsRig(), cube = new Cube(order), reference = new Cube(order);
    try {
      const { x, y, z } = cube.table.groups;
      const top = order - 1;
      rig.attachCube({ order, table: { groups: { x, y, z } }, twister: cube.twister });
      rig.setEnabled(true);
      await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
      let frame!: HandDiagnosticFrame;
      rig.subscribeDiagnostics(f => { frame = f; });
      for (const [right, left] of [['up', 'home'], ['down', 'home'], ['half', 'home'], ['halfDown', 'home'], ['home', 'home'],
        ['up', 'down'], ['up', 'up'], ['up', 'half'], ['up', 'halfDown']] as const) {
        cube.history.clear();
        rig.setGrips(gripQuat(right), gripQuat(left));
        // Exercise both prepared playback and a direct timed turn with no hint.
        if (right === 'up' || right === 'half') {
          for (let i = 0; i < 100 && rig.prepareTwist('y', [top], 1, 2); i++) rig.tick(16);
          expect(rig.prepareTwist('y', [top], 1, 2)).toBe(false);
        }
        const move = new TwistAction('U2');
        expect(cube.twister.twist(move, false, false)).toBe(true);
        const sign = right === 'home' ? 1 : -1;
        const side = sign === 1 ? 'R' : 'L';
        expect(y[top].targetAngle).toBeCloseTo(sign * Math.PI);
        const poseAt = (degrees: number) => {
          y[top].angle = sign * THREE.MathUtils.degToRad(degrees);
          rig.tick(16);
          expect(frame.grips.R).toBe(right);
          expect(frame.grips.L).toBe(order === 2 && left === 'up' ? 'up' : 'home');
          expect(frame.active?.gesture).toMatchObject({ hand: side, finger: 'index', finger2: 'middle' });
          const { index, middle } = frame.models[side].fingers;
          return [index.root.quaternion.clone(), middle.root.quaternion.clone()];
        };
        const start = poseAt(2);
        if (right === 'half' || right === 'halfDown') {
          const model = frame.models.R, skin = new FingerSurfaceSampler(model);
          const point = new THREE.Vector3();
          cube.updateMatrixWorld(true);
          for (const degrees of [18, 32, 42, 68, 84]) {
            poseAt(degrees);
            const pieces = readDiagnosticPieces(cube).map(piece => cube.matrixWorld.clone().multiply(piece.matrix).invert());
            for (const name of ['thumb', 'middle', 'ring'] as const) {
              const nail = model.nailMeshes!.find(mesh => mesh.userData.nail.finger === name)!;
              const vertices = skin.samplePoints(name).map(s => s.point).concat(nailVertices(nail));
              let deepest = 0;
              for (const inverse of pieces) for (const vertex of vertices) {
                point.copy(vertex).applyMatrix4(inverse);
                deepest = Math.max(deepest, beveledPieceDepth(Math.abs(point.x), Math.abs(point.y), Math.abs(point.z)));
              }
              expect(deepest * cube.scale.x, right + ' ' + name + ' at ' + degrees).toBeLessThanOrEqual(.5);
            }
          }
        }
        const handoff = poseAt(90);
        if (side === 'L') {
          const model = frame.models.L;
          const skin = new FingerSurfaceSampler(model);
          const surface = (name: 'index' | 'middle') => skin.sample(name).concat(
            nailFacesFromPoints(model.nailMeshes!.find(mesh => mesh.userData.nail.finger === name)!));
          expect(new FingerObstacle(surface('index')).intersections(surface('middle'))).toBe(0);
        }
        const end = poseAt(178);
        expect(start[0].angleTo(handoff[0])).toBeGreaterThan(.1);
        expect(handoff[1].angleTo(end[1])).toBeGreaterThan(.1);
        cube.twister.finish();
        rig.tick(16);
        reference.twister.twist(move, true, true);
        expect(cube.history.last.value).toBe('U2');
        expect(cube.serializePictureFacelets()).toEqual(reference.serializePictureFacelets());
        for (let i = 0; i < 100 && rig.waitForRegrip(); i++) rig.tick(16);
        expect(rig.waitForRegrip()).toBe(false);
        expect(frame.grips).toMatchObject({ R: right, L: left });
      }
      for (const right of ['half', 'halfDown'] as const) {
        for (const left of ['up', 'down', 'half', 'halfDown'] as const) {
          rig.setGrips(gripQuat(right), gripQuat(left));
          const move = new TwistAction('U2');
          expect(cube.twister.twist(move, false, false)).toBe(true);
          expect(y[top].targetAngle).toBeCloseTo(Math.PI);
          y[top].angle = Math.PI / 4;
          rig.tick(16);
          expect(frame.grips).toMatchObject({ R: right, L: left });
          expect(frame.active?.gesture).toMatchObject({ hand: 'R' });
          cube.twister.finish();
          rig.tick(16);
        }
      }
    } finally { rig.dispose(); cube.dispose(); reference.dispose(); }
  });

  it.each(['home', 'down'] as const)('drives both fingers through a pocket U2-prime from left %s grip', async grip => {
    const rig = new HandsRig(), cube = new Cube(2);
    try {
      const { x, y, z } = cube.table.groups;
      rig.attachCube({ order: 2, table: { groups: { x, y, z } } });
      rig.setEnabled(true);
      await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
      rig.setGrips(gripQuat('up'), gripQuat(grip));
      let frame!: HandDiagnosticFrame;
      rig.subscribeDiagnostics(value => { frame = value; });
      rig.prepareTwist('y', [1], -1, 2);
      y[1].drag();
      const poseAt = (degrees: number) => {
        y[1].angle = -THREE.MathUtils.degToRad(degrees);
        rig.tick(0);
        const { index, middle } = frame.models.L.fingers;
        return { index: index.root.quaternion.clone(), middle: middle.root.quaternion.clone() };
      };
      const start = poseAt(1), handoff = poseAt(90), finish = poseAt(179);
      expect(frame.active?.gesture).toMatchObject({ hand: 'L', finger: 'index', finger2: 'middle' });
      expect(start.index.angleTo(handoff.index)).toBeGreaterThan(.1);
      expect(handoff.middle.angleTo(finish.middle)).toBeGreaterThan(.1);
      expect(frame.hands.L.flickAngle).toBeCloseTo(-THREE.MathUtils.degToRad(179));
      y[1].drop();
    } finally { rig.dispose(); cube.dispose(); }
  });

  it.each([
    ['half', 'home', 'y', 1, 1, 'R', 'thumb', 1],
    ['half', 'home', 'y', 1, 1, 'L', 'index', 1],
    ['halfDown', 'home', 'y', 1, 1, 'L', 'ring', 0],
    ['halfDown', 'home', 'y', 1, 1, 'R', 'thumb', 0],
    ['half', 'home', 'z', 1, 2, 'L', 'thumb', 1],
    ['home', 'home', 'y', 1, 1, 'R', 'ring', 0],
    ['home', 'home', 'y', -1, 1, 'L', 'ring', 0],
    ['half', 'home', 'z', -1, 2, 'L', 'index', 0],
    ['half', 'home', 'z', -1, 2, 'L', 'middle', 0],
    ['home', 'up', 'y', -1, 2, 'L', 'middle', 1],
    ['up', 'home', 'y', 1, 2, 'R', 'middle', 1],
    ['home', 'down', 'y', 1, 2, 'R', 'middle', 1],
    ['home', 'down', 'z', 1, 2, 'L', 'index', 1],
    ['up', 'home', 'y', -1, 2, 'L', 'middle', 1],
    ['down', 'home', 'y', 1, 1, 'R', 'index', 1],
    ['up', 'down', 'y', -1, 1, 'L', 'index', 1],
  ] as const)('pocket grips %s/%s, %s × %i × %i keep %s %s clear of corner bevels',
    async (right, left, axis, direction, quarters, side, digit, layer) => {
      const rig = new HandsRig(), cube = new Cube(2);
      try {
        const { x, y, z } = cube.table.groups;
        rig.attachCube({ order: cube.order, table: { groups: { x, y, z } } });
        rig.setEnabled(true);
        await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
        rig.setGrips(gripQuat(right), gripQuat(left));
        let frame!: HandDiagnosticFrame;
        rig.subscribeDiagnostics(value => { frame = value; });
        rig.tick(0);
        cube.updateMatrixWorld(true);
        const surface = new FingerSurfaceSampler(frame.models[side]);
        const nail = frame.models[side].nailMeshes!.find(mesh => mesh.userData.nail.finger === digit)!;
        const group = cube.table.groups[axis][layer];
        const upperRelay = digit === 'middle' && axis === 'y' && (side === 'L' ? left : right) === 'up';
        const checkRelay = (phase: string) => {
          const faces = (name: typeof FINGER_NAMES[number]) => surface.sample(name).concat(nailFacesFromPoints(
            frame.models[side].nailMeshes!.find(mesh => mesh.userData.nail.finger === name)!));
          const middle = new FingerObstacle(faces('middle'));
          expect(middle.intersections(faces('index')), phase + ' lead / relay').toBe(0);
          expect(middle.intersections(faces('ring')), phase + ' relay / support').toBe(0);
        };
        const probe = new THREE.Vector3();
        const measure = () => {
          const points = surface.samplePoints(digit).map(sample => sample.point).concat(nailVertices(nail));
          let worst = -Infinity, stickerGap = Infinity, drivenDepth = -Infinity;
          const stickerHalf = 32 * (1 - cube.instancedRenderer.stickerGap);
          for (const piece of readDiagnosticPieces(cube)) {
            const inverse = cube.matrixWorld.clone().multiply(piece.matrix).invert();
            const rotating = group.cubelets.some(c => c.initial === piece.initial);
            for (const point of points) {
              probe.copy(point).applyMatrix4(inverse);
              const x = Math.abs(probe.x), y = Math.abs(probe.y), z = Math.abs(probe.z);
              // After 90°, the left sticker of the original upper-back-left corner
              // faces backwards. The middle finger carries it through the next quarter.
              if (piece.initial === (side === 'L' ? 3 : 2)) {
                const distance = Math.hypot(probe.x + (side === 'L' ? -32 : 32), Math.max(0, y - stickerHalf), Math.max(0, z - stickerHalf));
                stickerGap = Math.min(stickerGap, distance * cube.scale.x);
              }
              const inside = beveledPieceDepth(x, y, z);
              worst = Math.max(worst, inside * cube.scale.x);
              if (rotating) drivenDepth = Math.max(drivenDepth, inside * cube.scale.x);
            }
          }
          return { penetration: worst, stickerGap, drivenDepth };
        };
        for (let i = 0; i < 120 && rig.prepareTwist(axis, [layer], direction, quarters); i++) {
          rig.tick(8);
          if (right === 'halfDown') expect(measure().penetration, 'preparing D-prime at ' + i).toBeLessThanOrEqual(.5);
        }
        group.drag();
        for (let degrees = 0; degrees <= quarters * 90; degrees += .5) {
          group.angle = direction * THREE.MathUtils.degToRad(degrees);
          rig.tick(16);
          const { penetration, stickerGap, drivenDepth } = measure();
          expect(penetration, 'layer angle ' + degrees).toBeLessThanOrEqual(.5);
          if (upperRelay && Number.isInteger(degrees)) checkRelay('upper relay at ' + degrees);
          if (upperRelay && degrees >= 90) {
            expect(stickerGap, 'driven sticker at ' + degrees).toBeLessThan(2.5);
          }
          if (side === 'L' && (right === 'half' || right === 'halfDown') && degrees > 0
            && (axis === 'y' || (digit === 'middle' ? degrees >= 90 : degrees <= 90))) {
            expect(frame.grips.R).toBe(right);
            expect(drivenDepth, 'opposite hand on moving layer at ' + degrees).toBeGreaterThan(-2.8);
          }
          if (digit === 'thumb' && right === 'half' && axis === 'y') {
            expect(penetration, 'thumb support at ' + degrees).toBeGreaterThan(-2.5);
          }
        }
        group.drop();
        for (let i = 0; i < 45; i++) {
          rig.tick(12);
          expect(measure().penetration, 'release frame ' + i).toBeLessThanOrEqual(.5);
          if (upperRelay) checkRelay('release frame ' + i);
        }
      } finally { rig.dispose(); cube.dispose(); }
    });

  it.each([1, -1] as const)('seats the pocket marked middle relay and follows both moving stickers, direction %i', async dir => {
    const rig = new HandsRig(), cube = new Cube(2);
    try {
      const { x, y, z } = cube.table.groups;
      rig.attachCube({ order: 2, table: { groups: { x, y, z } }, twister: cube.twister });
      rig.setEnabled(true);
      await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
      let frame!: HandDiagnosticFrame;
      rig.subscribeDiagnostics(value => { frame = value; });
      const side = dir > 0 ? 'R' : 'L';
      const prepare = () => rig.prepareTwist('y', [1], dir, 2, false, undefined, false, { finger: 'middle' });
      for (let i = 0; i < 150 && prepare(); i++) rig.tick(16);
      expect(prepare()).toBe(false);
      expect(rig.gripNames()[side]).toBe('up');
      cube.updateMatrixWorld(true);
      const group = cube.table.groups.y[1], model = frame.models[side], sampler = new FingerSurfaceSampler(model);
      const half = 32 * (1 - cube.instancedRenderer.stickerGap);
      group.drag();
      for (let degree = 0; degree <= 180; degree++) {
        group.angle = dir * THREE.MathUtils.degToRad(degree || .02);
        rig.tick(16);
        expect(frame.active?.gesture).toMatchObject({ hand: side, finger: 'index', finger2: 'middle', style: 'topPush' });
        for (const digit of ['index', 'middle'] as const) {
          if (digit === 'index' ? degree > 90 : degree < 90) continue;
          const first = digit === 'index';
          const id = (dir > 0) === first ? 3 : 2;
          const matrix = new THREE.Matrix4();
          cube.instancedRenderer.getCubeletRenderMatrix(id, matrix);
          const inverse = cube.matrixWorld.clone().multiply(matrix).invert();
          const nail = model.nailMeshes!.find(mesh => mesh.userData.nail.finger === digit)!;
          const points = sampler.samplePoints(digit).map(p => p.point).concat(nailVertices(nail));
          const gap = Math.min(...points.map(point => {
            const {x,y,z} = point.applyMatrix4(inverse);
            return Math.hypot(first ? z + 32 : x + dir * 32, Math.max(0, Math.abs(y) - half),
              Math.max(0, Math.abs(first ? x : z) - half)) * cube.scale.x;
          }));
          expect(gap, digit + ' at ' + degree).toBeLessThan(2.5);
        }
      }
      group.drop();
      for (let i = 0; i < 120; i++) rig.tick(16);
      expect(rig.gripNames()).toEqual({ L: 'home', R: 'home' });
    } finally { rig.dispose(); cube.dispose(); }
  });

  it.each([['R', 1, 3, false], ['L', -1, 2, false], ['R', 1, 3, true], ['L', -1, 2, true]] as const)(
    '2×2 %s index follows the original back corner from pad to nail (direction %i, corner %i, marked %s)', async (side, direction, corner, marked) => {
      const rig = new HandsRig(), cube = new Cube(2);
      try {
        const { x, y, z } = cube.table.groups;
        rig.attachCube({ order: cube.order, table: { groups: { x, y, z } } });
        rig.setEnabled(true);
        await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
        let frame!: HandDiagnosticFrame;
        rig.subscribeDiagnostics(value => { frame = value; });
        rig.tick(0);
        const finger = new FingerSurfaceSampler(frame.models[side]);
        const nail = frame.models[side].nailMeshes!.find(mesh => mesh.userData.nail.finger === 'index')!;
        cube.updateMatrixWorld(true);
        const toCube = cube.matrixWorld.clone().invert();
        const stickerHalf = 32 * (1 - cube.instancedRenderer.stickerGap);
        const upper = cube.table.groups.y[1];
        expect(rig.prepareTwist('y', [1], direction, 1, false, undefined, false, marked ? { contact: 'nail' } : undefined)).toBe(false);
        upper.drag();
        for (let degrees = 0; degrees <= 90; degrees++) {
          upper.angle = direction * THREE.MathUtils.degToRad(degrees);
          rig.tick(0);
          const skin = finger.samplePoints('index'), shell = nailSurface(nail);
          const points = [...skin, ...shell];
          for (const sample of points) sample.point.applyMatrix4(toCube);
          // Inspect the actual cubie's local B sticker while it travels.
          const pieces = readDiagnosticPieces(cube);
          const collision = measureIndexContact(points, pieces, stickerHalf);
          expect(collision.penetration.depthU * cube.scale.x, String(degrees)).toBeLessThanOrEqual(.1);
          const driving = degrees < 65 ? skin : degrees > 65 ? shell : points;
          const contact = measureIndexContact(driving, pieces, stickerHalf).contacts.find(c =>
            c.pieceInitial === corner && c.localFace === 'B');
          expect(contact, String(degrees)).toBeDefined();
          expect(contact!.gapU * cube.scale.x, String(degrees)).toBeLessThanOrEqual(2.5);
        }
        upper.drop();
      } finally { rig.dispose(); cube.dispose(); }
    },
  );

  it('only anticipates a plain single R with a U continuation, and releases an abandoned handoff', async () => {
    const rig = new HandsRig(), cube = new Cube(3);
    try {
      rig.attachCube({ order: 3, table: { groups: { x: cube.table.groups.x, y: cube.table.groups.y, z: cube.table.groups.z } } });
      rig.setEnabled(true);
      await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
      expect(rig.prepareTwist('x', [2], 1)).toBe(false);
      expect(rig.isReachPreparing).toBe(false);
      expect(rig.prepareTwist('x', [2], -1, 1, false, undefined, true)).toBe(false);
      expect(rig.prepareTwist('x', [2], 1, 2, false, undefined, true)).toBe(false);
      // The opposite thumb seats for a wide turn; the driving hand does
      // not prepare the R-to-U index handoff.
      rig.prepareTwist('x', [1, 2], 1, 1, false, undefined, true);
      for (let i = 0; i < 10; i++) rig.tick(20);
      expect(rig.prepareTwist('x', [1, 2], 1, 1, false, undefined, true)).toBe(false);
      expect(rig.isReachPreparing).toBe(false);
      rig.setGrips(gripQuat('home'), gripQuat('home'));
      expect(rig.prepareTwist('x', [2], 1, 1, false, undefined, true)).toBe(true);
      for (let i = 0; i < 100; i++) rig.tick(4);
      // Editing the next move / stepping elsewhere must not leave a held index.
      expect(rig.prepareTwist('x', [2], -1)).toBe(true);
      expect(rig.isReachRetreating).toBe(true);
      for (let i = 0; i < 200; i++) rig.tick(4);
      expect(rig.isReachRetreating).toBe(false);
      expect(rig.prepareTwist('x', [2], -1)).toBe(false);
      rig.setGrips(gripQuat('up'), gripQuat('home'));
      expect(rig.prepareTwist('x', [2], 1, 1, false, undefined, true)).toBe(false);
    } finally { rig.dispose(); cube.dispose(); }
  });
  it.each(['home', 'up', 'down', 'half'] as const)('holds U8 through R and hands off at B0 with left %s', async left => {
    const rig = new HandsRig(), cube = new Cube(3);
    const recorder = new UContactRecorder(() => cube);
    try {
      rig.attachCube({ order: 3, table: { groups: {
        x: cube.table.groups.x, y: cube.table.groups.y, z: cube.table.groups.z,
      } } }); rig.setEnabled(true);
      await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
      rig.setGrips(gripQuat('home'), gripQuat(left));
      let frame!: HandDiagnosticFrame;
      rig.subscribeDiagnostics(value => { frame = value; }); rig.tick(0);
      const sampler = new IndexSkinSampler(frame.models.R);
      const surface = new FingerSurfaceSampler(frame.models.R);
      const measure = () => measureIndexContact(sampler.sample(cube), readDiagnosticPieces(cube));
      const checkPad = (contact: NonNullable<ReturnType<typeof measure>['nearest']>) => {
        const direction = new THREE.Vector3(0, 0, 1)
          .transformDirection(frame.models.R.fingers.index.tip.matrixWorld)
          .transformDirection(cube.matrixWorld.clone().invert());
        expect(direction.dot(new THREE.Vector3(...contact.normalCube)), 'pad must face the sticker').toBeLessThan(-.5);
        const nail = frame.models.R.nailMeshes!.find(m => m.userData.nail.finger === 'index')!;
        const attr = nail.geometry.getAttribute('position');
        const toCube = cube.matrixWorld.clone().invert().multiply(nail.matrixWorld);
        const points = Array.from({ length: attr.count }, (_, vertex) => ({ vertex, pad: true,
          point: new THREE.Vector3().fromBufferAttribute(attr, vertex).applyMatrix4(toCube) }));
        const measured = measureIndexContact(points, readDiagnosticPieces(cube));
        expect(measured.contacts, 'nail must stay away from stickers').toEqual([]);
        expect(measured.penetration.depthU, 'nail must stay outside the cube').toBeLessThanOrEqual(.1);
      };
      let worstPen = 0;
      expect(rig.prepareTwist('x', [2], 1, 1, false, undefined, true)).toBe(true);
      for (let i = 0; i < 100 && rig.isReachPreparing; i++) { rig.tick(4); worstPen = Math.max(worstPen, measure().penetration.depthU); }
      expect(rig.prepareTwist('x', [2], 1, 1, false, undefined, true)).toBe(false);
      const start = measure().contacts.find(c => c.stickerId === 'U8');
      expect(start).toBeDefined();
      checkPad(start!);
      const r = cube.table.groups.x[2]; r.drag();
      for (let degrees = 1; degrees <= 90; degrees++) {
        r.angle = degrees * Math.PI / 180; rig.tick(0);
        const m = measure(), contact = m.contacts.find(c => c.stickerId === 'U8');
        expect(contact, `R ${degrees}: ${JSON.stringify(m.nearest)}`).toBeDefined();
        checkPad(contact!);
        expect(new THREE.Vector3(...contact!.pointPiece).distanceTo(new THREE.Vector3(...start!.pointPiece))).toBeLessThan(.01);
        worstPen = Math.max(worstPen, m.penetration.depthU);
      }
      r.drop(); rig.tick(0);
      expect(frame.grips).toEqual({ R: 'up', L: left });
      expect(measure().contacts.find(c => c.stickerId === 'U8')?.currentSlot).toBe('B0');
      const beforeU = sampler.sample(cube);
      recorder.bind(rig); recorder.start();
      expect(rig.prepareTwist('y', [2], 1)).toBe(false);
      rig.tick(0);
      const afterU = sampler.sample(cube);
      expect(Math.max(...afterU.map((p, i) => p.point.distanceTo(beforeU[i].point)))).toBeLessThan(.01);
      const thumbJoints = frame.models.R.fingers.thumb;
      const thumbParts = [thumbJoints.root, thumbJoints.mid, thumbJoints.tip,
        frame.models.R.nailMeshes!.find(m => m.userData.nail.finger === 'thumb')!];
      const thumbPose = thumbParts.map(p => p.matrixWorld.elements.slice());
      const thumbPoints = surface.samplePoints('thumb');
      const thumbMeasurement = measureIndexContact(thumbPoints, readDiagnosticPieces(cube));
      expect(thumbMeasurement.nearest?.currentSlot).toBe('U5');
      const assertThumbHeld = () => {
        // Lock the actual joints and nail, including their world position. MANO
        // corrective skin near the web can deform slightly with another finger;
        // that surface is checked independently for collision below.
        for (const [i, part] of thumbParts.entries()) expect(part.matrixWorld.elements).toEqual(thumbPose[i]);
        // The frozen home thumb has a small existing ideal-box boundary overlap
        // during the layer sweep. Do not move it to hide that baseline; require
        // this motion to preserve the frozen-thumb result at the same layer angle.
        const pieces = readDiagnosticPieces(cube);
        const baseline = measureIndexContact(thumbPoints, pieces).penetration.depthU;
        expect(measureIndexContact(surface.samplePoints('thumb'), pieces).penetration.depthU).toBeLessThanOrEqual(baseline + .001);
      };
      const thumbFaces = surface.sample('thumb');
      const indexNail = frame.models.R.nailMeshes!.find(m => m.userData.nail.finger === 'index')!;
      const nailPoints = () => nailVertices(indexNail);
      const nailFaces = () => nailFacesFromPoints(indexNail, nailPoints());
      const thumbBox = new THREE.Box3();
      for (const face of thumbFaces) thumbBox.union(face.box);
      let underpassSamples = 0;
      const assertUnderThumb = () => {
        const ray = new THREE.Ray(), hit = new THREE.Vector3();
        const points = [...sampler.sample(cube), ...nailPoints().map(point => ({ point }))];
        for (const p of points) {
          if (p.point.x < thumbBox.min.x || p.point.x > thumbBox.max.x || p.point.z < thumbBox.min.z || p.point.z > thumbBox.max.z) continue;
          ray.set(new THREE.Vector3(p.point.x, -500, p.point.z), new THREE.Vector3(0, 1, 0));
          let underside = Infinity;
          for (const face of thumbFaces) {
            if (p.point.x < face.box.min.x || p.point.x > face.box.max.x || p.point.z < face.box.min.z || p.point.z > face.box.max.z) continue;
            if (ray.intersectTriangle(face.triangle.a, face.triangle.b, face.triangle.c, false, hit)) underside = Math.min(underside, hit.y);
          }
          if (Number.isFinite(underside)) {
            underpassSamples++;
            expect(underside - p.point.y, 'index must pass below the fixed thumb').toBeGreaterThan(.5);
          }
        }
      };
      const u = cube.table.groups.y[2]; u.drag();
      const angleStep = left === 'home' ? .25 : 1;
      for (let degrees = angleStep; degrees <= 90; degrees += angleStep) {
        u.angle = degrees * Math.PI / 180; rig.tick(0);
        const m = measure();
        assertThumbHeld();
        const measuredNail = measureIndexContact(nailSurface(frame.models.R.nailMeshes!.find(n => n.userData.nail.finger === 'index')!), readDiagnosticPieces(cube));
        if (degrees <= 60) expect(m.contacts.some(c => c.stickerId === 'U8'), 'U pad ' + degrees).toBe(true);
        if (degrees >= 60) expect(measuredNail.contacts.some(c => c.stickerId === 'U8'), 'U nail ' + degrees).toBe(true);
        expect(measuredNail.penetration.depthU).toBeLessThanOrEqual(.1);
        if (left === 'home' && degrees % 5 === 0) {
          assertUnderThumb();
          const skin = surface.sample('index');
          const nail = nailFaces();
          for (const finger of FINGER_NAMES.filter(f => f !== 'index')) {
            const obstacle = new FingerObstacle(surface.sample(finger));
            expect(obstacle.intersections(skin), `index / ${finger} at ${degrees}`).toBe(0);
            expect(obstacle.intersections(nail), `index nail / ${finger} at ${degrees}`).toBe(0);
          }
        }
        worstPen = Math.max(worstPen, m.penetration.depthU);
      }
      if (left === 'home') expect(underpassSamples).toBeGreaterThan(0);
      u.drop(); rig.tick(0);
      for (let i = 0; i < 200; i++) {
        rig.tick(4); worstPen = Math.max(worstPen, measure().penetration.depthU);
        if (frame.hands.R.phase === 'returning') assertThumbHeld();
        if (left === 'home' && frame.hands.R.phase === 'returning' && i % 5 === 0) {
          const obstacle = new FingerObstacle(surface.sample('thumb'));
          expect(obstacle.intersections(surface.sample('index')), 'return index / fixed thumb').toBe(0);
          expect(obstacle.intersections(nailFaces()), 'return index nail / fixed thumb').toBe(0);
          const toCube = cube.matrixWorld.clone().invert();
          const points = nailPoints().map((point, vertex) => ({ point: point.applyMatrix4(toCube), vertex, pad: false }));
          expect(measureIndexContact(points, readDiagnosticPieces(cube)).penetration.depthU,
            'return nail must stay outside the cube').toBeLessThanOrEqual(.1);
        }
      }
      expect(worstPen).toBeLessThanOrEqual(.1);
      expect(recorder.read().records.at(-1)?.status).toBe('complete');
      expect(recorder.read().records.at(-1)?.missingCheckpoints).toEqual([]);
    } finally { recorder.dispose(); rig.dispose(); cube.dispose(); }
  }, 30000);
  it('clears the incoming upper corner and returns before R-prime in upper-grip U2', async () => {
    const rig = new HandsRig(), cube = new Cube(3);
    try {
      const { x, y, z } = cube.table.groups;
      rig.attachCube({ order: 3, table: { groups: { x, y, z } } });
      rig.setEnabled(true);
      await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
      rig.setGrips(gripQuat('up'), gripQuat('home'));
      let frame!: HandDiagnosticFrame;
      rig.subscribeDiagnostics(value => { frame = value; });
      rig.tick(0);
      const model = frame.models.R, surface = new FingerSurfaceSampler(model);
      const opposite = new FingerSurfaceSampler(frame.models.L);
      const nail = model.nailMeshes!.find(m => m.userData.nail.finger === 'index')!;
      const finger = model.fingers.index;
      const homeIndex = [finger.meta!, finger.root, finger.mid, finger.tip].map(bone => bone.quaternion.clone());
      const support = FINGER_NAMES.filter(name => name !== 'index').map(name => model.fingers[name].tip);
      expect(rig.prepareTwist('y', [2], 1, 2)).toBe(true);
      rig.tick(0);
      const supportAtStart = support.map(bone => bone.matrixWorld.clone());
      const check = (phase: string, driving: boolean, triangles: boolean) => {
        const skin = surface.samplePoints('index'), points = nailVertices(nail);
        const pieces = readDiagnosticPieces(cube);
        const contact = measureIndexContact(skin, pieces);
        const axial = frame.hands.R.finalPose!.fingers.index.root.axialTwist;
        expect(axial, phase + ' defined MCP axis').not.toBeNull();
        expect(Math.abs(axial!), phase + ' binding-axis MCP roll').toBeLessThan(86);
        expect(contact.penetration.depthU, phase + ' skin').toBeLessThanOrEqual(.1);
        expect(measureIndexContact(points.map((point, vertex) => ({ point, vertex, pad: false })), pieces).penetration.depthU,
          phase + ' nail').toBeLessThanOrEqual(.1);
        if (driving) {
          const actual = Math.abs(frame.hands.R.flickAngle) >= Math.PI / 3
            ? measureIndexContact(nailSurface(nail, points), pieces) : contact;
          expect(actual.contacts.some(c => c.stickerId === 'B0'), phase + ' original sticker').toBe(true);
        }
        if (frame.hands.R.phase !== 'stable') for (const [i, bone] of support.entries()) {
          expect(bone.matrixWorld.elements, phase + ' support').toEqual(supportAtStart[i].elements);
        }
        if (triangles) {
          const obstacles = [...FINGER_NAMES.filter(f => f !== 'index').map(f => ({ name: f, faces: surface.sample(f) })),
            ...FINGER_NAMES.map(f => ({ name: 'opposite ' + f, faces: opposite.sample(f) }))];
          const moving = [...surface.sample('index'), ...nailFacesFromPoints(nail, points)];
          for (const { name, faces } of obstacles) expect(new FingerObstacle(faces).intersections(moving), phase + ' / ' + name).toBe(0);
        }
      };
      for (let ms = 0; ms < 300 && rig.isReachPreparing; ms += 2) {
        rig.tick(2); check('prepare ' + ms, false, ms % 8 === 0);
      }
      expect(rig.prepareTwist('y', [2], 1, 2)).toBe(false);
      y[2].drag();
      for (let i = 1; i <= 720; i++) {
        y[2].angle = i * Math.PI / 720;
        rig.tick(0);
        check('turn ' + i / 4, i <= 360, true);
      }
      y[2].drop(); rig.tick(0);
      expect(rig.prepareTwist('x', [2], -1)).toBe(true);
      for (let ms = 0; ms < 300 && rig.isReachRetreating; ms++) {
        rig.tick(1); check('return ' + ms, false, ms % 4 === 0);
      }
      expect(rig.prepareTwist('x', [2], -1)).toBe(false);
      for (const [i, bone] of [finger.meta!, finger.root, finger.mid, finger.tip].entries()) {
        expect(bone.quaternion.angleTo(homeIndex[i])).toBeLessThan(1e-6);
      }
    } finally { rig.dispose(); cube.dispose(); }
  }, 30000);
});

describe.runIf(haveBothHands)('single U and U-prime home-index contact', () => {
  it.each(['R', 'L'] as const)('rolls the %s index from pad to nail on its original corner, then clears the committed cube', async side => {
    const rig = new HandsRig(), cube = new Cube(3);
    try {
      const { x, y, z } = cube.table.groups;
      rig.attachCube({ order: cube.order, table: { groups: { x, y, z } } });
      rig.setEnabled(true);
      await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
      // Gc reaches U in double home and U-prime with the supporting right hand down.
      rig.setGrips(gripQuat(side === 'L' ? 'down' : 'home'), gripQuat('home'));
      let frame!: HandDiagnosticFrame;
      rig.subscribeDiagnostics(f => { frame = f; });
      const dir = side === 'R' ? 1 : -1;
      rig.prepareTwist('y', [2], dir);
      rig.tick(0);
      const model = frame.models[side], surface = new FingerSurfaceSampler(model);
      const nail = model.nailMeshes!.find(mesh => mesh.userData.nail.finger === 'index')!;
      const vertices = nail.geometry.getAttribute('position');
      const sticker = side === 'R' ? 'B0' : 'B2';
      const upper = cube.table.groups.y[2];
      const finger = model.fingers.index;
      const homeIndex = finger.root.quaternion.clone(), homeMeta = finger.meta!.quaternion.clone();
      const strain = knuckleStrain(model, 'index');
      const middleNail = model.nailMeshes!.find(mesh => mesh.userData.nail.finger === 'middle')!;
      const checkAdjacentFinger = () => {
        const middle = new FingerObstacle([...surface.sample('middle'), ...nailFacesFromPoints(middleNail, nailVertices(middleNail))]);
        expect(middle.intersections(surface.sample('index')), 'index / middle skin').toBe(0);
        expect(middle.intersections(nailFacesFromPoints(nail, nailVertices(nail))), 'index nail / middle').toBe(0);
      };
      upper.drag();
      const check = (angle: number, pushing: boolean) => {
        const skin = surface.samplePoints('index');
        expect(THREE.MathUtils.radToDeg(homeMeta.angleTo(finger.meta!.quaternion))).toBeLessThan(15);
        const q = finger.mid.quaternion;
        const offHinge = 2 * Math.atan2(Math.hypot(q.x, q.z), Math.hypot(q.y, q.w));
        expect(THREE.MathUtils.radToDeg(offHinge)).toBeLessThan(10);
        expect(strain().max, 'index knuckle stretch').toBeLessThan(1.50);
        const matrix = new THREE.Matrix4().makeRotationY(-angle)
          .multiply(new THREE.Matrix4().makeTranslation(dir * 64, 64, -64));
        const moving = { initial: side === 'R' ? 8 : 6, faces: [4 as const], matrix };
        const degrees = Math.abs(THREE.MathUtils.radToDeg(angle));
        if (pushing && degrees <= 65) expect(measureIndexContact(skin, [moving]).contacts.some(c => c.stickerId === sticker),
          'original sticker under pad at ' + degrees).toBe(true);
        if (pushing && degrees >= 65) expect(measureIndexContact(nailSurface(nail), [moving]).contacts.some(c => c.stickerId === sticker),
          'original sticker under nail at ' + degrees).toBe(true);
        const points = skin.map(v => v.point);
        for (let i = 0; i < vertices.count; i++)
          points.push(new THREE.Vector3().fromBufferAttribute(vertices, i).applyMatrix4(nail.matrixWorld));
        const c = Math.cos(angle), s = Math.sin(angle);
        let depth = -Infinity;
        for (const p of points) {
          const x = c * p.x + s * p.z, z = -s * p.x + c * p.z;
          depth = Math.max(depth, Math.min(96 - Math.abs(x), 32 - Math.abs(p.y - 64), 96 - Math.abs(z)),
            Math.min(96 - Math.abs(p.x), 64 - Math.abs(p.y + 32), 96 - Math.abs(p.z)));
        }
        expect(depth).toBeLessThanOrEqual(.1);
      };
      for (let i = 0; i <= 360; i++) {
        upper.angle = dir * i * Math.PI / 720;
        rig.tick(0);
        check(upper.angle, true);
        if (i >= 56 * 4 && i <= 75 * 4 && i % 2 === 0) checkAdjacentFinger();
      }
      upper.drop();
      for (let ms = 0; ms <= 300; ms++) { rig.tick(1); check(0, false); }
      expect(model.fingers.index.root.quaternion.angleTo(homeIndex)).toBeLessThan(1e-6);
    } finally { rig.dispose(); cube.dispose(); }
  });
});
