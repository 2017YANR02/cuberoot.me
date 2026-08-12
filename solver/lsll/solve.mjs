// LSLL 批量求解(阶段 1)—— 语料 corpus.txt 的每个 **case** 求**整方 HTM 最优解**,写 out.csv。
//
// ── case 的最优 = 16 个首尾 AUF 像里最短的那个 ───────────────────────────────
// 语料一行是一个 **case**(canonical key),不是一个局面。case 按定义就是双陪集 ⟨U⟩·S·⟨U⟩ ——
// 起手那个对准顶层的 AUF、以及公式尾部自带的那个 AUF,都是解法里可以自由选的,所以
// **`U^a 打乱 U^b` 这 16 个局面是同一个 case**,它们的最优解长度互差 0~2 步。只解其中一个
// (以前解的是展示相位那个)拿到的不是这个 case 的最优,是那个代表元的最优。
//
// 所以这里每行展开 16 个像各解一次,取最短。等价判据(export 阶段用它兜底):**取到最短之后,
// 那条解的首招和末招一定都不是 U 系转动** —— 是的话剥掉就得到同轨道更短的成员,与「最短」矛盾。
//
// 16 个像里偶尔有重复局面(整对入槽 + 槽棱没翻的 D± 两类有非平凡稳定子,全空间共 896 个重复),
// 展开后按局面去重,重复的不重复解。
//
// 代价:579,368 行 × ≤16 = 9,268,992 次求解。h6 表 12 线程 ~21.8 解/s ⇒ ~118 小时。
//
// 引擎 = cubeopt/h48(`core/packages/client/public/cubeopt/cube48opt*.mjs` + `solver/tables/h48/*.dat`),
// 与 `/scramble/solver`、`solver/333opt` 同一套。自己写的 Rust lsll_solver 2026-07-27 已退役(慢 1–2 个数量级)。
//
// **为什么默认 GROUP=1**:`solve_scramble` 的第 3 个参数是 n_group =「同时解几条」(**不是**
// 解数上限 —— 2026-07-27 实测,给 8 而只喂 1 条打乱会直接空转返回)。批量确实更快
// (h6 上 29.4/s vs 20.0/s),但 debug 输出是多线程裸 printf,**会在行内互相插队**:实测见过
// `Solution found!: Solution found!: …`、一条解被劈成两次回调、以及两条解首尾相接拼成一条
// (中间出现 `B  B` 这种不可能出现在最优解里的相邻同面)。解文本一旦串味就没法可靠还原,
// 所以放弃批量,老老实实一条一条解、12 线程全压在这一条上。GROUP 仍留作可调项。
//
// **每条解都回放校验**:本地 cubie 模型跑 `打乱 + 解 = 复原`,不过关就停下报错。
// 这条校验同时也钉死了下面那张 move 表(错了会 100% 失败,不会静默出坏数据)。
//
// 输出 `key,htm,qtm,solution` —— **qtm 是这一条解的 QTM,不是所有最优解里 QTM 最小的那个**。
// 用户要的口径是「HTM 最优前提下 QTM 也最优、并列全留」,那需要**枚举全部最优解**,而 h48 的
// wasm 没有枚举口(embind 只导出 get_mem_ptr/init/get_table_size/get_table_name/solve_scramble)。
// 阶段 2 见 README。这一阶段给的是 htm(**已经是确定的最优值**)+ 一条最优解。
//
// 断点续跑:**每个 case 一算完就 appendFileSync 落盘**,重启跳过 out.csv 里已有的 key。
// 所以随时 Ctrl-C / 关机 / 崩溃最多丢当前这一个 case(≤16 次求解,≈0.7 秒),没有别的状态要保存。
// 启动时还会检查末行是否被断电写残,残了就截掉再续(`repairTail`)。
// opt 系列 in-proc 跑久了会抛 emscripten `unwind`,所以全量走 `solve_loop.mjs`(自动重启),
// 别裸跑本文件。
//
// 进度显示:TTY 下**只有一行,原地覆盖**,不滚屏;重定向进日志时改成每 1% 落一条。
// env QUIET=1 连启动那行横幅也不打(solve_loop 重启时用,免得几百次重启把日志刷满)。
//
// Usage: node solve.mjs [THREADS=12]
//   env MODULE  默认 cube48opt9.mjs          env TABLE  默认 solver/tables/h48/h48prun31h9.dat
//   env GROUP   默认 1(见上,需整除 THREADS)  env CORPUS 默认 ./corpus.txt  env OUT 默认 ./out.csv
//   env LIMIT   只跑前 N 个未完成的 case(抽样量成本用,默认全跑)
//
// 默认 **opt9 + 15.6G 表**,与 `solver/333opt`(skill `update-scramble-stats` §C)同一档,
// 也是这条管道认定要用的那张 —— 要 ~16G 空闲物理内存,别让它换页到磁盘。
// 换表只改速度不改答案(都是可采纳剪枝表),而且按 key 续跑,所以中途停下来换表零重做。
import { freemem } from 'node:os';
import {
  readFileSync, writeFileSync, appendFileSync, existsSync, openSync, readSync, closeSync, statSync,
} from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const MJS = resolve(process.env.MODULE || resolve(repoRoot, 'core/packages/client/public/cubeopt/cube48opt9.mjs'));
const DAT = resolve(process.env.TABLE || resolve(repoRoot, 'solver/tables/h48/h48prun31h9.dat'));
// 相对路径按**脚本所在目录**算,不按 cwd —— 从别处调(update_lsll.ps1)时才不会指空
const CORPUS = resolve(__dirname, process.env.CORPUS || 'corpus.txt');
const OUT = resolve(process.env.OUT || resolve(__dirname, 'out.csv'));
const THREADS = Number(process.argv[2] ?? process.env.THREADS ?? 12);
const GROUP = Number(process.env.GROUP ?? 1);
const LIMIT = Number(process.env.LIMIT ?? 0);
const QUIET = process.env.QUIET === '1';
if (THREADS % GROUP !== 0) throw new Error(`GROUP(${GROUP}) 必须整除 THREADS(${THREADS})`);
const say = (m) => { if (!QUIET) console.log(m); };

