'use client';

import { useState, useCallback } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import type { Lang } from '../primitives';
import { tr } from '@/i18n/tr';

// ── Types ─────────────────────────────────────────────────────────────────────

type PolyId = 'x2_minus_2' | 'x3_minus_2' | 'cyclotomic_5' | 'cyclotomic_7' | 'quintic';

interface ComplexNum { re: number; im: number }

interface RootDef {
  label: string;       // short display
  re: number;
  im: number;
}

interface GroupElement {
  label: string;       // cycle notation
  perm: number[];      // perm[i] = where root i goes
}

interface SubgroupNode {
  id: string;
  label: string;       // e.g. "{e}", "A₃", "S₃"
  order: number;
  isNormal: boolean;
  fixedField: string;  // e.g. "Q(∛2·ω)"
  fieldDeg: string;    // e.g. "[L:F] = 3"
  baseDeg: string;     // e.g. "[F:Q] = 2"
}

interface SubgroupEdge {
  from: string;
  to: string;
}

interface SolvabilitySeries {
  chain: { label: string; order: number }[];
  quotients: string[];      // labels on edges, e.g. "C₂"
  solvable: boolean;
  blockNote: string | null; // why it fails, if any
}

interface PolyData {
  labelEn: string;
  labelZh: string;
  galoisGroupEn: string;
  galoisGroupZh: string;
  galoisGroupTex: string;
  groupOrder: number;
  roots: RootDef[];
  elements: GroupElement[];
  subgroups: SubgroupNode[];
  subgroupEdges: SubgroupEdge[];
  solvability: SolvabilitySeries;
  discriminantTex: string;
  noteEn: string;
  noteZh: string;
}

// ── Root data (hand-computed closed-form numerics) ────────────────────────────
// omega = e^{2πi/3} = (-1 + i√3) / 2
const OMEGA_RE = -0.5;
const OMEGA_IM = 0.8660254037844387;  // √3/2
const CBRT2 = 1.2599210498948732;     // 2^{1/3}

// zeta_5 = e^{2πi/5}: precompute k=1..4
function zeta5(k: number): ComplexNum {
  const angle = (2 * Math.PI * k) / 5;
  return { re: Math.cos(angle), im: Math.sin(angle) };
}

// zeta_7 = e^{2πi/7}: precompute k=1..6
function zeta7(k: number): ComplexNum {
  const angle = (2 * Math.PI * k) / 7;
  return { re: Math.cos(angle), im: Math.sin(angle) };
}

// Quintic x^5 - 6x + 3 (Eisenstein p=3, three real + two complex roots)
// Roots computed numerically (offline) to 6 decimal places:
const QUINTIC_ROOTS: RootDef[] = [
  { label: 'r₁', re: -1.670935, im: 0 },
  { label: 'r₂', re:  0.505501, im: 0 },
  { label: 'r₃', re:  1.401642, im: 0 },
  { label: 'r₄', re: -0.118104, im:  1.587459 },
  { label: 'r₅', re: -0.118104, im: -1.587459 },
];

// ── Polynomial database ───────────────────────────────────────────────────────

