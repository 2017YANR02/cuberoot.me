import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applySq1Scramble,
  invertSq1Alg,
  parseSq1Tokens,
} from '@cuberoot/shared/sq1-notation';
import {
  SQ1_SHAPES,
  canonicalSq1CsCaseKey,
  canonicalSq1CsCaseName,
  displaySq1ShapeName,
} from '@cuberoot/shared/sq1-shapes';
import { sq1StateShapes } from '@/lib/sq1-shapes';
import {
  normalizeStoredSq1CsKeys,
  normalizeStoredSq1CsRecord,
} from '@/lib/sq1-cs-storage';
import { scanLocalOverview } from '@/lib/trainer-marks';
import { scanLocalSrsOverview } from '@/lib/alg-srs-store';
import { workspaceFixturePath } from './workspace-fixture-path';

type AlgEntry = { alg: string };
type AlignmentRow = {
  i: number;
  p: number;
  en: string;
  eg: string;
  ep: string;
  ea: AlgEntry[][];
  n: string;
  g: string;
  s: string;
  a: AlgEntry[][];
};

const migration = readFileSync(
  workspaceFixturePath('@cuberoot/server', 'migrations', '0137_sq1_cs_squanmate_alignment.sql'),
  'utf8',
);
const payloadMatch = migration.match(/\$sq1_cs\$\s*([\s\S]*?)\s*\$sq1_cs\$::jsonb/);
if (!payloadMatch) throw new Error('Missing SQ1 CS alignment payload');
const rows = JSON.parse(payloadMatch[1]!) as AlignmentRow[];

function stateName(alg: string): string {
  const shapes = sq1StateShapes(applySq1Scramble(alg));
  if (!shapes.top || !shapes.bottom) throw new Error(`Unknown SQ1 state for ${alg}`);
  return `${shapes.top.sourceName} / ${shapes.bottom.sourceName}`;
}

const upstreamShapes = [
  ['4-4', 'eceeeeceee'], ['5-3', 'eceeeeecee'], ['6-2', 'ceeeeeecee'],
  ['7-1', 'ceeeeeeece'], ['8', 'ceeeeeeeec'], ['2-2-2', 'eeceeceec'],
  ['3-3', 'eecceeece'], ['3-2-1', 'eeeceecec'], ['3-1-2', 'ceeceeece'],
  ['Left 4-2', 'ceeeeceec'], ['Right 4-2', 'ceeceeeec'], ['4-1-1', 'eceeeecec'],
  ['Left 5-1', 'ceeeeecec'], ['Right 5-1', 'ceceeeeec'], ['6', 'ceeeeeecc'],
  ['Square', 'cececece'], ['Kite', 'ceceecec'], ['Barrel', 'ceecceec'],
  ['Shield', 'eeccceec'], ['Left fist', 'cececeec'], ['Right fist', 'ceececec'],
  ['Left pawn', 'cceeecec'], ['Right pawn', 'ceceeecc'], ['Mushroom', 'cceeecce'],
  ['Scallop', 'cceeeecc'], ['Paired edges', 'cccccee'],
  ['Perpendicular edges', 'ccccece'], ['Parallel edges', 'cccecce'], ['Star', 'cccccc'],
] as const;

class TestStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

afterEach(() => vi.unstubAllGlobals());

