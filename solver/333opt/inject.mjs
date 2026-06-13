// Step 3 — fold the solved histogram into stats/scramble/{distribution,examples}.json
// as the "333" method (variant '333', single stage '333') under sets.wca.variants.
// Reads every out.*.csv in this dir + scrambles.txt. Local write only; publishing
// to the CDN is a separate manual scp (see README).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const DIST = resolve(repoRoot, 'stats/scramble/distribution.json');
const EX = resolve(repoRoot, 'stats/scramble/examples.json');

const lens = {}; // line idx -> htm len
for (const f of readdirSync(__dirname).filter((f) => /^out\.\d+\.csv$/.test(f))) {
  for (const l of readFileSync(resolve(__dirname, f), 'utf8').split('\n').filter(Boolean)) {
    const [i, len] = l.split(',');
    if (len) lens[Number(i)] = Number(len);
  }
}
const scrambles = readFileSync(resolve(__dirname, 'scrambles.txt'), 'utf8').split('\n').map((s) => s.trim());

const counts = {};
for (const i of Object.keys(lens)) { const L = lens[i]; counts[L] = (counts[L] || 0) + 1; }
const bins = Object.keys(counts).map(Number).sort((a, b) => a - b);
const min = bins[0], max = bins[bins.length - 1];

// distribution.json — 333 整解作独立方法 variant '333',阶段只有 '333' 自身。
const dist = JSON.parse(readFileSync(DIST, 'utf8'));
const std = dist.sets.wca.variants.std;
std.stages = std.stages.filter((s) => s !== '333'); // 清掉早期把 333 塞进 std 的注入(若有)
delete std.data['333'];
const total = Object.values(counts).reduce((a, b) => a + b, 0);
dist.sets.wca.variants['333'] = {
  sample_count: total,
  stages: ['333'],
  data: { '333': { ALL: { min, max, counts, counts_qtm: {}, example_bins: [] } } },
};
writeFileSync(DIST, JSON.stringify(dist));

// examples.json — sets.wca.variants['333']['333'].ALL[bin] = [[id, scramble, color]]
const ex = JSON.parse(readFileSync(EX, 'utf8'));
ex.sets.wca ??= { variants: {} };
ex.sets.wca.variants ??= {};
delete ex.sets.wca.variants.std?.['333'];
const byBin = {};
for (const i of Object.keys(lens)) {
  const L = String(lens[i]);
  (byBin[L] ??= []);
  if (byBin[L].length < 12) byBin[L].push([String(i), scrambles[Number(i)], '']);
}
ex.sets.wca.variants['333'] = { '333': { ALL: byBin } };
writeFileSync(EX, JSON.stringify(ex));

console.log('injected 333:', JSON.stringify(counts), '| example bins', Object.keys(byBin).join(','));
