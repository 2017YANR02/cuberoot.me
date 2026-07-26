import { describe, it, expect } from 'vitest';
import { computeAoxr, aoxrKey } from '@/components/persons/logic/aoxr';
import type { WcaResultRow, WcaCompetition } from '@/lib/wca-person-api';

// 选手页 AoXR 列的口径回归。
// 值的算法必须与世界榜 /wca/wr_aoxr(stats-build/src/core/ao_rounds.ts)逐值一致,
// 否则同一场比赛两处显示不同数字;本页额外多一条「必须打满该项目全部轮次」的前提。
// fixture = 2023GENG02 耿暄一的真实三阶成绩(WCA API),期望值取自 stats/wr_aoxr.json:
//   Ao4R 4.21(该榜三阶第 1 行) / Ao3R 4.31 / Ao2R 4.84 —— 锁死,改算法必须主动改基线。

let nextId = 1;
const ROUND_IDS = ['1', '2', '3', 'f'];

function comp(id: string, start_date: string): WcaCompetition {
  return { id, name: id, city: '', country_iso2: 'CN', start_date, end_date: start_date };
}

/** 一场比赛某项目的 N 个轮次:averages 按时间序给(默认末位=决赛;roundIds 可显式指定轮次 id) */
function rounds(
  compId: string,
  averages: number[],
  opts: { eventId?: string; live?: boolean; roundIds?: string[] } = {},
): WcaResultRow[] {
  const eventId = opts.eventId ?? '333';
  const n = averages.length;
  return averages.map((average, i) => ({
    id: nextId++,
    competition_id: compId,
    event_id: eventId,
    // 2 轮 = 一轮 + 决赛,3 轮 = 一/二 + 决赛,以此类推
    round_type_id: opts.roundIds ? opts.roundIds[i] : (i === n - 1 ? 'f' : ROUND_IDS[i]),
    format_id: 'a',
    best: average > 0 ? average - 30 : average,
    average,
    pos: 1,
    attempts: [],
    ...(opts.live ? { live: true } : {}),
  } as WcaResultRow));
}

describe('computeAoxr — 与世界榜同口径', () => {
  // 三场真实比赛:轮次平均值直接取自 WCA API
  const comps = [
    comp('LinhaiNewcomers2025', '2025-03-15'),
    comp('DeqingSmallSpecial2026', '2026-04-26'),
    comp('StartofSummerBeijing2026', '2026-05-01'),
  ];
  const results = [
    ...rounds('LinhaiNewcomers2025', [455, 512]),
    ...rounds('DeqingSmallSpecial2026', [465, 456, 371]),
    ...rounds('StartofSummerBeijing2026', [399, 442, 410, 434]),
  ];
  const map = computeAoxr(results, comps);

  it('Ao4R = 4.21(世界榜三阶第 1 行)', () => {
    const cell = map.get(aoxrKey('StartofSummerBeijing2026', '333'))!;
    expect(cell.x).toBe(4);
    expect(cell.value).toBe(421);   // (399+442+410+434)/4 = 421.25 → 421
  });

  it('Ao3R = 4.31', () => {
    const cell = map.get(aoxrKey('DeqingSmallSpecial2026', '333'))!;
    expect(cell.x).toBe(3);
    expect(cell.value).toBe(431);   // 430.67 → 431
  });

  it('Ao2R = 4.84:.5 必须四舍五入进位,截断会写成 4.83 与世界榜差一', () => {
    const cell = map.get(aoxrKey('LinhaiNewcomers2025', '333'))!;
    expect(cell.x).toBe(2);
    expect(cell.value).toBe(484);   // 483.5 → 484
  });
});

