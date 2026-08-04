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
import type { Pin } from './fill';
import type { FaceIdx } from './model';
import { MIRROR_FACE, N_ROTATIONS, ROTATIONS, mirrorState, pieceAction, rotateState } from './rotate';

/** 一个棱块状态的身份:每个槽装着哪块棱、翻没翻。 */
export const edgeKey = (c: CubieCube): string => `${c.ep.join(',')}|${c.eo.join('')}`;

/**
 * 枚举出来的成员只钉度量读到的那几块;补成一个 CubieCube 拿来做对称。
 *
 * 补法是「剩下的块按序填剩下的槽」,只为了让它是个**真置换** —— 不这么补,被钉走的那块会
 * 同时留在原位上,「这块在哪个槽」就成了个有两个答案的问题。
 *
 * 补出来的部分不承诺任何东西:它不是均匀的,在对称下也不与 `g·m` 的补法一致。所以分类用的
 * key **只许读度量读到的那几块**(见 symmetryClasses 的 key 参数)—— 那一部分在 g 下怎么变
 * 与补法无关,这也正是轨道算得对的理由。
 */
export function memberState(m: CorpusMember): CubieCube {
  const s = solvedCubie();
  fillRest(s.ep, s.eo, m.edgePins, 12);
  fillRest(s.cp, s.co, m.cornerPins, 8);
  return s;
}

function fillRest(perm: number[], ori: number[], pins: readonly Pin[], n: number): void {
  const taken = new Uint8Array(n);
  const pinned = new Uint8Array(n);
  for (const p of pins) { perm[p.slot] = p.piece; ori[p.slot] = p.ori; taken[p.piece] = 1; pinned[p.slot] = 1; }
  const rest: number[] = [];
  for (let i = 0; i < n; i++) if (!taken[i]) rest.push(i);
  let k = 0;
  for (let i = 0; i < n; i++) if (!pinned[i]) { perm[i] = rest[k++]; ori[i] = 0; }
}

/**
 * 48 元群里把**每一组面**都整体映到自己身上的那些。
 *
 * 一组 = 一个必须保住的东西:底色集是一组;EO 轴是「一对相对面」这一组;EOLine 的题面同时
 * 钉住底面与轴,那就是两组,都得保住(结果只剩 4 个)。
 */
export function faceSymmetries(sets: ReadonlyArray<readonly FaceIdx[]>): Array<(c: CubieCube) => CubieCube> {
  const out: Array<(c: CubieCube) => CubieCube> = [];
  for (const mirrored of [false, true]) {
    for (let r = 0; r < N_ROTATIONS; r++) {
      const image = (f: number) => ROTATIONS[r].face[mirrored ? MIRROR_FACE[f] : f];
      if (!sets.every((s) => s.every((f) => s.includes(image(f) as FaceIdx)))) continue;
      out.push((c) => rotateState(mirrored ? mirrorState(c) : c, r));
    }
  }
  return out;
}

/** 48 元群(24 转体 × 镜像)里把这组底色整体映到自己身上的那些。 */
export const subsetSymmetries = (faces: readonly FaceIdx[]): Array<(c: CubieCube) => CubieCube> =>
  faceSymmetries([faces]);

/**
 * 定帧那道题的对称群:48 元里把**被盯的那组块**整体映到自己身上的那些。
 *
 * 判据不是「保住底色」而是「保住这道题」—— 定帧的题面是「把这几块归位」,目标集在 g 下不动
 * 当且仅当 g 把这几块换到这几块里(归位态本身对任何 g 都不动)。所以 2×2×2 定帧剩下的是
 * 绕那条体对角线的 3 个转体 × 镜像 = 6 个,而不是十字单色底的 8 个。
 */
export function trackedSymmetries(
  spec: { corners: readonly number[]; edges: readonly number[] },
): Array<(c: CubieCube) => CubieCube> {
  const es = new Set(spec.edges);
  const cs = new Set(spec.corners);
  const out: Array<(c: CubieCube) => CubieCube> = [];
  for (const mirrored of [false, true]) {
    for (let r = 0; r < N_ROTATIONS; r++) {
      const act = pieceAction(r, mirrored);
      if (!spec.edges.every((e) => es.has(act.edge[e]))) continue;
      if (!spec.corners.every((c) => cs.has(act.corner[c]))) continue;
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
  /**
   * 状态的身份,**只许读度量读到的那几块**(见 memberState)。没有默认值是故意的:
   * 读多了会把补出来的差异当成不同的情况,读少了会把两个情况并成一个,两头都错得很安静。
   */
  key: (c: CubieCube) => string,
): CaseClass[] {
  const seen = new Set<string>();
  const out: CaseClass[] = [];
  for (let i = 0; i < members.length; i++) {
    const st = memberState(members[i]);
    if (seen.has(key(st))) continue;
    const orbit = new Set<string>();
    for (const g of symmetries) orbit.add(key(g(st)));
    for (const k of orbit) seen.add(k);
    out.push({ rep: i, size: orbit.size, stab: symmetries.length / orbit.size });
  }
  return out;
}
