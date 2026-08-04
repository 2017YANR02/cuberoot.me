/**
 * 中层还原(`humanize.ts`)。
 * =========================================================================
 *
 * 起因是用户的一句话:「我做的 PLL 实际上是 `R2 U' S' U2' S U' R2`」,而报告里印的是
 * `L2 U' B F' L2 F B' U' L2 U2`。两个中层各变成一对相对面,夹在中间的 `U2'` 被换名
 * 成 `L2` —— 因为做中层的时候中心核跟着转了,后面每一手都换了名。
 *
 * 所以这里的头号测试是**把那条公式按魔方的报法生成一遍,再要求重写器原样还原它**。
 * 生成器 `record()` 走的是和重写器相反的方向,两边只共用拆分表这一个事实;要是符号
 * 写反了,两边会在「重写结果 ≠ 原公式」上炸,而不是互相抵消。
 */

import { describe, it, expect } from 'vitest';

import { humanizeStream } from '@/app/[lang]/timer/_lib/reconstruct/humanize';
import { SLICE_PAIRS, sliceSplitTable, sliceExpansion } from '@/lib/slice-pair';
import { facePermFor, conjugateToken } from '@/app/[lang]/timer/_lib/reconstruct/orient';
import { htmMoves } from '@/app/[lang]/timer/_lib/reconstruct/htm';
import type { HtmMove } from '@/app/[lang]/timer/_lib/reconstruct/htm';
import { applyOneToken } from '@/app/[lang]/timer/_lib/cube/apply_token';
import { solved, facesEqual } from '@/app/[lang]/timer/_lib/cube/state';

const T = (s: string) => s.trim().split(/\s+/).filter(Boolean);

function apply(tokens: readonly string[]) {
  let st = solved(3);
  for (const t of tokens) st = applyOneToken(st, t);
  return st;
}

/** 中层 → 魔方会报的那一对 + 它把核心转了多少。拆分表反过来查。 */
function pairForSlice(slice: string): { pair: [string, string]; rotation: string } {
  for (const [key, v] of sliceSplitTable()) {
    if (v.slice === slice) {
      const [a, b] = key.split(' ');
      return { pair: [a, b], rotation: v.rotation };
    }
  }
  throw new Error(`no recorded pair for ${slice}`);
}

/**
 * 人的公式 → 魔方会报的那条流。
 *
 * 维护 ρ =「核心到这里为止转了多少」:普通一手报成 `ρ⁻¹ h ρ`;中层报成它那一对,
 * 并且 `ρ ← ρ·σ`。和 `humanizeStream` 的推导互为逆运算,见该文件头注。
 */
function record(human: readonly string[]): string[] {
  const out: string[] = [];
  let rho = '';
  for (const h of human) {
    // 反向:人的记号 → 魔方系里的记号,正是 `conjugateToken` 本来的方向。
    const inv = facePermFor(rho);
    if (/^[MES]/.test(h)) {
      // 人写的中层先搬回魔方那个系,再查它报成哪一对。
      const inFrame = conjugateToken(h, inv);
      if (!inFrame) throw new Error(`cannot reframe ${h}`);
      const { pair, rotation } = pairForSlice(inFrame);
      out.push(pair[0], pair[1]);
      rho = rho === '' ? rotation : `${rho} ${rotation}`;
    } else {
      const tok = conjugateToken(h, inv);
      if (!tok) throw new Error(`cannot reframe ${h}`);
      out.push(tok);
    }
  }
  return out;
}

/** 记号串 → HtmMove[]。`pairGap` 是相对面那两手之间的间隔,别的手用 `gap`。 */
function stamped(tokens: readonly string[], gap = 200, tight: ReadonlySet<number> = new Set()): HtmMove[] {
  let t = 0;
  return tokens.map((m, i) => {
    t += i === 0 ? gap : (tight.has(i) ? 12 : gap);
    return { m, ts: t, endTs: t, quarters: m.endsWith('2') ? 2 : 1, startIdx: i, endIdx: i };
  });
}

