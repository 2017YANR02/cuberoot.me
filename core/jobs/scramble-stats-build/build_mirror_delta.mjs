// 镜像 wca_scrambles + wca_competitions 的「PG 增量灌库」delta 生成器(无状态 / 自愈)。
//
// 真相源 = prod 现有 (competition_id -> 行数)。不维护本地 manifest:每次拿 prod 现状跟 export 比,
// comp 级 diff —— export 里「prod 没有 / 行数对不上」的整场标记为待灌。新赛(prod 无)、补录(行数变)
// 都覆盖;首跑即正确(prod 已有的全部跳过);prod 若被外部改乱,下次自动纠正。
//
// 为何 comp 级而非行级:wca_scrambles 无 6 列自然键 UNIQUE(且 WCA dump 同场偶有两套 scramble = 重复自然键),
// 不能 ON CONFLICT upsert;按场 DELETE+INSERT 既匹配 WCA「整场补录」的修订粒度,又保留场内重复行。
//
// 用法:
//   node build_mirror_delta.mjs --scrambles tsv/Scrambles.tsv --prod-counts prod_comp_counts.tsv \
//        --out-delta mirror_delta.csv --out-comps mirror_comps.txt \
//        [--competitions tsv/Competitions.tsv --out-comps-csv wca_competitions_upsert.csv]
//
// 输出:
//   out-delta     镜像列序 CSV(带 header):competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,scramble
//   out-comps     待灌(先 DELETE 再 INSERT)的 competition_id,每行一个
//   out-comps-csv (可选)wca_competitions upsert CSV(带 header):id,name,country_id,start_date,end_date(全量过去赛)
// stdout 末行打 JSON 统计供调用方解析。
import fs from 'node:fs';
import readline from 'node:readline';

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const scramblesPath = arg('scrambles');
const prodCountsPath = arg('prod-counts');
const outDelta = arg('out-delta');
const outComps = arg('out-comps');
const compsPath = arg('competitions', null);
const outCompsCsv = arg('out-comps-csv', null);
if (!scramblesPath || !prodCountsPath || !outDelta || !outComps) {
  console.error('missing required args (--scrambles --prod-counts --out-delta --out-comps)');
  process.exit(2);
}

// incremental.py 同款列名归一化(抗 camelCase/snake_case 漂移)。
const norm = (s) => s.trim().toLowerCase().replace(/[_\s]/g, '');
function colmap(header, aliases) {
  const idx = new Map();
  header.forEach((h, i) => idx.set(norm(h), i));
  const out = {};
  for (const [target, alts] of Object.entries(aliases)) {
    for (const a of alts) {
      const k = norm(a);
      if (idx.has(k)) { out[target] = idx.get(k); break; }
    }
  }
  return out;
}
const SCR_ALIASES = {
  id: ['id', 'scramble_id'], scramble: ['scramble'],
  competition_id: ['competition_id'], event_id: ['event_id'],
  round_type_id: ['round_type_id'], group_id: ['group_id'],
  is_extra: ['is_extra'], scramble_num: ['scramble_num'],
};
const COMP_ALIASES = {
  id: ['id', 'competition_id'], name: ['name', 'cell_name', 'short_name'],
  country_id: ['country_id', 'countryid'],
  start_date: ['start_date'], end_date: ['end_date'],
  year: ['year'], month: ['month'], day: ['day'],
  end_year: ['end_year'], end_month: ['end_month'], end_day: ['end_day'],
};

const csvCell = (s) => /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
const ymd = (y, m, d) => {
  if (!y || y === '0' || y === 'NULL' || !m || m === '0' || m === 'NULL' || !d || d === '0' || d === 'NULL') return '';
  const yi = parseInt(y, 10), mi = parseInt(m, 10), di = parseInt(d, 10);
  if (!Number.isFinite(yi) || !Number.isFinite(mi) || !Number.isFinite(di)) return '';
  return `${String(yi).padStart(4, '0')}-${String(mi).padStart(2, '0')}-${String(di).padStart(2, '0')}`;
};

