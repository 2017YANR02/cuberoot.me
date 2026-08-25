/**
 * 选手页自家数据源 vs WCA 官网的 parity。
 *
 * 背景:选手页首屏(资料 / 全部成绩 / 参赛比赛)以前直连 WCA 官网,官网从国内不通时整页
 * 卡在「加载中…」。现在主源换成自家库(migration 0098 的 wca_person_results),官网降级为
 * 后台增强。换源就必须证明两边算出来的东西一样 —— 尤其是这两处最容易错的:
 *   1. wca_person_ranks 的名次是**按 RANK_EVENTS 顺序的定长数组**,错一位整张 PR 表全错;
 *   2. profile.medals 有两套口径 —— 官网是「决赛前三」,而库里的 wca_fs_medals 是另一套
 *      (实测这位选手 2 银 5 铜 vs 官网 1 银 3 铜),拿错表填这个字段不会报错,只会悄悄不一样。
 *
 * fixture 是 2026-07-30 从 worldcubeassociation.org/api/v0 抓的真实响应(736 条成绩),
 * rows 按 wca_person_results 的行形状逐字段照搬 —— builder 写这张表时也是从同一份 dump
 * 逐字段照搬的,所以这里比的就是「装配逻辑」本身。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  RANK_EVENTS, buildPersonalRecords, countMedals, ranksByEvent,
  type MirrorResultRow,
} from '../src/utils/person_page';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface OfficialCell { best: number; world_rank: number; continent_rank: number; country_rank: number }
interface Fixture {
  wcaId: string;
  official: {
    competition_count: number;
    medals: { gold: number; silver: number; bronze: number; total: number };
    records: { world: number; continental: number; national: number; total: number };
    personal_records: Record<string, { single?: OfficialCell; average?: OfficialCell }>;
  };
  derived: { solves: number; attempts: number; resultCount: number; dnfRounds: number };
  rows: [string, string, string, string, number, number, number, number[], string, string][];
}

const fx: Fixture = JSON.parse(
  readFileSync(resolve(__dirname, 'fixtures/person_page_2017YANR02.json'), 'utf-8'),
);

interface Row extends MirrorResultRow { comp_id: string; format_id: string; attempts: number[] }
const rows: Row[] = fx.rows.map(([comp_id, event_id, round_type_id, format_id, pos, best, average, attempts]) => ({
  comp_id, event_id, round_type_id, format_id, pos, best, average, attempts,
}));

/** 造一条 wca_person_ranks 行:名次按 RANK_EVENTS 顺序摊进定长数组,无名次填 0(builder 就是这么写的)。 */
function ranksRow(kind: 'single' | 'average') {
  const pick = (f: keyof OfficialCell) =>
    RANK_EVENTS.map(ev => fx.official.personal_records[ev]?.[kind]?.[f] ?? 0);
  return {
    ranks_world: pick('world_rank'),
    ranks_continent: pick('continent_rank'),
    ranks_country: pick('country_rank'),
  };
}

describe('选手页自家源 vs WCA 官网', () => {
  it('fixture 本身就是官网那 736 条', () => {
    expect(rows).toHaveLength(736);
    expect(fx.derived.resultCount).toBe(736);
  });

  it('整轮 DNF 的成绩没被丢掉 —— 这正是 wca_results_flat 装不下、必须另开一张表的原因', () => {
    const dnfRounds = rows.filter(r => r.best <= 0);
    expect(dnfRounds).toHaveLength(7);
    // 都是真实存在的轮次(3 条盲拧 / 多盲),不是空行
    expect(dnfRounds.every(r => r.attempts.some(a => a !== 0))).toBe(true);
  });

  it('复原次数 / 尝试次数与页面显示一致(DNS 与空位不算尝试)', () => {
    let solves = 0, attempts = 0;
    for (const r of rows) for (const a of r.attempts) {
      if (a === 0 || a === -2) continue;
      attempts++;
      if (a > 0) solves++;
    }
    expect(solves).toBe(3229);
    expect(attempts).toBe(3317);
  });

  it('personal_records 与官网逐项逐档相等(值现算 + 名次按数组下标还原)', () => {
    const built = buildPersonalRecords(rows, ranksRow('single'), ranksRow('average'));
    const official = fx.official.personal_records;

    expect(Object.keys(built).sort()).toEqual(Object.keys(official).sort());
    for (const [ev, off] of Object.entries(official)) {
      for (const kind of ['single', 'average'] as const) {
        const o = off[kind];
        const b = built[ev]?.[kind];
        if (!o) { expect(b).toBeUndefined(); continue; }
        expect(b, `${ev}.${kind}`).toBeDefined();
        expect(b!.best, `${ev}.${kind}.best`).toBe(o.best);
        expect(b!.world_rank, `${ev}.${kind}.world`).toBe(o.world_rank);
        expect(b!.continent_rank, `${ev}.${kind}.continent`).toBe(o.continent_rank);
        expect(b!.country_rank, `${ev}.${kind}.country`).toBe(o.country_rank);
      }
    }
  });

  it('奖牌数与官网一致(决赛前三口径)', () => {
    const { gold, silver, bronze } = countMedals(rows);
    expect({ gold, silver, bronze }).toEqual({
      gold: fx.official.medals.gold,
      silver: fx.official.medals.silver,
      bronze: fx.official.medals.bronze,
    });
    // 数值锁死:官网这位选手 1 银 3 铜。改了口径就该在这里红一次。
    expect([gold, silver, bronze]).toEqual([0, 1, 3]);
  });

  it('名次数组下标严格对齐 RANK_EVENTS(错一位 = 整张 PR 表张冠李戴)', () => {
    expect(RANK_EVENTS).toHaveLength(21);
    // 活跃 17 项在前、4 个废止项在后 —— builder 与 person_ranks 表共用这个约定
    expect(RANK_EVENTS[16]).toBe('333mbf');
    expect(RANK_EVENTS.slice(17)).toEqual(['333ft', 'magic', 'mmagic', '333mbo']);

    const m = ranksByEvent([0, 5, 0, ...Array(18).fill(0)]);
    expect(m.get('222')).toBe(5);
    expect(m.has('333')).toBe(false);   // 0 = 无名次,不是「第 0 名」
    expect(m.has('444')).toBe(false);

    // 废止项也要能取到(这位选手的 333ft 世界第 247)
    const ft = ranksByEvent(RANK_EVENTS.map(ev => (ev === '333ft' ? 247 : 0)));
    expect(ft.get('333ft')).toBe(247);
  });
});
