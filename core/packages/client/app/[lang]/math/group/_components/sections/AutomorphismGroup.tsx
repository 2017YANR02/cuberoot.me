'use client';

import { useState, useMemo, useCallback } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { tr } from '@/i18n/tr';
import i18n from "@/i18n/i18n-client";

// ── Math helpers ─────────────────────────────────────────────────────────────

function gcd(a: number, b: number): number {
  while (b !== 0) { const t = b; b = a % b; a = t; }
  return a;
}

function units(n: number): number[] {
  const result: number[] = [];
  for (let k = 1; k < n; k++) {
    if (gcd(k, n) === 1) result.push(k);
  }
  return result;
}

function phi(n: number): number {
  return units(n).length;
}

/** Multiplicative order of k mod n (k must be coprime to n) */
function multOrder(k: number, n: number): number {
  let val = 1;
  for (let e = 1; e <= n; e++) {
    val = (val * k) % n;
    if (val === 1) return e;
  }
  return n; // fallback
}

/**
 * Returns { cyclic, primitiveRoot } where cyclic = whether (Z/n)^* is cyclic.
 * If cyclic, primitiveRoot is the smallest primitive root.
 */
function analyzeUnits(n: number): { cyclic: boolean; primitiveRoot: number | null } {
  const us = units(n);
  const p = us.length; // = phi(n)
  for (const g of us) {
    if (multOrder(g, n) === p) {
      return { cyclic: true, primitiveRoot: g };
    }
  }
  return { cyclic: false, primitiveRoot: null };
}

/** Compute powers g^0, g^1, ..., g^{phi(n)-1} mod n */
function primitivePowers(g: number, n: number): number[] {
  const p = phi(n);
  const result: number[] = [1];
  let cur = 1;
  for (let i = 1; i < p; i++) {
    cur = (cur * g) % n;
    result.push(cur);
  }
  return result;
}

// ── V4 = C2 × C2 helpers ──────────────────────────────────────────────────────

// Elements: e=(0,0), a=(1,0), b=(0,1), c=(1,1) as F_2^2 vectors
// Indices:  0        1        2        3
const V4_VECS: [number, number][] = [[0, 0], [1, 0], [0, 1], [1, 1]];

// XOR add in F_2^2
function v4Add(i: number, j: number): number {
  const [ai, bi] = V4_VECS[i];
  const [aj, bj] = V4_VECS[j];
  const r: [number, number] = [(ai ^ aj), (bi ^ bj)];
  return V4_VECS.findIndex(v => v[0] === r[0] && v[1] === r[1]);
}

// All 6 automorphisms of V4: bijections of {1,2,3} (the nonidentity elements),
// extended by fixing e=0.
// Encoded as [imageOf1, imageOf2, imageOf3] where values are in {1,2,3}
const V4_AUTS: [number, number, number][] = [
  [1, 2, 3], // identity
  [1, 3, 2], // swap b<->c
  [2, 1, 3], // swap a<->b
  [2, 3, 1], // a->b->c->a (120 deg)
  [3, 1, 2], // a->c->b->a (240 deg)
  [3, 2, 1], // swap a<->c
];

// Cycle notation label for each automorphism (permutation of {a,b,c})
function v4AutLabel(aut: [number, number, number]): string {
  // aut[i] = image of nonidentity element i+1 (a,b,c)
  // elements: a=1, b=2, c=3; aut[0]=imageOf(a), aut[1]=imageOf(b), aut[2]=imageOf(c)
  // Compute cycle notation
  const visited = [false, false, false];
  const cycles: number[][] = [];
  for (let start = 0; start < 3; start++) {
    if (visited[start]) continue;
    const cycle: number[] = [start + 1]; // 1-indexed
    visited[start] = true;
    let cur = aut[start] - 1; // 0-indexed
    while (!visited[cur]) {
      visited[cur] = true;
      cycle.push(cur + 1);
      cur = aut[cur] - 1;
    }
    cycles.push(cycle);
  }
  const parts = cycles.map(c => {
    if (c.length === 1) return null;
    return '(' + c.map(x => ['a', 'b', 'c'][x - 1]).join('') + ')';
  }).filter(Boolean);
  if (parts.length === 0) return 'id';
  return parts.join('');
}

// ── Hardcoded Cayley tables for small groups ──────────────────────────────────

type Group = {
  name: string;
  nameZh: string;
  n: number;
  mul: (i: number, j: number) => number;
  inv: (i: number) => number;
  label: (i: number) => string;
  center: number[]; // indices
};

function makeGroups(): Group[] {
  // C6: Z/6Z
  const C6: Group = {
    name: 'C₆',
    nameZh: 'C₆',
    n: 6,
    mul: (i, j) => (i + j) % 6,
    inv: (i) => (6 - i) % 6,
    label: (i) => `${i}`,
    center: [0, 1, 2, 3, 4, 5],
  };

  // S3: symmetric group on 3 elements
  // Elements: 0=e, 1=(12), 2=(13), 3=(23), 4=(123), 5=(132)
  // as permutations of {0,1,2}:
  const S3_PERMS = [
    [0, 1, 2], // e
    [1, 0, 2], // (12)
    [2, 1, 0], // (13)
    [0, 2, 1], // (23)
    [1, 2, 0], // (123)
    [2, 0, 1], // (132)
  ];
  const S3_NAMES = ['e', '(12)', '(13)', '(23)', '(123)', '(132)'];
  function s3mul(i: number, j: number): number {
    // compose: i then j, i.e. σ_j ∘ σ_i (act on right)
    const pi = S3_PERMS[i], pj = S3_PERMS[j];
    const comp = pi.map(x => pj[x]);
    return S3_PERMS.findIndex(p => p[0] === comp[0] && p[1] === comp[1] && p[2] === comp[2]);
  }
  function s3inv(i: number): number {
    const pi = S3_PERMS[i];
    const inv = [0, 0, 0];
    for (let k = 0; k < 3; k++) inv[pi[k]] = k;
    return S3_PERMS.findIndex(p => p[0] === inv[0] && p[1] === inv[1] && p[2] === inv[2]);
  }
  const S3: Group = {
    name: 'S₃',
    nameZh: 'S₃',
    n: 6,
    mul: s3mul,
    inv: s3inv,
    label: (i) => S3_NAMES[i],
    center: [0],
  };

  // D4: dihedral group of order 8
  // Elements: r^0, r^1, r^2, r^3, s, sr, sr^2, sr^3
  // Multiply: r^a * r^b = r^{a+b mod 4}; r^a * s r^b = s r^{b-a mod 4}; s r^a * r^b = s r^{a+b mod 4}; s r^a * s r^b = r^{b-a mod 4}
  function d4el(isFlip: boolean, rot: number): number {
    return isFlip ? 4 + rot : rot;
  }
  function d4parse(i: number): [boolean, number] {
    return i >= 4 ? [true, i - 4] : [false, i];
  }
  function d4mul(i: number, j: number): number {
    const [fi, ri] = d4parse(i);
    const [fj, rj] = d4parse(j);
    if (!fi && !fj) return d4el(false, (ri + rj) % 4);
    if (!fi && fj) return d4el(true, ((rj - ri) % 4 + 4) % 4);
    if (fi && !fj) return d4el(true, (ri + rj) % 4);
    // fi && fj
    return d4el(false, ((rj - ri) % 4 + 4) % 4);
  }
  function d4inv(i: number): number {
    const [fi, ri] = d4parse(i);
    if (!fi) return d4el(false, (4 - ri) % 4);
    return d4el(true, ri); // s r^k * s r^k = r^0
  }
  const D4_NAMES = ['r⁰', 'r', 'r²', 'r³', 's', 'sr', 'sr²', 'sr³'];
  // Center of D4: {r^0, r^2}
  const D4: Group = {
    name: 'D₄',
    nameZh: 'D₄',
    n: 8,
    mul: d4mul,
    inv: d4inv,
    label: (i) => D4_NAMES[i],
    center: [0, 2],
  };

  // Q8: quaternion group
  // Elements: 1,-1,i,-i,j,-j,k,-k (indices 0..7)
  // Multiplication table (standard)
  const Q8_NAMES = ['1', '-1', 'i', '-i', 'j', '-j', 'k', '-k'];
  // Encode: 0=1,1=-1,2=i,3=-i,4=j,5=-j,6=k,7=-k
  const Q8_TABLE: number[][] = [
    [0, 1, 2, 3, 4, 5, 6, 7],  // 1  * ...
    [1, 0, 3, 2, 5, 4, 7, 6],  // -1 * ...
    [2, 3, 1, 0, 6, 7, 5, 4],  // i  * ...
    [3, 2, 0, 1, 7, 6, 4, 5],  // -i * ...
    [4, 5, 7, 6, 1, 0, 2, 3],  // j  * ...
    [5, 4, 6, 7, 0, 1, 3, 2],  // -j * ...
    [6, 7, 4, 5, 3, 2, 1, 0],  // k  * ...
    [7, 6, 5, 4, 2, 3, 0, 1],  // -k * ...
  ];
  function q8inv(i: number): number {
    for (let j = 0; j < 8; j++) if (Q8_TABLE[i][j] === 0) return j;
    return 0;
  }
  const Q8: Group = {
    name: 'Q₈',
    nameZh: 'Q₈',
    n: 8,
    mul: (i, j) => Q8_TABLE[i][j],
    inv: q8inv,
    label: (i) => Q8_NAMES[i],
    center: [0, 1],
  };

  return [C6, S3, D4, Q8];
}

