/**
 * pocket-facelet — 2×2×2 的「画状态」模型:24 格 URFDLB facelet ↔ 角块状态(cp/co),
 * 合法性校验,以及任意所画状态的 HTM 最优解。
 *
 * 状态模型与 lib/cube222-metric / lib/pocket-scramble 完全同源(8 角 URF0 UFL1 ULB2 UBR3
 * DFR4 DLF5 DBL6 DRB7,每角 3 色按顺时针序,朝向 = 让 U/D 色回到本位所需的旋转数)。CC 表
 * 就是 3×3 那份 CORNER_FACELET(facelet.ts)的 2×2 缩影 —— 同顺序、同手性,故两边可互相校验。
 *
 * 与 3×3 的关键差别:**二阶没有中心块**,整体朝向是自由的。所以
 *   1. 校验只有三条:8 个角块各出现一次、每角三色是真实存在的角(相邻 + 手性对)、扭转和 ≡ 0 (mod 3);
 *      **没有** 排列奇偶约束(单面转即奇置换)。
 *   2. 求解前先用 24 个整体旋转里唯一那个把 DBL 角转回原位(朝向 0),化归到 pocket-scramble
 *      的固定 DBL / 只 U R F 的 3,674,160 态精确模型;解出来的招式再按逆旋转换回**所画那个朝向**,
 *      于是给出的解可能含 D / L / B —— 拿着画的那个姿势直接照做即可。
 *   3. 「还原」= 六面各自单色(允许整体旋转),这也是二阶最优步数(上帝之数 11)的标准口径。
 */

import { optimalPocketSolveCodes, POCKET_MOVE_NAMES } from './pocket-scramble';

/** facelet 面序(与 3×3 一致):U0 R1 F2 D3 L4 B5,每面 2×2 行主序 → 共 24 格。 */
export const POCKET_FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
export type PocketFace = (typeof POCKET_FACES)[number];

export const POCKET_STICKERS = 24;

/** CC 表内部的面编码(沿用 cube222-metric):U0 D1 F2 B3 R4 L5。 */
const CC_FACE: PocketFace[] = ['U', 'D', 'F', 'B', 'R', 'L'];
/** 8 个角块的三色(顺时针,U/D 色在首位)—— cube222-metric 的 CC,逐项等于 3×3 CORNER_FACELET 的面。 */
const CC: ReadonlyArray<readonly [number, number, number]> = [
  [0, 4, 2], [0, 2, 5], [0, 5, 3], [0, 3, 4],
  [1, 2, 4], [1, 5, 2], [1, 3, 5], [1, 4, 3],
];

/**
 * 每个角位的 3 个 sticker idx,顺序与 CC[slot] 的面一一对应。
 * 逐项 = facelet.ts 的 CORNER_FACELET 在 2×2 上的对应格(已核对全部 8×3 项)。
 */
export const POCKET_CORNER_FACELET: ReadonlyArray<readonly [number, number, number]> = [
  [3, 4, 9],   // URF: U(1,1) R(0,0) F(0,1)
  [2, 8, 17],  // UFL: U(1,0) F(0,0) L(0,1)
  [0, 16, 21], // ULB: U(0,0) L(0,0) B(0,1)
  [1, 20, 5],  // UBR: U(0,1) B(0,0) R(0,1)
  [13, 11, 6], // DFR: D(0,1) F(1,1) R(1,0)
  [12, 19, 10],// DLF: D(0,0) L(1,1) F(1,0)
  [14, 23, 18],// DBL: D(1,0) B(1,1) L(1,0)
  [15, 7, 22], // DRB: D(1,1) R(1,1) B(1,0)
];

/** 同块伙伴(画的时候用来拒绝同块重复色 / 相对面色):每格 2 个伙伴。 */
export const POCKET_STICKER_SIBLINGS: ReadonlyArray<readonly number[]> = (() => {
  const out: number[][] = Array.from({ length: POCKET_STICKERS }, () => []);
  for (const [a, b, c] of POCKET_CORNER_FACELET) {
    out[a] = [b, c];
    out[b] = [a, c];
    out[c] = [a, b];
  }
  return out;
})();

export const SOLVED_POCKET_FACELET = POCKET_FACES.map((f) => f.repeat(4)).join('');
export const EMPTY_POCKET_FACELET = 'X'.repeat(POCKET_STICKERS);

export interface PocketState { cp: Int8Array; co: Int8Array }

export const solvedPocketState = (): PocketState => ({
  cp: Int8Array.from([0, 1, 2, 3, 4, 5, 6, 7]),
  co: new Int8Array(8),
});

