'use client';

/**
 * /scramble/solver?event=ctico — Icosamate(二十面体)在线求解器。
 *
 * 纯 TS,无 worker、无下载表:ctico 可达状态 ≈ 3.556×10³³(= 12!·5¹²·20!/80,Schreier-Sims 验证),
 * 远超整图 BFS / 打包表的规模 —— 故求解核心是从零对易子约简:先把 12 个角(Z5 取向)用 3-循环 + Z5
 * 扭转归位,再把 20 个面心(固定 1 个)用「保持角不变」的面心 3-循环归位。这给出**有效 + 有界**的解
 * (非最优),硬上界 CTICO_MAX_LENGTH。打乱来源复用 /scramble/gen 的 cstimer 桥(cstimerScramble('ctico')),
 * 记号与 cstimer 完全一致(6 个顶点轴 × {"", "2", "'", "2'"} = 24 个 token,每个 = 一次 72° 顶点转)。
 */
import { cstimerScramble } from '@/lib/cstimer-scramble';
import { solveCtico, CTICO_MAX_LENGTH, CTICO_MOVE_NAMES } from '@/lib/ctico-solver';
import PuzzleSolverPage, {
  type SolverSpec, METRIC_FIXED_BOUNDED, badgeCap, CAVEAT_TITLE_BOUNDED,
} from './_components/PuzzleSolverPage';

const CTICO_NOTE = CTICO_MOVE_NAMES.slice(0, 8).join(' ') + ' …';
const CTICO_TOKEN_SET = new Set(CTICO_MOVE_NAMES);

const SPEC: SolverSpec<ReturnType<typeof solveCtico>> = {
  event: 'ctico',
  titleZh: '二十面体魔方求解器',
  titleEn: 'Icosamate Solver',
  previewSize: 120,
  invocation: { async: false, solve: solveCtico },
  leadText: {
    zh: `二十面体魔方(Icosamate)在线求解:任意打乱的有效解(从零对易子约简,有界,非最优;硬上界 ${CTICO_MAX_LENGTH} 步)。记号 ${CTICO_NOTE},与 cstimer 一致。`,
    en: `Icosamate online solver: a valid solution for any scramble (from-scratch commutator reduction; bounded, not optimal; hard cap ${CTICO_MAX_LENGTH} moves). Notation ${CTICO_NOTE}, matching cstimer.`,
  },
  placeholder: {
    zh: '每行一条打乱,如 UL UR2 FlFr LBl2\' RBr',
    en: 'one scramble per line, e.g. UL UR2 FlFr LBl2\' RBr',
  },
  solvingText: { zh: '求解中…', en: 'Solving…' },
  errorNotationText: { zh: `打乱记号无法识别(应为 ${CTICO_NOTE})`, en: `Unrecognized notation (expected ${CTICO_NOTE})` },
  metricLabel: METRIC_FIXED_BOUNDED,
  badge: badgeCap(CTICO_MAX_LENGTH),
  caveatTitle: CAVEAT_TITLE_BOUNDED,
  caveatBody: {
    zh: `二十面体魔方有约 3.556×10³³ 个状态(= 12!·5¹²·20!/80,Schreier-Sims 验证),太大无法整图枚举,所以这里不是最优解,而是一条从零对易子约简给出的有效解:12 个角是单一轨道(Z5 取向,3-循环 + 扭转归位),20 个面心里 1 个被所有转动固定、其余 19 个用「保持角不变」的面心 3-循环归位。角取向之和与转动步数耦合(每转 +1 mod 5),求解器用一段前缀把总步数调到 5 的倍数后约简即可收敛。任何打乱都能在 ${CTICO_MAX_LENGTH} 步内还原(实测约 870 步)。移动语义与打乱镜像 cstimer,几何与校验用 cstimer 的 poly3dlib;计步按 cstimer(一个 token = 1 步)。`,
    en: `The Icosamate has ~3.556×10³³ states (= 12!·5¹²·20!/80, Schreier-Sims verified), far too many to enumerate, so this is not an optimal solution but a valid one from a from-scratch commutator reduction: the 12 corners form a single orbit (Z5 orientation; 3-cycles + twists), and of the 20 face-centers one is fixed by every turn while the other 19 are solved with vertex-preserving face-center 3-cycles. The corner-orientation sum is coupled to the move count (+1 mod 5 per turn), so the solver prepends a short prefix to bring the total count to a multiple of 5 before reducing. Any scramble solves within ${CTICO_MAX_LENGTH} moves (~870 in practice). Move semantics and scrambler mirror cstimer; geometry and verification use cstimer's poly3dlib; counted in cstimer's metric (one token = one move).`,
  },
  validate: (line) => {
    for (const tok of line.trim().split(/\s+/)) {
      if (tok && !CTICO_TOKEN_SET.has(tok)) return tok;
    }
    return null;
  },
  randomOne: () => cstimerScramble('ctico'),
};

export default function CticoSolverPage() {
  return <PuzzleSolverPage spec={SPEC} />;
}