/**
 * 人的公式(**可以带转体**)→ 魔方会报的那条流 + 姿态流会认下来的每一次核心换格。
 *
 * `record()` 只走动作那一半;这个走全套,因为转体在动作流里一个字都没有 —— 它只在
 * 姿态流里。两条规矩:
 *
 *   - **中层**:报成一对相对面,核心转 σ,`ρ ← ρ·σ`;
 *   - **转体**:一手也不报,核心转 σ = ρ⁻¹ h ρ,`ρ ← ρ·σ⁻¹`(方向和中层相反,
 *     见 `humanize.ts` 的 `advance`)。
 *
 * 和重写器互为逆运算,只共用拆分表和 `conjugateToken` 两个事实。
 */
function recordWithCore(human: readonly string[], gap = 600): {
  moves: HtmMove[];
  core: { events: Array<{ tMs: number; token: string; angleRad: number }> };
} {
  const tokens: string[] = [];
  const tight = new Set<number>();
  /** 换格发生在「第几个报出来的记号」之前(中层的那次就在它自己那一对里)。 */
  const turns: Array<{ before: number; inPair: boolean; token: string }> = [];
  let rho = '';

  for (const h of human) {
    const inv = facePermFor(rho);
    if (/^[xyz]/.test(h)) {
      const sigma = conjugateToken(h, inv);
      if (!sigma) throw new Error(`cannot reframe ${h}`);
      turns.push({ before: tokens.length, inPair: false, token: sigma });
      rho = rho === '' ? invert(sigma) : `${rho} ${invert(sigma)}`;
      continue;
    }
    if (/^[MES]/.test(h)) {
      const inFrame = conjugateToken(h, inv);
      if (!inFrame) throw new Error(`cannot reframe ${h}`);
      const { pair, rotation } = pairForSlice(inFrame);
      turns.push({ before: tokens.length, inPair: true, token: rotation });
      tight.add(tokens.length + 1);
      tokens.push(pair[0], pair[1]);
      rho = rho === '' ? rotation : `${rho} ${rotation}`;
      continue;
    }
    const tok = conjugateToken(h, inv);
    if (!tok) throw new Error(`cannot reframe ${h}`);
    tokens.push(tok);
  }

  const moves = stamped(tokens, gap, tight);
  const last = moves.length > 0 ? moves[moves.length - 1].ts : 0;
  const events = turns.map(t => ({
    // 中层那次落在它自己那一对里;转体那次落在它后面第一手之前。收尾的转体(后面
    // 没有手了)排在最后一手之后 —— 拧完把魔方摆正正是这么发生的。
    tMs: t.before < moves.length
      ? moves[t.before].ts + (t.inPair ? 5 : -100)
      : last + 100,
    token: t.token,
    angleRad: t.token.endsWith('2') ? Math.PI : Math.PI / 2,
  }));
  return { moves, core: { events } };
}

/** 单个记号取逆。`x2` 自逆。 */
function invert(token: string): string {
  return token.endsWith('2') ? token : token.endsWith("'") ? token.slice(0, -1) : `${token}'`;
}

/**
 * 拆分表的**判据**:拿魔方模型枚举六个面 × 三种量 × 九个中层 × 九个转体,逐条搜。
 *
 * 这段搜索原本长在 `humanize.ts` 里。表要给 /recon 那边共用之后搬成了
 * `lib/slice-pair.ts` 的静态数据 —— 但「抄六个面 × 三个量的符号是给手误留位置」这条
 * 理由没变,所以搜索留在这里当 oracle:那张表写错一个撇号,下面第一条就红。
 */
function searchSplitTable(): Map<string, { slice: string; rotation: string }> {
  const suffixes = ['', "'", '2'];
  const opposite: Record<string, string> = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };
  const slices = ['M', 'E', 'S'].flatMap(f => suffixes.map(s => `${f}${s}`));
  const rotations = ['x', 'y', 'z'].flatMap(f => suffixes.map(s => `${f}${s}`));
  const out = new Map<string, { slice: string; rotation: string }>();
  for (const a of Object.keys(opposite)) {
    for (const sa of suffixes) {
      for (const sb of suffixes) {
        const pair = [`${a}${sa}`, `${opposite[a]}${sb}`];
        const goal = apply(pair);
        for (const slice of slices) {
          const hit = rotations.find(r => facesEqual(apply([slice, r]), goal));
          if (hit) { out.set(pair.join(' '), { slice, rotation: hit }); break; }
        }
      }
    }
  }
  return out;
}

