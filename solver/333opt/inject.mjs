// Step 3 — fold the solved histogram into stats/scramble/{distribution,examples}.json as the
// "333" method (variant '333', single stage '333') under sets.wca. Reads out.*.csv (id,htm) +
// the corpus master (id,scramble for the sampled example ids).
//
// Example bins carry the REAL WCA scramble id + competition metadata merged into the set-level
// sets.wca.{comps,idMeta} — the comp-meta join mirrors build.ts buildExampleCompMeta (same
// wca_scrambles_split_mbf.csv + competitions.tsv source & column layout) and dateDisplay mirrors
// comp_date.ts (both tiny, deliberately kept in-line so this stays a self-contained .mjs step).
//
// Front-end contract (page.tsx): bars come from distribution counts (all clickable); clicking a bin
// reads examples.json sets.wca.variants['333']['333'].ALL[bin] = [[id,scramble,color,optScramble]] and
// resolves the comp card via sets.wca.idMeta[id] → sets.wca.comps[ci]. optScramble = invert(solution)
// = the shortest equivalent scramble (same state), drives the 原始/最优 toggle. example_bins only gates
// the ⬇ download link (333 has none) → [].
//
// Local write only; publishing to the CDN is a separate manual scp (see README).
import { readFileSync, writeFileSync, readdirSync, existsSync, createReadStream } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const DIST = process.env.DIST ? resolve(process.env.DIST) : resolve(repoRoot, 'stats/scramble/distribution.json');
const EX = process.env.EX ? resolve(process.env.EX) : resolve(repoRoot, 'stats/scramble/examples.json');
const CORPUS = process.env.CORPUS ? resolve(process.env.CORPUS) : 'D:/cube/scramble/wca_scramble/wca_scrambles_no_wide_move.txt';
const META = process.env.META ? resolve(process.env.META) : 'D:/cube/scramble/wca_scramble/input/wca_scrambles_split_mbf.csv';
const COMP_TSV = process.env.COMPS ? resolve(process.env.COMPS) : 'D:/cube/scramble/wca_scramble/competitions.tsv';
const PER_BIN = 12;

// 口径同 comp_date.ts dateDisplay
function dateDisplay(start, end) {
  if (!start || start === 'NULL') return '';
  if (!end || end === 'NULL' || end === start) return start;
  const [sy, sm] = start.split('-');
  const [ey, em, ed] = end.split('-');
  if (sy === ey && sm === em) return `${start}~${ed}`;
  if (sy === ey) return `${start}~${em}-${ed}`;
  return `${start}~${end}`;
}

// 反演解法 → 最优(最短)等价打乱:复现同一状态所需的最少步数序列(前端「最优」视图用)
function invertAlg(s) {
  return s.trim().split(/\s+/).filter(Boolean).reverse()
    .map((m) => (m.endsWith('2') ? m : m.endsWith("'") ? m.slice(0, -1) : `${m}'`))
    .join(' ');
}

// ---- 1. id -> htm + 最优解 从 out.*.csv(行 = id,htm,solution)----
const lens = {};
const soln = {};
for (const f of readdirSync(__dirname).filter((f) => /^out\.\d+\.csv$/.test(f))) {
  for (const l of readFileSync(resolve(__dirname, f), 'utf8').split('\n')) {
    const p = l.split(',');           // [id, htm, solution]
    if (p.length >= 2) {
      const v = Number(p[1]);
      if (Number.isFinite(v)) { lens[p[0]] = v; if (p[2]) soln[p[0]] = p[2].trim(); }
    }
  }
}
const ids = Object.keys(lens);
const total = ids.length;
if (!total) { console.error('out.*.csv 为空,先跑 solve.mjs'); process.exit(1); }

// ---- 2. counts 直方图 ----
const counts = {};
for (const id of ids) { const L = lens[id]; counts[L] = (counts[L] || 0) + 1; }
const binNums = Object.keys(counts).map(Number).sort((a, b) => a - b);
const min = binNums[0], max = binNums[binNums.length - 1];

