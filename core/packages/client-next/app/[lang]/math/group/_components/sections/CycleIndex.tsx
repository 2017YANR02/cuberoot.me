'use client';

import { useState, useMemo, useCallback } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import type { Lang } from '../primitives';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

// ── Categorical palette ────────────────────────────────────────────────────────
const PALETTE = ['#8B2E3C','#2A4D69','#3F7050','#B8860B','#6B4E9C','#C2410C','#5C7CA0','#9C4E6B'];

// ── Arithmetic helpers ─────────────────────────────────────────────────────────
function gcd(a: number, b: number): number {
  while (b) { const t = b; b = a % b; a = t; }
  return a;
}

/** Euler's totient φ(n) */
function phi(n: number): number {
  let result = n;
  let p = 2;
  let m = n;
  while (p * p <= m) {
    if (m % p === 0) {
      while (m % p === 0) m = Math.floor(m / p);
      result -= Math.floor(result / p);
    }
    p++;
  }
  if (m > 1) result -= Math.floor(result / m);
  return result;
}

/** All positive divisors of n in ascending order */
function divisors(n: number): number[] {
  const divs: number[] = [];
  for (let i = 1; i * i <= n; i++) {
    if (n % i === 0) {
      divs.push(i);
      if (i !== n / i) divs.push(n / i);
    }
  }
  return divs.sort((a, b) => a - b);
}

/** Integer factorial (n ≤ 20 safe) */
function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

// ── Polynomial representation ─────────────────────────────────────────────────
// A monomial: coefficient (rational, stored as {num, den}) × ∏ x_i^{exp_i}.
// We store the exponent map as a flat array indexed by cycle length 1..n.

type Monomial = {
  /** numerator of rational coefficient */
  num: number;
  /** denominator of rational coefficient */
  den: number;
  /** exponents[i] = exponent of x_{i+1}, i.e. exponents[0] = exp of x_1 */
  exponents: number[];
};

type CycleIndexPoly = Monomial[];

function gcdAbs(a: number, b: number): number { return gcd(Math.abs(a), Math.abs(b)); }

/** Evaluate the cycle index at x_i = k for all i (Burnside specialisation) */
function evaluateMono(m: Monomial, k: number): number {
  const totalExp = m.exponents.reduce((s, e) => s + e, 0);
  return (m.num / m.den) * Math.pow(k, totalExp);
}

function evaluateCycleIndex(poly: CycleIndexPoly, k: number): number {
  return poly.reduce((s, m) => s + evaluateMono(m, k), 0);
}

// ── Cycle index formulas ────────────────────────────────────────────────────────

/** One conjugacy class contribution */
interface CycleClass {
  /** label for display */
  label: { zh: string; en: string
    zhHant?: string;
 };
  /** number of elements in this class */
  size: number;
  /** exponents: exponents[i] = power of x_{i+1} */
  exponents: number[];
}

/** Compute conjugacy classes + cycle index for C_n */
function cycleIndexCn(n: number): { classes: CycleClass[]; poly: CycleIndexPoly } {
  const divs = divisors(n);
  const classes: CycleClass[] = divs.map(d => {
    const cycLen = d;          // cycle length = d
    const numCyc = n / d;      // number of cycles = n/d
    const exp = new Array(n).fill(0);
    exp[cycLen - 1] = numCyc;  // x_d^{n/d}
    const phiD = phi(d);
    return {
      label: {
        zh: d === 1 ? `恒等 (×1)` : `阶 ${d} 的旋转 (×${phiD})`,
        en: d === 1 ? `identity (×1)` : `rotations of order ${d} (×${phiD})`,
      },
      size: phiD,
      exponents: exp,
    };
  });
  // poly: (1/n) Σ_{d|n} φ(d) · x_d^{n/d}
  const poly: CycleIndexPoly = classes.map(cls => {
    const g = gcdAbs(cls.size, n);
    return { num: cls.size / g, den: n / g, exponents: cls.exponents };
  });
  return { classes, poly };
}

/** Reflection classes for D_n */
function reflectionClasses(n: number): CycleClass[] {
  const classes: CycleClass[] = [];
  if (n % 2 === 1) {
    // n odd: 1 class of n reflections, each fixes 1 vertex and swaps (n-1)/2 pairs
    const exp = new Array(n).fill(0);
    exp[0] = 1;            // x_1^1
    exp[1] = (n - 1) / 2; // x_2^{(n-1)/2}
    classes.push({
      label: {
        zh: `反射 (×${n}，n 为奇数：固定 1 顶点，交换 ${(n-1)/2} 对)`,
        en: `reflections (×${n}, n odd: 1 fixed vertex, ${(n-1)/2} swapped pairs)`,
      },
      size: n,
      exponents: exp,
    });
  } else {
    // n even: 2 classes
    // Class 1: n/2 reflections through two opposite vertices: x_1^2 x_2^{(n-2)/2}
    const exp1 = new Array(n).fill(0);
    exp1[0] = 2;
    exp1[1] = (n - 2) / 2;
    classes.push({
      label: {
        zh: `反射过对顶点 (×${n/2}：固定 2 顶点，交换 ${(n-2)/2} 对)`,
        en: `reflections through opposite vertices (×${n/2}: 2 fixed, ${(n-2)/2} pairs)`,
      },
      size: n / 2,
      exponents: exp1,
    });
    // Class 2: n/2 reflections through edge midpoints: x_2^{n/2}
    const exp2 = new Array(n).fill(0);
    exp2[1] = n / 2;
    classes.push({
      label: {
        zh: `反射过棱中点 (×${n/2}：无固定顶点，交换 ${n/2} 对)`,
        en: `reflections through edge midpoints (×${n/2}: 0 fixed, ${n/2} pairs)`,
      },
      size: n / 2,
      exponents: exp2,
    });
  }
  return classes;
}

/** Cycle index of D_n */
function cycleIndexDn(n: number): { classes: CycleClass[]; poly: CycleIndexPoly } {
  const { classes: cnClasses, poly: cnPoly } = cycleIndexCn(n);
  const refClasses = reflectionClasses(n);
  const order = 2 * n;
  // C_n contributes with weight 1/2 (since full order is 2n):
  // Z(D_n) = (1/2n)( Σ_Cn + Σ_reflections )
  const allClasses = [...cnClasses, ...refClasses];
  const poly: CycleIndexPoly = [
    ...cnPoly.map(m => {
      // cnPoly has denom n; for D_n denom is 2n, so double denom
      return { num: m.num, den: m.den * 2, exponents: m.exponents };
    }),
    ...refClasses.map(cls => {
      const g = gcdAbs(cls.size, order);
      return { num: cls.size / g, den: order / g, exponents: cls.exponents };
    }),
  ];
  return { classes: allClasses, poly };
}

/** Hard-coded cube face rotation group (order 24, 5 conjugacy classes) */
function cycleIndexCubeFace(): { classes: CycleClass[]; poly: CycleIndexPoly } {
  const classes: CycleClass[] = [
    {
      label: { zh: '恒等 (×1)', en: 'identity (×1)',
          zhHant: "恆等 (×1)"
    },
      size: 1,
      exponents: [6,0,0,0,0,0], // x_1^6
    },
    {
      label: { zh: '面轴 ±90° (×6)', en: 'face ±90° rotations (×6)',
          zhHant: "面軸 ±90° (×6)"
    },
      size: 6,
      exponents: [2,0,0,1,0,0], // x_1^2 x_4
    },
    {
      label: { zh: '面轴 180° (×3)', en: 'face 180° rotations (×3)',
          zhHant: "面軸 180° (×3)"
    },
      size: 3,
      exponents: [2,2,0,0,0,0], // x_1^2 x_2^2
    },
    {
      label: { zh: '顶点轴 ±120° (×8)', en: 'vertex ±120° rotations (×8)',
          zhHant: "頂點軸 ±120° (×8)"
    },
      size: 8,
      exponents: [0,0,2,0,0,0], // x_3^2
    },
    {
      label: { zh: '棱轴 180° (×6)', en: 'edge 180° rotations (×6)',
          zhHant: "稜軸 180° (×6)"
    },
      size: 6,
      exponents: [0,3,0,0,0,0], // x_2^3
    },
  ];
  // Z = (1/24)( x1^6 + 6 x1^2 x4 + 3 x1^2 x2^2 + 8 x3^2 + 6 x2^3 )
  const poly: CycleIndexPoly = classes.map(cls => {
    const g = gcdAbs(cls.size, 24);
    return { num: cls.size / g, den: 24 / g, exponents: cls.exponents.slice() };
  });
  return { classes, poly };
}

