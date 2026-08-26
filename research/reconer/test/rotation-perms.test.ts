import { describe, expect, it } from "vitest";
import { MOVE_PERMS, ROTATION_FACE_MAP, type Perm } from "../src/cube-state.ts";
import {
  IDENTITY_PERM,
  ORIENTATION_PERMS,
  ROTATION_PERMS,
  invertPerm,
  permKey,
  physicalPerm,
  seqCompose,
} from "../src/rotation-perms.ts";

// ROTATION_FACE_MAP 的面下标顺序: U=0 D=1 L=2 R=3 F=4 B=5
const FACE_ORDER = ["U", "D", "L", "R", "F", "B"] as const;
const MOVE_NAMES = Object.keys(MOVE_PERMS); // 18 个

function eq(a: Perm, b: Perm): boolean {
  return permKey(a) === permKey(b);
}

describe("转体置换 vs ROTATION_FACE_MAP 共轭恒等式", () => {
  // 物理恒等式: 先转 m 再整体转 ρ ≡ 先整体转 ρ 再转 map(m)
  // 即 seq(P_m, ρ) == seq(ρ, P_map(m)) — 逐一对照 functions.cpp 的面映射表
  it("9 转体 × 18 基础转 全部成立", () => {
    for (const [rot, faceList] of Object.entries(ROTATION_FACE_MAP)) {
      const rho = ROTATION_PERMS[rot];
      expect(rho, `缺转体置换 ${rot}`).toBeDefined();
      for (const m of MOVE_NAMES) {
        const face = m[0];
        const dir = m.slice(1);
        const mapped = FACE_ORDER[faceList[FACE_ORDER.indexOf(face as never)]] + dir;
        const lhs = seqCompose(MOVE_PERMS[m], rho);
        const rhs = seqCompose(rho, MOVE_PERMS[mapped]);
        expect(eq(lhs, rhs), `${m} ${rot} ≠ ${rot} ${mapped}`).toBe(true);
      }
    }
  });
});

describe("转体置换基本代数", () => {
  it("x/y/z 四次幂 = 恒等", () => {
    for (const r of ["x", "y", "z"]) {
      let p = ROTATION_PERMS[r];
      p = seqCompose(seqCompose(p, p), seqCompose(ROTATION_PERMS[r], ROTATION_PERMS[r]));
      expect(eq(p, IDENTITY_PERM), `${r}^4`).toBe(true);
    }
  });

  it("x2/y2/z2/逆 与生成元一致", () => {
    for (const r of ["x", "y", "z"]) {
      expect(eq(ROTATION_PERMS[`${r}2`], seqCompose(ROTATION_PERMS[r], ROTATION_PERMS[r]))).toBe(true);
      expect(eq(seqCompose(ROTATION_PERMS[r], ROTATION_PERMS[`${r}'`]), IDENTITY_PERM)).toBe(true);
    }
  });

  it("y 与 U 转可交换 (同轴)", () => {
    expect(eq(seqCompose(ROTATION_PERMS.y, MOVE_PERMS.U), seqCompose(MOVE_PERMS.U, ROTATION_PERMS.y))).toBe(true);
  });

  it("朝向闭包恰 24 个且互异", () => {
    expect(ORIENTATION_PERMS.length).toBe(24);
    expect(new Set(ORIENTATION_PERMS.map(permKey)).size).toBe(24);
  });

  it("每个朝向把整面映到整面 (中心随块)", () => {
    for (const o of ORIENTATION_PERMS) {
      for (let f = 0; f < 6; f++) {
        const targetFace = Math.floor(o[f * 9 + 4] / 9);
        for (let i = 0; i < 9; i++) {
          expect(Math.floor(o[f * 9 + i] / 9)).toBe(targetFace);
        }
      }
    }
  });
});

describe("physicalPerm", () => {
  it("转体不再是恒等 (区别于 canonical 语义)", () => {
    expect(eq(physicalPerm("y"), IDENTITY_PERM)).toBe(false);
    expect(eq(physicalPerm("y"), ROTATION_PERMS.y)).toBe(true);
  });

  it("宽转 = 转体∘基础转 (r = x L, u = y D)", () => {
    expect(eq(physicalPerm("r"), seqCompose(ROTATION_PERMS.x, MOVE_PERMS.L))).toBe(true);
    expect(eq(physicalPerm("u"), seqCompose(ROTATION_PERMS.y, MOVE_PERMS.D))).toBe(true);
    // 物理上 r ≠ L (canonical 语义里两者相等)
    expect(eq(physicalPerm("r"), MOVE_PERMS.L)).toBe(false);
  });

  it("复合 token 顺序合成: UD' / L2'x'", () => {
    expect(eq(physicalPerm("UD'"), seqCompose(MOVE_PERMS.U, MOVE_PERMS["D'"]))).toBe(true);
    expect(eq(physicalPerm("L2'x'"), seqCompose(MOVE_PERMS.L2, ROTATION_PERMS["x'"]))).toBe(true);
  });

  it("正逆相消: 任意 token 串", () => {
    for (const m of ["r", "u'", "d'", "f", "UD'", "L2'x'", "y", "M", "E'", "S2"]) {
      expect(eq(seqCompose(physicalPerm(m), invertPerm(physicalPerm(m))), IDENTITY_PERM), m).toBe(true);
    }
  });

  it("经典 slice 恒等式: M = x' L' R 物理成立 (即 r ≡ R M' 的对偶)", () => {
    // M 别名展开为 "x' L' R"; 独立验证: R' 应用后 M 与 x' L' 等价
    const lhs = physicalPerm("M");
    const rhs = seqCompose(seqCompose(ROTATION_PERMS["x'"], MOVE_PERMS["L'"]), MOVE_PERMS.R);
    expect(eq(lhs, rhs)).toBe(true);
  });
});
