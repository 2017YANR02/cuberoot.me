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
import { EOLR_GOAL_ALGS } from '@/lib/roux/eolr-goal';

export type AlgGoal =
  | 'unregistered' // 传了 set 却没登记目标:必须失败,不能再按 sticker.kind 静默兜底
  | 'solve'        // 整体还原(PLL / ZBLL / 1LLL / ELL / 2x2 CLL / SQ1 / 金字塔 …)
  | 'f2l'          // F2L 完成,顶层随意
  | 'f2l-3slots'   // 十字完成,四个 F2L 槽至少完成三个(Advanced F2L)
  | 'f2l+co'       // F2L 完成 + 顶层角已翻色(WV / SV / VLS / CLS)
  | 'f2l+eo'       // F2L 完成 + 顶层棱已翻色(ZBLS / EO)
  | 'oll'          // F2L + 顶层全部翻色 —— 排列自由(OLL)
  | 'll-corners'   // F2L + 顶层角全好(位 + 向)+ 顶棱已翻色 —— 顶棱排列自由(COLL / OLLCP)
  | 'roux-blocks'  // Roux 左右两块 —— M 层与整个顶层自由(SBLS)
  | 'roux-blocks+eo' // Roux 左右两块 + M 层四棱(UF/UB/DF/DB)已翻色,位置自由(EO4A)
  | 'roux-blocks+eolr' // EOLR:两块保留,EO 完成且 UL/UR 已配成可用 M2 插入的目标态
  | 'cmll'         // Roux 左右两块 + 顶层角全好 —— M 层与顶棱自由
  | 'co'           // 角块全翻色,排列自由(二阶 Ortega OLL / SQ1 CO)
  | 'sq1-cs'       // SQ1 复成立方体形状,排列自由
  | 'sq1-csp'      // SQ1 复成立方体形状,且角棱排列奇偶一致
  | 'sq1-eo'       // SQ1 CO 已保留 + 棱块朝向完成
  | 'sq1-cp'       // SQ1 双层朝向完成 + 角块排列完成,棱排列自由
  | 'sq1-ep'       // SQ1 完成,容忍上下层独立 AUF
  | 'sq1-obl'      // SQ1 双层朝向完成,排列自由
  | 'mega-eo'      // 五魔方最后一层棱翻色,排列与角块自由
  | 'mega-co'      // 五魔方最后一层角棱翻色,排列自由
  | 'mega-ep'      // 五魔方最后一层棱排列完成,角排列自由
  | 'oll-4x4'      // 4x4:除顶面外全还原,顶面同色(排列自由)
  | 'centers'      // 只看中心块(5x5 L2C)
  | 'skip';        // 判不了(sticker 是 raw,或压根没有 setup)

/**
 * `puzzle/set` → 目标态。ALG_CATALOG 的每一项都必须显式列出；覆盖测试负责卡新增漏项。
 * 只有没有传 set 的通用调用才按 sticker.kind 兜底。
 */
