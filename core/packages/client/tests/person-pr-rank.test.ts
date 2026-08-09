import { describe, it, expect } from 'vitest';
import { computePrRank } from '@/components/persons/logic/progress';
import { wcaResultRowKey, type WcaResultRow, type WcaCompetition } from '@/lib/wca-person-api';

// 单次 PR 名次必须把「平均里非最佳的把」也算进历史 solve 池:一把更早更快的非最佳把,
// 会压低后来更慢单次的名次。回归来源:2016LIUY24 / 444 —— 早场平均第 5 把 43.66 是 PR2,
// 后场 43.88 单次曾错误显示 PR2(应为 PR3,因 42.92 与 43.66 都更快且更早)。

function comp(id: string, start_date: string): WcaCompetition {
  return { id, name: id, city: '', country_iso2: 'CN', start_date, end_date: start_date };
}

function row(p: Partial<WcaResultRow> & Pick<WcaResultRow, 'id' | 'competition_id' | 'best' | 'attempts'>): WcaResultRow {
  return {
    event_id: '444', round_type_id: 'f', format_id: 'a', average: 0, pos: 1,
    ...p,
  } as WcaResultRow;
}

describe('computePrRank — 单次名次计入此前所有 solve(含非最佳把)', () => {
  // 厘秒:42.92=4292 43.66=4366 43.88=4388 ...
  const comps = [comp('compA', '2026-03-07'), comp('compB', '2026-06-20')];
  const A = row({ id: 1, competition_id: 'compA', best: 4292, average: 4602, attempts: [4747, 5086, 4694, 4292, 4366] });
  const B = row({ id: 2, competition_id: 'compB', best: 4388, average: 5276, attempts: [5993, 4912, 5268, 5649, 4388] });
  const ranks = computePrRank([A, B], comps);

  it('早场:42.92 单次=PR1,平均里的 43.66 把=PR2', () => {
    const a = ranks.get(wcaResultRowKey(A))!;
    expect(a.singleRank).toBe(1);
    expect(a.attemptRanks).toEqual([1, 2, 1, 1, 2]); // 4366 那把 = 2
  });

  it('后场:更慢更晚的 43.88 单次=PR3(不再是 PR2)', () => {
    const b = ranks.get(wcaResultRowKey(B))!;
    expect(b.singleRank).toBe(3);                 // 42.92 + 43.66 更快 → 第 3
    expect(b.attemptRanks[4]).toBe(3);            // 最好那把 == 单次列
    expect(b.attemptRanks).toEqual([6, 5, 7, 8, 3]);
  });

  it('单调性:更慢更晚的单次名次必 > 更早更快的非最佳把', () => {
    expect(ranks.get(wcaResultRowKey(B))!.singleRank!).toBeGreaterThan(ranks.get(wcaResultRowKey(A))!.attemptRanks[4]!);
  });

  it('平均维度独立按平均池排名', () => {
    expect(ranks.get(wcaResultRowKey(A))!.averageRank).toBe(1); // 46.02 先到
    expect(ranks.get(wcaResultRowKey(B))!.averageRank).toBe(2); // 52.76 次之
  });

  it('并列平均同名次,但分别占据后续名次位', () => {
    const tiedComps = [
      comp('avgA', '2026-01-01'),
      comp('avgB', '2026-02-01'),
      comp('avgC', '2026-03-01'),
      comp('avgD', '2026-04-01'),
      comp('avgE', '2026-05-01'),
    ];
    const averages = [334, 436, 436, 440, 451];
    const tiedRows = averages.map((average, index) => row({
      id: 10 + index,
      competition_id: tiedComps[index].id,
      event_id: '333',
      best: average - 20,
      average,
      attempts: [average - 20, average, average + 10],
    }));
    const tiedRanks = computePrRank(tiedRows, tiedComps);

    expect(tiedRanks.get(wcaResultRowKey(tiedRows[1]))!.averageRank).toBe(2);
    expect(tiedRanks.get(wcaResultRowKey(tiedRows[2]))!.averageRank).toBe(2);
    expect(tiedRanks.get(wcaResultRowKey(tiedRows[4]))!.averageRank).toBe(5);
  });

  it('并列单次和逐把同名次,但分别占据后续名次位', () => {
    const tiedComps = [
      comp('singleA', '2026-01-01'),
      comp('singleB', '2026-02-01'),
      comp('singleC', '2026-03-01'),
    ];
    const tiedRows = [400, 400, 500].map((best, index) => row({
      id: 20 + index,
      competition_id: tiedComps[index].id,
      event_id: '333',
      format_id: '1',
      best,
      attempts: [best],
    }));
    const tiedRanks = computePrRank(tiedRows, tiedComps);

    expect(tiedRanks.get(wcaResultRowKey(tiedRows[0]))!.singleRank).toBe(1);
    expect(tiedRanks.get(wcaResultRowKey(tiedRows[1]))!.singleRank).toBe(1);
    expect(tiedRanks.get(wcaResultRowKey(tiedRows[2]))!.singleRank).toBe(3);
    expect(tiedRanks.get(wcaResultRowKey(tiedRows[2]))!.attemptRanks).toEqual([3]);
  });

  it('keeps every round distinct when the upstream payload omits all database ids', () => {
    const noIdRows = [
      row({ competition_id: 'NoIds2026', event_id: '333', round_type_id: '1', best: 400, attempts: [400] }),
      row({ competition_id: 'NoIds2026', event_id: '333', round_type_id: 'f', best: 350, attempts: [350] }),
    ];
    const noIdRanks = computePrRank(noIdRows, [comp('NoIds2026', '2026-08-08')]);

    expect(noIdRanks.size).toBe(2);
    expect(noIdRanks.get(wcaResultRowKey(noIdRows[0]))?.singleRank).toBe(1);
    expect(noIdRanks.get(wcaResultRowKey(noIdRows[1]))?.singleRank).toBe(1);
  });
});