/** Generate all integer partitions of n (as arrays j_1..j_n where Σ i*j_i = n) */
function partitions(n: number): number[][] {
  const result: number[][] = [];
  const current = new Array(n + 1).fill(0);
  function backtrack(remaining: number, minPart: number) {
    if (remaining === 0) {
      result.push(current.slice(1, n + 1));
      return;
    }
    for (let part = minPart; part <= remaining; part++) {
      current[part]++;
      backtrack(remaining - part, part);
      current[part]--;
    }
  }
  backtrack(n, 1);
  return result;
}

/** Cycle index of S_n */
function cycleIndexSn(n: number): { classes: CycleClass[]; poly: CycleIndexPoly } {
  const parts = partitions(n);
  const groupOrder = factorial(n);
  const classes: CycleClass[] = [];
  const poly: CycleIndexPoly = [];

  for (const js of parts) {
    // js[i] = j_{i+1}, i.e. js[0] = j_1, number of 1-cycles
    // class size = n! / (prod_{i=1}^n i^{j_i} * j_i!)
    let denom = 1;
    const exponents = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      const ji = js[i];
      const cycLen = i + 1;
      exponents[i] = ji;
      denom *= Math.pow(cycLen, ji) * factorial(ji);
    }
    const classSize = Math.round(groupOrder / denom);
    const label = js
      .map((j, i) => j > 0 ? `${j>1?j:''}(${i+1})` : '')
      .filter(Boolean)
      .join(' ');
    classes.push({
      label: { zh: `类型 [${label}] (×${classSize})`, en: `type [${label}] (×${classSize})` },
      size: classSize,
      exponents,
    });
    const g = gcdAbs(classSize, groupOrder);
    poly.push({ num: classSize / g, den: groupOrder / g, exponents: exponents.slice() });
  }
  return { classes, poly };
}

// ── Two-colour pattern inventory (x_i → 1 + x^i) ─────────────────────────────
// Returns array of length n+1 where result[j] = number of orbits with exactly j black beads.
function twoColourInventory(poly: CycleIndexPoly, n: number): number[] {
  // For each monomial, substitute x_i → 1 + t^i, then multiply, then collect by t^j
  // We represent a univariate polynomial in t as an array of coefficients (index = power)

  function polyMul(a: number[], b: number[]): number[] {
    const res = new Array(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i++) {
      for (let j = 0; j < b.length; j++) {
        res[i + j] += a[i] * b[j];
      }
    }
    return res;
  }

  // (1 + t^i)^exp
  function polyPow(base: number[], exp: number): number[] {
    let result: number[] = [1];
    for (let k = 0; k < exp; k++) result = polyMul(result, base);
    return result;
  }

  // The final polynomial coefficients = (Σ over monomials of coeff · ∏(1+t^i)^exp_i).
  // Each coeff = num/den is exact in a double for the small groups here (n ≤ 8), so we
  // accumulate in floats and round at the end.
  const floatTotal = new Array(n + 1).fill(0);
  for (const m of poly) {
    const coeff = m.num / m.den;
    // Product: ∏_{i=1}^{n} (1 + t^i)^{exponents[i-1]}
    let prod: number[] = [1];
    for (let i = 0; i < m.exponents.length; i++) {
      const cycLen = i + 1;
      const exp = m.exponents[i];
      if (exp === 0) continue;
      const base: number[] = new Array(cycLen + 1).fill(0);
      base[0] = 1;
      base[cycLen] = 1; // 1 + t^cycLen
      prod = polyMul(prod, polyPow(base, exp));
    }
    for (let j = 0; j < prod.length && j <= n; j++) {
      floatTotal[j] += coeff * prod[j];
    }
  }
  return floatTotal.slice(0, n + 1).map(v => Math.round(v));
}

// ── Group selector type ───────────────────────────────────────────────────────
type GroupType = 'Cn' | 'Dn' | 'cube' | 'Sn';

interface GroupData {
  classes: CycleClass[];
  poly: CycleIndexPoly;
  order: number;
  n: number;
}

function buildGroupData(groupType: GroupType, n: number): GroupData {
  if (groupType === 'Cn') {
    const { classes, poly } = cycleIndexCn(n);
    return { classes, poly, order: n, n };
  } else if (groupType === 'Dn') {
    const { classes, poly } = cycleIndexDn(n);
    return { classes, poly, order: 2 * n, n };
  } else if (groupType === 'cube') {
    const { classes, poly } = cycleIndexCubeFace();
    return { classes, poly, order: 24, n: 6 };
  } else {
    // Sn
    const { classes, poly } = cycleIndexSn(n);
    return { classes, poly, order: factorial(n), n };
  }
}

/** Format a monomial exponent map as a LaTeX string like x_1^6 x_2^3 */
function monomialTeX(exponents: number[]): string {
  const parts: string[] = [];
  for (let i = 0; i < exponents.length; i++) {
    const e = exponents[i];
    if (e === 0) continue;
    const sub = i + 1;
    if (e === 1) parts.push(`x_{${sub}}`);
    else parts.push(`x_{${sub}}^{${e}}`);
  }
  return parts.length === 0 ? '1' : parts.join('\\,');
}

// ── Necklace / Bracelet enumeration (brute force for small n) ─────────────────
function buildGroup(groupType: 'Cn' | 'Dn', n: number): number[][] {
  const perms: number[][] = [];
  for (let s = 0; s < n; s++) {
    perms.push(Array.from({ length: n }, (_, i) => (i + s) % n));
  }
  if (groupType === 'Dn') {
    for (let s = 0; s < n; s++) {
      perms.push(Array.from({ length: n }, (_, i) => (s - i + n) % n));
    }
  }
  return perms;
}

function canonicalBead(bead: number[], group: number[][]): string {
  let best = bead.join(',');
  for (const perm of group) {
    const img = perm.map(j => bead[j]).join(',');
    if (img < best) best = img;
  }
  return best;
}

function enumerateBeads(
  n: number,
  k: number,
  groupType: 'Cn' | 'Dn',
): { orbits: number[][]; byBlack: number[] } {
  const group = buildGroup(groupType, n);
  const seen = new Set<string>();
  const orbits: number[][] = [];
  const byBlack = new Array(k === 2 ? n + 1 : 0).fill(0);

  function recurse(idx: number, current: number[]) {
    if (idx === n) {
      const canon = canonicalBead(current, group);
      if (!seen.has(canon)) {
        seen.add(canon);
        orbits.push([...current]);
        if (k === 2) byBlack[current.reduce((s, v) => s + v, 0)]++;
      }
      return;
    }
    for (let c = 0; c < k; c++) {
      current.push(c);
      recurse(idx + 1, current);
      current.pop();
    }
  }
  recurse(0, []);
  return { orbits, byBlack };
}

// ══════════════════════════════════════════════════════════════════════════════
// Main section component
// ══════════════════════════════════════════════════════════════════════════════

