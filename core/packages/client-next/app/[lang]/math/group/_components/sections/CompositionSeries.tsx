'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';

// ── Data model ────────────────────────────────────────────────────────────────

interface GroupDef {
  label: string;
  labelZh: string;
  order: number;
  series: SeriesDef[];
  altSeries?: SeriesDef;
  elementOrders: Record<number, number>; // order -> count
  isAbelian: boolean;
  description: string;
  descriptionZh: string;
}

interface SeriesDef {
  rungs: RungDef[];  // from bottom (1) to top (G), inclusive
}

interface RungDef {
  label: string;   // subgroup name
  order: number;
  normalInWhole: boolean; // is this subgroup normal in the entire group G?
}

// Hard-coded, spec-verified group data
// Factor order at step i = rungs[i+1].order / rungs[i].order
// Product of factor orders == groupOrder (verified below at render time)

const GROUPS: Record<string, GroupDef> = {
  'Z12': {
    label: 'ℤ/12', labelZh: 'ℤ/12',
    order: 12,
    series: [{
      rungs: [
        { label: '1', order: 1, normalInWhole: true },
        { label: '⟨4⟩ ≅ C₃', order: 3, normalInWhole: true },
        { label: '⟨2⟩ ≅ C₆', order: 6, normalInWhole: true },
        { label: 'ℤ/12', order: 12, normalInWhole: true },
      ],
    }],
    altSeries: {
      rungs: [
        { label: '1', order: 1, normalInWhole: true },
        { label: '⟨6⟩ ≅ C₂', order: 2, normalInWhole: true },
        { label: '⟨3⟩ ≅ C₄', order: 4, normalInWhole: true },
        { label: 'ℤ/12', order: 12, normalInWhole: true },
      ],
    },
    elementOrders: { 1: 1, 2: 1, 3: 2, 4: 2, 6: 2, 12: 4 },
    isAbelian: true,
    description: 'Cyclic, abelian. Two distinct composition series — same factor multiset {C₂, C₂, C₃} in different orders (Jordan–Hölder).',
    descriptionZh: '循环、交换群。有两条不同的合成列，但因子多重集相同 {C₂, C₂, C₃}（Jordan–Hölder 定理）。',
  },
  'S3': {
    label: 'S₃', labelZh: 'S₃',
    order: 6,
    series: [{
      rungs: [
        { label: '1', order: 1, normalInWhole: true },
        { label: 'A₃ ≅ C₃', order: 3, normalInWhole: true },
        { label: 'S₃', order: 6, normalInWhole: true },
      ],
    }],
    elementOrders: { 1: 1, 2: 3, 3: 2 },
    isAbelian: false,
    description: 'Non-abelian, same factors {C₂, C₃} as ℤ/6 — but S₃ ≇ ℤ/6. Extension problem at work.',
    descriptionZh: '非交换。因子 {C₂, C₃} 与 ℤ/6 相同，但 S₃ ≇ ℤ/6，说明因子不决定群。',
  },
  'A4': {
    label: 'A₄', labelZh: 'A₄',
    order: 12,
    series: [{
      rungs: [
        { label: '1', order: 1, normalInWhole: true },
        { label: 'C₂ ◁ V₄', order: 2, normalInWhole: false },
        { label: 'V₄ ≅ C₂×C₂', order: 4, normalInWhole: true },
        { label: 'A₄', order: 12, normalInWhole: true },
      ],
    }],
    elementOrders: { 1: 1, 2: 3, 3: 8 },
    isAbelian: false,
    description: 'A₄ has no subgroup of order 6 (Lagrange converse fails). The Klein four-group V₄ is the unique normal Sylow-2. The C₂ inside V₄ is normal in V₄ but NOT in A₄ — subnormal, not normal.',
    descriptionZh: 'A₄ 没有阶为 6 的子群（拉格朗日定理逆命题不成立）。Klein 四元群 V₄ 是唯一正规 Sylow-2 子群。V₄ 里的 C₂ 对 V₄ 正规，但对 A₄ 不正规，是次正规而非正规。',
  },
  'S4': {
    label: 'S₄', labelZh: 'S₄',
    order: 24,
    series: [{
      rungs: [
        { label: '1', order: 1, normalInWhole: true },
        { label: 'C₂ ◁ V₄', order: 2, normalInWhole: false },
        { label: 'V₄ ≅ C₂×C₂', order: 4, normalInWhole: true },
        { label: 'A₄', order: 12, normalInWhole: true },
        { label: 'S₄', order: 24, normalInWhole: true },
      ],
    }],
    elementOrders: { 1: 1, 2: 9, 3: 8, 4: 6 },
    isAbelian: false,
    description: 'The chain 1 ◁ C₂ ◁ V₄ ◁ A₄ ◁ S₄ has factors C₂, C₂, C₃, C₂ — four simple factors, composition length 4.',
    descriptionZh: '合成列 1 ◁ C₂ ◁ V₄ ◁ A₄ ◁ S₄，因子为 C₂, C₂, C₃, C₂，合成长度 4。',
  },
  'Q8': {
    label: 'Q₈', labelZh: 'Q₈',
    order: 8,
    series: [{
      rungs: [
        { label: '1', order: 1, normalInWhole: true },
        { label: '{1,−1} ≅ C₂', order: 2, normalInWhole: true },
        { label: '⟨i⟩ ≅ C₄', order: 4, normalInWhole: true },
        { label: 'Q₈', order: 8, normalInWhole: true },
      ],
    }],
    elementOrders: { 1: 1, 2: 1, 4: 6 },
    isAbelian: false,
    description: 'Quaternion group, order 8. Factors {C₂, C₂, C₂} — same as D₄, yet Q₈ ≇ D₄ (element-order spectra differ). The extension problem distinguishes them.',
    descriptionZh: '四元数群，阶 8。因子 {C₂, C₂, C₂} 与 D₄ 相同，但 Q₈ ≇ D₄（元素阶分布不同）。',
  },
  'D4': {
    label: 'D₄', labelZh: 'D₄',
    order: 8,
    series: [{
      rungs: [
        { label: '1', order: 1, normalInWhole: true },
        { label: 'Z(D₄) ≅ C₂', order: 2, normalInWhole: true },
        { label: '⟨r⟩ ≅ C₄', order: 4, normalInWhole: true },
        { label: 'D₄', order: 8, normalInWhole: true },
      ],
    }],
    elementOrders: { 1: 1, 2: 5, 4: 2 },
    isAbelian: false,
    description: 'Dihedral group of order 8. Factors {C₂, C₂, C₂} — same as Q₈. D₄ has 5 elements of order 2, Q₈ has only 1. Not isomorphic.',
    descriptionZh: '二面体群，阶 8。因子 {C₂, C₂, C₂} 与 Q₈ 相同，但 D₄ 有 5 个阶 2 元素，Q₈ 只有 1 个，两群不同构。',
  },
};

// Factor label: C_p where p = factor order (all factors here are prime-order cyclic)
function factorLabel(factorOrder: number): string {
  return `C${factorOrder}`;
}

