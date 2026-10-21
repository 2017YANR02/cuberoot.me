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
// 用法: node build_length_opt.mjs [--cached-only]
// --cached-only 仅复用 overlay/已完成 CSV；缺项即失败，绝不启动求解器。
import { readFileSync, writeFileSync, existsSync, statSync, mkdtempSync, rmSync, renameSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { executableSuffix, wcaDir, puzzleDir } from './pipeline_paths.mjs';
import { tsImport } from 'tsx/esm/api';

// The shared package uses bundler-style internal imports. Keep the existing
// plain-Node CLI working through this job's existing, scoped TS loader.
const { invertAlg } = await tsImport('@cuberoot/shared/alg-transform', import.meta.url);
const { normalizeWcaScramble } = await tsImport('@cuberoot/shared/normalize-wca-scramble', import.meta.url);
const { loadOptimalFaceResultsByText } = await tsImport('./src/optimal-face-results.mts', import.meta.url);

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');
const EX = resolve(repoRoot, 'stats/scramble/event_length_examples.json');
const OUT = resolve(repoRoot, 'stats/scramble/event_length_examples_opt.json');

const ANALYZER_DIR = resolve(repoRoot, 'solver/target/release');

// 纯 3x3 面转(无 wide / 旋转 / 小写)→ H48 h10 可直接吃。
const FACE_ONLY = /^[UDLRFB][2']? ?(?:[UDLRFB][2']? ?)*$/;
const FACE_EVENTS = new Set(['333', '333oh', '333fm', '333ft']);
const PUZZLE_BY_EVENT = { '222': '222', pyram: 'pyraminx', skewb: 'skewb' };
export const PUZZLE_BINARIES = { '222': 'cube222_analyzer', pyraminx: 'pyraminx_analyzer', skewb: 'skewb_analyzer' };

// Both native contracts return id,length,solution; never publish a partial batch.
export function parseSolvedSamples(csv, texts, puzzleKey = '333') {
  if (!csv.endsWith('\n')) throw new Error(`[${puzzleKey}] incomplete output CSV`);
  const rows = csv.split(/\r?\n/);
  rows.pop();
  if (puzzleKey !== '333' && rows.shift() !== `id,${puzzleKey},soln`) {
    throw new Error(`[${puzzleKey}] missing id/${puzzleKey}/soln header`);
  }
  const out = new Map();
  const seen = new Set();
  const movePattern = puzzleKey === 'pyraminx' ? /^[ULRBulrb]'?$/
    : puzzleKey === 'skewb' ? /^[ULRB]'?$/ : /^[UDLRFB][2']?$/;
  for (const row of rows) {
    const c = row.split(',');
    const index = Number(c[0]);
    const length = Number(c[1]);
    const solution = c[2]?.trim();
    const moves = solution ? solution.split(/\s+/) : [];
    if (c.length !== 3 || !/^\d+$/.test(c[0]) || !Number.isSafeInteger(index)
      || index >= texts.length || seen.has(index) || !/^\d+$/.test(c[1])
      || !Number.isSafeInteger(length) || moves.length !== length || moves.some((m) => !movePattern.test(m))) {
      throw new Error(`[${puzzleKey}] invalid or duplicate sample row: ${row}`);
    }
    seen.add(index);
    const inverse = invertAlg(solution);
    out.set(texts[index], puzzleKey === '333' || puzzleKey === '222' ? normalizeWcaScramble(inverse) : inverse);
  }
  if (seen.size !== texts.length) throw new Error(`[${puzzleKey}] incomplete solutions: ${seen.size}/${texts.length}`);
  return out;
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
    return parseSolvedSamples(readFileSync(output, 'utf8'), texts);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return out;
}

