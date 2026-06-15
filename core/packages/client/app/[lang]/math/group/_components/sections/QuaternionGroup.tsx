'use client';

import { useState, useMemo, useCallback } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { tr } from '@/i18n/tr';

// ── Q8 element model ──────────────────────────────────────────────────────────
// Each element encoded as { s: 1 | -1, idx: 0|1|2|3 }
// idx: 0 = 1, 1 = i, 2 = j, 3 = k
// element (s, idx) represents s * basis[idx]

type Q8Elem = { s: 1 | -1; idx: 0 | 1 | 2 | 3 };

const Q8_ELEMENTS: Q8Elem[] = [
  { s: 1, idx: 0 },   // 0:  1
  { s: -1, idx: 0 },  // 1: -1
  { s: 1, idx: 1 },   // 2:  i
  { s: -1, idx: 1 },  // 3: -i
  { s: 1, idx: 2 },   // 4:  j
  { s: -1, idx: 2 },  // 5: -j
  { s: 1, idx: 3 },   // 6:  k
  { s: -1, idx: 3 },  // 7: -k
];

const LABELS = ['1', '−1', 'i', '−i', 'j', '−j', 'k', '−k'];

function elemKey(e: Q8Elem): number {
  // index into Q8_ELEMENTS
  return e.s === 1 ? e.idx * 2 : e.idx * 2 + 1;
}

// Multiplication: (s1, a) * (s2, b)
// cyclic(a,b): i*j=k, j*k=i, k*i=j → b === (a % 3) + 1 when a,b in {1,2,3}
function q8Mul(a: Q8Elem, b: Q8Elem): Q8Elem {
  if (a.idx === 0) return { s: (a.s * b.s) as 1 | -1, idx: b.idx };
  if (b.idx === 0) return { s: (a.s * b.s) as 1 | -1, idx: a.idx };
  if (a.idx === b.idx) return { s: (-a.s * b.s) as 1 | -1, idx: 0 };
  // a and b are distinct pure units (i,j,k)
  // cyclic order: 1->2->3->1 (i->j->k->i)
  const cyclic = b.idx === (a.idx % 3) + 1; // ij=k, jk=i, ki=j
  const thirdIdx = (6 - a.idx - b.idx) as 1 | 2 | 3; // remaining index in {1,2,3}
  const sign: 1 | -1 = ((a.s * b.s * (cyclic ? 1 : -1)) as 1 | -1);
  return { s: sign, idx: thirdIdx };
}

function q8Inv(a: Q8Elem): Q8Elem {
  if (a.idx === 0) return a; // ±1 self-inverse
  return { s: (-a.s) as 1 | -1, idx: a.idx }; // i^{-1} = -i etc.
}

// Precompute full 8×8 table
const CAYLEY: number[][] = Array.from({ length: 8 }, (_, r) =>
  Array.from({ length: 8 }, (_, c) =>
    elemKey(q8Mul(Q8_ELEMENTS[r], Q8_ELEMENTS[c]))
  )
);

// Subgroups of Q8 as sets of element indices
const SUBGROUPS: { name: string; nameZh: string; elems: number[]; order: number; isoLabel: string }[] = [
  { name: '{1}', nameZh: '{1}', elems: [0], order: 1, isoLabel: 'C₁' },
  { name: '{±1}', nameZh: '{±1}', elems: [0, 1], order: 2, isoLabel: 'C₂' },
  { name: '⟨i⟩', nameZh: '⟨i⟩', elems: [0, 1, 2, 3], order: 4, isoLabel: 'C₄' },
  { name: '⟨j⟩', nameZh: '⟨j⟩', elems: [0, 1, 4, 5], order: 4, isoLabel: 'C₄' },
  { name: '⟨k⟩', nameZh: '⟨k⟩', elems: [0, 1, 6, 7], order: 4, isoLabel: 'C₄' },
  { name: 'Q₈', nameZh: 'Q₈', elems: [0, 1, 2, 3, 4, 5, 6, 7], order: 8, isoLabel: 'Q₈' },
];

// Hasse diagram positions (normalized for viewBox 0 0 320 280)
const SUBGROUP_POS: { x: number; y: number }[] = [
  { x: 160, y: 250 }, // {1}
  { x: 160, y: 180 }, // {±1}
  { x: 60,  y: 100 }, // <i>
  { x: 160, y: 100 }, // <j>
  { x: 260, y: 100 }, // <k>
  { x: 160, y: 30  }, // Q8
];

// Hasse edges (parent index → child index)
const HASSE_EDGES: [number, number][] = [
  [5, 2], [5, 3], [5, 4], // Q8 -> <i>,<j>,<k>
  [2, 1], [3, 1], [4, 1], // <i>,<j>,<k> -> {±1}
  [1, 0],                  // {±1} -> {1}
];

// D4 elements for involution comparison
// D4 = <r,s | r^4=s^2=e, srs=r^{-1}>, elements: e,r,r^2,r^3,s,rs,r^2 s,r^3 s
// (a,b): a in 0..3, b in {0,1}
// Square of (a,b): use dihedral multiplication
function d4Square(a: number, b: number): { a: number; b: number } {
  // (a,b)*(a,b): b*b=0, n part = a + (-1)^b * a mod 4
  const newA = ((a + (b === 0 ? a : -a)) % 4 + 4) % 4;
  const newB = (b + b) % 2;
  return { a: newA, b: newB };
}

// Character table (shared by Q8 and D4)
// 5 conjugacy classes, 5 irreducibles
// Classes: {e}, {-e/r^2}, {±i / r,r^3}, {±j / s,r^2s}, {±k / rs,r^3 s}
// actually for Q8: {1},{-1},{i,-i},{j,-j},{k,-k} — sizes 1,1,2,2,2
// char values:
//   trivial:    1,1,1,1,1
//   χ₂ (ker<i>): 1,1,1,1,-1   (j,k map to -1? let me use standard table)
// Standard Q8 character table (rows = irreducibles, cols = conjugacy classes in order):
// class order sizes: 1,1,2,2,2
// reps: 1, -1, i, j, k
//   trivial:  1, 1, 1, 1, 1
//   χ₂:       1, 1, 1,-1,-1
//   χ₃:       1, 1,-1, 1,-1
//   χ₄:       1, 1,-1,-1, 1
//   ρ (2-dim): 2,-2, 0, 0, 0
const CHAR_TABLE = [
  [1, 1, 1, 1, 1],
  [1, 1, 1, -1, -1],
  [1, 1, -1, 1, -1],
  [1, 1, -1, -1, 1],
  [2, -2, 0, 0, 0],
];
const CLASS_LABELS_Q8 = ['{1}', '{−1}', '{±i}', '{±j}', '{±k}'];
const CLASS_SIZES_Q8 = [1, 1, 2, 2, 2];
const CLASS_LABELS_D4 = ['{e}', '{r²}', '{r,r³}', '{s,r²s}', '{rs,r³s}'];
const CHAR_ROW_LABELS = ['χ₁', 'χ₂', 'χ₃', 'χ₄', 'ρ'];

// ── Color palette ─────────────────────────────────────────────────────────────
const PALETTE = ['#8B2E3C', '#2A4D69', '#3F7050', '#B8860B', '#6B4E9C', '#C2410C', '#5C7CA0', '#9C4E6B'];

// ── §55 QuaternionGroup ────────────────────────────────────────────────────────

