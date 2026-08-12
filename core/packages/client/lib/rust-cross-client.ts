// 有上界的 Rust→WASM cross-step worker 池。每个 worker 在自己的 WASM 线性内存装一份表,
// 所以 N 路并行 = N×表内存:手机默认 2、桌面 4(按需懒生成),既能多视角同时算又不至于 OOM。
// 零拷贝共享表需要 SharedArrayBuffer + COOP/COEP,本页没发这些头,故不共享。
//
// 下载量(2026-07-27 重划):
//   · mt_*(移动表)默认由 WASM 现场生成(见 solver/src/mt_gen.rs),不单独下载；
//     First Layer 例外,最终移动表封进 opt_first_layer,避免客户端执行 4490 万态 BFS。
//   · pt_*(BFS 剪枝表)仍须下载,是唯一的网络成本。
//   · std 池再拆两段:建池只拉 pt_cross(gz 50KB)就能算纯十字;xcross+ 要的
//     pt_cross_C4E0(gz 20MB)由 `ensureXCross()` 在用户真的切到那些阶段时才补。
// 结果:计时器/analyzer 默认视图(标准 · 十字)的冷启动从 ~30MB 降到 ~50KB。
//
// 产物自包含在 /tools/solver/rust-cross/(dev 经 Next catch-all,prod 直取 static)。

import { normalizeScramble } from './cross-solver';
// 表的住址 + 那张 21MB 大表的下载单例(跨池共享,页面级也能先行预取)。
import { BASE, TV, claimXCrossGz, releaseXCrossGz, tablesBaseUrl } from './rust-cross-tables';

// 代码产物(worker/glue/wasm)固定文件名 + 1 天 CDN 缓存,重建后靠版本 query 失效。
// 每次重建 wasm/worker 必须 bump。
const V = 'v=20260811c';

// 各表解压后(= 装进 WASM 线性内存的)字节数。实测自 tools/solver/rust-cross/tables/*.bin.gz
// (`gzip -dc | wc -c`)。**表重建后尺寸若变需同步更新**(见 memory「WASM 重建仪式」)。
export const TABLE_BYTES: Record<string, number> = {
  pt_cross: 139408,
  pt_cross_C4E0: 54743056,
  pt_cross_ins_C4: 2280976,
  pt_pair_C4E0: 304,
  pt_ep4eo12: 12165136,
  pt_pscross: 139408,
  mt_edge2: 38028,
  mt_edge3: 760332,
  mt_edge4: 18247692,
  mt_corn: 1740,
  mt_corn2: 36300,
  mt_edge: 1740,
  mt_eo12: 147468,
  mt_eo12_alt: 147468,
  mt_ep4: 855372,
  // 整解最优全空间距离表(解压后 = 态数 × 1B):2x2x2 / 金字塔核心 / 斜转。
  opt_222: 3674160,
  opt_pyraminx: 933120,
  opt_skewb: 3149280,
  // First Face / First Layer 最终移动表 + 4-bit PDB bundle；客户端只装载，不跑 BFS。
  opt_first_layer: 57383828,
};

// 各 need 首次加载的表清单 —— 必须与 cross-solver-worker.js 的 init 分支严格一致。
// **只列 pt_*/opt_*(必须下载的预构建产物)**;mt_* 不作为独立文件列出。
// eodr / htr / htr2 / fr / chain 零表下载(微表/距离表现场从内置运动学建)。
// pocket / pyraminx / skewb 拉预算好的全空间距离表 opt_*(秒算,from_dist 直载,
// 表缺失时 worker 回退现场 BFS)。
export const TABLE_SETS: Record<'cross' | 'cross_restrict' | 'xcross_restrict' | 'f2leo' | 'variant' | 'block222' | 'daisy' | 'first_layer' | 'roux223' | 'eodr' | 'htr' | 'htr2' | 'fr' | 'chain' | '222' | 'pyraminx' | 'skewb', string[]> = {
  // 纯十字段;xcross+ 的 pt_cross_C4E0 见 XCROSS_TABLES(ensureXCross 时才拉)。
  cross: ['pt_cross'],
  // or18 式受限最优十字:零表下载,worker 构造时现场建 coord/center transition。
  cross_restrict: [],
  // 受限最优 xcross:零表下载,worker 构造现场建 54-move transition + 双 PDB(用到才建)。
  xcross_restrict: [],
  f2leo: ['pt_cross'],
  variant: [
    'pt_cross_C4E0', 'pt_cross_ins_C4', 'pt_pair_C4E0',
    'pt_cross', 'pt_ep4eo12', 'pt_pscross',
  ],
  block222: [],
  daisy: [],
  first_layer: ['opt_first_layer'],
  roux223: [],
  eodr: [],
  htr: [],
  htr2: [],
  fr: [],
  chain: [],
  '222': ['opt_222'],
  pyraminx: ['opt_pyraminx'],
  skewb: ['opt_skewb'],
};

/** std 池切到 xcross+ 阶段时才补的表(`pool.ensureXCross()`)。UI 据此显示第二段加载提示。 */
export const XCROSS_TABLES = ['pt_cross_C4E0'];

/** HTR(条件式阶段)非 DR 视角的哨兵值(u32::MAX):该视角未处于 DR,无 HTR 步数。 */
export const HTR_NOT_DR = 0xffffffff;

/** HTR phase-2(条件式阶段)非 HTR/G3 视角的哨兵值(u32::MAX):该视角未处于 HTR 子群。 */
export const HTR2_NOT_HTR = 0xffffffff;