export default function CycleIndex() {
  const lang = useLang();

  return (
    <GTSec id="cycle-index" className="gt-sec">
      <div className="gt-sec-num">§49</div>
      <h2 className="gt-sec-title">
        <L zh="轮换指标多项式" en="The cycle-index polynomial" />
      </h2>

      <p className="gt-lede">
        <L
          zh={<>
            给正六面体的六个面涂颜色，旋转等价的方案算同一种，共有多少种？
            Burnside 引理告诉我们：答案等于"每个旋转固定的着色数"的平均。
            但把 24 个旋转逐一列出并代入 <TeX src={String.raw`k^{c(g)}`} />，显得笨拙。
            <strong>轮换指标</strong>（Cycle Index）把整个 Burnside 求和压缩成一个多项式 <TeX src={String.raw`Z(G)`} />：
            令 <TeX src={String.raw`x_i = k`} /> 就得计数，令 <TeX src={String.raw`x_i = 1+t^i`} /> 就得按颜色内容分类的生成函数。
            这一工具正是 <strong>Pólya 枚举定理（PET）</strong>的核心，由 Redfield（1927）和 Pólya（1937）独立建立。
          </>}
          en={<>
            How many distinct ways are there to colour the six faces of a cube with <TeX src={String.raw`k`} /> colours, counting rotations as the same?
            Burnside tells us to average the fixed-colouring counts over all 24 rotations — but writing out each term separately is cumbersome.
            The <strong>cycle index</strong> <TeX src={String.raw`Z(G)`} /> compresses the entire Burnside sum into one polynomial:
            set <TeX src={String.raw`x_i = k`} /> to get the plain orbit count; set <TeX src={String.raw`x_i = 1+t^i`} /> to get the generating function tracking colour content.
            This is the engine of the <strong>Pólya Enumeration Theorem (PET)</strong>, independently discovered by Redfield (1927) and Pólya (1937).
          </>}
        />
      </p>

      {/* ── Definition box ── */}
      <div className="gt-def">
        <div className="gt-def-title">
          <L zh="定义: 轮换指标" en="Definition: cycle index" />
        </div>
        <div className="gt-def-body">
          <L
            zh={<>
              设有限群 <TeX src={String.raw`G`} /> 作用在 <TeX src={String.raw`n`} /> 元集 <TeX src={String.raw`X`} /> 上（等价地，<TeX src={String.raw`G`} /> 嵌入 <TeX src={String.raw`S_n`} />）。
              对每个 <TeX src={String.raw`g\in G`} />，将 <TeX src={String.raw`g`} /> 写成不相交轮换之积，
              令 <TeX src={String.raw`c_i(g)`} /> 为长度恰为 <TeX src={String.raw`i`} /> 的轮换个数（不动点是 1-轮换），
              则 <TeX src={String.raw`\sum_{i=1}^n i\cdot c_i(g)=n`} />。
              <TeX src={String.raw`G`} /> 在 <TeX src={String.raw`X`} /> 上的<strong>轮换指标</strong>是有理数域上的多项式：
            </>}
            en={<>
              Let a finite group <TeX src={String.raw`G`} /> act on an <TeX src={String.raw`n`} />-element set <TeX src={String.raw`X`} /> (equivalently <TeX src={String.raw`G`} /> embeds in <TeX src={String.raw`S_n`} />).
              For each <TeX src={String.raw`g\in G`} />, write <TeX src={String.raw`g`} /> as a product of disjoint cycles and let <TeX src={String.raw`c_i(g)`} /> be the number of cycles of length exactly <TeX src={String.raw`i`} /> (fixed points are 1-cycles); then <TeX src={String.raw`\sum_i i\cdot c_i(g)=n`} />.
              The <strong>cycle index</strong> of <TeX src={String.raw`G`} /> acting on <TeX src={String.raw`X`} /> is the polynomial over <TeX src={String.raw`\mathbb{Q}`} />:
            </>}
          />
          <TeXBlock src={String.raw`Z(G)(x_1,\ldots,x_n) \;=\; \frac{1}{|G|}\sum_{g\in G}\prod_{i=1}^{n}x_i^{\,c_i(g)}.`} />
          <L
            zh={<>
              它只依赖于 <TeX src={String.raw`G`} /> 在 <TeX src={String.raw`X`} /> 上的置换作用（即各元素的轮换类型多重集），与 <TeX src={String.raw`X`} /> 中点的标号无关。
              同一共轭类中的元素具有相同的轮换类型，因此实际计算时按共轭类汇总即可。
            </>}
            en={<>
              It depends only on the permutation action of <TeX src={String.raw`G`} /> on <TeX src={String.raw`X`} /> (i.e. on the multiset of cycle types of its elements), not on the labels of <TeX src={String.raw`X`} />.
              Elements in the same conjugacy class share a cycle type, so in practice we sum over conjugacy classes.
            </>}
          />
        </div>
      </div>

      {/* ── Theorem: PET ── */}
      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理: Pólya 枚举定理（PET）" en="Theorem: Pólya Enumeration Theorem (PET)" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>
              设 <TeX src={String.raw`G`} /> 作用在 <TeX src={String.raw`n`} /> 元集 <TeX src={String.raw`X`} /> 上，颜色集 <TeX src={String.raw`C`} /> 中每种颜色 <TeX src={String.raw`c`} /> 带权 <TeX src={String.raw`w(c)`} />（形式不定元的单项式）。
              以 <TeX src={String.raw`G`} /> 轨道为单位的着色生成函数（<em>模式清单</em>）等于将轮换指标中 <TeX src={String.raw`x_i`} /> 代换为 <TeX src={String.raw`\sum_{c\in C}w(c)^i`} /> 所得：
            </>}
            en={<>
              Let <TeX src={String.raw`G`} /> act on the <TeX src={String.raw`n`} />-element set <TeX src={String.raw`X`} />, and assign to each colour <TeX src={String.raw`c\in C`} /> a formal weight <TeX src={String.raw`w(c)`} />.
              The generating function (pattern inventory) summing the weight over all <TeX src={String.raw`G`} />-orbits of colourings is obtained by substituting <TeX src={String.raw`x_i\mapsto\sum_{c}w(c)^i`} />:
            </>}
          />
          <TeXBlock src={String.raw`P_G \;=\; Z(G)\!\left(\sum_c w(c),\;\sum_c w(c)^2,\;\ldots,\;\sum_c w(c)^n\right).`} />
          <L
            zh={<>
              <strong>两个重要特例。</strong>
              (i) 令所有颜色权重 <TeX src={String.raw`w(c)=1`} />（共 <TeX src={String.raw`k`} /> 种颜色），则每个 <TeX src={String.raw`x_i\mapsto k`} />，还原 Burnside 引理：轨道数 <TeX src={String.raw`= Z(G)(k,k,\ldots,k)`} />。
              (ii) 令 <TeX src={String.raw`w(\text{黑})=t,\;w(\text{白})=1`} />，则 <TeX src={String.raw`x_i\mapsto 1+t^i`} />；生成函数中 <TeX src={String.raw`t^j`} /> 的系数恰为恰好含 <TeX src={String.raw`j`} /> 个黑色点的不等价着色数。
              <br />
              <strong>注意：</strong>代换是 <TeX src={String.raw`x_i\mapsto\sum_c w(c)^i`} />（各色权的 <TeX src={String.raw`i`} /> 次方之和），<em>不是</em> <TeX src={String.raw`\left(\sum_c w(c)\right)^i`} />——这是最常见的误用。
            </>}
            en={<>
              <strong>Two key specialisations.</strong>
              (i) Set all weights <TeX src={String.raw`w(c)=1`} /> (with <TeX src={String.raw`k`} /> colours), so every <TeX src={String.raw`x_i\mapsto k`} />: we recover Burnside — orbit count <TeX src={String.raw`= Z(G)(k,\ldots,k)`} />.
              (ii) Set <TeX src={String.raw`w(\text{black})=t,\;w(\text{white})=1`} />, so <TeX src={String.raw`x_i\mapsto 1+t^i`} />: the coefficient of <TeX src={String.raw`t^j`} /> in the resulting polynomial is the number of inequivalent colourings with exactly <TeX src={String.raw`j`} /> black points.
              <br />
              <strong>Pitfall:</strong> the substitution is <TeX src={String.raw`x_i\mapsto\sum_c w(c)^i`} /> (the <TeX src={String.raw`i`} />-th power sum), <em>not</em> <TeX src={String.raw`\left(\sum_c w(c)\right)^i`} /> — the most common misapplication.
            </>}
          />
        </div>
      </div>

      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="经典轮换指标公式" en="Classical cycle-index formulas" />
      </h3>

      <p>
        <L
          zh={<>
            三个最重要的群各有封闭公式：
          </>}
          en={<>
            Three groups have explicit closed-form cycle indices:
          </>}
        />
      </p>

      <TeXBlock src={String.raw`Z(C_n) = \frac{1}{n}\sum_{d\mid n}\varphi(d)\,x_d^{n/d}`} />

      <p style={{ marginTop: 0, marginBottom: 4 }}>
        <L
          zh={<>其中 <TeX src={String.raw`\varphi`} /> 是 Euler 函数。阶为 <TeX src={String.raw`d`} /> 的旋转共 <TeX src={String.raw`\varphi(d)`} /> 个，每个形成 <TeX src={String.raw`n/d`} /> 个长为 <TeX src={String.raw`d`} /> 的轮换。</>}
          en={<>where <TeX src={String.raw`\varphi`} /> is Euler's totient. There are <TeX src={String.raw`\varphi(d)`} /> rotations of order <TeX src={String.raw`d`} />, each yielding <TeX src={String.raw`n/d`} /> cycles of length <TeX src={String.raw`d`} />.</>}
        />
      </p>

      <TeXBlock src={String.raw`Z(D_n) = \tfrac{1}{2}Z(C_n) + \begin{cases} \tfrac{1}{2}x_1 x_2^{(n-1)/2} & n\text{ odd}\\ \tfrac{1}{4}\!\left(x_1^2 x_2^{(n-2)/2} + x_2^{n/2}\right) & n\text{ even}\end{cases}`} />

      <p style={{ marginTop: 0, marginBottom: 4 }}>
        <L
          zh={<>正方体 6 面的旋转群（阶 24，同构于 <TeX src={String.raw`S_4`} />）：</>}
          en={<>Cube face rotation group (order 24, isomorphic to <TeX src={String.raw`S_4`} />):</>}
        />
      </p>

      <TeXBlock src={String.raw`Z(\text{cube}) = \tfrac{1}{24}\!\left(x_1^6 + 6x_1^2 x_4 + 3x_1^2 x_2^2 + 8x_3^2 + 6x_2^3\right)`} />

      <p>
        <L
          zh={<>
            <strong>魔方连接：</strong>这 24 个旋转正是速拧中对整块魔方做 x/y/z 重定向的全部操作——把魔方作为刚体在空间中旋转，而非拨动某一层。
            它们置换空间对角线（4 条），因此群同构于 <TeX src={String.raw`S_4`} />。
            代入 <TeX src={String.raw`k=6`} /> 得 2226，即以 6 种颜色对 6 面进行的旋转等价着色方案总数（允许重复色）。
            <strong>警告：</strong>PET 只统计静态面着色，不涉及层转操作群（阶约 <TeX src={String.raw`4.3\times10^{19}`} />）；两者共享的仅是这 24 个重定向旋转。
          </>}
          en={<>
            <strong>Cube connection:</strong> these 24 rotations are exactly the whole-cube reorientations (x/y/z moves) that speedcubers use — rigid rotations of the cube as a solid, not layer turns.
            They permute the 4 body diagonals, so the group is isomorphic to <TeX src={String.raw`S_4`} />.
            Substituting <TeX src={String.raw`k=6`} /> gives 2226: the number of rotation-equivalent face-colourings with 6 colours (repetition allowed).
            <strong>Caveat:</strong> PET counts colourings of static faces; it does not model the move group (order <TeX src={String.raw`\approx4.3\times10^{19}`} />). The shared object is precisely these 24 reorientation rotations.
          </>}
        />
      </p>

      {/* ── Widget 1: Cycle-Index Builder ── */}
      <CycleIndexBuilder lang={lang} />

      {/* ── Widget 2: Necklace / Bracelet Visualiser ── */}
      <NecklaceVisualiser lang={lang} />

      {/* ── Widget 3: Burnside ↔ PET Substitution Stepper ── */}
      <SubstitutionStepper lang={lang} />

      {/* ── Common pitfalls ── */}
      <div className="gt-aside" style={{ marginTop: 40 }}>
        <L
          zh={<>
            <strong>常见误区。</strong>
            (1) Burnside 引理对所有群元素（含恒等）取平均，漏掉恒等项（贡献 <TeX src={String.raw`k^n`} />）是最频繁的计算错误。
            (2) 固定着色数是 <TeX src={String.raw`k^{c(g)}`} />（每个<em>轮换</em>一个颜色选择），不是 <TeX src={String.raw`k^{\text{被移动点数}}`} />。
            (3) <TeX src={String.raw`x_3^2`} /> 表示两个 3-轮换（共 6 个点），下标是轮换<em>长度</em>而非编号。
            (4) 同一抽象群在不同集合上的轮换指标不同：正方体旋转群作用于 6 个面、8 个顶点、12 条棱时分别有不同的 <TeX src={String.raw`Z`} />。
            (5) <TeX src={String.raw`D_n`} /> 在本文中阶为 <TeX src={String.raw`2n`} />（即 <TeX src={String.raw`n`} />-边形的对称群）；部分教材写 <TeX src={String.raw`D_{2n}`} /> 指同一群，请注意约定。
          </>}
          en={<>
            <strong>Common pitfalls.</strong>
            (1) Burnside averages over ALL group elements including the identity (contributing <TeX src={String.raw`k^n`} />); omitting it is the most frequent arithmetic error.
            (2) The fixed-colouring count for <TeX src={String.raw`g`} /> is <TeX src={String.raw`k^{c(g)}`} /> — one factor per <em>cycle</em>, not per moved point.
            (3) <TeX src={String.raw`x_3^2`} /> means two 3-cycles (6 points total); the subscript is the cycle <em>length</em>, not an index.
            (4) The cycle index depends on the action, not just the abstract group: the cube rotation group has different <TeX src={String.raw`Z`} /> on faces (degree 6), vertices (degree 8), and edges (degree 12).
            (5) Here <TeX src={String.raw`D_n`} /> has order <TeX src={String.raw`2n`} /> (symmetries of the <TeX src={String.raw`n`} />-gon); some texts write <TeX src={String.raw`D_{2n}`} /> for the same group.
          </>}
        />
      </div>

      {/* ── References ── */}
      <div style={{ marginTop: 40 }}>
        <div className="gt-def-title" style={{ marginBottom: 10 }}>
          <L zh="参考文献" en="References" />
        </div>
        <ol style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-dim)' }}>
          <li>R. P. Stanley, <em>Enumerative Combinatorics</em>, Vol. 2, §7.24. Cambridge University Press. Authoritative treatment of cycle indices and Pólya theory.</li>
          <li>J. H. van Lint &amp; R. M. Wilson, <em>A Course in Combinatorics</em>, 2nd ed., Chapter 35: "Pólya theory of counting". Cambridge, 2001.</li>
          <li>Wikipedia, <a href="https://en.wikipedia.org/wiki/P%C3%B3lya_enumeration_theorem" target="_blank" rel="noopener noreferrer">Pólya enumeration theorem</a> — cube-face worked example and C<sub>n</sub>/D<sub>n</sub>/S<sub>n</sub> formulas.</li>
        </ol>
      </div>
    </GTSec>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Widget 1: Cycle-Index Builder
// Shows symbolic Z(G), per-class table, and Burnside orbit count.
// ══════════════════════════════════════════════════════════════════════════════

function CycleIndexBuilder({ lang }: { lang: Lang }) {
  const [groupType, setGroupType] = useState<GroupType>('cube');
  const [n, setN] = useState(6);
  const [k, setK] = useState(2);
  const [showClasses, setShowClasses] = useState(true);

  const effectiveN = groupType === 'cube' ? 6 : groupType === 'Sn' ? Math.min(n, 6) : n;

  const data = useMemo(() => buildGroupData(groupType, effectiveN), [groupType, effectiveN]);

  const orbitCount = useMemo(() => {
    const raw = evaluateCycleIndex(data.poly, k);
    return Math.round(raw);
  }, [data, k]);

  // Check integrality: the sum Σ class.size * k^{Σ exponents} must be divisible by |G|
  const burnsideSum = useMemo(() => {
    return data.classes.reduce((s, cls) => {
      const c = cls.exponents.reduce((a, b) => a + b, 0);
      return s + cls.size * Math.pow(k, c);
    }, 0);
  }, [data, k]);

  const isInteger = Number.isInteger(burnsideSum / data.order);

  const handleGroupChange = useCallback((g: GroupType) => {
    setGroupType(g);
    if (g === 'Cn' || g === 'Dn') setN(prev => Math.max(2, Math.min(prev, 12)));
    if (g === 'Sn') setN(prev => Math.min(prev, 6));
  }, []);

  // SVG bar chart: one bar per conjugacy class
  const maxSize = Math.max(...data.classes.map(c => c.size));
  const BAR_W = 100;
  const BAR_GAP = 4;
  const BAR_MAX_H = 80;
  const ROW_H = 40;
  const svgW = Math.max(320, data.classes.length * (BAR_W + BAR_GAP) + 20);
  const svgH = BAR_MAX_H + ROW_H * 2 + 30;

  const colourForClass = (i: number) => PALETTE[i % PALETTE.length];

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="轮换指标构造器" en="Cycle-Index Builder" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="选择群，查看符号形式 Z(G)、共轭类分解与 Burnside 轨道数 Z(G)(k,…,k)。"
          en="Choose a group to see the symbolic cycle index Z(G), its conjugacy-class breakdown, and the Burnside orbit count Z(G)(k,…,k)."
        />
      </div>

      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {(['Cn','Dn','cube','Sn'] as GroupType[]).map(g => (
          <button
            key={g}
            className={`gt-chip${groupType === g ? ' gt-chip-active' : ''}`}
            onClick={() => handleGroupChange(g)}
          >
            {g === 'cube' ? (tr({ zh: '正方体面', en: 'Cube faces',
                zhHant: "正方體面"
            })) : g}
          </button>
        ))}
      </div>

      {(groupType === 'Cn' || groupType === 'Dn') && (
        <div className="gt-panel-input-row" style={{ marginTop: 10 }}>
          <label style={{ minWidth: 60 }}>
            <L zh={<>n (≥ 2)</>} en={<>n (≥ 2)</>} />
          </label>
          <input
            type="range" min={2} max={12} value={n}
            onChange={e => setN(+e.target.value)}
            style={{ flex: 1 }}
            className="gt-input"
          />
          <span className="gt-result-val-strong" style={{ minWidth: 28, color: 'var(--accent-2)' }}>{n}</span>
        </div>
      )}

      {groupType === 'Sn' && (
        <div className="gt-panel-input-row" style={{ marginTop: 10 }}>
          <label style={{ minWidth: 60 }}>n (2–6)</label>
          <input
            type="range" min={2} max={6} value={effectiveN}
            onChange={e => setN(+e.target.value)}
            style={{ flex: 1 }}
            className="gt-input"
          />
          <span className="gt-result-val-strong" style={{ minWidth: 28, color: 'var(--accent-2)' }}>{effectiveN}</span>
        </div>
      )}

      <div className="gt-panel-input-row" style={{ marginTop: 10 }}>
        <label style={{ minWidth: 60 }}>
          <L zh="颜色数 k" en="Colours k" />
        </label>
        <input
          type="range" min={1} max={8} value={k}
          onChange={e => setK(+e.target.value)}
          style={{ flex: 1 }}
          className="gt-input"
        />
        <span className="gt-result-val-strong" style={{ minWidth: 28, color: 'var(--accent)' }}>{k}</span>
      </div>

      <div style={{ marginTop: 10 }}>
        <button
          className={`gt-chip${showClasses ? ' gt-chip-active' : ''}`}
          onClick={() => setShowClasses(s => !s)}
          style={{ fontSize: 12 }}
        >
          <L zh="显示共轭类分解" en="Show class breakdown" />
        </button>
      </div>

      {/* Symbolic Z display */}
      <div style={{ marginTop: 18, padding: '12px 16px', background: 'var(--bg-elev)', borderRadius: 8, overflowX: 'auto' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-faint)', marginBottom: 6 }}>
          {tr({ zh: '符号轮换指标', en: 'Symbolic cycle index',
              zhHant: "符號輪換指標"
        })}
        </div>
        <TeXBlock src={
          `Z(G) = \\tfrac{1}{${data.order}}\\!\\Bigl(` +
          data.classes.map(cls => `${cls.size}\\cdot ${monomialTeX(cls.exponents)}`).join(' + ') +
          `\\Bigr)`
        } />
      </div>

      {/* Class bar chart */}
      {showClasses && (
        <div style={{ overflowX: 'auto', marginTop: 16 }}>
          <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" style={{ display: 'block', minWidth: 260, maxWidth: svgW }}>
            {data.classes.map((cls, ci) => {
              const x = 10 + ci * (BAR_W + BAR_GAP);
              const barH = maxSize === 0 ? 0 : Math.round((cls.size / maxSize) * BAR_MAX_H);
              const barY = BAR_MAX_H - barH;
              const col = colourForClass(ci);
              const kc = cls.exponents.reduce((s, e) => s + e, 0);
              return (
                <g key={ci}>
                  {/* Bar */}
                  <rect x={x} y={barY} width={BAR_W} height={barH} rx={3}
                    fill={col} fillOpacity={0.75} />
                  {/* Class size label on bar */}
                  <text x={x + BAR_W / 2} y={barY - 4} textAnchor="middle"
                    style={{ fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 700 }} fill={col}>
                    ×{cls.size}
                  </text>
                  {/* Monomial below bar */}
                  <foreignObject x={x} y={BAR_MAX_H + 6} width={BAR_W} height={ROW_H}>
                    <div
                      style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--ink-dim)',
                               textAlign: 'center', lineHeight: 1.3, wordBreak: 'break-all' }}
                    >
                      {monomialPlain(cls.exponents)}
                    </div>
                  </foreignObject>
                  {/* k^c contribution */}
                  <text x={x + BAR_W / 2} y={BAR_MAX_H + ROW_H + 22} textAnchor="middle"
                    style={{ fontSize: 10, fontFamily: 'var(--mono)' }} fill="var(--ink-faint)">
                    {cls.size}×{k}^{kc}={cls.size * Math.pow(k, kc)}
                  </text>
                </g>
              );
            })}
            {/* Total annotation */}
            <text x={10} y={svgH - 2} style={{ fontSize: 9, fontFamily: 'var(--mono)' }} fill="var(--ink-faint)">
              {lang === 'zh'
                ? `Σ = ${burnsideSum}，÷ ${data.order} = ${orbitCount}`
                : `Σ = ${burnsideSum}, ÷ ${data.order} = ${orbitCount}`}
            </text>
          </svg>
        </div>
      )}

      <div className="gt-panel-result" style={{ marginTop: 12 }}>
        <div className="gt-result-row">
          <span className="gt-result-label">|G|</span>
          <span className="gt-result-val-strong" style={{ color: 'var(--accent-2)' }}>{data.order}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="共轭类数" en="Conjugacy classes" />
          </span>
          <span className="gt-result-val">{data.classes.length}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="Burnside 和" en="Burnside sum" />
          </span>
          <span className="gt-result-val">{burnsideSum}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh={<>整除校验 (÷{data.order})</>} en={<>Integrality (÷{data.order})</>} />
          </span>
          <span className="gt-result-val-strong" style={{ color: isInteger ? 'var(--green)' : 'var(--warn)' }}>
            {isInteger ? (tr({ zh: '整除 ✓', en: 'divisible ✓' })) : (tr({ zh: '不整除 ✗', en: 'not integer ✗' }))}
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh={<>Z(G)({k},…,{k}) = 轨道数</>} en={<>Z(G)({k},…,{k}) = orbits</>} />
          </span>
          <span className="gt-result-val-strong" style={{ color: 'var(--green)', fontSize: 20 }}>
            {orbitCount}
          </span>
        </div>
        {/* Spot-check known values */}
        {groupType === 'cube' && k === 2 && (
          <div className="gt-result-row">
            <span className="gt-result-label"><L zh="已知值 k=2" en="Known k=2" /></span>
            <span className="gt-result-val" style={{ color: orbitCount === 10 ? 'var(--green)' : 'var(--warn)' }}>
              {orbitCount === 10 ? '10 ✓' : `≠ 10`}
            </span>
          </div>
        )}
        {groupType === 'cube' && k === 3 && (
          <div className="gt-result-row">
            <span className="gt-result-label"><L zh="已知值 k=3" en="Known k=3" /></span>
            <span className="gt-result-val" style={{ color: orbitCount === 57 ? 'var(--green)' : 'var(--warn)' }}>
              {orbitCount === 57 ? '57 ✓' : `≠ 57`}
            </span>
          </div>
        )}
        {groupType === 'Cn' && k === 2 && (
          <div className="gt-result-row">
            <span className="gt-result-label"><L zh="项链数 (k=2)" en="Necklaces (k=2)" /></span>
            <span className="gt-result-val" style={{ color: 'var(--ink-dim)', fontSize: 12 }}>
              {lang === 'zh'
                ? `C_${effectiveN}，2色 → ${orbitCount} 种项链`
                : `C_${effectiveN}, 2 colours → ${orbitCount} necklaces`}
            </span>
          </div>
        )}
        {groupType === 'Dn' && k === 2 && (
          <div className="gt-result-row">
            <span className="gt-result-label"><L zh="手环数 (k=2)" en="Bracelets (k=2)" /></span>
            <span className="gt-result-val" style={{ color: 'var(--ink-dim)', fontSize: 12 }}>
              {lang === 'zh'
                ? `D_${effectiveN}，2色 → ${orbitCount} 种手环`
                : `D_${effectiveN}, 2 colours → ${orbitCount} bracelets`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Plain-text monomial like x1^6 x3^2 */
function monomialPlain(exponents: number[]): string {
  const parts: string[] = [];
  for (let i = 0; i < exponents.length; i++) {
    const e = exponents[i];
    if (e === 0) continue;
    parts.push(e === 1 ? `x${i+1}` : `x${i+1}^${e}`);
  }
  return parts.length === 0 ? '1' : parts.join('·');
}

// ══════════════════════════════════════════════════════════════════════════════
// Widget 2: Necklace / Bracelet Visualiser
// ══════════════════════════════════════════════════════════════════════════════

function NecklaceVisualiser({ lang }: { lang: Lang }) {
  const [n, setN] = useState(5);
  const [gType, setGType] = useState<'Cn' | 'Dn'>('Cn');
  const k = 2;

  const { orbits, formulaCount, byBlack } = useMemo(() => {
    const { orbits, byBlack } = enumerateBeads(n, k, gType);
    const data = gType === 'Cn' ? cycleIndexCn(n) : cycleIndexDn(n);
    const fc = Math.round(evaluateCycleIndex(data.poly, k));
    return { orbits, formulaCount: fc, byBlack };
  }, [n, gType]);

  const verified = orbits.length === formulaCount;

  // Layout: arrange orbits in a responsive grid
  const RING_R = 22;  // radius of the bead ring
  const BEAD_R = 5;   // bead dot radius
  const CELL = RING_R * 2 + 16;
  const COLS = Math.max(3, Math.min(8, Math.floor(320 / CELL)));
  const ROWS = Math.ceil(orbits.length / COLS);
  const svgW = COLS * CELL + 8;
  const svgH = ROWS * CELL + 8;

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="项链 / 手环可视化器" en="Necklace / Bracelet Visualiser" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="枚举所有 2 色 n 珠项链（C_n）或手环（D_n），每个等价类画一个珠环，直接与 Z(G)(2,…,2) 对照。"
          en="Enumerate all 2-colour n-bead necklaces (C_n) or bracelets (D_n), draw one bead ring per orbit, and cross-check against Z(G)(2,…,2)."
        />
      </div>

      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 6 }}>
        <button
          className={`gt-chip${gType === 'Cn' ? ' gt-chip-active' : ''}`}
          onClick={() => setGType('Cn')}
        >
          <L zh="C_n（旋转）" en="C_n (rotations)" />
        </button>
        <button
          className={`gt-chip${gType === 'Dn' ? ' gt-chip-active' : ''}`}
          onClick={() => setGType('Dn')}
        >
          <L zh="D_n（旋转+反射）" en="D_n (rotations+reflections)" />
        </button>
      </div>

      <div className="gt-panel-input-row" style={{ marginTop: 10 }}>
        <label style={{ minWidth: 60 }}>n</label>
        <input
          type="range" min={2} max={9} value={n}
          onChange={e => setN(+e.target.value)}
          style={{ flex: 1 }}
          className="gt-input"
        />
        <span className="gt-result-val-strong" style={{ minWidth: 28, color: 'var(--accent-2)' }}>{n}</span>
      </div>

      <div className="gt-panel-result" style={{ marginTop: 8, marginBottom: 0 }}>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="绘制轨道数" en="Orbits drawn" />
          </span>
          <span className="gt-result-val-strong" style={{ color: 'var(--green)' }}>{orbits.length}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label">Z(G)(2,…,2)</span>
          <span className="gt-result-val-strong" style={{ color: verified ? 'var(--green)' : 'var(--warn)' }}>
            {formulaCount} {verified ? '✓' : '✗'}
          </span>
        </div>
        {n === 6 && gType === 'Cn' && (
          <div className="gt-result-row">
            <span className="gt-result-label"><L zh="经典值" en="Classic" /></span>
            <span className="gt-result-val" style={{ color: formulaCount === 14 ? 'var(--green)' : 'var(--warn)' }}>
              {tr({ zh: '14 种项链 ✓', en: '14 necklaces ✓',
                  zhHant: "14 種項鍊 ✓"
            })}
            </span>
          </div>
        )}
        {n === 6 && gType === 'Dn' && (
          <div className="gt-result-row">
            <span className="gt-result-label"><L zh="经典值" en="Classic" /></span>
            <span className="gt-result-val" style={{ color: formulaCount === 13 ? 'var(--green)' : 'var(--warn)' }}>
              {tr({ zh: '13 种手环 ✓（比项链少1，手性对消）', en: '13 bracelets ✓ (1 fewer than necklaces: one chiral pair merges)',
                  zhHant: "13 種手環 ✓（比項鍊少1，手性對消）"
            })}
            </span>
          </div>
        )}
      </div>

      {/* Colour-content bins (byBlack) */}
      {byBlack.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--ink-faint)', fontFamily: 'var(--mono)' }}>
            {tr({ zh: '按黑珠数：', en: 'by #black:',
                zhHant: "按黑珠數："
            })}
          </span>
          {byBlack.map((cnt, j) => cnt > 0 && (
            <span key={j} style={{
              fontSize: 12, fontFamily: 'var(--mono)',
              color: 'var(--accent)', fontWeight: 700,
              background: 'var(--bg-elev)', borderRadius: 4, padding: '1px 6px'
            }}>
              {j}:{cnt}
            </span>
          ))}
        </div>
      )}

      {/* Bead ring grid */}
      <div style={{ overflowX: 'auto', marginTop: 14 }}>
        <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" style={{ display: 'block', minWidth: 180, maxWidth: svgW }}>
          {orbits.map((bead, oi) => {
            const col = oi % COLS;
            const row = Math.floor(oi / COLS);
            const cx = 4 + col * CELL + CELL / 2;
            const cy = 4 + row * CELL + CELL / 2;
            return (
              <g key={oi}>
                {/* Ring guide circle */}
                <circle cx={cx} cy={cy} r={RING_R} fill="none" stroke="var(--rule)" strokeWidth={0.5} />
                {/* Beads */}
                {bead.map((colour, bi) => {
                  const angle = (2 * Math.PI * bi) / n - Math.PI / 2;
                  const bx = cx + RING_R * Math.cos(angle);
                  const by = cy + RING_R * Math.sin(angle);
                  return (
                    <circle
                      key={bi}
                      cx={bx} cy={by} r={BEAD_R}
                      fill={colour === 1 ? 'var(--accent)' : 'var(--bg-deep)'}
                      stroke={colour === 1 ? 'var(--accent)' : 'var(--rule)'}
                      strokeWidth={1}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-faint)', lineHeight: 1.6 }}>
        <L
          zh={<>
            红色 = 黑珠；空心灰 = 白珠。每个圆圈代表一个等价类的典范代表元（字典最小表示）。
            旋转（C_n）允许的操作比旋转+反射（D_n）少，故 C_n 的轨道数 ≥ D_n 的轨道数。
            n=6,k=2 时恰好差 1（14 vs 13）。
          </>}
          en={<>
            Red = black bead; hollow grey = white bead. Each ring shows the lexicographically minimal representative of its orbit.
            C_n (rotations only) has fewer symmetries than D_n (rotations+reflections), so C_n orbit count ≥ D_n orbit count.
            For n=6, k=2 they differ by exactly 1 (14 vs 13): one chiral pair of necklaces merges into one bracelet.
          </>}
        />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Widget 3: Burnside ↔ PET Substitution Stepper
// Shows three lenses on the same Z(G): symbolic, plain count, 2-colour gen fn
// ══════════════════════════════════════════════════════════════════════════════

type StepperTab = 'symbolic' | 'plain' | 'bicolour';

function SubstitutionStepper({ lang }: { lang: Lang }) {
  const [tab, setTab] = useState<StepperTab>('symbolic');
  const [groupType, setGroupType] = useState<GroupType>('cube');
  const [n, setN] = useState(6);
  const [k, setK] = useState(3);

  const effectiveN = groupType === 'cube' ? 6 : groupType === 'Sn' ? Math.min(n, 5) : n;

  const data = useMemo(() => buildGroupData(groupType, effectiveN), [groupType, effectiveN]);

  const orbitCount = useMemo(() => {
    const raw = evaluateCycleIndex(data.poly, k);
    return Math.round(raw);
  }, [data, k]);

  const inventory = useMemo(() => {
    if (tab !== 'bicolour') return null;
    return twoColourInventory(data.poly, effectiveN);
  }, [data, effectiveN, tab]);

  const inventoryTotal = inventory ? inventory.reduce((s, v) => s + v, 0) : 0;
  const inventoryCheck = Math.round(evaluateCycleIndex(data.poly, 2));

  const tabLabel = (t: StepperTab) => {
    if (lang === 'zh') {
      return { symbolic: '符号式', plain: `代入 x_i=${k}`, bicolour: '双色生成函数' }[t];
    }
    return { symbolic: 'Symbolic', plain: `x_i=${k}`, bicolour: 'B/W gen. fn.' }[t];
  };

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="Burnside ↔ Pólya 代换演示" en="Burnside ↔ Pólya substitution stepper" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="同一个 Z(G)，三种眼光：符号多项式、代入 k 还原 Burnside、代入 1+x^i 得双色生成函数。"
          en="One polynomial Z(G), three lenses: symbolic, plain count (Burnside), and two-colour generating function (PET)."
        />
      </div>

      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {(['Cn','Dn','cube','Sn'] as GroupType[]).map(g => (
          <button
            key={g}
            className={`gt-chip${groupType === g ? ' gt-chip-active' : ''}`}
            onClick={() => setGroupType(g)}
          >
            {g === 'cube' ? (tr({ zh: '正方体面', en: 'Cube faces',
                zhHant: "正方體面"
            })) : g}
          </button>
        ))}
      </div>

      {(groupType === 'Cn' || groupType === 'Dn') && (
        <div className="gt-panel-input-row" style={{ marginTop: 8 }}>
          <label style={{ minWidth: 50 }}>n</label>
          <input type="range" min={2} max={10} value={n}
            onChange={e => setN(+e.target.value)}
            style={{ flex: 1 }} className="gt-input" />
          <span className="gt-result-val-strong" style={{ minWidth: 28, color: 'var(--accent-2)' }}>{n}</span>
        </div>
      )}
      {groupType === 'Sn' && (
        <div className="gt-panel-input-row" style={{ marginTop: 8 }}>
          <label style={{ minWidth: 50 }}>n</label>
          <input type="range" min={2} max={5} value={effectiveN}
            onChange={e => setN(+e.target.value)}
            style={{ flex: 1 }} className="gt-input" />
          <span className="gt-result-val-strong" style={{ minWidth: 28, color: 'var(--accent-2)' }}>{effectiveN}</span>
        </div>
      )}

      {/* Tab row */}
      <div className="gt-panel-input-row" style={{ marginTop: 12, gap: 6, flexWrap: 'wrap' }}>
        {(['symbolic','plain','bicolour'] as StepperTab[]).map(t => (
          <button
            key={t}
            className={`gt-chip${tab === t ? ' gt-chip-active' : ''}`}
            onClick={() => setTab(t)}
          >
            {tabLabel(t)}
          </button>
        ))}
      </div>

      {tab === 'plain' && (
        <div className="gt-panel-input-row" style={{ marginTop: 8 }}>
          <label style={{ minWidth: 60 }}>
            <L zh="颜色数 k" en="Colours k" />
          </label>
          <input type="range" min={1} max={8} value={k}
            onChange={e => setK(+e.target.value)}
            style={{ flex: 1 }} className="gt-input" />
          <span className="gt-result-val-strong" style={{ minWidth: 28, color: 'var(--accent)' }}>{k}</span>
        </div>
      )}

      {/* ── Tab: Symbolic ── */}
      {tab === 'symbolic' && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontFamily: 'var(--mono)', marginBottom: 8 }}>
            {tr({ zh: '保留形式变量 x_i：', en: 'Keep formal variables x_i:',
                zhHant: "保留形式變數 x_i："
            })}
          </div>
          <div style={{ padding: '12px 16px', background: 'var(--bg-elev)', borderRadius: 8, overflowX: 'auto' }}>
            <TeXBlock src={
              `Z(G) = \\frac{1}{${data.order}}\\Bigl(` +
              data.classes.map(cls => `${cls.size}\\cdot ${monomialTeX(cls.exponents)}`).join(' + ') +
              `\\Bigr)`
            } />
          </div>
          {/* Class table */}
          <div style={{ overflowX: 'auto', marginTop: 14 }}>
            <table className="gt-compare">
              <thead>
                <tr>
                  <th><L zh="共轭类" en="Class" /></th>
                  <th><L zh="大小" en="Size" /></th>
                  <th><L zh="单项式" en="Monomial" /></th>
                  <th><L zh="贡献" en="Contribution" /></th>
                </tr>
              </thead>
              <tbody>
                {data.classes.map((cls, ci) => (
                  <tr key={ci}>
                    <td style={{ fontSize: 12, color: 'var(--ink-dim)' }}>
                      {(i18n.language === 'zh-Hant' ? (cls.label.zhHant ?? cls.label.zh) : (i18n.language.startsWith('zh') ? cls.label.zh : cls.label.en))}
                    </td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--mono)' }}>{cls.size}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                      {monomialPlain(cls.exponents)}
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: PALETTE[ci % PALETTE.length] }}>
                      {cls.size}/{data.order} · {monomialPlain(cls.exponents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ink-faint)' }}>
            <L
              zh={<>每个单项式满足：所有 <TeX src={String.raw`x_i`} /> 的指数 × 下标之和 = n = {effectiveN}（必要性自检）。</>}
              en={<>Each monomial satisfies: Σ (exponent × subscript) = n = {effectiveN} — a built-in correctness check.</>}
            />
          </div>
        </div>
      )}

      {/* ── Tab: Plain count ── */}
      {tab === 'plain' && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontFamily: 'var(--mono)', marginBottom: 8 }}>
            {lang === 'zh'
              ? `代入 x_i ↦ ${k}（所有 i），还原 Burnside 引理：`
              : `Substitute x_i ↦ ${k} (all i): recovers Burnside's lemma:`}
          </div>
          {/* SVG: chip sum visualization */}
          <div style={{ overflowX: 'auto' }}>
            <svg viewBox={`0 0 380 ${data.classes.length * 28 + 60}`} width="100%" style={{ display: 'block', minWidth: 280, maxWidth: 380 }}>
              {data.classes.map((cls, ci) => {
                const y = ci * 28 + 8;
                const kc = cls.exponents.reduce((s, e) => s + e, 0);
                const contrib = cls.size * Math.pow(k, kc);
                const col = PALETTE[ci % PALETTE.length];
                const barMax = data.order * orbitCount;
                const barW = barMax > 0 ? Math.round((contrib / (barMax + 1)) * 180) : 0;
                return (
                  <g key={ci}>
                    <text x={4} y={y + 16} style={{ fontSize: 9, fontFamily: 'var(--mono)' }} fill="var(--ink-faint)">
                      {cls.size}×{k}^{kc}
                    </text>
                    <rect x={90} y={y + 5} width={barW} height={16} rx={3} fill={col} fillOpacity={0.7} />
                    <text x={90 + barW + 4} y={y + 16} style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700 }} fill={col}>
                      {contrib}
                    </text>
                  </g>
                );
              })}
              {/* Sum line */}
              <line x1={88} y1={data.classes.length * 28 + 12} x2={380} y2={data.classes.length * 28 + 12}
                stroke="var(--rule)" strokeWidth={1} />
              <text x={4} y={data.classes.length * 28 + 28} style={{ fontSize: 10, fontFamily: 'var(--mono)' }} fill="var(--ink)">
                {lang === 'zh' ? `总和 ${data.classes.reduce((s,c)=>s+c.size*Math.pow(k,c.exponents.reduce((a,b)=>a+b,0)),0)} ÷ ${data.order} =` : `Sum ${data.classes.reduce((s,c)=>s+c.size*Math.pow(k,c.exponents.reduce((a,b)=>a+b,0)),0)} ÷ ${data.order} =`}
              </text>
              <text x={220} y={data.classes.length * 28 + 28} style={{ fontSize: 16, fontFamily: 'var(--mono)', fontWeight: 700 }} fill="var(--green)">
                {orbitCount}
              </text>
              <text x={4} y={data.classes.length * 28 + 46} style={{ fontSize: 9, fontFamily: 'var(--mono)' }} fill="var(--ink-faint)">
                {lang === 'zh' ? `每个 x_i → ${k}；k^{c(g)} 对各共轭类` : `Each x_i → ${k}; k^{c(g)} per class`}
              </text>
            </svg>
          </div>
          <div className="gt-panel-result" style={{ marginTop: 8 }}>
            <div className="gt-result-row">
              <span className="gt-result-label">
                <L zh="不等价着色数" en="Distinct colourings" />
              </span>
              <span className="gt-result-val-strong" style={{ color: 'var(--green)', fontSize: 20 }}>{orbitCount}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: B/W generating function ── */}
      {tab === 'bicolour' && inventory && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontFamily: 'var(--mono)', marginBottom: 8 }}>
            {tr({ zh: `代入 x_i ↦ 1 + t^i（黑色权 t，白色权 1）：`, en: `Substitute x_i ↦ 1 + t^i (weight t for black, 1 for white):`,
                zhHant: "代入 x_i ↦ 1 + t^i（黑色權 t，白色權 1）："
            })}
          </div>
          <div style={{ padding: '12px 16px', background: 'var(--bg-elev)', borderRadius: 8, overflowX: 'auto', marginBottom: 12 }}>
            <TeXBlock src={
              `P_G(t) = ` +
              inventory
                .map((v, j) => v !== 0 ? (j === 0 ? `${v}` : `${v}t^{${j}}`) : null)
                .filter(Boolean)
                .join(' + ')
            } />
          </div>

          {/* Bar chart of inventory */}
          <svg viewBox={`0 0 ${(effectiveN + 1) * 44 + 20} 90`} width="100%" style={{ display: 'block', overflowX: 'auto', maxWidth: (effectiveN + 1) * 44 + 20 }}>
            {inventory.map((cnt, j) => {
              const x = 10 + j * 44;
              const maxCnt = Math.max(...inventory);
              const barH = maxCnt > 0 ? Math.round((cnt / maxCnt) * 55) : 0;
              return (
                <g key={j}>
                  <rect x={x} y={60 - barH} width={36} height={barH} rx={3}
                    fill={PALETTE[j % PALETTE.length]} fillOpacity={0.75} />
                  <text x={x + 18} y={57 - barH} textAnchor="middle"
                    style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700 }}
                    fill={PALETTE[j % PALETTE.length]}>
                    {cnt > 0 ? cnt : ''}
                  </text>
                  <text x={x + 18} y={74} textAnchor="middle"
                    style={{ fontSize: 10, fontFamily: 'var(--mono)' }} fill="var(--ink-dim)">
                    {j}
                  </text>
                  <text x={x + 18} y={86} textAnchor="middle"
                    style={{ fontSize: 8, fontFamily: 'var(--mono)' }} fill="var(--ink-faint)">
                    t^{j}
                  </text>
                </g>
              );
            })}
          </svg>

          <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 6 }}>
            <L
              zh={<>横轴 = 黑色点数，纵轴 = 该颜色内容的轨道数。总计 = {inventoryTotal} （应等于 Z(G)(2,…,2) = {inventoryCheck} {inventoryTotal === inventoryCheck ? '✓' : '✗'}）。</>}
              en={<>x-axis = number of black points, y-axis = orbit count for that colour content. Total = {inventoryTotal} (should equal Z(G)(2,…,2) = {inventoryCheck} {inventoryTotal === inventoryCheck ? '✓' : '✗'}).</>}
            />
          </div>

          {groupType === 'cube' && (
            <div className="gt-aside" style={{ marginTop: 12, fontSize: 13 }}>
              <L
                zh={<>
                  正方体面双色（k=2）模式清单应为 <TeX src={String.raw`1+t+2t^2+2t^3+2t^4+t^5+t^6`} />，总计 10。
                  代入 <TeX src={String.raw`x_i\mapsto 1+t^i`} /> 展开后系数即各黑面数的轨道计数，可用代码验证。
                </>}
                en={<>
                  For the cube with 2 colours the pattern inventory is <TeX src={String.raw`1+t+2t^2+2t^3+2t^4+t^5+t^6`} />, total 10.
                  Substituting <TeX src={String.raw`x_i\mapsto 1+t^i`} /> and expanding yields these coefficients, verifiable in code.
                </>}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