const POLY_DATA: Record<PolyId, PolyData> = {
  x2_minus_2: {
    labelEn: 'x² − 2',
    labelZh: 'x² − 2',
    galoisGroupEn: 'C₂ (cyclic, order 2)',
    galoisGroupZh: 'C₂（循环群，阶 2）',
    galoisGroupTex: 'C_2',
    groupOrder: 2,
    roots: [
      { label: '√2',  re:  1.4142135623730951, im: 0 },
      { label: '−√2', re: -1.4142135623730951, im: 0 },
    ],
    elements: [
      { label: 'id',           perm: [0, 1] },
      { label: '(0 1): √2↔−√2', perm: [1, 0] },
    ],
    subgroups: [
      { id: 'trivial', label: '{e}', order: 1, isNormal: true,  fixedField: 'L = Q(√2)', fieldDeg: '[L:L] = 1', baseDeg: '[L:Q] = 2' },
      { id: 'whole',   label: 'C₂',  order: 2, isNormal: true,  fixedField: 'K = Q',     fieldDeg: '[L:Q] = 2', baseDeg: '[Q:Q] = 1' },
    ],
    subgroupEdges: [{ from: 'whole', to: 'trivial' }],
    solvability: {
      chain: [{ label: '{e}', order: 1 }, { label: 'C₂', order: 2 }],
      quotients: ['C₂'],
      solvable: true,
      blockNote: null,
    },
    discriminantTex: String.raw`\Delta = 8,\quad \sqrt{\Delta}=2\sqrt{2}\in\mathbb{Q}`,
    noteEn: 'The unique non-trivial automorphism swaps √2 ↔ −√2; C₂ is abelian, hence solvable.',
    noteZh: '唯一非平凡自同构交换 √2 ↔ −√2；C₂ 是阿贝尔群，故可解。',
  },

  x3_minus_2: {
    labelEn: 'x³ − 2',
    labelZh: 'x³ − 2',
    galoisGroupEn: 'S₃ (symmetric on 3 roots, order 6)',
    galoisGroupZh: 'S₃（三根的对称群，阶 6）',
    galoisGroupTex: 'S_3',
    groupOrder: 6,
    roots: [
      { label: '∛2',      re: CBRT2,             im: 0 },
      { label: '∛2·ω',    re: CBRT2 * OMEGA_RE,  im: CBRT2 * OMEGA_IM },
      { label: '∛2·ω²',   re: CBRT2 * OMEGA_RE,  im: -CBRT2 * OMEGA_IM },
    ],
    elements: [
      { label: 'id',       perm: [0, 1, 2] },
      { label: '(0 1)',    perm: [1, 0, 2] },
      { label: '(0 2)',    perm: [2, 1, 0] },
      { label: '(1 2)',    perm: [0, 2, 1] },
      { label: '(0 1 2)', perm: [1, 2, 0] },
      { label: '(0 2 1)', perm: [2, 0, 1] },
    ],
    subgroups: [
      { id: 'trivial', label: '{e}',      order: 1, isNormal: true,  fixedField: 'L = Q(∛2, ω)',  fieldDeg: '[L:L] = 1',  baseDeg: '[L:Q] = 6' },
      { id: 'c2_01',  label: '⟨(0 1)⟩',  order: 2, isNormal: false, fixedField: 'Q(∛2·ω²)',      fieldDeg: '[L:F] = 2',  baseDeg: '[F:Q] = 3' },
      { id: 'c2_02',  label: '⟨(0 2)⟩',  order: 2, isNormal: false, fixedField: 'Q(∛2·ω)',       fieldDeg: '[L:F] = 2',  baseDeg: '[F:Q] = 3' },
      { id: 'c2_12',  label: '⟨(1 2)⟩',  order: 2, isNormal: false, fixedField: 'Q(∛2)',         fieldDeg: '[L:F] = 2',  baseDeg: '[F:Q] = 3' },
      { id: 'a3',     label: 'A₃ ≅ C₃',  order: 3, isNormal: true,  fixedField: 'Q(ω) = Q(√−3)', fieldDeg: '[L:F] = 3',  baseDeg: '[F:Q] = 2' },
      { id: 's3',     label: 'S₃',        order: 6, isNormal: true,  fixedField: 'K = Q',          fieldDeg: '[L:Q] = 6',  baseDeg: '[Q:Q] = 1' },
    ],
    subgroupEdges: [
      { from: 's3',    to: 'a3'    },
      { from: 's3',    to: 'c2_01' },
      { from: 's3',    to: 'c2_02' },
      { from: 's3',    to: 'c2_12' },
      { from: 'a3',    to: 'trivial' },
      { from: 'c2_01', to: 'trivial' },
      { from: 'c2_02', to: 'trivial' },
      { from: 'c2_12', to: 'trivial' },
    ],
    solvability: {
      chain: [{ label: '{e}', order: 1 }, { label: 'A₃', order: 3 }, { label: 'S₃', order: 6 }],
      quotients: ['C₃', 'C₂'],
      solvable: true,
      blockNote: null,
    },
    discriminantTex: String.raw`\Delta = -108 = -4\cdot 27,\quad \sqrt{\Delta}\notin\mathbb{Q}`,
    noteEn: 'Δ = −108 is not a square in Q, so Gal ⊄ A₃; the group is S₃. Solvable: {e} ◁ A₃ ◁ S₃ with quotients C₃, C₂.',
    noteZh: 'Δ = −108 不是 Q 中的平方，故 Gal ⊄ A₃，从而群为 S₃。可解：{e} ◁ A₃ ◁ S₃，商群依次为 C₃、C₂。',
  },

  cyclotomic_5: {
    labelEn: 'Φ₅ = x⁴+x³+x²+x+1 (cyclotomic)',
    labelZh: 'Φ₅ = x⁴+x³+x²+x+1（分圆多项式）',
    galoisGroupEn: 'C₄ (cyclic, order 4; (Z/5Z)* ≅ C₄)',
    galoisGroupZh: 'C₄（循环群，阶 4；(Z/5Z)* ≅ C₄）',
    galoisGroupTex: 'C_4 \\cong (\\mathbb{Z}/5\\mathbb{Z})^*',
    groupOrder: 4,
    roots: [
      { label: 'ζ₅¹', ...zeta5(1) },
      { label: 'ζ₅²', ...zeta5(2) },
      { label: 'ζ₅³', ...zeta5(3) },
      { label: 'ζ₅⁴', ...zeta5(4) },
    ],
    elements: [
      { label: 'σ₁: ζ↦ζ¹ (id)',  perm: [0, 1, 2, 3] },
      { label: 'σ₂: ζ↦ζ²',       perm: [1, 3, 0, 2] },
      { label: 'σ₃: ζ↦ζ³',       perm: [2, 0, 3, 1] },
      { label: 'σ₄: ζ↦ζ⁴',       perm: [3, 2, 1, 0] },
    ],
    subgroups: [
      { id: 'trivial', label: '{e}',        order: 1, isNormal: true,  fixedField: 'L = Q(ζ₅)',       fieldDeg: '[L:L] = 1',  baseDeg: '[L:Q] = 4' },
      { id: 'c2',     label: '⟨σ₄⟩ ≅ C₂',  order: 2, isNormal: true,  fixedField: 'Q(√5)',            fieldDeg: '[L:F] = 2',  baseDeg: '[F:Q] = 2' },
      { id: 'c4',     label: 'C₄',          order: 4, isNormal: true,  fixedField: 'K = Q',            fieldDeg: '[L:Q] = 4',  baseDeg: '[Q:Q] = 1' },
    ],
    subgroupEdges: [
      { from: 'c4',  to: 'c2'     },
      { from: 'c2',  to: 'trivial' },
    ],
    solvability: {
      chain: [{ label: '{e}', order: 1 }, { label: 'C₄', order: 4 }],
      quotients: ['C₄'],
      solvable: true,
      blockNote: null,
    },
    discriminantTex: String.raw`\text{Gal}(\mathbb{Q}(\zeta_5)/\mathbb{Q})\cong(\mathbb{Z}/5\mathbb{Z})^*\cong C_4`,
    noteEn: 'All cyclotomic extensions have abelian Galois group; C₄ is abelian (cyclic) hence solvable. The intermediate field Q(√5) corresponds to the unique subgroup of order 2.',
    noteZh: '所有分圆扩张的 Galois 群均为阿贝尔群；C₄ 是阿贝尔（循环）群，故可解。中间域 Q(√5) 对应唯一的阶 2 子群。',
  },

  cyclotomic_7: {
    labelEn: 'Φ₇ = x⁶+x⁵+…+1 (cyclotomic, p=7)',
    labelZh: 'Φ₇ = x⁶+x⁵+…+1（分圆，p=7）',
    galoisGroupEn: 'C₆ (cyclic, order 6; (Z/7Z)* ≅ C₆)',
    galoisGroupZh: 'C₆（循环群，阶 6；(Z/7Z)* ≅ C₆）',
    galoisGroupTex: 'C_6 \\cong (\\mathbb{Z}/7\\mathbb{Z})^*',
    groupOrder: 6,
    roots: [
      { label: 'ζ₇¹', ...zeta7(1) },
      { label: 'ζ₇²', ...zeta7(2) },
      { label: 'ζ₇³', ...zeta7(3) },
      { label: 'ζ₇⁴', ...zeta7(4) },
      { label: 'ζ₇⁵', ...zeta7(5) },
      { label: 'ζ₇⁶', ...zeta7(6) },
    ],
    elements: [
      { label: 'σ₁: ζ↦ζ¹ (id)', perm: [0, 1, 2, 3, 4, 5] },
      { label: 'σ₂: ζ↦ζ²',      perm: [1, 3, 5, 0, 2, 4] },
      { label: 'σ₃: ζ↦ζ³',      perm: [2, 5, 1, 4, 0, 3] },
      { label: 'σ₄: ζ↦ζ⁴',      perm: [3, 0, 4, 1, 5, 2] },
      { label: 'σ₅: ζ↦ζ⁵',      perm: [4, 2, 0, 5, 3, 1] },
      { label: 'σ₆: ζ↦ζ⁶',      perm: [5, 4, 3, 2, 1, 0] },
    ],
    subgroups: [
      { id: 'trivial', label: '{e}',        order: 1, isNormal: true,  fixedField: 'L = Q(ζ₇)',       fieldDeg: '[L:L] = 1',  baseDeg: '[L:Q] = 6' },
      { id: 'c2',     label: '⟨σ₆⟩ ≅ C₂',  order: 2, isNormal: true,  fixedField: 'Q(ζ₇+ζ₇⁻¹)',     fieldDeg: '[L:F] = 2',  baseDeg: '[F:Q] = 3' },
      { id: 'c3',     label: '⟨σ₂⟩ ≅ C₃',  order: 3, isNormal: true,  fixedField: 'Q(√−7)',          fieldDeg: '[L:F] = 3',  baseDeg: '[F:Q] = 2' },
      { id: 'c6',     label: 'C₆',          order: 6, isNormal: true,  fixedField: 'K = Q',            fieldDeg: '[L:Q] = 6',  baseDeg: '[Q:Q] = 1' },
    ],
    subgroupEdges: [
      { from: 'c6', to: 'c2'     },
      { from: 'c6', to: 'c3'     },
      { from: 'c2', to: 'trivial' },
      { from: 'c3', to: 'trivial' },
    ],
    solvability: {
      chain: [{ label: '{e}', order: 1 }, { label: 'C₃', order: 3 }, { label: 'C₆', order: 6 }],
      quotients: ['C₃', 'C₂'],
      solvable: true,
      blockNote: null,
    },
    discriminantTex: String.raw`\text{Gal}(\mathbb{Q}(\zeta_7)/\mathbb{Q})\cong(\mathbb{Z}/7\mathbb{Z})^*\cong C_6`,
    noteEn: 'For prime p=7, (Z/7Z)* is cyclic of order p−1 = 6. All subgroups of C₆ are normal (it is abelian). Three intermediate fields: Q ⊂ Q(√−7) ⊂ Q(ζ₇+ζ₇⁻¹) ⊂ Q(ζ₇).',
    noteZh: '对素数 p=7，(Z/7Z)* 是阶为 p−1=6 的循环群。C₆ 的所有子群均正规（因为是阿贝尔群）。三个中间域：Q ⊂ Q(√−7) ⊂ Q(ζ₇+ζ₇⁻¹) ⊂ Q(ζ₇)。',
  },

  quintic: {
    labelEn: 'x⁵ − 6x + 3 (unsolvable quintic)',
    labelZh: 'x⁵ − 6x + 3（不可解五次方程）',
    galoisGroupEn: 'S₅ (NOT solvable, order 120)',
    galoisGroupZh: 'S₅（不可解，阶 120）',
    galoisGroupTex: 'S_5',
    groupOrder: 120,
    roots: QUINTIC_ROOTS,
    elements: [
      { label: '5-cycle (0 1 2 3 4)',   perm: [1, 2, 3, 4, 0] },
      { label: 'transposition (3 4)',   perm: [0, 1, 2, 4, 3] },
      { label: '(together generate S₅)', perm: [0, 1, 2, 3, 4] },
    ],
    subgroups: [
      { id: 'trivial', label: '{e}',  order: 1,   isNormal: true,  fixedField: 'L (splitting field, deg 120)', fieldDeg: '[L:L] = 1',    baseDeg: '[L:Q] = 120' },
      { id: 'a5',     label: 'A₅',   order: 60,  isNormal: true,  fixedField: 'fixed field of A₅ (deg 2)',    fieldDeg: '[L:F] = 60',   baseDeg: '[F:Q] = 2'   },
      { id: 's5',     label: 'S₅',   order: 120, isNormal: true,  fixedField: 'K = Q',                        fieldDeg: '[L:Q] = 120',  baseDeg: '[Q:Q] = 1'   },
    ],
    subgroupEdges: [
      { from: 's5', to: 'a5'    },
      { from: 'a5', to: 'trivial' },
    ],
    solvability: {
      chain: [{ label: '{e}', order: 1 }, { label: 'A₅', order: 60 }, { label: 'S₅', order: 120 }],
      quotients: ['A₅ (non-abelian simple!)', 'C₂'],
      solvable: false,
      blockNote: 'A₅ is simple and non-abelian: [A₅, A₅] = A₅. The series cannot be refined to have abelian quotients.',
    },
    discriminantTex: String.raw`\text{Gal}(f/\mathbb{Q}) \cong S_5,\quad [S_5,S_5]=A_5,\quad [A_5,A_5]=A_5`,
    noteEn: "Irreducible by Eisenstein (p=3); exactly 3 real roots -> complex conjugation is a transposition; a 5-cycle exists by Cauchy's theorem (5 | |Gal|). Together they generate S₅.",
    noteZh: '由 Eisenstein（p=3）不可约；恰有 3 个实根，故复共轭是对换；5 整除 |Gal|，由 Cauchy 定理存在 5-轮换。两者共同生成 S₅。',
  },
};

