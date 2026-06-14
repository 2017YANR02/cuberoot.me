'use client';

/**
 * /code/solvers — 求解器舰队看板.
 * 进度 (覆盖率) + 快照日期: 实时 fetch /stats/scramble/distribution.json 自动维护
 *   (管道每次被手动跑时重发布该文件 → 看板自动刷新, 无定时调度). fetch 失败回退到 curated 常量.
 * 吞吐 / 内存 / 浏览器端: curated 常量 (不在 distribution.json 里, 且为稳定特征).
 */
import { useEffect, useState } from 'react';
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { Cpu, Database, Gauge, HardDrive, Globe, Layers, CircleCheck, CircleDashed, CircleDot } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { statsUrl } from '@/lib/stats-base';
import './solvers.css';

// fetch 失败时的回退 (last-known 2026-05-30).
const FB_SNAPSHOT = '2026-05-30';
const FB_TARGET = 1_289_663;

type Status = 'complete' | 'partial' | 'seed';

interface NativeSolver {
  key: string;
  stages: number;
  fbRows: number; // 回退行数 (fetch 失败时用)
  rate: number | null; // tasks/sec, native, 16 核 (curated, 2026-05-30 实测; f2leo 系 2026-05-31); null = 未实测 (统计回填未接)
  tier: 'huge' | 'mid' | 'small';
  puzzle?: string; // 非 3x3 独立 puzzle (整魔方, 非 3x3 子阶段); 统计走 puzzle_distribution.json 新管线
  event?: string; // 非 3x3 puzzle 对应的 WCA event id (语料过滤用)
  zhWhy: string; enWhy: string;
}

// 原生分析器 (solver/target/release/*_analyzer.exe). rate 实测 (pair 2026-06-03 暖表稳态, 余 2026-05-30).
const NATIVE: NativeSolver[] = [
  { key: 'std', stages: 5, fbRows: 1_289_663, rate: 115, tier: 'huge', zhWhy: '联合大表剪枝最强, 全 5 阶段', enWhy: 'strongest joint-table pruning, full 5 stages' },
  { key: 'eo', stages: 5, fbRows: 1_240_119, rate: 0.9, tier: 'huge', zhWhy: 'xxxxcross 全枚举 ~13M 节点每条, 唯一长极', enWhy: 'xxxxcross full enumeration ~13M nodes/case — the long pole' },
  { key: 'pseudo', stages: 4, fbRows: 1_289_663, rate: 390, tier: 'huge', zhWhy: '槽解耦 + 强剪枝, 最快', enWhy: 'slot-decoupled + strong pruning, fastest' },
  { key: 'pseudo_pair', stages: 4, fbRows: 1_289_663, rate: 47, tier: 'huge', zhWhy: '角槽棱槽耦合, 搜索较重', enWhy: 'corner/edge slot coupling, heavier search' },
  { key: 'pair', stages: 4, fbRows: 1_293_570, rate: 200, tier: 'huge', zhWhy: '不在默认补缺 (opt-in), 暖表后 ~200/s 已全量回填', enWhy: 'opt-in (off the default run), ~200/s once tables warm — fully backfilled' },
  { key: 'f2leo', stages: 4, fbRows: 252, rate: 31, tier: 'huge', zhWhy: '联合大表剪枝 (同 std huge 表) + 自由棱 EO 门控, 4 阶段无 xxxxcross', enWhy: 'joint big-table pruning (same huge tables as std) + free-edge EO gating, 4 stages no xxxxcross' },
  { key: 'pseudo_f2leo', stages: 4, fbRows: 252, rate: 81, tier: 'huge', zhWhy: 'pseudo 大表电池 (C4E + corner2/3 + edge2/3) max + 自由棱 EO, 4 阶段无 xxxxcross', enWhy: 'pseudo big-table battery (C4E + corner2/3 + edge2/3) max + free-edge EO, 4 stages no xxxxcross' },
  { key: '333', stages: 1, fbRows: 240, rate: 4.5, tier: 'huge', zhWhy: '整魔方最优解 (Tronto h48, God 数 HTM, 单一整解非分阶段): emscripten WASM 在 Node 批量解 (非 Rust 分析器), 15G 剪枝表驻留 RAM, in-proc 12 线程 ~4.5/s; 喂 distribution.json 的 333 整解方法 (分布峰 18 / 均值 17.7)', enWhy: 'whole-cube optimal (Tronto h48, God\'s-number HTM, one whole solve not staged): emscripten WASM batch-solved in Node (not a Rust analyzer), 15G prune table resident in RAM, in-proc 12 threads ~4.5/s; feeds the 333 whole-solve method in distribution.json (distribution peaks at 18 / mean 17.7)' },
  { key: '222', stages: 1, fbRows: 1_297_444, rate: 1_250_000, tier: 'small', zhWhy: '2x2x2 块 (1 角 + 3 棱) 全空间仅 253,440 态, 精确距离表直查零搜索', enWhy: '2x2x2 block (corner + 3 edges) — 253,440 states total, exact distance table lookup, zero search' },
  { key: '123', stages: 2, fbRows: 1_297_444, rate: 600_000, tier: 'small', zhWhy: 'Roux 第一块: 1x2x2 方块 (1角+2棱, 前/后双微表) + 1x2x3 (2角+3棱, 5,322,240 态全表), 精确距离表直查零搜索', enWhy: 'Roux first block: 1x2x2 square (corner + 2 edges, front/back micro-tables) + 1x2x3 (2 corners + 3 edges, 5,322,240-state full table) — exact lookups, zero search' },
  { key: '223', stages: 1, fbRows: 1_297_444, rate: 19_000, tier: 'small', zhWhy: 'Petrus 2x2x3 (2角+5棱) 全空间 ~1.5G 态放不下全表, IDA* + max(1x2x3 全表, 角2+DB/DF 表) 可采纳下界', enWhy: 'Petrus 2x2x3 (2 corners + 5 edges) — 1.5G states, too big for a full table; IDA* with admissible h = max(1x2x3 full table, corners+DB/DF table)' },
  { key: 'eoline', stages: 2, fbRows: 1_297_444, rate: 350_000, tier: 'small', zhWhy: 'EO (2,048 态) + EOLine (294,912 态) 全空间微表, 零外部表, 精确距离直查零搜索', enWhy: 'EO (2,048 states) + EOLine (294,912 states) full-space micro-tables, zero external tables — exact lookups, zero search' },
  { key: 'dr', stages: 1, fbRows: 1_297_444, rate: 12_000, tier: 'small', zhWhy: 'DR (Kociemba phase-1) 全空间 ~2.2G 态, IDA* + max(eo×slice, co×slice) 双 ~1M 精确表, 全现场建零外部表', enWhy: 'DR (Kociemba phase 1) — ~2.2G states; IDA* with admissible h = max(eo×slice, co×slice), two ~1M exact tables built in RAM, zero external tables' },
  { key: 'htr', stages: 1, fbRows: 0, rate: null, tier: 'small', zhWhy: 'DR→HTR 条件式阶段: 输入须处于该视角 DR 态, 非 DR 出哨兵;全空间 2,822,400 态精确表查表即最优;统计口径待定未接回填, 吞吐未实测', enWhy: 'conditional DR→HTR stage: input must already be in DR for the view, non-DR yields a sentinel; 2,822,400-state exact table — lookups are optimal; stats wiring pending, throughput not yet measured' },
  { key: 'htr2', stages: 1, fbRows: 0, rate: null, tier: 'small', zhWhy: 'HTR→solved 收尾阶段 (G3→G4): 输入须处于 HTR 态, 非 HTR 出哨兵;全空间 663,552 态精确表查表即最优;统计口径待定未接回填, 吞吐未实测', enWhy: 'HTR→solved finish stage (G3→G4): input must already be in HTR, non-HTR yields a sentinel; 663,552-state exact table — lookups are optimal; stats wiring pending, throughput not yet measured' },
  { key: 'fr', stages: 1, fbRows: 0, rate: null, tier: 'small', zhWhy: 'HTR→FR (Floppy 还原) 条件式阶段: 输入须处于 HTR 态, 非 HTR 出哨兵;FR 坐标 = G3 中 H=⟨L2,R2,F2,B2⟩ 的右陪集索引, 全空间仅 3,456 陪集精确表查表即最优, God 数实测 11;原生只作链式求解器内核 (无独立分析器 bin), 统计未接回填, 吞吐未实测', enWhy: 'conditional HTR→FR (Floppy Reduction) stage: input must already be in HTR, non-HTR yields a sentinel; FR coord = right-coset index of H=⟨L2,R2,F2,B2⟩ within G3 — a 3,456-coset exact table, lookups are optimal, measured God\'s number 11; native side is the chain-solver core only (no standalone analyzer bin), stats wiring pending, throughput not yet measured' },
  { key: 'pocket', stages: 1, fbRows: 0, rate: null, tier: 'small', puzzle: '2x2x2', event: '222', zhWhy: '非 3x3 独立 puzzle: 2x2x2 整魔方全空间 3,674,160 态 (7!·3^6, 固定 DBL 角消整体朝向) 精确距离表查表即最优, God 数实测 11 HTM;统计走 puzzle_distribution.json 新管线, 全量灌注待跑, 吞吐未实测', enWhy: 'standalone non-3x3 puzzle: the whole 2x2x2 — full-space 3,674,160-state (7!·3^6, DBL corner fixed to kill whole-cube rotation) exact distance table, lookups are optimal, measured God\'s number 11 HTM; stats go through the new puzzle_distribution.json pipeline, full pour pending, throughput not yet measured' },
  { key: 'pyraminx', stages: 1, fbRows: 0, rate: null, tier: 'small', puzzle: 'Pyraminx', event: 'pyram', zhWhy: '非 3x3 独立 puzzle: Pyraminx 核心 933,120 态 (6 棱偶置换 360 × 翻转 32 × 4 轴心 3^4) 精确距离表查表即最优, 总步数 = 核心最优 + 错位顶点数 (75,582,720 含顶点全空间验证), God 数实测 核心 11 / 含顶点 15;统计走 puzzle_distribution.json 新管线 (event pyram), 全量灌注待跑, 吞吐未实测', enWhy: 'standalone non-3x3 puzzle: the Pyraminx core — 933,120 states (even edge perm 360 × flips 32 × axial 3^4) exact distance table, lookups are optimal; total HTM = core optimum + misplaced tips (verified across all 75,582,720 tip-inclusive states), measured God\'s number 11 core / 15 with tips; stats go through the puzzle_distribution.json pipeline (event pyram), full pour pending, throughput not yet measured' },
  { key: 'skewb', stages: 1, fbRows: 0, rate: null, tier: 'small', puzzle: 'Skewb', event: 'skewb', zhWhy: '非 3x3 独立 puzzle: Skewb (斜转) 整魔方全空间 3,149,280 态 (中心偶置换 360 × 双轨道角置换 12×3 × 扭转 3^5, 角 3 天然不动不扭作全局参照, 无需消整体朝向) 精确距离表查表即最优, God 数实测 11 (分布对公开数据逐项锁);统计走 puzzle_distribution.json 新管线 (event skewb), 全量灌注待跑, 吞吐未实测', enWhy: 'standalone non-3x3 puzzle: the whole Skewb — full-space 3,149,280-state (center even perms 360 × two-orbit corner perms 12×3 × twists 3^5; corner 3 never moves nor twists — a free global reference, no orientation reduction needed) exact distance table, lookups are optimal, measured God\'s number 11 (distribution locked term-by-term against published data); stats go through the puzzle_distribution.json pipeline (event skewb), full pour pending, throughput not yet measured' },
  { key: '123x2', stages: 1, fbRows: 0, rate: 220, tier: 'mid', zhWhy: '双 1x2x3 联合最优平均 ~11.5 步, 搜索深;5 张精确子目标表 max 剪枝, 其中 {块+2角} 表 2.68G 态落盘 mmap', enWhy: 'dual-1x2x3 joint optimum averages ~11.5 moves — deep search; pruned by max of 5 exact subgoal tables, incl. a 2.68G-state block+corners table mmapped from disk' },
];

