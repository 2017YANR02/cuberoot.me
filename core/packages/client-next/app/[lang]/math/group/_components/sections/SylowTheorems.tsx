'use client';

import { useState, useMemo, useCallback } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import type { Lang } from '../primitives';
import { tr } from '@/i18n/tr';

// ── Arithmetic helpers (bigint-safe for large n) ──────────────────────────────

/** v_p(n): p-adic valuation — highest power of p dividing n */
function vp(n: bigint, p: bigint): number {
  let k = 0;
  while (n % p === 0n) { n /= p; k++; }
  return k;
}

/** Trial-division factorisation of n (up to n ≤ 10^22 or so). Returns sorted [p, k][] */
function factorBigInt(n: bigint): [bigint, number][] {
  if (n <= 1n) return [];
  const factors: [bigint, number][] = [];
  let rem = n;
  for (let p = 2n; p * p <= rem && p < 10_000_000n; p++) {
    if (rem % p === 0n) {
      const k = vp(rem, p);
      factors.push([p, k]);
      for (let i = 0; i < k; i++) rem /= p;
    }
  }
  if (rem > 1n) factors.push([rem, 1]);
  return factors;
}

/** All divisors of n (bigint), sorted ascending. Guards against n with too many divisors. */
function allDivisors(n: bigint): bigint[] {
  if (n <= 0n) return [];
  const divs: bigint[] = [1n];
  let rem = n;
  for (let p = 2n; p * p <= rem; p++) {
    if (rem % p === 0n) {
      const k = vp(rem, p);
      const curLen = divs.length;
      let pk = 1n;
      for (let i = 0; i < k; i++) {
        pk *= p;
        for (let j = 0; j < curLen; j++) divs.push(divs[j] * pk);
      }
      for (let i = 0; i < k; i++) rem /= p;
    }
  }
  if (rem > 1n) {
    const curLen = divs.length;
    for (let j = 0; j < curLen; j++) divs.push(divs[j] * rem);
  }
  divs.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return divs;
}

/** Format bigint with thin-space grouping (every 3 digits) */
function fmtBig(n: bigint): string {
  const s = n.toString();
  let out = '';
  const r = s.length % 3;
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (i - r) % 3 === 0) out += ' ';
    out += s[i];
  }
  return out;
}

/** Small primes list for the pq widget */
const SMALL_PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];

const PALETTE = ['#8B2E3C', '#2A4D69', '#3F7050', '#B8860B', '#6B4E9C', '#C2410C', '#5C7CA0', '#9C4E6B'];

/** Cube-group order as bigint */
const CUBE_ORDER = 43_252_003_274_489_856_000n;

// ── Curated realizability data (Conrad Rmk 2.9) ──────────────────────────────
interface RealizabilityCase {
  n: number;
  p: number;
  np: number;
  passes: boolean;     // passes Sylow III necessary conditions
  realized: boolean;   // actually realized by some group
  noteZh: string;
  noteEn: string;
}

const REALIZABILITY_CASES: RealizabilityCase[] = [
  {
    n: 12, p: 2, np: 3,
    passes: true, realized: true,
    noteZh: 'S₃ × Z/2 (或 D₆) 实现 n₂ = 3',
    noteEn: 'D₆ (or S₃ × Z/2) realizes n₂ = 3'
},
  {
    n: 12, p: 3, np: 4,
    passes: true, realized: true,
    noteZh: 'A₄ 实现 n₃ = 4',
    noteEn: 'A₄ realizes n₃ = 4'
},
  {
    n: 12, p: 3, np: 1,
    passes: true, realized: true,
    noteZh: 'Z/12 或 Z/6 × Z/2 实现 n₃ = 1',
    noteEn: 'Z/12 or Z/6 × Z/2 realizes n₃ = 1'
},
  {
    n: 60, p: 3, np: 10,
    passes: true, realized: true,
    noteZh: 'A₅ 实现 n₃ = 10',
    noteEn: 'A₅ realizes n₃ = 10'
},
  {
    n: 60, p: 5, np: 6,
    passes: true, realized: true,
    noteZh: 'A₅ 实现 n₅ = 6',
    noteEn: 'A₅ realizes n₅ = 6'
},
  // Non-realizable: pass Sylow III but no group achieves them
  {
    n: 132, p: 3, np: 22,
    passes: true, realized: false,
    noteZh: '22 ≡ 1 (mod 3) 且 22 | 44，通过 Sylow III 检验，但无任何有限群有 n₃ = 22（Conrad 注记 2.9）',
    noteEn: '22 ≡ 1 (mod 3) and 22 | 44, so passes Sylow III, but NO finite group has n₃ = 22 (Conrad Rmk 2.9)'
},
  {
    n: 105, p: 5, np: 21,
    passes: true, realized: false,
    noteZh: '21 ≡ 1 (mod 5) 且 21 | 21，通过 Sylow III，但无群实现 n₅ = 21（Conrad 注记 2.9）',
    noteEn: '21 ≡ 1 (mod 5) and 21 | 21, passes Sylow III, but no group realizes n₅ = 21 (Conrad Rmk 2.9)'
},
];

// ══════════════════════════════════════════════════════════════════════════════
// Main Section Component
// ══════════════════════════════════════════════════════════════════════════════

