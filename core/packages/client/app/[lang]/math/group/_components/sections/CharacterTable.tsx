'use client';

import { useState, useMemo, useCallback } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import type { Lang } from '../primitives';
import { tr } from '@/i18n/tr';

// ── Complex number arithmetic ─────────────────────────────────────────────────

interface C { re: number; im: number }

function add(a: C, b: C): C { return { re: a.re + b.re, im: a.im + b.im }; }
function mul(a: C, b: C): C { return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }; }
function conj(a: C): C { return { re: a.re, im: -a.im }; }
function scale(a: C, s: number): C { return { re: a.re * s, im: a.im * s }; }
function czero(): C { return { re: 0, im: 0 }; }

// Format complex number nicely for display
function fmtC(z: C, digits = 3): string {
  const threshold = 1e-9;
  const r = Math.abs(z.re) < threshold ? 0 : z.re;
  const i = Math.abs(z.im) < threshold ? 0 : z.im;
  if (i === 0) return r.toFixed(digits).replace(/\.?0+$/, '') || '0';
  if (r === 0) return (i === 1 ? '' : i === -1 ? '-' : i.toFixed(digits).replace(/\.?0+$/, '')) + 'i';
  const iStr = (Math.abs(i) === 1 ? '' : Math.abs(i).toFixed(digits).replace(/\.?0+$/, '')) + 'i';
  return `${r.toFixed(digits).replace(/\.?0+$/, '')} ${i < 0 ? '-' : '+'} ${iStr}`;
}

// ── Group data ─────────────────────────────────────────────────────────────────

const ω: C = { re: -0.5, im: Math.sqrt(3) / 2 };       // exp(2πi/3)
const ω2: C = { re: -0.5, im: -Math.sqrt(3) / 2 };     // exp(4πi/3) = conj(ω)
const ONE: C = { re: 1, im: 0 };
const NEG: C = { re: -1, im: 0 };

// C_n: handled dynamically below — this covers n=2..8

type GroupKey = 'S3' | 'A4' | 'S4' | 'D4' | 'Q8' | `C${number}`;

interface GroupDef {
  key: GroupKey;
  labelEn: string;
  labelZh: string;
  order: number;
  // conjugacy classes
  classLabels: string[];   // representative notation
  classSizes: number[];
  // char values: charVals[i][k] = chi_i(g_k)
  charVals: C[][];
  charLabels: string[];
}

// S3: 3 classes {e size1, (12) size3, (123) size2}; 3 irreps dims 1,1,2
const S3: GroupDef = {
  key: 'S3', labelEn: 'S₃', labelZh: 'S₃',
  order: 6,
  classLabels: ['e', '(12)', '(123)'],
  classSizes: [1, 3, 2],
  charLabels: ['χ₁ (trivial)', 'χ₂ (sign)', 'χ₃ (std, dim 2)'],
  charVals: [
    [ONE,  ONE,  ONE ],
    [ONE,  NEG,  ONE ],
    [{ re: 2, im: 0 }, czero(), { re: -1, im: 0 }],
  ],
};

// A4: 4 classes {e size1, (12)(34) size3, (123) size4, (132) size4}; dims 1,1,1,3
const A4: GroupDef = {
  key: 'A4', labelEn: 'A₄', labelZh: 'A₄',
  order: 12,
  classLabels: ['e', '(12)(34)', '(123)', '(132)'],
  classSizes: [1, 3, 4, 4],
  charLabels: ['χ₁ (trivial)', 'χ_ω', 'χ_ω²', 'χ₄ (dim 3)'],
  charVals: [
    [ONE,  ONE, ONE,  ONE ],
    [ONE,  ONE, ω,    ω2  ],
    [ONE,  ONE, ω2,   ω   ],
    [{ re: 3, im: 0 }, { re: -1, im: 0 }, czero(), czero()],
  ],
};

// S4: 5 classes {e1, (12)6, (12)(34)3, (123)8, (1234)6}; dims 1,1,2,3,3
const S4: GroupDef = {
  key: 'S4', labelEn: 'S₄ (cube rotations)', labelZh: 'S₄ (魔方立方体旋转群)',
  order: 24,
  classLabels: ['e', '(12)', '(12)(34)', '(123)', '(1234)'],
  classSizes: [1, 6, 3, 8, 6],
  charLabels: ['χ₁ (trivial)', 'χ₂ (sign)', 'χ₃ (dim 2)', 'χ₄ (std, dim 3)', 'χ₅ (std⊗sgn, dim 3)'],
  charVals: [
    [ONE,  ONE,  ONE,  ONE,  ONE ],
    [ONE,  NEG,  ONE,  ONE,  NEG ],
    [{ re: 2, im: 0 }, czero(), { re: 2, im: 0 }, { re: -1, im: 0 }, czero()],
    [{ re: 3, im: 0 }, ONE,  { re: -1, im: 0 }, czero(), { re: -1, im: 0 }],
    [{ re: 3, im: 0 }, NEG, { re: -1, im: 0 }, czero(), ONE],
  ]
};

// D4 and Q8 have identical character tables
const D4Q8_CHAR: C[][] = [
  [ONE,  ONE,  ONE,  ONE,  ONE ],
  [ONE,  ONE,  ONE,  NEG,  NEG ],
  [ONE,  ONE,  NEG,  ONE,  NEG ],
  [ONE,  ONE,  NEG,  NEG,  ONE ],
  [{ re: 2, im: 0 }, { re: -2, im: 0 }, czero(), czero(), czero()],
];

const D4: GroupDef = {
  key: 'D4', labelEn: 'D₄ (dihedral, order 8)', labelZh: 'D₄ (二面体群，阶 8)',
  order: 8,
  classLabels: ['e', 'r²', '{r,r³}', '{s,r²s}', '{rs,r³s}'],
  classSizes: [1, 1, 2, 2, 2],
  charLabels: ['χ₁', 'χ₂', 'χ₃', 'χ₄', 'χ₅ (dim 2)'],
  charVals: D4Q8_CHAR
};

const Q8: GroupDef = {
  key: 'Q8', labelEn: 'Q₈ (quaternion)', labelZh: 'Q₈ (四元数群)',
  order: 8,
  classLabels: ['{1}', '{-1}', '{±i}', '{±j}', '{±k}'],
  classSizes: [1, 1, 2, 2, 2],
  charLabels: ['χ₁', 'χ₂', 'χ₃', 'χ₄', 'χ₅ (dim 2)'],
  charVals: D4Q8_CHAR
};

// Build C_n dynamically for n=2..8
function buildCn(n: number): GroupDef {
  const ζ = (k: number, m: number): C => {
    const angle = (2 * Math.PI * k * m) / n;
    return { re: Math.cos(angle), im: Math.sin(angle) };
  };
  const charVals: C[][] = [];
  for (let k = 0; k < n; k++) {
    const row: C[] = [];
    for (let m = 0; m < n; m++) row.push(ζ(k, m));
    charVals.push(row);
  }
  const classLabels = Array.from({ length: n }, (_, m) => (m === 0 ? 'e' : m === 1 ? 'g' : `g${m > 1 ? m.toString().split('').map(d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]).join('') : ''}`));
  const charLabels = Array.from({ length: n }, (_, k) => (k === 0 ? 'χ₀ (trivial)' : `χ${k}`));
  return {
    key: `C${n}` as GroupKey,
    labelEn: `C${n} (cyclic, order ${n})`,
    labelZh: `C${n}（循环群，阶 ${n}）`,
    order: n,
    classLabels,
    classSizes: Array(n).fill(1),
    charLabels,
    charVals,
  };
}

const PREBUILT: Record<string, GroupDef> = { S3, A4, S4, D4, Q8 };

type GroupSel = { type: 'named'; key: string } | { type: 'cn'; n: number };

function getGroup(sel: GroupSel): GroupDef {
  if (sel.type === 'named') return PREBUILT[sel.key];
  return buildCn(sel.n);
}

// ── Orthogonality computation ─────────────────────────────────────────────────

