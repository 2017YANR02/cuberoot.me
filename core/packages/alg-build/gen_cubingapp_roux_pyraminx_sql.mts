/** CubingApp Roux sets plus state-audited Pyraminx L4E supplements. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertSetCounts,
  cleanCubeAlg,
  completeExactAlgAuf,
  invertCubeAlg,
  invariant,
  readCubingAppSet,
  sourceCubeAlgs,
  type CubingAppCase,
} from './cubingapp_cube_import.mts';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const upstreamRoot = resolve(process.cwd(), process.argv[2] ?? resolve(HERE, '../../../../cubingapp'));
const output = resolve(process.cwd(), process.argv[3] ?? resolve(HERE, '../server/migrations/0110_cubingapp_roux_pyraminx.sql'));
const upstreamCommit = '613a49885dc618023368e5f0c2a25024b8c7e9a5';

const twoLookCmll = readCubingAppSet(upstreamRoot, '2-Look-CMLL');
const cmll = readCubingAppSet(upstreamRoot, 'CMLL');
const ohCmll = readCubingAppSet(upstreamRoot, 'OH-CMLL');
const lseEo = readCubingAppSet(upstreamRoot, 'LSE-EO');
const lseEolr = readCubingAppSet(upstreamRoot, 'LSE-EOLR');
const pyraminxLastLayer = readCubingAppSet(upstreamRoot, 'Pyraminx-Last-Layer');
const pyraminxL4e = readCubingAppSet(upstreamRoot, 'Pyraminx-L4E');
type BaselineCase = { puzzle: string; set: string; name: string; setup: string };
type L3eOverlap = { sourceName: string; targetName: string; existingAlg: string };
const baselineCases = JSON.parse(readFileSync(
  resolve(HERE, 'fixtures/cubingapp-roux-pyraminx-baseline.json'),
  'utf8',
)) as BaselineCase[];
const baselineByKey = new Map(baselineCases.map(item => [
  `${item.puzzle}/${item.set}/${item.name}`,
  item,
]));
const l3eOverlap = JSON.parse(readFileSync(
  resolve(HERE, 'fixtures/cubingapp-pyraminx-last-layer-overlap.json'),
  'utf8',
)) as L3eOverlap[];

assertSetCounts('2 Look CMLL', twoLookCmll, 9, 9);
assertSetCounts('CMLL', cmll, 42, 160);
assertSetCounts('OH CMLL', ohCmll, 42, 100);
assertSetCounts('LSE EO', lseEo, 11, 14);
assertSetCounts('LSE EOLR', lseEolr, 46, 48);
assertSetCounts('Pyraminx Last Layer', pyraminxLastLayer, 5, 5);
assertSetCounts('Pyraminx L4E', pyraminxL4e, 35, 36);

invariant(l3eOverlap.length === 5, 'Pyraminx Last Layer overlap audit must contain five formulas');
for (const item of l3eOverlap) {
  const sourceCase = pyraminxLastLayer.cases[item.sourceName];
  invariant(sourceCase, `missing Pyraminx Last Layer source case ${item.sourceName}`);
  const sourceAlgs = Object.keys(sourceCase.algs);
  invariant(sourceAlgs.length === 1, `${item.sourceName}: expected exactly one source formula`);
  invariant(
    cleanCubeAlg(sourceAlgs[0]) === cleanCubeAlg(item.existingAlg),
    `${item.sourceName}: audited L3E formula drifted`,
  );
}

const NOTE_ZH: Record<string, string> = {
  'Inverse of Sune': '小鱼的逆公式',
  'Double Sune with cancellation': '双小鱼，消去重复转动',
  'Sexy sledge': 'Sexy sledge',
  'Inverse of T CMLL': 'T CMLL 的逆公式',
  "F sexy F'": "F sexy F'",
  "F double sexy F'": "F double sexy F'",
  'J Perm': 'J Perm',
  'Y Perm': 'Y Perm',
};

const faceSticker = { kind: 'face', us: '', ub: '', uf: '', ul: '', ur: '' } as const;
const pyraminxSticker = { kind: 'raw', tag: 'pcube', attrs: {} } as const;

async function fullSetPayload(source: typeof twoLookCmll, mask?: string, exact = false) {
  return Promise.all(Object.entries(source.cases).map(async ([name, item], position) => {
    const algs = sourceCubeAlgs(item, NOTE_ZH);
    const firstMeta = Object.values(item.algs)[0];
    const setup = [
      firstMeta.setup ? cleanCubeAlg(firstMeta.setup) : '',
      invertCubeAlg(algs[0][0].alg),
    ].filter(Boolean).join(' ');
    if (exact) for (const entry of algs[0]) {
      entry.alg = await completeExactAlgAuf('3x3x3', setup, entry.alg);
    }
    return {
      position,
      name,
      subgroup: item.subset ?? '',
      setup,
      sticker: mask ? { ...faceSticker, mask } : faceSticker,
      algs,
    };
  }));
}

const twoLookCmllPayload = await fullSetPayload(twoLookCmll, 'cmll', true);
const ohCmllPayload = await fullSetPayload(ohCmll, 'cmll');
const lseEolrPayload = await fullSetPayload(lseEolr, 'eo_orbit');

const INVALID_OH_CMLL = "r' U2' R U' R' U' R U R' U r";
const OH_CMLL_REANCHOR: ReadonlyArray<[string, string, string]> = [
  ['Sune Columns', "F U' R' U R U F' U2 R f' U' f", 'U2'],
  ['Antisune Forward Slash', "U R' U z U R' D R U'", "y2 U2|U'"],
];

for (const item of ohCmllPayload) {
  item.algs[0] = item.algs[0].filter(entry => entry.alg !== INVALID_OH_CMLL);
}
for (const [name, raw, anchor] of OH_CMLL_REANCHOR) {
  const item = ohCmllPayload.find(row => row.name === name);
  const entry = item?.algs[0].find(candidate => candidate.alg === raw);
  invariant(entry, `missing OH CMLL re-anchor target: ${name}`);
  const [pre, post = ''] = anchor.split('|');
  entry.alg = [pre, raw, post].filter(Boolean).join(' ');
  entry.note = {
    en: `Re-anchored with ${[pre, post].filter(Boolean).join(' / ')} to match the audited case state`,
    zh: `用 ${[pre, post].filter(Boolean).join(' / ')} 调整基准方向，使公式与审计后的情况状态一致`,
  };
}
invariant(ohCmllPayload.flatMap(item => item.algs[0]).length === 99, 'OH CMLL must keep 99 validated formulas');

const CMLL_TARGETS: Record<string, string> = {
  'Pi Backslash': 'Pi Down Slash',
  'Pi Forward Slash': 'Pi Up Slash',
  'U Forward Slash': 'U Up Slash',
  'U Backslash': 'U Down Slash',
  'U Front Row': 'U Bottom Row',
  'U Back Row': 'U Upper Row',
  'T Front Row': 'T Bottom Row',
  'T Back Row': 'T Top Row',
  'Sune Forward Slash': 'Sune Up Slash',
  'Sune Backslash': 'Sune Down Slash',
  'Antisune Right Bar': 'Anti Sune Right Bar',
  'Antisune Columns': 'Anti Sune Columns',
  'Antisune Backslash': 'Anti Sune Down Slash',
  'Antisune X': 'Anti Sune X',
  'Antisune Forward Slash': 'Anti Sune Up Slash',
  'Antisune Left Bar': 'Anti Sune Left Bar',
};

/**
 * CubingApp CMLL has 141 normalized formulas already present in the 168-formula
 * SpeedCubeDB set. These are the 19 state-checked additions. The AUF is the
 * completion needed by the existing case orientation; displayAlg hides it.
 */
