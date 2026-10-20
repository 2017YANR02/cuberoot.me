import { describe, expect, it } from 'vitest';
import type { AlgCase } from '@cuberoot/shared/alg';
import casesJson from './fixtures/f2l-insertion-cases.json';
import { groupF2lSolutions, f2lStateKey, isF2lStandard } from '@/lib/f2l-solution-groups';
import { getCube3 } from '@/lib/cube3';
import { alignAlgFile, commonCaseSetup } from '@/lib/alg_case_alignment';

const cases = casesJson as AlgCase[];
const w = cases.find(c => c.name === 'W+')!;
const entries = ["U' R U R' U' R U2' R'", "U' R U R' U R' F R F'"].map(alg => ({ alg }));

describe('F2L standard insertion references', () => {
  it('groups the existing W+ examples at their actual four-move boundary', async () => {
    const result = await groupF2lSolutions(cases, w.setup, entries, 0);
    expect(result.ungrouped).toEqual([]);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].prefix).toBe("U' R U R'");
    expect(result.groups[0].sourceIndices).toEqual([0, 1]);
    expect(result.groups[0].options.filter(o => o.source === 'standard')).toHaveLength(2);
    expect(result.groups[0].options.filter(o => o.source === 'original').map(o => o.alg)).toEqual(["U' R U2' R'"]);
    const solved = (await getCube3()).defaultPattern();
    for (const choice of result.groups[0].options) {
      expect(f2lStateKey(solved.applyAlg(w.setup).applyAlg(choice.fullAlg))).toBe(f2lStateKey(solved));
    }
  });

  it('uses current standard formulas, including edits and removals, without rewriting the source', async () => {
    const before = JSON.stringify(entries);
    const original = (await groupF2lSolutions(cases, w.setup, entries, 0)).groups[0];
    const updated = cases.map(c => c.id === original.standardId
      ? { ...c, algs: c.algs.map((rows, oi) => oi === 0 ? [{ alg: `${rows[0].alg} R R'` }] : rows) } : c);
    const next = (await groupF2lSolutions(updated, w.setup, entries, 0)).groups[0];
    const linked = next.options.filter(o => o.source === 'standard');
    expect(linked).toHaveLength(1);
    expect(linked[0].fullAlg.endsWith("R R'")).toBe(true);
    expect(next.options.filter(o => o.source === 'original')).toHaveLength(2);
    expect(JSON.stringify(entries)).toBe(before);
  });

  it('keeps invalid and unrecognized originals visible', async () => {
    const result = await groupF2lSolutions(cases, w.setup, [{ alg: "U' R U R' F" }, { alg: '@bad' }], 0);
    expect(result.groups).toEqual([]);
    expect(result.ungrouped).toEqual([0, 1]);
  });

  it.each([0, 1, 2, 3])('verifies every offered composition in orientation %i', async ori => {
    const setup = commonCaseSetup('3x3', 'f2l', w, ori);
    const result = await groupF2lSolutions(cases, setup, w.algs[ori], ori);
    const solved = (await getCube3()).defaultPattern();
    for (const group of result.groups) for (const choice of group.options) {
      expect(f2lStateKey(solved.applyAlg(setup).applyAlg(choice.fullAlg))).toBe(f2lStateKey(solved));
    }
    expect([...result.ungrouped, ...result.groups.flatMap(g => g.sourceIndices)].sort((a,b) => a-b))
      .toEqual(w.algs[ori].map((_, i) => i));
  });

  it('covers the complete existing library and every slot without losing source rows', async () => {
    const file = await alignAlgFile({ puzzle: '3x3', set: 'f2l', cases, scrapedAt: '', source: '' });
    const solved = (await getCube3()).defaultPattern();
    let slots = 0, sources = 0, grouped = 0, groups = 0, choices = 0;
    expect(file.cases).toHaveLength(41);
    for (const c of file.cases) for (const [ori, rows] of c.algs.entries()) {
      slots++;
      if (isF2lStandard(c)) continue;
      const setup = commonCaseSetup('3x3', 'f2l', c, ori);
      const result = await groupF2lSolutions(file.cases, setup, rows, ori);
      expect([...result.ungrouped, ...result.groups.flatMap(g => g.sourceIndices)].sort((a,b) => a-b), `${c.name}/${ori}`)
        .toEqual(rows.map((_, i) => i));
      sources += rows.length;
      grouped += result.groups.reduce((n, g) => n + g.sourceIndices.length, 0);
      groups += result.groups.length;
      for (const group of result.groups) for (const choice of group.options) {
        choices++;
        expect(f2lStateKey(solved.applyAlg(setup).applyAlg(choice.fullAlg)), `${c.name}/${ori}: ${choice.fullAlg}`)
          .toBe(f2lStateKey(solved));
      }
    }
    expect(slots).toBe(164);
    expect({ slots, sources, grouped, groups, choices }).toEqual({
      slots: 164, sources: 570, grouped: 380, groups: 304, choices: 665,
    });
  });
});
