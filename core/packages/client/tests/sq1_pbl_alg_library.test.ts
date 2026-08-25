import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AlgCase } from '@cuberoot/shared';
import {
  applySq1Scramble,
  canonicalSq1Alg,
  invertSq1Alg,
  parseSq1Tokens,
} from '@cuberoot/shared/sq1-notation';
import { setupForCase, validateAlgCase } from '@/lib/alg_validation';
import { workspaceFixturePath } from './workspace-fixture-path';

type SourceCase = {
  key: string;
  top: string;
  bottom: string;
  shapePair: string;
  slices: number;
  solution: string | null;
  used: boolean;
  recommended: boolean;
  recommendation: { algorithm: string } | null;
};

type ImportedCase = Pick<AlgCase, 'name' | 'subgroup' | 'setup' | 'sticker' | 'algs'> & {
  position: number;
};

const source = JSON.parse(readFileSync(
  new URL('../data/sq1-pbl/cases.json', import.meta.url),
  'utf8',
)) as { cases: SourceCase[] };
const migration = readFileSync(
  workspaceFixturePath('@cuberoot/server', 'migrations', '0140_sq1_pbl.sql'),
  'utf8',
);
const payloadMatch = migration.match(/\$sq1_pbl_cases\$([\s\S]*?)\$sq1_pbl_cases\$/);
if (!payloadMatch) throw new Error('missing SQ1 PBL migration payload');
const imported = JSON.parse(payloadMatch[1]) as ImportedCase[];

describe('SQ1 PBL formula-library import', () => {
  it('imports all 967 non-solved PBL cases and no workbook-only row', () => {
    expect(source.cases).toHaveLength(968);
    expect(source.cases.filter(item => item.key === '-/-')).toEqual([
      expect.objectContaining({ solution: null, slices: 0 }),
    ]);
    expect(imported).toHaveLength(967);
    expect(imported.map(item => item.position)).toEqual(Array.from({ length: 967 }, (_, index) => index));
    expect(new Set(imported.map(item => item.name)).size).toBe(967);
    expect(imported.some(item => item.name === '-/-')).toBe(false);
  });

  it('preserves every executable solution and the two-level PBL taxonomy', () => {
    const byName = new Map(imported.map(item => [item.name, item]));
    for (const item of source.cases.filter(item => item.key !== '-/-')) {
      const row = byName.get(item.key);
      expect(row, item.key).toBeDefined();
      expect(row!.setup, item.key).toBe('');
      expect(row!.subgroup, item.key).toBe(`${item.shapePair === 'nP/nP' ? 'nP' : 'P'}/${item.top}`);
      expect(row!.algs, item.key).toHaveLength(1);
      expect(row!.algs[0], item.key).toHaveLength(1);
      expect(row!.algs[0][0].alg, item.key).toBe(canonicalSq1Alg(item.solution!));
      expect(row!.sticker, item.key).toMatchObject({
        kind: 'raw',
        tag: 'sq1-pbl',
        attrs: { top: item.top, bottom: item.bottom, slices: String(item.slices) },
      });
    }
    expect(new Set(imported.map(item => item.subgroup))).toHaveLength(44);
    expect(imported.filter(item => item.subgroup === 'nP/-')).toHaveLength(21);
    expect(imported.filter(item => item.subgroup !== 'nP/-').every(item =>
      imported.filter(other => other.subgroup === item.subgroup).length === 22,
    )).toBe(true);
  });

  it('locks the recovered M/Db formula and all four source-unused cases', () => {
    const mDb = imported.find(item => item.name === 'M/Db');
    expect(mDb?.algs[0][0].alg).toBe(
      '(1, 0) / (-3, 0) / (3, 0) / (-1, 2) / (0, 3) / (-3, -3) / (4, -2) / (-1, 0)',
    );
    expect(mDb?.algs[0][0].note?.en).toContain('10 W\' d D e\' t -10');
    expect(source.cases.filter(item => !item.used).map(item => item.key).sort()).toEqual([
      'Ga/Gd', 'Ga/Jb', 'Gb/Gc', 'Gb/Jb',
    ]);
    for (const key of ['Ga/Gd', 'Ga/Jb', 'Gb/Gc', 'Gb/Jb']) {
      expect(imported.find(item => item.name === key)?.algs[0][0].note?.en).toContain('double-misalignment');
    }
  });

  it('keeps every imported formula parseable and its inferred setup reversible', () => {
    const solved = applySq1Scramble('');
    for (const item of imported) {
      const alg = item.algs[0][0].alg;
      expect(parseSq1Tokens(alg).filter(token => token.kind === 'slice'), item.name)
        .toHaveLength(Number(item.sticker.kind === 'raw' ? item.sticker.attrs.slices : -1));
      expect(canonicalSq1Alg(alg), item.name).toBe(alg);
      expect(applySq1Scramble(`${invertSq1Alg(alg)} ${alg}`), item.name).toEqual(solved);
    }
  });

  it('passes the standard SQ1 formula-library player and validation contract', async () => {
    const failures: string[] = [];
    for (const item of imported) {
      const alg = item.algs[0][0].alg;
      const setup = setupForCase('sq1', item.setup, alg);
      const result = await validateAlgCase(setup, alg, item.sticker, 'sq1', 'pbl');
      if (!result.ok) failures.push(`${item.name}: ${result.reason}`);
    }
    expect(failures).toEqual([]);
  });

  it('keeps source mnemonics as notes instead of executable algorithms', () => {
    const recommended = source.cases.filter(item => item.recommended);
    expect(recommended).toHaveLength(963);
    for (const item of recommended) {
      const row = imported.find(candidate => candidate.name === item.key)!;
      expect(row.algs[0][0].note?.en).toContain(item.recommendation!.algorithm);
      expect(row.algs[0][0].alg).not.toBe(item.recommendation!.algorithm);
    }
  });
});