describe('computeAoxr — 档位边界', () => {
  it('某轮平均 DNF → 该场掉一档(4 轮变 Ao3R,只算有效轮)', () => {
    const map = computeAoxr(
      rounds('C', [399, -1, 410, 434]),
      [comp('C', '2026-05-01')],
    );
    const cell = map.get(aoxrKey('C', '333'))!;
    expect(cell.x).toBe(3);
    expect(cell.value).toBe(414);   // (399+410+434)/3 = 414.33 → 414
  });

  it('5 轮以上是防御上限(WCA 不会出现)→ 留空,不算出查无此档的 Ao5R', () => {
    const map = computeAoxr(
      rounds('C', [500, 510, 520, 530, 540]),
      [comp('C', '2005-05-01')],
    );
    expect(map.get(aoxrKey('C', '333'))).toBeUndefined();
  });

  it('无有效平均(全 DNF / 只有单次的项目)→ 无值', () => {
    const map = computeAoxr(
      [...rounds('C', [-1, -1]), ...rounds('C', [0], { eventId: '333bf' })],
      [comp('C', '2026-05-01')],
    );
    expect(map.get(aoxrKey('C', '333'))).toBeUndefined();
    expect(map.get(aoxrKey('C', '333bf'))).toBeUndefined();
  });

  it('多盲无官方平均 → 整项排除(与世界榜一致)', () => {
    const map = computeAoxr(
      rounds('C', [3600, 3700], { eventId: '333mbf' }),
      [comp('C', '2026-05-01')],
    );
    expect(map.get(aoxrKey('C', '333mbf'))).toBeUndefined();
  });
});

describe('computeAoxr — 必须打满该项目全部轮次', () => {
  it('四轮的项目只打到复赛(无决赛轮)→ 无值,不冒充 Ao2R', () => {
    const map = computeAoxr(
      rounds('NanchangSummer2026', [996, 1069], { roundIds: ['1', '2'] }),
      [comp('NanchangSummer2026', '2026-07-18')],
    );
    expect(map.get(aoxrKey('NanchangSummer2026', '333'))).toBeUndefined();
  });

  it('打进决赛 → 照常出值(同样两轮,但这场只有两轮)', () => {
    const map = computeAoxr(
      rounds('C', [996, 1069], { roundIds: ['1', 'f'] }),
      [comp('C', '2026-07-18')],
    );
    const cell = map.get(aoxrKey('C', '333'))!;
    expect(cell.x).toBe(2);
    expect(cell.value).toBe(1033);   // 1032.5 → 1033
  });

  it('决赛平均 DNF 仍算打满 → 降一档,不整场作废', () => {
    const map = computeAoxr(
      rounds('C', [399, 442, 410, -1], { roundIds: ['1', '2', '3', 'f'] }),
      [comp('C', '2026-05-01')],
    );
    const cell = map.get(aoxrKey('C', '333'))!;
    expect(cell.x).toBe(3);
    expect(cell.value).toBe(417);    // (399+442+410)/3 = 417
  });

  it('组合决赛 c 算决赛;B-决赛 b 不算(A 决赛在其之后照常举行)', () => {
    const map = computeAoxr([
      ...rounds('Combined', [500, 520], { roundIds: ['d', 'c'] }),
      ...rounds('BFinal', [500, 520], { roundIds: ['1', 'b'] }),
    ], [comp('Combined', '2005-05-01'), comp('BFinal', '2005-06-01')]);
    expect(map.get(aoxrKey('Combined', '333'))!.x).toBe(2);
    expect(map.get(aoxrKey('BFinal', '333'))).toBeUndefined();
  });

  it('被淘汰的场次不占 PR 名次序列', () => {
    const map = computeAoxr([
      ...rounds('A', [500, 520], { roundIds: ['1', 'f'] }),          // 510 → PR1
      ...rounds('KnockedOut', [400, 410], { roundIds: ['1', '2'] }), // 无值:4.05 不该压后面的场次
      ...rounds('B', [480, 500], { roundIds: ['1', 'f'] }),          // 490 → 仍是 PR1
    ], [comp('A', '2026-06-01'), comp('KnockedOut', '2026-06-10'), comp('B', '2026-06-20')]);
    expect(map.get(aoxrKey('KnockedOut', '333'))).toBeUndefined();
    expect(map.get(aoxrKey('A', '333'))!.prRank).toBe(1);
    expect(map.get(aoxrKey('B', '333'))!.prRank).toBe(1);
  });

  it('直播场同样要打满:决赛未开打的进行中比赛不出值', () => {
    const map = computeAoxr(
      rounds('LiveOngoing', [400, 410], { roundIds: ['1', '2'], live: true }),
      [comp('LiveOngoing', '2026-06-10')],
    );
    expect(map.get(aoxrKey('LiveOngoing', '333'))).toBeUndefined();
  });
});

