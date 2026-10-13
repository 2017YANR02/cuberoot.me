/**
 * Published snapshot of local research; no solver, table loading or benchmarks run here.
 * Evidence: solver/experiments/cube48opt-rust/benchmark-results.md and
 * .tmp/cubeopt-reverse/{benchmark-generic-opt1..8,benchmark-opt9-full60,
 * h10-benchmark-full60,native-rss-report.json} (retained locally).
 * H48 sizes: pinned nissy-core gendata_types_macros.h + gendata_h48.h.
 * A code-supported tier is not a generated/validated table or a measured solver.
 */
export type Bilingual = { zh: string; en: string };
export type Family = 'opt' | 'nissy' | 'rust';
export type GroupId = 'opt18' | 'opt9-60' | 'h10-60';
export type SolverComparisonRow = {
  id: string;
  label: string;
  family: Family;
  eoBits: number;
  /** Total file data required: main table plus auxiliary tables and headers. */
  tableBytes: number;
  mainTableBytes: number;
  auxiliaryBytes: number;
  nativeRssBytes: number | null;
  status: Bilingual;
  statusKind: 'measured' | 'table-ready' | 'source-supported' | 'code-only';
  measurements: readonly { groupId: GroupId; seconds: number }[];
  note: Bilingual;
};
export type BenchmarkComparison = {
  id: string;
  label: string;
  tableBytes: number;
  originalLabel: string;
  rustSeconds: number;
  originalSeconds: number;
  originalRssBytes: number | null;
  rustRssBytes: number | null;
  ratio: number;
};
export type BenchmarkGroup = {
  id: GroupId;
  label: Bilingual;
  description: Bilingual;
  cases: number;
  rounds: number;
  comparisons: readonly BenchmarkComparison[];
};

export const SNAPSHOT_DATE = '2026-10-12';
export const IMPLEMENTATION_DATE = '2026-10-13';
export const BENCHMARK_MACHINE = 'Apple M5 Pro';
export const BENCHMARK_BINARY_HASHES = {
  rustOpt: 'a8e64b19f79edf54ba0021a44702c7fe378d1637b1c917c77a022f9939a48d55',
  rustH10: 'e8b2c919087006bdcd51b76f7bdbe13a294b538c2a69058d4593fa107099d8a0',
  originalH10: '46d201e856901a1b6ebe06ceec51b438620ff27530343c7b3bd569fec14ee501',
} as const;
export const SOURCE_LINKS = [
  { label: 'cubeopt-wasm', href: 'https://github.com/cs0x7f/cubeopt-wasm/tree/1733d1f1ca0e7e7d9860d2b70662336ab4e6ff41' },
  { label: 'Nissy H48', href: 'https://github.com/sebastianotronto/nissy-core/tree/1f7e8e937d0e71e7eb3b5deab38b34d0a0159d88' },
  { label: 'CubeRoot', href: 'https://github.com/2017YANR02/cuberoot.me/blob/main/solver/experiments/cube48opt-rust/benchmark-results.md' },
] as const;

// [tier, PDB bytes, small-table bytes, native RSS bytes, WASM seconds, Rust seconds]
// RSS: /usr/bin/time -l on two complete HTM 15/16 historical inputs per tier.
// Timing: independent repeated protocols defined by BENCHMARK_GROUPS below.
const OPT_RECORDS = [
  [1, 30401280, 816856, 37486592, 3.502674, 3.248305876],
  [2, 121605120, 816952, 127516672, 0.377631, 0.326758918],
  [3, 243210240, 816952, 249118720, 0.202577, 0.178435251],
  [4, 486420480, 816952, 491274240, 0.594701, 0.546997543],
  [5, 972840960, 816952, 977698816, 0.395669, 0.358938792],
  [6, 1945681920, 816952, 1950547968, 0.220497, 0.189309332],
  [7, 3891363840, 816952, 3896197120, 0.105117, 0.083801087],
  [8, 7782727680, 818008, 7786528768, 0.084411, 0.059918873],
  [9, 15565455360, 818008, 15569256448, 60.718842, 52.117762],
] as const;

