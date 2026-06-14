'use client';

import { useState, useMemo } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import type { Lang } from '../primitives';
import { tr } from '@/i18n/tr';

// ── Growth computation helpers ────────────────────────────────────────────────

/** β(r) for Z^2 with standard ±e1,±e2 generators: 2r²+2r+1 */
function betaZ2(r: number): number {
  return 2 * r * r + 2 * r + 1;
}

/** β(r) for F_2 (free group on 2 generators, |S|=4): 2·3^r − 1, r≥0.
 *  Returns as a number; stays exact as Number for r≤20 since 2·3^20 ≈ 7e9 < 2^53. */
function betaF2(r: number): number {
  return 2 * Math.pow(3, r) - 1;
}

/** Sphere sizes σ(r) for the Rubik's Cube in HTM.
 *  Depths 0–15 are EXACT (Rokicki-Kociemba-Davidson-Dethridge, 2013 / cube20.org).
 *  Depths 16–20 are ESTIMATES — treated as unknown here; we cap β at |G| from r=16. */
const CUBE_SIGMA_EXACT: readonly number[] = [
  1,
  18,
  243,
  3240,
  43239,
  574908,
  7618438,
  100803036,
  1332343288,
  17596479795,
  232248063316,
  3063288809012,
  40374425656248,
  531653418284628,
  6989320578825358,
  91365146187124313,
];

/** |G| for the 3×3×3 Rubik's Cube = 8! · 3^7 · 12! · 2^11 / 2 (the /2 is the
 *  permutation-parity constraint linking corners and edges). */
const CUBE_ORDER = 43252003274489856000;
/** Exact decimal string of |G|; the Number above rounds past 2^53, so any
 *  user-facing display of the full value must use this string, not
 *  CUBE_ORDER.toLocaleString() (which yields …489,860,000). */
const CUBE_ORDER_STR = '43,252,003,274,489,856,000';

/** β(r) for the cube group.  r=0..15 exact; r>=16 returns CUBE_ORDER (complete). */
function betaCube(r: number): number {
  if (r >= 20) return CUBE_ORDER;
  let sum = 0;
  const stop = Math.min(r, 15);
  for (let k = 0; k <= stop; k++) sum += CUBE_SIGMA_EXACT[k];
  if (r >= 16) return CUBE_ORDER; // saturated at the diameter
  return sum;
}

/** safe log10 for positive numbers */
function log10safe(x: number): number {
  if (x <= 0) return 0;
  return Math.log10(x);
}

const LOG_MAX = log10safe(CUBE_ORDER); // ~19.636

// ── Colour palette constants ───────────────────────────────────────────────────
const COLOR_Z2 = '#3F7050';   // green
const COLOR_F2 = '#8B2E3C';   // accent (red)
const COLOR_CUBE = '#2A4D69'; // blue

// ══════════════════════════════════════════════════════════════════════════════
// §61 GrowthOfGroups — main export
// ══════════════════════════════════════════════════════════════════════════════