describe('拆分表', () => {
  const table = sliceSplitTable();

  it('和魔方模型搜出来的一模一样', () => {
    const searched = searchSplitTable();
    expect(searched.size).toBe(18);
    expect(Object.fromEntries(table)).toEqual(Object.fromEntries(searched));
  });

  it('每一条都真的等价 —— 一对相对面 = 中层 + 转体', () => {
    expect(table.size).toBeGreaterThan(0);
    for (const [key, { slice, rotation }] of table) {
      expect(facesEqual(apply(T(key)), apply([slice, rotation]))).toBe(true);
    }
  });

  it('反过来也对 —— `M\' ≡ R\' L x`,/recon 那个 ⇄ 按钮吃的就是这一份', () => {
    for (const { slice } of SLICE_PAIRS) {
      const exp = sliceExpansion(slice);
      expect(exp, slice).toBeTruthy();
      expect(facesEqual(apply([slice]), apply([exp!.a, exp!.b, exp!.rotation])), slice).toBe(true);
    }
    expect(sliceExpansion("M'")).toEqual({ a: "R'", b: 'L', rotation: 'x' });
    expect(sliceExpansion('U')).toBeNull();
  });

  it('六个有序轴向 × 三种量 = 18 条', () => {
    expect(table.size).toBe(18);
  });

  it('转向相反的一对拆不开 —— `R L` 不是中层', () => {
    expect(table.has('R L')).toBe(false);
    expect(table.has("R' L'")).toBe(false);
    expect(table.has("U D")).toBe(false);
  });

  it('量不一样的一对拆不开', () => {
    expect(table.has("F2 B'")).toBe(false);
    expect(table.has('F B2')).toBe(false);
  });

  it('用户那把里的两对都在表里', () => {
    expect(table.get("F B'")).toBeTruthy();
    expect(table.get("B F'")).toBeTruthy();
  });
});

describe('humanizeStream —— 用户报的那条 PLL', () => {
  // 用户写的是 `U2'`,标准写法是 `U2`(半转没有方向),其余一字不改。
  const HUMAN = T("R2 U' S' U2 S U' R2");

  it('魔方的报法确实把中层变成一对相对面、并且换掉后面的名', () => {
    const rec = record(HUMAN);
    // 7 手里有两个中层,各变成两手 → 9 手。
    expect(rec).toHaveLength(9);
    // 夹在两个中层之间的那一手不再写成 U —— 这正是用户看到的 `L2`。
    const mid = rec[4];
    expect(mid.startsWith('U')).toBe(false);
    expect(mid.endsWith('2')).toBe(true);
  });

  it('重写回来就是那条公式,一个记号不差', () => {
    const rec = record(HUMAN);
    const tight = new Set([3, 6]);   // 两对相对面各自的第二手
    const { moves, merges } = humanizeStream(stamped(rec, 200, tight));
    expect(merges).toBe(2);
    expect(moves.map(m => m.m)).toEqual(HUMAN);
  });

  /**
   * 用户 2026-08-03 报的第二次:间隔判据把这把拦下来了(一对 15ms 合了、另一对
   * 95ms 没合),于是印出来的是 `R2 U' B' F R2 F' B U' R2`。中心块那条约束不看间隔,
   * 所以下面这两条现在都还原成公式。
   */
  it('间隔拉多开都还原 —— 判据是中心块回没回家,不是毫秒数', () => {
    const rec = record(HUMAN);
    for (const gap of [200, 2000]) {
      const { moves, merges } = humanizeStream(stamped(rec, gap));
      expect(merges, `gap=${gap}`).toBe(2);
      expect(moves.map(m => m.m), `gap=${gap}`).toEqual(HUMAN);
    }
  });

  it('只有一对挨得近也照样两对一起合 —— 只合一对抵消不掉', () => {
    const rec = record(HUMAN);
    // 旧判据在这条输入上正好合一对、漏一对,后面整段跟着换名。
    const { moves, merges } = humanizeStream(stamped(rec, 200, new Set([3])));
    expect(merges).toBe(2);
    expect(moves.map(m => m.m)).toEqual(HUMAN);
  });
});

