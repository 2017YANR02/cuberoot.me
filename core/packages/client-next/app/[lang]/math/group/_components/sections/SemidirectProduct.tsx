'use client';

import { useState, useMemo, useCallback } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { tr } from '@/i18n/tr';

// ── Helper types ──────────────────────────────────────────────────────────────

type PhiMode = 'trivial' | 'inversion' | 'coord-perm';

// ── §34 SemidirectProduct ─────────────────────────────────────────────────────

export default function SemidirectProduct() {
  const lang = useLang();

  return (
    <GTSec id="semidirect-product" className="gt-sec">
      <div className="gt-sec-num">§34</div>
      <h2 className="gt-sec-title">
        <L zh="半直积 Semidirect product" en="Semidirect products" />
      </h2>

      <p className="gt-lede">
        <L
          zh={<>
            直积把两个群并排放在一起,各自独立演化。半直积更进一步:让第二个因子 <TeX src={String.raw`H`} /> 通过一个同态 <TeX src={String.raw`\varphi\colon H\to\operatorname{Aut}(N)`} /> 扭曲第一个因子 <TeX src={String.raw`N`} />。
            乘法规则只改了一项:<TeX src={String.raw`(n_1,h_1)(n_2,h_2)=(n_1\cdot\varphi_{h_1}(n_2),\,h_1 h_2)`} />。
            魔方的棱、角坐标恰好就是这个结构的具体实例。
          </>}
          en={<>
            The direct product places two groups side by side, each evolving independently. The semidirect product goes further: it lets the second factor <TeX src={String.raw`H`} /> twist the first factor <TeX src={String.raw`N`} /> via a homomorphism <TeX src={String.raw`\varphi\colon H\to\operatorname{Aut}(N)`} />.
            Only one entry in the multiplication rule changes: <TeX src={String.raw`(n_1,h_1)(n_2,h_2)=(n_1\cdot\varphi_{h_1}(n_2),\,h_1 h_2)`} />.
            The corner and edge coordinates of a Rubik&apos;s Cube are a concrete instance of exactly this structure.
          </>}
        />
      </p>

      {/* ── Definition box ── */}
      <div className="gt-def">
        <div className="gt-def-title">
          <L zh="定义: 外半直积" en="Definition: External semidirect product" />
        </div>
        <div className="gt-def-body">
          <L
            zh={<>
              设 <TeX src={String.raw`N`} />, <TeX src={String.raw`H`} /> 是群，<TeX src={String.raw`\varphi\colon H\to\operatorname{Aut}(N)`} /> 是群同态。<strong>外半直积</strong> <TeX src={String.raw`N\rtimes_\varphi H`} /> 是集合 <TeX src={String.raw`N\times H`} /> 配以乘法
            </>}
            en={<>
              Let <TeX src={String.raw`N`} />, <TeX src={String.raw`H`} /> be groups and <TeX src={String.raw`\varphi\colon H\to\operatorname{Aut}(N)`} /> a group homomorphism. The <strong>external semidirect product</strong> <TeX src={String.raw`N\rtimes_\varphi H`} /> is the set <TeX src={String.raw`N\times H`} /> with multiplication
            </>}
          />
          <TeXBlock src={String.raw`(n_1,h_1)\cdot(n_2,h_2) = \bigl(n_1\cdot\varphi_{h_1}(n_2),\;h_1 h_2\bigr).`} />
          <L
            zh={<>
              单位元为 <TeX src={String.raw`(e_N,e_H)`} />，<TeX src={String.raw`(n,h)`} /> 的逆为 <TeX src={String.raw`(\varphi_{h^{-1}}(n^{-1}),\,h^{-1})`} />。
              阶为 <TeX src={String.raw`|N\rtimes_\varphi H|=|N|\cdot|H|`} />。
              <TeX src={String.raw`N\times\{e_H\}`} /> 是其正规子群；<TeX src={String.raw`\{e_N\}\times H`} /> 是子群但<em>不一定正规</em>。当 <TeX src={String.raw`\varphi`} /> 为平凡同态时退化为直积。
            </>}
            en={<>
              The identity is <TeX src={String.raw`(e_N,e_H)`} /> and the inverse of <TeX src={String.raw`(n,h)`} /> is <TeX src={String.raw`(\varphi_{h^{-1}}(n^{-1}),\,h^{-1})`} />.
              The order is <TeX src={String.raw`|N\rtimes_\varphi H|=|N|\cdot|H|`} />.
              <TeX src={String.raw`N\times\{e_H\}`} /> is a normal subgroup; <TeX src={String.raw`\{e_N\}\times H`} /> is a subgroup but <em>not generally normal</em>. When <TeX src={String.raw`\varphi`} /> is trivial, this reduces to the direct product.
            </>}
          />
        </div>
      </div>

      <p>
        <L
          zh={<>
            <strong>内半直积识别定理</strong>（Dummit &amp; Foote §5.5, Thm 5.12）：群 <TeX src={String.raw`G`} /> 是 <TeX src={String.raw`N`} /> 和 <TeX src={String.raw`H`} /> 的内半直积，当且仅当
            (i) <TeX src={String.raw`N\trianglelefteq G`} />（<TeX src={String.raw`N`} /> 正规），(ii) <TeX src={String.raw`NH=G`} />，(iii) <TeX src={String.raw`N\cap H=\{e\}`} />。
            此时共轭 <TeX src={String.raw`\varphi_h(n)=hnh^{-1}`} /> 给出同构 <TeX src={String.raw`G\cong N\rtimes_\varphi H`} />，<TeX src={String.raw`H`} /> 称为 <TeX src={String.raw`N`} /> 的<em>补</em>。
          </>}
          en={<>
            <strong>Recognition theorem for internal semidirect products</strong> (Dummit &amp; Foote §5.5, Thm 5.12): a group <TeX src={String.raw`G`} /> is the internal semidirect product of <TeX src={String.raw`N`} /> by <TeX src={String.raw`H`} /> if and only if
            (i) <TeX src={String.raw`N\trianglelefteq G`} /> (N is normal), (ii) <TeX src={String.raw`NH=G`} />, and (iii) <TeX src={String.raw`N\cap H=\{e\}`} />.
            The conjugation map <TeX src={String.raw`\varphi_h(n)=hnh^{-1}`} /> then gives <TeX src={String.raw`G\cong N\rtimes_\varphi H`} />, and <TeX src={String.raw`H`} /> is called a <em>complement</em> to <TeX src={String.raw`N`} />.
          </>}
        />
      </p>

      {/* ── Theorem box: split SES ── */}
      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理: 半直积 = 正合列分裂" en="Theorem: semidirect product = split exact sequence" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>
              短正合列 <TeX src={String.raw`1\to N\xrightarrow{\iota} G\xrightarrow{\pi} H\to 1`} /> <strong>分裂</strong>（存在群同态截面 <TeX src={String.raw`s\colon H\to G`} /> 使 <TeX src={String.raw`\pi\circ s=\mathrm{id}_H`} />），当且仅当 <TeX src={String.raw`G\cong \iota(N)\rtimes s(H)`} />。
              因此"<TeX src={String.raw`G`} /> 是 <TeX src={String.raw`N`} /> 被 <TeX src={String.raw`H`} /> 的半直积"与"该正合列分裂"是同一件事。
              <strong>并非每个正合列都分裂</strong>：经典反例是 <TeX src={String.raw`1\to\mathbb{Z}/2\to\mathbb{Z}/4\to\mathbb{Z}/2\to 1`} />，此列不分裂（没有 <TeX src={String.raw`\mathbb{Z}/2`} /> 在 <TeX src={String.raw`\mathbb{Z}/4`} /> 中的补）。
            </>}
            en={<>
              A short exact sequence <TeX src={String.raw`1\to N\xrightarrow{\iota} G\xrightarrow{\pi} H\to 1`} /> <strong>splits</strong> (there is a group-homomorphism section <TeX src={String.raw`s\colon H\to G`} /> with <TeX src={String.raw`\pi\circ s=\mathrm{id}_H`} />) if and only if <TeX src={String.raw`G\cong \iota(N)\rtimes s(H)`} />.
              So &ldquo;<TeX src={String.raw`G`} /> is a semidirect product of <TeX src={String.raw`N`} /> by <TeX src={String.raw`H`} />&rdquo; and &ldquo;the sequence splits&rdquo; say the same thing.
              <strong>Not every short exact sequence splits</strong>: the canonical non-example is <TeX src={String.raw`1\to\mathbb{Z}/2\to\mathbb{Z}/4\to\mathbb{Z}/2\to 1`} />, which does not split (no complement of order 2 exists in <TeX src={String.raw`\mathbb{Z}/4`} />).
            </>}
          />
        </div>
      </div>

      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="二面体群与wreath积" en="Dihedral groups and wreath products" />
      </h3>

      <p>
        <L
          zh={<>
            正 <TeX src={String.raw`n`} /> 边形的对称群是半直积的原型：
          </>}
          en={<>
            The symmetry group of the regular <TeX src={String.raw`n`} />-gon is the prototype of a semidirect product:
          </>}
        />
      </p>
      <TeXBlock src={String.raw`D_n \;=\; C_n \rtimes_\varphi C_2, \quad \varphi_s(r^k)=r^{-k},\quad |D_n|=2n.`} />
      <p>
        <L
          zh={<>
            表现为 <TeX src={String.raw`\langle r,s\mid r^n=s^2=e,\;srs^{-1}=r^{-1}\rangle`} />，乘积 <TeX src={String.raw`r^i s^j \cdot r^k s^\ell = r^{i+(-1)^j k}\,s^{(j+\ell)\bmod 2}`} />。
            <strong>记号注意</strong>：几何/魔方领域用 <TeX src={String.raw`D_n`} />（阶 <TeX src={String.raw`2n`} />），抽象代数文献常用 <TeX src={String.raw`D_{2n}`} />（下标=阶）。本文统一用几何惯例。
          </>}
          en={<>
            Its presentation is <TeX src={String.raw`\langle r,s\mid r^n=s^2=e,\;srs^{-1}=r^{-1}\rangle`} />, with product rule <TeX src={String.raw`r^i s^j \cdot r^k s^\ell = r^{i+(-1)^j k}\,s^{(j+\ell)\bmod 2}`} />.
            <strong>Notation warning</strong>: the geometric/cubing convention writes <TeX src={String.raw`D_n`} /> (order <TeX src={String.raw`2n`} />); much abstract-algebra literature writes <TeX src={String.raw`D_{2n}`} /> (subscript = order). We use the geometric convention throughout.
          </>}
        />
      </p>

      <p>
        <L
          zh={<>
            <strong>Wreath积</strong>（限制型）<TeX src={String.raw`A\wr_X B`} /> 是半直积 <TeX src={String.raw`(A^X)\rtimes_\varphi B`} />，其中 <TeX src={String.raw`A^X=\prod_{x\in X}A`} /> 为基群，<TeX src={String.raw`\varphi_b((a_x)_{x\in X})=(a_{b^{-1}\cdot x})_{x\in X}`} /> 是坐标置换。阶为 <TeX src={String.raw`|A\wr_X B|=|A|^{|X|}\cdot|B|`} />。
            魔方 8 个角的可拆散群正是 <TeX src={String.raw`(\mathbb{Z}/3)\wr S_8`} />（阶 <TeX src={String.raw`3^8\cdot 8!`} />），12 条棱是 <TeX src={String.raw`(\mathbb{Z}/2)\wr S_{12}`} />（阶 <TeX src={String.raw`2^{12}\cdot 12!`} />），两者之积 <TeX src={String.raw`3^8\cdot 8!\cdot 2^{12}\cdot 12!=519\,024\,039\,293\,878\,272\,000`} /> 比合法状态数大 12 倍。
          </>}
          en={<>
            The <strong>wreath product</strong> (restricted) <TeX src={String.raw`A\wr_X B`} /> is the semidirect product <TeX src={String.raw`(A^X)\rtimes_\varphi B`} />, where <TeX src={String.raw`A^X=\prod_{x\in X}A`} /> is the base group and <TeX src={String.raw`\varphi_b((a_x)_{x\in X})=(a_{b^{-1}\cdot x})_{x\in X}`} /> permutes coordinates. Order: <TeX src={String.raw`|A\wr_X B|=|A|^{|X|}\cdot|B|`} />.
            The disassembly group of the 8 Rubik&apos;s cube corners is exactly <TeX src={String.raw`(\mathbb{Z}/3)\wr S_8`} /> (order <TeX src={String.raw`3^8\cdot 8!`} />), the 12 edges are <TeX src={String.raw`(\mathbb{Z}/2)\wr S_{12}`} /> (order <TeX src={String.raw`2^{12}\cdot 12!`} />), and their product <TeX src={String.raw`519{,}024{,}039{,}293{,}878{,}272{,}000`} /> is 12 times the legal state count.
          </>}
        />
      </p>

      <div className="gt-aside">
        <L
          zh={<>
            合法魔方群 <TeX src={String.raw`G`} /> 不是完整的wreath积之积，而是被三条约束（角转 <TeX src={String.raw`\sum\equiv 0\pmod{3}`} />，棱翻 <TeX src={String.raw`\sum\equiv 0\pmod{2}`} />，置换奇偶性相等）截出的指数 12 子群。它仍然是半直积，但分母是受约束的置换群 <TeX src={String.raw`P=\{(\sigma,\tau)\in S_8\times S_{12}:\operatorname{sgn}\sigma=\operatorname{sgn}\tau\}`} />，而非完整的 <TeX src={String.raw`S_8\times S_{12}`} />。分裂来自显式截面（以零定向置换方块），不依赖 Schur-Zassenhaus 定理（此处 <TeX src={String.raw`\gcd(|N|,|P|)\ne 1`} />）。
          </>}
          en={<>
            The legal cube group <TeX src={String.raw`G`} /> is not the full product of wreath products; it is the index-12 subgroup cut by three constraints (corner twist sum <TeX src={String.raw`\equiv 0\pmod{3}`} />, edge flip sum <TeX src={String.raw`\equiv 0\pmod{2}`} />, equal permutation parities). It is still a semidirect product, but by the constrained group <TeX src={String.raw`P=\{(\sigma,\tau)\in S_8\times S_{12}:\operatorname{sgn}\sigma=\operatorname{sgn}\tau\}`} />, not full <TeX src={String.raw`S_8\times S_{12}`} />. The splitting comes from an explicit section (permute pieces with zero orientations), not from Schur-Zassenhaus (whose hypothesis <TeX src={String.raw`\gcd(|N|,|P|)=1`} /> fails here).
          </>}
        />
      </div>

      {/* ── Panel 1: Pair-multiplier ── */}
      <PairMultiplierPanel lang={lang} />

      {/* ── Panel 2: Dihedral Cayley wheel ── */}
      <DihedralWheelPanel lang={lang} />

      {/* ── Panel 3: Split vs non-split extension ── */}
      <SplitExtensionPanel lang={lang} />

      {/* ── References ── */}
      <div className="gt-refs" style={{ marginTop: 40 }}>
        <div className="gt-def-title" style={{ marginBottom: 10 }}>
          <L zh="参考文献" en="References" />
        </div>
        <ol>
          <li>Dummit &amp; Foote, <em>Abstract Algebra</em>, 3rd ed., §5.5 &ldquo;Semidirect Products&rdquo; (Thm 5.12, wreath products) and §1.2 (dihedral groups).</li>
          <li>David Joyner, <em>Adventures in Group Theory</em>, 2nd ed. (Johns Hopkins, 2008) — cube group as semidirect/wreath product.</li>
          <li>Wikipedia, &ldquo;<a href="https://en.wikipedia.org/wiki/Rubik%27s_Cube_group" target="_blank" rel="noopener noreferrer">Rubik&apos;s Cube group</a>&rdquo; — order 43,252,003,274,489,856,000 and the index-12 constraint.</li>
          <li>J. J. Rotman, <em>An Introduction to the Theory of Groups</em>, 4th ed., Ch. 7 (semidirect products, wreath products, Schur-Zassenhaus).</li>
        </ol>
      </div>
    </GTSec>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Panel 1: Pair-multiplier
// ═════════════════════════════════════════════════════════════════════════════

function PairMultiplierPanel({ lang }: { lang: 'zh' | 'en' }) {
  const [phiMode, setPhiMode] = useState<PhiMode>('inversion');
  const [n, setN] = useState(5);          // order of C_n (for inversion mode)
  const [k, setK] = useState(3);          // dimension (for coord-perm mode)
  const [n1, setN1] = useState(1);
  const [h1, setH1] = useState(1);
  const [n2, setN2] = useState(2);
  const [h2, setH2] = useState(0);
  const [swapped, setSwapped] = useState(false);

  // Clamp n1, n2, h1, h2 whenever n or k changes
  const clamp = useCallback((v: number, max: number) => ((v % max) + max) % max, []);

  const result = useMemo(() => {
    const a1 = swapped ? n2 : n1;
    const b1 = swapped ? h2 : h1;
    const a2 = swapped ? n1 : n2;
    const b2 = swapped ? h1 : h2;

    if (phiMode === 'trivial') {
      return {
        semidirect: { n: (a1 + a2) % n, h: (b1 + b2) % 2 },
        direct: { n: (a1 + a2) % n, h: (b1 + b2) % 2 },
        phiApplied: a2,
        isAbelianHere: true,
      };
    }

    if (phiMode === 'inversion') {
      // C_n ⋊ C_2: phi_h1(n2) = (-1)^h1 * n2  mod n
      const phiApplied = ((Math.pow(-1, b1) * a2) % n + n) % n;
      const semi_n = (a1 + phiApplied) % n;
      const semi_h = (b1 + b2) % 2;
      const dir_n = (a1 + a2) % n;
      const dir_h = (b1 + b2) % 2;
      const isAbelianHere = semi_n === dir_n && semi_h === dir_h;
      return { semidirect: { n: semi_n, h: semi_h }, direct: { n: dir_n, h: dir_h }, phiApplied, isAbelianHere };
    }

    // coord-perm: N = (Z/m)^k, H = cyclic shift of coords, m=2 for k<=4, m=3 otherwise
    const m = k <= 4 ? 2 : 3;
    // encode n1 and n2 as length-k vectors over Z/m by base-m decomposition
    const toVec = (x: number): number[] => {
      const v: number[] = [];
      let rem = ((x % Math.pow(m, k)) + Math.pow(m, k)) % Math.pow(m, k);
      for (let i = 0; i < k; i++) { v.push(rem % m); rem = Math.floor(rem / m); }
      return v;
    };
    const fromVec = (v: number[]): number => v.reduce((acc, x, i) => acc + x * Math.pow(m, i), 0);
    // H = Z/k acts by cyclic shift: phi_h(v)[x] = v[(x - h + k) % k]
    const cyclicShift = (v: number[], shift: number): number[] => {
      const s = ((shift % k) + k) % k;
      return v.map((_, i) => v[((i - s) % k + k) % k]);
    };

    const v1 = toVec(a1);
    const v2 = toVec(a2);
    const hShift = b1 % k;
    const phiOfV2 = cyclicShift(v2, hShift);
    const semiVec = v1.map((x, i) => (x + phiOfV2[i]) % m);
    const dirVec = v1.map((x, i) => (x + v2[i]) % m);
    const semi_h = (b1 + b2) % k;
    const dir_h = semi_h;

    const phiApplied = fromVec(phiOfV2);
    const isAbelianHere = semiVec.every((x, i) => x === dirVec[i]) && semi_h === dir_h;

    return {
      semidirect: { n: fromVec(semiVec), h: semi_h },
      direct: { n: fromVec(dirVec), h: dir_h },
      phiApplied,
      isAbelianHere,
    };
  }, [phiMode, n, k, n1, h1, n2, h2, swapped]);

  // Max values
  const nMax = phiMode === 'trivial' ? n : phiMode === 'inversion' ? n : Math.pow(phiMode === 'coord-perm' && k <= 4 ? 2 : 3, k);
  const hMax = phiMode === 'coord-perm' ? k : 2;

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="运算对比: 直积 vs. 半直积" en="Product comparison: direct vs. semidirect" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="选择作用 φ，输入两个元素对 (n,h)，实时对比两种乘法的差异。"
          en="Choose the action φ, enter two element pairs (n,h), and compare the two products live."
        />
      </div>

      {/* Mode chips */}
      <div className="gt-panel-input-row">
        <label><L zh="作用 φ" en="Action φ" /></label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(['trivial', 'inversion', 'coord-perm'] as PhiMode[]).map(m => (
            <button key={m} className={`gt-chip${phiMode === m ? ' gt-chip-active' : ''}`} onClick={() => setPhiMode(m)}>
              {m === 'trivial'
                ? tr({ zh: '平凡 (直积)', en: 'trivial (direct)'
                                      })
                : m === 'inversion'
                ? (lang === 'zh' ? `C_${n} 求逆` : `C_${n} inversion`)
                : (lang === 'zh' ? `坐标置换 (Z/${k <= 4 ? 2 : 3})^${k}` : `coord-perm (Z/${k <= 4 ? 2 : 3})^${k}`)}
            </button>
          ))}
        </div>
      </div>

      {/* n slider (inversion mode) */}
      {phiMode === 'inversion' && (
        <div className="gt-panel-input-row">
          <label><TeX src={String.raw`n`} /></label>
          <input type="range" min={3} max={12} value={n} onChange={e => { setN(+e.target.value); setN1(v => clamp(v, +e.target.value)); setN2(v => clamp(v, +e.target.value)); }} style={{ flex: 1 }} />
          <span className="gt-result-val" style={{ minWidth: 24 }}>{n}</span>
        </div>
      )}
      {/* k slider (coord-perm mode) */}
      {phiMode === 'coord-perm' && (
        <div className="gt-panel-input-row">
          <label><TeX src={String.raw`k`} /></label>
          <input type="range" min={2} max={4} value={k} onChange={e => setK(+e.target.value)} style={{ flex: 1 }} />
          <span className="gt-result-val" style={{ minWidth: 24 }}>{k}</span>
        </div>
      )}

      {/* Element inputs */}
      <div className="gt-panel-input-row" style={{ gap: 8 }}>
        <label><L zh="第 1 对" en="Pair 1" /></label>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>(n<sub>1</sub>=</span>
        <input className="gt-input" type="number" min={0} max={nMax - 1} value={n1} onChange={e => setN1(clamp(+e.target.value, nMax))} style={{ width: 60, minWidth: 0 }} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>, h<sub>1</sub>=</span>
        <input className="gt-input" type="number" min={0} max={hMax - 1} value={h1} onChange={e => setH1(clamp(+e.target.value, hMax))} style={{ width: 60, minWidth: 0 }} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>)</span>
      </div>
      <div className="gt-panel-input-row" style={{ gap: 8 }}>
        <label><L zh="第 2 对" en="Pair 2" /></label>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>(n<sub>2</sub>=</span>
        <input className="gt-input" type="number" min={0} max={nMax - 1} value={n2} onChange={e => setN2(clamp(+e.target.value, nMax))} style={{ width: 60, minWidth: 0 }} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>, h<sub>2</sub>=</span>
        <input className="gt-input" type="number" min={0} max={hMax - 1} value={h2} onChange={e => setH2(clamp(+e.target.value, hMax))} style={{ width: 60, minWidth: 0 }} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>)</span>
      </div>

      <div className="gt-panel-input-row">
        <button className="gt-btn-ghost gt-btn" onClick={() => setSwapped(s => !s)}>
          <L zh="交换顺序" en="Swap order" />
        </button>
        {swapped && <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-faint)' }}>
          <L zh="(已交换: 先 2 后 1)" en="(swapped: 2 then 1)" />
        </span>}
      </div>

      {/* SVG visualization */}
      <MultiplicationSVG
        mode={phiMode}
        a1={swapped ? n2 : n1} b1={swapped ? h2 : h1}
        a2={swapped ? n1 : n2} b2={swapped ? h1 : h2}
        phiApplied={result.phiApplied}
        semiResult={result.semidirect}
        dirResult={result.direct}
        isAbelianHere={result.isAbelianHere}
        lang={lang}
      />

      <div className="gt-panel-result">
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="φ_{h₁}(n₂) =" en="φ_{h₁}(n₂) =" /></span>
          <span className="gt-result-val-strong">{result.phiApplied}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="半直积结果" en="Semidirect result" /></span>
          <span className="gt-result-val-strong">({result.semidirect.n}, {result.semidirect.h})</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="直积结果 (φ=id)" en="Direct product (φ=id)" /></span>
          <span className="gt-result-val">({result.direct.n}, {result.direct.h})</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="两种乘法相等？" en="Equal (abelian here)?" /></span>
          <span className={result.isAbelianHere ? 'gt-result-val' : 'gt-result-val-strong'} style={{ color: result.isAbelianHere ? 'var(--green)' : 'var(--warn)' }}>
            {result.isAbelianHere
              ? tr({ zh: '相等 (φ 在此未起作用)', en: 'equal (φ inactive here)' })
              : tr({ zh: '不等 — 非交换！', en: 'different — non-abelian!'
                                      })}
          </span>
        </div>
      </div>
    </div>
  );
}

