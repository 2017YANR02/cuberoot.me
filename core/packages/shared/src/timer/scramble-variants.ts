import { countQtm } from '../scramble_length';

export { bestErgonomicOrientationIndex, bestStageSolverY, rotateMovesToFrame, rotateSolutionY, Y_ROT_LABEL } from './stage-solver-orientation';
export { formatStageSolverBytes, STAGE_SOLVER_INFO_TITLE, stageSolverInfoModel, summarizeStageSolverTables,
  type StageSolverTableSize } from './stage-solver-info';

// 打乱分析「变体 + 阶段」的 runtime-neutral 单一真源:变体 key → 显示名(zh/en)+ 规范展示顺序 +
// 每变体的规范阶段键序 + 阶段显示名。
//
// 共用方:首页 RecentScrambles / /scramble/stats / /scramble/gen / /scramble/analyzer
// (StageSolver + CFOP 枚举器)。新增变体/阶段只在这里加,别再各页写一份。
//
// 注:这些下拉按 `isZh ? 'zh' : 'en'` 取名(简体 / 英文双语)。

// 'block'(砖)是 UI 聚合方法:把数据层 4 个块变体(123/123x2/222/223)收进一个
// 方法下拉项,块的具体形状落到阶段下拉(122/123/222/223/F2B)。数据键不变。
export type ScrambleVariant =
  | 'std' | 'lbl' | 'daisy' | 'first_layer' | 'second_layer' | 'eo' | 'pair' | 'pseudo' | 'pseudo_pair' | 'f2leo' | 'pseudo_f2leo'
  | 'block' | '123' | '123x2' | '222' | '223' | 'eoline' | 'dr' | 'htr' | 'htr2' | 'fr'
  | '333';

export interface VariantLabel { zh: string; en: string }

export const VARIANT_LABEL: Record<ScrambleVariant, VariantLabel> = {
  // 整解:整个 3x3 最优解(stats 难度 tab 的一个方法,阶段只有 '333' 自身)。
  '333': { zh: '整体', en: 'Full' },
  std: { zh: '标准', en: 'Standard' },
  // UI 聚合方法:Daisy / First Face / First Layer / Second Layer 都收进 LBL。
  lbl: { zh: '层先', en: 'LBL' },
  daisy: { zh: '小花', en: 'Daisy' },
  first_layer: { zh: '底层', en: 'First Layer' },
  second_layer: { zh: '第二层', en: 'Second Layer' },
  eo: { zh: 'EO', en: 'EO' },
  pair: { zh: '基态', en: 'Pair' },
  pseudo: { zh: '伪', en: 'Pseudo' },
  pseudo_pair: { zh: '伪基态', en: 'Pseudo Pair' },
  f2leo: { zh: 'F2LEO', en: 'F2LEO' },
  pseudo_f2leo: { zh: '伪 F2LEO', en: 'Pseudo F2LEO' },
  block: { zh: '砖', en: 'Block' },
  // 数据层块变体(不进方法下拉,留作 key 兜底显示)
  '123': { zh: '123', en: '123' },
  '123x2': { zh: 'F2B', en: 'F2B' },
  '222': { zh: '222', en: '222' },
  '223': { zh: '223', en: '223' },
  eoline: { zh: 'EOLine', en: 'EOLine' },
  dr: { zh: 'DR', en: 'DR' },
  // 条件式阶段(输入须已处于该视角 DR,否则 '-'):只进 StageSolver,不进 VARIANT_ORDER。
  htr: { zh: 'HTR', en: 'HTR' },
  // 条件式阶段(输入须已处于该视角 HTR,否则 '-',G3→solved):同样只进 StageSolver,不进 VARIANT_ORDER。
  htr2: { zh: 'HTR 收尾', en: 'HTR-finish' },
  // 条件式阶段(输入须已处于该视角 HTR,否则 '-',HTR→FR):同样只进 StageSolver,不进 VARIANT_ORDER。
  fr: { zh: 'Floppy 还原', en: 'Floppy Reduction' },
};

