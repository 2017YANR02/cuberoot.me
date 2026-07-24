// 公式记忆调度引擎(lib/alg-srs.ts)。全是纯函数,直测:
// 排期(SM-2 变体)、卡片分档、队列组装、多设备合并、每日活跃/热力图。
// 基准数值用 toBe() 锁死 —— 改算法要主动改这里的期望值,当 review 信号。
import { describe, it, expect } from 'vitest';
import {
  scheduleNext, previewIntervals, newSrsRec, recentGrades, histAt, srsPhase, isDue,
  summarizeSrs, dueForecast, retention, weakness, buildSrsQueue, gradeFromSolve,
  mergeSrs, bumpDaily, streakDays, mergeDaily, dayKey, heatmapGrid,
  EF_DEFAULT, MASTER_DAYS, HIST_LEN,
  type SrsRecs, type SrsDaily, type SrsRec,
} from '@/lib/alg-srs';

const DAY = 86_400_000;
const T0 = new Date('2026-07-24T12:00:00').getTime();

/** 连着按同一个评分打 n 次分,返回最终记录(fuzz = 0,可复现)。 */
function drill(grades: number[], start?: SrsRec): SrsRec {
  let r = start;
  let t = T0;
  for (const g of grades) {
    r = scheduleNext(r, g as 0 | 1 | 2 | 3, t, 0);
    t += Math.max(r.iv, 1) * DAY;
  }
  return r!;
}

describe('scheduleNext — 新卡起步', () => {
  it('新卡「记得」= 1 天后再见', () => {
    const r = scheduleNext(undefined, 2, T0, 0);
    expect(r.iv).toBe(1);
    expect(r.d).toBe(T0 + DAY);
    expect(r.n).toBe(1);
    expect(r.st).toBe(1);
    expect(r.l).toBe(0);
    expect(r.ef).toBe(EF_DEFAULT);
  });

  it('新卡「秒答」= 3 天,且 EF 提高', () => {
    const r = scheduleNext(undefined, 3, T0, 0);
    expect(r.iv).toBe(3);
    expect(r.ef).toBeCloseTo(EF_DEFAULT + 0.1, 6);
  });

  it('新卡「犹豫」不排到明天,而是本场重来(iv=0, due=now)', () => {
    const r = scheduleNext(undefined, 1, T0, 0);
    expect(r.iv).toBe(0);
    expect(r.d).toBe(T0);
    expect(r.st).toBe(1);      // 犹豫也算想起来了,连对不清零
    expect(r.l).toBe(0);
  });

  it('新卡「忘了」= 本场重来 + 记一次遗忘', () => {
    const r = scheduleNext(undefined, 0, T0, 0);
    expect(r.iv).toBe(0);
    expect(r.d).toBe(T0);
    expect(r.l).toBe(1);
    expect(r.st).toBe(0);
    expect(r.ef).toBeCloseTo(EF_DEFAULT - 0.3, 6);
  });
});

describe('scheduleNext — 间隔增长', () => {
  it('连续「记得」间隔按 EF 放大(1 → 2 → 5 → 12 → 29 天)', () => {
    let r = scheduleNext(undefined, 2, T0, 0);
    const seen = [r.iv];
    let t = T0;
    for (let i = 0; i < 4; i++) {
      t += r.iv * DAY;
      r = scheduleNext(r, 2, t, 0);
      seen.push(r.iv);
    }
    expect(seen).toEqual([1, 2, 5, 12, 29]);
  });

  it('全程「秒答」比全程「记得」涨得快', () => {
    const good = drill([2, 2, 2, 2]);
    const easy = drill([3, 3, 3, 3]);
    expect(easy.iv).toBeGreaterThan(good.iv);
  });

  it('「犹豫」在已成形的卡上只涨 1.2 倍', () => {
    const r0 = drill([2, 2, 2]);              // iv = 5
    expect(r0.iv).toBe(5);
    const r1 = scheduleNext(r0, 1, T0 + 5 * DAY, 0);
    expect(r1.iv).toBe(6);                    // round(5 * 1.2)
    expect(r1.ef).toBeCloseTo(r0.ef - 0.15, 6);
  });

  it('间隔封顶 365 天', () => {
    let r = drill([3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]);
    r = scheduleNext(r, 3, T0 + 400 * DAY, 0);
    expect(r.iv).toBeLessThanOrEqual(365);
  });

  it('EF 下限 1.3:连挂也不会把间隔算成负数', () => {
    let r: SrsRec | undefined;
    for (let i = 0; i < 20; i++) r = scheduleNext(r, 0, T0 + i * DAY, 0);
    expect(r!.ef).toBe(1.3);
    expect(r!.iv).toBe(0);
    expect(r!.l).toBe(20);
  });
});