interface OrthoResult {
  terms: { classSizeOrOne: number; a: C; bConj: C; product: C; weight: number }[];
  rawSum: C;        // un-normalized (sum over g of chi_i(g)*conj(chi_j(g)))
  normalized: C;   // rawSum / |G|
  expected: string; // "1" or "0" (for rows); centralizer order (for cols)
  isRow: boolean;
}

function computeRowOrtho(g: GroupDef, i: number, j: number, useConj: boolean): OrthoResult {
  const terms = g.classSizes.map((size, k) => {
    const a = g.charVals[i][k];
    const b = g.charVals[j][k];
    const bConj = useConj ? conj(b) : b;
    const product = mul(a, bConj);
    return { classSizeOrOne: size, a, bConj, product, weight: size };
  });
  const rawSum = terms.reduce((acc, t) => add(acc, scale(t.product, t.weight)), czero());
  const normalized = scale(rawSum, 1 / g.order);
  const expected = i === j ? '1' : '0';
  return { terms, rawSum, normalized, expected, isRow: true };
}

function computeColOrtho(g: GroupDef, a: number, b: number): OrthoResult {
  const r = g.charVals.length;
  const terms = Array.from({ length: r }, (_, i) => {
    const av = g.charVals[i][a];
    const bv = g.charVals[i][b];
    const bConj = conj(bv);
    const product = mul(av, bConj);
    return { classSizeOrOne: 1, a: av, bConj, product, weight: 1 };
  });
  const rawSum = terms.reduce((acc, t) => add(acc, t.product), czero());
  // expected: centralizer order |G|/|C_a| when a===b, else 0
  const centralizerOrder = g.order / g.classSizes[a];
  const expected = a === b ? String(Math.round(centralizerOrder)) : '0';
  return { terms, rawSum, normalized: rawSum, expected, isRow: false };
}

// ── Categorical palette ───────────────────────────────────────────────────────

const CAT = ['#8B2E3C', '#2A4D69', '#3F7050', '#B8860B', '#6B4E9C', '#C2410C', '#5C7CA0', '#9C4E6B'];

// ── §51 CharacterTable ────────────────────────────────────────────────────────

