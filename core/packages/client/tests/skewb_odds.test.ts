/**
 * 斜转精确概率的护栏。
 *
 * `lib/skewb-odds.ts` 里的常量全部在这里**现场重算**(`computeSkewbOdds()` 扫全 3,149,280 态 +
 * 四趟 BFS,约 2 秒),再逐个断言 —— 页面读的是常量,但常量不是抄的。
 *
 * 另一半是与外部表格(`.tmp/xlsx/Cube Odds.xlsx` 的 Skewb 页)对账:四个数逐位吻合、
 * 一个数被否掉(「纯 7 步三心换」不存在,是 8 步)、一组数口径不明未采纳。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  SKEWB_ODDS, SKEWB_PURE_CENTRE_3CYCLE, SKEWB_TOTAL, SKEWB_WCA_MIN_MOVES, SKEWB_WCA_SAMPLE,
  computeSkewbOdds,
} from '@/lib/skewb-odds';

const odds = computeSkewbOdds();
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('斜转:常量 == 现场重算', () => {
  it('整份数据逐字段相同', () => {
    expect(odds).toEqual(SKEWB_ODDS);
  });

  it('分布自洽:总和 = 3,149,280,上帝之数 11', () => {
    expect(odds.total).toBe(SKEWB_TOTAL);
    expect(sum(odds.histogram)).toBe(SKEWB_TOTAL);
    expect(odds.histogram.length - 1).toBe(11);
    for (const s of odds.steps) {
      expect(sum(s.hist), s.key).toBe(SKEWB_TOTAL);
      expect(s.seeds, s.key).toBe(s.hist[0]);
    }
  });

  it('「首层已还原」与首层步数分布的 0 步档是同一个数(全站一种说法)', () => {
    const layerCentre = odds.steps.find((s) => s.key === 'layerCentre')!;
    expect(odds.recognition.skipLayer).toBe(layerCentre.seeds);
  });
});

describe('斜转:与表格对账', () => {
  it('比赛口径分母 3,077,655 = 最优解 ≥ 7 步的态数', () => {
    expect(odds.wcaLegal).toBe(3_077_655);
    expect(sum(odds.histogram.slice(0, SKEWB_WCA_MIN_MOVES))).toBe(SKEWB_TOTAL - 3_077_655);
  });

  it('No bar 51,568 / No bar & no light 1,040 / Skip layer 3,110 逐位吻合', () => {
    expect(odds.recognition.noBar).toBe(51_568);
    expect(odds.recognition.noBarNoLight).toBe(1_040);
    expect(odds.recognition.skipLayer).toBe(3_110);
  });

  it('「U Perm」的 24 = 纯中心三循环,但它是 8 步不是 7 步', () => {
    const three = odds.centresOnly.find((r) => r.cycle === '3')!;
    // 表格给的 24/3,149,280 就是这一档:三循环里能 8 步解的那 24 个
    expect(three.byDist[8]).toBe(24);
    expect(SKEWB_PURE_CENTRE_3CYCLE).toEqual({ states: 24, moves: 8 });
    // 7 步不可能:角块全好的非还原态,最少就是 8 步
    const nonTrivialDepths = odds.centresOnly
      .filter((r) => r.cycle !== '')
      .flatMap((r) => Object.keys(r.byDist).map(Number));
    expect(Math.min(...nonTrivialDepths)).toBe(8);
    expect(three.byDist[7]).toBeUndefined();
  });

  it('那 24 个恰好是一条整体转向轨道 —— 24 | 3,149,280,且 1/p = 131,220', () => {
    expect(SKEWB_TOTAL / 24).toBe(131_220);
    expect(odds.wcaLegal / 24).toBeCloseTo(128_235.625, 3);
  });

  it('「0c..5c」那六格不可能是任何步数分布', () => {
    // 表格:2/16/112/490/400/60(分母 1080),约掉公因子是 1 : 8 : 56 : 245 : 200 : 30。
    // 若它是某个目标集的 BFS 分档,则 1 → 8 说明第 1 层没有碰撞;而斜转的 8 个生成元是 4 条轴
    // 各一对互逆(每条轴 3 阶),所以第 1 层的每个态里,同轴的两步一步回到第 0 层、一步落在第 1 层
    // —— 每个态至多带来 6 个新态,第 2 层不可能到 8×7。
    const sheet = [2, 16, 112, 490, 400, 60];
    const g = sheet[0];
    expect(sheet[1] / g).toBe(8);          // 第 1 层无碰撞
    expect(sheet[2] / sheet[1]).toBe(7);   // 第 2 层要 7 倍
    expect(7).toBeGreaterThan(6);          // 结构上限只有 6
    // 我们枚举出来的四条首步分布,第 2 层无一例外 ≤ 6 倍
    for (const s of odds.steps) {
      if (s.hist[1] !== 8 * s.hist[0]) continue;
      expect(s.hist[2] / s.hist[1], s.key).toBeLessThanOrEqual(6);
    }
  });

  it('那个 1080 分母确有其物:首层四角归位后剩 1,080 个 case —— 但分布对不上', () => {
    expect(odds.lastLayer.cases).toBe(1_080);
    expect(sum(Object.values(odds.lastLayer.byDist))).toBe(1_080);
    // 真实的 LL 步数分布是 1 / 24 / 60 / 303 / 468 / 224,不是表格那六个数
    expect(Object.values(odds.lastLayer.byDist)).toEqual([1, 24, 60, 303, 468, 224]);
    expect(Object.values(odds.lastLayer.byDist)).not.toEqual([2, 16, 112, 490, 400, 60]);
  });
});

describe('斜转:结构自证', () => {
  it('角块全好只剩中心 = 360 个态,轮型分布正是 A6 的共轭类', () => {
    expect(sum(odds.centresOnly.map((r) => r.total))).toBe(360);
    const byCycle = Object.fromEntries(odds.centresOnly.map((r) => [r.cycle, r.total]));
    // |A6| = 360:恒等 1、(2,2) 45、(3) 40、(3,3) 40、(4,2) 90、(5) 144
    expect(byCycle).toEqual({ '': 1, '2+2': 45, 3: 40, '3+3': 40, '4+2': 90, 5: 144 });
    // 中心块只能做偶置换:单个 2-轮换、单个 4-轮换这些奇置换一个都不出现
    expect(byCycle['2']).toBeUndefined();
    expect(byCycle['4']).toBeUndefined();
  });

  it('识别口径之间的包含关系', () => {
    const r = odds.recognition;
    expect(r.noBarNoLight).toBeLessThan(r.noBar);
    expect(r.noBarNoLight).toBeLessThan(r.noLight);
    expect(r.rainbow).toBeLessThan(r.noBarNoLight);
    expect(r.rainbow).toBe(296);
  });

  it('目标越严,0 步档越小、分布越靠后', () => {
    const by = Object.fromEntries(odds.steps.map((s) => [s.key, s]));
    expect(by.face.seeds).toBeGreaterThan(by.layer.seeds);
    expect(by.layer.seeds).toBeGreaterThan(by.layerCentre.seeds);
    const mean = (h: number[]) => h.reduce((a, n, d) => a + n * d, 0) / SKEWB_TOTAL;
    expect(mean(by.face.hist)).toBeLessThan(mean(by.layer.hist));
    expect(mean(by.layer.hist)).toBeLessThan(mean(by.layerCentre.hist));
  });
});

describe('斜转:WCA 真题印证', () => {
  const distPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../../stats/scramble/puzzle_distribution.json',
  );
  const wca = JSON.parse(readFileSync(distPath, 'utf8')).puzzles.skewb;

  it('副本与 stats JSON 一致,且真题最短就是 7 步', () => {
    expect(wca.sample_count).toBe(SKEWB_WCA_SAMPLE.sampleCount);
    expect(wca.dist.min).toBe(SKEWB_WCA_MIN_MOVES);
    for (const [d, n] of Object.entries(wca.dist.counts)) {
      expect(SKEWB_WCA_SAMPLE.counts[Number(d)], `d=${d}`).toBe(n);
    }
  });

  it('22.7 万条真题的逐档占比 ≈ 理论条件分布(最大偏差 < 0.1 个百分点)', () => {
    let worst = 0;
    for (let d = SKEWB_WCA_MIN_MOVES; d < odds.histogram.length; d++) {
      const theory = odds.histogram[d] / odds.wcaLegal;
      const seen = (SKEWB_WCA_SAMPLE.counts[d] ?? 0) / SKEWB_WCA_SAMPLE.sampleCount;
      worst = Math.max(worst, Math.abs(theory - seen) * 100);
    }
    expect(worst).toBeLessThan(0.1);
  });
});