// 规范展示顺序(RecentScrambles / gen 下拉用;stats 按 distribution.json 键枚举序,不用这个)。
// 块族只出 'block' 一项;EOLine 并入 'eo' 一项(见下)。
export const VARIANT_ORDER: ScrambleVariant[] = [
  '333',
  'std', 'lbl', 'pseudo', 'pair', 'pseudo_pair', 'eo', 'f2leo', 'pseudo_f2leo',
  'block', 'dr',
];

// LBL 是 UI 聚合方法:数据分别落 daisy / first_layer / second_layer。
// second_layer 只属于「第一层已还原」条件状态集，不是 WCA / XXXXCross 的别名。
export const LBL_DATA_VARIANTS = ['daisy', 'first_layer', 'second_layer'] as const;
export const isLblVariant = (v: string): boolean =>
  (LBL_DATA_VARIANTS as readonly string[]).includes(v);
export const LBL_STAGE_VARIANT: Record<string, ScrambleVariant> = {
  daisy: 'daisy', bdaisy: 'daisy',
  first_face: 'first_layer', first_layer: 'first_layer',
  bfirst_face: 'first_layer', bfirst_layer: 'first_layer',
  second_layer: 'second_layer',
};

// 数据层块变体集合 + 「block 方法的阶段/指标 → 底层数据变体」映射
// (键同时覆盖 distribution/recent_scrambles 的全名键与 gen comp_steps 的 b 前缀指标键)。
export const BLOCK_DATA_VARIANTS = ['123', '123x2', '222', '223'] as const;
export const isBlockVariant = (v: string): boolean =>
  (BLOCK_DATA_VARIANTS as readonly string[]).includes(v);
export const BLOCK_STAGE_VARIANT: Record<string, ScrambleVariant> = {
  fbsquare: '123', rouxs1: '123', block222: '222', block223: '223', f2b: '123x2',
  b122: '123', b123: '123', b222: '222', b223: '223', bf2b: '123x2',
};

// 'eo'(EO)同为 UI 聚合方法:数据层 'eoline' 变体(纯 EO / EOLine 两阶段)收进 EO 这一个
// 方法下拉项,细分落到阶段下拉(EO / EOLine / 十字 / XCross …)。数据键仍是 eo / eoline 两个变体
// —— 它们背后是两个求解引擎(VariantSolverWasm / EoDrSolverWasm),只在 UI 合并。
// 例外:/scramble/analyzer 的 StageSolver 方法下拉不走 VARIANT_ORDER(那是引擎选择器,
// 换阶段就换 WASM 池 = 重拉表),EOLine 在那里仍是独立方法。
export const EO_DATA_VARIANTS = ['eoline', 'eo'] as const;
export const isEoVariant = (v: string): boolean => v === 'eo' || v === 'eoline';
// 「EO 方法的阶段/指标 → 底层数据变体」映射,键覆盖三套键空间:
// distribution 全名键(eo_cross)/ recent_scrambles 指标键(cross, xc)/ gen 的 b 前缀键(beo)。
export const EO_STAGE_VARIANT: Record<string, ScrambleVariant> = {
  eo: 'eoline', eoline: 'eoline', beo: 'eoline', beoline: 'eoline',
  eo_cross: 'eo', eo_xcross: 'eo', eo_xxcross: 'eo', eo_xxxcross: 'eo', eo_xxxxcross: 'eo',
  cross: 'eo', xc: 'eo', xxc: 'eo', xxxc: 'eo', xxxxc: 'eo',
};

// 「打乱」是方法下拉里的伪变体:选中即按**原始 WCA 打乱的公式步数**分桶 / 取题(其余变体都是难度
// 口径)。刻意不进 ScrambleVariant 类型 —— 它没有求解引擎、没有阶段、也没有底色维度,进了
// VARIANT_STAGES / StageSolver 那几张表只会让每个消费者都得特判掉。共用方:首页「近期打乱」
// (按长度分桶展示)、/timer 真题难度筛(按长度取题,服务端谓词见 routes/wca_scrambles.ts)。
export const LENGTH_VARIANT = 'length';
const LENGTH_LABEL: VariantLabel = { zh: '打乱', en: 'Length' };