interface BrowserSolver { key: string; zhEngine: string; enEngine: string; zhLatency: string; enLatency: string; }

// 浏览器端 WASM (gen 页现算). 定性, 非精确遥测.
const BROWSER: BrowserSolver[] = [
  { key: 'std cross-step', zhEngine: 'pt_cross_C4E0 (52MB/worker)', enEngine: 'pt_cross_C4E0 (52MB/worker)', zhLatency: 'cross 秒出', enLatency: 'cross instant' },
  { key: 'pair', zhEngine: 'VariantSolverWasm', enEngine: 'VariantSolverWasm', zhLatency: '全 4 阶段 ~0.04s', enLatency: 'all 4 stages ~0.04s' },
  { key: 'eo', zhEngine: 'VariantSolverWasm', enEngine: 'VariantSolverWasm', zhLatency: '深阶段 数十秒', enLatency: 'deep stages tens of seconds' },
  { key: 'pseudo', zhEngine: 'VariantSolverWasm', enEngine: 'VariantSolverWasm', zhLatency: '~5s', enLatency: '~5s' },
  { key: 'pseudo_pair', zhEngine: 'VariantSolverWasm', enEngine: 'VariantSolverWasm', zhLatency: '深阶段 数十秒', enLatency: 'deep stages tens of seconds' },
  { key: 'f2leo / pseudo_f2leo', zhEngine: '小表 ~40MB/worker', enEngine: 'small tables ~40MB/worker', zhLatency: 'cross ~2.8s', enLatency: 'cross ~2.8s' },
  { key: '333 整解最优 (h48)', zhEngine: 'cube48opt[1-9] WASM (/scramble/solver, .dat 表用户自备)', enEngine: 'cube48opt[1-9] WASM (/scramble/solver, user-supplied .dat)', zhLatency: '默认桌面 opt3 243M / 手机 opt1 30M; 表越大搜得越快; 整解 God 数最优', enLatency: 'default desktop opt3 243M / mobile opt1 30M; bigger table = faster search; whole-cube God\'s-number optimal' },
  { key: '2x2x2 block', zhEngine: 'Block222SolverWasm (~0.7MB/worker)', enEngine: 'Block222SolverWasm (~0.7MB/worker)', zhLatency: '全 6 视角即时', enLatency: 'all 6 views instant' },
  { key: '1x2x3 / 2x2x3', zhEngine: 'Roux223SolverWasm (~0.8MB/worker)', enEngine: 'Roux223SolverWasm (~0.8MB/worker)', zhLatency: '方块/2x2x2 即时; 1x2x3 与 2x2x3 首算建表 ~秒级', enLatency: 'square/2x2x2 instant; 1x2x3 & 2x2x3 build tables on first solve (~seconds)' },
  { key: '1x2x3 ×2', zhEngine: 'Roux223SolverWasm 轻档 (免 2.68G 大表)', enEngine: 'Roux223SolverWasm light tier (no 2.68G table)', zhLatency: '单格 毫秒~秒级; 解法枚举 数秒~数十秒', enLatency: 'per-cell ms–seconds; solution enumeration seconds to tens of seconds' },
  { key: 'EO / EOLine / DR', zhEngine: 'EoDrSolverWasm (零表下载, 微表现场建)', enEngine: 'EoDrSolverWasm (zero downloads, micro-tables built in-browser)', zhLatency: 'EO/EOLine 即时; DR 首算建表 ~1s 后毫秒级', enLatency: 'EO/EOLine instant; DR builds tables on first solve (~1s), then ms' },
  { key: 'HTR (DR→HTR)', zhEngine: 'HtrSolverWasm (零表下载, 全空间精确表现场建)', enEngine: 'HtrSolverWasm (zero downloads, exact full-space table built in-browser)', zhLatency: '首算建表 ~335ms 后即时; 非 DR 出哨兵', enLatency: 'first solve builds the table (~335ms), then instant; non-DR yields a sentinel' },
  { key: 'HTR finish (HTR→solved)', zhEngine: 'HtrPhase2SolverWasm (零表下载, 全空间精确表现场建)', enEngine: 'HtrPhase2SolverWasm (zero downloads, exact full-space table built in-browser)', zhLatency: '首算建表后即时; 非 HTR 出哨兵', enLatency: 'first solve builds the table, then instant; non-HTR yields a sentinel' },
  { key: 'FR (HTR→FR)', zhEngine: 'FrSolverWasm (零表下载, 3,456 陪集距离表现场建)', enEngine: 'FrSolverWasm (zero downloads, 3,456-coset distance table built in-browser)', zhLatency: '首算建表 ~10s 后即时; 非 HTR 出哨兵', enLatency: 'first solve builds tables (~10s), then instant; non-HTR yields a sentinel' },
  { key: '2x2x2 pocket', zhEngine: 'PocketSolverWasm (零表下载, 3.6MB 距离表现场建, 免 132MB 移动表)', enEngine: 'PocketSolverWasm (zero downloads, 3.6MB distance table built in-wasm, no 132MB move table)', zhLatency: '首算惰性建表后即时; /scramble/pocket 在线出最优解', enLatency: 'lazy first-solve build, then instant; serves optimal solutions on /scramble/pocket' },
  { key: 'Pyraminx', zhEngine: 'PyraminxSolverWasm (零表下载, 0.9MB 核心距离表现场建, 免 29.9MB 移动表)', enEngine: 'PyraminxSolverWasm (zero downloads, 0.9MB core distance table built in-wasm, no 29.9MB move table)', zhLatency: '首算惰性建表 ~0.6s 后即时; /scramble/pyraminx 在线出最优解', enLatency: 'lazy first-solve build (~0.6s), then instant; serves optimal solutions on /scramble/pyraminx' },
  { key: 'Skewb', zhEngine: 'SkewbSolverWasm (零表下载, 3.0MB 距离表现场建, 转移件级现算免 ~100.8MB 联合移动表)', enEngine: 'SkewbSolverWasm (zero downloads, 3.0MB distance table built in-wasm, piecewise transitions — no ~100.8MB joint move table)', zhLatency: '首算惰性建表 ~3.3s 后即时; /scramble/skewb 在线出最优解', enLatency: 'lazy first-solve build (~3.3s), then instant; serves optimal solutions on /scramble/skewb' },
];

