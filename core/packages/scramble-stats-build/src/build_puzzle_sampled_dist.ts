// TIER C/D 非 WCA puzzle 解步数分布 —— **离线采样预计算**(从零自包含,不碰 WCA 真题管道)。
//
// 铁律(solver/NONWCA_PUZZLE_LOOP.md §0.0 + §0.6):TIER C/D 的状态空间巨大、无法整图枚举,分布只能
// **采样**。但采样必须在这里(build 脚本)**离线算一次**,落静态 `stats/scramble/dist_<event>.json`,
// 页面只 `statsUrl()` fetch + 渲染 —— **严禁浏览器进页现场求解采样**(开 分布 tab 不准解任何打乱)。
//
// 这是 build_puzzle_dist.ts(CSV 聚合,222/pyraminx/skewb/sq1 真题管道)之外的**另一条线**:这些 puzzle
// 没有 Rust analyzer / 真题语料,求解器是 packages/client/lib/<puzzle>-solver.ts 的纯 TS 实现。本脚本直接
// import 该求解器,用它**自带的 cstimer 同款随机打乱生成器**采 N 条、逐条求解、把返回解步数分桶。
//
// 复用性:加新 C/D 单元 = 在 REGISTRY 加一行(event / solver 路径 / 导出名 / 打乱长度 / 默认 N / 质量桶)。
// 之后退役各 DistView 的现场采样、改成 fetch dist_<event>.json,是机械活。
//
// 单进程、低内存(只攒一个直方图 Map + 一小撮样本)。重活由 ps1 包装设 BelowNormal 优先级 + 让出 CPU。
//
// 运行:
//   pnpm --filter @cuberoot/scramble-stats-build build:puzzle-sampled-dist 335            # 默认 N
//   pnpm --filter @cuberoot/scramble-stats-build build:puzzle-sampled-dist 335 3000       # 指定 N
//   DIST_N=3000 pnpm exec tsx src/build_puzzle_sampled_dist.ts 335                        # 或经 env
//
// 数据契约(stats/scramble/dist_<event>.json):
//   {
//     event, sampleCount, scrambleLen, quality: "sampled-near-optimal" | "sampled-optimal" | ...,
//     histogram: { "<length>": <count>, ... },   // sum(values) === sampleCount
//     mean, median, max, min, maxBound,           // maxBound = 求解器的硬上界常量(若有)
//     optimalCount?, stateCountStr?,              // 可证最优条数 / 预格式化状态数字符串
//     generatedSamples: [ { length, scramble, optimal }, ... ],  // 给 CSV 下载的小样本(每桶 ≤ 之)
//     generated_at
//   }
// 前端 DistView 直接 fetch 本文件,用 histogram 渲染 DiscreteHistogram、用 generatedSamples 做 CSV 下载。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ── 求解器适配器 ────────────────────────────────────────────────────────────────────
// 每个 puzzle 的求解器是纯 TS、按事件名各异,故用一层 adapter 抹平导出名差异。
// scramble(rnd) → cstimer 同款随机刚体打乱;solve(scramble) → { length, optimal }。
interface SolverAdapter {
  /** 生成一条 `len` 步 cstimer 同款随机刚体打乱(用注入的 rnd 复现)。 */
  scramble: (len: number, rnd: () => number) => string;
  solve: (scramble: string) => { length: number; optimal: boolean };
  /** 求解器导出的硬上界常量(可选,写进 maxBound)。 */
  maxBound?: number;
  /** 预格式化的可达状态数字符串(可选;> 2^53 必为字符串,见 §0.0 #4)。 */
  stateCountStr?: string;
}

interface PuzzleDistSpec {
  /** /scramble dispatch 的 event key(= 输出文件名 dist_<event>.json)。 */
  event: string;
  label: string;
  /** 该 puzzle 的随机刚体打乱长度(cstimer 同款,逼近近均匀随机态)。 */
  scrambleLen: number;
  /** 默认样本数(每条求解耗时差异大 → 各 puzzle 自定,跑几分钟为度)。 */
  defaultN: number;
  /** 诚实质量桶(§0.0 #3):sampled-near-optimal / sampled-optimal / sampled-bounded。 */
  quality: 'sampled-near-optimal' | 'sampled-optimal' | 'sampled-bounded';
  /** 动态加载该 puzzle 的求解器并返回 adapter。 */
  load: () => Promise<SolverAdapter>;
}

