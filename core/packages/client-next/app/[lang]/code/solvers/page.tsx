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
  rate: number; // tasks/sec, native, 16 核 (curated, 2026-05-30 实测; f2leo 系 2026-05-31)
  tier: 'huge' | 'mid' | 'small';
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
  { key: '222', stages: 1, fbRows: 1_297_444, rate: 1_250_000, tier: 'small', zhWhy: '2x2x2 块 (1 角 + 3 棱) 全空间仅 253,440 态, 精确距离表直查零搜索', enWhy: '2x2x2 block (corner + 3 edges) — 253,440 states total, exact distance table lookup, zero search' },
  { key: '123', stages: 2, fbRows: 1_297_444, rate: 600_000, tier: 'small', zhWhy: 'Roux 第一块: 1x2x2 方块 (1角+2棱, 前/后双微表) + 1x2x3 (2角+3棱, 5,322,240 态全表), 精确距离表直查零搜索', enWhy: 'Roux first block: 1x2x2 square (corner + 2 edges, front/back micro-tables) + 1x2x3 (2 corners + 3 edges, 5,322,240-state full table) — exact lookups, zero search' },
  { key: '223', stages: 1, fbRows: 1_297_444, rate: 19_000, tier: 'small', zhWhy: 'Petrus 2x2x3 (2角+5棱) 全空间 ~1.5G 态放不下全表, IDA* + max(1x2x3 全表, 角2+DB/DF 表) 可采纳下界', enWhy: 'Petrus 2x2x3 (2 corners + 5 edges) — 1.5G states, too big for a full table; IDA* with admissible h = max(1x2x3 full table, corners+DB/DF table)' },
  { key: 'eoline', stages: 2, fbRows: 1_297_444, rate: 350_000, tier: 'small', zhWhy: 'EO (2,048 态) + EOLine (294,912 态) 全空间微表, 零外部表, 精确距离直查零搜索', enWhy: 'EO (2,048 states) + EOLine (294,912 states) full-space micro-tables, zero external tables — exact lookups, zero search' },
  { key: 'dr', stages: 1, fbRows: 1_297_444, rate: 12_000, tier: 'small', zhWhy: 'DR (Kociemba phase-1) 全空间 ~2.2G 态, IDA* + max(eo×slice, co×slice) 双 ~1M 精确表, 全现场建零外部表', enWhy: 'DR (Kociemba phase 1) — ~2.2G states; IDA* with admissible h = max(eo×slice, co×slice), two ~1M exact tables built in RAM, zero external tables' },
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
  { key: '2x2x2 block', zhEngine: 'Block222SolverWasm (~0.7MB/worker)', enEngine: 'Block222SolverWasm (~0.7MB/worker)', zhLatency: '全 6 视角即时', enLatency: 'all 6 views instant' },
  { key: '1x2x3 / 2x2x3', zhEngine: 'Roux223SolverWasm (~0.8MB/worker)', enEngine: 'Roux223SolverWasm (~0.8MB/worker)', zhLatency: '方块/2x2x2 即时; 1x2x3 与 2x2x3 首算建表 ~秒级', enLatency: 'square/2x2x2 instant; 1x2x3 & 2x2x3 build tables on first solve (~seconds)' },
  { key: '1x2x3 ×2', zhEngine: 'Roux223SolverWasm 轻档 (免 2.68G 大表)', enEngine: 'Roux223SolverWasm light tier (no 2.68G table)', zhLatency: '单格 毫秒~秒级; 解法枚举 数秒~数十秒', enLatency: 'per-cell ms–seconds; solution enumeration seconds to tens of seconds' },
  { key: 'EO / EOLine / DR', zhEngine: 'EoDrSolverWasm (零表下载, 微表现场建)', enEngine: 'EoDrSolverWasm (zero downloads, micro-tables built in-browser)', zhLatency: 'EO/EOLine 即时; DR 首算建表 ~1s 后毫秒级', enLatency: 'EO/EOLine instant; DR builds tables on first solve (~1s), then ms' },
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
            <div className="solv-stat"><span className="solv-stat-num">~34<small>GB</small></span><span className="solv-stat-label">{zh ? '剪枝表' : 'pruning tables'}</span></div>
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
            {NATIVE.map((s) => {
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
            {[...NATIVE].sort((a, b) => b.rate - a.rate).map((s) => (
              <div className="solv-perf" key={s.key}>
                <div className="solv-perf-top">
                  <span className="solv-row-name">{s.key}</span>
                  <span className="solv-perf-rate">{s.rate >= 10000 ? `${(s.rate / 1e6).toFixed(2)}M` : s.rate}<small> /s</small></span>
                </div>
                <div className="solv-bar">
                  <div className="solv-bar-fill solv-fill-rate" style={{ width: `${rateBarPct(s.rate)}%` }} />
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
              <div className="solv-mem-list">std / eo / pseudo / pseudo_pair / pair / f2leo / pseudo_f2leo</div>
              <p>{zh
                ? 'mmap GB 级联合/电池剪枝表 (CEE/CCE/C4C5C6 / pair huge / E0E1E2 等)。eo 工作集峰值 ~24GB, 但 private 仅 ~0.1GB — 表是只读共享 mmap。f2leo 复用 std 的 pair huge 表 (各 ~10GB);pseudo_f2leo 用 pseudo 电池 (corner3 862MB + edge3 1GB 等), 各仅多叶子自由棱 EO 门控。'
                : 'GB-scale joint/battery prune tables (CEE/CCE/C4C5C6 / pair huge / E0E1E2) via mmap. eo peaks ~24GB working set but only ~0.1GB private — read-only shared mmap. f2leo reuses std pair huge tables (~10GB each); pseudo_f2leo uses the pseudo battery (corner3 862MB + edge3 1GB), each adding only leaf free-edge EO gating.'}</p>
            </article>
            <article className="solv-mem-card">
              <div className="solv-mem-tier"><Cpu size={13} strokeWidth={2} /> small</div>
              <div className="solv-mem-list">222</div>
              <p>{zh
                ? '仅 mt_edge3 (743KB) + mt_corn (1.7KB) 两张移动表;全空间精确距离表 (~248KB) 启动时内存现场 BFS, 不落盘。无 GB 级依赖, 可与任意 huge 变体并发。'
                : 'Only mt_edge3 (743KB) + mt_corn (1.7KB) move tables; the exact full-space distance table (~248KB) is BFS-built in RAM at startup, never written to disk. No GB-scale dependency — runs alongside any huge variant.'}</p>
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
