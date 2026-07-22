/**
 * mask 直映(canonical sid → 引擎贴纸 key)锁表 + 端到端灰化。
 *
 * 表 lib/puzzle-image/data/engine-sid-map.json 是派生物,禁手改:本文件每次跑测
 * 用 _engine_mask_derive.ts 从引擎几何 + canonical 状态机重推,逐字节比对 ——
 * 引擎几何 / key 命名 / 状态机任何一边变了,测试炸掉而不是遮罩悄悄错位。
 */
import './_raf_stub';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { derivePyraEngineMap, deriveSkewbEngineMap, deriveMegaEngineMap } from './_engine_mask_derive';
import { toEngineMask, engineMaskSupported, pieceOf, MASK_COLOR } from '@/lib/puzzle-image/puzzle-mask';
import { exportSimSvgSchematic } from '@/app/[lang]/sim/sim_svg_export_schematic';
import { buildPyraPiece, buildCore as buildPyraCore, EDGE_PAIRS, VDIR, PYRA_A } from '@/app/[lang]/sim/engine/pyra/pyraGeometry';
import {
  buildCornerMesh, buildCenterMesh, buildCore as buildSkewbCore, H as SKEWB_H,
} from '@/app/[lang]/sim/engine/skewb/skewbGeometry';
import {
  buildCornerPiece, buildEdgePiece, buildCenterPiece, R_IN as MEGA_R,
} from '@/app/[lang]/sim/engine/mega/megaGeometry';
import { FACE_NORMAL as MEGA_FACE_NORMAL } from '@/app/[lang]/sim/engine/mega/megaState';

const fixture = JSON.parse(
  readFileSync('lib/puzzle-image/data/engine-sid-map.json', 'utf8'),
) as Record<string, Record<string, string>>;

function worldFor(scene: THREE.Scene, dir: THREE.Vector3, dist: number) {
  const camera = new THREE.PerspectiveCamera(50, 1, 1, 10000);
  const n = dir.clone().normalize();
  if (Math.abs(n.y) > 0.99) camera.up.set(1, 0, 0);
  camera.position.copy(n).multiplyScalar(dist);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  return { scene, camera, width: 400, height: 400 };
}

const grayCount = (svg: string): number =>
  (svg.match(new RegExp(`fill="${MASK_COLOR}"/>`, 'g')) ?? []).length;

/** 块结构守恒:每个 canonical 块的所有 sid 映到同一个引擎 piece(key 冒号前段)。 */
function assertPieceStructure(puzzle: 'pyraminx' | 'skewb' | 'megaminx', table: Record<string, string>, pieceCount: number): void {
  const seen = new Set<string>();
  for (const sid of Object.keys(table)) {
    const piece = pieceOf(puzzle, sid);
    const enginePieces = new Set(piece.map((s) => table[s].split(':')[0]));
    expect(enginePieces.size, `piece of ${puzzle} ${sid}`).toBe(1);
    seen.add([...enginePieces][0]);
  }
  expect(seen.size).toBe(pieceCount);
}

describe('engine sid map — pyraminx', () => {
  it('re-derives byte-for-byte from engine geometry + canonical perms (shipped-table lock)', () => {
    const r = derivePyraEngineMap();
    expect(r.map).toEqual(fixture.pyraminx);
    // 配色锚点:canonical 面 → 引擎面 m(FACE_COLOR:D=m0 黄 / R=m1 红 / L=m2 蓝 / F=m3 绿)
    expect(r.faceMap).toEqual({ D: 'm0', R: 'm1', L: 'm2', F: 'm3' });
  });

  it('bijection + piece structure (14 pieces)', () => {
    const vals = Object.values(fixture.pyraminx);
    expect(vals.length).toBe(36);
    expect(new Set(vals).size).toBe(36);
    assertPieceStructure('pyraminx', fixture.pyraminx, 14);
  });

  it('end-to-end: masked piece renders gray in the schematic export, on the right faces', () => {
    const scene = new THREE.Scene();
    scene.add(buildPyraCore());
    for (let k = 0; k < 4; k++) {
      scene.add(buildPyraPiece('tip', k).pivot);
      scene.add(buildPyraPiece('corner', k).pivot);
    }
    for (const [a, b] of EDGE_PAIRS) scene.add(buildPyraPiece('edge', a, b).pivot);
    // 面 m 外法向 = −V_m;face-on 只有该面可见(其余面背剔)
    const faceOn = (m: number) => worldFor(scene, new THREE.Vector3(...VDIR[m]).negate(), PYRA_A * 4);
    const keys = toEngineMask('pyraminx', pieceOf('pyraminx', 'F5'))!; // D2/F5 棱块
    const mask = { keys, color: MASK_COLOR };
    // F 面(m3)face-on:9 小面可见,恰 1 灰(F5);D 面(m0)同理恰 1 灰(D2)
    expect(grayCount(exportSimSvgSchematic({ world: faceOn(3), mask }))).toBe(1);
    expect(grayCount(exportSimSvgSchematic({ world: faceOn(0), mask }))).toBe(1);
    // L 面(m2)该棱不占:0 灰;无 mask:0 灰
    expect(grayCount(exportSimSvgSchematic({ world: faceOn(2), mask }))).toBe(0);
    expect(grayCount(exportSimSvgSchematic({ world: faceOn(3) }))).toBe(0);
  });
});