/** FR(Floppy 还原,条件式阶段)非 HTR/G3 视角的哨兵值(u32::MAX):该视角未处于 HTR 子群。 */
export const FR_NOT_HTR = 0xffffffff;

/** 逐视角进度:某个视角(0..5 = D/U/L/R/F/B,同 solve*Stage 的返回序)的最终步数刚算出来。
 *  6 视角网格在 worker 里是一次同步 WASM 调用跑完的,深阶段(eo xxxxcross 尤甚)要几十秒到
 *  几分钟 —— 靠它把已定的格子提前交给 UI,而不是整段时间毫无音讯。最终 Promise 仍 resolve
 *  完整的 6 值权威结果。 */
export type FaceProgressFn = (face: number, value: number) => void;

/** 单条解法:m = 带视角前缀的步骤串;c = 该解的 F2L 槽位标签(如 "BL FR"),无槽阶段为空串。
 *  并列最优时不同条可能是不同槽。 */
export interface SolItem {
  m: string;
  c: string;
}
export interface MovesResult {
  len: number;
  sols: SolItem[];
}

/** 链式求解单步:kind = 阶段类别;variant = mallard 式变体名(eoud / drlr-eoud /
 *  htr-drlr / frud / fin);m = 该步 HOME 帧串(无视角前缀);len 本步长;
 *  cum = 截至该步总步数(N.len + I.len);inv = 整步做在 inverse 打乱上
 *  (NISS-Before;引擎仅 true 时携带,渲染括号在 UI 层)。 */
export interface ChainStepResult {
  kind: 'eo' | 'dr' | 'htr' | 'fr' | 'fin';
  variant: string;
  m: string;
  len: number;
  cum: number;
  inv?: boolean;
}
/** 一条链:按 total 升序返回;solution = 线性化最终解 N ++ rev_inv(I)
 *  (normal 打乱上单序列),total = 其长度。 */
export interface ChainResult {
  steps: ChainStepResult[];
  solution: string;
  total: number;
}

export interface FaceResult {
  value: number;
  ms: number; // worker 内纯计算耗时
}

export interface MovesTimed extends MovesResult {
  ms: number;
}

