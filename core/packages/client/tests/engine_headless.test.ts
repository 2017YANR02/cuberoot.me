// 引擎 headless 冒烟(PLAN-sr-retirement Phase 1 验收判据)。
//
// vitest environment 是纯 'node'(无 DOM / rAF / WebGL)—— 本文件 import 引擎并建
// world,就是「Node 裸脚本能建出 skewb world 并数出三角形」的验收本身,同时把
// 4 个 headless gate(tweener 模块级 rAF 单例、twister 的 window.__STACK_KERNEL_*、
// Controller 指针环、FaceHints 的 DOM canvas 纹理)锁进 CI:谁把浏览器 API 加回
// import 路径或构造路径,这里当场炸。
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import World from '@/app/[lang]/sim/engine/world';
import type Cube from '@/app/[lang]/sim/engine/nxn/cube';
import SquareFamilyCube from '@/app/[lang]/sim/engine/squareFamily/SquareFamilyCube';
import { squareFamilyDragCommit } from '@/app/[lang]/sim/engine/squareFamily/squareFamilyDrag';
import { squareTwistSlice } from '@/app/[lang]/sim/engine/squareDragRouter';
import tweener from '@/app/[lang]/sim/engine/tweener';

/** 场景里所有可见 mesh 的三角形总数(indexed 优先;InstancedMesh 按实例数乘)。 */
function countTriangles(scene: THREE.Scene): number {
  let tris = 0;
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry as THREE.BufferGeometry | undefined;
    if (!g) return;
    const per = g.index ? g.index.count / 3 : (g.getAttribute('position')?.count ?? 0) / 3;
    const inst = (m as unknown as THREE.InstancedMesh).isInstancedMesh
      ? (m as unknown as THREE.InstancedMesh).count : 1;
    tris += per * inst;
  });
  return tris;
}

function commitSquareFamilyTopDrag(cube: SquareFamilyCube): THREE.Object3D[] {
  const starts = cube.pieces
    .filter((piece) => cube.currentProbe(piece).y > 0)
    .map((piece) => ({
      pivot: piece.pivot,
      quat: piece.pivot.quaternion.clone(),
      pos: piece.pivot.position.clone(),
    }));
  const pivots = starts.map((entry) => entry.pivot);
  const move = squareFamilyDragCommit(cube, {
    kind: 'turn',
    layer: 'top',
    startAngle: 0,
    starts,
    startEastHalf: false,
  }, cube.spec.unitRadians);
  expect(move).not.toBeNull();
  return pivots;
}

function pivotPose(pivots: readonly THREE.Object3D[]): number[][] {
  return pivots.map((pivot) => [
    ...pivot.position.toArray(),
    ...pivot.quaternion.toArray(),
  ]);
}

