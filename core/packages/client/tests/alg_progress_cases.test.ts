/**
 * /alg/progress/cases 纯数据层。
 *
 * 排序是这页的产品本体(「最该回头看的排最前」),所以顺序全部用 toBe() 锁死:
 * 改了 weakness / 分层规则,这里必须跟着改期望值 —— 那正是要人看一眼的信号。
 */
import { describe, it, expect } from 'vitest';
import {
  collectCases, matchesFilter, sortCases, drillQueue, groupByPuzzle,
  canListUntouched, type SetCaseSource, type ProgressCase,
} from '@/lib/alg-progress-cases';
import { newSrsRec, type SrsRec } from '@/lib/alg-srs';
import type { CaseMarks } from '@/lib/trainer-marks';

const T0 = 1_800_000_000_000;   // 固定基准,不用 Date.now()
const DAY = 86_400_000;

/**
 * 造一条排期记录。`n`(复习次数)不给就由 `l` 推 —— 忘过 5 次却「一次没练过」的记录
 * 现实中不存在,而 `isDue` 在 `n === 0` 时直接判到期,拿这种记录测分层会测出假结果。
 */
function rec(over: Partial<SrsRec>): SrsRec {
  return { ...newSrsRec(), n: over.l ? over.l + 1 : 0, ...over };
}

const marks = (m: Record<string, { s?: 'learning' | 'mastered'; f?: 1 }>): CaseMarks =>
  Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { ...v, t: T0 }])) as CaseMarks;

describe('matchesFilter', () => {
  const base = { ps: '3x3/oll', puzzle: '3x3' as const, set: 'oll', key: 'a|1' };

  it('未学 = 没有状态,与星标无关', () => {
    expect(matchesFilter({ ...base, starred: false }, 'none')).toBe(true);
    expect(matchesFilter({ ...base, starred: true }, 'none')).toBe(true);
    expect(matchesFilter({ ...base, starred: true, status: 'learning' }, 'none')).toBe(false);
  });

  it('星标独立于状态', () => {
    expect(matchesFilter({ ...base, starred: true, status: 'mastered' }, 'star')).toBe(true);
    expect(matchesFilter({ ...base, starred: false, status: 'learning' }, 'star')).toBe(false);
  });

  it('状态档精确匹配', () => {
    expect(matchesFilter({ ...base, starred: false, status: 'learning' }, 'learning')).toBe(true);
    expect(matchesFilter({ ...base, starred: false, status: 'mastered' }, 'learning')).toBe(false);
  });
});

describe('collectCases', () => {
  const src = (over: Partial<SetCaseSource> = {}): SetCaseSource => ({
    puzzle: '3x3', set: 'oll',
    marks: marks({ 'a|1': { s: 'learning' }, 'a|2': { s: 'mastered', f: 1 }, 'a|3': { f: 1 } }),
    ...over,
  });

  it('按档拍平,墓碑不出现在任何一档', () => {
    const withTomb = src({
      marks: { ...src().marks, 'a|9': { t: T0 } },   // 清过标记留下的墓碑
      allKeys: ['a|1', 'a|2', 'a|3', 'a|9'],
    });
    expect(collectCases([withTomb], 'learning').map(c => c.key)).toEqual(['a|1']);
    expect(collectCases([withTomb], 'mastered').map(c => c.key)).toEqual(['a|2']);
    expect(collectCases([withTomb], 'star').map(c => c.key).sort()).toEqual(['a|2', 'a|3']);
    // 未学 = a|3(只星标没状态)+ a|9(墓碑,等同从没标过)。墓碑不会被收两遍
    expect(collectCases([withTomb], 'none').map(c => c.key).sort()).toEqual(['a|3', 'a|9']);
  });

  it('拿不到整套 key 时,未学只能给出「只星标没状态」的那部分', () => {
    // 虚拟集(LSLL):57 万 case 枚举不了,补集算不出来
    expect(collectCases([src()], 'none').map(c => c.key)).toEqual(['a|3']);
    expect(canListUntouched(src())).toBe(false);
    expect(canListUntouched(src({ allKeys: ['a|1'] }))).toBe(true);
  });

  it('带上记忆记录', () => {
    const r = rec({ l: 2, iv: 3 });
    const got = collectCases([src({ recs: { 'a|1': r } })], 'learning');
    expect(got[0].rec).toBe(r);
    expect(got[0].ps).toBe('3x3/oll');
  });
});

