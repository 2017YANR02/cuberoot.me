/**
 * 异 tag 合并里「PR 段」的回归 —— golden fixtures(抓自 Python)没有 CR/NR + PR 的组合,
 * 而 comp 弹窗的复制按钮天天在发这种 events:一条真纪录 + 一条只是个人成绩的 PR。
 *
 * 原缺陷:reduceSegmentCn/En 只分 WR / NR / else,PR 掉进 else 被 ISO2_TO_CR 按选手国籍
 * 编成洲际纪录 —— 美国选手的 31.74 单次 PR2 被写成「31.74单次北美洲纪录NAR/WR6」,
 * 凭空造出一条不存在的 NAR。
 */
import { describe, it, expect } from 'vitest';
import {
  enrich,
  formatCombinedRecords,
  type RecordEvent,
  type RankFn,
} from '../src/utils/record_format';

const COMP = {
  comp_name: '北美魔方锦标赛 2026',
  comp_name_en: "Rubik's North American Championship 2026",
  comp_iso2: 'US',
  url: 'https://cuberoot.me/zh/wca/comp/NAC2026?event=555&round=3&view=result',
};

const base = (over: Partial<RecordEvent>): RecordEvent => ({
  tag: 'PR',
  rec_type: 'single',
  attempt_result: 3174,
  event_id: '555',
  person_name: 'Max Park',
  person_iso2: 'US',
  ...COMP,
  ...over,
});

const ranks = (m: Record<string, number>): RankFn => (eid, rt, ar) => m[`${eid}|${rt}|${ar}`] ?? null;

describe('reduceSegment PR branch', () => {
  it('NAR average + non-breaking PR2 single — PR 段写成 PR2,不冒充 NAR', () => {
    const events = [
      base({ tag: 'PR', rec_type: 'single', attempt_result: 3174, pr_rank: 2 }),
      base({ tag: 'NAR', rec_type: 'average', attempt_result: 3465 }),
    ].map(enrich);
    const out = formatCombinedRecords(events, ranks({ '555|average|3465': 3, '555|single|3174': 6 }));
    expect(out.cn).toBe('纪录快讯! 34.65五阶魔方平均北美洲纪录NAR/WR3 Max Park🇺🇸| 31.74单次PR2 | 北美魔方锦标赛 2026🇺🇸');
    expect(out.en).toBe("Breaking News! 34.65 5x5 NAR/WR3 Avg Max Park🇺🇸| 31.74 PR2 Single | Rubik's North American Championship 2026🇺🇸");
  });

  it('NR single + 真破 PR average — PR 段带个人纪录字样与 /WRn', () => {
    const events = [
      base({ tag: 'NR', rec_type: 'single', attempt_result: 3174 }),
      base({ tag: 'PR', rec_type: 'average', attempt_result: 3465, pr_rank: 1 }),
    ].map(enrich);
    const out = formatCombinedRecords(events, ranks({ '555|single|3174': 6, '555|average|3465': 3 }));
    expect(out.cn).toBe('纪录快讯! 31.74五阶魔方单次美国纪录🇺🇸NR/WR6 Max Park | 34.65平均个人纪录PR/WR3 | 北美魔方锦标赛 2026🇺🇸');
    expect(out.en).toBe("Breaking News! 31.74 5x5🇺🇸NR/WR6 Single Max Park | 34.65 PR/WR3 Avg | Rubik's North American Championship 2026🇺🇸");
  });

  it('无世界名次时 PR 段不挂 /WRn', () => {
    const events = [
      base({ tag: 'ER', rec_type: 'average', attempt_result: 3465, person_iso2: 'PL' }),
      base({ tag: 'PR', rec_type: 'single', attempt_result: 3174, person_iso2: 'PL', pr_rank: 1 }),
    ].map(enrich);
    const out = formatCombinedRecords(events, () => null);
    expect(out.cn).toContain('31.74单次个人纪录PR ');
    expect(out.cn).not.toContain('31.74单次欧洲纪录');
    expect(out.en).toContain('31.74 PR Single');
  });
});