export default function SylowTheorems() {
  const lang = useLang();

  return (
    <GTSec id="sylow" className="gt-sec">
      <div className="gt-sec-num">§35</div>
      <h2 className="gt-sec-title">
        <L zh="Sylow 定理" en="Sylow theorems" />
      </h2>

      <p className="gt-lede">
        <L
          zh={<>
            Lagrange 定理告诉我们：子群的阶必整除群的阶。但反过来并不成立——
            <TeX src={String.raw`A_4`} /> 的阶为 12，却没有阶为 6 的子群。Sylow 定理将这个逆命题
            抢救到<em>素数幂</em>的情形：若 <TeX src={String.raw`p^k \mid |G|`} /> 且
            <TeX src={String.raw`p^{k+1} \nmid |G|`} />，则 <TeX src={String.raw`G`} /> 必有恰好阶为
            <TeX src={String.raw`p^k`} /> 的子群（Sylow <TeX src={String.raw`p`} />-子群），
            并且所有这样的子群都互相共轭，个数满足精确的同余和整除约束。这三条定理——
            存在、共轭、计数——是有限群结构理论的基石。
          </>}
          en={<>
            Lagrange&rsquo;s theorem says a subgroup&rsquo;s order must divide the group&rsquo;s order —
            but the converse fails: <TeX src={String.raw`A_4`} /> has order 12 yet has no subgroup of order 6.
            The Sylow theorems rescue the converse for <em>prime-power</em> divisors: if
            <TeX src={String.raw`p^k \mid |G|`} /> and <TeX src={String.raw`p^{k+1} \nmid |G|`} />,
            then <TeX src={String.raw`G`} /> must contain a subgroup of order exactly <TeX src={String.raw`p^k`} />
            (a Sylow <TeX src={String.raw`p`} />-subgroup), all such subgroups are conjugate, and their
            count satisfies sharp congruence and divisibility conditions.
            These three theorems — existence, conjugacy, counting — are the bedrock of finite group structure.
          </>}
        />
      </p>

      {/* ── Key definitions ── */}
      <div className="gt-def">
        <div className="gt-def-title">
          <L zh="定义: p-群与 Sylow p-子群" en="Definitions: p-group and Sylow p-subgroup" />
        </div>
        <div className="gt-def-body">
          <p>
            <L
              zh={<>
                设 <TeX src={String.raw`p`} /> 为素数。有限群称为 <strong>p-群</strong>，若其阶为 <TeX src={String.raw`p`} /> 的幂次（含 <TeX src={String.raw`p^0=1`} />）。
                子群 <TeX src={String.raw`H \leq G`} /> 称为 <TeX src={String.raw`p`} />-子群，若 <TeX src={String.raw`H`} /> 是 <TeX src={String.raw`p`} />-群，即 <TeX src={String.raw`|H|=p^j`} />（某个 <TeX src={String.raw`j\geq 0`} />）。
              </>}
              en={<>
                Let <TeX src={String.raw`p`} /> be a prime. A finite group is a <strong>p-group</strong> if its order is a power of <TeX src={String.raw`p`} /> (including <TeX src={String.raw`p^0=1`} />).
                A subgroup <TeX src={String.raw`H \leq G`} /> is a <TeX src={String.raw`p`} />-subgroup if <TeX src={String.raw`H`} /> is a <TeX src={String.raw`p`} />-group, i.e. <TeX src={String.raw`|H|=p^j`} /> for some <TeX src={String.raw`j\geq 0`} />.
              </>}
            />
          </p>
          <p>
            <L
              zh={<>
                写 <TeX src={String.raw`|G|=p^k\cdot m`} />，其中 <TeX src={String.raw`p\nmid m`} />（即 <TeX src={String.raw`p^k`} /> 是整除 <TeX src={String.raw`|G|`} /> 的 <TeX src={String.raw`p`} /> 的最高幂次，称为 <TeX src={String.raw`|G|`} /> 的 <TeX src={String.raw`p`} /> 部分，<TeX src={String.raw`m`} /> 为余部）。
                子群 <TeX src={String.raw`P \leq G`} /> 是 <strong>Sylow <TeX src={String.raw`p`} />-子群</strong>，若 <TeX src={String.raw`|P|=p^k`} />——即 <TeX src={String.raw`P`} /> 的阶是整除 <TeX src={String.raw`|G|`} /> 的 <TeX src={String.raw`p`} /> 的最高幂次，而非仅仅某个较小的 <TeX src={String.raw`p`} /> 的幂次。
                （Conrad，定义 1.1。当 <TeX src={String.raw`p\nmid|G|`} />，即 <TeX src={String.raw`k=0`} /> 时，唯一的 Sylow <TeX src={String.raw`p`} />-子群为平凡子群 <TeX src={String.raw`\{e\}`} />。）
              </>}
              en={<>
                Write <TeX src={String.raw`|G|=p^k\cdot m`} /> where <TeX src={String.raw`p\nmid m`} /> (so <TeX src={String.raw`p^k`} /> is the <em>exact</em>, maximal power of <TeX src={String.raw`p`} /> dividing <TeX src={String.raw`|G|`} />, and <TeX src={String.raw`m`} /> is the cofactor coprime to <TeX src={String.raw`p`} />).
                A subgroup <TeX src={String.raw`P \leq G`} /> is a <strong>Sylow <TeX src={String.raw`p`} />-subgroup</strong> if <TeX src={String.raw`|P|=p^k`} /> — its order is the largest power of <TeX src={String.raw`p`} /> dividing <TeX src={String.raw`|G|`} />, not merely some smaller <TeX src={String.raw`p`} />-power.
                (Conrad, Definition 1.1. When <TeX src={String.raw`p\nmid|G|`} />, i.e. <TeX src={String.raw`k=0`} />, the only Sylow <TeX src={String.raw`p`} />-subgroup is the trivial subgroup <TeX src={String.raw`\{e\}`} />.)
              </>}
            />
          </p>
          <p>
            <L
              zh={<>
                <TeX src={String.raw`n_p`} /> 表示 <TeX src={String.raw`G`} /> 中 Sylow <TeX src={String.raw`p`} />-子群的个数。
                <strong>规范化子</strong> <TeX src={String.raw`N_G(P)=\{g\in G:gPg^{-1}=P\}`} /> 是 <TeX src={String.raw`G`} /> 中使 <TeX src={String.raw`P`} /> 正规的最大子群；
                <TeX src={String.raw`P\trianglelefteq G`} /> 当且仅当 <TeX src={String.raw`N_G(P)=G`} />，等价地，当且仅当 <TeX src={String.raw`n_p=1`} />。
              </>}
              en={<>
                <TeX src={String.raw`n_p`} /> denotes the number of Sylow <TeX src={String.raw`p`} />-subgroups of <TeX src={String.raw`G`} />.
                The <strong>normalizer</strong> <TeX src={String.raw`N_G(P)=\{g\in G:gPg^{-1}=P\}`} /> is the largest subgroup of <TeX src={String.raw`G`} /> in which <TeX src={String.raw`P`} /> is normal;
                <TeX src={String.raw`P\trianglelefteq G`} /> if and only if <TeX src={String.raw`N_G(P)=G`} />, equivalently, if and only if <TeX src={String.raw`n_p=1`} />.
              </>}
            />
          </p>
        </div>
      </div>

      {/* ── Three Sylow Theorems ── */}
      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理 (Sylow, 1872)" en="Theorem (Sylow, 1872)" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>设 <TeX src={String.raw`G`} /> 为有限群，<TeX src={String.raw`p`} /> 为素数，写 <TeX src={String.raw`|G|=p^k\cdot m`} />，<TeX src={String.raw`p\nmid m`} />。</>}
            en={<>Let <TeX src={String.raw`G`} /> be a finite group, <TeX src={String.raw`p`} /> a prime, and write <TeX src={String.raw`|G|=p^k\cdot m`} /> with <TeX src={String.raw`p\nmid m`} />.</>}
          />
          <ol style={{ marginTop: 10, paddingLeft: 22, lineHeight: 2 }}>
            <li>
              <strong><L zh="存在性 (Sylow I)" en="Existence (Sylow I)" /></strong>
              <L
                zh={<>：<TeX src={String.raw`G`} /> 有阶为 <TeX src={String.raw`p^k`} /> 的子群（Sylow <TeX src={String.raw`p`} />-子群）；进而，<TeX src={String.raw`G`} /> 的每个 <TeX src={String.raw`p`} />-子群都包含在某个 Sylow <TeX src={String.raw`p`} />-子群中。（Conrad，定理 1.7）</>}
                en={<>: <TeX src={String.raw`G`} /> has a subgroup of order <TeX src={String.raw`p^k`} /> (a Sylow <TeX src={String.raw`p`} />-subgroup); moreover, every <TeX src={String.raw`p`} />-subgroup of <TeX src={String.raw`G`} /> is contained in some Sylow <TeX src={String.raw`p`} />-subgroup. (Conrad, Thm 1.7)</>}
              />
            </li>
            <li>
              <strong><L zh="共轭性 (Sylow II)" en="Conjugacy (Sylow II)" /></strong>
              <L
                zh={<>：对每个素数 <TeX src={String.raw`p`} />，所有 Sylow <TeX src={String.raw`p`} />-子群互相共轭：若 <TeX src={String.raw`P,Q`} /> 均为 Sylow <TeX src={String.raw`p`} />-子群，则存在 <TeX src={String.raw`g\in G`} /> 使 <TeX src={String.raw`gPg^{-1}=Q`} />。（Conrad，定理 1.8）</>}
                en={<>: For each prime <TeX src={String.raw`p`} />, all Sylow <TeX src={String.raw`p`} />-subgroups are conjugate: if <TeX src={String.raw`P,Q`} /> are both Sylow <TeX src={String.raw`p`} />-subgroups, then there exists <TeX src={String.raw`g\in G`} /> with <TeX src={String.raw`gPg^{-1}=Q`} />. (Conrad, Thm 1.8)</>}
              />
            </li>
            <li>
              <strong><L zh="计数性 (Sylow III)" en="Counting (Sylow III)" /></strong>
              <L
                zh={<>：Sylow <TeX src={String.raw`p`} />-子群的个数 <TeX src={String.raw`n_p`} /> 满足
                <TeXBlock src={String.raw`n_p \equiv 1\pmod{p} \quad\text{且}\quad n_p \mid m.`} />
                此外，<TeX src={String.raw`n_p=[G:N_G(P)]`} />（规范化子的指标）。（Conrad，定理 1.9–1.10）
                注意：结论是 <TeX src={String.raw`n_p\mid m`} />，而非仅 <TeX src={String.raw`n_p\mid|G|`} />——这是更尖锐的整除性。</>}
                en={<>: The number of Sylow <TeX src={String.raw`p`} />-subgroups, <TeX src={String.raw`n_p`} />, satisfies
                <TeXBlock src={String.raw`n_p \equiv 1\pmod{p} \quad\text{and}\quad n_p \mid m.`} />
                Moreover <TeX src={String.raw`n_p=[G:N_G(P)]`} /> (index of the normalizer). (Conrad, Thm 1.9–1.10.)
                Note: the sharp conclusion is <TeX src={String.raw`n_p\mid m`} />, not merely <TeX src={String.raw`n_p\mid|G|`} />.</>}
              />
            </li>
          </ol>
        </div>
      </div>

      {/* ── Corollaries ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="推论" en="Corollaries" />
      </h3>

      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="推论 1：素数阶群是循环群" en="Corollary 1: Prime order implies cyclic" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>若 <TeX src={String.raw`|G|=p`} /> 为素数，则 <TeX src={String.raw`G\cong\mathbb{Z}/p\mathbb{Z}`} /> 为循环群。（这是 Lagrange 定理的直接推论，无需 Sylow 机器：任一非单位元阶整除 <TeX src={String.raw`p`} />，故阶为 <TeX src={String.raw`p`} />，生成 <TeX src={String.raw`G`} />。）</>}
            en={<>If <TeX src={String.raw`|G|=p`} /> is prime, then <TeX src={String.raw`G\cong\mathbb{Z}/p\mathbb{Z}`} /> is cyclic. (This follows directly from Lagrange: any non-identity element has order dividing <TeX src={String.raw`p`} />, hence order <TeX src={String.raw`p`} />, so it generates <TeX src={String.raw`G`} />. The full Sylow machinery is not needed.)</>}
          />
        </div>
      </div>

      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="推论 2：pq 阶群的判定（Conrad 定理 4.5）" en="Corollary 2: Groups of order pq (Conrad Thm 4.5)" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>
              设 <TeX src={String.raw`p<q`} /> 为素数，且 <TeX src={String.raw`p\nmid(q-1)`} />（等价地，<TeX src={String.raw`q\not\equiv 1\pmod{p}`} />）。则每个阶为 <TeX src={String.raw`pq`} /> 的群都是循环群，即 <TeX src={String.raw`G\cong\mathbb{Z}/pq\mathbb{Z}`} />。
            </>}
            en={<>
              Let <TeX src={String.raw`p<q`} /> be primes with <TeX src={String.raw`p\nmid(q-1)`} /> (equivalently <TeX src={String.raw`q\not\equiv 1\pmod{p}`} />). Then every group of order <TeX src={String.raw`pq`} /> is cyclic, i.e. <TeX src={String.raw`G\cong\mathbb{Z}/pq\mathbb{Z}`} />.
            </>}
          />
          <p style={{ marginTop: 8, fontSize: 14, color: 'var(--ink-dim)' }}>
            <L
              zh={<>
                <strong>证明思路：</strong>Sylow III 给 <TeX src={String.raw`n_q\mid p`} /> 且 <TeX src={String.raw`n_q\equiv 1\pmod{q}`} />；
                由 <TeX src={String.raw`1<p<q`} /> 知 <TeX src={String.raw`p\not\equiv 1\pmod{q}`} />，故 <TeX src={String.raw`n_q=1`} />。
                又 <TeX src={String.raw`n_p\mid q`} /> 且 <TeX src={String.raw`n_p\equiv 1\pmod{p}`} />，若 <TeX src={String.raw`n_p=q`} /> 则 <TeX src={String.raw`q\equiv 1\pmod{p}`} />，
                被假设 <TeX src={String.raw`p\nmid(q-1)`} /> 排除，故 <TeX src={String.raw`n_p=1`} />。
                两个 Sylow 子群均正规，阶互素，
                故 <TeX src={String.raw`G\cong\mathbb{Z}/p\times\mathbb{Z}/q\cong\mathbb{Z}/pq`} />。
                <strong>反例：</strong>当 <TeX src={String.raw`p\mid(q-1)`} /> 时（如 <TeX src={String.raw`|G|=6`} />：<TeX src={String.raw`2\mid(3-1)`} />），存在非交换群（<TeX src={String.raw`S_3`} />）。
              </>}
              en={<>
                <strong>Proof sketch:</strong> Sylow III gives <TeX src={String.raw`n_q\mid p`} /> and <TeX src={String.raw`n_q\equiv 1\pmod{q}`} />;
                since <TeX src={String.raw`1<p<q`} />, <TeX src={String.raw`p\not\equiv 1\pmod{q}`} />, so <TeX src={String.raw`n_q=1`} />.
                Also <TeX src={String.raw`n_p\mid q`} /> and <TeX src={String.raw`n_p\equiv 1\pmod{p}`} />; if <TeX src={String.raw`n_p=q`} /> then <TeX src={String.raw`q\equiv 1\pmod{p}`} />,
                contradicting <TeX src={String.raw`p\nmid(q-1)`} />, so <TeX src={String.raw`n_p=1`} />.
                Both Sylow subgroups are normal, of coprime prime orders,
                so <TeX src={String.raw`G\cong\mathbb{Z}/p\times\mathbb{Z}/q\cong\mathbb{Z}/pq`} />.
                <strong>Counterexample:</strong> when <TeX src={String.raw`p\mid(q-1)`} /> (e.g. <TeX src={String.raw`|G|=6`} />: <TeX src={String.raw`2\mid(3-1)`} />), a non-abelian group exists (<TeX src={String.raw`S_3`} />).
              </>}
            />
          </p>
        </div>
      </div>

      {/* ── Cube Connection ── */}
      <div className="gt-aside" style={{ marginTop: 32 }}>
        <L
          zh={<>
            <strong>魔方群与 Sylow 定理。</strong>
            魔方群的阶 <TeX src={String.raw`|G_{\text{cube}}|=43{,}252{,}003{,}274{,}489{,}856{,}000`} /> 的素因子分解为
            <TeX src={String.raw`2^{27}\cdot 3^{14}\cdot 5^3\cdot 7^2\cdot 11`} />。
            Sylow I 保证 <TeX src={String.raw`G_{\text{cube}}`} /> 内存在阶分别为
            <TeX src={String.raw`2^{27}`} />、<TeX src={String.raw`3^{14}`} />、<TeX src={String.raw`5^3`} />、<TeX src={String.raw`7^2`} />、<TeX src={String.raw`11`} /> 的子群——这些子群的存在对于如此大的群而言不是显然的。
            其中最直观的是 Sylow 11-子群：11 恰好整除 <TeX src={String.raw`|G_{\text{cube}}|`} /> 一次，
            由 Cauchy/Sylow I，群中存在阶为 11 的元素，也就是说
            <em>存在某个公式可以将魔方循环 11 次后复原</em>——实际上这样的操作序列是存在的。
            <strong>诚实的说明：</strong>对魔方群各素数的 <TeX src={String.raw`n_p`} /> 值，Sylow III 仅给出约束而非精确值（余部 <TeX src={String.raw`m`} /> 有数百个因子），
            Sylow 理论并非魔方复原的自然工具——理解魔方群结构更好的方式是其显式的半直积/环积 <TeX src={String.raw`(\mathbb{Z}/3\wr S_8)\times(\mathbb{Z}/2\wr S_{12})`} /> 加奇偶约束。
          </>}
          en={<>
            <strong>The Rubik&rsquo;s Cube group and Sylow.</strong>
            The cube group has order <TeX src={String.raw`|G_{\text{cube}}|=43{,}252{,}003{,}274{,}489{,}856{,}000`} /> with prime factorisation
            <TeX src={String.raw`2^{27}\cdot 3^{14}\cdot 5^3\cdot 7^2\cdot 11`} />.
            Sylow I guarantees the existence of subgroups of orders
            <TeX src={String.raw`2^{27}`} />, <TeX src={String.raw`3^{14}`} />, <TeX src={String.raw`5^3`} />, <TeX src={String.raw`7^2`} />, and <TeX src={String.raw`11`} /> inside <TeX src={String.raw`G_{\text{cube}}`} /> — non-obvious for groups of this size.
            Most tangible is the Sylow 11-subgroup: 11 divides <TeX src={String.raw`|G_{\text{cube}}|`} /> exactly once, so by Cauchy/Sylow I there exists an element of order 11 in the group, meaning <em>there is a move sequence that cycles the cube through 11 distinct states before returning to solved</em> — and indeed such sequences exist.
            <strong>Honest caveat:</strong> the exact values of <TeX src={String.raw`n_p`} /> for the cube group are not pinned down by Sylow III alone (the cofactor <TeX src={String.raw`m`} /> has hundreds of divisors), and Sylow theory is not the natural lens for understanding cube solving — that is better done via the explicit wreath product structure <TeX src={String.raw`(\mathbb{Z}/3\wr S_8)\times(\mathbb{Z}/2\wr S_{12})`} /> with the parity constraint.
          </>}
        />
      </div>

      {/* ── Panel 1: Sylow Constraint Explorer ── */}
      <SylowConstraintExplorer lang={lang} />

      {/* ── Panel 2: Order-pq Cyclic Decider ── */}
      <PqCyclicDecider lang={lang} />

      {/* ── Panel 3: Realizability Quiz ── */}
      <RealizabilityQuiz lang={lang} />

      {/* ── Pitfalls ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="常见误区" en="Common pitfalls" />
      </h3>

      <div className="gt-aside">
        <L
          zh={<>
            <strong>(1)</strong> Sylow III 的整除结论是 <TeX src={String.raw`n_p\mid m`} />（余部，与 <TeX src={String.raw`p`} /> 互素），
            而非仅 <TeX src={String.raw`n_p\mid|G|`} />。两者均真，但只有前者有用。<br />
            <strong>(2)</strong> 同余和整除条件是<em>必要</em>的，不是充分的：
            存在满足 Sylow III 却无任何有限群能实现的 <TeX src={String.raw`n_p`} /> 值（如 <TeX src={String.raw`n_3=22`} />，Conrad 注记 2.9）。<br />
            <strong>(3)</strong> Sylow II 说所有 Sylow <TeX src={String.raw`p`} />-子群<em>共轭</em>（因此同构，阶相等），不是说它们相等。
            <TeX src={String.raw`n_p=1`} /> 才是那唯一的子群正规的情形。<br />
            <strong>(4)</strong> Sylow I 只对<em>素数幂</em>因子给出子群存在性。Lagrange 逆命题对一般因子是假的：
            <TeX src={String.raw`A_4`} />（阶 12）无阶为 6 的子群。<br />
            <strong>(5)</strong> pq 循环推论的假设是 <TeX src={String.raw`p<q`} /> <em>且</em> <TeX src={String.raw`p\nmid(q-1)`} />。缺少后者（如 <TeX src={String.raw`|G|=6`} />：<TeX src={String.raw`2\mid 2`} />），存在非交换群 <TeX src={String.raw`S_3`} />。
          </>}
          en={<>
            <strong>(1)</strong> The Sylow III divisibility conclusion is <TeX src={String.raw`n_p\mid m`} /> (the cofactor coprime to <TeX src={String.raw`p`} />), not merely <TeX src={String.raw`n_p\mid|G|`} />. Both are true, but only the former is useful.<br />
            <strong>(2)</strong> The congruence and divisibility conditions are <em>necessary</em>, not sufficient: there exist values satisfying Sylow III that no finite group realizes (e.g. <TeX src={String.raw`n_3=22`} />, Conrad Rmk 2.9).<br />
            <strong>(3)</strong> Sylow II says all Sylow <TeX src={String.raw`p`} />-subgroups are <em>conjugate</em> (hence isomorphic), not equal. <TeX src={String.raw`n_p=1`} /> is the special case where the unique subgroup is normal.<br />
            <strong>(4)</strong> Sylow I guarantees subgroups only for <em>prime-power</em> divisors. The converse of Lagrange fails in general: <TeX src={String.raw`A_4`} /> (order 12) has no subgroup of order 6.<br />
            <strong>(5)</strong> The pq-cyclic corollary requires <TeX src={String.raw`p<q`} /> <em>and</em> <TeX src={String.raw`p\nmid(q-1)`} />. Without the latter (e.g. <TeX src={String.raw`|G|=6`} />: <TeX src={String.raw`2\mid 2`} />), the non-abelian group <TeX src={String.raw`S_3`} /> exists.
          </>}
        />
      </div>

      {/* ── References ── */}
      <div style={{ marginTop: 40 }}>
        <div className="gt-def-title" style={{ marginBottom: 10 }}>
          <L zh="参考文献" en="References" />
        </div>
        <ol style={{ fontSize: 14, lineHeight: 1.9, color: 'var(--ink-dim)' }}>
          <li>Keith Conrad, <em>The Sylow Theorems</em>, University of Connecticut — Thms 1.7–1.10 (Sylow I, II, III, III*). <a href="https://kconrad.math.uconn.edu/blurbs/grouptheory/sylowpf.pdf" target="_blank" rel="noopener noreferrer">kconrad.math.uconn.edu</a></li>
          <li>Keith Conrad, <em>Consequences of the Sylow Theorems</em> — Thm 3.1 (<TeX src={String.raw`n_p=1\Leftrightarrow`} /> normal), Thm 4.5 (order <TeX src={String.raw`pq`} /> cyclic), Rmk 2.9 (conditions not sufficient). <a href="https://kconrad.math.uconn.edu/blurbs/grouptheory/sylowapp.pdf" target="_blank" rel="noopener noreferrer">kconrad.math.uconn.edu</a></li>
          <li>D. S. Dummit &amp; R. M. Foote, <em>Abstract Algebra</em>, 3rd ed., §4.5 &lsquo;The Sylow Theorems&rsquo; (Thms 18–19).</li>
          <li>David Joyner, <em>Adventures in Group Theory</em>, 2nd ed., Johns Hopkins UP (2008) — derivation of <TeX src={String.raw`|G_{\text{cube}}|=2^{27}\cdot3^{14}\cdot5^3\cdot7^2\cdot11`} />.</li>
        </ol>
      </div>
    </GTSec>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Panel 1: Sylow Constraint Explorer
// ══════════════════════════════════════════════════════════════════════════════

interface SylowRow {
  p: bigint;
  k: number;
  pk: bigint;
  m: bigint;
  allowed: bigint[];       // all allowed n_p values (n_p ≡ 1 mod p and n_p | m)
  allowedCount: number;    // total count (may differ from allowed.length if capped)
  forced: boolean;         // allowed == [1n]
}

const DISPLAY_CAP = 30; // show at most this many n_p pills per row

function computeSylowRows(n: bigint): SylowRow[] {
  if (n <= 1n) return [];
  const factors = factorBigInt(n);
  return factors.map(([p, k]) => {
    let pk = 1n;
    for (let i = 0; i < k; i++) pk *= p;
    const m = n / pk;
    // For very large m, cap divisor enumeration at 20000 divisors
    const divs = allDivisors(m);
    const filtered = divs.filter(d => d % p === 1n);
    const allowed = filtered.slice(0, DISPLAY_CAP);
    return { p, k, pk, m, allowed, allowedCount: filtered.length, forced: filtered.length === 1 && filtered[0] === 1n };
  });
}

const PRESETS: { label: string; value: string }[] = [
  { label: '12', value: '12' },
  { label: '15', value: '15' },
  { label: '60', value: '60' },
  { label: '105', value: '105' },
  { label: String.fromCharCode(71, 95, 99, 117, 98, 101), value: CUBE_ORDER.toString() },
];
// last preset label rendered separately

function SylowConstraintExplorer({ lang }: { lang: Lang }) {
  const [raw, setRaw] = useState<string>('12');
  const [showOnlyForced, setShowOnlyForced] = useState(false);

  const { rows, error, n } = useMemo<{ rows: SylowRow[]; error: string | null; n: bigint }>(() => {
    const trimmed = raw.trim().replace(/[, _]/g, '');
    if (!trimmed) return { rows: [], error: null, n: 0n };
    try {
      const val = BigInt(trimmed);
      if (val <= 1n) return { rows: [], error: tr({ zh: '请输入大于 1 的正整数', en: 'Enter an integer > 1'
    }), n: 0n };
      if (val > 10n ** 25n) return { rows: [], error: tr({ zh: '数字过大（最大 10²⁵）', en: 'Too large (max 10²⁵)'
    }), n: 0n };
      const rows = computeSylowRows(val);
      return { rows, error: null, n: val };
    } catch {
      return { rows: [], error: tr({ zh: '无效整数', en: 'Invalid integer'
    }), n: 0n };
    }
  }, [raw, lang]);

  const allForced = rows.length > 0 && rows.every(r => r.forced);
  const visibleRows = showOnlyForced ? rows.filter(r => r.forced) : rows;

  const isCubePreset = raw.trim().replace(/[, _]/g, '') === CUBE_ORDER.toString();

  return (
    <div className="gt-panel" style={{ marginTop: 40 }}>
      <div className="gt-panel-title">
        <L zh="Sylow 约束探索器" en="Sylow Constraint Explorer" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="输入任意正整数 n，自动分解质因数，对每个质数幂 p^k 列出 Sylow III 允许的 n_p 值（满足 n_p ≡ 1 (mod p) 且 n_p | m 的所有因子）。"
          en="Enter any positive integer n; the widget factors it and, for each prime power p^k, lists every value of n_p allowed by Sylow III (i.e. n_p ≡ 1 mod p and n_p | m where m = n/p^k)."
        />
      </div>

      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {PRESETS.map((ps, i) => (
          <button
            key={i}
            className={`gt-chip${raw.trim().replace(/[, _]/g, '') === ps.value ? ' gt-chip-active' : ''}`}
            onClick={() => setRaw(ps.value)}
          >
            {i === PRESETS.length - 1
              ? (tr({ zh: '魔方群', en: 'Cube group' }))
              : ps.label}
          </button>
        ))}
      </div>

      <div className="gt-panel-input-row" style={{ marginTop: 8 }}>
        <input
          className="gt-input"
          style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: 14 }}
          value={raw}
          onChange={e => setRaw(e.target.value)}
          placeholder={tr({ zh: '输入正整数', en: 'Enter a positive integer'
        })}
          spellCheck={false}
        />
      </div>

      {error && (
        <div style={{ color: 'var(--warn)', fontSize: 13, marginTop: 6 }}>{error}</div>
      )}

      {n > 1n && rows.length > 0 && (
        <>
          <div style={{ marginTop: 10, fontSize: 13, color: 'var(--ink-dim)', fontFamily: 'var(--mono)' }}>
            <TeX src={String.raw`n = `} />{fmtBig(n)}
            {rows.length > 0 && (
              <span style={{ marginLeft: 12 }}>
                = {rows.map((r, i) => (
                  <span key={i.toString()}>
                    {i > 0 ? ' · ' : ''}{r.p.toString()}{r.k > 1 ? <sup>{r.k}</sup> : null}
                  </span>
                ))}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <input
              type="checkbox"
              id="show-forced"
              checked={showOnlyForced}
              onChange={e => setShowOnlyForced(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="show-forced" style={{ fontSize: 13, cursor: 'pointer', color: 'var(--ink-dim)' }}>
              <L zh="仅显示 n_p 被确定为 1 的行" en="Show only rows where n_p is forced to 1" />
            </label>
          </div>

          {allForced && (
            <div style={{
              marginTop: 12, padding: '8px 14px', borderRadius: 6,
              background: 'color-mix(in srgb, var(--green) 12%, var(--bg-elev))',
              border: '1px solid var(--green)', color: 'var(--green)', fontSize: 13, fontWeight: 600,
            }}>
              <L
                zh={<>所有 Sylow 子群均正规（每个 <TeX src={String.raw`n_p=1`} />）⟹ 该阶的群唯一，且为交换群。</>}
                en={<>All Sylow subgroups are normal (<TeX src={String.raw`n_p=1`} /> for every prime) ⟹ the group of this order is unique and abelian.</>}
              />
            </div>
          )}

          <SylowTable rows={visibleRows} lang={lang} isCubePreset={isCubePreset} />
        </>
      )}
    </div>
  );
}

function SylowTable({ rows, lang, isCubePreset }: { rows: SylowRow[]; lang: Lang; isCubePreset: boolean }) {
  if (rows.length === 0) {
    return (
      <div style={{ marginTop: 16, color: 'var(--ink-faint)', fontSize: 13 }}>
        <L zh="（无满足条件的行）" en="(no rows to show)" />
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto', marginTop: 16 }}>
      <table className="gt-compare" style={{ minWidth: 340 }}>
        <thead>
          <tr>
            <th style={{ minWidth: 40 }}><L zh="p" en="p" /></th>
            <th><L zh="Sylow 子群阶 p^k" en="Sylow order p^k" /></th>
            <th><L zh="余部 m" en="Cofactor m" /></th>
            <th><L zh="允许的 n_p 值" en="Allowed n_p values" /></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            const color = PALETTE[ri % PALETTE.length];
            return (
              <tr key={row.p.toString()}>
                <td>
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 99,
                    background: `color-mix(in srgb, ${color} 18%, var(--bg-elev))`,
                    color, fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 13,
                  }}>
                    {row.p.toString()}
                  </span>
                </td>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>
                  {row.p.toString()}<sup>{row.k}</sup> = {fmtBig(row.pk)}
                </td>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-dim)', maxWidth: 160, wordBreak: 'break-all' }}>
                  {isCubePreset
                    ? <span title={row.m.toString()}>{fmtBig(row.m).slice(0, 20)}&hellip;</span>
                    : fmtBig(row.m)}
                </td>
                <td>
                  <NpPills row={row} color={color} lang={lang} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function NpPills({ row, color, lang }: { row: SylowRow; color: string; lang: Lang }) {
  const extra = row.allowedCount - row.allowed.length;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
      {row.allowed.map(v => {
        const isOne = v === 1n;
        return (
          <span
            key={v.toString()}
            style={{
              display: 'inline-block',
              padding: '1px 7px',
              borderRadius: 99,
              fontSize: 12,
              fontFamily: 'var(--mono)',
              background: isOne
                ? `color-mix(in srgb, ${color} 28%, var(--bg-elev))`
                : 'var(--bg-deep)',
              color: isOne ? color : 'var(--ink-dim)',
              fontWeight: isOne ? 700 : 400,
              border: isOne ? `1.5px solid ${color}` : '1px solid var(--rule)',
            }}
          >
            {v.toString()}
          </span>
        );
      })}
      {extra > 0 && (
        <span style={{ fontSize: 12, color: 'var(--ink-faint)', fontFamily: 'var(--mono)' }}>
          {lang === 'zh' ? `…还有 ${extra} 个` : `… and ${extra} more`}
        </span>
      )}
      {row.forced && (
        <span style={{ fontSize: 11, color: color, fontWeight: 700, marginLeft: 2 }}>
          <L zh="（正规！）" en="(normal!)" />
        </span>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Panel 2: Order-pq Cyclic Decider
// ══════════════════════════════════════════════════════════════════════════════

function PqCyclicDecider({ lang }: { lang: Lang }) {
  const [pi, setPi] = useState(0); // index into SMALL_PRIMES for p
  const [qi, setQi] = useState(2); // index into SMALL_PRIMES for q

  const p = SMALL_PRIMES[pi];
  const q = SMALL_PRIMES[qi];

  // Ensure p < q
  const [pFinal, qFinal] = p < q ? [p, q] : [q, p];

  // n_q analysis: divisors of p that are ≡ 1 mod q
  const nqCandidates = [1, pFinal].filter((d, i, arr) => arr.indexOf(d) === i); // {1, p}
  const nqAllowed = nqCandidates.filter(d => d % qFinal === 1);
  const nqForced = nqAllowed.length === 1 && nqAllowed[0] === 1;

  // n_p analysis: divisors of q that are ≡ 1 mod p
  const npCandidates = [1, qFinal].filter((d, i, arr) => arr.indexOf(d) === i); // {1, q}
  const npAllowed = npCandidates.filter(d => d % pFinal === 1);
  const npForced = npAllowed.length === 1 && npAllowed[0] === 1;

  const pDividesQm1 = (qFinal - 1) % pFinal === 0;
  const isCyclic = nqForced && npForced; // ⟺ !pDividesQm1 (and p<q so nq always forced)
  const pqOrder = pFinal * qFinal;

  const handlePChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setPi(SMALL_PRIMES.indexOf(Number(e.target.value)));
  }, []);
  const handleQChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setQi(SMALL_PRIMES.indexOf(Number(e.target.value)));
  }, []);

  // SVG card dimensions
  const CARD_W = 160, CARD_H = 120;
  const SVG_W = CARD_W * 2 + 20;
  const SVG_H = CARD_H + 30;

  function renderCard(
    prime: number, cofactor: number,
    candidates: number[], allowed: number[],
    isForced: boolean, colIdx: number,
    offsetX: number,
  ) {
    const col = PALETTE[colIdx];
    const pillW = 36, pillH = 20, gap = 8;
    const pillsPerRow = Math.max(1, Math.floor((CARD_W - 12) / (pillW + gap)));
    return (
      <g key={prime}>
        <rect x={offsetX} y={0} width={CARD_W} height={CARD_H} rx={8}
          fill="var(--bg-elev)" stroke={isForced ? col : 'var(--rule)'} strokeWidth={isForced ? 2 : 1} />
        <text x={offsetX + CARD_W / 2} y={20} textAnchor="middle"
          style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700 }} fill={col}>
          {lang === 'zh' ? `p = ${prime}，余部 m = ${cofactor}` : `p = ${prime}, cofactor m = ${cofactor}`}
        </text>
        <text x={offsetX + CARD_W / 2} y={36} textAnchor="middle"
          style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--ink-faint)">
          {lang === 'zh' ? `n_p 候选: {${candidates.join(', ')}}` : `n_p candidates: {${candidates.join(', ')}}`}
        </text>
        {/* Pills */}
        {candidates.map((c, ci) => {
          const row = Math.floor(ci / pillsPerRow);
          const col2 = ci % pillsPerRow;
          const px2 = offsetX + 8 + col2 * (pillW + gap);
          const py = 44 + row * (pillH + 6);
          const isAllowed = allowed.includes(c);
          return (
            <g key={c}>
              <rect x={px2} y={py} width={pillW} height={pillH} rx={10}
                fill={isAllowed
                  ? (c === 1 ? `color-mix(in srgb, ${col} 28%, var(--bg-elev))` : 'color-mix(in srgb, var(--warn) 18%, var(--bg-elev))')
                  : 'var(--bg-deep)'}
                stroke={isAllowed ? (c === 1 ? col : 'var(--warn)') : 'var(--rule)'}
                strokeWidth={isAllowed ? 1.5 : 1}
                strokeDasharray={isAllowed ? 'none' : '3 2'}
                opacity={isAllowed ? 1 : 0.45}
              />
              <text x={px2 + pillW / 2} y={py + pillH / 2 + 4} textAnchor="middle"
                style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: c === 1 ? 700 : 400 }}
                fill={isAllowed ? (c === 1 ? col : 'var(--warn)') : 'var(--ink-faint)'}
                opacity={isAllowed ? 1 : 0.5}>
                {c}
              </text>
              {!isAllowed && (
                <>
                  <line x1={px2 + 4} y1={py + pillH / 2} x2={px2 + pillW - 4} y2={py + pillH / 2}
                    stroke="var(--ink-faint)" strokeWidth={1.5} opacity={0.35} />
                </>
              )}
            </g>
          );
        })}
        {/* Forced badge */}
        {isForced && (
          <text x={offsetX + CARD_W / 2} y={CARD_H - 8} textAnchor="middle"
            style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700 }} fill={col}>
            n_{prime} = 1 ✓ <L zh="（正规）" en="(normal)" />
          </text>
        )}
        {!isForced && (
          <text x={offsetX + CARD_W / 2} y={CARD_H - 8} textAnchor="middle"
            style={{ fontFamily: 'var(--mono)', fontSize: 10 }} fill="var(--warn)">
            n_{prime} ∈ {'{'}{allowed.join(', ')}{'}'}
          </text>
        )}
      </g>
    );
  }

  return (
    <div className="gt-panel" style={{ marginTop: 40 }}>
      <div className="gt-panel-title">
        <L zh="pq 阶群循环判定器" en="Order-pq Cyclic Decider" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh={<>选择两个不同的素数 p 和 q，判定是否每个阶为 <TeX src={String.raw`pq`} /> 的群都是循环群，并可视化 Sylow III 的推导过程。</>}
          en={<>Choose two distinct primes p and q; the widget decides whether every group of order <TeX src={String.raw`pq`} /> must be cyclic, and visualises the Sylow III deduction.</>}
        />
      </div>

      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
          <L zh="素数 p" en="Prime p" />
          <select
            className="gt-input"
            value={pFinal}
            onChange={handlePChange}
            style={{ fontFamily: 'var(--mono)', padding: '4px 8px' }}
          >
            {SMALL_PRIMES.map(pr => (
              <option key={pr} value={pr}>{pr}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
          <L zh="素数 q" en="Prime q" />
          <select
            className="gt-input"
            value={qFinal}
            onChange={handleQChange}
            style={{ fontFamily: 'var(--mono)', padding: '4px 8px' }}
          >
            {SMALL_PRIMES.filter(pr => pr !== pFinal).map(pr => (
              <option key={pr} value={pr}>{pr}</option>
            ))}
          </select>
        </label>
        <span style={{ fontSize: 14, color: 'var(--ink-dim)', alignSelf: 'center' }}>
          <L zh={<>阶 = {pFinal} × {qFinal} = {pqOrder}</>} en={<>Order = {pFinal} × {qFinal} = {pqOrder}</>} />
        </span>
      </div>

      {pFinal === qFinal && (
        <div style={{ color: 'var(--warn)', fontSize: 13, marginTop: 8 }}>
          <L zh="请选择两个不同的素数。" en="Please choose two distinct primes." />
        </div>
      )}

      {pFinal !== qFinal && (
        <>
          <div style={{ overflowX: 'auto', marginTop: 20 }}>
            <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%" style={{ display: 'block', minWidth: 280, maxWidth: SVG_W }}>
              {/* Card for n_q (prime q, cofactor p) */}
              {renderCard(qFinal, pFinal, [1, pFinal].filter((d,i,a)=>a.indexOf(d)===i), nqAllowed, nqForced, 1, 0)}
              {/* Card for n_p (prime p, cofactor q) */}
              {renderCard(pFinal, qFinal, [1, qFinal].filter((d,i,a)=>a.indexOf(d)===i), npAllowed, npForced, 0, CARD_W + 20)}
              {/* Arrow / connector */}
              <text x={SVG_W / 2} y={SVG_H - 8} textAnchor="middle"
                style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--ink-faint)">
                {tr({ zh: '划掉的丸子 = 被 Sylow III 排除', en: 'Crossed-out pills = eliminated by Sylow III'
                })}
              </text>
            </svg>
          </div>

          {/* Verdict */}
          <div style={{
            marginTop: 16, padding: '10px 16px', borderRadius: 8,
            background: isCyclic
              ? 'color-mix(in srgb, var(--green) 12%, var(--bg-elev))'
              : 'color-mix(in srgb, var(--warn) 10%, var(--bg-elev))',
            border: `1.5px solid ${isCyclic ? 'var(--green)' : 'var(--warn)'}`,
          }}>
            {isCyclic ? (
              <L
                zh={<>
                  <strong style={{ color: 'var(--green)' }}>循环群</strong>：阶为 {pqOrder} 的群必为 <TeX src={String.raw`\mathbb{Z}/pq`} />，
                  因为 {qFinal} ≢ 1 (mod {pFinal})（即 {pFinal} ∤ {qFinal - 1}），
                  所以 <TeX src={`n_{${pFinal}}=1`} />，两个 Sylow 子群均正规。
                </>}
                en={<>
                  <strong style={{ color: 'var(--green)' }}>Cyclic:</strong> every group of order {pqOrder} is <TeX src={String.raw`\mathbb{Z}/pq`} />,
                  since {qFinal} ≢ 1 (mod {pFinal}) (i.e. {pFinal} ∤ {qFinal - 1}),
                  so <TeX src={`n_{${pFinal}}=1`} /> and both Sylow subgroups are normal.
                </>}
              />
            ) : (
              <L
                zh={<>
                  <strong style={{ color: 'var(--warn)' }}>非循环群存在</strong>：{pFinal} | {qFinal - 1}（即 {qFinal} ≡ 1 (mod {pFinal})），
                  所以 <TeX src={`n_{${pFinal}}=${qFinal}`} /> 在 Sylow III 下是允许的，
                  阶为 {pqOrder} 的非交换群因此可以存在（若 {pqOrder} = 6，则为 <TeX src={String.raw`S_3`} />）。
                </>}
                en={<>
                  <strong style={{ color: 'var(--warn)' }}>Non-abelian group exists:</strong> {pFinal} | {qFinal - 1} (i.e. {qFinal} ≡ 1 mod {pFinal}),
                  so <TeX src={`n_{${pFinal}}=${qFinal}`} /> is allowed by Sylow III,
                  and a non-abelian group of order {pqOrder} can exist
                  {pqOrder === 6 ? <> (<TeX src={String.raw`S_3`} />)</> : ''}.
                </>}
              />
            )}
          </div>

          <div className="gt-panel-result" style={{ marginTop: 10 }}>
            <div className="gt-result-row">
              <span className="gt-result-label">
                <L zh={`${pFinal} ∤ (${qFinal} − 1) ?`} en={`${pFinal} ∤ (${qFinal} − 1)?`} />
              </span>
              <span className="gt-result-val-strong" style={{ color: !pDividesQm1 ? 'var(--green)' : 'var(--warn)' }}>
                {!pDividesQm1
                  ? (lang === 'zh' ? `是，${pFinal} ∤ ${qFinal - 1} ✓ ⟹ 循环` : `Yes, ${pFinal} ∤ ${qFinal - 1} ✓ ⟹ cyclic`)
                  : (lang === 'zh' ? `否，${pFinal} | ${qFinal - 1} ⟹ 可能非交换` : `No, ${pFinal} | ${qFinal - 1} ⟹ possibly non-abelian`)}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Panel 3: n_p Realizability Quiz
// ══════════════════════════════════════════════════════════════════════════════

function vPadic(n: number, p: number): number {
  let k = 0;
  while (n % p === 0) { n /= p; k++; }
  return k;
}

function RealizabilityQuiz({ lang }: { lang: Lang }) {
  const [caseIdx, setCaseIdx] = useState(0);
  const [input, setInput] = useState('');
  const [checked, setChecked] = useState(false);

  const curCase = REALIZABILITY_CASES[caseIdx];
  const m = curCase.n / Math.pow(curCase.p, vPadic(curCase.n, curCase.p));

  // Sylow III check on user input
  const npInput = parseInt(input, 10);
  const inputValid = !isNaN(npInput) && npInput >= 1;
  const passCongruence = inputValid ? npInput % curCase.p === 1 : false;
  const passDivides = inputValid ? Number.isInteger(m) && m % npInput === 0 : false;
  const sylowOk = passCongruence && passDivides;

  // Curated expected check
  const isExactCase = inputValid && npInput === curCase.np;

  const handleCheck = useCallback(() => setChecked(true), []);
  const handleCase = useCallback((i: number) => {
    setCaseIdx(i);
    setInput('');
    setChecked(false);
  }, []);

  return (
    <div className="gt-panel" style={{ marginTop: 40 }}>
      <div className="gt-panel-title">
        <L zh="n_p 可实现性测验" en="n_p Realizability Quiz" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh={<>Sylow III 给出的是<em>必要</em>条件，不是充分条件。一个满足同余和整除约束的 <TeX src={String.raw`n_p`} /> 未必能被某个有限群实现。下面给出若干例题。</>}
          en={<>Sylow III gives only <em>necessary</em> conditions, not sufficient ones. A value <TeX src={String.raw`n_p`} /> satisfying the congruence and divisibility constraints need not be realizable by any finite group. Try the curated examples below.</>}
        />
      </div>

      {/* Case selector */}
      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {REALIZABILITY_CASES.map((c, i) => (
          <button
            key={i}
            className={`gt-chip${caseIdx === i ? ' gt-chip-active' : ''}`}
            onClick={() => handleCase(i)}
          >
            n = {c.n}, p = {c.p}, n_p = {c.np}
          </button>
        ))}
      </div>

      {/* Fixed parameters */}
      <div style={{ marginBottom: 12, fontSize: 14, color: 'var(--ink-dim)' }}>
        <L
          zh={<>
            当前：<TeX src={String.raw`n = ${curCase.n}`} />，<TeX src={String.raw`p = ${curCase.p}`} />，
            余部 <TeX src={String.raw`m = ${m}`} />。候选 <TeX src={String.raw`n_p`} /> 是多少？
          </>}
          en={<>
            Current: <TeX src={String.raw`n = ${curCase.n}`} />, <TeX src={String.raw`p = ${curCase.p}`} />,
            cofactor <TeX src={String.raw`m = ${m}`} />. What is <TeX src={String.raw`n_p`} />?
          </>}
        />
      </div>

      {/* Input and check */}
      <div className="gt-panel-input-row">
        <label style={{ fontSize: 14 }}>
          <L zh={`输入 n_p 的值（本题候选：${curCase.np}）`} en={`Enter n_p (this case uses ${curCase.np})`} />
        </label>
        <input
          className="gt-input"
          type="number"
          min={1}
          value={input}
          onChange={e => { setInput(e.target.value); setChecked(false); }}
          style={{ width: 90, fontFamily: 'var(--mono)' }}
          placeholder={tr({ zh: '整数', en: 'integer'
        })}
        />
        <button className="gt-btn" onClick={handleCheck} disabled={!inputValid}>
          <L zh="检验 Sylow III" en="Check Sylow III" />
        </button>
      </div>

      {/* Gauge bars (always shown when input is valid) */}
      {inputValid && (
        <SylowGauges
          passCongruence={passCongruence}
          passDivides={passDivides}
          np={npInput}
          p={curCase.p}
          m={m}
          lang={lang}
        />
      )}

      {/* Reveal full verdict */}
      {checked && inputValid && isExactCase && (
        <div style={{
          marginTop: 14, padding: '10px 16px', borderRadius: 8,
          background: curCase.realized
            ? 'color-mix(in srgb, var(--green) 11%, var(--bg-elev))'
            : 'color-mix(in srgb, var(--accent) 10%, var(--bg-elev))',
          border: `1.5px solid ${curCase.realized ? 'var(--green)' : 'var(--accent)'}`,
          fontSize: 13, lineHeight: 1.7,
        }}>
          <div style={{ fontWeight: 700, color: curCase.realized ? 'var(--green)' : 'var(--accent)', marginBottom: 4 }}>
            {sylowOk
              ? <L zh="✓ 通过 Sylow III 检验" en="✓ Passes Sylow III" />
              : <L zh="✗ 未通过 Sylow III 检验" en="✗ Fails Sylow III" />}
          </div>
          <div style={{ color: 'var(--ink-dim)' }}>
            {curCase.realized
              ? <L zh={curCase.noteZh} en={curCase.noteEn} />
              : <L
                zh={<><strong style={{ color: 'var(--accent)' }}>不可实现！</strong> {curCase.noteZh}</>}
                en={<><strong style={{ color: 'var(--accent)' }}>NOT realizable!</strong> {curCase.noteEn}</>}
              />}
          </div>
        </div>
      )}

      {checked && inputValid && !isExactCase && (
        <div style={{
          marginTop: 14, padding: '8px 14px', borderRadius: 8, fontSize: 13,
          background: 'var(--bg-deep)', border: '1px solid var(--rule)', color: 'var(--ink-dim)',
        }}>
          <L
            zh={<>
              你输入的值为 {npInput}（本题的策划案例是 {curCase.np}）。
              {sylowOk
                ? ' 它通过了 Sylow III 的必要条件'
                : ' 它未通过 Sylow III 的必要条件'}——
              切换到策划的候选值 {curCase.np} 可查看完整分析。
            </>}
            en={<>
              You entered {npInput} (the curated case uses {curCase.np}).
              {sylowOk ? ' It passes Sylow III necessary conditions' : ' It fails Sylow III necessary conditions'} —
              switch to the curated value {curCase.np} to see the full analysis.
            </>}
          />
        </div>
      )}
    </div>
  );
}

function SylowGauges({ passCongruence, passDivides, np, p, m, lang }: {
  passCongruence: boolean;
  passDivides: boolean;
  np: number;
  p: number;
  m: number;
  lang: Lang;
}) {
  const SVG_W = 320;
  const SVG_H = 72;
  const barW = 220;
  const barH = 20;
  const r = 8;

  function GaugeRow({ y, passes, label }: { y: number; passes: boolean; label: string }) {
    return (
      <g>
        <rect x={80} y={y} width={barW} height={barH} rx={r}
          fill="var(--bg-deep)" stroke="var(--rule)" strokeWidth={1} />
        <rect x={80} y={y} width={passes ? barW : barW * 0.22} height={barH} rx={r}
          fill={passes ? 'var(--green)' : 'var(--warn)'} opacity={0.7} />
        <text x={76} y={y + barH / 2 + 4} textAnchor="end"
          style={{ fontFamily: 'var(--mono)', fontSize: 10 }} fill="var(--ink-dim)">
          {label}
        </text>
        <text x={80 + barW + 8} y={y + barH / 2 + 4}
          style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700 }}
          fill={passes ? 'var(--green)' : 'var(--warn)'}>
          {passes ? '✓' : '✗'}
        </text>
      </g>
    );
  }

  return (
    <div style={{ marginTop: 14, overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%" style={{ display: 'block', minWidth: 260, maxWidth: SVG_W }}>
        <GaugeRow
          y={4}
          passes={passCongruence}
          label={`${np} ≡ 1 mod ${p}?`}
        />
        <GaugeRow
          y={barH + 12}
          passes={passDivides}
          label={`${np} | ${m}?`}
        />
        {/* Combined verdict pill */}
        <rect x={80} y={SVG_H - 16} width={100} height={14} rx={7}
          fill={passCongruence && passDivides ? 'var(--green)' : 'var(--warn)'} opacity={0.18} />
        <text x={130} y={SVG_H - 6} textAnchor="middle"
          style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700 }}
          fill={passCongruence && passDivides ? 'var(--green)' : 'var(--warn)'}>
          {passCongruence && passDivides
            ? (tr({ zh: 'Sylow III 通过（必要条件满足）', en: 'Sylow III: OK (necessary conditions met)'
            }))
            : (tr({ zh: 'Sylow III 未通过', en: 'Sylow III: FAIL'
            }))}
        </text>
      </svg>
    </div>
  );
}