// SVG for the pair multiplier
function MultiplicationSVG({
  mode, a1, b1, a2, b2, phiApplied, semiResult, dirResult, isAbelianHere, lang,
}: {
  mode: PhiMode;
  a1: number; b1: number; a2: number; b2: number;
  phiApplied: number;
  semiResult: { n: number; h: number };
  dirResult: { n: number; h: number };
  isAbelianHere: boolean;
  lang: 'zh' | 'en';
}) {
  const W = 560, H = 160;
  const boxW = 70, boxH = 44, gap = 12;
  // Row y positions
  const row1y = 20, row2y = 96;
  const labelX = (i: number) => 10 + i * (boxW + gap);

  const accent = 'var(--accent)';
  const rule = 'var(--rule)';
  const ink = 'var(--ink)';
  const inkDim = 'var(--ink-dim)';
  const bgElev = 'var(--bg-elev)';
  const gold = 'var(--gold)';

  const boxes = [
    { x: labelX(0), label: `n₁=${a1}`, sub: '', highlight: false },
    { x: labelX(1), label: `h₁=${b1}`, sub: '', highlight: false },
    { x: labelX(2), label: `n₂=${a2}`, sub: tr({ zh: '被 φ 作用', en: 'gets twisted' }), highlight: true },
    { x: labelX(3), label: `h₂=${b2}`, sub: '', highlight: false },
  ];
  const resultSemiX = labelX(5);
  const resultDirX = labelX(5);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', margin: '16px 0', overflow: 'visible', maxWidth: W }}>
      {/* Row label: semidirect */}
      <text x={4} y={row1y + 24} style={{ fontFamily: 'var(--mono)', fontSize: 10 }} fill={inkDim}>
        {tr({ zh: '半直', en: 'semi' })}
      </text>

      {/* Draw input boxes */}
      {boxes.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={row1y} width={boxW} height={boxH} rx={4}
            fill={b.highlight ? `color-mix(in srgb, ${gold} 12%, ${bgElev})` : bgElev}
            stroke={b.highlight ? gold : rule}
            strokeWidth={b.highlight ? 1.5 : 1}
          />
          <text x={b.x + boxW / 2} y={row1y + 17} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 13 }} fill={b.highlight ? gold : ink}>{b.label}</text>
          {b.sub && <text x={b.x + boxW / 2} y={row1y + 33} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 8 }} fill={gold}>{b.sub}</text>}
        </g>
      ))}

      {/* Arrow from h1 box to n2 box showing the action */}
      {mode !== 'trivial' && (
        <g>
          <path d={`M ${labelX(1) + boxW / 2} ${row1y + boxH} Q ${labelX(1) + boxW / 2 + 40} ${row1y + boxH + 18} ${labelX(2) + boxW / 2} ${row1y + boxH}`}
            fill="none" stroke={gold} strokeWidth={1.5} strokeDasharray="4 2"
            markerEnd="url(#arrowGold)" />
          <text x={(labelX(1) + labelX(2) + boxW) / 2} y={row1y + boxH + 32} textAnchor="middle"
            style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill={gold}>
            {lang === 'zh' ? `φ 作用后=${phiApplied}` : `φ applies → ${phiApplied}`}
          </text>
        </g>
      )}

      {/* Result box — semidirect */}
      <text x={labelX(4) + 6} y={row1y + 24} style={{ fontFamily: 'var(--mono)', fontSize: 11 }} fill={ink}>=</text>
      <rect x={resultSemiX} y={row1y} width={boxW + 10} height={boxH} rx={4}
        fill={`color-mix(in srgb, ${accent} 10%, ${bgElev})`} stroke={accent} strokeWidth={1.5} />
      <text x={resultSemiX + (boxW + 10) / 2} y={row1y + 24} textAnchor="middle"
        style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600 }} fill={accent}>
        ({semiResult.n}, {semiResult.h})
      </text>

      {/* Row 2: direct product */}
      <text x={4} y={row2y + 24} style={{ fontFamily: 'var(--mono)', fontSize: 10 }} fill={inkDim}>
        {tr({ zh: '直积', en: 'direct'
        })}
      </text>

      {boxes.map((b, i) => (
        <g key={`dir${i}`}>
          <rect x={b.x} y={row2y} width={boxW} height={boxH} rx={4} fill={bgElev} stroke={rule} strokeWidth={1} />
          <text x={b.x + boxW / 2} y={row2y + 24} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 13 }} fill={inkDim}>{b.label}</text>
        </g>
      ))}

      <text x={labelX(4) + 6} y={row2y + 24} style={{ fontFamily: 'var(--mono)', fontSize: 11 }} fill={inkDim}>=</text>
      <rect x={resultDirX} y={row2y} width={boxW + 10} height={boxH} rx={4}
        fill={isAbelianHere ? `color-mix(in srgb, var(--green) 10%, ${bgElev})` : bgElev}
        stroke={isAbelianHere ? 'var(--green)' : rule} strokeWidth={1} />
      <text x={resultDirX + (boxW + 10) / 2} y={row2y + 24} textAnchor="middle"
        style={{ fontFamily: 'var(--mono)', fontSize: 13 }} fill={isAbelianHere ? 'var(--green)' : inkDim}>
        ({dirResult.n}, {dirResult.h})
      </text>

      {/* Indicator dot */}
      <circle cx={W - 16} cy={H / 2} r={10}
        fill={isAbelianHere ? `color-mix(in srgb, var(--green) 20%, ${bgElev})` : `color-mix(in srgb, ${accent} 20%, ${bgElev})`}
        stroke={isAbelianHere ? 'var(--green)' : accent} strokeWidth={1.5} />
      <text x={W - 16} y={H / 2 + 4} textAnchor="middle"
        style={{ fontSize: 10, fontWeight: 700 }}
        fill={isAbelianHere ? 'var(--green)' : accent}>
        {isAbelianHere ? '=' : '≠'}
      </text>

      {/* Arrow marker */}
      <defs>
        <marker id="arrowGold" markerWidth={6} markerHeight={6} refX={3} refY={3} orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill={gold} />
        </marker>
      </defs>
    </svg>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Panel 2: Dihedral Cayley wheel
