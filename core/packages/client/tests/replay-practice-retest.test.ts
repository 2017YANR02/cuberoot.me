import { describe, expect, it } from 'vitest';
import type { TrainerSolve } from '@/lib/trainer-store';
import { practiceGroups, retestWindows } from '@/lib/replay-practice-retest';

function rep(i: number): TrainerSolve {
  return {i, caseKey:'pairs|W+', caseName:'W+', scramble:'', ms:1000, penalty:'ok',
    practiceSample:{id:String(i), startedAt:i, owner:'a', clock:'manual', conditions:'fixed'}};
}

describe('same-case retest windows', () => {
  it('separates timing source, setup, account and case, and ignores older unscoped records and duplicate IDs', () => {
    const original = rep(1);
    const variant = (id: number, field: string, value: string) => {
      const solve = rep(id);
      return {...solve, practiceSample:{...solve.practiceSample!, [field]:value}};
    };
    const groups = practiceGroups([original, original, {...rep(2), practiceSample:undefined},
      variant(3,'owner','b'), {...rep(4),caseKey:'other'}, variant(5,'conditions','random'), variant(6,'clock','cube:1')], 'a', 'pairs|W+');
    expect([...groups.values()].map(rows => rows.map(row => row.i))).toEqual([[1],[5],[6]]);
  });
  it('separates ordinary history, replay-specific drills and retests even for the same case and settings', () => {
    const tagged = (i: number, scope: string, role: 'recorded' | 'retest') => {
      const row = rep(i);
      return {...row, practiceSample: {...row.practiceSample!, replay: {scope, role}}};
    };
    const rows = [rep(1), tagged(2, 'this pair', 'recorded'), tagged(3, 'this pair', 'retest'),
      tagged(4, 'another solve', 'recorded'), tagged(5, 'another pair', 'retest')];
    const ids = (groups: ReturnType<typeof practiceGroups>) => Array.from(groups.values(), g => g.map(x => x.i));
    expect(ids(practiceGroups(rows, 'a', undefined, 'this pair', 'recorded'))).toEqual([[2]]);
    expect(ids(practiceGroups(rows, 'a', undefined, 'this pair'))).toEqual([[1], [3]]);
    expect(ids(practiceGroups(rows, 'a'))).toEqual([[1]]);
    expect(ids(practiceGroups(rows, 'b', undefined, 'this pair'))).toEqual([]);
  });
  it('keeps disjoint windows across practice, retries, penalties and deletions', () => {
    const attempts = Array.from({length:13}, (_, i) => rep(i + 1));
    attempts[8].penalty = 'DNF';
    attempts[9].penalty = '+2';
    const [group] = practiceGroups(attempts.reverse(), 'a').values();
    const baseline = retestWindows(group.slice(0,5), {});
    const plan = {before:baseline.before, afterAt:8};
    const comparison = retestWindows(group, plan);
    expect(comparison.before).toEqual(['1','2','3','4','5']);
    expect(comparison.after).toEqual(['8','9','10','11','12']);
    expect(comparison.afterTimes).toEqual(['1.000','DNF','3.000','1.000','1.000']);
    const edited = retestWindows(group.filter(row => row.i !== 9), {...plan,after:comparison.after});
    expect(edited.afterTimes).toHaveLength(4);
    expect(edited.after).not.toContain('13');
  });
});
