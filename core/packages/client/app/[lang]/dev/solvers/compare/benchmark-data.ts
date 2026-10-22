import type { Bilingual } from './comparison-data';
import { WCA_BENCHMARK } from './unified-benchmark';
import currentResults from './current-results.json';

export const NODE_COUNTER_DEFINITIONS = {
  'rust-context-visits-v1': {
    zh: 'Rust 搜索循环处理非空上下文的次数，包含叶检查；累加各深度和线程，重复访问重复计数。与原版计数口径不同。',
    en: 'Rust visits to non-empty search contexts, including leaf checks, summed across depths and threads. Repeated visits count again. Not equivalent to the original counter.',
  },
  'cube48opt-active-query-slots-v1': {
    zh: '原版 step1_query 的有效上下文槽位累计数，累加各深度和线程；不含叶检查与停用槽位。pnode 已包含在总数中。与 Rust 计数口径不同。',
    en: 'Original step1_query active context slots, summed across depths and threads; excludes leaf checks and inactive slots. Previous-depth pnode is already included. Not equivalent to the Rust counter.',
  },
  'nxopt-evals-v1': {
    zh: 'nxopt lookup6 启发式评估次数，累加全部打乱及搜索深度；不是统一的搜索节点定义，不能与 Rust 上下文计数直接等同。',
    en: 'Nxopt lookup6 heuristic evaluations, summed across scrambles and search depths; not a standardized node count or equivalent to Rust context visits.',
  },
} as const;

export type BenchmarkResult = {
  id: string; engine: string; date: string; seconds: number; peakRssBytes: number;
  processTreePeakRssBytes: number; nodes: number | null; verifiedSolutions: number;
  optimalLengthsMatched: number; compiler: string; cases: number; threads: number;
  nodeCounter: { value: number; definition: keyof typeof NODE_COUNTER_DEFINITIONS; cases: number; sourceField: string; rawSha256: string };
  continuation?: { completedCases: number; remainingCases: number; sessions: number; peakRssMethod: string };
};
export const CURRENT_RESULTS: readonly BenchmarkResult[] = currentResults as BenchmarkResult[];

export type Runtime = 'native' | 'wasm';
export type CohortId = 'opt8' | 'opt9' | 'opt10';
export const COHORTS = {
  opt10: { id: 'opt10', name: 'Opt10', tableBudgetGB: 32, cases: 1000, threads: 16, corpusSha256: WCA_BENCHMARK.corpusSha256 },
  opt8: { id: 'opt8', name: 'Opt8', tableBudgetGB: 8, cases: 100, threads: 4,
    corpusSha256: '92171d593d13982924ed16723f099bd771a873aaa2c30a0e08f319c86b75dcde' },
  opt9: { id: 'opt9', name: 'Opt9', tableBudgetGB: 16, cases: 1000, threads: 16,
    corpusSha256: WCA_BENCHMARK.corpusSha256 },
} as const;
export type Candidate = {
  id: string; name: string; implementation: string; runtime: Runtime;
  cohort: CohortId; tableGB: number; source: string; note: Bilingual; status?: Bilingual;
  archived?: boolean;
};