// Compute the factor multiset display string
function factorMultisetStr(rungs: RungDef[]): string {
  const counts: Record<number, number> = {};
  for (let i = 0; i + 1 < rungs.length; i++) {
    const fo = rungs[i + 1].order / rungs[i].order;
    counts[fo] = (counts[fo] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort(([a], [b]) => +b - +a)
    .map(([fo, cnt]) => cnt > 1 ? `C${fo}×${cnt}` : `C${fo}`)
    .join(', ');
}

// ══════════════════════════════════════════════════════════════════════════════
// §36 CompositionSeries — main export
// ══════════════════════════════════════════════════════════════════════════════

export default function CompositionSeries() {
  const lang = useLang();

  return (
    <GTSec id="composition-series" className="gt-sec">
      <div className="gt-sec-num">§36</div>
      <h2 className="gt-sec-title">
        <L zh="合成列与 Jordan–Hölder" en="Composition series & Jordan–Hölder" />
      </h2>

      <p className="gt-lede">
        <L
          zh={<>
            每个有限群都可以被"分解"成一列不可再细分的简单群，就像整数分解成素数。
            <strong>Jordan–Hölder 定理</strong>保证：无论选哪条分解路径，得到的简单因子的多重集完全相同——这是群的一个深刻不变量。
            魔方群的 21 个合成因子中藏着两个非交换单群 <TeX src={String.raw`A_8`} /> 和 <TeX src={String.raw`A_{12}`} />，正是它们让魔方群远离"可解"，也让魔方的难度有了群论的注脚。
          </>}
          en={<>
            Every finite group can be "factored" into a chain of irreducible, simple pieces — the group-theoretic analogue of prime factorization.
            The <strong>Jordan–Hölder theorem</strong> guarantees that no matter which factoring path you choose, the resulting multiset of simple factors is always the same — a profound invariant of the group.
            The Rubik&apos;s cube group&apos;s 21 composition factors contain two nonabelian simple groups <TeX src={String.raw`A_8`} /> and <TeX src={String.raw`A_{12}`} />, which are exactly what make the cube group far from solvable.
          </>}
        />
      </p>

      {/* ── Definition: subnormal series ── */}
      <div className="gt-def">
        <div className="gt-def-title">
          <L zh="定义: 次正规列 (subnormal series)" en="Definition: subnormal series" />
        </div>
        <div className="gt-def-body">
          <L
            zh={<>
              群 <TeX src={String.raw`G`} /> 的<strong>次正规列</strong>是一条有限子群链
            </>}
            en={<>
              A <strong>subnormal series</strong> of a group <TeX src={String.raw`G`} /> is a finite chain of subgroups
            </>}
          />
          <TeXBlock src={String.raw`1 = G_0 \;\trianglelefteq\; G_1 \;\trianglelefteq\; \cdots \;\trianglelefteq\; G_r = G,`} />
          <L
            zh={<>
              其中每个 <TeX src={String.raw`G_i`} /> 是<em>下一项</em> <TeX src={String.raw`G_{i+1}`} /> 的正规子群（记作 <TeX src={String.raw`G_i \trianglelefteq G_{i+1}`} />）。
              注意：正规性只要求对相邻项成立，<strong>不要求</strong> <TeX src={String.raw`G_i`} /> 对整个 <TeX src={String.raw`G`} /> 正规——那是更强的"正规列"。
              商群 <TeX src={String.raw`G_{i+1}/G_i`} /> 称为该列的<strong>因子</strong>，<TeX src={String.raw`r`} /> 称为列的<strong>长度</strong>。
            </>}
            en={<>
              where each <TeX src={String.raw`G_i`} /> is a normal subgroup of the <em>next term</em> <TeX src={String.raw`G_{i+1}`} /> (written <TeX src={String.raw`G_i \trianglelefteq G_{i+1}`} />).
              Normality is only required between consecutive terms, <strong>not</strong> that <TeX src={String.raw`G_i`} /> be normal in the whole <TeX src={String.raw`G`} /> — that stronger condition defines a &ldquo;normal series.&rdquo;
              The quotients <TeX src={String.raw`G_{i+1}/G_i`} /> are the <strong>factors</strong> of the series; <TeX src={String.raw`r`} /> is its <strong>length</strong>.
            </>}
          />
        </div>
      </div>

      <div className="gt-def">
        <div className="gt-def-title">
          <L zh="定义: 合成列 (composition series)" en="Definition: composition series" />
        </div>
        <div className="gt-def-body">
          <L
            zh={<>
              <strong>合成列</strong>是一条次正规列，其中每个因子 <TeX src={String.raw`G_{i+1}/G_i`} /> 都是<strong>单群</strong>——即唯一的正规子群只有平凡群和自身的非平凡群。
              等价地，合成列是不可再细化的次正规列（无法在两个相邻项之间插入新的子群而保持各因子非平凡）。
              因子 <TeX src={String.raw`G_{i+1}/G_i`} /> 称为 <TeX src={String.raw`G`} /> 的<strong>合成因子</strong>，<strong>视为多重集</strong>（同一个因子可能出现多次）。
              <br />
              每个有限群都有合成列（对 <TeX src={String.raw`|G|`} /> 归纳：取极大正规子群 <TeX src={String.raw`M \trianglelefteq G`} />，则 <TeX src={String.raw`G/M`} /> 单，合成列由 <TeX src={String.raw`M`} /> 的合成列延伸而来）。
              某些无限群没有合成列：整数加法群 <TeX src={String.raw`\mathbb{Z}`} /> 就是反例——它有无穷多条严格递降链 <TeX src={String.raw`n\mathbb{Z} \supset 2n\mathbb{Z} \supset \cdots`} />，无法终止。
            </>}
            en={<>
              A <strong>composition series</strong> is a subnormal series in which every factor <TeX src={String.raw`G_{i+1}/G_i`} /> is a <strong>simple group</strong> — a nontrivial group whose only normal subgroups are 1 and itself.
              Equivalently, it is a subnormal series with strict inclusions that admits no proper refinement (no new term can be inserted between consecutive ones while keeping every factor nontrivial).
              The factors <TeX src={String.raw`G_{i+1}/G_i`} /> are the <strong>composition factors</strong> of <TeX src={String.raw`G`} />, regarded as a <strong>multiset</strong> (a factor may repeat).
              <br />
              Every finite group possesses a composition series (induct on <TeX src={String.raw`|G|`} />: pick a maximal proper normal subgroup <TeX src={String.raw`M \trianglelefteq G`} />; then <TeX src={String.raw`G/M`} /> is simple, and a composition series for <TeX src={String.raw`M`} /> extends to one for <TeX src={String.raw`G`} />).
              Some infinite groups have none: <TeX src={String.raw`\mathbb{Z}`} /> (integers under addition) has infinite descending chains <TeX src={String.raw`n\mathbb{Z} \supset 2n\mathbb{Z} \supset \cdots`} /> and no composition series.
            </>}
          />
        </div>
      </div>

      {/* ── Jordan–Hölder theorem ── */}
      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理 (Jordan–Hölder)" en="Theorem (Jordan–Hölder)" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>
              设 <TeX src={String.raw`G`} /> 是拥有合成列的群。则 <TeX src={String.raw`G`} /> 的任意两条合成列具有<strong>相同的长度</strong>，且存在两列因子之间的双射，使得对应因子同构。
              换言之，合成因子的多重集（按同构类计）是 <TeX src={String.raw`G`} /> 的不变量，与所选合成列无关。
            </>}
            en={<>
              Let <TeX src={String.raw`G`} /> be a group possessing a composition series. Then any two composition series of <TeX src={String.raw`G`} /> have the <strong>same length</strong>, and there is a bijection between their sets of factors under which corresponding composition factors are isomorphic.
              In other words, the multiset of composition factors (taken up to isomorphism) is an invariant of <TeX src={String.raw`G`} /> independent of the chosen series.
            </>}
          />
        </div>
        <div className="gt-proof">
          <div className="gt-proof-title">
            <L zh="证明思路" en="Proof sketch" />
          </div>
          <L
            zh={<>
              关键引理是 <strong>Schreier 细化定理</strong>：任意两条次正规列都有等价的细化（长度相等、因子两两同构的细化）。
              证明依赖 Zassenhaus"蝴蝶"引理：对子群链中相邻四个项，构造典范同构。
              当原始两列已是合成列时——即无法再细化——两条等价细化必与原列相同，故因子完全匹配。
              Jordan–Hölder 定理说的是<em>无序</em>多重集的唯一性：两列的因子可以顺序不同。
            </>}
            en={<>
              The key is the <strong>Schreier Refinement Theorem</strong>: any two subnormal series admit equivalent refinements (same length with isomorphic factors in some pairing).
              Its proof rests on the Zassenhaus &ldquo;butterfly&rdquo; lemma, which constructs a canonical isomorphism between four adjacent terms in subgroup chains.
              When the original two series are already composition series — admitting no proper refinement — their equivalent refinements must coincide with themselves, forcing a factor-by-factor match.
              Jordan–Hölder asserts uniqueness of the <em>unordered</em> multiset: two series may list the same factors in different orders.
            </>}
          />
          <div className="gt-proof-end">□</div>
        </div>
      </div>

      <p>
        <L
          zh={<>
            <strong>单群的分类。</strong>
            有限单群分为四大类：<TeX src={String.raw`C_p`} />（素数阶循环群）、<TeX src={String.raw`A_n`} />（<TeX src={String.raw`n \ge 5`} /> 的交错群，非交换单群）、各类 Lie 型群，以及 26 个散在单群。
            特别注意：<TeX src={String.raw`A_n`} /> 在 <TeX src={String.raw`n \ge 5`} /> 时单，但 <TeX src={String.raw`A_4`} /> <strong>不单</strong>（含正规 Klein 四元群 <TeX src={String.raw`V_4`} />），<TeX src={String.raw`A_3 \cong C_3`} /> 是循环单群。
          </>}
          en={<>
            <strong>Classification of simple groups.</strong>
            Finite simple groups fall into four families: <TeX src={String.raw`C_p`} /> (cyclic of prime order), <TeX src={String.raw`A_n`} /> (<TeX src={String.raw`n \ge 5`} />, nonabelian simple), the groups of Lie type, and 26 sporadic groups.
            Note carefully: <TeX src={String.raw`A_n`} /> is simple only for <TeX src={String.raw`n \ge 5`} />. <TeX src={String.raw`A_4`} /> is <strong>not simple</strong> (it contains the normal Klein four-group <TeX src={String.raw`V_4`} />), and <TeX src={String.raw`A_3 \cong C_3`} /> is cyclic-simple.
          </>}
        />
      </p>

      <div className="gt-aside">
        <L
          zh={<>
            <strong>Hölder 纲领与扩张问题。</strong>
            知道合成因子<em>并不能</em>唯一确定群 <TeX src={String.raw`G`} />。从正规子群 <TeX src={String.raw`N`} /> 和商群 <TeX src={String.raw`Q = G/N`} /> 重建 <TeX src={String.raw`G`} /> 的问题称为<strong>扩张问题</strong>——这是 Hölder 纲领的第二步，至今在一般情形下仍未解决。
            最简单的反例：<TeX src={String.raw`\mathbb{Z}/6`} /> 与 <TeX src={String.raw`S_3`} /> 都有因子 <TeX src={String.raw`\{C_2, C_3\}`} />，却不同构；
            <TeX src={String.raw`D_4`} /> 与 <TeX src={String.raw`Q_8`} /> 都有因子 <TeX src={String.raw`\{C_2, C_2, C_2\}`} />，同样不同构。
          </>}
          en={<>
            <strong>Hölder&apos;s program and the extension problem.</strong>
            Knowing the composition factors does <em>not</em> determine <TeX src={String.raw`G`} /> up to isomorphism. Reconstructing <TeX src={String.raw`G`} /> from a normal subgroup <TeX src={String.raw`N`} /> and quotient <TeX src={String.raw`Q = G/N`} /> is the <strong>extension problem</strong> — the second half of Hölder&apos;s program, which remains genuinely open in general.
            The simplest examples: <TeX src={String.raw`\mathbb{Z}/6`} /> and <TeX src={String.raw`S_3`} /> both have factors <TeX src={String.raw`\{C_2, C_3\}`} /> but are non-isomorphic; <TeX src={String.raw`D_4`} /> and <TeX src={String.raw`Q_8`} /> both have factors <TeX src={String.raw`\{C_2, C_2, C_2\}`} /> but are non-isomorphic.
          </>}
        />
      </div>

      {/* ── Cube connection prose ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="魔方群的合成因子" en="Composition factors of the Rubik&apos;s cube group" />
      </h3>

      <p>
        <L
          zh={<>
            魔方群 <TeX src={String.raw`G`} /> 的结构为
          </>}
          en={<>
            The Rubik&apos;s cube group <TeX src={String.raw`G`} /> has structure
          </>}
        />
      </p>
      <TeXBlock src={String.raw`G \;\cong\; \bigl(\mathbb{Z}_3^7 \times \mathbb{Z}_2^{11}\bigr) \rtimes \bigl((A_8 \times A_{12}) \rtimes \mathbb{Z}_2\bigr),`} />
      <p>
        <L
          zh={<>
            其中 <TeX src={String.raw`\mathbb{Z}_3^7`} /> 是角块朝向（8 个角，各 3 态，总转角 <TeX src={String.raw`\equiv 0 \pmod{3}`} /> 去掉一个自由度，剩 7），
            <TeX src={String.raw`\mathbb{Z}_2^{11}`} /> 是棱块翻转（12 条棱，各 2 态，总翻转 <TeX src={String.raw`\equiv 0 \pmod{2}`} /> 去掉一个，剩 11），
            <TeX src={String.raw`A_8 \times A_{12}`} /> 是角和棱的<em>偶</em>置换（奇偶性必须同时改变），最外层 <TeX src={String.raw`\rtimes \mathbb{Z}_2`} /> 对应著名的奇偶约束：不能单独交换两个角块（或两条棱）而不同时做另一类的交换。
          </>}
          en={<>
            where <TeX src={String.raw`\mathbb{Z}_3^7`} /> encodes corner orientations (8 corners, 3 states each; the total-twist-zero constraint removes one degree, leaving 7),
            <TeX src={String.raw`\mathbb{Z}_2^{11}`} /> encodes edge flips (12 edges, 2 states each; the total-flip-zero constraint leaves 11),
            <TeX src={String.raw`A_8 \times A_{12}`} /> is even permutations of corners and edges respectively (their parities must agree), and the outer <TeX src={String.raw`\rtimes \mathbb{Z}_2`} /> encodes the famous parity constraint: you cannot swap just two corners (or just two edges) without a compensating swap of the other type.
          </>}
        />
      </p>
      <p>
        <L
          zh={<>
            从这一结构读出合成因子：<TeX src={String.raw`\mathbb{Z}_3^7`} /> 贡献 7 个 <TeX src={String.raw`C_3`} />；
            <TeX src={String.raw`\mathbb{Z}_2^{11}`} /> 贡献 11 个 <TeX src={String.raw`C_2`} />；
            <TeX src={String.raw`A_8`} />（<TeX src={String.raw`n=8 \ge 5`} />，非交换单群）本身就是一个因子；
            <TeX src={String.raw`A_{12}`} />（<TeX src={String.raw`n=12 \ge 5`} />，非交换单群）同理；
            最外层 <TeX src={String.raw`\mathbb{Z}_2`} /> 再贡献 1 个 <TeX src={String.raw`C_2`} />。
            因此合成因子多重集为 <TeX src={String.raw`\{A_8,\, A_{12},\, C_2^{12},\, C_3^7\}`} />，合成长度 <TeX src={String.raw`21`} />。
          </>}
          en={<>
            Reading off the composition factors: <TeX src={String.raw`\mathbb{Z}_3^7`} /> contributes seven <TeX src={String.raw`C_3`} />&apos;s;
            <TeX src={String.raw`\mathbb{Z}_2^{11}`} /> contributes eleven <TeX src={String.raw`C_2`} />&apos;s;
            <TeX src={String.raw`A_8`} /> (<TeX src={String.raw`n=8 \ge 5`} />, nonabelian simple) contributes one factor;
            <TeX src={String.raw`A_{12}`} /> (<TeX src={String.raw`n=12 \ge 5`} />, nonabelian simple) another;
            and the outer <TeX src={String.raw`\mathbb{Z}_2`} /> contributes one more <TeX src={String.raw`C_2`} />.
            The composition factor multiset is exactly <TeX src={String.raw`\{A_8,\, A_{12},\, C_2^{12},\, C_3^7\}`} />, with composition length <TeX src={String.raw`21`} />.
          </>}
        />
      </p>

      <div className="gt-pullquote">
        <L
          zh={<>
            一个群被称为<strong>可解群</strong>，当且仅当它的所有合成因子都是素数阶循环群。
            魔方群含有非交换单因子 <TeX src={String.raw`A_8`} /> 和 <TeX src={String.raw`A_{12}`} />，因此<strong>绝非可解群</strong>——这从代数上解释了为何没有类似根式求解公式那样的"万能还原公式"。
          </>}
          en={<>
            A group is called <strong>solvable</strong> if and only if all its composition factors are cyclic of prime order.
            The cube group contains the nonabelian simple factors <TeX src={String.raw`A_8`} /> and <TeX src={String.raw`A_{12}`} />, so it is <strong>far from solvable</strong> — the algebraic explanation for why no radical-formula analogue exists for restoring any scrambled cube.
          </>}
        />
        <div className="gt-pullquote-cite">
          <L zh="参见 Dummit &amp; Foote §3.4, §4.6" en="cf. Dummit &amp; Foote §3.4, §4.6" />
        </div>
      </div>

      {/* ── Widget 1: Composition series builder ── */}
      <SeriesBuilderPanel lang={lang} />

      {/* ── Widget 2: Same factors different group ── */}
      <ExtensionProblemPanel lang={lang} />

      {/* ── Widget 3: Cube factor accounting ── */}
      <CubeFactorPanel lang={lang} />

      {/* ── Widget 4: A4 subnormal explanation ── */}
      <A4RefinementPanel lang={lang} />

      {/* ── References ── */}
      <div style={{ marginTop: 40 }}>
        <div className="gt-def-title" style={{ marginBottom: 10 }}>
          <L zh="参考文献" en="References" />
        </div>
        <ol style={{ color: 'var(--ink-dim)', fontSize: 14, lineHeight: 1.8 }}>
          <li>Dummit &amp; Foote, <em>Abstract Algebra</em>, 3rd ed., §3.4 (Jordan–Hölder, Thm 22) and §4.6 (simplicity of <em>A</em><sub>n</sub>, Thm 24).</li>
          <li>J. J. Rotman, <em>An Introduction to the Theory of Groups</em>, 4th ed., Ch. 5 — Schreier Refinement (Thm 5.11) and Zassenhaus Lemma.</li>
          <li>Wikipedia, <a href="https://en.wikipedia.org/wiki/Rubik%27s_Cube_group" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-2)' }}>Rubik&apos;s Cube group</a> — structure, order 2²⁷·3¹⁴·5³·7²·11.</li>
          <li>D. Joyner, <em>Adventures in Group Theory</em>, 2nd ed. (Johns Hopkins, 2008) — explicit cube-group order and composition factors.</li>
        </ol>
      </div>
    </GTSec>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Widget 1: Composition series builder
// ══════════════════════════════════════════════════════════════════════════════

function SeriesBuilderPanel({ lang }: { lang: 'zh' | 'en' }) {
  const [groupKey, setGroupKey] = useState<string>('Z12');
  const [showAlt, setShowAlt] = useState(false);

  const gdef = GROUPS[groupKey];

  // Pick which series to display
  const series = (showAlt && gdef.altSeries) ? gdef.altSeries : gdef.series[0];
  const rungs = series.rungs;

  // Compute factor orders
  const factorOrders = useMemo(() =>
    rungs.slice(1).map((r, i) => r.order / rungs[i].order),
    [rungs]
  );

  // Product of factor orders
  const product = useMemo(() => factorOrders.reduce((a, b) => a * b, 1), [factorOrders]);
  const productStr = factorOrders.join(' × ');
  const correct = product === gdef.order;

  const hasAlt = !!gdef.altSeries;

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="合成列构造器" en="Composition series builder" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="选一个小群，查看其合成列（从下往上：从 1 到 G）、每段的单群因子，以及各因子阶之积等于 |G|。"
          en="Choose a small group and see its composition series (bottom to top: 1 up to G), the simple factor at each step, and verify that the product of factor orders equals |G|."
        />
      </div>

      {/* Group selector */}
      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 6 }}>
        <label><L zh="群" en="Group" /></label>
        {Object.keys(GROUPS).map(k => (
          <button
            key={k}
            className={`gt-chip${groupKey === k ? ' gt-chip-active' : ''}`}
            onClick={() => { setGroupKey(k); setShowAlt(false); }}
          >
            {GROUPS[k].label}
          </button>
        ))}
      </div>

      {/* Alternate series toggle for Z12 */}
      {hasAlt && (
        <div className="gt-panel-input-row">
          <label style={{ fontSize: 13 }}>
            <L zh="显示另一条合成列" en="Show alternate series" />
          </label>
          <button
            className={`gt-chip${showAlt ? ' gt-chip-active' : ''}`}
            onClick={() => setShowAlt(v => !v)}
          >
            <L zh={showAlt ? '第 2 列（已显示）' : '切换到第 2 列'} en={showAlt ? 'Series 2 (active)' : 'Switch to series 2'} />
          </button>
        </div>
      )}

      {/* Description */}
      <div style={{ fontSize: 13, color: 'var(--ink-dim)', marginBottom: 12, lineHeight: 1.6 }}>
        {lang === 'zh' ? gdef.descriptionZh : gdef.description}
      </div>

      {/* SVG ladder */}
      <SeriesLadderSVG rungs={rungs} factorOrders={factorOrders} lang={lang} />

      {/* Product banner */}
      <div className="gt-panel-result">
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="因子阶之积" en="Product of factor orders" /></span>
          <span className="gt-result-val">{productStr} = {product}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="|G|" en="|G|" /></span>
          <span className="gt-result-val-strong" style={{ color: correct ? 'var(--green)' : 'var(--warn)' }}>
            {gdef.order} {correct ? (lang === 'zh' ? '✓ 吻合' : '✓ matches') : (lang === 'zh' ? '✗ 不符' : '✗ mismatch')}
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="合成因子（多重集）" en="Composition factors (multiset)" /></span>
          <span className="gt-result-val">{'{' + factorMultisetStr(rungs) + '}'}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="合成长度" en="Composition length" /></span>
          <span className="gt-result-val">{rungs.length - 1}</span>
        </div>
      </div>
    </div>
  );
}