const POLY_IDS: PolyId[] = ['x2_minus_2', 'x3_minus_2', 'cyclotomic_5', 'cyclotomic_7', 'quintic'];

// ── Palette for roots ─────────────────────────────────────────────────────────
const ROOT_PALETTE = ['#8B2E3C', '#2A4D69', '#3F7050', '#B8860B', '#6B4E9C', '#C2410C'];

// ── GaloisConnection section ──────────────────────────────────────────────────

export default function GaloisConnection() {
  const lang = useLang();
  return (
    <GTSec id="galois-connection" className="gt-sec">
      <div className="gt-sec-num">§60</div>
      <h2 className="gt-sec-title">
        <L zh="伽罗瓦理论与可解性" en="Galois theory & solvability" />
      </h2>

      <p className="gt-lede">
        <L
          zh={<>
            为什么二次、三次、四次方程有根式求根公式，而一般五次方程没有？19 世纪初，年仅 20 岁的 Évariste Galois
            给出了一个深刻的回答：将每个多项式与一个置换群（<strong>Galois 群</strong>）配对，
            根式可解等价于该群的<strong>可解性</strong>。五次方程的 Galois 群是 <TeX src={String.raw`S_5`} />，
            而 <TeX src={String.raw`S_5`} /> 不可解——因为其中含有非交换单群 <TeX src={String.raw`A_5`} />。
            这也顺带揭示了一个词语陷阱：魔方可以被「解」，但魔方群在群论意义上并<em>不是</em>可解群。
          </>}
          en={<>
            Why do quadratic, cubic, and quartic equations have radical formulas, while the general quintic does not?
            In the early 19th century, Évariste Galois — barely twenty years old — gave a profound answer: attach
            to each polynomial a permutation group (its <strong>Galois group</strong>); the polynomial is
            solvable by radicals if and only if that group is <strong>solvable</strong>. The quintic&apos;s
            Galois group is <TeX src={String.raw`S_5`} />, which is not solvable — because it contains the
            non-abelian simple group <TeX src={String.raw`A_5`} />. This also exposes a word trap: a Rubik&apos;s Cube
            can be &ldquo;solved,&rdquo; but its group is <em>not</em> solvable in the mathematical sense.
          </>}
        />
      </p>

      {/* ── Definition: Galois group ── */}
      <div className="gt-def">
        <div className="gt-def-title">
          <L zh="定义：Galois 扩张与 Galois 群" en="Definition: Galois extension and Galois group" />
        </div>
        <div className="gt-def-body">
          <L
            zh={<>
              设 <TeX src={String.raw`K`} /> 为特征 0 的域（如 <TeX src={String.raw`\mathbb{Q}`} />），
              <TeX src={String.raw`f\in K[x]`} /> 为分离多项式，<TeX src={String.raw`L`} /> 为 <TeX src={String.raw`f`} /> 在 <TeX src={String.raw`K`} /> 上的分裂域。
              当 <TeX src={String.raw`|\!\operatorname{Aut}(L/K)| = [L:K]`} /> 时，称 <TeX src={String.raw`L/K`} /> 为
              <strong>Galois 扩张</strong>（特征 0 下等价于正规扩张）。其
              <strong>Galois 群</strong>为
            </>}
            en={<>
              Let <TeX src={String.raw`K`} /> be a field of characteristic 0 (e.g. <TeX src={String.raw`\mathbb{Q}`} />),
              <TeX src={String.raw`f\in K[x]`} /> a separable polynomial, and <TeX src={String.raw`L`} /> its
              splitting field over <TeX src={String.raw`K`} />. When <TeX src={String.raw`|\operatorname{Aut}(L/K)|=[L:K]`} />,
              we call <TeX src={String.raw`L/K`} /> a <strong>Galois extension</strong> (equivalent to normality in char 0).
              Its <strong>Galois group</strong> is
            </>}
          />
          <TeXBlock src={String.raw`\operatorname{Gal}(L/K) = \operatorname{Aut}(L/K) = \{\,\sigma: L\xrightarrow{\sim} L \mid \sigma|_K = \mathrm{id}\,\}.`} />
          <L
            zh={<>
              每个 <TeX src={String.raw`\sigma`} /> 置换 <TeX src={String.raw`f`} /> 的根，故当 <TeX src={String.raw`f`} /> 有
              <TeX src={String.raw`n`} /> 个不同根时，<TeX src={String.raw`\operatorname{Gal}(f/K)\hookrightarrow S_n`} />；
              当 <TeX src={String.raw`f`} /> 不可约时此嵌入的像是<strong>传递子群</strong>。
            </>}
            en={<>
              Each <TeX src={String.raw`\sigma`} /> permutes the roots of <TeX src={String.raw`f`} />, giving an embedding
              <TeX src={String.raw`\operatorname{Gal}(f/K)\hookrightarrow S_n`} /> when <TeX src={String.raw`f`} /> has
              <TeX src={String.raw`n`} /> distinct roots; the image is a <strong>transitive subgroup</strong> when <TeX src={String.raw`f`} /> is irreducible.
            </>}
          />
        </div>
      </div>

      {/* ── Theorem: FTGT ── */}
      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理（Galois 基本定理）" en="Fundamental Theorem of Galois Theory" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>
              设 <TeX src={String.raw`L/K`} /> 为有限 Galois 扩张，<TeX src={String.raw`G=\operatorname{Gal}(L/K)`} />。
              映射 <TeX src={String.raw`H\mapsto L^H`} />（不动域）和 <TeX src={String.raw`F\mapsto\operatorname{Gal}(L/F)`} /> 是
              <strong>包含反向</strong>的双射，连接 <TeX src={String.raw`G`} /> 的子群格与 <TeX src={String.raw`K\leq F\leq L`} /> 的中间域格。
              具体地：
            </>}
            en={<>
              Let <TeX src={String.raw`L/K`} /> be a finite Galois extension, <TeX src={String.raw`G=\operatorname{Gal}(L/K)`} />.
              The maps <TeX src={String.raw`H\mapsto L^H`} /> (fixed field) and <TeX src={String.raw`F\mapsto\operatorname{Gal}(L/F)`} />
              are mutually inverse, <strong>inclusion-reversing</strong> bijections between the
              subgroup lattice of <TeX src={String.raw`G`} /> and the lattice of intermediate fields <TeX src={String.raw`K\leq F\leq L`} />.
              Explicitly:
            </>}
          />
          <TeXBlock src={String.raw`[L:F] = |\!\operatorname{Gal}(L/F)|, \quad [F:K] = [G:\operatorname{Gal}(L/F)].`} />
          <L
            zh={<>
              <strong>包含反向</strong>是核心要点：子群<em>越大</em>，对应的不动域<em>越小</em>。
              端点为：全群 <TeX src={String.raw`G\leftrightarrow`} /> 底域 <TeX src={String.raw`K`} />；
              平凡群 <TeX src={String.raw`\{e\}\leftrightarrow`} /> 顶域 <TeX src={String.raw`L`} />。
              此外，中间域 <TeX src={String.raw`F`} /> 在 <TeX src={String.raw`K`} /> 上正规（故为 Galois 扩张）当且仅当对应子群
              <TeX src={String.raw`H=\operatorname{Gal}(L/F)`} /> 是 <TeX src={String.raw`G`} /> 的<strong>正规子群</strong>，
              且此时 <TeX src={String.raw`\operatorname{Gal}(F/K)\cong G/H`} />。
            </>}
            en={<>
              <strong>Inclusion-reversing</strong> is the key point: a <em>larger</em> subgroup
              corresponds to a <em>smaller</em> fixed field. The endpoints: the whole group
              <TeX src={String.raw`G\leftrightarrow`} /> base field <TeX src={String.raw`K`} />;
              trivial group <TeX src={String.raw`\{e\}\leftrightarrow`} /> top field <TeX src={String.raw`L`} />.
              Moreover, an intermediate field <TeX src={String.raw`F`} /> is normal (Galois) over <TeX src={String.raw`K`} /> iff the
              corresponding subgroup <TeX src={String.raw`H=\operatorname{Gal}(L/F)`} /> is a <strong>normal subgroup</strong>
              of <TeX src={String.raw`G`} />, and then <TeX src={String.raw`\operatorname{Gal}(F/K)\cong G/H`} />.
            </>}
          />
        </div>
      </div>

      {/* ── Panel 1: Roots in complex plane + group permutations ── */}
      <RootsPermutationPanel lang={lang} />

      {/* ── Prose: solvability criterion ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="根式可解准则与 Abel-Ruffini 定理" en="Solvability criterion & Abel-Ruffini" />
      </h3>

      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理（Galois 可解准则）" en="Theorem (Galois solvability criterion)" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>
              设 <TeX src={String.raw`\operatorname{char}(K)=0`} />，<TeX src={String.raw`f\in K[x]`} />。则 <TeX src={String.raw`f`} /> 可用根式求解
              当且仅当 <TeX src={String.raw`\operatorname{Gal}(f/K)`} /> 是<strong>可解群</strong>（存在次正规链
              <TeX src={String.raw`\{e\}=G_0\trianglelefteq G_1\trianglelefteq\cdots\trianglelefteq G_n=G`} />，每个商
              <TeX src={String.raw`G_{i+1}/G_i`} /> 均为阿贝尔群）。
              因此 <TeX src={String.raw`n`} /> 次一般方程（Galois 群为 <TeX src={String.raw`S_n`} />）有根式公式当且仅当
              <TeX src={String.raw`S_n`} /> 可解，即 <TeX src={String.raw`n\leq 4`} />。
            </>}
            en={<>
              Let <TeX src={String.raw`\operatorname{char}(K)=0`} /> and <TeX src={String.raw`f\in K[x]`} />. Then <TeX src={String.raw`f`} /> is
              solvable by radicals if and only if <TeX src={String.raw`\operatorname{Gal}(f/K)`} /> is a
              <strong>solvable group</strong> (there is a subnormal chain
              <TeX src={String.raw`\{e\}=G_0\trianglelefteq G_1\trianglelefteq\cdots\trianglelefteq G_n=G`} />
              with each quotient <TeX src={String.raw`G_{i+1}/G_i`} /> abelian).
              Hence the general degree-<TeX src={String.raw`n`} /> equation (Galois group <TeX src={String.raw`S_n`} />) has a radical formula
              iff <TeX src={String.raw`S_n`} /> is solvable, iff <TeX src={String.raw`n\leq 4`} />.
            </>}
          />
        </div>
      </div>

      <p>
        <L
          zh={<>
            <strong>Abel-Ruffini 定理</strong>（1799/1824）的群论证明：
            <TeX src={String.raw`[S_5,S_5]=A_5`} />，而 <TeX src={String.raw`[A_5,A_5]=A_5`} />（<TeX src={String.raw`A_5`} /> 是阶为 60
            的<em>单群</em>，也是最小的非交换单群，因此导出列在 <TeX src={String.raw`A_5`} /> 处永远停滞）。
            注意：Abel-Ruffini 说的是「不存在适用于所有五次方程的统一根式公式」，
            而<em>不是</em>说每个特定五次方程都无法用根式求解。例如
            <TeX src={String.raw`x^5-2`} /> 的 Galois 群是 20 阶可解群，故其根 <TeX src={String.raw`\sqrt[5]{2}`} /> 是根式表达式。
          </>}
          en={<>
            The group-theoretic proof of <strong>Abel-Ruffini</strong> (1799/1824):
            <TeX src={String.raw`[S_5,S_5]=A_5`} />, and <TeX src={String.raw`[A_5,A_5]=A_5`} /> (since <TeX src={String.raw`A_5`} /> is
            <em>simple</em> of order 60 — the smallest non-abelian simple group — the derived series stalls at <TeX src={String.raw`A_5`} /> forever).
            Caution: Abel-Ruffini says there is no <em>single radical formula</em> valid for all quintics — not that every
            individual quintic is unsolvable. For instance <TeX src={String.raw`x^5-2`} /> has a solvable Galois group (order 20),
            and its root <TeX src={String.raw`\sqrt[5]{2}`} /> is a radical expression.
          </>}
        />
      </p>

      {/* ── Panel 2: Lattice + solvability verdict ── */}
      <LatticeAndVerdictPanel lang={lang} />

      {/* ── Cube connection ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="两种「可解」：词语陷阱" en="Two meanings of 'solvable': a word trap" />
      </h3>

      <p>
        <L
          zh={<>
            魔方可以被「还原」（solved），但魔方群在群论意义上<strong>不是可解群</strong>。
            魔方群的阶为
          </>}
          en={<>
            A Rubik&apos;s Cube can be &ldquo;solved&rdquo; (restored to its initial state), but the
            Rubik&apos;s Cube group is <strong>not a solvable group</strong> in the mathematical sense.
            The cube group has order
          </>}
        />
      </p>
      <TeXBlock src={String.raw`|G_{\text{cube}}| = 2^{27}\cdot 3^{14}\cdot 5^3\cdot 7^2\cdot 11 \;=\; 43{,}252{,}003{,}274{,}489{,}856{,}000.`} />
      <p>
        <L
          zh={<>
            其组合因子包含 <TeX src={String.raw`A_8`} /> 和 <TeX src={String.raw`A_{12}`} />——这是两个非交换单群（<TeX src={String.raw`n\geq 5`} /> 时
            <TeX src={String.raw`A_n`} /> 均为非交换单群）。组合因子中含非交换单群，意味着无法把导出列化为全由阿贝尔群商组成的链，
            故群论意义上不可解。这里的「不可解」与五次方程的结构性障碍完全相同——<TeX src={String.raw`A_n`} /> 单性正是根式不可解的代数根源。
            下面的面板帮助区分这两种用法。
          </>}
          en={<>
            Its composition factors include <TeX src={String.raw`A_8`} /> and <TeX src={String.raw`A_{12}`} /> — both non-abelian
            simple groups (<TeX src={String.raw`A_n`} /> is non-abelian simple for every <TeX src={String.raw`n\geq 5`} />). A group
            with a non-abelian simple composition factor cannot have its derived series refined to abelian quotients, hence
            it is not solvable in the Galois sense. The obstruction is identical to that of the quintic: simplicity of
            <TeX src={String.raw`A_n`} /> is the algebraic root of radical insolvability. The panel below disambiguates the two uses.
          </>}
        />
      </p>

      {/* ── Panel 3: Cube vs Galois disambiguator ── */}
      <CubeDisambiguatorPanel lang={lang} />

      {/* ── References ── */}
      <div style={{ marginTop: 40 }}>
        <div className="gt-def-title" style={{ marginBottom: 10 }}>
          <L zh="参考文献" en="References" />
        </div>
        <ol style={{ fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.7, color: 'var(--ink-dim)', paddingLeft: 24 }}>
          <li>Dummit &amp; Foote, <em>Abstract Algebra</em>, 3rd ed., Ch. 14 (§14.2 FTGT, §14.5 Cyclotomic, §14.7 Solvable extensions &amp; insolvability of the quintic).</li>
          <li>Keith Conrad, <em>Galois groups of cubics and quartics</em>; <em>Cyclotomic extensions</em>. <a href="https://kconrad.math.uconn.edu/blurbs/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>kconrad.math.uconn.edu</a></li>
          <li>Wikipedia, <a href="https://en.wikipedia.org/wiki/Fundamental_theorem_of_Galois_theory" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>Fundamental theorem of Galois theory</a>.</li>
          <li>Groupprops, <a href="https://groupprops.subwiki.org/wiki/A5_is_the_unique_simple_non-abelian_group_of_smallest_order" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>A5 is the unique simple non-abelian group of smallest order</a>.</li>
          <li>David Joyner, <em>Adventures in Group Theory</em>, 2nd ed. (Johns Hopkins UP, 2008) — Rubik&apos;s Cube group structure.</li>
        </ol>
      </div>
    </GTSec>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Panel 1: Complex-plane roots + permutation arrows
// ═════════════════════════════════════════════════════════════════════════════

function RootsPermutationPanel({ lang }: { lang: Lang }) {
  const [polyId, setPolyId] = useState<PolyId>('x3_minus_2');
  const [elemIdx, setElemIdx] = useState(0);

  const handlePolyChange = useCallback((id: PolyId) => {
    setPolyId(id);
    setElemIdx(0);
  }, []);

  const data = POLY_DATA[polyId];
  const elem = data.elements[elemIdx];

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="复平面上的根与 Galois 置换" en="Roots in the complex plane & Galois permutations" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="选择多项式，再选一个 Galois 群元素，查看它如何在复平面上置换各根（箭头从原位置指向像）。"
          en="Choose a polynomial, then a Galois group element, to see how it permutes the roots in the complex plane (arrows from each root to its image)."
        />
      </div>

      {/* Polynomial selector */}
      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-dim)', alignSelf: 'center' }}>
          <L zh="多项式" en="Polynomial" />
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {POLY_IDS.map(id => (
            <button
              key={id}
              className={`gt-chip${polyId === id ? ' gt-chip-active' : ''}`}
              onClick={() => handlePolyChange(id)}
            >
              {lang === 'zh' ? POLY_DATA[id].labelZh : POLY_DATA[id].labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* Group element selector */}
      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-dim)', alignSelf: 'center' }}>
          <L zh="自同构 σ" en="Automorphism σ" />
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {data.elements.map((e, i) => (
            <button
              key={i}
              className={`gt-chip${elemIdx === i ? ' gt-chip-active' : ''}`}
              onClick={() => setElemIdx(i)}
            >
              {e.label}
            </button>
          ))}
        </div>
      </div>

      {/* SVG complex plane */}
      <ComplexPlaneSVG roots={data.roots} perm={elem.perm} lang={lang} />

      {/* Info row */}
      <div className="gt-panel-result">
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="Galois 群" en="Galois group" />
          </span>
          <span className="gt-result-val-strong">
            <TeX src={data.galoisGroupTex} />
            {' — '}
            {lang === 'zh' ? data.galoisGroupZh : data.galoisGroupEn}
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="判别式" en="Discriminant" />
          </span>
          <span className="gt-result-val" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
            <TeX src={data.discriminantTex} />
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="注记" en="Note" />
          </span>
          <span className="gt-result-val" style={{ fontSize: 13 }}>
            {lang === 'zh' ? data.noteZh : data.noteEn}
          </span>
        </div>
      </div>
    </div>
  );
}

function ComplexPlaneSVG({ roots, perm, lang }: { roots: RootDef[]; perm: number[]; lang: Lang }) {
  const W = 340, H = 300;
  const cx = W / 2, cy = H / 2;

  // Determine scale from roots
  const maxAbs = roots.reduce((m, r) => Math.max(m, Math.abs(r.re), Math.abs(r.im)), 0.1);
  const scale = Math.min((W / 2 - 36) / maxAbs, (H / 2 - 36) / maxAbs);

  const sx = (re: number) => cx + re * scale;
  const sy = (im: number) => cy - im * scale;

  const isIdentity = perm.every((v, i) => v === i);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', margin: '12px 0', background: 'var(--bg-elev)', borderRadius: 6, maxWidth: W }}>
      <defs>
        {roots.map((_, i) => (
          <marker key={i} id={`gal-arr-${i}`} markerWidth={8} markerHeight={8} refX={6} refY={4} orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill={ROOT_PALETTE[i % ROOT_PALETTE.length]} />
          </marker>
        ))}
      </defs>

      {/* Axes */}
      <line x1={8} y1={cy} x2={W - 8} y2={cy} stroke="var(--rule)" strokeWidth={1} />
      <line x1={cx} y1={8} x2={cx} y2={H - 8} stroke="var(--rule)" strokeWidth={1} />
      <text x={W - 10} y={cy - 4} textAnchor="end" style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--ink-faint)">Re</text>
      <text x={cx + 4} y={14} style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--ink-faint)">Im</text>

      {/* Unit circle hint */}
      {roots.every(r => Math.abs(r.re * r.re + r.im * r.im - 1) < 0.05) && (
        <circle cx={cx} cy={cy} r={scale} stroke="var(--rule)" strokeWidth={0.5} fill="none" strokeDasharray="3 3" />
      )}

      {/* Permutation arrows (bezier curves) */}
      {!isIdentity && roots.map((r, i) => {
        const dest = perm[i];
        if (dest === i) return null;
        const x1 = sx(r.re), y1 = sy(r.im);
        const x2 = sx(roots[dest].re), y2 = sy(roots[dest].im);
        // Control point: perpendicular offset for a gentle curve
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const cpx = mx - (dy / len) * 28, cpy = my + (dx / len) * 28;
        return (
          <path
            key={i}
            d={`M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`}
            fill="none"
            stroke={ROOT_PALETTE[i % ROOT_PALETTE.length]}
            strokeWidth={1.8}
            strokeDasharray="5 2"
            markerEnd={`url(#gal-arr-${i})`}
            opacity={0.85}
          />
        );
      })}

      {/* Root dots */}
      {roots.map((r, i) => {
        const x = sx(r.re), y = sy(r.im);
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={7} fill={ROOT_PALETTE[i % ROOT_PALETTE.length]} opacity={0.9} />
            <text x={x} y={y + 4} textAnchor="middle"
              style={{ fontFamily: 'var(--mono)', fontSize: 8, fontWeight: 700 }} fill="white">
              {i}
            </text>
            <text x={x + 10} y={y - 6}
              style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill={ROOT_PALETTE[i % ROOT_PALETTE.length]}>
              {r.label}
            </text>
          </g>
        );
      })}

      {/* Identity label */}
      {isIdentity && (
        <text x={W / 2} y={H - 8} textAnchor="middle"
          style={{ fontFamily: 'var(--mono)', fontSize: 10 }} fill="var(--ink-faint)">
          {tr({ zh: '恒等置换：每根不动', en: 'Identity: every root is fixed',
              zhHant: "恆等置換：每根不動"
        })}
        </text>
      )}
    </svg>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Panel 2: Subgroup/subfield lattice + solvability verdict
