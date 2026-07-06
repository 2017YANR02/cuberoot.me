/**
 * anchored-search.ts — 已知打乱的双端锚定波束搜索 (Step 3 升级)。
 *
 * 与 greedyReverse 同为逆序推理 (从 Solved 往前), 区别:
 *   1. 波束多路径 (beam) 替代贪心单路径
 *   2. 终点硬锚定: 消费完全部段后, 状态必须等于已知打乱态 (scramble state)
 *   3. 候选词表按 notation 约定全量生成: 基本转 / 宽转 / U-D 同时转 / x 捆绑 /
 *      中途 y 插入 (不消费段, probs.json 无 y 条目) / 空段 (失误修正对, 净效果为恒等)
 *
 * 评分 = Σ log(p_effective), p 来自 probs.json 的面概率, 词表变体乘先验折扣。
 */
import { CubeState, tokenize, type Perm } from "./cube-state.ts";
import { CUBE_COLOR_TO_NAME, type BFaceGrid, type ProbDist } from "./reconstruct.ts";

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

/** 把动作串展开为单个合成置换 (newSc[i] = oldSc[perm[i]]) */
function compileMove(move: string): Perm {
  const s = new CubeState();
  s.apply(move);
  // s.sc[i] = SOLVED[perm 合成][i] = perm(i)
  return s.sc.slice();
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
  /** 逆操作的合成置换 (逆序推理时应用) */
  invPerm: Perm;
}

/** 生成全量候选词表 (与具体某段无关, 概率在搜索时按段查) */
export function buildVocabulary(): Candidate[] {
  const out: Candidate[] = [];
  const add = (token: string, prior: number, face: string | null) => {
    out.push({ token, prior, face, invPerm: compileMove(invertMove(token) || "") });
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
  out.push({ token: "", prior: 1.0, face: null, invPerm: compileMove("") });
  return out;
}

const Y_INSERTS = ["y", "y'", "y2"] as const;

export interface AnchoredOptions {
  beamWidth?: number; // 默认 512
  floorProb?: number; // probs 未列出面的保底概率, 默认 0.03
  noopProb?: number; // 空段固定概率, 默认 0.015
  yInsertProb?: number; // 每次 y 插入的概率, 默认 0.02
  maxRotInserts?: number; // 每条路径最多 y 插入数, 默认 3
  /** 每段候选过滤 (实验用: 注入方向/面 oracle 约束) */
  candidateFilter?: (t: number, cand: Candidate) => boolean;
  /** 每段起点帧的 B 面观测 (与 probs 段对齐); 提供则加视觉对数似然 */
  grids?: readonly (BFaceGrid | null)[];
  /** 视觉对数似然权重, 默认 1 */
  visualWeight?: number;
}

/** B 面 9 格观测的对数似然 (零质量格给保底 0.005) */
export function logVisual(sc: readonly number[], grid: BFaceGrid): number {
  let s = 0;
  for (let i = 0; i < 9; i++) {
    const p = grid[i][CUBE_COLOR_TO_NAME[Math.floor(sc[45 + i] / 9)]] ?? 0.005;
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

function stateKey(sc: readonly number[]): string {
  return String.fromCharCode(...sc);
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
 * 双端锚定波束搜索。
 * @param probDists 每段面概率 (probs.json, 时间正序)
 * @param tailRotations 末尾朝向校正 (先 apply 其逆, 与 greedyReverse 一致)
 * @param scrambleState 已知打乱态 (锚点): 消费完全部段后状态必须与之相等
 */
export function anchoredBeamSearch(
  probDists: ProbDist[],
  tailRotations: string[],
  scrambleState: CubeState,
  opts: AnchoredOptions = {},
): AnchoredResult {
  const beamWidth = opts.beamWidth ?? 512;
  const floorProb = opts.floorProb ?? 0.03;
  const noopProb = opts.noopProb ?? 0.015;
  const yInsertProb = opts.yInsertProb ?? 0.02;
  const maxRotInserts = opts.maxRotInserts ?? 3;

  const vocab = buildVocabulary();
  const yPerms = Y_INSERTS.map((r) => compileMove(invertToken(r)));

  const init = new CubeState();
  for (let i = tailRotations.length - 1; i >= 0; i--) init.apply(invertMove(tailRotations[i]));

  let beam: PathNode[] = [
    { state: init.sc, score: 0, move: null, isInsert: false, parent: null, inserts: 0 },
  ];

  for (let t = probDists.length - 1; t >= 0; t--) {
    const dist = probDists[t];
    const expanded = new Map<string, PathNode>();
    const push = (node: PathNode) => {
      const key = stateKey(node.state);
      const prev = expanded.get(key);
      if (!prev || node.score > prev.score) expanded.set(key, node);
    };

    const segVocab = opts.candidateFilter
      ? vocab.filter((c) => c.face === null || opts.candidateFilter!(t, c))
      : vocab;

    const grid = opts.grids?.[t] ?? null;
    const vw = opts.visualWeight ?? 1;

    for (const path of beam) {
      // 1) 直接消费段 t
      for (const cand of segVocab) {
        const p = cand.face === null ? noopProb : (dist[cand.face] ?? floorProb) * cand.prior;
        const nextState = applyPermTo(path.state, cand.invPerm);
        const vis = grid ? vw * logVisual(nextState, grid) : 0;
        push({
          state: nextState,
          score: path.score + Math.log(p) + vis,
          move: cand.token,
          isInsert: false,
          parent: path,
          inserts: path.inserts,
        });
      }
      // 2) 先插一个 y 转体 (不消费段) 再消费段 t
      if (path.inserts < maxRotInserts) {
        for (let yi = 0; yi < Y_INSERTS.length; yi++) {
          const rotNode: PathNode = {
            state: applyPermTo(path.state, yPerms[yi]),
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
            const vis = grid ? vw * logVisual(nextState, grid) : 0;
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

  const anchorKey = stateKey(scrambleState.sc);
  const anchoredPaths = beam.filter((n) => stateKey(n.state) === anchorKey);
  const best = anchoredPaths[0] ?? null;
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
