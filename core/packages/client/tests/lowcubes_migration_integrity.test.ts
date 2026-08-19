import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Alg } from 'cubing/alg';
import { puzzles } from 'cubing/puzzles';
import { ftoEifState, isFtoEifSolved, parseFtoEifAlgorithm } from '@/lib/fto-eif-image';
import { normalizeAlg } from '@/lib/alg_normalize';
import { FTO_PF_TARGET_SETUP } from '@/lib/alg_validation';

interface MigrationAlgorithm {
  alg: string;
  setup?: string;
  source: string;
}

interface MigrationCase {
  name: string;
  setup: string;
  sticker: { kind: string; tag: string; attrs: Record<string, string> };
  algs: MigrationAlgorithm[][];
}

const SQL = readFileSync(
  new URL('../../server/migrations/0121_lowcubes_fto_megaminx.sql', import.meta.url),
  'utf8',
);
const PF_FIX_SQL = readFileSync(
  new URL('../../server/migrations/0157_fix_fto_pair_formation_setups.sql', import.meta.url),
  'utf8',
);

function payload(tag: string, sql = SQL): MigrationCase[] {
  const match = sql.match(new RegExp(`\\$${tag}\\$([\\s\\S]*?)\\$${tag}\\$`));
  if (!match) throw new Error(`Missing migration payload: ${tag}`);
  return JSON.parse(match[1]) as MigrationCase[];
}

function correctedPfCases(): MigrationCase[] {
  const fixes = payload('fto_pf_stage_setups', PF_FIX_SQL) as unknown as Array<{ name: string; setup: string }>;
  const setupByName = new Map(fixes.map((item) => [item.name, item.setup]));
  expect(setupByName.size).toBe(10);
  return payload('lowcubes_fto_pf').map((item) => {
    const setup = setupByName.get(item.name);
    if (!setup) throw new Error(`Missing corrected PF setup: ${item.name}`);
    return {
      ...item,
      setup,
      algs: item.algs.map((orientation) => orientation.map((entry) => ({ ...entry, setup }))),
    };
  });
}

function algorithms(cases: MigrationCase[]): MigrationAlgorithm[] {
  return cases.flatMap((item) => item.algs.flat());
}

describe('LowCubes migration integrity', () => {
  it('locks every FTO set count and accepts every EIF token', () => {
    const expected = {
      lowcubes_fto_pf: [10, 10],
      lowcubes_fto_tl: [5, 5],
      lowcubes_fto_lt: [3, 3],
      lowcubes_fto_tcp: [18, 29],
      lowcubes_fto_1l3t: [180, 251],
    } as const;

    for (const [tag, [caseCount, algCount]] of Object.entries(expected)) {
      const cases = payload(tag);
      const algs = algorithms(cases);
      expect(cases, `${tag} cases`).toHaveLength(caseCount);
      expect(algs, `${tag} algorithms`).toHaveLength(algCount);
      for (const item of cases) expect(parseFtoEifAlgorithm(item.setup).invalid, item.name).toEqual([]);
      for (const item of algs) {
        expect(item.source).toBe('LowCubes / Raul Low');
        expect(parseFtoEifAlgorithm(item.alg).invalid, item.alg).toEqual([]);
      }
    }

    for (const item of correctedPfCases()) {
      expect(parseFtoEifAlgorithm(item.setup).invalid, item.name).toEqual([]);
      const image = item.sticker.attrs.image;
      expect(image).toMatch(/^cases\/fto\/pf\/(?:[1-9]|10)\.webp$/);
      expect(() => readFileSync(new URL(`../public/${image}`, import.meta.url))).not.toThrow();
    }
  });

  it('round-trips every FTO case through every algorithm', () => {
    const cases = [
      ...correctedPfCases(),
      ...payload('lowcubes_fto_tl'),
      ...payload('lowcubes_fto_lt'),
      ...payload('lowcubes_fto_tcp'),
      ...payload('lowcubes_fto_1l3t'),
    ];
    const solvedReferences = cases.filter((item) => algorithms([item]).length === 0);
    expect(cases).toHaveLength(216);
    expect(solvedReferences.map((item) => item.name)).toEqual(['1.E.1']);

    const pfNames = new Set(correctedPfCases().map((item) => item.name));
    const pfTarget = ftoEifState(FTO_PF_TARGET_SETUP);
    const lt1Setup = payload('lowcubes_fto_lt').find((item) => item.name === 'LT 1')?.setup;
    expect(lt1Setup).toBeTruthy();
    expect(isFtoEifSolved(FTO_PF_TARGET_SETUP)).toBe(false);
    expect(ftoEifState(`${FTO_PF_TARGET_SETUP} S`)).toEqual(ftoEifState(lt1Setup!));

    for (const item of cases) {
      for (const entry of algorithms([item])) {
        const sequence = `${entry.setup ?? item.setup} ${entry.alg}`;
        if (pfNames.has(item.name)) {
          expect(ftoEifState(sequence), `${item.name}: ${entry.alg}`).toEqual(pfTarget);
          expect(isFtoEifSolved(sequence), `${item.name}: ${entry.alg}`).toBe(false);
        } else {
          expect(isFtoEifSolved(sequence), `${item.name}: ${entry.alg}`).toBe(true);
        }
      }
    }
  });

  it('locks the Megaminx Full PLL import count, source, notation, and local images', async () => {
    const cases = payload('lowcubes_megaminx_full_pll');
    const algs = algorithms(cases);
    const kpuzzle = await puzzles.megaminx.kpuzzle();
    expect(cases).toHaveLength(151);
    expect(algs).toHaveLength(326);
    expect(algs.every((item) => item.source === 'LowCubes / Raul Low')).toBe(true);
    const solved = kpuzzle.defaultPattern();
    for (const item of cases) {
      const image = item.sticker.attrs.image;
      expect(item.sticker.tag).toBe('lowcubes-megaminx');
      expect(image).toMatch(/^cases\/megaminx\/full-pll\/[a-z0-9]+\.webp$/);
      expect(() => readFileSync(new URL(`../public/${image}`, import.meta.url))).not.toThrow();

      const setup = normalizeAlg('megaminx', item.setup);
      expect(() => kpuzzle.defaultPattern().applyAlg(new Alg(setup)), `${item.name} setup`).not.toThrow();
      for (const entry of algorithms([item])) {
        expect(entry.setup, `${item.name}: ${entry.alg} setup`).toBeTruthy();
        const entrySetup = normalizeAlg('megaminx', entry.setup!);
        const normalized = normalizeAlg('megaminx', entry.alg);
        expect(
          kpuzzle.defaultPattern().applyAlg(new Alg(`${entrySetup} ${normalized}`)).isIdentical(solved),
          `${item.name}: ${entry.alg}`,
        ).toBe(true);
      }
    }
  });
});
