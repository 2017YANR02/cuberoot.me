// LSLL 批量求解(阶段 1)—— 语料 corpus.txt 的每个局面求**整方 HTM 最优解**,写 out.csv。
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
// 断点续跑:每条 appendFileSync 落盘,重启跳过 out.csv 里已有的 key。opt 系列 in-proc 跑久了
// 会抛 emscripten `unwind`,所以全量走 `solve_loop.mjs`(自动重启),别裸跑本文件。
//
// Usage: node solve.mjs [THREADS=12]
//   env MODULE  默认 cube48opt9.mjs          env TABLE  默认 solver/tables/h48/h48prun31h9.dat
//   env GROUP   默认 1(见上,需整除 THREADS)  env CORPUS 默认 ./corpus.txt  env OUT 默认 ./out.csv
//
// 默认 **opt9 + 15.6G 表**,与 `solver/333opt`(skill `update-scramble-stats` §C)同一档。
// 要 ~16G 空闲物理内存,别让它换页到磁盘。内存不够时换 opt6 / opt5(见 README),
// 换表只改速度不改答案,而且按 key 续跑 ⇒ 小表先起跑、空出来再换大表接着跑同一个 out.csv。
import { freemem } from 'node:os';
import { readFileSync, appendFileSync, existsSync, openSync, readSync, closeSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const MJS = resolve(process.env.MODULE || resolve(repoRoot, 'core/packages/client/public/cubeopt/cube48opt9.mjs'));
const DAT = resolve(process.env.TABLE || resolve(repoRoot, 'solver/tables/h48/h48prun31h9.dat'));
const CORPUS = resolve(process.env.CORPUS || resolve(__dirname, 'corpus.txt'));
const OUT = resolve(process.env.OUT || resolve(__dirname, 'out.csv'));
const THREADS = Number(process.argv[2] ?? process.env.THREADS ?? 12);
const GROUP = Number(process.env.GROUP ?? 1);
if (THREADS % GROUP !== 0) throw new Error(`GROUP(${GROUP}) 必须整除 THREADS(${THREADS})`);

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

// ---- 语料 / 断点 ----
const corpus = readFileSync(CORPUS, 'utf8').split('\n').filter((l) => l.includes(',')).map((l) => {
  const k = l.indexOf(',');
  return [l.slice(0, k), l.slice(k + 1).trim()];
});
const done = existsSync(OUT)
  ? new Set(readFileSync(OUT, 'utf8').split('\n').filter(Boolean).map((l) => l.slice(0, l.indexOf(','))))
  : new Set();
const todo = corpus.filter(([k]) => !done.has(k));

// ---- 载表 ----
const datSize = statSync(DAT).size;
console.log(`模块 ${MJS.split(/[\\/]/).pop()} · 表 ${DAT.split(/[\\/]/).pop()} (${(datSize / 1048576).toFixed(0)}M) · ${THREADS} 线程 / ${GROUP} 组`);
// 表必须全程驻留 RAM;换页到磁盘会比换一张小表还惨,先说清楚再开跑。
const free = freemem();
if (free < datSize * 1.1) {
  console.warn(`⚠ 空闲物理内存 ${(free / 1073741824).toFixed(1)}G < 表 ${(datSize / 1073741824).toFixed(1)}G ——`
    + ` 会换页到磁盘,慢到不如换小表。先腾内存,或 TABLE=../tables/h48/h48prun31h6.dat`
    + ` MODULE=../../core/packages/client/public/cubeopt/cube48opt6.mjs 起跑(按 key 续跑,之后能换回来)。`);
}
console.log(`语料 ${corpus.length} · 已完成 ${done.size} · 待解 ${todo.length}`);
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
console.log(`表就绪 ${((Date.now() - tLoad) / 1000).toFixed(1)}s`);

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
let n = 0, regrouped = 0, htmSum = 0;
const start = Date.now();
const tty = process.stdout.isTTY;
const MILESTONE = Math.max(1, Math.round(corpus.length / 100)); // 每 1% 一条持久行
let lastPaint = 0, lastMilestone = Math.floor(done.size / MILESTONE);

function paint(force) {
  const now = Date.now();
  if (!force && now - lastPaint < 200) return;
  lastPaint = now;
  const total = corpus.length, cur = done.size + n;
  const rate = n / ((now - start) / 1000);
  const eta = rate > 0 ? (total - cur) / rate : 0;
  const etaTxt = eta > 3600 ? `${(eta / 3600).toFixed(1)}h` : `${Math.round(eta / 60)}m`;
  const line = `[${cur}/${total} ${((cur / total) * 100).toFixed(1)}%] ${rate.toFixed(1)}/s · ETA ${etaTxt}`
    + ` · HTM 均 ${(htmSum / Math.max(1, n)).toFixed(2)} 峰 ${Math.max(...hist.keys(), 0)}`
    + (regrouped ? ` · 退回重解 ${regrouped}` : '');
  if (tty) process.stdout.write(`\r${line.padEnd(96)}`);
  const ms = Math.floor(cur / MILESTONE);
  if (ms > lastMilestone) {
    lastMilestone = ms;
    if (tty) process.stdout.write(`\r${line.padEnd(96)}\n`); else console.log(line);
  }
}

for (let i = 0; i < todo.length; i += GROUP) {
  const batch = todo.slice(i, i + GROUP);
  let got = claim(batch, solveBatch(batch));
  if (!got) {
    // 批量输出对不上(解数不足 / 有解认领不到打乱)→ 整批退回逐条重解,再不过就停下报错。
    regrouped++;
    got = batch.map((row, j) => {
      const one = claim([row], solveBatch([row]));
      if (!one) throw new Error(`校验失败(单条):${row[0]} ${row[1]}`);
      return { ...one[0], i: j };
    });
  }
  let rows = '';
  for (const r of got.sort((a, b) => a.i - b.i)) {
    const [key] = batch[r.i];
    rows += `${key},${r.htm},${qtmOf(r.sol)},${r.sol}\n`;
    hist.set(r.htm, (hist.get(r.htm) ?? 0) + 1);
    htmSum += r.htm;
    n++;
  }
  appendFileSync(OUT, rows);
  paint(false);
}
paint(true);
if (tty) process.stdout.write('\n');
console.log(`本轮 ${n} 条,用时 ${((Date.now() - start) / 1000 / 60).toFixed(1)} 分钟`);
console.log(`HTM 分布 ${JSON.stringify(Object.fromEntries([...hist].sort((a, b) => a[0] - b[0])))}`);
