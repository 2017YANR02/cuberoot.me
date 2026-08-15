import fs from 'node:fs';
import path from 'node:path';

const upstreamRepo = path.resolve(process.argv[2] ?? '../../squanmate');
const upstream = path.join(upstreamRepo, 'src/squanmate/scramblers/algsets');
const output = path.resolve('packages/client/lib/sq1-alg-trainer-data.ts');

function source(name) {
  return fs.readFileSync(path.join(upstream, name), 'utf8');
}

function definition(text, name, nextName) {
  const start = text.indexOf(`(def ^:private ${name}`);
  const end = nextName ? text.indexOf(`(def ^:private ${nextName}`, start + 1) : text.length;
  if (start < 0 || end < 0) throw new Error(`Could not find ${name}`);
  return text.slice(start, end);
}

function rows(text) {
  const result = [];
  const row = /\["((?:\\.|[^"\\])*)"\s+"((?:\\.|[^"\\])*)"/g;
  let match;
  while ((match = row.exec(text))) {
    result.push({
      name: JSON.parse(`"${match[1]}"`),
      algorithm: JSON.parse(`"${match[2]}"`),
    });
  }
  return result;
}

const configs = [
  {
    id: 'cubeshape',
    label: 'Cubeshape',
    source: 'cubeshape.cljs',
    even: [{ name: 'Cubeshape', algorithm: '' }],
    odd: [{ name: 'Cubeshape (odd parity)', algorithm: '' }],
  },
  { id: 'edge-permutation', label: 'Edge permutation (EP)', source: 'edge_permutation.cljs' },
  { id: 'permute-last-layer', label: 'Permute last layer (PLL)', source: 'permute_last_layer.cljs' },
  { id: 'lin-corner-permutation', label: 'Lin corner permutation', source: 'lin_corner_permutation.cljs', linCorner: true },
  { id: 'lin-pll-plus-1', label: 'Lin PLL+1', source: 'lin_pll_plus_1.cljs' },
];

for (const config of configs) {
  if (config.even) continue;
  const text = source(config.source);
  if (config.linCorner) {
    const bottomSolved = rows(definition(text, 'cases-with-bottom-solved', 'cases-with-df-edge-unsolved'));
    const dfUnsolved = rows(definition(text, 'cases-with-df-edge-unsolved', 'lin-top-edges-and-db-edge'));
    config.even = [...dfUnsolved, ...bottomSolved];
    config.odd = [...dfUnsolved, ...bottomSolved];
  } else {
    config.even = rows(definition(text, 'even-cases', 'odd-cases'));
    config.odd = rows(definition(text, 'odd-cases'));
  }
}

const lines = [
  '/**',
  ' * Generated from mikavilpas/squanmate algsets. Keep names, order, parity',
  ' * grouping, and algorithms byte-for-byte equivalent to the upstream data.',
  ' * Regenerate from core with:',
  ' * node packages/client/scripts/generate-sq1-alg-trainer-data.mjs ../../squanmate',
  ' */',
  '',
  "export type Sq1AlgTrainerGroupId = 'cubeshape' | 'edge-permutation' | 'permute-last-layer' | 'lin-corner-permutation' | 'lin-pll-plus-1';",
  "export type Sq1AlgTrainerParity = 'even' | 'odd';",
  '',
  'export interface Sq1AlgTrainerCase {',
  '  id: string;',
  '  groupId: Sq1AlgTrainerGroupId;',
  '  parity: Sq1AlgTrainerParity;',
  '  name: string;',
  '  algorithm: string;',
  '}',
  '',
  'export interface Sq1AlgTrainerGroup {',
  '  id: Sq1AlgTrainerGroupId;',
  '  label: string;',
  '  cases: readonly Sq1AlgTrainerCase[];',
  '}',
  '',
  'export const SQ1_ALG_TRAINER_GROUPS: readonly Sq1AlgTrainerGroup[] = [',
];

for (const config of configs) {
  lines.push(`  { id: ${JSON.stringify(config.id)}, label: ${JSON.stringify(config.label)}, cases: [`);
  for (const parity of ['even', 'odd']) {
    config[parity].forEach((item, index) => {
      const id = `${config.id}:${parity}:${index + 1}`;
      lines.push(`    { id: ${JSON.stringify(id)}, groupId: ${JSON.stringify(config.id)}, parity: ${JSON.stringify(parity)}, name: ${JSON.stringify(item.name)}, algorithm: ${JSON.stringify(item.algorithm)} },`);
    });
  }
  lines.push('  ] },');
}

lines.push(
  '];',
  '',
  'export const SQ1_ALG_TRAINER_CASES = SQ1_ALG_TRAINER_GROUPS.flatMap((group) => group.cases);',
  '',
);

fs.writeFileSync(output, `${lines.join('\n')}\n`, 'utf8');
console.log(configs.map((group) => `${group.label}: ${group.even.length} even + ${group.odd.length} odd`).join('\n'));
console.log(`Total: ${configs.reduce((sum, group) => sum + group.even.length + group.odd.length, 0)}`);
