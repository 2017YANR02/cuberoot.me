// 为 /timer「WCA 真题:原始/最优打乱」开关导出 222 / pyramid / skewb 的最优等态打乱。
// 与 solver/333opt/export_optimal.mjs(3x3 版)对等,灌入同一张 wca_scramble_optimal 表(自然键 PK)。
//
// 输入:
//   <puzzle_data_dir>/<key>/<key>.csv  (id,<key>,soln) —— analyzer 开 PUZZLE_EMIT_SOLN 产的解列
//   Scrambles.tsv                      (id → 自然键 competition/round/group/extra/num + event)
// 输出 wca_optimal_puzzle.csv:competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,htm,optimal_scramble
//   optimal_scramble = invert(soln) —— 到达与原 WCA 打乱同一态的最短序列(已经 SVG 逐条验证同态)。
//
// 同态性:222/pyram/skewb 的 WCA 打乱即 solver 求解的态(无宽块定向后缀),故最优打乱可作真题等价替身。
// 用法: node export_puzzle_optimal.mjs   → 产 wca_optimal_puzzle.csv;再 \copy 灌 wca_scramble_optimal。
import { readFileSync, existsSync, createReadStream, createWriteStream } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import YAML from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEST = resolve(__dirname, 'wca_optimal_puzzle.csv');
const SCRAMBLES_TSV = process.env.SCRAMBLES_TSV
  ? resolve(process.env.SCRAMBLES_TSV)
  : 'D:/cube/scramble/wca_scramble/incremental/tsv/Scrambles.tsv';

// key → WCA event_id(与 update_puzzle_stats.ps1 / build_puzzle_examples 注册表一致)。
const PUZZLES = { pocket: '222', pyraminx: 'pyram', skewb: 'skewb' };

let dataRoot = 'D:/cube/scramble/puzzle';
const cfgPath = resolve(__dirname, 'config.yml');
if (existsSync(cfgPath)) {
  const cfg = YAML.parse(readFileSync(cfgPath, 'utf8'));
  if (cfg?.puzzle_data_dir) dataRoot = cfg.puzzle_data_dir;
}

// 逆一条解 → 最优等价打乱:X2 自逆;X' ↔ X;pyraminx 小写 tip 同理。
const invertAlg = (s) => s.trim().split(/\s+/).filter(Boolean).reverse()
  .map((m) => (m.endsWith('2') ? m : m.endsWith("'") ? m.slice(0, -1) : `${m}'`)).join(' ');

// ---- 1. 各 puzzle 的 <key>.csv → id → { htm, opt } ----
const byId = new Map();
let totalSolved = 0;
for (const key of Object.keys(PUZZLES)) {
  const csv = join(dataRoot, key, `${key}.csv`);
  if (!existsSync(csv)) { console.warn(`[skip] ${key}: 缺 ${csv}`); continue; }
  let header = true, solnIdx = -1, n = 0;
  for (const line of readFileSync(csv, 'utf8').split('\n')) {
    if (!line) continue;
    if (header) { header = false; solnIdx = line.split(',').indexOf('soln'); continue; }
    if (solnIdx === -1) break; // 无 soln 列 → 该 puzzle 未开 PUZZLE_EMIT_SOLN 重解
    const c = line.split(',');
    const htm = c[1]; const soln = c[solnIdx];
    if (!soln || soln === '-') continue;
    byId.set(c[0], { htm, opt: invertAlg(soln) });
    n++;
  }
  console.log(`[${key}] ${n} solved ids`);
  totalSolved += n;
}
if (!totalSolved) { console.error('无解列数据。先开 PUZZLE_EMIT_SOLN 重跑 update_puzzle_stats.ps1。'); process.exit(1); }

// ---- 2. 流式 Scrambles.tsv,join 自然键,产表行 ----
if (!existsSync(SCRAMBLES_TSV)) { console.error(`缺 ${SCRAMBLES_TSV}`); process.exit(1); }
const EVENTS = new Set(Object.values(PUZZLES));
const ws = createWriteStream(DEST, 'utf8');
ws.write('competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,htm,optimal_scramble\n');
let emitted = 0; const byEvent = {};
let H = null;
const rl = createInterface({ input: createReadStream(SCRAMBLES_TSV, 'utf8'), crlfDelay: Infinity });
for await (const line of rl) {
  if (!line) continue;
  const c = line.split('\t');
  if (!H) { H = {}; c.forEach((name, i) => { H[name] = i; }); continue; }
  const ev = c[H.event_id];
  if (!EVENTS.has(ev)) continue;
  const rec = byId.get(c[H.id]);
  if (!rec) continue;
  ws.write(`${c[H.competition_id]},${ev},${c[H.round_type_id]},${c[H.group_id]},${c[H.is_extra]},${c[H.scramble_num]},${rec.htm},${rec.opt}\n`);
  emitted++;
  byEvent[ev] = (byEvent[ev] || 0) + 1;
}
ws.end();
await new Promise((r) => ws.on('finish', r));
console.log(`wrote ${DEST}: ${emitted} rows ${JSON.stringify(byEvent)}`);