// ---- 本地 cubie 模型(与 client lib/lsll/cube333.ts 同一张表,用于回放校验)----
const Z8 = Array(8).fill(0), Z12 = Array(12).fill(0);
const MOVES = {
  U: { cp: [3, 0, 1, 2, 4, 5, 6, 7], co: Z8, ep: [3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11], eo: Z12 },
  R: { cp: [4, 1, 2, 0, 7, 5, 6, 3], co: [2, 0, 0, 1, 1, 0, 0, 2], ep: [8, 1, 2, 3, 11, 5, 6, 7, 4, 9, 10, 0], eo: Z12 },
  F: { cp: [1, 5, 2, 3, 0, 4, 6, 7], co: [1, 2, 0, 0, 2, 1, 0, 0], ep: [0, 9, 2, 3, 4, 8, 6, 7, 1, 5, 10, 11], eo: [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0] },
  D: { cp: [0, 1, 2, 3, 5, 6, 7, 4], co: Z8, ep: [0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11], eo: Z12 },
  L: { cp: [0, 2, 6, 3, 4, 1, 5, 7], co: [0, 1, 2, 0, 0, 2, 1, 0], ep: [0, 1, 10, 3, 4, 5, 9, 7, 8, 2, 6, 11], eo: Z12 },
  B: { cp: [0, 1, 3, 7, 4, 5, 2, 6], co: [0, 0, 1, 2, 0, 0, 2, 1], ep: [0, 1, 2, 11, 4, 5, 6, 10, 8, 9, 3, 7], eo: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1] },
};
const solvedCube = () => ({ cp: [...Array(8).keys()], co: [...Z8], ep: [...Array(12).keys()], eo: [...Z12] });
function applyAlg(s, alg) {
  for (const tok of alg.trim().split(/\s+/).filter(Boolean)) {
    const t = tok.match(/^([URFDLB])(2'?|'|3)?$/);
    if (!t) throw new Error(`bad move ${tok}`);
    const n = t[2] === '2' || t[2] === "2'" ? 2 : t[2] === "'" || t[2] === '3' ? 3 : 1;
    const m = MOVES[t[1]];
    for (let k = 0; k < n; k++) {
      const cp = [], co = [], ep = [], eo = [];
      for (let i = 0; i < 8; i++) { cp[i] = s.cp[m.cp[i]]; co[i] = (s.co[m.cp[i]] + m.co[i]) % 3; }
      for (let i = 0; i < 12; i++) { ep[i] = s.ep[m.ep[i]]; eo[i] = (s.eo[m.ep[i]] + m.eo[i]) % 2; }
      s = { cp, co, ep, eo };
    }
  }
  return s;
}
const isSolved = (s) => s.cp.every((v, i) => v === i) && s.co.every((v) => !v)
  && s.ep.every((v, i) => v === i) && s.eo.every((v) => !v);
