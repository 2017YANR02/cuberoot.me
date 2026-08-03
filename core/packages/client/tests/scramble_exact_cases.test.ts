/*
 * 精确穷举集「点柱看状态」的守卫 —— 列出来的那一档必须**就是**那一档。
 *
 * 页面(app/[lang]/scramble/stats/_components/ExactCaseList.tsx)现场枚举,不读数据文件,所以
 * 这里要证三件事:
 *   ① 枚举出的个数逐档等于 _data/exact_dist.ts 的金标(那批数字抄自 solver/src/bin/dist_*.rs);
 *   ② 页面拿去渲染的那条打乱(棱块钉死 + 角块随机补齐)量出来仍是该档步数 —— 补角块不改步数;
 *   ③ 六色底 8 步那 40 个,与用户手算的表(.tmp/docx/8 Move CN Cross [5,40].docx,张铭源)
 *      逐个对上:5 条代表打乱各自落在集合里,且 24 个转体下的轨道大小恰为 6/3/6/24/1。
 *
 * ③ 是这份测试里唯一的**外部**判据:①② 都是本仓库自己的表在互证,③ 来自站外独立计算。
 */

import { describe, expect, it } from 'vitest';
import { Alg } from 'cubing/alg';
import { mirrorFamily, mirrorKeepsAmount } from '@cuberoot/shared/alg-notation';
import {
  applySequence, parseMoves, solvedCubie, type CubieCube,
} from '@/app/[lang]/timer/_lib/scramble/kociemba/cube';
import { EXACT_DIST } from '@/app/[lang]/scramble/stats/_data/exact_dist';
import { facesOfSubset, stageMetric } from '@/lib/cross-trainer';
import { enumerateCrossTop, type CorpusMember } from '@/lib/cross-trainer/corpus';
import { fillState } from '@/lib/cross-trainer/fill';
import { N_ROTATIONS, mirrorState, rotateState } from '@/lib/cross-trainer/rotate';

/** 棱块状态的身份:槽位 → 棱块 + 该槽的翻转。角块不进 key(十字口径根本不读角块)。 */
const edgeKey = (c: CubieCube): string => `${c.ep.join(',')}|${c.eo.join('')}`;

/** 枚举出的成员同样只钉棱块;补成一个 CubieCube(角块随便,只用来比棱)。 */
function memberState(m: CorpusMember): CubieCube {
  const s = solvedCubie();
  for (const { piece, slot, ori } of m.edgePins) { s.ep[slot] = piece; s.eo[slot] = ori; }
  return s;
}