// ═════════════════════════════════════════════════════════════════════════════

function LatticeAndVerdictPanel({ lang }: { lang: Lang }) {
  const [polyId, setPolyId] = useState<PolyId>('x3_minus_2');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showNormal, setShowNormal] = useState(true);
  const [seriesStep, setSeriesStep] = useState<number>(0);

  const data = POLY_DATA[polyId];
  const solv = data.solvability;
  const maxStep = solv.chain.length - 1;

  const handlePolyChange = useCallback((id: PolyId) => {
    setPolyId(id);
    setHoveredId(null);
    setSeriesStep(0);
  }, []);

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="子群/子域格（基本定理）与根式可解判定" en="Subgroup/subfield lattice (FTGT) & solvability verdict" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="悬停或点击子群节点，高亮其对应的不动域（注意：包含反向！大子群 ↔ 小不动域）。右侧显示导出列。"
          en="Hover or click a subgroup node to highlight its fixed field (note: inclusion-reversing — larger subgroup ↔ smaller fixed field). The right column shows the derived series."
        />
      </div>

      {/* Polynomial selector */}
      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-dim)', alignSelf: 'center' }}>
          <L zh="多项式" en="Polynomial" />
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {POLY_IDS.map(id => (
            <button
              key={id}
              className={`gt-chip${polyId === id ? ' gt-chip-active' : ''}`}
              onClick={() => handlePolyChange(id)}
            >
              {lang === 'zh' ? POLY_DATA[id].labelZh : POLY_DATA[id].labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* Toggle normal highlighting */}
      <div className="gt-panel-input-row">
        <button
          className={`gt-chip${showNormal ? ' gt-chip-active' : ''}`}
          onClick={() => setShowNormal(s => !s)}
        >
          <L zh="高亮正规子群" en="Highlight normal subgroups" />
        </button>
      </div>

      {/* Two-column lattice SVG */}
      <LatticeSVG
        subgroups={data.subgroups}
        edges={data.subgroupEdges}
        hoveredId={hoveredId}
        setHoveredId={setHoveredId}
        showNormal={showNormal}
        lang={lang}
      />

      {/* Hovered node info */}
      {hoveredId && (() => {
        const node = data.subgroups.find(s => s.id === hoveredId);
        if (!node) return null;
        return (
          <div style={{
            marginTop: 8, padding: '10px 14px', borderRadius: 6,
            background: 'var(--bg-elev)', border: '1px solid var(--rule)',
            fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink)',
          }}>
            <strong>{node.label}</strong>
            {' → '}
            <L zh="不动域" en="fixed field" />
            {': '}
            <strong>{node.fixedField}</strong>
            {'  '}
            <span style={{ color: 'var(--ink-faint)' }}>
              {node.fieldDeg} | {node.baseDeg}
            </span>
            {node.isNormal && (
              <span style={{ marginLeft: 10, color: 'var(--green)', fontWeight: 700 }}>
                <L zh="正规" en="normal" />
              </span>
            )}
          </div>
        );
      })()}

      {/* Solvability series stepper */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>
          <L zh="导出列（可解性证明）" en="Derived series (solvability proof)" />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <button className="gt-btn" disabled={seriesStep >= maxStep} onClick={() => setSeriesStep(s => Math.min(s + 1, maxStep))}>
            <L zh="下一步 →" en="Next →" />
          </button>
          <button className="gt-btn-ghost gt-btn" disabled={seriesStep === 0} onClick={() => setSeriesStep(0)}>
            <L zh="重置" en="Reset" />
          </button>
          <button className="gt-btn-ghost gt-btn" disabled={seriesStep >= maxStep} onClick={() => setSeriesStep(maxStep)}>
            <L zh="全部展开" en="Show all" />
          </button>
        </div>
        <SolvabilityChainSVG solv={solv} step={seriesStep} lang={lang} />
      </div>
    </div>
  );
}

// Layout for subgroup/field lattice
// Left column: subgroup Hasse diagram (top=G, bottom={e})
// Right column: fixed field lattice, flipped (top=K, bottom=L) — mirrors the reversal
function LatticeSVG({
  subgroups, edges, hoveredId, setHoveredId, showNormal, lang,
}: {
  subgroups: SubgroupNode[];
  edges: SubgroupEdge[];
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
  showNormal: boolean;
  lang: Lang;
}) {
  // Assign Y positions by order (top=largest, bottom=smallest) for subgroups
  // For fields: top=smallest (K), bottom=largest (L)
  const sortedByOrder = [...subgroups].sort((a, b) => b.order - a.order);
  const uniqueOrders = [...new Set(sortedByOrder.map(s => s.order))];

  const ROW_H = 72, NODE_W = 130, NODE_H = 44;
  const COL_GAP = 70;
  const LEFT_X = 20, RIGHT_X = LEFT_X + NODE_W + COL_GAP;
  const W = RIGHT_X + NODE_W + 20;
  const rows = uniqueOrders.length;
  const H = rows * ROW_H + 40;

  // Y of a node: by rank in order list (largest at top, smallest at bottom for subgroups)
  // For fields (reversed): largest at bottom, smallest at top
  const subgroupYMap: Record<string, number> = {};
  const fieldYMap: Record<string, number> = {};
  subgroups.forEach(s => {
    const rankFromTop = uniqueOrders.indexOf(s.order);   // 0=top (largest)
    subgroupYMap[s.id] = 20 + rankFromTop * ROW_H;
    // Field is reversed: largest order subgroup -> fixed field is smallest -> top
    fieldYMap[s.id] = 20 + rankFromTop * ROW_H;
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%"
      style={{ display: 'block', margin: '10px 0', overflow: 'visible', userSelect: 'none', maxWidth: W }}>

      {/* Column headers */}
      <text x={LEFT_X + NODE_W / 2} y={14} textAnchor="middle"
        style={{ fontFamily: 'var(--mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '.1em' }} fill="var(--ink-faint)">
        {tr({ zh: '子群 (大→小)', en: 'Subgroups (large→small)' })}
      </text>
      <text x={RIGHT_X + NODE_W / 2} y={14} textAnchor="middle"
        style={{ fontFamily: 'var(--mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '.1em' }} fill="var(--ink-faint)">
        {tr({ zh: '不动域 (小→大)', en: 'Fixed fields (small→large)',
            zhHant: "不動域 (小→大)"
        })}
      </text>

      {/* Subgroup edges */}
      {edges.map((e, idx) => {
        const fromY = subgroupYMap[e.from] + NODE_H;
        const toY = subgroupYMap[e.to];
        const fromX = LEFT_X + NODE_W / 2;
        return (
          <line key={idx} x1={fromX} y1={fromY} x2={fromX} y2={toY}
            stroke="var(--rule)" strokeWidth={1} />
        );
      })}

      {/* Field edges (same structure but on right column, same Y mapping) */}
      {edges.map((e, idx) => {
        // In the subgroup lattice, from->to means from contains to (from is larger).
        // In the field lattice, fixed(from) is SMALLER (lower in the column = higher Y).
        // The field lattice has K at top, L at bottom. So we need to draw edge
        // from fixed(e.from) UP to fixed(e.to)... but they share the same Y rank.
        // Actually we keep same Y for matching pair: field of smaller subgroup is at same Y as that subgroup.
        const fromY = fieldYMap[e.from] + NODE_H;
        const toY = fieldYMap[e.to];
        const fromX = RIGHT_X + NODE_W / 2;
        return (
          <line key={`f${idx}`} x1={fromX} y1={fromY} x2={fromX} y2={toY}
            stroke="var(--rule)" strokeWidth={1} />
        );
      })}

      {/* Cross-connection for hovered node */}
      {hoveredId && (() => {
        const node = subgroups.find(s => s.id === hoveredId);
        if (!node) return null;
        const ly = subgroupYMap[hoveredId] + NODE_H / 2;
        const ry = fieldYMap[hoveredId] + NODE_H / 2;
        return (
          <line
            x1={LEFT_X + NODE_W} y1={ly}
            x2={RIGHT_X} y2={ry}
            stroke="var(--gold)" strokeWidth={1.5} strokeDasharray="5 3"
          />
        );
      })()}

      {/* Subgroup nodes */}
      {subgroups.map(s => {
        const x = LEFT_X, y = subgroupYMap[s.id];
        const isHovered = hoveredId === s.id;
        const isNormHighlight = showNormal && s.isNormal;
        const stroke = isHovered ? 'var(--gold)' : isNormHighlight ? 'var(--green)' : 'var(--rule)';
        const bg = isHovered
          ? 'color-mix(in srgb, var(--gold) 15%, var(--bg-elev))'
          : isNormHighlight
          ? 'color-mix(in srgb, var(--green) 10%, var(--bg-elev))'
          : 'var(--bg-elev)';
        return (
          <g key={s.id}
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHoveredId(s.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => setHoveredId(hoveredId === s.id ? null : s.id)}
          >
            <rect x={x} y={y} width={NODE_W} height={NODE_H} rx={5}
              fill={bg} stroke={stroke} strokeWidth={isHovered ? 2 : 1.5} />
            <text x={x + NODE_W / 2} y={y + 18} textAnchor="middle"
              style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600 }} fill="var(--ink)">
              {s.label}
            </text>
            <text x={x + NODE_W / 2} y={y + 34} textAnchor="middle"
              style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--ink-faint)">
              |H| = {s.order}
            </text>
          </g>
        );
      })}

      {/* Field nodes (reversed: subgroup of order n at Y -> fixed field of that subgroup at same Y) */}
      {subgroups.map(s => {
        const x = RIGHT_X, y = fieldYMap[s.id];
        const isHovered = hoveredId === s.id;
        const isNormHighlight = showNormal && s.isNormal;
        const stroke = isHovered ? 'var(--gold)' : isNormHighlight ? 'var(--green)' : 'var(--rule)';
        const bg = isHovered
          ? 'color-mix(in srgb, var(--gold) 15%, var(--bg-elev))'
          : isNormHighlight
          ? 'color-mix(in srgb, var(--green) 10%, var(--bg-elev))'
          : 'var(--bg-elev)';
        return (
          <g key={`f_${s.id}`}
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHoveredId(s.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => setHoveredId(hoveredId === s.id ? null : s.id)}
          >
            <rect x={x} y={y} width={NODE_W} height={NODE_H} rx={5}
              fill={bg} stroke={stroke} strokeWidth={isHovered ? 2 : 1.5} />
            <text x={x + NODE_W / 2} y={y + 18} textAnchor="middle"
              style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600 }} fill="var(--ink)">
              {s.fixedField}
            </text>
            <text x={x + NODE_W / 2} y={y + 34} textAnchor="middle"
              style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--ink-faint)">
              {s.baseDeg}
            </text>
          </g>
        );
      })}

      {/* Reversal label */}
      <text x={W / 2} y={H - 2} textAnchor="middle"
        style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--ink-faint)">
        {tr({ zh: '← 包含反向 ↔ 子群越大 = 不动域越小 →', en: '← inclusion-reversing: bigger subgroup = smaller fixed field →',
            zhHant: "← 包含反向 ↔ 子群越大 = 不動域越小 →"
        })}
      </text>
    </svg>
  );
}

