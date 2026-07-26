/**
 * LSLL 三类 = 两步路线(two-look route)。
 *
 * 二类数的是**局面**(583,284 个,商掉首尾 AUF)。三类数的是**路线**:两步解法里
 * 依次认出的一对图 —— 先一个 ZBLS case,做完之后一个 ZBLL case。两个集合各自规范:
 *
 *   N₃ = 306(ZBLS case)× 494(ZBLL case)= 151,164
 *
 * 关键:mid-AUF 不能再商一次。局面不会因为你插那一下 U 而改变,mid 发生在**解法**上;
 * 硬商需要给每个 ZBLS case 钦定一条公式,换公式答案就变(19/62/89/127/494)。
 * 乘法口径与公式表无关,且恰是商口径的上确界。推导与两条佐证见 /math/lsll §3、
 * `scripts/lsll-class3.mts`、`tests/lsll_class3_structure.test.ts`。
 *
 * 本文件只负责把那个数字变成能浏览的东西:枚举 306 个 ZBLS 构型 + 494 个 ZBLL case,
 * 各自出图,并挂上站内公式库(zbls_algs.json / zbll_algs.json)。
 */
import {
  type LsllState, CATEGORIES, type LsllCategory, canonicalKey, unpackState, keyFromString,
} from './model';
import {
  LSLL_CORNER_POS, LSLL_EDGE_POS, cornerFaceletIdx, edgeFaceletIdx,
  paintCorner, paintEdge, solvedCube, toFacelets, embedLsll,
} from './cube333';
import { zblsForKey, ZBLS_COVERED_KEYS, type ZblsRef } from './zbls_overlay';
import zbllRaw from './zbll_algs.json';

/** ZBLL case 数(= 通行的 493 + 全解态)。fiber 上 mid+post 双侧商。 */
export const ZBLL_CASE_COUNT = 494;
/** ZBLS case 数(= 1,200 个构型商 pre-AUF;DB 的 zbls 集恰好 306 − 全解 = 305)。 */
export const ZBLS_CASE_COUNT = 306;
/** 三类 case 数 = 两步路线数。与任何公式表无关。 */
export const TOTAL_CASES_CLASS3 = ZBLS_CASE_COUNT * ZBLL_CASE_COUNT; // 151,164

// ---- ZBLS 构型 φ ----
// φ = (槽角位 cpos + 朝向 cori, 槽棱位 epos, 5 个棱位的 EO)。槽棱朝向 = eo[epos];
// 顶层 4 角的置换/朝向与 4 棱的置换都被 ZBLL 群吃掉,不进 φ。
// 编码:((cpos*3 + cori)*5 + epos)*32 + eoBits,eoBits 的第 p 位 = eo[p]。
const PHI_EO_MASK = 31;

export interface ZblsCase {
  /** canonical φ id(pre-AUF 四个像里最小的那个) */
  id: number;
  /** base36 短码,进 URL */
  code: string;
  /** 所属 42 大类的 slug */
  family: string;
  /** 顶层翻棱数(EO 为 1 的棱,不含槽棱) */
  eoBad: number;
  /** pre-AUF 稳定子阶(1 / 2 / 4)—— 9 个 >1 的就是 /math/lsll §3 那批对称构型 */
  stab: number;
  /** 全解构型(槽已还原 + EO 全正),它不是 zbls 库里的 case */
  solved: boolean;
}

function phiId(cpos: number, cori: number, epos: number, eoBits: number): number {
  return (((cpos * 3 + cori) * 5 + epos) * 32) + eoBits;
}

interface Phi { cpos: number; cori: number; epos: number; eo: number }
function phiParts(id: number): Phi {
  const eo = id & PHI_EO_MASK;
  const rest = (id - eo) / 32;
  return { cpos: Math.floor(rest / 15), cori: Math.floor(rest / 5) % 3, epos: rest % 5, eo };
}

/** pre-AUF 转 a 步:顶层位 p 上的东西挪到位 (p+a)&3(与 model.transformedPack 同向)。 */
function rotPhi(id: number, a: number): number {
  const { cpos, cori, epos, eo } = phiParts(id);
  let eo2 = eo & 16; // 位 4(FR 槽位)不动
  for (let p = 0; p < 4; p++) if ((eo >> ((p - a + 4) & 3)) & 1) eo2 |= 1 << p;
  return phiId(cpos < 4 ? (cpos + a) & 3 : 4, cori, epos < 4 ? (epos + a) & 3 : 4, eo2);
}

function canonPhi(id: number): number {
  let min = id;
  for (let a = 1; a < 4; a++) { const k = rotPhi(id, a); if (k < min) min = k; }
  return min;
}

