import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applySq1Scramble, invertSq1Alg, parseSq1Tokens } from '@cuberoot/shared/sq1-notation';
import { DEFAULT_SQ1_COLORS, renderSq1ScrambleSvg } from '@/lib/sq1-svg';
import { sq1StageHiddenStickerIds } from '@/lib/sq1-stage-mask';
import { workspaceFixturePath } from './workspace-fixture-path';

type ImportedAlg = {
  alg: string;
  source: string;
  note?: { en: string; zh: string };
};
type StageRow = {
  sourceName: string;
  targetName: string;
  position: number;
  subgroup: string;
  existing?: boolean;
  setup?: string;
  sticker?: { kind: string; tag: string; attrs: Record<string, string> };
  algs: ImportedAlg[][];
};
type OblRow = {
  position: number;
  name: string;
  subgroup: string;
  setup: string;
  sticker: { kind: string; tag: string; attrs: Record<string, string> };
  algs: ImportedAlg[][];
};

const migrationPath = workspaceFixturePath(
  '@cuberoot/server',
  'migrations',
  '0108_sq1_cubingapp_stages.sql',
);
const migration = readFileSync(migrationPath, 'utf8');

function jsonBlock<T>(tag: string): T {
  const match = new RegExp(`\\$${tag}\\$([\\s\\S]*?)\\$${tag}\\$::jsonb`).exec(migration);
  if (!match) throw new Error(`missing ${tag} JSON block`);
  return JSON.parse(match[1]) as T;
}

const cp = jsonBlock<StageRow[]>('cubingapp_sq1_cp');
const eo = jsonBlock<StageRow[]>('cubingapp_sq1_eo');
const ep = jsonBlock<StageRow[]>('cubingapp_sq1_ep');
const obl = jsonBlock<OblRow[]>('cubingapp_sq1_obl');
const solved = applySq1Scramble('');

describe('CubingApp Square-1 CP/EO/EP/OBL port payload', () => {
  it('pins complete source coverage and source order for CP and EO', () => {
    expect(cp).toHaveLength(8);
    expect(cp.flatMap(item => item.algs[0])).toHaveLength(8);
    expect(cp.map(item => item.position)).toEqual(Array.from({ length: 8 }, (_, i) => i));
    expect(cp.map(item => item.subgroup)).toEqual([
      'Top Adj', 'Top Adj', 'Top Adj',
      'Top Opp', 'Top Opp', 'Top Opp',
      'Top Solved', 'Top Solved',
    ]);

    expect(eo).toHaveLength(7);
    expect(eo.flatMap(item => item.algs[0])).toHaveLength(9);
    expect(eo.map(item => item.targetName)).toEqual(['1-1', 'I-I', '4-4', 'L-L', '3-3', 'L-I', 'I-L']);
    const notes = eo.flatMap(item => item.algs[0]).flatMap(entry => entry.note ? [entry.note] : []);
    expect(notes).toHaveLength(6);
    expect(notes).toContainEqual({ en: 'Fastest alg', zh: '最快公式' });
    expect(notes).toContainEqual({ en: 'Preserves CP', zh: '保持 CP' });
  });

  it('merges 17 state-audited EP matches and adds all 23 missing cases', () => {
    const existing = ep.filter(item => item.existing);
    const missing = ep.filter(item => !item.existing);
    expect(ep).toHaveLength(40);
    expect(ep.flatMap(item => item.algs[0])).toHaveLength(41);
    expect(existing).toHaveLength(17);
    expect(missing).toHaveLength(23);
    expect(missing.flatMap(item => item.algs[0])).toHaveLength(24);
    expect(new Set(ep.map(item => item.targetName)).size).toBe(40);
    expect(ep.map(item => item.position)).toEqual(Array.from({ length: 40 }, (_, i) => i));

    const sourceUaUa = ep.find(item => item.sourceName === 'Ua & Ua');
    const sourceUaUb = ep.find(item => item.sourceName === 'Ua & Ub');
    expect(sourceUaUa).toMatchObject({ targetName: 'Ua & Ua', existing: false });
    expect(sourceUaUb).toMatchObject({ targetName: 'Ua / Ua', existing: true });

    for (const item of missing) {
      expect(item.sticker).toEqual({ kind: 'raw', tag: 'sqcube', attrs: {} });
      expect(item.setup).toBe(invertSq1Alg(item.algs[0][0].alg));
      expect(applySq1Scramble(`${item.setup} ${item.algs[0][0].alg}`)).toEqual(solved);
      for (const entry of item.algs[0]) {
        expect(() => applySq1Scramble(`${item.setup} ${entry.alg}`)).not.toThrow();
      }
    }
  });

  it('imports every OBL case and formula with the complete slice taxonomy', () => {
    expect(obl).toHaveLength(185);
    expect(new Set(obl.map(item => item.name)).size).toBe(185);
    expect(obl.flatMap(item => item.algs[0])).toHaveLength(185);
    expect(obl.map(item => item.position)).toEqual(Array.from({ length: 185 }, (_, i) => i));
    expect(Object.fromEntries(
      [...new Set(obl.map(item => item.subgroup))].map(group => [
        group,
        obl.filter(item => item.subgroup === group).length,
      ]),
    )).toEqual({
      '1 Slice': 2,
      '2 Slices': 8,
      '3 Slices': 38,
      '4 Slices': 91,
      '5 Slices': 40,
      '6 Slices': 6,
    });

    const hidden = sq1StageHiddenStickerIds('obl');
    expect(hidden).not.toBeNull();
    for (const item of obl) {
      expect(item.sticker).toEqual({ kind: 'raw', tag: 'sqcube', attrs: {} });
      expect(item.setup).toBe(invertSq1Alg(item.algs[0][0].alg));
      expect(item.algs[0][0].source).toBe('cubingapp');
      expect(parseSq1Tokens(item.algs[0][0].alg).length).toBeGreaterThan(0);
      expect(applySq1Scramble(`${item.setup} ${item.algs[0][0].alg}`)).toEqual(solved);
      expect(() => renderSq1ScrambleSvg(item.setup, DEFAULT_SQ1_COLORS, {
        mask: { ids: hidden!, color: 'transparent' },
        compactFaces: true,
      }, false)).not.toThrow();
    }
  });

  it('locks the final merged database counts and pinned upstream revision', () => {
    expect(migration).toContain('613a49885dc618023368e5f0c2a25024b8c7e9a5');
    expect(migration).toContain('sq1/eo: expected 16 algorithms');
    expect(migration).toContain('sq1/ep: expected 72 cases');
    expect(migration).toContain('sq1/ep: expected 76 algorithms');
    expect(migration).toContain('sq1/obl: expected 185 cases');
    expect(migration).toContain('sq1/obl: expected 185 algorithms');
  });
});
