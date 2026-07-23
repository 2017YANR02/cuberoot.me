/**
 * LSLL(Last Slot and Last Layer)公式集数据模型。
 *
 * 状态空间:十字 + 3 槽已还原,FR 槽(DFR 角 + FR 棱)+ 顶层全体未定,
 * 共 (5!·5!/2)·3⁴·2⁴ = 9,331,200 原始态;case = 前 AUF(识别转顶)×
 * 后 AUF(结尾容差)Z4×Z4 商 → 583,284 个(Burnside:仅槽块归位构型有不动点)。
 *
 * 大类 = 槽对构型 42 种,命名沿用站内 zbls 公式集的字母(A+…X-,Solved Pair);
 * 字母 ↔ 构型映射由 zbls 集 289 条 setup 逆向实证(见 lsll/PLAN.md)。
 */
import {
  type Cube333, type LsllState, applyAlg, embedLsll, extractLsll, solvedCube, toFacelets,
  paintCorner, paintEdge, cornerFaceletIdx, edgeFaceletIdx, LSLL_CORNER_POS, LSLL_EDGE_POS,
} from './cube333';

export type { LsllState } from './cube333';

export const TOTAL_CASES = 583284;

// ---- canonical key ----
// pack:角 5 位各 4bit(piece*3+ori),棱 5 位各 4bit(piece*2+ori),共 40bit(number 精确)。
const C_BASE = 1048576; // 2^20

function transformedPack(s: LsllState, a: number, b: number): number {
  let c = 0, e = 0;
  for (let p = 0; p < 5; p++) {
    const src = p < 4 ? (p - a + 4) & 3 : 4;
    const pc = s.cp[src];
    c = c * 16 + (pc < 4 ? ((pc + b) & 3) : 4) * 3 + s.co[src];
    const pe = s.ep[src];
    e = e * 16 + (pe < 4 ? ((pe + b) & 3) : 4) * 2 + s.eo[src];
  }
  return c * C_BASE + e;
}

/** 16 个 AUF 像的最小编码 = case 的唯一 ID。 */
export function canonicalKey(s: LsllState): number {
  let min = Infinity;
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
    const k = transformedPack(s, a, b);
    if (k < min) min = k;
  }
  return min;
}

export function packState(s: LsllState): number { return transformedPack(s, 0, 0); }

export function unpackState(key: number): LsllState {
  const e0 = key % C_BASE;
  const c0 = (key - e0) / C_BASE;
  const cp: number[] = [], co: number[] = [], ep: number[] = [], eo: number[] = [];
  let c = c0, e = e0;
  for (let p = 4; p >= 0; p--) {
    const cv = c & 15; c >>= 4;
    cp[p] = Math.floor(cv / 3); co[p] = cv % 3;
    const ev = e & 15; e >>= 4;
    ep[p] = ev >> 1; eo[p] = ev & 1;
  }
  return { cp, co, ep, eo };
}

/** 解码 + 合法性校验(双射、朝向和、奇偶耦合)。非法返回 null;不要求已 canonical。 */
export function decodeKey(key: number): LsllState | null {
  if (!Number.isInteger(key) || key < 0 || key >= C_BASE * C_BASE) return null;
  const s = unpackState(key);
  const seenC = new Set(s.cp), seenE = new Set(s.ep);
  if (seenC.size !== 5 || s.cp.some((v) => v < 0 || v > 4)) return null;
  if (seenE.size !== 5 || s.ep.some((v) => v < 0 || v > 4)) return null;
  if (s.co.reduce((x, y) => x + y, 0) % 3 !== 0) return null;
  if (s.eo.reduce((x, y) => x + y, 0) % 2 !== 0) return null;
  if (perm5Parity(s.cp) !== perm5Parity(s.ep)) return null;
  return s;
}

function perm5Parity(p: number[]): number {
  let inv = 0;
  for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) if (p[i] > p[j]) inv++;
  return inv & 1;
}