// ── 状态 ↔ facelet ────────────────────────────────────────────────────────────────────────────
// 与 cube222-metric 的 showColor 同一式:角位 slot 在面 CC[slot][j] 上露出的色 =
// CC[cp[slot]][(j - co[slot]) mod 3]。

export function pocketStateToFacelet(s: PocketState): string {
  const out = new Array<string>(POCKET_STICKERS).fill('X');
  for (let slot = 0; slot < 8; slot++) {
    const piece = s.cp[slot];
    const ori = s.co[slot];
    for (let j = 0; j < 3; j++) {
      out[POCKET_CORNER_FACELET[slot][j]] = CC_FACE[CC[piece][(((j - ori) % 3) + 3) % 3]];
    }
  }
  return out.join('');
}

/** facelet(24 格,大写面字母)→ 角块状态。色组不成块时抛错。 */
export function faceletToPocketState(facelet: string): PocketState {
  if (facelet.length !== POCKET_STICKERS) {
    throw new Error(`facelet length ${facelet.length}, expected ${POCKET_STICKERS}`);
  }
  const cp = new Int8Array(8);
  const co = new Int8Array(8);
  for (let slot = 0; slot < 8; slot++) {
    const cols: number[] = [];
    for (let j = 0; j < 3; j++) {
      const ch = facelet[POCKET_CORNER_FACELET[slot][j]];
      const f = CC_FACE.indexOf(ch as PocketFace);
      if (f === -1) throw new Error(`corner ${slot}: sticker '${ch}' is not a face color`);
      cols.push(f);
    }
    let found = false;
    for (let piece = 0; piece < 8 && !found; piece++) {
      for (let ori = 0; ori < 3; ori++) {
        if (CC[piece][(((0 - ori) % 3) + 3) % 3] !== cols[0]) continue;
        if (CC[piece][(((1 - ori) % 3) + 3) % 3] !== cols[1]) continue;
        if (CC[piece][(((2 - ori) % 3) + 3) % 3] !== cols[2]) continue;
        cp[slot] = piece; co[slot] = ori; found = true; break;
      }
    }
    if (!found) throw new Error(`corner ${slot}: no matching piece for colors (${cols.map((c) => CC_FACE[c]).join('')})`);
  }
  return { cp, co };
}

/**
 * 物理合法性:8 块各一份 + 扭转和 ≡ 0 (mod 3)。二阶**没有**排列奇偶约束(单面转本身就是
 * 4-cycle = 奇置换),也没有棱块;整体朝向自由,而 sum(co) mod 3 在整体旋转下同样不变
 * (整体旋转 = 两个对面同向转的积,仍在群内)。返回 null 表示合法。
 */
export function validatePocketState(s: PocketState): string | null {
  if (new Set(s.cp).size !== 8) return 'corner permutation not bijective (some piece appears twice)';
  let sum = 0;
  for (const v of s.co) sum += v;
  if (sum % 3 !== 0) return `corner orientation sum ${sum} not divisible by 3 (one corner is twisted)`;
  return null;
}

/** 校验 facelet:先数颜色(错得最常见,报得最清楚),再认块、再查不变量。 */
export function validatePocketFacelet(facelet: string): string | null {
  const counts = new Map<string, number>();
  for (const ch of facelet) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  for (const f of POCKET_FACES) if ((counts.get(f) ?? 0) !== 4) return 'color counts != 4';
  let st: PocketState;
  try {
    st = faceletToPocketState(facelet);
  } catch (e) {
    return (e as Error).message;
  }
  return validatePocketState(st);
}

// ── 整体旋转(24 个)────────────────────────────────────────────────────────────────────────────
// 旋转是面标号的双射 σ,只要 (σU, σR, σF) 仍是一个「顺时针角三元组」就是真旋转(24 个)。
// 对状态的作用:角位 slot 的块整体搬到角位 σ(slot),块的身份(=三色)不变,朝向平移一个常数:
//   cp'[σ(s)] = cp[s],  co'[σ(s)] = co[s] + shift(σ, s)   (mod 3)
// 其中 shift = σ(CC[s][0]) 在 CC[σ(s)] 里的下标(与取哪个面无关 —— 两张表同手性)。

interface PocketRotation {
  /** faceMap[f] = σ(f),面用 POCKET_FACES 下标。 */
  faceMap: number[];
  /** invFaceMap[σ(f)] = f。 */
  invFaceMap: number[];
  slotMap: number[];
  shift: number[];
}

const F_IDX = (f: PocketFace): number => POCKET_FACES.indexOf(f);
/** CC 面编码 → POCKET_FACES 下标。 */
const CC2F = CC_FACE.map(F_IDX);
const OPP_IDX: number[] = (() => {
  const opp: Record<PocketFace, PocketFace> = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };
  return POCKET_FACES.map((f) => F_IDX(opp[f]));
})();

