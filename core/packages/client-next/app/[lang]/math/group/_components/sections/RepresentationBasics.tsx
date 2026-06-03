'use client';

import { useState, useMemo } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import type { Lang } from '../primitives';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ComplexNum { re: number; im: number }

function cMul(a: ComplexNum, b: ComplexNum): ComplexNum {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}
function cConj(a: ComplexNum): ComplexNum {
  return { re: a.re, im: -a.im };
}
function cAdd(a: ComplexNum, b: ComplexNum): ComplexNum {
  return { re: a.re + b.re, im: a.im + b.im };
}

// ── Hardcoded verified character tables ───────────────────────────────────────

// omega = e^{2πi/3}
const OMEGA: ComplexNum = { re: -0.5, im: Math.sqrt(3) / 2 };
const OMEGA2: ComplexNum = { re: -0.5, im: -Math.sqrt(3) / 2 };
const C1: ComplexNum = { re: 1, im: 0 };
const CN1: ComplexNum = { re: -1, im: 0 };
const C2: ComplexNum = { re: 2, im: 0 };
const CN1Half: ComplexNum = { re: -1, im: 0 };
const C3: ComplexNum = { re: 3, im: 0 };
const C0: ComplexNum = { re: 0, im: 0 };

type IrrepRow = {
  nameZh: string;
  nameEn: string;
  dim: number;
  values: ComplexNum[]; // one per conjugacy class
};

type CharTableData = {
  groupOrder: number;
  classes: { nameZh: string; nameEn: string; size: number }[];
  irreps: IrrepRow[];
  psiFixed: number[]; // fixed points per class
};

const S3_DATA: CharTableData = {
  groupOrder: 6,
  classes: [
    { nameZh: 'e', nameEn: 'e', size: 1 },
    { nameZh: '(12)', nameEn: '(12)', size: 3 },
    { nameZh: '(123)', nameEn: '(123)', size: 2 },
  ],
  irreps: [
    { nameZh: '平凡', nameEn: 'trivial', dim: 1, values: [C1, C1, C1] },
    { nameZh: '符号', nameEn: 'sign', dim: 1, values: [C1, CN1, C1] },
    { nameZh: '标准(2维)', nameEn: 'standard(2-dim)', dim: 2, values: [C2, C0, CN1Half] },
  ],
  psiFixed: [3, 1, 0],
};

const S4_DATA: CharTableData = {
  groupOrder: 24,
  classes: [
    { nameZh: 'e', nameEn: 'e', size: 1 },
    { nameZh: '(12)', nameEn: '(12)', size: 6 },
    { nameZh: '(12)(34)', nameEn: '(12)(34)', size: 3 },
    { nameZh: '(123)', nameEn: '(123)', size: 8 },
    { nameZh: '(1234)', nameEn: '(1234)', size: 6 },
  ],
  irreps: [
    { nameZh: '平凡', nameEn: 'trivial', dim: 1, values: [C1, C1, C1, C1, C1] },
    { nameZh: '符号', nameEn: 'sign', dim: 1, values: [C1, CN1, C1, C1, CN1] },
    { nameZh: '标准V(3维)', nameEn: 'standard V(3-dim)', dim: 3, values: [C3, C1, CN1, C0, CN1] },
    { nameZh: '标准⊗符号(3维)', nameEn: 'standard⊗sign(3-dim)', dim: 3, values: [C3, CN1, CN1, C0, C1] },
    { nameZh: '2维', nameEn: '2-dim', dim: 2, values: [C2, C0, C2, CN1, C0] },
  ],
  psiFixed: [4, 2, 0, 1, 0],
};

const A4_DATA: CharTableData = {
  groupOrder: 12,
  classes: [
    { nameZh: 'e', nameEn: 'e', size: 1 },
    { nameZh: '(12)(34)', nameEn: '(12)(34)', size: 3 },
    { nameZh: '(123)', nameEn: '(123)', size: 4 },
    { nameZh: '(132)', nameEn: '(132)', size: 4 },
  ],
  irreps: [
    { nameZh: '平凡', nameEn: 'trivial', dim: 1, values: [C1, C1, C1, C1] },
    { nameZh: 'χ_ω', nameEn: 'χ_ω', dim: 1, values: [C1, C1, OMEGA, OMEGA2] },
    { nameZh: 'χ_ω²', nameEn: 'χ_ω²', dim: 1, values: [C1, C1, OMEGA2, OMEGA] },
    { nameZh: '标准(3维)', nameEn: 'standard(3-dim)', dim: 3, values: [C3, CN1, C0, C0] },
  ],
  psiFixed: [4, 0, 1, 1],
};

const GROUP_OPTIONS = [
  { key: 'S3', label: 'S₃ on 3 points', labelZh: 'S₃ 作用于 3 点', data: S3_DATA },
  { key: 'S4', label: 'S₄ on 4 points', labelZh: 'S₄ 作用于 4 点', data: S4_DATA },
  { key: 'A4', label: 'A₄ on 4 points', labelZh: 'A₄ 作用于 4 点', data: A4_DATA },
] as const;

type GroupKey = (typeof GROUP_OPTIONS)[number]['key'];

// Square-area dimension diagram data (Widget 4)
const DIM_GROUPS = [
  { key: 'S3', label: 'S₃', order: 6, dims: [1, 1, 2] },
  { key: 'S4', label: 'S₄', order: 24, dims: [1, 1, 2, 3, 3] },
  { key: 'A4', label: 'A₄', order: 12, dims: [1, 1, 1, 3] },
  { key: 'S5', label: 'S₅', order: 120, dims: [1, 1, 4, 4, 5, 5, 6] },
] as const;