export default function QuaternionGroup() {
  const lang = useLang();

  return (
    <GTSec id="quaternion-group" className="gt-sec">
      <div className="gt-sec-num">§55</div>
      <h2 className="gt-sec-title">
        <L zh="四元数群 Q₈" en="The quaternion group Q₈" />
      </h2>

      <p className="gt-lede">
        <L
          zh={<>
            1843 年，哈密顿在都柏林的一座桥头刻下方程式 <TeX src={String.raw`i^2=j^2=k^2=ijk=-1`} />，宣告了四元数的诞生。由 8 个单位四元数 <TeX src={String.raw`\{\pm1,\pm i,\pm j,\pm k\}`} /> 构成的有限群 <TeX src={String.raw`Q_8`} />，是抽象代数里最令人意外的对象之一：它是非交换的，但它的每一个子群都是正规子群——这一性质通常只属于交换群，却在 <TeX src={String.raw`Q_8`} /> 这个 8 阶非交换群身上成立。
          </>}
          en={<>
            In 1843, Hamilton carved the equation <TeX src={String.raw`i^2=j^2=k^2=ijk=-1`} /> on a Dublin bridge, announcing the birth of quaternions. The group <TeX src={String.raw`Q_8`} /> of the eight unit quaternions <TeX src={String.raw`\{\pm1,\pm i,\pm j,\pm k\}`} /> is one of the most surprising objects in abstract algebra: it is non-abelian, yet every one of its subgroups is normal — a property usually reserved for abelian groups, yet here it holds in a non-abelian group of order 8.
          </>}
        />
      </p>

      {/* ── Definition box ── */}
      <div className="gt-def">
        <div className="gt-def-title">
          <L zh="定义: 四元数群 Q₈" en="Definition: Quaternion group Q₈" />
        </div>
        <div className="gt-def-body">
          <L
            zh={<>
              <strong>四元数群</strong> <TeX src={String.raw`Q_8`} /> 是由 8 个元素 <TeX src={String.raw`\{1,-1,i,-i,j,-j,k,-k\}`} /> 构成的群，乘法满足关系
            </>}
            en={<>
              The <strong>quaternion group</strong> <TeX src={String.raw`Q_8`} /> is the group of 8 elements <TeX src={String.raw`\{1,-1,i,-i,j,-j,k,-k\}`} /> with multiplication subject to
            </>}
          />
          <TeXBlock src={String.raw`i^2 = j^2 = k^2 = ijk = -1,\quad (-1)^2 = 1,\quad -1 \text{ central.}`} />
          <L
            zh={<>
              由此推出循环规则：<TeX src={String.raw`ij=k,\;jk=i,\;ki=j`} />（正向循环 <TeX src={String.raw`i\to j\to k\to i`} />），以及反向乘积引入负号：<TeX src={String.raw`ji=-k,\;kj=-i,\;ik=-j`} />。故 <TeX src={String.raw`ij\neq ji`} />，<TeX src={String.raw`Q_8`} /> 是非交换群。每个纯虚单位满足 <TeX src={String.raw`x^{-1}=-x`} />（阶 4），<TeX src={String.raw`x^2=-1`} />。有限表现为
            </>}
            en={<>
              This implies the cyclic rule: <TeX src={String.raw`ij=k,\;jk=i,\;ki=j`} /> (cyclic order <TeX src={String.raw`i\to j\to k\to i`} />), and reversing any product flips the sign: <TeX src={String.raw`ji=-k,\;kj=-i,\;ik=-j`} />. Hence <TeX src={String.raw`ij\neq ji`} /> and <TeX src={String.raw`Q_8`} /> is non-abelian. Each pure unit satisfies <TeX src={String.raw`x^{-1}=-x`} /> (order 4) and <TeX src={String.raw`x^2=-1`} />. A finite presentation is
            </>}
          />
          <TeXBlock src={String.raw`Q_8 = \langle\, a,b \mid a^4=1,\; a^2=b^2,\; bab^{-1}=a^{-1}\,\rangle.`} />
          <L
            zh={<>
              元素阶分布：阶 1 有 1 个（单位元 1）；阶 2 有 1 个（即 <TeX src={String.raw`-1`} />，<strong>唯一</strong>阶-2 元素）；阶 4 有 6 个（<TeX src={String.raw`\pm i,\pm j,\pm k`} />）。
            </>}
            en={<>
              Element-order distribution: 1 element of order 1 (the identity); 1 element of order 2 (namely <TeX src={String.raw`-1`} />, the <strong>unique</strong> involution); 6 elements of order 4 (<TeX src={String.raw`\pm i,\pm j,\pm k`} />).
            </>}
          />
        </div>
      </div>

      <p>
        <L
          zh={<>
            <TeX src={String.raw`Q_8`} /> 有 5 个共轭类，大小依次为 1, 1, 2, 2, 2：<TeX src={String.raw`\{1\}`} />，<TeX src={String.raw`\{-1\}`} />，<TeX src={String.raw`\{i,-i\}`} />，<TeX src={String.raw`\{j,-j\}`} />，<TeX src={String.raw`\{k,-k\}`} />。中心为 <TeX src={String.raw`Z(Q_8)=\{\pm1\}\cong C_2`} />，它也等于换位子群 <TeX src={String.raw`[Q_8,Q_8]`} /> 和 Frattini 子群（三者在 <TeX src={String.raw`Q_8`} /> 中合一，这正是<em>超特殊群</em>的特征）。商群 <TeX src={String.raw`Q_8/Z(Q_8)\cong C_2\times C_2`} />（Klein 四元群）。
          </>}
          en={<>
            <TeX src={String.raw`Q_8`} /> has 5 conjugacy classes of sizes 1, 1, 2, 2, 2: <TeX src={String.raw`\{1\}`} />, <TeX src={String.raw`\{-1\}`} />, <TeX src={String.raw`\{i,-i\}`} />, <TeX src={String.raw`\{j,-j\}`} />, <TeX src={String.raw`\{k,-k\}`} />. The center is <TeX src={String.raw`Z(Q_8)=\{\pm1\}\cong C_2`} />, which coincides with the commutator subgroup <TeX src={String.raw`[Q_8,Q_8]`} /> and the Frattini subgroup (all three coincide in <TeX src={String.raw`Q_8`} />, the hallmark of an <em>extraspecial group</em>). The quotient <TeX src={String.raw`Q_8/Z(Q_8)\cong C_2\times C_2`} /> (the Klein four-group).
          </>}
        />
      </p>

      {/* ── Theorem: all subgroups normal (Hamiltonian) ── */}
      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理: Q₈ 是最小哈密顿群" en="Theorem: Q₈ is the smallest Hamiltonian group" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>
              <TeX src={String.raw`Q_8`} /> 恰好有 6 个子群：<TeX src={String.raw`\{1\}`} />（阶 1）；<TeX src={String.raw`\{\pm1\}\cong C_2`} />（阶 2，唯一）；<TeX src={String.raw`\langle i\rangle,\langle j\rangle,\langle k\rangle`} />（各阶 4，同构于 <TeX src={String.raw`C_4`} />）；<TeX src={String.raw`Q_8`} /> 本身。其中<strong>每一个</strong>都是正规子群。
              一个非交换群中全部子群均正规者，称为<strong>哈密顿群</strong>（Hamiltonian group）。<TeX src={String.raw`Q_8`} /> 是最小的哈密顿群。
              Dedekind–Baer 结构定理（Dedekind 1897, Baer 1933）：每个哈密顿群 <TeX src={String.raw`G`} /> 同构于 <TeX src={String.raw`Q_8\times B\times D`} />，其中 <TeX src={String.raw`B`} /> 是初等交换 2-群，<TeX src={String.raw`D`} /> 是所有元素阶均为奇数的交换扭群。
            </>}
            en={<>
              <TeX src={String.raw`Q_8`} /> has exactly 6 subgroups: <TeX src={String.raw`\{1\}`} /> (order 1); <TeX src={String.raw`\{\pm1\}\cong C_2`} /> (order 2, unique); <TeX src={String.raw`\langle i\rangle,\langle j\rangle,\langle k\rangle`} /> (order 4 each, each isomorphic to <TeX src={String.raw`C_4`} />); and <TeX src={String.raw`Q_8`} /> itself. <strong>Every</strong> one is a normal subgroup.
              A non-abelian group in which every subgroup is normal is called a <strong>Hamiltonian group</strong>. <TeX src={String.raw`Q_8`} /> is the smallest Hamiltonian group.
              The Dedekind–Baer structure theorem (Dedekind 1897, Baer 1933) states: every Hamiltonian group <TeX src={String.raw`G`} /> decomposes as <TeX src={String.raw`Q_8\times B\times D`} />, where <TeX src={String.raw`B`} /> is an elementary abelian 2-group and <TeX src={String.raw`D`} /> is an abelian torsion group with every element of odd order.
            </>}
          />
        </div>
      </div>

      <p>
        <L
          zh={<>
            <strong>自同构群</strong>：<TeX src={String.raw`\operatorname{Aut}(Q_8)\cong S_4`} />（阶 24），内自同构群 <TeX src={String.raw`\operatorname{Inn}(Q_8)\cong Q_8/Z(Q_8)\cong C_2\times C_2`} />（阶 4），外自同构群 <TeX src={String.raw`\operatorname{Out}(Q_8)\cong S_3`} />（阶 6）。自同构通过置换三条"轴" <TeX src={String.raw`\{\pm i\},\{\pm j\},\{\pm k\}`} /> 并选择正负号来作用。
          </>}
          en={<>
            <strong>Automorphism group</strong>: <TeX src={String.raw`\operatorname{Aut}(Q_8)\cong S_4`} /> (order 24); inner automorphisms <TeX src={String.raw`\operatorname{Inn}(Q_8)\cong Q_8/Z(Q_8)\cong C_2\times C_2`} /> (order 4); outer automorphisms <TeX src={String.raw`\operatorname{Out}(Q_8)\cong S_3`} /> (order 6). Automorphisms act by permuting the three &ldquo;axes&rdquo; <TeX src={String.raw`\{\pm i\},\{\pm j\},\{\pm k\}`} /> and choosing signs.
          </>}
        />
      </p>

      {/* ── Panel 1: Quaternion multiplier + live Cayley table ── */}
      <CayleyPanel lang={lang} />

      {/* ── Panel 2: Subgroup lattice ── */}
      <LatticePanel lang={lang} />

      {/* Q8 vs D4 section ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="Q₈ 与 D₄：同一特征标表，不同的群" en="Q₈ vs D₄: same character table, different groups" />
      </h3>

      <p>
        <L
          zh={<>
            8 阶有且仅有两个非交换群：<TeX src={String.raw`Q_8`} /> 和正方形的二面体群 <TeX src={String.raw`D_4`} />（阶 8，表现为 <TeX src={String.raw`\langle r,s\mid r^4=s^2=e,\,srs^{-1}=r^{-1}\rangle`} />）。两者都有 5 个共轭类，大小均为 1,1,2,2,2，因而拥有<strong>完全相同</strong>的（普通复特征标）特征标表：四个 1 维特征标与一个 2 维不可约特征标（满足 <TeX src={String.raw`1^2+1^2+1^2+1^2+2^2=8`} />）。这是"特征标表不能区分有限群"的经典反例。
          </>}
          en={<>
            There are exactly two non-abelian groups of order 8: <TeX src={String.raw`Q_8`} /> and the dihedral group <TeX src={String.raw`D_4`} /> of the square (order 8, presentation <TeX src={String.raw`\langle r,s\mid r^4=s^2=e,\,srs^{-1}=r^{-1}\rangle`} />). Both have 5 conjugacy classes of sizes 1,1,2,2,2, and therefore <strong>identical</strong> (ordinary complex) character tables: four 1-dimensional characters and one 2-dimensional irreducible (satisfying <TeX src={String.raw`1^2+1^2+1^2+1^2+2^2=8`} />). This is the canonical counterexample to &ldquo;character tables determine finite groups.&rdquo;
          </>}
        />
      </p>

      <p>
        <L
          zh={<>
            区分它们的不变量：<TeX src={String.raw`Q_8`} /> 有<strong>唯一</strong>一个阶-2 元素（即 <TeX src={String.raw`-1`} />，因为 <TeX src={String.raw`i^2=j^2=k^2=-1\neq 1`} />），而 <TeX src={String.raw`D_4`} /> 有 5 个阶-2 元素（180° 旋转 <TeX src={String.raw`r^2`} /> 和四条反射轴 <TeX src={String.raw`s,rs,r^2s,r^3s`} />）。更深层的差异在于 Schur 指标：<TeX src={String.raw`Q_8`} /> 的 2 维不可约表示在有理数域 <TeX src={String.raw`\mathbb{Q}`} /> 上的 Schur 指标为 2（可在有理四元数除代数上实现，但不能在 <TeX src={String.raw`\mathbb{Q}`} /> 上的 <TeX src={String.raw`2\times 2`} /> 矩阵中实现），而 <TeX src={String.raw`D_4`} /> 的对应表示 Schur 指标为 1。
          </>}
          en={<>
            The distinguishing invariant: <TeX src={String.raw`Q_8`} /> has a <strong>unique</strong> element of order 2 (namely <TeX src={String.raw`-1`} />, since <TeX src={String.raw`i^2=j^2=k^2=-1\neq1`} />), while <TeX src={String.raw`D_4`} /> has 5 elements of order 2 (the 180° rotation <TeX src={String.raw`r^2`} /> and the four reflections <TeX src={String.raw`s,rs,r^2s,r^3s`} />). A deeper distinction is the Schur index: the 2-dimensional irreducible of <TeX src={String.raw`Q_8`} /> has Schur index 2 over <TeX src={String.raw`\mathbb{Q}`} /> (realizable over the rational quaternion division algebra but not via 2×2 matrices over <TeX src={String.raw`\mathbb{Q}`} />), whereas the corresponding irreducible of <TeX src={String.raw`D_4`} /> has Schur index 1.
          </>}
        />
      </p>

      {/* ── Panel 3: Character table comparator ── */}
      <CharTablePanel lang={lang} />

      {/* Cube connection ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="与魔方的联系" en="Connection to the cube" />
      </h3>

      <div className="gt-aside">
        <L
          zh={<>
            单位四元数群 <TeX src={String.raw`Q_8\subset S^3\cong\mathrm{SU}(2)`} /> 通过 2-1 覆盖 <TeX src={String.raw`q\mapsto(v\mapsto qvq^{-1})`} /> 映射到 <TeX src={String.raw`\mathrm{SO}(3)`} />：<TeX src={String.raw`\pm1`} /> 均映到恒等旋转，<TeX src={String.raw`\pm i,\pm j,\pm k`} /> 各自（两个一对）映到绕三个坐标轴的 180° 旋转，因此 <TeX src={String.raw`Q_8`} /> 映射到 <TeX src={String.raw`\mathrm{SO}(3)`} /> 中的 Klein 四元群 <TeX src={String.raw`V_4=\{I,180°_x,180°_y,180°_z\}\cong C_2\times C_2`} />，即正方体三对面轴的半转子群。<strong>注意</strong>：<TeX src={String.raw`Q_8`} /> 本身并不是 <TeX src={String.raw`\mathrm{SO}(3)`} /> 的子群（在 <TeX src={String.raw`\mathrm{SO}(3)`} /> 中没有有限非循环群包含唯一一个对合元素）；这个"加倍"（<TeX src={String.raw`i`} /> 与 <TeX src={String.raw`-i`} /> 给出同一个物理旋转）正是 720° 自旋子现象。最干净的联系是：<TeX src={String.raw`\operatorname{Aut}(Q_8)\cong S_4\cong`} /> 正方体的旋转对称群（24 阶），两者均同构于 <TeX src={String.raw`S_4`} />（置换 <TeX src={String.raw`Q_8`} /> 三条轴 <TeX src={String.raw`\{\pm i\},\{\pm j\},\{\pm k\}`} /> 的方式，镜像于正方体旋转对其 3 对对边轴的置换）。
          </>}
          en={<>
            The unit quaternion group <TeX src={String.raw`Q_8\subset S^3\cong\mathrm{SU}(2)`} /> maps to <TeX src={String.raw`\mathrm{SO}(3)`} /> via the 2-to-1 covering <TeX src={String.raw`q\mapsto(v\mapsto qvq^{-1})`} />: both <TeX src={String.raw`\pm1`} /> map to the identity rotation, and each of <TeX src={String.raw`\pm i,\pm j,\pm k`} /> (in pairs) maps to the 180° half-turn about a coordinate axis. So <TeX src={String.raw`Q_8`} /> surjects onto the Klein four-group <TeX src={String.raw`V_4=\{I,180°_x,180°_y,180°_z\}`} /> of half-turns of a cube about its three face-axes. <strong>Caveat</strong>: <TeX src={String.raw`Q_8`} /> itself is NOT a subgroup of <TeX src={String.raw`\mathrm{SO}(3)`} /> — no finite non-cyclic group with a unique involution embeds there; the &ldquo;doubling&rdquo; (<TeX src={String.raw`i`} /> and <TeX src={String.raw`-i`} /> yielding the same physical rotation) is exactly the spinor / 720° phenomenon. The cleanest correct connection is: <TeX src={String.raw`\operatorname{Aut}(Q_8)\cong S_4\cong`} /> the rotation group of the cube (both of order 24), since the automorphisms permute the three axes <TeX src={String.raw`\{\pm i\},\{\pm j\},\{\pm k\}`} /> in the same way cube rotations permute its three pairs of opposite-face axes.
          </>}
        />
      </div>

      {/* References ── */}
      <div className="gt-refs" style={{ marginTop: 40 }}>
        <div className="gt-def-title" style={{ marginBottom: 10 }}>
          <L zh="参考文献" en="References" />
        </div>
        <ol>
          <li>Dummit &amp; Foote, <em>Abstract Algebra</em>, 3rd ed., §1.5 (quaternion group Q₈) and the representation-theory chapter (character-table comparison of Q₈ and D₄).</li>
          <li>I. M. Isaacs, <em>Character Theory of Finite Groups</em> (Dover) — Q₈ vs D₄ sharing a character table; Schur indices.</li>
          <li>Wikipedia, <a href="https://en.wikipedia.org/wiki/Quaternion_group" target="_blank" rel="noopener noreferrer">&ldquo;Quaternion group&rdquo;</a> — multiplication, conjugacy classes, character table, Aut(Q₈) ≅ S₄, Hamiltonian property.</li>
          <li>Wikipedia, <a href="https://en.wikipedia.org/wiki/Hamiltonian_group" target="_blank" rel="noopener noreferrer">&ldquo;Hamiltonian group&rdquo;</a> — Dedekind (1897), Baer (1933) structure theorem.</li>
          <li>Groupprops, &ldquo;Quaternion group&rdquo; — order statistics 1↦1, 2↦1, 4↦6; conjugacy class sizes 1,1,2,2,2; extraspecial; dicyclic Dic₂; |Aut|=24.</li>
        </ol>
      </div>
    </GTSec>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Panel 1: Quaternion multiplier + live Cayley table
// ═══════════════════════════════════════════════════════════════════════════════

function CayleyPanel({ lang }: { lang: 'zh' | 'en' }) {
  const [leftIdx, setLeftIdx] = useState<number>(2);   // default: i
  const [rightIdx, setRightIdx] = useState<number>(4);  // default: j
  const [showFull, setShowFull] = useState(false);
  const [highlightCyclic, setHighlightCyclic] = useState(false);

  const productIdx = useMemo(() =>
    CAYLEY[leftIdx][rightIdx],
    [leftIdx, rightIdx]
  );

  // Color for each element index (based on order)
  function cellColor(idx: number): string {
    if (idx === 0) return 'var(--green)';   // 1
    if (idx === 1) return 'var(--accent)';  // -1
    if (idx <= 3) return '#2A4D69';         // ±i
    if (idx <= 5) return '#6B4E9C';         // ±j
    return '#B8860B';                       // ±k
  }

  // Cyclic triangle: cells (i,j) and (j,k) and (k,i) (element indices 2,4,6)
  function isCyclicCell(r: number, c: number): boolean {
    if (!highlightCyclic) return false;
    // ij=k, jk=i, ki=j
    if (r === 2 && c === 4) return true; // i*j = k
    if (r === 4 && c === 6) return true; // j*k = i
    if (r === 6 && c === 2) return true; // k*i = j
    return false;
  }

  const CELL_SIZE = 28;
  const HEADER_SIZE = 32;
  const TABLE_W = HEADER_SIZE + 8 * CELL_SIZE;
  const TABLE_H = HEADER_SIZE + 8 * CELL_SIZE;

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="四元数乘法器与 Cayley 表" en="Quaternion multiplier and Cayley table" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="点击左因子和右因子，实时查看乘积，并在 8×8 乘法表中高亮对应单元格。"
          en="Click a left factor and a right factor to see the product live, highlighted in the 8×8 Cayley table."
        />
      </div>

      {/* Element selector row */}
      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-dim)', marginRight: 4 }}>
          <L zh="左因子" en="Left" />:
        </span>
        {LABELS.map((lbl, idx) => (
          <button
            key={idx}
            className={`gt-chip${leftIdx === idx ? ' gt-chip-active' : ''}`}
            onClick={() => setLeftIdx(idx)}
            style={{ minWidth: 32 }}
          >
            {lbl}
          </button>
        ))}
      </div>
      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-dim)', marginRight: 4 }}>
          <L zh="右因子" en="Right" />:
        </span>
        {LABELS.map((lbl, idx) => (
          <button
            key={idx}
            className={`gt-chip${rightIdx === idx ? ' gt-chip-active' : ''}`}
            onClick={() => setRightIdx(idx)}
            style={{ minWidth: 32 }}
          >
            {lbl}
          </button>
        ))}
      </div>

      {/* Product display */}
      <div className="gt-panel-result" style={{ marginBottom: 14 }}>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <span style={{ fontFamily: 'var(--mono)' }}>{LABELS[leftIdx]}</span>
            <span style={{ margin: '0 6px' }}>×</span>
            <span style={{ fontFamily: 'var(--mono)' }}>{LABELS[rightIdx]}</span>
            <span style={{ margin: '0 6px' }}>=</span>
          </span>
          <span className="gt-result-val-strong" style={{ color: cellColor(productIdx), fontSize: 20 }}>
            {LABELS[productIdx]}
          </span>
        </div>
        {leftIdx !== 0 && rightIdx !== 0 && leftIdx !== 1 && rightIdx !== 1 &&
          Math.floor(leftIdx / 2) !== Math.floor(rightIdx / 2) && (
          <div className="gt-result-row" style={{ fontSize: 12, color: 'var(--ink-dim)' }}>
            <span className="gt-result-label"><L zh="反向乘积" en="Reverse product" /></span>
            <span className="gt-result-val">
              {LABELS[rightIdx]} × {LABELS[leftIdx]} = {LABELS[CAYLEY[rightIdx][leftIdx]]}
              {CAYLEY[rightIdx][leftIdx] !== productIdx && (
                <span style={{ color: 'var(--accent)', marginLeft: 8 }}>
                  <L zh="（不等，非交换！）" en="(different — non-abelian!)" />
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Toggle buttons */}
      <div className="gt-panel-input-row" style={{ gap: 8, marginBottom: 12 }}>
        <button
          className={`gt-btn${showFull ? '' : '-ghost'} gt-btn`}
          onClick={() => setShowFull(v => !v)}
          style={{ fontSize: 12 }}
        >
          <L zh={showFull ? '隐藏完整表' : '展开完整表'} en={showFull ? 'Hide full table' : 'Show full table'} />
        </button>
        <button
          className={`gt-btn${highlightCyclic ? '' : '-ghost'} gt-btn`}
          onClick={() => setHighlightCyclic(v => !v)}
          style={{ fontSize: 12 }}
        >
          <L zh="高亮循环规则 i→j→k" en="Highlight cyclic rule i→j→k" />
        </button>
      </div>

      {/* Cayley table SVG */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <svg
          viewBox={`0 0 ${TABLE_W} ${TABLE_H}`}
          width="100%"
          style={{ display: 'block', minWidth: Math.min(TABLE_W, 300), maxWidth: TABLE_W }}
        >
          {/* Column headers */}
          {Q8_ELEMENTS.map((_, c) => (
            <g key={`ch${c}`}>
              <rect
                x={HEADER_SIZE + c * CELL_SIZE} y={0}
                width={CELL_SIZE} height={HEADER_SIZE}
                fill={c === rightIdx ? 'color-mix(in srgb, var(--accent-2) 18%, var(--bg-elev))' : 'var(--bg-elev)'}
                stroke="var(--rule)" strokeWidth={0.5}
              />
              <text
                x={HEADER_SIZE + c * CELL_SIZE + CELL_SIZE / 2}
                y={HEADER_SIZE / 2 + 4}
                textAnchor="middle"
                style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: c === rightIdx ? 700 : 400 }}
                fill={c === rightIdx ? 'var(--accent-2)' : 'var(--ink-dim)'}
              >
                {LABELS[c]}
              </text>
            </g>
          ))}

          {/* Row headers */}
          {Q8_ELEMENTS.map((_, r) => (
            <g key={`rh${r}`}>
              <rect
                x={0} y={HEADER_SIZE + r * CELL_SIZE}
                width={HEADER_SIZE} height={CELL_SIZE}
                fill={r === leftIdx ? 'color-mix(in srgb, var(--accent) 18%, var(--bg-elev))' : 'var(--bg-elev)'}
                stroke="var(--rule)" strokeWidth={0.5}
              />
              <text
                x={HEADER_SIZE / 2}
                y={HEADER_SIZE + r * CELL_SIZE + CELL_SIZE / 2 + 4}
                textAnchor="middle"
                style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: r === leftIdx ? 700 : 400 }}
                fill={r === leftIdx ? 'var(--accent)' : 'var(--ink-dim)'}
              >
                {LABELS[r]}
              </text>
            </g>
          ))}

          {/* Cells */}
          {Q8_ELEMENTS.map((_, r) =>
            Q8_ELEMENTS.map((_, c) => {
              const val = CAYLEY[r][c];
              const isSelected = r === leftIdx && c === rightIdx;
              const isCyc = isCyclicCell(r, c);
              const showCell = showFull || isSelected;
              const x = HEADER_SIZE + c * CELL_SIZE;
              const y = HEADER_SIZE + r * CELL_SIZE;
              return (
                <g key={`${r}-${c}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => { setLeftIdx(r); setRightIdx(c); }}
                >
                  <rect
                    x={x} y={y} width={CELL_SIZE} height={CELL_SIZE}
                    fill={
                      isSelected
                        ? 'color-mix(in srgb, var(--accent) 22%, var(--bg-elev))'
                        : isCyc
                        ? 'color-mix(in srgb, var(--gold) 18%, var(--bg-elev))'
                        : (r === leftIdx || c === rightIdx)
                        ? 'color-mix(in srgb, var(--rule) 35%, var(--bg-elev))'
                        : 'var(--bg-elev)'
                    }
                    stroke={isSelected ? 'var(--accent)' : isCyc ? 'var(--gold)' : 'var(--rule)'}
                    strokeWidth={isSelected ? 1.5 : isCyc ? 1.5 : 0.5}
                  />
                  {showCell && (
                    <text
                      x={x + CELL_SIZE / 2} y={y + CELL_SIZE / 2 + 4}
                      textAnchor="middle"
                      style={{ fontFamily: 'var(--mono)', fontSize: 9, pointerEvents: 'none' }}
                      fill={isSelected ? 'var(--accent)' : isCyc ? 'var(--gold)' : cellColor(val)}
                    >
                      {LABELS[val]}
                    </text>
                  )}
                </g>
              );
            })
          )}

          {/* Cyclic triangle arrows (i→j→k) when highlighted */}
          {highlightCyclic && (() => {
            // nodes: i=elem 2, j=elem 4, k=elem 6 (row header positions)
            // Draw triangle in the "axis" region (below the table header, outside cells)
            // Actually draw small ring below the table
            const R = 22;
            const centerX = TABLE_W / 2;
            const centerY = TABLE_H + 36;
            const angle = (idx: number) => ((idx * 2 * Math.PI) / 3) - Math.PI / 2;
            const pts = [0, 1, 2].map(k => ({
              x: centerX + R * Math.cos(angle(k)),
              y: centerY + R * Math.sin(angle(k)),
              label: ['i', 'j', 'k'][k],
            }));
            return (
              <g transform={`translate(0, 0)`}>
                {[0, 1, 2].map(k => {
                  const from = pts[k];
                  const to = pts[(k + 1) % 3];
                  const mx = (from.x + to.x) / 2;
                  const my = (from.y + to.y) / 2;
                  return (
                    <g key={k}>
                      <line
                        x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                        stroke="var(--gold)" strokeWidth={1.5}
                        markerEnd="url(#arrowCyclic)"
                      />
                      <text x={mx} y={my} textAnchor="middle"
                        style={{ fontFamily: 'var(--mono)', fontSize: 8 }}
                        fill="var(--gold)">{['ij=k', 'jk=i', 'ki=j'][k]}</text>
                    </g>
                  );
                })}
                {pts.map((p, k) => (
                  <g key={k}>
                    <circle cx={p.x} cy={p.y} r={10} fill="var(--bg-elev)" stroke="var(--gold)" strokeWidth={1.5} />
                    <text x={p.x} y={p.y + 4} textAnchor="middle"
                      style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700 }}
                      fill="var(--gold)">{p.label}</text>
                  </g>
                ))}
                <text x={centerX} y={centerY + R + 16} textAnchor="middle"
                  style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--ink-faint)">
                  {tr({ zh: '循环规则 i→j→k→i', en: 'cyclic rule i→j→k→i'
                })}
                </text>
              </g>
            );
          })()}

          <defs>
            <marker id="arrowCyclic" markerWidth={6} markerHeight={6} refX={5} refY={3} orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="var(--gold)" />
            </marker>
          </defs>
        </svg>
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-faint)', fontFamily: 'var(--mono)' }}>
        <L
          zh="点击任意单元格选择左/右因子；点击「展开完整表」填入全部 64 个乘积。"
          en="Click any cell to select left/right factors; use 'Show full table' to fill all 64 products."
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Panel 2: Subgroup lattice with normality verification
// ═══════════════════════════════════════════════════════════════════════════════

function LatticePanel({ lang }: { lang: 'zh' | 'en' }) {
  const [selectedSG, setSelectedSG] = useState<number>(2); // index into SUBGROUPS
  const [verifyG, setVerifyG] = useState<number>(2);       // conjugator index in Q8_ELEMENTS
  const [verified, setVerified] = useState(false);

  const sg = SUBGROUPS[selectedSG];

  // Verify normality: compute g*H*g^{-1} for chosen g
  const conjugated = useMemo(() => {
    const g = Q8_ELEMENTS[verifyG];
    const gInv = q8Inv(g);
    return sg.elems.map(hIdx => {
      const h = Q8_ELEMENTS[hIdx];
      const gHgInv = q8Mul(q8Mul(g, h), gInv);
      return elemKey(gHgInv);
    });
  }, [sg, verifyG]);

  const isNormalVerified = useMemo(() =>
    new Set(conjugated).size === new Set(sg.elems).size &&
    conjugated.every(idx => sg.elems.includes(idx)),
    [conjugated, sg.elems]
  );

  // Cosets of selected subgroup (left cosets)
  const cosets = useMemo(() => {
    const cosetMap = new Map<number, number[]>();
    const assigned = new Set<number>();
    for (const gIdx of [0, 1, 2, 3, 4, 5, 6, 7]) {
      if (assigned.has(gIdx)) continue;
      const coset = sg.elems.map(hIdx =>
        CAYLEY[gIdx][hIdx]
      );
      const key = [...new Set(coset)].sort((a, b) => a - b).join(',');
      const keyNum = parseInt(key.split(',')[0], 10);
      if (!cosetMap.has(keyNum)) {
        cosetMap.set(keyNum, [...new Set(coset)]);
        coset.forEach(i => assigned.add(i));
      }
    }
    return [...cosetMap.values()];
  }, [sg]);

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="子群格: 每个子群都是正规子群" en="Subgroup lattice: every subgroup is normal" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="点击 Hasse 图中的节点选择子群，右侧验证正规性（对任意 g 计算 gHg⁻¹=H）。"
          en="Click a node in the Hasse diagram to select a subgroup; the panel on the right verifies normality (computing gHg⁻¹=H for a chosen g)."
        />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        {/* Hasse diagram SVG */}
        <div style={{ flexShrink: 0 }}>
          <svg viewBox="0 0 320 280" width={280} style={{ display: 'block' }}>
            {/* Edges */}
            {HASSE_EDGES.map(([from, to], i) => {
              const f = SUBGROUP_POS[from];
              const t = SUBGROUP_POS[to];
              return (
                <line key={i}
                  x1={f.x} y1={f.y} x2={t.x} y2={t.y}
                  stroke="var(--rule)" strokeWidth={1.5}
                />
              );
            })}

            {/* Nodes */}
            {SUBGROUPS.map((sg_, i) => {
              const pos = SUBGROUP_POS[i];
              const isSel = i === selectedSG;
              const nodeColor = PALETTE[i % PALETTE.length];
              return (
                <g key={i} style={{ cursor: 'pointer' }} onClick={() => { setSelectedSG(i); setVerified(false); }}>
                  <circle
                    cx={pos.x} cy={pos.y} r={26}
                    fill={isSel ? `color-mix(in srgb, ${nodeColor} 22%, var(--bg-elev))` : 'var(--bg-elev)'}
                    stroke={isSel ? nodeColor : 'var(--rule)'}
                    strokeWidth={isSel ? 2.5 : 1.5}
                  />
                  {/* ⊴ badge */}
                  <text
                    x={pos.x + 18} y={pos.y - 16}
                    style={{ fontFamily: 'var(--serif)', fontSize: 11, fontWeight: 700 }}
                    fill="var(--green)"
                  >⊴</text>
                  <text
                    x={pos.x} y={pos.y - 4}
                    textAnchor="middle"
                    style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: isSel ? 700 : 400 }}
                    fill={isSel ? nodeColor : 'var(--ink)'}
                  >
                    {sg_.name}
                  </text>
                  <text
                    x={pos.x} y={pos.y + 10}
                    textAnchor="middle"
                    style={{ fontFamily: 'var(--mono)', fontSize: 9 }}
                    fill="var(--ink-dim)"
                  >
                    {sg_.isoLabel}
                  </text>
                  <text
                    x={pos.x} y={pos.y + 22}
                    textAnchor="middle"
                    style={{ fontFamily: 'var(--mono)', fontSize: 8 }}
                    fill="var(--ink-faint)"
                  >
                    |{sg_.order}|
                  </text>
                </g>
              );
            })}

            {/* Legend */}
            <text x={10} y={270} style={{ fontFamily: 'var(--mono)', fontSize: 8 }} fill="var(--green)">
              {tr({ zh: '⊴ = 正规子群', en: '⊴ = normal subgroup'
            })}
            </text>
          </svg>
        </div>

        {/* Right panel: subgroup info + normality verifier */}
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink)', marginBottom: 8 }}>
            <L zh="已选" en="Selected" />: <strong>{sg.name}</strong>
            <span style={{ marginLeft: 8, color: 'var(--ink-dim)', fontSize: 11 }}>≅ {sg.isoLabel}</span>
          </div>

          {/* Elements as chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
            {sg.elems.map(idx => (
              <span key={idx} style={{
                fontFamily: 'var(--mono)', fontSize: 12, padding: '2px 8px',
                background: 'color-mix(in srgb, var(--accent-2) 12%, var(--bg-elev))',
                border: '1px solid var(--accent-2)', borderRadius: 4,
                color: 'var(--accent-2)',
              }}>
                {LABELS[idx]}
              </span>
            ))}
          </div>

          {/* Cosets */}
          {sg.order < 8 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--ink-dim)', marginBottom: 5 }}>
                <L zh="左陪集" en="Left cosets" />:
              </div>
              {cosets.map((coset, ci) => (
                <div key={ci} style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-faint)', marginRight: 3 }}>
                    {ci === 0 ? 'H' : `g${ci}H`}:
                  </span>
                  {coset.map(idx => (
                    <span key={idx} style={{
                      fontFamily: 'var(--mono)', fontSize: 10, padding: '1px 5px',
                      background: 'var(--bg-deep)', border: '1px solid var(--rule)',
                      borderRadius: 3, color: ci === 0 ? 'var(--green)' : 'var(--ink-dim)',
                    }}>
                      {LABELS[idx]}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Normality verifier */}
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--ink-dim)', marginBottom: 6 }}>
              <L zh="选共轭元 g，验证 gHg⁻¹ = H" en="Choose conjugator g, verify gHg⁻¹ = H" />:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
              {Q8_ELEMENTS.map((_, idx) => (
                <button
                  key={idx}
                  className={`gt-chip${verifyG === idx ? ' gt-chip-active' : ''}`}
                  onClick={() => { setVerifyG(idx); setVerified(false); }}
                  style={{ fontSize: 11, minWidth: 28 }}
                >
                  {LABELS[idx]}
                </button>
              ))}
            </div>
            <button
              className="gt-btn"
              style={{ fontSize: 11, marginBottom: 8 }}
              onClick={() => setVerified(true)}
            >
              <L zh="执行验证" en="Verify normality" />
            </button>

            {verified && (
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-dim)', marginBottom: 4 }}>
                  {LABELS[verifyG]}·H·{LABELS[verifyG]}⁻¹:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
                  {sg.elems.map((hIdx, i) => (
                    <span key={hIdx} style={{
                      fontFamily: 'var(--mono)', fontSize: 10, padding: '1px 5px',
                      background: 'var(--bg-deep)', border: '1px solid var(--rule)',
                      borderRadius: 3, color: 'var(--ink)',
                    }}>
                      {LABELS[verifyG]}·{LABELS[hIdx]}·{LABELS[verifyG]}⁻¹ = {LABELS[conjugated[i]]}
                    </span>
                  ))}
                </div>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700,
                  color: isNormalVerified ? 'var(--green)' : 'var(--warn)',
                  padding: '6px 10px',
                  background: isNormalVerified
                    ? 'color-mix(in srgb, var(--green) 10%, var(--bg-elev))'
                    : 'color-mix(in srgb, var(--warn) 10%, var(--bg-elev))',
                  borderRadius: 5,
                  border: `1px solid ${isNormalVerified ? 'var(--green)' : 'var(--warn)'}`,
                }}>
                  {isNormalVerified
                    ? (lang === 'zh' ? `gHg⁻¹ = H ✓ — ${sg.name} 是正规子群` : `gHg⁻¹ = H ✓ — ${sg.name} is normal`)
                    : tr({ zh: 'gHg⁻¹ ≠ H — 不正规（理论上不应出现）', en: 'gHg⁻¹ ≠ H — not normal (should not occur)'
                                                          })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Panel 3: Character table comparator + involution counter
// ═══════════════════════════════════════════════════════════════════════════════

function CharTablePanel({ lang }: { lang: 'zh' | 'en' }) {
  const [mode, setMode] = useState<'side' | 'Q8' | 'D4'>('side');
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState<number>(-1);
  const [showMatchHighlight, setShowMatchHighlight] = useState(false);

  const startScan = useCallback(() => {
    setScanning(true);
    setScanStep(0);
    let step = 0;
    const run = () => {
      step++;
      setScanStep(step);
      if (step < 8) {
        setTimeout(run, 220);
      } else {
        setScanning(false);
      }
    };
    setTimeout(run, 220);
  }, []);

  // D4 elements: (a, b) index = a + 4*b, a in 0..3, b in {0,1}
  // 0=e,1=r,2=r²,3=r³,4=s,5=rs,6=r²s,7=r³s
  const D4_LABELS = ['e', 'r', 'r²', 'r³', 's', 'rs', 'r²s', 'r³s'];
  const q8Involutions = [1]; // only -1 (index 1) in Q8
  const d4Involutions = [2, 4, 5, 6, 7]; // r², s, rs, r²s, r³s in D4

  function isQ8Involution(idx: number): boolean { return idx === 1; }
  function isD4Involution(idx: number): boolean { return [2, 4, 5, 6, 7].includes(idx); }

  const q8Square = useCallback((idx: number): string => {
    const e = Q8_ELEMENTS[idx];
    const sq = q8Mul(e, e);
    return LABELS[elemKey(sq)];
  }, []);

  const d4SquareName = (idx: number): string => {
    const a = idx % 4, b = Math.floor(idx / 4);
    const sq = d4Square(a, b);
    const sup = ['', '', '²', '³'];
    if (sq.a === 0 && sq.b === 0) return 'e';
    if (sq.b === 0) return `r${sup[sq.a]}`;
    return `r${sup[sq.a]}s`;
  };

  const CELL_W = 46, CELL_H = 28;
  const tableW = 6 * CELL_W + 10;

  function CharTable({ title, classLabels, classSizes, highlightRows }: {
    title: string;
    classLabels: string[];
    classSizes: number[];
    highlightRows: boolean;
  }) {
    return (
      <div style={{ flex: 1, minWidth: 260 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-dim)', marginBottom: 6, fontWeight: 600 }}>
          {title}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <svg viewBox={`0 0 ${tableW} ${(6) * CELL_H + 4}`} width="100%" style={{ display: 'block', minWidth: 260, maxWidth: tableW }}>
            {/* Header row: class labels + sizes */}
            {classLabels.map((cl, c) => (
              <g key={c}>
                <rect
                  x={c * CELL_W + 4} y={0} width={CELL_W - 2} height={CELL_H}
                  fill="color-mix(in srgb, var(--accent-2) 10%, var(--bg-elev))"
                  stroke="var(--rule)" strokeWidth={0.5}
                />
                <text x={c * CELL_W + 4 + CELL_W / 2 - 1} y={10}
                  textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 8 }}
                  fill="var(--ink-dim)">{cl}</text>
                <text x={c * CELL_W + 4 + CELL_W / 2 - 1} y={22}
                  textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 8 }}
                  fill="var(--ink-faint)">|{classSizes[c]}|</text>
              </g>
            ))}
            {/* Data rows */}
            {CHAR_TABLE.map((row, r) =>
              row.map((val, c) => {
                const isTwoRow = r === 4;
                const isHighlighted = highlightRows && showMatchHighlight;
                return (
                  <g key={`${r}-${c}`}>
                    <rect
                      x={c * CELL_W + 4} y={(r + 1) * CELL_H} width={CELL_W - 2} height={CELL_H}
                      fill={
                        isTwoRow && isHighlighted
                          ? 'color-mix(in srgb, var(--gold) 15%, var(--bg-elev))'
                          : isHighlighted
                          ? 'color-mix(in srgb, var(--green) 8%, var(--bg-elev))'
                          : 'var(--bg-elev)'
                      }
                      stroke="var(--rule)" strokeWidth={0.5}
                    />
                    <text
                      x={c * CELL_W + 4 + CELL_W / 2 - 1} y={(r + 1) * CELL_H + 18}
                      textAnchor="middle"
                      style={{ fontFamily: 'var(--mono)', fontSize: 11 }}
                      fill={isTwoRow ? 'var(--gold)' : val < 0 ? 'var(--accent)' : 'var(--ink)'}
                    >
                      {CHAR_ROW_LABELS[r]}: {val}
                    </text>
                  </g>
                );
              })
            )}
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="特征标表对比: Q₈ vs D₄ (相同但群不同)" en="Character table comparison: Q₈ vs D₄ (identical tables, different groups)" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="两个群的复特征标表完全相同，但阶-2 元素数目迥异，是同构不变量。"
          en="Both groups have identical complex character tables, yet their involution counts differ — a simple isomorphism invariant."
        />
      </div>

      <div className="gt-panel-input-row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {(['side', 'Q8', 'D4'] as const).map(m => (
          <button key={m} className={`gt-chip${mode === m ? ' gt-chip-active' : ''}`}
            onClick={() => setMode(m)}>
            {m === 'side' ? tr({ zh: '并排', en: 'side by side'
                            })
              : m === 'Q8' ? 'Q₈'
              : 'D₄'}
          </button>
        ))}
        <button
          className={`gt-btn${showMatchHighlight ? '' : '-ghost'} gt-btn`}
          style={{ fontSize: 11 }}
          onClick={() => setShowMatchHighlight(v => !v)}
        >
          <L zh="高亮吻合行" en="Highlight matching rows" />
        </button>
      </div>

      {/* Character tables */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginBottom: 16 }}>
        {(mode === 'side' || mode === 'Q8') && (
          <CharTable
            title={tr({ zh: 'Q₈ 的特征标表', en: 'Character table of Q₈'
            })}
            classLabels={CLASS_LABELS_Q8}
            classSizes={CLASS_SIZES_Q8}
            highlightRows={true}
          />
        )}
        {(mode === 'side' || mode === 'D4') && (
          <CharTable
            title={tr({ zh: 'D₄ 的特征标表', en: 'Character table of D₄'
            })}
            classLabels={CLASS_LABELS_D4}
            classSizes={CLASS_SIZES_Q8}
            highlightRows={true}
          />
        )}
      </div>

      {showMatchHighlight && (
        <div className="gt-aside" style={{ marginBottom: 12 }}>
          <L
            zh={<>
              两个表的所有数值完全相同。特征标表无法区分 <TeX src={String.raw`Q_8`} /> 与 <TeX src={String.raw`D_4`} />。
              黄色行 <TeX src={String.raw`\rho`} />（2 维不可约）：<TeX src={String.raw`Q_8`} /> 版本在 <TeX src={String.raw`\mathbb{Q}`} /> 上的 Schur 指标为 2，<TeX src={String.raw`D_4`} /> 版本为 1。
            </>}
            en={<>
              All entries in the two tables are identical. The character table cannot distinguish <TeX src={String.raw`Q_8`} /> from <TeX src={String.raw`D_4`} />.
              Highlighted row <TeX src={String.raw`\rho`} /> (the 2-dimensional irreducible): the Q₈ version has Schur index 2 over <TeX src={String.raw`\mathbb{Q}`} />; D₄&apos;s has index 1.
            </>}
          />
        </div>
      )}

      {/* Involution counter */}
      <div style={{ marginBottom: 8, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-dim)' }}>
        <L zh="阶-2 元素扫描（x² = e，x ≠ e）" en="Involution scan (x² = e, x ≠ e)" />:
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginBottom: 12 }}>
        {/* Q8 involution scan */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-dim)', marginBottom: 6 }}>Q₈</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {Q8_ELEMENTS.map((_, idx) => {
              const isScanned = scanStep >= idx;
              const isInv = isQ8Involution(idx);
              return (
                <div key={idx} style={{
                  fontFamily: 'var(--mono)', fontSize: 11, padding: '3px 7px',
                  background: isScanned
                    ? isInv
                      ? 'color-mix(in srgb, var(--accent) 18%, var(--bg-elev))'
                      : 'color-mix(in srgb, var(--rule) 30%, var(--bg-elev))'
                    : 'var(--bg-elev)',
                  border: `1px solid ${isScanned ? (isInv ? 'var(--accent)' : 'var(--rule)') : 'var(--rule)'}`,
                  borderRadius: 4,
                  color: isScanned ? (isInv ? 'var(--accent)' : 'var(--ink-dim)') : 'var(--ink-faint)',
                  transition: 'all 0.18s',
                }}>
                  {LABELS[idx]}
                  {isScanned && (
                    <span style={{ marginLeft: 3, fontSize: 9 }}>
                      ²={q8Square(idx)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {scanStep >= 7 && (
            <div style={{ marginTop: 6, fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
              <L zh={`阶-2 元素: ${q8Involutions.length} 个`} en={`Involutions: ${q8Involutions.length}`} />
            </div>
          )}
        </div>

        {/* D4 involution scan */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-dim)', marginBottom: 6 }}>D₄</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {D4_LABELS.map((lbl, idx) => {
              const isScanned = scanStep >= idx;
              const isInv = isD4Involution(idx);
              return (
                <div key={idx} style={{
                  fontFamily: 'var(--mono)', fontSize: 11, padding: '3px 7px',
                  background: isScanned
                    ? isInv
                      ? 'color-mix(in srgb, var(--accent-2) 18%, var(--bg-elev))'
                      : 'color-mix(in srgb, var(--rule) 30%, var(--bg-elev))'
                    : 'var(--bg-elev)',
                  border: `1px solid ${isScanned ? (isInv ? 'var(--accent-2)' : 'var(--rule)') : 'var(--rule)'}`,
                  borderRadius: 4,
                  color: isScanned ? (isInv ? 'var(--accent-2)' : 'var(--ink-dim)') : 'var(--ink-faint)',
                  transition: 'all 0.18s',
                }}>
                  {lbl}
                  {isScanned && (
                    <span style={{ marginLeft: 3, fontSize: 9 }}>
                      ²={d4SquareName(idx)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {scanStep >= 7 && (
            <div style={{ marginTop: 6, fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: 'var(--accent-2)' }}>
              <L zh={`阶-2 元素: ${d4Involutions.length} 个`} en={`Involutions: ${d4Involutions.length}`} />
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="gt-btn" style={{ fontSize: 12 }} onClick={startScan} disabled={scanning}>
          <L zh={scanning ? '扫描中…' : '计数阶-2 元素'} en={scanning ? 'Scanning…' : 'Count involutions'} />
        </button>
        <button className="gt-btn-ghost gt-btn" style={{ fontSize: 12 }} onClick={() => { setScanStep(-1); setScanning(false); }}>
          <L zh="重置" en="Reset" />
        </button>
      </div>

      {scanStep >= 7 && (
        <div className="gt-panel-result" style={{ marginTop: 12 }}>
          <div className="gt-result-row">
            <span className="gt-result-label"><L zh="Q₈ 阶-2 元素数" en="Q₈ involution count" /></span>
            <span className="gt-result-val-strong" style={{ color: 'var(--accent)' }}>
              <L zh="1（仅 −1）" en="1 (only −1)" />
            </span>
          </div>
          <div className="gt-result-row">
            <span className="gt-result-label"><L zh="D₄ 阶-2 元素数" en="D₄ involution count" /></span>
            <span className="gt-result-val-strong" style={{ color: 'var(--accent-2)' }}>
              <L zh="5（r², s, rs, r²s, r³s）" en="5 (r², s, rs, r²s, r³s)" />
            </span>
          </div>
          <div className="gt-result-row">
            <span className="gt-result-label"><L zh="结论" en="Conclusion" /></span>
            <span className="gt-result-val" style={{ color: 'var(--warn)', fontWeight: 600 }}>
              <L
                zh="阶-2 元素数不同 → Q₈ ≇ D₄，尽管特征标表相同！"
                en="Different involution counts → Q₈ ≇ D₄, despite identical character tables!"
              />
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
