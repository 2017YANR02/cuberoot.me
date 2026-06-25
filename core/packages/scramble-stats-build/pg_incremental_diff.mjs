// 通用「PG 灌库行级增量 diff」: 把本地全量 CSV 跟上次灌库的 sha1 行清单(manifest)对比,
// 只产出「内容真变 / 新增」的行(delta CSV)+「已消失」的自然键(deleted),并写出新 manifest。
// 配合 update_cross_stats.ps1 的 Load-*ToPg: 有 manifest 走增量(staging+UPSERT+DELETE), 无则全量+建基线。
// 自然键 = CSV 前 N 个逗号字段(前 N 字段恒为简单标识符, 无逗号/引号), 行 hash = sha1(整行原文)。
//
// 用法:
//   node pg_incremental_diff.mjs --csv <full.csv> --manifest <m.tsv> --key-cols 6 [--header]
//        --out-delta <delta.csv> --out-deleted <deleted.txt> --out-manifest <new.tsv>
// manifest 行格式: <natkey>\t<sha1>。退出码 0; 摘要打到 stderr; stdout 末行打 JSON 统计供调用方解析。
import fs from 'node:fs';
import readline from 'node:readline';
import crypto from 'node:crypto';

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const csvPath = arg('csv');
const manifestPath = arg('manifest');
const keyCols = parseInt(arg('key-cols', '6'), 10);
const hasHeader = arg('header', false) === true;
const outDelta = arg('out-delta');
const outDeleted = arg('out-deleted');
const outManifest = arg('out-manifest');
if (!csvPath || !manifestPath || !outDelta || !outDeleted || !outManifest) {
  console.error('missing required args (--csv --manifest --out-delta --out-deleted --out-manifest)');
  process.exit(2);
}

function natkey(line) {
  // 取前 keyCols 个逗号分隔字段, 用逗号 rejoin。只扫到第 keyCols 个逗号即可。
  let idx = 0;
  for (let n = 0; n < keyCols; n++) {
    const c = line.indexOf(',', idx);
    if (c === -1) return line; // 字段不足: 整行当键(异常行, 不会撞)
    idx = c + 1;
  }
  return line.slice(0, idx - 1);
}
const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');

// 读旧 manifest -> Map(key->hash)
const prev = new Map();
if (fs.existsSync(manifestPath)) {
  const rl = readline.createInterface({ input: fs.createReadStream(manifestPath, 'utf-8'), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    const t = line.lastIndexOf('\t');
    if (t === -1) continue;
    prev.set(line.slice(0, t), line.slice(t + 1));
  }
}

const deltaWs = fs.createWriteStream(outDelta, { encoding: 'utf-8' });
const manWs = fs.createWriteStream(outManifest, { encoding: 'utf-8' });
const seen = new Set();
let total = 0, changed = 0, added = 0, unchanged = 0, dupSkipped = 0, headerLine = null;

const rl = readline.createInterface({ input: fs.createReadStream(csvPath, 'utf-8'), crlfDelay: Infinity });
let first = true;
const deltaBuf = [];
const manBuf = [];
const flush = () => {
  if (deltaBuf.length) { deltaWs.write(deltaBuf.join('\n') + '\n'); deltaBuf.length = 0; }
  if (manBuf.length) { manWs.write(manBuf.join('\n') + '\n'); manBuf.length = 0; }
};
for await (const line of rl) {
  if (!line) continue;
  if (first && hasHeader) { first = false; headerLine = line; deltaBuf.push(line); continue; }
  first = false;
  const k = natkey(line);
  // 同自然键只取首次出现: 个别表(steps)WCA dump 偶有同自然键两套 scramble。manifest 按自然键存 hash,
  // 不去重则重复键每次 re-diff 都被误判 changed(白传 + 增量≠全量)。与服务端 DISTINCT ON 同口径保证唯一。
  if (seen.has(k)) { dupSkipped++; continue; }
  seen.add(k);
  const h = sha1(line);
  manBuf.push(`${k}\t${h}`);
  total++;
  const old = prev.get(k);
  if (old === undefined) { added++; deltaBuf.push(line); }
  else if (old !== h) { changed++; deltaBuf.push(line); }
  else unchanged++;
  if (deltaBuf.length >= 4000 || manBuf.length >= 4000) flush();
}
flush();
await new Promise((r) => deltaWs.end(r));
await new Promise((r) => manWs.end(r));

// deleted = 旧 manifest 有、当前 CSV 没有的键
const deletedKeys = [];
for (const k of prev.keys()) if (!seen.has(k)) deletedKeys.push(k);
fs.writeFileSync(outDeleted, deletedKeys.length ? deletedKeys.join('\n') + '\n' : '');

const stat = { total, changed, added, unchanged, deleted: deletedKeys.length, dupSkipped, deltaRows: changed + added, hadHeader: !!headerLine };
console.error(`[pg-diff] ${csvPath}`);
console.error(`  total=${total} added=${added} changed=${changed} unchanged=${unchanged} deleted=${deletedKeys.length} dupSkipped=${dupSkipped} -> delta=${stat.deltaRows} rows`);
console.log(JSON.stringify(stat));
