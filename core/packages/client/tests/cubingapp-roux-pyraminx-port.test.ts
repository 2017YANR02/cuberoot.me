import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ALG_CATALOG, type AlgSticker } from '@cuberoot/shared';
import { puzzles } from 'cubing/puzzles';
import { cubeThumbParams } from '@/lib/alg_thumb_plan';
import { displayAlg } from '@/lib/alg_display';
import { validateAlgCase } from '@/lib/alg_validation';
import { EOLR_GOAL_ALGS } from '@/lib/roux/eolr-goal';

type ImportedAlg = { alg: string; source: string; note?: { en: string; zh: string } };
type ImportedCase = {
  position: number;
  name: string;
  subgroup: string;
  setup: string;
  sticker: { kind: string; mask?: string };
  algs: ImportedAlg[][];
};
type Supplement = { targetName: string; algs: ImportedAlg[] };
type BaselineCase = { puzzle: string; set: string; name: string; setup: string };
type L3eOverlap = { sourceName: string; targetName: string; existingAlg: string };

const clientRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const migration = readFileSync(
  join(clientRoot, '..', 'server', 'migrations', '0110_cubingapp_roux_pyraminx.sql'),
  'utf8',
);

function jsonBlock<T>(tag: string): T {
  const match = new RegExp(`\\$${tag}\\$([\\s\\S]*?)\\$${tag}\\$::jsonb`).exec(migration);
  if (!match) throw new Error(`missing ${tag} JSON block`);
  return JSON.parse(match[1]) as T;
}

const twoLookCmll = jsonBlock<ImportedCase[]>('cubingapp_2look_cmll');
const ohCmll = jsonBlock<ImportedCase[]>('cubingapp_oh_cmll');
const lseEolr = jsonBlock<ImportedCase[]>('cubingapp_lse_eolr');
const cmllSupplement = jsonBlock<Supplement[]>('cubingapp_cmll_supplement');
const eoSupplement = jsonBlock<Supplement[]>('cubingapp_lse_eo_supplement');
const eoNew = jsonBlock<ImportedCase[]>('cubingapp_lse_eo_new');
const l4eSupplement = jsonBlock<Supplement[]>('cubingapp_pyraminx_l4e_supplement');
const l4eNew = jsonBlock<ImportedCase[]>('cubingapp_pyraminx_l4e_new');
const baselineCases = JSON.parse(readFileSync(
  join(clientRoot, '..', 'alg-build', 'fixtures', 'cubingapp-roux-pyraminx-baseline.json'),
  'utf8',
)) as BaselineCase[];
const baselineByKey = new Map(baselineCases.map(item => [
  `${item.puzzle}/${item.set}/${item.name}`,
  item,
]));
const l3eOverlap = JSON.parse(readFileSync(
  join(clientRoot, '..', 'alg-build', 'fixtures', 'cubingapp-pyraminx-last-layer-overlap.json'),
  'utf8',
)) as L3eOverlap[];

async function exactlySolves(puzzleId: '3x3x3' | 'pyraminx', setup: string, alg: string) {
  const kpuzzle = await puzzles[puzzleId].kpuzzle();
  const result = kpuzzle.defaultPattern().applyAlg(`${setup} ${alg}`);
  return JSON.stringify(result.patternData) === JSON.stringify(kpuzzle.defaultPattern().patternData);
}

