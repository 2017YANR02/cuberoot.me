/**
 * 纯 EO(ZZ 的第一步,只要求 12 条棱朝向正确,不管位置)在**全状态空间**上的精确深度分布 ——
 * 而且是站内口径:**一个底色给两条垂直轴,取更短的那条**。
 *
 * ## 为什么不能直接用单轴那张 2,048 的表
 *
 * 一条轴的 EO 只有 2,048 个态(12 位翻转字,总翻转数恒为偶 → 第 12 位由前 11 位定死),
 * BFS 一瞬间就跑完,直径 7。但站内说的「EO,白色」不是某一条轴:白/黄底面对应 U/D 轴,
 * 剩下 L/R 与 F/B 两条轴都是合法的 ZZ 起手,分析器两条都算、取更小
 * (`solver/src/eoline_solver.rs`,口径核对见 `docs/cross-trainer-difficulty.md` §6.1)。
 * 于是四档底色实际只有两种问法:
 *
 *   单色底 / 双色底  —— 一对对面色共用一条面轴 → 垂直轴恒为那两条 → **两条轴取最优**
 *   四色底 / 六色底  —— 四色已经把三条轴占满 → **三条轴取最优**(六色不会更多)
 *
 * `min(d_a, d_b)` 不是任何单条轴的字能回答的问题,得知道三条字**同时**是什么。
 *
 * ## 联合坐标恰好是 70,963,200
 *
 * 轴 a 下某个槽的翻转位 = kociemba 的 `eo[s]` 异或 `delta_a[片][槽]`(见 `cross-trainer/eo`)。
 * 关键事实(本文件启动即验,不是假设):**`delta` 只依赖棱的「类」,不依赖具体是哪条棱** ——
 * 一条棱按它**碰不到**的那条轴分类,12 条棱恰好分成 3 类 × 4 条:
 *
 *   缺 U/D 轴 = FR FL BL BR      缺 R/L 轴 = UF UB DF DB      缺 F/B 轴 = UR UL DR DL
 *
 * 所以三条字都由「每个槽里那条棱的类」+「12 位翻转字」决定,同类棱互换不改变任何一条字。
 * 商掉这层就是
 *
 *   12! · 2¹¹ / (4!)³ = 980,995,276,800 / 13,824 = **70,963,200**
 *
 * 每个商态在 12 棱空间里恰好对应 13,824 个态(同类互换),所以商上的计数**等比**放大回全空间,
 * 占比逐位不变。角块与 EO 完全无关,故这也是整只魔方上的占比。
 *
 * ## 自检
 *
 * 把「取最优」换成「只看第 2 条轴」跑同一遍枚举,必须逐档等于单轴金标 × 34,650
 * (`[1,2,25,202,620,900,285,13] × 34650`)。对上了才说明商空间与权重都没搞错 ——
 * `tests/eo_axis_dist.test.ts` 每次跑都重算。
 *
 * 约 2 秒、几百 KB;页面读常量,别在渲染路径上调。
 */

import { eoAxisData, type EoAxis } from '@/lib/cross-trainer/eo';
import { FACE_EDGES } from '@/lib/cross-trainer/model';

/** 一条棱的「类」= 它**碰不到**的那条轴(0 = U/D,1 = R/L,2 = F/B)。 */
export const EO_EDGE_CLASS: readonly number[] = Array.from({ length: 12 }, (_, e) => {
  const axes = new Set([0, 1, 2, 3, 4, 5].filter((f) => FACE_EDGES[f].includes(e)).map((f) => f % 3));
  const missing = [0, 1, 2].find((a) => !axes.has(a));
  // 每条棱有两个面、分属两条不同的轴,所以恰好缺一条。缺不到或缺两条都说明模型换了。
  if (missing === undefined) throw new Error(`edge ${e} touches all three axes`);
  return missing;
});

/** 类的排布数 12!/(4!)³。 */
export const EO_ARRANGEMENTS = 34650;
/** 一条轴的翻转字数(偶校验)。 */
export const EO_WORDS = 2048;
/** 联合坐标空间 = 排布 × 翻转字。 */
export const EO_AXIS_STATES = EO_ARRANGEMENTS * EO_WORDS;   // 70,963,200
/** 商掉的同类互换数 (4!)³ —— 乘回去就是 12 棱全空间 980,995,276,800。 */
export const EO_CLASS_MULTIPLICITY = 13824;

