// 产 wca_scramble_steps 灌库数据:每条 3x3 真打乱一行,steps[] 数组 = 各 (方法,阶段,底色) 最优步数。
// 槽位偏移随 VARIANTS 单源确定(append-only,std 永远在前),与 build.ts/distribution 同一份变体定义。
//
// 输入(均本地、gitignored,路径同 build.ts):
//   <csv_dir>/<variant>.csv               id + <stage>_<angle> 各底色步数(每变体一份;缺则跳过)
//   <root>/wca_scrambles_no_wide_move.txt  id 全集(3x3-family 语料)
//   <root>/input/wca_scrambles_split_mbf.csv  id → competition/event/round/group/extra/num 自然键
// 输出:
//   stats/scramble/steps/wca_scramble_steps.csv  (\copy 进 staging:natkey,gm_cross6,gm_xcross6,steps)
//   stats/scramble/steps/steps_layout.json       (server 端点据此把 (方法,阶段,底色) → 数组槽位)
//
// 用法: pnpm --filter @cuberoot/scramble-stats-build build:scramble-steps
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { VARIANTS, COLOR_LETTERS, type ColorLetter, type VariantSpec } from './variants';

const MISSING = -1; // Int16 sentinel:该 (id, 槽) 无数据 → 数组元素 NULL
// 333mbf(多盲)排除:split_mbf 把一次多盲拆成多个 cube 子打乱,同一自然键
// (comp,event,round,group,num) 对应多条 → 破坏 wca_scramble_steps 的自然键主键。
// 同 wca_scramble_optimal(0047)排除盲拧/多盲的口径。其余 333/oh/bf/fm/ft 单打乱、键唯一。
const EXCLUDE_EVENTS = new Set(['333mbf']);

interface SetSpec { key: string; csv_dir: string; scrambles_txt: string }
function resolveWcaSet(): SetSpec {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const pkgRoot = path.resolve(here, '..');
  const config = YAML.parse(fs.readFileSync(path.join(pkgRoot, 'config.yml'), 'utf-8'));
  const wca = (config.sets ?? []).find((s: { key: string }) => s.key === 'wca') ?? config.sets?.[0];
  if (!wca?.csv_dir) throw new Error('config.yml: no wca set with csv_dir');
  return {
    key: 'wca',
    csv_dir: wca.csv_dir,
    scrambles_txt: wca.scrambles_txt ?? path.join(path.dirname(wca.csv_dir), 'wca_scrambles_no_wide_move.txt'),
  };
}

// 规范槽位布局:遍历 present 变体(CSV 存在)× spec.stages × COLOR_LETTERS(B,G,O,R,W,Y)。
// 1-based offset。返回 { offsets, layout, presentVariants }。
function buildLayout(csvDir: string) {
  const present: VariantSpec[] = VARIANTS.filter((v) => fs.existsSync(path.join(csvDir, v.file)));
  const offsets = new Map<string, number>(); // `${variant}|${stage}|${color}` → 1-based offset
  const layout: Record<string, Record<string, Record<string, number>>> = {};
  let n = 0;
  for (const v of present) {
    layout[v.key] = {};
    for (const stage of v.stages) {
      layout[v.key][stage] = {};
      for (const color of COLOR_LETTERS) {
        n += 1;
        offsets.set(`${v.key}|${stage}|${color}`, n);
        layout[v.key][stage][color] = n;
      }
    }
  }
  return { present, offsets, layout, length: n };
}

