// 333 整解最优「首次出现」时间线注入。inject.mjs 的姊妹步:把 out.*.csv(id,htm)按比赛日期
// 折成每 htm 步数的**最早**一条打乱,注入 stats/scramble/difficulty_first_appearance.json 的
// sets.wca.variants['333'](阶段只 '333',伪子集 'ALL'),与 build_first_appearance.ts 产的
// std/eo/... 变体并列。前端难度 tab「333」方法时间线读它。
//
// 语义:基于**当前已解子集**(out.*.csv)。未解打乱不参与,故是"已解集内首次出现",随
// solve_loop 推进逐步逼近真值。全量解完即真值。只写 FA 文件,不碰 distribution/examples。
//
// 排序键 = (比赛开始日期升序, 打乱 id 升序)。无日期比赛排最后。
// idMeta/comps 口径同 inject.mjs(split_mbf 列 id,scramble,competition_id,event_id,
// round_type_id,group_id,is_extra,scramble_num)。
import { readFileSync, writeFileSync, readdirSync, existsSync, createReadStream } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const FA = process.env.FA ? resolve(process.env.FA) : resolve(repoRoot, 'stats/scramble/difficulty_first_appearance.json');
const CORPUS = process.env.CORPUS ? resolve(process.env.CORPUS) : 'D:/cube/scramble/wca_scramble/wca_scrambles_no_wide_move.txt';
const META = process.env.META ? resolve(process.env.META) : 'D:/cube/scramble/wca_scramble/input/wca_scrambles_split_mbf.csv';
const COMP_TSV = process.env.COMPS ? resolve(process.env.COMPS) : 'D:/cube/scramble/wca_scramble/competitions.tsv';

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

if (!existsSync(FA)) { console.error(`首次出现文件不存在(先跑 stages build): ${FA}`); process.exit(1); }

// ---- 1. id -> htm 从 out.*.csv ----
const lens = {};
for (const f of readdirSync(__dirname).filter((f) => /^out\.\d+\.csv$/.test(f))) {
  for (const l of readFileSync(resolve(__dirname, f), 'utf8').split('\n')) {
    const p = l.split(',');
    if (p.length >= 2) { const v = Number(p[1]); if (Number.isFinite(v)) lens[p[0]] = v; }
  }
}
const solvedN = Object.keys(lens).length;
if (!solvedN) { console.error('out.*.csv 为空,先跑 solve_loop.mjs'); process.exit(1); }

// ---- 2. competitions.tsv -> compId -> { startInt, display, name } ----
const compInfo = new Map();
if (existsSync(COMP_TSV)) {
  let first = true;
  for await (const line of createInterface({ input: createReadStream(COMP_TSV, 'utf8'), crlfDelay: Infinity })) {
    if (first) { first = false; continue; }
    if (!line) continue;
    const [id, name, start, end] = line.split('\t');
    const n = start && start !== 'NULL' ? Number(start.replaceAll('-', '')) : NaN;
    compInfo.set(id, { startInt: Number.isFinite(n) ? n : Infinity, display: dateDisplay(start, end), name });
  }
}

// ---- 3. 扫 split_mbf: 所有已解 id, 每 htm bin 取 (dateInt, idNum) 最早, 内联 winner meta ----
const best = new Map(); // htm -> { idNum, id, dateInt, meta:[ci,event,num,round,group,extra] }
{
  let first = true;
  for await (const line of createInterface({ input: createReadStream(META, 'utf8'), crlfDelay: Infinity })) {
    if (first) { first = false; continue; }
    if (!line) continue;
    const c = line.split(',');
    const id = c[0];
    const L = lens[id];
    if (L === undefined) continue; // 仅已解
    const ci = c[2];
    const dateInt = compInfo.get(ci)?.startInt ?? Infinity;
    const idNum = Number(id);
    const cur = best.get(L);
    if (!cur || dateInt < cur.dateInt || (dateInt === cur.dateInt && idNum < cur.idNum)) {
      best.set(L, { idNum, id, dateInt, meta: [ci, c[3], Number(c[7]), c[4], c[5], c[6] === '1' ? 1 : 0] });
    }
  }
}

// ---- 4. winner 打乱文字: 扫 CORPUS(只留命中) ----
const want = new Set([...best.values()].map((b) => b.id));
const scr = {};
for await (const line of createInterface({ input: createReadStream(CORPUS, 'utf8'), crlfDelay: Infinity })) {
  const k = line.indexOf(',');
  if (k <= 0) continue;
  const id = line.slice(0, k);
  if (want.has(id)) scr[id] = line.slice(k + 1).trim();
}

// ---- 5. 注入 FA: sets.wca.variants['333'].data['333'].ALL + 顶层 comps/idMeta ----
const fa = JSON.parse(readFileSync(FA, 'utf8'));
fa.sets ??= {};
fa.sets.wca ??= { label: 'WCA', label_zh: null, event: null, variants: {} };
fa.sets.wca.variants ??= {};
fa.comps ??= {};
fa.idMeta ??= {};
const ALL = {};
for (const L of [...best.keys()].sort((a, b) => a - b)) {
  const b = best.get(L);
  const s = scr[b.id];
  if (s === undefined) continue;
  ALL[String(L)] = [b.id, s, '']; // [id, scramble, color('')] 同 build_first_appearance Sample
  fa.idMeta[b.id] = b.meta;
  const ci = b.meta[0];
  if (!(ci in fa.comps)) { const info = compInfo.get(ci); fa.comps[ci] = info ? [info.name, info.display] : [ci, '']; }
}
fa.sets.wca.variants['333'] = { stages: ['333'], data: { '333': { ALL } } };
writeFileSync(FA, JSON.stringify(fa));
console.log(`first-appearance 333: ${Object.keys(ALL).length} bins (已解 ${solvedN})`);
