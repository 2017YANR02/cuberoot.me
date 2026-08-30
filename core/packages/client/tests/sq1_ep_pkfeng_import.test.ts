import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applySq1Scramble } from '@cuberoot/shared/sq1-notation';
import { classifySq1EpParity, sq1EpNumericCaseName } from '@/lib/sq1-ep-parity';
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

  it('keeps the generated migration tied to the source hash and final-count guards', () => {
    expect(migration).toContain(fixture.source.sha256);
    expect(migration).toContain('SQ1 EP expected 100 cases');
    expect(migration).toContain('SQ1 EP expected 50 no-parity cases');
    expect(migration).toContain('SQ1 EP expected 50 parity cases');
    expect(migration).toContain("name = 'Ua & Ua'");
  });
});
