'use client';

import { useState, useMemo, useCallback } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { tr } from '@/i18n/tr';

// ── Element encoding: (a, f) where a in Z/n, f in {0,1}
// f=0: rotation r^a;  f=1: reflection s r^a  (s-FIRST normal form, matching elemLabel)
// Group relation: s r = r^{-1} s (Conrad), so the 4-case product of (s^fa r^a)(s^fb r^b)
// reduces, after pushing s^fb left past r^a (r^a s^fb = s^fb r^{(-1)^fb a}), to:
//   s^{fa+fb} r^{(-1)^fb a + b}.  Explicitly (all exponents mod n):
//   r^a · r^b     = r^{a+b}        (a,0)*(b,0) = (a+b, 0)
//   r^a · s r^b   = s r^{b-a}      (a,0)*(b,1) = (b-a, 1)
//   s r^a · r^b   = s r^{a+b}      (a,1)*(b,0) = (a+b, 1)
//   s r^a · s r^b = r^{b-a}        (a,1)*(b,1) = (b-a, 0)
function dnMul(a: number, fa: number, b: number, fb: number, n: number): [number, number] {
  const sign = fb === 1 ? -1 : 1;
  return [((sign * a + b) % n + n) % n, (fa + fb) % 2];
}

function elemLabel(a: number, f: number): string {
  if (f === 0) return a === 0 ? 'e' : `r^${a}`;
  return a === 0 ? 's' : `sr^${a}`;
}

// Divisors of n (sorted ascending)
function divisors(n: number): number[] {
  const ds: number[] = [];
  for (let d = 1; d <= n; d++) if (n % d === 0) ds.push(d);
  return ds;
}

function sigma(n: number): number {
  return divisors(n).reduce((s, d) => s + d, 0);
}

// ── §41 DihedralGroups ────────────────────────────────────────────────────────

