/*
 * cross-trainer/exact-cases — 「这一档到底是哪些状态」,给 /scramble/stats 的完整状态空间用。
 *
 * 图上每根柱子是一个计数;小到能列全的那几根,这里把状态本身交出来。两类格子两条路:
 *
 *   固定单帧  题面是「把这几块归位」,度量只读那几块 —— 正是 ./tracked 那台通用穷举 BFS 的
 *             输入。砖块三档(1×2×2 / 2×2×2 / 1×2×3)是同一台引擎的三个块表,**每一档**都能
 *             列全,因为定了帧就没有底色可取最优,一档就是那张表的一层。
 *   取最优帧  题面是「六个颜色里取最优」,只有最深那一档说得通(那里「最好的颜色是 8」与
 *             「每个颜色都是 8」是同一句话),走 ./corpus 的逐面求交。
 *
 * 每一格都要复现 `_data/exact_dist.ts` 里那个金标计数才交出去 —— 对不上就是模型漂了,
 * 宁可不显示。tests/scramble_exact_cases.test.ts 逐格锁死。
 */

import type { CubieCube } from '@/app/[lang]/timer/_lib/scramble/kociemba/cube';
import { exactCasePlan, type ExactCaseStage } from '@/app/[lang]/scramble/stats/_data/exact_dist';
import { CANON_BLOCK, block123Pieces, square122Pieces } from './block';
import { enumerateCrossTop, type CorpusMember } from './corpus';
import { FACE_EDGES, type FaceIdx } from './model';
import { CANON_FACE, cornerName, edgeName } from './rotate';
import { subsetSymmetries, trackedSymmetries } from './symmetry';
import { trackedLayer, trackedPins, trackedKey, type TrackedSpec } from './tracked';

/** 一格的三件事:某一档有哪些状态、保住这道题的对称是哪些、状态的身份怎么算。 */
export interface ExactCaseSource {
  members(depth: number): CorpusMember[];
  symmetries: Array<(c: CubieCube) => CubieCube>;
  key(c: CubieCube): string;
  /** 这一格的每一档都能列(定帧),还是只有最深那一档(多色底取最优)。 */
  everyDepth: boolean;
  /**
   * 定的是哪一帧,按块名给出(`{corners:['DFR'], edges:['DF','DR','FR']}`)。帧是任选的
   * (24 个帧共轭,分布逐档相同),但列出来的打乱只对**这一帧**是那个步数,不写清楚就没法
   * 拿去核对。取最优帧的格子没有这一项。文案由调用方拼(这里不出中文)。
   */
  frame?: { corners: string[]; edges: string[] };
}

/**
 * 站内那几条曲线用的定帧。哪一帧不影响任何一个数(所有帧共轭,分布逐档相同),
 * 但得挑定一个:一律用这个目录的规范帧 —— D 面,侧面取 R。
 */
const SIDE: FaceIdx = 1;

/** 站内 stage 键 → 那一帧盯住的块。名单在 exact_dist 那份,这里必须逐个给出帧。 */
const FIXED_FRAME: Record<ExactCaseStage, TrackedSpec> = {
  block222: { corners: [CANON_BLOCK.corner], edges: CANON_BLOCK.edges },
  fbsquare: square122Pieces(CANON_FACE, SIDE, 0),
  rouxs1: block123Pieces(CANON_FACE, SIDE),
};

const trackedSource = (s: TrackedSpec, everyDepth: boolean): ExactCaseSource => ({
  members: (depth) => trackedLayer(s, depth).map((coord) => trackedPins(s, coord)),
  symmetries: trackedSymmetries(s),
  key: (c) => trackedKey(s, c),
  everyDepth,
  frame: { corners: s.corners.map(cornerName), edges: s.edges.map(edgeName) },
});

const crossSource = (faces: FaceIdx[], everyDepth: boolean): ExactCaseSource => {
  // 十字度量读的是这些面各自的四条棱 —— 一条棱属于两个面,所以取并集。
  const edges = [...new Set(faces.flatMap((f) => FACE_EDGES[f]))].sort((a, b) => a - b);
  return {
    members: (depth) => enumerateCrossTop(faces, depth),
    // 「取最优」这道题在整组底色换到自己身上时不变 —— 群按底色筛,不按块筛。
    symmetries: subsetSymmetries(faces),
    key: (c) => trackedKey({ corners: [], edges }, c),
    everyDepth,
  };
};

/**
 * 这一格(阶段 × 帧档 × 底色)能不能把一档列全,能的话怎么列。
 * `subsetKey` 只有取最优帧的十字用得上 —— 定帧的格子没有底色维度。
 *
 * 能不能列这件事只问 exact_dist 的 `exactCasePlan`(页面拿它决定哪根柱子可点,拿的是同一份
 * 答案);这里只负责「能的话,怎么列」。
 */
export function exactCaseSource(
  stage: string, slot: string, subsetKey: string, faces: FaceIdx[],
): ExactCaseSource | null {
  const plan = exactCasePlan(stage, slot, subsetKey);
  if (!plan) return null;
  if (slot === 'fixed1') return trackedSource(FIXED_FRAME[stage as ExactCaseStage], plan.everyDepth);
  return faces.length ? crossSource(faces, plan.everyDepth) : null;
}