/** 「整体」= 整解最优步数(方法键与阶段键同名)。 */
export const WHOLE_VARIANT = '333';
/**
 * 该方法的步数是否来自阶段步数索引(wca_scramble_steps)。
 * 「整体」查 wca_scramble_optimal.htm、「打乱」直接数打乱公式步数 —— 都不受某场比赛有没有回填
 * 阶段步数影响,故不该被「该场未入库」的判定连坐。
 */
export const usesStepsIndex = (variant: string): boolean =>
  variant !== WHOLE_VARIANT && variant !== LENGTH_VARIANT;

/** 变体显示名;未知 key 回退原样。 */
export const variantLabel = (key: string, isZh: boolean): string => {
  const m = key === LENGTH_VARIANT ? LENGTH_LABEL : VARIANT_LABEL[key as ScrambleVariant];
  return m ? (isZh ? m.zh : m.en) : key;
};

// ── 阶段 ──────────────────────────────────────────────────────────────────
// 阶段键空间 = distribution.json 的 stage 键(cross/eo_xcross/block222…)
// ∪ recent_scrambles.json 的指标键(xc/xxc…)。变体前缀/后缀(eo_ / pseudo_ /
// f2leo_ / _pair / _pseudo_pair)一律去掉再显示 —— 变体名由方法下拉承担,
// 阶段下拉两页统一只显示 Cross / XCross / … / 块名。

const STAGE_BASE: Record<string, VariantLabel> = {
  // 整解:整个 3x3 的最优解步数(stats 页专属阶段,数据驱动;StageSolver/gen 不含)。
  '333': { zh: '整体', en: 'Full' },
  daisy: { zh: '小花', en: 'Daisy' },
  first_face: { zh: '底面', en: 'First Face' },
  first_layer: { zh: '底层', en: 'First Layer' },
  second_layer: { zh: '第二层', en: 'Second Layer' },
  cross: { zh: '十字', en: 'Cross' },
  xcross: { zh: 'XCross', en: 'XCross' },
  xxcross: { zh: 'XXCross', en: 'XXCross' },
  xxxcross: { zh: 'XXXCross', en: 'XXXCross' },
  xxxxcross: { zh: 'XXXXCross', en: 'XXXXCross' },
  // recent_scrambles.json 指标键别名
  xc: { zh: 'XCross', en: 'XCross' },
  xxc: { zh: 'XXCross', en: 'XXCross' },
  xxxc: { zh: 'XXXCross', en: 'XXXCross' },
  xxxxc: { zh: 'XXXXCross', en: 'XXXXCross' },
  // 旧 distribution 键别名
  f2l: { zh: 'XXXXCross', en: 'XXXXCross' },
  // 块族 / EO 族(中英同形;块名去乘号纯数字,f2b = first 2 blocks)
  block222: { zh: '222', en: '222' },
  fbsquare: { zh: '122', en: '122' },
  rouxs1: { zh: '123', en: '123' },
  block223: { zh: '223', en: '223' },
  f2b: { zh: 'F2B', en: 'F2B' },
  // gen comp_steps 的 b 前缀指标键别名
  bdaisy: { zh: '小花', en: 'Daisy' },
  b122: { zh: '122', en: '122' },
  bfirst_face: { zh: '底面', en: 'First Face' },
  bfirst_layer: { zh: '底层', en: 'First Layer' },
  b123: { zh: '123', en: '123' },
  b222: { zh: '222', en: '222' },
  b223: { zh: '223', en: '223' },
  bf2b: { zh: 'F2B', en: 'F2B' },
  beo: { zh: 'EO', en: 'EO' },
  beoline: { zh: 'EOLine', en: 'EOLine' },
  bdr: { zh: 'DR', en: 'DR' },
  eo: { zh: 'EO', en: 'EO' },
  eoline: { zh: 'EOLine', en: 'EOLine' },
  dr: { zh: 'DR', en: 'DR' },
  htr: { zh: 'HTR', en: 'HTR' },
  htr2: { zh: 'HTR 收尾', en: 'HTR-finish' },
  fr: { zh: 'Floppy 还原', en: 'Floppy Reduction' },
};

