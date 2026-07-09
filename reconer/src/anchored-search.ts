/**
 * anchored-search.ts — 已知打乱的双端锚定波束搜索 (物理语义版)。
 *
 * 状态 = 相机空间系下的真实贴纸排布 (physical, 见 rotation-perms.ts 语义辨析):
 *   - 候选 token 编译为真实置换 (r = ρx∘L, 转体动中心块), r 与 L 状态轨迹不同,
 *     可被视觉观测区分, 输出即人类记号。
 *   - y 插入是真实转体 (改变后续所有段的相机-面对应), 对 GT 中途 y 段必需
 *     (probs.json 跳过 y 段, 故作"不消费段"的插入处理)。
 *   - 初始 beam = 24 个 solved 朝向 (计时结束时朝向未知, 观测自然收敛);
 *     锚定 = 起点态 ∈ 打乱态的 24 个整体旋转变体 (观察前打乱后可任意持握)。
 *
 * 评分 = Σ log(p_effective) + 视觉对数似然, p 来自 probs.json 面概率 × 词表先验。
 */
import { tokenize, type Perm } from "./cube-state.ts";
import {
  CUBE_COLOR_TO_NAME,
  type BFaceGrid,
  type CellDist,
  type ColorName,
  type ProbDist,
} from "./reconstruct.ts";
import {
  ORIENTATION_PERMS,
  ROTATION_PERMS,
  invertPerm,
  permKey,
  physicalPerm,
  seqCompose,
} from "./rotation-perms.ts";

/** 单 token 取逆: X↔X', X2/X2'→X2 (适用于任意 base: U r l d y x ...) */
export function invertToken(tok: string): string {
  if (tok.endsWith("2'")) return tok.slice(0, -1);
  if (tok.endsWith("2")) return tok;
  if (tok.endsWith("'")) return tok.slice(0, -1);
  return tok + "'";
}

/** 复合 token 串取逆 (逆序 + 逐 token 取逆), 如 "UD'" → "D U'", "L2x'" → "x L2" */
export function invertMove(move: string): string {
  return tokenize(move).reverse().map(invertToken).join(" ");
}