const CMLL_MISSING: ReadonlyArray<[string, string, string]> = [
  ['O Adjacent', "R U2 R' U' R U2 L' U R' U' L", 'U'],
  ['Pi Right Bar', "R' U2 R2 U R2 U R2 U2 R'", 'U2'],
  ['Pi Backslash', "R' U2 R U R' U' R U2 R f' U' f", 'U'],
  ['Pi Columns', "U' R U2 R' U R' D' R U2 R' D R2 U' R'", "U'"],
  ['U Forward Slash', "r U' r' U' r U' r' U' F' U2 F", ''],
  ['U Forward Slash', "R' U2 R U2 F U' R' U R U F'", "U'"],
  ['U Backslash', "U2 L2 D' L U2 L' D L U2 L", 'U2'],
  ['U Backslash', "R' r' D' r U2 r' D r U2 R", ''],
  ['U Front Row', "U' R U R' U' R U' R' U2 R U' R' U2 R U R'", 'U2'],
  ['T Rows', "R' U R U2 R' U' R U2 R' U' R U' R' U R", ''],
  ['Sune Left Bar', "U' L U L' U L U2 L'", 'U2'],
  ['Sune Columns', "U2 R' F2 R2 U2 R' F R U2 R2 F2 R", 'U'],
  ['Sune Backslash', "U' L U' R' U L' U' R", 'U2'],
  ['Antisune Right Bar', "U' L' U' L U' L' U2 L", 'U2'],
  ['Antisune Columns', "U' L' U' L U L F' L' F L' U' L U' L' U2 L", ''],
  ['Antisune Backslash', "U' M F' r U R' U2 R' F2 R", ''],
  ['Antisune Forward Slash', "U R' U L U' R U L'", 'U2'],
  ['Antisune Left Bar', "U L' U' L U' L F' L' F L' U2 L", "U'"],
  ['L Pure', "U' R' U2 R U R' U' R U R' U' R U R' U R", 'U'],
];

