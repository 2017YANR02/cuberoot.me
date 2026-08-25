import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AlgCase, AlgEntry } from '@cuberoot/shared';
import { ALG_CATALOG } from '@cuberoot/shared';
import { canonicalNnnAlg } from '@cuberoot/shared/alg-mirror';
import { puzzles } from 'cubing/puzzles';
import { goalOf, reachesGoal } from '@/lib/alg_goals';
import { caseThumbPlan } from '@/lib/alg_thumb_plan';
import { setupForCase, validateAlgCase } from '@/lib/alg_validation';
import { workspaceFixturePath } from './workspace-fixture-path';

type ImportedRow = Pick<AlgCase, 'name' | 'subgroup' | 'setup' | 'sticker' | 'algs'> & { position: number };
type ParityRow = { position: number; name: string; existing: boolean; canonicalKey: string; algs: AlgEntry[][] };
type ParityBaselineRow = { position: number; name: string; algs: string[] };

const migration = readFileSync(
  workspaceFixturePath('@cuberoot/server', 'migrations', '0109_cubingapp_beginner_ll.sql'),
  'utf8',
);

function jsonBlock<T>(tag: string): T {
  const match = migration.match(new RegExp(`\\$${tag}\\$([\\s\\S]*?)\\$${tag}\\$`));
  if (!match) throw new Error(`missing migration payload ${tag}`);
  return JSON.parse(match[1]) as T;
}

const oll = jsonBlock<ImportedRow[]>('cubingapp_2look_oll');
const pll = jsonBlock<ImportedRow[]>('cubingapp_2look_pll');
const parity = jsonBlock<ParityRow[]>('cubingapp_4x4_pll_parity');
const parityBaseline = JSON.parse(readFileSync(
  workspaceFixturePath('@cuberoot/alg-build', 'fixtures', '4x4-pll-parity-baseline.json'),
  'utf8',
)) as ParityBaselineRow[];
const parityBaselineByName = new Map(parityBaseline.map(item => [item.name, item]));

