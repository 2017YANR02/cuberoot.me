// 长度 tab「原始/最优」切换的数据源:为 event_length_examples.json 里的样例打乱算「最优等价打乱」
// (= 最优解的逆,同状态最少步)。本地步(需 cube48opt 表 + puzzle analyzer,均 gitignored、CI 无),
// 跟难度 tab 的 puzzle 管线一样手动跑 + 发布;产出独立 overlay 文件,CI 日更的 base examples 不被覆盖。
//
// 覆盖范围:
//   3x3 纯面转族(333/333oh/333fm/333ft)→ cube48opt5(972M 表)整解最优,逆得最优打乱。
//   222/pyram/skewb → 各自 analyzer(PUZZLE_EMIT_SOLN)整解最优,逆得最优打乱。
//   333bf/333mbf(含 wide/旋转,改朝向)、sq1/clock/大方块 → 跳过(前端自动只显原始)。
//
// 产出 stats/scramble/event_length_examples_opt.json = { meta, byText: { "<打乱文本>": "<最优打乱>" } }。
// 同一文本(面转字母表互不冲突)→ 同一最优,故全局 byText 足够;前端按样例文本查表。
//
// 用法: node build_length_opt.mjs   (从 core/packages/scramble-stats-build/ 或任意 CWD,路径自解析)
import {
  readFileSync, writeFileSync, existsSync, openSync, readSync, closeSync, fstatSync, statSync, mkdtempSync, rmSync,
} from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir, cpus } from 'node:os';
import { spawnSync } from 'node:child_process';

// 算力限额(全局规则:重计算 ≤14 线程,留核给系统)。THREADS 可覆盖(并发跑别的活时调低)。
const SOLVE_THREADS = Number(process.env.THREADS) || Math.min(14, Math.max(1, cpus().length - 2));

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');
const EX = resolve(repoRoot, 'stats/scramble/event_length_examples.json');
const OUT = resolve(repoRoot, 'stats/scramble/event_length_examples_opt.json');

const OPT_MJS = resolve(repoRoot, 'core/packages/client-next/public/cubeopt/cube48opt5.mjs');
const OPT_DAT = resolve(repoRoot, 'solver/tables/h48/h48prun31h5.dat');
const ANALYZER_DIR = resolve(repoRoot, 'solver/target/release');

// 纯 3x3 面转(无 wide / 旋转 / 小写)→ cube48opt 可直接吃。
const FACE_ONLY = /^[UDLRFB][2']? ?(?:[UDLRFB][2']? ?)*$/;
const FACE_EVENTS = new Set(['333', '333oh', '333fm', '333ft']);
const PUZZLE_BY_EVENT = { '222': 'pocket', pyram: 'pyraminx', skewb: 'skewb' };

// 逆一条解 → 最优等价打乱:X2 自逆;X' ↔ X;pyraminx 小写 tip 同理。
function invertAlg(s) {
  return s.trim().split(/\s+/).filter(Boolean).reverse()
    .map((m) => (m.endsWith('2') ? m : m.endsWith("'") ? m.slice(0, -1) : `${m}'`))
    .join(' ');
}

// cube48opt 求解器(复刻 solver/333opt/solve.mjs makeSolver,opt5 + 972M 表,inproc K 线程)。
async function makeCubeSolver(threads) {
  if (!existsSync(OPT_MJS) || !existsSync(OPT_DAT)) return null;
  const state = { last: '', sol: '' };
  const createModule = (await import(pathToFileURL(OPT_MJS).href)).default;
  const m = await createModule({
    print: (t) => {
      const s = t.match(/Solution found!:\s*(.*)/);
      if (s) state.sol = s[1].trim().replace(/\s+/g, ' ');
      if (/finished in/.test(t)) state.last = t;
    },
    printErr: () => {},
  });
  const base = Number(m._get_mem_ptr());
  const fd = openSync(OPT_DAT, 'r');
  const sz = fstatSync(fd).size;
  const CH = 64 * 1024 * 1024;
  const tmp = Buffer.allocUnsafe(CH);
  for (let off = 0; off < sz;) { const g = readSync(fd, tmp, 0, Math.min(CH, sz - off), off); m.HEAPU8.set(tmp.subarray(0, g), base + off); off += g; }
  closeSync(fd);
  m.init(0, threads);
  return (scr, nt) => {
    state.last = ''; state.sol = '';
    m.solve_scramble(scr, nt, 1, true);
    return state.sol; // 最优解序列
  };
}

// 批量跑 puzzle analyzer(PUZZLE_EMIT_SOLN)→ Map<text, optScramble>。
function solvePuzzleTexts(puzzleKey, texts) {
  const exe = join(ANALYZER_DIR, `${puzzleKey}_analyzer.exe`);
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
  const puzzleTexts = { pocket: new Set(), pyraminx: new Set(), skewb: new Set() };
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
    const K = SOLVE_THREADS;
    const solve = await makeCubeSolver(K);
    if (!solve) {
      console.warn(`  [3x3] 跳过:缺 cube48opt5 模块或 972M 表(${OPT_DAT})`);
    } else {
      let n = 0;
      for (const text of faceArr) {
        const sol = solve(text, K);
        if (sol !== undefined) byText[text] = invertAlg(sol);
        if (++n % 50 === 0) console.log(`  [3x3] ${n}/${faceArr.length}`);
      }
      console.log(`  [3x3] ${faceArr.length} 条 → 最优`);
    }
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
