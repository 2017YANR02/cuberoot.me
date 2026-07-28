// solve.mjs 的自动重启外壳 —— 全量入口就是它:`node solve_loop.mjs`。
//
// cubeopt 的 in-proc 求解跑上几千条后会抛 emscripten `unwind`(长生命周期进程里 pthread /
// main-thread-proxying 的资源累积),进程直接死。solve.mjs 每条即落盘、重启按 key 跳过已完成,
// 所以崩溃零损失,这里只管重新拉起来接着跑。
//
// 失安全:连续 3 轮**零进展**(下一条确定性崩溃 / 表载不进去)就 exit 2 停下来报警,
// 不静默跳数据、也不无限重启。正常的资源型崩溃总是有进展,只会触发一次重启。
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, 'out.csv');
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
// out.csv 由两批语料共用(corpus.txt + corpus_rest.txt),所以只数**本批**的行。
// 数总行数会在第二批跑到 43 万总行时误判「全部完成」,把后面十几万条静默丢掉。
const lines = () => (existsSync(OUT)
  ? readFileSync(OUT, 'utf8').split('\n').filter(Boolean)
    .filter((l) => corpusKeys.has(l.slice(0, l.indexOf(',')))).length
  : 0);

let stuck = 0, run = 0;
const t0 = Date.now();
for (;;) {
  const before = lines();
  if (before >= TOTAL) { console.log(`[loop] 全部完成:${before}/${TOTAL}`); break; }
  run++;
  console.log(`[loop] 第 ${run} 轮 · ${before}/${TOTAL} 已完成 · 启动 solve.mjs ${THREADS}`);
  const r = spawnSync(process.execPath, ['solve.mjs', THREADS], { cwd: __dirname, stdio: 'inherit' });
  const after = lines();
  console.log(`[loop] 第 ${run} 轮退出 code=${r.status ?? 'null'} · ${after}/${TOTAL} (+${after - before}) · 累计 ${((Date.now() - t0) / 3600000).toFixed(2)}h`);
  if (after >= TOTAL) { console.log('[loop] 全部完成'); break; }
  if (r.status === 0) { console.log('[loop] solve.mjs 正常退出但未到全量 —— 视为完成'); break; }
  if (after > before) { stuck = 0; continue; }
  if (++stuck >= 3) {
    console.log(`[loop] 卡死:连续 3 轮零进展,停在 ${after}/${TOTAL} —— 需要人看一眼`);
    process.exit(2);
  }
  console.log(`[loop] 无进展 (${stuck}/3),重试`);
}
