'use client';

/**
 * /scramble/solver?event=dino — Dino Cube (恐龙魔方) NEAR-OPTIMAL solver.
 *
 * This page retains csTimer's fixed-frame IDA* solver (redi.js), with no shortest-path guarantee.
 * Standard six-colour Dino has 19,958,400 states modulo the 12 core rotations:
 * God 11 for the original colour arrangement, or 10 when its mirror is accepted.
 * Those exact distributions are computed separately by dino-exact-distribution.mts;
 * their goal sets must not be confused with this solver's fixed-frame target.
 * Tokens F L B R f l b r, optionally primed, each count one 120-degree corner turn.
 */
import { cstimerScramble } from '@/lib/cstimer-scramble';
import { solveDino, DINO_TOKEN_RE, type DinoSolution } from '@/lib/dino-solver';
import PuzzleSolverPage, {
  type SolverSpec, METRIC_FIXED_NEAR_OPTIMAL, CAVEAT_TITLE_NEAR_OPTIMAL,
} from './_components/PuzzleSolverPage';

const SPEC: SolverSpec<DinoSolution> = {
  event: 'dino',
  titleZh: '恐龙魔方求解器',
  titleEn: 'Dino Cube Solver',
  previewSize: 72,
  invocation: { async: true, solve: solveDino },
  leadText: {
    zh: "记号 F L B R f l b r 表示八个角，可加 ' 表示反向，与 csTimer 一致。",
    en: "Notation F L B R f l b r represents the eight corners; add ' for the inverse, matching csTimer.",
  },
  placeholder: {
    zh: '每行一条打乱,如 F L B r f',
    en: 'one scramble per line, e.g. F L B r f',
  },
  solvingText: { zh: '求解中(首次会构建剪枝表)…', en: 'Solving (the first call builds prune tables)…' },
  errorNotationText: { zh: "打乱记号无法识别(应为 F L B R f l b r,可带 ')", en: 'Unrecognized notation (expected F L B R f l b r, optionally primed)' },
  metricLabel: METRIC_FIXED_NEAR_OPTIMAL,
  caveatTitle: CAVEAT_TITLE_NEAR_OPTIMAL,
  caveatBody: {
    zh: '标准六色恐龙魔方忽略整体旋转后有 19,958,400 个状态。每个 ±120° 角转计 1 步：保持原配色关系的上帝之数为 11，接受镜像配色为 10。本页沿用 csTimer 的固定框架求解器，返回近最优解，不保证最短。',
    en: 'The standard six-colour Dino has 19,958,400 states with whole-puzzle rotations ignored. Each ±120° corner turn costs one move: God’s number is 11 for the original colour arrangement, or 10 if its mirror is accepted. This page retains csTimer’s fixed-frame solver and returns near-optimal solutions without a shortest-path guarantee.',
  },
  validate: (line) => {
    for (const tok of line.trim().split(/\s+/)) {
      if (tok && !DINO_TOKEN_RE.test(tok)) return tok;
    }
    return null;
  },
  randomOne: () => cstimerScramble('dino'),
};

export default function DinoSolverPage() {
  return <PuzzleSolverPage spec={SPEC} />;
}
