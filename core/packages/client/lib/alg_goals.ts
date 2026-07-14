/**
 * 每个 alg set 的**目标态** —— 「这条公式算做完了吗」这句话的准确含义。
 *
 * 以前只有两档:face(整体还原)和 f2l。于是 OLL 被要求「把魔方还原」—— 可 OLL 只保证翻色,
 * 顶层排列本来就自由;CMLL 更不管 M 层和顶棱。结果:全库约 1500 条好公式被判成「没还原」。
 * 判据必须跟着 set 走。
 *
 * ## cubing.js 的块编号(实测,不是猜的)
 *
 * ```
 * 3x3 CORNERS  0=UFR 1=UBR 2=UBL 3=UFL | 4=DFR 5=DFL 6=DBL 7=DBR
 * 3x3 EDGES    0=UF 1=UR 2=UB 3=UL | 4=DF 5=DR 6=DB 7=DL | 8=FR 9=FL 10=BR 11=BL
 * 2x2 CORNERS  0..3 = U 层,4..7 = D 层
 * 4x4 EDGES    24 个 wing,U 层占 {0,1,2,3,4,8,12,16};CENTERS 按**颜色**编号(同色不分彼此)
 * ```
 *
 * 所有判据都在 24 个整体转体下试一遍(公式里常带 x / y / z),AUF 由校验器另外容忍。
 */
import type { KPattern, KPuzzle } from 'cubing/kpuzzle';
import type { AlgSticker } from '@cuberoot/shared';

export type AlgGoal =
  | 'solve'        // 整体还原(PLL / ZBLL / 1LLL / ELL / 2x2 CLL / SQ1 / 金字塔 …)
  | 'f2l'          // F2L 完成,顶层随意
  | 'f2l+co'       // F2L 完成 + 顶层角已翻色(WV / SV / VLS / CLS)
  | 'f2l+eo'       // F2L 完成 + 顶层棱已翻色(ZBLS / EO)
  | 'oll'          // F2L + 顶层全部翻色 —— 排列自由(OLL)
  | 'll-corners'   // F2L + 顶层角全好(位 + 向)+ 顶棱已翻色 —— 顶棱排列自由(COLL / OLLCP)
  | 'roux-blocks'  // Roux 左右两块 —— M 层与整个顶层自由(SBLS)
  | 'roux-blocks+eo' // Roux 左右两块 + M 层四棱(UF/UB/DF/DB)已翻色,位置自由(EO4A)
  | 'cmll'         // Roux 左右两块 + 顶层角全好 —— M 层与顶棱自由
  | 'co'           // 八个角全翻色,排列自由(二阶 Ortega OLL:两面同色)
  | 'oll-4x4'      // 4x4:除顶面外全还原,顶面同色(排列自由)
  | 'centers'      // 只看中心块(5x5 L2C)
  | 'skip';        // 判不了(sticker 是 raw,或压根没有 setup)

/** `puzzle/set` → 目标态。没列的按 sticker.kind 兜底(face → solve,f2l → f2l)。 */
export const SET_GOAL: Record<string, AlgGoal> = {
  // 3x3 —— 只解一半的那些
  '3x3/oll': 'oll',
  '3x3/ollcp': 'll-corners',
  '3x3/coll': 'll-corners',
  '3x3/cmll': 'cmll',
  '3x3/wv': 'f2l+co',
  '3x3/sv': 'f2l+co',
  '3x3/vls': 'f2l+co',
  '3x3/cls': 'f2l+co',
  '3x3/zbls': 'f2l+eo',
  // EO4A 是**桥式**的 EO 步:两块做完,再把 M 层四棱翻色(位置自由)。公式满地纯 `M`,
  // 拿 CFOP 的 F2L+EO 判据去卡,29 条全红。
  '3x3/eo4a': 'roux-blocks+eo',
  // SBLS 是 **Roux** 的二块最后一槽,不是 CFOP F2L —— 它的公式满地 `M` / `r`,M 层在 Roux 里
  // 本来就自由。拿 CFOP F2L 去要求它,135 条好公式全红。
  '3x3/sbls': 'roux-blocks',
  // AF2L(高阶 F2L)的终态**不是**完整 F2L —— 站长原话:「可能是整个 F2L 但少一个槽」。
  // 判据还没建模,先判不了(而不是一律判错:那样 483 条好公式全红,报告直接废掉)。
  // 见 docs/alg-data-cleanup.md。
  '3x3/adv-f2l': 'skip',
  '3x3/fruf': 'f2l',
  // 2x2 Ortega:先做一面(不是一层),OLL 只要求两面各自同色;PBL 是收尾一步,整魔方还原
  '2x2/ortega-oll': 'co',
  '2x2/ortega-pbl': 'solve',
  // 大魔方
  '4x4/oll-parity': 'oll-4x4',
  '4x4/pll-parity': 'solve',
  '5x5/l2c': 'centers',
  '5x5/l2e': 'solve',
};

export function goalOf(puzzle: string, set: string | undefined, kind: AlgSticker['kind']): AlgGoal {
  const named = set ? SET_GOAL[`${puzzle}/${set}`] : undefined;
  if (named) return named;
  if (kind === 'f2l') return 'f2l';
  if (kind === 'face') return 'solve';
  return 'skip';
}