export default function GrowthOfGroups() {
  const lang = useLang();

  return (
    <GTSec id="growth-of-groups" className="gt-sec">
      <div className="gt-sec-num">§61</div>
      <h2 className="gt-sec-title">
        <L zh="群的增长" en="Growth of groups" />
      </h2>

      <p className="gt-lede">
        <L
          zh={<>
            给定群 <TeX src={String.raw`G`} /> 和有限对称生成集 <TeX src={String.raw`S`} />，
            以 <TeX src={String.raw`e`} /> 为根的 Cayley 图里，半径 <TeX src={String.raw`r`} /> 的闭球包含多少个元素？
            这就是<strong>增长函数</strong> <TeX src={String.raw`\beta_S(r)`} />。
            它的渐近行为——多项式、指数还是「中间增长」——是群的拟等距不变量，与生成集的选取无关。
            Gromov 1981 年的深刻定理将多项式增长与殆幂零群画上等号；
            Grigorchuk 1983 年构造了第一个中间增长群，回答了 Milnor 1968 年提出的问题。
            魔方群因其有限性而独特：增长函数在直径 20 处饱和至 <TeX src={String.raw`|G|=43252003274489856000`} />，
            在对数坐标上画出一条先陡升、后折平的曲线。
          </>}
          en={<>
            Given a group <TeX src={String.raw`G`} /> with a finite symmetric generating set <TeX src={String.raw`S`} />,
            how many group elements lie within distance <TeX src={String.raw`r`} /> from the identity in the Cayley graph?
            That count is the <strong>growth function</strong> <TeX src={String.raw`\beta_S(r)`} />.
            Its asymptotic behaviour — polynomial, exponential, or &ldquo;intermediate&rdquo; — is a
            quasi-isometry invariant independent of the generating set.
            Gromov&apos;s 1981 theorem characterises polynomial growth as exactly virtual nilpotency;
            Grigorchuk&apos;s 1983 group answered Milnor&apos;s 1968 question by exhibiting the first group
            of intermediate growth.
            The Rubik&apos;s Cube group is finite, so its growth function saturates at
            <TeX src={String.raw`|G|=43{,}252{,}003{,}274{,}489{,}856{,}000`} /> by radius 20,
            tracing a curve on a log plot that rises steeply and then bends flat.
          </>}
        />
      </p>

      {/* ── Definitions ─────────────────────────────────────────────────────── */}
      <div className="gt-def">
        <div className="gt-def-title">
          <L zh="定义: 词长与增长函数" en="Definition: word length and growth function" />
        </div>
        <div className="gt-def-body">
          <L
            zh={<>
              设 <TeX src={String.raw`G`} /> 是群，<TeX src={String.raw`S`} /> 是有限<strong>对称</strong>生成集（即 <TeX src={String.raw`S=S^{-1}`} />，<TeX src={String.raw`e\notin S`} />）。
              元素 <TeX src={String.raw`g\in G`} /> 的<strong>词长</strong> <TeX src={String.raw`|g|_S`} /> 是将 <TeX src={String.raw`g`} /> 写成 <TeX src={String.raw`S`} /> 中元素之积所需的最少个数；约定 <TeX src={String.raw`|e|_S=0`} />。
              等价地，<TeX src={String.raw`|g|_S`} /> 是 Cayley 图 <TeX src={String.raw`\mathrm{Cay}(G,S)`} /> 中 <TeX src={String.raw`e`} /> 到 <TeX src={String.raw`g`} /> 的图距离。
            </>}
            en={<>
              Let <TeX src={String.raw`G`} /> be a group and <TeX src={String.raw`S`} /> a finite <strong>symmetric</strong> generating set (<TeX src={String.raw`S=S^{-1}`} />, <TeX src={String.raw`e\notin S`} />).
              The <strong>word length</strong> <TeX src={String.raw`|g|_S`} /> of <TeX src={String.raw`g\in G`} /> is the minimum number of generators from <TeX src={String.raw`S`} /> needed to express <TeX src={String.raw`g`} />; by convention <TeX src={String.raw`|e|_S=0`} />.
              Equivalently, <TeX src={String.raw`|g|_S`} /> is the graph distance from <TeX src={String.raw`e`} /> to <TeX src={String.raw`g`} /> in the Cayley graph <TeX src={String.raw`\mathrm{Cay}(G,S)`} />.
            </>}
          />
          <p style={{ margin: '10px 0 6px' }}>
            <L
              zh={<>
                <strong>增长函数</strong>（球大小）和<strong>球面大小</strong>分别为：
              </>}
              en={<>
                The <strong>growth function</strong> (ball size) and <strong>sphere size</strong> are:
              </>}
            />
          </p>
          <TeXBlock src={String.raw`\beta_S(r)=\#\{g\in G:|g|_S\le r\},\qquad \sigma_S(r)=\#\{g\in G:|g|_S=r\},`} />
          <L
            zh={<>
              满足 <TeX src={String.raw`\beta_S(0)=1`} />，<TeX src={String.raw`\beta_S(r)=\sum_{k=0}^r\sigma_S(k)`} />，且 <TeX src={String.raw`\beta_S`} /> 单调不减。
              对同一群的任意两个有限对称生成集 <TeX src={String.raw`S,S'`} />，增长函数等价（<TeX src={String.raw`f\lesssim g`} /> 指存在常数 <TeX src={String.raw`C\ge1`} /> 使 <TeX src={String.raw`f(r)\le Cg(Cr)`} /> 对所有 <TeX src={String.raw`r`} /> 成立，<TeX src={String.raw`f\sim g`} /> 指双向）：<TeX src={String.raw`\beta_S\sim\beta_{S'}`} />，故<strong>增长型</strong>是 <TeX src={String.raw`G`} /> 的不变量。
            </>}
            en={<>
              We have <TeX src={String.raw`\beta_S(0)=1`} />, <TeX src={String.raw`\beta_S(r)=\sum_{k=0}^r\sigma_S(k)`} />, and <TeX src={String.raw`\beta_S`} /> is non-decreasing.
              For any two finite symmetric generating sets <TeX src={String.raw`S,S'`} /> of the same group, their growth functions are equivalent (<TeX src={String.raw`f\lesssim g`} /> means <TeX src={String.raw`\exists C\ge1`} /> with <TeX src={String.raw`f(r)\le Cg(Cr)`} /> for all <TeX src={String.raw`r`} />; <TeX src={String.raw`f\sim g`} /> means both ways): <TeX src={String.raw`\beta_S\sim\beta_{S'}`} />, so the <strong>growth type</strong> is an invariant of <TeX src={String.raw`G`} />.
            </>}
          />
        </div>
      </div>

      <div className="gt-def">
        <div className="gt-def-title">
          <L zh="定义: 增长型分类" en="Definition: growth types" />
        </div>
        <div className="gt-def-body">
          <L
            zh={<>
              <strong>多项式增长</strong>：存在 <TeX src={String.raw`C>0,d\ge0`} /> 使 <TeX src={String.raw`\beta_S(r)\le Cr^d`} /> 对所有 <TeX src={String.raw`r\ge1`} /> 成立；增长次数是满足此条件的 <TeX src={String.raw`d`} /> 的下确界（由 Gromov 定理加 Bass-Guivarc'h 公式知该下确界是整数）。<br />
              <strong>指数增长</strong>：极限 <TeX src={String.raw`\lambda=\lim_{r\to\infty}\beta_S(r)^{1/r}>1`} />（由次可乘性 <TeX src={String.raw`\beta_S(r+s)\le\beta_S(r)\beta_S(s)`} /> 和 Fekete 引理知极限存在）。<br />
              <strong>次指数增长</strong>：<TeX src={String.raw`\lim\beta_S(r)^{1/r}=1`} />，增长比任意指数慢；多项式增长是其特例。<br />
              <strong>中间增长</strong>：次指数增长但<em>不是</em>多项式增长——比每个多项式快，又比每个指数 <TeX src={String.raw`a^r(a>1)`} /> 慢。
            </>}
            en={<>
              <strong>Polynomial growth</strong>: <TeX src={String.raw`\exists C>0,d\ge0`} /> with <TeX src={String.raw`\beta_S(r)\le Cr^d`} /> for all <TeX src={String.raw`r\ge1`} />; the growth degree is the infimum of such <TeX src={String.raw`d`} /> (shown to be an integer by Gromov&apos;s theorem and the Bass-Guivarc&apos;h formula).<br />
              <strong>Exponential growth</strong>: the limit <TeX src={String.raw`\lambda=\lim_{r\to\infty}\beta_S(r)^{1/r}>1`} /> (exists by submultiplicativity <TeX src={String.raw`\beta_S(r+s)\le\beta_S(r)\beta_S(s)`} /> and Fekete&apos;s lemma).<br />
              <strong>Subexponential growth</strong>: <TeX src={String.raw`\lim\beta_S(r)^{1/r}=1`} />; polynomial growth is a special case.<br />
              <strong>Intermediate growth</strong>: subexponential yet not polynomial — faster than every polynomial but slower than every exponential <TeX src={String.raw`a^r`} /> (<TeX src={String.raw`a>1`} />).
            </>}
          />
        </div>
      </div>

      {/* ── Three key examples ───────────────────────────────────────────────── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="三个典型例子" en="Three canonical examples" />
      </h3>

      <p>
        <L
          zh={<>
            <strong style={{ color: COLOR_Z2 }}>Z² — 多项式增长（次数 2）</strong>。
            取标准生成集 <TeX src={String.raw`S=\{\pm e_1,\pm e_2\}`} />，词长即出租车距离 <TeX src={String.raw`|g|_S=|x|+|y|`} />。
            半径 <TeX src={String.raw`r`} /> 的球面是一个顶角在四轴的正方形钻石（菱形），恰有 <TeX src={String.raw`\sigma(r)=4r`} /> 个格点（<TeX src={String.raw`r\ge1`} />），
            闭球面积 <TeX src={String.raw`\beta(r)=2r^2+2r+1`} />。
            更一般地，<TeX src={String.raw`\mathbb{Z}^n`} /> 的增长次数恰为 <TeX src={String.raw`n`} />（Bass-Guivarc'h 公式）。
          </>}
          en={<>
            <strong style={{ color: COLOR_Z2 }}>Z² — polynomial growth (degree 2)</strong>.
            With standard generators <TeX src={String.raw`S=\{\pm e_1,\pm e_2\}`} />, word length equals taxicab distance <TeX src={String.raw`|g|_S=|x|+|y|`} />.
            The sphere of radius <TeX src={String.raw`r`} /> is a diamond with exactly <TeX src={String.raw`\sigma(r)=4r`} /> lattice points (<TeX src={String.raw`r\ge1`} />),
            so the ball has size <TeX src={String.raw`\beta(r)=2r^2+2r+1`} />.
            More generally, <TeX src={String.raw`\mathbb{Z}^n`} /> has growth degree exactly <TeX src={String.raw`n`} /> (Bass-Guivarc&apos;h formula).
          </>}
        />
      </p>
      <TeXBlock src={String.raw`\beta_{\mathbb{Z}^2}(r)=2r^2+2r+1,\quad \sigma_{\mathbb{Z}^2}(r)=4r\;(r\ge1).`} />

      <p>
        <L
          zh={<>
            <strong style={{ color: COLOR_F2 }}>F₂ — 指数增长（速率 3）</strong>。
            自由群 <TeX src={String.raw`F_2=\langle a,b\rangle`} /> 的 Cayley 图是 4-正则无限树（每节点恰有 4 个邻居）。
            从单位元出发，长度 1 的约化词有 4 个；长度 <TeX src={String.raw`r\ge1`} /> 的约化词有 <TeX src={String.raw`\sigma(r)=4\cdot3^{r-1}`} /> 个（每步排除回头的那个生成元，乘以 <TeX src={String.raw`2k-1=3`} />）。
            球大小 <TeX src={String.raw`\beta(r)=2\cdot3^r-1`} />，指数增长速率 <TeX src={String.raw`\lambda=3`} />。
            在对数纵轴上，<TeX src={String.raw`\log\beta(r)\approx r\log 3`} /> 是一条斜率固定的直线。
          </>}
          en={<>
            <strong style={{ color: COLOR_F2 }}>F₂ — exponential growth (rate 3)</strong>.
            The Cayley graph of the free group <TeX src={String.raw`F_2=\langle a,b\rangle`} /> is the 4-regular infinite tree.
            There are 4 reduced words of length 1; for <TeX src={String.raw`r\ge1`} /> the sphere has
            <TeX src={String.raw`\sigma(r)=4\cdot3^{r-1}`} /> elements (each word extends in <TeX src={String.raw`2k-1=3`} /> ways, avoiding backtracking).
            The ball is <TeX src={String.raw`\beta(r)=2\cdot3^r-1`} /> with exponential growth rate <TeX src={String.raw`\lambda=3`} />.
            On a log-vertical axis, <TeX src={String.raw`\log\beta(r)\approx r\log 3`} /> is a straight line of constant slope.
          </>}
        />
      </p>
      <TeXBlock src={String.raw`\beta_{F_2}(r)=2\cdot 3^r-1,\quad \sigma_{F_2}(r)=4\cdot 3^{r-1}\;(r\ge1).`} />

      <p>
        <L
          zh={<>
            <strong style={{ color: COLOR_CUBE }}>魔方群 — 有限群的饱和</strong>。
            3×3×3 魔方群 <TeX src={String.raw`G`} />（阶 <TeX src={String.raw`\approx4.3\times10^{19}`} />）配 18 个 HTM 生成元（6 个面各 3 种转动：90° 顺/逆时针和 180°）。
            深度 0 到 15 的球面大小（元素个数）已由 Rokicki-Kociemba-Davidson-Dethridge（2013）精确枚举；深度 16–20 仍是估计值。
            <strong>直径 = 20</strong>（HTM 度量，即「上帝算法」步数）：所有 <TeX src={String.raw`4.3\times10^{19}`} /> 个状态在 20 步内可解，且存在需要整整 20 步的状态（约 4.9 亿个，均为估计值）。
            <strong>众数距离约为 18</strong>，而非 20——距离 20 的状态极为稀少。
            因为 <TeX src={String.raw`G`} /> 有限，<TeX src={String.raw`\beta_S(r)=|G|`} /> 对所有 <TeX src={String.raw`r\ge20`} /> 成立，对数曲线在此处折平。
          </>}
          en={<>
            <strong style={{ color: COLOR_CUBE }}>The Rubik&apos;s Cube group — saturation of a finite group</strong>.
            The 3×3×3 cube group <TeX src={String.raw`G`} /> (order <TeX src={String.raw`\approx4.3\times10^{19}`} />) uses 18 HTM generators (6 faces × 3 turns each: 90° CW, 90° CCW, 180°).
            Sphere sizes at depths 0–15 are <em>exact</em>, computed by Rokicki-Kociemba-Davidson-Dethridge (2013); depths 16–20 are <em>estimates</em>.
            <strong>Diameter = 20</strong> (half-turn metric, i.e. &ldquo;God&apos;s number&rdquo;): every one of the <TeX src={String.raw`4.3\times10^{19}`} /> states is solvable in at most 20 moves, and some require all 20 (roughly 490 million such states, all estimated).
            The <strong>modal distance is about 18</strong>, not 20 — distance-20 states are extremely rare.
            Since <TeX src={String.raw`G`} /> is finite, <TeX src={String.raw`\beta_S(r)=|G|`} /> for all <TeX src={String.raw`r\ge20`} />, so the log plot bends flat at that radius.
          </>}
        />
      </p>

      {/* ── Gromov's theorem ────────────────────────────────────────────────── */}
      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理（Gromov, 1981）: 多项式增长 ⟺ 殆幂零" en="Theorem (Gromov, 1981): polynomial growth ⟺ virtually nilpotent" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>
              有限生成群 <TeX src={String.raw`G`} /> 具有多项式增长（即 <TeX src={String.raw`\beta_S(r)\le Cr^d`} /> 对某常数 <TeX src={String.raw`C,d`} /> 及所有 <TeX src={String.raw`r\ge1`} /> 成立），
              当且仅当 <TeX src={String.raw`G`} /> <strong>殆幂零</strong>（即含有有限指数的幂零子群）。
            </>}
            en={<>
              A finitely generated group <TeX src={String.raw`G`} /> has polynomial growth (i.e. <TeX src={String.raw`\beta_S(r)\le Cr^d`} /> for some <TeX src={String.raw`C,d`} /> and all <TeX src={String.raw`r\ge1`} />) if and only if <TeX src={String.raw`G`} /> is <strong>virtually nilpotent</strong> (has a nilpotent subgroup of finite index).
            </>}
          />
          <p style={{ margin: '8px 0 0' }}>
            <L
              zh={<>
                「<TeX src={String.raw`\Leftarrow`} />」方向（Wolf-Bass, 1968/1972）是初等的：幂零群的增长次数由 Bass-Guivarc'h 公式给出，
                <TeXBlock src={String.raw`d = \sum_{i\ge 1} i\cdot\mathrm{rank}\!\left(\gamma_i(G)/\gamma_{i+1}(G)\right).`} />
                对 <TeX src={String.raw`\mathbb{Z}^n`} /> 下中心列只有一项（<TeX src={String.raw`r_1=n`} />），给出次数 <TeX src={String.raw`d=n`} />，与 <TeX src={String.raw`\beta(r)\sim r^n`} /> 一致。
                「<TeX src={String.raw`\Rightarrow`} />」方向（多项式增长 <TeX src={String.raw`\Rightarrow`} /> 殆幂零）是 Gromov 的深刻贡献，证明远非平凡。
              </>}
              en={<>
                The direction <TeX src={String.raw`\Leftarrow`} /> (Wolf-Bass, 1968/1972) is elementary: the growth degree of a nilpotent group is given by the Bass-Guivarc&apos;h formula
                <TeXBlock src={String.raw`d = \sum_{i\ge 1} i\cdot\mathrm{rank}\!\left(\gamma_i(G)/\gamma_{i+1}(G)\right).`} />
                For <TeX src={String.raw`\mathbb{Z}^n`} /> the lower central series has only one term (<TeX src={String.raw`r_1=n`} />), giving <TeX src={String.raw`d=n`} />, consistent with <TeX src={String.raw`\beta(r)\sim r^n`} />.
                The direction <TeX src={String.raw`\Rightarrow`} /> (polynomial growth <TeX src={String.raw`\Rightarrow`} /> virtually nilpotent) is Gromov&apos;s deep contribution.
              </>}
            />
          </p>
        </div>
      </div>

      {/* Milnor-Wolf + Grigorchuk */}
      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理（Milnor-Wolf 1968；Grigorchuk 1983）: 中间增长的存在" en="Theorems (Milnor-Wolf 1968; Grigorchuk 1983): intermediate growth exists" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>
              <strong>Milnor-Wolf 二分</strong>：有限生成<em>可解</em>群要么多项式增长（进而殆幂零），要么指数增长；不存在中间增长。
              更广泛地，线性群（Tits 二择）要么殆可解，要么含自由子群，故同样只有多项式或指数增长。
            </>}
            en={<>
              <strong>Milnor-Wolf dichotomy</strong>: a finitely generated <em>solvable</em> group has either polynomial or exponential growth — intermediate growth is impossible. More broadly, a linear group (Tits alternative) is either virtually solvable or contains a free subgroup, so also only polynomial or exponential growth.
            </>}
          />
          <p style={{ margin: '8px 0 0' }}>
            <L
              zh={<>
                <strong>Grigorchuk 群</strong>（1983）：一个作用于二叉根树的无限残余有限挠 2-群（由 4 个生成元 <TeX src={String.raw`a,b,c,d`} /> 生成），它是第一个中间增长群，从而回答了 Milnor 1968 年的问题。其球大小满足
                <TeXBlock src={String.raw`e^{c_1 r^{1/2}}\;\lesssim\;\beta(r)\;\lesssim\; e^{c_2 r^\alpha}`} />
                其中上指数 <TeX src={String.raw`\alpha\approx0.767`} />（<TeX src={String.raw`\alpha=\log 2/\log(2/\eta)`} />，<TeX src={String.raw`\eta`} /> 是 <TeX src={String.raw`X^3+X^2+X-2`} /> 的实根 <TeX src={String.raw`\approx0.811`} />），下指数约 0.516，均严格介于 0 和 1 之间，因此增长既非多项式也非指数，而是「真正的」中间增长。由于该群非线性（实际上是挠群），Milnor-Wolf 二分和 Tits 二择均不适用。
              </>}
              en={<>
                <strong>The Grigorchuk group</strong> (1983): an infinite residually finite torsion 2-group acting on the rooted binary tree (generated by 4 elements <TeX src={String.raw`a,b,c,d`} />), it is the first group of intermediate growth, answering Milnor&apos;s 1968 question. Its ball size satisfies
                <TeXBlock src={String.raw`e^{c_1 r^{1/2}}\;\lesssim\;\beta(r)\;\lesssim\; e^{c_2 r^\alpha}`} />
                where the upper exponent <TeX src={String.raw`\alpha\approx0.767`} /> (<TeX src={String.raw`\alpha=\log2/\log(2/\eta)`} />, <TeX src={String.raw`\eta`} /> the real root of <TeX src={String.raw`X^3+X^2+X-2`} />, <TeX src={String.raw`\eta\approx0.811`} />) and lower exponent <TeX src={String.raw`\approx0.516`} />, both strictly between 0 and 1. Being a torsion group, it is non-linear, so Milnor-Wolf and the Tits alternative do not apply.
              </>}
            />
          </p>
        </div>
      </div>

      {/* Cube connection */}
      <div className="gt-aside">
        <L
          zh={<>
            <strong>魔方与增长理论</strong>。「上帝算法」研究本质上是研究增长函数 <TeX src={String.raw`\beta_S(r)`} /> 在魔方群上的精确值。
            深度 0–15 的球面大小 <TeX src={String.raw`\sigma_S(r)`} />（「在恰好 <TeX src={String.raw`r`} /> 步内能解的状态数」）已被精确枚举；
            证明直径为 20 并不需要精确数出深度 16–20 的状态数——这些数至今仍是估计值。
            注意：虽然增长函数前期看起来像指数（约以 <TeX src={String.raw`13^r`} /> 的速率增长，因为每步有效分支因子约为 13），
            但魔方群是<em>有限</em>群，其真实增长型（由极限 <TeX src={String.raw`\lim\beta(r)^{1/r}`} /> 判断）与 <TeX src={String.raw`\mathbb{Z}^2`} /> 一样是「次指数」（极限为 1），只是饱和方式截然不同。
          </>}
          en={<>
            <strong>The Rubik&apos;s Cube and growth theory</strong>. Research on &ldquo;God&apos;s number&rdquo; is precisely the study of the growth function <TeX src={String.raw`\beta_S(r)`} /> on the cube group.
            Sphere sizes at depths 0–15 (states solvable in <em>exactly</em> <TeX src={String.raw`r`} /> moves) have been exactly enumerated; proving the diameter is 20 did not require counting positions at depths 16–20 — those remain estimates.
            Note: though early growth looks exponential (effective branching factor <TeX src={String.raw`\approx13`} /> per step), the cube group is <em>finite</em>, so its true growth type (judged by the limit <TeX src={String.raw`\lim\beta(r)^{1/r}`} />) is &ldquo;subexponential&rdquo; (limit = 1) just like <TeX src={String.raw`\mathbb{Z}^2`} />, though its saturation mechanism is entirely different.
          </>}
        />
      </div>

      {/* ── Panel 1: Three-group semilog comparison plot ─────────────────────── */}
      <GrowthComparisonPanel lang={lang} />

      {/* ── Panel 2: Cube distance distribution bar chart ─────────────────── */}
      <CubeDistributionPanel lang={lang} />

      {/* ── Panel 3: Z^2 grid / F2 tree explorer ──────────────────────────── */}
      <GeometricExplorerPanel lang={lang} />

      {/* ── References ──────────────────────────────────────────────────────── */}
      <div className="gt-refs" style={{ marginTop: 40 }}>
        <div className="gt-def-title" style={{ marginBottom: 10 }}>
          <L zh="参考文献" en="References" />
        </div>
        <ol style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--ink-dim)' }}>
          <li>
            P. de la Harpe, <em>Topics in Geometric Group Theory</em>, Univ. of Chicago Press (2000), Ch. VI–VII
            — standard reference for sphere/ball formulas in free and abelian groups, and Grigorchuk&apos;s group.
          </li>
          <li>
            C. Loeh, <em>Geometric Group Theory: An Introduction</em>, Springer (2017), Ch. 6 — growth types, quasi-isometry invariance, Gromov&apos;s theorem.
          </li>
          <li>
            M. Gromov, &ldquo;Groups of polynomial growth and expanding maps,&rdquo; <em>Publ. Math. IHES</em> 53 (1981), 53–73. Bass-Guivarc&apos;h degree: H. Bass, <em>Proc. LMS</em> 25 (1972), 603–614.
          </li>
          <li>
            R. Grigorchuk, &ldquo;Degrees of growth of finitely generated groups,&rdquo; <em>Izv. Akad. Nauk SSSR</em> 48 (1984), 939–985. Survey: Grigorchuk-Pak, <em>Groups of intermediate growth: an introduction</em>.
          </li>
          <li>
            T. Rokicki, H. Kociemba, M. Davidson, J. Dethridge, &ldquo;The Diameter of the Rubik&apos;s Cube Group Is Twenty,&rdquo; <em>SIAM J. Discrete Math.</em> 27(2) (2013), 1082–1105; <a href="https://cube20.org" target="_blank" rel="noopener noreferrer">cube20.org</a> (exact distance distribution, depths 0–15; estimates for 16–20).
          </li>
        </ol>
      </div>
    </GTSec>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Panel 1: Three-group semilog comparison plot
