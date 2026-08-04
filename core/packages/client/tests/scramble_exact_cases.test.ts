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
import {
  EXACT_CASE_FIXED_STAGES, EXACT_COLOR_KEYS, EXACT_DIST, EXACT_STAGES, SLOT_OK,
  exactCaseDepths, exactCasePlan, getExactCell,
} from '@/app/[lang]/scramble/stats/_data/exact_dist';
import { facesOfSubset, stageMetric } from '@/lib/cross-trainer';
import { block222DistCapped, blockCoordOf } from '@/lib/cross-trainer/block';
import { enumerateCrossTop } from '@/lib/cross-trainer/corpus';
import { exactCaseSource } from '@/lib/cross-trainer/exact-cases';
import { fillState } from '@/lib/cross-trainer/fill';
import { N_ROTATIONS, mirrorState, rotateState } from '@/lib/cross-trainer/rotate';
import { edgeKey, memberState, subsetSymmetries, symmetryClasses } from '@/lib/cross-trainer/symmetry';

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
 * 定帧那几格:度量只读固定的那几块,所以**每一档**都是那张穷举表的一层。
 *
 * 这里要证的还是那三件事,只是判据换了:
 *   ① 逐档个数等于 _data/exact_dist.ts 的金标(那批数字来自 solver/src/bin/dist_tracked.rs);
 *   ② 补齐不改这几块 —— 补完再读一遍度量看得见的部分,必须与钉的时候一模一样;
 *      2×2×2 那格再走一遍 ./block 自己那张独立写的表(两份实现对上,才不算自证)。
 *   ③ 保住这道题的对称把这一档整条轨道留在档内,且轨道 × 稳定子 = 群的大小。
 */
describe('exact case list / 定帧那几格', () => {
  const CELLS = EXACT_CASE_FIXED_STAGES.map((stage) => {
    const cell = EXACT_DIST[stage].fixed1?.W;
    if (cell?.kind !== 'full') throw new Error(`${stage} 定帧那格没有完整分布`);
    return { stage, counts: cell.counts.map(Number) };
  });

  // 只查页面真会让人点开的那几档:EOCross 的中间几档有上百万个态,把它们逐个物化成钉法
  // 会把这份测试(和浏览器)吃干净 —— 那也正是 EXACT_CASE_CAP 存在的原因。
  it.each(CELLS)('$stage:可点的每一档个数都对上金标', ({ stage, counts }) => {
    const src = exactCaseSource(stage, 'fixed1', 'W', []);
    expect(src).not.toBeNull();
    const depths = exactCaseDepths(stage, 'fixed1', 'W', counts.map(String));
    expect(depths.length).toBeGreaterThan(0);
    for (const d of depths) expect(src!.members(d).length, `${stage} d=${d}`).toBe(counts[d]);
    // 这张表就是整个坐标空间 —— 越界的档必须是空的,不是「还没算」。
    expect(src!.members(counts.length).length).toBe(0);
  });

  it.each(CELLS)('$stage:最深一档补齐后,度量读到的那几块原封不动', ({ stage, counts }) => {
    const src = exactCaseSource(stage, 'fixed1', 'W', [])!;
    const depth = counts.length - 1;
    const members = src.members(depth);
    for (let i = 0; i < members.length; i++) {
      const filled = fillState(members[i].edgePins, members[i].cornerPins, seeded(i));
      expect(src.key(filled), `${stage} #${i}`).toBe(src.key(memberState(members[i])));
    }
  });

  // 2×2×2 有第二份实现(./block 自己的坐标 + 自己的 BFS),拿它复测补齐后的整只魔方 ——
  // 枚举走的是 ./tracked 那台共享引擎,两条路对上才说明这 561 个真的是 8 步。
  it('2×2×2 最深一档 561 个:换一份表复测仍是 8 步', () => {
    const counts = CELLS.find((c) => c.stage === 'block222')!.counts;
    const depth = counts.length - 1;
    const members = exactCaseSource('block222', 'fixed1', 'W', [])!.members(depth);
    expect(members.length).toBe(561);
    const measured = members.map((m, i) =>
      block222DistCapped(blockCoordOf(fillState(m.edgePins, m.cornerPins, seeded(i))), depth));
    expect(new Set(measured)).toEqual(new Set([depth]));
  });

  /*
   * 群不是 48 也不是 8:定帧把题面钉死了,剩下的只有保住它的那几个。这几个数是**推得出来**的,
   * 所以值得当面钉住 —— 群悄悄变大只会让「本质 N 个」变小,轨道封闭那条测试是看不出来的。
   *   1×2×2  该角 + 那两条棱:恒等 + 交换那两条棱的镜像 = 2
   *   1×2×3  两角 + 三棱:恒等 + 沿块中面的镜像 = 2
   *   2×2×2  该角 + 三条棱:绕那条体对角线的 3 个转体 × 镜像 = 6(S₃ 作用在三条棱上)
   *   EO     只需保住那一对相对面(轴):24/3 × 2 = 16
   *   EOLine / EOCross  轴之外还钉住底面,两组都要保住 = 4
   */
  it.each([
    ['fbsquare', 2],
    ['rouxs1', 2],
    ['block222', 6],
    ['eo', 16],
    ['eoline', 4],
    ['eo_cross', 4],
  ] as const)('%s 的对称群是 %i 个', (stage, size) => {
    expect(exactCaseSource(stage, 'fixed1', 'W', [])!.symmetries.length).toBe(size);
  });

  it.each(CELLS)('$stage:最深一档的轨道整条落在档内,轨道 × 稳定子 = 群', ({ stage, counts }) => {
    const src = exactCaseSource(stage, 'fixed1', 'W', [])!;
    expectClosedOrbits(src, counts.length - 1, counts[counts.length - 1], stage);
  });
});