const sourceEntry = (alg: string, auf = '') => ({
  alg: [cleanCubeAlg(alg), auf].filter(Boolean).join(' '),
  source: 'cubingapp' as const,
});

async function completeForBaseline(puzzleId: '3x3x3' | 'pyraminx', puzzle: string, set: string, name: string, alg: string) {
  const baseline = baselineByKey.get(`${puzzle}/${set}/${name}`);
  invariant(baseline, `missing audited baseline setup for ${puzzle}/${set}/${name}`);
  return sourceEntry(await completeExactAlgAuf(puzzleId, baseline.setup, alg));
}

const cmllSupplement = CMLL_MISSING.map(([sourceName, alg, auf]) => {
  const targetName = CMLL_TARGETS[sourceName] ?? sourceName;
  return {
    targetName,
    algs: [sourceEntry(alg, auf)],
  };
});

const EO_EXISTING_TARGETS: ReadonlyArray<[string, number, string, string]> = [
  ['Front Arrow', 0, 'Top 2 Front 2', ''],
  ['2 Adj / 2', 0, '2 Top Adj 2 Bot', ''],
  ['Front 1 / 1', 0, '1 Top 1 Bot', ''],
  ['Front 1 / 1', 1, '1 Top 1 Bot', ''],
  ['Back 1 / 1', 0, 'Bottom 2', 'U'],
  ['Back 1 / 1', 1, '2 Top Adj', 'U'],
  ['2 Opp / 2', 0, '2 Top 2 Bot', ''],
  ['2 Opp / 0', 0, '2 Top Opp', ''],
  ['0 / 2', 0, 'Bottom 2', ''],
  ['4 / 0', 0, '4 Top', ''],
  ['4 / 0', 1, '4 Top', ''],
  ['All 6', 0, 'All 6', ''],
];

function algAt(source: CubingAppCase, index: number): string {
  const alg = Object.keys(source.algs)[index];
  invariant(alg, `missing CubingApp algorithm at index ${index}`);
  return alg;
}

const eoSupplement = EO_EXISTING_TARGETS.map(([sourceName, index, targetName, auf]) => ({
  targetName,
  algs: [sourceEntry(algAt(lseEo.cases[sourceName], index), auf)],
}));

const eoNewCases = ['Back Arrow', '2 Adj / 0'].map((name, offset) => {
  const item = lseEo.cases[name];
  invariant(item, `missing LSE EO case ${name}`);
  const algs = sourceCubeAlgs(item, NOTE_ZH);
  return {
    position: 9 + offset,
    name,
    subgroup: item.subset ?? '',
    setup: invertCubeAlg(algs[0][0].alg),
    sticker: { ...faceSticker, mask: 'eo_orbit' },
    algs,
  };
});

const L4E_EXISTING: ReadonlyArray<[string, number, string]> = [
  ['Down Edge Flipped #1', 0, '4 Flip'],
  ['Down Edge Flipped #4', 0, 'DB Flip'],
  ['Down Edge Flipped #4', 1, 'DB Flip'],
];

const l4eSupplement = await Promise.all(L4E_EXISTING.map(async ([sourceName, index, targetName]) => ({
  targetName,
  algs: [await completeForBaseline(
    'pyraminx', 'pyraminx', 'l4e', targetName, algAt(pyraminxL4e.cases[sourceName], index),
  )],
})));