// 每个原生分析器实际 mmap 的磁盘表 (D:\cube\cuberoot.me\solver\tables\, 大小为真实文件字节).
// 源码核实自 solver/ (std_analyzer.rs / eo_cross_solver.rs / pseudo_analyzer.rs /
// pseudo_pair_solver.rs / pair_solver.rs / f2leo_solver.rs / pseudo_f2leo_solver.rs),
// 口径 = 权威 full 全模式 (CUBE_ALLOW_HUGE_TABLES=1, 无 *_NO_DIAG / *_SKIP)。
// cnt>1 = 同规格一组; cond = 对角剪枝表, 仅全模式载, 设 *_NO_DIAG 可跳过 (各省 ~10GB).
interface Tbl { n: string; b: number; cnt?: number; cond?: boolean }
interface SolverTbls { move: Tbl[]; prune: Tbl[]; builtZh?: string; builtEn?: string
    builtZhHant?: string;
 }

const TABLES: Record<string, SolverTbls> = {
  std: {
    move: [{ n: 'mt_edge2', b: 38028 }, { n: 'mt_edge', b: 1740 }, { n: 'mt_corn', b: 1740 }, { n: 'mt_edge4', b: 18247692 }, { n: 'mt_edge6', b: 3065610252 }, { n: 'mt_corn2', b: 36300 }],
    prune: [{ n: 'pt_cross', b: 139408 }, { n: 'pt_cross_C4E0', b: 54743056 }, { n: 'pt_cross_C4C5E0E1', b: 10729635856 }, { n: 'pt_cross_C4C6E0E2', b: 10729635856 }],
  },
  eo: {
    move: [{ n: 'mt_edge2', b: 38028 }, { n: 'mt_eo12', b: 147468 }, { n: 'mt_edge4', b: 18247692 }, { n: 'mt_corn', b: 1740 }, { n: 'mt_edge', b: 1740 }, { n: 'mt_edge6', b: 3065610252 }, { n: 'mt_corn2', b: 36300 }, { n: 'mt_ep4', b: 855372 }, { n: 'mt_eo12_alt', b: 147468 }],
    prune: [{ n: 'pt_cross', b: 139408 }, { n: 'pt_ep4eo12', b: 12165136 }, { n: 'pt_cross_C4E0', b: 54743056 },
      { n: 'pt_cross_C4E0E1', b: 1313832976 }, { n: 'pt_cross_C4E0E2', b: 1313832976 }, { n: 'pt_cross_C4E0E3', b: 1313832976 },
      { n: 'pt_cross_C4C5E0', b: 1313832976 }, { n: 'pt_cross_C4C6E0', b: 1313832976 }, { n: 'pt_cross_C4C7E0', b: 1313832976 },
      { n: 'pt_cross_C4C5C6', b: 1313832976 }, { n: 'pt_cross_C4C5E0E1', b: 10729635856 },
      { n: 'pt_cross_C4C6E0E2', b: 10729635856, cond: true }],
  },
  pseudo: {
    move: [{ n: 'mt_edge2', b: 38028 }, { n: 'mt_edge4', b: 18247692 }, { n: 'mt_corn', b: 1740 }, { n: 'mt_edge', b: 1740 }, { n: 'mt_corn2', b: 36300 }, { n: 'mt_edge3', b: 760332 }, { n: 'mt_corn3', b: 653196 }],
    prune: [{ n: 'pt_pscross', b: 139408 },
      { n: 'pt_pscross_C4E0', b: 54743056 }, { n: 'pt_pscross_C4E1', b: 54743056 }, { n: 'pt_pscross_C4E2', b: 54743056 }, { n: 'pt_pscross_C4E3', b: 54743056 },
      { n: 'pt_pscross_E0E1', b: 50181136 }, { n: 'pt_pscross_E0E2', b: 50181136 },
      { n: 'pt_pscross_C4C5', b: 47900176 }, { n: 'pt_pscross_C4C6', b: 47900176 },
      { n: 'pt_pscross_E0E1E2', b: 1003622416 }, { n: 'pt_pscross_C4C5C6', b: 862202896 }],
  },
  pseudo_pair: {
    move: [{ n: 'mt_edge', b: 1740 }, { n: 'mt_corn', b: 1740 }, { n: 'mt_edge4', b: 18247692 }, { n: 'mt_edge2', b: 38028 }, { n: 'mt_edge3', b: 760332 }, { n: 'mt_corn2', b: 36300 }, { n: 'mt_corn3', b: 653196 }],
    prune: [{ n: 'pt_pscross_C4‥C7', b: 2280976, cnt: 4 },
      { n: 'pt_pscross_ins_C4‥C7_diff0‥3', b: 2280976, cnt: 16 },
      { n: 'pt_pspair_C4‥C7_E0‥E3', b: 304, cnt: 16 },
      { n: 'pt_pscross_C4E0‥C4E3', b: 54743056, cnt: 4 },
      { n: 'pt_pscross_E0E1', b: 50181136 }, { n: 'pt_pscross_E0E2', b: 50181136 },
      { n: 'pt_pscross_C4C5', b: 47900176 }, { n: 'pt_pscross_C4C6', b: 47900176 },
      { n: 'pt_pscross_E0E1E2', b: 1003622416 }, { n: 'pt_pscross_C4C5C6', b: 862202896 }],
  },
  pair: {
    move: [{ n: 'mt_edge4', b: 18247692 }, { n: 'mt_corn', b: 1740 }, { n: 'mt_edge', b: 1740 }, { n: 'mt_edge6', b: 3065610252 }, { n: 'mt_corn2', b: 36300 }],
    prune: [{ n: 'pt_cross_ins_C4', b: 2280976 }, { n: 'pt_pair_C4E0', b: 304 }, { n: 'pt_cross_C4E0', b: 54743056 },
      { n: 'pt_cross_C4C5E0E1', b: 10729635856 }, { n: 'pt_cross_C4C6E0E2', b: 10729635856, cond: true }],
  },
  f2leo: {
    move: [{ n: 'mt_edge2', b: 38028 }, { n: 'mt_edge', b: 1740 }, { n: 'mt_corn', b: 1740 }, { n: 'mt_edge4', b: 18247692 }, { n: 'mt_edge6', b: 3065610252 }, { n: 'mt_corn2', b: 36300 }],
    prune: [{ n: 'pt_cross', b: 139408 }, { n: 'pt_cross_C4E0', b: 54743056 }, { n: 'pt_cross_C4C5E0E1', b: 10729635856 }, { n: 'pt_cross_C4C6E0E2', b: 10729635856 }],
    builtZh: 'cross 阶段用 pt_cross;xcross 用 pt_cross_C4E0;xxcross/xxxcross 复用 std 的 pair huge 表 + 叶子门控自由 F2L 棱 EO',
    builtEn: 'cross via pt_cross; xcross via pt_cross_C4E0; xxcross/xxxcross reuse std pair huge tables + leaf EO gating on free F2L edges',
      builtZhHant: "cross 階段用 pt_cross;xcross 用 pt_cross_C4E0;xxcross/xxxcross 複用 std 的 pair huge 表 + 葉子門控自由 F2L 稜 EO"
},
  pseudo_f2leo: {
    move: [{ n: 'mt_edge2', b: 38028 }, { n: 'mt_edge4', b: 18247692 }, { n: 'mt_corn', b: 1740 }, { n: 'mt_edge', b: 1740 }, { n: 'mt_corn2', b: 36300 }, { n: 'mt_edge3', b: 760332 }, { n: 'mt_corn3', b: 653196 }],
    prune: [{ n: 'pt_pscross_C4E0‥C4E3', b: 54743056, cnt: 4 },
      { n: 'pt_pscross_E0E1', b: 50181136 }, { n: 'pt_pscross_E0E2', b: 50181136 },
      { n: 'pt_pscross_C4C5', b: 47900176 }, { n: 'pt_pscross_C4C6', b: 47900176 },
      { n: 'pt_pscross_E0E1E2', b: 1003622416 }, { n: 'pt_pscross_C4C5C6', b: 862202896 }],
    builtZh: 'combo 启发式 = max(每对 C4E, 角组 corner2/3, 棱组 edge2/3) + 叶子门控自由棱 EO;另现场建 pscross 剪枝 (~272KB, 内存) 供 cross 阶段',
    builtEn: 'combo heuristic = max(per-pair C4E, corner2/3 group, edge2/3 group) + leaf EO gating on free edges; plus pscross prune (~272KB) built in-RAM for the cross stage',
      builtZhHant: "combo 啟發式 = max(每對 C4E, 角組 corner2/3, 稜組 edge2/3) + 葉子門控自由稜 EO;另現場建 pscross 剪枝 (~272KB, 記憶體) 供 cross 階段"
},
  '333': {
    move: [],
    prune: [{ n: 'h48prun31h9', b: 15565455360 }],
    builtZh: 'Tronto cube48opt 最优解器 (h48 坐标, God 数 HTM 整解): 15G 剪枝表分 64MB 块拷入 emscripten 堆 (非 Rust mmap), in-proc 起 12 解线程; 同一 cube48opt[1-9] 引擎也服 /scramble/solver 在线最优 (浏览器选 30M~972M 小表)',
    builtEn: 'Tronto cube48opt optimal solver (h48 coordinate, God\'s-number HTM whole solve): the 15G prune table is copied into the emscripten heap in 64MB chunks (not a Rust mmap), starting 12 solve threads in-proc; the same cube48opt[1-9] engine also powers /scramble/solver online optimal (browser picks 30M–972M smaller tables)',
    builtZhHant: 'Tronto cube48opt 最優解器 (h48 座標, God 數 HTM 整解): 15G 剪枝表分 64MB 塊拷入 emscripten 堆 (非 Rust mmap), in-proc 起 12 解執行緒; 同一 cube48opt[1-9] 引擎也服 /scramble/solver 線上最優 (瀏覽器選 30M~972M 小表)',
  },
  '222': {
    move: [{ n: 'mt_edge3', b: 760332 }, { n: 'mt_corn', b: 1740 }],
    prune: [],
    builtZh: '不落盘剪枝:全空间精确距离表 (253,440 态, ~248KB) 构造时内存现场 BFS;查长度 O(1) 直查无搜索',
    builtEn: 'no on-disk prune: exact full-space distance table (253,440 states, ~248KB) BFS-built in RAM at startup; length queries are O(1) lookups, zero search',
    builtZhHant: '不落盤剪枝:全空間精確距離表 (253,440 態, ~248KB) 構造時記憶體現場 BFS;查長度 O(1) 直查無搜尋',
  },
  '123': {
    move: [{ n: 'mt_corn2', b: 36300 }, { n: 'mt_edge3', b: 760332 }, { n: 'mt_corn', b: 1740 }, { n: 'mt_edge2', b: 38028 }],
    prune: [],
    builtZh: '不落盘剪枝:1x2x3 全空间精确距离表 (5,322,240 态, ~5MB) 与 FB 方块前/后双微表 (各 12,672 态) 构造时内存现场 BFS;查长度 O(1) 直查无搜索',
    builtEn: 'no on-disk prune: exact full-space 1x2x3 distance table (5,322,240 states, ~5MB) + front/back FB-square micro-tables (12,672 states each) BFS-built in RAM at startup; length queries are O(1) lookups, zero search',
    builtZhHant: '不落盤剪枝:1x2x3 全空間精確距離表 (5,322,240 態, ~5MB) 與 FB 方塊前/後雙微表 (各 12,672 態) 構造時記憶體現場 BFS;查長度 O(1) 直查無搜尋',
  },
  '223': {
    move: [{ n: 'mt_corn2', b: 36300 }, { n: 'mt_edge3', b: 760332 }, { n: 'mt_edge2', b: 38028 }],
    prune: [],
    builtZh: '不落盘剪枝:内存现场 BFS 出 1x2x3 全表 (5,322,240 态) 与角2+DB/DF 表 (266,112 态) 作可采纳下界, IDA* 取两者 max;h=0 即块成',
    builtEn: 'no on-disk prune: 1x2x3 full table (5,322,240 states) + corners+DB/DF table (266,112 states) BFS-built in RAM as admissible bounds; IDA* prunes on their max; h=0 means the block is done',
    builtZhHant: '不落盤剪枝:記憶體現場 BFS 出 1x2x3 全表 (5,322,240 態) 與角2+DB/DF 表 (266,112 態) 作可採納下界, IDA* 取兩者 max;h=0 即塊成',
  },
  eoline: {
    move: [],
    prune: [],
    builtZh: '零盘表:eo12/线棱微 move 表与全空间精确距离表 (2,048 + 294,912 态) 全部现场从内置运动学构建;查长度 O(1) 直查无搜索',
    builtEn: 'no disk tables at all: eo12/line micro move tables + exact full-space distance tables (2,048 + 294,912 states) built in RAM from built-in kinematics; O(1) lookups, zero search',
  },
  dr: {
    move: [],
    prune: [],
    builtZh: '零盘表:eo/co/slice 微 move 表与两张 ~1M 态精确距离表全部现场构建;IDA* 取两者 max, h=0 即达 DR',
    builtEn: 'no disk tables at all: eo/co/slice micro move tables + two ~1M-state exact distance tables built in RAM; IDA* prunes on their max; h=0 means DR reached',
  },
  htr: {
    move: [],
    prune: [],
    builtZh: '零盘表:DR→HTR 全空间精确距离表 (2,822,400 态 = 角置换 8! 40,320 × 轨道 4 棱位置组合 C(8,4)=70, ~2.8MB) 首查惰性内存 BFS (native ~5s);查长度 O(1), 枚举首达即最优, DR→HTR God 数实测 13;非 DR 输入出哨兵',
    builtEn: 'no disk tables at all: exact full-space DR→HTR distance table (2,822,400 states = corner perm 8! 40,320 × C(8,4)=70 orbit-edge placements, ~2.8MB) lazily BFS-built in RAM on first query (~5s native); O(1) length lookups, first hit in enumeration is optimal — measured DR→HTR God\'s number 13; non-DR inputs yield a sentinel',
  },
  htr2: {
    move: [],
    prune: [],
    builtZh: '零盘表:HTR→solved (G3→G4) 全空间精确距离表 (663,552 态 = 角 HTR 子群 Hc 96 × 棱 6,912, ~648KB) 首查惰性内存 BFS;查长度 O(1), 枚举首达即最优, HTR→solved God 数实测 15;非 HTR 输入出哨兵',
    builtEn: 'no disk tables at all: exact full-space HTR→solved (G3→G4) distance table (663,552 states = HTR corner subgroup Hc 96 × 6,912 edges, ~648KB) lazily BFS-built in RAM on first query; O(1) length lookups, first hit in enumeration is optimal — measured HTR→solved God\'s number 15; non-HTR inputs yield a sentinel',
  },
  fr: {
    move: [],
    prune: [],
    builtZh: '零盘表:HTR→FR 距离表 = G3 中 H=⟨L2,R2,F2,B2⟩ 右陪集索引 (3,456 陪集, ~3.4KB) 首查惰性内存 BFS (复用 htr2 的 G3 角 96 × 棱 6,912 微表);查长度 O(1), 枚举首达即最优, HTR→FR God 数实测 11;非 HTR 输入出哨兵',
    builtEn: 'no disk tables at all: the HTR→FR distance table indexes right cosets of H=⟨L2,R2,F2,B2⟩ within G3 (3,456 cosets, ~3.4KB), lazily BFS-built in RAM on first query (reusing htr2\'s G3 corner-96 × edge-6,912 micro-tables); O(1) length lookups, first hit in enumeration is optimal — measured HTR→FR God\'s number 11; non-HTR inputs yield a sentinel',
  },
  pocket: {
    move: [],
    prune: [],
    builtZh: '零盘表:独立 2x2x2 全空间精确距离表 (3,674,160 态 = 7!·3^6, 固定 DBL 角消整体朝向, ~3.6MB) + 联合移动表 (~132MB) 启动时内存现场 BFS (亚秒级);查长度 O(1) 直查无搜索, God 数实测 11 HTM;全 18 记号经 24 旋转归一 (2x2x2 无中心, D/L/B = 对面 + 整体旋转)',
    builtEn: 'no disk tables at all: standalone 2x2x2 — exact full-space distance table (3,674,160 states = 7!·3^6, DBL corner fixed to kill whole-cube rotation, ~3.6MB) + joint move table (~132MB) BFS-built in RAM at startup (sub-second); O(1) length lookups, zero search — measured God\'s number 11 HTM; all 18 move tokens normalized through 24 rotations (no centers: D/L/B = opposite face + rotation)',
  },
  pyraminx: {
    move: [],
    prune: [],
    builtZh: '零盘表:Pyraminx 核心全空间精确距离表 (933,120 态 = 6 棱偶置换 360 × 翻转 32 × 4 轴心 3^4, ~0.9MB) 内存现场 BFS;native 分析器走 full 路线另建 ~29.9MB 移动表 (启动 ~1s), 浏览器走 lean 路线只建距离表;查长度 O(1) 直查无搜索, 总步数 = 核心最优 + 错位顶点数 (75,582,720 含顶点全空间验证加法公式), God 数实测 核心 11 / 含顶点 15;吃全 WCA pyram 记号含小写顶点 u/l/r/b',
    builtEn: 'no disk tables at all: exact full-space Pyraminx core distance table (933,120 states = even edge perm 360 × flips 32 × axial 3^4, ~0.9MB) BFS-built in RAM; the native analyzer takes the full route with an extra ~29.9MB move table (~1s at startup), the browser takes the lean distance-only route; O(1) length lookups, zero search — total HTM = core optimum + misplaced tips (additivity verified across all 75,582,720 tip-inclusive states), measured God\'s number 11 core / 15 with tips; accepts full WCA pyram notation incl. lowercase tips u/l/r/b',
  },
  skewb: {
    move: [],
    prune: [],
    builtZh: '零盘表:Skewb 整魔方全空间精确距离表 (3,149,280 态 = 中心偶置换 360 × 双轨道角置换 12×3 × 扭转 3^5, 角 3 天然不动不扭作全局参照, ~3.0MB) 内存现场 BFS (~1.2s);native 与浏览器同走 lean 路线, 转移件级现算, 不建 ~100.8MB 联合移动表;查长度 O(1) 直查无搜索, God 数实测 11 (分布对公开数据逐项锁);吃全 WCA skewb 记号 U/L/R/B 及撇号 (角转)',
    builtEn: 'no disk tables at all: exact full-space Skewb distance table (3,149,280 states = center even perms 360 × two-orbit corner perms 12×3 × twists 3^5; corner 3 never moves nor twists — a free global reference, ~3.0MB) BFS-built in RAM (~1.2s); native and browser share the same lean route — piecewise transitions computed on the fly, no ~100.8MB joint move table; O(1) length lookups, zero search — measured God\'s number 11 (distribution locked term-by-term against published data); accepts the full WCA skewb notation U/L/R/B with primes (vertex turns)',
  },
  '123x2': {
    move: [{ n: 'mt_corn2', b: 36300 }, { n: 'mt_edge3', b: 760332 }],
    prune: [{ n: 'pt_f2b_be3c2', b: 1341204496 }],
    builtZh: '内存现场 BFS 出 6 棱联合表 (111.5M 态) 与 4 角联合表;{整块+对侧2角} 表 (2.68G 态) 首跑 BFS 落盘 pt_f2b_be3c2.bin, 后续 mmap 秒开;IDA* 取 5 张精确子目标表 max',
    builtEn: '6-edge joint table (111.5M states) + 4-corner table BFS-built in RAM; the block+far-corners table (2.68G states) is BFS-built once, cached to pt_f2b_be3c2.bin and mmapped after; IDA* prunes on the max of 5 exact subgoal tables',
  },
};

