import { describe, it, expect } from 'vitest';
import {
  CLOCK_TYPE_MASKS,
  applyClockMoves,
  canonicalClockMoves,
  clockMoveDelta,
  clockScrambleForState,
  clockStateFromAlg,
  invalidClockCorner,
  isClockSolved,
  parseClockMoves,
  physicalPosit,
  randomClockState,
  SOLVED_CLOCK,
  solveClock,
  type ClockState,
} from '@/lib/clock-solver';
import { applyClockScramble } from '@/app/[lang]/scramble/gen/_svg/clock_svg';

// ─── 口径 ────────────────────────────────────────────────────────────────────
// 本文件的金标准有两条,互相独立:
//   1) tnoodle ClockPuzzle.java 的 18 位 move 表(站内移植 = clock_svg.ts)—— 招式语义。
//   2) Jaap Scherphuis 公布的 God's algorithm 表 —— 每个最优步数下的状态数。
// 我们**不**引用任何现成求解器;第 (2) 条里 d ≤ 3 那几档由本仓库自己的招式模型独立枚举复现。

/** Jaap https://www.jaapsch.net/puzzles/clock.htm 的完整距离分布。 */
const JAAP_DISTRIBUTION: readonly bigint[] = [
  1n, 330n, 51651n, 4947912n, 317141342n, 14054473232n, 428862722294n,
  8621633953202n, 101600180118726n, 528107928328516n, 613251601892918n,
  31893880879492n, 39248n,
];

/** 14 个自由坐标:正面 9 盘 + 反面 5 个自有盘(反面 4 个角盘由正面角盘决定)。 */
const COORDS14 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 13, 10, 14, 12, 16];
const FRONT_CORNER_DIAL = [0, 2, 6, 8];
const BACK_CORNER_DIAL = [11, 9, 17, 15];

const mod12 = (x: number) => ((x % 12) + 12) % 12;

function randomAlg(rng: () => number, len: number): string {
  const FRONT = ['UR', 'DR', 'DL', 'UL', 'U', 'R', 'D', 'L', 'ALL'];
  const out: string[] = [];
  for (let i = 0; i < len; i++) {
    const fam = FRONT[Math.floor(rng() * FRONT.length)];
    const n = 1 + Math.floor(rng() * 6);
    out.push(`${fam}${n}${rng() < 0.5 ? '+' : '-'}`);
  }
  return out.join(' ');
}

/** 可复现的伪随机(mulberry32),别让 CI 里出现随机红。 */
function rng32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('clock 招式语义 vs tnoodle', () => {
  it('单步招式与 tnoodle 的 18 位 move 表逐格相同(9 种正面记号)', () => {
    for (const fam of ['UR', 'DR', 'DL', 'UL', 'U', 'R', 'D', 'L', 'ALL']) {
      for (let n = 1; n <= 6; n++) {
        for (const sign of ['+', '-']) {
          const alg = `${fam}${n}${sign}`;
          expect(clockStateFromAlg(alg).posit, alg).toEqual(applyClockScramble(alg).posit);
        }
      }
    }
  });

  it('含 y2 的多步算法与 tnoodle 逐格相同(含末尾停在翻面态)', () => {
    const rng = rng32(20260725);
    for (let i = 0; i < 300; i++) {
      const alg = `${randomAlg(rng, 4)} y2 ${randomAlg(rng, 3)}`;
      const mine = clockStateFromAlg(alg);
      const tnoodle = applyClockScramble(alg);
      expect(mine.posit, alg).toEqual(tnoodle.posit);
      expect(mine.rightSideUp, alg).toBe(tnoodle.rightSideUp);
    }
  });

  it('30 种 move type 各自保持「反面角盘 = −正面角盘」不变量', () => {
    for (const side of [0, 1] as const) {
      for (const mask of CLOCK_TYPE_MASKS) {
        for (let k = 1; k < 12; k++) {
          const d = clockMoveDelta(side, mask, k);
          for (let c = 0; c < 4; c++) {
            expect(mod12(d[FRONT_CORNER_DIAL[c]] + d[BACK_CORNER_DIAL[c]]),
              `side=${side} mask=${mask} k=${k} corner=${c}`).toBe(0);
          }
        }
      }
    }
  });

  it('招式集恰好 30 种,且两两不同(15 种针脚组合 × 2 面)', () => {
    const seen = new Set<string>();
    for (const side of [0, 1] as const) {
      for (const mask of CLOCK_TYPE_MASKS) seen.add(clockMoveDelta(side, mask, 1).join(','));
    }
    expect(seen.size).toBe(30);
  });
});