// ══════════════════════════════════════════════════════════════════════════════

function GrowthComparisonPanel({ lang }: { lang: Lang }) {
  const [r, setR] = useState(10);
  const [showZ2, setShowZ2] = useState(true);
  const [showF2, setShowF2] = useState(true);
  const [showCube, setShowCube] = useState(true);
  const [logScale, setLogScale] = useState(true);

  const MAX_R = 20;
  const W = 520;
  const H = 280;
  const PAD = { top: 18, right: 16, bottom: 40, left: 56 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // Compute points
  const points = useMemo(() => {
    const rs = Array.from({ length: MAX_R + 1 }, (_, i) => i);
    return rs.map(ri => ({
      r: ri,
      z2: betaZ2(ri),
      f2: betaF2(ri),
      cube: betaCube(ri),
    }));
  }, []);

  // Scale helpers
  const LOG_MIN = 0; // log10(1)
  const LIN_MAX = CUBE_ORDER;

  function xPx(ri: number): number {
    return PAD.left + (ri / MAX_R) * plotW;
  }

  function yPxLog(val: number): number {
    if (val <= 0) return PAD.top + plotH;
    const frac = (log10safe(val) - LOG_MIN) / (LOG_MAX - LOG_MIN);
    return PAD.top + plotH - frac * plotH;
  }

  function yPxLin(val: number): number {
    const frac = val / LIN_MAX;
    return PAD.top + plotH - frac * plotH;
  }

  const yPx = logScale ? yPxLog : yPxLin;

  function toPolyline(vals: { r: number; v: number }[]): string {
    return vals.map(({ r: ri, v }) => `${xPx(ri).toFixed(1)},${yPx(v).toFixed(1)}`).join(' ');
  }

  const z2pts = points.map(p => ({ r: p.r, v: p.z2 }));
  const f2pts = points.map(p => ({ r: p.r, v: p.f2 }));
  const cubepts = points.map(p => ({ r: p.r, v: p.cube }));

  // Y-axis ticks (log scale)
  const logTicks = [0, 3, 6, 9, 12, 15, 18, 19];
  // X-axis ticks
  const xTicks = [0, 5, 10, 15, 20];

  const curR = points[r];

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="三群增长对比（半对数坐标）" en="Three-group growth comparison (semilog plot)" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="对数纵轴上：直线 = 指数增长，上凸曲线 = 多项式增长，折平 = 有限群饱和。"
          en="On a log vertical axis: straight line = exponential growth, concave curve = polynomial growth, flat plateau = finite-group saturation."
        />
      </div>

      {/* Controls */}
      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <label style={{ fontSize: 13, color: 'var(--ink-dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <L zh={`半径 r = ${r}`} en={`radius r = ${r}`} />
          <input
            type="range" min={0} max={MAX_R} value={r}
            onChange={e => setR(Number(e.target.value))}
            style={{ width: 100 }}
          />
        </label>
        <button className={`gt-chip${logScale ? ' gt-chip-active' : ''}`} onClick={() => setLogScale(s => !s)}>
          <L zh={logScale ? '对数纵轴' : '线性纵轴'} en={logScale ? 'Log scale' : 'Linear scale'} />
        </button>
      </div>

      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 6 }}>
        <button
          className={`gt-chip${showZ2 ? ' gt-chip-active' : ''}`}
          style={showZ2 ? { borderColor: COLOR_Z2, color: COLOR_Z2, background: `color-mix(in srgb, ${COLOR_Z2} 12%, var(--bg))` } : {}}
          onClick={() => setShowZ2(s => !s)}
        >
          Z² <L zh="(多项式)" en="(polynomial)" />
        </button>
        <button
          className={`gt-chip${showF2 ? ' gt-chip-active' : ''}`}
          style={showF2 ? { borderColor: COLOR_F2, color: COLOR_F2, background: `color-mix(in srgb, ${COLOR_F2} 12%, var(--bg))` } : {}}
          onClick={() => setShowF2(s => !s)}
        >
          F₂ <L zh="(指数)" en="(exponential)" />
        </button>
        <button
          className={`gt-chip${showCube ? ' gt-chip-active' : ''}`}
          style={showCube ? { borderColor: COLOR_CUBE, color: COLOR_CUBE, background: `color-mix(in srgb, ${COLOR_CUBE} 12%, var(--bg))` } : {}}
          onClick={() => setShowCube(s => !s)}
        >
          <L zh="魔方群 (饱和)" en="Cube group (saturating)" />
        </button>
      </div>

      {/* SVG plot */}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible', maxWidth: W }}>
        {/* Background */}
        <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} fill="var(--bg-elev)" rx={3} />

        {/* Y-axis grid and ticks */}
        {logScale && logTicks.map(exp => {
          const y = yPxLog(Math.pow(10, exp));
          return (
            <g key={exp}>
              <line x1={PAD.left} y1={y} x2={PAD.left + plotW} y2={y}
                stroke="var(--rule)" strokeWidth={0.5} />
              <text x={PAD.left - 4} y={y + 4} textAnchor="end"
                style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--ink-faint)">
                10<tspan dy={-4} style={{ fontSize: 7 }}>{exp}</tspan>
              </text>
            </g>
          );
        })}
        {!logScale && [0, 0.25, 0.5, 0.75, 1].map(frac => {
          const y = PAD.top + plotH - frac * plotH;
          const label = frac === 0 ? '0' : frac === 1 ? '4.3e19' : '';
          return (
            <g key={frac}>
              <line x1={PAD.left} y1={y} x2={PAD.left + plotW} y2={y}
                stroke="var(--rule)" strokeWidth={0.5} />
              {label && (
                <text x={PAD.left - 4} y={y + 4} textAnchor="end"
                  style={{ fontFamily: 'var(--mono)', fontSize: 8 }} fill="var(--ink-faint)">
                  {label}
                </text>
              )}
            </g>
          );
        })}

        {/* X-axis ticks */}
        {xTicks.map(ri => (
          <g key={ri}>
            <line x1={xPx(ri)} y1={PAD.top + plotH} x2={xPx(ri)} y2={PAD.top + plotH + 4}
              stroke="var(--ink-dim)" strokeWidth={1} />
            <text x={xPx(ri)} y={PAD.top + plotH + 14} textAnchor="middle"
              style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--ink-dim)">
              {ri}
            </text>
          </g>
        ))}

        {/* Axis labels */}
        <text x={PAD.left + plotW / 2} y={H - 2} textAnchor="middle"
          style={{ fontFamily: 'var(--mono)', fontSize: 10 }} fill="var(--ink-dim)">
          <L zh="半径 r" en="radius r" />
        </text>
        <text x={10} y={PAD.top + plotH / 2} textAnchor="middle"
          style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--ink-dim)"
          transform={`rotate(-90, 10, ${PAD.top + plotH / 2})`}>
          β(r)
        </text>

        {/* Axis borders */}
        <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH}
          fill="none" stroke="var(--rule)" strokeWidth={1} />

        {/* Vertical marker at r */}
        <line x1={xPx(r)} y1={PAD.top} x2={xPx(r)} y2={PAD.top + plotH}
          stroke="var(--gold)" strokeWidth={1} strokeDasharray="4 2" opacity={0.8} />

        {/* Polylines */}
        {showZ2 && (
          <polyline points={toPolyline(z2pts)}
            fill="none" stroke={COLOR_Z2} strokeWidth={2} strokeLinejoin="round" />
        )}
        {showF2 && (
          <polyline points={toPolyline(f2pts)}
            fill="none" stroke={COLOR_F2} strokeWidth={2} strokeLinejoin="round" />
        )}
        {showCube && (
          <polyline points={toPolyline(cubepts)}
            fill="none" stroke={COLOR_CUBE} strokeWidth={2} strokeLinejoin="round" />
        )}

        {/* Highlighted dots at slider r */}
        {showZ2 && (
          <circle cx={xPx(r)} cy={yPx(curR.z2)} r={5}
            fill={COLOR_Z2} stroke="var(--bg)" strokeWidth={2} />
        )}
        {showF2 && (
          <circle cx={xPx(r)} cy={yPx(curR.f2)} r={5}
            fill={COLOR_F2} stroke="var(--bg)" strokeWidth={2} />
        )}
        {showCube && (
          <circle cx={xPx(r)} cy={yPx(curR.cube)} r={5}
            fill={COLOR_CUBE} stroke="var(--bg)" strokeWidth={2} />
        )}

        {/* Legend */}
        {[
          { show: showZ2, color: COLOR_Z2, labelZh: 'Z² (多项式, 次数2)', labelEn: 'Z² (poly, degree 2)'
        },
          { show: showF2, color: COLOR_F2, labelZh: 'F₂ (指数, 速率3)', labelEn: 'F₂ (exp, rate 3)'
        },
          { show: showCube, color: COLOR_CUBE, labelZh: '魔方群 (饱和)', labelEn: 'Cube (saturating)'
        },
        ].filter(it => it.show).map((it, i) => (
          <g key={i} transform={`translate(${PAD.left + 8}, ${PAD.top + 10 + i * 16})`}>
            <line x1={0} y1={0} x2={18} y2={0} stroke={it.color} strokeWidth={2} />
            <circle cx={9} cy={0} r={3} fill={it.color} />
            <text x={22} y={4} style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--ink)">
              {lang === 'zh' ? it.labelZh : it.labelEn}
            </text>
          </g>
        ))}
      </svg>

      {/* Readout */}
      <div className="gt-panel-result" style={{ marginTop: 8 }}>
        <div className="gt-result-row">
          <span className="gt-result-label">r = {r}</span>
          <span className="gt-result-val" />
        </div>
        {showZ2 && (
          <div className="gt-result-row">
            <span className="gt-result-label" style={{ color: COLOR_Z2 }}>β_Z²({r})</span>
            <span className="gt-result-val-strong" style={{ color: COLOR_Z2 }}>
              {betaZ2(r).toLocaleString()}
            </span>
          </div>
        )}
        {showF2 && (
          <div className="gt-result-row">
            <span className="gt-result-label" style={{ color: COLOR_F2 }}>β_F₂({r})</span>
            <span className="gt-result-val-strong" style={{ color: COLOR_F2 }}>
              {betaF2(r).toLocaleString()}
            </span>
          </div>
        )}
        {showCube && (
          <div className="gt-result-row">
            <span className="gt-result-label" style={{ color: COLOR_CUBE }}>
              β_cube({r}) {r >= 16 ? (tr({ zh: '(估计)', en: '(est.)'
            })) : ''}
            </span>
            <span className="gt-result-val-strong" style={{ color: COLOR_CUBE }}>
              {r >= 16
                ? `= |G| = ${CUBE_ORDER_STR}`
                : betaCube(r).toLocaleString()}
            </span>
          </div>
        )}
        {showF2 && r > 0 && (
          <div className="gt-result-row">
            <span className="gt-result-label">
              <L zh="F₂ 局部斜率 log₃(β(r)/β(r-1))" en="F₂ local slope log₃(β(r)/β(r-1))" />
            </span>
            <span className="gt-result-val">
              {r > 0 ? (Math.log(betaF2(r) / betaF2(r - 1)) / Math.log(3)).toFixed(3) : '—'}
              <L zh=" (趋向 1)" en=" (→ 1)" />
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Panel 2: Cube distance distribution bar chart
// ══════════════════════════════════════════════════════════════════════════════

// Estimates for depths 16–20 (order of magnitude; all labelled as estimated)
// Source: cube20.org discussion; treat as approximate
const CUBE_SIGMA_EST: Record<number, number> = {
  16: 1.1e18,   // order estimate
  17: 1.2e19,   // order estimate
  18: 2.9e19,   // modal: order estimate
  19: 1.5e18,   // order estimate
  20: 4.9e8,    // ~490 million (estimate)
};

function CubeDistributionPanel({ lang }: { lang: Lang }) {
  const [logBarScale, setLogBarScale] = useState(true);
  const [showEst, setShowEst] = useState(false);
  const [hoveredR, setHoveredR] = useState<number | null>(null);

  const W = 520;
  const H = 240;
  const PAD = { top: 16, right: 16, bottom: 50, left: 56 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const maxDepth = showEst ? 20 : 15;
  const nBars = maxDepth + 1;
  const barGap = 2;
  const barW = (plotW - (nBars - 1) * barGap) / nBars;

  // All sphere counts (number, may be approximate for 16+)
  const allSigma: number[] = Array.from({ length: 21 }, (_, ri) => {
    if (ri <= 15) return CUBE_SIGMA_EXACT[ri];
    return CUBE_SIGMA_EST[ri] ?? 0;
  });

  const exactMax = Math.max(...CUBE_SIGMA_EXACT.map(Number));
  const globalMax = showEst ? Math.max(...allSigma.filter(v => v > 0)) : exactMax;
  const logGlobalMax = log10safe(globalMax);

  function barHeight(ri: number): number {
    const v = allSigma[ri];
    if (v <= 0) return 0;
    if (logBarScale) {
      return (log10safe(v) / logGlobalMax) * plotH;
    }
    return (v / globalMax) * plotH;
  }

  function barX(ri: number): number {
    return PAD.left + ri * (barW + barGap);
  }

  const hovered = hoveredR !== null ? hoveredR : null;
  const hoveredCount = hovered !== null ? allSigma[hovered] : null;

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="魔方 HTM 距离分布（球面大小 σ(r)）" en="Cube HTM distance distribution (sphere sizes σ(r))" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh={`深度 0–15 为精确值；深度 16–20 为估计值（${showEst ? '当前显示，灰色斜纹标记' : '当前隐藏'}）。众数距离约为 18，距离 20 的状态极为稀少。`}
          en={`Depths 0–15 are exact; depths 16–20 are estimates (${showEst ? 'shown, hatched' : 'hidden'}). Modal distance is about 18; distance-20 states are extremely rare.`}
        />
      </div>

      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <button className={`gt-chip${logBarScale ? ' gt-chip-active' : ''}`} onClick={() => setLogBarScale(s => !s)}>
          <L zh={logBarScale ? '对数高度' : '线性高度'} en={logBarScale ? 'Log height' : 'Linear height'} />
        </button>
        <button className={`gt-chip${showEst ? ' gt-chip-active' : ''}`} onClick={() => setShowEst(s => !s)}>
          <L zh={showEst ? '显示 16-20 (估计值)' : '仅显示 0-15 (精确值)'} en={showEst ? 'Show 16–20 (est.)' : 'Exact only (0–15)'} />
        </button>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%"
        style={{ display: 'block', overflow: 'visible', cursor: 'crosshair', maxWidth: W }}
        onMouseLeave={() => setHoveredR(null)}>

        <defs>
          <pattern id="hatch" width={4} height={4} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1={0} y1={0} x2={0} y2={4} stroke="var(--ink-faint)" strokeWidth={1} />
          </pattern>
        </defs>

        {/* Plot area */}
        <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} fill="var(--bg-elev)" rx={3} />

        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map(frac => {
          const y = PAD.top + plotH - frac * plotH;
          return (
            <line key={frac} x1={PAD.left} y1={y} x2={PAD.left + plotW} y2={y}
              stroke="var(--rule)" strokeWidth={0.5} />
          );
        })}

        {/* Bars */}
        {Array.from({ length: nBars }, (_, ri) => {
          const bh = barHeight(ri);
          const bx = barX(ri);
          const by = PAD.top + plotH - bh;
          const isExact = ri <= 15;
          const isHovered = ri === hoveredR;
          const barColor = isExact
            ? (isHovered ? COLOR_F2 : COLOR_CUBE)
            : (isHovered ? '#9C4E6B' : 'var(--ink-faint)');

          return (
            <g key={ri}
              onMouseEnter={() => setHoveredR(ri)}
              onClick={() => setHoveredR(ri)}
              style={{ cursor: 'pointer' }}>
              {bh > 0 && (
                <>
                  <rect x={bx} y={by} width={barW} height={bh}
                    fill={barColor} opacity={isExact ? 0.85 : 0.45} rx={1} />
                  {!isExact && bh > 0 && (
                    <rect x={bx} y={by} width={barW} height={bh}
                      fill="url(#hatch)" opacity={0.5} rx={1} />
                  )}
                </>
              )}
              {/* X label */}
              <text x={bx + barW / 2} y={PAD.top + plotH + 14} textAnchor="middle"
                style={{ fontFamily: 'var(--mono)', fontSize: 8 }} fill={isHovered ? 'var(--ink)' : 'var(--ink-dim)'}>
                {ri}
              </text>
              {/* Estimate label */}
              {!isExact && bh > 8 && (
                <text x={bx + barW / 2} y={by - 2} textAnchor="middle"
                  style={{ fontFamily: 'var(--mono)', fontSize: 6 }} fill="var(--ink-faint)">
                  ~
                </text>
              )}
            </g>
          );
        })}

        {/* Axis label */}
        <text x={PAD.left + plotW / 2} y={H - 2} textAnchor="middle"
          style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--ink-dim)">
          <L zh="HTM 距离 r" en="HTM distance r" />
        </text>
        <text x={10} y={PAD.top + plotH / 2} textAnchor="middle"
          style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--ink-dim)"
          transform={`rotate(-90, 10, ${PAD.top + plotH / 2})`}>
          σ(r)
        </text>

        {/* Axis border */}
        <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH}
          fill="none" stroke="var(--rule)" strokeWidth={1} />

        {/* Y-axis log ticks */}
        {logBarScale && [0, 5, 10, 15].map(exp => {
          const frac = exp / logGlobalMax;
          if (frac > 1) return null;
          const y = PAD.top + plotH - frac * plotH;
          return (
            <g key={exp}>
              <line x1={PAD.left} y1={y} x2={PAD.left - 4} y2={y} stroke="var(--ink-dim)" strokeWidth={1} />
              <text x={PAD.left - 6} y={y + 3} textAnchor="end"
                style={{ fontFamily: 'var(--mono)', fontSize: 7 }} fill="var(--ink-faint)">
                {exp > 0 ? `10^${exp}` : '1'}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Readout */}
      {hovered !== null && (
        <div className="gt-panel-result" style={{ marginTop: 6 }}>
          <div className="gt-result-row">
            <span className="gt-result-label">
              <L zh={`σ(${hovered}) — 距离恰好 ${hovered} 步`} en={`σ(${hovered}) — states at exactly ${hovered} moves`} />
            </span>
            <span className="gt-result-val-strong" style={{ color: hovered <= 15 ? COLOR_CUBE : 'var(--ink-faint)' }}>
              {hovered <= 15
                ? CUBE_SIGMA_EXACT[hovered].toLocaleString()
                : `~${(CUBE_SIGMA_EST[hovered] ?? 0).toExponential(1)} (${tr({ zh: '估计', en: 'est.'
                })})`}
            </span>
          </div>
          {hoveredCount !== null && hoveredCount > 0 && (
            <div className="gt-result-row">
              <span className="gt-result-label">
                <L zh="占 |G| 的比例" en="Fraction of |G|" />
              </span>
              <span className="gt-result-val">
                {((hoveredCount / CUBE_ORDER) * 100).toExponential(2)}%
              </span>
            </div>
          )}
          {hovered > 15 && (
            <div className="gt-result-row">
              <span className="gt-result-val" style={{ color: 'var(--ink-faint)', fontSize: 12 }}>
                <L
                  zh="⚠ 深度 16–20 的球面大小是估计值，尚未精确枚举。"
                  en="⚠ Sphere sizes at depths 16–20 are estimates, not yet exactly enumerated."
                />
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Panel 3: Geometric explorer — Z² diamond vs F₂ tree
// ══════════════════════════════════════════════════════════════════════════════

type ExplorerView = 'grid' | 'tree';

function GeometricExplorerPanel({ lang }: { lang: Lang }) {
  const [view, setView] = useState<ExplorerView>('grid');
  const [r, setR] = useState(3);

  const maxR = view === 'tree' ? 5 : 7;
  const safeR = Math.min(r, maxR);

  const sphereSize = view === 'grid'
    ? (safeR === 0 ? 1 : 4 * safeR)
    : (safeR === 0 ? 1 : 4 * Math.pow(3, safeR - 1));

  const ballSize = view === 'grid'
    ? betaZ2(safeR)
    : betaF2(safeR);

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="几何直觉: Z² 格点菱形 vs F₂ 树" en="Geometric intuition: Z² diamond vs F₂ tree" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="菱形边界每层线性增长（多项式）；树每层成倍分叉（指数）。"
          en="The diamond boundary grows linearly each level (polynomial); the tree branches by a constant factor each level (exponential)."
        />
      </div>

      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <button
          className={`gt-chip${view === 'grid' ? ' gt-chip-active' : ''}`}
          style={view === 'grid' ? { borderColor: COLOR_Z2, color: COLOR_Z2, background: `color-mix(in srgb, ${COLOR_Z2} 12%, var(--bg))` } : {}}
          onClick={() => setView('grid')}
        >
          Z² <L zh="格点" en="grid" />
        </button>
        <button
          className={`gt-chip${view === 'tree' ? ' gt-chip-active' : ''}`}
          style={view === 'tree' ? { borderColor: COLOR_F2, color: COLOR_F2, background: `color-mix(in srgb, ${COLOR_F2} 12%, var(--bg))` } : {}}
          onClick={() => setView('tree')}
        >
          F₂ <L zh="树" en="tree" />
        </button>
        <label style={{ fontSize: 13, color: 'var(--ink-dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
          r =
          <input
            type="range" min={0} max={maxR} value={safeR}
            onChange={e => setR(Number(e.target.value))}
            style={{ width: 90 }}
          />
          {safeR}
        </label>
      </div>

      {view === 'grid' ? (
        <Z2DiamondSVG r={safeR} lang={lang} />
      ) : (
        <F2TreeSVG r={safeR} lang={lang} />
      )}

      <div className="gt-panel-result">
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="球面大小 σ(r)" en="sphere σ(r)" />
          </span>
          <span className="gt-result-val-strong" style={{ color: view === 'grid' ? COLOR_Z2 : COLOR_F2 }}>
            {sphereSize.toLocaleString()}
            {view === 'grid'
              ? (safeR === 0
                ? ' = 1'
                : ` = 4 × ${safeR}`)
              : (safeR === 0
                ? ' = 1'
                : ` = 4 × 3^${safeR - 1}`)}
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="闭球大小 β(r)" en="ball β(r)" />
          </span>
          <span className="gt-result-val-strong" style={{ color: view === 'grid' ? COLOR_Z2 : COLOR_F2 }}>
            {ballSize.toLocaleString()}
            {view === 'grid'
              ? ` = 2·${safeR}²+2·${safeR}+1`
              : ` = 2·3^${safeR}−1`}
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="增长型" en="growth type" />
          </span>
          <span className="gt-result-val">
            {view === 'grid'
              ? (tr({ zh: '多项式，次数 2 (β ~ r²)', en: 'polynomial, degree 2 (β ~ r²)'
            }))
              : (tr({ zh: '指数，速率 3 (β ~ 3ʳ)', en: 'exponential, rate 3 (β ~ 3ʳ)'
            }))}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Z² diamond SVG ────────────────────────────────────────────────────────────

function Z2DiamondSVG({ r, lang }: { r: number; lang: Lang }) {
  const W = 340;
  const H = 280;
  const cx = W / 2;
  const cy = H / 2;
  const step = Math.min(26, r > 0 ? Math.floor(110 / r) : 26);

  // All lattice points with |x|+|y| <= r
  const dots: { x: number; y: number; dist: number }[] = [];
  for (let x = -r; x <= r; x++) {
    for (let y = -r; y <= r; y++) {
      const dist = Math.abs(x) + Math.abs(y);
      if (dist <= r) dots.push({ x, y, dist });
    }
  }

  // Diamond outline polygon: corners at (±r,0), (0,±r)
  const polyPts = r > 0
    ? [
      [r, 0], [0, r], [-r, 0], [0, -r],
    ].map(([px, py]) => `${cx + px * step},${cy - py * step}`).join(' ')
    : '';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', margin: '12px 0', maxWidth: W }}>
      {/* Axes */}
      <line x1={cx - 120} y1={cy} x2={cx + 120} y2={cy} stroke="var(--rule)" strokeWidth={1} />
      <line x1={cx} y1={cy - 120} x2={cx} y2={cy + 120} stroke="var(--rule)" strokeWidth={1} />
      <text x={cx + 122} y={cy + 4} style={{ fontFamily: 'var(--mono)', fontSize: 10 }} fill="var(--ink-faint)">e₁</text>
      <text x={cx - 4} y={cy - 122} style={{ fontFamily: 'var(--mono)', fontSize: 10 }} fill="var(--ink-faint)">e₂</text>

      {/* Diamond outline */}
      {r > 0 && (
        <polygon points={polyPts}
          fill={`color-mix(in srgb, ${COLOR_Z2} 8%, transparent)`}
          stroke={COLOR_Z2} strokeWidth={1.5} strokeDasharray="4 2" />
      )}

      {/* Dots */}
      {dots.map(({ x, y, dist }) => {
        const px = cx + x * step;
        const py = cy - y * step;
        const onBoundary = dist === r;
        return (
          <circle
            key={`${x}_${y}`}
            cx={px} cy={py} r={onBoundary ? 4 : (dist === 0 ? 5 : 3)}
            fill={dist === 0
              ? 'var(--gold)'
              : onBoundary
              ? COLOR_Z2
              : `color-mix(in srgb, ${COLOR_Z2} 50%, var(--bg-elev))`}
            stroke={dist === 0 ? 'var(--gold)' : 'var(--bg-elev)'}
            strokeWidth={1}
          />
        );
      })}

      {/* Label */}
      <text x={W / 2} y={H - 4} textAnchor="middle"
        style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--ink-faint)">
        |x|+|y| ≤ {r}, {dots.length} {r === 0 ? '' : (tr({ zh: '个点', en: 'pts'
        }))}
      </text>
    </svg>
  );
}

// ── F₂ 4-regular tree SVG ─────────────────────────────────────────────────────

interface TreeNode {
  id: string;
  level: number;
  px: number;
  py: number;
  parentId: string | null;
}

function buildTree(maxR: number, W: number, H: number): TreeNode[] {
  const cx = W / 2;
  const cy = 36;
  const levelH = maxR > 0 ? Math.min(44, (H - 60) / maxR) : 44;

  const nodes: TreeNode[] = [];
  const root: TreeNode = { id: 'r', level: 0, px: cx, py: cy, parentId: null };
  nodes.push(root);

  if (maxR === 0) return nodes;

  // BFS
  const queue: TreeNode[] = [root];
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node.level >= maxR) continue;

    // Determine children count and angles
    const isRoot = node.level === 0;
    const childCount = isRoot ? 4 : 3;

    // Compute a spread of angles below the node
    // For root: 4 children spread across bottom semicircle
    // For non-root: 3 children spread in a cone below
    const parentAngle = node.parentId === null ? -Math.PI / 2 : (() => {
      const parent = nodes.find(n => n.id === node.id.replace(/_\d+$/, '') || n.id === node.parentId);
      if (!parent) return Math.PI / 2;
      return Math.atan2(node.py - parent.py, node.px - parent.px);
    })();

    // Spread angles
    const spreadAngle = isRoot ? Math.PI * 1.8 : Math.PI * 0.7;
    const baseAngle = isRoot ? -Math.PI / 2 - spreadAngle / 2 : parentAngle - spreadAngle / 2;
    const rad = levelH;

    for (let ci = 0; ci < childCount; ci++) {
      const angle = baseAngle + (ci + 0.5) * (spreadAngle / childCount);
      const cpx = node.px + rad * Math.cos(angle);
      const cpy = node.py + rad * Math.sin(angle);
      const child: TreeNode = {
        id: `${node.id}_${ci}`,
        level: node.level + 1,
        px: cpx,
        py: cpy,
        parentId: node.id,
      };
      nodes.push(child);
      queue.push(child);
    }
  }

  return nodes;
}

function F2TreeSVG({ r, lang }: { r: number; lang: Lang }) {
  const W = 340;
  const H = 260;

  const nodes = useMemo(() => buildTree(r, W, H), [r]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', margin: '12px 0', maxWidth: W }}>
      {/* Edges */}
      {nodes.filter(n => n.parentId !== null).map(n => {
        const parent = nodes.find(p => p.id === n.parentId);
        if (!parent) return null;
        const isNew = n.level === r;
        return (
          <line
            key={`e_${n.id}`}
            x1={parent.px} y1={parent.py} x2={n.px} y2={n.py}
            stroke={isNew ? COLOR_F2 : 'var(--ink-dim)'}
            strokeWidth={isNew ? 1.5 : 1}
            opacity={0.7}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map(n => {
        const isNew = n.level === r;
        const isRoot = n.level === 0;
        return (
          <circle
            key={n.id}
            cx={n.px} cy={n.py}
            r={isRoot ? 6 : isNew ? 4 : 3}
            fill={isRoot
              ? 'var(--gold)'
              : isNew
              ? COLOR_F2
              : `color-mix(in srgb, ${COLOR_F2} 40%, var(--bg-elev))`}
            stroke="var(--bg)" strokeWidth={1}
          />
        );
      })}

      {/* Labels */}
      {r > 0 && (
        <text x={W / 2} y={H - 4} textAnchor="middle"
          style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--ink-faint)">
          {lang === 'zh'
            ? `深度 ${r}: ${(r === 0 ? 1 : 4 * Math.pow(3, r - 1)).toLocaleString()} 个节点 (高亮)`
            : `depth ${r}: ${(r === 0 ? 1 : 4 * Math.pow(3, r - 1)).toLocaleString()} nodes (highlighted)`}
        </text>
      )}
    </svg>
  );
}
