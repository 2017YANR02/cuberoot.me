/*
 * clock_analyzer —— 魔表真题语料的整解最优步数 analyzer(喂 build_puzzle_dist 的 clock/clock.csv)。
 *
 * 为什么是 TS 而不是 Rust:魔表的最优求解器本来就是纯 TS(`client/lib/clock-solver.ts`,零下载表、
 * 可证最优、~10ms/态),再拿 Rust 抄一遍没有收益。所以这个文件**把自己伪装成 analyzer exe**:
 * 与 `solver/target/release/*_analyzer.exe` 完全同一套 CLI 契约,`update_puzzle_stats.ps1` 那段
 * 分块循环一行都不用改口径。
 *
 * 契约(与 Rust analyzer 逐条对齐):
 *   stdin        每行一个块文件路径(ps1 一次喂一块)
 *   块文件       每行 `<id>,<scramble>`
 *   输出         同目录 `<块文件名去扩展>_clock.csv`,首行表头,其后与输入**逐行等长同序**
 *   列           `id,clock`(+ `soln` 当 env `PUZZLE_EMIT_SOLN=1`;它的逆 = 最优等价打乱)
 *   进度         stdout 打 `[PROG] ...`(ps1 会把这类行滤掉)
 *   失败         非 0 退出码
 *
 * 并行:worker 池,线程数 = min(14, cpu-2)(全局规则:重计算 ≤14 线程),可用 env `CLOCK_THREADS`
 * 或 `RAYON_NUM_THREADS`(ps1 已设 14)覆盖。worker 起不来(tsx loader 没传进 worker 等)就**退回
 * 单进程**,只是慢,不会把整条管道弄挂。
 *
 * 运行(一般由 ps1 调,手跑长这样):
 *   echo D:\cube\scramble\puzzle\clock\chunk_clock.txt | pnpm exec tsx src/clock_analyzer.mts
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

/** 只用到这两个导出,结构式声明即可(客户端包不在本包 rootDir 内,不做静态 import)。 */
interface ClockMod {
  clockStateFromAlg(alg: string): { posit: number[]; rightSideUp: boolean };
  solveClock(state: { posit: number[]; rightSideUp: boolean }): { length: number; notation: string };
}

/**
 * 跨包加载客户端求解器。与 `build_puzzle_sampled_dist` 同一套 default-interop:client 的 .ts 在
 * 没有 `"type":"module"` 的包里,tsx 按 CJS 加载 → 具名 import 不绑定,必须整体取再拿属性。
 * 路径经变量传入,避免 TS 把它当本包源文件(rootDir 之外)。
 */
const CLOCK_SOLVER_REL = '../../client/lib/clock-solver';
async function loadClock(): Promise<ClockMod> {
  const m = (await import(CLOCK_SOLVER_REL)) as { default?: ClockMod } & ClockMod;
  return (m.default && typeof m.default === 'object' ? m.default : m) as ClockMod;
}

const EMIT_SOLN = process.env.PUZZLE_EMIT_SOLN === '1';

/** 一条打乱 → CSV 行的后半段(步数 [+ 一条最优解])。 */
function solveRow(clock: ClockMod, scramble: string): string {
  const sol = clock.solveClock(clock.clockStateFromAlg(scramble));
  return EMIT_SOLN ? `${sol.length},${sol.notation}` : String(sol.length);
}

// ─── worker 侧 ───────────────────────────────────────────────────────────────

if (!isMainThread) {
  const rows = workerData as { i: number; scramble: string }[];
  void (async () => {
    const clock = await loadClock();
    const out = rows.map((r) => ({ i: r.i, v: solveRow(clock, r.scramble) }));
    parentPort!.postMessage(out);
  })().catch((e) => {
    parentPort!.postMessage({ error: String((e as Error)?.stack ?? e) });
  });
}

// ─── 主进程 ──────────────────────────────────────────────────────────────────