export interface RustCrossPool {
  ready: Promise<void>; // 首个 worker 就绪
  /** variant 0=cross,1=xc,2=xxc,3=xxxc,4=xxxxc;face 0..5。返回单格步数 + 计算耗时。
   *  mask:18 个 move 的 bitmask(bit m=1 表示允许),省略=不限步法;仅 cross(variant 0)生效。 */
  solveFace(scramble: string, variant: number, face: number, mask?: number): Promise<FaceResult>;
  /** 单格多解步骤 + 计算耗时。opts.mask 同 solveFace(省略=不限)。
   *  onPartial:流式回调,每枚举到一条解即触发(算一条出一条);最终 Promise 仍 resolve 完整权威结果。 */
  solveMoves(
    scramble: string,
    variant: number,
    face: number,
    opts?: { extra?: number; cap?: number; combo?: string; mask?: number },
    onPartial?: (sol: SolItem, len: number) => void,
  ): Promise<MovesTimed>;
  /** or18 式受限最优十字(6面+6宽+3中层+3旋转)单视角步数(含解里整体旋转计数)。
   *  allowed = 54-bit:lo=低 32 位、hi=高 22 位,bit m=1 允许 move m
   *  (0-17 面 / 18-35 宽 / 36-44 中层 M/E/S / 45-53 旋转 x/y/z);maxRot=解里旋转上限。
   *  受限无解返 0xFFFFFFFF。需 'cross_restrict' 池(零表)。 */
  solveCrossRestrictFace(scramble: string, face: number, lo: number, hi: number, maxRot: number): Promise<FaceResult>;
  /** or18 式受限最优十字单视角「多解枚举」:长度 ∈ [最优, 最优+extra],最多 cap 条(升序)。
   *  受限无解 len=0xFFFFFFFF + 空解集。 */
  solveCrossRestrictMoves(scramble: string, face: number, lo: number, hi: number, maxRot: number, extra: number, cap: number): Promise<MovesTimed>;
  /** 受限最优「十字 + k 个 F2L 对」6 视角长度网格(k=1 xcross / 2 xxcross / 3 xxxcross / 4 F2L;
   *  PDB 只建一次,6 视角 × C(4,k) 组合共用)。allowed = 54-bit(lo/hi);每视角真无解返 0xFFFFFFFF、
   *  限制过宽未在预算内判定返 0xFFFFFFFE(⋯)。需 'xcross_restrict' 池(零表)。 */
  solveXCrossRestrictGrid(scramble: string, lo: number, hi: number, maxRot: number, k: number): Promise<number[]>;
  /** 受限最优单视角「多解枚举」:长度 ∈ [最优, 最优+extra],最多 cap 条(升序)。`k`=对数;
   *  `combo`=逗号分隔固定槽集(''=自动枚举全部 C(4,k) 组合)。受限无解 len=0xFFFFFFFF + 空解集。
   *  onPartial:流式回调,每枚举到一条解即触发(c 恒空串)。 */
  solveXCrossRestrictMoves(scramble: string, face: number, lo: number, hi: number, maxRot: number, extra: number, cap: number, k: number, combo: string, onPartial?: (sol: SolItem, len: number) => void): Promise<MovesTimed>;
  /** F2LEO(pseudo=false)/ Pseudo F2LEO(pseudo=true)整变体 24 值:[cross,xc,xxc,xxxc]×6 朝向(已折叠 z0/z2/z3/z1/x3/x1)。 */
  solveF2leo(scramble: string, pseudo: boolean): Promise<number[]>;
  /** 单阶段 6 值(stage 0=cross/1=xc/2=xxc/3=xxxc)。cross 极快 → 先单算 cross 秒出,深阶段后台补。
   *  mask:18 个 move 的 bitmask(省略=不限步法);受限下无解视角返 0xFFFFFFFF 哨兵。
   *  onFace:逐视角进度,同 solveVariantStage。 */
  solveF2leoStage(scramble: string, pseudo: boolean, stage: number, mask?: number, onFace?: FaceProgressFn): Promise<number[]>;
  /** F2LEO(pseudo=false)/ Pseudo F2LEO(pseudo=true)单格(× stage × face)多解步骤 + 计算耗时。前缀可能含尾随 y(破 y 对称)。
   *  opts.mask 同 solveF2leoStage(省略=不限);受限下无解 len=0xFFFFFFFF。 */
  solveF2leoMoves(
    scramble: string,
    pseudo: boolean,
    face: number,
    stage: number,
    opts?: { extra?: number; cap?: number; combo?: string; mask?: number },
  ): Promise<MovesTimed>;
  /** 其余变体(0=pair/1=eo/2=pseudo/3=pseudo_pair)整变体 24/30 值 × 6 朝向(物理面序 z0/z2/z3/z1/x3/x1)。 */
  solveVariant(scramble: string, variant: number): Promise<number[]>;
  /** 变体单阶段 6 值(stage 0=cross.. ),cross 先出深阶段后台补。
   *  mask:18 个 move 的 bitmask(省略=不限步法);受限下无解视角返 0xFFFFFFFF 哨兵。
   *  onFace:逐视角进度,每定下一个视角即触发(未受限时才有;深阶段整格要几十秒)。 */
  solveVariantStage(scramble: string, variant: number, stage: number, mask?: number, onFace?: FaceProgressFn): Promise<number[]>;
  /** 变体单格(variant × stage × face)多解步骤 + 计算耗时。eo 的步骤前缀可能含尾随 y(破 y 对称)。
   *  combo = 固定已解 xcross 槽集(or18「槽位」);base = 自由对槽(or18「基态」,仅 pair/pseudo_pair,-1=auto)。
   *  opts.mask 同 solveVariantStage(省略=不限);受限下无解 len=0xFFFFFFFF。 */
  solveVariantMoves(
    scramble: string,
    variant: number,
    face: number,
    stage: number,
    opts?: { extra?: number; cap?: number; combo?: string; base?: number; mask?: number },
  ): Promise<MovesTimed>;
  /** 2x2x2 块 6 视角(每视角 = 该底色 4 个贴底块最小),物理面序 z0/z2/z3/z1/x3/x1。 */
  solveBlock222Stage(scramble: string): Promise<number[]>;
  /** 2x2x2 块单视角多解(4 贴底块合并按长度排序)。前缀 = rot + y^k,c = 块标签(URF..DRB)。 */
  solveBlock222Moves(
    scramble: string,
    face: number,
    opts?: { extra?: number; cap?: number },
  ): Promise<MovesTimed>;
  /** Daisy 6 个花瓣颜色视角；每格是四条指定色棱围绕对面中心的 HTM 最优步数。 */
  solveDaisyStage(scramble: string): Promise<number[]>;
  /** Daisy 单视角多解。前缀 = rot，c = 花瓣色→中心色标签。 */
  solveDaisyMoves(
    scramble: string,
    face: number,
    opts?: { extra?: number; cap?: number },
  ): Promise<MovesTimed>;
  /** First Face / First Layer 单阶段 6 底色最优步数。stage 0=底面，1=底层。 */
  solveFirstLayerStage(scramble: string, stage: number): Promise<number[]>;
  /** First Face / First Layer 单视角多解。前缀 = rot，c = 物理底面标签。 */
  solveFirstLayerMoves(
    scramble: string,
    stage: number,
    face: number,
    opts?: { extra?: number; cap?: number },
  ): Promise<MovesTimed>;
  /** 块族单阶段 6 视角(stage 0=FB方块 1=1x2x3 2=2x2x2 3=2x2x3 4=双1x2x3),物理面序 z0/z2/z3/z1/x3/x1。 */
  solveRoux223Stage(scramble: string, stage: number): Promise<number[]>;
  /** 块族单视角多解。前缀 = rot + y^k,c = 目标标签(方块 "DBL-L" / 1x2x3 "DL" / 2x2x2 角名 / 2x2x3 棱名 / f2b "D(LR)")。 */
  solveRoux223Moves(
    scramble: string,
    stage: number,
    face: number,
    opts?: { extra?: number; cap?: number },
  ): Promise<MovesTimed>;
  /** EO/EOLine/DR 单阶段 6 视角(stage 0=EO 1=EOLine 2=DR),物理面序 z0/z2/z3/z1/x3/x1。 */
  solveEoDrStage(scramble: string, stage: number): Promise<number[]>;
  /** EO/EOLine/DR 单视角多解。前缀 = rot + y^k,c = 目标标签(EO 轴 "FB" / EOLine "D(FB)" / DR 轴 "UD")。 */
  solveEoDrMoves(
    scramble: string,
    stage: number,
    face: number,
    opts?: { extra?: number; cap?: number },
  ): Promise<MovesTimed>;
  /** HTR(DR→HTR)6 视角,物理面序 z0/z2/z3/z1/x3/x1。条件式阶段:非 DR 视角 = HTR_NOT_DR 哨兵。 */
  solveHtrStage(scramble: string): Promise<number[]>;
  /** HTR 单视角多解。前缀 = rot(HTR 对 y 不变),c = 轴标签(同 DR,如 "UD");非 DR 视角 len = HTR_NOT_DR。 */
  solveHtrMoves(
    scramble: string,
    face: number,
    opts?: { extra?: number; cap?: number },
  ): Promise<MovesTimed>;
  /** HTR phase-2(G3→solved)6 视角,物理面序 z0/z2/z3/z1/x3/x1。条件式阶段:非 HTR 视角 = HTR2_NOT_HTR 哨兵。 */
  solveHtr2Stage(scramble: string): Promise<number[]>;
  /** HTR phase-2 单视角多解。前缀 = rot(对 y 不变),c = 轴标签(同 DR);非 HTR 视角 len = HTR2_NOT_HTR。 */
  solveHtr2Moves(
    scramble: string,
    face: number,
    opts?: { extra?: number; cap?: number },
  ): Promise<MovesTimed>;
  /** FR(HTR→FR,Floppy 还原)6 视角,物理面序 z0/z2/z3/z1/x3/x1。条件式阶段:非 HTR 视角 = FR_NOT_HTR 哨兵。 */
  solveFrStage(scramble: string): Promise<number[]>;
  /** FR 单视角多解。前缀 = rot(对 y 不变),c = 该视角 FR 轴标签(UD/FB/LR);非 HTR 视角 len = FR_NOT_HTR。 */
  solveFrMoves(
    scramble: string,
    face: number,
    opts?: { extra?: number; cap?: number },
  ): Promise<MovesTimed>;
  /** mallard 式链式求解(EO→DR→HTR→[FR]→Finish,单 HOME 帧,NISS-Before)。
   *  config = JSON 串(per-stage {enabled,extra,cap,min,max,axes,excluded,niss} +
   *  maxChains,'{}' = 默认;niss 默认 eo/dr/htr/fr 开、fin 强制关;excluded 串 =
   *  「累计 N '|' 累计 I」,无 '|' = I 空)。首调会在 worker 内现场建 DR/HTR/htr2
   *  距离表(数秒);fr.enabled 再惰性建 FR 表。 */
  solveChain(scramble: string, config: string): Promise<{ chains: ChainResult[]; ms: number }>;
  /** 2x2x2 口袋魔方整解最优 HTM 步数（0..=11，非条件式阶段无哨兵）。全 18 记号，D/L/B 经 24 旋转归一。 */
  solveCube222Len(scramble: string): Promise<number[]>;
  /** 2x2x2 整解一条最优解。`m` 前缀 = 整体旋转（打乱含 D/L/B 时归一所需，可为空），`c` 恒空串。 */
  solveCube222Moves(scramble: string): Promise<MovesTimed>;
  /** 金字塔整解最优 HTM 步数（0..=15,含 tips）。全 WCA pyram 记号（大写 U/L/R/B 核心 + 小写 u/l/r/b 顶点）。 */
  solvePyraminxLen(scramble: string): Promise<number[]>;
  /** 金字塔整解一条最优解。`m` = 核心大写解 + 小写 tip 收尾（无整体旋转前缀），`c` 恒空串。 */
  solvePyraminxMoves(scramble: string): Promise<MovesTimed>;
  /** 斜转整解最优步数（0..=11,每 120° 一步）。全 WCA skewb 记号 U/L/R/B ± '/2。 */
  solveSkewbLen(scramble: string): Promise<number[]>;
  /** 斜转整解一条最优解。`m` = 最优解序列（无整体旋转前缀），`c` 恒空串。 */
  solveSkewbMoves(scramble: string): Promise<MovesTimed>;
  /** std 池专用:补上 xcross+ 段的 pt_cross_C4E0(gz 20MB)。切到 xcross/F2L 阶段前必须
   *  先 await 它(否则 WASM 端 variant≥1 会因未 attach 而抛错);已就绪时立即 resolve。
   *  非 std 池(need!=='cross')是 no-op。 */
  ensureXCross(): Promise<void>;
  /** 该池是否已具备 xcross+ 能力(UI 据此决定要不要显示第二段加载提示)。 */
  hasXCross(): boolean;
  /** 丢弃所有「排队未派发」的任务(已在 worker 里跑的 ≤size 个无法中断)。切变体/打乱集时调,
   *  避免新请求(如快 cross)排在旧变体一堆慢任务后面干等。被丢的任务 reject('cancelled')。 */
  clearQueue(): void;
  /** 终止当前在跑的 worker(WASM 同步求解无法中途打断,只能 terminate),拒绝其在手任务 +
   *  清空排队;保留空闲 ready worker(被杀的下次 submit 按需重新预热,重载表)。
   *  供「无上限」枚举的终止按钮真正停掉跑飞的搜索。被中止任务 reject('aborted')。 */
  abort(): void;
  size: number;
  terminate(): void;
}

