'use client';

/**
 * /scramble/solver?event=15p — 15-Puzzle (数字华容道 / 十五数码) 在线求解器。
 *
 * 纯 TS,无 worker、无下载表。15 数码状态空间 ≈ 1.05×10¹³(16!/2),太大无法像 8 数码那样整图 BFS,
 * 所以每条打乱用 IDA*(迭代加深 A*)+ Walking-Distance 可采纳启发式现场求解,得到可证最短解(非近似)。
 * 上帝之数 80,随机态平均约 52.6 步。深态可能要一两秒,故求解放进 setTimeout 异步执行,期间显示
 * 「求解中」spinner,界面不会卡死。打乱来源复用 /scramble/gen 的 cstimer 桥(cstimerScramble('15p')),
 * 记号与 cstimer 完全一致(U D L R,空格滑动方向,可带次数 D2)。预览是 4×4 数字格(非魔方网)。
 */
import { cstimerScramble } from '@/lib/cstimer-scramble';
import { solveSlide15, SLIDE15_GODS_NUMBER, type Slide15Solution } from '@/lib/slide15-solver';
import PuzzleSolverPage, {
  type SolverSpec, METRIC_FIXED_OPTIMAL, badgeGodsNumber, CAVEAT_TITLE_OPTIMAL,
} from './_components/PuzzleSolverPage';

const SLIDE15_TOKEN_RE = /^([UDLR])(\d+)?$/;

const SPEC: SolverSpec<Slide15Solution> = {
  event: '15p',
  titleZh: '数字华容道求解器',
  titleEn: '15-Puzzle Solver',
  previewSize: 64,
  invocation: { async: false, solve: solveSlide15 },
  leadText: {
    zh: '数字华容道(15-Puzzle)在线求解:每条打乱用 IDA* + Walking-Distance 启发式现场算出整解最优解(可证最短,非近似)。上帝之数 80,记号 U D L R 表示空格滑动方向,与 cstimer 一致。',
    en: "15-Puzzle online solver: each scramble is solved on demand by IDA* with the Walking-Distance heuristic, giving the provably shortest solution (not an approximation). God's number is 80; notation U D L R = the direction the blank slides, matching cstimer.",
  },
  placeholder: {
    zh: '每行一条打乱,如 U R2 D L U',
    en: 'one scramble per line, e.g. U R2 D L U',
  },
  solvingText: { zh: '求解中(深态可能要一两秒)…', en: 'Solving (deep states can take a second or two)…' },
  errorNotationText: { zh: '打乱记号无法识别(应为 U D L R,可带次数如 D2)', en: 'Unrecognized notation (expected U D L R, optionally with a count like D2)' },
  metricLabel: METRIC_FIXED_OPTIMAL,
  badge: badgeGodsNumber(SLIDE15_GODS_NUMBER),
  caveatTitle: CAVEAT_TITLE_OPTIMAL,
  caveatBody: {
    zh: '15 数码有约 1.05×10¹³ 个状态(16! 的一半),太大无法像 8 数码那样整图 BFS,所以这里用 IDA* + Walking-Distance 可采纳启发式逐条求解 —— 启发式不超过真实距离,故返回的依然是可证的最短解,不是近似。任何打乱最多 80 步可还原,随机态平均约 52.6 步。',
    en: 'The 15-puzzle has ≈ 1.05×10¹³ states (half of all 16! permutations) — far too many to BFS like the 8-puzzle — so it is solved per-instance by IDA* with the admissible Walking-Distance heuristic. Since the heuristic never overestimates the true distance, the returned solution is still a provably shortest path, not an approximation. Any scramble solves in at most 80 moves, ~52.6 on average.',
  },
  validate: (line) => {
    for (const tok of line.trim().split(/\s+/)) {
      if (tok && !SLIDE15_TOKEN_RE.test(tok)) return tok;
    }
    return null;
  },
  randomOne: () => cstimerScramble('15p'),
};

export default function Slide15SolverPage() {
  return <PuzzleSolverPage spec={SPEC} />;
}
