// 难度 tab「下载全部」用:把整份 130 万 3x3 语料 + 比赛信息 + 各底色十字步数,按阶段打成
// gzip CSV(一份/阶段),用户下一次就有该阶段全部打乱和全部步数信息,自己按步数筛。
//
// 与逐 bin 采样下载(build.ts 的 downloads/,K=200、≤1000 bin)互补:这里是「全量、不采样」。
// 输入(均本地、gitignored):
//   <csv_dir>/std.csv                      id + <stage>_<axis> 十字步数(5 阶段 × 6 底面)
//   wca_scrambles_no_wide_move.txt         id → 打乱
//   input/wca_scrambles_split_mbf.csv      id → competition/event/round/group/num/extra
//   competitions.tsv                       comp id → 名称
// 输出 stats/scramble/bundles/wca/std/all_<stage>.csv.gz + bundles/manifest.json。
// 列:id,scramble,competition,event,round,group,num,extra,W,Y,B,G,O,R(后 6 列=该底色十字步数)。
//
// 用法: node build_scramble_bundle.mjs
import {
  readFileSync, writeFileSync, existsSync, mkdirSync, createReadStream, createWriteStream, statSync,
} from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { createGzip } from 'node:zlib';
import YAML from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');

// 路径(默认本机布局;config.yml 的 wca.csv_dir 覆盖 std.csv 目录)。
let csvDir = 'D:/cube/scramble/wca_scramble/stats';
const cfgPath = resolve(__dirname, 'config.yml');
if (existsSync(cfgPath)) {
  const cfg = YAML.parse(readFileSync(cfgPath, 'utf8'));
  const wca = (cfg?.sets ?? []).find?.((s) => s.key === 'wca') ?? cfg?.wca;
  if (wca?.csv_dir) csvDir = wca.csv_dir;
}
const STD_CSV = resolve(process.env.STD_CSV ? process.env.STD_CSV : join(csvDir, 'std.csv'));
const scrambleRoot = dirname(csvDir); // …/wca_scramble
const CORPUS = process.env.CORPUS ? resolve(process.env.CORPUS) : join(scrambleRoot, 'wca_scrambles_no_wide_move.txt');
const META = process.env.META ? resolve(process.env.META) : join(scrambleRoot, 'input/wca_scrambles_split_mbf.csv');
const COMP_TSV = process.env.COMPS ? resolve(process.env.COMPS) : join(scrambleRoot, 'competitions.tsv');
const OUT_DIR = resolve(repoRoot, 'stats/scramble/bundles/wca/std');

const STAGES = ['cross', 'xcross', 'xxcross', 'xxxcross', 'xxxxcross'];
// std.csv 角度后缀 → 底色字母(与 build.ts AXIS_TO_COLOR 一致)。
const AXIS_COLOR = { z0: 'Y', z1: 'R', z2: 'W', z3: 'O', x1: 'B', x3: 'G' };
const AXES = ['z0', 'z1', 'z2', 'z3', 'x1', 'x3'];
const COLOR_ORDER = ['W', 'Y', 'B', 'G', 'O', 'R']; // 输出列顺序

const csvCell = (s) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