function SeriesLadderSVG({
  rungs, factorOrders, lang,
}: {
  rungs: RungDef[];
  factorOrders: number[];
  lang: 'zh' | 'en';
}) {
  const n = rungs.length; // number of rungs including 1 and G
  const boxW = 160, boxH = 36, gap = 56;
  const svgH = n * (boxH + gap) - gap + 16;
  const svgW = 320;
  const centerX = svgW / 2;
  const lineX = centerX;

  // Rung y position (bottom = index 0 = trivial, top = index n-1 = G)
  const rungY = (i: number) => 8 + (n - 1 - i) * (boxH + gap);

  // Factor midpoint y between rung i and i+1
  const midY = (i: number) => rungY(i) + boxH + gap / 2;

  const PALETTE = ['#8B2E3C', '#2A4D69', '#3F7050', '#B8860B', '#6B4E9C', '#C2410C'];

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" style={{ display: 'block', margin: '12px 0', maxHeight: 480, maxWidth: svgW }}>
      {/* Vertical spine */}
      <line
        x1={lineX} y1={rungY(0) + boxH}
        x2={lineX} y2={rungY(n - 1)}
        stroke="var(--rule)" strokeWidth={2}
      />

      {/* Rungs */}
      {rungs.map((r, i) => {
        const y = rungY(i);
        const isTop = i === n - 1;
        const isBottom = i === 0;
        return (
          <g key={i}>
            <rect
              x={centerX - boxW / 2} y={y}
              width={boxW} height={boxH} rx={6}
              fill={isTop
                ? 'color-mix(in srgb, var(--accent) 12%, var(--bg-elev))'
                : isBottom
                  ? 'color-mix(in srgb, var(--ink-faint) 10%, var(--bg-elev))'
                  : 'var(--bg-elev)'}
              stroke={isTop ? 'var(--accent)' : 'var(--rule)'}
              strokeWidth={isTop ? 1.5 : 1}
            />
            <text
              x={centerX} y={y + 23}
              textAnchor="middle"
              style={{ fontFamily: 'var(--mono)', fontSize: 13 }}
              fill={isTop ? 'var(--accent)' : 'var(--ink)'}
            >
              {r.label}
            </text>
            {/* Normal-in-G badge */}
            {!r.normalInWhole && i > 0 && (
              <text
                x={centerX + boxW / 2 + 6} y={y + 23}
                textAnchor="start"
                style={{ fontFamily: 'var(--mono)', fontSize: 10 }}
                fill="var(--warn)"
              >
                {lang === 'zh' ? '非G正规' : '⊴G fails'}
              </text>
            )}
          </g>
        );
      })}

      {/* Factor labels on each edge */}
      {factorOrders.map((fo, i) => {
        const color = PALETTE[i % PALETTE.length];
        const y = midY(i);
        return (
          <g key={i}>
            {/* Left label: factor name */}
            <rect
              x={centerX - 52} y={y - 14}
              width={44} height={22} rx={4}
              fill={`color-mix(in srgb, ${color} 15%, var(--bg-elev))`}
              stroke={color} strokeWidth={1}
            />
            <text
              x={centerX - 30} y={y + 2}
              textAnchor="middle"
              style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600 }}
              fill={color}
            >
              {factorLabel(fo)}
            </text>
            {/* Right label: factor order */}
            <text
              x={centerX + 36} y={y + 2}
              textAnchor="start"
              style={{ fontFamily: 'var(--mono)', fontSize: 11 }}
              fill="var(--ink-dim)"
            >
              |·| = {fo}
            </text>
          </g>
        );
      })}

      {/* Product annotation at the bottom */}
      <text
        x={centerX} y={svgH - 2}
        textAnchor="middle"
        style={{ fontFamily: 'var(--mono)', fontSize: 10 }}
        fill="var(--ink-faint)"
      >
        {lang === 'zh' ? '从下往上读：每段因子阶之积 = |G|' : 'read bottom-up: product of edge orders = |G|'}
      </text>
    </svg>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Widget 2: Same factors, different group (extension problem)