export function keyToString(key: number): string { return key.toString(36); }
export function keyFromString(str: string): number | null {
  if (!/^[0-9a-z]{1,9}$/.test(str)) return null;
  const n = parseInt(str, 36);
  return Number.isSafeInteger(n) ? n : null;
}

// ---- 42 大类(ZBLS 字母) ----
export type CategoryKind = 'TT' | 'CS' | 'ES' | 'SS';

export interface LsllCategory {
  slug: string;
  letter: string;         // zbls 集的 subgroup 字母
  kind: CategoryKind;     // TT 角棱都在顶 / CS 角在槽 / ES 棱在槽 / SS 都在槽
  d?: number;             // TT:棱顶位 − 角顶位 (mod 4)
  c: number;              // 槽角朝向
  e: number;              // 槽棱朝向
  count: number;
}

const CAT = (slug: string, letter: string, kind: CategoryKind, c: number, e: number, d?: number): LsllCategory => ({
  slug, letter, kind, c, e, d,
  count: kind === 'SS' ? (e === 0 ? 3916 : 3888) : 15552,
});

/** 字母 ↔ 构型:由 zbls 集 setup 实证映射(diff 脚本),非猜测。 */
export const CATEGORIES: LsllCategory[] = [
  // TT:角棱都在顶层,d = 相对位差
  CAT('hp', 'H+', 'TT', 0, 0, 0), CAT('gm', 'G-', 'TT', 0, 1, 0),
  CAT('kp', 'K+', 'TT', 1, 0, 0), CAT('im', 'I-', 'TT', 1, 1, 0),
  CAT('ap', 'A+', 'TT', 2, 0, 0), CAT('xm', 'X-', 'TT', 2, 1, 0),
  CAT('gp', 'G+', 'TT', 0, 0, 1), CAT('hm', 'H-', 'TT', 0, 1, 1),
  CAT('xp', 'X+', 'TT', 1, 0, 1), CAT('am', 'A-', 'TT', 1, 1, 1),
  CAT('ip', 'I+', 'TT', 2, 0, 1), CAT('km', 'K-', 'TT', 2, 1, 1),
  CAT('pp', 'P+', 'TT', 0, 0, 2), CAT('qm', 'Q-', 'TT', 0, 1, 2),
  CAT('rp', 'R+', 'TT', 1, 0, 2), CAT('wm', 'W-', 'TT', 1, 1, 2),
  CAT('mp', 'M+', 'TT', 2, 0, 2), CAT('bm', 'B-', 'TT', 2, 1, 2),
  CAT('qp', 'Q+', 'TT', 0, 0, 3), CAT('pm', 'P-', 'TT', 0, 1, 3),
  CAT('bp', 'B+', 'TT', 1, 0, 3), CAT('mm', 'M-', 'TT', 1, 1, 3),
  CAT('wp', 'W+', 'TT', 2, 0, 3), CAT('rm', 'R-', 'TT', 2, 1, 3),
  // CS:角在槽(扭 c),棱在顶(翻 e)
  CAT('ep', 'E+', 'CS', 0, 0), CAT('em', 'E-', 'CS', 0, 1),
  CAT('jp', 'J+', 'CS', 1, 0), CAT('lm', 'L-', 'CS', 1, 1),
  CAT('lp', 'L+', 'CS', 2, 0), CAT('jm', 'J-', 'CS', 2, 1),
  // ES:棱在槽(翻 e),角在顶(扭 c)
  CAT('s', 'S', 'ES', 0, 0), CAT('t', 'T', 'ES', 0, 1),
  CAT('um', 'U-', 'ES', 1, 0), CAT('vm', 'V-', 'ES', 1, 1),
  CAT('up', 'U+', 'ES', 2, 0), CAT('vp', 'V+', 'ES', 2, 1),
  // SS:角棱都在槽
  CAT('solved', 'Solved Pair', 'SS', 0, 0), CAT('f', 'F', 'SS', 0, 1),
  CAT('dp', 'D+', 'SS', 1, 0), CAT('cp', 'C+', 'SS', 1, 1),
  CAT('dm', 'D-', 'SS', 2, 0), CAT('cm', 'C-', 'SS', 2, 1),
];

