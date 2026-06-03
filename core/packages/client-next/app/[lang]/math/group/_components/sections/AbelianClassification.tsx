'use client';

import { useState, useMemo, useCallback } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';

// ── Pure math helpers ──────────────────────────────────────────────────────

/** Compute integer partitions of n (parts non-increasing), memoised. */
function partitionsOf(n: number): number[][] {
  if (n === 0) return [[]];
  const result: number[][] = [];
  function go(remaining: number, maxPart: number, current: number[]) {
    if (remaining === 0) { result.push([...current]); return; }
    for (let k = Math.min(maxPart, remaining); k >= 1; k--) {
      current.push(k);
      go(remaining - k, k, current);
      current.pop();
    }
  }
  go(n, n, []);
  return result;
}

/** DP partition count p(n) for n = 0..N. */
function partitionCounts(N: number): number[] {
  const dp = new Array<number>(N + 1).fill(0);
  dp[0] = 1;
  for (let k = 1; k <= N; k++) for (let s = k; s <= N; s++) dp[s] += dp[s - k];
  return dp;
}

/** Factorise n into {prime: exponent}. Returns empty map for n<=1. */
function factorise(n: number): Map<number, number> {
  const res = new Map<number, number>();
  if (n <= 1) return res;
  let x = n;
  for (let p = 2; p * p <= x; p++) {
    while (x % p === 0) { res.set(p, (res.get(p) ?? 0) + 1); x = Math.floor(x / p); }
  }
  if (x > 1) res.set(x, 1);
  return res;
}

/** GCD via Euclid. */
function gcd(a: number, b: number): number { while (b) { [a, b] = [b, a % b]; } return a; }

/**
 * Given a list of prime-power factors (as {p, e} pairs), compute invariant factors.
 * Algorithm: group by prime, sort exponents ascending, right-pad to same length k,
 * column-j invariant factor = product p^(padded_e[j]).  Drop d_j = 1.
 */
function elementaryToInvariant(factors: Array<{ p: number; e: number }>): number[] {
  // Group by prime
  const byPrime = new Map<number, number[]>();
  for (const { p, e } of factors) {
    if (!byPrime.has(p)) byPrime.set(p, []);
    byPrime.get(p)!.push(e);
  }
  // Sort each prime's exponents ascending
  for (const arr of byPrime.values()) arr.sort((a, b) => a - b);
  const k = Math.max(0, ...Array.from(byPrime.values()).map((a) => a.length));
  if (k === 0) return [1]; // trivial
  // Left-pad with 0s
  const padded = new Map<number, number[]>();
  for (const [p, arr] of byPrime) {
    const pad = new Array<number>(k - arr.length).fill(0).concat(arr);
    padded.set(p, pad);
  }
  const primes = Array.from(padded.keys());
  const result: number[] = [];
  for (let j = 0; j < k; j++) {
    let dj = 1;
    for (const p of primes) dj *= Math.pow(p, padded.get(p)![j]);
    result.push(dj);
  }
  return result.filter((d) => d > 1).length > 0 ? result.filter((d) => d > 1) : [1];
}

/** From one partition (per prime), build the list of prime-power elementary divisors. */
function partitionToElementary(primeExps: Array<{ p: number; parts: number[] }>): Array<{ p: number; e: number }> {
  const out: Array<{ p: number; e: number }> = [];
  for (const { p, parts } of primeExps) for (const e of parts) out.push({ p, e });
  return out;
}

/** Render C_{n} as a string. */
function cLabel(n: number): string { return `C_${n}`; }

/** Format list of elementary divisors as a product string. */
function elementaryStr(divs: Array<{ p: number; e: number }>): string {
  if (divs.length === 0) return 'C_1';
  return divs.map(({ p, e }) => `C_{${p}${e > 1 ? `^${e}` : ''}}`).join(' \\times ');
}

/** Format invariant factors as product string. */
function invariantStr(factors: number[]): string {
  if (factors.length === 0 || (factors.length === 1 && factors[0] === 1)) return 'C_1';
  return factors.map((d) => cLabel(d)).join(' \\times ');
}

// ── Component ──────────────────────────────────────────────────────────────

