'use client';

/**
 * /scramble/solver?event=sia123 — Siamese 1×2×3(联体 1×2×3)整解最优在线求解器。TIER B(离线 PDB)。
 *
 * 纯 TS:sia123 = 两 3×3×3 沿共享 1×2×3 块联体,实测整群是 CLEAN 直积 G = G_A × G_B(A/B 招式作用不相交块
 * 且对易),每半边 = 受限 ⟨U,R,r⟩ 3×3×3(6 角 + 9 棱 + 5 中心,内层 r 4-循环 4 个面心)。解 = 按 cstimer 打乱里
 * 的 z2 拆成 A、B 两块 → 各半 IDA*(角 PDB + 两张互补 6 棱 PDB + 中心位置 PDB,max 启发)独立求最优 → 拼接 =
 * 全局最优(直积结构,长度 = 两半最优之和)。中心 POSITION 当坐标跟踪(取向单色不可见,目标不约束);引擎在
 * lib/restricted-cube-solver 为中心泛化(NZ 字段)。z2 共轭重排 piece-id → cube B PDB 与 A 不可共享,两半各存一份
 * 串进 opt_sia123.bin.gz(≤2MB,进 repo,首次求解时 fetch+inflate → 常驻类型化数组,无现场 BFS)。桌面优先。
 * 打乱来源复用 cstimer 桥 cstimerScramble('sia123')。
 */
import { cstimerScramble } from '@/lib/cstimer-scramble';
import { solveSia123, type Sia123Solution } from '@/lib/sia123-solver';
import PuzzleSolverPage, {
  type SolverSpec, METRIC_FIXED_OPTIMAL, badgeHalfLengths, CAVEAT_TITLE_OPTIMAL,
} from './_components/PuzzleSolverPage';

// quick batch validation: tokens are U/R/r·{"","2","'"} or the literal z2 separator.
function badTokenIn(line: string): string | null {
  for (const tok of line.trim().split(/\s+/)) {
    if (!tok) continue;
    if (tok === 'z2') continue;
    if (!/^[URr](2|')?$/.test(tok)) return tok;
  }
  return null;
}

const SPEC: SolverSpec<Sia123Solution> = {
  event: 'sia123',
  titleZh: '联体 1×2×3 求解器',
  titleEn: 'Siamese 1×2×3 Solver',
  previewSize: 64,
  invocation: { async: true, solve: solveSia123, tableErrorMode: true },
  leadText: {
    zh: '联体 1×2×3 在线求解:两 3×3×3 沿共享 1×2×3 块联体,整群是直积 → 按打乱里的 z2 拆半、各半受限 ⟨U,R,r⟩ 最优求解(角 + 双 6 棱 + 中心位置剪枝表)、拼接得全局最优解。剪枝表约 16MB,建议桌面端。',
    en: 'Siamese 1×2×3 online solver: two 3×3×3 cubes glued at a shared 1×2×3 block (a direct-product group). Split the scramble at z2, solve each restricted ⟨U,R,r⟩ half optimally (corner + two 6-edge + center-position databases), concatenate → globally optimal. ~16MB databases — desktop recommended.',
  },
  placeholder: {
    zh: "每行一条打乱,如 U R r' z2 U2 R r",
    en: "one scramble per line, e.g. U R r' z2 U2 R r",
  },
  solvingText: { zh: '求解中(首次会加载剪枝表)…', en: 'Solving (the first call loads the databases)…' },
  errorNotationText: { zh: '打乱记号无法识别(应为 U/R/r 招式,中间 z2 分隔两个立方)', en: 'Unrecognized notation (expected U/R/r moves with a z2 separator)' },
  errorTableText: { zh: '剪枝表加载失败,请检查网络后重试', en: 'Failed to load the pattern databases — check your connection and retry' },
  metricLabel: METRIC_FIXED_OPTIMAL,
  badge: badgeHalfLengths,
  caveatTitle: CAVEAT_TITLE_OPTIMAL,
  caveatBody: {
    zh: '联体 1×2×3 是两个 3×3×3 沿共享 1×2×3 块粘成一体的魔方。实测整个群是直积 G = G_A × G_B —— 两个立方的招式作用在互不相交的块上、两两对易;每半边都是受限 ⟨U,R,r⟩ 3×3×3(6 角轨道 29,160、9 棱轨道 92,897,280,加上内层 r 4-循环的 4 个面心)。求解时把打乱按中间的 z2 拆成 A、B 两块,各半边用 IDA* + 模式数据库(角 + 两张互补 6 棱 + 中心位置)独立求最短解,再拼接。由直积结构,拼接的总步数 = 两半最优步数之和,而且没有更短的整体解,所以这里给出的是真正的全局最优解,不是近似。中心是单色实心面,自旋不可见,目标不约束其取向,只约束位置。剪枝表两半各一份约 16MB 常驻,首次求解时下载压缩表,建议桌面端使用。',
    en: 'The Siamese 1×2×3 is two 3×3×3 cubes fused along a shared 1×2×3 block. The whole group is a measured direct product G = G_A × G_B — the two cubes\' moves act on disjoint pieces and all commute; each half is a restricted ⟨U,R,r⟩ 3×3×3 (corner orbit 29,160, edge orbit 92,897,280, plus the four face-centers 4-cycled by the inner r slice). To solve, split the scramble at the central z2 into an A-block and a B-block, solve each half optimally with IDA* + pattern databases (corner + two complementary 6-edge + a center-position table), and concatenate. By the direct-product structure the concatenation\'s length is the sum of the two half-optima and no shorter overall solution exists, so every solution here is a true GLOBAL optimum, not an approximation. The face-centers are single solid stickers — their spin is invisible, so the goal constrains their position but not their orientation. The databases (one set per half) are ~16MB resident; the first solve downloads the compressed table — desktop recommended.',
  },
  validate: badTokenIn,
  randomOne: () => cstimerScramble('sia123'),
};

export default function Sia123SolverPage() {
  return <PuzzleSolverPage spec={SPEC} />;
}