/** 阶段显示名:剥变体前缀/后缀后查表;未知 key 回退原样。 */
export const stageLabel = (key: string, isZh: boolean): string => {
  const base = key
    .replace(/^(pseudo_f2leo|f2leo|pseudo|eo)_/, '')
    .replace(/_(pseudo_pair|pair)$/, '');
  const m = STAGE_BASE[base];
  return m ? (isZh ? m.zh : m.en) : key;
};

// 每个变体的规范阶段键序。StageSolver 的 WASM 阶段索引 i ↔ VARIANT_STAGES[v][i];
// stats 页数据驱动(JSON 自带 stages 数组,是这里的子集),只共享 stageLabel。
export const VARIANT_STAGES: Record<ScrambleVariant, string[]> = {
  // 整解只有一个「阶段」= 整解本身;在 VARIANT_ORDER(首页+stats 方法下拉),但 gen 手动排除(无求解引擎)。
  '333': ['333'],
  std: ['cross', 'xcross', 'xxcross', 'xxxcross', 'xxxxcross'],
  // 只用于站点的两级菜单；StageSolver 仍按三套独立引擎显示原方法。
  lbl: ['daisy', 'first_face', 'first_layer', 'second_layer'],
  daisy: ['daisy'],
  first_layer: ['first_face', 'first_layer'],
  // 条件输入:第一层已还原，只需复原 4 条中层棱。
  second_layer: ['second_layer'],
  eo: ['eo_cross', 'eo_xcross', 'eo_xxcross', 'eo_xxxcross', 'eo_xxxxcross'],
  pair: ['cross_pair', 'xcross_pair', 'xxcross_pair', 'xxxcross_pair'],
  pseudo: ['pseudo_cross', 'pseudo_xcross', 'pseudo_xxcross', 'pseudo_xxxcross'],
  pseudo_pair: ['pseudo_cross_pseudo_pair', 'pseudo_xcross_pseudo_pair', 'pseudo_xxcross_pseudo_pair', 'pseudo_xxxcross_pseudo_pair'],
  f2leo: ['f2leo_cross', 'f2leo_xcross', 'f2leo_xxcross', 'f2leo_xxxcross'],
  pseudo_f2leo: ['pseudo_f2leo_cross', 'pseudo_f2leo_xcross', 'pseudo_f2leo_xxcross', 'pseudo_f2leo_xxxcross'],
  // 聚合方法「砖」:阶段序恰好与 Roux223SolverWasm 的阶段 id 0..4 一一对应。
  block: ['fbsquare', 'rouxs1', 'block222', 'block223', 'f2b'],
  '123': ['fbsquare', 'rouxs1', 'f2b'],
  '123x2': ['f2b'],
  '222': ['block222'],
  '223': ['block222', 'block223'],
  eoline: ['eo', 'eoline'],
  dr: ['dr'],
  htr: ['htr'],
  htr2: ['htr2'],
  fr: ['fr'],
};

/** The engine-backed methods offered by the timer's advanced solution view. */
export const STAGE_SOLVER_METHODS = [
  'std', 'daisy', 'first_layer', 'eo', 'pair', 'pseudo', 'pseudo_pair', 'f2leo', 'pseudo_f2leo',
  'block', 'eoline', 'dr', 'htr', 'htr2', 'fr',
] as const;