export default function AbelianClassification() {
  const lang = useLang();

  // ── Panel 1: Group Enumerator ──
  const [rawN, setRawN] = useState('12');
  const [displayMode, setDisplayMode] = useState<'both' | 'elem' | 'inv'>('both');

  const enumN = useMemo(() => {
    const v = parseInt(rawN, 10);
    return Number.isFinite(v) && v >= 1 && v <= 100000 ? v : NaN;
  }, [rawN]);

  const enumResult = useMemo(() => {
    if (isNaN(enumN)) return null;
    const factMap = factorise(enumN);
    const primes = Array.from(factMap.keys()).sort((a, b) => a - b);
    if (primes.length === 0) return { groups: [{ elementary: [], invariant: [1] }], factMap, primes, count: 1 };

    // Cartesian product of partition lists per prime
    const perPrime = primes.map((p) => {
      const e = factMap.get(p)!;
      return { p, parts: partitionsOf(e) };
    });

    const groups: Array<{ elementary: Array<{ p: number; e: number }>; invariant: number[] }> = [];
    function cartesian(idx: number, chosen: Array<{ p: number; parts: number[] }>) {
      if (idx === primes.length) {
        const elementary = partitionToElementary(chosen);
        const invariant = elementaryToInvariant(elementary);
        groups.push({ elementary, invariant });
        return;
      }
      for (const parts of perPrime[idx].parts) {
        cartesian(idx + 1, [...chosen, { p: primes[idx], parts }]);
      }
    }
    cartesian(0, []);
    return { groups, factMap, primes, count: groups.length };
  }, [enumN]);

  // ── Panel 2: CRT Splitter ──
  const [crtN, setCrtN] = useState('30');
  const [crtM, setCrtM] = useState('6');
  const [crtK, setCrtK] = useState('5');

  const crtSplit = useMemo(() => {
    const n = parseInt(crtN, 10);
    if (!Number.isFinite(n) || n < 1 || n > 1000000) return null;
    const factMap = factorise(n);
    const factors = Array.from(factMap.entries()).map(([p, e]) => ({ p, pk: Math.pow(p, e) }));
    return { n, factMap, factors };
  }, [crtN]);

  const crtPairResult = useMemo(() => {
    const m = parseInt(crtM, 10);
    const k = parseInt(crtK, 10);
    if (!Number.isFinite(m) || !Number.isFinite(k) || m < 1 || k < 1) return null;
    const g = gcd(m, k);
    const cyclic = g === 1;
    return { m, k, g, cyclic, product: m * k };
  }, [crtM, crtK]);

  // ── Panel 3: Elementary <-> Invariant Converter (Cube preset) ──
  // Preset: (Z/3)^7 x (Z/2)^11 = cube orientation group
  const CUBE_PRESET: Array<{ p: number; e: number }> = [
    ...Array.from({ length: 7 }, () => ({ p: 3, e: 1 })),
    ...Array.from({ length: 11 }, () => ({ p: 2, e: 1 })),
  ];

  const [convFactors, setConvFactors] = useState<Array<{ p: number; e: number }>>(CUBE_PRESET);
  const [convInput, setConvInput] = useState('');

  const convResult = useMemo(() => {
    if (convFactors.length === 0) return { invariant: [1], order: 1 };
    const invariant = elementaryToInvariant(convFactors);
    const order = convFactors.reduce((acc, { p, e }) => acc * Math.pow(p, e), 1);
    return { invariant, order };
  }, [convFactors]);

  const addConvFactor = useCallback(() => {
    const match = convInput.trim().match(/^(\d+)\^?(\d*)$/);
    if (!match) return;
    const p = parseInt(match[1], 10);
    const e = match[2] ? parseInt(match[2], 10) : 1;
    if (!Number.isFinite(p) || p < 2 || !Number.isFinite(e) || e < 1) return;
    // Check p is prime
    let isPrime = p >= 2;
    for (let i = 2; i * i <= p; i++) { if (p % i === 0) { isPrime = false; break; } }
    if (!isPrime) return;
    setConvFactors((prev) => [...prev, { p, e }]);
    setConvInput('');
  }, [convInput]);

  const removeConvFactor = useCallback((idx: number) => {
    setConvFactors((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // ── SVG: Partition Young Diagram strip (Panel 4 inline) ──
  const partitionDP = useMemo(() => partitionCounts(20), []);

  // For the counting visualiser: show partitions of each prime's exponent
  const countingData = useMemo(() => {
    if (isNaN(enumN) || !enumResult) return null;
    const { factMap } = enumResult;
    return Array.from(factMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([p, e]) => ({
        p,
        e,
        pCount: partitionDP[e] ?? 1,
        partitions: partitionsOf(e),
      }));
  }, [enumN, enumResult, partitionDP]);

  // Color palette
  const COLORS = ['#8B2E3C', '#2A4D69', '#3F7050', '#B8860B', '#6B4E9C', '#C2410C', '#5C7CA0'];

  return (
    <GTSec id="abelian-classification" className="gt-sec">
      <div className="gt-sec-num">§38</div>
      <h2 className="gt-sec-title">
        <L zh="有限阿贝尔群基本定理" en="Finite Abelian Groups" />
      </h2>

      <p className="gt-lede">
        <L
          zh={<>任何有限阿贝尔群，都可以唯一地分解为循环群的直积——这是群论中最漂亮的分类定理之一。它告诉我们，阶为 <TeX src={String.raw`n`} /> 的阿贝尔群的个数，仅取决于 <TeX src={String.raw`n`} /> 的素数指数，与具体的素数无关。</>}
          en={<>Every finite abelian group decomposes uniquely into a direct product of cyclic groups — one of the most elegant classification theorems in algebra. The number of abelian groups of order <TeX src={String.raw`n`} /> depends only on the exponents in the prime factorization of <TeX src={String.raw`n`} />, not on which primes appear.</>}
        />
      </p>

      {/* ── Definition boxes ── */}
      <div className="gt-def">
        <div className="gt-def-title"><L zh="定义" en="Definition" /></div>
        <div className="gt-def-body">
          <p style={{ margin: '0 0 10px' }}>
            <L
              zh={<><strong>有限阿贝尔群</strong>是一个满足交换律的有限群 <TeX src={String.raw`(G,+)`} />：对所有 <TeX src={String.raw`a,b \in G`} /> 有 <TeX src={String.raw`a+b=b+a`} />。我们用加法记号，单位元记为 <TeX src={String.raw`0`} />。</>}
              en={<>A <strong>finite abelian group</strong> is a finite group <TeX src={String.raw`(G,+)`} /> satisfying <TeX src={String.raw`a+b=b+a`} /> for all <TeX src={String.raw`a,b\in G`} />. We write the operation additively and the identity as <TeX src={String.raw`0`} />.</>}
            />
          </p>
          <p style={{ margin: '0 0 10px' }}>
            <L
              zh={<><strong>循环群</strong> <TeX src={String.raw`C_n = \mathbb{Z}/n\mathbb{Z}`} /> 是阶为 <TeX src={String.raw`n`} /> 的群，由 <TeX src={String.raw`1`} /> 生成。<TeX src={String.raw`C_1`} /> 是平凡群。</>}
              en={<>The <strong>cyclic group</strong> <TeX src={String.raw`C_n = \mathbb{Z}/n\mathbb{Z}`} /> has order <TeX src={String.raw`n`} />, generated by <TeX src={String.raw`1`} />. <TeX src={String.raw`C_1`} /> is the trivial group.</>}
            />
          </p>
          <p style={{ margin: 0 }}>
            <L
              zh={<><strong>直积</strong> <TeX src={String.raw`G \times H`} /> 是集合的笛卡尔积配以分量运算：<TeX src={String.raw`(g_1,h_1)+(g_2,h_2)=(g_1+g_2,h_1+h_2)`} />，阶等于 <TeX src={String.raw`|G|\cdot|H|`} />。对阿贝尔群而言，直积与内直和一致。</>}
              en={<>The <strong>direct product</strong> <TeX src={String.raw`G \times H`} /> carries componentwise operation <TeX src={String.raw`(g_1,h_1)+(g_2,h_2)=(g_1+g_2,h_1+h_2)`} />, with order <TeX src={String.raw`|G|\cdot|H|`} />. For abelian groups this coincides with the internal direct sum.</>}
            />
          </p>
        </div>
      </div>

      {/* ── Main theorem ── */}
      <div className="gt-thm">
        <div className="gt-thm-title"><L zh="定理（有限阿贝尔群基本定理）" en="Theorem — Fundamental Theorem of Finite Abelian Groups" /></div>
        <div className="gt-thm-body">
          <p style={{ margin: '0 0 12px' }}>
            <L
              zh={<>每个有限阿贝尔群 <TeX src={String.raw`G`} /> 都同构于素幂阶循环群的直积（<strong>初等因子分解</strong>）：</>}
              en={<>Every finite abelian group <TeX src={String.raw`G`} /> is isomorphic to a direct product of cyclic groups of prime-power order (<strong>elementary-divisor form</strong>):</>}
            />
          </p>
          <TeXBlock src={String.raw`G \;\cong\; C_{p_1^{a_1}} \times C_{p_2^{a_2}} \times \cdots \times C_{p_m^{a_m}}`} />
          <p style={{ margin: '12px 0' }}>
            <L
              zh={<>素幂的多重集 <TeX src={String.raw`\{p_i^{a_i}\}`} />（<strong>初等因子</strong>）由 <TeX src={String.raw`G`} /> 唯一确定。等价地，也存在唯一的<strong>不变因子分解</strong>：</>}
              en={<>The multiset <TeX src={String.raw`\{p_i^{a_i}\}`} /> of prime powers (the <strong>elementary divisors</strong>) is uniquely determined by <TeX src={String.raw`G`} />. Equivalently there is a unique <strong>invariant-factor form</strong>:</>}
            />
          </p>
          <TeXBlock src={String.raw`G \;\cong\; C_{d_1} \times C_{d_2} \times \cdots \times C_{d_k}, \quad d_1 \mid d_2 \mid \cdots \mid d_k,\; d_i \ge 2`} />
          <p style={{ margin: '12px 0 0' }}>
            <L
              zh={<>最大的不变因子 <TeX src={String.raw`d_k`} /> 是 <TeX src={String.raw`G`} /> 的<strong>指数</strong>（所有元素阶的最小公倍数）；<TeX src={String.raw`|G| = d_1 d_2 \cdots d_k`} />。两种分解形式可以互相转化，均是 <TeX src={String.raw`G`} /> 的同构不变量。</>}
              en={<>The largest invariant factor <TeX src={String.raw`d_k`} /> is the <strong>exponent</strong> of <TeX src={String.raw`G`} /> (lcm of all element orders); <TeX src={String.raw`|G|=d_1 d_2 \cdots d_k`} />. The two forms are equivalent isomorphism invariants of <TeX src={String.raw`G`} />.</>}
            />
          </p>
        </div>
      </div>

      <p>
        <L
          zh={<>两种形式通过中国剩余定理（CRT）互转：<TeX src={String.raw`C_{mn} \cong C_m \times C_n`} /> 当且仅当 <TeX src={String.raw`\gcd(m,n)=1`} />。于是 <TeX src={String.raw`C_{12} \cong C_4 \times C_3`} />（因为 <TeX src={String.raw`\gcd(4,3)=1`} />），但 <TeX src={String.raw`C_4 \not\cong C_2 \times C_2`} />（因为 <TeX src={String.raw`\gcd(2,2)=2\ne 1`} />）——这是最常见的错误。</>}
          en={<>The two forms convert via CRT: <TeX src={String.raw`C_{mn} \cong C_m \times C_n`} /> if and only if <TeX src={String.raw`\gcd(m,n)=1`} />. So <TeX src={String.raw`C_{12} \cong C_4 \times C_3`} /> (since <TeX src={String.raw`\gcd(4,3)=1`} />), but <TeX src={String.raw`C_4 \not\cong C_2 \times C_2`} /> (since <TeX src={String.raw`\gcd(2,2)=2`} />) — the single most common error.</>}
        />
      </p>

      {/* ── Counting formula ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="计数公式" en="Counting Formula" />
      </h3>

      <p>
        <L
          zh={<>设 <TeX src={String.raw`n = \prod p^e`} />，则阶为 <TeX src={String.raw`n`} /> 的不同构阿贝尔群数 <TeX src={String.raw`a(n)`} /> 等于：</>}
          en={<>Let <TeX src={String.raw`n = \prod p^e`} />. The number <TeX src={String.raw`a(n)`} /> of isomorphism classes of abelian groups of order <TeX src={String.raw`n`} /> is:</>}
        />
      </p>
      <TeXBlock src={String.raw`a(n) = \prod_{p^e \| n} p(e)`} />
      <p>
        <L
          zh={<>其中 <TeX src={String.raw`p(e)`} /> 是整数 <TeX src={String.raw`e`} /> 的划分数（将 <TeX src={String.raw`e`} /> 写成正整数之和的方式数，不计顺序）：<TeX src={String.raw`p(0)=1,\,p(1)=1,\,p(2)=2,\,p(3)=3,\,p(4)=5,\,p(5)=7`} />……注意 <TeX src={String.raw`a(n)`} /> 只依赖于 <TeX src={String.raw`n`} /> 的<em>指数多重集</em>，与具体素数无关：<TeX src={String.raw`a(p^3)=3`} /> 对所有素数 <TeX src={String.raw`p`} /> 均成立（OEIS A000688）。</>}
          en={<>Here <TeX src={String.raw`p(e)`} /> is the integer partition function (number of ways to write <TeX src={String.raw`e`} /> as an unordered sum of positive integers): <TeX src={String.raw`p(0)=1,p(1)=1,p(2)=2,p(3)=3,p(4)=5,p(5)=7`} />… Note <TeX src={String.raw`a(n)`} /> depends only on the <em>multiset of exponents</em> of <TeX src={String.raw`n`} />, not which primes: <TeX src={String.raw`a(p^3)=3`} /> for every prime <TeX src={String.raw`p`} /> (OEIS A000688).</>}
        />
      </p>

      {/* ── PANEL 1: Group Enumerator ── */}
      <div className="gt-panel">
        <div className="gt-panel-title">
          <L zh="阿贝尔群枚举器" en="Abelian Group Enumerator" />
        </div>
        <div className="gt-panel-sub">
          <L zh="输入 n，列出所有阶为 n 的阿贝尔群（初等因子形式和不变因子形式）" en="Enter n to list all abelian groups of order n in both elementary-divisor and invariant-factor form" />
        </div>

        <div className="gt-panel-input-row">
          <label>{lang === 'zh' ? 'n =' : 'n ='}</label>
          <input
            className="gt-input"
            type="number"
            min={1}
            max={100000}
            value={rawN}
            onChange={(e) => setRawN(e.target.value)}
            style={{ maxWidth: 160 }}
          />
          <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['both', 'elem', 'inv'] as const).map((m) => (
              <button
                key={m}
                className={`gt-chip ${displayMode === m ? 'gt-chip-active' : ''}`}
                onClick={() => setDisplayMode(m)}
              >
                {m === 'both'
                  ? (lang === 'zh' ? '两种形式' : 'Both')
                  : m === 'elem'
                  ? (lang === 'zh' ? '初等因子' : 'Elem. div.')
                  : (lang === 'zh' ? '不变因子' : 'Inv. factor')}
              </button>
            ))}
          </span>
        </div>

        {isNaN(enumN) && (
          <p style={{ color: 'var(--warn)', fontFamily: 'var(--mono)', fontSize: 13, margin: '8px 0' }}>
            <L zh="请输入 1 至 100000 之间的正整数。" en="Please enter a positive integer between 1 and 100 000." />
          </p>
        )}

        {enumResult && !isNaN(enumN) && (
          <div className="gt-panel-result">
            {/* Factorisation header */}
            <div style={{ marginBottom: 12, fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-dim)' }}>
              {enumN === 1
                ? (lang === 'zh' ? 'n = 1（平凡群）' : 'n = 1 (trivial group)')
                : (
                  <>
                    <span style={{ color: 'var(--ink)' }}>{enumN}</span>
                    {' = '}
                    {Array.from(enumResult.factMap.entries())
                      .sort((a, b) => a[0] - b[0])
                      .map(([p, e], i, arr) => (
                        <span key={p}>
                          <span style={{ color: 'var(--accent)' }}>{p}</span>
                          {e > 1 && <sup>{e}</sup>}
                          {i < arr.length - 1 && ' · '}
                        </span>
                      ))}
                    {'  '}
                    <span style={{ color: 'var(--ink-faint)' }}>
                      {'a('}
                      {enumN}
                      {') = '}
                      {Array.from(enumResult.factMap.entries())
                        .sort((a, b) => a[0] - b[0])
                        .map(([, e], i, arr) => (
                          <span key={i}>
                            p({e})={partitionDP[e] ?? 1}{i < arr.length - 1 ? ' × ' : ''}
                          </span>
                        ))}
                      {' = '}
                      <strong style={{ color: 'var(--accent-2)' }}>{enumResult.count}</strong>
                    </span>
                  </>
                )}
            </div>

            {/* Group list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {enumResult.groups.map((g, idx) => (
                <GroupRow
                  key={idx}
                  index={idx + 1}
                  elementary={g.elementary}
                  invariant={g.invariant}
                  displayMode={displayMode}
                  lang={lang}
                  n={enumN}
                />
              ))}
            </div>

            {/* Counting-by-partitions visualizer (Young diagrams) */}
            {countingData && countingData.length > 0 && enumN > 1 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 10 }}>
                  <L zh="各素数的划分杨图" en="Young diagrams for each prime's partitions" />
                </div>
                {countingData.map(({ p, e, partitions }, pi) => (
                  <div key={p} style={{ marginBottom: 14 }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: COLORS[pi % COLORS.length], marginBottom: 6 }}>
                      p = {p}, e = {e}, p({e}) = {partitions.length}
                    </div>
                    <YoungDiagramRow partitions={partitions} color={COLORS[pi % COLORS.length]} />
                  </div>
                ))}
                {countingData.length > 1 && (
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-dim)', marginTop: 8 }}>
                    {countingData.map(({ pCount }, i) => (
                      <span key={i}>{i > 0 ? ' × ' : ''}{pCount}</span>
                    ))}
                    {' = '}
                    <strong style={{ color: 'var(--accent)' }}>{enumResult.count}</strong>
                    <span style={{ color: 'var(--ink-faint)', fontSize: 11 }}>{' '}<L zh="个不同构阿贝尔群" en="non-isomorphic abelian groups" /></span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── CRT pitfall callout ── */}
      <div className="gt-aside">
        <L
          zh={<><strong>常见错误：</strong><TeX src={String.raw`C_4 \not\cong C_2 \times C_2`} />。CRT 只在 <TeX src={String.raw`\gcd(m,n)=1`} /> 时才能拆分 <TeX src={String.raw`C_{mn}`} />。"6" 是不变因子，不是初等因子（初等因子必须是素幂）。</>}
          en={<><strong>Pitfall:</strong> <TeX src={String.raw`C_4 \not\cong C_2 \times C_2`} />. CRT splits <TeX src={String.raw`C_{mn}`} /> only when <TeX src={String.raw`\gcd(m,n)=1`} />. "6" is an invariant factor, never an elementary divisor (those must be prime powers).</>}
        />
      </div>

      {/* ── PANEL 2: CRT Splitter ── */}
      <div className="gt-panel">
        <div className="gt-panel-title">
          <L zh="CRT 分解与互素检验" en="CRT Splitter and Coprimality Test" />
        </div>
        <div className="gt-panel-sub">
          <L
            zh="将 C_n 拆成互素循环因子，并检验 C_m × C_k 是否等于 C_{mk}"
            en="Split C_n into coprime prime-power cyclic factors; test whether C_m × C_k = C_{mk}"
          />
        </div>

        <div className="gt-panel-input-row">
          <label>n =</label>
          <input className="gt-input" type="number" min={1} max={1000000} value={crtN}
            onChange={(e) => setCrtN(e.target.value)} style={{ maxWidth: 140 }} />
        </div>

        {crtSplit && (
          <div style={{ marginBottom: 18 }}>
            <CRTRingsSVG n={crtSplit.n} factors={crtSplit.factors} lang={lang} />
            <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-dim)', marginTop: 8 }}>
              <TeX src={String.raw`C_{${crtSplit.n}} \cong `} />
              {crtSplit.factors.length === 0
                ? <TeX src={String.raw`C_1`} />
                : crtSplit.factors.map(({ pk }, i) => (
                  <span key={i}>
                    {i > 0 && <TeX src={String.raw`\times`} />}
                    {' '}
                    <TeX src={String.raw`C_{${pk}}`} />
                    {' '}
                  </span>
                ))}
              {crtSplit.factors.length <= 1 && (
                <span style={{ color: 'var(--ink-faint)', fontSize: 11 }}>
                  ({lang === 'zh' ? 'n 已是素幂，不可再拆' : 'already a prime power, cannot split further'})
                </span>
              )}
            </div>
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--rule)', paddingTop: 14, marginTop: 4 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-faint)', marginBottom: 10 }}>
            <L zh="验证：C_m × C_k 是否等于 C_{mk}？" en="Test: is C_m × C_k isomorphic to C_{mk}?" />
          </div>
          <div className="gt-panel-input-row">
            <label>m =</label>
            <input className="gt-input" type="number" min={1} value={crtM}
              onChange={(e) => setCrtM(e.target.value)} style={{ maxWidth: 100 }} />
            <label>k =</label>
            <input className="gt-input" type="number" min={1} value={crtK}
              onChange={(e) => setCrtK(e.target.value)} style={{ maxWidth: 100 }} />
          </div>
          {crtPairResult && (
            <div style={{
              padding: '12px 16px',
              borderRadius: 6,
              border: '1px solid',
              borderColor: crtPairResult.cyclic ? 'var(--green)' : 'var(--warn)',
              background: crtPairResult.cyclic
                ? 'color-mix(in srgb, var(--green) 10%, var(--bg-elev))'
                : 'color-mix(in srgb, var(--warn) 10%, var(--bg-elev))',
              fontFamily: 'var(--mono)',
              fontSize: 13,
            }}>
              <span style={{ color: crtPairResult.cyclic ? 'var(--green)' : 'var(--warn)', fontWeight: 700 }}>
                {crtPairResult.cyclic ? (lang === 'zh' ? '✓ 成立' : '✓ Yes') : (lang === 'zh' ? '✗ 不成立' : '✗ No')}
              </span>
              {'  '}
              <TeX src={String.raw`C_{${crtPairResult.m}} \times C_{${crtPairResult.k}}`} />
              {crtPairResult.cyclic
                ? <TeX src={String.raw`\;\cong\; C_{${crtPairResult.product}}`} />
                : <TeX src={String.raw`\;\not\cong\; C_{${crtPairResult.product}}`} />}
              {'  '}
              <span style={{ color: 'var(--ink-faint)' }}>
                (gcd({crtPairResult.m},{crtPairResult.k}) = {crtPairResult.g}
                {crtPairResult.cyclic
                  ? (lang === 'zh' ? '，互素' : ', coprime')
                  : (lang === 'zh' ? '，非互素' : ', not coprime')})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Rubik's cube connection ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="魔方中的阿贝尔群" en="An Abelian Group inside the Rubik's Cube" />
      </h3>
      <p>
        <L
          zh={<>魔方群本身是非阿贝尔的（阶约 <TeX src={String.raw`4.3 \times 10^{19}`} />），但它的<strong>朝向子群</strong>是一个有限阿贝尔群的教科书样本：</>}
          en={<>The full Rubik's Cube group is non-abelian (order <TeX src={String.raw`\approx 4.3 \times 10^{19}`} />), but its <strong>orientation subgroup</strong> is a textbook specimen of the Fundamental Theorem:</>}
        />
      </p>
      <div className="gt-pullquote">
        <TeX src={String.raw`C_o \;=\; (\mathbb{Z}/3)^7 \times (\mathbb{Z}/2)^{11}`} />
        <div className="gt-pullquote-cite">
          <L
            zh={<>阶 <TeX src={String.raw`3^7 \cdot 2^{11} = 4{,}478{,}976`} />。七个角块的朝向（总和模 3 为零）和十一个棱块的翻转（总和模 2 为零）各自独立。</>}
            en={<>Order <TeX src={String.raw`3^7 \cdot 2^{11} = 4{,}478{,}976`} />. The seven corner-twist coordinates (mod 3, sum fixed) and eleven edge-flip coordinates (mod 2, sum fixed) are independent.</>}
          />
        </div>
      </div>
      <p>
        <L
          zh={<>将初等因子 <TeX src={String.raw`\underbrace{3,\ldots,3}_{7} ,\, \underbrace{2,\ldots,2}_{11}`} /> 经对齐算法转换为不变因子：2 出现 11 次，3 出现 7 次，右对齐后最右 7 列贡献 <TeX src={String.raw`2 \times 3 = 6`} />，最左 4 列只有 2：</>}
          en={<>Applying the alignment algorithm to elementary divisors <TeX src={String.raw`\underbrace{3,\ldots,3}_{7},\underbrace{2,\ldots,2}_{11}`} />: right-align 7 threes inside 11 columns; the rightmost 7 columns give <TeX src={String.raw`2\times 3=6`} />, leftmost 4 give only 2:</>}
        />
      </p>
      <TeXBlock src={String.raw`C_o \;\cong\; \underbrace{C_2 \times C_2 \times C_2 \times C_2}_{4} \times \underbrace{C_6 \times C_6 \times C_6 \times C_6 \times C_6 \times C_6 \times C_6}_{7}`} />

      {/* ── PANEL 3: Elementary <-> Invariant Converter ── */}
      <div className="gt-panel">
        <div className="gt-panel-title">
          <L zh="初等因子 ↔ 不变因子转换器" en="Elementary Divisors ↔ Invariant Factors Converter" />
        </div>
        <div className="gt-panel-sub">
          <L zh="编辑素幂因子列表，实时计算不变因子链，并内置魔方朝向子群预设" en="Edit the list of prime-power factors; see the divisibility chain update live. Includes the cube orientation subgroup as a preset." />
        </div>

        <div className="gt-panel-input-row">
          <button className="gt-btn" onClick={() => setConvFactors(CUBE_PRESET)}>
            <L zh="加载魔方朝向子群" en="Load cube orientation group" />
          </button>
          <button className="gt-btn-ghost gt-btn" onClick={() => setConvFactors([])}>
            <L zh="清空" en="Clear" />
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {convFactors.map(({ p, e }, i) => (
            <span
              key={i}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: `color-mix(in srgb, ${COLORS[
                  Array.from(new Set(convFactors.map(f => f.p))).indexOf(p) % COLORS.length
                ]} 18%, var(--bg-elev))`,
                border: `1px solid color-mix(in srgb, ${COLORS[
                  Array.from(new Set(convFactors.map(f => f.p))).indexOf(p) % COLORS.length
                ]} 50%, var(--rule))`,
                borderRadius: 4, padding: '3px 8px',
                fontFamily: 'var(--mono)', fontSize: 13,
                color: 'var(--ink)',
              }}
            >
              {p}{e > 1 ? <sup>{e}</sup> : ''}
              <button
                onClick={() => removeConvFactor(i)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', fontSize: 14, lineHeight: 1, padding: '0 2px' }}
                aria-label="remove"
              >
                ×
              </button>
            </span>
          ))}
          {convFactors.length === 0 && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic' }}>
              <L zh="（空 — 平凡群）" en="(empty — trivial group)" />
            </span>
          )}
        </div>

        <div className="gt-panel-input-row">
          <input
            className="gt-input"
            placeholder={lang === 'zh' ? '输入素幂，如 2^3 或 5' : 'Enter prime power, e.g. 2^3 or 5'}
            value={convInput}
            onChange={(e) => setConvInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addConvFactor(); }}
            style={{ maxWidth: 200 }}
          />
          <button className="gt-btn" onClick={addConvFactor}>
            <L zh="添加" en="Add" />
          </button>
        </div>

        <AlignmentMatrixSVG factors={convFactors} invariant={convResult.invariant} lang={lang} colors={COLORS} />

        <div className="gt-panel-result">
          <div className="gt-result-row">
            <div className="gt-result-label"><L zh="初等因子" en="Elementary divisors" /></div>
            <div className="gt-result-val">
              {convFactors.length === 0
                ? <TeX src={String.raw`\{1\}`} />
                : <TeX src={elementaryStr(convFactors)} />}
            </div>
          </div>
          <div className="gt-result-row">
            <div className="gt-result-label"><L zh="不变因子" en="Invariant factors" /></div>
            <div className="gt-result-val-strong">
              <TeX src={invariantStr(convResult.invariant)} />
            </div>
          </div>
          <div className="gt-result-row">
            <div className="gt-result-label"><L zh="群的阶" en="Order" /></div>
            <div className="gt-result-val">{convResult.order.toLocaleString()}</div>
          </div>
          <div className="gt-result-row">
            <div className="gt-result-label"><L zh="指数（最大元素阶）" en="Exponent (max element order)" /></div>
            <div className="gt-result-val">
              {convResult.invariant.length > 0
                ? convResult.invariant[convResult.invariant.length - 1]
                : 1}
            </div>
          </div>
        </div>
      </div>

      {/* ── References ── */}
      <div className="gt-refs" style={{ marginTop: 40 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 10 }}>
          <L zh="参考文献" en="References" />
        </div>
        <ol>
          <li><span className="gt-ref-cite">Dummit &amp; Foote, <em>Abstract Algebra</em>, 3rd ed., §5.2</span> — {lang === 'zh' ? '初等因子与不变因子形式及转换算法' : 'Elementary-divisor and invariant-factor forms with the conversion algorithm'}.</li>
          <li><a href="https://oeis.org/A000688" target="_blank" rel="noreferrer">OEIS A000688</a> — {lang === 'zh' ? '阶为 n 的阿贝尔群数 a(n) = ∏ p(eᵢ)' : 'Number of abelian groups of order n; a(n) = ∏ p(eᵢ)'}.</li>
          <li><a href="https://oeis.org/A000041" target="_blank" rel="noreferrer">OEIS A000041</a> — {lang === 'zh' ? '整数划分函数 p(n)' : 'Integer partition function p(n)'}.</li>
          <li><a href="https://en.wikipedia.org/wiki/Rubik%27s_Cube_group" target="_blank" rel="noreferrer">Wikipedia: Rubik&apos;s Cube group</a> — {lang === 'zh' ? '朝向子群 (ℤ/3)⁷ × (ℤ/2)¹¹ 及完整半直积结构' : 'Orientation subgroup (ℤ/3)⁷ × (ℤ/2)¹¹ and full semidirect-product structure'}.</li>
        </ol>
      </div>
    </GTSec>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

type DisplayMode = 'both' | 'elem' | 'inv';

function GroupRow({
  index,
  elementary,
  invariant,
  displayMode,
  lang,
  n,
}: {
  index: number;
  elementary: Array<{ p: number; e: number }>;
  invariant: number[];
  displayMode: DisplayMode;
  lang: string;
  n: number;
}) {
  const isTriv = n === 1;
  const elemTex = isTriv ? 'C_1' : elementaryStr(elementary);
  const invTex = invariantStr(invariant);
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
      padding: '9px 12px',
      background: index % 2 === 0 ? 'var(--bg)' : 'var(--bg-elev)',
      borderRadius: 4,
      border: '1px solid var(--rule)',
    }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', minWidth: 22 }}>
        {index}.
      </span>
      {(displayMode === 'both' || displayMode === 'elem') && (
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-faint)', marginRight: 4 }}>
            {lang === 'zh' ? '初等' : 'elem'}
          </span>
          <TeX src={elemTex} />
        </span>
      )}
      {displayMode === 'both' && (
        <span style={{ color: 'var(--ink-faint)', fontSize: 14 }}>≅</span>
      )}
      {(displayMode === 'both' || displayMode === 'inv') && (
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--accent-2)', marginRight: 4 }}>
            {lang === 'zh' ? '不变' : 'inv'}
          </span>
          <TeX src={invTex} />
        </span>
      )}
    </div>
  );
}

