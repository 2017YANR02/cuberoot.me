import { describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import * as THREE from 'three';
import { knuckleStrain } from './handKnuckleStrain';
import Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import { TwistAction } from '@cuberoot/puzzle-render-core/engine/nxn/twister';
import HandsRig, { gripQuat, type HandDiagnosticFrame } from '@/app/[lang]/sim/engine/hands/handsRig';
import { buildManoHand } from '@/app/[lang]/sim/engine/hands/handModelMano';
import { IndexSkinSampler, readDiagnosticPieces, measureIndexContact } from '@/app/[lang]/sim/engine/hands/uContactGeometry';
import { UContactRecorder } from '@/app/[lang]/sim/engine/hands/uContactRecorder';
import { FingerSurfaceSampler, FingerObstacle, FINGER_NAMES } from '@/app/[lang]/sim/engine/hands/fingerCollision';

import { segmentAxialRotation } from '@/app/[lang]/sim/engine/hands/handModel';

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

describe.skipIf(!existsSync(asset(-1)) || !existsSync(asset(1)))('R U anticipation with real MANO skin', () => {
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

  it.each([['R', 1, 3], ['L', -1, 2]] as const)(
    '2×2 %s index follows the original back corner from pad to nail', async (side, direction, corner) => {
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
        rig.prepareTwist('y', [1], direction);
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

describe.skipIf(!existsSync(asset(-1)) || !existsSync(asset(1)))('single U and U-prime home-index contact', () => {
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