describe('等价性 —— 重写只换写法,不换这把', () => {
  // 全是「中层成对出现、中心块回得了家」的真解法形状 —— 一步之内落单的中层不存在,
  // 那样的局面根本不算这一步做完了(见 `humanize.ts` 头注)。
  const cases: Array<[string, string[]]> = [
    ['一对 S', T("S U2 S' R")],
    ['一对 M', T("M U M' F")],
    ['一对 E', T("E R E' F")],
    ['两个 M2', T('M2 U M2 R')],
    ['H perm', T('M2 U M2 U2 M2 U M2')],
  ];

  for (const [name, human] of cases) {
    it(`${name}:重写后的谱子 + 剩下的转体 = 原流`, () => {
      const rec = record(human);
      const { moves, merges, rotation } = humanizeStream(stamped(rec, 200));
      expect(merges).toBeGreaterThan(0);
      const rewritten = [...moves.map(m => m.m), ...T(rotation)];
      expect(facesEqual(apply(rec), apply(rewritten))).toBe(true);
      expect(moves.map(m => m.m)).toEqual(human);
    });
  }
});

describe('录了姿态的把:中层不再靠时间猜,转体也写进去', () => {
  // 用户 2026-08-03 报的那两条,一字不改。报告里当时印出来的是
  //   `M R L' B2 R' L U M R L' B M M B M'`  和  `R B' R' F R B R' F' …`
  // —— 前者是中层只合对了一半(ρ 从此就错了),后者是转体压根没被认出来。
  const Z_PERM = T("M2 U2 M U M2 U M2 U M");
  const E_PERM = T("x' R U' R' D R U R' D' R U R' D R U' R' D' x");

  it('Z perm(全是中层):原样还原', () => {
    const { moves, core } = recordWithCore(Z_PERM);
    const r = humanizeStream(moves, { core });
    expect(r.moves.map(m => m.m)).toEqual(Z_PERM);
    expect(r.rotations).toEqual([]);      // 一个转体都没有,核心那几次都是中层带的
  });

  it('E perm(带转体):转体和它后面的换名一起对', () => {
    const { moves, core } = recordWithCore(E_PERM);
    const r = humanizeStream(moves, { core });
    const written = [...r.moves.map(m => m.m)];
    // 转体不在 `moves` 里(它不是一手),按时刻插回去才是整条谱子。
    expect(r.rotations.map(x => x.token)).toEqual(["x'", 'x']);
    expect(written).toEqual(E_PERM.filter(t => !/^[xyz]/.test(t)));
  });

  it('照着重写后的谱子拧,和魔方真报的那条流拧出来一样', () => {
    for (const [name, human] of [['Z perm', Z_PERM], ['E perm', E_PERM]] as const) {
      const { moves, core } = recordWithCore(human);
      const r = humanizeStream(moves, { core });
      // 谱子 = 动作 + 按时刻插进去的转体。等价性要连 ρ_final 一起算。
      const merged: string[] = [];
      let ri = 0;
      for (const m of r.moves) {
        while (ri < r.rotations.length && r.rotations[ri].tMs <= m.ts) merged.push(r.rotations[ri++].token);
        merged.push(m.m);
      }
      while (ri < r.rotations.length) merged.push(r.rotations[ri++].token);
      expect(facesEqual(apply(moves.map(m => m.m)), apply([...merged, ...T(r.rotation)])), name).toBe(true);
    }
  });

  it('核心没换过格 → 那些相对面就是两手真转,抵不抵消都不合', () => {
    // 同一条流,只差「有没有录姿态」。中心块判据会合,而核心说它一动没动 —— 姿态
    // 是实测,实测赢。
    const rec = record(T("S U2 S' R"));
    expect(humanizeStream(stamped(rec, 200)).merges).toBe(2);
    expect(humanizeStream(stamped(rec, 200), { core: { events: [] } }).merges).toBe(0);
  });

  it('`M2` 报成两对时并成一个,不写成 `M M`', () => {
    // 编码器按四分之一圈报,一个 M2 常常是 `R L' R L'` 两对。
    const { moves, core } = recordWithCore(T('M M'));
    const r = humanizeStream(moves, { core });
    expect(r.moves.map(m => m.m)).toEqual(['M2']);
  });

  it('认不出来的转体(`?`)一个字都不写,ρ 也不动 —— 写错比缺一个更糟', () => {
    const { moves } = recordWithCore(T("R U R'"));
    const r = humanizeStream(moves, {
      core: { events: [{ tMs: moves[1].ts - 100, token: '?', angleRad: 1 }] },
    });
    expect(r.rotations).toEqual([]);
    expect(r.moves.map(m => m.m)).toEqual(T("R U R'"));
  });
});