/**
 * `delta[类][槽]`,每条轴一张。顺带把「只依赖类」这件事验掉:`cross-trainer/eo` 若改了朝向
 * 约定而这里没跟上,整个商空间就塌了,必须当场炸而不是给出一份安静的错数据。
 */
function classDeltas(): Int8Array[][] {
  return ([0, 1, 2] as EoAxis[]).map((a) => {
    const { delta } = eoAxisData(a);
    const tbl = [new Int8Array(12), new Int8Array(12), new Int8Array(12)];
    const seen = [new Uint8Array(12), new Uint8Array(12), new Uint8Array(12)];
    for (let s = 0; s < 12; s++) {
      for (let p = 0; p < 12; p++) {
        const c = EO_EDGE_CLASS[p];
        const v = delta[p * 12 + s];
        if (!seen[c][s]) { seen[c][s] = 1; tbl[c][s] = v; }
        else if (tbl[c][s] !== v) {
          throw new Error(`EO delta is not class-invariant: axis ${a}, slot ${s}, class ${c}`);
        }
      }
    }
    return tbl;
  });
}

/** 12 位偶校验翻转字:前 11 位任取,第 0 位补齐。 */
const evenWord = (x: number): number => {
  let n = 0;
  for (let i = 0; i < 11; i++) n ^= (x >> i) & 1;
  return (x << 1) | n;
};

/**
 * 每个轴集合一条分布:`out[i][d]` = 联合坐标里「对 `axisSets[i]` 取最优恰好 d 步」的态数。
 * 一次枚举同时出多条 —— 71M 次内层循环,分开跑就是几倍的墙钟。
 */
export function computeEoAxisDist(
  axisSets: readonly (readonly EoAxis[])[] = [[2], [1, 2], [0, 1, 2]],
): number[][] {
  const D = classDeltas();
  const dist = ([0, 1, 2] as EoAxis[]).map((a) => eoAxisData(a).dist);
  const words = new Int32Array(EO_WORDS);
  for (let x = 0; x < EO_WORDS; x++) words[x] = evenWord(x);

  const out = axisSets.map(() => new Array<number>(16).fill(0));
  const mask = new Int32Array(3);
  const cur = new Int8Array(12);
  const left = [4, 4, 4];
  let n = 0;

  const visit = () => {
    n++;
    mask[0] = 0; mask[1] = 0; mask[2] = 0;
    for (let s = 0; s < 12; s++) {
      const c = cur[s];
      mask[0] |= D[0][c][s] << s;
      mask[1] |= D[1][c][s] << s;
      mask[2] |= D[2][c][s] << s;
    }
    for (let x = 0; x < EO_WORDS; x++) {
      const v = words[x];
      const d0 = dist[0][(v ^ mask[0]) >> 1];
      const d1 = dist[1][(v ^ mask[1]) >> 1];
      const d2 = dist[2][(v ^ mask[2]) >> 1];
      for (let i = 0; i < axisSets.length; i++) {
        const set = axisSets[i];
        let best = 255;
        for (const a of set) { const d = a === 0 ? d0 : a === 1 ? d1 : d2; if (d < best) best = d; }
        out[i][best]++;
      }
    }
  };

  const rec = (s: number) => {
    if (s === 12) { visit(); return; }
    for (let c = 0; c < 3; c++) {
      if (!left[c]) continue;
      left[c]--; cur[s] = c; rec(s + 1); left[c]++;
    }
  };
  rec(0);
  if (n !== EO_ARRANGEMENTS) throw new Error(`class arrangements: ${n} ≠ ${EO_ARRANGEMENTS}`);

  // 尾部的空档不进结果 —— 直径以外的 0 会让「最深一档」读错。
  return out.map((h) => h.slice(0, h.findLastIndex((c) => c > 0) + 1));
}

/** 单轴金标(2,048 个字),`cross-trainer/eoline` 的 `eoHistogram` 同源。 */
export const EO_ONE_AXIS_HIST: readonly number[] = [1, 2, 25, 202, 620, 900, 285, 13];

/** 站内「单色底 / 双色底 EO」= 两条垂直轴取最优,直径 7。Σ = 70,963,200。 */
export const EO_BEST_OF_2_HIST: readonly number[] = [
  69230, 138320, 1716120, 12886020, 31047310, 23418220, 1681750, 6230,
];

/** 站内「四色底 / 六色底 EO」= 三条轴取最优,直径仍是 7 —— 只剩 401 个态。Σ = 70,963,200。 */
export const EO_BEST_OF_3_HIST: readonly number[] = [
  103741, 207066, 2550149, 17895502, 34885236, 14971488, 349617, 401,
];