describe('SQ1 CS Squanmate alignment', () => {
  it('keeps all 29 upstream shape names and handed patterns exactly', () => {
    expect(SQ1_SHAPES.map(({ sourceName, pattern }) => [sourceName, pattern])).toEqual(upstreamShapes);
    expect(displaySq1ShapeName('Right pawn')).toBe('R pawn');
    expect(displaySq1ShapeName('Left pawn')).toBe('L pawn');
  });

  it('contains every canonical oriented case exactly once', () => {
    expect(rows).toHaveLength(170);
    expect(new Set(rows.map((row) => row.i)).size).toBe(170);
    expect(rows.map((row) => row.p)).toEqual(Array.from({ length: 170 }, (_, index) => index));
    expect(new Set(rows.map((row) => row.n)).size).toBe(170);
    expect(new Set(rows.map((row) => row.n.split(' / ').sort().join(' / '))).size).toBe(90);
    const vocabulary = new Set(rows.flatMap((row) => row.n.split(' / ')));
    expect(vocabulary).toEqual(new Set(upstreamShapes.map(([name]) => name)));
  });

  it('matches every setup and every formula to its canonical top and bottom names', () => {
    for (const row of rows) {
      expect(canonicalSq1CsCaseName(row.n), `canonical name for ${row.i}`).toBe(row.n);
      expect(stateName(row.s), `setup for ${row.i}`).toBe(row.n);
      expect(row.a.flat().length, `formula count for ${row.i}`).toBeGreaterThan(0);
      for (const entry of row.a.flat()) {
        expect(stateName(invertSq1Alg(entry.alg)), `formula ${entry.alg} for ${row.i}`).toBe(row.n);
      }
      const firstAlg = row.a[0]?.[0]?.alg ?? '';
      const slices = parseSq1Tokens(firstAlg).filter((token) => token.kind === 'slice').length;
      expect(row.g, `slice group for ${row.i}`).toBe(
        slices === 0 ? 'Solved' : `${slices} ${slices === 1 ? 'Slice' : 'Slices'}`,
      );
    }
  });

  it('locks the two pawn directions reported from the catalog', () => {
    const rightLeft = rows.find((row) => row.i === 5788)!;
    const leftRight = rows.find((row) => row.i === 5789)!;
    expect(rightLeft.n).toBe('Right pawn / Left pawn');
    expect(stateName(rightLeft.s)).toBe('Right pawn / Left pawn');
    expect(leftRight.n).toBe('Left pawn / Right pawn');
    expect(stateName(leftRight.s)).toBe('Left pawn / Right pawn');
  });

  it('migrates aliases and the six corrected trainer groups exactly once', () => {
    expect(canonicalSq1CsCaseKey('4 Slices|Pair / Left paw')).toBe(
      '4 Slices|Paired edges / Left pawn',
    );
    expect(canonicalSq1CsCaseKey('cs:4 Slices|Right pawn / Right pawn::2')).toBe(
      'cs:5 Slices|Right pawn / Right pawn::2',
    );
    expect(canonicalSq1CsCaseKey('csp:4 Slices|Right paw / Right paw')).toBe(
      'csp:4 Slices|Right paw / Right paw',
    );
    expect(normalizeStoredSq1CsKeys('sq1', 'cs', [
      '4 Slices|Pair / Left paw',
      '4 Slices|Paired edges / Left pawn',
    ])).toEqual(['4 Slices|Paired edges / Left pawn']);
    expect(normalizeStoredSq1CsRecord('sq1', 'cs', {
      '4 Slices|Right pawn / Right pawn': { updatedAt: 1 },
      '5 Slices|Right pawn / Right pawn': { updatedAt: 2 },
    }, (current, incoming) => current.updatedAt >= incoming.updatedAt ? current : incoming)).toEqual({
      '5 Slices|Right pawn / Right pawn': { updatedAt: 2 },
    });
  });

  it('normalizes and deduplicates legacy keys in the cross-set progress scans', () => {
    const storage = new TestStorage();
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', storage);
    storage.setItem('trainer:marks:sq1/cs', JSON.stringify({
      '4 Slices|Pair / Left paw': { s: 'learning', t: 1 },
      '4 Slices|Paired edges / Left pawn': { s: 'mastered', t: 2 },
    }));
    storage.setItem('srs:recs:sq1/cs', JSON.stringify({
      '4 Slices|Pair / Left paw': { d: 1, iv: 1, ef: 2.4, n: 1, l: 0, st: 1, t: 1, h: 0 },
      '4 Slices|Paired edges / Left pawn': { d: 2, iv: 2, ef: 2.4, n: 2, l: 0, st: 2, t: 2, h: 0 },
    }));

    expect(scanLocalOverview()['sq1/cs']).toEqual({ learning: 0, mastered: 1 });
    const srs = scanLocalSrsOverview(0).recs['sq1/cs'];
    expect(Object.keys(srs)).toEqual(['4 Slices|Paired edges / Left pawn']);
    expect(srs['4 Slices|Paired edges / Left pawn']?.t).toBe(2);
  });

  it('guards every persisted server-side key surface in the migration', () => {
    for (const table of [
      'alg_submissions',
      'alg_case_marks',
      'alg_case_srs',
      'trainer_rooms',
      'alg_chain_orders',
      'alg_preferred_algs',
    ]) expect(migration).toContain(table);
    expect(migration).toContain("payload_count <> 170");
    expect(migration).toContain("distinct_name_count <> 170");
    expect(migration).toContain('refusing partial alignment');
  });
});