type DimGroupKey = (typeof DIM_GROUPS)[number]['key'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtComplex(c: ComplexNum, _lang: Lang): string {
  const eps = 1e-9;
  if (Math.abs(c.re) < eps && Math.abs(c.im) < eps) return '0';
  if (Math.abs(c.im) < eps) return String(Math.round(c.re));
  const reStr = Math.abs(c.re) < eps ? '' : String(Math.round(c.re * 2) / 2);
  // Detect omega patterns
  if (Math.abs(c.re - OMEGA.re) < eps && Math.abs(c.im - OMEGA.im) < eps) return 'ω';
  if (Math.abs(c.re - OMEGA2.re) < eps && Math.abs(c.im - OMEGA2.im) < eps) return 'ω²';
  if (Math.abs(c.re - (-OMEGA.re)) < eps && Math.abs(c.im - (-OMEGA.im)) < eps) return '-ω';
  if (Math.abs(c.re - (-OMEGA2.re)) < eps && Math.abs(c.im - (-OMEGA2.im)) < eps) return '-ω²';
  const iStr = c.im > 0 ? (reStr ? `+${c.im.toFixed(2)}i` : `${c.im.toFixed(2)}i`) : `${c.im.toFixed(2)}i`;
  return reStr + iStr;
}

function computeMultiplicities(data: CharTableData): number[] {
  const { groupOrder, classes, irreps, psiFixed } = data;
  return irreps.map(irrep => {
    let sum: ComplexNum = C0;
    for (let c = 0; c < classes.length; c++) {
      const chiConj = cConj(irrep.values[c]);
      const term = cMul({ re: classes[c].size * psiFixed[c], im: 0 }, chiConj);
      sum = cAdd(sum, term);
    }
    const m = sum.re / groupOrder;
    return Math.round(m);
  });
}

// Project R^3 vector v onto trivial + standard components
function decompose3(v: [number, number, number]): {
  trivial: [number, number, number];
  standard: [number, number, number];
} {
  const mean = (v[0] + v[1] + v[2]) / 3;
  return {
    trivial: [mean, mean, mean],
    standard: [v[0] - mean, v[1] - mean, v[2] - mean],
  };
}

// Apply permutation to R^3 vector: new[i] = v[pi^{-1}(i)]
// Permutations of {0,1,2}: S3 generators
const S3_GENERATORS: Array<{ nameZh: string; nameEn: string; perm: [number, number, number] }> = [
  { nameZh: '恒等 e', nameEn: 'identity e', perm: [0, 1, 2] },
  { nameZh: '对换 (12)', nameEn: 'transposition (12)', perm: [1, 0, 2] },
  { nameZh: '轮换 (123)', nameEn: '3-cycle (123)', perm: [2, 0, 1] },
  { nameZh: '轮换 (132)', nameEn: '3-cycle (132)', perm: [1, 2, 0] },
  { nameZh: '对换 (13)', nameEn: 'transposition (13)', perm: [2, 1, 0] },
  { nameZh: '对换 (23)', nameEn: 'transposition (23)', perm: [0, 2, 1] },
];

function applyPerm(v: [number, number, number], perm: [number, number, number]): [number, number, number] {
  // new[i] = v[perm^{-1}(i)]: the basis vector e_{perm[j]} gets sent to e_j
  // So result[j] = v[invPerm[j]] where invPerm[perm[j]] = j
  const inv: [number, number, number] = [0, 0, 0];
  for (let j = 0; j < 3; j++) inv[perm[j]] = j;
  return [v[inv[0]], v[inv[1]], v[inv[2]]];
}

// 2D isometric projection of R^3 -> screen coords
function project([x, y, z]: [number, number, number]): [number, number] {
  // Isometric: project onto (e1-e2)/sqrt(2) and (e1+e2-2e3)/sqrt(6)
  const px = (x - y) / Math.SQRT2;
  const py = (x + y - 2 * z) / Math.sqrt(6);
  return [px, py];
}

// Maschke averaging: accumulate rho(g) * P0 * rho(g)^{-1} for S3 in R^2
// We use S3 acting on the standard 2D rep: characters (2,0,-1)
// Choose rho: S3 -> GL(R^2), the irreducible standard rep via the explicit 2x2 matrices
// S3 = {e, (12), (23), (13), (123), (132)} in 2D standard rep matrices

type Mat2x2 = [number, number, number, number]; // [a,b,c,d] = [[a,b],[c,d]]

function mat2Mul(A: Mat2x2, B: Mat2x2): Mat2x2 {
  return [
    A[0] * B[0] + A[1] * B[2], A[0] * B[1] + A[1] * B[3],
    A[2] * B[0] + A[3] * B[2], A[2] * B[1] + A[3] * B[3],
  ];
}

function mat2Add(A: Mat2x2, B: Mat2x2): Mat2x2 {
  return [A[0] + B[0], A[1] + B[1], A[2] + B[2], A[3] + B[3]];
}

function mat2Scale(A: Mat2x2, s: number): Mat2x2 {
  return [A[0] * s, A[1] * s, A[2] * s, A[3] * s];
}

function mat2Inv(A: Mat2x2): Mat2x2 {
  const det = A[0] * A[3] - A[1] * A[2];
  return [A[3] / det, -A[1] / det, -A[2] / det, A[0] / det];
}

// Standard rep of S3: 2x2 matrices
// These are the "standard" 2D irrep matrices for S3 acting on sum-zero plane
// rho(e)=I, rho((12))=[[0,1],[1,0]]... actually we use the permutation matrices restricted to sum-zero plane
// Basis: u1 = (1,-1,0)/sqrt(2), u2 = (1,1,-2)/sqrt(6)  (orthonormal basis of {x+y+z=0})
// rho(pi) on this basis: the 2x2 matrix of pi restricted to the plane in coordinates (u1,u2)
// Precomputed (exact fractions):
// e: [[1,0],[0,1]]
// (12): [[-1,0],[0,1]] since u1 -> -u1, u2 -> u2
// (23): [[1/2, sqrt(3)/2],[sqrt(3)/2, -1/2]]  -- wait let me be careful
// Actually rho((12)) swaps coords 1 and 2:
//   u1 = (1,-1,0)/sqrt(2): (12)(u1) = (-1,1,0)/sqrt(2) = -u1 => [[-1,0],[0,1]] row1
//   u2 = (1,1,-2)/sqrt(6): (12)(u2) = (1,1,-2)/sqrt(6) = u2 => [[-1,0],[0,1]] row2
//   So (12) -> [[-1,0],[0,1]]
// (123) permutes 1->2->3->1, i.e., (x,y,z) -> (z,x,y):
//   (123)(u1) = (123)(1,-1,0)/sqrt(2) = (0,1,-1)/sqrt(2) = -1/2 u1 - sqrt(3)/2 u2
//   (123)(u2) = (123)(1,1,-2)/sqrt(6) = (-2,1,1)/sqrt(6) = sqrt(3)/2 u1 - 1/2 u2
//   So (123) -> [[-1/2, sqrt(3)/2],[-sqrt(3)/2, -1/2]]
const sq3h = Math.sqrt(3) / 2;
// All 6 group elements are derived by composition at runtime to avoid hardcoding errors.
function getS3Mats(): Mat2x2[] {
  const e: Mat2x2 = [1, 0, 0, 1];
  const t12: Mat2x2 = [-1, 0, 0, 1];
  const c123: Mat2x2 = [-0.5, sq3h, -sq3h, -0.5];
  const c132 = mat2Mul(c123, c123); // (123)^2 = (132)
  const t13 = mat2Mul(c123, t12);   // (123)(12) = (13)
  const t23 = mat2Mul(t12, c123);   // (12)(123) = (23)
  return [e, t12, c123, c132, t13, t23];
}

// Starting non-invariant projection P0 (a rank-1 oblique projection)
// P0 = [[1, 0.4], [0, 0]] — projects onto x-axis obliquely
const P0: Mat2x2 = [1, 0.4, 0, 0];

// ── §53 RepresentationBasics ──────────────────────────────────────────────────

export default function RepresentationBasics() {
  const lang = useLang();
  return (
    <GTSec id="representation-basics" className="gt-sec">
      <div className="gt-sec-num">§53</div>
      <h2 className="gt-sec-title">
        <L zh="表示与不可约分解" en="Representations & irreducible decomposition" />
      </h2>

      <p className="gt-lede">
        <L
          zh={<>
            群论最强大的工具之一：让群通过线性变换作用于向量空间。一个<strong>表示</strong>把每个群元素映射为一个可逆线性变换，把代数结构"编码"进矩阵乘法。
            Maschke 定理保证，在特征为零的域上，有限群的每个表示都能唯一地（在同构意义下）分解为不可约表示的直和——就像整数有唯一素因子分解一样。
            魔方群的角置换和棱置换各自是 <TeX src={String.raw`S_8`} /> 和 <TeX src={String.raw`S_{12}`} /> 的子群，正是这里研究的对象。
          </>}
          en={<>
            One of the most powerful tools in group theory: letting a group act on a vector space by linear transformations. A <strong>representation</strong> maps each group element to an invertible linear transformation, encoding the algebraic structure into matrix multiplication.
            Maschke&apos;s theorem guarantees that over a field of characteristic zero every representation of a finite group decomposes uniquely (up to isomorphism) as a direct sum of irreducible pieces — just as integers have unique prime factorizations.
            The corner and edge permutations of the Rubik&apos;s cube are subgroups of <TeX src={String.raw`S_8`} /> and <TeX src={String.raw`S_{12}`} />, exactly the groups studied here.
          </>}
        />
      </p>

      {/* ── Definition: Representation ── */}
      <div className="gt-def">
        <div className="gt-def-title">
          <L zh="定义: 线性表示" en="Definition: Linear representation" />
        </div>
        <div className="gt-def-body">
          <L
            zh={<>
              设 <TeX src={String.raw`G`} /> 是群，<TeX src={String.raw`V`} /> 是域 <TeX src={String.raw`F`} /> 上的有限维向量空间。<strong>表示</strong>是群同态 <TeX src={String.raw`\rho\colon G\to GL(V)`} />，即满足
              <TeX src={String.raw`\rho(gh)=\rho(g)\rho(h)`} />（因此 <TeX src={String.raw`\rho(e)=\mathrm{id}`} />，<TeX src={String.raw`\rho(g^{-1})=\rho(g)^{-1}`} />）。
              <TeX src={String.raw`V`} /> 的维数称为表示的<strong>维数</strong>。等价地，<TeX src={String.raw`V`} /> 是 <TeX src={String.raw`F[G]`} />-模。本节取 <TeX src={String.raw`F=\mathbb{C}`} />。
              <br /><br />
              子空间 <TeX src={String.raw`W\subseteq V`} /> 称为 <strong><TeX src={String.raw`G`} />-不变的</strong>（子表示），若对所有 <TeX src={String.raw`g\in G`} /> 都有 <TeX src={String.raw`\rho(g)W\subseteq W`} />。
              若 <TeX src={String.raw`V`} /> 除 <TeX src={String.raw`0`} /> 和 <TeX src={String.raw`V`} /> 本身外无 <TeX src={String.raw`G`} />-不变子空间，则称为<strong>不可约表示</strong>（irrep）。
            </>}
            en={<>
              Let <TeX src={String.raw`G`} /> be a group and <TeX src={String.raw`V`} /> a finite-dimensional vector space over a field <TeX src={String.raw`F`} />. A <strong>representation</strong> is a group homomorphism <TeX src={String.raw`\rho\colon G\to GL(V)`} />, i.e.
              <TeX src={String.raw`\rho(gh)=\rho(g)\rho(h)`} /> (so <TeX src={String.raw`\rho(e)=\mathrm{id}`} />, <TeX src={String.raw`\rho(g^{-1})=\rho(g)^{-1}`} />).
              The <strong>dimension</strong> of the representation is <TeX src={String.raw`\dim_F V`} />. Equivalently, <TeX src={String.raw`V`} /> is an <TeX src={String.raw`F[G]`} />-module. Throughout we take <TeX src={String.raw`F=\mathbb{C}`} />.
              <br /><br />
              A subspace <TeX src={String.raw`W\subseteq V`} /> is <strong><TeX src={String.raw`G`} />-invariant</strong> (a subrepresentation) if <TeX src={String.raw`\rho(g)W\subseteq W`} /> for every <TeX src={String.raw`g\in G`} />. A representation is <strong>irreducible</strong> (an irrep) if it has no <TeX src={String.raw`G`} />-invariant subspace other than <TeX src={String.raw`0`} /> and <TeX src={String.raw`V`} />.
            </>}
          />
        </div>
      </div>

      {/* ── Theorem: Maschke ── */}
      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理 (Maschke): 完全可约性" en="Theorem (Maschke): Complete reducibility" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>
              设 <TeX src={String.raw`G`} /> 是有限群，<TeX src={String.raw`F`} /> 是特征不整除 <TeX src={String.raw`|G|`} /> 的域（特别地，<TeX src={String.raw`\mathbb{C}`} /> 对所有有限群成立）。
              则 <TeX src={String.raw`G`} /> 在 <TeX src={String.raw`F`} /> 上的每个有限维表示都是不可约子表示的直和：
            </>}
            en={<>
              Let <TeX src={String.raw`G`} /> be a finite group and <TeX src={String.raw`F`} /> a field whose characteristic does not divide <TeX src={String.raw`|G|`} /> (in particular <TeX src={String.raw`\mathbb{C}`} /> always works for finite <TeX src={String.raw`G`} />).
              Then every finite-dimensional representation of <TeX src={String.raw`G`} /> over <TeX src={String.raw`F`} /> is completely reducible:
            </>}
          />
          <TeXBlock src={String.raw`V \;\cong\; V_1^{\oplus m_1} \oplus V_2^{\oplus m_2} \oplus \cdots \oplus V_k^{\oplus m_k}`} />
          <L
            zh={<>
              其中 <TeX src={String.raw`V_i`} /> 两两不同构的不可约表示，<TeX src={String.raw`m_i\geq0`} /> 是重数。不可约分量的同构类和重数唯一确定（但对应子空间的选取不唯一）。
              <strong>特征数条件不可缺</strong>：<TeX src={String.raw`\mathbb{Z}/p`} /> 在 <TeX src={String.raw`\mathbb{F}_p`} /> 上的自然 2 维表示不可分裂。
            </>}
            en={<>
              where the <TeX src={String.raw`V_i`} /> are pairwise non-isomorphic irreducibles and <TeX src={String.raw`m_i\geq0`} /> are multiplicities. The isomorphism class and multiplicity of each irreducible summand are <em>unique</em> (the actual subspaces are not). <strong>The characteristic hypothesis is essential</strong>: the natural 2-dimensional representation of <TeX src={String.raw`\mathbb{Z}/p`} /> over <TeX src={String.raw`\mathbb{F}_p`} /> does not split.
            </>}
          />
        </div>
      </div>

      {/* ── Proof sketch box ── */}
      <div className="gt-proof">
        <div className="gt-proof-title">
          <L zh="证明思路 (Maschke)" en="Proof sketch (Maschke)" />
        </div>
        <p style={{ margin: '8px 0', fontSize: 14 }}>
          <L
            zh={<>
              任取 <TeX src={String.raw`G`} />-不变子空间 <TeX src={String.raw`W\subseteq V`} />，选任意 <TeX src={String.raw`V`} /> 上的内积 <TeX src={String.raw`\langle\cdot,\cdot\rangle_0`} />（或任意余补子空间 <TeX src={String.raw`W'`} />）。
              对 <TeX src={String.raw`G`} /> 取平均：
              <TeX src={String.raw`\langle u,v\rangle = \tfrac{1}{|G|}\sum_{g\in G}\langle\rho(g)u,\rho(g)v\rangle_0`} />。
              该平均内积是 <TeX src={String.raw`G`} />-不变的，其正交补 <TeX src={String.raw`W^\perp`} /> 也是 <TeX src={String.raw`G`} />-不变的，给出 <TeX src={String.raw`V=W\oplus W^\perp`} />。
              关键：除以 <TeX src={String.raw`|G|`} /> 要求 <TeX src={String.raw`\mathrm{char}(F)\nmid|G|`} />。
            </>}
            en={<>
              Given a <TeX src={String.raw`G`} />-invariant subspace <TeX src={String.raw`W\subseteq V`} />, choose any inner product <TeX src={String.raw`\langle\cdot,\cdot\rangle_0`} /> on <TeX src={String.raw`V`} />. Average it over <TeX src={String.raw`G`} />:
              <TeX src={String.raw`\langle u,v\rangle = \tfrac{1}{|G|}\sum_{g\in G}\langle\rho(g)u,\rho(g)v\rangle_0`} />.
              The averaged inner product is <TeX src={String.raw`G`} />-invariant, and its orthogonal complement <TeX src={String.raw`W^\perp`} /> is also <TeX src={String.raw`G`} />-invariant, giving <TeX src={String.raw`V=W\oplus W^\perp`} />.
              The crucial step is dividing by <TeX src={String.raw`|G|`} />, which requires <TeX src={String.raw`\mathrm{char}(F)\nmid|G|`} />.
            </>}
          />
        </p>
        <div className="gt-proof-end">□</div>
      </div>

      {/* ── Characters and orthogonality ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="特征标与正交性" en="Characters and orthogonality" />
      </h3>

      <p>
        <L
          zh={<>
            表示 <TeX src={String.raw`\rho`} /> 的<strong>特征标</strong>是类函数 <TeX src={String.raw`\chi_\rho\colon G\to\mathbb{C}`} />，<TeX src={String.raw`\chi_\rho(g)=\mathrm{tr}(\rho(g))`} />。
            它满足 <TeX src={String.raw`\chi_\rho(e)=\dim V`} />，<TeX src={String.raw`\chi_\rho(hgh^{-1})=\chi_\rho(g)`} />，且 <TeX src={String.raw`\chi_\rho(g^{-1})=\overline{\chi_\rho(g)}`} />（酉表示下）。
            不同不可约表示的特征标在内积 <TeX src={String.raw`\langle\alpha,\beta\rangle=\tfrac{1}{|G|}\sum_g\alpha(g)\overline{\beta(g)}`} /> 下构成<strong>标准正交基</strong>（第一正交性关系），不可约表示的个数等于共轭类个数。
          </>}
          en={<>
            The <strong>character</strong> of <TeX src={String.raw`\rho`} /> is the class function <TeX src={String.raw`\chi_\rho\colon G\to\mathbb{C}`} />, <TeX src={String.raw`\chi_\rho(g)=\mathrm{tr}(\rho(g))`} />.
            It satisfies <TeX src={String.raw`\chi_\rho(e)=\dim V`} />, <TeX src={String.raw`\chi_\rho(hgh^{-1})=\chi_\rho(g)`} />, and <TeX src={String.raw`\chi_\rho(g^{-1})=\overline{\chi_\rho(g)}`} /> (unitary form).
            The characters of distinct irreducibles form an <strong>orthonormal basis</strong> for class functions under <TeX src={String.raw`\langle\alpha,\beta\rangle=\tfrac{1}{|G|}\sum_g\alpha(g)\overline{\beta(g)}`} /> (first orthogonality relation); the number of irreducibles equals the number of conjugacy classes.
          </>}
        />
      </p>

      {/* ── Multiplicity formula ── */}
      <div className="gt-def">
        <div className="gt-def-title">
          <L zh="重数公式与置换表示" en="Multiplicity formula and permutation representation" />
        </div>
        <div className="gt-def-body">
          <L
            zh={<>
              设表示 <TeX src={String.raw`\psi`} /> 分解为不可约：<TeX src={String.raw`\psi=\sum_i m_i\chi_i`} />。则<strong>重数公式</strong>：
            </>}
            en={<>
              If a representation with character <TeX src={String.raw`\psi`} /> decomposes as <TeX src={String.raw`\psi=\sum_i m_i\chi_i`} />, then the <strong>multiplicity formula</strong> is:
            </>}
          />
          <TeXBlock src={String.raw`m_i = \langle \psi,\chi_i\rangle = \frac{1}{|G|}\sum_{g\in G}\psi(g)\,\overline{\chi_i(g)} = \frac{1}{|G|}\sum_{\text{class }C}|C|\,\psi_C\,\overline{\chi_i(g_C)}.`} />
          <L
            zh={<>
              <strong>置换表示</strong>：设 <TeX src={String.raw`G`} /> 作用于有限集 <TeX src={String.raw`X`} />，置换表示 <TeX src={String.raw`\rho\colon G\to GL(\mathbb{C}^X)`} /> 将 <TeX src={String.raw`g`} /> 映为置换矩阵 <TeX src={String.raw`e_{x}\mapsto e_{g\cdot x}`} />。
              其特征标 <TeX src={String.raw`\psi(g)=\#\{x\in X:g\cdot x=x\}`} /> 就是 <TeX src={String.raw`g`} /> 的不动点数——矩阵迹只计对角线上的 1。
              <TeX src={String.raw`S_n`} /> 作用于 <TeX src={String.raw`n`} /> 点（<TeX src={String.raw`n\geq2`} />）的置换表示分解为：
            </>}
            en={<>
              <strong>Permutation representation</strong>: given an action of <TeX src={String.raw`G`} /> on a finite set <TeX src={String.raw`X`} />, the permutation representation <TeX src={String.raw`\rho\colon G\to GL(\mathbb{C}^X)`} /> sends <TeX src={String.raw`g`} /> to the permutation matrix <TeX src={String.raw`e_x\mapsto e_{g\cdot x}`} />.
              Its character is <TeX src={String.raw`\psi(g)=\#\{x\in X:g\cdot x=x\}`} />, the number of fixed points of <TeX src={String.raw`g`} /> — only the diagonal entries of the permutation matrix contribute to the trace.
              The permutation representation of <TeX src={String.raw`S_n`} /> on <TeX src={String.raw`n`} /> points (<TeX src={String.raw`n\geq2`} />) decomposes as:
            </>}
          />
          <TeXBlock src={String.raw`\mathbb{C}^n \;=\; \underbrace{\mathbb{C}(1,\ldots,1)}_{\text{trivial, dim }1} \;\oplus\; \underbrace{\{(z_1,\ldots,z_n):\textstyle\sum z_i=0\}}_{\text{standard rep, dim }n-1}.`} />
          <L
            zh={<>
              标准表示（<TeX src={String.raw`\dim=n-1`} />，<TeX src={String.raw`n\geq2`} /> 时不可约）是 <TeX src={String.raw`\mathbb{C}(1,\ldots,1)`} /> 的正交补，即所有坐标和为零的超平面。
              <strong>注意</strong>：平凡表示是 1 维对角线，<TeX src={String.raw`\mathbb{C}^n`} /> 本身<em>不是</em>标准表示。
            </>}
            en={<>
              The standard representation (<TeX src={String.raw`\dim=n-1`} />, irreducible for <TeX src={String.raw`n\geq2`} />) is the orthogonal complement of <TeX src={String.raw`\mathbb{C}(1,\ldots,1)`} />, namely the hyperplane of vectors with coordinate sum zero.
              <strong>Note</strong>: the trivial line is 1-dimensional; <TeX src={String.raw`\mathbb{C}^n`} /> itself is <em>not</em> the standard representation.
            </>}
          />
        </div>
      </div>

      {/* ── Theorem: regular representation ── */}
      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理: 正则表示与维数公式" en="Theorem: Regular representation and dimension formula" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>
              <strong>正则表示</strong> <TeX src={String.raw`\mathbb{C}[G]`} />（<TeX src={String.raw`G`} /> 左乘作用于自身）的特征标为 <TeX src={String.raw`\chi_{\mathrm{reg}}(e)=|G|`} />，<TeX src={String.raw`\chi_{\mathrm{reg}}(g)=0`} />（<TeX src={String.raw`g\neq e`} />）。
              它在分解中每个不可约 <TeX src={String.raw`\chi_i`} /> 恰好出现 <TeX src={String.raw`\dim(V_i)`} /> 次，从而：
            </>}
            en={<>
              The <strong>regular representation</strong> <TeX src={String.raw`\mathbb{C}[G]`} /> (left multiplication of <TeX src={String.raw`G`} /> on itself) has character <TeX src={String.raw`\chi_{\mathrm{reg}}(e)=|G|`} />, <TeX src={String.raw`\chi_{\mathrm{reg}}(g)=0`} /> for <TeX src={String.raw`g\neq e`} />.
              It contains each irreducible <TeX src={String.raw`\chi_i`} /> exactly <TeX src={String.raw`\dim(V_i)`} /> times, giving:
            </>}
          />
          <TeXBlock src={String.raw`\mathbb{C}[G] \;\cong\; \bigoplus_i V_i^{\oplus\dim V_i}, \qquad \sum_i (\dim V_i)^2 = |G|.`} />
          <L
            zh={<>
              验证：<TeX src={String.raw`m_i=\tfrac{1}{|G|}\sum_g\chi_{\mathrm{reg}}(g)\overline{\chi_i(g)}=\tfrac{1}{|G|}\cdot|G|\cdot\overline{\chi_i(e)}=\dim V_i`} />。
              对 <TeX src={String.raw`S_3`} />：<TeX src={String.raw`1^2+1^2+2^2=6=|S_3|`} />；对 <TeX src={String.raw`S_4`} />：<TeX src={String.raw`1+1+4+9+9=24`} />；对 <TeX src={String.raw`A_4`} />：<TeX src={String.raw`1+1+1+9=12`} />。
            </>}
            en={<>
              Proof: <TeX src={String.raw`m_i=\tfrac{1}{|G|}\sum_g\chi_{\mathrm{reg}}(g)\overline{\chi_i(g)}=\tfrac{1}{|G|}\cdot|G|\cdot\overline{\chi_i(e)}=\dim V_i`} />.
              Check: <TeX src={String.raw`S_3`} />: <TeX src={String.raw`1^2+1^2+2^2=6`} />; <TeX src={String.raw`S_4`} />: <TeX src={String.raw`1+1+4+9+9=24`} />; <TeX src={String.raw`A_4`} />: <TeX src={String.raw`1+1+1+9=12`} />.
            </>}
          />
        </div>
      </div>

      {/* ── Cube connection ── */}
      <div className="gt-aside">
        <L
          zh={<>
            <strong>魔方联系</strong>（严格表述）：魔方群 <TeX src={String.raw`G`} />（阶 <TeX src={String.raw`43{,}252{,}003{,}274{,}489{,}856{,}000 = 2^{27}\cdot3^{14}\cdot5^3\cdot7^2\cdot11`} />）是 <TeX src={String.raw`(\mathbb{Z}/3\wr S_8)\times(\mathbb{Z}/2\wr S_{12})`} /> 在三条奇偶约束下的指数 12 子群——<strong>不是</strong> <TeX src={String.raw`S_8\times S_{12}`} /> 本身。
            然而，8 个角块的置换部分是 <TeX src={String.raw`S_8`} /> 的子群，12 个棱块的置换部分是 <TeX src={String.raw`S_{12}`} /> 的子群。
            本节证明的定理直接给出：<TeX src={String.raw`\mathbb{C}^8=\text{平凡}\oplus\text{标准}(\dim7)`} />，<TeX src={String.raw`\mathbb{C}^{12}=\text{平凡}\oplus\text{标准}(\dim11)`} />，
            即 <TeX src={String.raw`n=8`} /> 和 <TeX src={String.raw`n=12`} /> 两种情形。"某魔方动作不动几块"恰好就是该动作在角（棱）置换表示下的特征标值 <TeX src={String.raw`\psi(g)`} />。
          </>}
          en={<>
            <strong>Cube connection</strong> (precise statement): the Rubik&apos;s cube group <TeX src={String.raw`G`} /> (order <TeX src={String.raw`43{,}252{,}003{,}274{,}489{,}856{,}000 = 2^{27}\cdot3^{14}\cdot5^3\cdot7^2\cdot11`} />) is the index-12 subgroup of <TeX src={String.raw`(\mathbb{Z}/3\wr S_8)\times(\mathbb{Z}/2\wr S_{12})`} /> cut by three parity constraints — it is <strong>not</strong> <TeX src={String.raw`S_8\times S_{12}`} />.
            Nevertheless, the permutation part of the 8 corners is a subgroup of <TeX src={String.raw`S_8`} /> and the edge part of <TeX src={String.raw`S_{12}`} />.
            The theorem proved in this section gives directly: <TeX src={String.raw`\mathbb{C}^8=\text{trivial}\oplus\text{standard}(\dim 7)`} /> and <TeX src={String.raw`\mathbb{C}^{12}=\text{trivial}\oplus\text{standard}(\dim 11)`} /> — the <TeX src={String.raw`n=8`} /> and <TeX src={String.raw`n=12`} /> instances of the theorem. The value &ldquo;how many cubies does a move fix&rdquo; is exactly the permutation character <TeX src={String.raw`\psi(g)`} /> for that move.
          </>}
        />
      </div>

      {/* ── Widget 1: Permutation character decomposer ── */}
      <CharDecomposerPanel lang={lang} />

      {/* ── Widget 2: Trivial + standard splitter in R^3 ── */}
      <TrivialStandardPanel lang={lang} />

      {/* ── Widget 3: Maschke averaging ── */}
      <MaschkeAveragingPanel lang={lang} />

      {/* ── Widget 4: Regular representation dimension check ── */}
      <RegularRepPanel lang={lang} />

      {/* ── References ── */}
      <div className="gt-refs" style={{ marginTop: 40 }}>
        <div className="gt-def-title" style={{ marginBottom: 10 }}>
          <L zh="参考文献" en="References" />
        </div>
        <ol style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--ink-dim)' }}>
          <li>J.-P. Serre, <em>Linear Representations of Finite Groups</em>, Springer GTM 42, §§1.1–2.4 (Maschke, characters, orthogonality, regular representation).</li>
          <li>W. Fulton &amp; J. Harris, <em>Representation Theory: A First Course</em>, Springer GTM 129, Lectures 1–3 (complete reducibility, characters; <TeX src={String.raw`S_3/S_4/S_5`} /> character tables, standard representation of <TeX src={String.raw`S_n`} />).</li>
          <li>G. James &amp; M. Liebeck, <em>Representations and Characters of Groups</em>, 2nd ed., Cambridge, Chapters 8–19 (Maschke with characteristic hypothesis, inner products, <TeX src={String.raw`A_4/S_4`} /> tables).</li>
          <li>D. Joyner, <em>Adventures in Group Theory</em>, 2nd ed., Johns Hopkins, Ch. 11 (Rubik&apos;s cube group, order <TeX src={String.raw`43{,}252{,}003{,}274{,}489{,}856{,}000`} />, <TeX src={String.raw`S_8/S_{12}`} /> permutation factors).</li>
        </ol>
      </div>
    </GTSec>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Widget 1: Permutation character decomposer