export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug);

const bySlug = new Map(CATEGORIES.map((c) => [c.slug, c]));
export function categoryBySlug(slug: string): LsllCategory | undefined { return bySlug.get(slug); }

const byConfig = new Map(CATEGORIES.map((c) => [`${c.kind}${c.d ?? ''}-${c.c}-${c.e}`, c]));

/** 从状态求所属大类 + 构型细节(对 16 个 AUF 像不变)。 */
export function classify(s: LsllState): { category: LsllCategory; eoBad: number; coTwisted: number } {
  const cpos = s.cp.indexOf(4), epos = s.ep.indexOf(4);
  const cori = s.co[cpos], eori = s.eo[epos];
  const kind: CategoryKind = cpos === 4 && epos === 4 ? 'SS' : cpos === 4 ? 'CS' : epos === 4 ? 'ES' : 'TT';
  const d = kind === 'TT' ? (epos - cpos + 4) & 3 : undefined;
  const category = byConfig.get(`${kind}${d ?? ''}-${cori}-${eori}`);
  if (!category) throw new Error('unclassifiable');
  let eoBad = 0, coTwisted = 0;
  for (let p = 0; p < 5; p++) {
    if (s.ep[p] < 4 && s.eo[p] === 1) eoBad++;
    if (s.cp[p] < 4 && s.co[p] !== 0) coTwisted++;
  }
  return { category, eoBad, coTwisted };
}

