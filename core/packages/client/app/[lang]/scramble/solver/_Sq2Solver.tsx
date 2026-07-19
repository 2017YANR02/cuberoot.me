'use client';

/**
 * /scramble/solver?event=sq2 — Square-2 (方块二) 在线求解器。
 *
 * 纯 TS,无 worker、无下载表。Square-2 = Square-1 的角全部一切为二,12 个顶 + 12 个底全是等大 30° 楔块,
 * 任何 (u,d)/ 转动都合法(不会像 Square-1 那样卡角)。在 cstimer 的 (u,d)/ 记号下可达状态
 * 76,828,484,468,736,000(= 12·18!,Schreier-Sims 实算),太大无法整图 BFS,单阶段 IDA* 也会爆。
 * 策略 = 约简(归正奇偶 + 共轭 3-循环逐块归位),任何打乱都返回一条有界的**近最优**解(optimal:false)。
 *
 * 记号 = cstimer 同款 (u,d)/ 元组(u,d ∈ [-5,6],不同时为 0);每个 (u,d)/ 元组计 1 步。
 */
import { randomSq2Scramble, solveSq2, SQ2_STATE_COUNT_STR, type Sq2Solution } from '@/lib/sq2-solver';
import PuzzleSolverPage, {
  type SolverSpec, METRIC_TERNARY_OPTIMAL_BOUNDED, CAVEAT_TITLE_OPTIMAL,
} from './_components/PuzzleSolverPage';

// random-scramble length for the buttons (cstimer sq2 default is 10 tuples).
const RANDOM_LEN = 10;
const HAS_TOKENS = /[\d/]/;

const SPEC: SolverSpec<Sq2Solution> = {
  event: 'sq2',
  titleZh: '方块二求解器',
  titleEn: 'Square-2 Solver',
  previewSize: 96,
  invocation: { async: false, solve: solveSq2 },
  hasTokensGate: true,
  leadText: {
    zh: 'Square-2(方块二)在线求解:约简法给出一条有效且有界的解(非近最优)。记号 (u,d)/(u,d ∈ [-5,6]),每个元组计 1 步。',
    en: 'Square-2 online solver: a reduction method returns a valid, bounded solution (not near-optimal). Notation (u,d)/ (u,d ∈ [-5,6]); each tuple counts as one move.',
  },
  placeholder: {
    zh: '每行一条打乱,如 (1,0)/ (-3,3)/ (0,-3)/',
    en: 'one scramble per line, e.g. (1,0)/ (-3,3)/ (0,-3)/',
  },
  solvingText: { zh: '求解中…', en: 'Solving…' },
  errorNotationText: { zh: '打乱记号无法识别(应为 (u,d)/ 形式)', en: 'Unrecognized notation (expected (u,d)/)' },
  metricLabel: METRIC_TERNARY_OPTIMAL_BOUNDED,
  caveatTitle: CAVEAT_TITLE_OPTIMAL,
  caveatBody: {
    zh: `Square-2 在 (u,d)/ 记号下有 ${SQ2_STATE_COUNT_STR} 个可达状态(= 12·18!,由 Schreier-Sims 实算),太大无法整图 BFS,单阶段 IDA* 在随机态上会爆,所以解**不是**最优。采用构造式约简(先归正奇偶,再用共轭 3-循环把每个楔块逐一归位):任何打乱都能解出一条**有效且有界**的解,但步数明显多于最短解(实测均值约 70 元组),标为「有界」而非近最优。`,
    en: `Under the (u,d)/ notation the Square-2 has ${SQ2_STATE_COUNT_STR} reachable states (= 12·18!, from Schreier-Sims) — far too many to BFS, and single-phase IDA* explodes on random states, so solutions are NOT optimal. The solver uses a constructive reduction (fix parity, then home each wedge with conjugated 3-cycles): ANY scramble returns a VALID, BOUNDED solution, but noticeably longer than the shortest (measured mean ≈ 70 tuples) — labeled "bounded", not near-optimal.`,
  },
  validate: (line) => (HAS_TOKENS.test(line.trim()) ? null : line.trim()),
  randomOne: () => Promise.resolve(randomSq2Scramble(RANDOM_LEN)),
};

export default function Sq2SolverPage() {
  return <PuzzleSolverPage spec={SPEC} />;
}
