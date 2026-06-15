'use client';

import { useState, useMemo, useCallback } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import type { Lang } from '../primitives';
import { tr } from '@/i18n/tr';

// ── Data tables: derived and lower central series ─────────────────────────────

type GroupId = 'S3' | 'S4' | 'A4' | 'A5' | 'D4' | 'Q8';

interface SeriesTerm {
  name: string;          // e.g. "A₄", "V₄", "{e}"
  nameTex: string;       // LaTeX
  order: number;
}

interface GroupData {
  labelEn: string;
  labelZh: string;
  order: number;
  derivedSeries: SeriesTerm[];     // G^(0), G^(1), ...
  lowerCentral: SeriesTerm[];      // γ₁, γ₂, ...
  solvable: boolean;               // derived series reaches {e}
  nilpotent: boolean;              // lower central reaches {e}
  derivedLength: number | null;    // null if not solvable
  nilpClass: number | null;        // null if not nilpotent
  // Why not nilpotent (short note)
  notNilpotentReasonEn?: string;
  notNilpotentReasonZh?: string;
}

const E_TERM: SeriesTerm = { name: '{e}', nameTex: '\\{e\\}', order: 1 };

const GROUP_DATA: Record<GroupId, GroupData> = {
  S3: {
    labelEn: 'S₃ (sym. on 3)', labelZh: 'S₃ (3元置换群)',
    order: 6,
    derivedSeries: [
      { name: 'S₃', nameTex: 'S_3', order: 6 },
      { name: 'A₃ ≅ ℤ₃', nameTex: 'A_3 \\cong \\mathbb{Z}_3', order: 3 },
      E_TERM,
    ],
    lowerCentral: [
      { name: 'S₃', nameTex: 'S_3', order: 6 },
      { name: 'A₃', nameTex: 'A_3', order: 3 },
      { name: 'A₃', nameTex: 'A_3', order: 3 }, // stabilizes
    ],
    solvable: true,
    nilpotent: false,
    derivedLength: 2,
    nilpClass: null,
    notNilpotentReasonEn: 'γ₃ = [S₃, A₃] = A₃ ≠ {e} — series stabilizes; Sylow-2 subgroups (three of them) not normal.',
    notNilpotentReasonZh: 'γ₃ = [S₃, A₃] = A₃ ≠ {e}，下中心级数稳定；Sylow-2 子群（共三个）不正规。'
},
  S4: {
    labelEn: 'S₄ (sym. on 4)', labelZh: 'S₄ (4元置换群)',
    order: 24,
    derivedSeries: [
      { name: 'S₄', nameTex: 'S_4', order: 24 },
      { name: 'A₄', nameTex: 'A_4', order: 12 },
      { name: 'V₄', nameTex: 'V_4', order: 4 },
      E_TERM,
    ],
    lowerCentral: [
      { name: 'S₄', nameTex: 'S_4', order: 24 },
      { name: 'A₄', nameTex: 'A_4', order: 12 },
      { name: 'A₄', nameTex: 'A_4', order: 12 }, // stabilizes: [S4, A4] = A4 (contains 3-cycles)
    ],
    solvable: true,
    nilpotent: false,
    derivedLength: 3,
    nilpClass: null,
    notNilpotentReasonEn: 'γ₃ = [S₄, A₄] = A₄ ≠ {e} — lower central stabilizes at A₄; Sylow-3 subgroups not normal.',
    notNilpotentReasonZh: 'γ₃ = [S₄, A₄] = A₄ ≠ {e}，下中心级数稳定在 A₄；Sylow-3 子群不正规。'
},
  A4: {
    labelEn: 'A₄ (alt. on 4)', labelZh: 'A₄ (4元交替群)',
    order: 12,
    derivedSeries: [
      { name: 'A₄', nameTex: 'A_4', order: 12 },
      { name: 'V₄', nameTex: 'V_4', order: 4 },
      E_TERM,
    ],
    lowerCentral: [
      { name: 'A₄', nameTex: 'A_4', order: 12 },
      { name: 'V₄', nameTex: 'V_4', order: 4 },
      { name: 'V₄', nameTex: 'V_4', order: 4 }, // stabilizes: [A4, V4] = V4
    ],
    solvable: true,
    nilpotent: false,
    derivedLength: 2,
    nilpClass: null,
    notNilpotentReasonEn: 'γ₃ = [A₄, V₄] = V₄ ≠ {e} — series stabilizes; four Sylow-3 subgroups (not normal).',
    notNilpotentReasonZh: 'γ₃ = [A₄, V₄] = V₄ ≠ {e}，级数稳定；有四个 Sylow-3 子群（不正规）。'
},
  A5: {
    labelEn: 'A₅ (alt. on 5)', labelZh: 'A₅ (5元交替群)',
    order: 60,
    derivedSeries: [
      { name: 'A₅', nameTex: 'A_5', order: 60 },
      { name: 'A₅', nameTex: 'A_5', order: 60 }, // [A5,A5] = A5 (simple nonabelian)
    ],
    lowerCentral: [
      { name: 'A₅', nameTex: 'A_5', order: 60 },
      { name: 'A₅', nameTex: 'A_5', order: 60 },
    ],
    solvable: false,
    nilpotent: false,
    derivedLength: null,
    nilpClass: null,
    notNilpotentReasonEn: 'A₅ is simple nonabelian — derived series stabilizes at A₅ itself; not solvable and not nilpotent.',
    notNilpotentReasonZh: 'A₅ 是非交换单群，导出列稳定在 A₅ 本身；既不可解也不幂零。'
},
  D4: {
    labelEn: 'D₄ (dihedral, order 8)', labelZh: 'D₄ (二面体群，阶 8)',
    order: 8,
    derivedSeries: [
      { name: 'D₄', nameTex: 'D_4', order: 8 },
      { name: '⟨r²⟩ ≅ ℤ₂', nameTex: '\\langle r^2 \\rangle \\cong \\mathbb{Z}_2', order: 2 },
      E_TERM,
    ],
    lowerCentral: [
      { name: 'D₄', nameTex: 'D_4', order: 8 },
      { name: '⟨r²⟩', nameTex: '\\langle r^2 \\rangle', order: 2 },
      E_TERM,
    ],
    solvable: true,
    nilpotent: true,
    derivedLength: 2,
    nilpClass: 2
},
  Q8: {
    labelEn: 'Q₈ (quaternion)', labelZh: 'Q₈ (四元数群)',
    order: 8,
    derivedSeries: [
      { name: 'Q₈', nameTex: 'Q_8', order: 8 },
      { name: '{1,−1} ≅ ℤ₂', nameTex: '\\{1,-1\\} \\cong \\mathbb{Z}_2', order: 2 },
      E_TERM,
    ],
    lowerCentral: [
      { name: 'Q₈', nameTex: 'Q_8', order: 8 },
      { name: '{1,−1}', nameTex: '\\{1,-1\\}', order: 2 },
      E_TERM,
    ],
    solvable: true,
    nilpotent: true,
    derivedLength: 2,
    nilpClass: 2
},
};

const GROUP_IDS: GroupId[] = ['S3', 'S4', 'A4', 'A5', 'D4', 'Q8'];

// ── Sylow data table ──────────────────────────────────────────────────────────

interface SylowPrime { p: number; exp: number; sylowOrder: number; nP: number; normal: boolean }