/** 局面 → 它的 ZBLS 构型(canonical,对 16 个 AUF 像不变)。 */
export function phiOfState(s: LsllState): number {
  const cpos = s.cp.indexOf(4), epos = s.ep.indexOf(4);
  let eoBits = 0;
  for (let p = 0; p < 5; p++) if (s.eo[p]) eoBits |= 1 << p;
  return canonPhi(phiId(cpos, s.co[cpos], epos, eoBits));
}

const CAT_BY_CONFIG = new Map<string, LsllCategory>(
  CATEGORIES.map((c) => [`${c.kind}${c.d ?? ''}-${c.c}-${c.e}`, c]),
);

function familyOfPhi(id: number): string {
  const { cpos, cori, epos, eo } = phiParts(id);
  const kind = cpos === 4 && epos === 4 ? 'SS' : cpos === 4 ? 'CS' : epos === 4 ? 'ES' : 'TT';
  const d = kind === 'TT' ? (epos - cpos + 4) & 3 : undefined;
  const cat = CAT_BY_CONFIG.get(`${kind}${d ?? ''}-${cori}-${(eo >> epos) & 1}`);
  if (!cat) throw new Error(`unclassifiable phi ${id}`);
  return cat.slug;
}

function buildZblsCases(): ZblsCase[] {
  const orbit = new Map<number, number>(); // canonical id → 轨道大小
  for (let cpos = 0; cpos < 5; cpos++) {
    for (let cori = 0; cori < 3; cori++) {
      for (let epos = 0; epos < 5; epos++) {
        for (let eoBits = 0; eoBits < 32; eoBits++) {
          // 总翻转奇偶:5 个棱位的 EO 之和必须为偶(整魔方的 EO 守恒)。
          let bits = 0;
          for (let p = 0; p < 5; p++) bits += (eoBits >> p) & 1;
          if (bits & 1) continue;
          const id = phiId(cpos, cori, epos, eoBits);
          const c = canonPhi(id);
          orbit.set(c, (orbit.get(c) ?? 0) + 1);
        }
      }
    }
  }
  return [...orbit.entries()]
    .map(([id, size]) => {
      const { epos, eo } = phiParts(id);
      let eoBad = 0;
      for (let p = 0; p < 5; p++) if (p !== epos && ((eo >> p) & 1)) eoBad++;
      return {
        id,
        code: id.toString(36),
        family: familyOfPhi(id),
        eoBad,
        stab: 4 / size,
        solved: id === phiId(4, 0, 4, 0),
      };
    })
    .sort((a, b) => a.eoBad - b.eoBad || a.id - b.id);
}

let zblsCasesCache: ZblsCase[] | null = null;
/** 306 个 ZBLS case。 */
export function allZblsCases(): ZblsCase[] {
  return (zblsCasesCache ??= buildZblsCases());
}

const byCodeCache = new Map<string, ZblsCase>();
export function zblsCaseByCode(code: string): ZblsCase | undefined {
  if (!byCodeCache.size) for (const z of allZblsCases()) byCodeCache.set(z.code, z);
  return byCodeCache.get(code);
}

const byFamilyCache = new Map<string, ZblsCase[]>();
/** 某大类下的 ZBLS case(TT/CS/ES 各 8,D± / O 各 4,F / C± 各 2)。 */
export function zblsCasesForFamily(slug: string): ZblsCase[] {
  if (!byFamilyCache.size) {
    for (const z of allZblsCases()) {
      const arr = byFamilyCache.get(z.family);
      if (arr) arr.push(z); else byFamilyCache.set(z.family, [z]);
    }
  }
  return byFamilyCache.get(slug) ?? [];
}

/** 大类的三类 case 数 = 该类 ZBLS case 数 × 494。 */
export function class3CountForFamily(slug: string): number {
  return zblsCasesForFamily(slug).length * ZBLL_CASE_COUNT;
}

// ---- φ ↔ 站内 zbls 公式库 ----
// zbls_algs.json 的键是每条 zbls setup 的 LSLL canonical key(整个局面),不是 φ。
// 反查一次:解码 key → 取它的 φ → 建 φ→案例 索引。305 条,毫秒级。
const zblsRefCache = new Map<number, ZblsRef[]>();
/** φ 对应的 zbls 库案例(全解构型没有案例,返 null)。 */
export function zblsLibRefs(id: number): ZblsRef[] | null {
  if (!zblsRefCache.size) {
    for (const ks of ZBLS_COVERED_KEYS) {
      const key = keyFromString(ks);
      const refs = key === null ? null : zblsForKey(ks);
      if (key === null || !refs) continue;
      const phi = phiOfState(unpackState(key));
      const arr = zblsRefCache.get(phi);
      if (arr) arr.push(...refs); else zblsRefCache.set(phi, [...refs]);
    }
  }
  return zblsRefCache.get(id) ?? null;
}