/** 角位的面集合 key(升序面下标),用于「面集合 → 角位」反查。 */
const slotKeyOf = (faces: number[]): number => {
  const s = [...faces].sort((a, b) => a - b);
  return s[0] * 36 + s[1] * 6 + s[2];
};
const SLOT_FACES: number[][] = CC.map((tri) => tri.map((c) => CC2F[c]));
const SLOT_BY_KEY = new Map<number, number>(SLOT_FACES.map((fs, slot) => [slotKeyOf(fs), slot]));
/** 有序对 (a,b) → c,使 (a,b,c) 是某个角的顺时针三元组的循环移位。 */
const PAIR_THIRD = new Map<number, number>();
for (const fs of SLOT_FACES) {
  for (let k = 0; k < 3; k++) {
    PAIR_THIRD.set(fs[k] * 6 + fs[(k + 1) % 3], fs[(k + 2) % 3]);
  }
}

export const POCKET_ROTATIONS: PocketRotation[] = (() => {
  const out: PocketRotation[] = [];
  const uI = F_IDX('U'), rI = F_IDX('R'), fI = F_IDX('F');
  for (let u2 = 0; u2 < 6; u2++) {
    for (let f2 = 0; f2 < 6; f2++) {
      const r2 = PAIR_THIRD.get(f2 * 6 + u2); // (F,U,R) 亦是 (U,R,F) 的循环移位
      if (r2 === undefined) continue;
      const faceMap = new Array<number>(6);
      faceMap[uI] = u2; faceMap[rI] = r2; faceMap[fI] = f2;
      faceMap[OPP_IDX[uI]] = OPP_IDX[u2];
      faceMap[OPP_IDX[rI]] = OPP_IDX[r2];
      faceMap[OPP_IDX[fI]] = OPP_IDX[f2];
      const invFaceMap = new Array<number>(6);
      faceMap.forEach((to, from) => { invFaceMap[to] = from; });
      const slotMap = new Array<number>(8);
      const shift = new Array<number>(8);
      for (let slot = 0; slot < 8; slot++) {
        const target = SLOT_BY_KEY.get(slotKeyOf(SLOT_FACES[slot].map((f) => faceMap[f])))!;
        slotMap[slot] = target;
        shift[slot] = SLOT_FACES[target].indexOf(faceMap[SLOT_FACES[slot][0]]);
      }
      out.push({ faceMap, invFaceMap, slotMap, shift });
    }
  }
  return out;
})();

export function rotatePocketState(s: PocketState, rot: PocketRotation): PocketState {
  const cp = new Int8Array(8);
  const co = new Int8Array(8);
  for (let slot = 0; slot < 8; slot++) {
    const to = rot.slotMap[slot];
    cp[to] = s.cp[slot];
    co[to] = (s.co[slot] + rot.shift[slot]) % 3;
  }
  return { cp, co };
}

// ── 六面转 ────────────────────────────────────────────────────────────────────────────────────
// U / R / F 是 pocket-scramble / cube222-metric 那三个生成元;D / L / B 由「转过去 → 转 U/R/F →
// 转回来」的共轭得到(不手写表,避免抄错)。

type Gen = { p: number[]; o: number[] };
const GEN_URF: Record<'U' | 'R' | 'F', Gen> = {
  U: { p: [3, 0, 1, 2, 4, 5, 6, 7], o: [0, 0, 0, 0, 0, 0, 0, 0] },
  R: { p: [4, 1, 2, 0, 7, 5, 6, 3], o: [2, 0, 0, 1, 1, 0, 0, 2] },
  F: { p: [1, 5, 2, 3, 0, 4, 6, 7], o: [1, 2, 0, 0, 2, 1, 0, 0] },
};

function applyGen(s: PocketState, g: Gen): PocketState {
  const cp = new Int8Array(8);
  const co = new Int8Array(8);
  for (let i = 0; i < 8; i++) { cp[i] = s.cp[g.p[i]]; co[i] = (s.co[g.p[i]] + g.o[i]) % 3; }
  return { cp, co };
}