export default function CharacterTable() {
  const lang = useLang();

  // Shared group selection state used by multiple panels
  const [groupSel, setGroupSel] = useState<GroupSel>({ type: 'named', key: 'S4' });
  const [cnN, setCnN] = useState(4);

  const group = useMemo(() => getGroup(groupSel), [groupSel, cnN]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <GTSec id="character-table" className="gt-sec">
      <div className="gt-sec-num">§51</div>
      <h2 className="gt-sec-title">
        <L zh="特征标表" en="Character tables" />
      </h2>

      <p className="gt-lede">
        <L
          zh={<>
            有限群的不可约表示有多少个？它们的矩阵迹告诉我们什么？<strong>特征标</strong>（character）是表示 <TeX src={String.raw`\rho\colon G\to\mathrm{GL}(V)`} /> 的最精简编码——只取迹，扔掉坐标选择带来的冗余。每个特征标都是共轭类上的常值函数（类函数），而有限群的不可约特征标恰好构成类函数空间的一组标准正交基。将所有不可约特征标排成一张矩阵，行对应不可约特征标、列对应共轭类，便得到<strong>特征标表</strong>——它是群的一份惊人精简的"指纹"，但正如 <TeX src={String.raw`D_4`} /> 与 <TeX src={String.raw`Q_8`} /> 所示，不同构的群可以共享同一张特征标表。
          </>}
          en={<>
            How many irreducible representations does a finite group have, and what do their matrix traces encode? The <strong>character</strong> of a representation <TeX src={String.raw`\rho\colon G\to\mathrm{GL}(V)`} /> is its trace function — the most concise summary of <TeX src={String.raw`\rho`} />, free from basis-choice redundancy. Every character is constant on conjugacy classes (a class function), and the irreducible characters form an orthonormal basis of the space of class functions. Arranged into a matrix — rows for irreducible characters, columns for conjugacy classes — this gives the <strong>character table</strong>: a remarkably compact fingerprint of <TeX src={String.raw`G`} />, though as <TeX src={String.raw`D_4`} /> versus <TeX src={String.raw`Q_8`} /> shows, non-isomorphic groups can share identical tables.
          </>}
        />
      </p>

      {/* ── Definition: character ── */}
      <div className="gt-def">
        <div className="gt-def-title">
          <L zh="定义: 表示的特征标" en="Definition: character of a representation" />
        </div>
        <div className="gt-def-body">
          <L
            zh={<>
              设 <TeX src={String.raw`G`} /> 为有限群，<TeX src={String.raw`\rho\colon G\to\mathrm{GL}(V)`} /> 为有限维复表示。其<strong>特征标</strong>是函数 <TeX src={String.raw`\chi_\rho\colon G\to\mathbb{C}`} />，定义为
            </>}
            en={<>
              Let <TeX src={String.raw`G`} /> be a finite group and <TeX src={String.raw`\rho\colon G\to\mathrm{GL}(V)`} /> a finite-dimensional complex representation. Its <strong>character</strong> is the function <TeX src={String.raw`\chi_\rho\colon G\to\mathbb{C}`} /> defined by
            </>}
          />
          <TeXBlock src={String.raw`\chi_\rho(g) = \mathrm{trace}(\rho(g)).`} />
          <L
            zh={<>
              特别地 <TeX src={String.raw`\chi_\rho(e) = \dim V`} />，即表示的<strong>度数</strong>（dimension）。由于迹在相似变换下不变，<TeX src={String.raw`\chi_\rho`} /> 是<strong>类函数</strong>：对所有 <TeX src={String.raw`g,h\in G`} /> 有 <TeX src={String.raw`\chi_\rho(hgh^{-1})=\chi_\rho(g)`} />（因为 <TeX src={String.raw`\mathrm{trace}(ABA^{-1})=\mathrm{trace}(B)`} />）。两个表示同构当且仅当它们的特征标相同。
            </>}
            en={<>
              In particular <TeX src={String.raw`\chi_\rho(e) = \dim V`} />, the <strong>degree</strong> of the representation. Since the trace is invariant under conjugation, <TeX src={String.raw`\chi_\rho`} /> is a <strong>class function</strong>: <TeX src={String.raw`\chi_\rho(hgh^{-1})=\chi_\rho(g)`} /> for all <TeX src={String.raw`g,h\in G`} /> (because <TeX src={String.raw`\mathrm{trace}(ABA^{-1})=\mathrm{trace}(B)`} />). Two representations are isomorphic iff they have the same character.
            </>}
          />
        </div>
      </div>

      {/* ── Definition: character table ── */}
      <div className="gt-def">
        <div className="gt-def-title">
          <L zh="定义: 特征标表" en="Definition: character table" />
        </div>
        <div className="gt-def-body">
          <L
            zh={<>
              设 <TeX src={String.raw`G`} /> 有 <TeX src={String.raw`r`} /> 个共轭类，代表元为 <TeX src={String.raw`g_1,\ldots,g_r`} />（约定 <TeX src={String.raw`g_1=e`} />），不可约特征标为 <TeX src={String.raw`\chi_1,\ldots,\chi_r`} />（约定 <TeX src={String.raw`\chi_1\equiv 1`} /> 为平凡特征标）。<strong>特征标表</strong>是 <TeX src={String.raw`r\times r`} /> 矩阵，第 <TeX src={String.raw`(i,k)`} /> 项为 <TeX src={String.raw`\chi_i(g_k)`} />。列标题通常注明类的大小 <TeX src={String.raw`|C_k|`} />。
            </>}
            en={<>
              If <TeX src={String.raw`G`} /> has <TeX src={String.raw`r`} /> conjugacy classes with representatives <TeX src={String.raw`g_1,\ldots,g_r`} /> (with <TeX src={String.raw`g_1=e`} />) and irreducible characters <TeX src={String.raw`\chi_1,\ldots,\chi_r`} /> (with <TeX src={String.raw`\chi_1\equiv 1`} /> trivial), the <strong>character table</strong> is the <TeX src={String.raw`r\times r`} /> matrix with <TeX src={String.raw`(i,k)`} />-entry <TeX src={String.raw`\chi_i(g_k)`} />. Column headers typically include the class sizes <TeX src={String.raw`|C_k|`} />.
            </>}
          />
        </div>
      </div>

      {/* ── Key theorems ── */}
      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理: 不可约特征标个数 = 共轭类个数" en="Theorem: number of irreducible characters = number of conjugacy classes" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>
              有限群 <TeX src={String.raw`G`} /> 的不可约复表示（在同构意义下）的个数恰好等于 <TeX src={String.raw`G`} /> 的共轭类的个数 <TeX src={String.raw`r`} />。从而特征标表是方阵。等价地：不可约特征标构成类函数空间（维数为 <TeX src={String.raw`r`} />）的一组标准正交基。设不可约特征标的度数为 <TeX src={String.raw`d_1,\ldots,d_r`} />，则
            </>}
            en={<>
              A finite group <TeX src={String.raw`G`} /> has exactly as many inequivalent irreducible complex representations as conjugacy classes, say <TeX src={String.raw`r`} />. Hence the character table is square. Equivalently: the irreducible characters form an orthonormal basis of the space of class functions, which has dimension <TeX src={String.raw`r`} />. If the irreducible degrees are <TeX src={String.raw`d_1,\ldots,d_r`} />, then
            </>}
          />
          <TeXBlock src={String.raw`\sum_{i=1}^{r} d_i^2 = |G|.`} />
          <L
            zh={<>
              这来自正则表示的分解：正则特征标满足 <TeX src={String.raw`\chi_\mathrm{reg}(e)=|G|`} /> 且 <TeX src={String.raw`\chi_\mathrm{reg}=\sum_i d_i\chi_i`} />，代入 <TeX src={String.raw`e`} /> 即得。每个 <TeX src={String.raw`d_i`} /> 整除 <TeX src={String.raw`|G|`} />。
            </>}
            en={<>
              This follows from decomposing the regular representation: <TeX src={String.raw`\chi_\mathrm{reg}(e)=|G|`} /> and <TeX src={String.raw`\chi_\mathrm{reg}=\sum_i d_i\chi_i`} />, so evaluating at <TeX src={String.raw`e`} /> gives the sum. Each <TeX src={String.raw`d_i`} /> divides <TeX src={String.raw`|G|`} />.
            </>}
          />
        </div>
      </div>

      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="正交关系" en="Orthogonality relations" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>
              类函数空间上的 Hermitian 内积定义为 <TeX src={String.raw`\langle f,h\rangle = \frac{1}{|G|}\sum_{g\in G} f(g)\overline{h(g)}`} />。由于 <TeX src={String.raw`f,h`} /> 在类上取常值，等价于 <TeX src={String.raw`\frac{1}{|G|}\sum_k |C_k|\,f(g_k)\overline{h(g_k)}`} />。注意第二因子必须取复共轭（Hermitian 内积）——对含复值特征标的群（如 <TeX src={String.raw`A_4`} /> 含 <TeX src={String.raw`\omega`} />）缺少共轭会给出错误答案。
            </>}
            en={<>
              The Hermitian inner product on class functions is <TeX src={String.raw`\langle f,h\rangle = \frac{1}{|G|}\sum_{g\in G} f(g)\overline{h(g)}`} />, equivalently <TeX src={String.raw`\frac{1}{|G|}\sum_k |C_k|\,f(g_k)\overline{h(g_k)}`} />. The complex conjugate on the second factor is essential — for groups with complex-valued characters (e.g. <TeX src={String.raw`A_4`} /> with <TeX src={String.raw`\omega`} />) omitting it gives wrong answers.
            </>}
          />
          <TeXBlock src={String.raw`\langle\chi_i,\chi_j\rangle = \frac{1}{|G|}\sum_{g\in G}\chi_i(g)\overline{\chi_j(g)} = \delta_{ij}.`} />
          <L
            zh={<>
              这是<strong>第一正交关系</strong>（行正交性）。<strong>第二正交关系</strong>（列正交性）：
            </>}
            en={<>
              This is the <strong>first (row) orthogonality relation</strong>. The <strong>second (column) orthogonality relation</strong> is:
            </>}
          />
          <TeXBlock src={String.raw`\sum_{i=1}^{r}\chi_i(g_j)\overline{\chi_i(g_k)} = |C_G(g_j)|\,\delta_{jk},`} />
          <L
            zh={<>
              其中 <TeX src={String.raw`|C_G(g_j)|=|G|/|C_j|`} /> 是中心化子的阶，也是第 <TeX src={String.raw`j`} /> 列的"平方范数"。注意：列正交关系中的权是<strong>中心化子阶</strong>，而非类的大小；行正交关系中的权才是类的大小 <TeX src={String.raw`|C_k|`} />。
            </>}
            en={<>
              where <TeX src={String.raw`|C_G(g_j)|=|G|/|C_j|`} /> is the centralizer order, which is the squared norm of column <TeX src={String.raw`j`} />. Note: the weight in the <em>column</em> relation is the <strong>centralizer order</strong>, not the class size; the class size <TeX src={String.raw`|C_k|`} /> appears as the weight in the <em>row</em> relation.
            </>}
          />
        </div>
      </div>

      {/* ── Cube connection ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="立方体旋转群 S₄ 与特征标表" en="The cube's rotation group S₄ and its character table" />
      </h3>

      <p>
        <L
          zh={<>
            立方体的朝向保持旋转群（24 个旋转，不含镜面）同构于 <TeX src={String.raw`S_4`} />，这个同构来自旋转对四条体对角线的置换作用。五个共轭类——恒等（1 个）、棱的 180° 旋转（6 个，作用为对换）、面的 180° 旋转（3 个，作用为对合置换）、顶点的 120°/240° 旋转（8 个，作用为 3-轮换）、面的 90°/270° 旋转（6 个，作用为 4-轮换）——恰好对应 <TeX src={String.raw`S_4`} /> 的五个共轭类，1+6+3+8+6=24。度数为 1,1,2,3,3 的五个不可约表示满足 <TeX src={String.raw`1+1+4+9+9=24=|S_4|`} />，其中两个 3 维不可约表示对应 <TeX src={String.raw`\mathbb{R}^3`} /> 上的几何作用（自然表示）及其与符号特征标的张量积。
          </>}
          en={<>
            The orientation-preserving rotation group of a cube (24 rotations, no reflections) is isomorphic to <TeX src={String.raw`S_4`} />, via its action on the four space diagonals. The five conjugacy classes — identity (size 1), edge 180° rotations (size 6, transpositions), face 180° rotations (size 3, double transpositions), vertex 120°/240° rotations (size 8, 3-cycles), face 90°/270° rotations (size 6, 4-cycles) — match exactly the five conjugacy classes of <TeX src={String.raw`S_4`} />, with 1+6+3+8+6=24. The five irreducible representations of degrees 1,1,2,3,3 satisfy <TeX src={String.raw`1+1+4+9+9=24=|S_4|`} />; the two 3-dimensional irreps are the natural geometric action on <TeX src={String.raw`\mathbb{R}^3`} /> and its tensor product with the sign character.
          </>}
        />
      </p>

      <div className="gt-aside">
        <L
          zh={<>
            注意区分：此处的群是立方体<em>固体</em>的旋转对称群（<TeX src={String.raw`S_4`} />，24 阶），与魔方拼图群（约 <TeX src={String.raw`4.3\times10^{19}`} /> 阶，由棱和角的置换与朝向构成的环积）是完全不同的对象。不要混淆两者。
          </>}
          en={<>
            Caution: this group is the rotational symmetry group of the cube <em>solid</em> (<TeX src={String.raw`S_4`} />, order 24), which is entirely different from the Rubik&apos;s Cube puzzle group (order <TeX src={String.raw`\approx 4.3\times10^{19}`} />, built from wreath products of cyclic groups with symmetric groups on corners and edges). Do not conflate the two.
          </>}
        />
      </div>

      {/* ── D4 vs Q8 ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="特征标表相同 ≠ 群同构：D₄ 与 Q₈" en="Equal character table ≠ isomorphic: D₄ versus Q₈" />
      </h3>

      <p>
        <L
          zh={<>
            <TeX src={String.raw`D_4`} />（二面体群，阶 8）与 <TeX src={String.raw`Q_8`} />（四元数群，阶 8）的特征标表逐项相同，都是 <TeX src={String.raw`\{1,1,1,1,2\}`} /> 度数。但两者不同构：<TeX src={String.raw`D_4`} /> 有 5 个 2 阶元（<TeX src={String.raw`r^2, s, rs, r^2s, r^3s`} />），而 <TeX src={String.raw`Q_8`} /> 只有 1 个 2 阶元（<TeX src={String.raw`-1`} />）。元素阶的分布是同构不变量，所以两群不同构。此外，<TeX src={String.raw`D_4`} /> 的 2 维不可约表示可在实数域上实现（正交矩阵），而 <TeX src={String.raw`Q_8`} /> 的 2 维不可约表示的 Schur 指数为 2，只能在四元数体 <TeX src={String.raw`\mathbb{H}`} /> 上实现，无法降到 <TeX src={String.raw`\mathbb{R}`} />。特征标相同不等于表示"相同"（在非代数闭域上）。
          </>}
          en={<>
            <TeX src={String.raw`D_4`} /> (dihedral group of order 8) and <TeX src={String.raw`Q_8`} /> (quaternion group, order 8) have identical character tables, both with degree sequence <TeX src={String.raw`\{1,1,1,1,2\}`} />. Yet they are non-isomorphic: <TeX src={String.raw`D_4`} /> has 5 elements of order 2 (<TeX src={String.raw`r^2, s, rs, r^2s, r^3s`} />), while <TeX src={String.raw`Q_8`} /> has exactly 1 (namely <TeX src={String.raw`-1`} />). The element-order distribution is an isomorphism invariant, so the groups are distinct. Moreover, <TeX src={String.raw`D_4`} />&apos;s 2-dimensional irrep is realizable over <TeX src={String.raw`\mathbb{R}`} /> (orthogonal matrices), whereas <TeX src={String.raw`Q_8`} />&apos;s 2-dimensional irrep has Schur index 2 and requires the quaternion algebra <TeX src={String.raw`\mathbb{H}`} /> — it is not realizable over <TeX src={String.raw`\mathbb{R}`} />. Equal character values do not mean equal representations over a non-algebraically-closed field.
          </>}
        />
      </p>

      {/* ── Panel 1: Character table grid + orthogonality probe ── */}
      <CharTablePanel group={group} groupSel={groupSel} setGroupSel={setGroupSel} cnN={cnN} setCnN={setCnN} lang={lang} />

      {/* ── Panel 2: Sum-of-squares budget bar ── */}
      <SumOfSquaresPanel group={group} lang={lang} />

      {/* ── Panel 3: Why conjugation matters (A4) ── */}
      <ConjugationPanel lang={lang} />

      {/* ── Panel 4: S4 cube-rotation mapper ── */}
      <CubeClassMapperPanel lang={lang} />

      {/* ── References ── */}
      <div className="gt-refs" style={{ marginTop: 48 }}>
        <div className="gt-def-title" style={{ marginBottom: 10 }}>
          <L zh="参考文献" en="References" />
        </div>
        <ol>
          <li>J.-P. Serre, <em>Linear Representations of Finite Groups</em> (GTM 42), Springer 1977. Part I, §2.2–2.5 (characters, orthogonality, number of irreducibles = number of classes) and §5.1–5.8 (tables for cyclic, S₃, A₄, S₄, dihedral, quaternion).</li>
          <li>I. M. Isaacs, <em>Character Theory of Finite Groups</em>, AMS Chelsea 2006. Ch. 2 (orthogonality, column orthogonality with centralizer-order weighting).</li>
          <li>Groupprops (Group Properties Wiki): explicit verified character tables for S₃, A₄, S₄, D₄ (dihedral order 8), Q₈, and &ldquo;Octahedral group is isomorphic to S₄&rdquo;. <a href="https://groupprops.subwiki.org/wiki/Linear_representation_theory_of_alternating_group:A4" target="_blank" rel="noopener noreferrer">groupprops.subwiki.org</a></li>
          <li>Wikipedia, &ldquo;<a href="https://en.wikipedia.org/wiki/Character_table" target="_blank" rel="noopener noreferrer">Character table</a>&rdquo; and &ldquo;Schur orthogonality relations&rdquo;.</li>
        </ol>
      </div>
    </GTSec>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Panel 1: Character table grid with orthogonality probe