export type StageSolverMethod = (typeof STAGE_SOLVER_METHODS)[number];
export const STAGE_SOLVER_VARIANT_IDS = { pair: 0, eo: 1, pseudo: 2, pseudo_pair: 3 } as const;
export const STAGE_SOLVER_VARIANT_TABLES = [
  'pt_cross_C4E0', 'pt_cross_ins_C4', 'pt_pair_C4E0', 'pt_cross', 'pt_ep4eo12', 'pt_pscross',
] as const;
export const STAGE_SOLVER_TABLES_BASE = 'https://static.cuberoot.me/tools/solver/rust-cross/tables';
export const STAGE_SOLVER_TABLE_QUERY = 'tv=1';
export const STAGE_SOLVER_DEFAULT_SLACK = 2;
export const STAGE_SOLVER_DEFAULT_LIMIT = 10;
export const STAGE_SOLVER_SLACK_OPTIONS = [0, 1, 2, 3, 4, 5, 6] as const;
export const STAGE_SOLVER_LIMIT_OPTIONS = [1, 5, 10, 25, 50, 0] as const;
export const STAGE_SOLVER_NO_LIMIT_CAP = 100000;

export const STAGE_SOLVER_MOVE_FACES = ['U', 'D', 'L', 'R', 'F', 'B'] as const;
export const STAGE_SOLVER_MOVE_CELLS = [
  ...STAGE_SOLVER_MOVE_FACES, 'u', 'd', 'l', 'r', 'f', 'b', 'M', 'E', 'S', 'x', 'y', 'z',
] as const;
export const STAGE_SOLVER_DEFAULT_FACES = STAGE_SOLVER_MOVE_FACES.map(() => true);
export const STAGE_SOLVER_DEFAULT_CELLS = STAGE_SOLVER_MOVE_CELLS.map((_, i) => i < STAGE_SOLVER_MOVE_FACES.length);
export const STAGE_SOLVER_ALL_FACE_MOVES = (1 << 18) - 1;
export const STAGE_SOLVER_SLOT_LABELS = ['BL', 'BR', 'FR', 'FL'] as const;

const ONE_FACE_LIMIT_METHODS: ReadonlySet<StageSolverMethod> = new Set([
  'pair', 'eo', 'pseudo', 'pseudo_pair', 'f2leo', 'pseudo_f2leo',
]);

/** Full move grid for Standard, one forbidden face for the other masked engines. */
export function stageSolverRestrictionKind(method: StageSolverMethod) {
  return method === 'std' ? 'grid' : ONE_FACE_LIMIT_METHODS.has(method) ? 'single-face' : 'none';
}

export function stageSolverToggleMoveCell(cells: readonly boolean[], index: number, singleFace = false) {
  if (singleFace) return cells.map((_, i) => index !== i || !cells[index]);
  return cells.map((on, i) => (i === index ? !on : on));
}

/** Each cell owns the three quarter, half and inverse-turn bits in solver order. */
export function stageSolverMoveBits(cells: readonly boolean[]) {
  let lo = 0;
  let hi = 0;
  cells.forEach((on, i) => {
    if (!on) return;
    for (let bit = 3 * i; bit < 3 * i + 3; bit++) {
      if (bit < 32) lo |= 1 << bit;
      else hi |= 1 << (bit - 32);
    }
  });
  return { lo: lo >>> 0, hi: hi >>> 0 };
}

export function stageSolverMoveRestriction(method: StageSolverMethod, cells: readonly boolean[]) {
  const kind = stageSolverRestrictionKind(method);
  if (kind === 'none') return { restricted: false };
  const { lo, hi } = stageSolverMoveBits(cells);
  if (kind === 'grid' && (hi !== 0 || (lo >>> 18) !== 0)) {
    const maxRot = cells.slice(15, 18).some(Boolean) ? 2 : 0;
    return { restricted: true, restriction: { lo, hi, maxRot } };
  }
  return lo === STAGE_SOLVER_ALL_FACE_MOVES ? { restricted: false } : { restricted: true, mask: lo };
}

export function stageSolverSlotCount(method: StageSolverMethod, stageIndex: number): number {
  return method === 'std' || ONE_FACE_LIMIT_METHODS.has(method) ? stageIndex : 0;
}

export const stageSolverHasBase = (method: StageSolverMethod): boolean => method === 'pair' || method === 'pseudo_pair';

