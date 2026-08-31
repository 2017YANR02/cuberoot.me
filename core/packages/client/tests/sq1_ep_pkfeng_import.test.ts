import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applySq1Scramble } from '@cuberoot/shared/sq1-notation';
import { classifySq1EpParity, sq1EpNumericCaseName } from '@/lib/sq1-ep-parity';
import { sq1StateShapes } from '@/lib/sq1-shapes';
import { traceSq1Algorithm } from '@/lib/sq1-tools';
import { validateStoredAlgCase } from '@/lib/alg_validation';
import { workspaceFixturePath } from './workspace-fixture-path';

type SourceAlg = {
  alg: string;
  setup: string;
  source: 'cuberoot';
  note?: { zh: string; en: string };
};
type SourceCase = {
  position: number;
  numericName: string;
  name: string;
  parity: 'no-parity' | 'parity';
  sourceCell?: string;
  setup: string;
  algs: SourceAlg[];
};
type Fixture = {
  schemaVersion: number;
  source: { title: string; file: string; sha256: string };
  naming: {
    layerOrder: string[];
    layerNames: Record<string, string>;
    note: string;
  };
  cases: SourceCase[];
};

const fixturePath = workspaceFixturePath('@cuberoot/alg-build', 'fixtures', 'sq1-ep-pkfeng.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as Fixture;
const migrationPath = workspaceFixturePath('@cuberoot/server', 'migrations', '0187_sq1_ep_pkfeng_complete.sql');
const migration = readFileSync(migrationPath, 'utf8');
const solved = applySq1Scramble('');

describe('Pk Feng SQ1 EP complete import', () => {
  it('pins the complete 10 by 10 source matrix and exact parity split', () => {
    expect(fixture.schemaVersion).toBe(1);
    expect(fixture.source.sha256).toBe('BE1D01D0EBD36E53CB46A404FA05F50F91928312D08E882FF38CD302263D3D84');
    expect(fixture.naming.layerOrder).toEqual(['0', '1', '2', '3+', '3-', '4+', '4-', '7', '+', '//']);
    expect(fixture.naming.layerNames['+']).toBe('H');
    expect(fixture.cases).toHaveLength(100);
    expect(fixture.cases.map(item => item.position)).toEqual(Array.from({ length: 100 }, (_, index) => index));
    expect(new Set(fixture.cases.map(item => item.numericName)).size).toBe(100);
    expect(new Set(fixture.cases.map(item => item.name)).size).toBe(100);
    expect(fixture.cases.filter(item => item.parity === 'no-parity')).toHaveLength(50);
    expect(fixture.cases.filter(item => item.parity === 'parity')).toHaveLength(50);
    expect(fixture.cases.flatMap(item => item.algs)).toHaveLength(118);
  });

  it('uses standalone + for H in every numeric case name', () => {
    for (const item of fixture.cases) {
      expect(sq1EpNumericCaseName(item.name), item.name).toBe(item.numericName);
      expect(classifySq1EpParity(item.name), item.name).toBe(item.parity);
    }
    expect(fixture.cases.find(item => item.name === 'Ua / H')?.numericName).toBe('3+.+');
    expect(fixture.cases.find(item => item.name === 'H & Opp')?.numericName).toBe('+.1');
    expect(fixture.cases.find(item => item.name === 'H / H')?.numericName).toBe('+.+');
  });

  it('preserves the LC source cell without inventing a formula and verifies all imported formulas', () => {
    expect(fixture.cases[0]).toMatchObject({
      numericName: '0.0',
      name: 'Solved / Solved',
      sourceCell: 'LC',
      setup: '',
      algs: [],
    });
    for (const item of fixture.cases) {
      if (item.algs.length > 0) {
        expect(item.setup, item.numericName).toBe(item.algs[0].setup);
      }
      for (const entry of item.algs) {
        expect(applySq1Scramble(`${entry.setup} ${entry.alg}`), item.numericName).toEqual(solved);
      }
    }
  });

  it('passes strict stored-formula validation for all 118 imported formulas', async () => {
    const sticker = { kind: 'raw' as const, tag: 'sqcube', attrs: {} };
    for (const item of fixture.cases) {
      for (const entry of item.algs) {
        const result = await validateStoredAlgCase(entry.setup, entry.alg, sticker, 'sq1', 'ep');
        expect(result, `${item.numericName}: ${entry.alg}`).toEqual({ ok: true, auf: '' });
      }
    }
  });

  it('completes source formulas that omitted their final U or D alignment', () => {
    const completedAufEntries: Array<[numericName: string, algIndex: number]> = [
      ['1.3+', 0],
      ['2.2', 0],
      ['2.2', 1],
      ['2.2', 2],
      ['3+.//', 0],
    ];

    for (const [numericName, algIndex] of completedAufEntries) {
      const item = fixture.cases.find(entry => entry.numericName === numericName);
      const entry = item?.algs[algIndex];
      expect(entry, `${numericName} alg ${algIndex}`).toBeDefined();
      if (!entry) continue;

      const trace = traceSq1Algorithm(entry.alg, entry.setup);
      expect(trace, `${numericName} alg ${algIndex}`).toMatchObject({ ok: true });
      if (!trace.ok) continue;

      const initialShapes = sq1StateShapes(trace.steps[0].state);
      expect(initialShapes.top?.id, `${numericName} top shape`).toBe('square');
      expect(initialShapes.bottom?.id, `${numericName} bottom shape`).toBe('square');
      expect(trace.steps.at(-1)?.state, `${numericName} final alignment`).toEqual(solved);
    }

    const adj = fixture.cases.find(item => item.numericName === '2.2');
    expect(adj?.algs.map(entry => entry.alg)).toEqual([
      '1,0/0,3/-1,-1/1,-2/-1',
      '0,-1/-3,0/1,1/2,-1/0,1',
      '1,0/3,0/-1,-1/-2,1/-1',
      '0,-1/1,-2/-1,-1/0,3/0,1',
    ]);
  });

  it('keeps the generated migration tied to the source hash and final-count guards', () => {
    expect(migration).toContain(fixture.source.sha256);
    expect(migration).toContain('SQ1 EP expected 100 cases');
    expect(migration).toContain('SQ1 EP expected 50 no-parity cases');
    expect(migration).toContain('SQ1 EP expected 50 parity cases');
    expect(migration).toContain("name = 'Ua & Ua'");
  });
});
