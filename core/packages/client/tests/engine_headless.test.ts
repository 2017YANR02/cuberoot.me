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
});
