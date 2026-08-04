/*
 * cross-trainer/exact-cases — 「这一档到底是哪些状态」,给 /scramble/stats 的完整状态空间用。
 *
 * 图上每根柱子是一个计数;小到能列全的那几根,这里把状态本身交出来。两类格子两条路:
 *
 *   固定单帧  题面是「把这几块弄成这样」,度量只读固定的那一小撮,于是整个阶段就是一张能
 *             穷举的表,**每一档**都是那张表的一层 —— 定了帧就没有底色可取最优。砖块三档
 *             (1×2×2 / 2×2×2 / 1×2×3)走 ./tracked 那台通用块 BFS;EO 三档(EO / EOLine /
 *             EOCross)走 ./eo ./eoline 的翻转字坐标,那边的表本来就是整个空间。
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
import {
  EO_POS_STATES, eoAxisData, eoCrossDist, eoCrossPins, eoFrameData, eoPack, eoPins, eoWord,
  type EoAxis, type EoFrame,
} from './eo';
import { CANON_AXIS, CANON_LINE, eoLineCoordOf, eoLineLayer, eoLinePins, eoWordOf } from './eoline';
import { CANON_EO_FRAME, eoCoordOf } from './index';
import { FACE_EDGES, FACE_LETTERS, type FaceIdx } from './model';
import { CANON_FACE, cornerName, edgeName } from './rotate';
import { faceSymmetries, subsetSymmetries, trackedSymmetries } from './symmetry';
import { trackedLayer, trackedPins, trackedKey, type TrackedSpec } from './tracked';

/** 一格的三件事:某一档有哪些状态、保住这道题的对称是哪些、状态的身份怎么算。 */
export interface ExactCaseSource {
  members(depth: number): CorpusMember[];
  symmetries: Array<(c: CubieCube) => CubieCube>;
  key(c: CubieCube): string;
  /** 这一格的每一档都能列(定帧),还是只有最深那一档(多色底取最优)。 */
  everyDepth: boolean;
  /**
   * 定的是哪一帧,按名字给出(`{corners:['DFR'], edges:['DF','DR','FR']}` / `{axis:'F/B'}`)。
   * 帧是任选的(同一阶段的各帧共轭,分布逐档相同),但列出来的打乱只对**这一帧**是那个步数,
   * 不写清楚就没法拿去核对。取最优帧的格子没有这一项。文案由调用方拼(这里不出中文)。
   */
  frame?: { face?: string; axis?: string; corners?: string[]; edges?: string[] };
}

/**
 * 站内那几条曲线用的定帧。哪一帧不影响任何一个数(同一阶段的帧互相共轭,分布逐档相同),
 * 但得挑定一个:一律用这个目录的规范帧 —— D 面,侧面取 R,EO 轴取 ./eoline 那条。
 */
const SIDE: FaceIdx = 1;

/** 一条 EO 轴 = 一对相对面。写成 `F/B`,也是筛对称时那一组。 */
const axisFaces = (axis: EoAxis): FaceIdx[] => [axis as FaceIdx, (axis + 3) as FaceIdx];
const axisName = (axis: EoAxis): string => axisFaces(axis).map((f) => FACE_LETTERS[f]).join('/');

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
 * EO 三档。坐标里的位置是「哪个槽翻了」而不是「哪块棱在哪」,所以成员给的是**十二条棱全钉**
 * (翻转由坐标定死,谁在哪个槽随便挑一种)—— 挑法不影响任何一档的步数,翻转字本来就与位置无关。
 *
 * 群按面筛不按块筛:朝向只相对一条轴才有意义,所以轴那一对面必须保住;EOLine / EOCross 还
 * 同时钉住底面,那就是两组都要保住(只剩 4 个)。
 */
const eoSource = (): ExactCaseSource => {
  const { dist, delta } = eoAxisData(CANON_AXIS);
  return {
    members: (depth) => scanLayer(dist, depth)
      .map((word) => ({ edgePins: eoPins(delta, [], [], eoWord(word), fixedRng), cornerPins: [] })),
    symmetries: faceSymmetries([axisFaces(CANON_AXIS)]),
    key: (c) => String(eoWordOf(c, CANON_AXIS)),
    everyDepth: true,
    frame: { axis: axisName(CANON_AXIS) },
  };
};

const eoLineSource = (): ExactCaseSource => ({
  members: (depth) => eoLineLayer(depth)
    .map((coord) => ({ edgePins: eoLinePins(coord, fixedRng), cornerPins: [] })),
  symmetries: faceSymmetries([[CANON_FACE], axisFaces(CANON_AXIS)]),
  key: (c) => String(eoLineCoordOf(c)),
  everyDepth: true,
  frame: { face: FACE_LETTERS[CANON_FACE], axis: axisName(CANON_AXIS), edges: CANON_LINE.map(edgeName) },
});

const eoCrossSource = (): ExactCaseSource => {
  const frame: EoFrame = CANON_EO_FRAME;
  return {
    // 24,330,240 个字节的表,首次点开约两秒;之后全站共享。
    members: (depth) => scanLayer(eoCrossDist(frame), depth).map((idx) => ({
      edgePins: eoCrossPins(frame, { pos: idx % EO_POS_STATES, eo: (idx / EO_POS_STATES) | 0 }, fixedRng),
      cornerPins: [],
    })),
    symmetries: faceSymmetries([[frame.face], axisFaces(frame.axis!)]),
    key: (c) => String(eoPack(eoCoordOf(c, eoFrameData(frame)))),
    everyDepth: true,
    frame: {
      face: FACE_LETTERS[frame.face],
      axis: axisName(frame.axis!),
      edges: FACE_EDGES[frame.face].map(edgeName),
    },
  };
};

/** 距离表里正好是 `depth` 的那些下标。 */
function scanLayer(dist: Uint8Array, depth: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < dist.length; i++) if (dist[i] === depth) out.push(i);
  return out;
}

/**
 * 补齐没钉的那几条棱时用的「rng」。列表要的是可复现的代表,不是随机样本 —— 每次点开同一档,
 * 同一行必须还是同一条(页面另有一把种子 rng 负责把角块补出来)。
 */
const fixedRng = (): number => 0;

/**
 * 站内 stage 键 → 那一格怎么列。名单在 exact_dist 那份,这里必须逐个给出做法(漏一个编译不过)。
 * 值是**惰性**的:EOCross 那张 24 MB 的表只在真点开那一格时才建。
 */
const FIXED: Record<ExactCaseStage, () => ExactCaseSource> = {
  block222: () => trackedSource({ corners: [CANON_BLOCK.corner], edges: CANON_BLOCK.edges }, true),
  fbsquare: () => trackedSource(square122Pieces(CANON_FACE, SIDE, 0), true),
  rouxs1: () => trackedSource(block123Pieces(CANON_FACE, SIDE), true),
  eo: eoSource,
  eoline: eoLineSource,
  eo_cross: eoCrossSource,
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
  if (slot === 'fixed1') return FIXED[stage as ExactCaseStage]();
  return faces.length ? crossSource(faces, plan.everyDepth) : null;
}