// Current 2-bit H48 file format, not the obsolete 4-bit table estimates.
export const H48_AUXILIARY_BYTES = 2060648;
export function h48TableBytes(h: number): number {
  if (!Number.isInteger(h) || h < 0 || h > 11) throw new RangeError('H48 h must be 0..11');
  return 64 * Math.ceil((3393 * 34650 * 2 ** h) / 254) + H48_AUXILIARY_BYTES;
}

const optRows: SolverComparisonRow[] = OPT_RECORDS.map(([tier, main, auxiliary, , seconds]) => ({
  id: `opt-${tier}`,
  label: `Opt${tier}`,
  family: 'opt',
  eoBits: tier === 1 ? 0 : tier,
  tableBytes: main + auxiliary,
  mainTableBytes: main,
  auxiliaryBytes: auxiliary,
  nativeRssBytes: null,
  status: { zh: '已有实测', en: 'Measured' },
  statusKind: 'measured',
  measurements: [{ groupId: tier === 9 ? 'opt9-60' : 'opt18', seconds }],
  note: {
    zh: 'csTimer 作者的固定 WASM，在本机 Node 中测试；不是浏览器整页性能。表已生成并验解。WASM 独立进程峰值未测；对应 Rust Opt 的内存与速度在下方性能组中单独列出。',
    en: 'Pinned WASM by the csTimer author, tested in local Node, not a browser-page benchmark. Tables and solutions were checked. Standalone WASM peak RSS was not measured; the corresponding Rust Opt results appear separately in the benchmark groups below.',
  },
}));

const hRows: SolverComparisonRow[] = (['nissy', 'rust'] as const).flatMap((family) =>
  Array.from({ length: 12 }, (_, h): SolverComparisonRow => {
    const isRust = family === 'rust';
    const measured = h === 10;
    const tableReady = !isRust && h === 7;
    const tableBytes = h48TableBytes(h);
    return {
      id: `${family}-h${h}`,
      label: `${isRust ? 'Rust ' : ''}H${h}`,
      family,
      eoBits: h,
      tableBytes,
      mainTableBytes: tableBytes - H48_AUXILIARY_BYTES,
      auxiliaryBytes: H48_AUXILIARY_BYTES,
      nativeRssBytes: measured ? (isRust ? 30342217728 : 30342397952) : null,
      statusKind: measured ? 'measured' : isRust ? 'code-only' : tableReady ? 'table-ready' : 'source-supported',
      status: measured
        ? { zh: '已有实测', en: 'Measured' }
        : isRust
          ? { zh: '代码已实现 · 未实测', en: 'Implemented · not measured' }
          : tableReady
            ? { zh: '本机已有表 · 未计时', en: 'Local table · not timed' }
            : { zh: '源码支持 · 本机无表', en: 'Source supported · no local table' },
      measurements: measured ? [{ groupId: 'h10-60', seconds: isRust ? 36.782246953 : 57.605142 }] : [],
      note: isRust
        ? measured
          ? {
            zh: '复用同一张 Nissy H10 表；数据来自泛化前已验收的固定 Rust H10 版本。H0～H11 泛化版仅做编译与小数据校验，未重新计时。',
            en: 'Reuses the same Nissy H10 file. Measurements belong to the verified Rust H10 build before generalization. The H0–H11 generalization has compile and small-data checks only; it has not been retimed.',
          }
          : h === 11
            ? {
              zh: '仅实现代码并做小数据校验。按维护者要求，本机入口禁止加载、建表及求解 H11；没有 H11 实测结果。60.67 GB 为文件数据大小，不是整机内存需求。',
              en: 'Code and small-data checks only. By maintainer request, local entry points refuse H11 loading or solving; no H11 table generation or benchmark was run. 60.67 GB describes file data, not total machine requirements.',
            }
            : {
              zh: '共用 Rust H48 后端已泛化到该档位；没有使用此档真实表验解或计时，不以 Rust Opt 同编号结果替代。文件大小由固定上游格式精确计算。',
              en: 'The shared Rust H48 backend implements this tier, but has no real-table solve validation or timing for it. A matching Rust Opt number is not a substitute. File size is calculated exactly from the pinned upstream format.',
            }
        : measured
          ? { zh: '未修改的原 C 搜索器，同表、单线程；60 例完整预热后正式测三轮。', en: 'Unmodified original C search, same table and one solving thread; three measured rounds after full 60-case warmup.' }
          : tableReady
            ? { zh: '本机 H7 表已生成并校验，但没有本页口径的求解性能记录。', en: 'A generated and checked H7 table exists locally, but no solving benchmark under this page’s protocol is available.' }
            : { zh: '64 位原版源码支持此档；大小由当前两位压缩格式计算，不表示已在本机生成或运行。', en: 'Supported by the 64-bit original source. Size follows the current 2-bit format; it does not imply local generation or execution.' },
    };
  }),
);