describe('scheduleNext — 遗忘后重学', () => {
  it('忘了 ⟹ 间隔清零;再「记得」从 1 天重新起步(不跳回原间隔)', () => {
    const grown = drill([2, 2, 2, 2]);        // iv = 12
    expect(grown.iv).toBe(12);
    const lapsed = scheduleNext(grown, 0, T0 + 12 * DAY, 0);
    expect(lapsed.iv).toBe(0);
    const relearned = scheduleNext(lapsed, 2, T0 + 12 * DAY, 0);
    expect(relearned.iv).toBe(1);
    expect(relearned.l).toBe(1);              // 遗忘计数留着,是这张卡的历史
  });
});

describe('scheduleNext — 抖动', () => {
  it('≤3 天不抖(否则会跑到「今天」)', () => {
    expect(scheduleNext(undefined, 2, T0, 1).iv).toBe(1);
    expect(scheduleNext(undefined, 3, T0, -1).iv).toBe(3);
  });

  it('长间隔按 ±5% 抖,把整套同一天到期的卡摊开', () => {
    const r = drill([2, 2, 2, 2]);            // iv = 12
    const lo = scheduleNext(r, 2, T0, -1).iv;
    const hi = scheduleNext(r, 2, T0, 1).iv;
    expect(hi).toBeGreaterThan(lo);
    expect(hi - lo).toBeLessThanOrEqual(4);
  });
});

describe('previewIntervals', () => {
  it('四个按钮的预览与真正打分一致', () => {
    const r = drill([2, 2]);
    const p = previewIntervals(r, T0);
    expect(p[0]).toBe(scheduleNext(r, 0, T0, 0).iv);
    expect(p[2]).toBe(scheduleNext(r, 2, T0, 0).iv);
    expect(p[0]).toBe(0);
    expect(p[3]).toBeGreaterThan(p[2]);
  });
});

describe('评分历史(2bit 位串)', () => {
  it('最新的在低位,最多留 12 次', () => {
    const r = drill([2, 3, 0, 2]);
    expect(recentGrades(r)).toEqual([2, 0, 3, 2]);
    expect(histAt(r, 0)).toBe(2);
    expect(histAt(r, 3)).toBe(2);
    expect(histAt(r, 4)).toBe(null);
  });

  it('超过 12 次只保留最近 12 次', () => {
    const r = drill(new Array(20).fill(2));
    expect(recentGrades(r).length).toBe(HIST_LEN);
    expect(r.n).toBe(20);
  });
});

describe('srsPhase / isDue', () => {
  it('没记录 = new,重学中 = relearn,间隔跨 21 天 = mature', () => {
    expect(srsPhase(undefined)).toBe('new');
    expect(srsPhase(newSrsRec())).toBe('new');
    expect(srsPhase(scheduleNext(undefined, 0, T0, 0))).toBe('relearn');
    expect(srsPhase(scheduleNext(undefined, 2, T0, 0))).toBe('young');
    const mature = drill([2, 2, 2, 2, 2]);    // iv = 29 ≥ 21
    expect(mature.iv).toBeGreaterThanOrEqual(MASTER_DAYS);
    expect(srsPhase(mature)).toBe('mature');
  });

  it('没练过的卡永远算到期(要先学它)', () => {
    expect(isDue(undefined, T0)).toBe(true);
    const r = scheduleNext(undefined, 2, T0, 0);
    expect(isDue(r, T0)).toBe(false);
    expect(isDue(r, T0 + DAY)).toBe(true);
  });
});

describe('summarizeSrs', () => {
  const recs: SrsRecs = {
    a: drill([2]),                     // young, 明天到期
    b: drill([2, 2, 2, 2, 2]),         // mature
    c: scheduleNext(undefined, 0, T0, 0),  // relearn, 立刻到期
    d: newSrsRec(),                    // 重置过的卡:n=0,不计入
  };

  it('分档 + 到期计数', () => {
    const s = summarizeSrs(recs, T0);
    expect(s.tracked).toBe(3);
    expect(s.young).toBe(1);
    expect(s.mature).toBe(1);
    expect(s.relearn).toBe(1);
    expect(s.due).toBe(1);             // 只有 c
    expect(s.lapses).toBe(1);
  });

  it('keys 过滤掉已下线的 case', () => {
    const s = summarizeSrs(recs, T0, new Set(['a']));
    expect(s.tracked).toBe(1);
    expect(s.young).toBe(1);
  });
});