function SolvabilityChainSVG({ solv, step, lang }: { solv: SolvabilitySeries; step: number; lang: Lang }) {
  const chain = solv.chain.slice(0).reverse(); // bottom-up: {e}, ..., G
  const revealed = chain.slice(0, step + 1);
  const BOX_W = 120, BOX_H = 44, ARROW_H = 36;
  const W = BOX_W + 120;
  const H = revealed.length * (BOX_H + ARROW_H) + 10;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', margin: '0 0 8px', maxWidth: W }}>
      <defs>
        <marker id="sv-arr-ok" markerWidth={8} markerHeight={8} refX={4} refY={4} orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="var(--green)" />
        </marker>
        <marker id="sv-arr-fail" markerWidth={8} markerHeight={8} refX={4} refY={4} orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="var(--warn)" />
        </marker>
      </defs>
      {revealed.map((term, i) => {
        const y = (revealed.length - 1 - i) * (BOX_H + ARROW_H) + 4;
        const quotient = i > 0 ? solv.quotients[chain.indexOf(revealed[i - 1])] : null;
        const isLastQuotient = quotient !== null && !solv.solvable && i === revealed.length - 1;
        const arrowColor = isLastQuotient ? 'var(--warn)' : 'var(--green)';
        const boxColor = term.order === 1
          ? 'color-mix(in srgb, var(--green) 15%, var(--bg-elev))'
          : (!solv.solvable && i === revealed.length - 1 && i > 0)
          ? 'color-mix(in srgb, var(--warn) 10%, var(--bg-elev))'
          : 'var(--bg-elev)';
        const boxStroke = term.order === 1 ? 'var(--green)'
          : (!solv.solvable && i === revealed.length - 1 && i > 0) ? 'var(--warn)'
          : 'var(--rule)';
        return (
          <g key={i}>
            <rect x={4} y={y} width={BOX_W} height={BOX_H} rx={5}
              fill={boxColor} stroke={boxStroke} strokeWidth={1.5} />
            <text x={4 + BOX_W / 2} y={y + 18} textAnchor="middle"
              style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600 }} fill="var(--ink)">
              {term.label}
            </text>
            <text x={4 + BOX_W / 2} y={y + 34} textAnchor="middle"
              style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--ink-faint)">
              |·| = {term.order}
            </text>
            {/* Arrow above (toward next term = bigger group) */}
            {i < revealed.length - 1 && (
              <>
                <line
                  x1={4 + BOX_W / 2} y1={y - ARROW_H + 2}
                  x2={4 + BOX_W / 2} y2={y - 4}
                  stroke={arrowColor} strokeWidth={1.5}
                  markerEnd={isLastQuotient ? 'url(#sv-arr-fail)' : 'url(#sv-arr-ok)'}
                />
                {quotient && (
                  <text x={4 + BOX_W + 6} y={y - ARROW_H / 2 + 4}
                    style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600 }}
                    fill={isLastQuotient ? 'var(--warn)' : 'var(--green)'}>
                    {quotient}
                  </text>
                )}
              </>
            )}
          </g>
        );
      })}
      {/* Verdict */}
      {step >= solv.chain.length - 1 && (
        <text x={4} y={H - 2}
          style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700 }}
          fill={solv.solvable ? 'var(--green)' : 'var(--warn)'}>
          {solv.solvable
            ? (tr({ zh: '✓ 可用根式求解', en: '✓ Solvable by radicals' }))
            : (tr({ zh: '✗ 不可用根式求解 (A₅ 是单群)', en: '✗ NOT solvable by radicals (A₅ is simple)',
                zhHant: "✗ 不可用根式求解 (A₅ 是單群)"
            }))}
        </text>
      )}
    </svg>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Panel 3: Cube vs Galois "solvable" disambiguator