// ---- 大类内枚举 ----
/** 构型代表位:角/棱各自的(位置, 朝向)。TT 角固定顶位 0,棱在顶位 d。 */
function repConfig(cat: LsllCategory): { cpos: number; epos: number } {
  const cpos = cat.kind === 'CS' || cat.kind === 'SS' ? 4 : 0;
  const epos = cat.kind === 'ES' || cat.kind === 'SS' ? 4 : cat.kind === 'TT' ? cat.d! : 0;
  return { cpos, epos };
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

const enumCache = new Map<string, number[]>();

/** 大类全部 case 的 canonical key(升序)。62,208 次 canonical 化,~100ms,缓存。 */
export function enumerateCategory(slug: string): number[] {
  const hit = enumCache.get(slug);
  if (hit) return hit;
  const cat = bySlug.get(slug);
  if (!cat) return [];
  const { cpos, epos } = repConfig(cat);
  const cSlots = [0, 1, 2, 3, 4].filter((p) => p !== cpos);
  const eSlots = [0, 1, 2, 3, 4].filter((p) => p !== epos);
  const keys = new Set<number>();
  const s: LsllState = { cp: Array(5).fill(0), co: Array(5).fill(0), ep: Array(5).fill(0), eo: Array(5).fill(0) };
  s.cp[cpos] = 4; s.co[cpos] = cat.c;
  s.ep[epos] = 4; s.eo[epos] = cat.e;
  for (const pc of PERM4) {
    for (let i = 0; i < 4; i++) s.cp[cSlots[i]] = pc[i];
    const cParity = perm5Parity(s.cp);
    for (const pe of PERM4) {
      for (let i = 0; i < 4; i++) s.ep[eSlots[i]] = pe[i];
      if (perm5Parity(s.ep) !== cParity) continue;
      for (let o = 0; o < 27; o++) {
        const o1 = o % 3, o2 = ((o / 3) | 0) % 3, o3 = ((o / 9) | 0) % 3;
        const o4 = (30 - cat.c - o1 - o2 - o3) % 3;
        s.co[cSlots[0]] = o1; s.co[cSlots[1]] = o2; s.co[cSlots[2]] = o3; s.co[cSlots[3]] = o4;
        for (let f = 0; f < 8; f++) {
          const f1 = f & 1, f2 = (f >> 1) & 1, f3 = (f >> 2) & 1;
          const f4 = (cat.e + f1 + f2 + f3) & 1;
          s.eo[eSlots[0]] = f1; s.eo[eSlots[1]] = f2; s.eo[eSlots[2]] = f3; s.eo[eSlots[3]] = f4;
          keys.add(canonicalKey(s));
        }
      }
    }
  }
  const sorted = [...keys].sort((a, b) => a - b);
  enumCache.set(slug, sorted);
  return sorted;
}

// ---- 渲染 ----
/** case 的完整 54 facelets(fd 串)。 */
export function caseFacelets(s: LsllState): string {
  return toFacelets(embedLsll(s));
}

/** 大类示意图:LSLL 域全灰,仅画槽对两块(构型代表位)。 */
export function categoryCardFacelets(slug: string): string {
  const cat = bySlug.get(slug);
  if (!cat) return toFacelets(solvedCube());
  const f = toFacelets(solvedCube()).split('');
  for (const p of LSLL_CORNER_POS) for (const idx of cornerFaceletIdx(p)) f[idx] = 'o';
  for (const p of LSLL_EDGE_POS) for (const idx of edgeFaceletIdx(p)) f[idx] = 'o';
  f[4] = 'o'; // U 中心随 LL 一起置灰(与 f2l 遮罩一致)
  const { cpos, epos } = repConfig(cat);
  paintCorner(f, LSLL_CORNER_POS[cpos], 4, cat.c);
  paintEdge(f, LSLL_EDGE_POS[epos], 8, cat.e);
  return f.join('');
}

// ---- 打乱定位 ----
export type LocateResult =
  | { ok: true; key: number; keyStr: string; category: LsllCategory }
  | { ok: false; reason: 'empty' | 'bad-token' | 'not-lsll'; detail?: string };

/** 粘贴打乱 → 应用到还原态 → LSLL 校验 → canonical key。 */
export function locateFromScramble(scramble: string): LocateResult {
  if (!scramble.trim()) return { ok: false, reason: 'empty' };
  let cube: Cube333;
  try {
    cube = applyAlg(solvedCube(), scramble);
  } catch (err) {
    return { ok: false, reason: 'bad-token', detail: err instanceof Error ? err.message : '' };
  }
  const got = extractLsll(cube);
  if ('broken' in got) return { ok: false, reason: 'not-lsll', detail: got.broken.join(' ') };
  const key = canonicalKey(got.state);
  return { ok: true, key, keyStr: keyToString(key), category: classify(got.state).category };
}

/** 状态的 canonical 代表(与 canonicalKey 一致的那一个像)。 */
export function canonicalState(s: LsllState): LsllState {
  return unpackState(canonicalKey(s));
}

/** 用户公式自测:在该 case 上应用,允许结尾 AUF。 */
export function verifyCaseAlg(s: LsllState, alg: string):
  | { ok: true; auf: number }
  | { ok: false; reason: 'bad-token' | 'not-solved'; detail?: string } {
  let cube: Cube333;
  try {
    cube = applyAlg(embedLsll(s), alg);
  } catch (err) {
    return { ok: false, reason: 'bad-token', detail: err instanceof Error ? err.message : '' };
  }
  for (let j = 0; j < 4; j++) {
    const c = j === 0 ? cube : applyAlg(cube, ['', 'U', 'U2', "U'"][j]);
    if (c.cp.every((v, i) => v === i) && c.co.every((v) => v === 0)
      && c.ep.every((v, i) => v === i) && c.eo.every((v) => v === 0)) {
      return { ok: true, auf: j };
    }
  }
  return { ok: false, reason: 'not-solved' };
}