/** 每个面配一个 (σ, σ⁻¹, σ 下该面落到的 U/R/F 生成元) —— 共轭用;U/R/F 自己配恒等旋转。 */
const TURN_BY_FACE: { rot: PocketRotation; inv: PocketRotation; gen: Gen }[] = (() => {
  const invOf = (r: PocketRotation) => POCKET_ROTATIONS.find(
    (x) => x.faceMap.every((to, from) => r.invFaceMap[from] === to),
  )!;
  return POCKET_FACES.map((face) => {
    if (face === 'U' || face === 'R' || face === 'F') {
      const ident = POCKET_ROTATIONS.find((r) => r.faceMap.every((to, from) => to === from))!;
      return { rot: ident, inv: ident, gen: GEN_URF[face] };
    }
    const fi = F_IDX(face);
    for (const rot of POCKET_ROTATIONS) {
      const g = POCKET_FACES[rot.faceMap[fi]];
      if (g === 'U' || g === 'R' || g === 'F') return { rot, inv: invOf(rot), gen: GEN_URF[g] };
    }
    throw new Error(`no rotation maps ${face} onto U/R/F`);
  });
})();

/** 单面顺时针 90° × amount(1/2/3)。 */
export function applyPocketFaceTurn(s: PocketState, face: PocketFace, amount: number): PocketState {
  const { rot, inv, gen } = TURN_BY_FACE[F_IDX(face)];
  let cur = rotatePocketState(s, rot);
  for (let i = 0; i < amount; i++) cur = applyGen(cur, gen);
  return rotatePocketState(cur, inv);
}