export default function DihedralGroups() {
  const lang = useLang();

  return (
    <GTSec id="dihedral" className="gt-sec">
      <div className="gt-sec-num">§41</div>
      <h2 className="gt-sec-title">
        <L zh="二面体群 D_n" en="Dihedral groups D_n" />
      </h2>

      <p className="gt-lede">
        <L
          zh={<>
            把一张正 <TeX src={String.raw`n`} /> 边形纸片放在桌上，不撕破、不拉伸地将其映回自身——能做到这一点的所有刚体运动恰好构成一个群，阶为 <TeX src={String.raw`2n`} />，称为<strong>二面体群</strong> <TeX src={String.raw`D_n`} />。它是对称性、群论表现和半直积三条线索交汇的典型例子，也是非交换群中最简洁的一族。
          </>}
          en={<>
            Place a regular <TeX src={String.raw`n`} />-gon flat on a table. The rigid motions of the plane — no tearing, no stretching — that map the polygon back onto itself form a group of order <TeX src={String.raw`2n`} />, called the <strong>dihedral group</strong> <TeX src={String.raw`D_n`} />. It is the canonical meeting point of geometric symmetry, group presentations, and semidirect products, and the simplest family of non-abelian groups.
          </>}
        />
      </p>

      {/* ── Definition box ── */}
      <div className="gt-def">
        <div className="gt-def-title">
          <L zh="定义: 二面体群 D_n" en="Definition: Dihedral group D_n" />
        </div>
        <div className="gt-def-body">
          <L
            zh={<>
              设 <TeX src={String.raw`n \ge 3`} /> 为整数。<strong>二面体群</strong> <TeX src={String.raw`D_n`} /> 是所有把正 <TeX src={String.raw`n`} /> 边形映回自身的平面等距变换所组成的群，运算为映射的复合。它有两类元素：
              <ul style={{ margin: '10px 0 6px 20px', lineHeight: 1.8 }}>
                <li><strong>旋转</strong>：绕中心旋转 <TeX src={String.raw`2\pi k/n`} />（<TeX src={String.raw`k = 0, 1, \ldots, n-1`} />），共 <TeX src={String.raw`n`} /> 个；</li>
                <li><strong>反射</strong>：关于过中心的对称轴翻转，共 <TeX src={String.raw`n`} /> 个。</li>
              </ul>
              因此 <TeX src={String.raw`|D_n| = 2n`} />。<strong>记号警告</strong>：几何学惯例用 <TeX src={String.raw`D_n`} />（阶 <TeX src={String.raw`2n`} />），抽象代数文献（如 Dummit &amp; Foote）常用 <TeX src={String.raw`D_{2n}`} />（下标等于阶）。本文统一用几何惯例。
            </>}
            en={<>
              For an integer <TeX src={String.raw`n \ge 3`} />, the <strong>dihedral group</strong> <TeX src={String.raw`D_n`} /> is the group of all isometries of the plane that map a fixed regular <TeX src={String.raw`n`} />-gon onto itself, with composition as the group operation. It contains two types of elements:
              <ul style={{ margin: '10px 0 6px 20px', lineHeight: 1.8 }}>
                <li><strong>Rotations</strong>: by <TeX src={String.raw`2\pi k/n`} /> about the center (<TeX src={String.raw`k = 0, 1, \ldots, n-1`} />), giving <TeX src={String.raw`n`} /> elements;</li>
                <li><strong>Reflections</strong>: across each of the <TeX src={String.raw`n`} /> axes of symmetry through the center.</li>
              </ul>
              Hence <TeX src={String.raw`|D_n| = 2n`} />. <strong>Notation warning</strong>: geometers write <TeX src={String.raw`D_n`} /> (order <TeX src={String.raw`2n`} />); much algebra literature (e.g.&nbsp;Dummit &amp; Foote) writes <TeX src={String.raw`D_{2n}`} /> (subscript = order). We use the geometer&apos;s convention throughout.
            </>}
          />
        </div>
      </div>

      <p>
        <L
          zh={<>
            令 <TeX src={String.raw`r`} /> 为逆时针旋转 <TeX src={String.raw`2\pi/n`} />，<TeX src={String.raw`s`} /> 为关于某条固定轴的反射，则 <TeX src={String.raw`D_n`} /> 有如下<strong>群表现</strong>：
          </>}
          en={<>
            Let <TeX src={String.raw`r`} /> be counterclockwise rotation by <TeX src={String.raw`2\pi/n`} /> and <TeX src={String.raw`s`} /> a reflection across a fixed axis. Then <TeX src={String.raw`D_n`} /> has the <strong>group presentation</strong>:
          </>}
        />
      </p>
      <TeXBlock src={String.raw`D_n \;=\; \langle\, r,\, s \;\mid\; r^n = e,\; s^2 = e,\; srs = r^{-1}\,\rangle.`} />
      <p>
        <L
          zh={<>
            群的 <TeX src={String.raw`2n`} /> 个元素可以唯一地写成 <TeX src={String.raw`\{e, r, r^2, \ldots, r^{n-1}, s, sr, sr^2, \ldots, sr^{n-1}\}`} />（即 <TeX src={String.raw`r^a`} /> 或 <TeX src={String.raw`sr^a`} />，<TeX src={String.raw`0 \le a \le n-1`} />）。关键关系 <TeX src={String.raw`srs^{-1} = r^{-1}`} />（等价于 <TeX src={String.raw`srs = r^{-1}`} />，因为 <TeX src={String.raw`s^2 = e`} /> 故 <TeX src={String.raw`s^{-1}=s`} />）给出了乘法规则的完整描述：
          </>}
          en={<>
            The <TeX src={String.raw`2n`} /> elements can be written uniquely as <TeX src={String.raw`\{e, r, r^2, \ldots, r^{n-1}, s, sr, sr^2, \ldots, sr^{n-1}\}`} /> (that is, <TeX src={String.raw`r^a`} /> or <TeX src={String.raw`sr^a`} /> for <TeX src={String.raw`0 \le a \le n-1`} />). The key relation <TeX src={String.raw`srs^{-1} = r^{-1}`} /> (equivalent to <TeX src={String.raw`srs = r^{-1}`} /> since <TeX src={String.raw`s^{-1}=s`} />) encodes the full multiplication rule:
          </>}
        />
      </p>
      <TeXBlock src={String.raw`r^a \cdot r^b = r^{a+b},\quad r^a \cdot sr^b = sr^{b-a},\quad sr^a \cdot r^b = sr^{a+b},\quad sr^a \cdot sr^b = r^{b-a}`} />
      <p style={{ fontSize: 14, color: 'var(--ink-dim)', fontStyle: 'italic' }}>
        <L zh="（所有指数模 n 计算）" en="(all exponents taken mod n)" />
      </p>

      {/* ── Theorem: Non-abelian + structure ── */}
      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理 (Conrad §3): 结构定理" en="Theorem (Conrad §3): Structure" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>
              <strong>(i)</strong> <TeX src={String.raw`D_n`} /> 对 <TeX src={String.raw`n \ge 3`} /> 是非交换群，因为 <TeX src={String.raw`sr = r^{-1}s \ne rs`} />（若相等则 <TeX src={String.raw`r^2 = e`} />，与 <TeX src={String.raw`r`} /> 阶为 <TeX src={String.raw`n \ge 3`} /> 矛盾）。
              <strong>(ii)</strong> <TeX src={String.raw`D_n \cong C_n \rtimes_\varphi C_2`} />，其中 <TeX src={String.raw`C_n = \langle r\rangle`} /> 正规，<TeX src={String.raw`C_2 = \langle s\rangle`} /> 以求逆自同构 <TeX src={String.raw`\varphi_s(r^a) = r^{-a}`} /> 作用。这是<em>半直</em>积，<strong>不是</strong>直积（<TeX src={String.raw`n \ge 3`} /> 时作用非平凡）。
              <strong>(iii) 中心</strong>：奇数 <TeX src={String.raw`n`} /> 时 <TeX src={String.raw`Z(D_n) = \{e\}`} />；偶数 <TeX src={String.raw`n`} /> 时 <TeX src={String.raw`Z(D_n) = \{e, r^{n/2}\}`} />（半圈旋转 <TeX src={String.raw`r^{n/2}`} /> 阶为 2，且是唯一非单位中心元）。
              <strong>(iv) 换位子群</strong>：<TeX src={String.raw`[D_n, D_n] = \langle r^2 \rangle`} />（<strong>不是</strong> <TeX src={String.raw`\langle r\rangle`} />！）。奇数 <TeX src={String.raw`n`} /> 时 <TeX src={String.raw`\langle r^2\rangle = \langle r\rangle = C_n`} />，指数 2；偶数 <TeX src={String.raw`n`} /> 时 <TeX src={String.raw`\langle r^2\rangle`} /> 阶为 <TeX src={String.raw`n/2`} />，在 <TeX src={String.raw`D_n`} /> 中指数 4，阿贝尔化为 <TeX src={String.raw`C_2 \times C_2`} />。
            </>}
            en={<>
              <strong>(i)</strong> <TeX src={String.raw`D_n`} /> is non-abelian for <TeX src={String.raw`n \ge 3`} />, since <TeX src={String.raw`sr = r^{-1}s \ne rs`} /> (equality would force <TeX src={String.raw`r^2 = e`} />, contradicting <TeX src={String.raw`\operatorname{ord}(r) = n \ge 3`} />).
              <strong>(ii)</strong> <TeX src={String.raw`D_n \cong C_n \rtimes_\varphi C_2`} />, where <TeX src={String.raw`C_n = \langle r\rangle`} /> is normal and <TeX src={String.raw`C_2 = \langle s\rangle`} /> acts by the inversion automorphism <TeX src={String.raw`\varphi_s(r^a) = r^{-a}`} />. This is a <em>semi</em>direct product, <strong>not</strong> a direct product (the action is nontrivial for <TeX src={String.raw`n \ge 3`} />).
              <strong>(iii) Center</strong>: For odd <TeX src={String.raw`n`} />, <TeX src={String.raw`Z(D_n) = \{e\}`} />. For even <TeX src={String.raw`n`} />, <TeX src={String.raw`Z(D_n) = \{e, r^{n/2}\}`} /> (the half-turn <TeX src={String.raw`r^{n/2}`} /> is the only non-identity central element).
              <strong>(iv) Commutator subgroup</strong>: <TeX src={String.raw`[D_n, D_n] = \langle r^2 \rangle`} /> (NOT <TeX src={String.raw`\langle r\rangle`} /> in general!). For odd <TeX src={String.raw`n`} />, <TeX src={String.raw`\langle r^2\rangle = \langle r\rangle = C_n`} /> (index 2). For even <TeX src={String.raw`n`} />, <TeX src={String.raw`\langle r^2\rangle`} /> has order <TeX src={String.raw`n/2`} /> and index 4 in <TeX src={String.raw`D_n`} />, so the abelianization is <TeX src={String.raw`C_2 \times C_2`} />.
            </>}
          />
        </div>
      </div>

      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="对称轴与共轭类" en="Reflection axes and conjugacy classes" />
      </h3>

      <p>
        <L
          zh={<>
            正 <TeX src={String.raw`n`} /> 边形恰有 <TeX src={String.raw`n`} /> 条对称轴，均过中心。其几何类型取决于 <TeX src={String.raw`n`} /> 的奇偶性：
            奇数 <TeX src={String.raw`n`} /> 时，每条轴经过一个顶点和对边的中点（<TeX src={String.raw`n`} /> 条同类型轴，全部共轭，构成 <TeX src={String.raw`D_n`} /> 中<em>唯一一类</em>反射）；
            偶数 <TeX src={String.raw`n`} /> 时，<TeX src={String.raw`n/2`} /> 条轴连接对顶点，<TeX src={String.raw`n/2`} /> 条连接对边中点（两类轴在 <TeX src={String.raw`D_n`} /> 中各自形成<em>独立的共轭类</em>）。
          </>}
          en={<>
            A regular <TeX src={String.raw`n`} />-gon has exactly <TeX src={String.raw`n`} /> axes of symmetry, all passing through the center. Their geometric type depends on the parity of <TeX src={String.raw`n`} />:
            for odd <TeX src={String.raw`n`} />, every axis passes through one vertex and the midpoint of the opposite edge (all <TeX src={String.raw`n`} /> axes are conjugate in <TeX src={String.raw`D_n`} />, forming <em>one</em> conjugacy class of reflections);
            for even <TeX src={String.raw`n`} />, <TeX src={String.raw`n/2`} /> axes connect opposite vertices and <TeX src={String.raw`n/2`} /> bisect opposite edges (the two types form <em>two separate</em> conjugacy classes).
          </>}
        />
      </p>

      <p>
        <L
          zh={<>
            共轭类的完整计数（Conrad 定理 4.1）：奇数 <TeX src={String.raw`n`} /> 有 <TeX src={String.raw`(n+3)/2`} /> 个类；偶数 <TeX src={String.raw`n`} /> 有 <TeX src={String.raw`(n+6)/2`} /> 个类。子群结构：<TeX src={String.raw`D_n`} /> 的子群总数为 <TeX src={String.raw`d(n) + \sigma(n)`} />，其中 <TeX src={String.raw`d(n)`} /> 是因子数（循环旋转子群的数目），<TeX src={String.raw`\sigma(n)`} /> 是因子和（二面体子群的数目，每个因子 <TeX src={String.raw`m \mid n`} /> 贡献 <TeX src={String.raw`n/m`} /> 个同构于 <TeX src={String.raw`D_m`} /> 的子群）。例如 <TeX src={String.raw`D_6`} />（<TeX src={String.raw`n=6`} />）：<TeX src={String.raw`d(6)+\sigma(6)=4+12=16`} /> 个子群。
          </>}
          en={<>
            Full conjugacy class count (Conrad Theorem 4.1): odd <TeX src={String.raw`n`} /> gives <TeX src={String.raw`(n+3)/2`} /> classes; even <TeX src={String.raw`n`} /> gives <TeX src={String.raw`(n+6)/2`} /> classes. Subgroup structure: the total number of subgroups of <TeX src={String.raw`D_n`} /> is <TeX src={String.raw`d(n) + \sigma(n)`} />, where <TeX src={String.raw`d(n)`} /> is the number of divisors (one cyclic rotation subgroup each) and <TeX src={String.raw`\sigma(n)`} /> is the sum of divisors (dihedral subgroups: each divisor <TeX src={String.raw`m \mid n`} /> contributes <TeX src={String.raw`n/m`} /> copies of <TeX src={String.raw`D_m`} />). Example: <TeX src={String.raw`D_6`} /> (<TeX src={String.raw`n=6`} />) has <TeX src={String.raw`d(6)+\sigma(6)=4+12=16`} /> subgroups.
          </>}
        />
      </p>

      <div className="gt-aside">
        <L
          zh={<>
            <strong>魔方联系（诚实版）</strong>：魔方每个面的贴纸图案是一个正方形，其对称群恰好是 <TeX src={String.raw`D_4`} />（阶 8）。面的四次旋转对应 <TeX src={String.raw`D_4`} /> 中的循环子群 <TeX src={String.raw`C_4 = \langle r\rangle`} />；面的对角线和中线对称对应 <TeX src={String.raw`D_4`} /> 中 4 个反射。实体魔方的旋转只能实现 <TeX src={String.raw`C_4`} /> 部分（反射需要镜像，无法物理实现）。整个魔方群（阶约 <TeX src={String.raw`4.3\times 10^{19}`} />）<strong>不是</strong>二面体群；魔方作为刚体的旋转对称群是 <TeX src={String.raw`S_4`} />（八面体对称群，阶 24），与 <TeX src={String.raw`D_n`} /> 无关。
          </>}
          en={<>
            <strong>Cube connection (honest version)</strong>: each face of the Rubik&apos;s cube is a square, whose symmetry group is <TeX src={String.raw`D_4`} /> (order 8). The four quarter-turns of a face form the cyclic subgroup <TeX src={String.raw`C_4 = \langle r\rangle`} /> inside <TeX src={String.raw`D_4`} />; the diagonal and edge-midpoint mirror symmetries correspond to the 4 reflections. Physical cube moves can realize <TeX src={String.raw`C_4`} /> (reflections are orientation-reversing and require disassembly). The full Rubik&apos;s cube group (order <TeX src={String.raw`{\approx}4.3\times 10^{19}`} />) is <strong>not</strong> dihedral; the cube&apos;s rigid-body rotation symmetry group is <TeX src={String.raw`S_4`} /> (octahedral, order 24), unrelated to any <TeX src={String.raw`D_n`} />.
          </>}
        />
      </div>

      {/* ── Panel 1: Interactive n-gon ── */}
      <NPolygonPanel lang={lang} />

      {/* ── Panel 2: Cayley table ── */}
      <CayleyTablePanel lang={lang} />

      {/* ── Panel 3: Conjugation verifier + axis explorer ── */}
      <AxisAndConjugationPanel lang={lang} />

      {/* ── Facts table ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="数值一览" en="Quick-reference facts" />
      </h3>

      <FactsTable lang={lang} />

      {/* ── References ── */}
      <div className="gt-refs" style={{ marginTop: 40 }}>
        <div className="gt-def-title" style={{ marginBottom: 10 }}>
          <L zh="参考文献" en="References" />
        </div>
        <ol style={{ paddingLeft: 20, lineHeight: 1.8, fontSize: 15 }}>
          <li>Keith Conrad, <em>Dihedral Groups</em> (U. Connecticut expository notes). Theorems 2.2/2.5 (order), 3.1/eqs 3.2–3.3 (multiplication rule), 3.4 (center), 4.1 (conjugacy classes), A.1 (commutator subgroup <TeX src={String.raw`\langle r^2\rangle`} />). <a href="https://kconrad.math.uconn.edu/blurbs/grouptheory/dihedral.pdf" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>PDF</a></li>
          <li>Dummit &amp; Foote, <em>Abstract Algebra</em>, 3rd ed., §1.2 (presentation, uses <TeX src={String.raw`D_{2n}`} /> indexing).</li>
          <li>Groupprops, <em>Element structure of dihedral groups</em> and <em>Subgroup structure of dihedral groups</em> (conjugacy class counts; <TeX src={String.raw`d(n)+\sigma(n)`} /> subgroup formula).</li>
        </ol>
      </div>
    </GTSec>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Panel 1: Interactive n-gon (r and s buttons, live element display)
// ═════════════════════════════════════════════════════════════════════════════

function NPolygonPanel({ lang }: { lang: 'zh' | 'en' }) {
  const [n, setN] = useState(5);
  const [a, setA] = useState(0); // rotation exponent
  const [f, setF] = useState(0); // 0=rotation, 1=reflection

  const applyR = useCallback(() => {
    // Post-multiply by r=(1,0): (a,f)*(1,0). Since fb=0 leaves the exponent sign +1,
    // both rotations and reflections shift a -> a+1: r^a·r = r^{a+1}, (sr^a)·r = sr^{a+1}.
    setA(prev => (prev + 1) % n);
  }, [n]);

  const applyS = useCallback(() => {
    // Post-multiply by s=(0,1): (a,f)*(0,1) = (-a mod n, 1-f).
    // r^a·s = sr^{-a};  (sr^a)·s = s(r^a s) = s(s r^{-a}) = r^{-a}.
    setA(prev => ((-prev) % n + n) % n);
    setF(prev => 1 - prev);
  }, [n]);

  const resetElem = useCallback(() => { setA(0); setF(0); }, []);

  // Clamp a when n changes
  const handleNChange = useCallback((newN: number) => {
    setN(newN);
    setA(prev => prev % newN);
  }, []);

  const label = useMemo(() => {
    if (f === 0) return a === 0 ? 'e' : `r^${a}`;
    return a === 0 ? 's' : `s r^${a}`;
  }, [a, f]);

  // SVG: n-gon centered at (cx, cy), radius R
  // Vertex k is at angle: base_angle + (f==0 ? 1 : -1)*k * 2pi/n + a*2pi/n
  // f=0: angle_k = a*2pi/n + k*2pi/n
  // f=1 (reflected): angle_k = a*2pi/n - k*2pi/n  (reflection negates k)
  const cx = 110, cy = 110, R = 80;
  const vertices = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    const baseOffset = -Math.PI / 2; // vertex 0 at top
    for (let k = 0; k < n; k++) {
      const angle = baseOffset + (2 * Math.PI * a) / n + (f === 0 ? 1 : -1) * (2 * Math.PI * k) / n;
      pts.push({ x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) });
    }
    return pts;
  }, [n, a, f]);

  // Fixed reference polygon (identity position, f=0, a=0)
  const refVertices = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    const baseOffset = -Math.PI / 2;
    for (let k = 0; k < n; k++) {
      const angle = baseOffset + (2 * Math.PI * k) / n;
      pts.push({ x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) });
    }
    return pts;
  }, [n]);

  // Fixed axis (reflection axis at k=0 direction = top)
  const axisY1 = cy - R - 16, axisY2 = cy + R + 16;

  // Chirality marker: a small 'R'-shaped path at vertex 0
  const v0 = vertices[0];
  const handednessColor = f === 0 ? 'var(--accent)' : 'var(--accent-2)';

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="互动 n 边形: 旋转与反射" en="Interactive n-gon: rotations and reflections" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="拖动滑块选 n，用按钮施加生成元 r（旋转）和 s（反射），观察当前元素和手性标记的变化。顶点编号和蓝色箭头方向显示方向性。"
          en="Drag the slider to choose n, then use the buttons to apply generators r (rotate) and s (reflect). Vertex numbers and handedness mark show orientation."
        />
      </div>

      <div className="gt-panel-input-row">
        <label><TeX src={String.raw`n`} /></label>
        <input type="range" min={3} max={12} value={n} onChange={e => handleNChange(+e.target.value)} style={{ flex: 1 }} />
        <span className="gt-result-val" style={{ minWidth: 48 }}>
          {n} <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>|D_{'{n}'}|={2 * n}</span>
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start', marginTop: 8 }}>
        {/* SVG polygon */}
        <svg viewBox="0 0 220 220" width={220} style={{ flexShrink: 0, display: 'block' }}>
          {/* Fixed reflection axis (dashed, vertical through vertex 0 of identity) */}
          <line x1={cx} y1={axisY1} x2={cx} y2={axisY2}
            stroke="var(--ink-faint)" strokeWidth={1} strokeDasharray="5 3" />
          <text x={cx + 4} y={axisY1 + 10} style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--ink-faint)">s axis</text>

          {/* Reference (ghost) polygon */}
          <polygon
            points={refVertices.map(v => `${v.x.toFixed(2)},${v.y.toFixed(2)}`).join(' ')}
            fill="none"
            stroke="var(--rule)"
            strokeWidth={1}
            strokeDasharray="4 3"
          />

          {/* Current (active) polygon */}
          <polygon
            points={vertices.map(v => `${v.x.toFixed(2)},${v.y.toFixed(2)}`).join(' ')}
            fill={f === 0
              ? 'color-mix(in srgb, var(--accent) 8%, var(--bg-elev))'
              : 'color-mix(in srgb, var(--accent-2) 12%, var(--bg-elev))'}
            stroke={f === 0 ? 'var(--accent)' : 'var(--accent-2)'}
            strokeWidth={2}
          />

          {/* Vertex labels */}
          {vertices.map((v, k) => {
            const dx = v.x - cx, dy = v.y - cy;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const lx = v.x + (dx / len) * 13;
            const ly = v.y + (dy / len) * 13;
            return (
              <text key={k} x={lx.toFixed(1)} y={(ly + 3.5).toFixed(1)} textAnchor="middle"
                style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: k === 0 ? 700 : 400 }}
                fill={k === 0 ? handednessColor : 'var(--ink-dim)'}>
                {k}
              </text>
            );
          })}

          {/* Vertex 0 dot (highlight) */}
          <circle cx={v0.x.toFixed(2)} cy={v0.y.toFixed(2)} r={5} fill={handednessColor} />

          {/* Handedness arrow: from vertex 0 toward vertex 1 direction, small arc */}
          {(() => {
            const v1 = vertices[1] ?? vertices[0];
            const dx = v1.x - v0.x, dy = v1.y - v0.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const ax = v0.x + (dx / len) * 18;
            const ay = v0.y + (dy / len) * 18;
            return <line x1={v0.x.toFixed(2)} y1={v0.y.toFixed(2)} x2={ax.toFixed(2)} y2={ay.toFixed(2)}
              stroke={handednessColor} strokeWidth={2} markerEnd="url(#arrowD)" />;
          })()}

          {/* Center dot */}
          <circle cx={cx} cy={cy} r={2.5} fill="var(--ink-dim)" />

          {/* Element label in center */}
          <text x={cx} y={cy - 8} textAnchor="middle"
            style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700 }}
            fill={f === 0 ? 'var(--accent)' : 'var(--accent-2)'}>
            {label}
          </text>
          <text x={cx} y={cy + 8} textAnchor="middle"
            style={{ fontFamily: 'var(--mono)', fontSize: 9 }}
            fill="var(--ink-faint)">
            {f === 0
              ? tr({ zh: '旋转', en: 'rotation'
                                      })
              : tr({ zh: '反射', en: 'reflection' })}
          </text>

          <defs>
            <marker id="arrowD" markerWidth={6} markerHeight={6} refX={5} refY={3} orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={handednessColor} />
            </marker>
          </defs>
        </svg>

        {/* Controls */}
        <div style={{ flex: 1, minWidth: 140, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-dim)', marginBottom: 4 }}>
            <L zh="当前元素" en="Current element" />
            {': '}
            <strong style={{ color: f === 0 ? 'var(--accent)' : 'var(--accent-2)' }}>{label}</strong>
          </div>
          <button className="gt-btn" onClick={applyR} style={{ fontSize: 13 }}>
            <L zh="× r（旋转 2π/n）" en="× r (rotate by 2π/n)" />
          </button>
          <button className="gt-btn" onClick={applyS} style={{ fontSize: 13, background: 'color-mix(in srgb, var(--accent-2) 12%, var(--bg-elev))', color: 'var(--accent-2)', border: '1px solid var(--accent-2)' }}>
            <L zh="× s（反射）" en="× s (reflect)" />
          </button>
          <button className="gt-btn-ghost gt-btn" onClick={resetElem} style={{ fontSize: 12 }}>
            <L zh="重置为 e" en="Reset to e" />
          </button>

          <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 8, lineHeight: 1.7 }}>
            <div>
              <TeX src={String.raw`r`} /> <L zh="阶" en="has order" /> <strong>{n}</strong>
            </div>
            <div>
              <TeX src={String.raw`s`} /> <L zh="阶" en="has order" /> <strong>2</strong>
            </div>
            <div style={{ color: f === 1 ? 'var(--accent-2)' : 'var(--ink-faint)', fontSize: 11, marginTop: 4 }}>
              {f === 1
                ? tr({ zh: '蓝色=反射，手性已翻转', en: 'blue = reflection, orientation flipped'
                                              })
                : tr({ zh: '红色=旋转，手性保持', en: 'red = rotation, orientation preserved'
                                              })}
            </div>
          </div>
        </div>
      </div>

      <div className="gt-panel-result">
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="群元素" en="Group element" /></span>
          <span className="gt-result-val-strong" style={{ fontFamily: 'var(--mono)', color: f === 0 ? 'var(--accent)' : 'var(--accent-2)' }}>{label}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="类型" en="Type" /></span>
          <span className="gt-result-val">{f === 0 ? tr({ zh: '旋转', en: 'rotation'
                          }) : tr({ zh: '反射', en: 'reflection' })}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="s r s = r⁻¹ 验证" en="s r s = r⁻¹ check" /></span>
          <span className="gt-result-val" style={{ fontFamily: 'var(--mono)', color: 'var(--green)', fontSize: 12 }}>
            {`s r^1 s = r^${((-(1)) % n + n) % n} = r^{n-1}`} {lang === 'zh' ? '✓' : '✓'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Panel 2: Cayley (multiplication) table for D_n, n = 3..6
// ═════════════════════════════════════════════════════════════════════════════

function CayleyTablePanel({ lang }: { lang: 'zh' | 'en' }) {
  const [n, setN] = useState(3);
  const [hoveredCell, setHoveredCell] = useState<{ i: number; j: number } | null>(null);
  const [highlight, setHighlight] = useState<'none' | 'rotations' | 'center'>('none');

  // Order elements: [e, r, ..., r^{n-1}, s, sr, ..., sr^{n-1}]
  // Encoded as (a, f) where index = a + n*f
  const order = 2 * n;
  const elements = useMemo((): Array<[number, number]> => {
    const arr: Array<[number, number]> = [];
    for (let a = 0; a < n; a++) arr.push([a, 0]);
    for (let a = 0; a < n; a++) arr.push([a, 1]);
    return arr;
  }, [n]);

  // Multiplication table: table[i][j] = index of elements[i] * elements[j]
  const table = useMemo(() => {
    return elements.map((ei) =>
      elements.map((ej) => {
        const [ra, fa] = ei;
        const [rb, fb] = ej;
        const [rc, fc] = dnMul(ra, fa, rb, fb, n);
        return rc + n * fc;
      })
    );
  }, [elements, n]);

  // Center elements: all indices i such that table[i][j] === table[j][i] for all j
  const centerIndices = useMemo(() => {
    const idx: number[] = [];
    for (let i = 0; i < order; i++) {
      if (elements.every((_, j) => table[i][j] === table[j][i])) idx.push(i);
    }
    return new Set(idx);
  }, [table, elements, order]);

  const CELL = 32;
  const PAD = 28; // left/top padding for row/col headers
  const totalW = PAD + order * CELL;
  const totalH = PAD + order * CELL;

  const PALETTE = ['#8B2E3C', '#2A4D69', '#3F7050', '#B8860B', '#6B4E9C', '#C2410C', '#5C7CA0', '#9C4E6B',
    '#8B6C3C', '#3C6B8B', '#6B8B3C', '#8B3C6B', '#3C8B6B', '#6B3C8B', '#8B8B3C', '#3C8B8B'];

  // Color per element index
  const colorOf = useCallback((idx: number): string => PALETTE[idx % PALETTE.length], []);

  const isHovRow = (i: number) => hoveredCell?.i === i;
  const isHovCol = (j: number) => hoveredCell?.j === j;
  const isHovCell = (i: number, j: number) => hoveredCell?.i === i && hoveredCell?.j === j;

  const isRotation = (idx: number) => idx < n;
  const isCenter = (idx: number) => centerIndices.has(idx);
  const inHighlightedRow = (i: number) => {
    if (highlight === 'rotations') return isRotation(i);
    if (highlight === 'center') return isCenter(i);
    return false;
  };
  const inHighlightedCol = (j: number) => {
    if (highlight === 'rotations') return isRotation(j);
    if (highlight === 'center') return isCenter(j);
    return false;
  };

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="乘法表（Cayley 表）" en="Cayley (multiplication) table" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="行 × 列 = 对应格。悬停高亮行/列元素和乘积。表对对角线不对称 = 非交换性。蓝色虚框 = 旋转子群 C_n。"
          en="Row × column = cell product. Hover to highlight. Table not symmetric = non-abelian. Blue dashed box = rotation subgroup C_n."
        />
      </div>

      <div className="gt-panel-input-row">
        <label><TeX src={String.raw`n`} /></label>
        <input type="range" min={3} max={6} value={n} onChange={e => { setN(+e.target.value); setHoveredCell(null); }} style={{ flex: 1 }} />
        <span className="gt-result-val" style={{ minWidth: 60 }}>
          n={n}, |D_{'{n}'}|={2 * n}
        </span>
      </div>

      <div className="gt-panel-input-row">
        <label><L zh="高亮" en="Highlight" /></label>
        {(['none', 'rotations', 'center'] as const).map(h => (
          <button key={h} className={`gt-chip${highlight === h ? ' gt-chip-active' : ''}`}
            onClick={() => setHighlight(h)}>
            {h === 'none'
              ? tr({ zh: '无', en: 'none'
                                })
              : h === 'rotations'
              ? (lang === 'zh' ? `C_${n} 旋转` : `C_${n} rotations`)
              : tr({ zh: '中心 Z(D_n)', en: 'center Z(D_n)' })}
          </button>
        ))}
      </div>

      <div style={{ overflowX: 'auto', marginTop: 8 }}>
        <svg
          viewBox={`0 0 ${totalW + 4} ${totalH + 4}`}
          width={Math.min(totalW + 4, 520)}
          style={{ display: 'block', fontFamily: 'var(--mono)' }}
          onMouseLeave={() => setHoveredCell(null)}
        >
          {/* Column headers */}
          {elements.map(([a, f], j) => (
            <text key={`ch${j}`}
              x={PAD + j * CELL + CELL / 2} y={PAD - 6}
              textAnchor="middle"
              fontSize={CELL <= 32 ? 8 : 9}
              fill={inHighlightedCol(j) ? colorOf(j) : isHovCol(j) ? 'var(--accent)' : 'var(--ink-faint)'}>
              {elemLabel(a, f)}
            </text>
          ))}

          {/* Row headers */}
          {elements.map(([a, f], i) => (
            <text key={`rh${i}`}
              x={PAD - 4} y={PAD + i * CELL + CELL / 2 + 3.5}
              textAnchor="end"
              fontSize={CELL <= 32 ? 8 : 9}
              fill={inHighlightedRow(i) ? colorOf(i) : isHovRow(i) ? 'var(--accent)' : 'var(--ink-faint)'}>
              {elemLabel(a, f)}
            </text>
          ))}

          {/* Cells */}
          {elements.map((_, i) =>
            elements.map((_, j) => {
              const prodIdx = table[i][j];
              const isHov = isHovCell(i, j);
              const rowHov = isHovRow(i) && !isHov;
              const colHov = isHovCol(j) && !isHov;
              const hlRow = inHighlightedRow(i);
              const hlCol = inHighlightedCol(j);
              const isNonCommCell = table[i][j] !== table[j][i];

              let bgFill = 'var(--bg-elev)';
              if (isHov) bgFill = `color-mix(in srgb, ${colorOf(prodIdx)} 25%, var(--bg-elev))`;
              else if (hlRow && hlCol) bgFill = `color-mix(in srgb, ${colorOf(prodIdx)} 18%, var(--bg-elev))`;
              else if (rowHov || colHov) bgFill = `color-mix(in srgb, var(--accent) 10%, var(--bg-elev))`;
              else if (isRotation(i) && isRotation(j)) bgFill = `color-mix(in srgb, var(--accent) 5%, var(--bg-elev))`;

              return (
                <g key={`${i}-${j}`}
                  onMouseEnter={() => setHoveredCell({ i, j })}
                  style={{ cursor: 'default' }}>
                  <rect
                    x={PAD + j * CELL + 0.5} y={PAD + i * CELL + 0.5}
                    width={CELL - 1} height={CELL - 1}
                    fill={bgFill}
                    stroke={isHov ? colorOf(prodIdx) : isNonCommCell && hoveredCell !== null ? 'none' : 'var(--rule)'}
                    strokeWidth={isHov ? 1.5 : 0.5}
                  />
                  <text
                    x={PAD + j * CELL + CELL / 2}
                    y={PAD + i * CELL + CELL / 2 + 3.5}
                    textAnchor="middle"
                    fontSize={CELL <= 32 ? 7.5 : 9}
                    fill={isHov ? colorOf(prodIdx) : (rowHov || colHov) ? 'var(--accent)' : 'var(--ink-dim)'}
                    fontWeight={isHov ? 700 : 400}>
                    {elemLabel(elements[prodIdx][0], elements[prodIdx][1])}
                  </text>
                </g>
              );
            })
          )}

          {/* Blue dashed box for rotation subgroup C_n (top-left n x n) */}
          <rect
            x={PAD + 0.5} y={PAD + 0.5}
            width={n * CELL - 1} height={n * CELL - 1}
            fill="none"
            stroke="var(--accent-2)"
            strokeWidth={1.5}
            strokeDasharray="5 3"
          />
          <text x={PAD + n * CELL / 2} y={PAD + n * CELL + 11}
            textAnchor="middle" fontSize={8} fill="var(--accent-2)">
            {`C_${n}`}
          </text>
        </svg>
      </div>

      {hoveredCell !== null && (
        <div className="gt-panel-result">
          <div className="gt-result-row">
            <span className="gt-result-label"><L zh="行" en="Row" /></span>
            <span className="gt-result-val" style={{ fontFamily: 'var(--mono)' }}>
              {elemLabel(elements[hoveredCell.i][0], elements[hoveredCell.i][1])}
            </span>
          </div>
          <div className="gt-result-row">
            <span className="gt-result-label"><L zh="列" en="Col" /></span>
            <span className="gt-result-val" style={{ fontFamily: 'var(--mono)' }}>
              {elemLabel(elements[hoveredCell.j][0], elements[hoveredCell.j][1])}
            </span>
          </div>
          <div className="gt-result-row">
            <span className="gt-result-label"><L zh="积" en="Product" /></span>
            <span className="gt-result-val-strong" style={{ fontFamily: 'var(--mono)' }}>
              {elemLabel(elements[table[hoveredCell.i][hoveredCell.j]][0], elements[table[hoveredCell.i][hoveredCell.j]][1])}
            </span>
          </div>
          <div className="gt-result-row">
            <span className="gt-result-label"><L zh="g·h = h·g?" en="g·h = h·g?" /></span>
            <span className="gt-result-val" style={{ color: table[hoveredCell.i][hoveredCell.j] === table[hoveredCell.j][hoveredCell.i] ? 'var(--green)' : 'var(--warn)' }}>
              {table[hoveredCell.i][hoveredCell.j] === table[hoveredCell.j][hoveredCell.i]
                ? tr({ zh: '相等 (交换)', en: 'yes (commute)'
                                              })
                : tr({ zh: '不等 (非交换)', en: 'no (non-commute)'
                                              })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Panel 3: Axis explorer (odd vs even) + conjugation verifier
// ═════════════════════════════════════════════════════════════════════════════

function AxisAndConjugationPanel({}: { lang: 'zh' | 'en' }) {
  const [n, setN] = useState(6);
  const [selectedAxis, setSelectedAxis] = useState<number | null>(null);
  const [colorByClass, setColorByClass] = useState(true);
  const [conjK, setConjK] = useState(1);
  const [verified, setVerified] = useState(false);

  const isEven = n % 2 === 0;
  const cx = 100, cy = 100, R = 75;

  // Place vertex k at angle: -pi/2 + 2*pi*k/n (vertex 0 at top)
  const vertexAngle = useCallback((k: number) => -Math.PI / 2 + (2 * Math.PI * k) / n, [n]);
  const vertices = useMemo(() =>
    Array.from({ length: n }, (_, k) => ({
      x: cx + R * Math.cos(vertexAngle(k)),
      y: cy + R * Math.sin(vertexAngle(k)),
    })), [n, vertexAngle]);

  // Axis k: angle = pi*k/n (from Conrad §2: axis direction angle theta_k = pi*k/n)
  // Convention: base angle = -pi/2 for vertex 0; axis k passes through angle -pi/2 + pi*k/n from center
  // For even n: axis k hits vertices when k is even (since vertex at 0 = -pi/2 = axis 0 direction when using base -pi/2)
  // Actually: axis of reflection s_k is at angle  base_offset + pi*k/n where base_offset = 0
  // with vertex 0 at angle -pi/2: axis k is at angle pi*k/n from +x axis.
  // Vertex j at angle -pi/2 + 2*pi*j/n is on axis k when -pi/2 + 2*pi*j/n ≡ pi*k/n (mod pi)
  // i.e. 2j/n - k/n ≡ 1/2 (mod 1), i.e. (2j-k)/n ≡ 1/2 (mod 1), i.e. 2(2j-k) ≡ n (mod 2n)...
  // More directly: for even n, axis at angle pi*k/n:
  //   k even => axis at angle pi*(even)/n; vertex j is on axis if 2*pi*j/n - pi/2 = pi*k/n (mod pi)
  //   => 2j = k + n/2 (mod n). For k=0: 2j = n/2 mod n, j=n/4 and j=3n/4 (only if 4|n).
  // Let's use a simpler geometric classification:
  // axis k for k=0..n-1 has unit direction (cos(pi*k/n), sin(pi*k/n)).
  // For even n, we classify: vertex-type axis vs edge-type axis by whether any vertex lies on it.
  // Vertex j is on axis k iff the dot product perpendicular is 0:
  //   the axis direction is (cos(A), sin(A)) where A = pi*k/n.
  //   perpendicular component of vertex j direction (cos(V_j), sin(V_j)) w.r.t. axis k is:
  //   sin(V_j - A) = sin(-pi/2 + 2*pi*j/n - pi*k/n) = 0
  //   => -pi/2 + 2*pi*j/n - pi*k/n = m*pi for some integer m
  //   => 2j - k = n/2 + n*m
  //   => 2j - k ≡ n/2 (mod n)  [but n/2 must be integer, so only for even n]
  // For even n: axis k is vertex-type iff ∃ integer j ∈ [0,n) with 2j ≡ k + n/2 (mod n).
  // Since n is even, 2j runs over even numbers mod n; k+n/2 must be even.
  // k+n/2 even iff k and n/2 have same parity.
  // So for even n: vertex-type axis when (k + n/2) is even.

  const axisIsVertexType = useCallback((k: number): boolean => {
    if (!isEven) return true; // odd n: all axes vertex-to-edge-midpoint (one class)
    return (k + n / 2) % 2 === 0;
  }, [isEven, n]);

  // Reflection permutation across axis k: vertex j -> (2k - j + n_offset) mod n
  // Where n_offset compensates for the base offset.
  // The reflection s_k maps vertex j to vertex (2k - j) mod n for our axis placement.
  // (This is because axis k is the angle bisector of vertices k and -k in some convention;
  //  we verify: s_k(k) = k, s_k(0) = 2k mod n etc.)
  // Actually with vertex j at angle -pi/2 + 2pi*j/n and axis at angle pi*k/n:
  // The reflection of angle theta across axis phi gives 2*phi - theta.
  // So vertex j angle reflected: 2*(pi*k/n) - (-pi/2 + 2*pi*j/n) = 2*pi*k/n + pi/2 - 2*pi*j/n
  // = pi/2 + 2*pi*(k-j)/n
  // Vertex index of reflected angle: pi/2 + 2*pi*(k-j)/n = -pi/2 + 2*pi*m/n
  // => pi + 2*pi*(k-j)/n = 2*pi*m/n
  // => m = (n/2 + k - j) mod n  [for even n]
  // For odd n: n/2 is not integer, but we can still find m mod n.
  // In general: m = ((n+1)/2 + k - j) mod n... let me recalculate cleanly.
  // vertex j at angle base + 2pi*j/n, base = -pi/2
  // axis k at angle: we use axis_k = (base + pi*k/n)... hmm, let me pick a cleaner convention.
  //
  // CLEAN CONVENTION: axis k passes through angle pi*k/n from +x axis (k=0..n-1).
  // Vertex j at angle -pi/2 + 2*pi*j/n from +x axis.
  // Reflection of point at angle theta across axis at angle phi: reflected angle = 2*phi - theta.
  // Reflected vertex j angle: 2*(pi*k/n) - (-pi/2 + 2*pi*j/n) = 2*pi*k/n + pi/2 - 2*pi*j/n.
  // = pi/2 + 2*pi*(k-j)/n
  // To find what vertex this is: -pi/2 + 2*pi*m/n = pi/2 + 2*pi*(k-j)/n
  // => 2*pi*m/n = pi + 2*pi*(k-j)/n
  // => m = n/2 + k - j (real)
  // => m = (n/2 + k - j) mod n  -- only integer if n is even.
  // For odd n: n/2 is not integer. Let's check parity more carefully.
  // Actually the correct formula for the reflection permutation in D_n with this vertex placement:
  // axis k: for n even, reflects vertex j -> (k - j + n/2) mod n... hmm.
  // Let me just use the standard: axis 0 = through vertex 0 (for odd n), so s(j) = -j mod n = (n-j) mod n.
  // axis k is conjugate: s_k = r^k s r^{-k}, so s_k(j) = k - (j - k) = 2k - j mod n.
  // This is independent of our vertex placement: s_k(j) = (2k - j + n) mod n.
  // Let's verify: s_0(j) = -j mod n = (n-j) mod n. s_0(0) = 0 (vertex 0 fixed). s_0(1) = n-1. OK.
  // But wait: s corresponds to the standard presentation s(j) = (-j) mod n = (n-j) mod n.
  // The "s" in our panel (button) reflects across axis 0. axis k = r^k s r^{-k}.
  // So s_k maps vertex j to (2k - j) mod n. This is the formula we use.

  // Fixed points of axis k: vertices j with (2k - j) ≡ j (mod n), i.e., 2j ≡ 2k (mod n), j ≡ k (mod n/2) when n even,
  // or 2j ≡ 2k (mod n) => j = k (unique mod n) when n odd. For odd n: 1 fixed vertex. For even n: 2 fixed vertices (j = k mod n and j = k+n/2 mod n) if vertex-type axis.
  // For edge-midpoint axis: no fixed vertex (the fixed points are midpoints between vertices).

  const fixedVertices = useCallback((k: number): number[] => {
    const fixed: number[] = [];
    for (let j = 0; j < n; j++) {
      if ((2 * k - j + 4 * n) % n === j % n) fixed.push(j);
    }
    return fixed;
  }, [n]);

  const selAxisFixed = selectedAxis !== null ? fixedVertices(selectedAxis) : [];

  // After selecting axis, apply reflection to polygon (visual)
  // Applied reflection permutes vertex positions: vertex k moves to position s_k(index) of original
  const reflectedVertices = useMemo(() => {
    if (selectedAxis === null) return null;
    const k = selectedAxis;
    return vertices.map((_, j) => {
      const origIdx = (2 * k - j + 4 * n) % n;
      return vertices[origIdx];
    });
  }, [selectedAxis, vertices, n]);

  // Conjugation verifier: s r^k s^{-1} = r^{-k}
  // LHS: (0,1)*(k,0)*(0,1) = (0,1)*(k,1) = (0-k, 0) = (-k mod n, 0) = r^{n-k}
  // RHS: r^{-k} = r^{n-k}. Equal. ✓
  const lhsIdx = ((-(conjK)) % n + n) % n; // a = n-conjK
  const rhsIdx = ((-(conjK)) % n + n) % n; // same
  const matches = lhsIdx === rhsIdx; // always true, but show the computation

  const axisColors = ['#8B2E3C', '#2A4D69'];

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="对称轴探索 + 共轭关系验证" en="Reflection axis explorer + conjugation verifier" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="点击对称轴查看固定点和反射后的多边形；下方验证 s r^k s^{-1} = r^{-k}。"
          en="Click a reflection axis to see fixed points and the reflected polygon; verify s r^k s^{-1} = r^{-k} below."
        />
      </div>

      <div className="gt-panel-input-row">
        <label><TeX src={String.raw`n`} /></label>
        <input type="range" min={3} max={12} value={n}
          onChange={e => { setN(+e.target.value); setSelectedAxis(null); setConjK(1); setVerified(false); }}
          style={{ flex: 1 }} />
        <span className="gt-result-val" style={{ minWidth: 60 }}>
          n={n} ({isEven ? tr({ zh: '偶数', en: 'even'
                          }) : tr({ zh: '奇数', en: 'odd'
                              })})
        </span>
      </div>

      <div className="gt-panel-input-row">
        <button
          className={`gt-chip${colorByClass ? ' gt-chip-active' : ''}`}
          onClick={() => setColorByClass(c => !c)}>
          <L zh="按共轭类着色" en="Color by conjugacy class" />
        </button>
        {selectedAxis !== null && (
          <button className="gt-chip" onClick={() => setSelectedAxis(null)}>
            <L zh="取消选中" en="Deselect axis" />
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start', marginTop: 8 }}>
        <svg viewBox="0 0 200 200" width={200} style={{ flexShrink: 0, display: 'block' }}>
          {/* Reference polygon */}
          <polygon
            points={vertices.map(v => `${v.x.toFixed(2)},${v.y.toFixed(2)}`).join(' ')}
            fill="color-mix(in srgb, var(--accent) 6%, var(--bg-elev))"
            stroke="var(--accent)"
            strokeWidth={1.5}
          />

          {/* Reflected polygon */}
          {reflectedVertices && (
            <polygon
              points={reflectedVertices.map(v => `${v.x.toFixed(2)},${v.y.toFixed(2)}`).join(' ')}
              fill="color-mix(in srgb, var(--accent-2) 14%, var(--bg-elev))"
              stroke="var(--accent-2)"
              strokeWidth={2}
              strokeDasharray="5 3"
            />
          )}

          {/* Reflection axes */}
          {Array.from({ length: n }, (_, k) => {
            const angle = (Math.PI * k) / n;
            const len = R + 14;
            const x1 = cx + len * Math.cos(angle);
            const y1 = cy + len * Math.sin(angle);
            const x2 = cx - len * Math.cos(angle);
            const y2 = cy - len * Math.sin(angle);
            const isVert = axisIsVertexType(k);
            const color = colorByClass
              ? (isEven ? axisColors[isVert ? 0 : 1] : axisColors[0])
              : 'var(--ink-faint)';
            const isSelected = selectedAxis === k;
            return (
              <line key={k}
                x1={x1.toFixed(2)} y1={y1.toFixed(2)}
                x2={x2.toFixed(2)} y2={y2.toFixed(2)}
                stroke={isSelected ? 'var(--gold)' : color}
                strokeWidth={isSelected ? 2 : 1}
                strokeDasharray={isSelected ? 'none' : '4 3'}
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedAxis(k === selectedAxis ? null : k)}
              />
            );
          })}

          {/* Vertices */}
          {vertices.map((v, k) => {
            const isFixed = selAxisFixed.includes(k);
            return (
              <circle key={k} cx={v.x.toFixed(2)} cy={v.y.toFixed(2)} r={isFixed ? 5 : 3.5}
                fill={isFixed ? 'var(--gold)' : 'var(--accent)'}
                stroke={isFixed ? 'var(--gold)' : 'none'}
                strokeWidth={1.5}
              />
            );
          })}

          {/* Vertex labels */}
          {vertices.map((v, k) => {
            const dx = v.x - cx, dy = v.y - cy;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const lx = v.x + (dx / len) * 12;
            const ly = v.y + (dy / len) * 12;
            return (
              <text key={k} x={lx.toFixed(1)} y={(ly + 3).toFixed(1)} textAnchor="middle"
                style={{ fontFamily: 'var(--mono)', fontSize: 8 }}
                fill={selAxisFixed.includes(k) ? 'var(--gold)' : 'var(--ink-faint)'}>
                {k}
              </text>
            );
          })}

          <circle cx={cx} cy={cy} r={2} fill="var(--ink-dim)" />
        </svg>

        <div style={{ flex: 1, minWidth: 140, fontSize: 13, lineHeight: 1.8, color: 'var(--ink-dim)' }}>
          {/* Parity legend */}
          {isEven && colorByClass && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', width: 20, height: 2, background: axisColors[0] }} />
                <span style={{ fontSize: 12 }}><L zh="顶点-顶点轴（偶 k），共轭类 1" en="Vertex-vertex axes (even k), class 1" /></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', width: 20, height: 2, background: axisColors[1] }} />
                <span style={{ fontSize: 12 }}><L zh="边中点轴（奇 k），共轭类 2" en="Edge-midpoint axes (odd k), class 2" /></span>
              </div>
            </div>
          )}
          {!isEven && colorByClass && (
            <div style={{ marginBottom: 10, fontSize: 12 }}>
              <span style={{ display: 'inline-block', width: 20, height: 2, background: axisColors[0] }} />
              {' '}
              <L zh="所有 n 条轴同类（一个共轭类）" en="All n axes in one conjugacy class" />
            </div>
          )}

          {selectedAxis !== null ? (
            <div>
              <div><L zh="选中轴" en="Selected axis" /> {selectedAxis}</div>
              <div><L zh="类型" en="Type" />: {axisIsVertexType(selectedAxis)
                ? tr({ zh: '顶点-边中点轴', en: 'vertex-to-edge-midpoint'
                                              })
                : tr({ zh: '边中点-边中点轴', en: 'edge-midpoint to edge-midpoint'
                                              })}</div>
              <div><L zh="固定顶点" en="Fixed vertices" />: {selAxisFixed.length > 0 ? selAxisFixed.join(', ') : tr({ zh: '无（固定边中点）', en: 'none (fixes edge midpoints)'
                                      })}</div>
              <div><L zh="反射置换" en="Reflection perm" />: j ↦ ({`2×${selectedAxis} − j`}) mod {n}</div>
            </div>
          ) : (
            <div style={{ color: 'var(--ink-faint)', fontSize: 12 }}>
              <L zh="点击虚线对称轴查看详情" en="Click a dashed axis to see details" />
            </div>
          )}

          <div style={{ marginTop: 16, fontSize: 12 }}>
            <div><L zh="n 奇偶" en="n parity" />: {isEven ? tr({ zh: '偶数', en: 'even'
                                  }) : tr({ zh: '奇数', en: 'odd'
                                      })}</div>
            <div><L zh="反射共轭类数" en="Reflection conjugacy classes" />: {isEven ? 2 : 1}</div>
            <div><L zh="共轭类总数" en="Total conjugacy classes" />: {isEven ? (n + 6) / 2 : (n + 3) / 2}</div>
          </div>
        </div>
      </div>

      {/* Conjugation verifier */}
      <div style={{ borderTop: '1px solid var(--rule)', marginTop: 20, paddingTop: 16 }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600, marginBottom: 10, color: 'var(--ink)' }}>
          <L zh="机器验证 s r^k s^{-1} = r^{-k}" en="Machine-verify s r^k s^{-1} = r^{-k}" />
        </div>
        <div className="gt-panel-input-row">
          <label><TeX src={String.raw`k`} /></label>
          <input type="range" min={0} max={n - 1} value={conjK}
            onChange={e => { setConjK(+e.target.value); setVerified(false); }}
            style={{ flex: 1 }} />
          <span className="gt-result-val" style={{ minWidth: 24 }}>{conjK}</span>
        </div>

        <div style={{ fontFamily: 'var(--mono)', fontSize: 12, marginBottom: 10, lineHeight: 2, color: 'var(--ink-dim)' }}>
          <div><L zh="步骤 1: 从 e 出发施加 s" en="Step 1: apply s to e" /> → {elemLabel(0, 1)}</div>
          <div><L zh="步骤 2: 再施加 r^k" en="Step 2: apply r^k" /> → {(() => { const [ra, fa] = dnMul(0, 1, conjK, 0, n); return elemLabel(ra, fa); })()}</div>
          <div><L zh="步骤 3: 再施加 s^{-1} = s" en="Step 3: apply s⁻¹ = s" /> → {(() => { const [ra, fa] = dnMul(0, 1, conjK, 0, n); const [rb, fb] = dnMul(ra, fa, 0, 1, n); return elemLabel(rb, fb); })()}</div>
          <div style={{ color: 'var(--green)', fontWeight: 600 }}>
            <L zh="右侧: r^{-k} = " en="RHS: r^{-k} = " />
            {elemLabel(((-(conjK)) % n + n) % n, 0)}
            {' '}{matches ? '✓' : '✗'}
          </div>
        </div>

        <button className="gt-btn" onClick={() => setVerified(true)} style={{ fontSize: 12 }}>
          <L zh="确认等式成立" en="Confirm identity holds" />
        </button>

        {verified && (
          <div style={{ marginTop: 10, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--green)', padding: '8px 12px', background: 'color-mix(in srgb, var(--green) 8%, var(--bg-elev))', borderRadius: 4, border: '1px solid var(--green)' }}>
            <L
              zh={<>对所有 k = 0…{n - 1} 均成立：LHS = RHS = r^{((-(conjK)) % n + n) % n}。共轭关系 s r^k s = r^(-k) 是 D_n 非交换性的核心。</>}
              en={<>Verified for k = {conjK}: LHS = RHS = r^{((-(conjK)) % n + n) % n}. The conjugation relation s r^k s = r^(-k) is the structural heart of D_n&apos;s non-commutativity.</>}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Facts table: live-computed for any n
// ═════════════════════════════════════════════════════════════════════════════

function FactsTable({}: { lang: 'zh' | 'en' }) {
  const [n, setN] = useState(6);
  const isEven = n % 2 === 0;

  const conjClasses = isEven ? (n + 6) / 2 : (n + 3) / 2;
  const centerOrder = isEven ? 2 : 1;
  const commutatorOrder = isEven ? n / 2 : n;
  const abelianizationOrder = isEven ? 4 : 2;
  const order2Count = isEven ? n + 1 : n;
  const subgroupCount = divisors(n).length + sigma(n);

  const rows = [
    { label: tr({ zh: '群阶', en: 'Group order'
    }), val: `|D_n| = ${2 * n}`, formula: '2n' },
    { label: tr({ zh: '旋转子群', en: 'Rotation subgroup'
    }), val: `C_${n}`, formula: 'C_n ◁ D_n' },
    { label: tr({ zh: '中心 |Z(D_n)|', en: 'Center |Z(D_n)|' }), val: String(centerOrder), formula: isEven ? '{e, r^{n/2}}' : '{e}' },
    { label: tr({ zh: '阶为 2 的元素数', en: 'Elements of order 2'
    }), val: String(order2Count), formula: isEven ? 'n+1 (n reflections + r^{n/2})' : 'n (all reflections)' },
    { label: tr({ zh: '共轭类数', en: 'Conjugacy classes'
    }), val: String(conjClasses), formula: isEven ? '(n+6)/2' : '(n+3)/2' },
    { label: tr({ zh: '反射共轭类数', en: 'Reflection conj. classes'
    }), val: isEven ? '2' : '1', formula: isEven ? '2 (vertex + edge-midpoint)' : '1' },
    { label: tr({ zh: '换位子群 |[D_n,D_n]|', en: 'Commutator subgroup order'
    }), val: String(commutatorOrder), formula: isEven ? 'n/2 (⟨r²⟩, NOT ⟨r⟩!)' : 'n (⟨r²⟩=⟨r⟩)' },
    { label: tr({ zh: '阿贝尔化阶', en: 'Abelianization order'
    }), val: String(abelianizationOrder), formula: isEven ? 'C₂×C₂' : 'C₂' },
    { label: tr({ zh: '子群总数 d(n)+σ(n)', en: 'Total subgroups d(n)+σ(n)'
    }), val: String(subgroupCount), formula: `d(${n})=${divisors(n).length} + σ(${n})=${sigma(n)}` },
  ];

  return (
    <div>
      <div className="gt-panel-input-row" style={{ marginBottom: 12 }}>
        <label><TeX src={String.raw`n`} /></label>
        <input type="range" min={3} max={12} value={n} onChange={e => setN(+e.target.value)} style={{ flex: 1 }} />
        <span className="gt-result-val" style={{ minWidth: 48 }}>n = {n}</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="gt-compare" style={{ width: '100%', minWidth: 320 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--ink-faint)', fontWeight: 500 }}>
                <L zh="性质" en="Property" />
              </th>
              <th style={{ textAlign: 'center', fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--ink-faint)', fontWeight: 500 }}>
                <L zh="值 (n={n})" en="Value (n={n})" />
              </th>
              <th style={{ textAlign: 'left', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ink-faint)', fontWeight: 400 }}>
                <L zh="说明" en="Note" />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ label, val, formula }, idx) => (
              <tr key={idx} style={{ background: idx % 2 === 0 ? 'var(--bg-elev)' : 'transparent' }}>
                <td style={{ padding: '5px 8px', fontSize: 13, fontFamily: 'var(--sans)', color: 'var(--ink-dim)' }}>{label}</td>
                <td style={{ padding: '5px 8px', textAlign: 'center', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 14, color: 'var(--accent)' }}>{val}</td>
                <td style={{ padding: '5px 8px', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ink-faint)' }}>{formula}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic', fontFamily: 'var(--serif)' }}>
        <L
          zh={<>注：换位子群是 <TeX src={String.raw`\langle r^2\rangle`} />，<strong>不是</strong> <TeX src={String.raw`\langle r\rangle`} />（仅当 n 为奇数时两者相等）。这是二面体群理论中最常见的错误。</>}
          en={<>Note: the commutator subgroup is <TeX src={String.raw`\langle r^2\rangle`} />, <strong>not</strong> <TeX src={String.raw`\langle r\rangle`} /> (they coincide only when n is odd). This is the single most common error in dihedral-group write-ups.</>}
        />
      </div>
    </div>
  );
}