export const SET_GOAL: Record<string, AlgGoal> = {
  // 2x2
  '2x2/ortega-oll': 'co',
  '2x2/ortega-pbl': 'solve',
  '2x2/cll': 'solve',
  '2x2/eg1': 'solve',
  '2x2/eg2': 'solve',
  '2x2/leg1': 'solve',
  '2x2/tcll-plus': 'solve',
  '2x2/tcll-minus': 'solve',
  '2x2/ls1': 'solve',
  '2x2/ls2': 'solve',
  '2x2/ls3': 'solve',
  '2x2/ls4': 'solve',
  '2x2/ls5': 'solve',
  '2x2/ls6': 'solve',
  '2x2/ls7': 'solve',
  '2x2/ls8': 'solve',
  '2x2/ls9': 'solve',
  '2x2/teg2-plus': 'solve',

  // 3x3 —— 只解一半的那些
  '3x3/f2l': 'f2l',
  '3x3/psf2l': 'f2l',
  '3x3/oll': 'oll',
  // 同一 set 同时含第一步和第二步；弱阶段目标会让第二步 case 在零步时就误判完成。
  '3x3/2-look-oll': 'solve',
  '3x3/2-look-pll': 'solve',
  '3x3/pll': 'solve',
  '3x3/zbll': 'solve',
  '3x3/ollcp': 'll-corners',
  '3x3/coll': 'll-corners',
  '3x3/cmll': 'cmll',
  '3x3/2-look-cmll': 'cmll',
  '3x3/oh-cmll': 'cmll',
  '3x3/wv': 'f2l+co',
  '3x3/sv': 'f2l+co',
  '3x3/vls': 'f2l+co',
  '3x3/cls': 'f2l+co',
  '3x3/zbls': 'f2l+eo',
  // EO4A 是**桥式**的 EO 步:两块做完,再把 M 层四棱翻色(位置自由)。公式满地纯 `M`,
  // 拿 CFOP 的 F2L+EO 判据去卡,29 条全红。
  '3x3/eo4a': 'roux-blocks+eo',
  '3x3/lse-eolr': 'roux-blocks+eolr',
  // SBLS 是 **Roux** 的二块最后一槽,不是 CFOP F2L —— 它的公式满地 `M` / `r`,M 层在 Roux 里
  // 本来就自由。拿 CFOP F2L 去要求它,135 条好公式全红。
  '3x3/sbls': 'roux-blocks',
  // 667 个「朝向 × 公式」末态实测:184 个完成四槽,483 个完成三槽；两类都保住十字。
  '3x3/adv-f2l': 'f2l-3slots',
  '3x3/fruf': 'f2l',
  '3x3/anti-pll': 'solve',
  '3x3/ell': 'solve',
  '3x3/1lll': 'solve',
  // 3BLD 换位子:一条公式就是一个三循环,`setup`(= case 态)加上它必须**整魔方还原**。
  // 必须显式写在这儿 —— 这两套的 sticker 是 `raw`(三循环跨层,face 那套顶面+四侧边描述不了),
  // 而 `goalOf` 对 raw 的兜底是 `skip`,不列的话 818 条一条都不校验,坏数据静默入库。
  '3x3/comm-corner': 'solve',
  '3x3/comm-edge': 'solve',
  // SQ1 的 raw 图示没有通用兜底；八个阶段分别登记，避免坏公式静默通过。
  'sq1/cs': 'sq1-cs',
  'sq1/csp': 'sq1-csp',
  'sq1/co': 'co',
  'sq1/eo': 'sq1-eo',
  'sq1/cp': 'sq1-cp',
  'sq1/ep': 'sq1-ep',
  'sq1/obl': 'sq1-obl',
  'sq1/parity': 'sq1-ep',
  // 大魔方
  '4x4/oll-parity': 'oll-4x4',
  '4x4/pll-parity': 'solve',
  '5x5/l2c': 'centers',
  '5x5/l2e': 'solve',
  // 其它魔方:setup 描述该阶段 case；公式完成后应整解，整体换握由 reachesGoal 容忍。
  'megaminx/full-pll': 'solve',
  'megaminx/eo': 'mega-eo',
  'megaminx/co': 'mega-co',
  'megaminx/ep': 'mega-ep',
  'megaminx/cp': 'solve',
  'pyraminx/l3e': 'solve',
  'pyraminx/l4e': 'solve',
  'skewb/sarahs-advanced': 'solve',
  // FTO 使用自己的 EIF 状态机校验；仍登记在同一契约里，防止目录新增漏校验。
  'fto/pf': 'solve',
  'fto/tl': 'solve',
  'fto/lt': 'solve',
  'fto/tcp': 'solve',
  'fto/1l3t': 'solve',
};

