/**
 * 顶层(LL)状态模型 + AUF 双边作用下的轨道枚举。
 *
 * 本页所有数字(全集大小 / case 数 / 轨道直方图 / Burnside 不动点)都由这里**现场枚举**
 * 算出,不硬编码 —— 模型错了页面上的数字会当场对不上(如 PLL 轨道数 ≠ 22)。
 *
 * ## 状态表示
 * 顶层 4 角 4 棱。位置顺时针编号(俯视):0=NW 1=NE 2=SE 3=SW(角),
 * 0=N 1=E 2=S 3=W(棱)。`cp[i]` = 位置 i 上的角块原属哪个位置(棱同理);
 * `co[i]` ∈ {0,1,2} 为位置 i 上角块的扭转(0 = 顶面贴纸朝上),`eo[i]` ∈ {0,1} 为翻棱。
 *
 * ## AUF 双边作用(Z4 × Z4,16 个元素)
 * 收尾 AUF(U^b,打乱后再转顶层):**位置**整体顺时针轮换 —— postU。
 * 起手 AUF(U^a,打乱前先转顶层):同一套打乱作用在预转过的顶层上,
 * 等价于把**块的标签**减 a(推导:打乱是固定的位置置换+朝向增量,
 * 预转只改变每个位置里装的是哪块)—— preU。
 * 同一 case = 同一条 {preU^a ∘ postU^b · s} 轨道;|轨道| × |稳定子| = 16。
 */

export interface LLState {
  cp: number[];
  co: number[];
  ep: number[];
  eo: number[];
}

const rotPos = (a: number[]): number[] => [a[3], a[0], a[1], a[2]];

/** 收尾 AUF:位置整体顺时针转一格(块与朝向跟着位置走)。 */
export function postU(s: LLState): LLState {
  return { cp: rotPos(s.cp), co: rotPos(s.co), ep: rotPos(s.ep), eo: rotPos(s.eo) };
}

/** 起手 AUF:块标签整体减一(位置与朝向不动)。 */
export function preU(s: LLState): LLState {
  return {
    cp: s.cp.map(v => (v + 3) % 4),
    co: [...s.co],
    ep: s.ep.map(v => (v + 3) % 4),
    eo: [...s.eo],
  };
}

export const keyOf = (s: LLState): string =>
  `${s.cp.join('')}|${s.co.join('')}|${s.ep.join('')}|${s.eo.join('')}`;

/** s 的 16 个双边像(可能重复)。 */
export function images(s: LLState): LLState[] {
  const out: LLState[] = [];
  let x = s;
  for (let a = 0; a < 4; a++) {
    let y = x;
    for (let b = 0; b < 4; b++) {
      out.push(y);
      y = postU(y);
    }
    x = preU(x);
  }
  return out;
}

/** 轨道大小(去重后的像数)与规范键(像里字典序最小的 key,作轨道 id)。 */
export function orbitOf(s: LLState): { size: number; canon: string } {
  const keys = images(s).map(keyOf);
  const uniq = new Set(keys);
  let canon = keys[0];
  for (const k of uniq) if (k < canon) canon = k;
  return { size: uniq.size, canon };
}

// ── 枚举工具 ──────────────────────────────────────────────

export const PERMS4: number[][] = (() => {
  const out: number[][] = [];
  const rec = (cur: number[], rest: number[]) => {
    if (rest.length === 0) { out.push([...cur]); return; }
    for (let i = 0; i < rest.length; i++) {
      cur.push(rest[i]);
      rec(cur, rest.filter((_, j) => j !== i));
      cur.pop();
    }
  };
  rec([], [0, 1, 2, 3]);
  return out;
})();

export function permSign(p: number[]): 1 | -1 {
  let inv = 0;
  for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) if (p[i] > p[j]) inv++;
  return inv % 2 === 0 ? 1 : -1;
}

/** 角朝向组合(和 ≡ 0 mod 3):27 个。 */
export const CO_ALL: number[][] = (() => {
  const out: number[][] = [];
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) for (let c = 0; c < 3; c++) {
    out.push([a, b, c, (3 - ((a + b + c) % 3)) % 3]);
  }
  return out;
})();

