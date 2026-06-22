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
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

// ── 求解器适配器 ────────────────────────────────────────────────────────────────────
// 每个 puzzle 的求解器是纯 TS、按事件名各异,故用一层 adapter 抹平导出名差异。
// 两条路:
//   (A) 纯 TS 刚体打乱 + 纯 TS 求解(335/337/334/233)——给 scramble(len,rnd) + solve(scramble),可确定性复现。
//   (B) 不吃刚体打乱字符串(15 数码采随机格)或求解器是 cstimer worker 引擎(只能在 Node 里走 node:vm 沙箱跑 cstimer
//       原生 JS,无法 import client lib 因其拉 `new Worker`)——给 sampleOne(rnd) 自取一条样本。
// 一个 spec 二选一:有 sampleOne 走 (B);否则走 (A) 的 scramble+solve。两路 solve 返回都可为 Promise(crz3a kociemba 异步)。
type SampleResult = { length: number; optimal: boolean; scramble: string };
interface SolverAdapter {
  /** (A) 生成一条 `len` 步 cstimer 同款随机刚体打乱(用注入的 rnd 复现)。 */
  scramble?: (len: number, rnd: () => number) => string;
  /** (A) 求解一条打乱字符串 → { length, optimal }(可为 Promise)。 */
  solve?: (scramble: string) => { length: number; optimal: boolean } | Promise<{ length: number; optimal: boolean }>;
  /** (B) 自取一条样本(随机格 / cstimer 引擎自生成 + 自求解)。给了它就忽略 scramble/solve。 */
  sampleOne?: (rnd: () => number) => SampleResult | Promise<SampleResult>;
  /** 求解器导出的硬上界常量(可选,写进 maxBound)。 */
  maxBound?: number;
  /** 预格式化的可达状态数字符串(可选;> 2^53 必为字符串,见 §0.0 #4)。 */
  stateCountStr?: string;
  /** 预格式化的 facelet 群阶字符串(可选;334 等用)。 */
  groupOrderStr?: string;
}

// ── cstimer 原生引擎 node:vm 沙箱(与各 *_solver.test.ts 同款) ─────────────────────────────
// 浏览器端 lib/cstimer-scramble 走 `new Worker('/tools/...')`,Node 里跑不了。但 cstimer 的 scramble
// 核心是纯 JS,可在 node:vm 沙箱里加载 → 直接拿 scrMgr(生成器)+ 各 puzzle 引擎(mpyr/redi 自带求解器)。
// 这正是 mpyr_solver.test.ts / dino_solver.test.ts / crz3a_solver.test.ts 用的方式。
let CSTIMER_SANDBOX: Record<string, unknown> | null | undefined;
function cstimerSandbox(): Record<string, unknown> | null {
  if (CSTIMER_SANDBOX !== undefined) return CSTIMER_SANDBOX;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, '..', '..', '..', '..');
  const candidates = [
    path.join(repoRoot, 'tools', 'cstimer-scramble'),
    'D:/cube/cuberoot.me/tools/cstimer-scramble',
  ];
  let root: string | null = null;
  for (const c of candidates) {
    try { if (fs.existsSync(path.join(c, 'scramble', 'megascramble.js'))) { root = c; break; } } catch { /* ignore */ }
  }
  if (!root) { CSTIMER_SANDBOX = null; return null; }
  try {
    const sandbox: Record<string, unknown> = Object.create(null);
    sandbox.self = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.global = sandbox;
    sandbox.console = console;
    sandbox.setTimeout = setTimeout;
    sandbox.clearTimeout = clearTimeout;
    sandbox.kernel = { getProp: () => '', setProp() {}, regProp() {}, regListener() {}, pushSignal() {} };
    sandbox.DEBUG = false;
    sandbox.importScripts = () => {};
    sandbox.process = process;
    sandbox.require = require;
    const ctx = vm.createContext(sandbox);
    const files = [
      'lib/utillib.js', 'lib/isaac.js', 'lib/mathlib.js',
      'scramble/scramble.js', 'scramble/megascramble.js',
      'scramble/pyraminx.js', 'scramble/redi.js', 'scramble/slide.js',
    ];
    for (const f of files) {
      const code = fs.readFileSync(path.join(root, f), 'utf8');
      vm.runInContext(code, ctx, { filename: f });
    }
    CSTIMER_SANDBOX = sandbox;
    return sandbox;
  } catch (e) {
    console.warn('[cstimer-vm] sandbox load failed:', e);
    CSTIMER_SANDBOX = null;
    return null;
  }
}