describe('CubingApp Roux and Pyraminx port', () => {
  it('adds the three genuinely missing Roux sets in complete source order', () => {
    expect(twoLookCmll).toHaveLength(9);
    expect(twoLookCmll.flatMap(item => item.algs[0])).toHaveLength(9);
    expect(ohCmll).toHaveLength(42);
    expect(ohCmll.flatMap(item => item.algs[0])).toHaveLength(99);
    expect(lseEolr).toHaveLength(46);
    expect(lseEolr.flatMap(item => item.algs[0])).toHaveLength(48);

    for (const [rows, mask] of [[twoLookCmll, 'cmll'], [ohCmll, 'cmll'], [lseEolr, 'eo_orbit']] as const) {
      expect(rows.map(item => item.position)).toEqual(Array.from({ length: rows.length }, (_, i) => i));
      for (const item of rows) {
        expect(item.sticker).toMatchObject({ kind: 'face', mask });
        expect(item.algs.flat().every(alg => alg.source === 'cubingapp')).toBe(true);
      }
    }
  });

  it('all 108 CMLL formulas in the new Roux sets pass the shared CMLL goal', async () => {
    const failures: string[] = [];
    let count = 0;
    for (const [set, rows] of [
      ['2-look-cmll', twoLookCmll],
      ['oh-cmll', ohCmll],
    ] as const) {
      for (const item of rows) for (const entry of item.algs.flat()) {
        count += 1;
        const result = await validateAlgCase(
          item.setup, displayAlg(entry.alg), item.sticker as AlgSticker, '3x3', set,
        );
        if (!result.ok) failures.push(`${set}/${item.name}: ${entry.alg}: ${result.reason}`);
      }
    }
    expect(count).toBe(108);
    expect(failures).toEqual([]);
  });

  it('rejects CubingApp’s one invalid OH formula after exhausting every case AUF and y anchor', async () => {
    const invalid = "r' U2' R U' R' U' R U R' U r";
    expect(JSON.stringify(ohCmll)).not.toContain(invalid);
    const anchors = [
      '', 'U', 'U2', "U'", 'y', 'y2', "y'", 'y U', 'y U2', "y U'",
      'y2 U', 'y2 U2', "y2 U'", "y' U", "y' U2", "y' U'",
    ];
    let attempts = 0;
    for (const item of ohCmll) for (const anchor of anchors) {
      attempts += 1;
      const result = await validateAlgCase(
        item.setup, [anchor, invalid].filter(Boolean).join(' '),
        item.sticker as AlgSticker, '3x3', 'oh-cmll',
      );
      expect(result.ok, `${item.name} / ${anchor || 'no anchor'}`).toBe(false);
    }
    expect(attempts).toBe(42 * 16);
  });

  it('all 48 EOLR formulas hit the same 17 target states as the Roux pruner', async () => {
    expect(EOLR_GOAL_ALGS).toHaveLength(17);
    const failures: string[] = [];
    for (const item of lseEolr) {
      const start = await validateAlgCase(
        item.setup, "U U'", item.sticker as AlgSticker, '3x3', 'lse-eolr',
      );
      if (start.ok) failures.push(`${item.name}: case setup already satisfies EOLR`);
      for (const entry of item.algs.flat()) {
        const result = await validateAlgCase(
          item.setup, displayAlg(entry.alg), item.sticker as AlgSticker, '3x3', 'lse-eolr',
        );
        if (!result.ok) failures.push(`${item.name}: ${entry.alg}: ${result.reason}`);
      }
    }
    expect(lseEolr.flatMap(item => item.algs[0])).toHaveLength(48);
    expect(failures).toEqual([]);
  });

  it('merges CMLL and LSE EO instead of duplicating existing stages', () => {
    expect(cmllSupplement).toHaveLength(19);
    expect(cmllSupplement.flatMap(item => item.algs)).toHaveLength(19);
    expect(cmllSupplement).toContainEqual(expect.objectContaining({ targetName: 'Pi Down Slash' }));
    expect(cmllSupplement).toContainEqual(expect.objectContaining({ targetName: 'Anti Sune Up Slash' }));

    expect(eoSupplement.flatMap(item => item.algs)).toHaveLength(12);
    expect(eoNew.map(item => item.name)).toEqual(['Back Arrow', '2 Adj / 0']);
    expect(eoNew.flatMap(item => item.algs[0])).toHaveLength(2);
    expect(migration).not.toContain("'3x3', 'lse-eo'");
  });

  it('deduplicates Pyraminx Last Layer into L3E and adds only missing L4E states', () => {
    expect(l3eOverlap).toEqual([
      { sourceName: 'Sune', targetName: 'Sune', existingAlg: "R U R' U R U R'" },
      { sourceName: 'Antisune', targetName: 'AntiSune', existingAlg: "R U' R' U' R U' R'" },
      { sourceName: '2-flip', targetName: '2 Flip', existingAlg: "L R' L' R U' R U R'" },
      { sourceName: "R' unsexy R", targetName: 'Lefty Bars', existingAlg: "R' U' L' U L R" },
      { sourceName: "L unsexy L'", targetName: 'Righty Bars', existingAlg: "L U R U' R' L'" },
    ]);
    expect(l4eSupplement.flatMap(item => item.algs)).toHaveLength(3);
    expect(l4eSupplement.map(item => item.targetName)).toEqual(['4 Flip', 'DB Flip', 'DB Flip']);
    expect(l4eNew).toHaveLength(12);
    expect(l4eNew.flatMap(item => item.algs[0])).toHaveLength(12);
    expect(new Set(l4eNew.map(item => item.name)).size).toBe(12);
    expect(l4eNew[0].position).toBe(37);
    expect(l4eNew.at(-1)?.position).toBe(48);
    expect(migration).not.toContain("'pyraminx', 'last-layer'");
  });

  it('validates every supplement against the audited production case setup', async () => {
    const failures: string[] = [];
    for (const [set, supplements, sticker] of [
      ['cmll', cmllSupplement, { kind: 'face', us: '', ub: '', uf: '', ul: '', ur: '' }],
      ['eo4a', eoSupplement, { kind: 'face', us: '', ub: '', uf: '', ul: '', ur: '' }],
    ] as const) {
      for (const item of supplements) {
        const baseline = baselineByKey.get(`3x3/${set}/${item.targetName}`)!;
        for (const entry of item.algs) {
          const bare = displayAlg(entry.alg);
          const result = await validateAlgCase(baseline.setup, bare, sticker, '3x3', set);
          const completed = [bare, result.auf].filter(Boolean).join(' ');
          if (!result.ok || completed !== entry.alg) {
            failures.push(`${set}/${item.targetName}: ${entry.alg}: ${result.reason ?? `expected ${completed}`}`);
          }
        }
      }
    }

    for (const item of l4eSupplement) {
      const baseline = baselineByKey.get(`pyraminx/l4e/${item.targetName}`)!;
      for (const entry of item.algs) {
        if (!(await exactlySolves('pyraminx', baseline.setup, entry.alg))) {
          failures.push(`l4e/${item.targetName}: ${entry.alg}: does not exactly solve`);
        }
      }
    }

    expect(cmllSupplement.flatMap(item => item.algs)).toHaveLength(19);
    expect(eoSupplement.flatMap(item => item.algs)).toHaveLength(12);
    expect(l4eSupplement.flatMap(item => item.algs)).toHaveLength(3);
    expect(failures).toEqual([]);
  });

  it('all newly inserted EO and L4E cases exactly solve their inverse-derived setups', async () => {
    const failures: string[] = [];
    for (const item of eoNew) for (const entry of item.algs.flat()) {
      if (!(await exactlySolves('3x3x3', item.setup, entry.alg))) {
        failures.push(`eo4a/${item.name}: ${entry.alg}`);
      }
    }
    for (const item of l4eNew) for (const entry of item.algs.flat()) {
      if (!(await exactlySolves('pyraminx', item.setup, entry.alg))) {
        failures.push(`l4e/${item.name}: ${entry.alg}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('puts every Roux set in the dedicated 3x3 section and reuses shared thumbnails', () => {
    const rouxSlugs = ['2-look-cmll', 'cmll', 'oh-cmll', 'sbls', 'eo4a', 'lse-eolr'];
    const catalogSlugs = ALG_CATALOG['3x3'].map(item => item.slug);
    for (const slug of rouxSlugs) expect(catalogSlugs).toContain(slug);

    const page = readFileSync(join(clientRoot, 'app', '[lang]', 'alg', '[puzzle]', 'AlgPuzzleClient.tsx'), 'utf8');
    expect(page).toContain("tr({ zh: '桥式', en: 'Roux' })");
    for (const slug of rouxSlugs) expect(page).toContain(`'${slug}'`);

    const raw = { kind: 'raw' as const, tag: '', attrs: {} };
    for (const slug of ['2-look-cmll', 'oh-cmll']) {
      expect(cubeThumbParams('3x3', slug, raw)).toEqual({
        view: 'pll', mask: 'cmll', hideGreySides: true, puzzleSize: 3,
      });
    }
  });

  it('locks final merged counts and the pinned MIT source revision', () => {
    expect(migration).toContain('613a49885dc618023368e5f0c2a25024b8c7e9a5');
    for (const expected of [
      '3x3/2-look-cmll: expected 9 cases',
      '3x3/cmll: expected 179 algorithms',
      '3x3/oh-cmll: expected 99 algorithms',
      '3x3/eo4a: expected 11 cases',
      '3x3/eo4a: expected 43 algorithms',
      '3x3/lse-eolr: expected 48 algorithms',
      'pyraminx/l3e: expected 16 algorithms',
      'pyraminx/l4e: expected 49 cases',
      'pyraminx/l4e: expected 202 algorithms',
    ]) expect(migration).toContain(expected);
  });
});