/** F2L slot combinations in the same order as the solver's pair and triplet tables. */
export function stageSolverSlotCombinations(count: number): number[][] {
  const result: number[][] = [];
  const visit = (start: number, slots: number[]) => {
    if (slots.length === count) { result.push(slots); return; }
    for (let i = start; i < STAGE_SOLVER_SLOT_LABELS.length; i++) visit(i + 1, [...slots, i]);
  };
  visit(0, []);
  return result;
}

export const stageSolverComboArity = (combo: string): number => combo ? combo.split(',').length : 0;

const STAGE_SOLVER_ENGINE = {
  std: 'cross', daisy: 'daisy', first_layer: 'first_layer',
  eo: 'variant', pair: 'variant', pseudo: 'variant', pseudo_pair: 'variant',
  f2leo: 'f2leo', pseudo_f2leo: 'f2leo', block: 'roux223',
  eoline: 'eodr', dr: 'eodr', htr: 'htr', htr2: 'htr2', fr: 'fr',
} as const satisfies Record<StageSolverMethod, string>;

export function stageSolverNeed(method: StageSolverMethod) {
  return STAGE_SOLVER_ENGINE[method];
}

export function stageSolverKind(method: StageSolverMethod, stageKey: string) {
  if (method === 'std') return 'std';
  if (method === 'block' && stageKey === 'block222') return 'block222';
  return STAGE_SOLVER_ENGINE[method];
}

export function stageSolverStageIndex(method: StageSolverMethod, index: number): number {
  return method === 'dr' ? 2 : index;
}

export const STAGE_SOLVER_FACES = ['D', 'U', 'L', 'R', 'F', 'B'] as const;
export const STAGE_SOLVER_NO_SOLUTION = 0xffffffff;
export const STAGE_SOLVER_TOO_BROAD = 0xfffffffe;

export function stageSolverCountStatus(value: number | null | undefined) {
  if (value === STAGE_SOLVER_NO_SOLUTION) return 'no-solution';
  if (value === STAGE_SOLVER_TOO_BROAD) return 'too-broad';
  return typeof value === 'number' && Number.isFinite(value) ? 'ready' : 'pending';
}

export function bestStageSolverFace(
  counts: readonly (number | null)[],
  visible: (face: number) => boolean = () => true,
): number | null {
  let best: number | null = null;
  let min = Infinity;
  counts.forEach((value, i) => {
    if (value != null && visible(i) && stageSolverCountStatus(value) === 'ready' && value < min) {
      best = i;
      min = value;
    }
  });
  return best;
}

/** Existing solver output places view orientation before move notation. Hosts
 * fold the initial orientation into the playback setup. */