/** Generate one cstimer scramble string for `key` (e.g. 'mpyrso', 'dinoso', 'crz3a'). Retries while empty. */
function cstimerGen(scrMgr: { scramblers?: Record<string, (k: string, n?: number) => unknown>; toTxt?: (s: string) => string }, key: string, len?: number): string | null {
  const fn = scrMgr.scramblers && scrMgr.scramblers[key];
  if (!fn) return null;
  let out: unknown;
  for (let k = 0; k < 50000 && (out === undefined || out === null); k++) out = len !== undefined ? fn(key, len) : fn(key);
  if (out == null) return null;
  const txt = scrMgr.toTxt ? scrMgr.toTxt(String(out)) : String(out);
  const s = String(txt).trim();
  return s.length > 0 ? s : null;
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
    event: '336',
    label: '3x3x6',
    scrambleLen: 50,          // = Cuboid336DistView SCRAMBLE_LEN(cstimer 336 generator length=50,纯 mega 无 /333)
    defaultN: 2000,           // 抄 335 的 N;336 两阶段每条数十~数百 ms,单进程跑几分钟为度(慢则用 -SampledN 调小)
    quality: 'sampled-near-optimal',
    load: async () => {
      const m = await mod('../../client/lib/cuboid336-solver');
      return {
        scramble: m.randomCuboid336Scramble as SolverAdapter['scramble'],
        solve: m.solveCuboid336 as SolverAdapter['solve'],
        maxBound: m.CUBOID336_MAX_LENGTH as number,
        stateCountStr: m.CUBOID336_STATE_COUNT_STR as string,
        groupOrderStr: m.CUBOID336_GROUP_ORDER_STR as string,
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
  {
    event: '233',
    label: '2x3x3 Domino',
    scrambleLen: 25,          // cstimer 233 generator length(CSTIMER_EVENTS 233 length=25)
    defaultN: 2000,           // solveCuboid233 毫秒级,2000 条单进程几十秒
    quality: 'sampled-optimal',
    load: async () => {
      const m = await mod('../../client/lib/cuboid233-solver');
      const solveCuboid233 = m.solveCuboid233 as (s: string) => { length: number };
      return {
        // randomCuboid233Scramble 忠实镜像 cstimer mega 的 233 生成器(同 7 token 字母表+无重复规则)。
        scramble: m.randomCuboid233Scramble as SolverAdapter['scramble'],
        // solveCuboid233 是 IDA* 可证最优(但其返回值无 optimal 字段)→ 恒标 optimal:true。
        solve: (s: string) => ({ length: solveCuboid233(s).length, optimal: true }),
        stateCountStr: m.CUBOID233_STATE_COUNT_STR as string,
      };
    },
  },
  {
    event: '334',
    label: '3x3x4',
    scrambleLen: 40,          // = Cuboid334DistView SCRAMBLE_LEN
    defaultN: 300,            // 实测含 warmup/方差约 ~1.5-1.6s/solve(两阶段)→ 300 条单进程 ~6-7min(N=400 超 500s)
    quality: 'sampled-near-optimal',
    load: async () => {
      const m = await mod('../../client/lib/cuboid334-solver');
      return {
        scramble: m.randomCuboid334Scramble as SolverAdapter['scramble'],
        solve: m.solveCuboid334 as SolverAdapter['solve'],
        maxBound: m.CUBOID334_MAX_LENGTH as number,
        stateCountStr: m.CUBOID334_STATE_COUNT_STR as string,
        groupOrderStr: m.CUBOID334_GROUP_ORDER_STR as string,
      };
    },
  },
  {
    event: 'sq2',
    label: 'Square-2',
    scrambleLen: 10,          // cstimer sq2 generator length (CSTIMER_EVENTS sq2 length=10 tuples)
    defaultN: 2000,           // solveSq2 (reduction) is ms-level → 2000 单进程几十秒
    // 构造式 3-循环约简:有效 + 有界(实测 20000 样本 mean≈70、max 95、bound 130),非近最优(§0.0 #3 诚实记)。
    quality: 'sampled-bounded',
    load: async () => {
      const m = await mod('../../client/lib/sq2-solver');
      const solveSq2 = m.solveSq2 as (s: string) => { length: number; optimal?: boolean };
      return {
        // randomSq2Scramble 忠实镜像 cstimer 的 (u,d)/ 元组生成器(u,d∈[-5,6],不同时为 0)。
        scramble: m.randomSq2Scramble as SolverAdapter['scramble'],
        // 约简法有效+有界(非可证最优)→ optimal 取求解器返回值(一般 false)。
        solve: (s: string) => { const o = solveSq2(s); return { length: o.length, optimal: o.optimal ?? false }; },
        maxBound: m.SQ2_MAX_LENGTH as number,
        stateCountStr: m.SQ2_STATE_COUNT_STR as string,
      };
    },
  },
  {
    event: 'ssq1',
    label: 'Super Square-1',
    scrambleLen: 10,          // cstimer ssq1t generator length (CSTIMER_EVENTS ssq1 length=10 tuples)
    defaultN: 2000,           // 两阶段约简:表懒建一次(~15-20s)后每条求解毫秒级 → 2000 单进程不到 1min
    // 两阶段形状+排列约简(解实际状态,非打乱路径):有效 + 有界(实测 2000 样本 mean≈28、max≈41、bound 60),
    // 长度随打乱难度变化(真分布,非单柱),非最优(§0.0 #3 诚实记)。
    quality: 'sampled-bounded',
    load: async () => {
      const m = await mod('../../client/lib/ssq1-solver');
      const solveSsq1 = m.solveSsq1 as (s: string) => { length: number; optimal?: boolean };
      return {
        // randomSsq1Scramble 忠实镜像 cstimer 的 ssq1t (a,b,c,d)/ 生成器(两个独立 sq1_getseq 织成 4 元组)。
        scramble: m.randomSsq1Scramble as SolverAdapter['scramble'],
        // 约简有效+有界(非最优)→ optimal 取求解器返回值(一般 false)。
        solve: (s: string) => { const o = solveSsq1(s); return { length: o.length, optimal: o.optimal ?? false }; },
        maxBound: m.SSQ1_MAX_LENGTH as number,
        stateCountStr: m.SSQ1_STATE_COUNT_STR as string,
      };
    },
  },
  {
    event: 'bsq',
    label: 'Bandaged Square-1',
    scrambleLen: 10,          // cstimer bsq generator length (CSTIMER_EVENTS bsq length=10 = #slices)
    defaultN: 2000,           // 三阶段约简:小表懒建一次(~tens ms)后每条求解毫秒级 → 2000 单进程秒级
    // 受限 </,(1,0)> 移动集(顶层 (x,0) + 切片,底层从不直接转)的构造式三阶段约简(形状→角排列→棱排列),
    // 解实际状态、只发合法 bsq 招式:有效 + 有界(实测 3000 样本 mean≈16、max≈63、bound 90),
    // 长度随打乱难度变化(真分布,非单柱),非最优(§0.0 #3 诚实记)。
    quality: 'sampled-bounded',
    load: async () => {
      const m = await mod('../../client/lib/bsq-solver');
      const solveBsq = m.solveBsq as (s: string) => { length: number; optimal?: boolean };
      return {
        // randomBsqScramble 忠实镜像 cstimer 的 bsq 生成器(sq1_getseq(1,2,len),y 恒 0 → (x,0) 顶转 + /)。
        scramble: m.randomBsqScramble as SolverAdapter['scramble'],
        // 约简有效+有界(非最优)→ optimal 取求解器返回值(恒 false)。
        solve: (s: string) => { const o = solveBsq(s); return { length: o.length, optimal: o.optimal ?? false }; },
        maxBound: m.BSQ_MAX_LENGTH as number,
        stateCountStr: m.BSQ_STATE_COUNT_STR as string,
      };
    },
  },
  {
    event: 'cm3',
    label: 'Cmetrick',
    scrambleLen: 16,          // cstimer cm3 generator length (CSTIMER_EVENTS cm3 length=16)
    defaultN: 2000,           // 从零构造式约简,表懒建一次(~15ms)后每条求解毫秒级 → 2000 单进程秒级
    // 从零逐球约简(cm2 的 3×3 放大):先用线翻转解 9 个符号位(G/H=Z2),再用单球对易子 gadget 逐球归位。
    // 有效 + 有界(实测 3000 真打乱 mean≈33、median≈35、max≈41,bound 60),长度随打乱难度变化(平滑单峰,非单柱),
    // 非最优(§0.0 #3 诚实记)。
    quality: 'sampled-bounded',
    load: async () => {
      const m = await mod('../../client/lib/cm3-solver');
      const solveCm3 = m.solveCm3 as (s: string) => { length: number; optimal?: boolean };
      return {
        // randomCm3Scramble 忠实镜像 cstimer 的 mega cm3 生成器(2 轴 × 3 组 × 3 幂 + 无重复规则)。
        scramble: m.randomCm3Scramble as SolverAdapter['scramble'],
        // 约简有效+有界(非最优)→ optimal 恒 false。
        solve: (s: string) => ({ length: solveCm3(s).length, optimal: false }),
        maxBound: m.CM3_MAX_LENGTH as number,
        stateCountStr: m.CM3_STATE_COUNT_STR as string,
      };
    },
  },
  {
    event: 'crz3a',
    label: 'Crazy 3x3',
    scrambleLen: 25,          // cstimer crz3a generator length(CSTIMER_EVENTS crz3a length=25)
    defaultN: 1000,           // kociemba 两阶段(表暖后)每条 ~数十 ms;1000 条单进程几分钟
    quality: 'sampled-near-optimal',
    // 打乱走 cstimer-vm 原生 crz3a 生成器(同 live view 的 cstimerScramble('crz3a'));
    // 求解走纯 TS solveCrz3a(kociemba 两阶段,Node 可跑,异步)。
    load: async () => {
      const sb = cstimerSandbox();
      if (!sb) throw new Error('cstimer sandbox unavailable for crz3a scramble generation');
      const scrMgr = sb.scrMgr as Parameters<typeof cstimerGen>[0];
      const m = await mod('../../client/lib/crz3a-solver');
      const solveCrz3a = m.solveCrz3a as (s: string) => Promise<{ length: number; optimal?: boolean }>;
      return {
        sampleOne: async () => {
          const scramble = cstimerGen(scrMgr, 'crz3a', 25);
          if (!scramble) throw new Error('crz3a generator returned empty');
          const out = await solveCrz3a(scramble);
          return { length: out.length, optimal: out.optimal ?? false, scramble };
        },
        // 三阶魔方 ≈ 4.3×10¹⁹,超 2^53 → 预格式化字符串(与 Crz3aDistView STATE_COUNT_APPROX 一致)。
        stateCountStr: '43,252,003,274,489,856,000',
      };
    },
  },
  {
    event: 'mpyrso',
    label: 'Master Pyraminx',
    scrambleLen: 0,           // cstimer 随态生成器忽略长度
    defaultN: 400,            // 实测 ~0.95s/solve(cstimer 两阶段)→ 400 条单进程 ~6min(故不取 1000)
    quality: 'sampled-near-optimal',
    // 生成 + 求解都走 cstimer-vm 原生引擎(mpyr.solveScramble),与 live view 的 worker 路径同源,
    // 不 import client lib(mpyr-solver 拉 `new Worker`)。
    load: async () => {
      const sb = cstimerSandbox();
      if (!sb) throw new Error('cstimer sandbox unavailable for mpyr');
      const scrMgr = sb.scrMgr as Parameters<typeof cstimerGen>[0];
      const mpyr = sb.mpyr as { solveScramble: (s: string) => string } | undefined;
      if (!mpyr || typeof mpyr.solveScramble !== 'function') throw new Error('cstimer mpyr engine unavailable');
      // 暖一次 prune 表(首条触发懒构建)。
      cstimerGen(scrMgr, 'mpyrso');
      return {
        sampleOne: async () => {
          const scramble = cstimerGen(scrMgr, 'mpyrso');
          if (!scramble) throw new Error('mpyrso generator returned empty');
          const sol = mpyr.solveScramble(scramble).trim();
          const length = sol ? sol.split(/\s+/).length : 0;
          return { length, optimal: false, scramble };
        },
      };
    },
  },
  {
    event: 'dino',
    label: 'Dino Cube',
    scrambleLen: 0,           // cstimer 随态生成器忽略长度
    defaultN: 2000,           // dino 解很快(~7-11 步),2000 条单进程几十秒
    quality: 'sampled-near-optimal',
    // 生成 + 求解都走 cstimer-vm 原生引擎(redi.solveScramble),event id 'dino' 的 cstimer key 是 'dinoso'。
    load: async () => {
      const sb = cstimerSandbox();
      if (!sb) throw new Error('cstimer sandbox unavailable for dino');
      const scrMgr = sb.scrMgr as Parameters<typeof cstimerGen>[0];
      const redi = sb.redi as { solveScramble: (s: string) => string } | undefined;
      if (!redi || typeof redi.solveScramble !== 'function') throw new Error('cstimer redi (dino) engine unavailable');
      cstimerGen(scrMgr, 'dinoso');
      return {
        sampleOne: async () => {
          const scramble = cstimerGen(scrMgr, 'dinoso');
          if (!scramble) throw new Error('dinoso generator returned empty');
          const sol = redi.solveScramble(scramble).trim();
          const length = sol ? sol.split(/\s+/).length : 0;
          return { length, optimal: false, scramble };
        },
      };
    },
  },
  // NOTE: 15p (数字华容道) 故意 NOT 注册 —— 其 walking-distance IDA* 对均匀随机深态单条可能跑数分钟(N=20
  // 离线采样 >200s 未完成),即便很小的 N 也无法给出平滑直方图且有 runaway/OOM 风险(并发重 solver 在跑)。
  // 故跳过,Slide15DistView 保持现场采样(深态在浏览器里也慢,但有进度条+可取消)。若日后换更强求解器再接入。
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

  const useSampleOne = typeof adapter.sampleOne === 'function';
  if (!useSampleOne && (!adapter.scramble || !adapter.solve)) {
    throw new Error(`[${spec.event}] adapter has neither sampleOne nor scramble+solve`);
  }

  const t0 = Date.now();
  let done = 0;
  for (let i = 0; i < n; i++) {
    let scramble = '';
    try {
      let length: number, optimal: boolean;
      if (useSampleOne) {
        const r = await adapter.sampleOne!(rnd);
        scramble = r.scramble; length = r.length; optimal = r.optimal;
      } else {
        scramble = adapter.scramble!(spec.scrambleLen, rnd);
        const out = await adapter.solve!(scramble);
        length = out.length; optimal = out.optimal;
      }
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
  if (adapter.groupOrderStr) out.groupOrderStr = adapter.groupOrderStr;

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