export const COMPARISON_ROWS: readonly SolverComparisonRow[] = [...optRows, ...hRows];

const optComparisons: BenchmarkComparison[] = OPT_RECORDS.map(([tier, main, auxiliary, rss, originalSeconds, rustSeconds]) => ({
  id: `opt-${tier}`,
  label: `Opt${tier}`,
  tableBytes: main + auxiliary,
  originalLabel: 'WASM',
  rustSeconds,
  originalSeconds,
  originalRssBytes: null,
  rustRssBytes: rss,
  ratio: originalSeconds / rustSeconds,
}));

export const BENCHMARK_GROUPS: readonly BenchmarkGroup[] = [
  {
    id: 'opt18',
    label: { zh: 'Opt1～8 · 18 例', en: 'Opt1–8 · 18 cases' },
    description: {
      zh: '16 条历史打乱的前 14 步，加全部两条 15～16 步完整历史状态。两引擎常驻、逐例交替，预热一轮后正式三轮。同机、同档表、单线程。较大档总耗时很短，比例容易受噪声影响；不能与 60 例组横向比较。',
      en: 'Fourteen-move prefixes from 16 historical scrambles plus both complete historical states at distances 15–16. Persistent engines alternate per case, with one excluded warmup and three measured rounds, on the same Mac, tier and single thread. Larger tiers take very little time, making ratios sensitive to noise. Do not compare these totals with the 60-case groups.',
    },
    cases: 18,
    rounds: 3,
    comparisons: optComparisons.filter((row) => row.id !== 'opt-9'),
  },
  {
    id: 'opt9-60',
    label: { zh: 'Opt9 · 完整 60 例', en: 'Opt9 · all 60 cases' },
    description: {
      zh: '全部 60 条 HTM 15～19 步历史状态，原顺序保留。每批新进程，完整预热 60 例，整批先后交替；首轮和逐进程预热排除，正式三轮。同表单线程，Rust 为 8 个交错上下文。960 次求解验解通过。',
      en: 'All 60 historical states at HTM distances 15–19 in original order. Each batch uses a fresh process and full-corpus warmup; whole-engine order alternates. The first round and process warmups are excluded from the three measured rounds. Same table and one solving thread; Rust uses eight interleaved contexts. All 960 solutions were verified.',
    },
    cases: 60,
    rounds: 3,
    comparisons: optComparisons.filter((row) => row.id === 'opt-9'),
  },
  {
    id: 'h10-60',
    label: { zh: 'H10 · 完整 60 例', en: 'H10 · all 60 cases' },
    description: {
      zh: '原 C H10 与泛化前的 Rust H10，复用同一个 30.34 GB 文件。每批新进程、完整 60 例预热、整批先后交替；排除首轮，正式三轮。双方单求解线程，一次仅驻留一个引擎。960 次求解验解通过。与 Opt9 来自不同批次，不能据此直接排名。',
      en: 'Original C H10 versus Rust H10 before generalization, reusing one 30.34 GB file. Fresh processes, full 60-case warmup and alternating batch order; the first round is excluded from three measured rounds. Both use one solving thread, with only one engine resident at a time. All 960 solutions were verified. This was a separate run from Opt9 and is not a direct cross-tier ranking.',
    },
    cases: 60,
    rounds: 3,
    comparisons: [{
      id: 'h10',
      label: 'H10',
      tableBytes: h48TableBytes(10),
      originalLabel: 'C',
      rustSeconds: 36.782246953,
      originalSeconds: 57.605142,
      originalRssBytes: 30342397952,
      rustRssBytes: 30342217728,
      ratio: 57.605142 / 36.782246953,
    }],
  },
];