function fmtBytes(b: number): string {
  if (b >= 1_073_741_824) return (b / 1_073_741_824).toFixed(1) + ' GB';
  if (b >= 1_048_576) return (b / 1_048_576).toFixed(b < 10_485_760 ? 1 : 0) + ' MB';
  if (b >= 1024) return (b / 1024).toFixed(0) + ' KB';
  return b + ' B';
}
function tblTotal(t: SolverTbls): number {
  // cond 表(对角剪枝, 各 ~10GB)可选 / 可跳过, 不计入头部总和。
  const sum = (arr: Tbl[]) => arr.reduce((a, x) => a + (x.cond ? 0 : x.b * (x.cnt ?? 1)), 0);
  return sum(t.move) + sum(t.prune);
}

interface Coverage { generatedAt: string; target: number; counts: Record<string, number>; }

function deriveStatus(rows: number, target: number): Status {
  const pct = (rows / target) * 100;
  if (pct >= 99.9) return 'complete';
  if (pct < 1) return 'seed';
  return 'partial';
}

// rate 跨度 0.9–390/s, 线性条会让慢的看不见 → log 缩放.
function rateBarPct(rate: number): number {
  const lo = Math.log10(0.5);
  const hi = Math.log10(500);
  return Math.max(4, Math.min(100, ((Math.log10(rate) - lo) / (hi - lo)) * 100));
}