/** QTM = 步数 + 半转个数(半转记 2)。 */
const qtmOf = (sol) => sol.split(' ').filter(Boolean).reduce((n, t) => n + (t.includes('2') ? 2 : 1), 0);
/** 整方局面指纹,用来给 AUF 像去重(不同像撞上同一个局面时别重复解)。 */
const fingerprint = (s) => `${s.cp.join('')}|${s.co.join('')}|${s.ep.join('')}|${s.eo.join('')}`;

// ---- 一个 case 的 16 个首尾 AUF 像 ----
const AUF = ['', 'U', 'U2', "U'"];
/**
 * `打乱` → 它所在 case 的全部 AUF 像(`U^a 打乱 U^b`),按到达的局面去重。
 * 前后各接一个 U 系转动**不会**换 case:U 碰不到 DFR / FR,得到的仍是同一条 ⟨U⟩·S·⟨U⟩ 双陪集。
 */
function aufImages(scramble) {
  const seen = new Map();
  for (const pre of AUF) {
    for (const post of AUF) {
      const scr = [pre, scramble, post].filter(Boolean).join(' ');
      const fp = fingerprint(applyAlg(solvedCube(), scr));
      if (!seen.has(fp)) seen.set(fp, scr);
    }
  }
  return [...seen.values()];
}

/**
 * 一个 case 的最优解 = 16 个像各自最优解里最短的那条。
 * 并列时按 (htm, qtm, 字典序) 定序 —— 换机器 / 换表跑出来要是同一行,行级 sha 清单 diff 才有意义。
 */
function bestOf(results) {
  return results.reduce((a, b) => {
    if (b.htm !== a.htm) return b.htm < a.htm ? b : a;
    const qa = qtmOf(a.sol), qb = qtmOf(b.sol);
    if (qa !== qb) return qb < qa ? b : a;
    return b.sol < a.sol ? b : a;
  });
}

// ---- 语料 / 断点 ----
const corpus = readFileSync(CORPUS, 'utf8').split('\n').filter((l) => l.includes(',')).map((l) => {
  const k = l.indexOf(',');
  return [l.slice(0, k), l.slice(k + 1).trim()];
});
/**
 * 断电 / 强杀有极小概率把末行写残(一次 append 写一行,系统崩在中间)。残行会让 done 集多出一个
 * 假 key(那个 case 被永久跳过),也会让 export 阶段炸。启动时核一遍末行,残了就截掉重算那一条。
 */