describe('CubingApp beginner LL port', () => {
  it('registers both sets beside full OLL and PLL', () => {
    const slugs = ALG_CATALOG['3x3'].map(item => item.slug);
    expect(slugs.indexOf('2-look-oll')).toBeLessThan(slugs.indexOf('oll'));
    expect(slugs.indexOf('2-look-pll')).toBeLessThan(slugs.indexOf('pll'));
  });

  it('imports every source case, algorithm, subgroup and note', () => {
    expect(oll).toHaveLength(9);
    expect(oll.flatMap(item => item.algs[0])).toHaveLength(9);
    expect(oll.filter(item => item.subgroup === 'Edges')).toHaveLength(2);
    expect(oll.filter(item => item.subgroup === 'Corners')).toHaveLength(7);
    expect(oll.flatMap(item => item.algs[0]).filter(item => item.note)).toHaveLength(6);

    expect(pll).toHaveLength(6);
    expect(pll.flatMap(item => item.algs[0])).toHaveLength(10);
    expect(pll.filter(item => item.subgroup === 'Corners')).toHaveLength(2);
    expect(pll.filter(item => item.subgroup === 'Edges')).toHaveLength(4);
    expect(pll.flatMap(item => item.algs[0]).filter(item => item.note)).toHaveLength(4);

    for (const item of [...oll, ...pll]) {
      expect(item.setup.trim()).not.toBe('');
      for (const entry of item.algs[0]) expect(entry.source).toBe('cubingapp');
    }
  });

  it('uses the stage-specific OELL/OCLL masks in the shared web/PDF plan', () => {
    const edge = oll.find(item => item.subgroup === 'Edges')!;
    const corner = oll.find(item => item.subgroup === 'Corners')!;
    const edgePlan = caseThumbPlan({
      puzzle: '3x3', set: '2-look-oll', sticker: edge.sticker,
      alg: edge.algs[0][0].alg, setup: edge.setup,
    });
    const cornerPlan = caseThumbPlan({
      puzzle: '3x3', set: '2-look-oll', sticker: corner.sticker,
      alg: corner.algs[0][0].alg, setup: corner.setup,
    });
    expect(edgePlan.renderer).toBe('visualcube');
    expect(cornerPlan.renderer).toBe('visualcube');
    if (edgePlan.renderer !== 'visualcube' || cornerPlan.renderer !== 'visualcube') return;
    expect(edgePlan.params).toMatchObject({ view: 'oll', mask: 'oell', hideGreySides: true });
    expect(cornerPlan.params).toMatchObject({ view: 'oll', mask: 'ocll', hideGreySides: true });
    expect(edgePlan.params.scheme).toBe('FFFF00,404040,404040,404040,404040,404040');
    expect(cornerPlan.params.scheme).toBe(edgePlan.params.scheme);
  });

  it('all 19 beginner formulas exactly solve their generated setups', async () => {
    const failures: string[] = [];
    for (const [set, rows] of [['2-look-oll', oll], ['2-look-pll', pll]] as const) {
      for (const item of rows) {
        for (const entry of item.algs[0]) {
          const result = await validateAlgCase(item.setup, entry.alg, item.sticker, '3x3');
          if (!result.ok) failures.push(`${set}/${item.name}: ${entry.alg}: ${result.reason}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('never marks a beginner case complete before its algorithm is applied', async () => {
    const kpuzzle = await puzzles['3x3x3'].kpuzzle();
    for (const [set, rows] of [['2-look-oll', oll], ['2-look-pll', pll]] as const) {
      for (const item of rows) {
        const goal = goalOf('3x3', set, item.sticker.kind);
        expect(goal).toBe('solve');
        const start = kpuzzle.defaultPattern().applyAlg(item.setup);
        expect(reachesGoal(start, kpuzzle, '3x3', goal), `${set}/${item.name} start`).toBe(false);
        for (const entry of item.algs[0]) {
          const end = start.applyAlg(entry.alg);
          expect(reachesGoal(end, kpuzzle, '3x3', goal), `${set}/${item.name}: ${entry.alg}`).toBe(true);
        }
      }
    }
  });

  it('carries all 22 parity source cases for id-preserving merge', () => {
    expect(parity).toHaveLength(22);
    expect(parity.flatMap(item => item.algs[0])).toHaveLength(22);
    expect(new Set(parity.map(item => item.name)).size).toBe(22);
    expect(parity.map(item => item.position)).toEqual([...Array(22).keys()]);
    expect(parity.filter(item => item.existing).map(item => item.name)).toEqual([
      'OPP Parity', 'Adj Parity', 'Ba', 'Pb', 'Diag C',
    ]);
    expect(parity.filter(item => !item.existing)).toHaveLength(17);
    expect(parityBaseline).toHaveLength(22);
    expect(parityBaseline.flatMap(item => item.algs)).toHaveLength(40);
    expect(canonicalNnnAlg("R3 U2'")).toBe("R' U2");
    for (const item of parity) {
      const alg = item.algs[0][0].alg;
      expect(alg).not.toMatch(/(^|\s)M(?:\d+)?'?(?=\s|$)/);
      expect(item.canonicalKey).toBe(canonicalNnnAlg(alg));
      const baseline = parityBaselineByName.get(item.name)!;
      expect(item.existing).toBe(baseline.algs.some(entry => canonicalNnnAlg(entry) === item.canonicalKey));
    }
  });

  it('all 57 post-migration 4x4 formulas solve the audited production case setup', async () => {
    const failures: string[] = [];
    let count = 0;
    for (const item of parity) {
      const baseline = parityBaselineByName.get(item.name)!;
      const sourceAlg = item.algs[0][0].alg;
      const finalAlgs = item.existing ? baseline.algs : [sourceAlg, ...baseline.algs];
      const setup = setupForCase('4x4', '', baseline.algs[0]);
      count += finalAlgs.length;
      for (const alg of finalAlgs) {
        const result = await validateAlgCase(setup, alg, {
          kind: 'face', us: '', ub: '', uf: '', ul: '', ur: '',
        }, '4x4', 'pll-parity');
        if (!result.ok) failures.push(`${item.name}: ${alg}: ${result.reason}`);
      }
    }
    expect(count).toBe(57);
    expect(failures).toEqual([]);
  });
});