const SYLOW_DATA: Record<GroupId, SylowPrime[]> = {
  S3:  [{ p: 2, exp: 1, sylowOrder: 2,  nP: 3, normal: false }, { p: 3, exp: 1, sylowOrder: 3,  nP: 1, normal: true  }],
  S4:  [{ p: 2, exp: 3, sylowOrder: 8,  nP: 3, normal: false }, { p: 3, exp: 1, sylowOrder: 3,  nP: 4, normal: false }],
  A4:  [{ p: 2, exp: 2, sylowOrder: 4,  nP: 1, normal: true  }, { p: 3, exp: 1, sylowOrder: 3,  nP: 4, normal: false }],
  A5:  [{ p: 2, exp: 2, sylowOrder: 4,  nP: 5, normal: false }, { p: 3, exp: 1, sylowOrder: 3,  nP: 10, normal: false }, { p: 5, exp: 1, sylowOrder: 5, nP: 6, normal: false }],
  D4:  [{ p: 2, exp: 3, sylowOrder: 8,  nP: 1, normal: true  }],
  Q8:  [{ p: 2, exp: 3, sylowOrder: 8,  nP: 1, normal: true  }],
};

// Palette for prime colors
const PRIME_COLORS = ['#8B2E3C', '#2A4D69', '#3F7050', '#B8860B', '#6B4E9C'];

// ── §37 SolvableNilpotent ─────────────────────────────────────────────────────