describe('dueForecast', () => {
  it('过期的全算到第 0 格,其余按自然日落格', () => {
    const recs: SrsRecs = {
      overdue: { ...drill([2]), d: T0 - 5 * DAY },
      today: { ...drill([2]), d: T0 + 3600_000 },
      d3: { ...drill([2]), d: T0 + 3 * DAY },
      far: { ...drill([2]), d: T0 + 90 * DAY },
    };
    const f = dueForecast(recs, T0, 7);
    expect(f[0]).toBe(2);   // overdue + today
    expect(f[3]).toBe(1);
    expect(f.reduce((a, b) => a + b, 0)).toBe(3);  // far 超窗不计
  });
});

describe('retention', () => {
  it('只练过一次的卡不计入(还没经历过间隔)', () => {
    const { samples } = retention({ a: drill([2]) });
    expect(samples).toBe(0);
  });

  it('忘一次、对三次 ⟹ 保持率 2/3(第一次复习不计)', () => {
    const { rate, samples } = retention({ a: drill([2, 2, 0, 2]) });
    expect(samples).toBe(3);
    expect(rate).toBeCloseTo(2 / 3, 6);
  });
});

describe('weakness', () => {
  it('忘得多的排在前面', () => {
    const often = drill([2, 0, 2, 0, 2]);
    const clean = drill([2, 2, 2]);
    expect(weakness(often)).toBeGreaterThan(weakness(clean));
  });
});

describe('buildSrsQueue', () => {
  const mk = (iv: number, due: number, lapses = 0): SrsRec =>
    ({ ...newSrsRec(), iv, d: due, n: 3, l: lapses, t: T0 });

  it('到期卡按过期时长排,新卡掺在中间,总数受限', () => {
    const recs: SrsRecs = {
      d1: mk(3, T0 - 2 * DAY),
      d2: mk(3, T0 - 9 * DAY),
      d3: mk(3, T0 - 1 * DAY),
      later: mk(30, T0 + 30 * DAY),
    };
    const q = buildSrsQueue(['d1', 'd2', 'd3', 'later', 'n1', 'n2'], recs, T0, {
      newLimit: 2, sessionLimit: 10, fillExtra: false,
    });
    const dues = q.filter(x => x.kind === 'due').map(x => x.key);
    expect(dues).toEqual(['d2', 'd1', 'd3']);              // 过期最久的在最前
    expect(q.filter(x => x.kind === 'new').map(x => x.key)).toEqual(['n1', 'n2']);
    expect(q.some(x => x.key === 'later')).toBe(false);    // 没到期且没开加练
  });

  it('newLimit=0 只复习不学新的', () => {
    const q = buildSrsQueue(['d1', 'n1'], { d1: mk(3, T0 - DAY) }, T0, {
      newLimit: 0, sessionLimit: 10, fillExtra: false,
    });
    expect(q.map(x => x.key)).toEqual(['d1']);
  });

  it('sessionLimit 先满足到期卡,新卡让位', () => {
    const recs: SrsRecs = { a: mk(3, T0 - DAY), b: mk(3, T0 - DAY), c: mk(3, T0 - DAY) };
    const q = buildSrsQueue(['a', 'b', 'c', 'n1', 'n2'], recs, T0, {
      newLimit: 5, sessionLimit: 3, fillExtra: false,
    });
    expect(q.length).toBe(3);
    expect(q.every(x => x.kind === 'due')).toBe(true);
  });

  it('fillExtra 用没到期里最弱的补满本场', () => {
    const recs: SrsRecs = {
      weak: mk(4, T0 + 4 * DAY, 3),
      solid: mk(60, T0 + 60 * DAY, 0),
    };
    const q = buildSrsQueue(['weak', 'solid'], recs, T0, {
      newLimit: 0, sessionLimit: 5, fillExtra: true,
    });
    expect(q.map(x => x.key)).toEqual(['weak', 'solid']);
    expect(q.every(x => x.kind === 'extra')).toBe(true);
  });

  it('全新的一套:全是新卡,不超额度', () => {
    const q = buildSrsQueue(['a', 'b', 'c', 'd'], {}, T0, {
      newLimit: 2, sessionLimit: 20, fillExtra: true,
    });
    expect(q.map(x => x.key)).toEqual(['a', 'b']);
    expect(q.every(x => x.kind === 'new')).toBe(true);
  });

  it('空池 = 空队列', () => {
    expect(buildSrsQueue([], {}, T0, { newLimit: 5, sessionLimit: 20, fillExtra: true })).toEqual([]);
  });
});