// ══════════════════════════════════════════════════════════════════════════════

type PairKey = 'Z6-S3' | 'D4-Q8';

interface GroupPairSpec {
  groupA: string;   // key into GROUPS
  groupB: string;
  pairZh: string;
  pairEn: string;
  factorsZh: string;
  factorsEn: string;
  distinctZh: string;
  distinctEn: string;
}

const PAIRS: Record<PairKey, GroupPairSpec> = {
  'Z6-S3': {
    groupA: 'Z12', // We'll use S3 and Z12 but need Z6 — hardcode below
    groupB: 'S3',
    pairZh: 'ℤ/6 与 S₃',
    pairEn: 'ℤ/6 and S₃',
    factorsZh: '两者因子均为 {C₂, C₃}',
    factorsEn: 'Both have factors {C₂, C₃}',
    distinctZh: 'ℤ/6 交换，S₃ 非交换 → 不同构',
    distinctEn: 'ℤ/6 is abelian, S₃ is not → not isomorphic',
  },
  'D4-Q8': {
    groupA: 'D4',
    groupB: 'Q8',
    pairZh: 'D₄ 与 Q₈',
    pairEn: 'D₄ and Q₈',
    factorsZh: '两者因子均为 {C₂, C₂, C₂}',
    factorsEn: 'Both have factors {C₂, C₂, C₂}',
    distinctZh: 'D₄ 有 5 个阶-2 元素，Q₈ 只有 1 个 → 不同构',
    distinctEn: 'D₄ has 5 elements of order 2; Q₈ has only 1 → not isomorphic',
  },
};