// ═════════════════════════════════════════════════════════════════════════════

function DihedralWheelPanel({ lang }: { lang: 'zh' | 'en' }) {
  const [n, setN] = useState(6);
  // Selected element: (i, j) where i in 0..n-1, j in {0,1}
  const [selI, setSelI] = useState(0);
  const [selJ, setSelJ] = useState(0);
  // Generator action: r, s, or conjugate
  const [action, setAction] = useState<'r' | 's' | 'conj'>('r');

  // Apply right multiplication by generator
  // r: (i,j) * (1,0) = (i + (-1)^j * 1 mod n, j)
  // s: (i,j) * (0,1) = (i + 0,       (j+1) mod 2)  = (i, 1-j)
  // conj by s: s*(i,0)*s^-1 = s*(i,0)*s = (-i mod n, 0)  [only for j=0 rotations]
  const applyAction = useCallback(() => {
    if (action === 'r') {
      const newI = ((selI + (selJ === 0 ? 1 : -1)) % n + n) % n;
      setSelI(newI);
    } else if (action === 's') {
      setSelJ(j => 1 - j);
    } else {
      // conjugate by s: s (i,j) s^-1
      // s*(i,j) = (i, j+1 mod 2) wait — need full formula
      // (0,1)*(i,j)*(0,1) = ?
      // (0,1)*(i,j) = (0*(-1)^1 *... let me use the multiplication rule directly
      // (n1,h1)(n2,h2) = (n1 + (-1)^h1 * n2, h1+h2 mod 2)
      // (0,1)*(i,j) = (0 + (-1)^1 * i, 1+j mod 2) = (-i mod n, 1+j mod 2)
      // Then multiply by (0,1) on the right (since s^-1 = s in C2):
      // (-i, 1+j) * (0,1) = (-i + (-1)^{1+j}*0, 1+j+1 mod 2) = (-i mod n, j)
      const newI = ((-selI) % n + n) % n;
      setSelI(newI);
      // j stays the same under conjugation by s
    }
  }, [action, selI, selJ, n]);

  // Compute polygon vertices for the geometric view
  const polyVertices = useMemo(() => {
    const verts: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
      const theta = (2 * Math.PI * i) / n - Math.PI / 2;
      verts.push({ x: 60 + 50 * Math.cos(theta), y: 60 + 50 * Math.sin(theta) });
    }
    return verts;
  }, [n]);

  // Rotate polygon vertices by current element
  const rotated = useMemo(() => {
    const angle = (2 * Math.PI * selI) / n;
    const cx = 60, cy = 60;
    return polyVertices.map(v => {
      const dx = v.x - cx, dy = v.y - cy;
      const rx = dx * Math.cos(angle) - dy * Math.sin(angle);
      const ry = dx * Math.sin(angle) + dy * Math.cos(angle);
      // if j=1, also reflect x
      const fx = selJ === 1 ? -rx : rx;
      return { x: cx + fx, y: cy + ry };
    });
  }, [polyVertices, selI, selJ, n]);

  const R_outer = 80, R_inner = 50;
  const cx = 120, cy = 120;
  const svgSize = 240;

  // Nodes: outer ring = rotations r^i, inner ring = reflections r^i s
  const nodes = useMemo(() => {
    const arr: { i: number; j: number; x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
      const theta = (2 * Math.PI * i) / n - Math.PI / 2;
      arr.push({ i, j: 0, x: cx + R_outer * Math.cos(theta), y: cy + R_outer * Math.sin(theta) });
      arr.push({ i, j: 1, x: cx + R_inner * Math.cos(theta), y: cy + R_inner * Math.sin(theta) });
    }
    return arr;
  }, [n]);

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh={`二面体群 Cayley 轮 D_n = C_n ⋊ C_2`} en={`Dihedral Cayley wheel D_n = C_n ⋊ C_2`} />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="外圈=旋转 r^i，内圈=反射 r^i s。选一个生成元动作，点击执行，观察 s r^i s⁻¹ = r^{-i} 的逆转作用。"
          en="Outer ring = rotations r^i; inner ring = reflections r^i s. Choose a generator action, click to apply, and see how s r^i s⁻¹ = r^{-i} inverts a rotation."
        />
      </div>

      <div className="gt-panel-input-row">
        <label><TeX src={String.raw`n`} /></label>
        <input type="range" min={3} max={12} value={n} onChange={e => { setN(+e.target.value); setSelI(0); setSelJ(0); }} style={{ flex: 1 }} />
        <span className="gt-result-val" style={{ minWidth: 36 }}>
          <L zh={`n=${n}, |D_n|=${2 * n}`} en={`n=${n}, |D_n|=${2 * n}`} />
        </span>
      </div>

      <div className="gt-panel-input-row">
        <label><L zh="动作" en="Action" /></label>
        {(['r', 's', 'conj'] as const).map(a => (
          <button key={a} className={`gt-chip${action === a ? ' gt-chip-active' : ''}`} onClick={() => setAction(a)}>
            {a === 'r'
              ? tr({ zh: '×r (旋转)', en: '×r (rotate)'
                                })
              : a === 's'
              ? tr({ zh: '×s (反射)', en: '×s (reflect)' })
              : tr({ zh: 's·g·s⁻¹ (共轭)', en: 's·g·s⁻¹ (conjugate)'
                                    })}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        {/* Cayley wheel SVG */}
        <svg viewBox={`0 0 ${svgSize} ${svgSize}`} width={Math.min(svgSize, 240)} style={{ flexShrink: 0 }}>
          {/* Rings */}
          <circle cx={cx} cy={cy} r={R_outer} fill="none" stroke="var(--rule)" strokeWidth={1} strokeDasharray="3 3" />
          <circle cx={cx} cy={cy} r={R_inner} fill="none" stroke="var(--rule)" strokeWidth={1} strokeDasharray="3 3" />

          {/* Nodes */}
          {nodes.map(({ i, j, x, y }) => {
            const isSel = i === selI && j === selJ;
            return (
              <g key={`${i}-${j}`} style={{ cursor: 'pointer' }} onClick={() => { setSelI(i); setSelJ(j); }}>
                <circle cx={x} cy={y} r={14}
                  fill={isSel ? (j === 0 ? 'var(--accent)' : 'var(--accent-2)') : 'var(--bg-elev)'}
                  stroke={j === 0 ? 'var(--accent)' : 'var(--accent-2)'}
                  strokeWidth={isSel ? 2.5 : 1.5}
                />
                <text x={x} y={y + 4} textAnchor="middle"
                  style={{ fontFamily: 'var(--mono)', fontSize: 9, pointerEvents: 'none' }}
                  fill={isSel ? 'white' : 'var(--ink)'}>
                  {j === 0 ? `r${i === 0 ? 'ᵉ' : i}` : `r${i}s`}
                </text>
              </g>
            );
          })}

          {/* Labels */}
          <text x={cx} y={16} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--accent)">
            {tr({ zh: '旋转', en: 'rotations'
            })}
          </text>
          <text x={cx} y={cy + R_inner - 4} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--accent-2)">
            {tr({ zh: '反射', en: 'reflections' })}
          </text>
        </svg>

        {/* Polygon visualization */}
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', marginBottom: 8 }}>
            <L zh="几何作用" en="Geometric action" />
          </div>
          <svg viewBox="0 0 120 120" width={120}>
            {/* Original polygon */}
            <polygon
              points={polyVertices.map(v => `${v.x},${v.y}`).join(' ')}
              fill="none" stroke="var(--rule)" strokeWidth={1} strokeDasharray="3 2"
            />
            {/* Transformed polygon */}
            <polygon
              points={rotated.map(v => `${v.x},${v.y}`).join(' ')}
              fill={`color-mix(in srgb, var(--accent) 12%, var(--bg-elev))`}
              stroke="var(--accent)" strokeWidth={1.5}
            />
            {/* Vertices */}
            {rotated.map((v, i) => (
              <circle key={i} cx={v.x} cy={v.y} r={4} fill="var(--accent)" />
            ))}
            <text x={60} y={118} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--ink-faint)">
              {selJ === 0 ? `r^${selI}` : `r^${selI} s`}
            </text>
          </svg>

          {/* Info */}
          <div style={{ marginTop: 12, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-dim)', lineHeight: 1.6 }}>
            <div><L zh="当前元素" en="Current" />: ({selI}, {selJ}) = {selJ === 0 ? `r^${selI}` : `r^${selI} s`}</div>
            {action === 'conj' && <div style={{ color: 'var(--gold)', marginTop: 4 }}>
              <L zh={`s·r^${selI}·s⁻¹ = r^${((-selI) % n + n) % n}`} en={`s·r^${selI}·s⁻¹ = r^${((-selI) % n + n) % n}`} />
            </div>}
          </div>

          <button className="gt-btn" style={{ marginTop: 12, fontSize: 11 }} onClick={applyAction}>
            <L zh="执行动作" en="Apply action" />
          </button>
          <button className="gt-btn-ghost gt-btn" style={{ marginTop: 8, fontSize: 11 }} onClick={() => { setSelI(0); setSelJ(0); }}>
            <L zh="重置" en="Reset" />
          </button>
        </div>
      </div>

      {/* Conjugation formula display */}
      <div className="gt-panel-result">
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="选中元素" en="Selected element" /></span>
          <span className="gt-result-val-strong">r<sup>{selI}</sup>{selJ === 1 ? ' s' : ''}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="s·(·)·s⁻¹" en="s·(·)·s⁻¹" /></span>
          <span className="gt-result-val" style={{ color: 'var(--gold)' }}>
            r<sup>{((-selI) % n + n) % n}</sup>{selJ === 1 ? ' s' : ''}
            <span style={{ fontSize: 11, marginLeft: 8, color: 'var(--ink-faint)' }}>
              <L zh={selJ === 0 ? '(旋转被逆转)' : '(仍是反射，旋转分量取反)'} en={selJ === 0 ? '(rotation inverted)' : '(still a reflection, rotation part negated)'} />
            </span>
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="乘法规则" en="Multiplication rule" /></span>
          <span className="gt-result-val" style={{ fontSize: 11 }}>
            r^i · r^k s^l = r^{'{'}i + (-1)^j k{'}'} s^{'{'}j+l mod 2{'}'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Panel 3: Split vs non-split extension demo
// ═════════════════════════════════════════════════════════════════════════════

// We demonstrate two groups:
// (A) D_3 = C_3 ⋊ C_2 of order 6: N=C_3 (indices 0,1,2), H=C_2 (index 3)
//     Elements: 0=e, 1=r, 2=r^2, 3=s, 4=rs, 5=r^2 s
//     Multiplication: (i,j)*(k,l) = (i + (-1)^j * k mod 3, (j+l) mod 2)
//     We label element (i,j) -> index = i + 3*j
// (B) Z/4 = {0,1,2,3} — extension 1->Z/2->{0,2}->Z/4->{0,1}->1 does NOT split

type ExtExample = 'D3' | 'Z4';

function d3Mul(a: number, b: number): number {
  // element index a = i + 3*j, so i=a%3, j=Math.floor(a/3)
  const ia = a % 3, ja = Math.floor(a / 3);
  const ib = b % 3, jb = Math.floor(b / 3);
  const ni = ((ia + (ja === 0 ? 1 : -1) * ib) % 3 + 3) % 3;
  const nj = (ja + jb) % 2;
  return ni + 3 * nj;
}

function z4Mul(a: number, b: number): number {
  return (a + b) % 4;
}

function SplitExtensionPanel({ lang }: { lang: 'zh' | 'en' }) {
  const [example, setExample] = useState<ExtExample>('D3');
  const [selectedH, setSelectedH] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);

  // For D3: G has 6 elements, N = {0,1,2} = C3, quotient H_abstract = C2
  // Cosets of N in G: {0,1,2} and {3,4,5} — picking one from each coset = transversal
  // We let user pick which element of coset {3,4,5} to use as the section of the non-identity
  // For Z4: G={0,1,2,3}, N={0,2} (the even elements, kernel of mod-2 map), cosets: {0,2}, {1,3}

  const isD3 = example === 'D3';

  // Cosets
  const cosets: number[][] = isD3
    ? [[0, 1, 2], [3, 4, 5]]
    : [[0, 2], [1, 3]];

  // Representative for identity coset is always the identity
  // User picks the lift of the non-identity element
  const coset1Elements = cosets[1];

  // The selected section (transversal): [{coset 0 rep = identity}, {selected element from coset 1}]
  const s0 = 0; // identity always
  const s1 = selectedH ?? coset1Elements[0];

  // Check if {s0, s1} is closed under multiplication (= a subgroup = a section homomorphism)
  const mul = isD3 ? d3Mul : z4Mul;
  const productS1S1 = mul(s1, s1);
  // More precisely: section is a hom if s(h1)s(h2) = s(h1+h2) for all h1,h2 in H
  // H = C2, so the only nontrivial check is s(1)*s(1) = s(0) = e
  const sectionIsHom = productS1S1 === s0;

  // For the SVG: show G as two columns (cosets of N)
  const G_labels: string[] = isD3
    ? ['e', 'r', 'r²', 's', 'rs', 'r²s']
    : ['0', '1', '2', '3'];

  const cosetLabel = isD3 ? ['N = C₃', 's·N'] : ['N = {0,2}', '{1,3}'];

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="正合列分裂 vs. 不分裂" en="Split vs. non-split exact sequence" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="选择一个截面（转移）并验证它是否是群同态，绿色连线表示封闭（分裂），红色表示不封闭。"
          en="Pick a section (transversal) and check whether it is a group homomorphism. Green edges = closed (splits); red = fails closure."
        />
      </div>

      <div className="gt-panel-input-row">
        <label><L zh="例子" en="Example" /></label>
        {(['D3', 'Z4'] as ExtExample[]).map(ex => (
          <button key={ex} className={`gt-chip${example === ex ? ' gt-chip-active' : ''}`}
            onClick={() => { setExample(ex); setSelectedH(null); setChecked(false); }}>
            {ex === 'D3'
              ? tr({ zh: 'D₃ = C₃ ⋊ C₂ (分裂)', en: 'D₃ = C₃ ⋊ C₂ (splits)' })
              : tr({ zh: 'ℤ/4 over ℤ/2 (不分裂)', en: 'ℤ/4 over ℤ/2 (non-split)' })}
          </button>
        ))}
      </div>

      <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-dim)', marginBottom: 12 }}>
        <L
          zh={<>选 <TeX src={String.raw`H\cong\mathbb{Z}/2`} /> 的非单位元提升:</>}
          en={<>Pick the lift of the non-identity of <TeX src={String.raw`H\cong\mathbb{Z}/2`} />:</>}
        />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {coset1Elements.map(el => (
          <button key={el} className={`gt-chip${s1 === el ? ' gt-chip-active' : ''}`}
            onClick={() => { setSelectedH(el); setChecked(false); }}>
            {G_labels[el]}
          </button>
        ))}
      </div>

      {/* Extension diagram SVG */}
      <ExtensionDiagramSVG
        cosets={cosets}
        gLabels={G_labels}
        cosetLabels={cosetLabel}
        s0={s0} s1={s1}
        sectionIsHom={sectionIsHom}
        checked={checked}
        lang={lang}
      />

      <button className="gt-btn" onClick={() => setChecked(true)} style={{ marginBottom: 12 }}>
        <L zh="验证截面是否同态" en="Check if section is a homomorphism" />
      </button>

      {checked && (
        <div className="gt-panel-result">
          <div className="gt-result-row">
            <span className="gt-result-label"><L zh="截面选取" en="Section chosen" /></span>
            <span className="gt-result-val">{`s(0)=${G_labels[s0]}, s(1)=${G_labels[s1]}`}</span>
          </div>
          <div className="gt-result-row">
            <span className="gt-result-label"><L zh="s(1)·s(1) =" en="s(1)·s(1) =" /></span>
            <span className="gt-result-val">{G_labels[productS1S1]}</span>
          </div>
          <div className="gt-result-row">
            <span className="gt-result-label"><L zh="需等于 s(0) = e" en="Must equal s(0) = e" /></span>
            <span className="gt-result-val" style={{ color: sectionIsHom ? 'var(--green)' : 'var(--warn)' }}>
              {sectionIsHom
                ? (lang === 'zh' ? `等于 ${G_labels[productS1S1]} — 同态成立，正合列分裂！` : `equals ${G_labels[productS1S1]} — homomorphism, sequence splits!`)
                : (lang === 'zh' ? `得到 ${G_labels[productS1S1]} ≠ e — 此截面不是同态。` : `got ${G_labels[productS1S1]} ≠ e — this section is not a homomorphism.`)}
            </span>
          </div>
          {!isD3 && (
            <div className="gt-result-row">
              <span className="gt-result-label"><L zh="结论" en="Conclusion" /></span>
              <span className="gt-result-val" style={{ color: 'var(--warn)' }}>
                <L zh="非单位元的两个提升 1、3 阶都是 4，平方 1+1 = 3+3 = 2 ≠ 0，都不生成 C₂；ℤ/4 唯一的阶-2 元素 2 落在 N = {0,2} 内部，N 没有补，正合列不分裂。" en="The two lifts 1 and 3 of the non-identity both have order 4, with 1+1 = 3+3 = 2 ≠ 0, so neither generates a C₂. The only order-2 element of ℤ/4, namely 2, lies inside N = {0,2}; N has no complement, so the sequence does not split." />
              </span>
            </div>
          )}
          {isD3 && sectionIsHom && (
            <div className="gt-result-row">
              <span className="gt-result-label"><L zh="结论" en="Conclusion" /></span>
              <span className="gt-result-val" style={{ color: 'var(--green)' }}>
                <L zh="正合列分裂：G ≅ C₃ ⋊ C₂ = D₃。截面 s 是 C₂ 在 G 中的补。" en="The sequence splits: G ≅ C₃ ⋊ C₂ = D₃. The section s is a complement to C₃ in G." />
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ExtensionDiagramSVG({
  cosets, gLabels, cosetLabels, s0, s1, sectionIsHom, checked, lang,
}: {
  cosets: number[][];
  gLabels: string[];
  cosetLabels: string[];
  s0: number; s1: number;
  sectionIsHom: boolean;
  checked: boolean;
  lang: 'zh' | 'en';
}) {
  const colW = 100, nodeR = 18, nodeGap = 48;
  const nCols = cosets.length;
  const maxRows = Math.max(...cosets.map(c => c.length));
  const W = nCols * colW + 40;
  const H = maxRows * nodeGap + 60;

  // Node positions: column i, row j
  const nodePos = (col: number, row: number) => ({
    x: 30 + col * colW + colW / 2,
    y: 44 + row * nodeGap,
  });

  // Section nodes: s0 in col 0, s1 in col 1
  const sectionNodeIndices = [s0, s1];
  const isSection = (col: number, idx: number) => sectionNodeIndices[col] === idx;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', margin: '12px 0', maxWidth: W }}>
      {/* Column headers */}
      {cosets.map((_, col) => (
        <text key={col} x={30 + col * colW + colW / 2} y={18} textAnchor="middle"
          style={{ fontFamily: 'var(--mono)', fontSize: 11 }} fill="var(--ink-faint)">
          {cosetLabels[col]}
        </text>
      ))}

      {/* Nodes */}
      {cosets.map((coset, col) =>
        coset.map((el, row) => {
          const { x, y } = nodePos(col, row);
          const inSec = isSection(col, el);
          return (
            <g key={`${col}-${row}`}>
              <circle cx={x} cy={y} r={nodeR}
                fill={inSec
                  ? (checked && sectionIsHom ? `color-mix(in srgb, var(--green) 20%, var(--bg-elev))` : `color-mix(in srgb, var(--accent-2) 20%, var(--bg-elev))`)
                  : 'var(--bg-elev)'}
                stroke={inSec
                  ? (checked ? (sectionIsHom ? 'var(--green)' : 'var(--accent-2)') : 'var(--accent-2)')
                  : 'var(--rule)'}
                strokeWidth={inSec ? 2 : 1}
              />
              <text x={x} y={y + 4} textAnchor="middle"
                style={{ fontFamily: 'var(--mono)', fontSize: 11, pointerEvents: 'none' }}
                fill={inSec ? 'var(--accent-2)' : 'var(--ink-dim)'}>
                {gLabels[el]}
              </text>
            </g>
          );
        })
      )}

      {/* Edge connecting the two section nodes */}
      {(() => {
        const { x: x0, y: y0 } = nodePos(0, cosets[0].indexOf(s0));
        const { x: x1, y: y1 } = nodePos(1, cosets[1].indexOf(s1));
        const color = !checked ? 'var(--accent-2)' : sectionIsHom ? 'var(--green)' : 'var(--warn)';
        return (
          <line x1={x0 + nodeR} y1={y0} x2={x1 - nodeR} y2={y1}
            stroke={color} strokeWidth={2}
            strokeDasharray={checked && !sectionIsHom ? '4 3' : 'none'} />
        );
      })()}

      {/* Legend */}
      <text x={W / 2} y={H - 6} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 10 }} fill="var(--ink-faint)">
        {tr({ zh: '实线=闭合(分裂), 虚线=不封闭', en: 'solid=closed(splits), dashed=fails closure'
        })}
      </text>
    </svg>
  );
}