const ROW_RE = /^[0-9a-z]+,\d+,\d+,[URFDLB2' ]+$/;
function repairTail() {
  if (!existsSync(OUT)) return [];
  const lines = readFileSync(OUT, 'utf8').split('\n').filter(Boolean);
  if (lines.length && !ROW_RE.test(lines[lines.length - 1])) {
    const bad = lines.pop();
    writeFileSync(OUT, lines.length ? `${lines.join('\n')}\n` : '');
    console.log(`out.csv 末行写残,已截掉重算:${bad.slice(0, 60)}`);
  }
  return lines;
}
const existing = repairTail();
// 旧口径(2026-07-28 之前:只解展示相位那一个代表元)的 out.csv 混进来是最危险的一种脏数据 ——
// key 空间一样,会被当成「已完成」静默跳过,最后端上去的是虚高 0~2 步的假最优。
// 判据就是那条:轨道最短的解首末招不可能是 U 系。扫一遍,发现一条就停,让人先把旧文件挪走。
const U_END_RE = /^U[2']?(\s|$)|(^|\s)U[2']?$/;
for (const l of existing) {
  const sol = l.slice(l.indexOf(',') + 1).split(',').slice(2).join(',');
  if (U_END_RE.test(sol)) {
    console.error(`out.csv 里有旧口径的行(解首/末是 U 系):${l.slice(0, 70)}`);
    console.error('旧口径算的是「展示相位那个代表元」的最优,不是这个 case 的最优,不能混用。');
    console.error(`先把它挪走再跑:pwsh -NoProfile -File "$HOME/.codex/bin/trash.ps1" ${OUT}`);
    process.exit(2);
  }
}
const done = new Set(existing.map((l) => l.slice(0, l.indexOf(','))));
let todo = corpus.filter(([k]) => !done.has(k));
// 进度只数**本语料**里已完成的 key,不拿 out.csv 的总行数当分子(留着旧口径的 out.csv
// 在旁边时会把不属于本语料的行算进来,百分比和 ETA 全歪)。
const doneHere = corpus.length - todo.length;
if (LIMIT > 0) todo = todo.slice(0, LIMIT);

// ---- 载表 ----
const datSize = statSync(DAT).size;
// 表必须全程驻留 RAM,换页到磁盘会慢到不可用。**这条警告不受 QUIET 压制**,但也只是警告:
// 用哪张表由调用方决定,这里不替它改。
const free = freemem();
if (free < datSize * 1.1) {
  console.warn(`⚠ 空闲物理内存 ${(free / 1073741824).toFixed(1)}G < 表 ${(datSize / 1073741824).toFixed(1)}G ——`
    + ` 会换页到磁盘。先腾内存再开跑(按 key 续跑,停下来腾完再起零重做)。`);
}
say(`${MJS.split(/[\\/]/).pop()} · ${DAT.split(/[\\/]/).pop()} ${(datSize / 1048576).toFixed(0)}M · ${THREADS} 线程`
  + ` · 语料 ${corpus.length} case(每个展开 ≤16 个 AUF 像)· 已完成 ${doneHere} · 待解 ${todo.length}`
  + `${LIMIT > 0 ? ` · LIMIT=${LIMIT}` : ''}`);
if (!todo.length) { console.log('全部完成'); process.exit(0); }

const printed = [];
const createModule = (await import(pathToFileURL(MJS).href)).default;
const m = await createModule({ print: (t) => printed.push(t), printErr: () => {} });
const heapBase = Number(m._get_mem_ptr());
const fd = openSync(DAT, 'r');
const CH = 64 * 1024 * 1024;
const buf = Buffer.allocUnsafe(CH);
const tLoad = Date.now();
for (let off = 0; off < datSize;) {
  const got = readSync(fd, buf, 0, Math.min(CH, datSize - off), off);
  m.HEAPU8.set(buf.subarray(0, got), heapBase + off);
  off += got;
}
closeSync(fd);
m.init(0, THREADS);
say(`表就绪 ${((Date.now() - tLoad) / 1000).toFixed(1)}s`);

/**
 * 解一批,返回该批打印出的全部解(顺序无意义)。
 *
 * **不靠 `CubeN` 的编号认领**:12 条并发时 `Solution found!` 与 `CubeN finished in` 两行会交错,
 * 按相邻配对有 90%+ 的批次错位。改成**按解认领打乱** —— 一条解只可能解开它自己那个局面
 * (语料里 key 两两不同 ⇒ 局面两两不同),回放一遍就知道是谁的,顺带把解也验了。
 * htm 直接数解的步数(与 wasm 的 `finished in N` 同值,实测一致)。
 */
function solveBatch(batch) {
  printed.length = 0;
  m.solve_scramble(batch.map(([, s]) => s).join('\n'), THREADS, batch.length, true);
  // 并发下 print 回调拿到的不一定是完整一行:两条消息会被拼进同一条 text
  // (见过 `Solution found!: … Cube7 finished in 14, …`)。所以整段扫,并且只吃
  // 紧跟其后的那串**合法转动**,后面粘着什么都不管。
  const out = [];
  const re = /Solution found!:\s*((?:[URFDLB](?:2|')?\s+)*[URFDLB](?:2|')?)/g;
  for (const mt of printed.join('\n').matchAll(re)) out.push(mt[1].trim().replace(/\s+/g, ' '));
  return out;
}

/** 把一批解认领到各自的打乱上;认领不全返回 null(调用方退回逐条重解)。 */
function claim(batch, sols) {
  if (sols.length !== batch.length) return null;
  const states = batch.map(([, scr]) => applyAlg(solvedCube(), scr));
  const taken = new Array(batch.length).fill(null);
  for (const sol of sols) {
    let hit = -1;
    for (let i = 0; i < batch.length; i++) {
      if (taken[i] === null && isSolved(applyAlg(states[i], sol))) { hit = i; break; }
    }
    if (hit < 0) return null;
    taken[hit] = { i: hit, htm: sol.split(' ').filter(Boolean).length, sol };
  }
  return taken.every(Boolean) ? taken : null;
}

// ---- 主循环 ----
const hist = new Map();
let n = 0, regrouped = 0, htmSum = 0, solves = 0;
const start = Date.now();
const tty = process.stdout.isTTY;
// 重定向进日志时没法原地覆盖,退化成每 1% 一条(579,368 个 case ⇒ 全程约 100 行,不刷屏)。
const MILESTONE = Math.max(1, Math.round(corpus.length / 100));
let lastPaint = 0, lastMilestone = Math.floor(doneHere / MILESTONE);

function paint(force) {
  const now = Date.now();
  if (!force && now - lastPaint < 200) return;
  lastPaint = now;
  const total = corpus.length, cur = doneHere + n;
  const rate = n / ((now - start) / 1000);
  const eta = rate > 0 ? (total - cur) / rate : 0;
  const etaTxt = eta > 3600 ? `${(eta / 3600).toFixed(1)}h` : `${Math.round(eta / 60)}m`;
  const solveRate = solves / ((now - start) / 1000);
  const line = `[${cur}/${total} ${((cur / total) * 100).toFixed(2)}%] ${rate.toFixed(2)} case/s`
    + `(${solveRate.toFixed(1)} 解/s)· 剩 ${etaTxt}`
    + ` · HTM 均 ${(htmSum / Math.max(1, n)).toFixed(2)} 峰 ${Math.max(...hist.keys(), 0)}`
    + (regrouped ? ` · 退回重解 ${regrouped}` : '');
  // TTY:**永远只占一行**,原地覆盖,连 1% 的持久行也不落 —— 5 天的活不该在屏幕上堆几百行。
  if (tty) { process.stdout.write(`\r${line.padEnd(110)}`); return; }
  const ms = Math.floor(cur / MILESTONE);
  if (ms > lastMilestone) { lastMilestone = ms; console.log(line); }
}

/** 解一组打乱(GROUP 条一批),批量对不上就整批退回逐条重解。 */
function solveAll(scrambles, label) {
  const out = [];
  for (let i = 0; i < scrambles.length; i += GROUP) {
    const batch = scrambles.slice(i, i + GROUP).map((s, j) => [String(i + j), s]);
    let got = claim(batch, solveBatch(batch));
    if (!got) {
      // 批量输出对不上(解数不足 / 有解认领不到打乱)→ 整批退回逐条重解,再不过就停下报错。
      regrouped++;
      got = batch.map((row, j) => {
        const one = claim([row], solveBatch([row]));
        if (!one) throw new Error(`校验失败(单条):${label} ${row[1]}`);
        return { ...one[0], i: j };
      });
    }
    for (const r of got) out.push({ htm: r.htm, sol: r.sol });
    solves += batch.length;
  }
  return out;
}

// ── 别再试图「吞掉 unwind 接着跑」(2026-07-28 实测过两轮,结论:不行)────────────────
// 动机是省掉重启时那 20~34s 的表重载(崩得勤时是 30%+ 的税)。两种写法都试了:
//  1. `try/catch` 包住 solve_scramble —— **抓不到**。unwind 不在我们这条调用栈上,
//     是 worker 的 mailbox 回调异步投递到进程级的(`--trace-uncaught` 指到 run_main)。
//  2. `process.on('uncaughtException')` 里吞掉 —— 确实**能**接着跑(61 个 case 变 291 个),
//     然后 wasm 自己炸了:`RuntimeError: memory access out of bounds`(worker 线程的
//     ida_search 里)。也就是说 unwind 之后 pthread / 堆状态已经坏了,继续跑是在坏状态上算。
// 最怕的不是崩,是**不崩**:搜索被打断后返回一条更长但仍能解开的解,回放校验照样过,
// htm 就静默虚高 —— 而这条管道的全部意义就是「最优」。所以宁可重载表。
for (const [key, baseScramble] of todo) {
  const best = bestOf(solveAll(aufImages(baseScramble), key));
  // 取到轨道最短之后,首末招都不可能是 U 系 —— 是的话剥掉就得到同轨道更短的成员,与最短矛盾。
  // 命中说明 16 个像没取全(或 aufImages 拼错了),此时数据是坏的,当场停,别静默写进 58 万行。
  if (U_END_RE.test(best.sol)) {
    throw new Error(`${key}:最短解 "${best.sol}" 首/末是 U 系 —— 不是轨道最小,AUF 展开有问题`);
  }
  appendFileSync(OUT, `${key},${best.htm},${qtmOf(best.sol)},${best.sol}\n`);
  hist.set(best.htm, (hist.get(best.htm) ?? 0) + 1);
  htmSum += best.htm;
  n++;
  paint(false);
}
paint(true);
// QUIET(= 被 solve_loop 重启拉起)时不换行、不打汇总 —— 那一行留给下一个进程接着覆盖,
// 几百次重启也不会在屏幕上堆出几百行。
if (!QUIET) {
  if (tty) process.stdout.write('\n');
  console.log(`本轮 ${n} 个 case(${solves} 次求解),用时 ${((Date.now() - start) / 1000 / 60).toFixed(1)} 分钟`);
  console.log(`HTM 分布 ${JSON.stringify(Object.fromEntries([...hist].sort((a, b) => a[0] - b[0])))}`);
}