// ---- ZBLL case ----
function perm5Parity(p: number[]): number {
  let inv = 0;
  for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) if (p[i] > p[j]) inv++;
  return inv & 1;
}

const PERM4: number[][] = (() => {
  const out: number[][] = [];
  const gen = (cur: number[], rest: number[]) => {
    if (!rest.length) { out.push(cur); return; }
    for (let i = 0; i < rest.length; i++) gen([...cur, rest[i]], [...rest.slice(0, i), ...rest.slice(i + 1)]);
  };
  gen([], [0, 1, 2, 3]);
  return out;
})();

/** ZBLL 态:槽对已归位 + 顶层 EO 全正,顶层角置换/朝向 + 棱置换自由(7,776 个)。 */
function buildZbllCases(): number[] {
  const keys = new Set<number>();
  const s: LsllState = { cp: [0, 0, 0, 0, 4], co: [0, 0, 0, 0, 0], ep: [0, 0, 0, 0, 4], eo: [0, 0, 0, 0, 0] };
  for (const pc of PERM4) {
    for (let i = 0; i < 4; i++) s.cp[i] = pc[i];
    const par = perm5Parity(s.cp);
    for (const pe of PERM4) {
      for (let i = 0; i < 4; i++) s.ep[i] = pe[i];
      if (perm5Parity(s.ep) !== par) continue;
      for (let o = 0; o < 27; o++) {
        s.co[0] = o % 3; s.co[1] = ((o / 3) | 0) % 3; s.co[2] = ((o / 9) | 0) % 3;
        s.co[3] = (9 - s.co[0] - s.co[1] - s.co[2]) % 3;
        keys.add(canonicalKey(s));
      }
    }
  }
  return [...keys].sort((a, b) => a - b);
}

let zbllCache: number[] | null = null;
/** 494 个 ZBLL case 的 canonical key(升序)。 */
export function allZbllCases(): number[] {
  return (zbllCache ??= buildZbllCases());
}

export interface ZbllRef { set: string; name: string; subgroup: string; slug: string; algCount: number }
const ZBLL_MAP = zbllRaw as Record<string, ZbllRef[]>;
/** ZBLL case(base36 canonical key)对应的站内库案例:472 在 zbll 集、21 个在 pll 集。 */
export function zbllLibRefs(keyStr: string): ZbllRef[] | null {
  return ZBLL_MAP[keyStr] ?? null;
}

/** 短名(格子里用):"ZBLL L 44" → "L 44";pll 集的补 "PLL"。 */
export function zbllShortLabel(r?: ZbllRef | null): string | null {
  if (!r) return null;
  return r.set === 'pll' ? `PLL ${r.name}` : r.name.replace(/^ZBLL\s*/i, '');
}

/** 全名(单独出现时用):"ZBLL L 44" / "PLL Ua"。 */
export function zbllFullLabel(r?: ZbllRef | null): string | null {
  if (!r) return null;
  return r.set === 'pll' ? `PLL ${r.name}` : r.name;
}

// ---- 出图 ----
/** ZBLS 构型图:槽对画实色,顶层棱只画朝向(黄贴纸在哪面),其余全灰。 */
export function zblsCardFacelets(id: number): string {
  const { cpos, cori, epos, eo } = phiParts(id);
  const f = toFacelets(solvedCube()).split('');
  for (const p of LSLL_CORNER_POS) for (const idx of cornerFaceletIdx(p)) f[idx] = 'o';
  for (const p of LSLL_EDGE_POS) for (const idx of edgeFaceletIdx(p)) f[idx] = 'o';
  paintCorner(f, LSLL_CORNER_POS[cpos], 4, cori);            // 槽角(DFR 块)
  paintEdge(f, LSLL_EDGE_POS[epos], 8, (eo >> epos) & 1);    // 槽棱(FR 块)
  // 其余 4 个棱位放顶层棱:只贴 U 色那一片,位置 = 它的 EO(paintEdge 的 k=0 落点)。
  for (let p = 0; p < 5; p++) {
    if (p === epos) continue;
    const [a, b] = edgeFaceletIdx(LSLL_EDGE_POS[p]);
    const o = (eo >> p) & 1;
    f[o ? b : a] = 'u';
    f[o ? a : b] = 'o';
  }
  return f.join('');
}

/** ZBLL case 图:顶层全实色(EO 已正),配 plan 视图 = 通行的 ZBLL 图。 */
export function zbllCardFacelets(key: number): string {
  return toFacelets(embedLsll(unpackState(key)));
}