describe('sortCases', () => {
  const mk = (key: string, r?: SrsRec): ProgressCase =>
    ({ ps: '3x3/oll', puzzle: '3x3', set: 'oll', key, starred: false, rec: r });

  it('weak:忘得多的在前,没练过的垫底', () => {
    const list = [
      mk('never'),
      mk('lapse1', rec({ l: 1, iv: 10, ef: 2.4 })),
      mk('lapse3', rec({ l: 3, iv: 10, ef: 2.4 })),
      mk('lapse1-hard', rec({ l: 1, iv: 10, ef: 1.5 })),
    ];
    expect(sortCases(list, 'weak').map(c => c.key))
      .toEqual(['lapse3', 'lapse1-hard', 'lapse1', 'never']);
  });

  it('due:最快到期的在前,没练过的当立刻到期排最前', () => {
    const list = [
      mk('later', rec({ d: T0 + 5 * DAY })),
      mk('never'),
      mk('soon', rec({ d: T0 + DAY })),
    ];
    expect(sortCases(list, 'due').map(c => c.key)).toEqual(['never', 'soon', 'later']);
  });

  it('同分不抖:全序兜底到 ps + key', () => {
    const a: ProgressCase = { ps: '3x3/pll', puzzle: '3x3', set: 'pll', key: 'b|1', starred: false };
    const b: ProgressCase = { ps: '3x3/oll', puzzle: '3x3', set: 'oll', key: 'b|1', starred: false };
    expect(sortCases([a, b], 'weak').map(c => c.ps)).toEqual(['3x3/oll', '3x3/pll']);
    expect(sortCases([b, a], 'weak').map(c => c.ps)).toEqual(['3x3/oll', '3x3/pll']);
    expect(sortCases([a, b], 'set').map(c => c.ps)).toEqual(['3x3/oll', '3x3/pll']);
  });
});

describe('drillQueue', () => {
  const mk = (key: string, over: Partial<ProgressCase>): ProgressCase =>
    ({ ps: '3x3/oll', puzzle: '3x3', set: 'oll', key, starred: false, ...over });

  it('三层:到期且忘过 → 不熟 → 星标', () => {
    const q = drillQueue([
      mk('star-only', { starred: true }),
      mk('shaky', { status: 'learning' }),
      mk('due-lapsed', { status: 'mastered', rec: rec({ l: 2, d: T0 - DAY, iv: 4 }) }),
    ], T0);
    expect(q.map(c => c.key)).toEqual(['due-lapsed', 'shaky', 'star-only']);
  });

  it('已掌握、没到期、没忘过的不进队列', () => {
    const q = drillQueue([
      mk('solid', { status: 'mastered', rec: rec({ l: 0, d: T0 + 30 * DAY, iv: 30 }) }),
      mk('untouched', {}),
      mk('lapsed-but-not-due', { status: 'mastered', rec: rec({ l: 5, d: T0 + 9 * DAY, iv: 9 }) }),
    ], T0);
    expect(q).toEqual([]);
  });

  it('同层内忘得多的先练', () => {
    // 都没到期 ⟹ 同在「不熟」这层,层内只比薄弱度
    const q = drillQueue([
      mk('shaky-a', { status: 'learning', rec: rec({ l: 1, iv: 5, d: T0 + 5 * DAY }) }),
      mk('shaky-b', { status: 'learning', rec: rec({ l: 4, iv: 5, d: T0 + 5 * DAY }) }),
      mk('shaky-new', { status: 'learning' }),
    ], T0);
    expect(q.map(c => c.key)).toEqual(['shaky-b', 'shaky-a', 'shaky-new']);
  });

  it('「不熟」优先于「到期但没忘过」—— 后者不入队,由记忆模式照常排期', () => {
    const q = drillQueue([
      mk('due-clean', { status: 'mastered', rec: rec({ l: 0, d: T0 - DAY, iv: 2 }) }),
      mk('shaky', { status: 'learning' }),
    ], T0);
    expect(q.map(c => c.key)).toEqual(['shaky']);
  });
});

describe('groupByPuzzle', () => {
  it('按 puzzle 分组 —— 合练路由跨不了 puzzle', () => {
    const g = groupByPuzzle([
      { ps: '3x3/oll', puzzle: '3x3', set: 'oll', key: 'a|1', starred: true },
      { ps: 'skewb/l2l', puzzle: 'skewb', set: 'l2l', key: 'b|1', starred: true },
      { ps: '3x3/pll', puzzle: '3x3', set: 'pll', key: 'c|1', starred: true },
    ]);
    expect([...g.keys()]).toEqual(['3x3', 'skewb']);
    expect(g.get('3x3')!.map(c => c.set)).toEqual(['oll', 'pll']);
  });
});
