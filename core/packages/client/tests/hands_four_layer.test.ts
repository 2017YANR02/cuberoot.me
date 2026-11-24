import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import tweener from '@cuberoot/puzzle-render-core/engine/tweener';
import { TwistAction } from '@cuberoot/puzzle-render-core/engine/nxn/twister';
import HandsRig, { gestureForLayers, gripQuat, type Axis, type HandDiagnosticFrame } from '@/app/[lang]/sim/engine/hands/handsRig';
import { buildManoHand } from '@/app/[lang]/sim/engine/hands/handModelMano';
import { FingerObstacle, FingerSurfaceSampler, type SkinTriangle } from '@/app/[lang]/sim/engine/hands/fingerCollision';
import { layerInvalidSpans } from '@/app/[lang]/sim/pocketMoves';
import { engineHomeSid } from '@cuberoot/puzzle-render-core/engine/nxn/netIndex';
import { FACE } from '@cuberoot/puzzle-render-core/engine/define';
import { nailPoints } from '@/app/[lang]/sim/engine/hands/gestureContactTrace';

const asset = (side: number) => new URL(`../public/sim/hands/mano/${side === -1 ? 'right' : 'left'}.mano.json`, import.meta.url);
vi.mock('@/app/[lang]/sim/engine/hands/handModelMano', async original => ({
  ...await original<typeof import('@/app/[lang]/sim/engine/hands/handModelMano')>(),
  loadManoHand: async (side: 1 | -1, material: THREE.Material) =>
    buildManoHand(JSON.parse(readFileSync(asset(side), 'utf8')), side, material),
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

function fingerFaces(skin: FingerSurfaceSampler, model: HandDiagnosticFrame['models']['R'], finger: keyof HandDiagnosticFrame['models']['R']['fingers']) {
  const faces: SkinTriangle[] = skin.sample(finger);
  const nail = model.nailMeshes!.find(mesh => mesh.userData.nail.finger === finger)!;
  const points = nailPoints(model, finger, new THREE.Matrix4()), indices = nail.geometry.index!;
  for (let i = 0; i < indices.count; i += 3) {
    const a = points[indices.getX(i)].point, b = points[indices.getX(i + 1)].point, c = points[indices.getX(i + 2)].point;
    faces.push({ triangle: new THREE.Triangle(a, b, c), box: new THREE.Box3().setFromPoints([a, b, c]) });
  }
  return faces;
}

function checkFlexionLimits(finger: HandDiagnosticFrame['models']['R']['fingers']['ring']) {
  const hinges = [[finger.mid, finger.restBend![0], 130], [finger.tip, finger.restBend![1], 100]] as const;
  for (const [joint, rest, limit] of hinges) {
    // XYZ Euler angles fold a pure Y hinge past 90° into two apparent half twists.
    const { x, y, z, w } = joint.quaternion;
    expect(Math.hypot(x, z)).toBeLessThan(1e-6);
    const bend = -2 * Math.atan2(y * Math.sign(w), Math.abs(w));
    expect(bend).toBeGreaterThanOrEqual(.03 - 1e-5);
    expect(bend + rest).toBeLessThanOrEqual(THREE.MathUtils.degToRad(limit));
  }
}

// The rendered cubelet has flat faces and bevels on its edges and corners.
function cubeletDepth(p: THREE.Vector3) {
  const x = Math.abs(p.x), y = Math.abs(p.y), z = Math.abs(p.z);
  return Math.min(32 - Math.max(x, y, z), (61 - Math.max(x + y, x + z, y + z)) / Math.SQRT2,
    (90 - x - y - z) / Math.sqrt(3));
}

it('preserves the actual depth selected by the engine, including signed halves and aliases', () => {
  const cube = new Cube(4);
  try {
    for (const [token, layers] of Object.entries({
      R: [3], '2R': [2], '2L': [1], r: [2, 3], Rw: [2, 3], '2Rw': [2, 3],
      '3Rw': [1, 2, 3], M: [1, 2], '2-3R': [1, 2], x: [0, 1, 2, 3],
    })) {
      const moves = cube.table.convert(new TwistAction(token));
      expect(moves.map(m => m.group.layer), token).toEqual(layers);
    }
    expect(layerInvalidSpans("3Rw M 2R2' (R U)5 // 5Rw", 4)).toBeNull();
    expect(layerInvalidSpans('R 5Rw 0L 2-5F', 4)?.filter(span => span.bad).map(span => span.text))
      .toEqual(['5Rw', '0L', '2-5F']);
    for (const face of 'RLUDFB') {
      for (const suffix of ['', "'", '2', "2'"]) {
        for (const [prefix, wide, width] of [['', '', 1], ['2', '', 1], ['', 'w', 2], ['3', 'w', 3], ['4', 'w', 4]] as const) {
          const move = new TwistAction(prefix + face + wide + suffix);
          const rotated = cube.table.convert(move);
          expect(rotated, move.value).toHaveLength(width);
          expect(new Set(rotated.map(r => r.group.layer)).size).toBe(width);
          expect(rotated.every(r => Math.abs(r.twist) === (suffix.startsWith('2') ? 2 : 1))).toBe(true);
        }
      }
    }
    const grips = { R: 'up', L: 'home' } as const;
    const wide = gestureForLayers('y', [2, 3], 1, grips, { quarters: 2 }, 4);
    expect(wide).toEqual(gestureForLayers('y', [1], 1, grips, { quarters: 2 }, 2));
    expect(gestureForLayers('y', [3], 1, grips, undefined, 4))
      .toEqual(gestureForLayers('y', [2], 1, grips, undefined, 3));
    expect(cube.table.convert(new TwistAction("2R2'"))[0].twist).toBe(-2);
  } finally { cube.dispose(); }
});

describe.skipIf(!existsSync(asset(1)) || !existsSync(asset(-1)))('four-layer MANO contacts', () => {
  it.each(['Fw2', "Fw2'", 'D2', "B2'"])('clears the baked corner during the return from %s', async move => {
    const cube = new Cube(4), rig = new HandsRig();
    try {
      const { x, y, z } = cube.table.groups;
      rig.attachCube({ order: cube.order, table: { groups: { x, y, z } }, twister: cube.twister });
      rig.setEnabled(true);
      await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
      let frame!: HandDiagnosticFrame;
      rig.subscribeDiagnostics(next => { frame = next; });
      const action = new TwistAction(move), turns = cube.table.convert(action);
      const { group, twist } = turns[0], layers = turns.map(turn => turn.group.layer);
      const prepare = () => rig.prepareTwist(group.axis as Axis, layers, twist > 0 ? 1 : -1, 2);
      for (let i = 0; i < 160 && prepare(); i++) rig.tick(8);
      expect(prepare()).toBe(false);
      expect(cube.twister.twist(action, false, false, 60)).toBe(true);
      const side = move === 'Fw2' || move === "B2'" ? 'R' : 'L';
      const driver = move.startsWith('Fw') ? 'middle' : 'ring';
      const model = frame.models[side], skin = new FingerSurfaceSampler(model);
      for (let i = 0; cube.busy && i < 140; i++) { tweener.update(.48); rig.tick(8); }
      expect(cube.busy).toBe(false);
      const toCube = cube.matrix.clone().invert(), toPiece = new THREE.Matrix4(), vertex = new THREE.Vector3();
      const inversePieces = Array.from(cube.initials.keys(), id => {
        cube.instancedRenderer.getCubeletRenderMatrix(id, toPiece);
        return toPiece.clone().invert().multiply(toCube);
      });
      let depth = 0;
      for (let i = 0; i < 40; i++) {
        const points = [...skin.samplePoints(driver), ...nailPoints(model, driver, new THREE.Matrix4())];
        for (const matrix of inversePieces) for (const { point } of points) {
          depth = Math.max(depth, cubeletDepth(vertex.copy(point).applyMatrix4(matrix)) * cube.scale.x);
        }
        rig.tick(8);
      }
      expect(depth).toBeLessThanOrEqual(.1);
    } finally { rig.dispose(); cube.dispose(); }
  });

  it.each([
    ['2R', 'home'], ['2L', 'home'], ['2U', 'home'], ['2D', 'home'], ['2F', 'home'], ['2B', 'home'],
    ['2R2', 'home'], ["2L2'", 'home'], ["2R2'", 'home'], ['2L2', 'home'], ['2D2', 'home'], ['2U2', 'home'], ["2U2'", 'home'], ["2D2'", 'home'],
    ['2R', 'up/down'], ['2U', 'up/down'], ['2F', 'up/down'], ['2R2', 'up/down'],
    ['2L', 'half'], ['2U', 'half'], ['2R2', 'half'], ['2F', 'drag'],
  ] as const)('seats both hands on single stationary strips for %s with %s', async (move, start) => {
    const cube = new Cube(4), rig = new HandsRig();
    try {
      const { x, y, z } = cube.table.groups;
      rig.attachCube({ order: 4, table: { groups: { x, y, z } } });
      rig.setEnabled(true);
      await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
      let frame!: HandDiagnosticFrame;
      rig.subscribeDiagnostics(f => { frame = f; });
      if (start === 'up/down') rig.setGrips(gripQuat('up'), gripQuat('down'));
      if (start === 'half') rig.setGrips(gripQuat('half'), gripQuat('halfDown'), { R: Math.PI, L: -Math.PI });
      const [{ group, twist }] = cube.table.convert(new TwistAction(move));
      const axis = group.axis as Axis, layer = group.layer, dir = twist < 0 ? -1 : 1;
      const quarters = Math.abs(twist);
      if (start !== 'drag') {
        for (let i = 0; i < 120 && rig.prepareTwist(axis, [layer], dir, quarters); i++) rig.tick(16);
        expect(rig.prepareTwist(axis, [layer], dir, quarters)).toBe(false);
      }
      rig.tick(0);
      const hands = (['R', 'L'] as const).map(side => {
        const model = frame.models[side];
        const fingers = (['thumb', 'index', 'middle', 'ring', 'pinky'] as const).map(name => {
          const f = model.fingers[name], joints = [f.root, f.mid, f.tip];
          return { name, joints, seated: joints.map(j => j.quaternion.clone()) };
        });
        return { side, fingers, skin: new FingerSurfaceSampler(model) };
      });
      const axes = ['x', 'y', 'z'] as const;
      const restingRows = new Map<string, number>();
      group.drag();
      // Sample both sides of the handoff and reverse the drag. The bones
      // should retain the posture established before the layer started.
      const sweep = start === 'home' && quarters === 2
        ? Array.from({ length: 721 }, (_, i) => i / 4 || .01)
        : [.01, 45, 89, ...(quarters === 2 ? [91, 135, 180] : [90])];
      for (const degrees of [...sweep, 45, 1]) {
        group.angle = THREE.MathUtils.degToRad(degrees) * dir;
        rig.tick(16);
        const gesture = frame.active?.gesture;
        if (gesture?.kind !== 'flick') throw Error('Expected an inner-slice flick');
        for (const { side, fingers, skin } of hands) {
          const gaps = [Infinity, Infinity, Infinity, Infinity];
          const lowerRelay = axis === 'y' && layer === 1 && quarters === 2 && start === 'home';
          for (const { name, joints, seated } of fingers) {
            if (side === gesture.hand && (name === gesture.finger || name === gesture.finger2)) continue;
            joints.forEach((joint, i) => {
              if (start === 'drag' && degrees === .01) seated[i].copy(joint.quaternion);
              expect(joint.quaternion.angleTo(seated[i])).toBeLessThan(1e-5);
            });
            let upperStripGap = Infinity;
            for (const { point, pad } of skin.samplePoints(name)) {
              if (!pad) continue;
              for (let row = 0; row < 4; row++) {
                for (const normal of axes) {
                  if (axis === normal && row !== 0 && row !== 3) continue;
                  const height = axis === normal ? point[normal] * (row === 0 ? -1 : 1) : Math.abs(point[normal]);
                  let distance = (height - 96) ** 2;
                  for (const tangent of axes) {
                    if (tangent === normal) continue;
                    const column = tangent === axis ? row : THREE.MathUtils.clamp(Math.floor((point[tangent] + 96) / 48), 0, 3);
                    distance += Math.max(0, Math.abs(point[tangent] - (column - 1.5) * 48) - 21) ** 2;
                  }
                  const gap = Math.sqrt(distance);
                  gaps[row] = Math.min(gaps[row], gap);
                  if (lowerRelay && row === 2 && normal === 'z' && (name === 'thumb' ? point.z > 0 : point.z < 0))
                    upperStripGap = Math.min(upperStripGap, gap);
                }
              }
            }
            if (lowerRelay && (name === 'thumb' || name === 'middle'))
              expect(upperStripGap, `${side} ${name} bracing row 2 at ${degrees}°`).toBeLessThan(2.5);
          }
          const contacts = gaps.flatMap((gap, row) => gap < 2.5 ? [row] : []);
          expect(contacts, `${side} at ${degrees}°: ${gaps}`).toHaveLength(1);
          expect(contacts[0]).not.toBe(layer);
          if (!restingRows.has(side)) restingRows.set(side, contacts[0]);
          expect(contacts[0]).toBe(restingRows.get(side));
        }
      }
      group.angle = 0;
      group.drop();
    } finally { rig.dispose(); cube.dispose(); }
  });

  it.each(['Rw', '3Rw', 'Lw', '3Lw'])('holds the moving columns and the stationary strip through %s', async move => {
    const cube = new Cube(4), rig = new HandsRig();
    try {
      const { x, y, z } = cube.table.groups;
      const rotations = cube.table.convert(new TwistAction(move));
      const layers = rotations.map(r => r.group.layer);
      const dir = rotations[0].twist > 0 ? 1 : -1;
      const side = dir === 1 ? 'R' : 'L';
      const outer = dir === 1 ? 3 : 0;
      rig.attachCube({ order: 4, table: { groups: { x, y, z } } });
      rig.setEnabled(true);
      await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
      let frame!: HandDiagnosticFrame;
      rig.subscribeDiagnostics(f => { frame = f; });
      for (let n = 0; n < 100 && rig.prepareTwist('x', layers, dir); n++) rig.tick(16);
      expect(rig.prepareTwist('x', layers, dir)).toBe(false);
      rig.tick(0);
      const driver = new FingerSurfaceSampler(frame.models[side]);
      const support = new FingerSurfaceSampler(frame.models[side === 'R' ? 'L' : 'R']);
      const anchors = [
        { sampler: driver, finger: 'thumb', column: outer },
        { sampler: driver, finger: 'middle', column: outer - dir * (layers.length - 1) },
        { sampler: support, finger: 'middle', column: 3 - outer },
      ] as const;
      const checks = layers.length === 3
        ? [...anchors, { sampler: driver, finger: 'ring' as const, column: outer - dir }]
        : anchors;
      for (const { group } of rotations) group.drag();
      const inverse = cube.matrix.clone().invert(), matrix = new THREE.Matrix4(), point = new THREE.Vector3();
      for (const degrees of [1, 30, 45, 60, 90]) {
        for (const { group } of rotations) group.angle = dir * degrees * Math.PI / 180;
        rig.tick(16);
        for (const { sampler, finger, column } of checks) {
          let gap = Infinity;
          const pad = sampler.samplePoints(finger).filter(v => v.pad);
          for (const id of cube.initials.keys()) {
            if (id % 4 !== column) continue;
            const y = Math.floor(id / 4) % 4, z = Math.floor(id / 16);
            cube.instancedRenderer.getCubeletRenderMatrix(id, matrix);
            matrix.invert().multiply(inverse);
            for (const sample of pad) {
              point.copy(sample.point).applyMatrix4(matrix);
              const axial = Math.max(0, Math.abs(point.x) - 28);
              if (z === 0 || z === 3) gap = Math.min(gap, Math.hypot(point.z - (z === 0 ? -32 : 32), axial, Math.max(0, Math.abs(point.y) - 28)));
              if (y === 0 || y === 3) gap = Math.min(gap, Math.hypot(point.y - (y === 0 ? -32 : 32), axial, Math.max(0, Math.abs(point.z) - 28)));
            }
          }
          expect(gap * cube.scale.x, `${degrees}° ${finger} column ${column}`).toBeLessThan(2.5);
        }
      }
      for (const { group } of rotations) { group.angle = 0; group.drop(); }
    } finally { rig.dispose(); cube.dispose(); }
  });

  it.each([
    { move: '2R', layers: [2], side: 'R', dir: 1, piece: 2, face: 'B', sticker: 'B13' },
    { move: "2R'", layers: [2], side: 'R', dir: -1, piece: 50, face: 'D', sticker: 'D2' },
    { move: '2L', layers: [1], side: 'L', dir: -1, piece: 49, face: 'D', sticker: 'D1' },
    { move: "2L'", layers: [1], side: 'L', dir: 1, piece: 1, face: 'B', sticker: 'B14' },
    { move: 'M', layers: [1, 2], side: 'L', dir: -1, piece: 49, face: 'D', sticker: 'D1' },
    { move: "M'", layers: [1, 2], side: 'L', dir: 1, piece: 1, face: 'B', sticker: 'B14' },
    { move: '2U', layers: [2], side: 'R', dir: 1, piece: 11, face: 'B', sticker: 'B4' },
    { move: "2U'", layers: [2], side: 'L', dir: -1, piece: 8, face: 'B', sticker: 'B7' },
    { move: '2D', layers: [1], side: 'L', dir: -1, piece: 4, face: 'B', sticker: 'B11' },
    { move: "2D'", layers: [1], side: 'R', dir: 1, piece: 7, face: 'B', sticker: 'B8' },
    { move: '2F', layers: [2], side: 'R', dir: 1, piece: 47, face: 'U', sticker: 'U11' },
    { move: "2F'", layers: [2], side: 'L', dir: -1, piece: 44, face: 'U', sticker: 'U8' },
    { move: '2B', layers: [1], side: 'L', dir: -1, piece: 28, face: 'U', sticker: 'U4' },
    { move: "2B'", layers: [1], side: 'R', dir: 1, piece: 31, face: 'U', sticker: 'U7' },
  ] as const)('tracks physical sticker $sticker through the driving phase of $move', async spec => {
    const cube = new Cube(4), rig = new HandsRig();
    try {
      const { x, y, z } = cube.table.groups;
      const layers = [...spec.layers];
      const { axis } = cube.table.convert(new TwistAction(spec.move))[0].group;
      if (axis !== 'x' && axis !== 'y' && axis !== 'z') throw new Error(`Unknown axis ${axis}`);
      const groups = cube.table.groups[axis];
      const finger = axis === 'x' || spec.move.startsWith('2D') ? 'ring' : 'index';
      rig.attachCube({ order: 4, table: { groups: { x, y, z } } });
      rig.setEnabled(true);
      await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
      let frame!: HandDiagnosticFrame;
      rig.subscribeDiagnostics(f => { frame = f; });
      for (let i = 0; i < 100 && rig.prepareTwist(axis, layers, spec.dir); i++) rig.tick(16);
      expect(rig.prepareTwist(axis, layers, spec.dir)).toBe(false);
      rig.tick(0);
      const model = frame.models[spec.side];
      const skin = new FingerSurfaceSampler(model);
      const identity = new THREE.Matrix4(), toPiece = new THREE.Matrix4();
      const cubeInverse = cube.matrix.clone().invert();
      const p = new THREE.Vector3();
      expect(engineHomeSid(spec.piece, FACE[spec.face], 4)).toBe(spec.sticker);
      for (const layer of layers) groups[layer].drag();
      let worstGap = 0;
      const ringJoints = axis === 'x' && layers.length === 1
        ? [model.fingers.ring.meta!, model.fingers.ring.root, model.fingers.ring.mid, model.fingers.ring.tip] : [];
      const previous = ringJoints.map(j => j.quaternion.clone());
      const ring = model.fingers.ring;
      const ringDepth = (point: THREE.Vector3, low: number, high: number) => {
        // Coordinates in the stationary or rotating strip's frame. The
        // closest cubelet in this strip bounds penetration of a skin vertex.
        const local = p.copy(point);
        for (const axis of ['x', 'y', 'z'] as const) {
          const row = THREE.MathUtils.clamp(Math.floor((local[axis] + 96) / 48), axis === 'x' ? low : 0, axis === 'x' ? high : 3);
          local[axis] -= (row - 1.5) * 48;
        }
        return cubeletDepth(local.multiplyScalar(1 / cube.scale.x)) * cube.scale.x;
      };
      const step = ringJoints.length ? .25 : 1;
      for (let degrees = step; degrees <= 90; degrees += step) {
        for (const layer of layers) groups[layer].angle = spec.dir * degrees * Math.PI / 180;
        rig.tick(16);
        for (const [i, joint] of ringJoints.entries()) {
          expect(THREE.MathUtils.radToDeg(joint.quaternion.angleTo(previous[i])), `${degrees}° joint ${i}`).toBeLessThan(10 * step);
          previous[i].copy(joint.quaternion);
        }
        expect(frame.active?.layers).toEqual(layers);
        expect(frame.active?.gesture).toMatchObject({ kind: 'flick', hand: spec.side, finger });
        cube.instancedRenderer.getCubeletRenderMatrix(spec.piece, toPiece);
        toPiece.invert().multiply(cubeInverse);
        let gap = Infinity;
        const samples = [...skin.samplePoints(finger), ...nailPoints(model, finger, identity)];
        if (ringJoints.length) {
          const ringFaces = fingerFaces(skin, model, 'ring');
          const obstacle = new FingerObstacle(ringFaces);
          for (const neighbor of ['middle', 'pinky'] as const) {
            expect(obstacle.intersections(fingerFaces(skin, model, neighbor)), `${degrees}° ring/${neighbor}`).toBe(0);
          }
          const layer = layers[0], rotated = new THREE.Vector3(), xAxis = new THREE.Vector3(1, 0, 0);
          let depth = -Infinity;
          for (const { point } of samples) {
            rotated.copy(point).applyAxisAngle(xAxis, groups[layer].angle);
            depth = Math.max(depth, ringDepth(rotated, layer, layer), ringDepth(point, 0, layer - 1), ringDepth(point, layer + 1, 3));
          }
          expect(depth, `${degrees}° ring skin and nail`).toBeLessThan(.1);
          checkFlexionLimits(ring);
        }
        for (const sample of samples) {
          if (!sample.pad) continue;
          p.copy(sample.point).applyMatrix4(toPiece);
          const [normal, tangent] = spec.face === 'B' ? [p.z, p.y] : [p.y, p.z];
          gap = Math.min(gap, Math.hypot(normal - (spec.face === 'U' ? 32 : -32), Math.max(0, Math.abs(p.x) - 28),
            Math.max(0, Math.abs(tangent) - 28)) * cube.scale.x);
        }
        // The front/back index press releases after 45° and coasts to 90°.
        if (axis !== 'z' || degrees <= 45) worstGap = Math.max(worstGap, gap);
      }
      expect(worstGap).toBeLessThan(2.5);
      for (const layer of layers) groups[layer].drop();
      const next = spec.side === 'R' ? 1 : 2;
      x[next].drag();
      x[next].angle = .7;
      rig.tick(16);
      expect(frame.active?.layers).toEqual([next]);
      expect(frame.active?.gesture).toMatchObject({ kind: 'flick', hand: next === 1 ? 'L' : 'R' });
      x[next].angle = 0;
      x[next].drop();
      rig.tick(16);
      expect(frame.active).toBeNull();
    } finally { rig.dispose(); cube.dispose(); }
  });

  // Piece numbers are fixed cubelet identities in the solved cube. Sampling
  // their render matrices also exercises the engine's signed layer motion.
  it.each([
    { move: '3Bw', firstPiece: 12, anchors: [51, 63] },
    { move: "3Bw'", firstPiece: 15, anchors: [48, 60] },
    { move: '3Uw', firstPiece: 15, anchors: [48, 0] },
    { move: "3Uw'", firstPiece: 12, anchors: [51, 3] },
    { move: '2R2', firstPiece: 2, secondPiece: 14 },
    { move: "2L2'", firstPiece: 1, secondPiece: 13 },
    { move: "2R2'", firstPiece: 50, secondPiece: 62 },
    { move: '2L2', firstPiece: 49, secondPiece: 61 },
    { move: 'M2', firstPiece: 49, secondPiece: 61 },
    { move: "M2'", firstPiece: 1, secondPiece: 13 },
    { move: '2D2', firstPiece: 4, secondPiece: 7 },
    { move: "2D2'", firstPiece: 7, secondPiece: 4 },
    { move: '2U2', firstPiece: 11, secondPiece: 8 },
    { move: 'E2', firstPiece: 8, secondPiece: 11 },
    { move: "E2'", firstPiece: 11, secondPiece: 8 },
    { move: "2U2'", firstPiece: 8, secondPiece: 11 },
    { move: '2U2', firstPiece: 11, secondPiece: 8, mark: { finger: 'middle' as const } },
    { move: "2U2'", firstPiece: 8, secondPiece: 11, mark: { finger: 'middle' as const } },
    { move: "2R2'", firstPiece: 50, secondPiece: 62, mark: { contact: 'nail' as const } },
    { move: '2L2', firstPiece: 49, secondPiece: 61, mark: { contact: 'nail' as const } },
  ])('maintains the driving contacts and handoff through $move ($mark)', async spec => {
    const cube = new Cube(4), rig = new HandsRig();
    try {
      const turns = cube.table.convert(new TwistAction(spec.move));
      const axis = turns[0].group.axis as Axis;
      const layers = turns.map(t => t.group.layer), dir = turns[0].twist < 0 ? -1 : 1;
      const lower = axis === 'y' && layers.length === 1 && layers[0] === 1;
      const ringRelay = axis === 'x' || lower;
      const first = ringRelay ? 'ring' : 'index', second = ringRelay ? 'pinky' : 'middle';
      const nailRelay = axis === 'x' && dir < 0;
      const firstNormal = nailRelay ? 'y' : 'z';
      const secondNormal = axis === 'x' ? (nailRelay ? 'z' : 'y') : 'x';
      const quarters = Math.abs(turns[0].twist);
      const rightHand = axis === 'x' ? layers[0] === 2 : dir === 1;
      const side = rightHand ? 'R' : 'L', opposite = rightHand ? 'L' : 'R';
      const { x, y, z } = cube.table.groups;
      rig.attachCube({ order: 4, table: { groups: { x, y, z } } });
      rig.setEnabled(true);
      await vi.waitFor(() => expect(rig.getLoadState().hands).toBe('ready'));
      let frame!: HandDiagnosticFrame;
      rig.subscribeDiagnostics(f => { frame = f; });
      rig.tick(0);
      const model = frame.models[side], driver = new FingerSurfaceSampler(model);
      const support = new FingerSurfaceSampler(frame.models[opposite]);
      const toPiece = new THREE.Matrix4(), toCube = cube.matrix.clone().invert();
      const tangents = { x: ['y', 'z'], y: ['x', 'z'], z: ['x', 'y'] } as const;
      const stickerGap = (sampler: FingerSurfaceSampler, finger: keyof typeof model.fingers, piece: number,
        normal: 'x' | 'y' | 'z', sign: number) => {
        cube.instancedRenderer.getCubeletRenderMatrix(piece, toPiece);
        toPiece.invert().multiply(toCube);
        const [u, v] = tangents[normal];
        let gap = Infinity;
        const samples = nailRelay && sampler === driver ? nailPoints(model, finger, new THREE.Matrix4(), true) : sampler.samplePoints(finger);
        for (const { point, pad } of samples) {
          if (!pad) continue;
          point.applyMatrix4(toPiece);
          gap = Math.min(gap, Math.hypot(point[normal] - sign * 32,
            Math.max(0, Math.abs(point[u]) - 28), Math.max(0, Math.abs(point[v]) - 28)) * cube.scale.x);
        }
        return gap;
      };
      const checkClearance = (phase: string, checkNeighbor = false) => {
        const firstFaces = fingerFaces(driver, model, first);
        const fingerPoints = new Set(firstFaces.flatMap(({ triangle: t }) => [t.a, t.b, t.c]));
        const secondFaces = fingerFaces(driver, model, second);
        for (const { triangle: t } of secondFaces) { fingerPoints.add(t.a); fingerPoints.add(t.b); fingerPoints.add(t.c); }
        expect(new FingerObstacle(firstFaces).intersections(secondFaces), `finger crossing at ${phase}`).toBe(0);
        if (checkNeighbor) {
          const neighbors = nailRelay || lower ? ['middle', 'index', 'thumb'] as const : [axis === 'x' ? 'middle' : 'ring'] as const;
          const moving = new FingerObstacle(nailRelay || lower ? [...firstFaces, ...secondFaces] : axis === 'x' ? firstFaces : secondFaces);
          for (const neighbor of neighbors)
            expect(moving.intersections(fingerFaces(driver, model, neighbor)), `${neighbor} crossing at ${phase}`).toBe(0);
        }
        const point = new THREE.Vector3();
        let depth = 0;
        for (const id of cube.initials.keys()) {
          cube.instancedRenderer.getCubeletRenderMatrix(id, toPiece);
          toPiece.invert().multiply(toCube);
          for (const vertex of fingerPoints)
            depth = Math.max(depth, cubeletDepth(point.copy(vertex).applyMatrix4(toPiece)) * cube.scale.x);
        }
        expect(depth, `driving skin or nail inside cubelet at ${phase}`).toBeLessThanOrEqual(.1);
      };
      if (!spec.mark && axis === 'y' && layers.length === 1 && !lower && spec.secondPiece !== undefined) {
        // An actual pointer drag has no target angle or queued half-turn hint.
        // Start from rest, cross the handoff, then drag back across it.
        for (let i = 0; i < 45; i++) rig.tick(16);
        const group = turns[0].group;
        group.drag();
        for (const deg of [8, 15, 24, 35, 45, 55, 65, 70, 75, 80, 85, 90, 100, 120, 95, 85]) {
          group.angle = dir * THREE.MathUtils.degToRad(deg);
          rig.tick(16);
          expect(frame.active?.gesture).toMatchObject({ hand: side, finger: 'index', finger2: 'middle' });
          if (deg >= 85) {
            const gap = deg > 90 ? stickerGap(driver, 'middle', spec.secondPiece, 'x', -dir)
              : stickerGap(driver, 'index', spec.firstPiece, 'z', -1);
            expect(gap, `pointer drag at ${deg}°`).toBeLessThan(2.5);
          }
        }
        group.angle = dir * Math.PI / 2;
        rig.tick(16);
        group.drop();
        for (let i = 0; i < 40; i++) {
          rig.tick(8);
          checkClearance(`pointer release +${(i + 1) * 8} ms`);
        }
        cube.reset();
      }
      for (let i = 0; i < 24; i++) rig.tick(16);
      const prepare = () => rig.prepareTwist(axis, layers, dir, quarters, false, undefined, false, spec.mark);
      for (let i = 0; i < 120 && prepare(); i++) rig.tick(16);
      expect(prepare()).toBe(false);
      rig.tick(0);
      for (const { group } of turns) group.drag();
      const degrees = Array.from({ length: 360 * quarters + 1 }, (_, i) => i / 4);
      if (quarters === 2) degrees.push(150, 105, 95, 91, 90, 89, 85, 75, 100, 145, 180);
      const joints = ([first, second] as const).flatMap(name => {
        const f = model.fingers[name];
        return [f.meta!, f.root, f.mid, f.tip];
      });
      const previous = joints.map(j => j.quaternion.clone());
      let last = -1;
      for (const deg of degrees) {
        for (const { group } of turns) group.angle = dir * THREE.MathUtils.degToRad(deg || .02);
        rig.tick(16);
        expect(frame.active?.gesture).toMatchObject({ kind: 'flick', hand: side, finger: first,
          ...(spec.secondPiece !== undefined && { finger2: second }) });
        if (ringRelay) {
          checkFlexionLimits(model.fingers.ring);
          checkFlexionLimits(model.fingers.pinky);
        }
        if (quarters === 2 && deg - last === .25 && (ringRelay || deg >= 80 && deg <= 110)) {
          const limit = axis === 'x' ? 6 : 10;
          for (const [i, joint] of joints.entries()) {
            const speed = THREE.MathUtils.radToDeg(joint.quaternion.angleTo(previous[i])) / .25;
            expect(speed, `${spec.move} joint ${i} at ${deg}°`).toBeLessThan(limit);
          }
        }
        joints.forEach((joint, i) => previous[i].copy(joint.quaternion));
        last = deg;
        if (deg <= (axis === 'z' ? 70 : 90))
          expect(stickerGap(driver, first, spec.firstPiece, firstNormal, -1), `${first} at ${deg}°`).toBeLessThan(2.5);
        if (spec.secondPiece !== undefined && deg >= 90)
          expect(stickerGap(driver, second, spec.secondPiece, secondNormal, axis === 'x' ? 1 : -dir), `${second} at ${deg}°`).toBeLessThan(2.5);
        checkClearance(`${deg}°`, spec.secondPiece !== undefined);
        if (spec.anchors) {
          expect(stickerGap(support, 'thumb', spec.anchors[0], 'z', 1), `fixed thumb at ${deg}°`).toBeLessThan(2.5);
          const back = axis === 'z';
          expect(stickerGap(support, back ? 'index' : 'middle', spec.anchors[1], back ? 'y' : 'z', back ? 1 : -1),
            `fixed opposing finger at ${deg}°`).toBeLessThan(2.5);
        }
      }
      for (const { group } of turns) group.drop();
      const startMs = ringRelay ? 0 : 16;
      for (let ms = startMs; ms <= 320; ms += 4) {
        rig.tick(ms === startMs ? startMs : 4);
        if (nailRelay || lower) {
          checkFlexionLimits(model.fingers.ring);
          checkFlexionLimits(model.fingers.pinky);
          joints.forEach((joint, i) => {
            const step = joint.quaternion.angleTo(previous[i]);
            if (ms === 0) expect(step, 'first release frame').toBeLessThan(1e-5);
            else expect(THREE.MathUtils.radToDeg(step), `release joint ${i} at ${ms} ms`).toBeLessThan(8);
            previous[i].copy(joint.quaternion);
          });
        }
        checkClearance(`release +${ms} ms`, ringRelay);
      }
    } finally { rig.dispose(); cube.dispose(); }
  });
});