export default function SolvableNilpotent() {
  const lang = useLang();

  return (
    <GTSec id="solvable-nilpotent" className="gt-sec">
      <div className="gt-sec-num">§37</div>
      <h2 className="gt-sec-title">
        <L zh="可解群与幂零群" en="Solvable & nilpotent groups" />
      </h2>

      <p className="gt-lede">
        <L
          zh={<>
            一个群「多交换」意味着什么？答案可以从它的<em>导出列</em>读出：反复取换位子群，若干步后化为平凡群，则称之为<strong>可解群</strong>。幂零条件更严格——每一步不再只取自身的换位子群，而是与整个群作换位，若干步后也能化为平凡群。Galois 在 19 世纪初揭示了可解群与根式可解多项式之间的精确对应，这也解释了为什么五次方程没有通用求根公式。魔方群的故事更令人意外：阶数高达 <TeX src={String.raw`4.3\times10^{19}`} /> 的它不是可解群——因为组合因子中含有非交换单群 <TeX src={String.raw`A_8`} /> 和 <TeX src={String.raw`A_{12}`} />。
          </>}
          en={<>
            What does it mean for a group to be &ldquo;almost abelian&rdquo;? The derived series gives one answer: repeatedly take the commutator subgroup; if this process reaches the trivial group in finitely many steps the group is called <strong>solvable</strong>. Nilpotency is stricter — instead of taking commutators within the current subgroup alone, we always commute with the whole group. Galois showed in the 1830s that solvability by radicals is precisely solvability of the Galois group, explaining why no general quintic formula exists. The Rubik&apos;s Cube group — order <TeX src={String.raw`4.3\times10^{19}`} /> — is not solvable, because its composition factors include the non-abelian simple groups <TeX src={String.raw`A_8`} /> and <TeX src={String.raw`A_{12}`} />.
          </>}
        />
      </p>

      {/* ── Definition: commutator & derived subgroup ── */}
      <div className="gt-def">
        <div className="gt-def-title">
          <L zh="定义: 换位子与导出子群" en="Definition: commutator and derived subgroup" />
        </div>
        <div className="gt-def-body">
          <L
            zh={<>
              设 <TeX src={String.raw`a,b\in G`} />，<strong>换位子</strong>（commutator）定义为
            </>}
            en={<>
              For <TeX src={String.raw`a,b\in G`} />, the <strong>commutator</strong> of <TeX src={String.raw`a`} /> and <TeX src={String.raw`b`} /> is
            </>}
          />
          <TeXBlock src={String.raw`[a,b] = a^{-1}b^{-1}ab.`} />
          <L
            zh={<>
              注意 <TeX src={String.raw`[a,b]=e`} /> 当且仅当 <TeX src={String.raw`ab=ba`} />，即 <TeX src={String.raw`a,b`} /> 交换。对子群 <TeX src={String.raw`H,K\leq G`} />，<strong>换位子子群</strong> <TeX src={String.raw`[H,K]`} /> 是所有 <TeX src={String.raw`[h,k]`} />（<TeX src={String.raw`h\in H,k\in K`} />）生成的子群。<strong>导出子群</strong>（commutator subgroup）<TeX src={String.raw`G'=[G,G]`} /> 是 <TeX src={String.raw`G`} /> 中使商群为阿贝尔群的最小正规子群：<TeX src={String.raw`G/N`} /> 为阿贝尔群当且仅当 <TeX src={String.raw`G'\leq N`} />。
            </>}
            en={<>
              Note <TeX src={String.raw`[a,b]=e`} /> iff <TeX src={String.raw`ab=ba`} />, i.e. <TeX src={String.raw`a`} /> and <TeX src={String.raw`b`} /> commute. For subgroups <TeX src={String.raw`H,K\leq G`} />, the <strong>commutator subgroup</strong> <TeX src={String.raw`[H,K]`} /> is generated by all <TeX src={String.raw`[h,k]`} /> with <TeX src={String.raw`h\in H,k\in K`} />. The <strong>derived subgroup</strong> <TeX src={String.raw`G'=[G,G]`} /> is the smallest normal subgroup with abelian quotient: <TeX src={String.raw`G/N`} /> is abelian iff <TeX src={String.raw`G'\leq N`} />.
            </>}
          />
        </div>
      </div>

      {/* ── Derived series ── */}
      <div className="gt-def">
        <div className="gt-def-title">
          <L zh="定义: 导出列与可解群" en="Definition: derived series and solvable groups" />
        </div>
        <div className="gt-def-body">
          <L
            zh={<>
              <strong>导出列</strong>定义为 <TeX src={String.raw`G^{(0)}=G`} />，<TeX src={String.raw`G^{(i+1)}=[G^{(i)},G^{(i)}]`} />，给出下降链
            </>}
            en={<>
              The <strong>derived series</strong> is defined by <TeX src={String.raw`G^{(0)}=G`} />, <TeX src={String.raw`G^{(i+1)}=[G^{(i)},G^{(i)}]`} />, giving a descending chain
            </>}
          />
          <TeXBlock src={String.raw`G = G^{(0)} \geq G^{(1)} \geq G^{(2)} \geq \cdots`} />
          <L
            zh={<>
              其中每项都是 <TeX src={String.raw`G`} /> 的特征子群，每个商 <TeX src={String.raw`G^{(i)}/G^{(i+1)}`} /> 为阿贝尔群。群 <TeX src={String.raw`G`} /> 是<strong>可解群</strong>（solvable）当且仅当存在 <TeX src={String.raw`n`} /> 使 <TeX src={String.raw`G^{(n)}=\{e\}`} />；最小的这个 <TeX src={String.raw`n`} /> 称为<strong>导出长度</strong>（derived length）。
            </>}
            en={<>
              Each term is characteristic in <TeX src={String.raw`G`} /> and each quotient <TeX src={String.raw`G^{(i)}/G^{(i+1)}`} /> is abelian. The group <TeX src={String.raw`G`} /> is <strong>solvable</strong> iff <TeX src={String.raw`G^{(n)}=\{e\}`} /> for some <TeX src={String.raw`n`} />; the least such <TeX src={String.raw`n`} /> is the <strong>derived length</strong>.
            </>}
          />
        </div>
      </div>

      {/* ── Lower central series ── */}
      <div className="gt-def">
        <div className="gt-def-title">
          <L zh="定义: 下中心列与幂零群" en="Definition: lower central series and nilpotent groups" />
        </div>
        <div className="gt-def-body">
          <L
            zh={<>
              <strong>下中心列</strong>定义为 <TeX src={String.raw`\gamma_1(G)=G`} />，<TeX src={String.raw`\gamma_{i+1}(G)=[G,\gamma_i(G)]`} />（注意每次都与<em>整个</em> <TeX src={String.raw`G`} /> 取换位，而非与 <TeX src={String.raw`\gamma_i`} /> 自身取换位——这与导出列不同）。群 <TeX src={String.raw`G`} /> 是<strong>幂零群</strong>（nilpotent）当且仅当 <TeX src={String.raw`\gamma_{c+1}(G)=\{e\}`} /> 对某个 <TeX src={String.raw`c\geq 0`} /> 成立；最小的这个 <TeX src={String.raw`c`} /> 称为<strong>幂零类</strong>（nilpotency class）。
            </>}
            en={<>
              The <strong>lower central series</strong> is defined by <TeX src={String.raw`\gamma_1(G)=G`} />, <TeX src={String.raw`\gamma_{i+1}(G)=[G,\gamma_i(G)]`} /> (note: commute with the <em>whole</em> group <TeX src={String.raw`G`} /> each time, not just within <TeX src={String.raw`\gamma_i`} /> — this is different from the derived series). <TeX src={String.raw`G`} /> is <strong>nilpotent</strong> iff <TeX src={String.raw`\gamma_{c+1}(G)=\{e\}`} /> for some <TeX src={String.raw`c\geq 0`} />; the least such <TeX src={String.raw`c`} /> is the <strong>nilpotency class</strong>.
            </>}
          />
        </div>
      </div>

      <p>
        <L
          zh={<>
            最常见的混淆：下中心列用 <TeX src={String.raw`[G,\gamma_i]`} />，导出列用 <TeX src={String.raw`[\gamma_i,\gamma_i]`} />。两者在 <TeX src={String.raw`\gamma_2`} /> 处相同（都等于 <TeX src={String.raw`[G,G]=G'`} />），但之后可以分叉。对 <TeX src={String.raw`S_3`} /> 而言，导出列 <TeX src={String.raw`S_3\to A_3\to\{e\}`} /> 在两步内终止（可解），而下中心列 <TeX src={String.raw`S_3\to A_3\to A_3\to\cdots`} /> 稳定在 <TeX src={String.raw`A_3`} />，永远到不了 <TeX src={String.raw`\{e\}`} />（不幂零）。
          </>}
          en={<>
            The most common confusion: the lower central series uses <TeX src={String.raw`[G,\gamma_i]`} />, while the derived series uses <TeX src={String.raw`[\gamma_i,\gamma_i]`} />. They agree at <TeX src={String.raw`\gamma_2`} /> (both equal <TeX src={String.raw`[G,G]=G'`} />) but can diverge afterwards. For <TeX src={String.raw`S_3`} />: the derived series <TeX src={String.raw`S_3\to A_3\to\{e\}`} /> terminates in two steps (solvable), while the lower central series <TeX src={String.raw`S_3\to A_3\to A_3\to\cdots`} /> stabilizes at <TeX src={String.raw`A_3`} /> and never reaches <TeX src={String.raw`\{e\}`} /> (not nilpotent).
          </>}
        />
      </p>

      {/* ── Theorem: nilpotent => solvable ── */}
      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理: 幂零 ⟹ 可解（反之不然）" en="Theorem: nilpotent implies solvable (not conversely)" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>
              每个幂零群都是可解群。反之不然：<TeX src={String.raw`S_3`} />（导出长度 2）是可解群但不是幂零群。
              包含关系为：交换群 <TeX src={String.raw`\Rightarrow`} /> 幂零群 <TeX src={String.raw`\Rightarrow`} /> 超可解群 <TeX src={String.raw`\Rightarrow`} /> 可解群，每个蕴含都严格。
              有限群中：<strong>有限群为幂零群当且仅当它同构于各 Sylow 子群的直积</strong>（有限群特有，无限群不成立）。特别地，每个有限 <TeX src={String.raw`p`} />-群都是幂零群，<TeX src={String.raw`D_4`} /> 和 <TeX src={String.raw`Q_8`} /> 都是阶为 8 的 2-群，故都幂零。<TeX src={String.raw`S_3`} /> 的 Sylow-2 子群有三个且不正规，故不幂零。
            </>}
            en={<>
              Every nilpotent group is solvable. The converse fails: <TeX src={String.raw`S_3`} /> (derived length 2) is solvable but not nilpotent.
              The inclusions are: abelian <TeX src={String.raw`\Rightarrow`} /> nilpotent <TeX src={String.raw`\Rightarrow`} /> supersolvable <TeX src={String.raw`\Rightarrow`} /> solvable, each strict.
              For finite groups: <strong>a finite group is nilpotent iff it is (isomorphic to) the direct product of its Sylow subgroups</strong> (a finite-group result; does not hold for infinite groups). In particular every finite <TeX src={String.raw`p`} />-group is nilpotent, so <TeX src={String.raw`D_4`} /> and <TeX src={String.raw`Q_8`} /> (both 2-groups of order 8) are nilpotent. <TeX src={String.raw`S_3`} /> has three Sylow-2 subgroups, none normal, so it is not nilpotent.
            </>}
          />
        </div>
      </div>

      {/* ── Theorem: solvability of S_n ── */}
      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理: S_n 的可解性与 A_n 的单性" en="Theorem: solvability of S_n and simplicity of A_n" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>
              对所有 <TeX src={String.raw`n\geq 5`} />，<TeX src={String.raw`A_n`} /> 是非交换单群（无真正规子群）；因此 <TeX src={String.raw`S_n`} /> 的导出列在 <TeX src={String.raw`A_n`} /> 处永远停滞，<TeX src={String.raw`S_n`} /> 不可解。<strong><TeX src={String.raw`S_n`} /> 可解当且仅当 <TeX src={String.raw`n\leq 4`} /></strong>。
              注意：<TeX src={String.raw`A_4`} /> 不是单群（含正规子群 <TeX src={String.raw`V_4`} />），<TeX src={String.raw`A_3=\mathbb{Z}_3`} /> 是单群但交换。只有 <TeX src={String.raw`n\geq 5`} /> 时 <TeX src={String.raw`A_n`} /> 才是非交换单群，这正是可解性在 <TeX src={String.raw`n=5`} /> 处的断崖。<TeX src={String.raw`A_5`} />（阶 60）是最小的非交换单群。
            </>}
            en={<>
              For all <TeX src={String.raw`n\geq 5`} />, <TeX src={String.raw`A_n`} /> is simple and non-abelian (no proper normal subgroup); hence <TeX src={String.raw`[A_n,A_n]=A_n`} /> and the derived series of <TeX src={String.raw`S_n`} /> stalls at <TeX src={String.raw`A_n`} />. <strong><TeX src={String.raw`S_n`} /> is solvable iff <TeX src={String.raw`n\leq 4`} /></strong>.
              Note: <TeX src={String.raw`A_4`} /> is NOT simple (it has the normal Klein four-group <TeX src={String.raw`V_4`} />), and <TeX src={String.raw`A_3=\mathbb{Z}_3`} /> is simple but abelian. Only for <TeX src={String.raw`n\geq 5`} /> is <TeX src={String.raw`A_n`} /> simple and non-abelian — this is exactly why solvability fails precisely at <TeX src={String.raw`n=5`} />. <TeX src={String.raw`A_5`} /> (order 60) is the smallest non-abelian simple group.
            </>}
          />
        </div>
      </div>

      {/* ── Galois connection ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="Galois 定理：根式可解与群可解" en="Galois: solvability by radicals" />
      </h3>

      <p>
        <L
          zh={<>
            <strong>Galois 定理（1830s）</strong>：特征 0 域上的多项式 <TeX src={String.raw`f`} /> 可以用根式求解，当且仅当其 Galois 群 <TeX src={String.raw`\operatorname{Gal}(f)`} /> 是可解群。<em>n</em> 次一般多项式的 Galois 群是 <TeX src={String.raw`S_n`} />；由于 <TeX src={String.raw`S_n`} /> 在 <TeX src={String.raw`n\geq 5`} /> 时不可解，不存在适用于一般五次及更高次方程的根式公式——这就是 Abel-Ruffini 定理的群论证明。二次、三次、四次方程有根式公式，恰好因为 <TeX src={String.raw`S_2,S_3,S_4`} /> 都是可解群。
          </>}
          en={<>
            <strong>Galois&apos; theorem (1830s)</strong>: a polynomial <TeX src={String.raw`f`} /> over a field of characteristic 0 is solvable by radicals iff its Galois group <TeX src={String.raw`\operatorname{Gal}(f)`} /> is a solvable group. The general degree-<TeX src={String.raw`n`} /> polynomial has Galois group <TeX src={String.raw`S_n`} />; since <TeX src={String.raw`S_n`} /> is unsolvable for <TeX src={String.raw`n\geq 5`} />, there is no general radical formula for degree <TeX src={String.raw`\geq 5`} /> — this is the group-theoretic proof of Abel-Ruffini. The quadratic/cubic/quartic formulas exist precisely because <TeX src={String.raw`S_2,S_3,S_4`} /> are solvable.
          </>}
        />
      </p>

      {/* ── Cube connection ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="魔方群：不可解的代数根源" en="The Rubik's Cube group: an unsolvable algebra" />
      </h3>

      <p>
        <L
          zh={<>
            魔方群 <TeX src={String.raw`G`} />（阶 <TeX src={String.raw`2^{27}\cdot3^{14}\cdot5^3\cdot7^2\cdot11`} />）的结构为
          </>}
          en={<>
            The Rubik&apos;s Cube group <TeX src={String.raw`G`} /> (order <TeX src={String.raw`2^{27}\cdot3^{14}\cdot5^3\cdot7^2\cdot11`} />) has structure
          </>}
        />
      </p>
      <TeXBlock src={String.raw`G \;\cong\; \bigl(\mathbb{Z}_3^7 \times \mathbb{Z}_2^{11}\bigr) \rtimes \bigl((A_8\times A_{12})\rtimes\mathbb{Z}_2\bigr).`} />
      <p>
        <L
          zh={<>
            组合因子为：<TeX src={String.raw`A_8`} />、<TeX src={String.raw`A_{12}`} />（非交换单群）、<TeX src={String.raw`\mathbb{Z}_3`} />（7 次）、<TeX src={String.raw`\mathbb{Z}_2`} />（12 次）。由于 <TeX src={String.raw`A_8`} /> 和 <TeX src={String.raw`A_{12}`} /> 不是素阶循环群，<TeX src={String.raw`G`} /> <strong>不是可解群</strong>。这不仅仅是因为它"很大"或"非交换"——阶为 8 的 <TeX src={String.raw`D_4`} /> 和 <TeX src={String.raw`Q_8`} /> 非交换但仍幂零；真正的障碍是非交换单群的出现。
          </>}
          en={<>
            Its composition factors are: <TeX src={String.raw`A_8`} />, <TeX src={String.raw`A_{12}`} /> (non-abelian simple), <TeX src={String.raw`\mathbb{Z}_3`} /> (multiplicity 7), <TeX src={String.raw`\mathbb{Z}_2`} /> (multiplicity 12). Since <TeX src={String.raw`A_8`} /> and <TeX src={String.raw`A_{12}`} /> are not cyclic of prime order, <TeX src={String.raw`G`} /> is <strong>not solvable</strong>. This is not just because it is large or non-abelian — <TeX src={String.raw`D_4`} /> and <TeX src={String.raw`Q_8`} /> of order 8 are non-abelian yet nilpotent; the genuine obstruction is the presence of non-abelian simple composition factors.
          </>}
        />
      </p>

      <div className="gt-aside">
        <L
          zh={<>
            速拧选手每天都在使用换位子：经典的「Sune」型公式本质上是短换位子，精确移动少数棱或角而不干扰其余部分。下中心列的「换位子深度」控制了一个操作的局部性：<TeX src={String.raw`G^{(i)}`} /> 中的元素在越来越小的子群中被表示，因此「作用范围」越来越局限。朝向子群 <TeX src={String.raw`\mathbb{Z}_3^7`} />（角朝向）和 <TeX src={String.raw`\mathbb{Z}_2^{11}`} />（棱翻转）是正规的、交换的——这就是魔方中「容易」的可解层。著名的「奇偶性定理」——不能单独对换两块棋子——正是角置换与棱置换的奇偶性被最后一个 <TeX src={String.raw`\mathbb{Z}_2`} /> 绑定在一起的体现，即 <TeX src={String.raw`G`} /> 在 <TeX src={String.raw`S_8\times S_{12}`} /> 中的像落在联合偶置换的指数 2 子群中。
          </>}
          en={<>
            Speedcubers use commutators every day: a &ldquo;Sune&rdquo;-type algorithm is essentially a short commutator that moves a few pieces while leaving the rest fixed. The commutator depth tracked by the lower central series controls locality: elements of <TeX src={String.raw`G^{(i)}`} /> are expressed in increasingly small subgroups, so their &ldquo;reach&rdquo; becomes increasingly localised. The orientation subgroups <TeX src={String.raw`\mathbb{Z}_3^7`} /> (corner twists) and <TeX src={String.raw`\mathbb{Z}_2^{11}`} /> (edge flips) are normal and abelian — the &ldquo;easy&rdquo;, solvable layer. The famous parity rule — you cannot swap exactly two pieces with everything else solved — is precisely the fact that corner and edge permutation parities are tied by the final <TeX src={String.raw`\mathbb{Z}_2`} />, i.e. the image of <TeX src={String.raw`G`} /> in <TeX src={String.raw`S_8\times S_{12}`} /> lands in the index-2 subgroup of jointly-even permutations.
          </>}
        />
      </div>

      {/* ── Panel 1: Derived series stepper ── */}
      <DerivedSeriesPanel lang={lang} />

      {/* ── Panel 2: Sylow decomposition / nilpotency tester ── */}
      <SylowNilpotencyPanel lang={lang} />

      {/* ── Panel 3: Galois / S_n solvability timeline ── */}
      <GaloisTimelinePanel lang={lang} />

      {/* ── References ── */}
      <div className="gt-refs" style={{ marginTop: 40 }}>
        <div className="gt-def-title" style={{ marginBottom: 10 }}>
          <L zh="参考文献" en="References" />
        </div>
        <ol>
          <li>Dummit &amp; Foote, <em>Abstract Algebra</em>, 3rd ed., §3.4, §4.6, §6.1, §14.7–14.8.</li>
          <li>Keith Conrad, <em>Subgroup Series II</em> — derived series, lower/upper central series, worked S₄ example. <a href="https://kconrad.math.uconn.edu/blurbs/grouptheory/subgpseries2.pdf" target="_blank" rel="noopener noreferrer">kconrad.math.uconn.edu</a></li>
          <li>Wikipedia, &ldquo;<a href="https://en.wikipedia.org/wiki/Rubik%27s_Cube_group" target="_blank" rel="noopener noreferrer">Rubik&apos;s Cube group</a>&rdquo; — structure, order <TeX src={String.raw`2^{27}\cdot3^{14}\cdot5^3\cdot7^2\cdot11`} />, and composition factors <TeX src={String.raw`A_8,A_{12},\mathbb{Z}_3^7,\mathbb{Z}_2^{12}`} />.</li>
          <li>David Joyner, <em>Adventures in Group Theory</em>, 2nd ed. (Johns Hopkins UP, 2008).</li>
        </ol>
      </div>
    </GTSec>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Panel 1: Derived series stepper