/** 棱朝向组合(和 ≡ 0 mod 2):8 个。 */
export const EO_ALL: number[][] = (() => {
  const out: number[][] = [];
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) {
    out.push([a, b, c, (a + b + c) % 2]);
  }
  return out;
})();

export type UniverseId = 'pll' | 'oll' | 'ell' | 'zbll' | '1lll';

/**
 * 枚举一个全集的全部状态。
 * pll:CO=EO=0,角棱置换同奇偶(288)。
 * ell:角块整体只差 AUF 相位(cp = 轮换 k),EO 任意、EP 与角奇偶匹配(384)。
 * zbll:EO=0(7776)。1lll:全部(62208)。
 * oll 的"状态"是纯朝向图案,另走 enumerateOllPatterns。
 */
export function enumerateUniverse(id: Exclude<UniverseId, 'oll'>): LLState[] {
  const out: LLState[] = [];
  const zeros = [0, 0, 0, 0];
  if (id === 'ell') {
    for (let k = 0; k < 4; k++) {
      const cp = [0, 1, 2, 3].map(i => (i + 4 - k) % 4);
      const sign = permSign(cp);
      for (const ep of PERMS4) {
        if (permSign(ep) !== sign) continue;
        for (const eo of EO_ALL) out.push({ cp, co: zeros, ep, eo });
      }
    }
    return out;
  }
  for (const cp of PERMS4) {
    for (const ep of PERMS4) {
      if (permSign(cp) !== permSign(ep)) continue;
      const cos = id === 'pll' ? [zeros] : CO_ALL;
      const eos = id === '1lll' ? EO_ALL : [zeros];
      for (const co of cos) for (const eo of eos) out.push({ cp, co, ep, eo });
    }
  }
  return out;
}

export interface OrbitStats {
  states: number;
  orbits: number;
  /** 轨道大小 → 该大小的轨道条数 */
  histogram: Map<number, number>;
  /** 规范键 → { size, rep } */
  byCanon: Map<string, { size: number; rep: LLState }>;
}

export function orbitStats(states: LLState[]): OrbitStats {
  const byCanon = new Map<string, { size: number; rep: LLState }>();
  for (const s of states) {
    const { size, canon } = orbitOf(s);
    if (!byCanon.has(canon)) byCanon.set(canon, { size, rep: s });
  }
  const histogram = new Map<number, number>();
  for (const { size } of byCanon.values()) {
    histogram.set(size, (histogram.get(size) ?? 0) + 1);
  }
  return { states: states.length, orbits: byCanon.size, histogram, byCanon };
}

/** Burnside 用:双边作用里 (a,b) 元素的不动点数。 */
export function fixedPoints(states: LLState[], a: number, b: number): number {
  let n = 0;
  for (const s of states) {
    let t = s;
    for (let i = 0; i < a; i++) t = preU(t);
    for (let i = 0; i < b; i++) t = postU(t);
    if (keyOf(t) === keyOf(s)) n++;
  }
  return n;
}

// ── OLL:纯朝向图案,单边旋转(共轭)作用 ──────────────────

export interface OllPattern { co: number[]; eo: number[] }

export const ollKey = (p: OllPattern): string => `${p.co.join('')}|${p.eo.join('')}`;

export const rotOll = (p: OllPattern): OllPattern => ({ co: rotPos(p.co), eo: rotPos(p.eo) });

export function enumerateOllPatterns(): OllPattern[] {
  const out: OllPattern[] = [];
  for (const co of CO_ALL) for (const eo of EO_ALL) out.push({ co, eo });
  return out;
}