// ---- 3. distribution.json:variant '333'(整解作独立方法,阶段只 333)----
const dist = JSON.parse(readFileSync(DIST, 'utf8'));
const std = dist.sets.wca.variants.std;
if (std) { std.stages = std.stages.filter((s) => s !== '333'); delete std.data?.['333']; } // 清早期误注入
dist.sets.wca.variants['333'] = {
  sample_count: total,
  stages: ['333'],
  data: { '333': { ALL: { min, max, counts, counts_qtm: {}, example_bins: [] } } },
};
writeFileSync(DIST, JSON.stringify(dist));

// ---- 4. 每步数 bin 取 PER_BIN 个 id 当示例 ----
const byBin = {};                 // len(str) -> [id,...]
const wanted = new Set();
for (const id of ids) {
  const L = String(lens[id]);
  (byBin[L] ??= []);
  if (byBin[L].length < PER_BIN) { byBin[L].push(id); wanted.add(id); }
}

// id -> scramble(仅 wanted):流式扫 master(~83MB,只留命中,免全量进内存)
const scrambleOf = {};
for await (const line of createInterface({ input: createReadStream(CORPUS, 'utf8'), crlfDelay: Infinity })) {
  const k = line.indexOf(',');
  if (k <= 0) continue;
  const id = line.slice(0, k);
  if (wanted.has(id)) scrambleOf[id] = line.slice(k + 1).trim();
}

// ---- 5. 比赛元数据 join(口径同 build.ts buildExampleCompMeta)----
const compNames = new Map();      // ci -> [name, dateDisplay]
if (existsSync(COMP_TSV)) {
  let first = true;
  for await (const line of createInterface({ input: createReadStream(COMP_TSV, 'utf8'), crlfDelay: Infinity })) {
    if (first) { first = false; continue; }
    if (!line) continue;
    const [id, name, start, end] = line.split('\t');
    compNames.set(id, [name, dateDisplay(start, end)]);
  }
}
// split_mbf.csv 列: id,scramble,competition_id,event_id,round_type_id,group_id,is_extra,scramble_num
const comps = {};
const idMeta = {};                // id -> [ci, event, num, round, group, extra(0|1)]
if (existsSync(META) && wanted.size) {
  let first = true;
  for await (const line of createInterface({ input: createReadStream(META, 'utf8'), crlfDelay: Infinity })) {
    if (first) { first = false; continue; }
    if (!line) continue;
    const c = line.split(',');
    const id = c[0];
    if (!wanted.has(id)) continue;
    const ci = c[2];
    idMeta[id] = [ci, c[3], Number(c[7]), c[4], c[5], c[6] === '1' ? 1 : 0];
    if (!(ci in comps)) comps[ci] = compNames.get(ci) ?? [ci, ''];
  }
}

// ---- 6. examples.json:sets.wca.variants['333']['333'].ALL[bin] = [[id, scramble, '']] + merge set 级 comps/idMeta ----
const ex = JSON.parse(readFileSync(EX, 'utf8'));
ex.sets ??= {};
ex.sets.wca ??= { variants: {}, comps: {}, idMeta: {} };
ex.sets.wca.variants ??= {};
ex.sets.wca.comps ??= {};
ex.sets.wca.idMeta ??= {};
delete ex.sets.wca.variants.std?.['333'];
const bins = {};
for (const [L, arr] of Object.entries(byBin)) {
  const cards = arr.filter((id) => scrambleOf[id] !== undefined)
    .map((id) => [id, scrambleOf[id], '', soln[id] ? invertAlg(soln[id]) : '']);
  if (cards.length) bins[L] = cards;
}
ex.sets.wca.variants['333'] = { '333': { ALL: bins } };
Object.assign(ex.sets.wca.comps, comps);
Object.assign(ex.sets.wca.idMeta, idMeta);
writeFileSync(EX, JSON.stringify(ex));

console.log(`injected 333: ${total} samples · dist ${JSON.stringify(counts)}`);
console.log(`examples: ${Object.keys(bins).length} bins · ${wanted.size} ids · ${Object.keys(comps).length} comps`);