// 批量跑 puzzle analyzer(PUZZLE_EMIT_SOLN)→ Map<text, optScramble>。
function solvePuzzleTexts(puzzleKey, texts) {
  const binary = PUZZLE_BINARIES[puzzleKey];
  if (!binary) throw new Error(`Unknown puzzle analyzer: ${puzzleKey}`);
  const exe = join(ANALYZER_DIR, `${binary}${executableSuffix}`);
  const out = new Map();
  if (texts.length === 0) return out;
  if (!existsSync(exe)) throw new Error(`Missing puzzle analyzer: ${exe}`);
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
    if (r.error || r.status !== 0) throw new Error(`[${puzzleKey}] analyzer failed: ${String(r.error || r.status)}\n${r.stderr}`);
    // executor 输出 = <输入名去扩展>_<suffix>.csv = in_<key>.csv
    const csv = join(dir, `in_${puzzleKey}.csv`);
    return parseSolvedSamples(readFileSync(csv, 'utf8'), texts, puzzleKey);
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
  return out;
}

export async function buildLengthOpt({
  cachedOnly = false, examplesFile = EX, outputFile = OUT,
  faceCorpus = join(wcaDir, 'wca_scrambles_no_wide_move.txt'),
  faceResults = join(repoRoot, 'solver/333opt/out.0.csv'), puzzleRoot = puzzleDir,
} = {}) {
  const ex = JSON.parse(readFileSync(examplesFile, 'utf8'));
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
  if (existsSync(outputFile)) {
    Object.assign(byText, JSON.parse(readFileSync(outputFile, 'utf8')).byText ?? {});
  }
  const before = Object.keys(byText).length;

  // 3x3 面转族(跳过已解)。
  const faceArr = [...faceTexts].filter((t) => !(t in byText));
  if (faceArr.length) {
    const solved = await loadOptimalFaceResultsByText(faceCorpus, faceResults, faceArr);
    const reused = solved.size;
    const missing = faceArr.filter((text) => !solved.has(text));
    if (cachedOnly && missing.length) throw new Error(`[333] cached-only: ${missing.length} missing solutions; overlay unchanged`);
    if (!cachedOnly) for (const [text, optimal] of solveFaceTexts(missing)) solved.set(text, optimal);
    for (const [text, optimal] of solved) byText[text] = optimal;
    console.log(`  [3x3] ${solved.size}/${faceArr.length} 条 → 最优（复用 ${reused}，新增求解 ${missing.length}）`);
  }

  // 222 / pyram / skewb(跳过已解)。
  for (const [pk, set] of Object.entries(puzzleTexts)) {
    const arr = [...set].filter((t) => !(t in byText));
    if (!arr.length) continue;
    const m = pk === '222' ? await loadOptimalFaceResultsByText(
      join(puzzleRoot, '222/scrambles.txt'), join(puzzleRoot, '222/222.csv'), arr, '222',
    ) : new Map();
    const reused = m.size;
    const missing = arr.filter((text) => !m.has(text));
    if (cachedOnly && missing.length) throw new Error(`[${pk}] cached-only: ${missing.length} missing solutions; overlay unchanged`);
    if (!cachedOnly) for (const [text, optimal] of solvePuzzleTexts(pk, missing)) m.set(text, optimal);
    for (const [t, opt] of m) byText[t] = opt;
    console.log(`  [${pk}] ${m.size}/${arr.length} 条 → 最优（复用 ${reused}，新增求解 ${missing.length}）`);
  }

  const generated_at = process.env.SCRAMBLE_STATS_STAMP || new Date().toISOString();
  const temporary = `${outputFile}.${process.pid}.tmp`;
  try {
    writeFileSync(temporary, JSON.stringify({ meta: { generated_at }, byText }), { flag: 'wx', flush: true });
    renameSync(temporary, outputFile);
  } finally { rmSync(temporary, { force: true }); }
  const total = Object.keys(byText).length;
  console.log(`Wrote ${outputFile}  (${total} texts, +${total - before} new, ${(statSync(outputFile).size / 1024).toFixed(1)} KB)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--cached-only')) throw new Error(`Unknown arguments: ${args.join(' ')}`);
  buildLengthOpt({ cachedOnly: args.includes('--cached-only') }).catch((err) => { console.error(err); process.exit(1); });
}