export function stageSolverSplitLeadingRotations(algorithm: string): { lead: string; body: string } {
  const tokens = algorithm.trim().split(/\s+/).filter(Boolean);
  let cut = 0;
  while (cut < tokens.length && /^[xyz][2']?$/.test(tokens[cut])) cut++;
  return { lead: tokens.slice(0, cut).join(' '), body: tokens.slice(cut).join(' ') };
}

export const stageSolverMoveLength = (solution: string): number =>
  solution.replace(/^([xyz][2']?\s+)+/, '').split(/\s+/).filter(Boolean).length;

/** Stable ordering for the timer candidate list. */
export function sortStageSolverCandidates<T extends { m: string }>(solutions: readonly T[]): T[] {
  return [...solutions].sort((a, b) => stageSolverMoveLength(a.m) - stageSolverMoveLength(b.m) || countQtm(a.m) - countQtm(b.m));
}

// 聚合方法 'eo' 在阶段下拉里的完整序(跨两个数据变体):EO → EOLine → EO+十字系列。
// 刻意不塞进 VARIANT_STAGES.eo —— 那个数组是 StageSolver 的 WASM 阶段索引契约(i ↔ 阶段 id)。
export const EO_UI_STAGES: string[] = [...VARIANT_STAGES.eoline, ...VARIANT_STAGES.eo];

// 首页近期打乱 JSON 的短 metric 展开序。新管道阶段必须同步加进来,
// 否则方法会出现在下拉里,但选中后找不到任何步数桶。
export const RECENT_METRIC_ORDER: string[] = [
  '333', 'daisy', 'first_face', 'first_layer', 'eo', 'eoline', 'cross', 'xc', 'xxc', 'xxxc', 'xxxxc',
  'fbsquare', 'rouxs1', 'block222', 'block223', 'f2b', 'dr',
];

// ── 方法/阶段下拉的 UI 聚合(首页 RecentScrambles 与 /timer 真题难度筛共用)────────
// 数据层有 16 个变体(含整解;块族 4 个 + eo/eoline 2 个各自独立),方法下拉把 LBL 阶段、
// 块族和 EOLine 各自聚合,细分落到阶段下拉。存回设置 / 查表一律用数据变体。

/** 数据变体 → 方法下拉里的 UI 项(LBL / block / EO 各自聚合)。 */
export const uiVariantOf = (dataVariant: string): string =>
  (isLblVariant(dataVariant) ? 'lbl'
    : isBlockVariant(dataVariant) ? 'block'
      : dataVariant === 'eoline' ? 'eo' : dataVariant);

/** 方法下拉选项 = VARIANT_ORDER 里有数据的项;聚合项只要有一个成员变体有数据就算。 */
export const uiVariantOptions = (hasData: (dataVariant: string) => boolean): string[] =>
  VARIANT_ORDER.filter((v) => (
    v === 'lbl' ? LBL_DATA_VARIANTS.some(hasData)
      : v === 'block' ? BLOCK_DATA_VARIANTS.some(hasData)
      : v === 'eo' ? EO_DATA_VARIANTS.some(hasData)
        : hasData(v)
  ));

/** UI 方法 → 阶段下拉的规范键序(聚合方法跨数据变体展开;「打乱」无阶段,用同名键占位)。 */
export const uiStagesOf = (uiVariant: string): string[] =>
  (uiVariant === 'eo' ? EO_UI_STAGES
    : uiVariant === LENGTH_VARIANT ? [LENGTH_VARIANT]
      : (VARIANT_STAGES[uiVariant as ScrambleVariant] ?? []));

/** UI 方法 + 阶段键 → 底层数据变体(过滤 / 查表口径)。 */
export const dataVariantOfStage = (uiVariant: string, stage: string): string => (
  uiVariant === 'lbl' ? (LBL_STAGE_VARIANT[stage] ?? 'daisy')
    : uiVariant === 'block' ? (BLOCK_STAGE_VARIANT[stage] ?? '123')
    : uiVariant === 'eo' ? (EO_STAGE_VARIANT[stage] ?? 'eo')
      : uiVariant);

/** UI 方法 / 阶段 → 唯一底层数据坐标。 */
export interface VariantDataRef { variant: string; stage: string; recentMetric: string }
export const variantDataRef = (uiVariant: string, stage: string): VariantDataRef => ({
  variant: dataVariantOfStage(uiVariant, stage), stage, recentMetric: stage,
});

/**
 * 把 URL / 旧设置里的方法与阶段收敛到当前数据集真正存在的坐标。
 * 优先留在同一个 UI 方法内(LBL / 砖 / EO),再回退到数据集首项；返回值可直接用于
 * 本帧渲染，不能只等 effect 改 URL，否则原生 select 会短暂或持续显示空白值。
 */
export const normalizeVariantDataRef = (
  variants: Record<string, { stages: readonly string[] }>,
  variant: string,
  stage: string,
): VariantDataRef | null => {
  const direct = variantDataRef(variant, stage);
  if (variants[direct.variant]?.stages.includes(direct.stage)) return direct;

  const uiVariant = uiVariantOf(variant);
  for (const candidateStage of uiStagesOf(uiVariant)) {
    const candidate = variantDataRef(uiVariant, candidateStage);
    if (variants[candidate.variant]?.stages.includes(candidate.stage)) return candidate;
  }

  for (const [candidateVariant, data] of Object.entries(variants)) {
    const candidateStage = data.stages[0];
    if (candidateStage) return variantDataRef(candidateVariant, candidateStage);
  }
  return null;
};
