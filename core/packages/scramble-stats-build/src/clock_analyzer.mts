/*
 * clock_analyzer —— 魔表真题语料的整解最优步数 analyzer(喂 build_puzzle_dist 的 clock/clock.csv)。
 *
 * 为什么是 TS 而不是 Rust:魔表的最优求解器本来就是纯 TS(`@cuberoot/puzzle-solvers/clock`,零下载表、
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
 *   pnpm --filter @cuberoot/puzzle-solvers build
 *   echo D:\cube\scramble\puzzle\clock\chunk_clock.txt | pnpm exec tsx src/clock_analyzer.mts
 */
import { clockStateFromAlg, solveClock } from '@cuberoot/puzzle-solvers/clock';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

interface ClockWorkerPayload {
  rows: { i: number; scramble: string }[];
  emitSolution: boolean;
}

export interface ClockAnalyzerOptions {
  threads?: number;
  emitSolution?: boolean;
}

export interface ClockAnalyzerResult {
  mode: 'single' | 'worker';
  outPath: string;
}

/** 一条打乱 → CSV 行的后半段(步数 [+ 一条最优解])。 */
function solveRow(scramble: string, emitSolution: boolean): string {
  const sol = solveClock(clockStateFromAlg(scramble));
  return emitSolution ? `${sol.length},${sol.notation}` : String(sol.length);
}

// ─── worker 侧 ───────────────────────────────────────────────────────────────

if (!isMainThread) {
  const { rows, emitSolution } = workerData as ClockWorkerPayload;
  void (async () => {
    const out = rows.map((r) => ({ i: r.i, v: solveRow(r.scramble, emitSolution) }));
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
  emitSolution: boolean,
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
        w = new Worker(self, {
          workerData: { rows: part, emitSolution } satisfies ClockWorkerPayload,
          execArgv: process.execArgv,
        });
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

async function runSingle(
  rows: { i: number; scramble: string }[],
  emitSolution: boolean,
): Promise<string[]> {
  const out = new Array<string>(rows.length);
  for (let k = 0; k < rows.length; k++) {
    out[rows[k].i] = solveRow(rows[k].scramble, emitSolution);
    if ((k + 1) % 2000 === 0) console.log(`[PROG] ${k + 1}/${rows.length}`);
  }
  return out;
}

export async function processClockBlock(
  blockPath: string,
  options: ClockAnalyzerOptions = {},
): Promise<ClockAnalyzerResult> {
  const threads = Math.max(1, Math.min(14, options.threads ?? threadCount()));
  const emitSolution = options.emitSolution ?? process.env.PUZZLE_EMIT_SOLN === '1';
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
  const pooled = threads > 1 ? await runPool(rows, threads, emitSolution) : null;
  const mode = pooled ? 'worker' : 'single';
  const values = pooled ?? await runSingle(rows, emitSolution);
  const header = emitSolution ? 'id,clock,soln' : 'id,clock';
  const outPath = path.join(
    path.dirname(blockPath),
    `${path.basename(blockPath, path.extname(blockPath))}_clock.csv`,
  );
  fs.writeFileSync(outPath, `${header}\n${ids.map((id, i) => `${id},${values[i]}`).join('\n')}\n`);
  const ms = Date.now() - t0;
  console.log(`[PROG] ${rows.length} 条 / ${(ms / 1000).toFixed(1)}s `
    + `(${(rows.length / (ms / 1000)).toFixed(0)} 条/秒) -> ${outPath}`);
  return { mode, outPath };
}

function isCliEntry(): boolean {
  return Boolean(process.argv[1])
    && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
}

export async function runClockAnalyzerCli(): Promise<void> {
  const threads = threadCount();
  const emitSolution = process.env.PUZZLE_EMIT_SOLN === '1';
  console.log(`[PROG] clock_analyzer: ${threads} 线程,soln 列 ${emitSolution ? '开' : '关'}`);
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of rl) {
    const p = line.trim();
    if (p) await processClockBlock(p, { emitSolution, threads });
  }
}

if (isMainThread && isCliEntry()) {
  void runClockAnalyzerCli().catch((e) => {
    console.error(`clock_analyzer 失败: ${(e as Error)?.stack ?? e}`);
    process.exit(1);
  });
}