// ═════════════════════════════════════════════════════════════════════════════

function CharTablePanel({
  group, groupSel, setGroupSel, cnN, setCnN, lang,
}: {
  group: GroupDef;
  groupSel: GroupSel;
  setGroupSel: (s: GroupSel) => void;
  cnN: number;
  setCnN: (n: number) => void;
  lang: Lang;
}) {
  // selection: null | {type:'row'|'col', idx:number}
  const [selA, setSelA] = useState<{ type: 'row' | 'col'; idx: number } | null>(null);
  const [selB, setSelB] = useState<{ type: 'row' | 'col'; idx: number } | null>(null);
  const [normalized, setNormalized] = useState(true);
  const [useConj, setUseConj] = useState(true);

  // Reset selections when group changes
  const handleGroup = useCallback((sel: GroupSel) => {
    setGroupSel(sel);
    setSelA(null);
    setSelB(null);
  }, [setGroupSel]);

  const orthoResult = useMemo<OrthoResult | null>(() => {
    if (!selA || !selB) return null;
    if (selA.type !== selB.type) return null;
    if (selA.type === 'row') {
      return computeRowOrtho(group, selA.idx, selB.idx, useConj);
    } else {
      return computeColOrtho(group, selA.idx, selB.idx);
    }
  }, [group, selA, selB, useConj]);

  const handleCellClick = (type: 'row' | 'col', idx: number) => {
    if (!selA) {
      setSelA({ type, idx });
    } else if (!selB) {
      if (selA.type === type) {
        setSelB({ type, idx });
      } else {
        // Different type: replace selA
        setSelA({ type, idx });
        setSelB(null);
      }
    } else {
      // Both set: restart
      setSelA({ type, idx });
      setSelB(null);
    }
  };

  const r = group.charVals.length;
  const c = group.classSizes.length;

  // Color entry for display
  const entryColor = (z: C): string => {
    const eps = 1e-9;
    if (Math.abs(z.im) > eps) return 'var(--accent-2)';       // complex
    if (Math.abs(z.re + 1) < eps) return 'var(--warn)';        // -1
    if (Math.abs(z.re) < eps) return 'var(--ink-faint)';        // 0
    return 'var(--ink)';
  };

  const fmtEntry = (z: C): string => {
    const eps = 1e-9;
    if (Math.abs(z.im) < eps && Math.abs(z.re - Math.round(z.re)) < eps) {
      return String(Math.round(z.re));
    }
    if (Math.abs(z.re + 0.5) < eps && Math.abs(Math.abs(z.im) - Math.sqrt(3) / 2) < eps) {
      return z.im > 0 ? 'ω' : 'ω²';
    }
    return fmtC(z, 2);
  };

  const isRowSel = (i: number) =>
    (selA?.type === 'row' && selA.idx === i) || (selB?.type === 'row' && selB.idx === i);
  const isColSel = (k: number) =>
    (selA?.type === 'col' && selA.idx === k) || (selB?.type === 'col' && selB.idx === k);

  const NAMED_GROUPS: { key: string; label: string }[] = [
    { key: 'S3', label: 'S₃' },
    { key: 'A4', label: 'A₄' },
    { key: 'S4', label: 'S₄' },
    { key: 'D4', label: 'D₄' },
    { key: 'Q8', label: 'Q₈' },
  ];

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="特征标表与正交性探针" en="Character table grid and orthogonality probe" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="选择一个群查看其特征标表；点击两行（或两列）计算内积，验证正交关系。"
          en="Select a group to display its character table; click two rows (or two columns) to compute the inner product and verify the orthogonality relations."
        />
      </div>

      {/* Group selector */}
      <div className="gt-panel-input-row">
        <label><L zh="群" en="Group" /></label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {NAMED_GROUPS.map(({ key, label }) => (
            <button
              key={key}
              className={`gt-chip${groupSel.type === 'named' && groupSel.key === key ? ' gt-chip-active' : ''}`}
              onClick={() => handleGroup({ type: 'named', key })}
            >
              {label}
            </button>
          ))}
          <button
            className={`gt-chip${groupSel.type === 'cn' ? ' gt-chip-active' : ''}`}
            onClick={() => handleGroup({ type: 'cn', n: cnN })}
          >
            C<sub>n</sub>
          </button>
        </div>
      </div>

      {groupSel.type === 'cn' && (
        <div className="gt-panel-input-row">
          <label style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>n = {cnN}</label>
          <input
            type="range" min={2} max={8} value={cnN}
            className="gt-input" style={{ flex: 1, minWidth: 120, cursor: 'pointer' }}
            onChange={e => { setCnN(Number(e.target.value)); handleGroup({ type: 'cn', n: Number(e.target.value) }); }}
          />
        </div>
      )}

      {/* Normalize toggle */}
      <div className="gt-panel-input-row">
        <button
          className={`gt-chip${normalized ? ' gt-chip-active' : ''}`}
          onClick={() => setNormalized(v => !v)}
        >
          <L zh={normalized ? '显示归一化 (÷|G|)' : '显示非归一化 (×|G|)'} en={normalized ? 'Normalized (÷|G|)' : 'Unnormalized (raw sum)'} />
        </button>
        <button
          className={`gt-chip${useConj ? ' gt-chip-active' : ''}`}
          onClick={() => setUseConj(v => !v)}
        >
          <L zh={useConj ? '有共轭 (正确)' : '无共轭 (错误演示)'} en={useConj ? 'With conjugation (correct)' : 'No conjugation (wrong demo)'} />
        </button>
      </div>

      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', marginBottom: 12 }}>
        <L
          zh="点击列标题选择列（计算列正交），点击行标签选择行（计算行正交）。选两个同类型的后显示内积。"
          en="Click a column header to select a column (column orthogonality), or click a row label to select a row (row orthogonality). Select two of the same type to compute the inner product."
        />
      </div>

      {/* Character table SVG */}
      <CharTableSVG
        group={group} r={r} c={c}
        isRowSel={isRowSel} isColSel={isColSel}
        onRowClick={i => handleCellClick('row', i)}
        onColClick={k => handleCellClick('col', k)}
        entryColor={entryColor} fmtEntry={fmtEntry}
        lang={lang}
      />

      {/* Orthogonality result */}
      {orthoResult && (
        <div className="gt-panel-result">
          {(() => {
            const res = orthoResult;
            const displayVal = res.isRow
              ? (normalized ? res.normalized : res.rawSum)
              : res.rawSum;
            const expectedNum = parseFloat(res.expected);
            const displayNum = normalized && res.isRow ? 1 : expectedNum;
            const actualRe = Math.round(displayVal.re * 1e6) / 1e6;
            const isCorrect = Math.abs(actualRe - displayNum) < 0.01 && Math.abs(displayVal.im) < 0.01;
            const color = useConj ? (isCorrect ? 'var(--green)' : 'var(--warn)') : 'var(--warn)';

            return (
              <>
                <div className="gt-result-row">
                  <span className="gt-result-label">
                    <L zh="类型" en="Type" />
                  </span>
                  <span className="gt-result-val">
                    {res.isRow
                      ? tr({ zh: '行正交（第一正交关系）', en: 'Row orthogonality (1st relation)'
                                                    })
                      : tr({ zh: '列正交（第二正交关系）', en: 'Column orthogonality (2nd relation)'
                                                    })}
                  </span>
                </div>
                <div className="gt-result-row">
                  <span className="gt-result-label">
                    <L zh="期望值" en="Expected" />
                  </span>
                  <span className="gt-result-val">
                    {res.isRow
                      ? (normalized
                        ? `δ = ${res.expected}`
                        : `${res.expected} × |G| = ${parseFloat(res.expected) * group.order}`)
                      : `${res.expected} (centralizer order)`}
                  </span>
                </div>
                <div className="gt-result-row">
                  <span className="gt-result-label">
                    <L zh="计算值" en="Computed" />
                  </span>
                  <span className="gt-result-val-strong" style={{ color }}>
                    {fmtC(displayVal)}
                    {!useConj && res.isRow && (
                      <span style={{ color: 'var(--warn)', fontWeight: 400, fontSize: 11, marginLeft: 8 }}>
                        <L zh="(无共轭=错误)" en="(no conj = wrong)" />
                      </span>
                    )}
                  </span>
                </div>
                <div className="gt-result-row">
                  <span className="gt-result-label">
                    <L zh="展开求和" en="Term-by-term sum" />
                  </span>
                  <span className="gt-result-val" style={{ fontSize: 12, color: 'var(--ink-dim)', wordBreak: 'break-word' }}>
                    {res.terms.map((t, ti) => {
                      const wA = res.isRow ? `${t.weight}·` : '';
                      return (
                        <span key={ti}>
                          {ti > 0 ? ' + ' : ''}
                          {wA}{fmtC(t.a)}·{useConj ? `conj(${fmtC(t.bConj)})` : fmtC({ re: t.bConj.re, im: -t.bConj.im })}
                        </span>
                      );
                    })}
                    {res.isRow && normalized && <span> = {fmtC(res.rawSum)} / {group.order}</span>}
                    {' = '}<strong>{fmtC(displayVal)}</strong>
                  </span>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {!orthoResult && (selA || selB) && (
        <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-faint)', marginTop: 12, padding: '10px 14px', border: '1px dashed var(--rule)', borderRadius: 4 }}>
          <L zh="再选一个同类型（行或列）来计算内积。" en="Now select one more of the same type (row or column) to compute the inner product." />
        </div>
      )}
    </div>
  );
}

function CharTableSVG({
  group, r, c,
  isRowSel, isColSel,
  onRowClick, onColClick,
  entryColor, fmtEntry,
}: {
  group: GroupDef; r: number; c: number;
  isRowSel: (i: number) => boolean;
  isColSel: (k: number) => boolean;
  onRowClick: (i: number) => void;
  onColClick: (k: number) => void;
  entryColor: (z: C) => string;
  fmtEntry: (z: C) => string;
  lang: Lang;
}) {
  const CELL_W = Math.max(48, Math.min(72, 420 / c));
  const CELL_H = 36;
  const ROW_LABEL_W = 130;
  const COL_HEADER_H = 54;
  const padLeft = 8;

  const totalW = padLeft + ROW_LABEL_W + c * CELL_W + 8;
  const totalH = COL_HEADER_H + r * CELL_H + 8;

  return (
    <svg viewBox={`0 0 ${totalW} ${totalH}`} width="100%" style={{ display: 'block', overflow: 'visible', margin: '8px 0' }}>
      {/* Column headers */}
      {Array.from({ length: c }, (_, k) => {
        const x = padLeft + ROW_LABEL_W + k * CELL_W;
        const sel = isColSel(k);
        return (
          <g key={`ch${k}`} style={{ cursor: 'pointer' }} onClick={() => onColClick(k)}>
            <rect x={x} y={0} width={CELL_W} height={COL_HEADER_H}
              fill={sel ? 'color-mix(in srgb, var(--accent) 18%, var(--bg-elev))' : 'var(--bg-elev)'}
              stroke={sel ? 'var(--accent)' : 'var(--rule)'}
              strokeWidth={sel ? 1.5 : 1} rx={3} />
            {/* Class label */}
            <text x={x + CELL_W / 2} y={16} textAnchor="middle"
              style={{ fontFamily: 'var(--mono)', fontSize: Math.min(11, CELL_W / 6.5), fontWeight: 600 }}
              fill={sel ? 'var(--accent)' : 'var(--ink)'}>
              {group.classLabels[k]}
            </text>
            {/* Class size */}
            <text x={x + CELL_W / 2} y={30} textAnchor="middle"
              style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--ink-faint)">
              |C|={group.classSizes[k]}
            </text>
            {/* Centralizer order */}
            <text x={x + CELL_W / 2} y={44} textAnchor="middle"
              style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--ink-faint)">
              {tr({ zh: '中心', en: 'cen' })}={group.order / group.classSizes[k]}
            </text>
          </g>
        );
      })}

      {/* Row labels + data cells */}
      {Array.from({ length: r }, (_, i) => {
        const y = COL_HEADER_H + i * CELL_H;
        const sel = isRowSel(i);
        return (
          <g key={`row${i}`}>
            {/* Row label */}
            <g style={{ cursor: 'pointer' }} onClick={() => onRowClick(i)}>
              <rect x={padLeft} y={y} width={ROW_LABEL_W} height={CELL_H}
                fill={sel ? 'color-mix(in srgb, var(--accent) 14%, var(--bg-elev))' : (i % 2 === 0 ? 'var(--bg-elev)' : 'var(--bg)')}
                stroke={sel ? 'var(--accent)' : 'var(--rule)'}
                strokeWidth={sel ? 1.5 : 1} rx={2} />
              <text x={padLeft + 8} y={y + CELL_H / 2 + 4} textAnchor="start"
                style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: sel ? 700 : 400 }}
                fill={sel ? 'var(--accent)' : 'var(--ink-dim)'}>
                {group.charLabels[i]}
              </text>
            </g>
            {/* Data cells */}
            {Array.from({ length: c }, (_, k) => {
              const x = padLeft + ROW_LABEL_W + k * CELL_W;
              const z = group.charVals[i][k];
              const colSel = isColSel(k);
              const bothSel = sel && colSel;
              return (
                <rect key={`cell${i}${k}`}
                  x={x} y={y} width={CELL_W} height={CELL_H}
                  fill={bothSel ? 'color-mix(in srgb, var(--accent) 30%, var(--bg-elev))'
                    : sel ? 'color-mix(in srgb, var(--accent) 10%, var(--bg-elev))'
                    : colSel ? 'color-mix(in srgb, var(--accent) 8%, var(--bg-elev))'
                    : (i % 2 === 0 ? 'var(--bg-elev)' : 'var(--bg)')}
                  stroke={bothSel ? 'var(--accent)' : (sel || colSel ? 'color-mix(in srgb, var(--accent) 40%, var(--rule))' : 'var(--rule)')}
                  strokeWidth={bothSel ? 2 : 1} rx={2} />
              );
              // text rendered separately so it appears above rects
              void z;
            })}
            {/* Overlay text on data cells */}
            {Array.from({ length: c }, (_, k) => {
              const x = padLeft + ROW_LABEL_W + k * CELL_W;
              const z = group.charVals[i][k];
              return (
                <text key={`txt${i}${k}`} x={x + CELL_W / 2} y={y + CELL_H / 2 + 4}
                  textAnchor="middle"
                  style={{ fontFamily: 'var(--mono)', fontSize: Math.min(12, CELL_W / 5), fontWeight: 600 }}
                  fill={entryColor(z)}>
                  {fmtEntry(z)}
                </text>
              );
            })}
          </g>
        );
      })}

      {/* Column header top-left corner label */}
      <rect x={padLeft} y={0} width={ROW_LABEL_W} height={COL_HEADER_H}
        fill="var(--bg-elev)" stroke="var(--rule)" strokeWidth={1} rx={3} />
      <text x={padLeft + ROW_LABEL_W / 2} y={18} textAnchor="middle"
        style={{ fontFamily: 'var(--mono)', fontSize: 10 }} fill="var(--ink-faint)">
        {tr({ zh: 'χᵢ \\ 类', en: 'χᵢ \\ class'
        })}
      </text>
      <text x={padLeft + ROW_LABEL_W / 2} y={32} textAnchor="middle"
        style={{ fontFamily: 'var(--mono)', fontSize: 10 }} fill="var(--ink-faint)">
        {group.labelEn}
      </text>
      <text x={padLeft + ROW_LABEL_W / 2} y={46} textAnchor="middle"
        style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--ink-faint)">
        |G|={group.order}, r={r}
      </text>
    </svg>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Panel 2: Sum-of-squares budget bar
// ═════════════════════════════════════════════════════════════════════════════

function SumOfSquaresPanel({ group, lang }: { group: GroupDef; lang: Lang }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const degrees = group.charVals.map(row => Math.round(row[0].re));
  const sumSq = degrees.reduce((s, d) => s + d * d, 0);
  const G = group.order;

  const BAR_W = 560;
  const BAR_H = 40;
  const SVG_W = BAR_W + 40;
  const SVG_H = BAR_H + 60;

  let xOff = 0;
  const segments = degrees.map((d, i) => {
    const w = (d * d / G) * BAR_W;
    const x = xOff;
    xOff += w;
    return { d, sq: d * d, x, w, color: CAT[i % CAT.length] };
  });

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="度数平方预算图" en="Sum-of-squares budget bar" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh={<>
            每个不可约特征标 <TeX src={String.raw`\chi_i`} /> 对应一个宽为 <TeX src={String.raw`d_i^2`} /> 的色块，所有色块恰好拼满总宽 <TeX src={String.raw`|G|`} />，直观呈现 <TeX src={String.raw`\sum d_i^2 = |G|`} />。悬停色块高亮对应的不可约特征标。
          </>}
          en={<>
            Each irreducible character <TeX src={String.raw`\chi_i`} /> contributes a segment of width <TeX src={String.raw`d_i^2`} />, and all segments together fill exactly <TeX src={String.raw`|G|`} />, visualizing <TeX src={String.raw`\sum d_i^2 = |G|`} />. Hover a segment to highlight the corresponding irreducible character.
          </>}
        />
      </div>

      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%" style={{ display: 'block', margin: '12px 0', overflow: 'visible' }}>
        {/* Bar background */}
        <rect x={20} y={0} width={BAR_W} height={BAR_H} fill="var(--bg)" stroke="var(--rule)" strokeWidth={1} rx={4} />

        {/* Segments */}
        {segments.map((seg, i) => (
          <g key={i} style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <rect
              x={20 + seg.x} y={0} width={seg.w} height={BAR_H}
              fill={seg.color}
              opacity={hovered === null || hovered === i ? 1 : 0.4}
              rx={i === 0 ? 4 : i === segments.length - 1 ? 4 : 0}
              style={{ transition: 'opacity 0.15s' }}
            />
            {seg.w > 28 && (
              <>
                <text
                  x={20 + seg.x + seg.w / 2} y={BAR_H / 2 - 4}
                  textAnchor="middle"
                  style={{ fontFamily: 'var(--mono)', fontSize: Math.min(12, seg.w / 3.5), fontWeight: 700 }}
                  fill="white" opacity={hovered === null || hovered === i ? 1 : 0.4}>
                  d={seg.d}
                </text>
                <text
                  x={20 + seg.x + seg.w / 2} y={BAR_H / 2 + 10}
                  textAnchor="middle"
                  style={{ fontFamily: 'var(--mono)', fontSize: Math.min(10, seg.w / 4) }}
                  fill="white" opacity={hovered === null || hovered === i ? 0.85 : 0.3}>
                  d²={seg.sq}
                </text>
              </>
            )}
            {/* Divider line */}
            {i > 0 && <line x1={20 + seg.x} y1={0} x2={20 + seg.x} y2={BAR_H} stroke="white" strokeWidth={1} opacity={0.4} />}
          </g>
        ))}

        {/* Axis label */}
        <text x={20} y={BAR_H + 16} style={{ fontFamily: 'var(--mono)', fontSize: 10 }} fill="var(--ink-faint)">0</text>
        <text x={20 + BAR_W} y={BAR_H + 16} textAnchor="end" style={{ fontFamily: 'var(--mono)', fontSize: 10 }} fill="var(--ink-faint)">{G}</text>

        {/* Check mark */}
        <text x={20 + BAR_W / 2} y={BAR_H + 30} textAnchor="middle"
          style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600 }}
          fill={sumSq === G ? 'var(--green)' : 'var(--warn)'}>
          {lang === 'zh'
            ? `∑ dᵢ² = ${degrees.map(d => `${d}²`).join(' + ')} = ${sumSq} ${sumSq === G ? '✓ = |G|' : `≠ |G|=${G}`}`
            : `∑ dᵢ² = ${degrees.map(d => `${d}²`).join(' + ')} = ${sumSq} ${sumSq === G ? '✓ = |G|' : `≠ |G|=${G}`}`}
        </text>

        {/* Hover info */}
        {hovered !== null && (
          <text x={20 + BAR_W / 2} y={BAR_H + 48} textAnchor="middle"
            style={{ fontFamily: 'var(--mono)', fontSize: 11 }} fill={CAT[hovered % CAT.length]}>
            {group.charLabels[hovered]}: deg={degrees[hovered]}, d²={segments[hovered].sq}, {tr({ zh: '占比', en: 'share'
            })}={segments[hovered].sq}/{G}
          </text>
        )}
      </svg>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Panel 3: Why conjugation matters (A4 complex characters)
