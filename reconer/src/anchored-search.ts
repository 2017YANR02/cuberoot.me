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
}

/** 生成全量候选词表 (与具体某段无关, 概率在搜索时按段查) */
export function buildVocabulary(): Candidate[] {
  const out: Candidate[] = [];
  const add = (token: string, prior: number, face: string | null) => {
    out.push({ token, prior, face, invPerm: invertPerm(physicalPerm(token)) });
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
}

const COLOR_CODE: Record<ColorName, number> = { W: 0, R: 1, G: 2, Y: 3, O: 4, B: 5 };

/** 24 种指派: assign[a][cell] = 该相机格对应的 facelet 下标 */
const FACE_ROT_ASSIGN: readonly (readonly number[])[] = (() => {
  const rot = (m: number[]) => [m[6], m[3], m[0], m[7], m[4], m[1], m[8], m[5], m[2]];
  const out: number[][] = [];
  for (let f = 0; f < 6; f++) {
    let base = Array.from({ length: 9 }, (_, i) => f * 9 + i);
    for (let r = 0; r < 4; r++) {
      out.push(base);
      base = rot(base);
    }
  }
  return out;
})();

/** 面身份边缘化的观测对数似然: 对指派集取 max (默认全 24; 可限面收紧证据) */
export function logRawObs(
  sc: readonly number[],
  codes: readonly number[], // 相机 9 格颜色码 (-1 = 不可读)
  logHit: number,
  logMiss: number,
  assigns: readonly (readonly number[])[] = FACE_ROT_ASSIGN,
): number {
  let best = -Infinity;
  for (const assign of assigns) {
    let s = 0;
    for (let cell = 0; cell < 9; cell++) {
      const code = codes[cell];
      if (code < 0) continue;
      s += Math.floor(sc[assign[cell]] / 9) === code ? logHit : logMiss;
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
  /** 面身份未知的原始观测 (与 observations 二选一; 24 指派边缘化评分) */
  rawObservations?: readonly (RawFaceObs | null)[];
  finalRawObservation?: RawFaceObs | null;
  /** 原始观测的单格命中/漏概率 (默认 0.85 / 0.03) */
  rawHitProb?: number;
  rawMissProb?: number;
  /** 原始观测允许的可见面 (默认全 6 面; 限面收紧证据强度) */
  rawFaces?: readonly ("U" | "R" | "F" | "D" | "L" | "B")[];
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

/** 从叶节点回溯出时间正序的 token 列表 (逆序搜索 → 叶在最早时刻) */
function collect(node: PathNode): { movesFlat: string[]; segTokens: string[] } {
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
  const rawCodes = opts.rawObservations?.map((o) => (o ? rawObsCodes(o) : null));
  const finalRawCodes = opts.finalRawObservation ? rawObsCodes(opts.finalRawObservation) : null;

  // 初始 beam: 24 个 solved 朝向 (末帧观测可收敛)
  let beam: PathNode[] = ORIENTATION_PERMS.map((o) => ({
    state: o.slice(),
    score: opts.finalObservation
      ? vw * logObs(o, opts.finalObservation)
      : finalRawCodes
        ? vw * logRawObs(o, finalRawCodes, logHit, logMiss, rawAssigns)
        : 0,
    move: null,
    isInsert: false,
    parent: null,
    inserts: 0,
  }));

  for (let t = probDists.length - 1; t >= 0; t--) {
    const dist = probDists[t];
    const expanded = new Map<string, PathNode>();
    const push = (node: PathNode) => {
      const key = permKey(node.state);
      const prev = expanded.get(key);
      if (!prev || node.score > prev.score) expanded.set(key, node);
    };

    const segVocab = opts.candidateFilter
      ? vocab.filter((c) => c.face === null || opts.candidateFilter!(t, c))
      : vocab;

    const obs = opts.observations?.[t] ?? null;
    const raw = rawCodes?.[t] ?? null;
    const visOf = (sc: readonly number[]): number =>
      obs ? vw * logObs(sc, obs) : raw ? vw * logRawObs(sc, raw, logHit, logMiss, rawAssigns) : 0;

    for (const path of beam) {
      // 1) 直接消费段 t
      for (const cand of segVocab) {
        const p = cand.face === null ? noopProb : (dist[cand.face] ?? floorProb) * cand.prior;
        const nextState = applyPermTo(path.state, cand.invPerm);
        const vis = visOf(nextState);
        push({
          state: nextState,
          score: path.score + Math.log(p) + vis,
          move: cand.token,
          isInsert: false,
          parent: path,
          inserts: path.inserts,
        });
      }
      // 2) 段 t 之后紧跟一个 y 转体 (不消费段, probs 无 y 条目) — 逆序时先撤销 y 再撤销段 t
      if (path.inserts < maxRotInserts) {
        for (let yi = 0; yi < Y_INSERTS.length; yi++) {
          const rotNode: PathNode = {
            state: applyPermTo(path.state, yInvPerms[yi]),
            score: path.score + Math.log(yInsertProb),
            move: Y_INSERTS[yi],
            isInsert: true,
            parent: path,
            inserts: path.inserts + 1,
          };
          for (const cand of segVocab) {
            if (cand.face === null) continue; // y 后紧跟空段无意义
            const p = (dist[cand.face] ?? floorProb) * cand.prior;
            const nextState = applyPermTo(rotNode.state, cand.invPerm);
            const vis = visOf(nextState);
            push({
              state: nextState,
              score: rotNode.score + Math.log(p) + vis,
              move: cand.token,
              isInsert: false,
              parent: rotNode,
              inserts: rotNode.inserts,
            });
          }
        }
      }
    }

    beam = [...expanded.values()].sort((a, b) => b.score - a.score).slice(0, beamWidth);
  }

  // 锚定: 起点态 ∈ 打乱态的 24 个整体旋转变体
  const anchorKeys = new Set(ORIENTATION_PERMS.map((o) => permKey(seqCompose(scrambleSc, o))));
  const best = beam.find((n) => anchorKeys.has(permKey(n.state))) ?? null;
  const bestAny = beam[0] ?? null;

  if (best) {
    return { anchored: true, ...collect(best), score: best.score };
  }
  return {
    anchored: false,
    movesFlat: [],
    segTokens: [],
    score: -Infinity,
    bestUnanchored: bestAny ? { ...collect(bestAny), score: bestAny.score } : undefined,
  };
}