// ═══════════════════════════════════════════════════════════════════════════════

function CharDecomposerPanel({ lang }: { lang: Lang }) {
  const [groupKey, setGroupKey] = useState<GroupKey>('S3');
  const [showFullTable, setShowFullTable] = useState(true);

  const groupData = GROUP_OPTIONS.find(g => g.key === groupKey)!.data;
  const multiplicities = useMemo(() => computeMultiplicities(groupData), [groupData]);
  const normSq = useMemo(() => {
    return multiplicities.reduce((s, m) => s + m * m, 0);
  }, [multiplicities]);

  const decompositionStr = useMemo(() => {
    const parts = multiplicities
      .map((m, i) => m > 0 ? `${m}×${lang === 'zh' ? groupData.irreps[i].nameZh : groupData.irreps[i].nameEn}` : null)
      .filter(Boolean);
    return parts.join(' + ');
  }, [multiplicities, groupData, lang]);

  const W = 600, ROW_H = 34, HEADER_H = 44;
  const nClasses = groupData.classes.length;
  const nIrreps = groupData.irreps.length;
  const colW = 70;
  const labelW = 130;
  const multW = 80;
  const termW = 80;
  const totalW = labelW + nClasses * colW + (showFullTable ? termW * nClasses + multW : multW);
  const svgH = HEADER_H + (nIrreps + 1) * ROW_H;

  const PALETTE = ['#8B2E3C', '#2A4D69', '#3F7050', '#B8860B', '#6B4E9C', '#C2410C', '#5C7CA0', '#9C4E6B'];

  const renderCell = (c: ComplexNum): string => fmtComplex(c, lang);

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="置换特征标分解器" en="Permutation character decomposer" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="选择一个置换表示，看不动点特征标 ψ 按共轭类的值，以及内积公式给出的各不可约重数 m_i。"
          en="Choose a permutation action to see the fixed-point character ψ by conjugacy class and the multiplicities m_i from the inner product formula."
        />
      </div>

      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {GROUP_OPTIONS.map(g => (
          <button
            key={g.key}
            className={`gt-chip${groupKey === g.key ? ' gt-chip-active' : ''}`}
            onClick={() => setGroupKey(g.key)}
          >
            {lang === 'zh' ? g.labelZh : g.label}
          </button>
        ))}
        <button
          className={`gt-chip${showFullTable ? ' gt-chip-active' : ''}`}
          onClick={() => setShowFullTable(v => !v)}
          style={{ marginLeft: 'auto' }}
        >
          <L zh="显示逐项" en="Show terms" />
        </button>
      </div>

      {/* SVG character table */}
      <div style={{ overflowX: 'auto', marginTop: 12 }}>
        <svg
          viewBox={`0 0 ${Math.max(totalW, W)} ${svgH}`}
          width="100%"
          style={{ display: 'block', minWidth: Math.min(totalW, 340), maxWidth: Math.max(totalW, W) }}
        >
          {/* Header row background */}
          <rect x={0} y={0} width={Math.max(totalW, W)} height={HEADER_H}
            fill="color-mix(in srgb, var(--accent) 8%, var(--bg-elev))" />

          {/* Irrep label column header */}
          <text x={8} y={HEADER_H / 2 + 5} style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600 }} fill="var(--ink)">
            {lang === 'zh' ? '不可约表示' : 'Irreducible'}
          </text>

          {/* Class headers */}
          {groupData.classes.map((cls, ci) => (
            <g key={ci}>
              <text
                x={labelW + ci * colW + colW / 2}
                y={HEADER_H / 2 - 4}
                textAnchor="middle"
                style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600 }}
                fill="var(--ink)"
              >
                {lang === 'zh' ? cls.nameZh : cls.nameEn}
              </text>
              <text
                x={labelW + ci * colW + colW / 2}
                y={HEADER_H / 2 + 10}
                textAnchor="middle"
                style={{ fontFamily: 'var(--mono)', fontSize: 9 }}
                fill="var(--ink-faint)"
              >
                {`|C|=${cls.size}`}
              </text>
            </g>
          ))}

          {/* Term headers (if visible) */}
          {showFullTable && groupData.classes.map((_, ci) => (
            <text
              key={`th-${ci}`}
              x={labelW + nClasses * colW + ci * termW + termW / 2}
              y={HEADER_H / 2 + 5}
              textAnchor="middle"
              style={{ fontFamily: 'var(--mono)', fontSize: 9 }}
              fill="var(--ink-faint)"
            >
              {lang === 'zh' ? `贡献${ci + 1}` : `term${ci + 1}`}
            </text>
          ))}

          {/* m_i header */}
          <text
            x={labelW + nClasses * colW + (showFullTable ? nClasses * termW : 0) + multW / 2}
            y={HEADER_H / 2 + 5}
            textAnchor="middle"
            style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700 }}
            fill="var(--accent)"
          >
            m_i
          </text>

          {/* ψ row */}
          <rect x={0} y={HEADER_H} width={Math.max(totalW, W)} height={ROW_H}
            fill="color-mix(in srgb, var(--gold) 7%, var(--bg-elev))" />
          <text x={8} y={HEADER_H + ROW_H / 2 + 5}
            style={{ fontFamily: 'var(--mono)', fontSize: 12, fontStyle: 'italic', fontWeight: 600 }}
            fill="var(--gold)">
            ψ (fixed pts)
          </text>
          {groupData.psiFixed.map((pf, ci) => (
            <text
              key={ci}
              x={labelW + ci * colW + colW / 2}
              y={HEADER_H + ROW_H / 2 + 5}
              textAnchor="middle"
              style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700 }}
              fill="var(--gold)"
            >
              {pf}
            </text>
          ))}
          <line x1={labelW} y1={HEADER_H + ROW_H} x2={Math.max(totalW, W)} y2={HEADER_H + ROW_H}
            stroke="var(--rule)" strokeWidth={0.5} />

          {/* Irrep rows */}
          {groupData.irreps.map((irrep, ri) => {
            const mi = multiplicities[ri];
            const rowY = HEADER_H + ROW_H + ri * ROW_H;
            const color = PALETTE[ri % PALETTE.length];
            return (
              <g key={ri}>
                <rect x={0} y={rowY} width={Math.max(totalW, W)} height={ROW_H}
                  fill={ri % 2 === 0 ? 'var(--bg-elev)' : 'var(--bg)'} />

                {/* Irrep name */}
                <text x={8} y={rowY + ROW_H / 2 + 5}
                  style={{ fontFamily: 'var(--sans)', fontSize: 11 }}
                  fill={color}>
                  {lang === 'zh' ? irrep.nameZh : irrep.nameEn}
                  {` (dim ${irrep.dim})`}
                </text>

                {/* χ_i values */}
                {irrep.values.map((v, ci) => (
                  <text
                    key={ci}
                    x={labelW + ci * colW + colW / 2}
                    y={rowY + ROW_H / 2 + 5}
                    textAnchor="middle"
                    style={{ fontFamily: 'var(--mono)', fontSize: 11 }}
                    fill={color}
                  >
                    {renderCell(v)}
                  </text>
                ))}

                {/* Per-class contribution terms: |C| * ψ_C * conj(χ_i) */}
                {showFullTable && groupData.classes.map((cls, ci) => {
                  const termC = cMul({ re: cls.size * groupData.psiFixed[ci], im: 0 }, cConj(irrep.values[ci]));
                  const termStr = Math.abs(termC.im) < 1e-9
                    ? String(Math.round(termC.re))
                    : `${termC.re.toFixed(1)}+${termC.im.toFixed(1)}i`;
                  return (
                    <text
                      key={ci}
                      x={labelW + nClasses * colW + ci * termW + termW / 2}
                      y={rowY + ROW_H / 2 + 5}
                      textAnchor="middle"
                      style={{ fontFamily: 'var(--mono)', fontSize: 10 }}
                      fill="var(--ink-dim)"
                    >
                      {termStr}
                    </text>
                  );
                })}

                {/* m_i */}
                <rect
                  x={labelW + nClasses * colW + (showFullTable ? nClasses * termW : 0) + 4}
                  y={rowY + 4}
                  width={multW - 8}
                  height={ROW_H - 8}
                  rx={4}
                  fill={mi > 0 ? `color-mix(in srgb, ${color} 15%, var(--bg-elev))` : 'none'}
                  stroke={mi > 0 ? color : 'none'}
                  strokeWidth={1}
                />
                <text
                  x={labelW + nClasses * colW + (showFullTable ? nClasses * termW : 0) + multW / 2}
                  y={rowY + ROW_H / 2 + 5}
                  textAnchor="middle"
                  style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: mi > 0 ? 700 : 400 }}
                  fill={mi > 0 ? color : 'var(--ink-faint)'}
                >
                  {mi}
                </text>

                {/* Row separator */}
                <line x1={0} y1={rowY + ROW_H} x2={Math.max(totalW, W)} y2={rowY + ROW_H}
                  stroke="var(--rule)" strokeWidth={0.5} />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="gt-panel-result" style={{ marginTop: 12 }}>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="分解式" en="Decomposition" />
          </span>
          <span className="gt-result-val-strong" style={{ color: 'var(--accent)' }}>
            ψ = {decompositionStr}
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="||ψ||² = Σm_i²" en="||ψ||² = Σm_i²" />
          </span>
          <span className="gt-result-val">{normSq}</span>
          <span style={{ fontSize: 12, color: 'var(--ink-faint)', marginLeft: 8 }}>
            <L zh={`(${normSq === 2 ? '= 2, 2-传递作用' : `= ${normSq}`})`} en={`(${normSq === 2 ? '= 2, 2-transitive action' : `= ${normSq}`})`} />
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="轨道数 = m_triv" en="#orbits = m_triv" />
          </span>
          <span className="gt-result-val">{multiplicities[0]}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="Σ dim_i²" en="Σ dim_i²" />
          </span>
          <span className="gt-result-val">
            {groupData.irreps.reduce((s, r) => s + r.dim * r.dim, 0)} = |G| = {groupData.groupOrder}
          </span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Widget 2: Trivial + standard splitter in R^3 / R^2 projected
// ═══════════════════════════════════════════════════════════════════════════════

function TrivialStandardPanel({ lang }: { lang: Lang }) {
  const [v, setV] = useState<[number, number, number]>([3, 1, -1]);
  const [permIdx, setPermIdx] = useState(0);

  const perm = S3_GENERATORS[permIdx].perm;
  const vPerm = applyPerm(v, perm);

  const { trivial, standard } = decompose3(v);
  const { trivial: trivialP, standard: standardP } = decompose3(vPerm);

  // Project to 2D for display
  const scale = 40;
  const cx = 120, cy = 120;

  const toSvg = (pt: [number, number, number]): [number, number] => {
    const [px, py] = project(pt);
    return [cx + px * scale, cy - py * scale];
  };

  const origin: [number, number] = [cx, cy];
  const [vx, vy] = toSvg(v);
  const [vpx, vpy] = toSvg(vPerm);
  const [tx, ty] = toSvg(trivial);
  const [sx, sy] = toSvg(standard);
  const [txP, tyP] = toSvg(trivialP);
  const [sxP, syP] = toSvg(standardP);

  const fmtVec = (vec: [number, number, number]) =>
    `(${vec[0].toFixed(1)}, ${vec[1].toFixed(1)}, ${vec[2].toFixed(1)})`;

  const mean = (trivial[0]).toFixed(2);

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="平凡分量与标准分量的几何分解" en="Trivial + standard decomposition in R³" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="在 R³ 中选一个向量，施加 S₃ 的置换，观察平均分量（平凡，沿对角线）保持不变，零和分量（标准）在超平面内旋转。"
          en="Choose a vector in R³, apply a permutation in S₃, and see the average component (trivial, along diagonal) stay fixed while the sum-zero component (standard) rotates within the hyperplane."
        />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        {/* Controls */}
        <div style={{ flex: '0 0 auto', minWidth: 180 }}>
          <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginBottom: 8 }}>
            <L zh="输入向量 v = (v₁, v₂, v₃)" en="Input vector v = (v₁, v₂, v₃)" />
          </div>
          {([0, 1, 2] as const).map(i => (
            <div key={i} className="gt-panel-input-row" style={{ gap: 6, marginBottom: 4 }}>
              <label style={{ minWidth: 24 }}>v<sub>{i + 1}</sub></label>
              <input
                type="range"
                min={-4}
                max={4}
                step={0.5}
                value={v[i]}
                onChange={e => {
                  const nv: [number, number, number] = [...v] as [number, number, number];
                  nv[i] = Number(e.target.value);
                  setV(nv);
                }}
                style={{ flex: 1, minWidth: 80 }}
              />
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12, minWidth: 30 }}>{v[i].toFixed(1)}</span>
            </div>
          ))}

          <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 12, marginBottom: 6 }}>
            <L zh="施加置换" en="Apply permutation" />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {S3_GENERATORS.map((g, idx) => (
              <button
                key={idx}
                className={`gt-chip${permIdx === idx ? ' gt-chip-active' : ''}`}
                style={{ fontSize: 10, padding: '2px 8px' }}
                onClick={() => setPermIdx(idx)}
              >
                {lang === 'zh' ? g.nameZh : g.nameEn}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 14, fontSize: 12, lineHeight: 1.7, fontFamily: 'var(--mono)' }}>
            <div style={{ color: 'var(--ink-dim)' }}>v = {fmtVec(v)}</div>
            <div style={{ color: 'var(--gold)' }}>
              <L zh="平均值 =" en="mean =" /> {mean}
            </div>
            <div style={{ color: 'var(--accent-2)' }}>
              <L zh="平凡分量" en="trivial" /> = {fmtVec(trivial)}
            </div>
            <div style={{ color: 'var(--accent)' }}>
              <L zh="标准分量" en="standard" /> = {fmtVec(standard)}
            </div>
            <div style={{ marginTop: 6, color: 'var(--ink-dim)' }}>
              <L zh="置换后" en="after perm" />: {fmtVec(vPerm)}
            </div>
            <div style={{ color: 'var(--accent-2)', fontSize: 11 }}>
              <L zh="平凡（不变）" en="trivial (unchanged)" /> = {fmtVec(trivialP)}
            </div>
            <div style={{ color: 'var(--accent)', fontSize: 11 }}>
              <L zh="标准（在超平面内）" en="standard (in hyperplane)" /> = {fmtVec(standardP)}
            </div>
          </div>
        </div>

        {/* SVG projection */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <svg viewBox="0 0 240 240" width="100%" style={{ display: 'block', maxWidth: 240 }}>
            {/* Axes labels */}
            <text x={230} y={cy + 4} textAnchor="end" style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--ink-faint)">x+y+z=0</text>
            <text x={cx} y={12} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--gold)">(1,1,1)</text>

            {/* Coordinate axes (projected) */}
            {([
              [[1, 0, 0], 'x'], [[0, 1, 0], 'y'], [[0, 0, 1], 'z'],
            ] as Array<[[number, number, number], string]>).map(([axis, name]) => {
              const [ax, ay] = toSvg(axis.map(c => c * 3) as [number, number, number]);
              return (
                <g key={name}>
                  <line x1={cx} y1={cy} x2={ax} y2={ay}
                    stroke="var(--rule)" strokeWidth={1} strokeDasharray="3 2" />
                  <text x={ax} y={ay - 4} textAnchor="middle"
                    style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--ink-faint)">{name}</text>
                </g>
              );
            })}

            {/* Diagonal (1,1,1) axis */}
            {(() => {
              const [d1x, d1y] = toSvg([2.5, 2.5, 2.5]);
              const [d2x, d2y] = toSvg([-2.5, -2.5, -2.5]);
              return (
                <line x1={d1x} y1={d1y} x2={d2x} y2={d2y}
                  stroke="var(--gold)" strokeWidth={1.5} strokeDasharray="6 3" />
              );
            })()}

            {/* Sum-zero plane hint (a few reference vectors) */}
            {[
              [2, -1, -1], [-1, 2, -1], [-1, -1, 2],
              [1, -1, 0], [0, 1, -1], [-1, 0, 1],
            ].map((pt, i) => {
              const [px2, py2] = toSvg(pt as [number, number, number]);
              return <circle key={i} cx={px2} cy={py2} r={2} fill="color-mix(in srgb, var(--ink-faint) 30%, transparent)" />;
            })}

            {/* Original vector v (gray) */}
            <line x1={origin[0]} y1={origin[1]} x2={vx} y2={vy}
              stroke="var(--ink-dim)" strokeWidth={1.5} markerEnd="url(#arrowInk)" />
            <text x={vx + 4} y={vy} style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--ink-dim)">v</text>

            {/* Trivial component (gold) */}
            <line x1={origin[0]} y1={origin[1]} x2={tx} y2={ty}
              stroke="var(--gold)" strokeWidth={2} markerEnd="url(#arrowGold)" />
            <text x={tx + 4} y={ty - 4} style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--gold)">
              <L zh="平凡" en="triv" />
            </text>

            {/* Standard component (accent) */}
            <line x1={tx} y1={ty} x2={sx} y2={sy}
              stroke="var(--accent)" strokeWidth={2} strokeDasharray="4 2" markerEnd="url(#arrowAccent)" />
            <text x={(tx + sx) / 2 + 6} y={(ty + sy) / 2} style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--accent)">
              <L zh="标准" en="std" />
            </text>

            {/* Permuted vector (lighter) */}
            {permIdx !== 0 && (
              <>
                <line x1={origin[0]} y1={origin[1]} x2={vpx} y2={vpy}
                  stroke="var(--accent-2)" strokeWidth={1.5} strokeDasharray="5 3" markerEnd="url(#arrowBlue)" />
                <text x={vpx + 4} y={vpy + 4} style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--accent-2)">π(v)</text>

                {/* Permuted trivial (same as original — shown as dot) */}
                <circle cx={txP} cy={tyP} r={4} fill="var(--gold)" opacity={0.5} />

                {/* Permuted standard */}
                <line x1={txP} y1={tyP} x2={sxP} y2={syP}
                  stroke="var(--accent-2)" strokeWidth={1.5} />
              </>
            )}

            <defs>
              <marker id="arrowInk" markerWidth={6} markerHeight={6} refX={3} refY={3} orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="var(--ink-dim)" />
              </marker>
              <marker id="arrowGold" markerWidth={6} markerHeight={6} refX={3} refY={3} orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="var(--gold)" />
              </marker>
              <marker id="arrowAccent" markerWidth={6} markerHeight={6} refX={3} refY={3} orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="var(--accent)" />
              </marker>
              <marker id="arrowBlue" markerWidth={6} markerHeight={6} refX={3} refY={3} orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="var(--accent-2)" />
              </marker>
            </defs>
          </svg>
          <div style={{ fontSize: 11, color: 'var(--ink-faint)', textAlign: 'center', marginTop: -4 }}>
            <L zh="等轴测投影 R³ → 平面" en="Isometric projection R³ → plane" />
          </div>
        </div>
      </div>

      <div className="gt-panel-result" style={{ marginTop: 8 }}>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="v = 平凡 + 标准" en="v = trivial + standard" />
          </span>
          <span className="gt-result-val" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
            {fmtVec(trivial)} + {fmtVec(standard)}
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="坐标和" en="Coord sum" />
          </span>
          <span className="gt-result-val">
            {`standard: ${(standard[0] + standard[1] + standard[2]).toFixed(6)} ≈ 0`}
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="置换后平均值变化" en="Mean after perm" />
          </span>
          <span className="gt-result-val" style={{ color: 'var(--green)' }}>
            {((vPerm[0] + vPerm[1] + vPerm[2]) / 3).toFixed(2)} = {mean}
            <L zh=" (不变)" en=" (invariant)" />
          </span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Widget 3: Maschke averaging visualizer