const L4E_NEW_NAMES = [
  'Down Edge Flipped #5', 'Down Edge Flipped #6',
  'Upper Edge Flipped #3', 'Upper Edge Flipped #4',
  'Upper Edge Flipped #7', 'Upper Edge Flipped #8',
  'Nothing Placed #1', 'Nothing Placed #2',
  'Nothing Placed #5', 'Nothing Placed #6',
  'Nothing Placed #7', 'Nothing Placed #8',
] as const;

const l4eNewCases = L4E_NEW_NAMES.map((name, offset) => {
  const item = pyraminxL4e.cases[name];
  invariant(item, `missing Pyraminx L4E case ${name}`);
  const algs = sourceCubeAlgs(item, NOTE_ZH);
  return {
    position: 37 + offset,
    name,
    subgroup: item.subset ?? '',
    setup: invertCubeAlg(algs[0][0].alg),
    sticker: pyraminxSticker,
    algs,
  };
});

invariant(cmllSupplement.length === 19, 'CMLL supplement must contain 19 formulas');
invariant(eoNewCases.length === 2, 'LSE EO supplement must contain two missing states');
invariant(l4eNewCases.length === 12, 'Pyraminx L4E supplement must contain 12 missing states');

const pretty = (value: unknown) => JSON.stringify(value, null, 2);
const source = (path: string, speedCubeDb?: string) => [
  speedCubeDb ? `https://speedcubedb.com/a/${speedCubeDb}` : null,
  `https://cubingapp.com/algorithms/${path}`,
  `https://github.com/spencerchubb/cubingapp/commit/${upstreamCommit}`,
].filter(Boolean).join('; ');