describe('computeAoxr — PR 名次(同档比同档,时间序 dense rank)', () => {
  // 2023GENG02 三阶 Ao4R 的真实连续片段(2025 全年),右注 = 该场 AoXR
  const fixture: [string, string, number[]][] = [
    ['ChengduSpringOpen2025', '2025-02-08', [440, 500, 487, 487]],    // 479
    ['XianCherryBlossom2025', '2025-04-04', [476, 488, 465, 487]],    // 479 — 与上一场同值
    ['BeijingSummer2025', '2025-05-17', [448, 484, 441, 472]],        // 461
    ['WarmUpSeattle2025', '2025-06-28', [463, 541, 472, 494]],        // 493
    ['WC2025', '2025-07-03', [517, 503, 483, 449]],                   // 488
    ['VietnamChampionship2025', '2025-08-15', [457, 484, 480, 502]],  // 481
    ['GuangzhouSmallCubes2025', '2025-11-09', [451, 436, 503, 513]],  // 476
    ['HongKongChampionship2025', '2025-11-15', [483, 497, 421, 416]], // 454
    ['BeijingOnly3x32025', '2025-11-23', [475, 447, 448, 415]],       // 446
    ['HangzhouWinter2025', '2025-11-29', [449, 440, 504, 450]],       // 461
  ];
  const comps = fixture.map(([id, d]) => comp(id, d));
  const results = fixture.flatMap(([id, , avgs]) => rounds(id, avgs));
  const map = computeAoxr(results, comps);

  it('名次 = 该场当时严格更快的不同值数 + 1,同值并列', () => {
    expect(fixture.map(([id]) => map.get(aoxrKey(id, '333'))!.prRank))
      .toEqual([1, 1, 1, 3, 3, 3, 2, 1, 1, 3]);
    // 4.79 出现两次:第二场仍是 PR1(并列),不因先到的同值降为 PR2
    expect(map.get(aoxrKey('ChengduSpringOpen2025', '333'))!.value).toBe(479);
    expect(map.get(aoxrKey('XianCherryBlossom2025', '333'))!.value).toBe(479);
    // 末场 4.61 与更早的 4.61 同值,但此时 4.54 / 4.46 已更快 → PR3(名次一经赋值即冻结)
    expect(map.get(aoxrKey('BeijingSummer2025', '333'))!.prRank).toBe(1);
    expect(map.get(aoxrKey('HangzhouWinter2025', '333'))!.prRank).toBe(3);
  });

  it('Ao3R 与 Ao4R 各排各的:轮数不同不可比', () => {
    const m = computeAoxr([
      ...rounds('BeijingWinter2026', [419, 384, 455, 439]),        // Ao4R 424
      ...rounds('DeqingSmallSpecial2026', [465, 456, 371]),        // Ao3R 431 — 比 4.24 慢
      ...rounds('StartofSummerBeijing2026', [399, 442, 410, 434]), // Ao4R 421
    ], [
      comp('BeijingWinter2026', '2026-01-10'),
      comp('DeqingSmallSpecial2026', '2026-04-26'),
      comp('StartofSummerBeijing2026', '2026-05-01'),
    ]);
    // 混档会让 4.31 落在 4.24 之后变 PR2;分档则它是 Ao3R 档的头一场 → PR1
    expect(m.get(aoxrKey('DeqingSmallSpecial2026', '333'))!.prRank).toBe(1);
    expect(m.get(aoxrKey('BeijingWinter2026', '333'))!.prRank).toBe(1);
    expect(m.get(aoxrKey('StartofSummerBeijing2026', '333'))!.prRank).toBe(1);
  });
});

describe('computeAoxr — 直播(非官方)分层', () => {
  const comps = [
    comp('OfficialA', '2026-06-01'),
    comp('LiveB', '2026-06-10'),
    comp('OfficialC', '2026-06-20'),
  ];
  const map = computeAoxr([
    ...rounds('OfficialA', [480, 500]),              // 490
    ...rounds('LiveB', [400, 410], { live: true }),  // 405 — 非官方,比两场官方都快
    ...rounds('OfficialC', [500, 520]),              // 510
  ], comps);

  it('含直播轮次的场次标非官方', () => {
    expect(map.get(aoxrKey('LiveB', '333'))!.unofficial).toBe(true);
    expect(map.get(aoxrKey('OfficialA', '333'))!.unofficial).toBe(false);
  });

  it('直播场不压官方序列:官方 5.10 是 PR2(只数官方的 4.90,不数直播的 4.05)', () => {
    expect(map.get(aoxrKey('OfficialC', '333'))!.prRank).toBe(2);
  });

  it('直播场自己的名次在「官方 + 直播」序列里算(4.05 是当时最快 → PR1)', () => {
    expect(map.get(aoxrKey('LiveB', '333'))!.prRank).toBe(1);
  });
});
