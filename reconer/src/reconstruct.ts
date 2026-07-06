/**
 * reconstruct.ts — Step 3 逆推引擎 (纯逻辑)。
 *
 * 从 Solved 态出发, 逆序遍历每段: 取 Top-K 面 × 3 方向为候选, 对每个候选执行逆操作
 * 得到"预期上一态", 用 (视觉分 + 概率分) 贪心选择。视觉观测抽象为每段的 B 面 3×3
 * 颜色分布网格 (BFaceGrid), 由视频层 (ffmpeg+HSV) 或测试注入 — 本模块不碰视频/OpenCV。
 *
 * 对齐 greedy_reverse.py: frame_colors 为 null 时 visScore=0 (退化为纯概率排序)。
 */
import { CubeState } from "./cube-state.ts";
import { FACE_DIRECTIONS, getInverse, getMoveFace } from "./notation.ts";

/** 颜色名 (视频侧可见色): W R G Y O B */
export type ColorName = "W" | "R" | "G" | "Y" | "O" | "B";

/** CubeState 颜色 id (0..5) → 颜色名。id: U=0 R=1 F=2 D=3 L=4 B=5 */
export const CUBE_COLOR_TO_NAME: readonly ColorName[] = ["W", "R", "G", "Y", "O", "B"];

/** 单个贴纸的颜色分布 {颜色名: 概率} */
export type CellDist = Partial<Record<ColorName, number>>;

/** B 面 3×3 观测: 长度 9, 索引 i 对应 facelet 45+i (已按相机镜像重排回 CubeState 顺序) */
export type BFaceGrid = readonly CellDist[];

/** Top-K 面概率分布, 键的插入顺序 = 排名 (与 probs.json 一致) */
export type ProbDist = Record<string, number>;

export interface ReverseOptions {
  /** 概率分权重 (综合分 = 视觉分 + probScore × probWeight), 默认 2.0 */
  probWeight?: number;
  /** 每段取 Top-K 面, 默认 3 */
  topK?: number;
}

export interface ReverseResult {
  predicted: string[];
  finalState: CubeState;
}

/** 概率分: Top-1=1.0, Top-2=0.5, 其余=0.2 (与 greedy_reverse 一致) */
function probScoreOfRank(rank: number): number {
  return rank === 0 ? 1.0 : rank === 1 ? 0.5 : 0.2;
}

/**
 * 计算虚拟魔方 B 面 (45-53) 与观测网格的视觉相似度 = 各格期望色概率之和 (0~9)。
 * 与 greedy_reverse.scoreVisual 一致。
 */
export function scoreVisual(state: CubeState, grid: BFaceGrid): number {
  let score = 0;
  for (let i = 0; i < 9; i++) {
    const colorId = Math.floor(state.sc[45 + i] / 9);
    const name = CUBE_COLOR_TO_NAME[colorId];
    score += grid[i][name] ?? 0;
  }
  return score;
}

/**
 * 贪心逆推。
 * @param probDists  每段 Top-K 面概率 (probs.json)
 * @param tailRotations  末尾朝向校正转体 (先执行其逆)
 * @param grids  每段 B 面观测网格 (可选; 缺省或某段为 null → 该段纯概率排序)
 */
export function greedyReverse(
  probDists: ProbDist[],
  tailRotations: string[],
  grids?: readonly (BFaceGrid | null)[],
  opts: ReverseOptions = {},
): ReverseResult {
  const probWeight = opts.probWeight ?? 2.0;
  const topK = opts.topK ?? 3;
  const nSegs = probDists.length;

  const state = new CubeState();
  // 先执行末尾转体的逆 (朝向校正)
  for (let i = tailRotations.length - 1; i >= 0; i--) {
    state.apply(getInverse(tailRotations[i]));
  }

  const predicted: string[] = [];
  for (let t = nSegs - 1; t >= 0; t--) {
    const topFaces = Object.keys(probDists[t]).slice(0, topK);
    const grid = grids?.[t] ?? null;

    let bestMove: string | null = null;
    let bestScore = -Infinity;
    for (const [rank, face] of topFaces.entries()) {
      const probScore = probScoreOfRank(rank);
      for (const move of FACE_DIRECTIONS[face] ?? []) {
        const next = state.clone().apply(getInverse(move));
        const visScore = grid ? scoreVisual(next, grid) : 0;
        const score = visScore + probScore * probWeight;
        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
        }
      }
    }
    // 所有 Top-K 面都无对应转动 (如全是 'y') → 明确报错, 而非后续 null 崩溃
    if (bestMove === null) {
      throw new Error(`greedyReverse: 段 ${t} 无有效候选面 (top=${topFaces.join(",")})`);
    }

    // 更新状态 (执行选中动作的逆), 逆序插入到结果头部
    state.apply(getInverse(bestMove));
    predicted.unshift(bestMove);
  }

  return { predicted, finalState: state };
}

export interface CompareRow {
  seg: number;
  predicted: string;
  gt: string;
  faceOk: boolean;
  fullOk: boolean;
}

export interface CompareResult {
  rows: CompareRow[];
  faceCorrect: number;
  fullCorrect: number;
  total: number;
}

/** 逐步对比预测与 GT — 与 greedy_reverse.compareMoves 一致 (面级 / 完整级准确率) */
export function compareMoves(predicted: string[], gtMoves: string[]): CompareResult {
  const maxLen = Math.max(predicted.length, gtMoves.length);
  const rows: CompareRow[] = [];
  let faceCorrect = 0;
  let fullCorrect = 0;
  let total = 0;

  for (let i = 0; i < maxLen; i++) {
    const pred = i < predicted.length ? predicted[i] : "---";
    const gt = i < gtMoves.length ? gtMoves[i] : "---";
    const faceOk = getMoveFace(pred === "---" ? null : pred) === getMoveFace(gt === "---" ? null : gt);
    const fullOk = pred === gt;
    if (pred !== "---" && gt !== "---") {
      total++;
      if (faceOk) faceCorrect++;
      if (fullOk) fullCorrect++;
    }
    rows.push({ seg: i + 1, predicted: pred, gt, faceOk, fullOk });
  }

  return { rows, faceCorrect, fullCorrect, total };
}