// ═════════════════════════════════════════════════════════════════════════════

function DerivedSeriesPanel({ lang }: { lang: Lang }) {
  const [groupId, setGroupId] = useState<GroupId>('S4');
  const [step, setStep] = useState(0);           // how many terms revealed (0 = only G^(0))
  const [showLC, setShowLC] = useState(false);    // toggle lower central series

  const data = GROUP_DATA[groupId];

  const maxDerivedStep = data.derivedSeries.length - 1;

  const handleGroupChange = useCallback((id: GroupId) => {
    setGroupId(id);
    setStep(0);
    setShowLC(false);
  }, []);

  const revealedDerived = data.derivedSeries.slice(0, step + 1);
  const revealedLC = showLC ? data.lowerCentral.slice(0, step + 1) : [];

  // Determine if we've stabilized (A5 case: last two terms identical in order)
  const lastTerm = revealedDerived[revealedDerived.length - 1];
  const stabilized = !data.solvable && lastTerm.order > 1 && step >= 1;
  const atEnd = step >= maxDerivedStep;

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="导出列逐步展开" en="Derived series stepper" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="选择一个群，逐步展开其导出列（可选同时显示下中心列），观察它是否到达平凡群。"
          en="Choose a group, reveal its derived series step by step (optionally with the lower central series), and see whether it reaches the trivial group."
        />
      </div>

      {/* Group selector chips */}
      <div className="gt-panel-input-row">
        <label style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-dim)' }}>
          <L zh="群" en="Group" />
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {GROUP_IDS.map(id => (
            <button
              key={id}
              className={`gt-chip${groupId === id ? ' gt-chip-active' : ''}`}
              onClick={() => handleGroupChange(id)}
            >
              {lang === 'zh' ? GROUP_DATA[id].labelZh : GROUP_DATA[id].labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* Toggle lower central series */}
      <div className="gt-panel-input-row">
        <button
          className={`gt-chip${showLC ? ' gt-chip-active' : ''}`}
          onClick={() => setShowLC(s => !s)}
        >
          <L zh="同时显示下中心列 γᵢ" en="Show lower central series γᵢ" />
        </button>
        {showLC && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)' }}>
            <L zh="(γᵢ₊₁ = [G, γᵢ]，非 [γᵢ, γᵢ])" en="(γᵢ₊₁ = [G, γᵢ], not [γᵢ, γᵢ])" />
          </span>
        )}
      </div>

      {/* Buttons */}
      <div className="gt-panel-input-row">
        <button
          className="gt-btn"
          disabled={atEnd}
          onClick={() => setStep(s => Math.min(s + 1, maxDerivedStep))}
        >
          <L zh="下一步 →" en="Next step →" />
        </button>
        <button
          className="gt-btn-ghost gt-btn"
          onClick={() => setStep(maxDerivedStep)}
          disabled={atEnd}
        >
          <L zh="显示全部" en="Show all" />
        </button>
        <button
          className="gt-btn-ghost gt-btn"
          onClick={() => setStep(0)}
          disabled={step === 0}
        >
          <L zh="重置" en="Reset" />
        </button>
      </div>

      {/* SVG diagram */}
      <DerivedSeriesSVG
        derivedTerms={revealedDerived}
        lcTerms={revealedLC}
        stabilized={stabilized}
        showLC={showLC}
        lang={lang}
      />

      {/* Verdict badges */}
      <div className="gt-panel-result">
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="可解群？" en="Solvable?" />
          </span>
          <span className="gt-result-val-strong" style={{ color: data.solvable ? 'var(--green)' : 'var(--warn)' }}>
            {data.solvable
              ? (lang === 'zh' ? `是 (导出长度 ${data.derivedLength})` : `Yes (derived length ${data.derivedLength})`)
              : tr({ zh: '否 (导出列稳定在非平凡处)', en: 'No (series stabilizes above {e})'
                                      })}
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="幂零群？" en="Nilpotent?" />
          </span>
          <span className="gt-result-val-strong" style={{ color: data.nilpotent ? 'var(--green)' : 'var(--warn)' }}>
            {data.nilpotent
              ? (lang === 'zh' ? `是 (幂零类 ${data.nilpClass})` : `Yes (nilpotency class ${data.nilpClass})`)
              : tr({ zh: '否', en: 'No' })}
          </span>
        </div>
        {!data.nilpotent && (
          <div className="gt-result-row">
            <span className="gt-result-label">
              <L zh="不幂零原因" en="Why not nilpotent" />
            </span>
            <span className="gt-result-val" style={{ fontSize: 12 }}>
              {lang === 'zh' ? data.notNilpotentReasonZh : data.notNilpotentReasonEn}
            </span>
          </div>
        )}
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="群阶" en="Order" />
          </span>
          <span className="gt-result-val">|{groupId}| = {data.order}</span>
        </div>
      </div>
    </div>
  );
}

