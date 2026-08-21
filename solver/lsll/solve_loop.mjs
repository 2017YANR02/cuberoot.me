// solve.mjs 的自动重启外壳 —— 全量入口就是它:`node solve_loop.mjs`。
//
// cubeopt 的 in-proc 求解跑上几千条后会抛 emscripten `unwind`(长生命周期进程里 pthread /
// main-thread-proxying 的资源累积)。solve.mjs 将这个已知信号转成安静退出;每条即落盘、
// 重启按 key 跳过已完成,所以回收零损失,这里只管重新拉起来接着跑。
//
// 失安全:连续 3 轮**零进展**(下一条确定性崩溃 / 表载不进去)就 exit 2 停下来报警,
// 不静默跳数据、也不无限重启。正常的资源型崩溃总是有进展,只会触发一次重启。
//
// 屏幕:第 1 轮之外全部 QUIET —— 子进程不打横幅、不打汇总,进度那一行原地覆盖,
// 本文件的轮次行同样原地覆盖。所以 5 天的活从头到尾**只占一行**(重定向进日志时才落行)。
// Ctrl-C 随时可停:每个 case 一算完就落盘,重跑同一条命令按 key 续上。
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// OUT 也认 env —— 多分片并行时每个分片写自己那份(run_lsll.ps1),否则几个进程抢同一个文件
const OUT = resolve(process.env.OUT || resolve(__dirname, 'out.csv'));
// 相对路径按**脚本所在目录**算,不按 cwd —— 从别处调时 CORPUS=corpus_rest.txt 才不会指空
const CORPUS = resolve(__dirname, process.env.CORPUS || 'corpus.txt');
if (!existsSync(CORPUS)) {
  console.error(`语料不存在:${CORPUS}`);
  console.error('先生成:cd core && NODE_OPTIONS=--no-experimental-strip-types pnpm --filter @cuberoot/client exec tsx scripts/lsll-corpus.mts');
  process.exit(2);
}
const corpusKeys = new Set(
  readFileSync(CORPUS, 'utf8').split('\n').filter((l) => l.includes(',')).map((l) => l.slice(0, l.indexOf(','))),
);
const TOTAL = corpusKeys.size;
const THREADS = String(process.env.THREADS || '12');
// 只数**属于本语料**的行。数总行数会在旁边留着旧口径 out.csv 时误判「全部完成」,
// 把没算的静默丢掉。
const lines = () => (existsSync(OUT)
  ? readFileSync(OUT, 'utf8').split('\n').filter(Boolean)
    .filter((l) => corpusKeys.has(l.slice(0, l.indexOf(',')))).length
  : 0);

const tty = process.stdout.isTTY;
/** TTY 下原地覆盖(与子进程的进度共用同一行);重定向进日志时才落一行。 */
const status = (m) => {
  if (tty) process.stdout.write(`\r${m.padEnd(110)}`);
  else console.log(m);
};
/** 必须留痕的(完成 / 卡死):TTY 下先把当前那行收掉再打。 */
const permanent = (m) => {
  if (tty) process.stdout.write(`\r${''.padEnd(110)}\r`);
  console.log(m);
};

let stuck = 0, run = 0;
const t0 = Date.now();
for (;;) {
  const before = lines();
  if (before >= TOTAL) { permanent(`[loop] 全部完成:${before}/${TOTAL}`); break; }
  run++;
  status(`[loop] 第 ${run} 轮 · ${before}/${TOTAL} case · 载表中…`);
  // 第 1 轮打横幅(表 / 线程 / 待解数,开跑前想看一眼),之后全部 QUIET —— 崩溃重启几百次
  // 也不会刷屏,进度始终是原地覆盖的那一行。
  const r = spawnSync(process.execPath, ['solve.mjs', THREADS], {
    cwd: __dirname,
    stdio: 'inherit',
    env: run === 1 ? process.env : { ...process.env, QUIET: '1' },
  });
  const after = lines();
  const tail = `${after}/${TOTAL} (+${after - before}) · 累计 ${((Date.now() - t0) / 3600000).toFixed(2)}h`;
  if (after >= TOTAL) { permanent(`[loop] 全部完成 · ${tail}`); break; }
  if (r.status === 0) { permanent(`[loop] solve.mjs 正常退出但未到全量 —— 视为完成 · ${tail}`); break; }
  if (after > before) { stuck = 0; status(`[loop] 第 ${run} 轮 code=${r.status ?? 'null'} · ${tail} · 重启`); continue; }
  if (++stuck >= 3) {
    permanent(`[loop] 卡死:连续 3 轮零进展,停在 ${after}/${TOTAL} —— 需要人看一眼`);
    process.exit(2);
  }
  status(`[loop] 无进展 (${stuck}/3),重试 · ${tail}`);
}