describe('判不准的要报出来 —— 少认一个中层和正常输出长得一样', () => {
  it('中心块配得上的那些不算判不准 —— 那是算出来的', () => {
    const rec = record(T("R2 U' S' U2 S U' R2"));
    expect(humanizeStream(stamped(rec, 200)).blindPairs).toBe(0);
  });

  it('落单、抵消不掉的那一对记一笔', () => {
    // 一对 `F B'` 孤零零站着:合了它中心块就回不了家,只能按两手真转写 —— 但它也
    // 可能真是个 `S'` 而这一步里另一半没被认出来,所以要说一句。
    const r = humanizeStream(stamped(T("F B' U2 R"), 12));
    expect(r.merges).toBe(0);
    expect(r.blindPairs).toBe(1);
  });

  it('录了姿态就一处都不用判', () => {
    const { moves, core } = recordWithCore(T("R2 U' S' U2 S U' R2"));
    const r = humanizeStream(moves, { core });
    expect(r.blindPairs).toBe(0);
    expect(r.moves.map(m => m.m)).toEqual(T("R2 U' S' U2 S U' R2"));
  });

  it('一对相对面都没有的把:没录姿态也不用判', () => {
    expect(humanizeStream(stamped(T("R U R' U' F R F'"), 200)).blindPairs).toBe(0);
  });
});

describe('不该合的不合', () => {
  it('跨过步骤边界不合 —— 边界也是「中心块必须在家」的那条线', () => {
    const rec = record(T("S U2 S' R"));
    expect(humanizeStream(stamped(rec, 200)).merges).toBe(2);
    // 把两个中层劈到两步里:各自那一步都抵消不掉,于是一对都不合。
    const cut = humanizeStream(stamped(rec, 200), { boundaries: new Set([2]) });
    expect(cut.merges).toBe(0);
  });

  it('转向相反的一对(`R L`)不是中层,再挨得近也不合', () => {
    expect(humanizeStream(stamped(T('R L U2'), 12)).merges).toBe(0);
  });

  it('没有设备时钟(整条流的时间戳挤成同一刻)照样还原 —— 判据不吃时间', () => {
    const rec = record(T("S U2 S' R"));
    const flat = rec.map((m, i) => ({
      m, ts: 0, endTs: 0, quarters: 1, startIdx: i, endIdx: i,
    }));
    const r = humanizeStream(flat);
    expect(r.merges).toBe(2);
    expect(r.moves.map(m => m.m)).toEqual(T("S U2 S' R"));
  });

  it('落单的 `M2` 不合 —— 它自己就把中心块转走了 x2', () => {
    // `M M` 报成 `R L' R L'`,合两对是 x·x = x2:中心块没回家,这一步就不算做完。
    // 真解法里 `M2` 总有伴(H perm 四个 M2 乘出来是恒等),那种才合 —— 见上面的等价性。
    const rec = record(T('M M'));
    expect(rec).toEqual(T("R L' R L'"));
    expect(humanizeStream(stamped(rec, 12)).merges).toBe(0);
  });

  it('空流 / 单手不炸', () => {
    expect(humanizeStream([]).moves).toEqual([]);
    expect(humanizeStream(htmMoves([{ m: 'R', ts: 10 }])).merges).toBe(0);
  });
});
