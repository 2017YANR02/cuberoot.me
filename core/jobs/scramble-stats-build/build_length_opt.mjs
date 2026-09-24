// 长度 tab「原始/最优」切换的数据源:为 event_length_examples.json 里的样例打乱算「最优等价打乱」
// (= 最优解的逆,同状态最少步)。本地步(需 H48 h10 表 + puzzle analyzer,均 gitignored、CI 无),
// 跟难度 tab 的 puzzle 管线一样手动跑 + 发布;产出独立 overlay 文件,CI 日更的 base examples 不被覆盖。
//
// 覆盖范围:
//   3x3 纯面转族(333/333oh/333fm/333ft)→ 统一 H48 h10 整解最优,逆得最优打乱。
//   222/pyram/skewb → 各自 analyzer(PUZZLE_EMIT_SOLN)整解最优,逆得最优打乱。
//   333bf/333mbf(含 wide/旋转,改朝向)、sq1/clock/大方块 → 跳过(前端自动只显原始)。
//
// 产出 stats/scramble/event_length_examples_opt.json = { meta, byText: { "<打乱文本>": "<最优打乱>" } }。
// 同一文本(面转字母表互不冲突)→ 同一最优,故全局 byText 足够;前端按样例文本查表。
//
// 用法: node build_length_opt.mjs   (从 core/jobs/scramble-stats-build/ 或任意 CWD,路径自解析)
import { readFileSync, writeFileSync, existsSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { executableSuffix } from './pipeline_paths.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');
const EX = resolve(repoRoot, 'stats/scramble/event_length_examples.json');
const OUT = resolve(repoRoot, 'stats/scramble/event_length_examples_opt.json');

const ANALYZER_DIR = resolve(repoRoot, 'solver/target/release');

// 纯 3x3 面转(无 wide / 旋转 / 小写)→ H48 h10 可直接吃。
const FACE_ONLY = /^[UDLRFB][2']? ?(?:[UDLRFB][2']? ?)*$/;
const FACE_EVENTS = new Set(['333', '333oh', '333fm', '333ft']);
const PUZZLE_BY_EVENT = { '222': '222', pyram: 'pyraminx', skewb: 'skewb' };

// 逆一条解 → 最优等价打乱:X2 自逆;X' ↔ X;pyraminx 小写 tip 同理。
function invertAlg(s) {
  return s.trim().split(/\s+/).filter(Boolean).reverse()
    .map((m) => (m.endsWith('2') ? m : m.endsWith("'") ? m.slice(0, -1) : `${m}'`))
    .join(' ');
}