// ═════════════════════════════════════════════════════════════════════════════

function ConjugationPanel({ lang }: { lang: Lang }) {
  const [conjOn, setConjOn] = useState(true);
  // A4 chi_omega row index = 1, chi_omega2 row index = 2
  const [pairI, setPairI] = useState(1);
  const [pairJ, setPairJ] = useState(1);

  const g = A4;
  const result = computeRowOrtho(g, pairI, pairJ, conjOn);
  const displayVal = result.normalized;

  // Argand diagram: draw the 4 class terms as chained vectors
  // Each term = classSizes[k] * charVals[pairI][k] * conj/no-conj(charVals[pairJ][k]) / |G|
  const SCALE = 40; // px per unit
  const CX = 110;   // center x in local coords
  const CY = 80;    // center y in local coords

  const arrowTerms = g.classSizes.map((size, k) => {
    const a = g.charVals[pairI][k];
    const b = conjOn ? conj(g.charVals[pairJ][k]) : g.charVals[pairJ][k];
    return scale(mul(a, b), size / g.order);
  });

  // Cumulative
  let cx = 0, cy = 0;
  const chains = arrowTerms.map(t => {
    const from = { x: cx, y: cy };
    cx += t.re;
    cy += t.im;
    return { from, to: { x: cx, y: cy }, t };
  });

  const PAIR_LABELS = [
    { label: 'χ₁ (trivial)', zh: 'χ₁ (平凡)' },
    { label: 'χ_ω', zh: 'χ_ω' },
    { label: 'χ_ω²', zh: 'χ_ω²' },
  ];

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="为何必须取复共轭：A₄ 的复值特征标" en="Why conjugation is essential: A₄'s complex characters" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="拨动开关取消共轭，观察正交性如何破坏：正确的 Hermitian 内积使向量之和归零（对 i≠j）或归 1（对 i=j），去掉共轭则两者均失败。"
          en="Toggle off conjugation and watch orthogonality break. The correct Hermitian inner product makes the vector sum collapse to the origin (for i≠j) or land on (1,0) (for i=j); without conjugation both fail."
        />
      </div>

      <div className="gt-panel-input-row">
        <label><L zh="选对 (i,j)" en="Pair (i,j)" /></label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[0, 1, 2].map(i => (
            [0, 1, 2].map(j => (i <= j) && (
              <button key={`${i}${j}`}
                className={`gt-chip${pairI === i && pairJ === j ? ' gt-chip-active' : ''}`}
                onClick={() => { setPairI(i); setPairJ(j); }}
              >
                ({lang === 'zh' ? PAIR_LABELS[i].zh : PAIR_LABELS[i].label}, {lang === 'zh' ? PAIR_LABELS[j].zh : PAIR_LABELS[j].label})
              </button>
            ))
          )).flat().filter(Boolean)}
        </div>
      </div>

      <div className="gt-panel-input-row">
        <button
          className={`gt-chip${conjOn ? ' gt-chip-active' : ''}`}
          style={{ background: conjOn ? 'var(--green)' : 'var(--warn)', borderColor: conjOn ? 'var(--green)' : 'var(--warn)', color: 'white' }}
          onClick={() => setConjOn(v => !v)}
        >
          <L zh={conjOn ? '取复共轭: ON (正确)' : '取复共轭: OFF (错误演示)'} en={conjOn ? 'Conjugate second: ON (correct)' : 'Conjugate second: OFF (wrong demo)'} />
        </button>
      </div>

      {/* Argand diagram */}
      <svg viewBox={`0 0 240 180`} width="100%" style={{ display: 'block', margin: '12px auto', maxWidth: 320 }}>
        <defs>
          <marker id="conjArrow" markerWidth={7} markerHeight={7} refX={3.5} refY={3.5} orient="auto">
            <path d="M0,0 L7,3.5 L0,7 Z" fill="var(--accent-2)" />
          </marker>
          <marker id="conjFinal" markerWidth={8} markerHeight={8} refX={4} refY={4} orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="var(--accent)" />
          </marker>
        </defs>

        {/* Axes */}
        <line x1={CX - 70} y1={CY} x2={CX + 90} y2={CY} stroke="var(--rule)" strokeWidth={1} />
        <line x1={CX} y1={CY - 70} x2={CX} y2={CY + 70} stroke="var(--rule)" strokeWidth={1} />
        <text x={CX + 94} y={CY + 4} style={{ fontFamily: 'var(--mono)', fontSize: 10 }} fill="var(--ink-faint)">Re</text>
        <text x={CX + 2} y={CY - 72} style={{ fontFamily: 'var(--mono)', fontSize: 10 }} fill="var(--ink-faint)">Im</text>

        {/* Unit circle (dashed) */}
        <circle cx={CX} cy={CY} r={SCALE} fill="none" stroke="var(--rule)" strokeWidth={1} strokeDasharray="4 3" />

        {/* Origin */}
        <circle cx={CX} cy={CY} r={3} fill="var(--ink-faint)" />

        {/* Chained vectors */}
        {chains.map((ch, idx) => {
          const fx = CX + ch.from.x * SCALE;
          const fy = CY - ch.from.y * SCALE;
          const tx = CX + ch.to.x * SCALE;
          const ty = CY - ch.to.y * SCALE;
          const color = CAT[idx % CAT.length];
          return (
            <g key={idx}>
              <line x1={fx} y1={fy} x2={tx} y2={ty}
                stroke={color} strokeWidth={2.5}
                markerEnd="url(#conjArrow)"
                style={{ '--stroke': color } as React.CSSProperties} />
              <text x={(fx + tx) / 2 + 5} y={(fy + ty) / 2 - 2}
                style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill={color}>
                k={idx}
              </text>
            </g>
          );
        })}

        {/* Final point */}
        {(() => {
          const fx = CX + cx * SCALE;
          const fy = CY - cy * SCALE;
          const eps = 1e-6;
          const isOk = Math.abs(cx - displayVal.re) < eps;
          const color = conjOn && Math.abs(cx) < 0.05 && Math.abs(cy) < 0.05 ? 'var(--green)'
            : conjOn && Math.abs(cx - 1) < 0.05 && Math.abs(cy) < 0.05 ? 'var(--green)'
            : 'var(--warn)';
          void isOk;
          return (
            <>
              <circle cx={fx} cy={fy} r={5} fill={color} />
              <text x={fx + 7} y={fy + 4} style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600 }} fill={color}>
                ({fmtC({ re: cx, im: cy }, 2)})
              </text>
            </>
          );
        })()}

        <text x={120} y={168} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 10 }} fill="var(--ink-faint)">
          {tr({ zh: 'Argand 图 — 各项首尾相连', en: 'Argand diagram — vectors head-to-tail'
        })}
        </text>
      </svg>

      {/* Numeric result */}
      <div className="gt-panel-result">
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="内积结果" en="Inner product" />
          </span>
          <span className="gt-result-val-strong" style={{ color: conjOn ? 'var(--green)' : 'var(--warn)' }}>
            {fmtC(displayVal)} {conjOn ? (Math.abs(displayVal.re - (pairI === pairJ ? 1 : 0)) < 0.01 ? '= δ ✓' : '') : tr({ zh: '(错误)', en: '(wrong)'
                                  })}
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="期望 δᵢⱼ" en="Expected δᵢⱼ" />
          </span>
          <span className="gt-result-val">{pairI === pairJ ? '1' : '0'}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="虚部残差" en="Imaginary residue" />
          </span>
          <span className="gt-result-val" style={{ color: Math.abs(displayVal.im) < 0.001 ? 'var(--green)' : 'var(--warn)' }}>
            {displayVal.im.toFixed(6)} {Math.abs(displayVal.im) < 0.001 ? '≈ 0 ✓' : '≠ 0 !'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Panel 4: S4 cube-rotation class mapper
// ═════════════════════════════════════════════════════════════════════════════

interface CubeClass {
  colIdx: number;
  nameEn: string;
  nameZh: string;
  cycleType: string;
  size: number;
  axisDesc: string;
}

const CUBE_CLASSES: CubeClass[] = [
  { colIdx: 0, nameEn: 'Identity', nameZh: '恒等', cycleType: '1⁴', size: 1, axisDesc: 'none'
},
  { colIdx: 1, nameEn: 'Edge 180° rotations', nameZh: '棱 180° 旋转', cycleType: '(12)', size: 6, axisDesc: 'edge'
},
  { colIdx: 2, nameEn: 'Face 180° rotations', nameZh: '面 180° 旋转', cycleType: '(12)(34)', size: 3, axisDesc: 'face'
},
  { colIdx: 3, nameEn: 'Vertex 120°/240° rotations', nameZh: '顶点 120°/240° 旋转', cycleType: '(123)', size: 8, axisDesc: 'vertex'
},
  { colIdx: 4, nameEn: 'Face 90°/270° rotations', nameZh: '面 90°/270° 旋转', cycleType: '(1234)', size: 6, axisDesc: 'face90'
},
];

// Isometric projection
function iso(x: number, y: number, z: number): { px: number; py: number } {
  const cos30 = Math.sqrt(3) / 2;
  const sin30 = 0.5;
  return {
    px: (x - z) * cos30,
    py: -y + (x + z) * sin30,
  };
}

function CubeClassMapperPanel({ lang }: { lang: Lang }) {
  const [selected, setSelected] = useState(0); // index into CUBE_CLASSES

  const cls = CUBE_CLASSES[selected];

  // Cube vertices in local coords: (±1, ±1, ±1)
  const V = [
    [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], // back face
    [-1, -1,  1], [1, -1,  1], [1, 1,  1], [-1, 1,  1], // front face
  ];
  const VP = V.map(([x, y, z]) => iso(x, y, z));

  // Cube edges
  const EDGES: [number, number][] = [
    [0,1],[1,2],[2,3],[3,0], // back
    [4,5],[5,6],[6,7],[7,4], // front
    [0,4],[1,5],[2,6],[3,7], // connecting
  ];

  // Center of view: shift so cube is centered
  const OFFSET_X = 0;
  const OFFSET_Y = 0;
  const SX = 40; // scale

  const px = (v: { px: number; py: number }) => ({ x: 100 + OFFSET_X + v.px * SX, y: 100 + OFFSET_Y + v.py * SX });

  // Axis line endpoints for each class type
  const axisEndpoints: { from: [number, number, number]; to: [number, number, number] } | null =
    cls.axisDesc === 'none' ? null :
    cls.axisDesc === 'face' ? { from: [0, -1.6, 0], to: [0, 1.6, 0] } :
    cls.axisDesc === 'face90' ? { from: [-1.6, 0, 0], to: [1.6, 0, 0] } :
    cls.axisDesc === 'edge' ? { from: [-1.6, 0, -1.6], to: [1.6, 0, 1.6] } :
    cls.axisDesc === 'vertex' ? { from: [-1.4, -1.4, -1.4], to: [1.4, 1.4, 1.4] } :
    null;

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="立方体旋转类 ↔ S₄ 共轭类映射" en="Cube rotation types ↔ S₄ conjugacy class mapper" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="当选中 S₄ 时，特征标表的每一列对应一种几何旋转类型。点击下方按钮，在等轴测线框立方体上查看对应旋转轴。"
          en="When S₄ is selected, each column of the character table corresponds to a geometric rotation type of the cube. Click a button to see the corresponding rotation axis on the isometric wireframe."
        />
      </div>

      <div className="gt-panel-input-row">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {CUBE_CLASSES.map((cc, idx) => (
            <button key={idx}
              className={`gt-chip${selected === idx ? ' gt-chip-active' : ''}`}
              onClick={() => setSelected(idx)}
            >
              {lang === 'zh' ? cc.nameZh : cc.nameEn}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        {/* Isometric cube SVG */}
        <svg viewBox="0 0 200 200" width="200" style={{ flexShrink: 0, display: 'block' }}>
          {/* Cube edges */}
          {EDGES.map(([a, b], i) => {
            const pa = px(VP[a]);
            const pb = px(VP[b]);
            return (
              <line key={i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                stroke="var(--ink-dim)" strokeWidth={1.5} />
            );
          })}

          {/* Rotation axis */}
          {axisEndpoints && (() => {
            const fa = iso(...axisEndpoints.from as [number, number, number]);
            const ta = iso(...axisEndpoints.to as [number, number, number]);
            const fa2 = px(fa), ta2 = px(ta);
            return (
              <>
                <line x1={fa2.x} y1={fa2.y} x2={ta2.x} y2={ta2.y}
                  stroke="var(--accent)" strokeWidth={2.5} strokeDasharray="5 3" />
                <circle cx={fa2.x} cy={fa2.y} r={4} fill="var(--accent)" />
                <circle cx={ta2.x} cy={ta2.y} r={4} fill="var(--accent)" />
              </>
            );
          })()}

          {/* Origin dot */}
          {cls.axisDesc === 'none' && (
            <circle cx={100} cy={100} r={6} fill="var(--green)" />
          )}
        </svg>

        {/* Class info */}
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', marginBottom: 6 }}>
            <L zh="S₄ 列索引" en="S₄ column index" />: {cls.colIdx + 1}
          </div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
            {lang === 'zh' ? cls.nameZh : cls.nameEn}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--mono)', fontSize: 13 }}>
            <tbody>
              <tr style={{ borderBottom: '1px dashed var(--rule)' }}>
                <td style={{ padding: '5px 8px 5px 0', color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>
                  <L zh="轮换类型" en="Cycle type" />
                </td>
                <td style={{ padding: '5px 0', color: 'var(--accent)', fontWeight: 700 }}>{cls.cycleType}</td>
              </tr>
              <tr style={{ borderBottom: '1px dashed var(--rule)' }}>
                <td style={{ padding: '5px 8px 5px 0', color: 'var(--ink-faint)' }}>
                  <L zh="类的大小 |C|" en="Class size |C|" />
                </td>
                <td style={{ padding: '5px 0', color: 'var(--ink)', fontWeight: 600 }}>{cls.size}</td>
              </tr>
              <tr style={{ borderBottom: '1px dashed var(--rule)' }}>
                <td style={{ padding: '5px 8px 5px 0', color: 'var(--ink-faint)' }}>
                  <L zh="中心化子阶" en="Centralizer order" />
                </td>
                <td style={{ padding: '5px 0', color: 'var(--ink)' }}>{S4.order / cls.size}</td>
              </tr>
              <tr>
                <td style={{ padding: '5px 8px 5px 0', color: 'var(--ink-faint)' }}>
                  <L zh="S₄ 特征标值" en="S₄ character values" />
                </td>
                <td style={{ padding: '5px 0', color: 'var(--ink-dim)', lineHeight: 1.5 }}>
                  {S4.charVals.map((row, i) => {
                    const z = row[cls.colIdx];
                    const eps = 1e-9;
                    const v = Math.abs(z.im) < eps ? String(Math.round(z.re)) : fmtC(z, 2);
                    return (
                      <span key={i} style={{ display: 'inline-block', marginRight: 6 }}>
                        χ{i + 1}={v}
                      </span>
                    );
                  })}
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: 14, padding: '8px 12px', background: 'color-mix(in srgb, var(--accent-2) 8%, var(--bg-elev))', borderRadius: 4, fontSize: 13, color: 'var(--ink-dim)', fontStyle: 'italic', lineHeight: 1.6 }}>
            <L
              zh={<>
                1+6+3+8+6 = 24 = |S₄|。五类旋转恰好填满立方体所有朝向保持旋转。
              </>}
              en={<>
                1+6+3+8+6 = 24 = |S₄|. The five rotation types account for all orientation-preserving symmetries of the cube.
              </>}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