// 注:client 求解器 .ts 在无 "type":"module" 的包里,tsx 当 CJS 加载 → 命名 import 不绑定。
// 必须 default-import 整个模块再取属性(下方 mod() 封装)。
async function mod(rel: string): Promise<Record<string, unknown>> {
  const m = (await import(rel)) as { default?: Record<string, unknown> } & Record<string, unknown>;
  // ESM 正常包走 m.*;CJS-wrapped 走 m.default.*。
  const inner = (m.default && typeof m.default === 'object') ? m.default : m;
  return inner as Record<string, unknown>;
}

// 新 C/D 单元:加一行。solver 路径相对本文件(src/),逐字段照各 DistView 现场采样口径。
const REGISTRY: PuzzleDistSpec[] = [
  {
    event: '335',
    label: '3x3x5',
    scrambleLen: 40,          // = Cuboid335DistView SCRAMBLE_LEN
    defaultN: 2000,           // ~217ms/solve 单进程 → ~7min(N 越大尾部越平滑,几分钟为度)
    quality: 'sampled-near-optimal',
    load: async () => {
      const m = await mod('../../client/lib/cuboid335-solver');
      return {
        scramble: m.randomCuboid335Scramble as SolverAdapter['scramble'],
        solve: m.solveCuboid335 as SolverAdapter['solve'],
        maxBound: m.CUBOID335_MAX_LENGTH as number,
        stateCountStr: m.CUBOID335_STATE_COUNT_STR as string,
      };
    },
  },
  {
    event: '337',
    label: '3x3x7',
    scrambleLen: 40,          // = Cuboid337DistView SCRAMBLE_LEN(原现场采样口径)
    // 337 比 335 重(实测 mean ~0.55s/solve、MAX ~4.4s 长尾)→ N 取 700,单进程 ~6-7min;
    // 尾部足够平滑,又不被慢态拖到太久。
    defaultN: 700,
    quality: 'sampled-near-optimal',
    load: async () => {
      const m = await mod('../../client/lib/cuboid337-solver');
      return {
        scramble: m.randomCuboid337Scramble as SolverAdapter['scramble'],
        solve: m.solveCuboid337 as SolverAdapter['solve'],
        maxBound: m.CUBOID337_MAX_LENGTH as number,
        stateCountStr: m.CUBOID337_STATE_COUNT_STR as string,
      };
    },
  },
];

// ── 简易确定性 PRNG(mulberry32),让重跑可复现(与测试同款) ───────────────────────────
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SAMPLES_PER_BUCKET = 12; // CSV 下载样本:每个步数桶最多留几条(够示例,文件不臃肿)