function completeSetSql(tag: string, puzzle: string, set: string, payload: unknown) {
  return [
    `WITH payload AS (SELECT $${tag}$${pretty(payload)}$${tag}$::jsonb AS body),`,
    'items AS (SELECT value AS item FROM payload, jsonb_array_elements(body))',
    'UPDATE alg_cases AS c',
    "SET position = (items.item->>'position')::integer, subgroup = items.item->>'subgroup',",
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

function appendAlgsSql(tag: string, puzzle: string, set: string, payload: unknown) {
  return [
    `WITH payload AS (SELECT $${tag}$${pretty(payload)}$${tag}$::jsonb AS body),`,
    'items AS (',
    '  SELECT item, item_ord',
    '  FROM payload, jsonb_array_elements(body) WITH ORDINALITY AS source(item, item_ord)',
    '),',
    'source_entries AS (',
    "  SELECT item->>'targetName' AS target_name, entry, item_ord, entry_ord,",
    "         regexp_replace(translate(entry->>'alg', '()', ''), '\\s', '', 'g') AS canonical_key",
    '  FROM items, jsonb_array_elements(COALESCE(item->\'algs\', \'[]\'::jsonb))',
    '       WITH ORDINALITY AS source(entry, entry_ord)',
    '),',
    'unique_source AS (',
    '  SELECT DISTINCT ON (target_name, canonical_key)',
    '         target_name, entry, item_ord, entry_ord',
    '  FROM source_entries',
    '  ORDER BY target_name, canonical_key, item_ord, entry_ord',
    '),',
    'targets AS (',
    '  SELECT target_name, jsonb_agg(entry ORDER BY item_ord, entry_ord) AS entries',
    '  FROM unique_source',
    '  GROUP BY target_name',
    ')',
    'UPDATE alg_cases AS c',
    "SET algs = jsonb_set(c.algs, '{0}', COALESCE(c.algs->0, '[]'::jsonb) || COALESCE((",
    '  SELECT jsonb_agg(source.entry ORDER BY source.ord)',
    "  FROM jsonb_array_elements(COALESCE(targets.entries, '[]'::jsonb)) WITH ORDINALITY AS source(entry, ord)",
    '  WHERE NOT EXISTS (',
    "    SELECT 1 FROM jsonb_array_elements(COALESCE(c.algs, '[]'::jsonb)) AS orientation(entries),",
    "                  jsonb_array_elements(COALESCE(orientation.entries, '[]'::jsonb)) AS existing(entry)",
    "    WHERE regexp_replace(translate(existing.entry->>'alg', '()', ''), '\\s', '', 'g')",
    "        = regexp_replace(translate(source.entry->>'alg', '()', ''), '\\s', '', 'g')",
    '  )',
    "), '[]'::jsonb))",
    'FROM targets',
    `WHERE c.puzzle = '${puzzle}' AND c.set_slug = '${set}' AND c.name = targets.target_name;`,
  ];
}

function assertCountsSql(puzzle: string, set: string, cases: number, algs: number) {
  return [
    `  SELECT COUNT(*) INTO got FROM alg_cases WHERE puzzle = '${puzzle}' AND set_slug = '${set}';`,
    `  IF got <> ${cases} THEN RAISE EXCEPTION '${puzzle}/${set}: expected ${cases} cases, got %', got; END IF;`,
    `  SELECT COALESCE(SUM((SELECT SUM(jsonb_array_length(orientation.value)) FROM jsonb_array_elements(algs) AS orientation(value))), 0) INTO got FROM alg_cases WHERE puzzle = '${puzzle}' AND set_slug = '${set}';`,
    `  IF got <> ${algs} THEN RAISE EXCEPTION '${puzzle}/${set}: expected ${algs} algorithms, got %', got; END IF;`,
  ];
}

const lines = [
  '-- Import CubingApp Roux sets and supplement existing CMLL, LSE EO and Pyraminx sets.',
  '-- Generated by packages/alg-build/gen_cubingapp_roux_pyraminx_sql.mts.',
  `-- Upstream: CubingApp commit ${upstreamCommit} (MIT).`,
  '-- OH CMLL upstream has 100 formulas; one state-invalid H Columns formula is rejected, leaving 99.',
  '',
  'INSERT INTO alg_sets (puzzle, set_slug, source, scraped_at) VALUES',
  `  ('3x3', '2-look-cmll', '${source('2-Look-CMLL')}', NOW()),`,
  `  ('3x3', 'cmll', '${source('CMLL', '3x3/CMLL')}', NOW()),`,
  `  ('3x3', 'oh-cmll', '${source('OH-CMLL')}', NOW()),`,
  `  ('3x3', 'eo4a', '${source('LSE-EO', '3x3/EO4A')}', NOW()),`,
  `  ('3x3', 'lse-eolr', '${source('LSE-EOLR')}', NOW()),`,
  `  ('pyraminx', 'l3e', '${source('Pyraminx-Last-Layer', 'pyraminx/L3E')}', NOW()),`,
  `  ('pyraminx', 'l4e', '${source('Pyraminx-L4E', 'pyraminx/L4E')}', NOW())`,
  'ON CONFLICT (puzzle, set_slug) DO UPDATE SET source = EXCLUDED.source, scraped_at = EXCLUDED.scraped_at;',
  '',
  ...completeSetSql('cubingapp_2look_cmll', '3x3', '2-look-cmll', twoLookCmllPayload),
  '',
  ...completeSetSql('cubingapp_oh_cmll', '3x3', 'oh-cmll', ohCmllPayload),
  '',
  ...completeSetSql('cubingapp_lse_eolr', '3x3', 'lse-eolr', lseEolrPayload),
  '',
  ...appendAlgsSql('cubingapp_cmll_supplement', '3x3', 'cmll', cmllSupplement),
  '',
  ...appendAlgsSql('cubingapp_lse_eo_supplement', '3x3', 'eo4a', eoSupplement),
  '',
  ...completeSetSql('cubingapp_lse_eo_new', '3x3', 'eo4a', eoNewCases),
  '',
  ...appendAlgsSql('cubingapp_pyraminx_l4e_supplement', 'pyraminx', 'l4e', l4eSupplement),
  '',
  ...completeSetSql('cubingapp_pyraminx_l4e_new', 'pyraminx', 'l4e', l4eNewCases),
  '',
  'DO $cubingapp_roux_pyraminx_counts$',
  'DECLARE got BIGINT;',
  'BEGIN',
  ...assertCountsSql('3x3', '2-look-cmll', 9, 9),
  ...assertCountsSql('3x3', 'cmll', 42, 179),
  ...assertCountsSql('3x3', 'oh-cmll', 42, 99),
  ...assertCountsSql('3x3', 'eo4a', 11, 43),
  ...assertCountsSql('3x3', 'lse-eolr', 46, 48),
  ...assertCountsSql('pyraminx', 'l3e', 5, 16),
  ...assertCountsSql('pyraminx', 'l4e', 49, 202),
  'END',
  '$cubingapp_roux_pyraminx_counts$;',
  '',
];

writeFileSync(output, lines.join('\n'), 'utf8');
console.log('wrote', output, 'Roux 9/9 + 42/179 + 42/99 + 11/43 + 46/48; Pyraminx 5/16 + 49/202');