describe('clock 记号往返', () => {
  it('parse → toString → parse 幂等,且状态不变', () => {
    const rng = rng32(7);
    for (let i = 0; i < 200; i++) {
      const state = randomClockState(rng);
      const moves = canonicalClockMoves(state, false);
      const applied = applyClockMoves(SOLVED_CLOCK(), moves);
      expect(applied.posit).toEqual(state.posit);
      const reparsed = parseClockMoves(clockScrambleForState(state));
      expect(applyClockMoves(SOLVED_CLOCK(), reparsed).posit).toEqual(state.posit);
    }
  });

  it('反推打乱与 tnoodle 打乱同形(14 个 token + y2),施加后回到该状态', () => {
    const rng = rng32(11);
    for (let i = 0; i < 100; i++) {
      const state = randomClockState(rng);
      const scr = clockScrambleForState(state);
      const toks = scr.split(' ');
      expect(toks).toHaveLength(15); // 9 正面 + y2 + 5 反面
      expect(toks[9]).toBe('y2');
      // 真实 WCA 打乱串末尾停在翻面态(rightSideUp=false),故按物理帧比对同一构型。
      const reached = applyClockScramble(scr);
      expect(reached.rightSideUp).toBe(false);
      expect(physicalPosit(reached)).toEqual(physicalPosit(state));
      // 站内自己的解析器也要给出同一个物理构型
      expect(physicalPosit(clockStateFromAlg(scr))).toEqual(physicalPosit(state));
    }
  });

  it('翻面态输入:求解与反推打乱都正确(视角帧 vs 物理帧不能混)', () => {
    const rng = rng32(1234);
    for (let i = 0; i < 60; i++) {
      const up = randomClockState(rng);
      // 同一构型的翻面写法
      const flipped: ClockState = {
        posit: [...up.posit.slice(9), ...up.posit.slice(0, 9)],
        rightSideUp: false,
      };
      expect(physicalPosit(flipped)).toEqual(physicalPosit(up));
      // 解:视角帧各自解各自的,步数必须一样(同一个物理构型)
      const a = solveClock(up), b = solveClock(flipped);
      expect(b.length).toBe(a.length);
      expect(isClockSolved(applyClockMoves(flipped, b.moves))).toBe(true);
      // 反推打乱:两种写法必须给出同一条打乱
      expect(clockScrambleForState(flipped)).toBe(clockScrambleForState(up));
    }
  });

  it('非法状态(角盘不联动)被拒', () => {
    const bad: ClockState = SOLVED_CLOCK();
    bad.posit[0] = 3; // 正面 UL 角盘动了,反面 11 没跟
    expect(invalidClockCorner(bad.posit)).toBe('UL');
    expect(() => solveClock(bad)).toThrow(/illegal clock state/);
  });
});

