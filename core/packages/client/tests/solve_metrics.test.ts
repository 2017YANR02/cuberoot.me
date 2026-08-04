/**
 * 一把成绩的三个「手感」数字(步数 / TPS / 流畅),以及按天分组那几个工具。
 * =========================================================================
 *
 * 这三个数在报告页是走完整复盘链路算出来的(含 IDA*),在统计里不可能这么算 ——
 * 于是有了 `solve_metrics.ts` 的免搜索版本。**两条路必须给出同一个数**,所以这里
 * 把口径逐条钉死:
 *
 *   步数 = STM(中层记一个;和 `recon_text.ts` 的 `stm` 同义)
 *   TPS  = STM ÷ 这把的用时(不是首手到末手 —— 和详情页同一个分母)
 *   流畅 = 在转的时间 ÷ 首手到末手(`quality.ts` 的 `turningSplit`)
 *
 * 以及一条同样重要的:**没有动作流的成绩不进分母**。手动计时的把对这三个数没有
 * 发言权,让它们占分母只会把平均往下拽,而界面上看不出来为什么。
 */
import { describe, it, expect } from 'vitest';

import { solveMetrics, averageSolveMetrics } from '@/app/[lang]/timer/_lib/solve_metrics';
import { dayKeyOf, solveDayKeys } from '@/app/[lang]/timer/_lib/stats_buckets';
import type { Solve } from '@/app/[lang]/timer/_lib/types';

/** R / U / F 循环:三个面两两相邻,不会凑出相对面 —— 也就不会被认成中层,
 *  于是 STM == 面转数,这几条断言量的才是它们自己想量的东西。 */
const FACES = ['R', 'U', 'F'];

/** `count` 个 1/4 转,每 `gapMs` 一个;`pauseAt` 那一手之前多停 `pauseMs`。 */
function stream(count: number, gapMs: number, pauseAt = -1, pauseMs = 0) {
  const out: Array<{ m: string; ts: number }> = [];
  let ts = 0;
  for (let i = 0; i < count; i++) {
    if (i > 0) ts += gapMs + (i === pauseAt ? pauseMs : 0);
    out.push({ m: FACES[i % FACES.length], ts });
  }
  return out;
}

function solve(over: Partial<Solve> = {}): Solve {
  return {
    id: over.id ?? 's1',
    timeMs: 3000,
    penalty: 'ok',
    scramble: '',
    event: '333',
    ts: Date.UTC(2026, 7, 4, 12),
    ...over,
  };
}

describe('一把的步数 / TPS / 流畅', () => {
  it('不停顿的一把:STM = 面转数,流畅 100%', () => {
    // 12 手,每手 100ms:首手到末手 1.1s,全程在转。用时 3.0s → 12 / 3 = 4 tps。
    const m = solveMetrics(solve({ id: 'even', moves: stream(12, 100) }))!;
    expect(m.stm).toBe(12);
    expect(m.tps).toBeCloseTo(4, 6);
    expect(m.fluency).toBeCloseTo(100, 6);
  });

  it('中间停一下:停掉的那一段不算在「在转」里', () => {
    // 11 个间隔:十个 100ms + 一个 600ms。一手按 100ms 算(25 分位),
    // 于是停了 500ms,跨度 1600ms → 1100 / 1600。
    const m = solveMetrics(solve({ id: 'pause', moves: stream(12, 100, 6, 500) }))!;
    expect(m.stm).toBe(12);
    expect(m.fluency).toBeCloseTo(68.75, 2);
  });

  it('步数数的是记号,不是魔方转了几下面', () => {
    // 六个 1/4 转,写出来是 `R2 U2 F2` —— 三个记号。中层那一档的合并由
    // `recon_text.test.ts` 端到端锁着(同一把 turns 40 / stm 38),这里只钉住
    // 「STM 走的是合并后的流」这条接线。
    const moves = ['R', 'R', 'U', 'U', 'F', 'F'].map((m, i) => ({ m, ts: i * 100 }));
    expect(solveMetrics(solve({ id: 'dbl', moves }))!.stm).toBe(3);
  });

  it('TPS 的分母是这把的用时,不是首手到末手', () => {
    // 同一条动作流,只是成绩上的用时翻倍 → TPS 减半。拿跨度当分母的话这两把会
    // 一模一样,而详情页顶上那个 TPS 明明会变。
    const moves = stream(12, 100);
    const fast = solveMetrics(solve({ id: 'fast', moves, timeMs: 3000 }))!;
    const slow = solveMetrics(solve({ id: 'slow', moves, timeMs: 6000 }))!;
    expect(fast.tps).toBeCloseTo(4, 6);
    expect(slow.tps).toBeCloseTo(2, 6);
    expect(fast.fluency).toBeCloseTo(slow.fluency!, 6);  // 流畅只看动作流,不受影响
  });

  it('+2 罚时算进 TPS 的分母', () => {
    const m = solveMetrics(solve({ id: 'p2', moves: stream(12, 100), penalty: '+2' }))!;
    expect(m.tps).toBeCloseTo(12 / 5, 6);   // 3.0s + 2s
  });

  it('说不出话的那几种一律 null', () => {
    expect(solveMetrics(solve({ id: 'nomoves' }))).toBeNull();
    expect(solveMetrics(solve({ id: 'one', moves: [{ m: 'R', ts: 0 }] }))).toBeNull();
    // DNF/DNS 的用时是 Infinity,除出来的 TPS 没有意义。
    expect(solveMetrics(solve({ id: 'dnf', moves: stream(12, 100), penalty: 'DNF' }))).toBeNull();
    expect(solveMetrics(solve({ id: 'dns', moves: stream(12, 100), penalty: 'DNS' }))).toBeNull();
  });
});

describe('一段成绩的平均', () => {
  it('没有动作流的把不占分母', () => {
    const a = averageSolveMetrics([
      solve({ id: 'a', moves: stream(12, 100), timeMs: 3000 }),   // 4.00 tps
      solve({ id: 'b', moves: stream(12, 100), timeMs: 6000 }),   // 2.00 tps
      solve({ id: 'c' }),                                          // 手动计时,不算
      solve({ id: 'd', moves: stream(12, 100), penalty: 'DNF' }),  // DNF,不算
    ]);
    expect(a.n).toBe(2);
    expect(a.stm).toBeCloseTo(12, 6);
    expect(a.tps).toBeCloseTo(3, 6);
    expect(a.fluency).toBeCloseTo(100, 6);
  });

  it('一把智能魔方成绩都没有 → 三个都是 null', () => {
    const a = averageSolveMetrics([solve({ id: 'x' }), solve({ id: 'y' })]);
    expect(a).toEqual({ n: 0, stm: null, tps: null, fluency: null });
  });
});

describe('按天分组', () => {
  it('按本地时区切天,不是 UTC', () => {
    // 本地时间当天 23:30 那把属于当天 —— 用 UTC 切的话时区一偏就跑去了明天。
    const late = new Date(2026, 7, 4, 23, 30).getTime();
    expect(dayKeyOf(late)).toBe('2026-08-04');
    const early = new Date(2026, 7, 4, 0, 5).getTime();
    expect(dayKeyOf(early)).toBe('2026-08-04');
  });

  it('只列有成绩的天,升序去重', () => {
    const days = solveDayKeys([
      solve({ id: '1', ts: new Date(2026, 7, 4, 9).getTime() }),
      solve({ id: '2', ts: new Date(2026, 7, 1, 9).getTime() }),
      solve({ id: '3', ts: new Date(2026, 7, 4, 20).getTime() }),
    ]);
    expect(days).toEqual(['2026-08-01', '2026-08-04']);
  });
});
