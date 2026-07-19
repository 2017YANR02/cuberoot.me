'use client';

/**
 * /scramble/solver?event=crz3a — Crazy 3×3 (疯狂 3×3) NEAR-OPTIMAL solver.
 *
 * The Crazy 3×3 is mechanically an ORDINARY 3×3 cube (cstimer crz3a uses the standard U/D/L/R/F/B move set;
 * the "crazy" is purely presentation), with ~4.3×10¹⁹ states — far too many for a full BFS / God's-number
 * table. So, like the other TIER D puzzles, this is NOT solved provably-optimally: we REUSE the site's own
 * client-side kociemba two-phase solver (app/[lang]/scramble/solver/_kociemba/*) as a near-optimal engine
 * via lib/crz3a-solver → solveCrz3a. The result is provably valid (scramble∘solution = solved) but not
 * guaranteed shortest; typical solutions are ~18-23 HTM.
 *
 * Solving is ASYNC (a one-time prune-table build on the first call + the IDA* search), so the UI shows a
 * "solving" spinner. Notation is the standard 3×3 HTM set: U D L R F B, each with an optional 2 or '.
 * Preview reuses the standard unfolded 3×3 net (solved = each face a single color). Metric = each token =
 * 1 move (HTM); near-optimal, NOT provably shortest.
 */
import { cstimerScramble } from '@/lib/cstimer-scramble';
import { solveCrz3a, type Crz3aSolution } from '@/lib/crz3a-solver';
import PuzzleSolverPage, {
  type SolverSpec, METRIC_FIXED_NEAR_OPTIMAL, CAVEAT_TITLE_NEAR_OPTIMAL,
} from './_components/PuzzleSolverPage';

// standard 3×3 HTM token: U/D/L/R/F/B + optional 2 or '.
const CRZ3A_TOKEN_RE = /^[URFDLB][2']?$/;

const SPEC: SolverSpec<Crz3aSolution> = {
  event: 'crz3a',
  titleZh: '疯狂 3×3 求解器',
  titleEn: 'Crazy 3×3 Solver',
  previewSize: 72,
  invocation: { async: true, solve: solveCrz3a },
  leadText: {
    zh: '疯狂 3×3 在线求解:它机械上就是一个普通三阶魔方(crz3a 用标准 U D L R F B 转法,「疯狂」只是花纹),状态空间约 4.3×10¹⁹,太大无法整图枚举求可证最优。所以直接复用站内的 kociemba 两阶段求解器作为近最优引擎(可证 打乱∘解=还原,长度接近最优但非可证最短)。记号即标准三阶 HTM:U D L R F B,可带 2 或 \'。',
    en: 'Crazy 3×3 online solver: mechanically it is an ordinary 3×3 cube (crz3a uses the standard U D L R F B moves; the "crazy" is just the pattern), with ≈ 4.3×10¹⁹ states — too many to enumerate for a provably optimal solution. So we reuse the site\'s own kociemba two-phase solver as a near-optimal engine (provably scramble∘solution = solved; length is near-optimal, not provably shortest). Notation is standard 3×3 HTM: U D L R F B, optionally with 2 or \'.',
  },
  placeholder: {
    zh: "每行一条打乱,如 R U R' U' F2 D",
    en: "one scramble per line, e.g. R U R' U' F2 D",
  },
  solvingText: { zh: '求解中(首次会构建剪枝表)…', en: 'Solving (the first call builds prune tables)…' },
  errorNotationText: { zh: "打乱记号无法识别(应为标准三阶 U D L R F B,可带 2 或 ')", en: "Unrecognized notation (expected standard 3×3 U D L R F B, optionally with 2 or ')" },
  metricLabel: METRIC_FIXED_NEAR_OPTIMAL,
  caveatTitle: CAVEAT_TITLE_NEAR_OPTIMAL,
  caveatBody: {
    zh: '疯狂 3×3 就是一个普通三阶魔方,状态空间约 4.3×10¹⁹,无法像小魔方那样整图 BFS 求可证最优。这里把站内的 kociemba 两阶段求解器当引擎:先把状态归约到子群 G1(阶段一),再在 G1 内求解到还原态(阶段二)。结果保证能把打乱解开(打乱∘解=还原),长度接近最优(通常 ~18-23 步 HTM)但不保证是最短解。',
    en: 'The Crazy 3×3 is just an ordinary 3×3 cube; its state space is ≈ 4.3×10¹⁹, too large to BFS for a provably optimal solution like the small puzzles. We use the site\'s own kociemba two-phase solver as the engine: reduce the state to the subgroup G1 (phase 1), then solve within G1 to the solved state (phase 2). The result is guaranteed to solve the scramble (scramble∘solution = solved); its length is near-optimal (typically ~18-23 HTM) but not guaranteed shortest.',
  },
  validate: (line) => {
    for (const tok of line.trim().split(/\s+/)) {
      if (tok && !CRZ3A_TOKEN_RE.test(tok)) return tok;
    }
    return null;
  },
  randomOne: () => cstimerScramble('crz3a'),
};

export default function Crz3aSolverPage() {
  return <PuzzleSolverPage spec={SPEC} />;
}