interface Job {
  msg: Record<string, unknown>;
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  // 流式:worker 每枚举到一条解发 *_partial,这里回调给调用方做渐进显示;
  // 不清 job、不派下一个,直到最终 moves/xcr_moves 消息才结算 resolve。
  onPartial?: (sol: SolItem, len: number) => void;
  // 同上,但报的是 6 视角网格里「哪一格已经定了」(face_progress);同样不结算 job。
  onFace?: FaceProgressFn;
}

interface PoolWorker {
  w: Worker;
  job: Job | null;
  ready: boolean;
  dead: boolean;
  /** 该 worker 的 xcross 段:null=未补;Promise=补表中/已补(resolve 即可用)。 */
  xcross: Promise<void> | null;
  /** 补表中的 resolve 句柄:worker 死掉时要手动结算,否则 ensureXCross 永远等下去。 */
  xcrossResolve: (() => void) | null;
}

export function createRustCrossPool(maxSize: number, need: 'cross' | 'cross_restrict' | 'xcross_restrict' | 'f2leo' | 'variant' | 'block222' | 'daisy' | 'first_layer' | 'roux223' | 'eodr' | 'htr' | 'htr2' | 'fr' | 'chain' | '222' | 'pyraminx' | 'skewb' = 'cross'): RustCrossPool {
  const size = Math.max(1, maxSize);
  const all: PoolWorker[] = [];
  const idle: PoolWorker[] = [];
  const queue: Job[] = [];
  let spawned = 0;
  let loading = false; // 串行预热:同一时刻只允许一个 worker 在加载
  let anyReady = false;
  let resolveReady!: () => void;
  let rejectReady!: (e: Error) => void;
  const ready = new Promise<void>((res, rej) => { resolveReady = res; rejectReady = rej; });

  // std 池:本会话是否已升级到 xcross+(切阶段后新 spawn 的 worker 直接带上大表 init,
  // 免得刚 ready 又补一次)。
  let wantXCross = false;
  let xcrossSeq = 1;
  const xcrossWaiters = new Map<number, () => void>();

  const origin = typeof location !== 'undefined' ? location.origin : '';
  // 表 URL:dev 走同源 catch-all,prod 直取 static(见 rust-cross-tables)。
  const tablesBase = tablesBaseUrl();
  const initMsg = {
    type: 'init',
    glueUrl: `${origin}${BASE}/cross_solver.js?${V}`,
    wasmUrl: `${origin}${BASE}/cross_solver_bg.wasm?${V}`,
    tablesBase,
    tableQuery: TV, // worker 拼成 <base>/<name>.bin.gz?<tableQuery>
    need,
    xcross: false, // spawn 时按 wantXCross 覆盖
  };

  function dispatch(pw: PoolWorker, job: Job) {
    pw.job = job;
    pw.w.postMessage(job.msg);
  }

  // worker 不可用:标死,把在手任务重排;全死则让 ready / 排队任务带真实错误失败,
  // 否则把任务交给空闲 worker 或按需预热,池继续可用。
  function fail(pw: PoolWorker, err: Error, terminate = false) {
    if (pw.dead) return;
    pw.dead = true;
    loading = false;
    // 死掉的 worker 不再服务任何 job,等它补表没有意义 —— 结算掉,免得 ensureXCross 悬着。
    pw.xcrossResolve?.();
    pw.xcrossResolve = null;
    if (terminate) { try { pw.w.terminate(); } catch { /* */ } }
    const job = pw.job;
    pw.job = null;
    if (job) queue.unshift(job);
    if (all.every((p) => p.dead)) {
      if (!anyReady) rejectReady(err);
      while (queue.length) queue.shift()!.reject(err);
    } else {
      while (queue.length && idle.length) dispatch(idle.pop()!, queue.shift()!);
      maybeSpawn();
    }
  }

  // ready 空闲 worker 领下一个排队任务,否则归 idle;顺带按需串行预热。
  function assign(pw: PoolWorker) {
    if (pw.dead) return;
    const next = queue.shift();
    if (next) dispatch(pw, next);
    else idle.push(pw);
    maybeSpawn();
  }

  // 仅在「有排队任务 + 未满 + 当前没有 worker 在加载」时串行预热一个(避免 N× 同时解压 27MB)。
  function maybeSpawn() {
    if (loading || spawned >= size || queue.length === 0) return;
    spawn();
  }

  function spawn(): void {
    spawned++;
    loading = true;
    const w = new Worker(`${BASE}/cross-solver-worker.js?${V}`, { type: 'module' });
    // 已升级过的池:新 worker 直接带大表 init,ready 即具备 xcross 能力。
    const bornWithXCross = wantXCross;
    const pw: PoolWorker = {
      w, job: null, ready: false, dead: false,
      xcross: bornWithXCross ? Promise.resolve() : null,
      xcrossResolve: null,
    };
    all.push(pw);
    w.onmessage = (e: MessageEvent) => {
      const m = e.data;
      // xcross 补表回执:只结算等待者,不动 job(该 worker 可能正忙着别的任务)。
      if (m.type === 'xcross_ready') {
        xcrossWaiters.get(m.id)?.();
        xcrossWaiters.delete(m.id);
        return;
      }
      if (m.type === 'ready') {
        pw.ready = true;
        loading = false;
        if (!anyReady) { anyReady = true; resolveReady(); }
        assign(pw);
        return;
      }
      if (m.type === 'error') {
        const job = pw.job;
        pw.job = null;
        if (job) { job.reject(new Error(m.error)); assign(pw); return; } // 求解错误,worker 仍存活
        // 无 job 的 error = init 阶段失败(取表 / WASM 实例化),worker 不可用
        fail(pw, new Error(m.error || 'init failed'));
        return;
      }
      // 流式 partial:回调给调用方,但不结算 job(等最终 moves/xcr_moves 才 resolve + 派下一个)。
      if (m.type === 'moves_partial' || m.type === 'xcr_partial') {
        pw.job?.onPartial?.({ m: m.m, c: m.c }, m.len);
        return;
      }
      // 逐视角进度:同样只回调、不结算(最终 variant/f2leo 消息才是权威 6 值)。
      if (m.type === 'face_progress') {
        pw.job?.onFace?.(m.face, m.value);
        return;
      }
      const job = pw.job;
      pw.job = null;
      if (job) {
        if (m.type === 'face' || m.type === 'cr_face') job.resolve({ value: m.value, ms: m.ms });
        else if (m.type === 'moves' || m.type === 'cr_moves' || m.type === 'xcr_moves' || m.type === 'variant_moves' || m.type === 'f2leo_moves' || m.type === 'block222_moves' || m.type === 'daisy_moves' || m.type === 'first_layer_moves' || m.type === 'roux223_moves' || m.type === 'eodr_moves' || m.type === 'htr_moves' || m.type === 'htr2_moves' || m.type === 'fr_moves' || m.type === 'chain_solve' || m.type === 'cube222_moves' || m.type === 'pyraminx_moves' || m.type === 'skewb_moves') job.resolve({ ...m.data, ms: m.ms });
        else job.resolve(m.values);
      }
      assign(pw);
    };
    // 致命错误(脚本加载失败 / WASM 内存被浏览器杀掉等,onerror 常无 message):标死处理。
    w.onerror = (e) => {
      const detail = e.message || (e.filename ? `load failed: ${e.filename}` : '')
        || 'worker crashed (可能内存不足 / out of memory)';
      fail(pw, new Error(detail), true);
    };
    // 池已升级过:这个 worker 一 init 就要带上大表(ready 即具备 xcross 能力,不能等 ready 之后
    // 再补 —— 中间派进来的 job 会打在没 attach 的 WASM 上直接 panic)。字节仍走整池那一份,
    // 拿不到(已撒手 / 取表失败)才让它自己去取。gz 早已下好,这里的 await 只是一个微任务。
    if (bornWithXCross) {
      void claimXCrossGz().then(
        (gz) => { w.postMessage({ ...initMsg, xcross: true, gz }); dropXCrossGzIfDone(); },
        () => w.postMessage({ ...initMsg, xcross: true }),
      );
    } else {
      w.postMessage({ ...initMsg, xcross: false });
    }
  }

  // 大表(pt_cross_C4E0,gz 21MB)只下一次,字节从 rust-cross-tables 那个跨池单例取。
  //
  // 原先是每个 worker 自己 fetch:ensureAllXCross 向已起的 N 路一起广播,N 个 fetch 同一 URL
  // 同时出发,而浏览器**不会**把并发的同 URL 请求合成一次下载 —— 实测(计时器面板,手机宽度
  // 2 路)真的是两条 21MB 的流并行抢带宽,42MB 过线,首次切到 XCross 要等 7~15 秒。
  // 主线程取一次 gz,再把这份字节分发给每个 worker(各自解压进自己的 WASM 内存,那部分本来
  // 就得一人一份)。发完就撒手,不长期占着这 21MB。
  /** 池里每一路都拿到过大表(= 不会再有新 worker 来要)后松手,别让这 21MB 常驻主线程 ——
   *  手机上还压着两份 52MB 的解压表。此后万一还有人要,退回重新 fetch(缓存已热)。 */
  function dropXCrossGzIfDone(): void {
    if (spawned >= size && all.every((p) => p.dead || p.xcross)) releaseXCrossGz();
  }

  // 给某个 worker 补 xcross 段(幂等:pw.xcross 一旦建立就复用同一个 Promise)。
  // worker 侧 ensure_xcross 会先 await 自己的 init,故 init 未完成时发也安全。
  function ensureWorkerXCross(pw: PoolWorker): Promise<void> {
    if (pw.dead) return Promise.resolve();
    if (pw.xcross) return pw.xcross;
    const id = xcrossSeq++;
    // resolve 句柄同步挂上:worker 中途死掉时 fail() 要能结算它(此刻表可能还没下完)。
    let settle!: () => void;
    const done = new Promise<void>((res) => { settle = res; });
    pw.xcrossResolve = settle;
    xcrossWaiters.set(id, () => { pw.xcrossResolve = null; settle(); });
    pw.xcross = claimXCrossGz().then((gz) => {
      if (pw.dead) { settle(); return done; }
      // 不进 transfer list:每个 worker 要自己那一份,postMessage 的结构化克隆正是拷贝。
      pw.w.postMessage({ type: 'ensure_xcross', id, gz });
      dropXCrossGzIfDone();
      return done;
    }, (e) => {
      xcrossWaiters.delete(id);
      pw.xcross = null;
      pw.xcrossResolve = null;
      throw e;
    });
    return pw.xcross;
  }

  // std 池:variant≥1(xcross..xxxxcross)需要 pt_cross_C4E0。调用方不必记得先 ensureXCross ——
  // 这里统一拦一道,漏调只是慢一点(先补表再派发),不会让 WASM 端因未 attach 抛错。
  function jobNeedsXCross(msg: Record<string, unknown>): boolean {
    if (need !== 'cross') return false;
    const v = msg.variant;
    return typeof v === 'number' && v >= 1;
  }

  async function ensureAllXCross(): Promise<void> {
    wantXCross = true;
    await Promise.all(all.filter((p) => !p.dead).map(ensureWorkerXCross));
  }

  function submit(msg: Record<string, unknown>, onPartial?: Job['onPartial'], onFace?: Job['onFace']): Promise<unknown> {
    // 门必须是「等表真的到位」,不能只看 wantXCross 标志:补表期间后来的 job 若被放行,
    // 会打到尚未 attach 的 worker 上,WASM 端 panic('unreachable')——而 panic 过的实例
    // 连后续 attach 都做不了,那个 worker 就此报废(曾表现为 UI 永远停在「加载 XCross 数据表」)。
    // ensureAllXCross 幂等,已就绪时只是 await 一批已 resolve 的 Promise。
    if (jobNeedsXCross(msg)) {
      return ensureAllXCross().then(() => submitReady(msg, onPartial, onFace));
    }
    return submitReady(msg, onPartial, onFace);
  }

  function submitReady(msg: Record<string, unknown>, onPartial?: Job['onPartial'], onFace?: Job['onFace']): Promise<unknown> {
    // 含 Rw/Fw/旋转的打乱(如 3BLD 朝向尾缀)会让魔方偏离白顶绿前;Rust 端 string_to_alg
    // 直接跳过无法识别 token 会静默算错,故先归正到白顶绿前的纯 HTM 再喂 worker。
    // pyraminx / skewb 例外:记号非 3x3 语义(pyram 小写 tips;skewb 角转 120°,X2=240°),
    // 原样直达 Rust parse_pyraminx / parse_skewb。
    const isNon333 = typeof msg.type === 'string'
      && (msg.type.startsWith('pyraminx_') || msg.type.startsWith('skewb_'));
    if (typeof msg.scramble === 'string' && !isNon333) msg.scramble = normalizeScramble(msg.scramble) ?? msg.scramble;
    return new Promise((resolve, reject) => {
      const job: Job = { msg, resolve, reject, onPartial, onFace };
      const free = idle.pop();
      if (free && free.ready && !free.dead) dispatch(free, job);
      else { queue.push(job); maybeSpawn(); }
    });
  }

  // 立即起第一个 worker(拉表 + 发 ready),即便暂无任务也要 resolve ready。
  spawn();

  let nextId = 1;
  return {
    ready,
    size,
    solveFace(scramble, variant, face, mask) {
      return submit({
        type: 'face', id: nextId++, scramble, variant, face,
        ...(mask != null ? { mask } : {}),
      }) as Promise<FaceResult>;
    },
    solveMoves(scramble, variant, face, opts = {}, onPartial) {
      return submit({
        type: 'moves', id: nextId++, scramble, variant, face,
        extra: opts.extra ?? 0, cap: opts.cap ?? 50, combo: opts.combo ?? '',
        ...(opts.mask != null ? { mask: opts.mask } : {}),
      }, onPartial) as Promise<MovesTimed>;
    },
    solveCrossRestrictFace(scramble, face, lo, hi, maxRot) {
      return submit({ type: 'cr_face', id: nextId++, scramble, face, lo, hi, maxRot }) as Promise<FaceResult>;
    },
    solveCrossRestrictMoves(scramble, face, lo, hi, maxRot, extra, cap) {
      return submit({ type: 'cr_moves', id: nextId++, scramble, face, lo, hi, maxRot, extra, cap }) as Promise<MovesTimed>;
    },
    solveXCrossRestrictGrid(scramble, lo, hi, maxRot, k) {
      return submit({ type: 'xcr_grid', id: nextId++, scramble, lo, hi, maxRot, k }) as Promise<number[]>;
    },
    solveXCrossRestrictMoves(scramble, face, lo, hi, maxRot, extra, cap, k, combo, onPartial) {
      return submit({ type: 'xcr_moves', id: nextId++, scramble, face, lo, hi, maxRot, extra, cap, k, combo }, onPartial) as Promise<MovesTimed>;
    },
    solveF2leo(scramble, pseudo) {
      return submit({ type: 'f2leo', id: nextId++, scramble, pseudo }) as Promise<number[]>;
    },
    solveF2leoStage(scramble, pseudo, stage, mask, onFace) {
      return submit({
        type: 'f2leo_stage', id: nextId++, scramble, pseudo, stage,
        ...(mask != null ? { mask } : {}),
      }, undefined, onFace) as Promise<number[]>;
    },
    solveF2leoMoves(scramble, pseudo, face, stage, opts = {}) {
      return submit({
        type: 'f2leo_moves', id: nextId++, scramble, pseudo, face, stage,
        extra: opts.extra ?? 0, cap: opts.cap ?? 20, combo: opts.combo ?? '',
        ...(opts.mask != null ? { mask: opts.mask } : {}),
      }) as Promise<MovesTimed>;
    },
    solveVariant(scramble, variant) {
      return submit({ type: 'variant', id: nextId++, scramble, variant }) as Promise<number[]>;
    },
    solveVariantStage(scramble, variant, stage, mask, onFace) {
      return submit({
        type: 'variant_stage', id: nextId++, scramble, variant, stage,
        ...(mask != null ? { mask } : {}),
      }, undefined, onFace) as Promise<number[]>;
    },
    solveVariantMoves(scramble, variant, face, stage, opts = {}) {
      return submit({
        type: 'variant_moves', id: nextId++, scramble, variant, face, stage,
        extra: opts.extra ?? 0, cap: opts.cap ?? 20, combo: opts.combo ?? '', base: opts.base ?? -1,
        ...(opts.mask != null ? { mask: opts.mask } : {}),
      }) as Promise<MovesTimed>;
    },
    solveBlock222Stage(scramble) {
      return submit({ type: 'block222_stage', id: nextId++, scramble }) as Promise<number[]>;
    },
    solveBlock222Moves(scramble, face, opts = {}) {
      return submit({
        type: 'block222_moves', id: nextId++, scramble, face,
        extra: opts.extra ?? 0, cap: opts.cap ?? 20,
      }) as Promise<MovesTimed>;
    },
    solveDaisyStage(scramble) {
      return submit({ type: 'daisy_stage', id: nextId++, scramble }) as Promise<number[]>;
    },
    solveDaisyMoves(scramble, face, opts = {}) {
      return submit({
        type: 'daisy_moves', id: nextId++, scramble, face,
        extra: opts.extra ?? 0, cap: opts.cap ?? 20,
      }) as Promise<MovesTimed>;
    },
    solveFirstLayerStage(scramble, stage) {
      return submit({ type: 'first_layer_stage', id: nextId++, scramble, stage }) as Promise<number[]>;
    },
    solveFirstLayerMoves(scramble, stage, face, opts = {}) {
      return submit({
        type: 'first_layer_moves', id: nextId++, scramble, stage, face,
        extra: opts.extra ?? 0, cap: opts.cap ?? 20,
      }) as Promise<MovesTimed>;
    },
    solveRoux223Stage(scramble, stage) {
      return submit({ type: 'roux223_stage', id: nextId++, scramble, stage }) as Promise<number[]>;
    },
    solveRoux223Moves(scramble, stage, face, opts = {}) {
      return submit({
        type: 'roux223_moves', id: nextId++, scramble, stage, face,
        extra: opts.extra ?? 0, cap: opts.cap ?? 20,
      }) as Promise<MovesTimed>;
    },
    solveEoDrStage(scramble, stage) {
      return submit({ type: 'eodr_stage', id: nextId++, scramble, stage }) as Promise<number[]>;
    },
    solveEoDrMoves(scramble, stage, face, opts = {}) {
      return submit({
        type: 'eodr_moves', id: nextId++, scramble, stage, face,
        extra: opts.extra ?? 0, cap: opts.cap ?? 20,
      }) as Promise<MovesTimed>;
    },
    solveHtrStage(scramble) {
      return submit({ type: 'htr_stage', id: nextId++, scramble }) as Promise<number[]>;
    },
    solveHtrMoves(scramble, face, opts = {}) {
      return submit({
        type: 'htr_moves', id: nextId++, scramble, face,
        extra: opts.extra ?? 0, cap: opts.cap ?? 20,
      }) as Promise<MovesTimed>;
    },
    solveHtr2Stage(scramble) {
      return submit({ type: 'htr2_stage', id: nextId++, scramble }) as Promise<number[]>;
    },
    solveHtr2Moves(scramble, face, opts = {}) {
      return submit({
        type: 'htr2_moves', id: nextId++, scramble, face,
        extra: opts.extra ?? 0, cap: opts.cap ?? 20,
      }) as Promise<MovesTimed>;
    },
    solveFrStage(scramble) {
      return submit({ type: 'fr_stage', id: nextId++, scramble }) as Promise<number[]>;
    },
    solveFrMoves(scramble, face, opts = {}) {
      return submit({
        type: 'fr_moves', id: nextId++, scramble, face,
        extra: opts.extra ?? 0, cap: opts.cap ?? 20,
      }) as Promise<MovesTimed>;
    },
    solveChain(scramble, config) {
      return submit({ type: 'chain_solve', id: nextId++, scramble, config }) as Promise<{ chains: ChainResult[]; ms: number }>;
    },
    solveCube222Len(scramble) {
      return submit({ type: 'cube222_len', id: nextId++, scramble }) as Promise<number[]>;
    },
    solveCube222Moves(scramble) {
      return submit({ type: 'cube222_moves', id: nextId++, scramble }) as Promise<MovesTimed>;
    },
    solvePyraminxLen(scramble) {
      return submit({ type: 'pyraminx_len', id: nextId++, scramble }) as Promise<number[]>;
    },
    solvePyraminxMoves(scramble) {
      return submit({ type: 'pyraminx_moves', id: nextId++, scramble }) as Promise<MovesTimed>;
    },
    solveSkewbLen(scramble) {
      return submit({ type: 'skewb_len', id: nextId++, scramble }) as Promise<number[]>;
    },
    solveSkewbMoves(scramble) {
      return submit({ type: 'skewb_moves', id: nextId++, scramble }) as Promise<MovesTimed>;
    },
    async ensureXCross() {
      // 池是懒生成的:此刻可能只有 1 个 worker(spawn() 在建池时已起第一个)。
      // 之后 spawn 的 worker 走 bornWithXCross,init 时直接带上大表。
      if (need === 'cross') await ensureAllXCross();
    },
    hasXCross() {
      return need !== 'cross' || wantXCross;
    },
    clearQueue() { while (queue.length) queue.shift()!.reject(new Error('cancelled')); },
    abort() {
      // 只终止在跑的 worker(有 job 的);空闲 ready worker 保留,避免无谓重载表。
      for (const pw of all) {
        if (!pw.job) continue;
        pw.job.reject(new Error('aborted'));
        pw.job = null;
        try { pw.w.terminate(); } catch { /* */ }
        pw.dead = true;
        pw.xcrossResolve?.(); // 同 fail():别让 ensureXCross 等一个已被杀掉的 worker
        pw.xcrossResolve = null;
      }
      for (let i = all.length - 1; i >= 0; i--) if (all[i].dead) { all.splice(i, 1); spawned--; }
      for (let i = idle.length - 1; i >= 0; i--) if (idle[i].dead) idle.splice(i, 1);
      while (queue.length) queue.shift()!.reject(new Error('aborted'));
      loading = false;
    },
    terminate() {
      releaseXCrossGz();
      for (const pw of all) pw.w.terminate();
    },
  };
}