export function goalOf(puzzle: string, set: string | undefined, kind: AlgSticker['kind']): AlgGoal {
  const named = set ? SET_GOAL[`${puzzle}/${set}`] : undefined;
  if (named) return named;
  if (set) return 'unregistered';
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
/** 这批槽位仍装着这批块，朝向自由。 */
const containedAt = (o: Orbit, slots: number[]) => {
  const set = new Set(slots);
  return slots.every(i => set.has(o.pieces[i]));
};

const U_CORNERS = [0, 1, 2, 3];
const D_CORNERS = [4, 5, 6, 7];
const U_EDGES = [0, 1, 2, 3];
const F2L_EDGES = [4, 5, 6, 7, 8, 9, 10, 11];   // D 层 4 + 中层 4
const CROSS_EDGES = [4, 5, 6, 7];
const F2L_SLOTS = [[4, 8], [5, 9], [6, 11], [7, 10]] as const;
/** Roux 左右两块:角 DFR/DFL/DBL/DBR 全要,棱只要 DR/DL/FR/FL/BR/BL(M 层的 UF/UB/DF/DB 自由) */
const ROUX_EDGES = [5, 7, 8, 9, 10, 11];
/** M 层四棱 UF/UB/DF/DB —— 桥式 EO 只管它们翻色,不管在哪 */
const M_EDGES = [0, 2, 4, 6];
/** 4x4 顶层的 8 个 wing 槽 */
const U_WINGS_4 = [0, 1, 2, 3, 4, 8, 12, 16];
/** 五魔方 U 面一圈；由 cubing.js 的 U move 实测得到。 */
const MEGA_U_CORNERS = [0, 1, 2, 6, 7];
const MEGA_U_EDGES = [0, 1, 6, 7, 26];
/**
 * Square-1 的 WEDGES 轨道把一个角拆成相邻两个 30° wedge。orientation 永远是 0，
 * 所以 CO 要看原属 U / D 面的角 wedge 是否仍各自在对应的 12 个层槽里。
 */
const SQ1_U_CORNER_WEDGES = [0, 1, 3, 4, 6, 7, 9, 10];
const SQ1_D_CORNER_WEDGES = [12, 13, 15, 16, 18, 19, 21, 22];
const SQ1_U_EDGE_WEDGES = [2, 5, 8, 11];
const SQ1_D_EDGE_WEDGES = [14, 17, 20, 23];
const SQ1_EDGE_WEDGES = new Set([...SQ1_U_EDGE_WEDGES, ...SQ1_D_EDGE_WEDGES]);

const cyclicEqual = (actual: number[], expected: number[]): boolean =>
  actual.length === expected.length && expected.some((_, shift) =>
    actual.every((value, i) => value === expected[(i + shift) % expected.length]));

function sq1CubeShape(wedges: Orbit): boolean {
  const layerIsCube = (start: number) => {
    const positions = Array.from({ length: 12 }, (_, i) => start + i);
    const byCorner = new Map<number, number[]>();
    for (const pos of positions) {
      const piece = wedges.pieces[pos];
      if (SQ1_EDGE_WEDGES.has(piece)) continue;
      const id = Math.floor(piece / 3);
      const slots = byCorner.get(id) ?? [];
      slots.push(pos - start);
      byCorner.set(id, slots);
    }
    if (byCorner.size !== 4 || [...byCorner.values()].some(slots => slots.length !== 2)) return false;
    return [...byCorner.values()].every(([a, b]) => Math.abs(a - b) === 1 || Math.abs(a - b) === 11);
  };
  return layerIsCube(0) && layerIsCube(12);
}

function sq1LayerOriented(wedges: Orbit): boolean {
  const top = new Set(wedges.pieces.slice(0, 12));
  const bottom = new Set(wedges.pieces.slice(12, 24));
  return [...SQ1_U_CORNER_WEDGES, ...SQ1_U_EDGE_WEDGES].every(piece => top.has(piece))
    && [...SQ1_D_CORNER_WEDGES, ...SQ1_D_EDGE_WEDGES].every(piece => bottom.has(piece));
}

function sq1CornerOrder(wedges: Orbit): boolean {
  const ids = (start: number) => {
    const out: number[] = [];
    for (const piece of wedges.pieces.slice(start, start + 12)) {
      if (SQ1_EDGE_WEDGES.has(piece)) continue;
      const id = Math.floor(piece / 3);
      if (out.at(-1) !== id) out.push(id);
    }
    if (out.length > 1 && out[0] === out.at(-1)) out.pop();
    return out;
  };
  return cyclicEqual(ids(0), [0, 1, 2, 3]) && cyclicEqual(ids(12), [4, 5, 6, 7]);
}

function permutationParity(values: number[]): number {
  let parity = 0;
  for (let i = 0; i < values.length; i++) for (let j = i + 1; j < values.length; j++) {
    if (values[i] > values[j]) parity ^= 1;
  }
  return parity;
}

function sq1ParityCorrect(wedges: Orbit): boolean {
  const pieceOrder = (edges: boolean) => {
    const out: number[] = [];
    for (const start of [0, 12]) {
      const seen = new Set<number>();
      for (const piece of wedges.pieces.slice(start, start + 12)) {
        if (SQ1_EDGE_WEDGES.has(piece) !== edges) continue;
        const id = Math.floor(piece / 3);
        // 角可能跨 12 点边界；每层按物理块去重，不能只去相邻重复。
        if (!seen.has(id)) {
          seen.add(id);
          out.push(id);
        }
      }
    }
    return out;
  };
  return permutationParity(pieceOrder(false)) === permutationParity(pieceOrder(true));
}

function sq1SolvedModuloAuf(wedges: Orbit, equator: Orbit): boolean {
  return cyclicEqual(wedges.pieces.slice(0, 12), Array.from({ length: 12 }, (_, i) => i))
    && cyclicEqual(wedges.pieces.slice(12, 24), Array.from({ length: 12 }, (_, i) => i + 12))
    && equator.pieces.every((piece, i) => piece === i)
    && equator.orientation.every(value => value === 0);
}

const _eolrGoalCache = new WeakMap<KPuzzle, Set<string>>();

/** Same reduced state as the Roux EOLR pruner: blocks, LR slots and EO only. */
function eolrProjection(p: KPattern): string {
  const c = orbit(p, 'CORNERS'), e = orbit(p, 'EDGES');
  const blocks = solvedAt(c, D_CORNERS) && solvedAt(e, ROUX_EDGES);
  const lrSlots = [e.pieces[4], e.pieces[6]].sort((a, b) => a - b).join(',');
  return `${blocks ? 1 : 0}|${lrSlots}|${e.orientation.join('')}`;
}

function eolrGoalKeys(kp: KPuzzle): Set<string> {
  let keys = _eolrGoalCache.get(kp);
  if (keys) return keys;
  keys = new Set(EOLR_GOAL_ALGS.map(alg => eolrProjection(
    alg ? kp.defaultPattern().applyAlg(alg) : kp.defaultPattern(),
  )));
  _eolrGoalCache.set(kp, keys);
  return keys;
}

/** 在某一个固定朝向下,这个态达成目标了吗。 */
function reaches(p: KPattern, kp: KPuzzle, puzzle: string, goal: AlgGoal): boolean {
  if (goal === 'skip') return true;
  if (goal === 'unregistered') return false;
  if (goal === 'solve') return JSON.stringify(p.patternData) === JSON.stringify(kp.defaultPattern().patternData);

  if (puzzle === '2x2') {
    const c = orbit(p, 'CORNERS');
    if (goal === 'co') return orientedAt(c, [...U_CORNERS, ...D_CORNERS]);
    return false;
  }

  if (puzzle === 'sq1') {
    const wedges = orbit(p, 'WEDGES');
    if (!sq1CubeShape(wedges)) return false;
    if (goal === 'sq1-cs') return true;
    if (goal === 'sq1-csp') return sq1ParityCorrect(wedges);
    if (goal === 'co') {
      const top = new Set(wedges.pieces.slice(0, 12));
      const bottom = new Set(wedges.pieces.slice(12, 24));
      return SQ1_U_CORNER_WEDGES.every(piece => top.has(piece))
        && SQ1_D_CORNER_WEDGES.every(piece => bottom.has(piece));
    }
    if (goal === 'sq1-eo' || goal === 'sq1-obl') return sq1LayerOriented(wedges);
    if (goal === 'sq1-cp') return sq1LayerOriented(wedges) && sq1CornerOrder(wedges);
    if (goal === 'sq1-ep') return sq1SolvedModuloAuf(wedges, orbit(p, 'EQUATOR'));
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

  if (puzzle === 'megaminx' && (goal === 'mega-eo' || goal === 'mega-co' || goal === 'mega-ep')) {
    const c = orbit(p, 'CORNERS'), e = orbit(p, 'EDGES');
    const lowerCorners = c.pieces.map((_, i) => i).filter(i => !MEGA_U_CORNERS.includes(i));
    const lowerEdges = e.pieces.map((_, i) => i).filter(i => !MEGA_U_EDGES.includes(i));
    const lowerSolved = solvedAt(c, lowerCorners) && solvedAt(e, lowerEdges);
    const cornersInLastLayer = containedAt(c, MEGA_U_CORNERS);
    if (goal === 'mega-eo') {
      return lowerSolved && cornersInLastLayer && groupedAt(e, MEGA_U_EDGES);
    }
    const orientedLastLayer = groupedAt(c, MEGA_U_CORNERS) && groupedAt(e, MEGA_U_EDGES);
    if (goal === 'mega-co') return lowerSolved && orientedLastLayer;
    return lowerSolved && orientedLastLayer && solvedAt(e, MEGA_U_EDGES);
  }

  if (puzzle !== '3x3') return false;
  const c = orbit(p, 'CORNERS'), e = orbit(p, 'EDGES');
  const f2lDone = solvedAt(c, D_CORNERS) && solvedAt(e, F2L_EDGES);
  const f2lSlotCount = F2L_SLOTS.filter(([corner, edge]) => solvedAt(c, [corner]) && solvedAt(e, [edge])).length;
  const rouxBlocks = solvedAt(c, D_CORNERS) && solvedAt(e, ROUX_EDGES);
  switch (goal) {
    case 'f2l':          return f2lDone;
    case 'f2l-3slots':   return solvedAt(e, CROSS_EDGES) && f2lSlotCount >= 3;
    case 'f2l+co':       return f2lDone && orientedAt(c, U_CORNERS);
    case 'f2l+eo':       return f2lDone && orientedAt(e, U_EDGES);
    case 'oll':          return f2lDone && orientedAt(c, U_CORNERS) && orientedAt(e, U_EDGES);
    case 'll-corners':   return f2lDone && solvedAt(c, U_CORNERS) && orientedAt(e, U_EDGES);
    case 'roux-blocks':  return rouxBlocks;
    case 'roux-blocks+eo': return rouxBlocks && orientedAt(e, M_EDGES);
    // Compare the pruner's reduced state, not the full cube: the two UL/UR
    // edges may still need their final M2 insertion and U corners are free.
    case 'roux-blocks+eolr': return eolrGoalKeys(kp).has(eolrProjection(p));
    case 'cmll':         return rouxBlocks && solvedAt(c, U_CORNERS);
    default:             return false;
  }
}

/** 目标达成了吗 —— cube 系列容忍 24 个整体转体,其它魔方严格比。 */
export function reachesGoal(p: KPattern, kp: KPuzzle, puzzle: string, goal: AlgGoal): boolean {
  if (goal === 'skip') return true;
  if (reaches(p, kp, puzzle, goal)) return true;
  const orientations = CUBE_LIKE.has(puzzle)
    ? CUBE_ORIENTATIONS
    : orientationAlgs(kp, puzzle);
  return orientations.some(r => {
    if (!r) return false;
    try { return reaches(p.applyAlg(r), kp, puzzle, goal); } catch { return false; }
  });
}

const ORIENTATION_GENERATORS: Record<string, string[]> = {
  megaminx: ['Uv', 'Fv'],
  pyraminx: ['Uv', 'Lv'],
  skewb: ['x', 'y'],
};
const _orientationCache = new WeakMap<KPuzzle, Map<string, string[]>>();

/** 非立方体的全部整体换握；从还原态按 rotation 生成，按状态去重。 */
function orientationAlgs(kp: KPuzzle, puzzle: string): string[] {
  const generators = ORIENTATION_GENERATORS[puzzle];
  if (!generators) return [];
  let byPuzzle = _orientationCache.get(kp);
  if (!byPuzzle) {
    byPuzzle = new Map();
    _orientationCache.set(kp, byPuzzle);
  }
  const cached = byPuzzle.get(puzzle);
  if (cached) return cached;

  const out = [''];
  const seen = new Set([JSON.stringify(kp.defaultPattern().patternData)]);
  const queue: Array<{ pattern: KPattern; alg: string }> = [{ pattern: kp.defaultPattern(), alg: '' }];
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    for (const move of generators) {
      const pattern = cur.pattern.applyAlg(move);
      const key = JSON.stringify(pattern.patternData);
      if (seen.has(key)) continue;
      seen.add(key);
      const alg = `${cur.alg} ${move}`.trim();
      out.push(alg);
      queue.push({ pattern, alg });
    }
  }
  byPuzzle.set(puzzle, out);
  return out;
}