/** Young-diagram row: one mini SVG per partition. */
function YoungDiagramRow({ partitions, color }: { partitions: number[][]; color: string }) {
  const cellSize = 11;
  const gap = 3;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
      {partitions.map((parts, pi) => {
        const maxRow = Math.max(1, ...parts);
        const rows = parts.length || 1;
        const w = maxRow * (cellSize + gap) - gap + 4;
        const h = rows * (cellSize + gap) - gap + 4;
        return (
          <svg key={pi} width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
            {parts.map((len, ri) =>
              Array.from({ length: len }, (_, ci) => (
                <rect
                  key={`${ri}-${ci}`}
                  x={2 + ci * (cellSize + gap)}
                  y={2 + ri * (cellSize + gap)}
                  width={cellSize}
                  height={cellSize}
                  rx={2}
                  fill={`color-mix(in srgb, ${color} 30%, var(--bg-elev))`}
                  stroke={color}
                  strokeWidth={1}
                />
              ))
            )}
            {parts.length === 0 && (
              <text x={w / 2} y={h / 2 + 4} textAnchor="middle" fontFamily="var(--mono)" fontSize={9} fill="var(--ink-faint)">∅</text>
            )}
          </svg>
        );
      })}
    </div>
  );
}

/** SVG visualisation: concentric rings for CRT split factors. */
function CRTRingsSVG({
  n,
  factors,
  lang,
}: {
  n: number;
  factors: Array<{ p: number; pk: number }>;
  lang: string;
}) {
  const W = 320;
  const H = 160;
  const cx = W / 2;
  const cy = H / 2;
  const COLORS = ['#8B2E3C', '#2A4D69', '#3F7050', '#B8860B', '#6B4E9C', '#C2410C'];

  if (n === 1 || factors.length === 0) {
    return (
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', maxWidth: W }}>
        <text x={cx} y={cy + 5} textAnchor="middle" fontFamily="var(--mono)" fontSize={13} fill="var(--ink-dim)">
          C₁ ({lang === 'zh' ? '平凡群' : 'trivial group'})
        </text>
      </svg>
    );
  }

  // Draw rings for each prime factor
  const radii = factors.map((_, i) => 32 + i * 28);
  const maxR = Math.max(...radii) + 24;
  const svgH = Math.max(H, maxR * 2 + 20);

  const dotRadius = 3;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${svgH}`} style={{ display: 'block', maxWidth: W }}>
      {factors.map(({ pk }, fi) => {
        const r = radii[fi];
        const color = COLORS[fi % COLORS.length];
        const dots = Math.min(pk, 36);
        return (
          <g key={fi}>
            <circle cx={cx} cy={svgH / 2} r={r} fill="none" stroke={color} strokeWidth={1} strokeDasharray="4 3" opacity={0.4} />
            {Array.from({ length: dots }, (_, di) => {
              const angle = (2 * Math.PI * di) / dots - Math.PI / 2;
              const dx = cx + r * Math.cos(angle);
              const dy = svgH / 2 + r * Math.sin(angle);
              return <circle key={di} cx={dx} cy={dy} r={dotRadius} fill={color} opacity={0.85} />;
            })}
            {dots < pk && (
              <text x={cx + r + 6} y={svgH / 2 + 4} fontSize={9} fill={color} fontFamily="var(--mono)">+{pk - dots}</text>
            )}
            <text x={cx} y={svgH / 2 - r - 5} textAnchor="middle" fontSize={10} fill={color} fontFamily="var(--mono)">
              C_{`{${pk}}`}
            </text>
          </g>
        );
      })}
      <circle cx={cx} cy={svgH / 2} r={5} fill="var(--accent)" />
      <text x={cx + 8} y={svgH / 2 + 4} fontSize={9} fill="var(--ink-faint)" fontFamily="var(--mono)">0</text>
    </svg>
  );
}

/** SVG alignment matrix for Elementary -> Invariant conversion. */
function AlignmentMatrixSVG({
  factors,
  invariant,
  lang,
  colors,
}: {
  factors: Array<{ p: number; e: number }>;
  invariant: number[];
  lang: string;
  colors: string[];
}) {
  // Group by prime
  const primeSet = Array.from(new Set(factors.map((f) => f.p))).sort((a, b) => a - b);
  if (primeSet.length === 0) return null;

  // Per prime: sorted exponents ascending
  const byPrime = new Map<number, number[]>();
  for (const { p, e } of factors) {
    if (!byPrime.has(p)) byPrime.set(p, []);
    byPrime.get(p)!.push(e);
  }
  for (const arr of byPrime.values()) arr.sort((a, b) => a - b);

  const k = Math.max(0, ...Array.from(byPrime.values()).map((a) => a.length));
  if (k === 0) return null;

  // Left-padded
  const padded = new Map<number, number[]>();
  for (const [p, arr] of byPrime) {
    padded.set(p, new Array<number>(k - arr.length).fill(0).concat(arr));
  }

  const colW = 48;
  const rowH = 34;
  const leftPad = 46;
  const topPad = 28;
  const W = leftPad + k * colW + 4;
  const H = topPad + (primeSet.length + 1) * rowH + 36;

  return (
    <div style={{ overflowX: 'auto', marginBottom: 8 }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', minWidth: Math.min(W, 300) }}>
        {/* Column headers */}
        {Array.from({ length: k }, (_, j) => (
          <text key={j} x={leftPad + j * colW + colW / 2} y={18} textAnchor="middle"
            fontSize={9} fontFamily="var(--mono)" fill="var(--ink-faint)">
            d{j + 1}
          </text>
        ))}
        {/* Rows per prime */}
        {primeSet.map((p, pi) => {
          const color = colors[pi % colors.length];
          const row = padded.get(p) ?? [];
          return (
            <g key={p}>
              <text x={leftPad - 4} y={topPad + pi * rowH + rowH / 2 + 4} textAnchor="end"
                fontSize={11} fontFamily="var(--mono)" fill={color}>
                p={p}
              </text>
              {row.map((exp, j) => {
                const isEmpty = exp === 0;
                return (
                  <g key={j}>
                    <rect x={leftPad + j * colW + 2} y={topPad + pi * rowH + 2}
                      width={colW - 4} height={rowH - 4} rx={3}
                      fill={isEmpty
                        ? 'var(--bg)'
                        : `color-mix(in srgb, ${color} 22%, var(--bg-elev))`}
                      stroke={isEmpty ? 'var(--rule)' : color}
                      strokeWidth={isEmpty ? 0.5 : 1.2}
                      strokeDasharray={isEmpty ? '3 2' : 'none'}
                    />
                    <text x={leftPad + j * colW + colW / 2} y={topPad + pi * rowH + rowH / 2 + 4}
                      textAnchor="middle" fontSize={11} fontFamily="var(--mono)"
                      fill={isEmpty ? 'var(--ink-faint)' : color}>
                      {isEmpty ? '—' : `${p}${exp > 1 ? `^${exp}` : ''}`}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
        {/* Invariant factor row */}
        {(() => {
          const invY = topPad + primeSet.length * rowH;
          // Rebuild full-length invariant factors array (before dropping d=1)
          const fullInv: number[] = Array.from({ length: k }, (_, j) => {
            let dj = 1;
            for (const p of primeSet) dj *= Math.pow(p, (padded.get(p) ?? [])[j] ?? 0);
            return dj;
          });
          return (
            <g>
              <line x1={leftPad} y1={invY} x2={leftPad + k * colW} y2={invY} stroke="var(--rule)" strokeWidth={1} />
              <text x={leftPad - 4} y={invY + rowH / 2 + 4} textAnchor="end"
                fontSize={10} fontFamily="var(--mono)" fill="var(--accent)">
                {lang === 'zh' ? '不变' : 'inv.'}
              </text>
              {fullInv.map((d, j) => (
                <g key={j}>
                  <rect x={leftPad + j * colW + 2} y={invY + 2}
                    width={colW - 4} height={rowH - 4} rx={3}
                    fill={d === 1 ? 'var(--bg)' : 'color-mix(in srgb, var(--accent) 18%, var(--bg-elev))'}
                    stroke={d === 1 ? 'var(--rule)' : 'var(--accent)'}
                    strokeWidth={d === 1 ? 0.5 : 1.5}
                  />
                  <text x={leftPad + j * colW + colW / 2} y={invY + rowH / 2 + 4}
                    textAnchor="middle" fontSize={11} fontFamily="var(--mono)"
                    fill={d === 1 ? 'var(--ink-faint)' : 'var(--accent)'} fontWeight={d > 1 ? 700 : 400}>
                    {d}
                  </text>
                </g>
              ))}
              {/* Divisibility chain arrows */}
              {invariant.length > 1 && invariant.map((d, i) => {
                if (i === invariant.length - 1) return null;
                // Find column index: invariant factors correspond to last (k - invariant.length + i) cols of fullInv
                const colStart = k - invariant.length + i;
                const x1 = leftPad + colStart * colW + colW - 2;
                const x2 = leftPad + (colStart + 1) * colW + 2;
                const y = invY + rowH / 2 + H - rowH - 12;
                return (
                  <g key={i}>
                    <line x1={x1 + 2} y1={y} x2={x2 - 2} y2={y} stroke="var(--accent-2)" strokeWidth={1.5} />
                    <polygon
                      points={`${x2 - 2},${y - 4} ${x2 + 4},${y} ${x2 - 2},${y + 4}`}
                      fill="var(--accent-2)"
                    />
                    <text x={(x1 + x2) / 2} y={y + 14}
                      textAnchor="middle" fontSize={8} fontFamily="var(--mono)" fill="var(--accent-2)">
                      {d}|{invariant[i + 1]}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