// Special Z/6 data (subset of Z/12 data)
const Z6_DEF: GroupDef = {
  label: 'ℤ/6', labelZh: 'ℤ/6',
  order: 6,
  series: [{
    rungs: [
      { label: '1', order: 1, normalInWhole: true },
      { label: '⟨3⟩ ≅ C₂', order: 2, normalInWhole: true },
      { label: 'ℤ/6', order: 6, normalInWhole: true },
    ],
  }],
  elementOrders: { 1: 1, 2: 1, 3: 2, 6: 2 },
  isAbelian: true,
  description: 'Cyclic of order 6. Abelian.',
  descriptionZh: '6 阶循环群，交换群。',
};

function ExtensionProblemPanel({ lang }: { lang: 'zh' | 'en' }) {
  const [pairKey, setPairKey] = useState<PairKey>('D4-Q8');
  const [invariant, setInvariant] = useState<'series' | 'orders'>('orders');

  const spec = PAIRS[pairKey];
  const isZ6 = pairKey === 'Z6-S3';

  const defA: GroupDef = isZ6 ? Z6_DEF : GROUPS[spec.groupA];
  const defB: GroupDef = GROUPS[spec.groupB];

  // Build element-order bar chart data
  const allOrders = useMemo(() => {
    const setA = new Set(Object.keys(defA.elementOrders).map(Number));
    const setB = new Set(Object.keys(defB.elementOrders).map(Number));
    return Array.from(new Set([...setA, ...setB])).sort((a, b) => a - b);
  }, [defA, defB]);

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="相同因子，不同群——扩张问题" en="Same factors, different group — the extension problem" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh={<>两个群有完全相同的合成因子多重集，却彼此不同构。切换&ldquo;区分不变量&rdquo;可看到使它们不同的结构差异。</>}
          en="Two groups share the exact same composition-factor multiset yet are non-isomorphic. Switch the distinguishing invariant to see what sets them apart."
        />
      </div>

      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 6 }}>
        <label><L zh="配对" en="Pair" /></label>
        {(Object.keys(PAIRS) as PairKey[]).map(k => (
          <button
            key={k}
            className={`gt-chip${pairKey === k ? ' gt-chip-active' : ''}`}
            onClick={() => setPairKey(k)}
          >
            {lang === 'zh' ? PAIRS[k].pairZh : PAIRS[k].pairEn}
          </button>
        ))}
      </div>

      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 6 }}>
        <label><L zh="查看" en="View" /></label>
        <button
          className={`gt-chip${invariant === 'series' ? ' gt-chip-active' : ''}`}
          onClick={() => setInvariant('series')}
        >
          <L zh="合成列" en="Composition series" />
        </button>
        <button
          className={`gt-chip${invariant === 'orders' ? ' gt-chip-active' : ''}`}
          onClick={() => setInvariant('orders')}
        >
          <L zh="元素阶分布" en="Element-order spectrum" />
        </button>
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)', marginBottom: 10 }}>
        {lang === 'zh' ? spec.factorsZh : spec.factorsEn}
      </div>

      {invariant === 'series' ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
          {[{ def: defA, label: defA.label }, { def: defB, label: defB.label }].map(({ def, label }) => {
            const rungs = def.series[0].rungs;
            const fos = rungs.slice(1).map((r, i) => r.order / rungs[i].order);
            return (
              <div key={label} style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
                  {label}
                </div>
                <SeriesLadderSVG rungs={rungs} factorOrders={fos} lang={lang} />
              </div>
            );
          })}
        </div>
      ) : (
        <ElementOrderBarChart
          defA={defA} defB={defB}
          allOrders={allOrders}
          lang={lang}
        />
      )}

      <div className="gt-panel-result">
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="相同因子" en="Shared factors" /></span>
          <span className="gt-result-val" style={{ color: 'var(--gold)' }}>
            {pairKey === 'Z6-S3' ? '{C₂, C₃}' : '{C₂, C₂, C₂}'}
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="区分标准" en="Distinguished by" /></span>
          <span className="gt-result-val-strong" style={{ color: 'var(--accent)' }}>
            {lang === 'zh' ? spec.distinctZh : spec.distinctEn}
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="结论" en="Conclusion" /></span>
          <span className="gt-result-val" style={{ color: 'var(--warn)' }}>
            <L zh="相同因子 ≠ 同构群（扩张问题）" en="Equal factors ≠ isomorphic groups (extension problem)" />
          </span>
        </div>
      </div>
    </div>
  );
}