// 复用 333opt 的同一个 H10 worker；临时语料和结果不改全量 out.0.csv/counts.json。
function solveFaceTexts(texts) {
  const out = new Map();
  if (texts.length === 0) return out;
  const dir = mkdtempSync(join(tmpdir(), 'lenopt-h10-'));
  try {
    const corpus = join(dir, 'corpus.csv');
    const output = join(dir, 'out.csv');
    writeFileSync(corpus, texts.map((text, i) => `${i},${text}`).join('\n') + '\n');
    const result = spawnSync('pnpm', ['exec', 'tsx', '../solver/333opt/solve_h10.mts', '--no-counts'], {
      cwd: resolve(repoRoot, 'core'),
      env: { ...process.env, CORPUS: corpus, OUT: output },
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
    if (result.error || result.status !== 0) {
      throw new Error(`H48 h10 length sample solve failed: ${String(result.error || result.status)}\n${result.stderr}`);
    }
    for (const row of readFileSync(output, 'utf8').trim().split('\n')) {
      const first = row.indexOf(',');
      const second = row.indexOf(',', first + 1);
      const index = Number(row.slice(0, first));
      if (first < 1 || second < 0 || !Number.isInteger(index) || index < 0 || index >= texts.length) {
        throw new Error(`Invalid H48 h10 length sample row: ${row}`);
      }
      out.set(texts[index], invertAlg(row.slice(second + 1)));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return out;
}

// 批量跑 puzzle analyzer(PUZZLE_EMIT_SOLN)→ Map<text, optScramble>。
function solvePuzzleTexts(puzzleKey, texts) {
  const exe = join(ANALYZER_DIR, `${puzzleKey}_analyzer${executableSuffix}`);
  const out = new Map();
  if (!existsSync(exe) || texts.length === 0) return out;
  const dir = mkdtempSync(join(tmpdir(), 'lenopt-'));
  try {
    const inFile = join(dir, 'in.txt');
    writeFileSync(inFile, texts.map((t, i) => `${i},${t}`).join('\n'));
    const r = spawnSync(exe, {
      input: `${inFile}\nexit\n`,
      env: { ...process.env, PUZZLE_EMIT_SOLN: '1' },
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    });
    if (r.status !== 0 && r.error) { console.warn(`  [${puzzleKey}] analyzer 失败: ${r.error.message}`); return out; }
    // executor 输出 = <输入名去扩展>_<suffix>.csv = in_<key>.csv
    const csv = join(dir, `in_${puzzleKey}.csv`);
    if (!existsSync(csv)) { console.warn(`  [${puzzleKey}] 无输出 csv`); return out; }
    let header = true;
    for (const line of readFileSync(csv, 'utf8').split('\n')) {
      if (!line) continue;
      if (header) { header = false; continue; }
      const c = line.split(','); // id,len,soln
      const idx = Number(c[0]);
      const soln = c[2];
      if (Number.isInteger(idx) && soln && soln !== '-') out.set(texts[idx], invertAlg(soln));
    }
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
  return out;
}

async function main() {
  if (!existsSync(EX)) { console.error(`缺 ${EX}(先跑 build_scramble_lengths 或拉线上数据)`); process.exit(1); }
  const ex = JSON.parse(readFileSync(EX, 'utf8'));
  const events = ex.events ?? {};
  const eventsQtm = ex.events_qtm ?? {};

  // 收集各类待解文本(去重)。tuple = [compId, round, group, num, text, isExtra?]。
  const faceTexts = new Set();
  const puzzleTexts = { '222': new Set(), pyraminx: new Set(), skewb: new Set() };
  const collect = (src) => {
    for (const [ev, bins] of Object.entries(src)) {
      const pk = PUZZLE_BY_EVENT[ev];
      const isFace = FACE_EVENTS.has(ev);
      if (!pk && !isFace) continue;
      for (const arr of Object.values(bins)) {
        for (const row of arr) {
          const text = (row[4] ?? '').trim();
          if (!text) continue;
          if (pk) puzzleTexts[pk].add(text);
          else if (FACE_ONLY.test(text)) faceTexts.add(text);
        }
      }
    }
  };
  collect(events);
  collect(eventsQtm); // QTM 分桶引用同一批文本,顺带覆盖

  // 增量:复用已解 overlay,只解新出现的文本(CI 蓄水池缓慢漂移,再跑很便宜)。
  const byText = {};
  if (existsSync(OUT)) {
    try { Object.assign(byText, JSON.parse(readFileSync(OUT, 'utf8')).byText ?? {}); } catch { /* 重建 */ }
  }
  const before = Object.keys(byText).length;

  // 3x3 面转族(跳过已解)。
  const faceArr = [...faceTexts].filter((t) => !(t in byText));
  if (faceArr.length) {
    const solved = solveFaceTexts(faceArr);
    for (const [text, optimal] of solved) byText[text] = optimal;
    console.log(`  [3x3] H48 h10 ${solved.size}/${faceArr.length} 条 → 最优`);
  }

  // 222 / pyram / skewb(跳过已解)。
  for (const [pk, set] of Object.entries(puzzleTexts)) {
    const arr = [...set].filter((t) => !(t in byText));
    if (!arr.length) continue;
    const m = solvePuzzleTexts(pk, arr);
    for (const [t, opt] of m) byText[t] = opt;
    console.log(`  [${pk}] ${m.size}/${arr.length} 条 → 最优`);
  }

  const generated_at = process.env.SCRAMBLE_STATS_STAMP || new Date().toISOString();
  writeFileSync(OUT, JSON.stringify({ meta: { generated_at }, byText }));
  const total = Object.keys(byText).length;
  console.log(`Wrote ${OUT}  (${total} texts, +${total - before} new, ${(statSync(OUT).size / 1024).toFixed(1)} KB)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