// Candidate configurations, not results. Table estimates are decimal GB.
// Sources: each project's README and cs0x7f/cube_solver_test (2026-10-14).
export const CANDIDATES: readonly Candidate[] = [
  { id: 'rust-opt8-native', name: 'CubeRoot Opt8', implementation: 'Rust', runtime: 'native', cohort: 'opt8', tableGB: 7.8,
    source: 'https://github.com/2017YANR02/cuberoot.me', note: {zh: '待测试', en: 'Pending benchmark'} },
  { id: 'rust-opt10-native', name: 'CubeRoot Opt10', implementation: 'Rust', runtime: 'native', cohort: 'opt10', tableGB: 31.1,
    source: 'https://github.com/2017YANR02/cuberoot.me', note: {zh: '正式版 · 本机 1000 条已验证', en: 'Official release · 1000 verified locally'} },
  { id: 'nissy-h10-native', name: 'Nissy H48 h10', implementation: 'C', runtime: 'native', cohort: 'opt10', tableGB: 30.3,
    source: 'https://github.com/sebastianotronto/nissy-core', note: {zh: '待测试 · 启动前核对专用表', en: 'Pending benchmark · table availability must be checked'} },
  { id: 'nxopt-23', name: 'nxopt 23', implementation: 'C++', runtime: 'native', cohort: 'opt10', tableGB: 22.7,
    source: 'https://github.com/rokicki/cube20src/blob/master/nxopt.md', note: {zh: '待测试 · 实际表约23G，需另行建表', en: 'Pending benchmark · approximately 23G table must be generated'} },
  { id: 'rust-opt8-wasm', name: 'CubeRoot Opt8', implementation: 'Rust → WASM', runtime: 'wasm', cohort: 'opt8', tableGB: 7.8,
    source: 'https://github.com/2017YANR02/cuberoot.me',
    note: { zh: '正式版 · 本机已测', en: 'Official release · measured locally' } },
  { id: 'rust-opt8-wasm-coset', name: 'CubeRoot Opt8 · coset', implementation: 'Rust → WASM', runtime: 'wasm', cohort: 'opt8', tableGB: 7.8,
    archived: true, // Retained in the downloadable evidence; omitted from the chart.
    source: 'https://github.com/2017YANR02/cuberoot.me',
    status: { zh: '实验变慢 · 未采用', en: 'Slower experiment · not promoted' },
    note: { zh: '100 条已验证 · 耗时增加，保留正式版', en: '100 verified · slower; official release retained' } },
  { id: 'cube48opt8-wasm', name: 'cube48opt8', implementation: 'Original WASM', runtime: 'wasm', cohort: 'opt8', tableGB: 7.8,
    source: 'https://github.com/cs0x7f/cubeopt-wasm',
    note: { zh: '本机 100 条已验证 · 私有 JS 线程兼容修复 · WASM 未改', en: '100 verified locally · private JS thread compatibility fix · unchanged WASM' } },
  { id: 'rust-opt-9', name: 'CubeRoot Opt9', implementation: 'Rust', runtime: 'native', cohort: 'opt9', tableGB: 15.6,
    source: 'https://github.com/2017YANR02/cuberoot.me',
    note: { zh: '正式版 · 本轮已测', en: 'Official release · measured this run' } },
  { id: 'cube48opt-native', name: 'cube48opt9', implementation: 'C++', runtime: 'native', cohort: 'opt9', tableGB: 15.6,
    source: 'https://github.com/cs0x7f/cube_solver_test',
    note: { zh: '公开基准有记录 · 闭源', en: 'Listed in public benchmarks · closed source' } },
  { id: 'h48-h9', name: 'Nissy H48 h9', implementation: 'C', runtime: 'native', cohort: 'opt9', tableGB: 15.2,
    source: 'https://github.com/sebastianotronto/nissy-core',
    note: { zh: '独立剪枝表 · 本机无表', en: 'Independent pruning tables · table unavailable locally' } },
  { id: 'vcube-208', name: 'vcube 208', implementation: 'C++ · x86', runtime: 'native', cohort: 'opt9', tableGB: 7.8,
    source: 'https://github.com/Voltara/vcube',
    note: { zh: '原版依赖 AVX2 / BMI2 · Mac ARM 适配未验证', en: 'Requires AVX2 / BMI2 · Mac ARM port unverified' } },
  { id: 'nxopt-22', name: 'nxopt 22', implementation: 'C++', runtime: 'native', cohort: 'opt8', tableGB: 7.8,
    source: 'https://github.com/rokicki/cube20src/blob/master/nxopt.md',
    note: { zh: '100 条已验证 · 4 线程跨打乱并行 · 8G 表', en: '100 verified · 4 threads across scrambles · 8G table' } },
  { id: 'rust-opt9-wasm-batch', name: 'CubeRoot Opt9', implementation: 'Rust → WASM', runtime: 'wasm', cohort: 'opt9', tableGB: 15.6,
    source: 'https://github.com/2017YANR02/cuberoot.me',
    note: { zh: '本轮最快 · 1000 条已验证', en: 'Fastest this round · 1000 verified' } },
  { id: 'rust-opt9-wasm-padded', name: 'CubeRoot Opt9 · padded', implementation: 'Rust → WASM', runtime: 'wasm', cohort: 'opt9', tableGB: 15.6,
    archived: true,
    source: 'https://github.com/2017YANR02/cuberoot.me',
    note: { zh: '实验归档 · 1000 条已验证', en: 'Archived experiment · 1000 verified' } },
  { id: 'rust-opt9-wasm-batch-padded', name: 'CubeRoot Opt9 · batch-padded', implementation: 'Rust → WASM', runtime: 'wasm', cohort: 'opt9', tableGB: 15.6,
    archived: true,
    source: 'https://github.com/2017YANR02/cuberoot.me',
    note: { zh: '实验归档 · 1000 条已验证', en: 'Archived experiment · 1000 verified' } },
  { id: 'rust-opt9-wasm-select', name: 'CubeRoot Opt9 · select', implementation: 'Rust → WASM', runtime: 'wasm', cohort: 'opt9', tableGB: 15.6,
    archived: true,
    source: 'https://github.com/2017YANR02/cuberoot.me',
    note: { zh: '实验归档 · 1000 条已验证', en: 'Archived experiment · 1000 verified' } },
  { id: 'rust-opt9-wasm-quarter', name: 'CubeRoot Opt9 · quarter-fixed', implementation: 'Rust → WASM', runtime: 'wasm', cohort: 'opt9', tableGB: 15.6,
    archived: true,
    source: 'https://github.com/2017YANR02/cuberoot.me',
    note: { zh: '补齐 Opt9 等价剪枝 · 本轮已测', en: 'Opt9 equivalent-branch pruning enabled · measured' } },
  { id: 'rust-opt9-wasm-coset', name: 'CubeRoot Opt9 · coset', implementation: 'Rust → WASM', runtime: 'wasm', cohort: 'opt9', tableGB: 15.6,
    archived: true,
    source: 'https://github.com/2017YANR02/cuberoot.me',
    status: { zh: '内存保护停止', en: 'Memory protection stopped run' },
    note: { zh: '加载时触发内存保护 · 0 / 1000 · 无成绩', en: 'Memory protection during loading · 0 / 1000 · no score' } },
  { id: 'rust-opt9-wasm', name: 'CubeRoot Opt9 · baseline', implementation: 'Rust → WASM', runtime: 'wasm', cohort: 'opt9', tableGB: 15.6,
    archived: true,
    source: 'https://github.com/2017YANR02/cuberoot.me',
    note: { zh: '本轮 1000 条已验证', en: '1000 verified this run' } },
  { id: 'cube48opt-wasm', name: 'cube48opt9', implementation: 'Original WASM', runtime: 'wasm', cohort: 'opt9', tableGB: 15.6,
    source: 'https://github.com/cs0x7f/cubeopt-wasm',
    note: { zh: 'JS 线程兼容修复 · WASM 未改 · 断点续测完成', en: 'JS thread compatibility fix · unchanged WASM · resumed and completed' } },
];