// ── 1. prod 现状: competition_id -> 行数 ──
const prodCounts = new Map();
if (fs.existsSync(prodCountsPath)) {
  const rl = readline.createInterface({ input: fs.createReadStream(prodCountsPath, 'utf-8'), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    // 分隔符容错:psql -A 默认 '|',或制表符。comp_id 不含二者,取最后一个分隔符切。
    const t = Math.max(line.lastIndexOf('\t'), line.lastIndexOf('|'));
    if (t === -1) continue;
    prodCounts.set(line.slice(0, t).trim(), parseInt(line.slice(t + 1).trim(), 10) || 0);
  }
}

// ── 2. Pass 1: export 每场行数 ──
async function* tsvRows(path) {
  const rl = readline.createInterface({ input: fs.createReadStream(path, 'utf-8'), crlfDelay: Infinity });
  let cm = null;
  for await (const line of rl) {
    if (line === '' || line == null) continue;
    const parts = line.split('\t');
    if (cm === null) { cm = colmap(parts, SCR_ALIASES); yield { header: cm }; continue; }
    yield { parts };
  }
}
let scm = null;
const exportCounts = new Map();
for await (const r of tsvRows(scramblesPath)) {
  if (r.header) { scm = r.header; continue; }
  const comp = scm.competition_id != null ? (r.parts[scm.competition_id] ?? '') : '';
  if (!comp) continue;
  exportCounts.set(comp, (exportCounts.get(comp) || 0) + 1);
}
if (!scm || scm.competition_id == null || scm.scramble == null || scm.event_id == null) {
  console.error(`Scrambles.tsv 缺关键列 (competition_id/scramble/event_id); colmap=${JSON.stringify(scm)}`);
  process.exit(2);
}

// ── 3. 待灌场 = 行数对不上(含 prod 缺) ──
const toLoad = new Set();
for (const [comp, n] of exportCounts) {
  if ((prodCounts.get(comp) || 0) !== n) toLoad.add(comp);
}

// ── 4. Pass 2: 写待灌场的镜像列序行 ──
fs.writeFileSync(outComps, toLoad.size ? [...toLoad].join('\n') + '\n' : '');
const deltaWs = fs.createWriteStream(outDelta, { encoding: 'utf-8' });
deltaWs.write('competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,scramble\n');
let deltaRows = 0;
if (toLoad.size > 0) {
  const buf = [];
  for await (const r of tsvRows(scramblesPath)) {
    if (r.header) continue;
    const p = r.parts;
    const comp = p[scm.competition_id] ?? '';
    if (!toLoad.has(comp)) continue;
    const g = (k) => (scm[k] != null && scm[k] < p.length ? p[scm[k]] : '') ?? '';
    const isExtra = (() => { const v = g('is_extra').trim().toLowerCase(); return v === '1' || v === 'true' ? '1' : '0'; })();
    const row = [comp, g('event_id'), g('round_type_id'), g('group_id'), isExtra, g('scramble_num'), g('scramble')]
      .map(csvCell).join(',');
    buf.push(row);
    deltaRows++;
    if (buf.length >= 4000) { deltaWs.write(buf.join('\n') + '\n'); buf.length = 0; }
  }
  if (buf.length) deltaWs.write(buf.join('\n') + '\n');
}
await new Promise((res) => deltaWs.end(res));

// ── 5. (可选)competitions upsert CSV(全量过去赛;幂等)──
let compsRows = 0;
if (compsPath && outCompsCsv) {
  const rl = readline.createInterface({ input: fs.createReadStream(compsPath, 'utf-8'), crlfDelay: Infinity });
  let cm = null;
  const ws = fs.createWriteStream(outCompsCsv, { encoding: 'utf-8' });
  ws.write('id,name,country_id,start_date,end_date\n');
  const buf = [];
  for await (const line of rl) {
    if (line === '' || line == null) continue;
    const parts = line.split('\t');
    if (cm === null) { cm = colmap(parts, COMP_ALIASES); continue; }
    const g = (k) => (cm[k] != null && cm[k] < parts.length ? parts[cm[k]] : '') ?? '';
    const id = g('id');
    if (!id) continue;
    const name = g('name') || id;
    const country = g('country_id'); // NOT NULL 列;export 总有,缺则空串(库里现有更全的会被 upsert 覆盖,故仅在新增赛生效)
    const start = g('start_date') || ymd(g('year'), g('month'), g('day'));
    const end = g('end_date') || ymd(g('end_year'), g('end_month'), g('end_day'));
    buf.push([id, name, country, start, end].map(csvCell).join(','));
    compsRows++;
    if (buf.length >= 4000) { ws.write(buf.join('\n') + '\n'); buf.length = 0; }
  }
  if (buf.length) ws.write(buf.join('\n') + '\n');
  await new Promise((res) => ws.end(res));
}

const stat = {
  exportComps: exportCounts.size, prodComps: prodCounts.size,
  toLoadComps: toLoad.size, deltaRows, compsRows,
};
console.error(`[mirror-delta] export comps=${stat.exportComps} prod comps=${stat.prodComps} -> toLoad comps=${stat.toLoadComps} (${deltaRows} rows)` + (compsPath ? ` + ${compsRows} competitions` : ''));
console.log(JSON.stringify(stat));