// ── Colors ────────────────────────────────────────────────────────────────────

const PALETTE = ['#8B2E3C', '#2A4D69', '#3F7050', '#B8860B', '#6B4E9C', '#C2410C', '#5C7CA0', '#9C4E6B'];

// ── Component ─────────────────────────────────────────────────────────────────

export default function AutomorphismGroup() {
  const lang = useLang();
  const isZh = lang === 'zh';

  // ── Widget 1: Aut(C_n) explorer ────────────────────────────────────────────
  const [nInput, setNInput] = useState('10');
  const [selectedK, setSelectedK] = useState<number | null>(null);
  const [showMulTable, setShowMulTable] = useState(false);

  const n = useMemo(() => {
    const v = parseInt(nInput, 10);
    if (isNaN(v) || v < 2) return 2;
    if (v > 120) return 120;
    return v;
  }, [nInput]);

  const us = useMemo(() => units(n), [n]);
  const phiN = us.length;
  const { cyclic, primitiveRoot } = useMemo(() => analyzeUnits(n), [n]);
  const powers = useMemo(
    () => (cyclic && primitiveRoot != null ? primitivePowers(primitiveRoot, n) : []),
    [cyclic, primitiveRoot, n]
  );
  const powerRank: Map<number, number> = useMemo(() => {
    const m = new Map<number, number>();
    powers.forEach((v, i) => m.set(v, i));
    return m;
  }, [powers]);

  const effectiveK = selectedK !== null && us.includes(selectedK) ? selectedK : us[0] ?? 1;

  // Dial layout
  const R = 90; // radius of dial
  const CX = 120, CY = 120; // center of SVG circle area
  const dotR = 5;

  const dotPos = useCallback((i: number, total: number): [number, number] => {
    const angle = (2 * Math.PI * i) / total - Math.PI / 2;
    return [CX + R * Math.cos(angle), CY + R * Math.sin(angle)];
  }, []);

  // Multiplication table rows for (Z/n)^×
  const mulTableData = useMemo(() => {
    if (!showMulTable || us.length > 16) return null;
    return us.map(row => us.map(col => (row * col) % n));
  }, [showMulTable, us, n]);

  // ── Widget 2: Inn(G) conjugation viewer ──────────────────────────────────────
  const GROUPS = useMemo(() => makeGroups(), []);
  const [groupIdx, setGroupIdx] = useState(2); // default D4
  const [conjG, setConjG] = useState(1);

  const grp = GROUPS[groupIdx];

  // Reset conjG if it's out of bounds for new group
  const safeConjG = conjG < grp.n ? conjG : 0;

  const conjPerm = useMemo(() => {
    const g = safeConjG;
    const gi = grp.inv(g);
    return Array.from({ length: grp.n }, (_, x) => grp.mul(grp.mul(g, x), gi));
  }, [grp, safeConjG]);

  // All distinct conjugation perms
  const allConjPerms = useMemo(() => {
    const seen = new Set<string>();
    const perms: number[][] = [];
    for (let g = 0; g < grp.n; g++) {
      const gi = grp.inv(g);
      const perm = Array.from({ length: grp.n }, (_, x) => grp.mul(grp.mul(g, x), gi));
      const key = perm.join(',');
      if (!seen.has(key)) { seen.add(key); perms.push(perm); }
    }
    return perms;
  }, [grp]);

  const innSize = allConjPerms.length;
  // Actual center: elements fixed by ALL inner auts
  const centerActual = useMemo(() => {
    return Array.from({ length: grp.n }, (_, x) => x).filter(x =>
      allConjPerms.every(p => p[x] === x)
    );
  }, [grp, allConjPerms]);

  // For SVG layout of conjugation diagram
  const nodeW = 52, nodeH = 32, gapX = 60;
  const cols = Math.min(grp.n, 8);
  const rows = Math.ceil(grp.n / cols);
  const svgW = cols * (nodeW + gapX);
  const svgH = Math.max(rows * (nodeH + 40), 120);

  function nodeX(i: number): number { return (i % cols) * (nodeW + gapX) + nodeW / 2 + 10; }
  function nodeY(i: number): number { return Math.floor(i / cols) * (nodeH + 40) + nodeH / 2 + 20; }

  // ── Widget 3: V4 automorphism gallery ────────────────────────────────────────
  const [v4AutIdx, setV4AutIdx] = useState(0);
  const selAut = V4_AUTS[v4AutIdx];
  // image of nonidentity i (1,2,3) under selected automorphism
  function v4Image(nid: number): number { return selAut[nid - 1]; } // nid in {1,2,3}

  return (
    <GTSec id="automorphism-group" className="gt-sec">
      <div className="gt-sec-num">§39</div>
      <h2 className="gt-sec-title">
        <L zh="自同构群 Aut(G)" en="Automorphism groups" />
      </h2>
      <p className="gt-lede">
        <L
          zh={<>
            群 <TeX src={String.raw`G`} /> 到自身的同构称为<strong>自同构</strong>。
            所有自同构在复合下构成<strong>自同构群</strong> <TeX src={String.raw`\mathrm{Aut}(G)`} />，
            它是 <TeX src={String.raw`G`} /> 的元素集的对称群 <TeX src={String.raw`\mathrm{Sym}(G)`} /> 的子群。
            自同构群刻画了 <TeX src={String.raw`G`} /> 内部对称性的完整图景：内自同构来自共轭，外自同构则是结构上更深层的对称。
          </>}
          en={<>
            An <strong>automorphism</strong> of a group <TeX src={String.raw`G`} /> is an isomorphism <TeX src={String.raw`G \to G`} />.
            The set of all automorphisms, under composition, forms the <strong>automorphism group</strong> <TeX src={String.raw`\mathrm{Aut}(G)`} />,
            a subgroup of the symmetric group <TeX src={String.raw`\mathrm{Sym}(G)`} /> on the underlying set.
            Aut(<TeX src={String.raw`G`} />) captures the full symmetry of <TeX src={String.raw`G`} />&rsquo;s structure: inner automorphisms arise from conjugation; outer ones are deeper.
          </>}
        />
      </p>

      {/* ── Definitions ─────────────────────────────────────────────────────── */}
      <div className="gt-def">
        <div className="gt-def-title">
          <L zh="定义：自同构，内自同构，外自同构群" en="Definition: Automorphism, Inn(G), Out(G)" />
        </div>
        <div className="gt-def-body">
          <p>
            <L
              zh={<>
                群 <TeX src={String.raw`G`} /> 的<strong>自同构</strong>是双射同态 <TeX src={String.raw`\varphi: G \to G`} />（即 <TeX src={String.raw`G`} /> 与自身的同构）。
                全体自同构在复合下构成 <TeX src={String.raw`\mathrm{Aut}(G)`} />，单位元为恒等映射 <TeX src={String.raw`\mathrm{id}_G`} />，逆为逆函数（仍是自同构）。
              </>}
              en={<>
                An <strong>automorphism</strong> of <TeX src={String.raw`G`} /> is a bijective homomorphism <TeX src={String.raw`\varphi: G \to G`} />.
                All automorphisms under composition form <TeX src={String.raw`\mathrm{Aut}(G)`} />, with identity <TeX src={String.raw`\mathrm{id}_G`} /> and inverse the inverse function (automatically an automorphism).
              </>}
            />
          </p>
          <p style={{ marginTop: 10 }}>
            <L
              zh={<>
                对 <TeX src={String.raw`g \in G`} />，<strong>共轭映射</strong> <TeX src={String.raw`c_g: x \mapsto gxg^{-1}`} /> 是一个自同构，称为<strong>内自同构</strong>。
                映射 <TeX src={String.raw`g \mapsto c_g`} /> 是从 <TeX src={String.raw`G`} /> 到 <TeX src={String.raw`\mathrm{Aut}(G)`} /> 的同态，其像
                <TeX src={String.raw`\mathrm{Inn}(G)`} /> 是 <TeX src={String.raw`\mathrm{Aut}(G)`} /> 的正规子群，核为中心 <TeX src={String.raw`Z(G)`} />。
              </>}
              en={<>
                For <TeX src={String.raw`g \in G`} />, <strong>conjugation</strong> <TeX src={String.raw`c_g: x \mapsto gxg^{-1}`} /> is an automorphism, called an <strong>inner automorphism</strong>.
                The map <TeX src={String.raw`g \mapsto c_g`} /> is a homomorphism <TeX src={String.raw`G \to \mathrm{Aut}(G)`} /> with image <TeX src={String.raw`\mathrm{Inn}(G) \trianglelefteq \mathrm{Aut}(G)`} /> and kernel <TeX src={String.raw`Z(G)`} />.
              </>}
            />
          </p>
          <p style={{ marginTop: 10 }}>
            <L
              zh={<>
                <strong>外自同构群</strong>定义为商群 <TeX src={String.raw`\mathrm{Out}(G) := \mathrm{Aut}(G)/\mathrm{Inn}(G)`} />。
                注意：<TeX src={String.raw`\mathrm{Out}(G)`} /> 的元素是陪集，而非单个自同构。
                称一个自同构"是外自同构"只是说它不在 <TeX src={String.raw`\mathrm{Inn}(G)`} /> 中，在差一个内自同构的意义下有定义。
              </>}
              en={<>
                The <strong>outer automorphism group</strong> is the quotient <TeX src={String.raw`\mathrm{Out}(G) := \mathrm{Aut}(G)/\mathrm{Inn}(G)`} />.
                Elements of <TeX src={String.raw`\mathrm{Out}(G)`} /> are cosets, not individual automorphisms.
                An automorphism is called &ldquo;outer&rdquo; if it lies outside <TeX src={String.raw`\mathrm{Inn}(G)`} />, defined only up to composition with inner ones.
              </>}
            />
          </p>
        </div>
      </div>

      {/* ── Theorem: Inn ≅ G/Z ─────────────────────────────────────────────── */}
      <div className="gt-thm" style={{ marginTop: 28 }}>
        <div className="gt-thm-title">
          <L zh="定理：Inn(G) ≅ G/Z(G)" en="Theorem: Inn(G) ≅ G/Z(G)" />
        </div>
        <div className="gt-thm-body">
          <p>
            <L
              zh={<>
                共轭同态 <TeX src={String.raw`G \to \mathrm{Aut}(G),\; g \mapsto c_g`} /> 的核恰好是中心 <TeX src={String.raw`Z(G)`} />，故由第一同构定理，
              </>}
              en={<>
                The conjugation homomorphism <TeX src={String.raw`G \to \mathrm{Aut}(G),\; g \mapsto c_g`} /> has kernel <TeX src={String.raw`Z(G)`} />, so by the first isomorphism theorem,
              </>}
            />
          </p>
          <TeXBlock src={String.raw`\mathrm{Inn}(G) \cong G/Z(G).`} />
          <p style={{ marginTop: 8 }}>
            <L
              zh={<>
                特别地，<TeX src={String.raw`G`} /> 是阿贝尔群当且仅当 <TeX src={String.raw`\mathrm{Inn}(G)`} /> 是平凡群（每个非单位元自同构都是"外"的）。
                <em>不要</em>写成 <TeX src={String.raw`\mathrm{Inn}(G) \cong G`} />：只有在 <TeX src={String.raw`Z(G)=1`} />（无中心）时才成立。
              </>}
              en={<>
                In particular, <TeX src={String.raw`G`} /> is abelian if and only if <TeX src={String.raw`\mathrm{Inn}(G)`} /> is trivial (every nontrivial automorphism is outer).
                Do <em>not</em> write <TeX src={String.raw`\mathrm{Inn}(G) \cong G`} />: this holds only when <TeX src={String.raw`Z(G)=1`} />.
              </>}
            />
          </p>
          <p style={{ marginTop: 8 }}>
            <L
              zh={<>
                关于正规性：对任意 <TeX src={String.raw`\psi \in \mathrm{Aut}(G)`} /> 和 <TeX src={String.raw`g \in G`} />，直接计算给出
                <TeX src={String.raw`\psi \circ c_g \circ \psi^{-1} = c_{\psi(g)}`} />，
                从而 <TeX src={String.raw`\mathrm{Inn}(G) \trianglelefteq \mathrm{Aut}(G)`} /> 成立，商群 <TeX src={String.raw`\mathrm{Out}(G)`} /> 有意义。
              </>}
              en={<>
                Normality: for <TeX src={String.raw`\psi \in \mathrm{Aut}(G)`} /> and <TeX src={String.raw`g \in G`} />, direct computation gives
                <TeX src={String.raw`\psi \circ c_g \circ \psi^{-1} = c_{\psi(g)}`} />,
                so <TeX src={String.raw`\mathrm{Inn}(G) \trianglelefteq \mathrm{Aut}(G)`} /> and <TeX src={String.raw`\mathrm{Out}(G)`} /> is well-defined.
              </>}
            />
          </p>
        </div>
      </div>

      {/* ── Theorem: Aut(C_n) ─────────────────────────────────────────────── */}
      <div className="gt-thm" style={{ marginTop: 28 }}>
        <div className="gt-thm-title">
          <L zh="定理：Aut(C_n) ≅ (Z/n)^×" en="Theorem: Aut(C_n) ≅ (Z/n)×" />
        </div>
        <div className="gt-thm-body">
          <p>
            <L
              zh={<>
                设 <TeX src={String.raw`C_n = \langle a \rangle`} /> 为 <TeX src={String.raw`n`} /> 阶循环群。
                <TeX src={String.raw`C_n`} /> 的自同态由生成元的像 <TeX src={String.raw`a \mapsto a^k`} /> 完全决定；
                它是自同构当且仅当 <TeX src={String.raw`a^k`} /> 也生成 <TeX src={String.raw`C_n`} />，即 <TeX src={String.raw`\gcd(k, n) = 1`} />。故
              </>}
              en={<>
                Let <TeX src={String.raw`C_n = \langle a \rangle`} /> be cyclic of order <TeX src={String.raw`n`} />.
                An endomorphism of <TeX src={String.raw`C_n`} /> is determined by <TeX src={String.raw`a \mapsto a^k`} />;
                it is an automorphism iff <TeX src={String.raw`\gcd(k,n)=1`} />. Therefore
              </>}
            />
          </p>
          <TeXBlock src={String.raw`\mathrm{Aut}(C_n) \cong (\mathbb{Z}/n)^\times,\quad |\mathrm{Aut}(C_n)| = \varphi(n).`} />
          <p style={{ marginTop: 8 }}>
            <L
              zh={<>
                由高斯的结果，<TeX src={String.raw`(\mathbb{Z}/n)^\times`} /> 是循环群（即原根存在）当且仅当
                <TeX src={String.raw`n \in \{1, 2, 4, p^k, 2p^k\}`} />，其中 <TeX src={String.raw`p`} /> 是奇素数，<TeX src={String.raw`k \geq 1`} />。
                最小的反例是 <TeX src={String.raw`n = 8`} />：<TeX src={String.raw`(\mathbb{Z}/8)^\times = \{1,3,5,7\} \cong C_2 \times C_2`} />，每个非单位元都满足 <TeX src={String.raw`x^2 \equiv 1`} />，不存在 4 阶元。
              </>}
              en={<>
                By Gauss, <TeX src={String.raw`(\mathbb{Z}/n)^\times`} /> is cyclic (equivalently a primitive root mod <TeX src={String.raw`n`} /> exists) if and only if
                <TeX src={String.raw`n \in \{1, 2, 4, p^k, 2p^k\}`} /> with <TeX src={String.raw`p`} /> an odd prime and <TeX src={String.raw`k \geq 1`} />.
                The smallest failure is <TeX src={String.raw`n=8`} />: <TeX src={String.raw`(\mathbb{Z}/8)^\times \cong C_2 \times C_2`} />, every nonidentity element squares to 1, so no element of order <TeX src={String.raw`\varphi(8)=4`} /> exists.
              </>}
            />
          </p>
        </div>
      </div>

      {/* ── Notable examples table ────────────────────────────────────────── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="典型例子" en="Notable examples" />
      </h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="gt-compare" style={{ minWidth: 340 }}>
          <thead>
            <tr>
              <th><L zh="群" en="Group" /></th>
              <th>Aut(<TeX src={String.raw`G`} />)</th>
              <th>Inn(<TeX src={String.raw`G`} />)</th>
              <th>Out(<TeX src={String.raw`G`} />)</th>
              <th><L zh="备注" en="Notes" /></th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><TeX src={String.raw`C_n`} /></td>
              <td><TeX src={String.raw`(\mathbb{Z}/n)^\times`} /></td>
              <td>1 <L zh="（阿贝尔）" en="(abelian)" /></td>
              <td><TeX src={String.raw`(\mathbb{Z}/n)^\times`} /></td>
              <td><TeX src={String.raw`\varphi(n)`} /> <L zh="阶" en="elements" /></td>
            </tr>
            <tr>
              <td><TeX src={String.raw`C_2 \times C_2`} /></td>
              <td><TeX src={String.raw`S_3 \cong \mathrm{GL}(2,\mathbb{F}_2)`} /></td>
              <td>1 <L zh="（阿贝尔）" en="(abelian)" /></td>
              <td><TeX src={String.raw`S_3`} /></td>
              <td><L zh="6 阶，置换 3 个非单位元" en="order 6, permutes 3 nonidentity elements" /></td>
            </tr>
            <tr>
              <td><TeX src={String.raw`S_n`} /> (<TeX src={String.raw`n \neq 2,6`} />)</td>
              <td><TeX src={String.raw`S_n`} /></td>
              <td><TeX src={String.raw`S_n`} /></td>
              <td>1</td>
              <td><L zh="完全群（中心平凡 + 全内）" en="Complete group (trivial center, all inner)" /></td>
            </tr>
            <tr>
              <td><TeX src={String.raw`S_6`} /></td>
              <td><TeX src={String.raw`S_6 \rtimes C_2`} /></td>
              <td><TeX src={String.raw`S_6`} /></td>
              <td><TeX src={String.raw`C_2`} /></td>
              <td><L zh="例外外自同构，|Aut| = 1440" en="Exceptional outer automorphism, |Aut| = 1440" /></td>
            </tr>
            <tr>
              <td><TeX src={String.raw`\mathbb{Z}`} /></td>
              <td><TeX src={String.raw`C_2`} /></td>
              <td>1</td>
              <td><TeX src={String.raw`C_2`} /></td>
              <td><TeX src={String.raw`n \mapsto \pm n`} /></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── S6 exceptional outer automorphism callout ─────────────────────── */}
      <div className="gt-aside" style={{ marginTop: 24 }}>
        <L
          zh={<>
            <strong>S₆ 的例外外自同构</strong> 是对称群理论中最令人惊叹的结果之一。
            对所有 <TeX src={String.raw`n \geq 3, n \neq 6`} />，<TeX src={String.raw`S_n`} /> 是<strong>完全群</strong>：中心平凡，每个自同构都是内自同构，<TeX src={String.raw`\mathrm{Out}(S_n) = 1`} />。
            唯有 <TeX src={String.raw`S_6`} /> 拥有非内自同构：<TeX src={String.raw`|\mathrm{Out}(S_6)| = 2`} />，<TeX src={String.raw`|\mathrm{Aut}(S_6)| = 720 \times 2 = 1440`} />。
            这个外自同构把 15 个对换（2-轮换）映到 15 个三对换积（<TeX src={String.raw`(ab)(cd)(ef)`} /> 形式），不保持轮换型——这正是它"非内"的直观特征。
            注意：<TeX src={String.raw`|\mathrm{Out}(S_6)|=2`} /> 意指有一个非平凡陪集，该陪集里有 720 个外自同构，而非"唯一"一个。
          </>}
          en={<>
            <strong>The exceptional outer automorphism of S₆</strong> is one of the most striking facts in the theory of symmetric groups.
            For all <TeX src={String.raw`n \geq 3, n \neq 6`} />, <TeX src={String.raw`S_n`} /> is <strong>complete</strong>: trivial center, every automorphism is inner, <TeX src={String.raw`\mathrm{Out}(S_n) = 1`} />.
            Only <TeX src={String.raw`S_6`} /> has non-inner automorphisms: <TeX src={String.raw`|\mathrm{Out}(S_6)| = 2`} />, <TeX src={String.raw`|\mathrm{Aut}(S_6)| = 720 \times 2 = 1440`} />.
            The outer automorphism sends each of the 15 transpositions to one of the 15 products-of-three-disjoint-transpositions <TeX src={String.raw`(ab)(cd)(ef)`} />, violating cycle-type preservation — the hallmark of being non-inner.
            Note: <TeX src={String.raw`|\mathrm{Out}(S_6)|=2`} /> means one nontrivial coset, which contains 720 outer automorphisms (not &ldquo;a unique&rdquo; one).
          </>}
        />
      </div>

      {/* ── Cube connection ──────────────────────────────────────────────────── */}
      <div className="gt-pullquote" style={{ marginTop: 28 }}>
        <L
          zh={<>
            <strong>魔方连接：共轭 = 换位操作</strong>。魔方玩法中的<em>换位技巧</em>（conjugate，或称 setup move）
            <TeX src={String.raw`[g:x] = g\,x\,g^{-1}`} /> 正是内自同构 <TeX src={String.raw`c_g`} /> 的具体体现：先做打好位置的操作 <TeX src={String.raw`g`} />，
            执行算法 <TeX src={String.raw`x`} />，再撤销 <TeX src={String.raw`g^{-1}`} />，实现在不同位置施加同一算法。
            此外，整体旋转和镜像对称给出了面生成元 <TeX src={String.raw`\{U,D,L,R,F,B\}`} /> 的重新标记，
            诱导了魔方群的自同构：镜像将每步变换为其镜像版（如 <TeX src={String.raw`R \mapsto L'`} />），
            是魔方玩家每天都在使用的"镜像 OLL/PLL" 背后的数学结构，属于对称诱导的自同构（非内自同构——因为你无法通过合法转面实现镜像）。
          </>}
          en={<>
            <strong>Cube connection: conjugation = setup moves</strong>. The cuber&rsquo;s <em>conjugate</em> (setup-move pattern)
            <TeX src={String.raw`[g:x] = g\,x\,g^{-1}`} /> is precisely the inner automorphism <TeX src={String.raw`c_g`} />: apply setup <TeX src={String.raw`g`} />, execute algorithm <TeX src={String.raw`x`} />, undo <TeX src={String.raw`g^{-1}`} />, to perform <TeX src={String.raw`x`} /> at a shifted location.
            Additionally, whole-cube rotations and the mirror reflection induce automorphisms of the move group by relabeling generators <TeX src={String.raw`\{U,D,L,R,F,B\}`} />:
            mirroring sends each move to its mirror (e.g. <TeX src={String.raw`R \mapsto L'`} />), the mathematics behind the everyday &ldquo;mirror an OLL/PLL alg&rdquo; trick — a symmetry-induced automorphism that is not an inner automorphism (no legal sequence of turns physically mirrors the cube).
          </>}
        />
        <div className="gt-pullquote-cite">
          <L zh="共轭 = 内自同构，镜像 = 对称诱导自同构" en="Conjugate = inner automorphism; mirror = symmetry-induced automorphism" />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          WIDGET 1: Aut(C_n) Explorer
      ══════════════════════════════════════════════════════════════════ */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 44, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="探索 Aut(C_n)" en="Exploring Aut(C_n)" />
      </h3>
      <div className="gt-panel">
        <div className="gt-panel-title">
          <L zh="循环群自同构浏览器" en="Cyclic group automorphism explorer" />
        </div>
        <div className="gt-panel-sub">
          <L
            zh={<><TeX src={String.raw`C_n`} /> 的每个自同构形如 <TeX src={String.raw`a \mapsto a^k`} />，其中 <TeX src={String.raw`\gcd(k,n)=1`} />。选择 <TeX src={String.raw`n`} /> 查看所有单位元及圆盘上的作用。</>}
            en={<>Each automorphism of <TeX src={String.raw`C_n`} /> has the form <TeX src={String.raw`a \mapsto a^k`} /> for <TeX src={String.raw`\gcd(k,n)=1`} />. Choose <TeX src={String.raw`n`} /> to see all units and their action on the dial.</>}
          />
        </div>

        <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <label style={{ color: 'var(--ink)', fontSize: 14 }}>
            <TeX src={String.raw`n`} />
            <input
              type="number"
              className="gt-input"
              value={nInput}
              min={2}
              max={120}
              style={{ width: 72, marginLeft: 8 }}
              onChange={e => {
                setNInput(e.target.value);
                setSelectedK(null);
              }}
            />
          </label>
          <button
            className={`gt-btn-ghost`}
            style={{ fontSize: 13 }}
            onClick={() => setShowMulTable(v => !v)}
          >
            <L zh={showMulTable ? '隐藏乘法表' : '显示乘法表'} en={showMulTable ? 'Hide mult. table' : 'Show mult. table'} />
          </button>
        </div>

        {/* Results row */}
        <div className="gt-panel-result" style={{ marginTop: 12 }}>
          <div className="gt-result-row">
            <span className="gt-result-label"><TeX src={String.raw`\varphi(n)`} /></span>
            <span className="gt-result-val-strong">{phiN}</span>
          </div>
          <div className="gt-result-row">
            <span className="gt-result-label">
              <L zh="单位元集" en="Unit group" />
            </span>
            <span className="gt-result-val gt-mono" style={{ fontSize: 13 }}>
              {'{' + us.join(', ') + '}'}
            </span>
          </div>
          <div className="gt-result-row">
            <span className="gt-result-label">
              <L zh="是否循环" en="Cyclic?" />
            </span>
            <span className="gt-result-val" style={{ color: cyclic ? 'var(--green)' : 'var(--warn)', fontWeight: 600 }}>
              {cyclic
                ? (isZh ? `是 — 最小原根 g = ${primitiveRoot}` : `Yes — smallest primitive root g = ${primitiveRoot}`)
                : tr({ zh: '否（无原根）', en: 'No (no primitive root)'
                                              })}
            </span>
          </div>
          {cyclic && primitiveRoot != null && (
            <div className="gt-result-row" style={{ flexWrap: 'wrap' }}>
              <span className="gt-result-label">
                <L zh={`g^0, …, g^{${phiN - 1}}`} en={`g^0, …, g^{${phiN - 1}}`} />
              </span>
              <span className="gt-result-val gt-mono" style={{ fontSize: 13 }}>
                {'[' + powers.join(', ') + ']'}
              </span>
            </div>
          )}
        </div>

        {/* Unit chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
          {us.map((k) => {
            const rank = powerRank.get(k);
            const color = cyclic && rank !== undefined ? PALETTE[rank % PALETTE.length] : undefined;
            const isActive = k === effectiveK;
            return (
              <button
                key={k}
                className={`gt-chip${isActive ? ' gt-chip-active' : ''}`}
                style={color ? { borderColor: color, color: isActive ? '#fff' : color, background: isActive ? color : undefined } : undefined}
                onClick={() => setSelectedK(k === effectiveK ? null : k)}
              >
                {k}
              </button>
            );
          })}
        </div>

        {/* SVG dial */}
        <div style={{ marginTop: 20, maxWidth: 340, width: '100%', margin: '20px auto 0' }}>
          <svg viewBox="0 0 240 240" width="100%" aria-label={(isZh ? `C_${n} 拨盘` : `C_${n} dial`)}>
            {/* Tick circle */}
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--rule)" strokeWidth={1} />

            {/* Arrow: for effectiveK, draw chord from i to (effectiveK*i)%n */}
            {us.includes(effectiveK) && Array.from({ length: n }, (_, i) => {
              const target = (effectiveK * i) % n;
              if (target === i) return null;
              const [x1, y1] = dotPos(i, n);
              const [x2, y2] = dotPos(target, n);
              // midpoint offset for curve
              const mx = (x1 + x2) / 2 + (CY - (y1 + y2) / 2) * 0.18;
              const my = (y1 + y2) / 2 + ((x1 + x2) / 2 - CX) * 0.18;
              return (
                <g key={i}>
                  <path
                    d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth={1.2}
                    strokeOpacity={0.55}
                    markerEnd="url(#arrowAut)"
                  />
                </g>
              );
            })}

            {/* Arrow marker */}
            <defs>
              <marker id="arrowAut" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="var(--accent)" opacity={0.7} />
              </marker>
            </defs>

            {/* Dots */}
            {Array.from({ length: n }, (_, i) => {
              const [x, y] = dotPos(i, n);
              const coprime = i > 0 && gcd(i, n) === 1;
              const rank = powerRank.get(i);
              const color = cyclic && rank !== undefined ? PALETTE[rank % PALETTE.length] : 'var(--green)';
              return (
                <g key={i}>
                  <circle
                    cx={x} cy={y} r={dotR}
                    fill={i === 0 ? 'var(--gold)' : coprime ? color : 'none'}
                    stroke={i === 0 ? 'var(--gold)' : coprime ? color : 'var(--rule)'}
                    strokeWidth={1.5}
                  />
                  {n <= 30 && (
                    <text
                      x={x + (x - CX) * 0.28}
                      y={y + (y - CY) * 0.28}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={n > 20 ? 7 : 9}
                      fill={coprime || i === 0 ? 'var(--ink)' : 'var(--ink-faint)'}
                    >
                      {i}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Center label */}
            <text x={CX} y={CY - 10} textAnchor="middle" fontSize={11} fill="var(--ink-dim)">
              {isZh ? `C${n}` : `C${n}`}
            </text>
            <text x={CX} y={CY + 8} textAnchor="middle" fontSize={10} fill="var(--ink-dim)">
              <L zh={`a↦a^${effectiveK}`} en={`a↦a^${effectiveK}`} />
            </text>
          </svg>
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-dim)', marginTop: 4 }}>
            <L
              zh={<>绿色 / 彩色圆点 = 与 <TeX src={String.raw`n`} /> 互质的元素（单位元）；弧线 = 自同构 <TeX src={String.raw`a \mapsto a^{${effectiveK}}`} /> 的作用。</>}
              en={<>Filled dots = units (coprime to <TeX src={String.raw`n`} />); arcs = automorphism <TeX src={String.raw`a \mapsto a^{${effectiveK}}`} />.</>}
            />
          </p>
        </div>

        {/* Multiplication table */}
        {showMulTable && mulTableData && (
          <div style={{ marginTop: 16, overflowX: 'auto' }}>
            <p style={{ fontSize: 13, color: 'var(--ink-dim)', marginBottom: 6 }}>
              <L zh={`(Z/${n})× 乘法表（单位元集内部）`} en={`Multiplication table of (Z/${n})×`} />
            </p>
            <table className="gt-compare" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ background: 'var(--bg-deep)' }}>×</th>
                  {us.map(k => <th key={k}>{k}</th>)}
                </tr>
              </thead>
              <tbody>
                {us.map((row, ri) => (
                  <tr key={row}>
                    <td style={{ fontWeight: 600, background: 'var(--bg-deep)' }}>{row}</td>
                    {(mulTableData[ri]).map((v, ci) => (
                      <td key={ci} style={{ textAlign: 'center', color: v === 1 ? 'var(--gold)' : undefined, fontWeight: v === 1 ? 700 : undefined }}>
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {showMulTable && us.length > 16 && (
          <p style={{ fontSize: 12, color: 'var(--warn)', marginTop: 8 }}>
            <L zh={`n=${n} 时单位元数 ${phiN} > 16，乘法表不显示（过大）。`} en={`φ(${n}) = ${phiN} > 16; mult. table hidden (too large).`} />
          </p>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          WIDGET 2: Aut(V4) ≅ S3 — Klein four-group automorphisms
      ══════════════════════════════════════════════════════════════════ */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 48, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="Klein 四元群的自同构：Aut(V₄) ≅ S₃" en="Automorphisms of the Klein four-group: Aut(V₄) ≅ S₃" />
      </h3>
      <p style={{ color: 'var(--ink-dim)', fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
        <L
          zh={<>
            Klein 四元群 <TeX src={String.raw`V_4 = C_2 \times C_2`} /> 是阿贝尔群，故 <TeX src={String.raw`\mathrm{Inn}(V_4) = 1`} />，每个非平凡自同构都是"外"的。
            它的 3 个非单位元 <TeX src={String.raw`a=(1,0), b=(0,1), c=(1,1)`} /> 满足 <TeX src={String.raw`a + b = c`} />（在 <TeX src={String.raw`\mathbb{F}_2^2`} /> 中按位异或）。
            <em>任意</em>对 3 个非单位元的双射都保持这个关系，因为第三个元素由前两个唯一确定：故 <TeX src={String.raw`\mathrm{Aut}(V_4) \cong S_3`} />，阶为 6。
            更一般地，<TeX src={String.raw`\mathrm{Aut}(C_p^m) \cong \mathrm{GL}(m, \mathbb{F}_p)`} />；对 <TeX src={String.raw`m=p=2`} /> 有 <TeX src={String.raw`|\mathrm{GL}(2,\mathbb{F}_2)| = (4-1)(4-2) = 6`} />。
          </>}
          en={<>
            The Klein four-group <TeX src={String.raw`V_4 = C_2 \times C_2`} /> is abelian, so <TeX src={String.raw`\mathrm{Inn}(V_4) = 1`} /> and every nontrivial automorphism is outer.
            Its three nonidentity elements <TeX src={String.raw`a=(1,0), b=(0,1), c=(1,1)`} /> satisfy <TeX src={String.raw`a + b = c`} /> (XOR in <TeX src={String.raw`\mathbb{F}_2^2`} />).
            <em>Any</em> bijection of the 3 nonidentity elements preserves this relation since the third is forced by the other two: hence <TeX src={String.raw`\mathrm{Aut}(V_4) \cong S_3`} />, of order 6.
            More generally <TeX src={String.raw`\mathrm{Aut}(C_p^m) \cong \mathrm{GL}(m, \mathbb{F}_p)`} />; for <TeX src={String.raw`m=p=2`} />: <TeX src={String.raw`|\mathrm{GL}(2,\mathbb{F}_2)| = (4-1)(4-2) = 6`} />.
          </>}
        />
      </p>

      <div className="gt-panel">
        <div className="gt-panel-title">
          <L zh="V₄ 的 6 个自同构" en="All 6 automorphisms of V₄" />
        </div>
        <div className="gt-panel-sub">
          <L
            zh="点击选择一个自同构，查看它如何置换三角形的三个顶点。"
            en="Click an automorphism to see how it permutes the three vertices of the triangle."
          />
        </div>

        {/* 6-cell row of automorphism chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {V4_AUTS.map((aut, idx) => {
            const label = v4AutLabel(aut);
            return (
              <button
                key={idx}
                className={`gt-chip${v4AutIdx === idx ? ' gt-chip-active' : ''}`}
                style={{ fontFamily: 'var(--mono)', fontSize: 13 }}
                onClick={() => setV4AutIdx(idx)}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginTop: 20, alignItems: 'flex-start', justifyContent: 'center' }}>
          {/* Triangle SVG */}
          <div style={{ maxWidth: 220, width: '100%' }}>
            <svg viewBox="0 0 200 200" width="100%" aria-label={tr({ zh: 'V4 三角形自同构图', en: 'V4 automorphism triangle'
            })}>
              <defs>
                <marker id="arrowV4" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                  <path d="M0,0 L7,3.5 L0,7 Z" fill="var(--accent-2)" />
                </marker>
              </defs>
              {/* Triangle vertices: a=top, b=bottom-left, c=bottom-right */}
              {/* a=(1,0) b=(0,1) c=(1,1) */}
              {(() => {
                const vpos: Record<number, [number, number]> = {
                  1: [100, 30],   // a
                  2: [30, 165],   // b
                  3: [170, 165],  // c
                };
                const vcolors: string[] = ['', '#8B2E3C', '#2A4D69', '#3F7050'];
                const vnames = ['', 'a', 'b', 'c'];
                // Draw edges
                const edges: [number, number][] = [[1, 2], [2, 3], [1, 3]];
                return (
                  <>
                    {/* identity 'e' at center */}
                    <circle cx={100} cy={120} r={14} fill="var(--bg-deep)" stroke="var(--rule)" strokeWidth={1.5} />
                    <text x={100} y={120} textAnchor="middle" dominantBaseline="middle" fontSize={12} fill="var(--ink-dim)">e</text>
                    {/* edges */}
                    {edges.map(([u, v]) => {
                      const [ux, uy] = vpos[u], [vx, vy] = vpos[v];
                      return <line key={`${u}-${v}`} x1={ux} y1={uy} x2={vx} y2={vy} stroke="var(--rule)" strokeWidth={1.5} />;
                    })}
                    {/* mapping arrows */}
                    {([1, 2, 3] as const).map((nid) => {
                      const img = v4Image(nid);
                      if (img === nid) return null;
                      const [x1, y1] = vpos[nid], [x2, y2] = vpos[img];
                      const mx = (x1 + x2) / 2 + (y2 - y1) * 0.3;
                      const my = (y1 + y2) / 2 + (x1 - x2) * 0.3;
                      return (
                        <path key={nid}
                          d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
                          fill="none" stroke="var(--accent-2)" strokeWidth={2}
                          markerEnd="url(#arrowV4)"
                        />
                      );
                    })}
                    {/* vertex circles */}
                    {([1, 2, 3] as const).map(nid => {
                      const [x, y] = vpos[nid];
                      const isFixed = v4Image(nid) === nid;
                      return (
                        <g key={nid}>
                          <circle cx={x} cy={y} r={16}
                            fill={isFixed ? vcolors[nid] : 'var(--bg-elev)'}
                            stroke={vcolors[nid]} strokeWidth={2}
                          />
                          <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={13}
                            fill={isFixed ? '#fff' : vcolors[nid]} fontFamily="var(--mono)" fontWeight={600}>
                            {vnames[nid]}
                          </text>
                        </g>
                      );
                    })}
                  </>
                );
              })()}
            </svg>
          </div>

          {/* Info panel */}
          <div style={{ flex: '1 1 160px', minWidth: 160 }}>
            <div style={{ fontSize: 13, color: 'var(--ink-dim)', marginBottom: 8 }}>
              <L zh="当前自同构" en="Selected automorphism" />
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 15, marginBottom: 10 }}>
              {v4AutLabel(selAut) === 'id'
                ? tr({ zh: '恒等映射 id', en: 'Identity id'
                                              })
                : v4AutLabel(selAut)}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.8 }}>
              {[1, 2, 3].map(nid => (
                <div key={nid}>
                  <span style={{ fontFamily: 'var(--mono)', color: PALETTE[nid - 1] }}>
                    {['a', 'b', 'c'][nid - 1]}
                  </span>
                  {' → '}
                  <span style={{ fontFamily: 'var(--mono)', color: PALETTE[v4Image(nid) - 1] }}>
                    {['a', 'b', 'c'][v4Image(nid) - 1]}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, fontSize: 13, color: 'var(--ink-dim)', lineHeight: 1.7 }}>
              <L
                zh={<>
                  关系验证：<br />
                  <TeX src={String.raw`\varphi(a) + \varphi(b)`} /> = {' '}
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>
                    {['a', 'b', 'c'][v4Image(1) - 1]} + {['a', 'b', 'c'][v4Image(2) - 1]}
                    {' = '}
                    {['a', 'b', 'c'][v4Add(v4Image(1), v4Image(2)) - 1]}
                  </span>
                  {' = '}
                  <TeX src={String.raw`\varphi(c)`} />: <span style={{ color: 'var(--green)', fontWeight: 700 }}>✓</span>
                </>}
                en={<>
                  Relation check:<br />
                  <TeX src={String.raw`\varphi(a) + \varphi(b)`} /> ={' '}
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>
                    {['a', 'b', 'c'][v4Image(1) - 1]} + {['a', 'b', 'c'][v4Image(2) - 1]}
                    {' = '}
                    {['a', 'b', 'c'][v4Add(v4Image(1), v4Image(2)) - 1]}
                  </span>
                  {' = '}
                  <TeX src={String.raw`\varphi(c)`} />: <span style={{ color: 'var(--green)', fontWeight: 700 }}>✓</span>
                </>}
              />
            </div>
            <div style={{ marginTop: 10, fontSize: 13, color: 'var(--ink-dim)' }}>
              <L
                zh={<>
                  Inn(V₄) = 1（<TeX src={String.raw`V_4`} /> 是阿贝尔群），故<strong>每个</strong>非平凡自同构都是外自同构。
                  |Inn| = {1}，|Aut| = 6，|Out| = 6。
                </>}
                en={<>
                  Inn(V₄) = 1 (<TeX src={String.raw`V_4`} /> abelian), so <strong>every</strong> nontrivial automorphism is outer.
                  |Inn| = 1, |Aut| = 6, |Out| = 6.
                </>}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          WIDGET 3: Inn(G) conjugation visualizer
      ══════════════════════════════════════════════════════════════════ */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 48, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="共轭作用与 Inn(G) = G/Z(G)" en="Conjugation action and Inn(G) = G/Z(G)" />
      </h3>
      <div className="gt-panel">
        <div className="gt-panel-title">
          <L zh="内自同构可视化" en="Inner automorphism visualizer" />
        </div>
        <div className="gt-panel-sub">
          <L
            zh={<>对群 <TeX src={String.raw`G`} /> 和共轭元 <TeX src={String.raw`g`} />，可视化 <TeX src={String.raw`c_g: x \mapsto gxg^{-1}`} /> 作为 <TeX src={String.raw`G`} /> 上的置换。中心元素给出恒等置换。</>}
            en={<>For group <TeX src={String.raw`G`} /> and conjugating element <TeX src={String.raw`g`} />, visualize <TeX src={String.raw`c_g: x \mapsto gxg^{-1}`} /> as a permutation of <TeX src={String.raw`G`} />. Center elements give the identity permutation.</>}
          />
        </div>

        <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <label style={{ fontSize: 14, color: 'var(--ink)' }}>
            <L zh="群" en="Group" />
            <select
              className="gt-input"
              style={{ marginLeft: 8 }}
              value={groupIdx}
              onChange={e => { setGroupIdx(Number(e.target.value)); setConjG(0); }}
            >
              {GROUPS.map((g, i) => (
                <option key={i} value={i}>{isZh ? g.nameZh : g.name}</option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 14, color: 'var(--ink)' }}>
            <TeX src={String.raw`g`} /> =
            <select
              className="gt-input"
              style={{ marginLeft: 8 }}
              value={safeConjG}
              onChange={e => setConjG(Number(e.target.value))}
            >
              {Array.from({ length: grp.n }, (_, i) => (
                <option key={i} value={i}>{grp.label(i)}</option>
              ))}
            </select>
          </label>
        </div>

        {/* Permutation diagram SVG */}
        <div style={{ marginTop: 16, overflowX: 'auto' }}>
          <svg viewBox={`0 0 ${svgW + 20} ${svgH}`} width="100%" style={{ minWidth: Math.min(svgW + 20, 300) }}>
            <defs>
              <marker id="arrowConj" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="var(--accent)" opacity={0.8} />
              </marker>
            </defs>
            {Array.from({ length: grp.n }, (_, x) => {
              const img = conjPerm[x];
              const isCenter = centerActual.includes(x);
              const isFixed = img === x;
              const nx = nodeX(x), ny = nodeY(x);
              const ni = nodeX(img), niy = nodeY(img);
              return (
                <g key={x}>
                  {/* Arrow if non-fixed */}
                  {!isFixed && (
                    <path
                      d={`M ${nx} ${ny} Q ${(nx + ni) / 2 + 20} ${(ny + niy) / 2 - 18} ${ni} ${niy}`}
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth={1.5}
                      strokeOpacity={0.7}
                      markerEnd="url(#arrowConj)"
                    />
                  )}
                  {/* Node */}
                  <rect
                    x={nx - nodeW / 2} y={ny - nodeH / 2}
                    width={nodeW} height={nodeH}
                    rx={6}
                    fill={isCenter ? 'var(--gold)' : isFixed ? 'var(--green)' : 'var(--bg-elev)'}
                    fillOpacity={isCenter ? 0.3 : isFixed ? 0.25 : 1}
                    stroke={isCenter ? 'var(--gold)' : isFixed ? 'var(--green)' : 'var(--rule)'}
                    strokeWidth={isCenter || isFixed ? 2 : 1}
                  />
                  <text x={nx} y={ny} textAnchor="middle" dominantBaseline="middle"
                    fontSize={11} fontFamily="var(--mono)"
                    fill={isCenter ? 'var(--gold)' : isFixed ? 'var(--green)' : 'var(--ink)'}>
                    {grp.label(x)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Stats */}
        <div className="gt-panel-result" style={{ marginTop: 8 }}>
          <div className="gt-result-row">
            <span className="gt-result-label">
              <L zh="中心 Z(G)" en="Center Z(G)" />
            </span>
            <span className="gt-result-val gt-mono">
              {'{'}{centerActual.map(x => grp.label(x)).join(', ')}{'}'}
            </span>
          </div>
          <div className="gt-result-row">
            <span className="gt-result-label">|Z(G)|</span>
            <span className="gt-result-val-strong">{centerActual.length}</span>
          </div>
          <div className="gt-result-row">
            <span className="gt-result-label">|Inn(G)|</span>
            <span className="gt-result-val-strong">{innSize}</span>
          </div>
          <div className="gt-result-row">
            <span className="gt-result-label">|G| / |Z(G)|</span>
            <span className="gt-result-val-strong">{grp.n / centerActual.length}</span>
          </div>
          <div className="gt-result-row">
            <span className="gt-result-label">
              <L zh="验证：|Inn| = |G/Z|" en="Check: |Inn| = |G/Z|" />
            </span>
            <span className="gt-result-val" style={{
              color: innSize === grp.n / centerActual.length ? 'var(--green)' : 'var(--warn)',
              fontWeight: 600
            }}>
              {innSize === grp.n / centerActual.length
                ? tr({ zh: '✓ 一致', en: '✓ Consistent' })
                : tr({ zh: '✗ 不一致', en: '✗ Mismatch' })}
            </span>
          </div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 8 }}>
          <L
            zh={<>金色边框 = 中心元素（给恒等置换）；绿色 = 当前共轭元固定的元素；箭头 = <TeX src={String.raw`c_g`} /> 的非平凡映射。</>}
            en={<>Gold border = center elements (identity permutation); green = elements fixed by current <TeX src={String.raw`c_g`} />; arrows = nontrivial mappings of <TeX src={String.raw`c_g`} />.</>}
          />
        </p>
      </div>

      {/* ── Characteristic subgroups note ───────────────────────────────────── */}
      <div className="gt-aside" style={{ marginTop: 32 }}>
        <L
          zh={<>
            <strong>特征子群</strong>（characteristic subgroup）比正规子群更强：<TeX src={String.raw`H \leq G`} /> 是<strong>特征子群</strong>，
            若对<em>所有</em>自同构 <TeX src={String.raw`\varphi \in \mathrm{Aut}(G)`} /> 都有 <TeX src={String.raw`\varphi(H) = H`} />（而正规子群只需对内自同构 <TeX src={String.raw`\mathrm{Inn}(G)`} /> 成立）。
            典型例子：中心 <TeX src={String.raw`Z(G)`} />、换位子群 <TeX src={String.raw`[G,G]`} />、Frattini 子群均是特征子群。
            特征具有传递性：若 <TeX src={String.raw`K`} /> char <TeX src={String.raw`H`} /> 且 <TeX src={String.raw`H`} /> char <TeX src={String.raw`G`} />，则 <TeX src={String.raw`K`} /> char <TeX src={String.raw`G`} />。
          </>}
          en={<>
            A <strong>characteristic subgroup</strong> is stronger than a normal one: <TeX src={String.raw`H \leq G`} /> is <strong>characteristic</strong> if <TeX src={String.raw`\varphi(H) = H`} /> for <em>all</em> <TeX src={String.raw`\varphi \in \mathrm{Aut}(G)`} /> (normality only requires invariance under <TeX src={String.raw`\mathrm{Inn}(G)`} />).
            Classic examples: the center <TeX src={String.raw`Z(G)`} />, the commutator subgroup <TeX src={String.raw`[G,G]`} />, and the Frattini subgroup are all characteristic.
            Characteristic is transitive: if <TeX src={String.raw`K`} /> char <TeX src={String.raw`H`} /> and <TeX src={String.raw`H`} /> char <TeX src={String.raw`G`} />, then <TeX src={String.raw`K`} /> char <TeX src={String.raw`G`} />.
          </>}
        />
      </div>

      {/* ── References ───────────────────────────────────────────────────────── */}
      <div style={{ marginTop: 36, paddingTop: 20, borderTop: '1px solid var(--rule)', fontSize: 13, color: 'var(--ink-dim)', lineHeight: 1.8 }}>
        <strong style={{ color: 'var(--ink)' }}>
          <L zh="参考文献" en="References" />
        </strong>
        <ul style={{ marginTop: 8, paddingLeft: 20 }}>
          <li>Dummit &amp; Foote, <em>Abstract Algebra</em>, 3rd ed., §4.4 — Aut(<em>C</em><sub>n</sub>) ≅ (<TeX src={String.raw`\mathbb{Z}/n)^\times`} /> and Inn(G) ≅ G/Z(G).</li>
          <li>J. J. Rotman, <em>An Introduction to the Theory of Groups</em>, 4th ed. (GTM 148), §7 — completeness of <em>S</em><sub>n</sub> (Thm 7.5) and the outer automorphism of <em>S</em><sub>6</sub>.</li>
          <li>G. Janusz &amp; J. Rotman, &ldquo;Outer automorphisms of S<sub>6</sub>&rdquo;, <em>Amer. Math. Monthly</em> <strong>89</strong> (1982), 407–410.</li>
          <li>Wikipedia, &ldquo;Automorphisms of the symmetric and alternating groups&rdquo; and &ldquo;Multiplicative group of integers modulo n&rdquo; (Gauss: cyclic iff <em>n</em> ∈ {'{'}1,2,4,<em>p<sup>k</sup></em>,2<em>p<sup>k</sup></em>{'}'}).</li>
        </ul>
      </div>
    </GTSec>
  );
}