describe('mergeSrs (LWW)', () => {
  it('本地更新的赢并回传', () => {
    const local: SrsRecs = { a: { ...newSrsRec(), n: 2, t: 200, iv: 5 } };
    const cloud: SrsRecs = { a: { ...newSrsRec(), n: 1, t: 100, iv: 1 } };
    const { merged, toUpload } = mergeSrs(local, cloud);
    expect(merged.a.iv).toBe(5);
    expect(toUpload).toHaveLength(1);
    expect(toUpload[0].k).toBe('a');
  });

  it('云端更新的赢,不回传', () => {
    const local: SrsRecs = { a: { ...newSrsRec(), n: 1, t: 100 } };
    const cloud: SrsRecs = { a: { ...newSrsRec(), n: 9, t: 300 } };
    const { merged, toUpload } = mergeSrs(local, cloud);
    expect(merged.a.n).toBe(9);
    expect(toUpload).toEqual([]);
  });

  it('时间相同 ⟹ 取云端(不产生无谓上传)', () => {
    const local: SrsRecs = { a: { ...newSrsRec(), n: 1, t: 100 } };
    const cloud: SrsRecs = { a: { ...newSrsRec(), n: 2, t: 100 } };
    const { merged, toUpload } = mergeSrs(local, cloud);
    expect(merged.a.n).toBe(2);
    expect(toUpload).toEqual([]);
  });

  it('只在一边的行都保留;本地没练过的空记录不回传', () => {
    const local: SrsRecs = { onlyLocal: { ...newSrsRec(), n: 3, t: 10 }, blank: newSrsRec() };
    const cloud: SrsRecs = { onlyCloud: { ...newSrsRec(), n: 1, t: 20 } };
    const { merged, toUpload } = mergeSrs(local, cloud);
    expect(Object.keys(merged).sort()).toEqual(['blank', 'onlyCloud', 'onlyLocal']);
    expect(toUpload.map(x => x.k)).toEqual(['onlyLocal']);
  });
});

describe('每日活跃', () => {
  it('bumpDaily 累加复习数与「忘了」数', () => {
    let d: SrsDaily = {};
    d = bumpDaily(d, T0, 2);
    d = bumpDaily(d, T0, 0);
    expect(d[dayKey(T0)]).toEqual([2, 1]);
  });

  it('连续天数从今天往回数;今天还没练不断链', () => {
    const daily: SrsDaily = {
      [dayKey(T0 - DAY)]: [5, 0],
      [dayKey(T0 - 2 * DAY)]: [3, 1],
      [dayKey(T0 - 4 * DAY)]: [9, 0],   // 断了一天
    };
    expect(streakDays(daily, T0)).toBe(2);
    expect(streakDays({ ...daily, [dayKey(T0)]: [1, 0] }, T0)).toBe(3);
  });

  it('从没练过 = 0 天', () => {
    expect(streakDays({}, T0)).toBe(0);
  });

  it('多设备合并每日日志取较大值', () => {
    const a: SrsDaily = { '2026-07-20': [10, 2], '2026-07-21': [4, 0] };
    const b: SrsDaily = { '2026-07-20': [7, 3], '2026-07-22': [6, 1] };
    expect(mergeDaily(a, b)).toEqual({
      '2026-07-20': [10, 3],
      '2026-07-21': [4, 0],
      '2026-07-22': [6, 1],
    });
  });
});

describe('gradeFromSolve — 计时成绩折算自评', () => {
  it('DNF = 忘了,+2 最多算犹豫', () => {
    expect(gradeFromSolve(1500, 'DNF', 2000)).toBe(0);
    expect(gradeFromSolve(1200, '+2', 2000)).toBe(1);
  });

  it('没有基线(本场成功成绩 < 3 把)一律算「记得」,不瞎猜快慢', () => {
    expect(gradeFromSolve(900, 'ok', null)).toBe(2);
  });

  it('按本场中位数分档:明显快 = 秒答,正常 = 记得,明显慢 = 犹豫', () => {
    const med = 2000;
    expect(gradeFromSolve(1400, 'ok', med)).toBe(3);   // 0.70×
    expect(gradeFromSolve(2000, 'ok', med)).toBe(2);   // 1.00×
    expect(gradeFromSolve(2600, 'ok', med)).toBe(2);   // 1.30×
    expect(gradeFromSolve(3200, 'ok', med)).toBe(1);   // 1.60×
  });
});

describe('heatmapGrid', () => {
  it('固定列数 × 7 行,未来格为 null,今天有数', () => {
    const daily: SrsDaily = { [dayKey(T0)]: [7, 1] };
    const grid = heatmapGrid(daily, T0, 12);
    expect(grid).toHaveLength(12);
    expect(grid.every(col => col.length === 7)).toBe(true);
    const todayCell = grid.flat().find(c => c && c.day === dayKey(T0));
    expect(todayCell?.n).toBe(7);
    // 今天之后的格子一律 null
    const last = grid[grid.length - 1];
    const idxToday = last.findIndex(c => c && c.day === dayKey(T0));
    expect(last.slice(idxToday + 1).every(c => c === null)).toBe(true);
  });
});