/**
 * 页面「本质」那一栏的不变量,两类格子共用一份:
 *   轨道整条落在这一档里 —— 否则「这一档」就不是个对称不变的性质,分类也就没意义;
 *   轨道 × 稳定子 = 群的大小(页面就是这么解释 6/40 的);
 *   各类大小之和 = 这一档的金标个数。
 */
function expectClosedOrbits(
  src: NonNullable<ReturnType<typeof exactCaseSource>>, depth: number, count: number, label: string,
): void {
  const members = src.members(depth);
  const keys = new Set(members.map((m) => src.key(memberState(m))));
  const classes = symmetryClasses(members, src.symmetries, src.key);
  for (const c of classes) {
    const st = memberState(members[c.rep]);
    for (const g of src.symmetries) expect(keys.has(src.key(g(st))), label).toBe(true);
    expect(c.size * c.stab, label).toBe(src.symmetries.length);
  }
  expect(classes.reduce((n, c) => n + c.size, 0), label).toBe(count);
}

// 十字那四档也走同一套不变量 —— memberState 的补法与分类用的 key 都是两类格子共用的代码。
describe('exact case list / 取最优帧的十字也满足同一套不变量', () => {
  it.each(['W', 'WY', 'BGOR', 'BGORWY'])('%s 最深一档', (key) => {
    const cell = EXACT_DIST.cross.unfixed?.[key as 'W'];
    if (cell?.kind !== 'full') throw new Error(`${key} 没有完整分布`);
    const depth = cell.counts.length - 1;
    const src = exactCaseSource('cross', 'unfixed', key, facesOfSubset(key))!;
    expectClosedOrbits(src, depth, Number(cell.counts[depth]), key);
  });
});

/*
 * 「哪几格能列」有两份代码读它:页面拿 exactCasePlan 决定哪根柱子可点(不能为此把整台引擎
 * 拉进首包),枚举那边拿 exactCaseSource 真去列。两者各自判断,答案必须一样 —— 否则要么柱子
 * 点了没内容,要么列得出来却点不动。
 */
describe('exact case list / 两个入口对同一批格子说同一句话', () => {
  it('整张矩阵逐格一致', () => {
    let listable = 0;
    for (const stage of EXACT_STAGES) {
      for (const slot of SLOT_OK[stage] ?? []) {
        for (const colors of EXACT_COLOR_KEYS) {
          const plan = exactCasePlan(stage, slot, colors);
          const src = exactCaseSource(stage, slot, colors, facesOfSubset(colors));
          expect(!!src, `${stage}/${slot}/${colors}`).toBe(!!plan);
          if (!plan || !src) continue;
          expect(src.everyDepth, `${stage}/${slot}/${colors}`).toBe(plan.everyDepth);
          listable++;
          // 能列的格子必须真有完整分布可对 —— 否则金标那道闸永远拦着,等于列不出来。
          expect(getExactCell(stage, slot, colors)?.kind, `${stage}/${slot}/${colors}`).toBe('full');
        }
      }
    }
    // 十字取最优帧四档 + 定帧六格 ×(四个底色 key 走同一格)= 4 + 24。
    // 加一格能列的阶段这个数就得改 —— 那正是要当面看一眼的地方。
    expect(listable).toBe(28);
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

  // 页面「本质」那一栏走的就是 symmetry.ts 这两个函数,所以这里直接测它们,不再抄一份。
  it('页面用的分类器给出 5 类,大小 1/3/6/6/24', () => {
    const syms = subsetSymmetries(facesOfSubset('BGORWY'));
    expect(syms.length).toBe(48); // 六色底:整个 48 元群都保住这道题
    // 六色底把十二条棱全钉住了,edgeKey 读到的就是度量读到的 —— 这一格可以直接用它。
    const classes = symmetryClasses(members, syms, edgeKey);
    expect(classes.map((c) => c.size).sort((a, b) => a - b)).toEqual([1, 3, 6, 6, 24]);
    expect(classes.reduce((n, c) => n + c.size, 0)).toBe(40);
    // 轨道-稳定子:类的大小 × 该状态自身对称的个数 = 群的大小(页面就是这么解释 6/40 的)。
    expect(classes.map((c) => c.stab).sort((a, b) => a - b)).toEqual([2, 8, 8, 16, 48]);
    for (const c of classes) expect(c.size * c.stab).toBe(48);
    // 5 个代表与手算表的 5 条一一同构(代表可以取到不同的那一个,类必须是同一批)。
    const repOrbit = classes.map((c) => orbit48(memberState(members[c.rep])));
    for (const { scramble, orbit } of CN8_REPS) {
      const hit = repOrbit.filter((o) => o.has(edgeKey(stateOf(scramble))));
      expect(hit.length, scramble).toBe(1);
      expect(hit[0].size, scramble).toBe(orbit);
    }
  });

  // 单色底问的是「白色十字」,把白面转走的对称问的是另一道题 —— 群缩到固定该面的 8 个。
  it('白底只保住 8 个对称', () => {
    expect(subsetSymmetries(facesOfSubset('W')).length).toBe(8);
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