const opt9 = WCA_BENCHMARK.results.find(row => row.id === 'rust-opt-9')!;
export const LOCAL_BASELINE = {
  ...opt9, release: 'opt9-fixed-20261014', date: '2026-10-14',
  nodes: 9811462269, probes: 12474177360, verified: 1000,
  reportSha256: 'b1b3e79da609c23a317946bd1c8fb5dca83a92033af3ca114178bd6281c8f262',
  executableSha256: '3314f88daaf8be5423ae862e359c98fc741a0f9ea8bbd9695f45fd474eb857a9',
  evidence: 'wca1000-mt16-rust-native-opt9-exp-fixed-report.json',
};

// Only complete local runs; never infer scores from another machine or runtime.
export const BENCHMARK_MANIFEST = {
  schema: 'cuberoot.optimal-benchmark.v2', status: 'local-measurements',
  puzzle: '3x3x3', metric: 'HTM', cohorts: COHORTS,
  machine: 'Apple M5 Pro · macOS', passes: 1, warmupCases: 0,
  timing: 'Solve time excluding table initialization and independent verification',
  ranking: 'Compare total batch elapsed solve time within one cohort and runtime under the same thread budget; allow parallelism within or across scrambles. Do not sum overlapping per-scramble times or interpret batch results as single-state latency.',
  memory: 'Table budget; report solver and whole-process-tree peak RSS separately',
  currentRunResults: currentResults, candidates: CANDIDATES,
  nodeCounters: {
    definitions: NODE_COUNTER_DEFINITIONS,
    comparability: 'Engine-specific diagnostics, not a cross-engine node reduction or throughput ranking. Final-depth work can vary with thread scheduling.',
    originalExtraction: 'One final Cube finished N/M node(s) summary per retained case: N is active query slots; M is inactive slots. pnode is a subset of N, never added to it.',
  },
  incompleteRuns: [{ id: 'rust-opt9-wasm-coset', cohort: 'opt9', completedCases: 0, plannedCases: 1000,
    reason: 'Memory protection: Swapouts increased from 16 to 48 during table loading',
    phase: 'table-loading', stoppedAt: '2026-10-15T06:59:36.852Z', performanceResult: false }],
  continuation: { id: 'cube48opt-wasm', retainedCases: 431, continuedCases: 569, sessions: 2,
    timing: 'Sum of 1000 completed calls; first 431 retained without rerunning; failed attempt and reload excluded',
    limitation: 'Two sessions, unlike the uninterrupted Rust runs. No repeated-run noise estimate.',
    memory: 'Original solver peak is a conservative upper bound using the first segment process-tree peak' },
};