describe('clock 最优求解', () => {
  it('还原态 = 0 步', () => {
    const r = solveClock(SOLVED_CLOCK());
    expect(r.length).toBe(0);
    expect(r.notation).toBe('');
  });

  it('解施加回去必然还原(随机态)', () => {
    const rng = rng32(2026);
    for (let i = 0; i < 120; i++) {
      const state = randomClockState(rng);
      const sol = solveClock(state);
      expect(isClockSolved(applyClockMoves(state, sol.moves)), sol.notation).toBe(true);
      expect(sol.moves).toHaveLength(sol.length);
      // 同一种 move type 不该出现两次(阿贝尔群,合并即更短)
      const keys = sol.moves.map((m) => `${m.side}:${m.mask}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('解不长于 WCA 规范 14 步分解', () => {
    const rng = rng32(99);
    for (let i = 0; i < 120; i++) {
      const state = randomClockState(rng);
      expect(solveClock(state).length).toBeLessThanOrEqual(canonicalClockMoves(state).length);
    }
  });

  it('对「已知 k 步可解」的状态,给出的步数 ≤ k(k ≤ 4 全枚举构造)', () => {
    const rng = rng32(31337);
    for (let trial = 0; trial < 60; trial++) {
      const k = 1 + Math.floor(rng() * 4);
      const picked = new Set<number>();
      while (picked.size < k) picked.add(Math.floor(rng() * 30));
      let state = SOLVED_CLOCK();
      for (const t of picked) {
        const side = (t < 15 ? 0 : 1) as 0 | 1;
        const mask = CLOCK_TYPE_MASKS[t % 15];
        state = applyClockMoves(state, [{ side, mask, amount: 1 + Math.floor(rng() * 11) }]);
      }
      expect(solveClock(state).length).toBeLessThanOrEqual(k);
    }
  });

  it('最优性:与深度 ≤ 2 的全枚举精确表逐个对账', () => {
    // 全枚举所有 ≤2 步可达的状态,记录真实最短步数,再要求求解器逐个命中。
    const vec = moveVectors14();
    const exact = new Map<number, number>();
    exact.set(0, 0);
    for (let t1 = 0; t1 < 30; t1++) {
      for (let a1 = 1; a1 < 12; a1++) {
        const v1 = vec[t1][a1];
        const k1 = encode14(v1);
        if (!exact.has(k1)) exact.set(k1, 1);
        for (let t2 = t1 + 1; t2 < 30; t2++) {
          for (let a2 = 1; a2 < 12; a2++) {
            const v2 = addVec(v1, vec[t2][a2]);
            const k2 = encode14(v2);
            if (!exact.has(k2)) exact.set(k2, 2);
          }
        }
      }
    }
    // 深度 1 的状态数必须正好 330(Jaap 表首档)
    expect([...exact.values()].filter((d) => d === 1)).toHaveLength(330);

    const rng = rng32(4242);
    const entries = [...exact.entries()];
    for (let i = 0; i < 400; i++) {
      const [key, depth] = entries[Math.floor(rng() * entries.length)];
      expect(solveClock(stateFromKey(key)).length, `key=${key}`).toBe(depth);
    }
  });
});

describe('clock 距离分布 vs Jaap 的 God 表', () => {
  it('全表求和 = 12^14', () => {
    const total = JAAP_DISTRIBUTION.reduce((a, b) => a + b, 0n);
    expect(total).toBe(12n ** 14n);
  });

  it('d ≤ 3 各档状态数由本仓库自己的招式模型独立枚举复现', () => {
    const vec = moveVectors14();
    // 收集所有 ≤3 步可达状态的 key(含重复),排序去重后按累计做差。
    const keys = new Float64Array(1 + 330 + 435 * 121 + 4060 * 1331);
    let n = 0;
    keys[n++] = 0;
    const cut: number[] = [1]; // cut[d] = 深度 ≤ d 的 tuple 数(未去重)
    for (let t1 = 0; t1 < 30; t1++) {
      for (let a1 = 1; a1 < 12; a1++) keys[n++] = encode14(vec[t1][a1]);
    }
    cut.push(n);
    for (let t1 = 0; t1 < 30; t1++) {
      for (let a1 = 1; a1 < 12; a1++) {
        const v1 = vec[t1][a1];
        for (let t2 = t1 + 1; t2 < 30; t2++) {
          for (let a2 = 1; a2 < 12; a2++) keys[n++] = encode14(addVec(v1, vec[t2][a2]));
        }
      }
    }
    cut.push(n);
    for (let t1 = 0; t1 < 30; t1++) {
      for (let a1 = 1; a1 < 12; a1++) {
        const v1 = vec[t1][a1];
        for (let t2 = t1 + 1; t2 < 30; t2++) {
          for (let a2 = 1; a2 < 12; a2++) {
            const v2 = addVec(v1, vec[t2][a2]);
            for (let t3 = t2 + 1; t3 < 30; t3++) {
              for (let a3 = 1; a3 < 12; a3++) keys[n++] = encode14(addVec(v2, vec[t3][a3]));
            }
          }
        }
      }
    }
    cut.push(n);
    expect(n).toBe(keys.length);

    const cumulative = cut.map((upTo) => {
      const slice = keys.slice(0, upTo);
      slice.sort();
      let distinct = 0;
      for (let i = 0; i < slice.length; i++) if (i === 0 || slice[i] !== slice[i - 1]) distinct++;
      return BigInt(distinct);
    });
    // cumulative[d] = 距离 ≤ d 的状态数 → 逐档做差得到 Jaap 表前 4 档
    expect(cumulative[0]).toBe(JAAP_DISTRIBUTION[0]);
    expect(cumulative[1] - cumulative[0]).toBe(JAAP_DISTRIBUTION[1]);
    expect(cumulative[2] - cumulative[1]).toBe(JAAP_DISTRIBUTION[2]);
    expect(cumulative[3] - cumulative[2]).toBe(JAAP_DISTRIBUTION[3]);
  }, 120_000);

  it('随机抽样的最优步数分布贴合 Jaap 表(均值 9.4337、上限 12)', () => {
    const rng = rng32(20260726);
    const N = 600;
    const hist = new Array<number>(13).fill(0);
    let sum = 0;
    for (let i = 0; i < N; i++) {
      const len = solveClock(randomClockState(rng)).length;
      expect(len).toBeLessThanOrEqual(12);
      hist[len]++;
      sum += len;
    }
    const mean = sum / N;
    // 理论均值 9.4337,单次抽样标准差 ≈0.9 → N=600 时标准误 ≈0.037,4σ 容差
    expect(Math.abs(mean - 9.4337)).toBeLessThan(0.15);
    // 8..11 档占全空间 99.6%,抽样里也该压倒性集中在这里
    const bulk = hist[8] + hist[9] + hist[10] + hist[11];
    expect(bulk / N).toBeGreaterThan(0.95);
  }, 120_000);
});

// ─── 测试自用的独立 14 维模型(不复用求解器内部的坐标切分) ──────────────────

/** vec[type][amount] = 该招式在 14 个自由坐标上的增量。type 0..14 = 正面,15..29 = 反面。 */
function moveVectors14(): number[][][] {
  const out: number[][][] = [];
  for (let t = 0; t < 30; t++) {
    const side = (t < 15 ? 0 : 1) as 0 | 1;
    const mask = CLOCK_TYPE_MASKS[t % 15];
    const byAmount: number[][] = [];
    for (let a = 0; a < 12; a++) {
      const d = clockMoveDelta(side, mask, a);
      byAmount.push(COORDS14.map((i) => d[i]));
    }
    out.push(byAmount);
  }
  return out;
}

function addVec(a: readonly number[], b: readonly number[]): number[] {
  const out = new Array<number>(14);
  for (let i = 0; i < 14; i++) {
    const v = a[i] + b[i];
    out[i] = v >= 12 ? v - 12 : v;
  }
  return out;
}

/** 14 位 12 进制打包成一个精确整数(12^14 ≈ 1.28e15 < 2^53)。 */
function encode14(v: readonly number[]): number {
  let k = 0;
  for (let i = 0; i < 14; i++) k = k * 12 + v[i];
  return k;
}

function stateFromKey(key: number): ClockState {
  const digits = new Array<number>(14);
  let k = key;
  for (let i = 13; i >= 0; i--) { digits[i] = k % 12; k = Math.floor(k / 12); }
  const posit = new Array<number>(18).fill(0);
  COORDS14.forEach((dial, i) => { posit[dial] = digits[i]; });
  for (let c = 0; c < 4; c++) posit[BACK_CORNER_DIAL[c]] = mod12(-posit[FRONT_CORNER_DIAL[c]]);
  return { posit, rightSideUp: true };
}
