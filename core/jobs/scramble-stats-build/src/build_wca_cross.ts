// Emits per-color real-WCA-scramble pools bucketed by optimal cross length, for
// the /scramble/analyzer "real WCA scramble + cross-step filter" feature.
//
// Reads the same WCA set as build.ts (std.csv cross lengths + no-wide scrambles),
// joins competition metadata (split_mbf.csv -> competitions.tsv), reservoir-samples
// K per (color, cross-length) bin, and writes stats/scramble/wca_cross/<L>.json
// (L = W/Y/R/O/B/G). No live computation needed at runtime — pure data.
//
// Run: pnpm --filter @cuberoot/scramble-stats-build build:wca-cross

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { makeRng } from './prng';
import { dateDisplay } from './comp_date';

const K = 200; // reservoir size per (color, bin)

// color letter -> std.csv column name (angle): z0=Y z1=R z2=W z3=O x1=B x3=G
const COLOR_COL: Record<string, string> = {
  W: 'cross_z2', Y: 'cross_z0', R: 'cross_z1', O: 'cross_z3', B: 'cross_x1', G: 'cross_x3',
};
const COLOR_LETTERS = Object.keys(COLOR_COL);

// 固定种子 PRNG (mulberry32, 见 prng.ts):reservoir 采样确定化 -> 输入不变则 wca_cross JSON 逐字节不变。
const rng = makeRng(0x9e3779b9);

interface Reservoir { samples: string[]; seen: number }
function resAdd(r: Reservoir, id: string) {
  r.seen++;
  if (r.samples.length < K) { r.samples.push(id); return; }
  const j = Math.floor(rng() * r.seen);
  if (j < K) r.samples[j] = id;
}

