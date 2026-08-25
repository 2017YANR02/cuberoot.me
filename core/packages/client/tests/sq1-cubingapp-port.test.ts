import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applySq1Scramble, invertSq1Alg, parseSq1Tokens } from '@cuberoot/shared/sq1-notation';
import { DEFAULT_SQ1_COLORS, renderSq1ScrambleSvg } from '@/lib/sq1-svg';
import { workspaceFixturePath } from './workspace-fixture-path';

type ImportedAlg = { alg: string; source: string };
type ImportedCase = {
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
  '0107_sq1_cubingapp_csp.sql',
);
const migration = readFileSync(migrationPath, 'utf8');

function jsonBlock<T>(tag: string): T {
  const match = new RegExp(`\\$${tag}\\$([\\s\\S]*?)\\$${tag}\\$::jsonb`).exec(migration);
  if (!match) throw new Error(`missing ${tag} JSON block`);
  return JSON.parse(match[1]) as T;
}

const cs = jsonBlock<{
  patches: Array<{ name: string; mode: 'replace' | 'prepend'; algs: ImportedAlg[][] }>;
  missing: ImportedCase;
}>('cubingapp_cs_patch');
const csp = jsonBlock<ImportedCase[]>('cubingapp_csp_cases');

describe('CubingApp Square-1 CS/CSP port payload', () => {
  it('pins the audited CS correction and completion delta', () => {
    expect(cs.patches.map(({ name, mode }) => ({ name, mode }))).toEqual([
      { name: 'Pair / Right 5-1', mode: 'replace' },
      { name: 'Parallel Edges / Left 4-2', mode: 'prepend' },
      { name: '3-2-1 / Parallel Edges', mode: 'prepend' },
      { name: 'Parallel Edges / 3-2-1', mode: 'prepend' },
      { name: '3-1-2 / Parallel Edges', mode: 'prepend' },
      { name: 'Parallel Edges / 3-1-2', mode: 'prepend' },
    ]);
    expect(cs.patches.flatMap(patch => patch.algs[0])).toHaveLength(6);
    expect(cs.patches[0].algs[0][0].alg).toBe('/ 2,-3 / -1,-2 / -3,0 /');
    expect(cs.missing).toMatchObject({
      position: 84,
      name: 'Left 4-2 / Perpendicular Edges',
      subgroup: '5 Slices',
      sticker: { kind: 'raw', tag: 'sqcube', attrs: {} },
    });
    expect(cs.missing.setup).toBe(invertSq1Alg(cs.missing.algs[0][0].alg));
    expect(migration).toContain("expected 170 cases (169 shapes + solved)");
    expect(migration).toContain("expected 178 algorithms");
    expect(migration).toContain('expected contiguous positions 0..169');
  });

  it('contains every CSP case and formula in source order', () => {
    expect(csp).toHaveLength(179);
    expect(new Set(csp.map(item => item.name)).size).toBe(179);
    expect(csp.flatMap(item => item.algs[0])).toHaveLength(203);
    expect(csp.map(item => item.position)).toEqual(Array.from({ length: 179 }, (_, i) => i));
    expect(csp[0].name).toBe('Left 4-2 / Paired Edges (Odd)');
    expect(csp.at(-1)?.name).toBe('Square / Square (Odd)');
  });

  it('preserves CSP parity labels and slice-count taxonomy', () => {
    const subgroupCounts = Object.fromEntries(
      [...new Set(csp.map(item => item.subgroup))].map(group => [
        group,
        csp.filter(item => item.subgroup === group).length,
      ]),
    );
    expect(subgroupCounts).toEqual({
      '4 Slices': 36,
      '5 Slices': 82,
      '3 Slices': 8,
      '6 Slices': 45,
      '2 Slices': 2,
      '7 Slices': 5,
      '1 Slice': 1,
    });
    expect(csp.filter(item => item.name.endsWith('(Odd)'))).toHaveLength(90);
    expect(csp.filter(item => item.name.endsWith('(Even)'))).toHaveLength(89);
  });

  it('uses the shared SQ1 inverse for every setup and identifies every imported formula', () => {
    for (const item of csp) {
      expect(item.sticker).toEqual({ kind: 'raw', tag: 'sqcube', attrs: {} });
      expect(item.setup).toBe(invertSq1Alg(item.algs[0][0].alg));
      expect(() => renderSq1ScrambleSvg(
        item.setup,
        DEFAULT_SQ1_COLORS,
        { compactFaces: false },
        false,
      )).not.toThrow();
      for (const entry of item.algs[0]) {
        expect(entry.source).toBe('cubingapp');
        expect(parseSq1Tokens(entry.alg).length).toBeGreaterThan(0);
        expect(() => applySq1Scramble(`${item.setup} ${entry.alg}`)).not.toThrow();
      }
    }
    expect(migration).toContain('613a49885dc618023368e5f0c2a25024b8c7e9a5');
    expect(migration).toContain("expected 179 cases");
    expect(migration).toContain("expected 203 algorithms");
  });
});