// ═══════════════════════════════════════════════════════════════════════════════

function MaschkeAveragingPanel({ lang }: { lang: Lang }) {
  const [stepCount, setStepCount] = useState(0);
  const [badChar, setBadChar] = useState(false);

  const mats = useMemo(() => getS3Mats(), []);
  const groupOrder = 6;

  // Accumulate sum_{k=0}^{stepCount-1} rho(g_k) * P0 * rho(g_k)^{-1}
  const partialSum: Mat2x2 = useMemo(() => {
    let acc: Mat2x2 = [0, 0, 0, 0];
    for (let k = 0; k < Math.min(stepCount, groupOrder); k++) {
      const rho = mats[k];
      const rhoInv = mat2Inv(rho);
      const term = mat2Mul(mat2Mul(rho, P0), rhoInv);
      acc = mat2Add(acc, term);
    }
    return acc;
  }, [stepCount, mats]);

  const divisor = badChar ? 0 : groupOrder;
  const averaged: Mat2x2 | null = useMemo(() => {
    if (badChar || stepCount < groupOrder) return null;
    return mat2Scale(partialSum, 1 / groupOrder);
  }, [partialSum, stepCount, badChar]);

  const fmtMat = (m: Mat2x2) =>
    `[[${m[0].toFixed(2)}, ${m[1].toFixed(2)}], [${m[2].toFixed(2)}, ${m[3].toFixed(2)}]]`;

  // Visualize the 2D operator on a unit circle: draw image of 4 basis vectors
  const renderOperator = (m: Mat2x2, color: string, scale: number, cx: number, cy: number) => {
    const vecs: Array<[number, number]> = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    return vecs.map(([x, y], i) => {
      const mx = m[0] * x + m[1] * y;
      const my = m[2] * x + m[3] * y;
      return (
        <line
          key={i}
          x1={cx} y1={cy}
          x2={cx + mx * scale} y2={cy - my * scale}
          stroke={color} strokeWidth={2} opacity={0.7}
          markerEnd={`url(#arrowM${i})`}
        />
      );
    });
  };

  const svgCx = 70, svgCy = 70, sc = 45;

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="Maschke 平均化可视化" en="Maschke averaging visualizer" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="从一个非 G-不变投影 P₀ 出发，逐步加入 ρ(g)P₀ρ(g)⁻¹，平均后得到 G-不变投影。切换「坏特征」看除以 |G| 失效。"
          en="Starting from a non-invariant projection P₀, accumulate ρ(g)P₀ρ(g)⁻¹ one by one. The average is G-invariant. Toggle 'bad characteristic' to see division by |G| fail."
        />
      </div>

      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <button
          className="gt-btn"
          onClick={() => setStepCount(s => Math.min(s + 1, groupOrder))}
          disabled={stepCount >= groupOrder}
        >
          <L zh={`加入 ρ(g_${stepCount + 1}) (${stepCount}/${groupOrder})`} en={`Add ρ(g_${stepCount + 1}) (${stepCount}/${groupOrder})`} />
        </button>
        <button className="gt-btn-ghost gt-btn" onClick={() => setStepCount(0)}>
          <L zh="重置" en="Reset" />
        </button>
        <button
          className={`gt-chip${badChar ? ' gt-chip-active' : ''}`}
          onClick={() => setBadChar(v => !v)}
          style={{ color: badChar ? 'var(--warn)' : undefined }}
        >
          <L zh="坏特征 char(F) | |G|" en="bad char: char(F) | |G|" />
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 12 }}>
        {/* SVG: P0 and current running average */}
        <svg viewBox="0 0 300 150" width="100%" style={{ display: 'block', minWidth: 220, maxWidth: 300 }}>
          {/* Left: P0 */}
          <text x={svgCx} y={12} textAnchor="middle"
            style={{ fontFamily: 'var(--mono)', fontSize: 10 }} fill="var(--ink-dim)">P₀</text>
          <circle cx={svgCx} cy={svgCy} r={sc} fill="none" stroke="var(--rule)" strokeWidth={1} />
          {renderOperator(P0, 'var(--ink-dim)', sc, svgCx, svgCy)}

          {/* Right: running sum / averaged */}
          <text x={svgCx + 160} y={12} textAnchor="middle"
            style={{ fontFamily: 'var(--mono)', fontSize: 10 }}
            fill={averaged ? 'var(--green)' : 'var(--accent-2)'}>
            {stepCount === 0
              ? (lang === 'zh' ? '(初始)' : '(start)')
              : averaged
              ? (lang === 'zh' ? '平均后 (G-不变)' : 'averaged (G-invariant)')
              : (lang === 'zh' ? `累计 ${stepCount}/${groupOrder}` : `sum ${stepCount}/${groupOrder}`)}
          </text>
          <circle cx={svgCx + 160} cy={svgCy} r={sc} fill="none" stroke="var(--rule)" strokeWidth={1} />
          {renderOperator(
            averaged ?? (stepCount > 0 ? mat2Scale(partialSum, 1 / Math.max(stepCount, 1)) : P0),
            averaged ? 'var(--green)' : 'var(--accent-2)',
            sc,
            svgCx + 160,
            svgCy,
          )}

          {/* Arrow between */}
          <text x={svgCx + 80} y={svgCy + 4} textAnchor="middle"
            style={{ fontFamily: 'var(--mono)', fontSize: 11 }} fill="var(--ink-faint)">→</text>

          {/* Divisor label */}
          {stepCount === groupOrder && (
            <text x={svgCx + 160} y={svgCy + sc + 18} textAnchor="middle"
              style={{ fontFamily: 'var(--mono)', fontSize: 10 }}
              fill={badChar ? 'var(--warn)' : 'var(--green)'}>
              {badChar ? `÷ |G| = ${groupOrder}, but 1/${groupOrder} ∉ F!` : `÷ |G| = ${groupOrder} ✓`}
            </text>
          )}

          <defs>
            {[0, 1, 2, 3].map(i => (
              <marker key={i} id={`arrowM${i}`} markerWidth={5} markerHeight={5} refX={2.5} refY={2.5} orient="auto">
                <path d="M0,0 L5,2.5 L0,5 Z" fill="var(--ink-dim)" />
              </marker>
            ))}
          </defs>
        </svg>
      </div>

      <div className="gt-panel-result" style={{ marginTop: 8 }}>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="初始 P₀" en="Starting P₀" />
          </span>
          <span className="gt-result-val" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
            {fmtMat(P0)}
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="当前累计和" en="Running sum" />
          </span>
          <span className="gt-result-val" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
            {fmtMat(partialSum)}
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="除以 |G| =" en="Divide by |G| =" />
          </span>
          {badChar ? (
            <span className="gt-result-val" style={{ color: 'var(--warn)', fontFamily: 'var(--mono)' }}>
              1/{divisor === 0 ? '0' : divisor}
              <L zh=" — 在 char(F) | |G| 时无意义！" en=" — undefined when char(F) | |G|!" />
            </span>
          ) : (
            <span className="gt-result-val" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
              {stepCount >= groupOrder
                ? fmtMat(averaged!)
                : (lang === 'zh' ? `(需要全部 ${groupOrder} 项)` : `(need all ${groupOrder} terms)`)}
            </span>
          )}
        </div>
        {averaged && !badChar && (
          <div className="gt-result-row">
            <span className="gt-result-label">
              <L zh="G-不变？" en="G-invariant?" />
            </span>
            <span className="gt-result-val" style={{ color: 'var(--green)' }}>
              <L zh="是 — 对所有 g∈G: ρ(g)Pρ(g)⁻¹ = P" en="Yes — ρ(g)Pρ(g)⁻¹ = P for all g∈G" />
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Widget 4: Regular representation dimension check
// ═══════════════════════════════════════════════════════════════════════════════

function RegularRepPanel({ lang }: { lang: Lang }) {
  const [groupKey, setGroupKey] = useState<DimGroupKey>('S3');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const group = DIM_GROUPS.find(g => g.key === groupKey)!;
  const sumSq = group.dims.reduce((s, d) => s + d * d, 0);
  // Sanity assertion: sumSq must equal groupOrder
  const isCorrect = sumSq === group.order;

  const PALETTE = ['#8B2E3C', '#2A4D69', '#3F7050', '#B8860B', '#6B4E9C', '#C2410C', '#5C7CA0', '#9C4E6B'];

  // Layout: pack squares left-to-right, side proportional to dim_i (so area = dim_i²)
  const maxW = 340;
  const totalUnits = group.dims.reduce((s, d) => s + d, 0); // sum of dims (not squares)
  const unitPx = Math.min(40, Math.floor(maxW / totalUnits));

  let xCursor = 0;
  const rects = group.dims.map((dim, i) => {
    const w = dim * unitPx;
    const squareW = w;
    const squareH = squareW; // actual square
    const rect = { x: xCursor, dim, squareW, squareH, color: PALETTE[i % PALETTE.length] };
    xCursor += squareW + 4;
    return rect;
  });

  const svgW = xCursor;
  const svgH = Math.max(...rects.map(r => r.squareH)) + 48;

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="正则表示维数验证: Σ dim_i² = |G|" en="Regular representation: Σ dim_i² = |G|" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="每个方块面积 = dim(χ_i)²，它在正则表示中出现 dim(χ_i) 次。全部方块面积之和 = |G|。悬停查看详情。"
          en="Each square has area = dim(χ_i)², and appears dim(χ_i) times in C[G]. Total area = |G|. Hover to inspect."
        />
      </div>

      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {DIM_GROUPS.map(g => (
          <button
            key={g.key}
            className={`gt-chip${groupKey === g.key ? ' gt-chip-active' : ''}`}
            onClick={() => { setGroupKey(g.key); setHoveredIdx(null); }}
          >
            {g.label} (|G|={g.order})
          </button>
        ))}
      </div>

      <div style={{ overflowX: 'auto', marginTop: 12 }}>
        <svg
          viewBox={`0 0 ${svgW + 20} ${svgH}`}
          width="100%"
          style={{ display: 'block', minWidth: 200, maxWidth: svgW + 20 }}
        >
          {rects.map((r, i) => {
            const isHov = hoveredIdx === i;
            const baseY = svgH - 32 - r.squareH;
            return (
              <g
                key={i}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                onTouchStart={() => setHoveredIdx(i === hoveredIdx ? null : i)}
              >
                <rect
                  x={r.x + 2}
                  y={baseY}
                  width={r.squareW - 4}
                  height={r.squareH}
                  rx={3}
                  fill={`color-mix(in srgb, ${r.color} ${isHov ? 35 : 18}%, var(--bg-elev))`}
                  stroke={r.color}
                  strokeWidth={isHov ? 2 : 1}
                />
                {/* dim label inside */}
                {r.squareW >= 20 && (
                  <text
                    x={r.x + r.squareW / 2}
                    y={baseY + r.squareH / 2 + 5}
                    textAnchor="middle"
                    style={{ fontFamily: 'var(--mono)', fontSize: Math.min(14, r.squareW / 2), fontWeight: 600 }}
                    fill={r.color}
                  >
                    {r.dim}
                  </text>
                )}
                {/* Area label below */}
                <text
                  x={r.x + r.squareW / 2}
                  y={svgH - 14}
                  textAnchor="middle"
                  style={{ fontFamily: 'var(--mono)', fontSize: 9 }}
                  fill="var(--ink-faint)"
                >
                  {`${r.dim}²=${r.dim * r.dim}`}
                </text>
              </g>
            );
          })}

          {/* Total area annotation */}
          <text x={svgW / 2} y={14} textAnchor="middle"
            style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600 }}
            fill={isCorrect ? 'var(--green)' : 'var(--warn)'}>
            {`Σ dim² = ${sumSq} ${isCorrect ? '=' : '≠'} |G| = ${group.order}`}
          </text>
        </svg>
      </div>

      {hoveredIdx !== null && (
        <div className="gt-panel-result" style={{ marginTop: 8 }}>
          <div className="gt-result-row">
            <span className="gt-result-label">
              <L zh="不可约表示" en="Irreducible" />
            </span>
            <span className="gt-result-val-strong" style={{ color: PALETTE[hoveredIdx % PALETTE.length] }}>
              {lang === 'zh' ? `第 ${hoveredIdx + 1} 个` : `#${hoveredIdx + 1}`}
              {` (dim = ${group.dims[hoveredIdx]})`}
            </span>
          </div>
          <div className="gt-result-row">
            <span className="gt-result-label">
              <L zh="在正则表示中出现" en="Multiplicity in C[G]" />
            </span>
            <span className="gt-result-val">{group.dims[hoveredIdx]}
              <L zh=" 次" en=" times" />
            </span>
          </div>
          <div className="gt-result-row">
            <span className="gt-result-label">
              <L zh="贡献面积 dim²" en="Area contribution dim²" />
            </span>
            <span className="gt-result-val">{group.dims[hoveredIdx] ** 2}</span>
          </div>
        </div>
      )}

      {hoveredIdx === null && (
        <div className="gt-panel-result" style={{ marginTop: 8 }}>
          <div className="gt-result-row">
            <span className="gt-result-label"><L zh="维数列表" en="Dimension list" /></span>
            <span className="gt-result-val" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
              [{group.dims.join(', ')}]
            </span>
          </div>
          <div className="gt-result-row">
            <span className="gt-result-label">
              <L zh="平方和" en="Sum of squares" />
            </span>
            <span className="gt-result-val-strong" style={{ color: isCorrect ? 'var(--green)' : 'var(--warn)' }}>
              {group.dims.map(d => `${d}²`).join(' + ')} = {sumSq} = {group.order}
            </span>
          </div>
          {group.key === 'S5' && (
            <div className="gt-result-row">
              <span className="gt-result-label"><L zh="注" en="Note" /></span>
              <span className="gt-result-val" style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                <L
                  zh="S₅ 的维数列表 [1,1,4,4,5,5,6] 由 1+1+16+16+25+25+36=120=|S₅| 验证，但须核对字符表原始文献。"
                  en="S₅ dimension list [1,1,4,4,5,5,6] verified by 1+1+16+16+25+25+36=120=|S₅|, but confirm against a primary character-table reference."
                />
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
