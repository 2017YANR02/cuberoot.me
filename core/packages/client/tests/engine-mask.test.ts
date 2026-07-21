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
import { derivePyraEngineMap } from './_engine_mask_derive';
import { toEngineMask, engineMaskSupported, pieceOf, MASK_COLOR } from '@/lib/puzzle-image/puzzle-mask';
import { exportSimSvgSchematic } from '@/app/[lang]/sim/sim_svg_export_schematic';
import { buildPyraPiece, buildCore, EDGE_PAIRS, VDIR, PYRA_A } from '@/app/[lang]/sim/engine/pyra/pyraGeometry';

const fixture = JSON.parse(
  readFileSync('lib/puzzle-image/data/engine-sid-map.json', 'utf8'),
) as Record<string, Record<string, string>>;

describe('engine sid map — pyraminx', () => {
  it('re-derives byte-for-byte from engine geometry + canonical perms (shipped-table lock)', () => {
    const r = derivePyraEngineMap();
    expect(r.map).toEqual(fixture.pyraminx);
    // 配色锚点:canonical 面 → 引擎面 m(FACE_COLOR:D=m0 黄 / R=m1 红 / L=m2 蓝 / F=m3 绿)
    expect(r.faceMap).toEqual({ D: 'm0', R: 'm1', L: 'm2', F: 'm3' });
  });

  it('is a bijection onto the 36 engine sticker keys', () => {
    const vals = Object.values(fixture.pyraminx);
    expect(vals.length).toBe(36);
    expect(new Set(vals).size).toBe(36);
  });

  it('respects canonical piece structure: one canonical piece → one engine piece', () => {
    // 逐 canonical 块检查:块内所有 sid 映到同一个引擎 piece 前缀(key 冒号前段)
    const seen = new Set<string>();
    for (const sid of Object.keys(fixture.pyraminx)) {
      const piece = pieceOf('pyraminx', sid);
      const enginePieces = new Set(piece.map((s) => fixture.pyraminx[s].split(':')[0]));
      expect(enginePieces.size, `piece of ${sid}`).toBe(1);
      seen.add([...enginePieces][0]);
    }
    expect(seen.size).toBe(14); // 4 tip + 4 corner + 6 edge
  });

  it('toEngineMask / engineMaskSupported gates', () => {
    expect(engineMaskSupported('pyraminx')).toBe(true);
    expect(engineMaskSupported('cube')).toBe(false);
    expect(engineMaskSupported('sq1')).toBe(false);
    expect(toEngineMask('cube', ['U0'])).toBeUndefined();
    expect(toEngineMask('pyraminx', ['F5', 'D2'])).toEqual(new Set(['edge1-2:3', 'edge1-2:0']));
    expect(toEngineMask('pyraminx', ['ZZZ99'])).toEqual(new Set()); // 不在拼图上:静默跳过
  });

  it('end-to-end: masked piece renders gray in the schematic export, on the right faces', () => {
    const scene = new THREE.Scene();
    scene.add(buildCore());
    for (let k = 0; k < 4; k++) {
      scene.add(buildPyraPiece('tip', k).pivot);
      scene.add(buildPyraPiece('corner', k).pivot);
    }
    for (const [a, b] of EDGE_PAIRS) scene.add(buildPyraPiece('edge', a, b).pivot);

    const faceOn = (m: number) => {
      // 面 m 外法向 = −V_m;face-on 只有该面可见(其余面背剔)
      const n = new THREE.Vector3(...VDIR[m]).negate().normalize();
      const camera = new THREE.PerspectiveCamera(50, 1, 1, 10000);
      camera.position.copy(n).multiplyScalar(PYRA_A * 4);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      return { scene, camera, width: 400, height: 400 };
    };
    const keys = toEngineMask('pyraminx', pieceOf('pyraminx', 'F5'))!; // D2/F5 棱块
    const grayCount = (svg: string) =>
      (svg.match(new RegExp(`fill="${MASK_COLOR}"/>`, 'g')) ?? []).length;

    // F 面(m3)face-on:9 小面可见,恰 1 灰(F5);D 面(m0)同理恰 1 灰(D2)
    const mask = { keys, color: MASK_COLOR };
    expect(grayCount(exportSimSvgSchematic({ world: faceOn(3), mask }))).toBe(1);
    expect(grayCount(exportSimSvgSchematic({ world: faceOn(0), mask }))).toBe(1);
    // L 面(m2)该棱不占:0 灰;无 mask:0 灰
    expect(grayCount(exportSimSvgSchematic({ world: faceOn(2), mask }))).toBe(0);
    expect(grayCount(exportSimSvgSchematic({ world: faceOn(3) }))).toBe(0);
  });
});