function ElementOrderBarChart({
  defA, defB, allOrders, lang,
}: {
  defA: GroupDef;
  defB: GroupDef;
  allOrders: number[];
  lang: 'zh' | 'en';
}) {
  const barW = 28, gap = 10, groupGap = 6;
  const maxCount = useMemo(() => {
    const vals = allOrders.flatMap(o => [defA.elementOrders[o] ?? 0, defB.elementOrders[o] ?? 0]);
    return Math.max(...vals, 1);
  }, [allOrders, defA, defB]);

  const chartH = 120;
  const axisY = chartH - 20;
  const pxPerUnit = (axisY - 10) / maxCount;

  const totalW = allOrders.length * (2 * barW + groupGap + gap) + gap;
  const svgW = totalW + 60;

  return (
    <svg viewBox={`0 0 ${svgW} ${chartH + 30}`} width="100%" style={{ display: 'block', margin: '10px 0', maxWidth: svgW }}>
      {/* Y axis */}
      <line x1={48} y1={8} x2={48} y2={axisY} stroke="var(--rule)" strokeWidth={1} />
      {/* X axis */}
      <line x1={48} y1={axisY} x2={svgW - 4} y2={axisY} stroke="var(--rule)" strokeWidth={1} />

      {/* Bars */}
      {allOrders.map((order, gi) => {
        const baseX = 52 + gi * (2 * barW + groupGap + gap);
        const countA = defA.elementOrders[order] ?? 0;
        const countB = defB.elementOrders[order] ?? 0;
        const hA = countA * pxPerUnit;
        const hB = countB * pxPerUnit;

        return (
          <g key={order}>
            {/* Bar A */}
            <rect
              x={baseX} y={axisY - hA}
              width={barW} height={Math.max(hA, 0)} rx={2}
              fill="color-mix(in srgb, var(--accent) 60%, var(--bg-elev))"
              stroke="var(--accent)" strokeWidth={1}
            />
            {countA > 0 && (
              <text
                x={baseX + barW / 2} y={axisY - hA - 3}
                textAnchor="middle"
                style={{ fontFamily: 'var(--mono)', fontSize: 10 }}
                fill="var(--accent)"
              >
                {countA}
              </text>
            )}

            {/* Bar B */}
            <rect
              x={baseX + barW + groupGap} y={axisY - hB}
              width={barW} height={Math.max(hB, 0)} rx={2}
              fill="color-mix(in srgb, var(--accent-2) 60%, var(--bg-elev))"
              stroke="var(--accent-2)" strokeWidth={1}
            />
            {countB > 0 && (
              <text
                x={baseX + barW + groupGap + barW / 2} y={axisY - hB - 3}
                textAnchor="middle"
                style={{ fontFamily: 'var(--mono)', fontSize: 10 }}
                fill="var(--accent-2)"
              >
                {countB}
              </text>
            )}

            {/* X label: order */}
            <text
              x={baseX + barW + groupGap / 2} y={axisY + 12}
              textAnchor="middle"
              style={{ fontFamily: 'var(--mono)', fontSize: 11 }}
              fill="var(--ink-dim)"
            >
              {lang === 'zh' ? `阶${order}` : `ord ${order}`}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      <rect x={52} y={chartH + 14} width={12} height={10} rx={2}
        fill="color-mix(in srgb, var(--accent) 60%, var(--bg-elev))" stroke="var(--accent)" strokeWidth={1} />
      <text x={68} y={chartH + 23} style={{ fontFamily: 'var(--mono)', fontSize: 11 }} fill="var(--accent)">{defA.label}</text>
      <rect x={130} y={chartH + 14} width={12} height={10} rx={2}
        fill="color-mix(in srgb, var(--accent-2) 60%, var(--bg-elev))" stroke="var(--accent-2)" strokeWidth={1} />
      <text x={146} y={chartH + 23} style={{ fontFamily: 'var(--mono)', fontSize: 11 }} fill="var(--accent-2)">{defB.label}</text>

      {/* Y-axis label */}
      <text
        x={10} y={axisY / 2 + 8}
        textAnchor="middle"
        style={{ fontFamily: 'var(--mono)', fontSize: 10 }}
        fill="var(--ink-faint)"
        transform={`rotate(-90, 10, ${axisY / 2})`}
      >
        {lang === 'zh' ? '元素个数' : 'count'}
      </text>
    </svg>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Widget 3: Rubik's cube factor accounting
// ══════════════════════════════════════════════════════════════════════════════

// Factor blocks for the cube group
interface CubeFactorBlock {
  key: string;
  label: string;
  order: bigint;
  count: number;  // how many copies
  color: string;
  tooltipZh: string;
  tooltipEn: string;
}

const CUBE_FACTORS: CubeFactorBlock[] = [
  {
    key: 'A8', label: 'A₈', order: 20160n, count: 1, color: '#8B2E3C',
    tooltipZh: 'A₈: 8 个角块的偶置换群（n=8≥5，非交换单群）|A₈|=2⁶·3²·5·7=20160',
    tooltipEn: 'A₈: even permutations of 8 corners (n=8≥5, nonabelian simple). |A₈|=2⁶·3²·5·7=20160',
  },
  {
    key: 'A12', label: 'A₁₂', order: 239500800n, count: 1, color: '#2A4D69',
    tooltipZh: 'A₁₂: 12 条棱块的偶置换群（n=12≥5，非交换单群）|A₁₂|=2⁹·3⁵·5²·7·11=239500800',
    tooltipEn: 'A₁₂: even permutations of 12 edges (n=12≥5, nonabelian simple). |A₁₂|=2⁹·3⁵·5²·7·11=239500800',
  },
  {
    key: 'C3', label: 'C₃', order: 3n, count: 7, color: '#3F7050',
    tooltipZh: 'C₃ × 7: 7 个角块朝向（总转角≡0 mod 3，去掉一个自由度，剩 7 个独立 C₃）',
    tooltipEn: 'C₃ × 7: 7 corner-orientation degrees of freedom (total-twist=0 mod 3 removes one, leaving 7 independent C₃)',
  },
  {
    key: 'C2_edge', label: 'C₂', order: 2n, count: 11, color: '#B8860B',
    tooltipZh: 'C₂ × 11: 11 条棱块翻转（总翻转≡0 mod 2，去掉一个，剩 11 个独立 C₂）',
    tooltipEn: 'C₂ × 11: 11 edge-flip degrees of freedom (total-flip=0 mod 2 removes one, leaving 11)',
  },
  {
    key: 'C2_parity', label: 'C₂', order: 2n, count: 1, color: '#6B4E9C',
    tooltipZh: 'C₂ × 1: 奇偶约束（角和棱的置换奇偶性必须相同，外层 ⋊ ℤ₂）',
    tooltipEn: 'C₂ × 1: the parity constraint (corner and edge permutation parities must agree; the outer ⋊ ℤ₂)',
  },
];

// Total product: |A8|·|A12|·3^7·2^12 = |G|
const CUBE_ORDER_BIGINT = 43252003274489856000n;

function CubeFactorPanel({ lang }: { lang: 'zh' | 'en' }) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [showProduct, setShowProduct] = useState(false);
  const [animStep, setAnimStep] = useState(0);

  // Compute running product for animation
  const steps = useMemo(() => {
    const blocks: { label: string; orderPow: bigint }[] = [];
    for (const f of CUBE_FACTORS) {
      for (let c = 0; c < f.count; c++) {
        blocks.push({ label: f.count > 1 ? `${f.label}[${c + 1}]` : f.label, orderPow: f.order });
      }
    }
    return blocks;
  }, []);

  const runningProducts = useMemo(() => {
    const arr: bigint[] = [];
    let prod = 1n;
    for (const s of steps) {
      prod *= s.orderPow;
      arr.push(prod);
    }
    return arr;
  }, [steps]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startAnimation = useCallback(() => {
    setAnimStep(0);
    setShowProduct(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setAnimStep(prev => {
        if (prev >= steps.length - 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return steps.length - 1;
        }
        return prev + 1;
      });
    }, 140);
  }, [steps.length]);

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  // SVG block layout: width ∝ log10(order) * count
  const logWidths = CUBE_FACTORS.map(f => {
    const log = Math.log10(Number(f.order));
    return Math.max(log * 28, 30) * f.count;
  });
  const totalLogW = logWidths.reduce((a, b) => a + b, 0);
  const svgW = 600;
  const blockH = 60;
  const svgH = blockH + 80;

  // Scale widths to fit svgW (minus margins)
  const avail = svgW - 24;
  const scale = avail / totalLogW;
  const widths = logWidths.map(w => w * scale);

  // Block x positions
  const blockXs: number[] = [];
  let cx = 12;
  for (const w of widths) {
    blockXs.push(cx);
    cx += w + 2;
  }

  const hovered = hoveredKey ? CUBE_FACTORS.find(f => f.key === hoveredKey) : null;

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="魔方群合成因子核算" en="Rubik&apos;s cube factor accounting" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh={<>21 个合成因子如何覆盖 |G| = 2²⁷·3¹⁴·5³·7²·11 的全部素数幂。悬停/点击每个因子块查看含义；点击&ldquo;累乘阶数&rdquo;验证等式。</>}
          en="How the 21 composition factors account for every prime in |G| = 2²⁷·3¹⁴·5³·7²·11. Hover/tap each block for its meaning; click 'multiply orders' to verify the identity."
        />
      </div>

      {/* Factor block SVG */}
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        width="100%"
        style={{ display: 'block', margin: '12px 0', cursor: 'pointer', maxWidth: svgW }}
      >
        {CUBE_FACTORS.map((f, fi) => {
          const x = blockXs[fi];
          const w = widths[fi];
          const isHov = hoveredKey === f.key;
          return (
            <g
              key={f.key}
              onMouseEnter={() => setHoveredKey(f.key)}
              onMouseLeave={() => setHoveredKey(null)}
              onClick={() => setHoveredKey(hoveredKey === f.key ? null : f.key)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={x} y={4} width={w - 2} height={blockH} rx={6}
                fill={`color-mix(in srgb, ${f.color} ${isHov ? 35 : 18}%, var(--bg-elev))`}
                stroke={f.color} strokeWidth={isHov ? 2.5 : 1.5}
              />
              {/* Factor label */}
              <text
                x={x + (w - 2) / 2} y={28}
                textAnchor="middle"
                style={{ fontFamily: 'var(--mono)', fontSize: Math.min(15, (w - 4) / f.label.length * 1.8), fontWeight: 700 }}
                fill={f.color}
              >
                {f.label}
              </text>
              {/* Count badge if > 1 */}
              {f.count > 1 && (
                <text
                  x={x + (w - 2) / 2} y={48}
                  textAnchor="middle"
                  style={{ fontFamily: 'var(--mono)', fontSize: 11 }}
                  fill={`color-mix(in srgb, ${f.color} 80%, var(--ink))`}
                >
                  ×{f.count}
                </text>
              )}
            </g>
          );
        })}

        {/* Prime ledger below blocks */}
        <text x={12} y={blockH + 22} style={{ fontFamily: 'var(--mono)', fontSize: 10 }} fill="var(--ink-dim)">
          {lang === 'zh' ? '素数分解:' : 'prime decomp:'}
        </text>
        <text x={12} y={blockH + 36} style={{ fontFamily: 'var(--mono)', fontSize: 10 }} fill="var(--ink-faint)">
          2: {lang === 'zh' ? '6(A₈)+9(A₁₂)+12(C₂×12)' : '6(A₈)+9(A₁₂)+12(C₂×12)'} = 27
        </text>
        <text x={12} y={blockH + 50} style={{ fontFamily: 'var(--mono)', fontSize: 10 }} fill="var(--ink-faint)">
          3: {lang === 'zh' ? '2(A₈)+5(A₁₂)+7(C₃×7)' : '2(A₈)+5(A₁₂)+7(C₃×7)'} = 14
        </text>
        <text x={12} y={blockH + 64} style={{ fontFamily: 'var(--mono)', fontSize: 10 }} fill="var(--ink-faint)">
          {lang === 'zh' ? '5: 1(A₈)+2(A₁₂)=3; 7: 1+1=2; 11: 1(A₁₂)=1 — 全部来自非交换单因子' : '5: 1(A₈)+2(A₁₂)=3; 7: 1+1=2; 11: 1(A₁₂)=1 — all from nonabelian simple factors'}
        </text>
      </svg>

      {/* Tooltip area */}
      {hovered && (
        <div style={{
          background: 'var(--bg-elev)', border: `1px solid ${hovered.color}`,
          borderRadius: 8, padding: '10px 14px', fontSize: 13, lineHeight: 1.6,
          color: 'var(--ink-dim)', marginBottom: 12,
        }}>
          <span style={{ fontWeight: 700, color: hovered.color, fontFamily: 'var(--mono)', marginRight: 8 }}>
            {hovered.label}{hovered.count > 1 ? ` ×${hovered.count}` : ''}
          </span>
          {lang === 'zh' ? hovered.tooltipZh : hovered.tooltipEn}
        </div>
      )}

      {/* Animate button */}
      <button className="gt-btn" onClick={startAnimation} style={{ marginBottom: 10 }}>
        <L zh="累乘阶数 — 验证乘积 = |G|" en="Multiply orders — verify product = |G|" />
      </button>

      {showProduct && (
        <div className="gt-panel-result">
          <div className="gt-result-row">
            <span className="gt-result-label"><L zh="当前已乘因子数" en="Factors multiplied so far" /></span>
            <span className="gt-result-val">{animStep + 1} / {steps.length}</span>
          </div>
          <div className="gt-result-row">
            <span className="gt-result-label"><L zh="累积乘积" en="Running product" /></span>
            <span className="gt-result-val" style={{ fontFamily: 'var(--mono)', fontSize: 12, wordBreak: 'break-all' }}>
              {runningProducts[animStep]?.toString() ?? '…'}
            </span>
          </div>
          {animStep === steps.length - 1 && (
            <div className="gt-result-row">
              <span className="gt-result-label"><L zh="|G| = 43,252,003,274,489,856,000" en="|G| = 43,252,003,274,489,856,000" /></span>
              <span className="gt-result-val-strong" style={{ color: runningProducts[animStep] === CUBE_ORDER_BIGINT ? 'var(--green)' : 'var(--warn)' }}>
                {runningProducts[animStep] === CUBE_ORDER_BIGINT
                  ? (lang === 'zh' ? '✓ 完全吻合' : '✓ exact match')
                  : (lang === 'zh' ? '✗ 不符 (bug)' : '✗ mismatch (bug)')}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Summary table */}
      <table className="gt-compare" style={{ marginTop: 16, fontSize: 13 }}>
        <thead>
          <tr>
            <th><L zh="因子" en="Factor" /></th>
            <th><L zh="个数" en="Count" /></th>
            <th><L zh="含义" en="Meaning" /></th>
            <th><L zh="贡献素数" en="Primes contributed" /></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ fontFamily: 'var(--mono)', color: '#8B2E3C' }}>A₈</td>
            <td>1</td>
            <td><L zh="角块偶置换" en="Even corner perms" /></td>
            <td style={{ fontFamily: 'var(--mono)' }}>2⁶·3²·5·7</td>
          </tr>
          <tr>
            <td style={{ fontFamily: 'var(--mono)', color: '#2A4D69' }}>A₁₂</td>
            <td>1</td>
            <td><L zh="棱块偶置换" en="Even edge perms" /></td>
            <td style={{ fontFamily: 'var(--mono)' }}>2⁹·3⁵·5²·7·11</td>
          </tr>
          <tr>
            <td style={{ fontFamily: 'var(--mono)', color: '#3F7050' }}>C₃</td>
            <td>7</td>
            <td><L zh="角块朝向" en="Corner orientations" /></td>
            <td style={{ fontFamily: 'var(--mono)' }}>3⁷</td>
          </tr>
          <tr>
            <td style={{ fontFamily: 'var(--mono)', color: '#B8860B' }}>C₂</td>
            <td>11</td>
            <td><L zh="棱块翻转" en="Edge flips" /></td>
            <td style={{ fontFamily: 'var(--mono)' }}>2¹¹</td>
          </tr>
          <tr>
            <td style={{ fontFamily: 'var(--mono)', color: '#6B4E9C' }}>C₂</td>
            <td>1</td>
            <td><L zh="奇偶约束" en="Parity constraint" /></td>
            <td style={{ fontFamily: 'var(--mono)' }}>2¹</td>
          </tr>
          <tr style={{ fontWeight: 700, borderTop: '2px solid var(--rule)' }}>
            <td><L zh="合计" en="Total" /></td>
            <td>21</td>
            <td><L zh="合成长度" en="Composition length" /></td>
            <td style={{ fontFamily: 'var(--mono)' }}>2²⁷·3¹⁴·5³·7²·11</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Widget 4: A4 — normal vs subnormal, coarse vs refined series
// ══════════════════════════════════════════════════════════════════════════════

function A4RefinementPanel({ lang }: { lang: 'zh' | 'en' }) {
  const [step, setStep] = useState<0 | 1>(0); // 0 = coarse, 1 = refined
  const [showNormalInG, setShowNormalInG] = useState(false);

  // Coarse chain: 1 <| V4 <| A4
  const coarseRungs: RungDef[] = [
    { label: '1', order: 1, normalInWhole: true },
    { label: 'V₄ ≅ C₂×C₂', order: 4, normalInWhole: true },
    { label: 'A₄', order: 12, normalInWhole: true },
  ];
  // Coarse "factor" from 1 to V4 is order 4, NOT simple
  const coarseFactors = [
    { order: 4, simple: false, label: lang === 'zh' ? 'C₂×C₂ (非单!)' : 'C₂×C₂ (not simple!)' },
    { order: 3, simple: true, label: 'C₃' },
  ];

  // Refined chain: 1 <| C2 <| V4 <| A4
  const refinedRungs: RungDef[] = [
    { label: '1', order: 1, normalInWhole: true },
    { label: 'C₂ ◁ V₄', order: 2, normalInWhole: false },  // C2 not normal in A4!
    { label: 'V₄ ≅ C₂×C₂', order: 4, normalInWhole: true },
    { label: 'A₄', order: 12, normalInWhole: true },
  ];
  const refinedFactors = [
    { order: 2, simple: true, label: 'C₂' },
    { order: 2, simple: true, label: 'C₂' },
    { order: 3, simple: true, label: 'C₃' },
  ];

  const rungs = step === 0 ? coarseRungs : refinedRungs;
  const factors = step === 0 ? coarseFactors : refinedFactors;

  const n = rungs.length;
  const boxW = 180, boxH = 36, gap = 56;
  const svgH = n * (boxH + gap) - gap + 16;
  const svgW = 340;
  const centerX = svgW / 2;

  const rungY = (i: number) => 8 + (n - 1 - i) * (boxH + gap);
  const midY = (i: number) => rungY(i) + boxH + gap / 2;

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="A₄ 的合成列: 为什么要细化" en="A₄ composition series: why refinement is necessary" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="粗链 1 ◁ V₄ ◁ A₄ 还不是合成列（V₄/1 ≅ C₂×C₂ 不单）；必须插入 C₂ 细化。细化后 C₂ 对 V₄ 正规，对 A₄ 则不正规，所以这是次正规列而非正规列。"
          en="The coarse chain 1 ◁ V₄ ◁ A₄ is NOT a composition series (V₄/1 ≅ C₂×C₂ is not simple); a C₂ must be inserted. After refinement, C₂ is normal in V₄ but NOT in A₄ — subnormal, not normal."
        />
      </div>

      {/* Step toggle */}
      <div className="gt-panel-input-row" style={{ gap: 8 }}>
        <label><L zh="步骤" en="Step" /></label>
        <button
          className={`gt-chip${step === 0 ? ' gt-chip-active' : ''}`}
          onClick={() => setStep(0)}
        >
          <L zh="粗链 (非合成列)" en="Coarse chain (not a composition series)" />
        </button>
        <button
          className={`gt-chip${step === 1 ? ' gt-chip-active' : ''}`}
          onClick={() => setStep(1)}
        >
          <L zh="细化合成列" en="Refined composition series" />
        </button>
      </div>

      {/* Normal-in-G checkbox */}
      <div className="gt-panel-input-row" style={{ gap: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
          <input
            type="checkbox"
            checked={showNormalInG}
            onChange={e => setShowNormalInG(e.target.checked)}
            style={{ accentColor: 'var(--accent)' }}
          />
          <L zh="标注哪些子群对 A₄ 正规" en="Mark which subgroups are normal in A₄" />
        </label>
      </div>

      {/* SVG ladder for A4 */}
      <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" style={{ display: 'block', margin: '12px 0', maxWidth: svgW }}>
        {/* Vertical spine */}
        <line
          x1={centerX} y1={rungY(0) + boxH}
          x2={centerX} y2={rungY(n - 1)}
          stroke="var(--rule)" strokeWidth={2}
        />

        {/* Rungs */}
        {rungs.map((r, i) => {
          const y = rungY(i);
          const isTop = i === n - 1;
          const isInserted = step === 1 && i === 1; // The newly inserted C2
          return (
            <g key={i}>
              <rect
                x={centerX - boxW / 2} y={y}
                width={boxW} height={boxH} rx={6}
                fill={isInserted
                  ? 'color-mix(in srgb, var(--gold) 15%, var(--bg-elev))'
                  : isTop
                    ? 'color-mix(in srgb, var(--accent) 12%, var(--bg-elev))'
                    : 'var(--bg-elev)'}
                stroke={isInserted ? 'var(--gold)' : isTop ? 'var(--accent)' : 'var(--rule)'}
                strokeWidth={isInserted ? 2 : isTop ? 1.5 : 1}
              />
              <text
                x={centerX} y={y + 23}
                textAnchor="middle"
                style={{ fontFamily: 'var(--mono)', fontSize: 13 }}
                fill={isInserted ? 'var(--gold)' : isTop ? 'var(--accent)' : 'var(--ink)'}
              >
                {r.label}
              </text>
              {/* Normal-in-G badge */}
              {showNormalInG && i > 0 && i < n - 1 && (
                <text
                  x={centerX + boxW / 2 + 8} y={y + 23}
                  textAnchor="start"
                  style={{ fontFamily: 'var(--mono)', fontSize: 11 }}
                  fill={r.normalInWhole ? 'var(--green)' : 'var(--warn)'}
                >
                  {r.normalInWhole
                    ? (lang === 'zh' ? '◁ A₄ ✓' : '◁ A₄ ✓')
                    : (lang === 'zh' ? '◁ A₄ ✗' : '◁ A₄ ✗')}
                </text>
              )}
            </g>
          );
        })}

        {/* Factor labels */}
        {factors.map((f, i) => {
          const y = midY(i);
          const color = f.simple ? '#3F7050' : 'var(--warn)';
          return (
            <g key={i}>
              <rect
                x={centerX - 60} y={y - 14}
                width={52} height={22} rx={4}
                fill={f.simple
                  ? 'color-mix(in srgb, #3F7050 15%, var(--bg-elev))'
                  : 'color-mix(in srgb, var(--warn) 15%, var(--bg-elev))'}
                stroke={color} strokeWidth={f.simple ? 1 : 2}
              />
              <text
                x={centerX - 34} y={y + 2}
                textAnchor="middle"
                style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600 }}
                fill={color}
              >
                {f.label}
              </text>
              {/* Simple/not-simple flag */}
              <text
                x={centerX + 10} y={y + 2}
                textAnchor="start"
                style={{ fontFamily: 'var(--mono)', fontSize: 10 }}
                fill={f.simple ? 'var(--ink-faint)' : 'var(--warn)'}
              >
                {f.simple
                  ? (lang === 'zh' ? '单群 ✓' : 'simple ✓')
                  : (lang === 'zh' ? '非单群 ✗' : 'not simple ✗')}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="gt-panel-result">
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="是合成列？" en="Is this a composition series?" /></span>
          <span className="gt-result-val-strong" style={{ color: step === 1 ? 'var(--green)' : 'var(--warn)' }}>
            {step === 0
              ? (lang === 'zh' ? '否 — V₄/1 = C₂×C₂ 不是单群' : 'No — V₄/1 = C₂×C₂ is not simple')
              : (lang === 'zh' ? '是 — 每个因子都是单群' : 'Yes — every factor is a simple group')}
          </span>
        </div>
        {step === 1 && (
          <>
            <div className="gt-result-row">
              <span className="gt-result-label"><L zh="C₂ 对 V₄ 正规？" en="C₂ normal in V₄?" /></span>
              <span className="gt-result-val" style={{ color: 'var(--green)' }}>
                <L zh="是 (V₄ 交换，每个子群正规)" en="Yes (V₄ is abelian; every subgroup is normal)" />
              </span>
            </div>
            <div className="gt-result-row">
              <span className="gt-result-label"><L zh="C₂ 对 A₄ 正规？" en="C₂ normal in A₄?" /></span>
              <span className="gt-result-val" style={{ color: 'var(--warn)' }}>
                <L zh="否 — A₄ 中三个阶-2 子群相互共轭，没有一个正规" en="No — the three order-2 subgroups of A₄ are conjugate to each other; none is normal in A₄" />
              </span>
            </div>
            <div className="gt-result-row">
              <span className="gt-result-label"><L zh="结论" en="Conclusion" /></span>
              <span className="gt-result-val">
                <L zh="合成列是次正规列，不是正规列（下一条正规性只对相邻项成立）" en="A composition series is subnormal, not necessarily normal — normality is only required between consecutive terms" />
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