// ═════════════════════════════════════════════════════════════════════════════

type DisambigView = 'puzzle' | 'group';

interface CompositionFactor {
  label: string;
  order: string;
  isSimpleNonAbelian: boolean;
  noteEn: string;
  noteZh: string;
}

const CUBE_FACTORS: CompositionFactor[] = [
  { label: 'Z/2', order: '2', isSimpleNonAbelian: false, noteEn: 'cyclic (abelian) — from edge-flip orientations', noteZh: '循环群（阿贝尔）——棱翻转朝向' },
  { label: 'Z/3', order: '3', isSimpleNonAbelian: false, noteEn: 'cyclic (abelian) — from corner-twist orientations', noteZh: '循环群（阿贝尔）——角朝向' },
  { label: 'A₈',  order: '8!/2 = 20160', isSimpleNonAbelian: true,  noteEn: 'simple non-abelian! (even permutations of 8 corners)', noteZh: '非交换单群！（8 个角块的偶置换）' },
  { label: 'A₁₂', order: '12!/2 ≈ 2.4×10⁸', isSimpleNonAbelian: true, noteEn: 'simple non-abelian! (even permutations of 12 edges)', noteZh: '非交换单群！（12 个棱块的偶置换）' },
];

function CubeDisambiguatorPanel({ lang }: { lang: Lang }) {
  const [view, setView] = useState<DisambigView>('puzzle');
  const [revealedFactors, setRevealedFactors] = useState(0);

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="两种「可解」的对比" en="Two meanings of 'solvable': side by side" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="魔方可被「还原」（puzzle-solvable），但魔方群不是可解群（not group-solvable）。组合因子 A₈ 和 A₁₂ 是关键障碍。"
          en="A cube can be puzzle-solved, but the cube group is not group-solvable. The composition factors A₈ and A₁₂ are the structural obstruction."
        />
      </div>

      {/* Toggle */}
      <div className="gt-panel-input-row">
        <button
          className={`gt-chip${view === 'puzzle' ? ' gt-chip-active' : ''}`}
          onClick={() => setView('puzzle')}
        >
          <L zh="还原意义（谜题可解）" en="Puzzle-solvable" />
        </button>
        <button
          className={`gt-chip${view === 'group' ? ' gt-chip-active' : ''}`}
          onClick={() => { setView('group'); setRevealedFactors(0); }}
        >
          <L zh="群论意义（Galois 可解）" en="Group-solvable (Galois)" />
        </button>
      </div>

      {view === 'puzzle' ? (
        <PuzzleSolvableView lang={lang} />
      ) : (
        <GroupSolvableView lang={lang} revealedFactors={revealedFactors} setRevealedFactors={setRevealedFactors} />
      )}
    </div>
  );
}