describe('engine sid map — skewb', () => {
  it('re-derives byte-for-byte; face map is the identity (both sides WCA letters)', () => {
    const r = deriveSkewbEngineMap();
    expect(r.map).toEqual(fixture.skewb);
    expect(r.faceMap).toEqual({ U: 'U', D: 'D', F: 'F', B: 'B', R: 'R', L: 'L' });
  });

  it('bijection + piece structure (14 pieces)', () => {
    const vals = Object.values(fixture.skewb);
    expect(vals.length).toBe(30);
    expect(new Set(vals).size).toBe(30);
    assertPieceStructure('skewb', fixture.skewb, 14);
  });

  it('end-to-end: masked corner shows exactly its U facelet gray, U face-on', () => {
    const scene = new THREE.Scene();
    scene.add(buildSkewbCore());
    for (let i = 0; i < 8; i++) scene.add(buildCornerMesh(i).pivot);
    for (let i = 0; i < 6; i++) scene.add(buildCenterMesh(i).pivot);
    const keys = toEngineMask('skewb', pieceOf('skewb', 'U3'))!; // F1/L2/U3 角块
    const world = worldFor(scene, new THREE.Vector3(0, 1, 0), SKEWB_H * 4);
    expect(grayCount(exportSimSvgSchematic({ world, mask: { keys, color: MASK_COLOR } }))).toBe(1);
    // 中心块(单贴纸)在 U face-on 也恰 1 灰
    const center = toEngineMask('skewb', pieceOf('skewb', 'U0'))!;
    expect(grayCount(exportSimSvgSchematic({ world, mask: { keys: center, color: MASK_COLOR } }))).toBe(1);
  });
});

describe('engine sid map — megaminx', () => {
  it('re-derives byte-for-byte; bottom-ring faces land on the correct PG names', () => {
    const r = deriveMegaEngineMap();
    expect(r.map).toEqual(fixture.megaminx);
    // 顶环同名;底环 tnoodle → PG:方位角逐面吻合(DR=54°→C,DL=126°→A,
    // DBL=198°→I,B=270°→BF,DBR=342°→E)。镜像会把这串反过来。
    expect(r.faceMap).toEqual({
      U: 'U', F: 'F', L: 'L', BL: 'BL', BR: 'BR', R: 'R',
      D: 'D', DR: 'C', DL: 'A', DBL: 'I', B: 'BF', DBR: 'E',
    });
  });

  it('bijection + piece structure (62 pieces)', () => {
    const vals = Object.values(fixture.megaminx);
    expect(vals.length).toBe(132);
    expect(new Set(vals).size).toBe(132);
    assertPieceStructure('megaminx', fixture.megaminx, 62);
  });

  it('end-to-end: masked U corner grays 3 facelets in the U face-on export', () => {
    const scene = new THREE.Scene();
    for (let f = 0; f < 12; f++) scene.add(buildCenterPiece(f).pivot);
    for (let i = 0; i < 20; i++) scene.add(buildCornerPiece(i).pivot);
    for (let i = 0; i < 30; i++) scene.add(buildEdgePiece(i).pivot);
    const [nx, ny, nz] = MEGA_FACE_NORMAL[0];
    const world = worldFor(scene, new THREE.Vector3(nx, ny, nz), MEGA_R * 4);
    const corner = pieceOf('megaminx', 'U0');
    expect(corner.length).toBe(3);
    const keys = toEngineMask('megaminx', corner)!;
    // U face-on 可见 66 小面(U + 5 邻面),角块 3 贴纸全部可见 → 恰 3 灰
    expect(grayCount(exportSimSvgSchematic({ world, mask: { keys, color: MASK_COLOR } }))).toBe(3);
  });
});

describe('toEngineMask / engineMaskSupported gates', () => {
  it('gates', () => {
    expect(engineMaskSupported('pyraminx')).toBe(true);
    expect(engineMaskSupported('skewb')).toBe(true);
    expect(engineMaskSupported('megaminx')).toBe(true);
    expect(engineMaskSupported('cube')).toBe(true);   // NxN 恒等映射(instanceKeys = canonical sid)
    expect(engineMaskSupported('sq1')).toBe(true);    // sq1 恒等映射(stickerKey = canonical sid)
    // cube:恒等透传(引擎实例 key 即 canonical sid);无派生表。
    expect(toEngineMask('cube', ['U0', 'F3'])).toEqual(new Set(['U0', 'F3']));
    expect(toEngineMask('pyraminx', ['F5', 'D2'])).toEqual(new Set(['edge1-2:3', 'edge1-2:0']));
    expect(toEngineMask('pyraminx', ['ZZZ99'])).toEqual(new Set()); // 不在拼图上:静默跳过
  });
});