describe('engine headless (Node, no DOM / rAF / WebGL)', () => {
  it('new World() constructs and frames a 3x3 without any browser API', () => {
    // ctor 内部即:tweener 单例已在 import 时构造(gate①)、new Controller(gate③)、
    // 10 组 FaceHints(gate④)、setPuzzle(3) 全套 NxN 场景装配。
    const world = new World();
    expect(world.puzzleKind).toBe(3);
    expect(world.scene).toBeInstanceOf(THREE.Scene);
    // resize() 已在 setPuzzle 内跑过(相机取景),投影矩阵应有限。
    expect(Number.isFinite(world.camera.projectionMatrix.elements[0])).toBe(true);
    expect(countTriangles(world.scene)).toBeGreaterThan(0);
  });

  it('builds a skewb world and counts its triangles (Phase 1 acceptance)', () => {
    const world = new World();
    world.setPuzzle('skewb');
    expect(world.puzzleKind).toBe('skewb');
    const tris = countTriangles(world.scene);
    // skewb = 14 实体楔块 CSG,几千三角量级;>1000 足以证几何真建出来了。
    expect(tris).toBeGreaterThan(1000);
  });

  it('applies an NxN scramble headlessly via twister.setup (gate②)', () => {
    const world = new World();
    const cube = world.cube as Cube;
    const solved = cube.serialize();
    // setup() 是 headless 打乱应用主入口;WASM 未就绪时走纯 JS 路径,两条都不许碰 window。
    cube.twister.setup("R U R' U' F2");
    const scrambled = cube.serialize();
    expect(scrambled).not.toBe(solved);
    expect(scrambled.length).toBe(solved.length);
  });

  it('switches across puzzle families without leaking browser calls', () => {
    const world = new World();
    for (const kind of ['sq1', 'pyraminx', 'megaminx', 4] as const) {
      world.setPuzzle(kind);
      expect(countTriangles(world.scene)).toBeGreaterThan(0);
    }
  });

  it('switches SQ1 → SQ2 → SQ4 → 4 with finite framed geometry and reuses SQ2', () => {
    const world = new World();
    let sq2Cube: typeof world.cube | null = null;

    for (const kind of ['sq1', 'sq2', 'sq4', 4] as const) {
      world.setPuzzle(kind);
      expect(world.puzzleKind).toBe(kind);
      expect(countTriangles(world.scene)).toBeGreaterThan(0);
      expect(world.camera.projectionMatrix.elements.every(Number.isFinite)).toBe(true);
      expect(Number.isFinite(world.camera.near)).toBe(true);
      expect(Number.isFinite(world.camera.far)).toBe(true);
      expect(world.camera.near).toBeGreaterThan(0);
      expect(world.camera.far).toBeGreaterThan(world.camera.near);
      if (kind === 'sq2') sq2Cube = world.cube;
    }

    world.setPuzzle('sq2');
    expect(world.cube).toBe(sq2Cube);
    expect(countTriangles(world.scene)).toBeGreaterThan(0);
  });

  it('settles an outgoing SQ2/SQ4 tween before caching the cube off-scene', () => {
    const world = new World();
    world.setPuzzle('sq2');
    const sq2 = world.cube as SquareFamilyCube;
    sq2.twister.push('(1,0) / (2,0) /');
    expect(sq2.twister.busy).toBe(true);

    world.setPuzzle('sq4');

    expect(sq2.twister.busy).toBe(false);
    const settled = JSON.stringify(sq2.state);
    tweener.update(1_000_000);
    expect(JSON.stringify(sq2.state)).toBe(settled);
  });

  it.each(['sq2', 'sq4'] as const)(
    'settles queued %s playback before an equator-tap slash',
    (kind) => {
      tweener.finish();
      const cube = new SquareFamilyCube(kind);
      cube.twister.push('(1,0) / (2,0) /');
      expect(tweener.length).toBe(1);
      expect(cube.twister.length).toBe(3);

      expect(squareTwistSlice(cube, 1)).toBe(true);

      expect(tweener.length).toBe(1);
      expect(cube.twister.length).toBe(0);
      expect(cube.history.moves).toEqual(['(1,0)', '/', '(2,0)', '/']);
      tweener.finish();
      expect(cube.history.moves).toEqual(['(1,0)', '/', '(2,0)', '/', '/']);
      cube.dispose();
    },
  );

  it.each(['sq2', 'sq4'] as const)(
    'settles an active %s drag snap before switching puzzles',
    (kind) => {
      tweener.finish();
      const world = new World();
      world.setPuzzle(kind);
      const cube = world.cube as SquareFamilyCube;
      const pivots = commitSquareFamilyTopDrag(cube);
      expect(tweener.length).toBe(1);

      world.setPuzzle(kind === 'sq2' ? 'sq4' : 'sq2');

      expect(tweener.length).toBe(0);
      const settled = pivotPose(pivots);
      tweener.update(1_000_000);
      expect(pivotPose(pivots)).toEqual(settled);
      world.disposeSquareFamilyCubes();
    },
  );

  it.each(['sq2', 'sq4'] as const)(
    'settles an active %s drag snap before disposal',
    (kind) => {
      tweener.finish();
      const cube = new SquareFamilyCube(kind);
      const pivots = commitSquareFamilyTopDrag(cube);
      expect(tweener.length).toBe(1);

      cube.dispose();

      expect(tweener.length).toBe(0);
      const settled = pivotPose(pivots);
      tweener.update(1_000_000);
      expect(pivotPose(pivots)).toEqual(settled);
    },
  );
});