/** ExactCaseList 里那把种子 rng —— 行代表必须可复现,测试用同一把。 */
function seeded(seed: number): () => number {
  let a = (seed + 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const stateOf = (scramble: string): CubieCube =>
  applySequence(solvedCubie(), parseMoves(scramble));

/** M 面镜像**在公式上**的做法 —— 全站单一真源(与 tests/cn_xcross_10.test.ts 同一条路)。 */
function mirrorAlg(alg: string): string {
  const out: string[] = [];
  for (const m of new Alg(alg).experimentalLeafMoves()) {
    const family = mirrorFamily(m.family, 'M');
    const amount = ((mirrorKeepsAmount(m.family, 'M') ? m.amount : -m.amount) % 4 + 4) % 4;
    if (amount === 0) continue;
    out.push(family + (amount === 1 ? '' : amount === 2 ? '2' : "'"));
  }
  return out.join(' ');
}

/** 一个状态在 48 元群(24 转体 × 镜像)下的整条轨道,只看棱块。 */
function orbit48(st: CubieCube): Set<string> {
  const out = new Set<string>();
  for (const v of [st, mirrorState(st)]) {
    for (let r = 0; r < N_ROTATIONS; r++) out.add(edgeKey(rotateState(v, r)));
  }
  return out;
}

describe('exact case list / 枚举与金标一致', () => {
  // 单色底:度量只读那一面的四条棱,所以**每一档**都是那一面自己的一层,逐档可查。
  it('白底十字每一档都对上 dist_cross_1col', () => {
    const counts = EXACT_DIST.cross.unfixed?.W;
    expect(counts?.kind).toBe('full');
    if (counts?.kind !== 'full') return;
    const faces = facesOfSubset('W');
    const got = counts.counts.map((_, d) => enumerateCrossTop(faces, d).length);
    expect(got).toEqual(counts.counts.map(Number));
  });

  // 多色底:只有最深那一档「取最优 = 每个颜色都这么深」,别的档不是这个集合(也大到列不动)。
  it.each(['WY', 'BGOR', 'BGORWY'])('%s 最深一档的个数对上金标', (key) => {
    const cell = EXACT_DIST.cross.unfixed?.[key as 'WY'];
    expect(cell?.kind).toBe('full');
    if (cell?.kind !== 'full') return;
    const top = cell.counts.length - 1;
    expect(enumerateCrossTop(facesOfSubset(key), top).length).toBe(Number(cell.counts[top]));
  });

  // 页面渲染的那条打乱 = 钉死棱块 + 随机补齐;补齐不能把状态挪出这一档。
  it.each(['W', 'WY', 'BGOR', 'BGORWY'])('%s 最深一档:补齐后逐个复测仍是那个步数', (key) => {
    const cell = EXACT_DIST.cross.unfixed?.[key as 'W'];
    if (cell?.kind !== 'full') throw new Error(`${key} 没有完整分布`);
    const depth = cell.counts.length - 1;
    const members = enumerateCrossTop(facesOfSubset(key), depth);
    const measured = members.map((m, i) =>
      stageMetric('std', 'cross', fillState(m.edgePins, m.cornerPins, seeded(i)), key));
    expect(new Set(measured)).toEqual(new Set([depth]));
  });
});

/*
 * 六色底 8 步的 40 个态,按 24 个转体分成 5 类 —— 用户(张铭源)手算表给的代表与轨道大小。
 * 顺序即表里的顺序;最后一条是自对称的那个(超级翻转棋盘)。
 */
const CN8_REPS: Array<{ orbit: number; scramble: string }> = [
  { orbit: 6, scramble: "L B2 L2 D2 B2 U2 B' L D F D2 L2 U F' R D' R F2" },
  { orbit: 3, scramble: "F' R' U' F' U2 F2 R2 D2 F L R2 U' B' D' R' F R2 F'" },
  { orbit: 6, scramble: "R' F2 L' R' U2 F R U B' D R F' R2 F' U R2 U' B' U2" },
  { orbit: 24, scramble: "L2 D L2 F' R' U' L' R' F2 L2 F R' B' L D R2 B F2" },
  { orbit: 1, scramble: "R B L F D L R' B2 F D' U L D' U R' D' F' R' U'" },
];

describe('exact case list / 六色底 8 步 40 个 vs 手算表', () => {
  const members = enumerateCrossTop(facesOfSubset('BGORWY'), 8);
  const keys = new Set(members.map((m) => edgeKey(memberState(m))));

  it('枚举出 40 个', () => {
    expect(members.length).toBe(40);
  });

  it('表里 5 条代表都在集合里,且六色底十字确实是 8 步', () => {
    for (const { scramble } of CN8_REPS) {
      const st = stateOf(scramble);
      expect(stageMetric('std', 'cross', st, 'BGORWY'), scramble).toBe(8);
      expect(keys.has(edgeKey(st)), scramble).toBe(true);
    }
  });

  it('48 元群把 40 个分成 5 条轨道,大小 1/3/6/6/24', () => {
    const seen = new Set<string>();
    const orbits: number[] = [];
    for (const m of members) {
      const st = memberState(m);
      if (seen.has(edgeKey(st))) continue;
      const o = orbit48(st);
      for (const k of o) seen.add(k);
      // 轨道整条都得落在这 40 个里 —— 否则「六色底 8 步」就不是个对称不变的性质。
      expect([...o].every((k) => keys.has(k))).toBe(true);
      orbits.push(o.size);
    }
    expect(orbits.sort((a, b) => a - b)).toEqual([1, 3, 6, 6, 24]);
    expect(seen.size).toBe(40);
  });

  it('5 条代表落在 5 条不同的轨道上,且轨道大小与表一致', () => {
    const orbits = CN8_REPS.map(({ scramble }) => orbit48(stateOf(scramble)));
    expect(orbits.map((o) => o.size)).toEqual(CN8_REPS.map((r) => r.orbit));
    // 两两不相交 = 5 条代表两两不同构。
    for (let i = 0; i < orbits.length; i++) {
      for (let j = i + 1; j < orbits.length; j++) {
        expect([...orbits[i]].some((k) => orbits[j].has(k)), `${i} vs ${j}`).toBe(false);
      }
    }
  });

  // 24 个转体单独作用时,那条 24 的轨道会裂成两半 —— 手性对。所以「本质 5 个」这句话
  // 必须带上镜像;只按转体数会数出 6 个。这条把结论钉住,免得以后有人悄悄换掉群。
  it('只用 24 个转体会裂成 6 条(那条 24 是一对手性)', () => {
    const seen = new Set<string>();
    const sizes: number[] = [];
    for (const m of members) {
      const st = memberState(m);
      if (seen.has(edgeKey(st))) continue;
      const o = new Set<string>();
      for (let r = 0; r < N_ROTATIONS; r++) o.add(edgeKey(rotateState(st, r)));
      for (const k of o) seen.add(k);
      sizes.push(o.size);
    }
    expect(sizes.sort((a, b) => a - b)).toEqual([1, 3, 6, 6, 12, 12]);
  });
});

describe('exact case list / 镜像', () => {
  // mirrorState 是本仓库新写的关系映射;真源是公式层的 mirrorFamily(/scramble/hardest 那套)。
  // 两者在随机打乱上必须逐格相同(棱与角、位置与朝向都算),否则上面的轨道结论不作数。
  it('mirrorState 与公式层镜像逐格一致', () => {
    const faces = ['U', 'D', 'L', 'R', 'F', 'B'], suffix = ['', "'", '2'];
    let seed = 12345;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let n = 0; n < 50; n++) {
      const moves: string[] = [];
      for (let i = 0; i < 15; i++) {
        moves.push(faces[(rnd() * 6) | 0] + suffix[(rnd() * 3) | 0]);
      }
      const scramble = moves.join(' ');
      const got = mirrorState(stateOf(scramble));
      const want = stateOf(mirrorAlg(scramble));
      expect([got.ep, got.eo, got.cp, got.co], scramble).toEqual([want.ep, want.eo, want.cp, want.co]);
    }
  });
});
