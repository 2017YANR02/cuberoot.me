'use client';

/**
 * /scramble/solver?event=helicv — Curvy Copter(弧面直升机)在线求解器。
 *
 * 纯 TS,无 worker、无下载表:helicv 可达状态 ≈ 3.03×10²¹(= 8!·3⁷·(6!)⁴·2¹²/2⁵,Schreier-Sims 验证,
 * 恰为直升机魔方的 256 倍),远超整图 BFS / 打包表的规模 —— 故求解核心是从零对易子约简:先用一段
 * 17 位奇偶前缀同时清零角置换奇偶、4 个面块轨道的置换奇偶、以及 12 个弧面棱块的翻转位(这一步直接把
 * 12 个棱块全部归位),再用角 3-循环 / 角扭转 / 按轨道缓冲的面块 3-循环逐件归位。给出**有效 + 有界**的解
 * (非最优),硬上界 HELICV_MAX_LENGTH。打乱来源复用 /scramble/gen 的 cstimer 桥(cstimerScramble('helicv')),
 * 记号与 cstimer 完全一致(与直升机相同的 12 个棱名,每个 = 一次 180° 棱转),保证生成的打乱被正确求解。
 */
import { cstimerScramble } from '@/lib/cstimer-scramble';
import { solveHelicv, HELICV_MAX_LENGTH, HELICV_MOVE_NAMES } from '@/lib/helicv-solver';
import PuzzleSolverPage, {
  type SolverSpec, METRIC_FIXED_BOUNDED, badgeCap, CAVEAT_TITLE_BOUNDED,
} from './_components/PuzzleSolverPage';

const HELICV_NOTE = HELICV_MOVE_NAMES.join(' ');
const HELICV_TOKEN_SET = new Set(HELICV_MOVE_NAMES);

const SPEC: SolverSpec<ReturnType<typeof solveHelicv>> = {
  event: 'helicv',
  titleZh: '弧面直升机魔方求解器',
  titleEn: 'Curvy Copter Solver',
  previewSize: 96,
  invocation: { async: false, solve: solveHelicv },
  prewarm: () => { solveHelicv(''); },
  leadText: {
    zh: `弧面直升机魔方在线求解:任意打乱的有效解(从零对易子约简,有界,非最优;硬上界 ${HELICV_MAX_LENGTH} 步)。记号 ${HELICV_NOTE},与 cstimer 一致。`,
    en: `Curvy Copter online solver: a valid solution for any scramble (from-scratch commutator reduction; bounded, not optimal; hard cap ${HELICV_MAX_LENGTH} moves). Notation ${HELICV_NOTE}, matching cstimer.`,
  },
  placeholder: {
    zh: '每行一条打乱,如 UF DR BL UR FL',
    en: 'one scramble per line, e.g. UF DR BL UR FL',
  },
  solvingText: { zh: '求解中…', en: 'Solving…' },
  errorNotationText: { zh: `打乱记号无法识别(应为 ${HELICV_NOTE})`, en: `Unrecognized notation (expected ${HELICV_NOTE})` },
  metricLabel: METRIC_FIXED_BOUNDED,
  badge: badgeCap(HELICV_MAX_LENGTH),
  caveatTitle: CAVEAT_TITLE_BOUNDED,
  caveatBody: {
    zh: `弧面直升机魔方有约 3.03×10²¹ 个状态(= 8!·3⁷·(6!)⁴·2¹²/2⁵,Schreier-Sims 验证,是直升机魔方的 256 倍),太大无法整图枚举,所以这里不是最优解,而是一条从零对易子约简给出的有效解。它和直升机魔方共用同一组打乱招式,但弧面切割多出一类零件:8 个角(可证 3-循环 + 角扭转)、24 个面块分成 4 个各 6 件的轨道、外加 12 个弧面棱块(每个只有「归位 / 翻转」两态)。先用一段 17 位奇偶前缀同时清零角置换奇偶、4 个轨道的置换奇偶以及 12 个棱块翻转位(这一步把 12 个棱块直接全部归位),再用角 3-循环 / 角扭转 / 按轨道缓冲的面块 3-循环逐件归位。任何打乱都能在 ${HELICV_MAX_LENGTH} 步内还原(实测约 206 步)。移动语义与打乱镜像 cstimer,几何与校验用 cstimer 的 poly3dlib;计步按 cstimer(一个 token = 1 步)。`,
    en: `The Curvy Copter has ~3.03×10²¹ states (= 8!·3⁷·(6!)⁴·2¹²/2⁵, Schreier-Sims verified — 256× the Helicopter Cube), far too many to enumerate, so this is not an optimal solution but a valid one from a from-scratch commutator reduction. It shares its scramble moves with the Helicopter Cube, but the curvy cuts add a piece type: 8 corners (3-cycles + twists), 24 face pieces in 4 orbits of 6, plus 12 curvy edge pieces (each just "home / flipped"). A 17-bit parity prefix first clears the corner-permutation parity, the 4 orbit parities, and all 12 edge bits at once (this solves all 12 edge pieces outright), then corner 3-cycles, corner twists, and per-orbit buffer face-piece 3-cycles fix each piece in turn. Any scramble solves within ${HELICV_MAX_LENGTH} moves (~206 in practice). Move semantics and scrambler mirror cstimer; geometry and verification use cstimer's poly3dlib; counted in cstimer's metric (one token = one move).`,
  },
  validate: (line) => {
    for (const tok of line.trim().split(/\s+/)) {
      if (tok && !HELICV_TOKEN_SET.has(tok)) return tok;
    }
    return null;
  },
  randomOne: () => cstimerScramble('helicv'),
};

export default function HelicvSolverPage() {
  return <PuzzleSolverPage spec={SPEC} />;
}
