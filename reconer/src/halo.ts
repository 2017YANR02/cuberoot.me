/**
 * halo.ts — cubie 签名 → 窗口渗色映射 (从 scripts/last2-decode.ts 提取共享)。
 *
 * 斜视角下窗口边缘格常采到邻面贴纸 (负⑩(a) 的"错位读真色"), 这是方向判别的
 * 真信号而非噪声: 按 cubie 签名 (6 个外层 90° 转动的被动集, 同签名 = 同块)
 * 推导每个边缘格的邻面同块 partner, 打分侧按混合概率建模。
 */
import { physicalPerm } from "./rotation-perms.ts";

const FACES = ["U", "R", "F", "D", "L", "B"] as const;
const faceOfFacelet = (x: number): number => Math.floor(x / 9);

/** 签名 = 动到该 facelet 的外层转动面集合位掩码: 角 3 位 / 棱 2 位 / 中心 1 位 */
const SIG: number[] = (() => {
  const sig = new Array<number>(54).fill(0);
  for (let fi = 0; fi < 6; fi++) {
    const p = physicalPerm(FACES[fi]);
    for (let i = 0; i < 54; i++) if (p[i] !== i) sig[i] |= 1 << fi;
  }
  return sig;
})();
const CUBIE = new Map<number, number[]>();
for (let i = 0; i < 54; i++) {
  const arr = CUBIE.get(SIG[i]);
  if (arr) arr.push(i);
  else CUBIE.set(SIG[i], [i]);
}
const partnerOnFace = (x: number, g: number): number => {
  for (const y of CUBIE.get(SIG[x]) ?? []) if (y !== x && faceOfFacelet(y) === g) return y;
  return -1;
};
const otherFaceOfEdge = (edgeFacelet: number, f: number): number => {
  for (let fi = 0; fi < 6; fi++) if (fi !== f && SIG[edgeFacelet] & (1 << fi)) return fi;
  return -1;
};

export interface Halo {
  /** 每窗口格的渗色候选 facelet (边缘格 1-2 个, 中心 0 个) */
  bleed: number[][];
  /** 平移出窗位置 (r+1)*5+(c+1) → halo facelet (双向出窗 = -1 按背景) */
  out: Int32Array;
}

/** 按指派集建 halo 查询器 (每 ai 缓存) */
export function makeHaloGetter(assigns: readonly (readonly number[])[]): (ai: number) => Halo {
  const cache = new Map<number, Halo>();
  return (ai: number): Halo => {
    let h = cache.get(ai);
    if (h) return h;
    const assign = assigns[ai];
    const f = faceOfFacelet(assign[4]);
    // 窗口四方向邻面 (由中行/中列边缘棱贴纸唯一决定)
    const gTop = otherFaceOfEdge(assign[1], f);
    const gRight = otherFaceOfEdge(assign[5], f);
    const gBottom = otherFaceOfEdge(assign[7], f);
    const gLeft = otherFaceOfEdge(assign[3], f);
    const bleed: number[][] = [];
    for (let j = 0; j < 9; j++) {
      const r = (j / 3) | 0, c = j % 3;
      const cands: number[] = [];
      if (r === 0) cands.push(partnerOnFace(assign[j], gTop));
      if (r === 2) cands.push(partnerOnFace(assign[j], gBottom));
      if (c === 0) cands.push(partnerOnFace(assign[j], gLeft));
      if (c === 2) cands.push(partnerOnFace(assign[j], gRight));
      bleed.push(cands.filter((x) => x >= 0));
    }
    const out = new Int32Array(25).fill(-1);
    for (let k = 0; k < 3; k++) {
      out[0 * 5 + (k + 1)] = partnerOnFace(assign[k], gTop); // r=-1
      out[4 * 5 + (k + 1)] = partnerOnFace(assign[6 + k], gBottom); // r=3
      out[(k + 1) * 5 + 0] = partnerOnFace(assign[k * 3], gLeft); // c=-1
      out[(k + 1) * 5 + 4] = partnerOnFace(assign[k * 3 + 2], gRight); // c=3
    }
    h = { bleed, out };
    cache.set(ai, h);
    return h;
  };
}
