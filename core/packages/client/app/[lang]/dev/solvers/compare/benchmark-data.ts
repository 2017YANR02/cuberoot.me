import type { Bilingual } from './comparison-data';
import { WCA_BENCHMARK } from './unified-benchmark';
import currentResults from './current-results.json';

export type BenchmarkResult = {
  id: string; engine: string; date: string; seconds: number; peakRssBytes: number;
  processTreePeakRssBytes: number; nodes: number | null; verifiedSolutions: number;
  optimalLengthsMatched: number; compiler: string; cases: number; threads: number;
  continuation?: { completedCases: number; remainingCases: number; sessions: number; peakRssMethod: string };
};
export const CURRENT_RESULTS: readonly BenchmarkResult[] = currentResults;

export type Runtime = 'native' | 'wasm';
export type CohortId = 'opt8' | 'opt9';
export const COHORTS = {
  opt8: { id: 'opt8', name: 'Opt8', tableBudgetGB: 8, cases: 100, threads: 4,
    corpusSha256: '92171d593d13982924ed16723f099bd771a873aaa2c30a0e08f319c86b75dcde' },
  opt9: { id: 'opt9', name: 'Opt9', tableBudgetGB: 16, cases: 1000, threads: 16,
    corpusSha256: WCA_BENCHMARK.corpusSha256 },
} as const;
export type Candidate = {
  id: string; name: string; implementation: string; runtime: Runtime;
  cohort: CohortId; tableGB: number; source: string; note: Bilingual;
};

// Candidate configurations, not results. Table estimates are decimal GB.
// Sources: each project's README and cs0x7f/cube_solver_test (2026-10-14).
export const CANDIDATES: readonly Candidate[] = [
  { id: 'rust-opt8-wasm', name: 'CubeRoot Opt8', implementation: 'Rust → WASM', runtime: 'wasm', cohort: 'opt8', tableGB: 7.8,
    source: 'https://github.com/2017YANR02/cuberoot.me',
    note: { zh: '正式版 · 本机已测', en: 'Official release · measured locally' } },
  { id: 'cube48opt8-wasm', name: 'cube48opt 8', implementation: 'Original WASM', runtime: 'wasm', cohort: 'opt8', tableGB: 7.8,
    source: 'https://github.com/cs0x7f/cubeopt-wasm',
    note: { zh: '本机尚无同条件结果', en: 'No matched local result yet' } },
  { id: 'rust-opt-9', name: 'CubeRoot Opt9', implementation: 'Rust', runtime: 'native', cohort: 'opt9', tableGB: 15.6,
    source: 'https://github.com/2017YANR02/cuberoot.me',
    note: { zh: '正式版 · 本轮已测', en: 'Official release · measured this run' } },
  { id: 'cube48opt-native', name: 'cube48opt 9', implementation: 'C++', runtime: 'native', cohort: 'opt9', tableGB: 15.6,
    source: 'https://github.com/cs0x7f/cube_solver_test',
    note: { zh: '公开基准有记录 · 原生源码尚未取得', en: 'Listed in public benchmarks · native source not obtained' } },
  { id: 'h48-h9', name: 'Nissy H48 h9', implementation: 'C', runtime: 'native', cohort: 'opt9', tableGB: 15.2,
    source: 'https://github.com/sebastianotronto/nissy-core',
    note: { zh: '独立剪枝表 · 本机无表', en: 'Independent pruning tables · table unavailable locally' } },
  { id: 'vcube-208', name: 'vcube 208', implementation: 'C++ · x86', runtime: 'native', cohort: 'opt9', tableGB: 7.8,
    source: 'https://github.com/Voltara/vcube',
    note: { zh: '原版依赖 AVX2 / BMI2 · Mac ARM 适配未验证', en: 'Requires AVX2 / BMI2 · Mac ARM port unverified' } },
  { id: 'nxopt-22', name: 'nxopt 22', implementation: 'C++', runtime: 'native', cohort: 'opt9', tableGB: 7.8,
    source: 'https://github.com/rokicki/cube20src/blob/master/nxopt.md',
    note: { zh: '跨状态并行 · 单状态延迟榜不适用', en: 'Parallel across states · ineligible for single-state latency ranking' } },
  { id: 'rust-opt9-wasm-quarter', name: 'CubeRoot Opt9 · quarter-fixed', implementation: 'Rust → WASM', runtime: 'wasm', cohort: 'opt9', tableGB: 15.6,
    source: 'https://github.com/2017YANR02/cuberoot.me',
    note: { zh: '补齐 Opt9 等价剪枝 · 本轮已测', en: 'Opt9 equivalent-branch pruning enabled · measured' } },
  { id: 'rust-opt9-wasm', name: 'CubeRoot Opt9 · baseline', implementation: 'Rust → WASM', runtime: 'wasm', cohort: 'opt9', tableGB: 15.6,
    source: 'https://github.com/2017YANR02/cuberoot.me',
    note: { zh: '本轮 1000 条已验证', en: '1000 verified this run' } },
  { id: 'cube48opt-wasm', name: 'cube48opt 9', implementation: 'Original WASM', runtime: 'wasm', cohort: 'opt9', tableGB: 15.6,
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
  ranking: 'Compare only within one cohort and runtime; keep batch throughput and single-state latency separate',
  memory: 'Table budget; report solver and whole-process-tree peak RSS separately',
  currentRunResults: currentResults, candidates: CANDIDATES,
  incompleteRuns: [],
  continuation: { id: 'cube48opt-wasm', retainedCases: 431, continuedCases: 569, sessions: 2,
    timing: 'Sum of 1000 completed calls; first 431 retained without rerunning; failed attempt and reload excluded',
    limitation: 'Two sessions, unlike the uninterrupted Rust runs. No repeated-run noise estimate.',
    memory: 'Original solver peak is a conservative upper bound using the first segment process-tree peak' },
};