function fmtInt(n: number): string {
  return n.toLocaleString('en-US');
}

const STATUS_ICON = { complete: CircleCheck, partial: CircleDot, seed: CircleDashed } as const;

export default function SolversPage() {
  const { i18n } = useTranslation();
  const zh = i18n.language.startsWith('zh');
  useDocumentTitle('求解器', 'Solvers');

  const [cov, setCov] = useState<Coverage | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(statsUrl('/stats/scramble/distribution.json'), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => {
        const wca = j?.sets?.wca;
        if (!wca?.variants) return;
        const counts: Record<string, number> = {};
        for (const [k, v] of Object.entries(wca.variants)) {
          const c = (v as { sample_count?: number })?.sample_count;
          if (typeof c === 'number') counts[k] = c;
        }
        if (!cancelled) {
          setCov({
            generatedAt: typeof j?.meta?.generated_at === 'string' ? j.meta.generated_at : FB_SNAPSHOT,
            target: typeof wca.sample_count === 'number' ? wca.sample_count : FB_TARGET,
            counts,
          });
        }
      })
      .catch(() => { /* 保留回退常量 */ });
    return () => { cancelled = true; };
  }, []);

  const target = cov?.target ?? FB_TARGET;
  const snapshot = cov?.generatedAt ?? FB_SNAPSHOT;
  const live = !!cov;
  const rowsOf = (s: NativeSolver) => cov?.counts[s.key] ?? s.fbRows;

  const completeN = NATIVE.filter((s) => deriveStatus(rowsOf(s), target) === 'complete').length;

  return (
    <div className="solv-page">
      <div className="solv-bg" aria-hidden="true" />

      <div className="solv-shell">
        <div className="solv-topbar">
          <Link href="/code" className="solv-back">← /code</Link>
          <span className="solv-snapshot" title={live ? (zh ? '覆盖率实时取自 distribution.json' : 'coverage live from distribution.json') : (zh ? '回退到内置快照' : 'fallback to built-in snapshot')}>
            {zh ? '数据' : 'data'} {snapshot}{live ? ' ↻' : ''}
          </span>
        </div>

        <header className="solv-hero">
          <h1 className="solv-title">solvers<span className="solv-cursor">_</span></h1>
          <p className="solv-sub">
            {zh
              ? '魔方分阶段求解器舰队:本机原生分析器(喂打乱分布 + 比赛预计算)与浏览器端 WASM(gen 页现算)的进度、吞吐、内存。'
              : 'The staged cube-solver fleet: native analyzers (feeding the scramble distribution + per-comp precompute) and browser WASM (live solve on the gen page) — coverage, throughput, memory.'}
          </p>
          <div className="solv-herostats">
            <div className="solv-stat"><span className="solv-stat-num">{NATIVE.length}</span><span className="solv-stat-label">{zh ? '原生分析器' : 'native analyzers'}</span></div>
            <div className="solv-stat"><span className="solv-stat-num">~51<small>GB</small></span><span className="solv-stat-label">{zh ? '剪枝表' : 'pruning tables'}</span></div>
            <div className="solv-stat"><span className="solv-stat-num">{completeN}<small>/{NATIVE.length}</small></span><span className="solv-stat-label">{zh ? '已补齐' : 'fully covered'}</span></div>
            <div className="solv-stat"><span className="solv-stat-num">0.9–1.25M<small>/s</small></span><span className="solv-stat-label">{zh ? '吞吐跨度' : 'throughput span'}</span></div>
          </div>
        </header>

        {/* 回填进度 (实时) */}
        <section className="solv-section">
          <header className="solv-sec-head">
            <Database size={15} strokeWidth={2} />
            <h2>{zh ? '回填进度' : 'Backfill coverage'}</h2>
            <span className="solv-sec-note">
              {zh ? `目标 ${fmtInt(target)} 条` : `target ${fmtInt(target)}`}{live ? (zh ? ' · 实时' : ' · live') : ''}
            </span>
          </header>
          <div className="solv-rows">
            {NATIVE.filter((s) => !s.puzzle).map((s) => {
              const rows = rowsOf(s);
              const status = deriveStatus(rows, target);
              const pct = Math.min(100, (rows / target) * 100);
              const SIcon = STATUS_ICON[status];
              return (
                <div className="solv-row" key={s.key}>
                  <div className="solv-row-head">
                    <span className="solv-row-name">{s.key}</span>
                    <span className={`solv-badge solv-badge-${status}`}>
                      <SIcon size={12} strokeWidth={2.2} />
                      {status === 'complete' ? (zh ? '已补齐' : 'complete') : status === 'partial' ? (zh ? '回填中' : 'partial') : (zh ? '仅种子' : 'seed')}
                    </span>
                    <span className="solv-row-stages">{s.stages} {zh ? '阶段' : 'stages'}</span>
                  </div>
                  <div className="solv-bar">
                    <div className={`solv-bar-fill solv-fill-${status}`} style={{ width: `${Math.max(0.4, pct)}%` }} />
                  </div>
                  <div className="solv-row-foot">
                    <span className="solv-row-rows">{fmtInt(rows)} <span className="solv-dim">/ {fmtInt(target)}</span></span>
                    <span className="solv-row-pct">{pct >= 99.95 ? '100' : pct < 0.1 ? pct.toFixed(2) : pct.toFixed(1)}%</span>
                  </div>
                </div>
              );
            })}
            {/* 非 3x3 独立 puzzle: 语料与目标都不同 (puzzle_distribution.json 新管线), 不对 3x3 目标算百分比 */}
            {NATIVE.filter((s) => s.puzzle).map((s) => (
              <div className="solv-row" key={s.key}>
                <div className="solv-row-head">
                  <span className="solv-row-name">{s.key}</span>
                  <span className="solv-badge solv-badge-seed">
                    <CircleDashed size={12} strokeWidth={2.2} />
                    {zh ? '待灌注' : 'pending'}
                  </span>
                  <span className="solv-row-stages">{s.puzzle}</span>
                </div>
                <div className="solv-bar">
                  <div className="solv-bar-fill solv-fill-seed" style={{ width: '0.4%' }} />
                </div>
                <div className="solv-row-foot">
                  <span className="solv-row-rows">{zh
                    ? `非 3x3 独立 puzzle · 语料 = WCA ${s.event} 打乱, 走 puzzle_distribution.json 新管线, 不计入上方 3x3 目标`
                    : `standalone non-3x3 puzzle · corpus = WCA ${s.event} scrambles via the new puzzle_distribution.json pipeline — not counted against the 3x3 target above`}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 吞吐 */}
        <section className="solv-section">
          <header className="solv-sec-head">
            <Gauge size={15} strokeWidth={2} />
            <h2>{zh ? '吞吐' : 'Throughput'}</h2>
            <span className="solv-sec-note">{zh ? '本机 16 核, huge 表全模式 (log 缩放)' : '16-core, full huge-table mode (log scale)'}</span>
          </header>
          <div className="solv-rows">
            {[...NATIVE].sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1)).map((s) => (
              <div className="solv-perf" key={s.key}>
                <div className="solv-perf-top">
                  <span className="solv-row-name">{s.key}</span>
                  <span className="solv-perf-rate">{s.rate == null
                    ? <small>{zh ? '未实测' : 'n/a'}</small>
                    : <>{s.rate >= 10000 ? `${(s.rate / 1e6).toFixed(2)}M` : s.rate}<small> /s</small></>}</span>
                </div>
                <div className="solv-bar">
                  <div className="solv-bar-fill solv-fill-rate" style={{ width: `${s.rate == null ? 0 : rateBarPct(s.rate)}%` }} />
                </div>
                <p className="solv-perf-why">{zh ? s.zhWhy : s.enWhy}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 内存与剪枝表 */}
        <section className="solv-section">
          <header className="solv-sec-head">
            <HardDrive size={15} strokeWidth={2} />
            <h2>{zh ? '内存与剪枝表' : 'Memory & tables'}</h2>
            <span className="solv-sec-note">{zh ? '本机 31.8GB 物理内存' : '31.8GB physical RAM on the build host'}</span>
          </header>
          <div className="solv-mem">
            <article className="solv-mem-card">
              <div className="solv-mem-tier"><Cpu size={13} strokeWidth={2} /> huge</div>
              <div className="solv-mem-list">std / eo / pseudo / pseudo_pair / pair / f2leo / pseudo_f2leo / 333</div>
              <p>{zh
                ? 'mmap GB 级联合/电池剪枝表 (CEE/CCE/C4C5C6 / pair huge / E0E1E2 等)。eo 工作集峰值 ~24GB, 但 private 仅 ~0.1GB — 表是只读共享 mmap。f2leo 复用 std 的 pair huge 表 (各 ~10GB);pseudo_f2leo 用 pseudo 电池 (corner3 862MB + edge3 1GB 等), 各仅多叶子自由棱 EO 门控。333 整解最优是例外:Tronto h48 15G 表分块拷入 emscripten 堆 (非 mmap 共享), 与 Rust 表互不相干。'
                : 'GB-scale joint/battery prune tables (CEE/CCE/C4C5C6 / pair huge / E0E1E2) via mmap. eo peaks ~24GB working set but only ~0.1GB private — read-only shared mmap. f2leo reuses std pair huge tables (~10GB each); pseudo_f2leo uses the pseudo battery (corner3 862MB + edge3 1GB), each adding only leaf free-edge EO gating. 333 whole-cube optimal is the exception: its Tronto h48 15G table is copied into the emscripten heap in chunks (not a shared mmap), independent of the Rust tables.'}</p>
            </article>
            <article className="solv-mem-card">
              <div className="solv-mem-tier"><Cpu size={13} strokeWidth={2} /> small</div>
              <div className="solv-mem-list">222 / 123 / 223 / eoline / dr / htr / htr2 / fr / pocket / pyraminx / skewb</div>
              <p>{zh
                ? '222/123/223 仅 mt_corn/mt_corn2/mt_edge2/mt_edge3 微移动表 (各家合计 <1MB);eoline/dr/htr/htr2/fr/pocket/pyraminx/skewb 零盘表。精确距离/剪枝表启动或首查时内存现场 BFS (htr 全空间 2,822,400 态 ~2.8MB, htr2 663,552 态 ~648KB, fr 3,456 陪集 ~3.4KB, pocket 独立 2x2x2 全空间 3,674,160 态 ~3.6MB + 移动表 ~132MB, pyraminx 核心 933,120 态 ~0.9MB + 移动表 ~29.9MB, skewb 整魔方 3,149,280 态 ~3.0MB 转移件级现算免移动表), 不落盘。无 GB 级依赖, 可与任意 huge 变体并发。'
                : '222/123/223 use only micro move tables (mt_corn/mt_corn2/mt_edge2/mt_edge3, <1MB each analyzer); eoline/dr/htr/htr2/fr/pocket/pyraminx/skewb need zero disk tables. Exact distance/prune tables are BFS-built in RAM at startup or first query (htr: full 2,822,400-state space, ~2.8MB; htr2: 663,552 states, ~648KB; fr: 3,456 cosets, ~3.4KB; pocket: the full standalone 2x2x2, 3,674,160 states, ~3.6MB + ~132MB move table; pyraminx: the 933,120-state core, ~0.9MB + ~29.9MB move table; skewb: the whole 3,149,280-state puzzle, ~3.0MB with piecewise transitions, no move table), never written to disk. No GB-scale dependency — runs alongside any huge variant.'}</p>
            </article>
            <article className="solv-mem-card solv-mem-wide">
              <div className="solv-mem-tier"><Cpu size={13} strokeWidth={2} /> {zh ? '并行' : 'parallelism'}</div>
              <p>{zh
                ? '每个分析器对整块任务跑 rayon par_iter 铺满 16 核; 表只读 mmap 跨进程共享。跨变体并发会各装一套不同的 GB 表 → 撞爆 32GB, 故串行。'
                : 'Each analyzer runs rayon par_iter over a whole chunk across all 16 cores; tables shared read-only via mmap. Running variants concurrently loads distinct GB-scale tables → blows past 32GB, so they run serially.'}</p>
            </article>
          </div>
        </section>

        {/* 每个求解器的表 */}
        <section className="solv-section">
          <header className="solv-sec-head">
            <Layers size={15} strokeWidth={2} />
            <h2>{zh ? '每个求解器的表' : 'Tables per analyzer'}</h2>
            <span className="solv-sec-note">{zh ? '源码核实 · full 全模式 · mmap' : 'source-verified · full mode · mmap'}</span>
          </header>
          <p className="solv-tbl-intro">{zh
            ? '展开看每个原生分析器实际 mmap 的移动表 (mt_*, 状态转移) 与剪枝表 (pt_*, 启发式下界); 大小为磁盘真实文件字节。'
            : 'Expand to see the move tables (mt_*, state transitions) and prune tables (pt_*, admissible heuristics) each native analyzer mmaps; sizes are the real on-disk file bytes.'}</p>
          <div className="solv-rows">
            {NATIVE.map((s) => {
              const t = TABLES[s.key];
              if (!t) return null;
              const hasCond = [...t.move, ...t.prune].some((x) => x.cond);
              const item = (x: Tbl) => (
                <div className={`solv-tbl-item${x.cond ? ' solv-tbl-item-cond' : ''}`} key={x.n}>
                  <span className="solv-tbl-name">{x.n}{x.cond ? <span className="solv-tbl-dag"> †</span> : null}</span>
                  <span className="solv-tbl-sz">{fmtBytes(x.b)}{x.cnt ? ` ×${x.cnt}` : ''}</span>
                </div>
              );
              return (
                <details className="solv-tbl" key={s.key}>
                  <summary className="solv-tbl-sum">
                    <span className="solv-row-name">{s.key}</span>
                    <span className="solv-tbl-tier">{s.tier}</span>
                    <span className="solv-tbl-total">{fmtBytes(tblTotal(t))}</span>
                  </summary>
                  <div className="solv-tbl-body">
                    <div className="solv-tbl-grp">
                      <div className="solv-tbl-grp-h">{zh ? '移动表 mt_*' : 'move tables mt_*'}</div>
                      {t.move.map(item)}
                    </div>
                    {t.prune.length > 0 && (
                      <div className="solv-tbl-grp">
                        <div className="solv-tbl-grp-h">{zh ? '剪枝表 pt_*' : 'prune tables pt_*'}</div>
                        {t.prune.map(item)}
                      </div>
                    )}
                    {(zh ? t.builtZh : t.builtEn) && <p className="solv-tbl-built">{zh ? t.builtZh : t.builtEn}</p>}
                    {hasCond && <p className="solv-tbl-note">{zh
                      ? `† 对角剪枝表 (10.2GB) 可选, 未计入上方总和; 设 ${s.key === 'pair' ? 'CUBE_PAIR_NO_DIAG' : 'CUBE_EO_NO_DIAG'}=1 跳过 (略损剪枝)。`
                      : `† diagonal prune table (10.2GB), optional, excluded from the total above; set ${s.key === 'pair' ? 'CUBE_PAIR_NO_DIAG' : 'CUBE_EO_NO_DIAG'}=1 to skip (weaker pruning).`}</p>}
                  </div>
                </details>
              );
            })}
          </div>
        </section>

        {/* 浏览器端 */}
        <section className="solv-section">
          <header className="solv-sec-head">
            <Globe size={15} strokeWidth={2} />
            <h2>{zh ? '浏览器端 WASM' : 'Browser WASM'}</h2>
            <span className="solv-sec-note">{zh ? 'gen 页现算, 每 worker 自带小表 (手机 2 / 桌面 4)' : 'live on gen page, per-worker small tables (mobile 2 / desktop 4)'}</span>
          </header>
          <div className="solv-browser">
            {BROWSER.map((b) => (
              <div className="solv-brow-row" key={b.key}>
                <span className="solv-brow-name">{b.key}</span>
                <span className="solv-brow-engine">{zh ? b.zhEngine : b.enEngine}</span>
                <span className="solv-brow-lat">{zh ? b.zhLatency : b.enLatency}</span>
              </div>
            ))}
          </div>
          <p className="solv-browser-note">
            {zh
              ? '浏览器装不下 GB 级 huge 表, 故深阶段 (xxxxcross) 比原生慢几个量级; 无 SharedArrayBuffer, worker 之间不共享表。常见比赛已由 comp_steps 预计算秒出, 现算只在未收录比赛兜底。'
              : 'Browsers cannot hold GB-scale huge tables, so deep stages (xxxxcross) are orders of magnitude slower than native; no SharedArrayBuffer means workers do not share tables. Common comps are served instantly from comp_steps precompute — live solve is only a fallback for uncovered comps.'}
          </p>
        </section>

        <footer className="solv-foot">
          <span>{zh
            ? `进度与日期实时取自 distribution.json (每次手动跑管道才刷新, 无定时); 吞吐/内存为 2026-05-30 实测常量。`
            : `Coverage & date are live from distribution.json (refreshes only when the pipeline is run by hand — no schedule); throughput/memory are measured constants from 2026-05-30.`}</span>
          <Link href="/code" className="solv-foot-link">/code</Link>
        </footer>
      </div>
    </div>
  );
}