function PuzzleSolvableView({ lang }: { lang: Lang }) {
  return (
    <div>
      <svg viewBox="0 0 340 140" width="100%" style={{ display: 'block', margin: '12px 0', maxWidth: 340 }}>
        {/* Two boxes side by side */}
        {/* Box: "scrambled cube" */}
        <rect x={10} y={20} width={140} height={90} rx={8} fill="color-mix(in srgb, var(--accent-2) 10%, var(--bg-elev))" stroke="var(--accent-2)" strokeWidth={1.5} />
        <text x={80} y={44} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600 }} fill="var(--accent-2)">
          {tr({ zh: '打乱状态', en: 'Scrambled state',
              zhHant: "打亂狀態"
        })}
        </text>
        <text x={80} y={62} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--ink-faint)">
          {tr({ zh: '任意置换 ∈ G_cube', en: 'any permutation ∈ G_cube',
              zhHant: "任意置換 ∈ G_cube"
        })}
        </text>
        <text x={80} y={98} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--ink-faint)">
          |G| = 4.3 × 10¹⁹
        </text>

        {/* Arrow with label "20 moves (God's number)" */}
        <line x1={150} y1={65} x2={188} y2={65} stroke="var(--green)" strokeWidth={2} markerEnd="url(#puzzle-arr)" />
        <defs>
          <marker id="puzzle-arr" markerWidth={8} markerHeight={8} refX={6} refY={4} orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="var(--green)" />
          </marker>
        </defs>
        <text x={169} y={58} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 8 }} fill="var(--green)">
          {tr({ zh: '≤ 20 步', en: '≤ 20 moves' })}
        </text>
        <text x={169} y={78} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 8 }} fill="var(--ink-faint)">
          {tr({ zh: '（上帝之数）', en: "(God's number)",
              zhHant: "（上帝之數）"
        })}
        </text>

        {/* Box: solved */}
        <rect x={190} y={20} width={140} height={90} rx={8} fill="color-mix(in srgb, var(--green) 10%, var(--bg-elev))" stroke="var(--green)" strokeWidth={1.5} />
        <text x={260} y={44} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600 }} fill="var(--green)">
          {tr({ zh: '还原状态', en: 'Solved state',
              zhHant: "還原狀態"
        })}
        </text>
        <text x={260} y={62} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--ink-faint)">
          {tr({ zh: '单位元 e ∈ G_cube', en: 'identity e ∈ G_cube',
              zhHant: "單位元 e ∈ G_cube"
        })}
        </text>
        <text x={260} y={80} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--green)">
          {tr({ zh: '可达！(puzzle-solved)', en: 'Reachable! (puzzle-solved)',
              zhHant: "可達！(puzzle-solved)"
        })}
        </text>
      </svg>
      <p style={{ fontFamily: 'var(--serif)', fontSize: 14, color: 'var(--ink-dim)', lineHeight: 1.6 }}>
        <L
          zh={<>
            魔方是「谜题可解」的：从任意状态出发，至多 20 步（上帝之数，Rokicki 等人 2010 年证明）即可还原到单位元。
            这是群论关于连通性的命题（群 <TeX src={String.raw`G_\text{cube}`} /> 由 6 个生成元生成），与可解性无关。
          </>}
          en={<>
            The cube is puzzle-solvable: from any state, at most 20 moves (God&apos;s Number, proved by Rokicki et al. 2010) return it
            to the identity. This is a group-theoretic statement about connectivity (the group <TeX src={String.raw`G_\text{cube}`} /> is generated
            by 6 generators), not about solvability.
          </>}
        />
      </p>
    </div>
  );
}

