/**
 * record_format.ts golden 回归 —— fixtures 抓自上线前生产 Python `/opt/wca-monitor`
 * (record_format.py)的真实输出,锁住 TS 移植逐字符等价。
 *
 * 每个 case 两条断言:
 *   no_rank   — getRank 恒 null,验文案结构(无 /WRn);TS 主结构 oracle
 *   with_rank — getRank 返回 Python 当时用的真实 rank(fixtures 里记着),验 /WRn 插入位置
 *
 * 抓 fixtures 的 driver:.tmp/wca-monitor-ref/_golden_driver.py(每 case 跑两遍 Python)。
 * 覆盖 24 分支:WR/NR/CR(洲际)/PR(真破/非破/平)、单双纪录、同 tag/异 tag 合并、
 * FMC/MBLD/Mean/分钟时间、中英比赛名、中文括号名拆分。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  enrich,
  formatCombinedRecords,
  type RecordEvent,
  type RankFn,
} from '../../server/src/utils/record_format';

interface GoldenCase {
  name: string;
  input: { events: RecordEvent[] };
  with_rank: { cn: string; en: string; url: string; ranks: (number | null)[] };
  no_rank: { cn: string; en: string; url: string };
}

const here = path.dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(
  readFileSync(path.join(here, 'fixtures/record_format_golden.json'), 'utf-8'),
) as GoldenCase[];

const rankKey = (eid: string, rt: string, ar: number) => `${eid}|${rt}|${ar}`;

describe('record_format golden parity', () => {
  it('loaded all fixtures', () => {
    expect(golden.length).toBeGreaterThanOrEqual(24);
  });

  for (const c of golden) {
    it(`${c.name} — no /WRn structure`, () => {
      const events = c.input.events.map(enrich);
      const out = formatCombinedRecords(events, () => null);
      expect(out.cn).toBe(c.no_rank.cn);
      expect(out.en).toBe(c.no_rank.en);
      expect(out.url).toBe(c.no_rank.url);
    });

    it(`${c.name} — with /WRn`, () => {
      const rankMap = new Map<string, number | null>();
      c.input.events.forEach((e, i) => {
        rankMap.set(rankKey(e.event_id, e.rec_type, e.attempt_result), c.with_rank.ranks[i] ?? null);
      });
      const getRank: RankFn = (eid, rt, ar) => rankMap.get(rankKey(eid, rt, ar)) ?? null;
      const events = c.input.events.map(enrich);
      const out = formatCombinedRecords(events, getRank);
      expect(out.cn).toBe(c.with_rank.cn);
      expect(out.en).toBe(c.with_rank.en);
      expect(out.url).toBe(c.with_rank.url);
    });
  }
});
