/**
 * rotation-perms.ts — 整体转体 (x/y/z) 的真实 54-sticker 置换 + 24 朝向 + 物理语义 token 编译。
 *
 * 三种语义辨析 (本仓库并存, 勿混):
 *   1. canonical (cube-state.apply 逐 token): 转体被丢弃 (apply("y")=恒等), r≡L。
 *      自洽但与相机观测脱节 — Phase-1 oracle 用的这套。
 *   2. conjugated (cube-state.apply 整串): 转体吸收进面映射, 终态 = 末帧朝向系下的
 *      本体状态 (functions.cpp ConvertScramble 语义)。
 *   3. physical (本模块): 转体是真实贴纸置换, 中心块会动。状态 = 相机空间系下的
 *      真实贴纸排布 — 视觉观测 (视频帧) 直接对应这套。搜索/回放一律用这套。
 *
 * 置换语义与 cube-state 一致: newState[i] = oldState[perm[i]];
 * 顺序应用 a 再 b 的合成 seqCompose(a,b)[i] = a[b[i]]。
 */
import { MOVE_ALIASES, MOVE_PERMS, tokenize, type Perm } from "./cube-state.ts";

/** 顺序应用 a 再 b 的合成置换 */
export function seqCompose(a: Perm, b: Perm): Perm {
  const out = new Array<number>(54);
  for (let i = 0; i < 54; i++) out[i] = a[b[i]];
  return out;
}

export function invertPerm(p: Perm): Perm {
  const out = new Array<number>(54);
  for (let i = 0; i < 54; i++) out[p[i]] = i;
  return out;
}

export const IDENTITY_PERM: Perm = Array.from({ length: 54 }, (_, i) => i);

/**
 * ρ_y: 整体 y 转体 (U 方向)。侧面同下标轮换 B→R→F→L→B,
 * U 面按 U 转动 in-plane, D 面按 D' in-plane。
 */
const ROT_Y: Perm = [
  6, 3, 0, 7, 4, 1, 8, 5, 2, // U in-plane (同 U 转的 U 块)
  45, 46, 47, 48, 49, 50, 51, 52, 53, // R ← B
  9, 10, 11, 12, 13, 14, 15, 16, 17, // F ← R
  29, 32, 35, 28, 31, 34, 27, 30, 33, // D in-plane (同 D' 的 D 块)
  18, 19, 20, 21, 22, 23, 24, 25, 26, // L ← F
  36, 37, 38, 39, 40, 41, 42, 43, 44, // B ← L
];

/**
 * ρ_x: 整体 x 转体 (R 方向)。F→U 同下标, D→F 同下标,
 * U→B 与 B→D 各 180° 翻转, R 面按 R in-plane, L 面按 L' in-plane。
 */
const ROT_X: Perm = [
  18, 19, 20, 21, 22, 23, 24, 25, 26, // U ← F
  15, 12, 9, 16, 13, 10, 17, 14, 11, // R in-plane (同 R 转的 R 块)
  27, 28, 29, 30, 31, 32, 33, 34, 35, // F ← D
  53, 52, 51, 50, 49, 48, 47, 46, 45, // D ← B (180°)
  38, 41, 44, 37, 40, 43, 36, 39, 42, // L in-plane (同 L' 的 L 块)
  8, 7, 6, 5, 4, 3, 2, 1, 0, // B ← U (180°)
];

/** ρ_z = x y x' (绕 F 轴) — 由已验证的 x/y 合成, 避免再手推 in-plane */
const ROT_Z: Perm = seqCompose(seqCompose(ROT_X, ROT_Y), invertPerm(ROT_X));

/** 9 个转体 token → 真实贴纸置换 */
export const ROTATION_PERMS: Record<string, Perm> = {
  x: ROT_X,
  x2: seqCompose(ROT_X, ROT_X),
  "x'": invertPerm(ROT_X),
  y: ROT_Y,
  y2: seqCompose(ROT_Y, ROT_Y),
  "y'": invertPerm(ROT_Y),
  z: ROT_Z,
  z2: seqCompose(ROT_Z, ROT_Z),
  "z'": invertPerm(ROT_Z),
};

export function permKey(p: Perm): string {
  return String.fromCharCode(...p);
}

/** 24 个整体朝向置换 (含恒等), 由 {x,y} BFS 闭包生成 */
export const ORIENTATION_PERMS: readonly Perm[] = (() => {
  const seen = new Map<string, Perm>();
  const queue: Perm[] = [IDENTITY_PERM];
  seen.set(permKey(IDENTITY_PERM), IDENTITY_PERM);
  while (queue.length) {
    const cur = queue.shift()!;
    for (const gen of [ROT_X, ROT_Y]) {
      const next = seqCompose(cur, gen);
      const key = permKey(next);
      if (!seen.has(key)) {
        seen.set(key, next);
        queue.push(next);
      }
    }
  }
  if (seen.size !== 24) throw new Error(`朝向闭包 ${seen.size} ≠ 24`);
  return [...seen.values()];
})();

/**
 * token → 真实空间置换 (physical 语义)。
 * 宽转经 MOVE_ALIASES 展开 (如 r = "x L" 顺序应用), 转体查 ROTATION_PERMS,
 * 基础转查 MOVE_PERMS。复合 token ("UD'"/"L2x'") 按 tokenize 顺序合成。
 */
export function physicalPerm(move: string): Perm {
  let acc: Perm = IDENTITY_PERM;
  const expand = (token: string): void => {
    if (token in MOVE_PERMS) {
      acc = seqCompose(acc, MOVE_PERMS[token]);
    } else if (token in ROTATION_PERMS) {
      acc = seqCompose(acc, ROTATION_PERMS[token]);
    } else if (token in MOVE_ALIASES) {
      for (const sub of MOVE_ALIASES[token].split(" ")) expand(sub);
    } else {
      throw new Error(`physicalPerm: unknown token ${token}`);
    }
  };
  for (const token of tokenize(move)) expand(token);
  return acc;
}