function GroupSolvableView({
  lang, revealedFactors, setRevealedFactors,
}: {
  lang: Lang;
  revealedFactors: number;
  setRevealedFactors: (n: number) => void;
}) {
  const shown = CUBE_FACTORS.slice(0, revealedFactors);
  const hasBlocker = shown.some(f => f.isSimpleNonAbelian);

  return (
    <div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 14, color: 'var(--ink-dim)', lineHeight: 1.6, marginBottom: 12 }}>
        <L
          zh={<>
            要判断 <TeX src={String.raw`G_\text{cube}`} /> 是否为可解群，需看其<strong>组合因子</strong>（composition factors）：
            若所有组合因子均为素阶循环群，则可解；否则不可解。点击「展开因子」逐一查看。
          </>}
          en={<>
            To check if <TeX src={String.raw`G_\text{cube}`} /> is group-solvable, we examine its <strong>composition factors</strong>:
            if every factor is cyclic of prime order, the group is solvable; otherwise not. Click &ldquo;Reveal factor&rdquo; to inspect them one by one.
          </>}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button
          className="gt-btn"
          disabled={revealedFactors >= CUBE_FACTORS.length}
          onClick={() => setRevealedFactors(Math.min(revealedFactors + 1, CUBE_FACTORS.length))}
        >
          <L zh="展开因子 →" en="Reveal factor →" />
        </button>
        <button className="gt-btn-ghost gt-btn" disabled={revealedFactors === 0} onClick={() => setRevealedFactors(0)}>
          <L zh="重置" en="Reset" />
        </button>
      </div>

      {/* Factor chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {CUBE_FACTORS.map((f, i) => {
          const visible = i < revealedFactors;
          return (
            <div key={i} style={{
              padding: '8px 14px', borderRadius: 6,
              background: !visible
                ? 'var(--bg-deep)'
                : f.isSimpleNonAbelian
                ? 'color-mix(in srgb, var(--warn) 18%, var(--bg-elev))'
                : 'color-mix(in srgb, var(--green) 12%, var(--bg-elev))',
              border: `1.5px solid ${!visible ? 'var(--rule)' : f.isSimpleNonAbelian ? 'var(--warn)' : 'var(--green)'}`,
              fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700,
              color: !visible ? 'var(--ink-faint)' : f.isSimpleNonAbelian ? 'var(--warn)' : 'var(--green)',
              minWidth: 60, textAlign: 'center' as const,
            }}>
              {visible ? f.label : '?'}
              {visible && (
                <div style={{ fontWeight: 400, fontSize: 9, marginTop: 2, color: 'var(--ink-faint)' }}>
                  |·| = {f.order}
                </div>
              )}
              {visible && f.isSimpleNonAbelian && (
                <div style={{ fontWeight: 700, fontSize: 9, marginTop: 2, color: 'var(--warn)' }}>
                  <L zh="非交换单群!" en="simple non-abelian!" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Notes on revealed factors */}
      {shown.map((f, i) => (
        <div key={i} style={{
          fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-dim)',
          borderLeft: `3px solid ${f.isSimpleNonAbelian ? 'var(--warn)' : 'var(--green)'}`,
          paddingLeft: 10, marginBottom: 6,
        }}>
          <strong style={{ color: f.isSimpleNonAbelian ? 'var(--warn)' : 'var(--green)' }}>{f.label}</strong>
          {': '}
          {lang === 'zh' ? f.noteZh : f.noteEn}
        </div>
      ))}

      {/* Final verdict */}
      {revealedFactors >= CUBE_FACTORS.length && (
        <div style={{
          marginTop: 12, padding: '12px 16px', borderRadius: 6,
          background: 'color-mix(in srgb, var(--warn) 12%, var(--bg-elev))',
          border: '1.5px solid var(--warn)',
          fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--warn)',
        }}>
          <L
            zh={<>G_cube 含非交换单群组合因子 (A₈, A₁₂) → <strong>群论上不可解</strong>。「可还原」≠「可解群」。</>}
            en={<>G_cube has simple non-abelian composition factors (A₈, A₁₂) → <strong>NOT group-solvable</strong>. &ldquo;Puzzle-solvable&rdquo; ≠ &ldquo;group-solvable.&rdquo;</>}
          />
        </div>
      )}

      {!hasBlocker && revealedFactors > 0 && (
        <div style={{
          marginTop: 8, padding: '8px 14px', borderRadius: 6,
          background: 'color-mix(in srgb, var(--green) 10%, var(--bg-elev))',
          border: '1px solid var(--green)',
          fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--green)',
        }}>
          <L zh="目前只见阿贝尔因子……继续展开" en="Only abelian factors so far… keep revealing" />
        </div>
      )}
    </div>
  );
}