/** 归一化用于对比: X2' ≡ X2 (方向注记不改变状态) */
export function normalizeToken(tok: string): string {
  return tok.replace(/2'/g, "2");
}

const FACES = ["U", "D", "L", "R", "F"] as const;
const DIRS = ["", "'", "2"] as const;

export interface Candidate {
  /** 输出 token (归一化形式, 空串 = 空段/修正段) */
  token: string;
  /** 该候选的先验折扣 (乘在面概率上) */
  prior: number;
  /** 依附的分类面 (取 probs 里该面概率); null = 固定概率 (空段) */
  face: string | null;
  /** 逆操作的真实空间置换 (逆序推理时应用) */
  invPerm: Perm;
  /** 正操作置换 (正向推理时应用) */
  perm: Perm;
}

/** 生成全量候选词表 (与具体某段无关, 概率在搜索时按段查) */
export function buildVocabulary(): Candidate[] {
  const out: Candidate[] = [];
  const add = (token: string, prior: number, face: string | null) => {
    const perm = physicalPerm(token);
    out.push({ token, prior, face, invPerm: invertPerm(perm), perm });
  };

  for (const face of FACES) {
    for (const dir of DIRS) {
      const basic = face + dir;
      add(basic, 1.0, face); // 基本转
      add(face.toLowerCase() + dir, 0.5, face); // 宽转 (r u l f d)
      // x 捆绑 (如 L2x'): 只捆基本转, 视频里 x 不单独分段
      for (const xv of ["x", "x'", "x2"]) add(basic + xv, 0.25, face);
    }
  }
  // U/D 同时转 (同段 2 动, U 在前与 GT 书写一致)
  for (const du of DIRS) for (const dd of DIRS) add(`U${du}D${dd}`, 0.35, "U");
  // 空段: 失误修正对 (如 l l') 净效果为恒等, 或分段误报
  add("", 1.0, null);
  return out;
}

const Y_INSERTS = ["y", "y'", "y2"] as const;

/** 单格观测: 空间 facelet 下标 + 颜色分布 */
export interface Observation {
  idx: number;
  dist: CellDist;
}

export type SegObservations = readonly Observation[] | null;

/** B 面 3×3 网格观测 → 通用观测列表 (下标 45..53) */
export function bfaceGridToObservations(grid: BFaceGrid): Observation[] {
  return grid.map((dist, i) => ({ idx: 45 + i, dist }));
}

/**
 * 面身份未知的原始 3×3 观测 (相机行主序颜色, null=不可读)。
 * 实拍中相机看到的主导面随持握变化 (B/U/L/R 都可能), 评分时对
 * 6 面 × 4 in-plane 旋转共 24 种指派取最优 (从外侧看任何面无镜像)。
 */
export interface RawFaceObs {
  colors: readonly (ColorName | null)[];
  /**
   * 可选软观测: 逐格 6 色概率向量 (COLOR_CODE 顺序 W R G Y O B, 已归一化;
   * null = 该格无信息)。提供时评分用 log p[预测色] 取代 hit/miss —
   * 颜色重叠区的格子输出近均匀 (近中性), 干净格输出尖峰 (强证据),
   * 硬 argmax 在 60-70% 精度下把混淆格变成对真路径的全额惩罚, 软通道不会。
   */
  probs?: readonly (readonly number[] | null)[];
}

const COLOR_CODE: Record<ColorName, number> = { W: 0, R: 1, G: 2, Y: 3, O: 4, B: 5 };

/**
 * 24 种指派: assign[a][cell] = 该相机格对应的 facelet 下标。
 * 相机行主序 ↔ B 面 45..53 直接同序 (金标验证)。持握朝向 ρ 下相机看到的是
 * applyTo(S,ρ) 的 B 窗口 = S[ρ[45+i]], 故合法指派集 = 24 朝向的 B 窗口回拉。
 * 勿用「facelet 下标网格 rot90」硬造 — 各面下标布局从外侧看未必是行主序
 * (镜像/错旋约定), 硬造会让真匹配落在指派集之外 (真实数据得分≈随机)。
 */
const FACE_ROT_ASSIGN: readonly (readonly number[])[] = ORIENTATION_PERMS.map((rho) =>
  Array.from({ length: 9 }, (_, i) => rho[45 + i]),
);

/**
 * 面身份边缘化的观测对数似然: 对指派集取 max (默认全 24; 可限面收紧证据)。
 * lp 提供时该格用软概率 log p[预测色] (预算好 log 的 Float64Array), 否则 hit/miss。
 */
export function logRawObs(
  sc: readonly number[],
  codes: readonly number[], // 相机 9 格颜色码 (-1 = 不可读)
  logHit: number,
  logMiss: number,
  assigns: readonly (readonly number[])[] = FACE_ROT_ASSIGN,
  lp: readonly (Float64Array | null)[] | null = null,
): number {
  let best = -Infinity;
  for (const assign of assigns) {
    let s = 0;
    for (let cell = 0; cell < 9; cell++) {
      const code = codes[cell];
      if (code < 0) continue;
      const soft = lp?.[cell];
      if (soft) s += soft[Math.floor(sc[assign[cell]] / 9)];
      else s += Math.floor(sc[assign[cell]] / 9) === code ? logHit : logMiss;
    }
    if (s > best) best = s;
  }
  return best;
}

/** 按可见面过滤指派集 (面序 U R F D L B; 如 ["U","B"] = 相机只可能看到这两面) */
export function assignsForFaces(faces: readonly ("U" | "R" | "F" | "D" | "L" | "B")[]): readonly (readonly number[])[] {
  const FACE_IDX: Record<string, number> = { U: 0, R: 1, F: 2, D: 3, L: 4, B: 5 };
  const allowed = new Set(faces.map((f) => FACE_IDX[f]));
  return FACE_ROT_ASSIGN.filter((a) => allowed.has(Math.floor(a[0] / 9)));
}

/** RawFaceObs → 颜色码数组 (评分热路径用) */
export function rawObsCodes(obs: RawFaceObs): number[] {
  return obs.colors.map((c) => (c ? COLOR_CODE[c] : -1));
}

export interface AnchoredOptions {
  beamWidth?: number; // 默认 512
  floorProb?: number; // probs 未列出面的保底概率, 默认 0.03
  noopProb?: number; // 空段固定概率, 默认 0.015
  yInsertProb?: number; // 每次 y 插入的概率, 默认 0.02
  maxRotInserts?: number; // 每条路径最多 y 插入数, 默认 3
  /** 每段候选过滤 (实验用: 注入方向/面 oracle 约束) */
  candidateFilter?: (t: number, cand: Candidate) => boolean;
  /** 每段起点帧的观测 (与 probs 段对齐); 提供则加视觉对数似然 */
  observations?: readonly SegObservations[];
  /** 末段结束后 (复原态) 的观测, 用于收敛末尾朝向 */
  finalObservation?: SegObservations;
  /**
   * 面身份未知的原始观测 (与 observations 二选一; 指派边缘化评分)。
   * 每段一个或多个网格 (静止链共识/跟踪帧); 多网格按双端点语义评分:
   * 段内任意时刻读数必属段起点态或终点态之一 (拧转前/后; 拧转中非转动层两者皆合),
   * 每网格取 max(起点, 终点), 段内求和 — 标注滞后的 ±1 归属歧义自动消解。
   */
  rawObservations?: readonly (RawFaceObs | readonly RawFaceObs[] | null)[];
  finalRawObservation?: RawFaceObs | null;
  /** 原始观测的单格命中/漏概率 (默认 0.85 / 0.03) */
  rawHitProb?: number;
  rawMissProb?: number;
  /** 软观测回火 τ: lp = τ·log p + (1-τ)·log(1/6) (相邻帧相关性/模型过自信折减, 默认 1) */
  rawSoftTemper?: number;
  /** 原始观测允许的可见面 (默认全 6 面; 限面收紧证据强度) */
  rawFaces?: readonly ("U" | "R" | "F" | "D" | "L" | "B")[];
  /**
   * 路径级指派钉死: 每条路径携带一组 pin (每个 rawFaces 面钉 1 个面内旋转,
   * 组合数 = 4^面数), 初始 beam = 24 朝向 × pin 组合, 评分只用该 pin 的指派
   * (去重键含 pin)。相比每网格自由 max over 24/8 指派, 乱态巧合从 ~48% 塌到
   * ~30%。实拍中面内旋转随手部姿态连续漂移 (实测同视频高质量链 r0-r3 全出现),
   * 须配 rawPinDrift 允许段间切换。
   */
  rawPinWindows?: boolean;
  /**
   * pin 漂移: 扩展时推两个子节点 — 保持当前 pin / 切到本段最优其他 pin 并付
   * pinSwitchLogProb 惩罚。= 把持握朝向当带平滑先验的隐变量 (离散 6-DoF-lite)。
   */
  rawPinDrift?: boolean;
  /** 每次 pin 切换的对数概率惩罚 (默认 log 0.05) */
  pinSwitchLogProb?: number;
  /**
   * 鲁棒垃圾混合: 每网格 P(obs|state) = (1-π)·P(obs|state,指派) + π·(1/6)^读格。
   * 跨面骑跨网格/坏晶格/拧转中帧对所有路径付同一常数 → 自动中和, 不再随机
   * 奖励错误状态 (实测毒观测把 GT 路径在倒序第 3 段就挤出 beam)。0 = 关闭。
   */
  rawJunkProb?: number;
  /**
   * 正向搜索: 从 {ω∘打乱态} 出发按时间正序消费段, 锚定 = 末态 ∈ 24 复原朝向。
   * 证据分布是强开局 (打乱态已知 + 观察期观测 + F2L 花色态) 弱结尾 (全黄 OLL/PLL
   * + 跨面垃圾) — 逆序搜索从最弱一端起步, 真路径在高信息区到来前就被挤出 beam
   * (实测 t37 死)。正向让真路径先靠强证据站稳。
   */
  forward?: boolean;
  /**
   * 诊断: GT 态序列 (GT 记谱系)。第 t 段处理完剪枝后, 对 debugGtStates[t] 报告
   * {o∘gt | o∈24 朝向} 在 beam 中的最好排名 (-1 = 真路径已死) 与分数落差。
   * 逆序时传段起点态; 正向时传段终点态 (调用方负责对齐)。
   */
  debugGtStates?: readonly (readonly number[])[];
  onSegmentTrace?: (t: number, info: { rank: number; gap: number; top: number; gtScore: number }) => void;
  /** 视觉对数似然权重, 默认 1 */
  visualWeight?: number;
}

/** 观测对数似然 (未列颜色给保底 0.005) */
export function logObs(sc: readonly number[], obs: readonly Observation[]): number {
  let s = 0;
  for (const { idx, dist } of obs) {
    const p = dist[CUBE_COLOR_TO_NAME[Math.floor(sc[idx] / 9)]] ?? 0.005;
    s += Math.log(p);
  }
  return s;
}

interface PathNode {
  state: number[];
  score: number;
  move: string | null; // null = 根
  isInsert: boolean;
  parent: PathNode | null;
  inserts: number;
  /** rawPinWindows 时的 pin 组合下标 (关闭时恒 0) */
  pin: number;
}

export interface AnchoredResult {
  anchored: boolean;
  /** 按时间顺序的完整 token 序列 (含插入的 y, 不含空段) */
  movesFlat: string[];
  /** 与 probs 段对齐的 token (不含 y 插入; 空段为 "") */
  segTokens: string[];
  score: number;
  /** 未锚定时的兜底: 分数最高路径 (诊断用) */
  bestUnanchored?: { movesFlat: string[]; segTokens: string[]; score: number };
}

function applyPermTo(sc: readonly number[], perm: Perm): number[] {
  const next = new Array<number>(54);
  for (let i = 0; i < 54; i++) next[i] = sc[perm[i]];
  return next;
}

/** 从叶节点回溯出时间正序的 token 列表 (逆序搜索叶在最早时刻; 正向搜索叶在最晚, 需反转) */
function collect(node: PathNode, forward = false): { movesFlat: string[]; segTokens: string[] } {
  const movesFlat: string[] = [];
  const segTokens: string[] = [];
  for (let n: PathNode | null = node; n && n.move !== null; n = n.parent) {
    if (n.isInsert) {
      movesFlat.push(n.move);
    } else {
      segTokens.push(n.move);
      if (n.move !== "") movesFlat.push(n.move);
    }
  }
  if (forward) {
    movesFlat.reverse();
    segTokens.reverse();
  }
  return { movesFlat, segTokens };
}

/**
 * 双端锚定波束搜索 (物理语义)。
 * @param probDists 每段面概率 (probs.json, 时间正序, 不含 y 段)
 * @param scrambleSc 已知打乱的空间状态 (任意持握朝向皆可; 锚定按 24 旋转变体判)
 */
export function anchoredBeamSearch(
  probDists: ProbDist[],
  scrambleSc: readonly number[],
  opts: AnchoredOptions = {},
): AnchoredResult {
  const beamWidth = opts.beamWidth ?? 512;
  const floorProb = opts.floorProb ?? 0.03;
  const noopProb = opts.noopProb ?? 0.015;
  const yInsertProb = opts.yInsertProb ?? 0.02;
  const maxRotInserts = opts.maxRotInserts ?? 3;
  const vw = opts.visualWeight ?? 1;

  const vocab = buildVocabulary();
  const yInvPerms = Y_INSERTS.map((r) => invertPerm(ROTATION_PERMS[r]));

  const logHit = Math.log(opts.rawHitProb ?? 0.85);
  const logMiss = Math.log(opts.rawMissProb ?? 0.03);
  const rawAssigns = opts.rawFaces ? assignsForFaces(opts.rawFaces) : undefined;
  // 软观测预处理: probs → 逐格 log 概率 (floor 0.02 ≈ 硬 miss 量级, 防单格 -inf 核弹)
  const softTemper = opts.rawSoftTemper ?? 1;
  const prepLP = (o: RawFaceObs): (Float64Array | null)[] | null => {
    if (!o.probs) return null;
    const logSixth = Math.log(1 / 6);
    return o.probs.map((p) => {
      if (!p) return null;
      const arr = new Float64Array(6);
      for (let i = 0; i < 6; i++) {
        arr[i] = softTemper * Math.log(Math.max(p[i], 0.02)) + (1 - softTemper) * logSixth;
      }
      return arr;
    });
  };
  const asList = (o: RawFaceObs | readonly RawFaceObs[]): readonly RawFaceObs[] =>
    Array.isArray(o) ? (o as readonly RawFaceObs[]) : [o as RawFaceObs];
  const rawCodes = opts.rawObservations?.map((o) => (o ? asList(o).map(rawObsCodes) : null));
  const rawLPs = opts.rawObservations?.map((o) => (o ? asList(o).map(prepLP) : null));
  const finalRawCodes = opts.finalRawObservation ? rawObsCodes(opts.finalRawObservation) : null;
  const finalRawLP = opts.finalRawObservation ? prepLP(opts.finalRawObservation) : null;

  // pin 组合: 每个 rawFaces 面钉 1 个面内旋转 (笛卡尔积); 关闭时单组合 = 全指派集。
  // 逐 pin 评分用共享的逐指派分数分解 (8 指派算一遍, 16 组合只做 max 组装)。
  let pinCombos: (readonly (readonly number[])[])[] = [rawAssigns ?? FACE_ROT_ASSIGN];
  let pinFlatAssigns: readonly (readonly number[])[] = [];
  let pinComboAssignIdx: number[][] = [];
  if (opts.rawPinWindows && opts.rawFaces) {
    const groups = opts.rawFaces.map((f) => assignsForFaces([f]));
    pinFlatAssigns = groups.flat();
    let comboIdx: number[][] = [[]];
    let offset = 0;
    for (const group of groups) {
      const base = offset;
      comboIdx = comboIdx.flatMap((combo) => group.map((_, gi) => [...combo, base + gi]));
      offset += group.length;
    }
    pinComboAssignIdx = comboIdx;
    pinCombos = comboIdx.map((idxs) => idxs.map((ai) => pinFlatAssigns[ai]));
  }
  const drift = opts.rawPinDrift === true && pinCombos.length > 1;
  const switchLP = opts.pinSwitchLogProb ?? Math.log(0.05);
  const junkP = opts.rawJunkProb ?? 0;
  const logJunkMix = junkP > 0 ? Math.log(junkP) : -Infinity;
  const logRealMix = junkP > 0 ? Math.log(1 - junkP) : 0;
  const LOG_SIXTH = Math.log(1 / 6);
  /** 鲁棒混合: logaddexp(log(1-π)+s, log(π)+read·log(1/6)) */
  const robust = (s: number, read: number): number => {
    if (junkP <= 0) return s;
    const a = logRealMix + s;
    const b = logJunkMix + read * LOG_SIXTH;
    const hi = a > b ? a : b;
    return hi + Math.log1p(Math.exp((a > b ? b : a) - hi));
  };
  const readOf = (codes: readonly number[]): number => {
    let n = 0;
    for (let cell = 0; cell < 9; cell++) if (codes[cell] >= 0) n++;
    return n;
  };

  /** 单指派观测对数似然 (lp 提供的格用软概率) */
  const logRawOne = (
    sc: readonly number[],
    codes: readonly number[],
    assign: readonly number[],
    lp: readonly (Float64Array | null)[] | null = null,
  ): number => {
    let s = 0;
    for (let cell = 0; cell < 9; cell++) {
      const code = codes[cell];
      if (code < 0) continue;
      const soft = lp?.[cell];
      if (soft) s += soft[Math.floor(sc[assign[cell]] / 9)];
      else s += Math.floor(sc[assign[cell]] / 9) === code ? logHit : logMiss;
    }
    return s;
  };
  /** 段观测的逐 pin 分数向量 (双端点语义: 每网格 max over 该 pin 指派 × 两端点, 再过鲁棒混合) */
  const visPerPin = (
    raw: readonly (readonly number[])[],
    lps: readonly ((Float64Array | null)[] | null)[] | null,
    startSc: readonly number[],
    endSc: readonly number[],
  ): Float64Array => {
    const totals = new Float64Array(pinCombos.length);
    const nA = pinFlatAssigns.length;
    const s = new Float64Array(nA * 2);
    for (let gi = 0; gi < raw.length; gi++) {
      const codes = raw[gi];
      const lp = lps?.[gi] ?? null;
      const rd = readOf(codes);
      for (let ai = 0; ai < nA; ai++) {
        s[ai] = logRawOne(startSc, codes, pinFlatAssigns[ai], lp);
        s[nA + ai] = logRawOne(endSc, codes, pinFlatAssigns[ai], lp);
      }
      for (let pi = 0; pi < pinCombos.length; pi++) {
        let best = -Infinity;
        for (const ai of pinComboAssignIdx[pi]) {
          if (s[ai] > best) best = s[ai];
          if (s[nA + ai] > best) best = s[nA + ai];
        }
        totals[pi] += robust(best, rd);
      }
    }
    return totals;
  };

  const fwd = opts.forward === true;
  const yPerms = Y_INSERTS.map((r) => ROTATION_PERMS[r]);
  /** 末帧观测评分 (逆序在初始 beam 上, 正向在末段之后) */
  const finalVis = (sc: readonly number[], pin: number): number =>
    opts.finalObservation
      ? vw * logObs(sc, opts.finalObservation)
      : finalRawCodes
        ? vw * robust(logRawObs(sc, finalRawCodes, logHit, logMiss, pinCombos[pin], finalRawLP), readOf(finalRawCodes))
        : 0;

  // 初始 beam × pin 组合: 逆序 = 24 solved 朝向 (末帧观测收敛朝向并淘汰错 pin);
  // 正向 = 24 个打乱态朝向变体 {ω∘scramble} (锚定条件转移到末端)
  let beam: PathNode[] = ORIENTATION_PERMS.flatMap((o) =>
    pinCombos.map((_combo, pin) => ({
      state: fwd ? [...seqCompose(o, scrambleSc)] : o.slice(),
      score: fwd ? 0 : finalVis(o, pin),
      move: null,
      isInsert: false,
      parent: null,
      inserts: 0,
      pin,
    })),
  );

  for (let step = 0; step < probDists.length; step++) {
    const t = fwd ? step : probDists.length - 1 - step;
    const dist = probDists[t];
    const expanded = new Map<string, PathNode>();
    const push = (node: PathNode) => {
      const key = pinCombos.length > 1 ? `${node.pin}|${permKey(node.state)}` : permKey(node.state);
      const prev = expanded.get(key);
      if (!prev || node.score > prev.score) expanded.set(key, node);
    };

    const segVocab = opts.candidateFilter
      ? vocab.filter((c) => c.face === null || opts.candidateFilter!(t, c))
      : vocab;

    const obs = opts.observations?.[t] ?? null;
    const raw = rawCodes?.[t] ?? null;
    const rawLP = rawLPs?.[t] ?? null;
    /** 段观测似然 (单 pin): startSc = 段起点态, endSc = 段终点态 (双端点语义) */
    const visOf = (startSc: readonly number[], endSc: readonly number[], pin: number): number => {
      if (obs) return vw * logObs(startSc, obs);
      if (!raw) return 0;
      const assigns = pinCombos[pin];
      let s = 0;
      for (let gi = 0; gi < raw.length; gi++) {
        const codes = raw[gi];
        const lp = rawLP?.[gi] ?? null;
        const a = logRawObs(startSc, codes, logHit, logMiss, assigns, lp);
        const b = logRawObs(endSc, codes, logHit, logMiss, assigns, lp);
        s += robust(a >= b ? a : b, readOf(codes));
      }
      return vw * s;
    };

    /**
     * 扩展一个 (父节点, 候选, 概率): drift 开启时推 (保持 pin, 最优切换) 两子。
     * 正向时另推"段后紧跟 y"的插入子 (y 段无帧, 只付惩罚)。
     */
    const expand = (parent: PathNode, cand: Candidate, p: number) => {
      const nextState = applyPermTo(parent.state, fwd ? cand.perm : cand.invPerm);
      const startSc = fwd ? parent.state : nextState;
      const endSc = fwd ? nextState : parent.state;
      const base = parent.score + Math.log(p);
      const children: PathNode[] = [];
      if (drift && raw && !obs) {
        const pins = visPerPin(raw, rawLP, startSc, endSc);
        const keep = pins[parent.pin];
        children.push({
          state: nextState,
          score: base + vw * keep,
          move: cand.token,
          isInsert: false,
          parent,
          inserts: parent.inserts,
          pin: parent.pin,
        });
        let bp = -1, bv = -Infinity;
        for (let pi = 0; pi < pins.length; pi++) {
          if (pi !== parent.pin && pins[pi] > bv) { bv = pins[pi]; bp = pi; }
        }
        // 切换子仅在净收益为正时值得推 (省一半 map 压力)
        if (bp >= 0 && vw * bv + switchLP > vw * keep) {
          children.push({
            state: nextState,
            score: base + vw * bv + switchLP,
            move: cand.token,
            isInsert: false,
            parent,
            inserts: parent.inserts,
            pin: bp,
          });
        }
      } else {
        children.push({
          state: nextState,
          score: base + visOf(startSc, endSc, parent.pin),
          move: cand.token,
          isInsert: false,
          parent,
          inserts: parent.inserts,
          pin: parent.pin,
        });
      }
      for (const child of children) {
        push(child);
        // 正向 y 插入: 段 t 之后紧跟转体 (逆序对应形状在下方主循环)
        if (fwd && cand.face !== null && child.inserts < maxRotInserts) {
          for (let yi = 0; yi < Y_INSERTS.length; yi++) {
            push({
              state: applyPermTo(child.state, yPerms[yi]),
              score: child.score + Math.log(yInsertProb),
              move: Y_INSERTS[yi],
              isInsert: true,
              parent: child,
              inserts: child.inserts + 1,
              pin: child.pin,
            });
          }
        }
      }
    };

    for (const path of beam) {
      // 1) 直接消费段 t
      for (const cand of segVocab) {
        const p = cand.face === null ? noopProb : (dist[cand.face] ?? floorProb) * cand.prior;
        expand(path, cand, p);
      }
      // 2) (逆序) 段 t 之后紧跟一个 y 转体 (不消费段, probs 无 y 条目) — 先撤销 y 再撤销段 t
      if (!fwd && path.inserts < maxRotInserts) {
        for (let yi = 0; yi < Y_INSERTS.length; yi++) {
          const rotNode: PathNode = {
            state: applyPermTo(path.state, yInvPerms[yi]),
            score: path.score + Math.log(yInsertProb),
            move: Y_INSERTS[yi],
            isInsert: true,
            parent: path,
            inserts: path.inserts + 1,
            pin: path.pin,
          };
          for (const cand of segVocab) {
            if (cand.face === null) continue; // y 后紧跟空段无意义
            const p = (dist[cand.face] ?? floorProb) * cand.prior;
            // 段 t 的终点 = y 之前的态 (y 段帧在 real-eval 侧已单独丢弃)
            expand(rotNode, cand, p);
          }
        }
      }
    }

    beam = [...expanded.values()].sort((a, b) => b.score - a.score).slice(0, beamWidth);

    if (opts.debugGtStates && opts.onSegmentTrace) {
      const gt = opts.debugGtStates[t];
      if (gt) {
        const keys = new Set(ORIENTATION_PERMS.map((o) => permKey(seqCompose(o, gt))));
        let rank = -1, gtScore = NaN;
        for (let i = 0; i < beam.length; i++) {
          if (keys.has(permKey(beam[i].state))) { rank = i; gtScore = beam[i].score; break; }
        }
        opts.onSegmentTrace(t, { rank, gap: rank >= 0 ? beam[0].score - gtScore : NaN, top: beam[0]?.score ?? NaN, gtScore });
      }
    }
  }

  // 正向: 末段之后计入末帧观测再重排 (逆序在初始 beam 已计)
  if (fwd && (opts.finalObservation || finalRawCodes)) {
    beam = beam
      .map((n) => ({ ...n, score: n.score + finalVis(n.state, n.pin) }))
      .sort((a, b) => b.score - a.score);
  }

  // 锚定: 逆序 = 起点态 ∈ {ω∘打乱态}; 正向 = 末态 ∈ 24 复原朝向。
  // 相机系 = GT 系差常数颜色重标 κ (共轭的外侧半): 真路径从初始朝向 ω=κ 出发,
  // 必须左复合 {ω∘R}。右复合 {R∘o} 仅在 κ=id (纯仿真) 时相交于 o=id。
  const anchorKeys = fwd
    ? new Set(ORIENTATION_PERMS.map((o) => permKey(o)))
    : new Set(ORIENTATION_PERMS.map((o) => permKey(seqCompose(o, scrambleSc))));
  const best = beam.find((n) => anchorKeys.has(permKey(n.state))) ?? null;
  const bestAny = beam[0] ?? null;

  if (best) {
    return { anchored: true, ...collect(best, fwd), score: best.score };
  }
  return {
    anchored: false,
    movesFlat: [],
    segTokens: [],
    score: -Infinity,
    bestUnanchored: bestAny ? { ...collect(bestAny, fwd), score: bestAny.score } : undefined,
  };
}