export function ollOrbitStats(): {
  states: number; orbits: number;
  histogram: Map<number, number>;
  byCanon: Map<string, { size: number; rep: OllPattern }>;
  fixed: number[];
} {
  const all = enumerateOllPatterns();
  const byCanon = new Map<string, { size: number; rep: OllPattern }>();
  for (const p of all) {
    const keys: string[] = [];
    let q = p;
    for (let i = 0; i < 4; i++) { keys.push(ollKey(q)); q = rotOll(q); }
    const uniq = new Set(keys);
    let canon = keys[0];
    for (const k of uniq) if (k < canon) canon = k;
    if (!byCanon.has(canon)) byCanon.set(canon, { size: uniq.size, rep: p });
  }
  const histogram = new Map<number, number>();
  for (const { size } of byCanon.values()) histogram.set(size, (histogram.get(size) ?? 0) + 1);
  // 旋转 0..3 次的不动点数(Burnside 面板用)
  const fixed = [0, 1, 2, 3].map(k => {
    let n = 0;
    for (const p of all) {
      let q = p;
      for (let i = 0; i < k; i++) q = rotOll(q);
      if (ollKey(q) === ollKey(p)) n++;
    }
    return n;
  });
  return { states: all.length, orbits: byCanon.size, histogram, byCanon, fixed };
}

// ── 记名 case 的不变量识别(只认铁证的几个,其余匿名) ──────

const cycleType = (p: number[]): string => {
  const seen = [false, false, false, false];
  const lens: number[] = [];
  for (let i = 0; i < 4; i++) {
    if (seen[i]) continue;
    let j = i, len = 0;
    while (!seen[j]) { seen[j] = true; j = p[j]; len++; }
    if (len > 1) lens.push(len);
  }
  return lens.sort((x, y) => y - x).join('+') || 'id';
};

/**
 * PLL 轨道 → 可靠命名。只按「轨道里某个像的环结构」+ 轨道大小识别没有争议的几个:
 * H(角不动 + 棱双交换、轨道 4)/ Z(同结构、轨道 8)/ E(角双交换、棱不动)/
 * N(角棱各一对、轨道 4)/ U perm(棱三循环)/ A perm(角三循环)/ 还原。其余匿名。
 *
 * ⚠ 必须扫**整条轨道**:起手 AUF 是块标签重排(复合,不是共轭),会改环结构 ——
 * H perm 的轨道里就躺着一个「角上像 U2、棱全还原」的伪装态。
 */
export function pllOrbitLabel(rep: LLState, size: number): { zh: string; en: string } | null {
  const sigs = new Set(images(rep).map(s => `${cycleType(s.cp)}/${cycleType(s.ep)}`));
  if (sigs.has('id/id')) return { zh: '还原(跳过)', en: 'Solved (skip)' };
  if (size === 4) {
    if (sigs.has('id/2+2')) return { zh: 'H perm', en: 'H perm' };
    if (sigs.has('2/2')) return { zh: 'N perm(Na/Nb 之一)', en: 'N perm (Na or Nb)' };
  }
  if (size === 8) {
    if (sigs.has('id/2+2')) return { zh: 'Z perm', en: 'Z perm' };
    if (sigs.has('2+2/id')) return { zh: 'E perm', en: 'E perm' };
  }
  if (size === 16) {
    if (sigs.has('id/3')) return { zh: 'U perm(Ua/Ub 之一)', en: 'U perm (Ua or Ub)' };
    if (sigs.has('3/id')) return { zh: 'A perm(Aa/Ab 之一)', en: 'A perm (Aa or Ab)' };
  }
  return null;
}

/**
 * 给轨道找「最好认」的代表元:优先角块还原的像,其次棱环结构简单的。
 * (canonical key 的代表元往往是伪装态,比如 H perm 会以「角 U2 棱不动」出现。)
 */
export function displayRep(rep: LLState): LLState {
  const imgs = images(rep);
  const score = (s: LLState): number => {
    const c = cycleType(s.cp);
    const e = cycleType(s.ep);
    let n = 0;
    if (c === 'id') n -= 10;                      // 角已还原最好认
    if (c !== 'id' && e === 'id') n -= 4;
    n += (c === 'id' ? 0 : 2) + (e === 'id' ? 0 : 1);
    // 同分时取 key 最小,保证确定性(与初始 render 无随机)
    return n;
  };
  let best = imgs[0];
  let bestScore = score(best);
  let bestKey = keyOf(best);
  for (const s of imgs.slice(1)) {
    const sc = score(s);
    const k = keyOf(s);
    if (sc < bestScore || (sc === bestScore && k < bestKey)) {
      best = s; bestScore = sc; bestKey = k;
    }
  }
  return best;
}