async function main() {
  for (const f of [STD_CSV, CORPUS, META]) {
    if (!existsSync(f)) { console.error(`缺 ${f}`); process.exit(1); }
  }

  // 1. comp id → 名称。
  const compNames = new Map();
  if (existsSync(COMP_TSV)) {
    let first = true;
    for await (const line of createInterface({ input: createReadStream(COMP_TSV, 'utf8'), crlfDelay: Infinity })) {
      if (first) { first = false; continue; }
      if (!line) continue;
      const i = line.indexOf('\t');
      if (i < 0) continue;
      const id = line.slice(0, i);
      const rest = line.slice(i + 1);
      compNames.set(id, rest.split('\t')[0] ?? id);
    }
  }

  // 2. id → 打乱(全量进内存,~100MB)。
  console.log('loading corpus…');
  const scrambleOf = new Map();
  for await (const line of createInterface({ input: createReadStream(CORPUS, 'utf8'), crlfDelay: Infinity })) {
    const k = line.indexOf(',');
    if (k <= 0) continue;
    scrambleOf.set(line.slice(0, k), line.slice(k + 1).trim());
  }
  console.log(`corpus: ${scrambleOf.size.toLocaleString()} scrambles`);

  // 3. id → 比赛元数据。split_mbf 列: id,scramble,competition_id,event_id,round_type_id,group_id,is_extra,scramble_num
  console.log('loading meta…');
  const metaOf = new Map();
  {
    let first = true;
    for await (const line of createInterface({ input: createReadStream(META, 'utf8'), crlfDelay: Infinity })) {
      if (first) { first = false; continue; }
      if (!line) continue;
      const c = line.split(',');
      metaOf.set(c[0], { ci: c[2], ev: c[3], rt: c[4], grp: c[5], ex: c[6], num: c[7] });
    }
  }
  console.log(`meta: ${metaOf.size.toLocaleString()} rows`);

  // 4. 打开各阶段 gz 流,写表头。
  mkdirSync(OUT_DIR, { recursive: true });
  const header = `id,scramble,competition,event,round,group,num,extra,${COLOR_ORDER.join(',')}\n`;
  const gz = {}; const done = {};
  for (const st of STAGES) {
    const g = createGzip();
    const ws = createWriteStream(join(OUT_DIR, `all_${st}.csv.gz`));
    g.pipe(ws);
    g.write(header);
    gz[st] = g;
    done[st] = new Promise((r) => ws.on('finish', r));
  }

  // 5. 流式 std.csv,逐行写各阶段。
  console.log('streaming std.csv…');
  let colIdx = null; // { id, [stage_axis]: idx }
  let n = 0, missScr = 0;
  for await (const line of createInterface({ input: createReadStream(STD_CSV, 'utf8'), crlfDelay: Infinity })) {
    if (!line) continue;
    if (!colIdx) {
      const h = line.split(',');
      colIdx = {};
      h.forEach((name, i) => { colIdx[name] = i; });
      continue;
    }
    const c = line.split(',');
    const id = c[colIdx.id];
    const scr = scrambleOf.get(id);
    if (scr === undefined) { missScr++; continue; }
    const m = metaOf.get(id) ?? { ci: '', ev: '', rt: '', grp: '', ex: '', num: '' };
    const comp = csvCell(compNames.get(m.ci) ?? m.ci);
    const prefix = `${id},${scr},${comp},${m.ev},${m.rt},${m.grp},${m.num},${m.ex},`;
    for (const st of STAGES) {
      const lens = COLOR_ORDER.map((color) => {
        const axis = AXES.find((a) => AXIS_COLOR[a] === color);
        return c[colIdx[`${st}_${axis}`]];
      });
      gz[st].write(`${prefix}${lens.join(',')}\n`);
    }
    if (++n % 200000 === 0) console.log(`  ${n.toLocaleString()} rows`);
  }

  for (const st of STAGES) gz[st].end();
  await Promise.all(Object.values(done));

  // 6. manifest(前端据此决定显示「下载全部」)。
  const sizes = {};
  for (const st of STAGES) sizes[st] = Math.round(statSync(join(OUT_DIR, `all_${st}.csv.gz`)).size / 1024);
  writeFileSync(resolve(repoRoot, 'stats/scramble/bundles/manifest.json'),
    JSON.stringify({ generated_at: process.env.SCRAMBLE_STATS_STAMP || '', rows: n, sets: { wca: { std: STAGES } }, sizes_kb: { wca: { std: sizes } } }));

  console.log(`done: ${n.toLocaleString()} rows/stage, ${missScr} missing scramble`);
  for (const st of STAGES) console.log(`  all_${st}.csv.gz  ${(sizes[st] / 1024).toFixed(1)} MB`);
}

main().catch((e) => { console.error(e); process.exit(1); });
