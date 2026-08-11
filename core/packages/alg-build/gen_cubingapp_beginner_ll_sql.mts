/** CubingApp 2 Look OLL / PLL plus the missing 4x4 PLL Parity alternatives. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalNnnAlg } from '@cuberoot/shared/alg-mirror';
import {
  assertSetCounts,
  completeExactAlgAuf,
  invertCubeAlg,
  normalizeFourByFourAlg,
  readCubingAppSet,
  sourceCubeAlgs,
} from './cubingapp_cube_import.mts';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const upstreamRoot = resolve(process.cwd(), process.argv[2] ?? resolve(HERE, '../../../../cubingapp'));
const output = resolve(process.cwd(), process.argv[3] ?? resolve(HERE, '../server/migrations/0109_cubingapp_beginner_ll.sql'));
const upstreamCommit = '613a49885dc618023368e5f0c2a25024b8c7e9a5';

const twoLookOll = readCubingAppSet(upstreamRoot, '2-Look-OLL');
const twoLookPll = readCubingAppSet(upstreamRoot, '2-Look-PLL');
const pllParity = readCubingAppSet(upstreamRoot, '4x4-PLL-Parity');
type ParityBaselineCase = { position: number; name: string; algs: string[] };
const parityBaseline = JSON.parse(readFileSync(
  resolve(HERE, 'fixtures/4x4-pll-parity-baseline.json'),
  'utf8',
)) as ParityBaselineCase[];

assertSetCounts('2 Look OLL', twoLookOll, 9, 9);
assertSetCounts('2 Look PLL', twoLookPll, 6, 10);
assertSetCounts('4x4 PLL Parity', pllParity, 22, 22);

const NOTE_ZH: Record<string, string> = {
  "F sexy F'": "F sexy F'",
  "F inverse sexy F'": "F inverse sexy F'",
  'Inverse of Sune': '小鱼的逆公式',
  'Double Sune with cancellation': '双小鱼，消去重复转动',
  'Sexy sledge with wide moves': 'Sexy sledge with wide moves',
  'Inverse of T OLL': 'T OLL 的逆公式',
  'Inverse of Ub perm': 'Ub perm 的逆公式',
  'Inverse of Ua perm': 'Ua perm 的逆公式',
};

const faceSticker = { kind: 'face', us: '', ub: '', uf: '', ul: '', ur: '' } as const;
const OLL_SCHEME = 'FFFF00,404040,404040,404040,404040,404040';

async function completeSetPayload(
  source: typeof twoLookOll,
  stickerFor: (item: (typeof source.cases)[string]) => typeof faceSticker,
) {
  return Promise.all(Object.entries(source.cases).map(async ([name, item], position) => {
    const algs = sourceCubeAlgs(item, NOTE_ZH);
    const setup = invertCubeAlg(algs[0][0].alg);
    for (const entry of algs[0]) {
      const original = entry.alg;
      entry.alg = await completeExactAlgAuf('3x3x3', setup, original);
      if (source === twoLookPll && entry.alg !== original && !entry.note) {
        entry.note = {
          en: 'AUF adjusted to match the case diagram',
          zh: '调整 AUF，使公式与情况图一致',
        };
      }
    }
    return {
      position,
      name,
      subgroup: item.subset ?? '',
      setup,
      sticker: stickerFor(item),
      algs,
    };
  }));
}

const ollPayload = await completeSetPayload(twoLookOll, item => ({
  ...faceSticker,
  mask: item.subset === 'Edges' ? 'oell' : 'ocll',
  scheme: OLL_SCHEME,
}));
const pllPayload = await completeSetPayload(twoLookPll, () => faceSticker);
if (parityBaseline.length !== 22) throw new Error(`expected 22 baseline parity cases, got ${parityBaseline.length}`);
if (parityBaseline.flatMap(item => item.algs).length !== 40) {
  throw new Error('expected 40 baseline parity formulas');
}
const parityBaselineByName = new Map(parityBaseline.map(item => [item.name, item]));
const parityPayload = Object.entries(pllParity.cases).map(([name, item], position) => {
  const baseline = parityBaselineByName.get(name);
  if (!baseline || baseline.position !== position) throw new Error(`parity baseline mismatch: ${name}`);
  const algs = sourceCubeAlgs(item, NOTE_ZH, normalizeFourByFourAlg);
  const canonicalKey = canonicalNnnAlg(algs[0][0].alg);
  return {
    position,
    name,
    existing: baseline.algs.some(alg => canonicalNnnAlg(alg) === canonicalKey),
    algs,
    canonicalKey,
  };
});

if (parityPayload.filter(item => item.existing).length !== 5) throw new Error('expected 5 existing parity formulas');
if (parityPayload.filter(item => !item.existing).length !== 17) throw new Error('expected 17 missing parity formulas');

const pretty = (value: unknown) => JSON.stringify(value, null, 2);
const source = (path: string, speedCubeDb?: string) => [
  speedCubeDb ? `https://speedcubedb.com/a/4x4/${speedCubeDb}` : null,
  `https://cubingapp.com/algorithms/${path}`,
  `https://github.com/spencerchubb/cubingapp/commit/${upstreamCommit}`,
].filter(Boolean).join('; ');

function completeSetSql(tag: string, puzzle: string, set: string, payload: unknown) {
  return [
    `WITH payload AS (SELECT $${tag}$${pretty(payload)}$${tag}$::jsonb AS body),`,
    'items AS (SELECT value AS item FROM payload, jsonb_array_elements(body))',
    'UPDATE alg_cases AS c',
    "SET position = (items.item->>'position')::integer, name = items.item->>'name', subgroup = items.item->>'subgroup',",
    "    setup = items.item->>'setup', sticker = items.item->'sticker', algs = items.item->'algs'",
    'FROM items',
    `WHERE c.puzzle = '${puzzle}' AND c.set_slug = '${set}' AND c.name = items.item->>'name';`,
    '',
    `WITH payload AS (SELECT $${tag}$${pretty(payload)}$${tag}$::jsonb AS body),`,
    'items AS (SELECT value AS item FROM payload, jsonb_array_elements(body))',
    'INSERT INTO alg_cases (puzzle, set_slug, position, name, subgroup, setup, sticker, algs)',
    `SELECT '${puzzle}', '${set}', (item->>'position')::integer, item->>'name', item->>'subgroup', item->>'setup', item->'sticker', item->'algs'`,
    'FROM items',
    `WHERE NOT EXISTS (SELECT 1 FROM alg_cases WHERE puzzle = '${puzzle}' AND set_slug = '${set}' AND name = item->>'name');`,
  ];
}

const lines = [
  '-- Import CubingApp beginner last-layer sets and supplement 4x4 PLL Parity.',
  '-- Generated by packages/alg-build/gen_cubingapp_beginner_ll_sql.mts.',
  `-- Upstream: CubingApp commit ${upstreamCommit} (MIT).`,
  '',
  'INSERT INTO alg_sets (puzzle, set_slug, source, scraped_at) VALUES',
  `  ('3x3', '2-look-oll', '${source('2-Look-OLL')}', NOW()),`,
  `  ('3x3', '2-look-pll', '${source('2-Look-PLL')}', NOW()),`,
  `  ('4x4', 'pll-parity', '${source('4x4-PLL-Parity', 'PLLParity')}', NOW())`,
  'ON CONFLICT (puzzle, set_slug) DO UPDATE SET source = EXCLUDED.source, scraped_at = EXCLUDED.scraped_at;',
  '',
  ...completeSetSql('cubingapp_2look_oll', '3x3', '2-look-oll', ollPayload),
  '',
  ...completeSetSql('cubingapp_2look_pll', '3x3', '2-look-pll', pllPayload),
  '',
  '-- Five source formulas were canonical state/text matches in the audited production baseline.',
  '-- Prepend only the 17 missing formulas; keep every existing parity alternative and case id.',
  `WITH payload AS (SELECT $cubingapp_4x4_pll_parity$${pretty(parityPayload)}$cubingapp_4x4_pll_parity$::jsonb AS body),`,
  'items AS (SELECT value AS item FROM payload, jsonb_array_elements(body))',
  'UPDATE alg_cases AS c',
  'SET algs = jsonb_build_array(',
  '  COALESCE((',
  '    SELECT jsonb_agg(source.entry ORDER BY source.ord)',
  "    FROM jsonb_array_elements(COALESCE(items.item->'algs'->0, '[]'::jsonb)) WITH ORDINALITY AS source(entry, ord)",
  "    WHERE (items.item->>'existing')::boolean = false",
  '      AND NOT EXISTS (',
  "      SELECT 1 FROM jsonb_array_elements(COALESCE(c.algs->0, '[]'::jsonb)) AS existing(entry)",
  "      WHERE regexp_replace(existing.entry->>'alg', '\\s', '', 'g') = regexp_replace(source.entry->>'alg', '\\s', '', 'g')",
  '    )',
  "  ), '[]'::jsonb) || COALESCE(c.algs->0, '[]'::jsonb)",
  ')',
  'FROM items',
  "WHERE c.puzzle = '4x4' AND c.set_slug = 'pll-parity' AND c.name = items.item->>'name';",
  '',
  'DO $cubingapp_beginner_ll_counts$',
  'DECLARE got BIGINT;',
  'BEGIN',
  "  SELECT COUNT(*) INTO got FROM alg_cases WHERE puzzle = '3x3' AND set_slug = '2-look-oll';",
  "  IF got <> 9 THEN RAISE EXCEPTION '3x3/2-look-oll: expected 9 cases, got %', got; END IF;",
  "  SELECT SUM(jsonb_array_length(algs->0)) INTO got FROM alg_cases WHERE puzzle = '3x3' AND set_slug = '2-look-oll';",
  "  IF got <> 9 THEN RAISE EXCEPTION '3x3/2-look-oll: expected 9 algorithms, got %', got; END IF;",
  "  SELECT COUNT(*) INTO got FROM alg_cases WHERE puzzle = '3x3' AND set_slug = '2-look-pll';",
  "  IF got <> 6 THEN RAISE EXCEPTION '3x3/2-look-pll: expected 6 cases, got %', got; END IF;",
  "  SELECT SUM(jsonb_array_length(algs->0)) INTO got FROM alg_cases WHERE puzzle = '3x3' AND set_slug = '2-look-pll';",
  "  IF got <> 10 THEN RAISE EXCEPTION '3x3/2-look-pll: expected 10 algorithms, got %', got; END IF;",
  "  SELECT COUNT(*) INTO got FROM alg_cases WHERE puzzle = '4x4' AND set_slug = 'pll-parity';",
  "  IF got <> 22 THEN RAISE EXCEPTION '4x4/pll-parity: expected 22 cases, got %', got; END IF;",
  "  SELECT SUM(jsonb_array_length(algs->0)) INTO got FROM alg_cases WHERE puzzle = '4x4' AND set_slug = 'pll-parity';",
  "  IF got <> 57 THEN RAISE EXCEPTION '4x4/pll-parity: expected 57 algorithms, got %', got; END IF;",
  'END',
  '$cubingapp_beginner_ll_counts$;',
  '',
];

writeFileSync(output, lines.join('\n'), 'utf8');
console.log(`wrote ${output}: 2 Look OLL 9/9; 2 Look PLL 6/10; 4x4 PLL Parity 22/57`);