async function loadCorpusIds(txtPath: string): Promise<Map<string, number>> {
  const idx = new Map<string, number>();
  const rl = readline.createInterface({ input: fs.createReadStream(txtPath, 'utf-8'), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    const i = line.indexOf(',');
    if (i <= 0) continue;
    const id = line.slice(0, i);
    if (!idx.has(id)) idx.set(id, idx.size);
  }
  return idx;
}

// split_mbf: id,scramble,competition_id,event_id,round_type_id,group_id,is_extra,scramble_num
async function loadNaturalKeys(metaCsv: string, ids: Map<string, number>): Promise<(string[] | undefined)[]> {
  const keys: (string[] | undefined)[] = new Array(ids.size);
  const rl = readline.createInterface({ input: fs.createReadStream(metaCsv, 'utf-8'), crlfDelay: Infinity });
  let first = true;
  for await (const line of rl) {
    if (!line) continue;
    if (first) { first = false; continue; }
    const i0 = line.indexOf(',');
    if (i0 === -1) continue;
    const id = line.slice(0, i0);
    const row = ids.get(id);
    if (row === undefined) continue;
    const c = line.split(',');
    // [competition_id, event_id, round_type_id, group_id, is_extra, scramble_num]
    keys[row] = [c[2], c[3], c[4], c[5], c[6] || '0', c[7]];
  }
  return keys;
}

const csvCell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

async function main() {
  const set = resolveWcaSet();
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, '..', '..', '..', '..');
  const dataRoot = path.dirname(set.csv_dir);
  const metaCsv = path.join(dataRoot, 'input', 'wca_scrambles_split_mbf.csv');
  for (const [label, p] of [['scrambles_txt', set.scrambles_txt], ['split_mbf', metaCsv]] as const) {
    if (!fs.existsSync(p)) throw new Error(`missing ${label}: ${p}`);
  }

  const { present, offsets, layout, length } = buildLayout(set.csv_dir);
  console.log(`present variants (${present.length}): ${present.map((v) => v.key).join(', ')}`);
  console.log(`steps[] length = ${length} slots`);

  console.log('loading corpus ids...');
  const ids = await loadCorpusIds(set.scrambles_txt);
  const numRows = ids.size;
  console.log(`  ${numRows.toLocaleString()} ids`);

  console.log('loading natural keys...');
  const natKeys = await loadNaturalKeys(metaCsv, ids);

  // 大列存:Int16Array(numRows * length),sentinel -1 = 缺。~numRows*length*2 字节。
  console.log(`allocating steps store (~${((numRows * length * 2) / 1e9).toFixed(2)} GB)...`);
  const store = new Int16Array(numRows * length).fill(MISSING);

  // 逐变体填值
  for (const v of present) {
    const csvPath = path.join(set.csv_dir, v.file);
    const colorToAngle: Record<ColorLetter, string> = {} as Record<ColorLetter, string>;
    for (const [angle, color] of Object.entries(v.angleToColor)) colorToAngle[color] = angle;
    const rl = readline.createInterface({ input: fs.createReadStream(csvPath, 'utf-8'), crlfDelay: Infinity });
    let header: Record<string, number> | null = null;
    // 预解析该变体每 (stage,color) → (csv 列 idx, 数组 slot idx)
    const fills: { col: number; slot: number }[] = [];
    let rows = 0;
    for await (const line of rl) {
      if (!line) continue;
      if (!header) {
        header = {};
        line.split(',').forEach((name, i) => { header![name] = i; });
        for (const stage of v.stages) {
          for (const color of COLOR_LETTERS) {
            const angle = colorToAngle[color];
            const colName = v.colFor(stage, angle);
            const col = header[colName];
            if (col === undefined) throw new Error(`[${v.key}] missing column ${colName}`);
            fills.push({ col, slot: offsets.get(`${v.key}|${stage}|${color}`)! - 1 });
          }
        }
        continue;
      }
      const parts = line.split(',');
      const row = ids.get(parts[0]);
      if (row === undefined) continue;
      const base = row * length;
      for (const { col, slot } of fills) {
        const val = Number(parts[col]);
        if (Number.isFinite(val) && val >= 0 && val < 32767) store[base + slot] = val;
      }
      rows++;
    }
    console.log(`  [${v.key}] ${rows.toLocaleString()} rows × ${v.stages.length} stages`);
  }

  // 写出 CSV(\copy 用)+ layout。std 六色十字/xcross 预算 gm_*(热路径)。
  const outDir = path.join(repoRoot, 'stats', 'scramble', 'steps');
  fs.mkdirSync(outDir, { recursive: true });
  const stdCrossSlots = COLOR_LETTERS.map((c) => offsets.get(`std|cross|${c}`)).filter((x): x is number => !!x).map((x) => x - 1);
  const stdXcrossSlots = COLOR_LETTERS.map((c) => offsets.get(`std|xcross|${c}`)).filter((x): x is number => !!x).map((x) => x - 1);
  const minOf = (base: number, slots: number[]): number | null => {
    let m = Infinity;
    for (const s of slots) { const v = store[base + s]; if (v !== MISSING && v < m) m = v; }
    return m === Infinity ? null : m;
  };

  const csvPath = path.join(outDir, 'wca_scramble_steps.csv');
  const ws = fs.createWriteStream(csvPath, { encoding: 'utf-8' });
  let written = 0, skipped = 0;
  const buf: string[] = [];
  for (const [, row] of ids) {
    const k = natKeys[row];
    if (!k || !k[0] || !k[1] || k[5] === undefined || EXCLUDE_EVENTS.has(k[1])) { skipped++; continue; }
    const base = row * length;
    const arr: string[] = new Array(length);
    for (let s = 0; s < length; s++) { const v = store[base + s]; arr[s] = v === MISSING ? 'NULL' : String(v); }
    const gmC = minOf(base, stdCrossSlots);
    const gmX = minOf(base, stdXcrossSlots);
    // 列: competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,gm_cross6,gm_xcross6,steps
    buf.push([
      csvCell(k[0]), k[1], k[2], k[3], k[4], k[5],
      gmC === null ? '' : String(gmC), gmX === null ? '' : String(gmX),
      `"{${arr.join(',')}}"`,
    ].join(','));
    written++;
    if (buf.length >= 2000) { ws.write(buf.join('\n') + '\n'); buf.length = 0; }
  }
  if (buf.length) ws.write(buf.join('\n') + '\n');
  await new Promise<void>((r) => ws.end(r));

  const layoutPath = path.join(outDir, 'steps_layout.json');
  fs.writeFileSync(layoutPath, JSON.stringify({
    generated_at: process.env.SCRAMBLE_STATS_STAMP || new Date().toISOString(),
    length,
    variants: layout, // variant → stage → color → 1-based slot
  }, null, 0));

  console.log(`\nwrote ${csvPath}`);
  console.log(`  ${written.toLocaleString()} rows, ${skipped.toLocaleString()} skipped (no natural key)`);
  console.log(`  size ${(fs.statSync(csvPath).size / 1e6).toFixed(1)} MB`);
  console.log(`wrote ${layoutPath} (length=${length})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