async function buildOne(spec: PuzzleDistSpec, n: number): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, '..', '..', '..', '..'); // src → pkg → packages → core → repo
  const outDir = path.join(repoRoot, 'stats', 'scramble');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `dist_${spec.event}.json`);

  console.log(`[${spec.event}] loading solver…`);
  const adapter = await spec.load();

  console.log(`[${spec.event}] sampling N=${n} (scrambleLen=${spec.scrambleLen}, quality=${spec.quality})…`);
  const rnd = mulberry32(0x5a3 ^ (spec.event.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)));
  const counts = new Map<number, number>();
  const bucketSamples = new Map<number, { length: number; scramble: string; optimal: boolean }[]>();
  let sum = 0, mn = Infinity, mx = 0, optN = 0;
  const lengthsSorted: number[] = []; // 收集所有长度求中位数(N ≤ 数万,放内存可接受)

  const t0 = Date.now();
  let done = 0;
  for (let i = 0; i < n; i++) {
    let scramble = '';
    try {
      scramble = adapter.scramble(spec.scrambleLen, rnd);
      const { length, optimal } = adapter.solve(scramble);
      counts.set(length, (counts.get(length) ?? 0) + 1);
      sum += length;
      if (length < mn) mn = length;
      if (length > mx) mx = length;
      if (optimal) optN++;
      lengthsSorted.push(length);
      const arr = bucketSamples.get(length) ?? [];
      if (arr.length < SAMPLES_PER_BUCKET) { arr.push({ length, scramble, optimal }); bucketSamples.set(length, arr); }
      done++;
    } catch (e) {
      console.warn(`[${spec.event}] sample ${i} threw (skipped): ${String(e)} on "${scramble}"`);
    }
    if ((i + 1) % 250 === 0) {
      const ms = Date.now() - t0;
      console.log(`  ${i + 1}/${n}  (${(ms / (i + 1)).toFixed(0)} ms/solve, ~${((ms / (i + 1) * (n - i - 1)) / 1000).toFixed(0)}s left)`);
    }
  }

  if (done === 0) { throw new Error(`[${spec.event}] no successful samples`); }
  lengthsSorted.sort((a, b) => a - b);
  const median = lengthsSorted[Math.floor(lengthsSorted.length / 2)];

  // histogram 升序键;sum(values) 必 === sampleCount。
  const histogram: Record<string, number> = {};
  for (const k of [...counts.keys()].sort((a, b) => a - b)) histogram[String(k)] = counts.get(k)!;
  // CSV 样本:按桶升序拍平。
  const generatedSamples: { length: number; scramble: string; optimal: boolean }[] = [];
  for (const k of [...bucketSamples.keys()].sort((a, b) => a - b)) generatedSamples.push(...bucketSamples.get(k)!);

  const generatedAt = process.env.SCRAMBLE_STATS_STAMP || new Date().toISOString();
  const out: Record<string, unknown> = {
    event: spec.event,
    label: spec.label,
    sampleCount: done,
    scrambleLen: spec.scrambleLen,
    quality: spec.quality,
    histogram,
    mean: sum / done,
    median,
    min: mn,
    max: mx,
    optimalCount: optN,
    generatedSamples,
    generated_at: generatedAt,
  };
  if (adapter.maxBound !== undefined) out.maxBound = adapter.maxBound;
  if (adapter.stateCountStr) out.stateCountStr = adapter.stateCountStr;

  fs.writeFileSync(outPath, JSON.stringify(out));
  const ms = Date.now() - t0;
  console.log(`[${spec.event}] wrote ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB) — ` +
    `${done} samples in ${(ms / 1000).toFixed(0)}s, mean ${(sum / done).toFixed(2)}, median ${median}, ` +
    `range ${mn}..${mx}, optimal ${((100 * optN) / done).toFixed(1)}%`);
}

async function main(): Promise<void> {
  // argv 位置参数(按顺序,event id 本身可为纯数字如 335 故不靠正则区分):
  //   第 1 个 = event(缺省 = 全部已注册);第 2 个 = N(缺省 = 各自 defaultN 或 DIST_N env)。
  // 也支持 --n=<N> 显式覆盖。
  const args = process.argv.slice(2);
  const flagN = args.find((a) => /^--n=\d+$/.test(a));
  const positional = args.filter((a) => !a.startsWith('--'));
  const eventArg = positional[0];
  const nArg = flagN ? flagN.split('=')[1] : positional[1];
  const envN = process.env.DIST_N ? Number(process.env.DIST_N) : undefined;

  const specs = eventArg ? REGISTRY.filter((s) => s.event === eventArg) : REGISTRY;
  if (specs.length === 0) {
    throw new Error(`unknown event '${eventArg}'. registered: ${REGISTRY.map((s) => s.event).join(', ')}`);
  }
  for (const spec of specs) {
    const n = nArg ? Number(nArg) : (envN ?? spec.defaultN);
    if (!Number.isFinite(n) || n <= 0) throw new Error(`bad N: ${n}`);
    await buildOne(spec, n);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