/** 24 个整体 rotation —— 公式里带 y / x / z 时,末态整体偏一个转体,不算错。 */
export const CUBE_ORIENTATIONS: string[] = (() => {
  const out: string[] = [];
  for (const t of ['', 'x', 'x2', "x'", 'z', "z'"]) for (const y of ['', 'y', 'y2', "y'"]) {
    out.push([t, y].filter(Boolean).join(' '));
  }
  return out;
})();

const CUBE_LIKE = new Set(['2x2', '3x3', '4x4', '5x5']);

type Orbit = { pieces: number[]; orientation: number[] };
const orbit = (p: KPattern, name: string) => p.patternData[name] as unknown as Orbit;

/** 这批槽位的块**原样归位**(位置 + 朝向)。 */
const solvedAt = (o: Orbit, slots: number[]) => slots.every(i => o.pieces[i] === i && (o.orientation[i] ?? 0) === 0);
/** 这批槽位只要求**朝向正**(谁在哪不管)。 */
const orientedAt = (o: Orbit, slots: number[]) => slots.every(i => (o.orientation[i] ?? 0) === 0);
/** 这批槽位的块仍在这批槽位里,且朝向正 —— 「同色但可换位」。 */
const groupedAt = (o: Orbit, slots: number[]) => {
  const set = new Set(slots);
  return slots.every(i => set.has(o.pieces[i]) && (o.orientation[i] ?? 0) === 0);
};

const U_CORNERS = [0, 1, 2, 3];
const D_CORNERS = [4, 5, 6, 7];
const U_EDGES = [0, 1, 2, 3];
const F2L_EDGES = [4, 5, 6, 7, 8, 9, 10, 11];   // D 层 4 + 中层 4
/** Roux 左右两块:角 DFR/DFL/DBL/DBR 全要,棱只要 DR/DL/FR/FL/BR/BL(M 层的 UF/UB/DF/DB 自由) */
const ROUX_EDGES = [5, 7, 8, 9, 10, 11];
/** M 层四棱 UF/UB/DF/DB —— 桥式 EO 只管它们翻色,不管在哪 */
const M_EDGES = [0, 2, 4, 6];
/** 4x4 顶层的 8 个 wing 槽 */
const U_WINGS_4 = [0, 1, 2, 3, 4, 8, 12, 16];

/** 在某一个固定朝向下,这个态达成目标了吗。 */
function reaches(p: KPattern, kp: KPuzzle, puzzle: string, goal: AlgGoal): boolean {
  if (goal === 'skip') return true;
  if (goal === 'solve') return JSON.stringify(p.patternData) === JSON.stringify(kp.defaultPattern().patternData);

  if (puzzle === '2x2') {
    const c = orbit(p, 'CORNERS');
    if (goal === 'co') return orientedAt(c, [...U_CORNERS, ...D_CORNERS]);
    return false;
  }

  if (puzzle === '4x4' && goal === 'oll-4x4') {
    const c = orbit(p, 'CORNERS'), e = orbit(p, 'EDGES'), ce = orbit(p, 'CENTERS');
    const def = kp.defaultPattern();
    const dce = orbit(def, 'CENTERS');
    const lowWings = e.pieces.map((_, i) => i).filter(i => !U_WINGS_4.includes(i));
    return solvedAt(c, D_CORNERS) && orientedAt(c, U_CORNERS)
      && solvedAt(e, lowWings) && groupedAt(e, U_WINGS_4)
      && ce.pieces.every((x, i) => x === dce.pieces[i]);
  }

  if (puzzle === '5x5' && goal === 'centers') {
    const def = kp.defaultPattern();
    return ['CENTERS', 'CENTERS2', 'CENTERS3'].every(name => {
      const o = orbit(p, name), d = orbit(def, name);
      return o.pieces.every((x, i) => x === d.pieces[i]) && o.orientation.every((x, i) => x === d.orientation[i]);
    });
  }

  if (puzzle !== '3x3') return false;
  const c = orbit(p, 'CORNERS'), e = orbit(p, 'EDGES');
  const f2lDone = solvedAt(c, D_CORNERS) && solvedAt(e, F2L_EDGES);
  const rouxBlocks = solvedAt(c, D_CORNERS) && solvedAt(e, ROUX_EDGES);
  switch (goal) {
    case 'f2l':          return f2lDone;
    case 'f2l+co':       return f2lDone && orientedAt(c, U_CORNERS);
    case 'f2l+eo':       return f2lDone && orientedAt(e, U_EDGES);
    case 'oll':          return f2lDone && orientedAt(c, U_CORNERS) && orientedAt(e, U_EDGES);
    case 'll-corners':   return f2lDone && solvedAt(c, U_CORNERS) && orientedAt(e, U_EDGES);
    case 'roux-blocks':  return rouxBlocks;
    case 'roux-blocks+eo': return rouxBlocks && orientedAt(e, M_EDGES);
    case 'cmll':         return rouxBlocks && solvedAt(c, U_CORNERS);
    default:             return false;
  }
}

/** 目标达成了吗 —— cube 系列容忍 24 个整体转体,其它魔方严格比。 */
export function reachesGoal(p: KPattern, kp: KPuzzle, puzzle: string, goal: AlgGoal): boolean {
  if (goal === 'skip') return true;
  if (reaches(p, kp, puzzle, goal)) return true;
  if (!CUBE_LIKE.has(puzzle)) return false;
  return CUBE_ORIENTATIONS.some(r => {
    if (!r) return false;
    try { return reaches(p.applyAlg(r), kp, puzzle, goal); } catch { return false; }
  });
}