async function loadScrambleMap(txtPath: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const rl = readline.createInterface({ input: fs.createReadStream(txtPath, 'utf-8'), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    const i = line.indexOf(',');
    if (i === -1) continue;
    map.set(line.slice(0, i), line.slice(i + 1));
  }
  return map;
}

interface CompMeta { name: string; date: string }
async function loadCompMeta(tsvPath: string): Promise<Map<string, CompMeta>> {
  const map = new Map<string, CompMeta>();
  const rl = readline.createInterface({ input: fs.createReadStream(tsvPath, 'utf-8'), crlfDelay: Infinity });
  let first = true;
  for await (const line of rl) {
    if (!line) continue;
    if (first) { first = false; continue; } // header
    const [id, name, start, end] = line.split('\t');
    map.set(id, { name, date: dateDisplay(start, end) });
  }
  return map;
}

interface ScrMeta { compId: string; event: string; round: string; group: string; num: number }
async function loadScrMeta(csvPath: string, needed: Set<string>): Promise<Map<string, ScrMeta>> {
  // columns: id,scramble,competition_id,event_id,round_type_id,group_id,is_extra,scramble_num
  const map = new Map<string, ScrMeta>();
  const rl = readline.createInterface({ input: fs.createReadStream(csvPath, 'utf-8'), crlfDelay: Infinity });
  let first = true;
  for await (const line of rl) {
    if (!line) continue;
    if (first) { first = false; continue; }
    const c = line.split(',');
    const id = c[0];
    if (!needed.has(id)) continue;
    map.set(id, { compId: c[2], event: c[3], round: c[4], group: c[5], num: Number(c[7]) });
  }
  return map;
}

async function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const pkgRoot = path.resolve(here, '..');
  const repoRoot = path.resolve(pkgRoot, '..', '..', '..');
  const config = YAML.parse(fs.readFileSync(path.join(pkgRoot, 'config.yml'), 'utf-8'));
  const wca = (config.sets || []).find((s: { key: string }) => s.key === 'wca') ?? config.sets?.[0];
  if (!wca) throw new Error('no wca set in config.yml');

  const csvDir: string = wca.csv_dir;
  const dataRoot = path.dirname(csvDir); // .../wca_scramble
  const stdCsv = path.join(csvDir, 'std.csv');
  const scramblesTxt: string = wca.scrambles_txt;
  const metaCsv = wca.meta_csv ?? path.join(dataRoot, 'input', 'wca_scrambles_split_mbf.csv');
  const compTsv = wca.comp_csv ?? path.join(dataRoot, 'competitions.tsv');
  for (const [label, p] of [['std.csv', stdCsv], ['scrambles', scramblesTxt], ['split_mbf', metaCsv], ['competitions', compTsv]] as const) {
    if (!fs.existsSync(p)) throw new Error(`missing ${label}: ${p}`);
  }

  console.log('loading scramble map...');
  const scrambleMap = await loadScrambleMap(scramblesTxt);
  console.log(`  ${scrambleMap.size} scrambles`);

  // reservoir per color per bin
  const res: Record<string, Map<number, Reservoir>> = {};
  for (const c of COLOR_LETTERS) res[c] = new Map();

  console.log('streaming std.csv...');
  const rl = readline.createInterface({ input: fs.createReadStream(stdCsv, 'utf-8'), crlfDelay: Infinity });
  let header: string[] | null = null;
  const colIdx: Record<string, number> = {};
  let rows = 0;
  for await (const line of rl) {
    if (!line) continue;
    if (!header) {
      header = line.split(',');
      for (const c of COLOR_LETTERS) {
        const idx = header.indexOf(COLOR_COL[c]);
        if (idx === -1) throw new Error(`missing column ${COLOR_COL[c]}`);
        colIdx[c] = idx;
      }
      continue;
    }
    const parts = line.split(',');
    const id = parts[0];
    for (const c of COLOR_LETTERS) {
      const v = Number(parts[colIdx[c]]);
      if (!Number.isFinite(v)) continue;
      let bin = res[c].get(v);
      if (!bin) { bin = { samples: [], seen: 0 }; res[c].set(v, bin); }
      resAdd(bin, id);
    }
    if (++rows % 200000 === 0) process.stdout.write(`  ${rows} rows\r`);
  }
  console.log(`  ${rows} rows`);

  // collect needed ids
  const needed = new Set<string>();
  for (const c of COLOR_LETTERS) for (const bin of res[c].values()) for (const id of bin.samples) needed.add(id);
  console.log(`sampled ${needed.size} distinct scrambles; loading metadata...`);
  const scrMeta = await loadScrMeta(metaCsv, needed);
  const compMeta = await loadCompMeta(compTsv);
  console.log(`  ${scrMeta.size} scramble meta, ${compMeta.size} competitions`);

  const outDir = path.join(repoRoot, 'stats', 'scramble', 'wca_cross');
  fs.mkdirSync(outDir, { recursive: true });
  const generatedAt = process.env.SCRAMBLE_STATS_STAMP || new Date().toISOString();

  let totalBytes = 0;
  for (const c of COLOR_LETTERS) {
    const binsObj: Record<string, unknown[]> = {};
    const bins = [...res[c].keys()].sort((a, b) => a - b);
    for (const b of bins) {
      const arr: unknown[] = [];
      for (const id of res[c].get(b)!.samples) {
        const scramble = scrambleMap.get(id);
        const sm = scrMeta.get(id);
        if (!scramble || !sm) continue;
        const cm = compMeta.get(sm.compId);
        arr.push({ id, s: scramble, c: cm?.name ?? sm.compId, d: cm?.date ?? '', r: sm.round, g: sm.group, n: sm.num, e: sm.event });
      }
      if (arr.length) binsObj[String(b)] = arr;
    }
    const json = JSON.stringify({ color: c, generated_at: generatedAt, source: path.basename(scramblesTxt), bins: binsObj });
    const fp = path.join(outDir, `${c}.json`);
    fs.writeFileSync(fp, json);
    totalBytes += json.length;
    console.log(`  wrote ${c}.json (${(json.length / 1024).toFixed(1)} KB, ${bins.length} bins)`);
  }
  console.log(`done -> ${outDir} (${(totalBytes / 1024).toFixed(1)} KB total)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