function DerivedSeriesSVG({
  derivedTerms,
  lcTerms,
  stabilized,
  showLC,
  lang,
}: {
  derivedTerms: SeriesTerm[];
  lcTerms: SeriesTerm[];
  stabilized: boolean;
  showLC: boolean;
  lang: Lang;
}) {
  const nodeH = 56;
  const nodeW = 160;
  const arrowGap = 36;
  const colGap = 80;
  const leftX = showLC ? 40 : (360 - nodeW) / 2;
  const rightX = showLC ? leftX + nodeW + colGap : leftX;

  const n = derivedTerms.length;
  const lcN = lcTerms.length;
  const rows = Math.max(n, showLC ? lcN : 0);

  const H_SVG = rows * (nodeH + arrowGap) + 20;
  const W_SVG = showLC ? nodeW * 2 + colGap + 80 : nodeW + 80;

  const nodeY = (i: number) => 10 + i * (nodeH + arrowGap);

  return (
    <svg viewBox={`0 0 ${W_SVG} ${H_SVG}`} width="100%" style={{ display: 'block', margin: '16px 0', overflow: 'visible', maxWidth: W_SVG }}>
      <defs>
        <marker id="snArrow" markerWidth={8} markerHeight={8} refX={4} refY={4} orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="var(--ink-dim)" />
        </marker>
        <marker id="snArrowRed" markerWidth={8} markerHeight={8} refX={4} refY={4} orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="var(--warn)" />
        </marker>
        <marker id="snArrowGreen" markerWidth={8} markerHeight={8} refX={4} refY={4} orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="var(--green)" />
        </marker>
        <marker id="snArrowLC" markerWidth={8} markerHeight={8} refX={4} refY={4} orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="var(--accent-2)" />
        </marker>
      </defs>

      {/* Derived series column header */}
      {showLC && (
        <>
          <text x={leftX + nodeW / 2} y={6} textAnchor="middle"
            style={{ fontFamily: 'var(--mono)', fontSize: 10 }} fill="var(--accent)">
            {tr({ zh: '导出列 G^(i)', en: 'Derived series G^(i)'
            })}
          </text>
          <text x={rightX + nodeW / 2} y={6} textAnchor="middle"
            style={{ fontFamily: 'var(--mono)', fontSize: 10 }} fill="var(--accent-2)">
            {tr({ zh: '下中心列 γᵢ', en: 'Lower central γᵢ' })}
          </text>
        </>
      )}

      {/* Derived series nodes + arrows */}
      {derivedTerms.map((term, i) => {
        const y = nodeY(i);
        const isLast = i === derivedTerms.length - 1;
        const isTrivial = term.order === 1;
        const isStabilized = stabilized && isLast;

        const nodeColor = isTrivial
          ? 'color-mix(in srgb, var(--green) 18%, var(--bg-elev))'
          : isStabilized
          ? 'color-mix(in srgb, var(--warn) 14%, var(--bg-elev))'
          : 'var(--bg-elev)';
        const nodeStroke = isTrivial ? 'var(--green)' : isStabilized ? 'var(--warn)' : 'var(--rule)';
        const textColor = isTrivial ? 'var(--green)' : isStabilized ? 'var(--warn)' : 'var(--ink)';

        return (
          <g key={`d${i}`}>
            <rect x={leftX} y={y} width={nodeW} height={nodeH} rx={6}
              fill={nodeColor} stroke={nodeStroke} strokeWidth={isTrivial || isStabilized ? 2 : 1} />
            {/* Superscript label */}
            <text x={leftX + 10} y={y + 16} style={{ fontFamily: 'var(--mono)', fontSize: 10 }} fill="var(--ink-faint)">
              G^({i})
            </text>
            {/* Group name */}
            <text x={leftX + nodeW / 2} y={y + 33} textAnchor="middle"
              style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600 }} fill={textColor}>
              {term.name}
            </text>
            {/* Order */}
            <text x={leftX + nodeW - 8} y={y + nodeH - 8} textAnchor="end"
              style={{ fontFamily: 'var(--mono)', fontSize: 10 }} fill="var(--ink-faint)">
              |·|={term.order}
            </text>

            {/* Arrow down or self-loop for stabilized */}
            {!isLast && (
              <line
                x1={leftX + nodeW / 2} y1={y + nodeH}
                x2={leftX + nodeW / 2} y2={y + nodeH + arrowGap - 8}
                stroke="var(--ink-dim)" strokeWidth={1.5}
                markerEnd="url(#snArrow)"
              />
            )}
            {!isLast && (
              <text x={leftX + nodeW / 2 + 6} y={y + nodeH + arrowGap / 2 - 2}
                style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--ink-faint)">
                [·,·]
              </text>
            )}
            {/* Self-loop for A5 stabilization */}
            {isStabilized && (
              <g>
                <path d={`M ${leftX + nodeW - 6} ${y + nodeH / 2} Q ${leftX + nodeW + 28} ${y + nodeH / 2} ${leftX + nodeW - 6} ${y + nodeH / 2 + 20}`}
                  fill="none" stroke="var(--warn)" strokeWidth={1.5} strokeDasharray="4 2"
                  markerEnd="url(#snArrowRed)" />
                <text x={leftX + nodeW + 32} y={y + nodeH / 2 + 12}
                  style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--warn)">
                  {tr({ zh: '稳定', en: 'stable'
                })}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Lower central series nodes + arrows */}
      {showLC && lcTerms.map((term, i) => {
        const y = nodeY(i);
        const isLast = i === lcTerms.length - 1;
        const isTrivial = term.order === 1;
        // Check if stabilized in LC: same as previous term order and not trivial
        const lcStabilized = isLast && !isTrivial && i >= 1 && lcTerms[i].order === lcTerms[i - 1].order;

        const nodeColor = isTrivial
          ? 'color-mix(in srgb, var(--green) 18%, var(--bg-elev))'
          : lcStabilized
          ? 'color-mix(in srgb, var(--accent-2) 14%, var(--bg-elev))'
          : 'color-mix(in srgb, var(--accent-2) 6%, var(--bg-elev))';
        const nodeStroke = isTrivial ? 'var(--green)' : 'var(--accent-2)';
        const textColor = isTrivial ? 'var(--green)' : 'var(--accent-2)';

        return (
          <g key={`lc${i}`}>
            <rect x={rightX} y={y} width={nodeW} height={nodeH} rx={6}
              fill={nodeColor} stroke={nodeStroke} strokeWidth={1.5} />
            <text x={rightX + 10} y={y + 16} style={{ fontFamily: 'var(--mono)', fontSize: 10 }} fill="var(--ink-faint)">
              γ{i + 1}
            </text>
            <text x={rightX + nodeW / 2} y={y + 33} textAnchor="middle"
              style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600 }} fill={textColor}>
              {term.name}
            </text>
            <text x={rightX + nodeW - 8} y={y + nodeH - 8} textAnchor="end"
              style={{ fontFamily: 'var(--mono)', fontSize: 10 }} fill="var(--ink-faint)">
              |·|={term.order}
            </text>

            {!isLast && (
              <line
                x1={rightX + nodeW / 2} y1={y + nodeH}
                x2={rightX + nodeW / 2} y2={y + nodeH + arrowGap - 8}
                stroke="var(--accent-2)" strokeWidth={1.5}
                markerEnd="url(#snArrowLC)"
              />
            )}
            {!isLast && (
              <text x={rightX + nodeW / 2 + 6} y={y + nodeH + arrowGap / 2 - 2}
                style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--ink-faint)">
                [G,·]
              </text>
            )}
            {/* Stabilization loop */}
            {lcStabilized && (
              <g>
                <path d={`M ${rightX + nodeW - 6} ${y + nodeH / 2} Q ${rightX + nodeW + 28} ${y + nodeH / 2} ${rightX + nodeW - 6} ${y + nodeH / 2 + 20}`}
                  fill="none" stroke="var(--accent-2)" strokeWidth={1.5} strokeDasharray="4 2"
                  markerEnd="url(#snArrowLC)" />
                <text x={rightX + nodeW + 32} y={y + nodeH / 2 + 12}
                  style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--accent-2)">
                  {tr({ zh: '不幂零', en: 'not nilpotent'
                })}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Panel 2: Sylow decomposition + nilpotency tester
// ═════════════════════════════════════════════════════════════════════════════

function SylowNilpotencyPanel({ lang }: { lang: Lang }) {
  const [groupId, setGroupId] = useState<GroupId>('D4');
  const [showWhy, setShowWhy] = useState(false);

  const data = GROUP_DATA[groupId];
  const sylows = SYLOW_DATA[groupId];
  const isNilp = data.nilpotent;

  // Factorize order for display bar
  const factorSegments = useMemo(() => {
    return sylows.map((s, i) => ({
      ...s,
      color: PRIME_COLORS[i % PRIME_COLORS.length],
      widthPct: (s.exp * Math.log(s.p)) / Math.log(data.order) * 100,
    }));
  }, [sylows, data.order]);

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="Sylow 子群与幂零性" en="Sylow subgroups and nilpotency" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="有限群为幂零群当且仅当每个 Sylow 子群都正规（即等价于群同构于各 Sylow 子群的直积）。"
          en="A finite group is nilpotent iff every Sylow subgroup is normal (equivalently: iff it is the direct product of its Sylow subgroups)."
        />
      </div>

      {/* Group picker */}
      <div className="gt-panel-input-row">
        <label style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-dim)' }}>
          <L zh="群" en="Group" />
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {GROUP_IDS.map(id => (
            <button
              key={id}
              className={`gt-chip${groupId === id ? ' gt-chip-active' : ''}`}
              onClick={() => { setGroupId(id); setShowWhy(false); }}
            >
              {id}
            </button>
          ))}
        </div>
      </div>

      {/* Show why toggle */}
      <div className="gt-panel-input-row">
        <button className={`gt-chip${showWhy ? ' gt-chip-active' : ''}`} onClick={() => setShowWhy(s => !s)}>
          <L zh="展开 Sylow 分析" en="Expand Sylow analysis" />
        </button>
      </div>

      {/* Prime factorization bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', marginBottom: 6 }}>
          <L zh={`|${groupId}| = ${data.order}`} en={`|${groupId}| = ${data.order}`} />
          {' = '}
          {sylows.map((s, i) => (
            <span key={i}>
              {i > 0 ? ' · ' : ''}
              {s.p}<sup>{s.exp}</sup>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', height: 24, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--rule)' }}>
          {factorSegments.map((seg, i) => (
            <div key={i} style={{
              flex: seg.widthPct,
              background: seg.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--mono)', fontSize: 10, color: 'white', overflow: 'hidden',
              minWidth: 20,
            }}>
              {seg.p}<sup style={{ fontSize: 7 }}>{seg.exp}</sup>
            </div>
          ))}
        </div>
      </div>

      {/* Sylow cards SVG */}
      <SylowCardsSVG
        sylows={sylows}
        groupId={groupId}
        showWhy={showWhy}
        lang={lang}
      />

      {/* Nilpotency verdict */}
      <div style={{
        marginTop: 16,
        padding: '12px 16px',
        borderRadius: 6,
        background: isNilp
          ? 'color-mix(in srgb, var(--green) 12%, var(--bg-elev))'
          : 'color-mix(in srgb, var(--warn) 12%, var(--bg-elev))',
        border: `1px solid ${isNilp ? 'color-mix(in srgb, var(--green) 40%, var(--bg-elev))' : 'color-mix(in srgb, var(--warn) 40%, var(--bg-elev))'}`,
        fontFamily: 'var(--mono)',
        fontSize: 13,
        color: isNilp ? 'var(--green)' : 'var(--warn)',
      }}>
        {isNilp
          ? (lang === 'zh'
            ? `${groupId} 幂零 — 所有 Sylow 子群均正规 => G = 各 Sylow 子群的直积`
            : `${groupId} is nilpotent — all Sylow subgroups are normal => G = direct product of its Sylows`)
          : (lang === 'zh'
            ? `${groupId} 不幂零 — 存在不正规的 Sylow-p 子群`
            : `${groupId} is not nilpotent — at least one Sylow-p subgroup is not normal`)}
      </div>
    </div>
  );
}

function SylowCardsSVG({
  sylows, groupId: _groupId, showWhy, lang,
}: {
  sylows: SylowPrime[];
  groupId: GroupId;
  showWhy: boolean;
  lang: Lang;
}) {
  const cardW = 160, cardH = showWhy ? 100 : 70, gap = 16;
  const n = sylows.length;
  const W = n * cardW + (n - 1) * gap + 8;
  const H = cardH + 8;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', margin: '8px 0', overflow: 'visible', maxWidth: W }}>
      {sylows.map((s, i) => {
        const x = 4 + i * (cardW + gap);
        const color = PRIME_COLORS[i % PRIME_COLORS.length];
        const normalColor = s.normal ? 'var(--green)' : 'var(--warn)';
        return (
          <g key={i}>
            <rect x={x} y={4} width={cardW} height={cardH} rx={6}
              fill="var(--bg-elev)" stroke={s.normal ? 'color-mix(in srgb, var(--green) 50%, var(--rule))' : 'color-mix(in srgb, var(--warn) 50%, var(--rule))'}
              strokeWidth={1.5} />
            {/* Prime header */}
            <rect x={x} y={4} width={cardW} height={22} rx={0}
              fill={color} style={{ clipPath: `inset(0 0 ${cardH - 22}px 0 round 6px 6px 0 0)` }} />
            <text x={x + cardW / 2} y={19} textAnchor="middle"
              style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700 }} fill="white">
              Sylow-{s.p} (order {s.sylowOrder})
            </text>

            {/* Count n_p */}
            <text x={x + 10} y={42} style={{ fontFamily: 'var(--mono)', fontSize: 11 }} fill="var(--ink)">
              n_{s.p} = {s.nP}
            </text>

            {/* Normal badge */}
            <text x={x + 10} y={58} style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600 }} fill={normalColor}>
              {s.normal
                ? tr({ zh: '正规 ✓', en: 'normal ✓'
                                        })
                : tr({ zh: '不正规 ✗', en: 'not normal ✗'
                                        })}
            </text>

            {showWhy && (
              <text x={x + 10} y={74} style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--ink-faint)">
                {s.normal
                  ? tr({ zh: `n_p=1 => 正规`, en: `n_p=1 => unique => normal`
                                            })
                  : (lang === 'zh' ? `n_p=${s.nP}>1 => 不正规` : `n_p=${s.nP}>1 => not unique => non-normal`)}
              </text>
            )}
            {showWhy && (
              <text x={x + 10} y={88} style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--ink-faint)">
                p^e = {s.p}^{s.exp} = {s.sylowOrder}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Panel 3: Galois / S_n solvability timeline
// ═════════════════════════════════════════════════════════════════════════════

const SN_DEGREES = [2, 3, 4, 5, 6] as const;
type Degree = typeof SN_DEGREES[number];

const SN_INFO: Record<Degree, {
  order: number;
  solvable: boolean;
  derivedLength: number | null;
  formulaEn: string;
  formulaZh: string;
  derivedChainEn: string;
  derivedChainZh: string;
}> = {
  2: {
    order: 2,
    solvable: true,
    derivedLength: 1,
    formulaEn: 'Quadratic formula: x = (−b ± √(b²−4ac)) / 2a',
    formulaZh: '二次公式: x = (−b ± √(b²−4ac)) / 2a',
    derivedChainEn: 'S₂ → {e} (abelian, derived length 1)',
    derivedChainZh: 'S₂ → {e}（交换群，导出长度 1）'
},
  3: {
    order: 6,
    solvable: true,
    derivedLength: 2,
    formulaEn: 'Cubic formula exists (Cardano, 1545)',
    formulaZh: '三次根式公式存在（Cardano，1545）',
    derivedChainEn: 'S₃ → A₃ → {e} (derived length 2)',
    derivedChainZh: 'S₃ → A₃ → {e}（导出长度 2）'
},
  4: {
    order: 24,
    solvable: true,
    derivedLength: 3,
    formulaEn: 'Quartic formula exists (Ferrari, 1545)',
    formulaZh: '四次根式公式存在（Ferrari，1545）',
    derivedChainEn: 'S₄ → A₄ → V₄ → {e} (derived length 3)',
    derivedChainZh: 'S₄ → A₄ → V₄ → {e}（导出长度 3）'
},
  5: {
    order: 120,
    solvable: false,
    derivedLength: null,
    formulaEn: 'No general radical formula (Abel-Ruffini, ~1824)',
    formulaZh: '不存在通用根式公式（Abel-Ruffini，约 1824）',
    derivedChainEn: 'S₅ → A₅ → A₅ → ··· (stabilizes; A₅ simple nonabelian)',
    derivedChainZh: 'S₅ → A₅ → A₅ → ···（稳定；A₅ 为非交换单群）'
},
  6: {
    order: 720,
    solvable: false,
    derivedLength: null,
    formulaEn: 'No general radical formula (A₆ simple nonabelian)',
    formulaZh: '不存在通用根式公式（A₆ 为非交换单群）',
    derivedChainEn: 'S₆ → A₆ → A₆ → ··· (stabilizes)',
    derivedChainZh: 'S₆ → A₆ → A₆ → ···（稳定）'
},
};

function GaloisTimelinePanel({ lang }: { lang: Lang }) {
  const [selectedDeg, setSelectedDeg] = useState<Degree>(4);
  const info = SN_INFO[selectedDeg];

  // SVG track dimensions
  const trackW = 340, trackH = 60;
  const nodeR = 18;
  const spacing = trackW / (SN_DEGREES.length - 1);

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="Galois 根式可解时间线" en="Galois radical-solvability timeline" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="n 次一般多项式的 Galois 群是 Sₙ。Sₙ 可解当且仅当 n ≤ 4，因此仅低次方程有根式公式。"
          en="The general degree-n polynomial has Galois group Sₙ. Since Sₙ is solvable iff n ≤ 4, radical formulas exist only for low degrees."
        />
      </div>

      {/* Degree selector chips */}
      <div className="gt-panel-input-row">
        <label style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-dim)' }}>
          <L zh="次数 n" en="Degree n" />
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {SN_DEGREES.map(d => (
            <button
              key={d}
              className={`gt-chip${selectedDeg === d ? ' gt-chip-active' : ''}`}
              onClick={() => setSelectedDeg(d)}
            >
              n = {d}
            </button>
          ))}
        </div>
      </div>

      {/* SVG timeline */}
      <svg viewBox={`0 0 ${trackW + 20} ${trackH}`} width="100%" style={{ display: 'block', margin: '12px 0', maxWidth: trackW + 20 }}>
        {/* Track line */}
        <line x1={10 + nodeR} y1={trackH / 2} x2={10 + trackW - nodeR} y2={trackH / 2}
          stroke="var(--rule)" strokeWidth={2} />
        {/* Divider at n=4/5 boundary */}
        <line x1={10 + 3 * spacing} y1={trackH / 2 - 24} x2={10 + 3 * spacing} y2={trackH / 2 + 24}
          stroke="var(--gold)" strokeWidth={1.5} strokeDasharray="4 3" />
        <text x={10 + 3 * spacing + 4} y={14}
          style={{ fontFamily: 'var(--mono)', fontSize: 8 }} fill="var(--gold)">
          {tr({ zh: 'n=5 断崖', en: 'n=5 wall'
        })}
        </text>

        {SN_DEGREES.map((d, i) => {
          const cx = 10 + i * spacing;
          const cy = trackH / 2;
          const isSel = d === selectedDeg;
          const solv = SN_INFO[d].solvable;
          const fillColor = isSel
            ? (solv ? 'var(--green)' : 'var(--warn)')
            : (solv
              ? 'color-mix(in srgb, var(--green) 25%, var(--bg-elev))'
              : 'color-mix(in srgb, var(--warn) 25%, var(--bg-elev))');
          const strokeColor = solv ? 'var(--green)' : 'var(--warn)';

          return (
            <g key={d} style={{ cursor: 'pointer' }} onClick={() => setSelectedDeg(d)}>
              <circle cx={cx} cy={cy} r={nodeR}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={isSel ? 3 : 1.5}
              />
              <text x={cx} y={cy + 4} textAnchor="middle"
                style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, pointerEvents: 'none' }}
                fill={isSel ? 'white' : strokeColor}>
                {d}
              </text>
              <text x={cx} y={cy + nodeR + 12} textAnchor="middle"
                style={{ fontFamily: 'var(--mono)', fontSize: 8 }} fill="var(--ink-faint)">
                {SN_INFO[d].order}!
              </text>
            </g>
          );
        })}

        {/* Labels */}
        <text x={10 + 0.5 * spacing} y={trackH - 2} textAnchor="middle"
          style={{ fontFamily: 'var(--mono)', fontSize: 8 }} fill="var(--green)">
          {tr({ zh: '可解', en: 'solvable' })}
        </text>
        <text x={10 + 3.5 * spacing} y={trackH - 2} textAnchor="middle"
          style={{ fontFamily: 'var(--mono)', fontSize: 8 }} fill="var(--warn)">
          {tr({ zh: '不可解', en: 'unsolvable' })}
        </text>
      </svg>

      {/* Detail card for selected degree */}
      <div style={{
        background: 'var(--bg-elev)',
        border: `1px solid ${info.solvable ? 'color-mix(in srgb, var(--green) 40%, var(--rule))' : 'color-mix(in srgb, var(--warn) 40%, var(--rule))'}`,
        borderRadius: 6, padding: '14px 18px',
      }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: info.solvable ? 'var(--green)' : 'var(--warn)', marginBottom: 8, fontWeight: 600 }}>
          S{selectedDeg}  &nbsp;|&nbsp;
          {lang === 'zh' ? `阶 ${info.order}` : `order ${info.order}`}  &nbsp;|&nbsp;
          {info.solvable
            ? (lang === 'zh' ? `可解，导出长度 ${info.derivedLength}` : `solvable, derived length ${info.derivedLength}`)
            : tr({ zh: '不可解', en: 'unsolvable' })}
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-dim)', marginBottom: 6 }}>
          {lang === 'zh' ? info.derivedChainZh : info.derivedChainEn}
        </div>
        <div style={{
          fontFamily: 'var(--serif)', fontSize: 14, color: info.solvable ? 'var(--ink)' : 'var(--warn)',
          fontStyle: 'italic',
        }}>
          {lang === 'zh' ? info.formulaZh : info.formulaEn}
        </div>
      </div>

      {/* Cube connection note */}
      <div className="gt-panel-result">
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="魔方群可解性" en="Cube group solvability" />
          </span>
          <span className="gt-result-val" style={{ color: 'var(--warn)', fontSize: 12 }}>
            <L
              zh="不可解 — 组合因子含 A₈, A₁₂（非交换单群），非仅因为群很大"
              en="Not solvable — composition factors include A₈, A₁₂ (non-abelian simple); not merely because the group is large"
            />
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="对比" en="Contrast" />
          </span>
          <span className="gt-result-val" style={{ fontSize: 12 }}>
            <L
              zh="D₄, Q₈（阶 8，非交换）幂零 — 组合因子全为 ℤ₂"
              en="D₄, Q₈ (order 8, non-abelian) are nilpotent — all composition factors are ℤ₂"
            />
          </span>
        </div>
      </div>
    </div>
  );
}