const TOKEN_RE = /^([URFDLB])(2|')?$/;

/** 解析并施加打乱串(六面 + 可选 2 / ');token 非法抛错。 */
export function applyPocketMoves(s: PocketState, alg: string): PocketState {
  let cur = s;
  for (const tok of alg.trim().split(/\s+/).filter(Boolean)) {
    const m = TOKEN_RE.exec(tok);
    if (!m) throw new Error(tok);
    cur = applyPocketFaceTurn(cur, m[1] as PocketFace, m[2] === '2' ? 2 : m[2] === "'" ? 3 : 1);
  }
  return cur;
}

/** 打乱串 → facelet(非法 token 抛错)。 */
export function pocketFaceletFromMoves(alg: string): string {
  return pocketStateToFacelet(applyPocketMoves(solvedPocketState(), alg));
}

/** 招式串取逆(逆序 + 逐招取逆)。 */
export function invertPocketAlg(alg: string): string {
  return alg.trim().split(/\s+/).filter(Boolean).reverse()
    .map((tok) => (tok.endsWith('2') ? tok : tok.endsWith("'") ? tok.slice(0, -1) : `${tok}'`))
    .join(' ');
}

// ── 求解 ──────────────────────────────────────────────────────────────────────────────────────

export interface PocketSolveResult {
  /** 所画朝版本的最优解(可能含 D / L / B),空串 = 已还原。 */
  solution: string;
  length: number;
}

/**
 * 所画状态的 HTM 最优解。先用唯一那个把 DBL 块转回原位且朝向 0 的整体旋转 σ 归一化,
 * 交给 pocket-scramble 的精确模型求解(只 U/R/F),再把每招的面按 σ⁻¹ 换回所画的朝向 ——
 * 旋转是保向的,顺时针仍是顺时针,故只需换面名、不动转量。
 */
export function solvePocketState(s: PocketState): PocketSolveResult {
  const bad = validatePocketState(s);
  if (bad) throw new Error(bad);
  let home = -1;
  for (let slot = 0; slot < 8; slot++) if (s.cp[slot] === 6) { home = slot; break; }
  const rot = POCKET_ROTATIONS.find(
    (r) => r.slotMap[home] === 6 && (s.co[home] + r.shift[home]) % 3 === 0,
  );
  if (!rot) throw new Error('no normalizing rotation (should be impossible)');
  const norm = rotatePocketState(s, rot);
  const codes = optimalPocketSolveCodes(norm.cp, norm.co);
  const moves = codes.map((code) => {
    const name = POCKET_MOVE_NAMES[code];
    return POCKET_FACES[rot.invFaceMap[F_IDX(name[0] as PocketFace)]] + name.slice(1);
  });
  return { solution: moves.join(' '), length: moves.length };
}

/** facelet 版:非法状态抛错(错误信息同 validatePocketFacelet)。 */
export function solvePocketFacelet(facelet: string): PocketSolveResult {
  return solvePocketState(faceletToPocketState(facelet));
}

// ── 反推打乱 ──────────────────────────────────────────────────────────────────────────────────
// 解的逆**不足以**复现所画状态:解把状态还原到「六面单色」,终点是一个转过朝向的还原态 Q,
// 而不是恒等。右作用下 ρ·T = P 要求前缀 ρ = P·(解) = Q,所以打乱 = 「Q 的整体旋转词」+ 解的逆
// (旋转词用对面同向转拼,如 x = R L');多出的 2~4 步不影响打乱质量 —— 状态一样,最优步数一样。

const stateKey = (s: PocketState): string => `${s.cp.join('')}|${s.co.join('')}`;

/** 24 个整体旋转态 → 一条实现它的面转词(BFS,最短优先)。 */
const ROTATION_WORDS: Map<string, string> = (() => {
  const AXIS = [['R', 'L'], ['U', 'D'], ['F', 'B']]; // x / y / z:同向转 = 前者顺 + 后者逆
  const gens: string[] = [];
  for (const [a, b] of AXIS) {
    gens.push(`${a} ${b}'`, `${a}' ${b}`, `${a}2 ${b}2`);
  }
  const solved = solvedPocketState();
  const out = new Map<string, string>([[stateKey(solved), '']]);
  let frontier = [''];
  for (let depth = 0; depth < 3 && out.size < 24; depth++) {
    const next: string[] = [];
    for (const word of frontier) {
      for (const g of gens) {
        const w = word ? `${word} ${g}` : g;
        const k = stateKey(applyPocketMoves(solved, w));
        if (out.has(k)) continue;
        out.set(k, w);
        next.push(w);
      }
    }
    frontier = next;
  }
  return out;
})();

/** 相邻同面合并(R R' 消掉、R R → R2);只做同面,保证等价。 */
function simplifyPocketAlg(alg: string): string {
  const toks = alg.trim().split(/\s+/).filter(Boolean);
  const out: { face: string; amt: number }[] = [];
  for (const tok of toks) {
    const amt = tok.endsWith('2') ? 2 : tok.endsWith("'") ? 3 : 1;
    const last = out[out.length - 1];
    if (last && last.face === tok[0]) {
      last.amt = (last.amt + amt) % 4;
      if (last.amt === 0) out.pop();
    } else {
      out.push({ face: tok[0], amt });
    }
  }
  return out.map(({ face, amt }) => face + (amt === 2 ? '2' : amt === 3 ? "'" : '')).join(' ');
}

/**
 * 一条**精确**到达所画状态的打乱(applyPocketMoves(solved, 打乱) 逐格等于所画 facelet)。
 * 已还原(含转过朝向的)→ 空串。
 */
export function derivePocketScramble(facelet: string): string {
  const state = faceletToPocketState(facelet);
  const { solution } = solvePocketState(state);
  const end = solution ? applyPocketMoves(state, solution) : state;
  const rotWord = ROTATION_WORDS.get(stateKey(end));
  if (rotWord === undefined) throw new Error('solution did not land on a rotated solved state');
  return simplifyPocketAlg(solution ? `${rotWord} ${invertPocketAlg(solution)}` : rotWord);
}

/** 随机合法状态(均匀随机态 + 随机整体朝向)。 */
export function randomPocketFacelet(rng: () => number = Math.random): string {
  // 均匀:7 块随机排列 + 6 个自由朝向,第 7 个由扭转和定;再随机转个朝向(24 个)。
  const cp = new Int8Array(8);
  const co = new Int8Array(8);
  const free = [0, 1, 2, 3, 4, 5, 7];
  const pool = [...free];
  for (const slot of free) {
    const k = Math.floor(rng() * pool.length);
    cp[slot] = pool[k];
    pool.splice(k, 1);
  }
  cp[6] = 6;
  let sum = 0;
  for (let i = 0; i < 6; i++) { const v = Math.floor(rng() * 3); co[free[i]] = v; sum += v; }
  co[free[6]] = (3 - (sum % 3)) % 3;
  const rot = POCKET_ROTATIONS[Math.floor(rng() * POCKET_ROTATIONS.length)];
  return pocketStateToFacelet(rotatePocketState({ cp, co }, rot));
}

/** 把 validate* 的原始信息译成给用户看的一句话。 */
export function friendlyPocketErr(msg: string, isZh: boolean): string {
  const t = (z: string, e: string) => (isZh ? z : e);
  if (msg.includes('color counts != 4')) return t('每种颜色必须正好 4 格', 'Each color must appear exactly 4 times');
  if (msg.includes('is not a face color')) return t('出现了非面色字符', 'A sticker color is not one of the six face colors');
  if (msg.includes('not bijective')) return t('某个角块出现了两次(或缺失)', 'Some corner piece appears twice or is missing');
  if (msg.includes('orientation sum')) return t('单个角块被扭了 ±120°(角朝向之和必须是 3 的倍数)', 'A single corner is twisted (corner orientation invariant)');
  if (msg.includes('no matching piece')) return t('某个角的颜色组合不存在(三色必须两两相邻且手性正确)', 'A corner has colors that cannot belong to any real cubelet');
  return msg;
}