function threadCount(): number {
  const env = Number(process.env.CLOCK_THREADS || process.env.RAYON_NUM_THREADS || 0);
  const want = env > 0 ? env : Math.max(1, os.cpus().length - 2);
  return Math.max(1, Math.min(14, want)); // 全局规则:本机重计算 ≤14 线程
}

/** worker 池:把行切成 T 份,每份一个 worker。失败(loader 没进 worker 等)返回 null → 调用方退回单进程。 */
function runPool(
  rows: { i: number; scramble: string }[],
  threads: number,
): Promise<string[] | null> {
  const self = fileURLToPath(import.meta.url);
  const out = new Array<string>(rows.length);
  const chunks: { i: number; scramble: string }[][] = Array.from({ length: threads }, () => []);
  rows.forEach((r, k) => chunks[k % threads].push(r)); // 轮转分片(难度不均匀,轮转比切段更平)
  return new Promise((resolve) => {
    let live = 0, failed = false, done = 0;
    const finish = () => { if (--live === 0) resolve(failed ? null : out); };
    for (const part of chunks) {
      if (part.length === 0) continue;
      live++;
      let w: Worker;
      try {
        w = new Worker(self, { workerData: part, execArgv: process.execArgv });
      } catch {
        failed = true; finish(); continue;
      }
      w.on('message', (msg: { error?: string } | { i: number; v: string }[]) => {
        if (Array.isArray(msg)) {
          for (const r of msg) out[r.i] = r.v;
          done += msg.length;
          console.log(`[PROG] ${done}/${rows.length}`);
        } else { failed = true; }
      });
      w.on('error', () => { failed = true; });
      w.on('exit', finish);
    }
    if (live === 0) resolve(out); // 空块
  });
}

async function runSingle(rows: { i: number; scramble: string }[]): Promise<string[]> {
  const clock = await loadClock();
  const out = new Array<string>(rows.length);
  for (let k = 0; k < rows.length; k++) {
    out[rows[k].i] = solveRow(clock, rows[k].scramble);
    if ((k + 1) % 2000 === 0) console.log(`[PROG] ${k + 1}/${rows.length}`);
  }
  return out;
}

async function processBlock(blockPath: string, threads: number): Promise<void> {
  const ids: string[] = [];
  const rows: { i: number; scramble: string }[] = [];
  for (const line of fs.readFileSync(blockPath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const c = line.indexOf(',');
    if (c <= 0) throw new Error(`bad block line (want "id,scramble"): ${line}`);
    rows.push({ i: ids.length, scramble: line.slice(c + 1).trim() });
    ids.push(line.slice(0, c));
  }
  const t0 = Date.now();
  const values = (threads > 1 ? await runPool(rows, threads) : null) ?? await runSingle(rows);
  const header = EMIT_SOLN ? 'id,clock,soln' : 'id,clock';
  const outPath = path.join(
    path.dirname(blockPath),
    `${path.basename(blockPath, path.extname(blockPath))}_clock.csv`,
  );
  fs.writeFileSync(outPath, `${header}\n${ids.map((id, i) => `${id},${values[i]}`).join('\n')}\n`);
  const ms = Date.now() - t0;
  console.log(`[PROG] ${rows.length} 条 / ${(ms / 1000).toFixed(1)}s `
    + `(${(rows.length / (ms / 1000)).toFixed(0)} 条/秒) -> ${outPath}`);
}

if (isMainThread) {
  const threads = threadCount();
  console.log(`[PROG] clock_analyzer: ${threads} 线程,soln 列 ${EMIT_SOLN ? '开' : '关'}`);
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  void (async () => {
    for await (const line of rl) {
      const p = line.trim();
      if (p) await processBlock(p, threads);
    }
  })().catch((e) => {
    console.error(`clock_analyzer 失败: ${(e as Error)?.stack ?? e}`);
    process.exit(1);
  });
}
