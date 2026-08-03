/*
 * cross-trainer/symmetry — 「去除同构后本质上有几个」的那个「同构」。
 *
 * 群不是固定的 48 个。对称要**保住这道题**才算数:
 *   六色底  问的是「六个颜色里取最优」,任何转体/镜像换来的还是同一道题 → 整个 48 元群;
 *   白底    问的是「白色十字」,把白面转到别处的对称问的是另一道题(那时它成了别的颜色的
 *           十字) → 只剩固定白面的 8 个;
 *   四色底  只有把那四个颜色整体换到自己身上的对称算数。
 * 所以这里先按底色集合筛对称,再拿筛剩的那些分类 —— subsetSymmetries 干第一件事,
 * symmetryClasses 干第二件。
 *
 * 只比棱块:十字口径根本不读角块,角块是补出来的。
 *
 * tests/scramble_exact_cases.test.ts 用用户手算的六色底 8 步表(5 类,大小 1/3/6/6/24)钉住
 * 这里的结论 —— 那 24 那一条只在**带镜像**时才是一条;单看 24 个转体它是一对手性,会数出 6 类。
 */

import { solvedCubie, type CubieCube } from '@/app/[lang]/timer/_lib/scramble/kociemba/cube';
import type { CorpusMember } from './corpus';
import type { FaceIdx } from './model';
import { MIRROR_FACE, N_ROTATIONS, ROTATIONS, mirrorState, rotateState } from './rotate';

/** 一个棱块状态的身份:每个槽装着哪块棱、翻没翻。 */
export const edgeKey = (c: CubieCube): string => `${c.ep.join(',')}|${c.eo.join('')}`;

/** 枚举出来的成员只钉棱块;补成一个 CubieCube(角块随便,只拿来比棱、做对称)。 */
export function memberState(m: CorpusMember): CubieCube {
  const s = solvedCubie();
  for (const { piece, slot, ori } of m.edgePins) { s.ep[slot] = piece; s.eo[slot] = ori; }
  return s;
}

/** 48 元群(24 转体 × 镜像)里把这组底色整体映到自己身上的那些。 */
export function subsetSymmetries(faces: readonly FaceIdx[]): Array<(c: CubieCube) => CubieCube> {
  const set = new Set<number>(faces);
  const out: Array<(c: CubieCube) => CubieCube> = [];
  for (const mirrored of [false, true]) {
    for (let r = 0; r < N_ROTATIONS; r++) {
      const image = (f: number) => ROTATIONS[r].face[mirrored ? MIRROR_FACE[f] : f];
      if (!faces.every((f) => set.has(image(f)))) continue;
      out.push((c) => rotateState(mirrored ? mirrorState(c) : c, r));
    }
  }
  return out;
}

export interface CaseClass {
  /** 代表在 members 里的下标(枚举序里最先出现的那个)。 */
  rep: number;
  /** 该类含多少个状态(轨道大小)。 */
  size: number;
  /**
   * 该状态自身的对称有几个(稳定子的大小)—— 轨道-稳定子定理:size × stab = 群的大小。
   * 越对称的状态,类越小;吃下全部对称的那个,自己就是一整类。
   */
  stab: number;
}

/**
 * 把一批状态按 `symmetries` 分类,每类取枚举序里最先出现的当代表。
 *
 * 轨道整条都该落在这批状态里 —— 否则「这一档」就不是个对称不变的性质,分类也就没意义;
 * 上面那份测试对六色底 8 步逐条验过这点。
 */
export function symmetryClasses(
  members: readonly CorpusMember[],
  symmetries: ReadonlyArray<(c: CubieCube) => CubieCube>,
): CaseClass[] {
  const seen = new Set<string>();
  const out: CaseClass[] = [];
  for (let i = 0; i < members.length; i++) {
    const st = memberState(members[i]);
    if (seen.has(edgeKey(st))) continue;
    const orbit = new Set<string>();
    for (const g of symmetries) orbit.add(edgeKey(g(st)));
    for (const k of orbit) seen.add(k);
    out.push({ rep: i, size: orbit.size, stab: symmetries.length / orbit.size });
  }
  return out;
}
