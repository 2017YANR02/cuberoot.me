import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import { TwistAction } from '@cuberoot/puzzle-render-core/engine/nxn/twister';
import HandsRig, { gestureForLayers, type HandDiagnosticFrame } from '@/app/[lang]/sim/engine/hands/handsRig';
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

function fingerFaces(skin: FingerSurfaceSampler, model: HandDiagnosticFrame['models']['R'], finger: 'index' | 'middle') {
  const faces: SkinTriangle[] = skin.sample(finger);
  const nail = model.nailMeshes!.find(mesh => mesh.userData.nail.finger === finger)!;
  const points = nailPoints(model, finger, new THREE.Matrix4()), indices = nail.geometry.index!;
  for (let i = 0; i < indices.count; i += 3) {
    const a = points[indices.getX(i)].point, b = points[indices.getX(i + 1)].point, c = points[indices.getX(i + 2)].point;
    faces.push({ triangle: new THREE.Triangle(a, b, c), box: new THREE.Box3().setFromPoints([a, b, c]) });
  }
  return faces;
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
      for (let degrees = 1; degrees <= 90; degrees++) {
        for (const layer of layers) groups[layer].angle = spec.dir * degrees * Math.PI / 180;
        rig.tick(16);
        expect(frame.active?.layers).toEqual(layers);
        expect(frame.active?.gesture).toMatchObject({ kind: 'flick', hand: spec.side, finger });
        cube.instancedRenderer.getCubeletRenderMatrix(spec.piece, toPiece);
        toPiece.invert().multiply(cubeInverse);
        let gap = Infinity;
        const samples = [...skin.samplePoints(finger), ...nailPoints(model, finger, identity)];
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
    { move: '3Bw', index: 12, anchors: [51, 63] },
    { move: "3Bw'", index: 15, anchors: [48, 60] },
    { move: '3Uw', index: 15, anchors: [48, 0] },
    { move: "3Uw'", index: 12, anchors: [51, 3] },
    { move: '2U2', index: 11, middle: 8 },
    { move: "2U2'", index: 8, middle: 11 },
  ])('maintains the driving contacts and handoff through $move', async spec => {
    const cube = new Cube(4), rig = new HandsRig();
    try {
      const turns = cube.table.convert(new TwistAction(spec.move));
      const axis = turns[0].group.axis;
      if (axis !== 'y' && axis !== 'z') throw new Error(spec.move);
      const layers = turns.map(t => t.group.layer), dir = turns[0].twist < 0 ? -1 : 1;
      const quarters = Math.abs(turns[0].twist);
      const side = dir === 1 ? 'R' : 'L', opposite = side === 'R' ? 'L' : 'R';
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
      const stickerGap = (sampler: FingerSurfaceSampler, finger: 'index' | 'middle' | 'thumb', piece: number,
        normal: 'x' | 'y' | 'z', sign: number) => {
        cube.instancedRenderer.getCubeletRenderMatrix(piece, toPiece);
        toPiece.invert().multiply(toCube);
        const [u, v] = tangents[normal];
        let gap = Infinity;
        for (const { point, pad } of sampler.samplePoints(finger)) {
          if (!pad) continue;
          point.applyMatrix4(toPiece);
          gap = Math.min(gap, Math.hypot(point[normal] - sign * 32,
            Math.max(0, Math.abs(point[u]) - 28), Math.max(0, Math.abs(point[v]) - 28)) * cube.scale.x);
        }
        return gap;
      };
      const checkClearance = (phase: string) => {
        const indexFaces = fingerFaces(driver, model, 'index');
        const fingerPoints = new Set(indexFaces.flatMap(({ triangle: t }) => [t.a, t.b, t.c]));
        const middleFaces = fingerFaces(driver, model, 'middle');
        for (const { triangle: t } of middleFaces) { fingerPoints.add(t.a); fingerPoints.add(t.b); fingerPoints.add(t.c); }
        expect(new FingerObstacle(indexFaces).intersections(middleFaces), `finger crossing at ${phase}`).toBe(0);
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
      if (spec.middle !== undefined) {
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
            const gap = deg > 90 ? stickerGap(driver, 'middle', spec.middle, 'x', -dir)
              : stickerGap(driver, 'index', spec.index, 'z', -1);
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
      for (let i = 0; i < 120 && rig.prepareTwist(axis, layers, dir, quarters); i++) rig.tick(16);
      expect(rig.prepareTwist(axis, layers, dir, quarters)).toBe(false);
      rig.tick(0);
      for (const { group } of turns) group.drag();
      const degrees = Array.from({ length: 360 * quarters + 1 }, (_, i) => i / 4);
      if (quarters === 2) degrees.push(150, 105, 95, 91, 90, 89, 85, 75, 100, 145, 180);
      for (const deg of degrees) {
        for (const { group } of turns) group.angle = dir * THREE.MathUtils.degToRad(deg || .02);
        rig.tick(16);
        expect(frame.active?.gesture).toMatchObject({ kind: 'flick', hand: side, finger: 'index',
          ...(spec.middle !== undefined && { finger2: 'middle' }) });
        if (deg <= (axis === 'z' ? 70 : 90))
          expect(stickerGap(driver, 'index', spec.index, 'z', -1), `index at ${deg}°`).toBeLessThan(2.5);
        if (spec.middle !== undefined && deg >= 90)
          expect(stickerGap(driver, 'middle', spec.middle, 'x', -dir), `middle at ${deg}°`).toBeLessThan(2.5);
        checkClearance(`${deg}°`);
        if (spec.anchors) {
          expect(stickerGap(support, 'thumb', spec.anchors[0], 'z', 1), `fixed thumb at ${deg}°`).toBeLessThan(2.5);
          const back = axis === 'z';
          expect(stickerGap(support, back ? 'index' : 'middle', spec.anchors[1], back ? 'y' : 'z', back ? 1 : -1),
            `fixed opposing finger at ${deg}°`).toBeLessThan(2.5);
        }
      }
      for (const { group } of turns) group.drop();
      for (let ms = 16; ms <= 320; ms += 4) {
        rig.tick(ms === 16 ? 16 : 4);
        checkClearance(`release +${ms} ms`);
      }
    } finally { rig.dispose(); cube.dispose(); }
  });
});
