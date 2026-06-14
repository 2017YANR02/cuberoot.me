'use client';

import { useState, useMemo } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { tr } from '@/i18n/tr';

// ── Types ─────────────────────────────────────────────────────────────────────

type GroupName = 'S3' | 'S4' | 'A4' | 'D4' | 'Q8';
type ColorBy = 'order' | 'class';

// A permutation on n elements represented as a number[] (0-indexed).
type Perm = number[];

// ── Permutation arithmetic ────────────────────────────────────────────────────

function permMul(p: Perm, q: Perm): Perm {
  return p.map((_, i) => p[q[i]]);
}

function permInv(p: Perm): Perm {
  const inv = new Array<number>(p.length);
  for (let i = 0; i < p.length; i++) inv[p[i]] = i;
  return inv;
}

function permEq(p: Perm, q: Perm): boolean {
  return p.every((v, i) => v === q[i]);
}

function permOrder(p: Perm): number {
  let cur = [...p];
  const id = p.map((_, i) => i);
  for (let k = 1; k <= 60; k++) {
    if (permEq(cur, id)) return k;
    cur = permMul(cur, p);
  }
  return 0;
}

function permConjugate(g: Perm, a: Perm): Perm {
  // g * a * g^{-1}
  const gInv = permInv(g);
  return permMul(permMul(g, a), gInv);
}

function permsEqual(p: Perm, q: Perm): boolean {
  if (p.length !== q.length) return false;
  return p.every((v, i) => v === q[i]);
}

// Render a permutation in cycle notation (omit 1-cycles for readability)
function toCycleNotation(p: Perm, labels?: string[]): string {
  const lbl = labels ?? p.map((_, i) => String(i + 1));
  const visited = new Array<boolean>(p.length).fill(false);
  const cycles: string[] = [];
  for (let i = 0; i < p.length; i++) {
    if (!visited[i] && p[i] !== i) {
      const cycle: number[] = [];
      let j = i;
      while (!visited[j]) { visited[j] = true; cycle.push(j); j = p[j]; }
      cycles.push('(' + cycle.map(x => lbl[x]).join('') + ')');
    }
  }
  return cycles.length === 0 ? 'e' : cycles.join('');
}

// ── Group generators / element enumeration ────────────────────────────────────

function generateGroup(generators: Perm[], n: number): Perm[] {
  const id: Perm = Array.from({ length: n }, (_, i) => i);
  const elems: Perm[] = [id];
  let queue = [id];
  const seen = new Set<string>();
  seen.add(JSON.stringify(id));

  while (queue.length > 0) {
    const next: Perm[] = [];
    for (const g of queue) {
      for (const gen of generators) {
        const prod = permMul(g, gen);
        const key = JSON.stringify(prod);
        if (!seen.has(key)) {
          seen.add(key);
          elems.push(prod);
          next.push(prod);
        }
      }
    }
    queue = next;
  }
  return elems;
}

// ── Small group definitions ───────────────────────────────────────────────────

// S3: symmetric group on {0,1,2}, order 6
function makeS3(): Perm[] {
  const r: Perm = [1, 2, 0]; // (012)
  const s: Perm = [1, 0, 2]; // (01)
  return generateGroup([r, s], 3);
}

// S4: symmetric group on {0,1,2,3}, order 24
function makeS4(): Perm[] {
  const r: Perm = [1, 2, 3, 0]; // (0123)
  const s: Perm = [1, 0, 2, 3]; // (01)
  return generateGroup([r, s], 4);
}

// A4: alternating group on {0,1,2,3}, order 12
// generators: (012) and (01)(23)
function makeA4(): Perm[] {
  const a: Perm = [1, 2, 0, 3]; // (012)
  const b: Perm = [1, 0, 3, 2]; // (01)(23)
  return generateGroup([a, b], 4);
}

// D4: dihedral group of order 8, realized as perms on {0,1,2,3} (vertices of square)
// r = (0123), s = (02) [reflection through horizontal axis]
function makeD4(): Perm[] {
  const r: Perm = [1, 2, 3, 0]; // rotation by 90
  const s: Perm = [2, 1, 0, 3]; // reflection: fixes 1,3; swaps 0,2
  return generateGroup([r, s], 4);
}

// Q8: quaternion group of order 8, via left-regular representation on 8 points.
// Elements: 1,-1,i,-i,j,-j,k,-k labeled 0..7
// Multiplication table (Cayley table) encoded as permutations.
// Index: 0=1, 1=-1, 2=i, 3=-i, 4=j, 5=-j, 6=k, 7=-k
// mul: q8Mul[a][b] = a*b
const Q8_MUL: number[][] = [
  // 1   -1   i   -i   j   -j   k   -k
  [0, 1, 2, 3, 4, 5, 6, 7], // 1 * x = x
  [1, 0, 3, 2, 5, 4, 7, 6], // -1 * x
  [2, 3, 1, 0, 6, 7, 5, 4], // i * x
  [3, 2, 0, 1, 7, 6, 4, 5], // -i * x
  [4, 5, 7, 6, 1, 0, 2, 3], // j * x
  [5, 4, 6, 7, 0, 1, 3, 2], // -j * x
  [6, 7, 4, 5, 3, 2, 1, 0], // k * x
  [7, 6, 5, 4, 2, 3, 0, 1], // -k * x
];

// Build Q8 as permutations via the left-regular representation:
// Each element a corresponds to the permutation pi_a(b) = a*b (row a of multiplication table)
function makeQ8(): Perm[] {
  return Q8_MUL.map(row => row);
}

// ── Conjugacy class computation ───────────────────────────────────────────────

interface ConjugacyClass {
  members: number[]; // indices into elements array
  size: number;
  centralizerOrder: number;
  isCenter: boolean;
  repIdx: number; // index of a representative
}

function computeConjugacyClasses(elems: Perm[]): ConjugacyClass[] {
  const n = elems.length;
  const assigned = new Array<boolean>(n).fill(false);
  const classes: ConjugacyClass[] = [];

  for (let a = 0; a < n; a++) {
    if (assigned[a]) continue;
    const classMembers = new Set<number>();
    for (let g = 0; g < n; g++) {
      const conj = permConjugate(elems[g], elems[a]);
      for (let b = 0; b < n; b++) {
        if (permsEqual(conj, elems[b])) {
          classMembers.add(b);
          break;
        }
      }
    }
    const members = Array.from(classMembers).sort((x, y) => x - y);
    members.forEach(m => { assigned[m] = true; });
    const size = members.length;
    const centralizerOrder = Math.round(n / size);
    classes.push({
      members,
      size,
      centralizerOrder,
      isCenter: size === 1,
      repIdx: a,
    });
  }
  // Sort: singleton classes (center) first, then by size ascending
  classes.sort((a, b) => {
    if (a.isCenter !== b.isCenter) return a.isCenter ? -1 : 1;
    return a.size - b.size;
  });
  return classes;
}

// ── Element labels per group ──────────────────────────────────────────────────

function getGroupData(name: GroupName): {
  elems: Perm[];
  labels: string[];
  permN: number;
} {
  switch (name) {
    case 'S3': {
      const elems = makeS3();
      return { elems, labels: elems.map(p => toCycleNotation(p)), permN: 3 };
    }
    case 'S4': {
      const elems = makeS4();
      return { elems, labels: elems.map(p => toCycleNotation(p)), permN: 4 };
    }
    case 'A4': {
      const elems = makeA4();
      return { elems, labels: elems.map(p => toCycleNotation(p)), permN: 4 };
    }
    case 'D4': {
      const elems = makeD4();
      // Human-readable labels for D4: r^i (rotation) or r^i s (reflection).
      // r = (0123) generates the 4 rotations; s = (02) is one reflection.
      // Every element is uniquely r^k or r^k s. With permMul(p,q)=p∘q and s an
      // involution, a reflection p satisfies p = r^k s, i.e. r^k = p s, so we
      // recover k by matching p (or p∘s) against the precomputed rotations.
      const r: Perm = [1, 2, 3, 0];
      const s: Perm = [2, 1, 0, 3];
      const id: Perm = [0, 1, 2, 3];
      const rot: Perm[] = [];
      let cur: Perm = [...id];
      for (let k = 0; k < 4; k++) { rot.push([...cur]); cur = permMul(cur, r); }
      const labels = elems.map(p => {
        for (let k = 0; k < 4; k++) {
          if (permsEqual(rot[k], p)) return k === 0 ? 'e' : `r${k}`;
        }
        const ps = permMul(p, s); // p∘s should be a rotation r^k
        for (let k = 0; k < 4; k++) {
          if (permsEqual(rot[k], ps)) return k === 0 ? 's' : `r${k}s`;
        }
        return '?';
      });
      return { elems, labels, permN: 4 };
    }
    case 'Q8': {
      const elems = makeQ8();
      const q8labels = ['1', '-1', 'i', '-i', 'j', '-j', 'k', '-k'];
      // The left-regular rep permutes indices; we label by the group element index (row 0..7)
      const labels = elems.map(perm => {
        // The identity corresponds to row [0,1,2,3,4,5,6,7]
        // Element a corresponds to row Q8_MUL[a]
        const idx = Q8_MUL.findIndex(row => row.every((v, i) => v === perm[i]));
        return idx >= 0 ? q8labels[idx] : '?';
      });
      return { elems, labels, permN: 8 };
    }
  }
}

// ── Integer partitions of n ───────────────────────────────────────────────────

function partitions(n: number): number[][] {
  const result: number[][] = [];
  function helper(remaining: number, maxPart: number, current: number[]): void {
    if (remaining === 0) { result.push([...current]); return; }
    for (let p = Math.min(remaining, maxPart); p >= 1; p--) {
      current.push(p);
      helper(remaining - p, p, current);
      current.pop();
    }
  }
  helper(n, n, []);
  return result;
}

function factorial(k: number): number {
  let f = 1;
  for (let i = 2; i <= k; i++) f *= i;
  return f;
}

// Class size in S_n for a partition given as sorted-descending array
// m_k = number of parts equal to k
// size = n! / prod_k (k^{m_k} * m_k!)
function classSize(partition: number[], n: number): number {
  const counts = new Map<number, number>();
  for (const p of partition) counts.set(p, (counts.get(p) ?? 0) + 1);
  let denom = 1;
  for (const [k, mk] of counts) {
    denom *= Math.pow(k, mk) * factorial(mk);
  }
  return factorial(n) / denom;
}

function centralizerSize(partition: number[], n: number): number {
  // centralizer order = n! / class size = denom
  const sz = classSize(partition, n);
  return factorial(n) / sz;
}

// ── Categorical color palette ─────────────────────────────────────────────────

const CLASS_COLORS = [
  '#8B2E3C', '#2A4D69', '#3F7050', '#B8860B',
  '#6B4E9C', '#C2410C', '#5C7CA0', '#9C4E6B',
];

const ORDER_COLORS: Record<number, string> = {
  1: '#3F7050',  // green for identity
  2: '#2A4D69',  // blue
  3: '#B8860B',  // gold
  4: '#8B2E3C',  // red/accent
  8: '#6B4E9C',  // purple
};

function orderColor(ord: number): string {
  return ORDER_COLORS[ord] ?? '#5C7CA0';
}

// ── §50 ClassEquation ─────────────────────────────────────────────────────────

export default function ClassEquation() {
  const lang = useLang();

  return (
    <GTSec id="class-equation" className="gt-sec">
      <div className="gt-sec-num">§50</div>
      <h2 className="gt-sec-title">
        <L zh="类方程与共轭类" en="The class equation" />
      </h2>

      <p className="gt-lede">
        <L
          zh={<>
            共轭把群的元素分拆成不可分割的轨道——<strong>共轭类</strong>。对轨道计数所得的等式，即<strong>类方程</strong>，是群论中最简洁、威力最强的恒等式之一：它把群的阶拆成中心大小与若干类大小之和，并由此推出 <TeX src={String.raw`p`} />-群的中心必非平凡。魔方上的"换位复原"技术，正是对这一数学结构的直觉体现。
          </>}
          en={<>
            Conjugation partitions the elements of a group into indivisible orbits called <strong>conjugacy classes</strong>. Counting those orbits yields the <strong>class equation</strong>, one of the most elegant and powerful identities in group theory: it writes the group order as the size of the center plus a sum of class sizes, and from it one deduces that the center of any <TeX src={String.raw`p`} />-group must be nontrivial. The cuber&apos;s setup-move technique is an intuitive embodiment of precisely this structure.
          </>}
        />
      </p>

      {/* ── Definition: conjugacy ── */}
      <div className="gt-def">
        <div className="gt-def-title">
          <L zh="定义: 共轭、共轭类、中心化子、中心" en="Definitions: conjugacy, conjugacy class, centralizer, center" />
        </div>
        <div className="gt-def-body">
          <p>
            <L
              zh={<>
                设 <TeX src={String.raw`G`} /> 为群，<TeX src={String.raw`a,b\in G`} />。若存在 <TeX src={String.raw`g\in G`} /> 使得 <TeX src={String.raw`b=gag^{-1}`} />，则称 <TeX src={String.raw`b`} /> 与 <TeX src={String.raw`a`} /> <strong>共轭</strong>，记作 <TeX src={String.raw`a\sim b`} />。共轭是等价关系（自反、对称、传递），故将 <TeX src={String.raw`G`} /> 拆分为不相交的等价类。
              </>}
              en={<>
                Let <TeX src={String.raw`G`} /> be a group and <TeX src={String.raw`a,b\in G`} />. We say <TeX src={String.raw`b`} /> is <strong>conjugate</strong> to <TeX src={String.raw`a`} /> if there exists <TeX src={String.raw`g\in G`} /> with <TeX src={String.raw`b=gag^{-1}`} />, written <TeX src={String.raw`a\sim b`} />. Conjugacy is an equivalence relation (reflexive, symmetric, transitive), so it partitions <TeX src={String.raw`G`} /> into disjoint classes.
              </>}
            />
          </p>
          <p>
            <L
              zh={<>
                元素 <TeX src={String.raw`a`} /> 的<strong>共轭类</strong>是 <TeX src={String.raw`\mathrm{cl}(a)=\{gag^{-1}:g\in G\}`} />，即 <TeX src={String.raw`G`} /> 以共轭作用（<TeX src={String.raw`g\cdot a=gag^{-1}`} />）作用于自身时 <TeX src={String.raw`a`} /> 的轨道。<br />
                <TeX src={String.raw`a`} /> 的<strong>中心化子</strong>是 <TeX src={String.raw`C_G(a)=\{g\in G:ga=ag\}`} />——恰好是该共轭作用下 <TeX src={String.raw`a`} /> 的稳定子群。<br />
                群的<strong>中心</strong>是 <TeX src={String.raw`Z(G)=\{z\in G:zg=gz,\,\forall g\in G\}`} />，即所有大小为 1 的共轭类之并；<TeX src={String.raw`a\in Z(G)`} /> 当且仅当 <TeX src={String.raw`\mathrm{cl}(a)=\{a\}`} />。
              </>}
              en={<>
                The <strong>conjugacy class</strong> of <TeX src={String.raw`a`} /> is <TeX src={String.raw`\mathrm{cl}(a)=\{gag^{-1}:g\in G\}`} />, the orbit of <TeX src={String.raw`a`} /> under the conjugation action <TeX src={String.raw`g\cdot a=gag^{-1}`} />.<br />
                The <strong>centralizer</strong> of <TeX src={String.raw`a`} /> is <TeX src={String.raw`C_G(a)=\{g\in G:ga=ag\}`} />, exactly the stabilizer of <TeX src={String.raw`a`} /> under conjugation.<br />
                The <strong>center</strong> is <TeX src={String.raw`Z(G)=\{z\in G:zg=gz\;\forall g\}`} />, the union of all singleton conjugacy classes; <TeX src={String.raw`a\in Z(G)`} /> iff <TeX src={String.raw`\mathrm{cl}(a)=\{a\}`} />.
              </>}
            />
          </p>
        </div>
      </div>

      {/* ── Theorem: orbit-stabilizer + class equation ── */}
      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理: 轨道-稳定子 + 类方程" en="Theorem: Orbit-Stabilizer and the Class Equation" />
        </div>
        <div className="gt-thm-body">
          <p>
            <L
              zh={<>
                对有限群 <TeX src={String.raw`G`} /> 和任意 <TeX src={String.raw`a\in G`} />，由<strong>轨道-稳定子定理</strong>（应用于共轭作用）得
              </>}
              en={<>
                For a finite group <TeX src={String.raw`G`} /> and any <TeX src={String.raw`a\in G`} />, the <strong>orbit-stabilizer theorem</strong> applied to the conjugation action gives
              </>}
            />
          </p>
          <TeXBlock src={String.raw`|\mathrm{cl}(a)| = [G:C_G(a)] = \frac{|G|}{|C_G(a)|}.`} />
          <p>
            <L
              zh={<>
                特别地，每个共轭类的大小整除 <TeX src={String.raw`|G|`} />。设 <TeX src={String.raw`a_1,\ldots,a_r`} /> 是所有<em>非中心</em>共轭类（大小 <TeX src={String.raw`>1`} />）的代表元，则
              </>}
              en={<>
                In particular, each class size divides <TeX src={String.raw`|G|`} />. If <TeX src={String.raw`a_1,\ldots,a_r`} /> are representatives of the distinct <em>non-central</em> conjugacy classes (size <TeX src={String.raw`>1`} />), then
              </>}
            />
          </p>
          <TeXBlock src={String.raw`|G| = |Z(G)| + \sum_{i=1}^{r} [G:C_G(a_i)].`} />
          <p>
            <L
              zh={<>
                这就是<strong>类方程</strong>。<TeX src={String.raw`Z(G)`} /> 一项汇集了所有大小为 1 的类；其余每项 <TeX src={String.raw`[G:C_G(a_i)]>1`} />。
                <em>注意</em>：求和只跑非中心类代表元，不要遍历所有类。
              </>}
              en={<>
                This is the <strong>class equation</strong>. The <TeX src={String.raw`|Z(G)|`} /> term collects all singleton classes; each remaining term <TeX src={String.raw`[G:C_G(a_i)]>1`} />.
                <em>Note</em>: the sum runs over non-central class representatives only, not all classes.
              </>}
            />
          </p>
        </div>
      </div>

      <div className="gt-proof">
        <div className="gt-proof-title">
          <L zh="证明要点" en="Proof sketch" />
        </div>
        <p>
          <L
            zh={<>
              共轭类恰好是 <TeX src={String.raw`G`} /> 在自身上共轭作用的轨道，故彼此不相交且并集为 <TeX src={String.raw`G`} />。大小为 1 的轨道恰好是 <TeX src={String.raw`Z(G)`} /> 的元素（中心元素固定于所有共轭）。对每个大小 <TeX src={String.raw`>1`} /> 的轨道，轨道-稳定子定理给出 <TeX src={String.raw`|\mathrm{cl}(a_i)|=|G|/|C_G(a_i)|`} />。将所有轨道大小相加即得类方程。
            </>}
            en={<>
              Conjugacy classes are exactly the orbits of the conjugation action of <TeX src={String.raw`G`} /> on itself, so they are pairwise disjoint and their union is <TeX src={String.raw`G`} />. The size-1 orbits are precisely the elements of <TeX src={String.raw`Z(G)`} /> (central elements are fixed by all conjugations). For each non-central orbit, orbit-stabilizer gives <TeX src={String.raw`|\mathrm{cl}(a_i)|=|G|/|C_G(a_i)|`} />. Summing all orbit sizes yields the class equation.
            </>}
          />
        </p>
        <div className="gt-proof-end">□</div>
      </div>

      {/* ── p-group corollary ── */}
      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="推论: p-群的中心非平凡" en="Corollary: Nontrivial center of a p-group" />
        </div>
        <div className="gt-thm-body">
          <p>
            <L
              zh={<>
                若 <TeX src={String.raw`|G|=p^k`} />（<TeX src={String.raw`p`} /> 为素数，<TeX src={String.raw`k\geq 1`} />），则 <TeX src={String.raw`p\mid|Z(G)|`} />，特别是 <TeX src={String.raw`Z(G)\neq\{e\}`} />。
              </>}
              en={<>
                If <TeX src={String.raw`|G|=p^k`} /> for a prime <TeX src={String.raw`p`} /> and <TeX src={String.raw`k\geq 1`} />, then <TeX src={String.raw`p\mid|Z(G)|`} />, so in particular <TeX src={String.raw`Z(G)\neq\{e\}`} />.
              </>}
            />
          </p>
          <p>
            <L
              zh={<>
                <strong>证明：</strong>类方程右边每个非中心项 <TeX src={String.raw`[G:C_G(a_i)]`} /> 整除 <TeX src={String.raw`|G|=p^k`} /> 且大于 1，故被 <TeX src={String.raw`p`} /> 整除。由于 <TeX src={String.raw`p\mid|G|`} />，于是 <TeX src={String.raw`p\mid|Z(G)|`} />，因而 <TeX src={String.raw`|Z(G)|\geq p`} />。推论：阶为 <TeX src={String.raw`p^2`} /> 的群必为 Abel 群（因为 <TeX src={String.raw`G/Z(G)`} /> 是循环群时 <TeX src={String.raw`G`} /> 为 Abel 群）。
              </>}
              en={<>
                <strong>Proof:</strong> Each non-central term <TeX src={String.raw`[G:C_G(a_i)]`} /> divides <TeX src={String.raw`|G|=p^k`} /> and exceeds 1, so is divisible by <TeX src={String.raw`p`} />. Since <TeX src={String.raw`p\mid|G|`} />, the class equation forces <TeX src={String.raw`p\mid|Z(G)|`} />, so <TeX src={String.raw`|Z(G)|\geq p`} />. Corollary: every group of order <TeX src={String.raw`p^2`} /> is abelian (for if <TeX src={String.raw`G/Z(G)`} /> is cyclic, <TeX src={String.raw`G`} /> is abelian).
              </>}
            />
          </p>
        </div>
      </div>

      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="S_n 中的共轭类: 轮换型" en="Conjugacy classes of S_n: cycle types" />
      </h3>

      <p>
        <L
          zh={<>
            在对称群 <TeX src={String.raw`S_n`} /> 中，两个置换共轭当且仅当它们具有相同的<strong>轮换型</strong>（不相交轮换分解中各轮换长度的多重集，即 <TeX src={String.raw`n`} /> 的一个分拆）。共轭用 <TeX src={String.raw`\sigma`} /> 对轮换的元素重新标号：
          </>}
          en={<>
            In the symmetric group <TeX src={String.raw`S_n`} />, two permutations are conjugate if and only if they have the same <strong>cycle type</strong> (the multiset of cycle lengths in their disjoint-cycle decomposition, i.e. a partition of <TeX src={String.raw`n`} />). Conjugation by <TeX src={String.raw`\sigma`} /> simply relabels the entries of each cycle:
          </>}
        />
      </p>
      <TeXBlock src={String.raw`\sigma(a_1\;a_2\;\cdots\;a_k)\sigma^{-1} = (\sigma(a_1)\;\sigma(a_2)\;\cdots\;\sigma(a_k)).`} />
      <p>
        <L
          zh={<>
            因此 <TeX src={String.raw`S_n`} /> 的共轭类个数恰好等于 <TeX src={String.raw`n`} /> 的分拆数 <TeX src={String.raw`p(n)`} />（<TeX src={String.raw`p(3)=3,\,p(4)=5,\,p(5)=7`} />）。若分拆中 <TeX src={String.raw`k`} />-轮换有 <TeX src={String.raw`m_k`} /> 个（即 <TeX src={String.raw`\sum_k k\,m_k=n`} />），则该类的大小为
          </>}
          en={<>
            Hence the number of conjugacy classes of <TeX src={String.raw`S_n`} /> equals the number of partitions <TeX src={String.raw`p(n)`} /> (<TeX src={String.raw`p(3)=3,\,p(4)=5,\,p(5)=7`} />). If the partition has <TeX src={String.raw`m_k`} /> cycles of length <TeX src={String.raw`k`} /> (so <TeX src={String.raw`\sum_k k\,m_k=n`} />), the class size is
          </>}
        />
      </p>
      <TeXBlock src={String.raw`\frac{n!}{\displaystyle\prod_{k\geq 1} k^{m_k}\cdot m_k!}.`} />
      <p>
        <L
          zh={<>
            分母中的 <TeX src={String.raw`m_k!`} /> 对应于置换等长轮换，<TeX src={String.raw`k^{m_k}`} /> 对应于在每条 <TeX src={String.raw`k`} />-轮换内的循环旋转。
            <strong>警告</strong>：该公式只对 <TeX src={String.raw`S_n`} /> 有效，对子群（如 <TeX src={String.raw`A_n`} />）无效。在 <TeX src={String.raw`A_4`} /> 中，<TeX src={String.raw`S_4`} /> 中的 8 个三轮换分裂成两个 <TeX src={String.raw`A_4`} />-类，每个大小为 4。
          </>}
          en={<>
            The factor <TeX src={String.raw`m_k!`} /> accounts for permuting equal-length cycles; <TeX src={String.raw`k^{m_k}`} /> accounts for cyclic rotation within each <TeX src={String.raw`k`} />-cycle.
            <strong>Warning</strong>: this formula is valid in <TeX src={String.raw`S_n`} /> only, not in subgroups like <TeX src={String.raw`A_n`} />. In <TeX src={String.raw`A_4`} /> the 8 three-cycles of <TeX src={String.raw`S_4`} /> split into two <TeX src={String.raw`A_4`} />-classes, each of size 4.
          </>}
        />
      </p>

      {/* ── Cube connection aside ── */}
      <div className="gt-aside">
        <L
          zh={<>
            <strong>魔方上的共轭:</strong> 魔方玩家使用的"换位复原"（<em>setup move</em>）技术正是共轭的直观体现。若已知公式 <TeX src={String.raw`B`} /> 可在某一位置产生特定效果（例如三棱换），则对任意预备步 <TeX src={String.raw`Z`} />，共轭 <TeX src={String.raw`Z\,B\,Z^{-1}`} />（魔方记法写作 <TeX src={String.raw`Z\,B\,Z'`} />）将<em>同类效果</em>搬到另一位置——因为共轭保持轮换结构。Keith Conrad 在《群中的共轭》第 1 节正是以魔方换位为首个例子。量化地说：魔方群（阶 <TeX src={String.raw`43{,}252{,}003{,}274{,}489{,}856{,}000`} />）共有 81,120 个共轭类，每个类代表"同一种效果、不同位置的等价族"。
          </>}
          en={<>
            <strong>Conjugation on the cube:</strong> the cuber&apos;s <em>setup move</em> technique is conjugation made concrete. If algorithm <TeX src={String.raw`B`} /> achieves a desired effect (say a 3-cycle of edges) at one location, then for any setup sequence <TeX src={String.raw`Z`} />, the conjugate <TeX src={String.raw`Z\,B\,Z^{-1}`} /> (written <TeX src={String.raw`Z\,B\,Z'`} /> by cubers) produces the <em>same type</em> of effect elsewhere, because conjugation preserves cycle structure. Keith Conrad uses exactly this as the first example in his note on conjugation. Quantitatively: the Rubik&apos;s Cube group (order <TeX src={String.raw`43{,}252{,}003{,}274{,}489{,}856{,}000`} />) has 81,120 conjugacy classes — each class is one &ldquo;type of scramble effect up to relabeling.&rdquo;
          </>}
        />
      </div>

      {/* ── Panel 1: Conjugacy-class explorer ── */}
      <ConjugacyExplorer lang={lang} />

      {/* ── Panel 2: S_n cycle-type calculator ── */}
      <CycleTypePanel lang={lang} />

      {/* ── Panel 3: D4 vs Q8 same class equation ── */}
      <D4Q8ContrastPanel lang={lang} />

      {/* ── References ── */}
      <div className="gt-refs" style={{ marginTop: 40 }}>
        <div className="gt-def-title" style={{ marginBottom: 10 }}>
          <L zh="参考文献" en="References" />
        </div>
        <ol style={{ paddingLeft: 20, lineHeight: 1.8, fontSize: 15 }}>
          <li>Dummit &amp; Foote, <em>Abstract Algebra</em>, 3rd ed., §4.3 &ldquo;Groups Acting on Themselves by Conjugation &mdash; The Class Equation&rdquo; (Thm 7: class equation; Thm 8: nontrivial center of a p-group).</li>
          <li>Keith Conrad, <a href="https://kconrad.math.uconn.edu/blurbs/grouptheory/conjclass.pdf" target="_blank" rel="noopener noreferrer">&ldquo;Conjugation in a Group&rdquo;</a> &mdash; setup-move example (Ex 1.2), D4 (Ex 2.3), Q8 (Ex 2.4), A4 class splitting (Ex 2.5), cycle-type tables for S_n and A_n.</li>
          <li>Wikipedia, <a href="https://en.wikipedia.org/wiki/Rubik%27s_Cube_group" target="_blank" rel="noopener noreferrer">&ldquo;Rubik&apos;s Cube group&rdquo;</a> &mdash; order <TeX src={String.raw`2^{27}\cdot 3^{14}\cdot 5^3\cdot 7^2\cdot 11`} /> and 81,120 conjugacy classes.</li>
        </ol>
      </div>
    </GTSec>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Panel 1: Conjugacy-class explorer (brute-force)
// ═════════════════════════════════════════════════════════════════════════════

function ConjugacyExplorer({ lang }: { lang: 'zh' | 'en' }) {
  const [groupName, setGroupName] = useState<GroupName>('S3');
  const [showMembers, setShowMembers] = useState(true);
  const [hoveredClass, setHoveredClass] = useState<number | null>(null);

  const { elems, labels } = useMemo(() => getGroupData(groupName), [groupName]);
  const classes = useMemo(() => computeConjugacyClasses(elems), [elems]);

  const order = elems.length;
  const centerSize = classes.filter(c => c.isCenter).reduce((s, c) => s + c.size, 0);
  const nonCentralClasses = classes.filter(c => !c.isCenter);

  // Build class equation string
  const eqParts: string[] = [];
  if (centerSize > 0) eqParts.push(`${centerSize}`);
  nonCentralClasses.forEach(c => eqParts.push(`${c.size}`));
  const eqStr = eqParts.join(' + ');

  const groups: GroupName[] = ['S3', 'S4', 'A4', 'D4', 'Q8'];
  const groupLabels: Record<GroupName, string> = {
    S3: 'S₃ (|G|=6)', S4: 'S₄ (|G|=24)', A4: 'A₄ (|G|=12)', D4: 'D₄ (|G|=8)', Q8: 'Q₈ (|G|=8)',
  };

  // Bar total width relative to order
  const BAR_W = 500;

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="共轭类探索器 (暴力计算类方程)" en="Conjugacy-class explorer (brute-force class equation)" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="选择一个小群，实时计算所有共轭类，验证类方程。"
          en="Pick a small group to brute-force its conjugacy classes and verify the class equation."
        />
      </div>

      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 6 }}>
        <label><L zh="群" en="Group" /></label>
        {groups.map(g => (
          <button
            key={g}
            className={`gt-chip${groupName === g ? ' gt-chip-active' : ''}`}
            onClick={() => { setGroupName(g); setHoveredClass(null); }}
          >
            {groupLabels[g]}
          </button>
        ))}
      </div>

      <div className="gt-panel-input-row">
        <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={showMembers}
            onChange={e => setShowMembers(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <L zh="显示类成员" en="Show class members" />
        </label>
      </div>

      {/* Stacked bar SVG */}
      <ClassEquationBarSVG
        classes={classes}
        order={order}
        centerSize={centerSize}
        barW={BAR_W}
        hoveredClass={hoveredClass}
        onHover={setHoveredClass}
        lang={lang}
      />

      {/* Ledger */}
      <div style={{ fontFamily: 'var(--mono)', fontSize: 13, marginBottom: 12, color: 'var(--ink-dim)' }}>
        {`|G| = ${order}  =  ${eqStr}`}
        {centerSize > 0 && (
          <span style={{ color: 'var(--accent-2)', marginLeft: 8 }}>
            <L zh={`(|Z(G)| = ${centerSize})`} en={`(|Z(G)| = ${centerSize})`} />
          </span>
        )}
      </div>

      {/* Class table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="gt-compare" style={{ fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ width: 28 }}>#</th>
              <th><L zh="类大小" en="Size" /></th>
              <th><L zh="|C_G(a)|" en="|C_G(a)|" /></th>
              <th><L zh="中心?" en="Center?" /></th>
              {showMembers && <th><L zh="成员" en="Members" /></th>}
            </tr>
          </thead>
          <tbody>
            {classes.map((cls, ci) => (
              <tr
                key={ci}
                style={{
                  background: hoveredClass === ci
                    ? `color-mix(in srgb, ${CLASS_COLORS[ci % CLASS_COLORS.length]} 16%, var(--bg-elev))`
                    : undefined,
                  cursor: 'default',
                }}
                onMouseEnter={() => setHoveredClass(ci)}
                onMouseLeave={() => setHoveredClass(null)}
              >
                <td style={{ color: CLASS_COLORS[ci % CLASS_COLORS.length], fontWeight: 700 }}>{ci + 1}</td>
                <td style={{ fontWeight: 600 }}>{cls.size}</td>
                <td>{cls.centralizerOrder}</td>
                <td style={{ color: cls.isCenter ? 'var(--accent-2)' : 'var(--ink-faint)' }}>
                  {cls.isCenter ? (tr({ zh: '是', en: 'yes' })) : (tr({ zh: '否', en: 'no' }))}
                </td>
                {showMembers && (
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 11, maxWidth: 240, wordBreak: 'break-word' }}>
                    {cls.members.map(m => labels[m]).join(', ')}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* A4 warning */}
      {groupName === 'A4' && (
        <div className="gt-aside" style={{ marginTop: 16 }}>
          <L
            zh={<>
              <strong>A₄ 类分裂：</strong>S₄ 中的 8 个三轮换在 A₄ 中分裂为 2 个大小为 4 的类（只用偶置换共轭）。轮换型公式对 S_n 以外的群无效。
            </>}
            en={<>
              <strong>A₄ class splitting:</strong> the 8 three-cycles of S₄ split into 2 classes of size 4 in A₄ (conjugating only by even permutations). The cycle-type formula is not valid in subgroups.
            </>}
          />
        </div>
      )}
    </div>
  );
}

function ClassEquationBarSVG({
  classes, order, centerSize, barW, hoveredClass, onHover, lang,
}: {
  classes: ConjugacyClass[];
  order: number;
  centerSize: number;
  barW: number;
  hoveredClass: number | null;
  onHover: (i: number | null) => void;
  lang: 'zh' | 'en';
}) {
  const H = 80;
  const barH = 36;
  const barY = 24;
  const labelY = barY + barH + 14;

  let x = 0;
  const segments = classes.map((cls, ci) => {
    const w = (cls.size / order) * barW;
    const seg = { x, w, ci, cls };
    x += w;
    return seg;
  });

  return (
    <svg viewBox={`0 0 ${barW + 4} ${H}`} width="100%" style={{ display: 'block', margin: '12px 0' }}>
      {segments.map(({ x: sx, w, ci, cls }) => {
        const color = cls.isCenter ? 'var(--accent-2)' : CLASS_COLORS[ci % CLASS_COLORS.length];
        const isHov = hoveredClass === ci;
        return (
          <g
            key={ci}
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => onHover(ci)}
            onMouseLeave={() => onHover(null)}
          >
            <rect
              x={sx + 1} y={barY} width={Math.max(w - 2, 1)} height={barH}
              fill={`color-mix(in srgb, ${color} ${isHov ? 30 : 18}%, var(--bg-elev))`}
              stroke={color}
              strokeWidth={isHov ? 2 : 1}
              rx={3}
            />
            {w > 22 && (
              <text
                x={sx + w / 2} y={barY + barH / 2 + 5}
                textAnchor="middle"
                style={{ fontFamily: 'var(--mono)', fontSize: Math.min(12, w / cls.size > 18 ? 12 : 9), pointerEvents: 'none' }}
                fill={color}
                fontWeight={isHov ? 700 : 400}
              >
                {cls.size}
              </text>
            )}
          </g>
        );
      })}

      {/* Hover tooltip */}
      {hoveredClass !== null && (() => {
        const seg = segments[hoveredClass];
        if (!seg) return null;
        const { cls, ci } = seg;
        const color = cls.isCenter ? 'var(--accent-2)' : CLASS_COLORS[ci % CLASS_COLORS.length];
        const tx = Math.min(Math.max(seg.x + seg.w / 2, 60), barW - 60);
        return (
          <g>
            <rect x={tx - 58} y={0} width={116} height={20} rx={4}
              fill="var(--bg-elev)" stroke={color} strokeWidth={1} />
            <text x={tx} y={14} textAnchor="middle"
              style={{ fontFamily: 'var(--mono)', fontSize: 10, pointerEvents: 'none' }}
              fill={color}>
              {lang === 'zh'
                ? `类${ci + 1}: |cl|=${cls.size}, |C_G|=${cls.centralizerOrder}`
                : `class ${ci + 1}: |cl|=${cls.size}, |C_G(a)|=${cls.centralizerOrder}`}
            </text>
          </g>
        );
      })()}

      {/* Center bracket */}
      {centerSize > 0 && (() => {
        const cw = (centerSize / order) * barW;
        return (
          <g>
            <line x1={1} y1={labelY} x2={cw} y2={labelY} stroke="var(--accent-2)" strokeWidth={1} />
            <line x1={1} y1={labelY - 3} x2={1} y2={labelY + 3} stroke="var(--accent-2)" strokeWidth={1} />
            <line x1={cw} y1={labelY - 3} x2={cw} y2={labelY + 3} stroke="var(--accent-2)" strokeWidth={1} />
            <text x={cw / 2} y={labelY - 4} textAnchor="middle"
              style={{ fontFamily: 'var(--mono)', fontSize: 9 }} fill="var(--accent-2)">
              {lang === 'zh' ? `Z(G) 大小=${centerSize}` : `Z(G) size=${centerSize}`}
            </text>
          </g>
        );
      })()}
    </svg>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Panel 2: S_n cycle-type class-size calculator
// ═════════════════════════════════════════════════════════════════════════════

function CycleTypePanel({ lang }: { lang: 'zh' | 'en' }) {
  const [n, setN] = useState(4);
  const [selectedPart, setSelectedPart] = useState<number | null>(null);

  const parts = useMemo(() => partitions(n), [n]);
  const nFact = useMemo(() => factorial(n), [n]);

  // For each partition: compute class size and centralizer order
  const rows = useMemo(() => {
    return parts.map((part) => {
      const sz = classSize(part, n);
      const cent = centralizerSize(part, n);
      const counts = new Map<number, number>();
      for (const p of part) counts.set(p, (counts.get(p) ?? 0) + 1);
      return { part, sz, cent, counts };
    });
  }, [parts, n]);

  const totalCheck = rows.reduce((s, r) => s + r.sz, 0);

  const BAR_W = 420;

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="S_n 轮换型与类大小计算器" en="S_n cycle-type class-size calculator" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh={<>调整 <TeX src={String.raw`n`} />，每行对应 <TeX src={String.raw`n`} /> 的一个分拆（即 S_n 的一个共轭类）。点击一行展开计算细节。</>}
          en={<>Adjust <TeX src={String.raw`n`} />; each row is a partition of <TeX src={String.raw`n`} /> (a conjugacy class of S_n). Click a row to expand the calculation.</>}
        />
      </div>

      <div className="gt-panel-input-row">
        <label><TeX src={String.raw`n`} /></label>
        <input
          type="range" min={3} max={7} value={n}
          onChange={e => { setN(+e.target.value); setSelectedPart(null); }}
          style={{ flex: 1 }}
        />
        <span className="gt-result-val" style={{ minWidth: 48 }}>
          {n} ({lang === 'zh' ? `${parts.length} 类` : `${parts.length} classes`})
        </span>
      </div>

      {/* Partition bars */}
      <svg viewBox={`0 0 ${BAR_W + 4} ${rows.length * 28 + 20}`} width="100%" style={{ display: 'block', margin: '8px 0' }}>
        {rows.map(({ part, sz }, ri) => {
          const w = (sz / nFact) * BAR_W;
          const isHov = selectedPart === ri;
          const color = CLASS_COLORS[ri % CLASS_COLORS.length];
          const partStr = part.slice().reverse().join('+');
          return (
            <g
              key={ri}
              style={{ cursor: 'pointer' }}
              onClick={() => setSelectedPart(selectedPart === ri ? null : ri)}
            >
              <rect
                x={2} y={ri * 28 + 2} width={Math.max(w, 4)} height={22}
                fill={`color-mix(in srgb, ${color} ${isHov ? 28 : 14}%, var(--bg-elev))`}
                stroke={color} strokeWidth={isHov ? 2 : 1} rx={3}
              />
              <text
                x={Math.max(w, 4) + 8} y={ri * 28 + 17}
                style={{ fontFamily: 'var(--mono)', fontSize: 11 }}
                fill="var(--ink-dim)"
              >
                {partStr}  ({sz})
              </text>
            </g>
          );
        })}
        {/* Footer: total bar */}
        <text
          x={BAR_W / 2} y={rows.length * 28 + 16}
          textAnchor="middle"
          style={{ fontFamily: 'var(--mono)', fontSize: 10 }}
          fill="var(--ink-faint)"
        >
          {lang === 'zh' ? `各类大小之和 = ${totalCheck} = ${n}!` : `Sum of class sizes = ${totalCheck} = ${n}!`}
          {totalCheck !== nFact && '  ⚠'}
        </text>
      </svg>

      {/* Expanded detail */}
      {selectedPart !== null && (() => {
        const { part, sz, cent, counts } = rows[selectedPart];
        const partStr = part.slice().reverse().join('+');
        // Build factor display
        const factors: string[] = [];
        for (const [k, mk] of Array.from(counts.entries()).sort((a, b) => a[0] - b[0])) {
          factors.push(`${k}^${mk} · ${mk}!`);
        }
        const denomStr = factors.join(' · ');
        return (
          <div style={{
            background: 'var(--bg-elev)',
            border: `1px solid ${CLASS_COLORS[selectedPart % CLASS_COLORS.length]}`,
            borderRadius: 6, padding: '12px 16px', marginTop: 8,
            fontFamily: 'var(--mono)', fontSize: 12,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 8, color: CLASS_COLORS[selectedPart % CLASS_COLORS.length] }}>
              <L zh={`分拆: ${partStr}`} en={`Partition: ${partStr}`} />
            </div>
            <div style={{ color: 'var(--ink-dim)', lineHeight: 2 }}>
              <div>
                <L zh="m_k 向量" en="m_k vector" />{': '}
                {Array.from(counts.entries()).sort((a, b) => a[0] - b[0]).map(([k, mk]) =>
                  `m_${k}=${mk}`
                ).join(', ')}
              </div>
              <div>
                <L zh="公式" en="Formula" />{': '}
                {n}! / ({denomStr}) = {nFact} / {nFact / sz} = <strong>{sz}</strong>
              </div>
              <div>
                <L zh="中心化子阶" en="Centralizer order" />{': '}
                |C_G(a)| = {nFact} / {sz} = <strong>{cent}</strong>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Panel 3: D4 vs Q8 — same class equation, non-isomorphic groups
// ═════════════════════════════════════════════════════════════════════════════

function D4Q8ContrastPanel({ lang }: { lang: 'zh' | 'en' }) {
  const [colorBy, setColorBy] = useState<ColorBy>('class');
  const [showOrderNote, setShowOrderNote] = useState(false);

  const d4Data = useMemo(() => {
    const { elems, labels } = getGroupData('D4');
    const classes = computeConjugacyClasses(elems);
    const orders = elems.map(p => permOrder(p));
    return { elems, labels, classes, orders };
  }, []);

  const q8Data = useMemo(() => {
    const { elems, labels } = getGroupData('Q8');
    const classes = computeConjugacyClasses(elems);
    const orders = elems.map(p => permOrder(p));
    return { elems, labels, classes, orders };
  }, []);

  // Compute class equations
  function classEqStr(classes: ConjugacyClass[], groupOrder: number): string {
    const centerSz = classes.filter(c => c.isCenter).reduce((s, c) => s + c.size, 0);
    const nonCenter = classes.filter(c => !c.isCenter).map(c => c.size);
    return `${groupOrder} = ${centerSz} + ${nonCenter.join(' + ')}`;
  }

  const d4Eq = classEqStr(d4Data.classes, 8);
  const q8Eq = classEqStr(q8Data.classes, 8);

  // For each element find which class index it belongs to
  function classIndexOf(elemIdx: number, classes: ConjugacyClass[]): number {
    return classes.findIndex(c => c.members.includes(elemIdx));
  }

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="D₄ vs Q₈: 相同的类方程, 不同构的群" en="D₄ vs Q₈: identical class equations, non-isomorphic groups" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="两个非同构的 8 阶群拥有完全相同的类方程 8 = 1+1+2+2+2，说明类方程并不决定群的结构。"
          en="Two non-isomorphic groups of order 8 share the identical class equation 8 = 1+1+2+2+2, showing the class equation does not determine the group."
        />
      </div>

      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 6 }}>
        <label><L zh="着色依据" en="Color by" /></label>
        {(['class', 'order'] as ColorBy[]).map(c => (
          <button
            key={c}
            className={`gt-chip${colorBy === c ? ' gt-chip-active' : ''}`}
            onClick={() => setColorBy(c)}
          >
            {c === 'class'
              ? (tr({ zh: '共轭类', en: 'conjugacy class'
            }))
              : (tr({ zh: '元素阶', en: 'element order'
            }))}
          </button>
        ))}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
          <input
            type="checkbox"
            checked={showOrderNote}
            onChange={e => setShowOrderNote(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <L zh="显示说明" en="Show note" />
        </label>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        <GroupStrip
          name="D₄"
          groupOrder={8}
          classes={d4Data.classes}
          labels={d4Data.labels}
          orders={d4Data.orders}
          colorBy={colorBy}
          classEq={d4Eq}
          lang={lang}
          classIndexOf={classIndexOf}
        />
        <GroupStrip
          name="Q₈"
          groupOrder={8}
          classes={q8Data.classes}
          labels={q8Data.labels}
          orders={q8Data.orders}
          colorBy={colorBy}
          classEq={q8Eq}
          lang={lang}
          classIndexOf={classIndexOf}
        />
      </div>

      {showOrderNote && (
        <div className="gt-aside" style={{ marginTop: 12 }}>
          <L
            zh={<>
              <strong>共轭元素阶相等，反之不成立：</strong>若 <TeX src={String.raw`b=gag^{-1}`} />，则 <TeX src={String.raw`b^n=ga^ng^{-1}`} />，因此 <TeX src={String.raw`a`} /> 与 <TeX src={String.raw`b`} /> 同阶。反之则不然：D₄ 和 Q₈ 中各有多个阶为 2 的元素，却分属不同共轭类（可在上图中切换"共轭类"与"元素阶"着色亲眼验证）。在任意 Abel 群中，不同元素永远不共轭——即使它们同阶。
            </>}
            en={<>
              <strong>Conjugate elements have equal order; the converse fails:</strong> if <TeX src={String.raw`b=gag^{-1}`} /> then <TeX src={String.raw`b^n=ga^ng^{-1}`} />, so <TeX src={String.raw`a`} /> and <TeX src={String.raw`b`} /> have the same order. The converse is false: D₄ and Q₈ each have multiple elements of order 2 that lie in different conjugacy classes (toggle "element order" vs "conjugacy class" in the chart above to see this directly). In any abelian group, distinct elements are never conjugate even if they share an order.
            </>}
          />
        </div>
      )}

      <div className="gt-panel-result" style={{ marginTop: 12 }}>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="D₄ 类方程" en="D₄ class equation" /></span>
          <span className="gt-result-val-strong" style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{d4Eq}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="Q₈ 类方程" en="Q₈ class equation" /></span>
          <span className="gt-result-val-strong" style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{q8Eq}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="结论" en="Conclusion" /></span>
          <span className="gt-result-val" style={{ color: 'var(--warn)' }}>
            <L
              zh="类方程相同 ≠ 群同构（类方程不能决定群）"
              en="Same class equation ≠ isomorphic groups (class equation does not determine the group)"
            />
          </span>
        </div>
      </div>
    </div>
  );
}

function GroupStrip({
  name, groupOrder, classes, labels, orders, colorBy, classEq, lang, classIndexOf,
}: {
  name: string;
  groupOrder: number;
  classes: ConjugacyClass[];
  labels: string[];
  orders: number[];
  colorBy: ColorBy;
  classEq: string;
  lang: 'zh' | 'en';
  classIndexOf: (elemIdx: number, classes: ConjugacyClass[]) => number;
}) {
  const [hoveredElem, setHoveredElem] = useState<number | null>(null);

  const CELL_W = 44, CELL_H = 44, COLS = 4;
  const ROWS = Math.ceil(groupOrder / COLS);
  const W = COLS * CELL_W + 2;
  const H = ROWS * CELL_H + 40;

  // Build a list of elements sorted by class order
  const elemOrder: number[] = [];
  classes.forEach(cls => cls.members.forEach(m => elemOrder.push(m)));

  return (
    <div style={{ flex: '1 1 180px', minWidth: 180 }}>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 600, marginBottom: 6, color: 'var(--ink)' }}>
        {name}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        {/* Class separator brackets at bottom */}
        {elemOrder.map((ei, pos) => {
          const col = pos % COLS;
          const row = Math.floor(pos / COLS);
          const cx = col * CELL_W + CELL_W / 2 + 1;
          const cy = row * CELL_H + CELL_H / 2 + 1;

          const ci = classIndexOf(ei, classes);
          const cls = classes[ci];

          let color: string;
          if (colorBy === 'class') {
            color = cls.isCenter ? 'var(--accent-2)' : CLASS_COLORS[ci % CLASS_COLORS.length];
          } else {
            color = orderColor(orders[ei]);
          }

          const isHov = hoveredElem === ei;
          const label = labels[ei];

          return (
            <g
              key={ei}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredElem(ei)}
              onMouseLeave={() => setHoveredElem(null)}
            >
              <rect
                x={col * CELL_W + 2} y={row * CELL_H + 2}
                width={CELL_W - 4} height={CELL_H - 4}
                rx={4}
                fill={`color-mix(in srgb, ${color} ${isHov ? 35 : 16}%, var(--bg-elev))`}
                stroke={color}
                strokeWidth={isHov ? 2 : 1}
              />
              <text
                x={cx} y={cy + 5}
                textAnchor="middle"
                style={{ fontFamily: 'var(--mono)', fontSize: Math.min(11, 10), pointerEvents: 'none' }}
                fill={color}
                fontWeight={isHov ? 700 : 400}
              >
                {label.length > 5 ? label.slice(0, 5) + '…' : label}
              </text>
            </g>
          );
        })}

        {/* Hover info */}
        {hoveredElem !== null && (() => {
          const ei = hoveredElem;
          const ci = classIndexOf(ei, classes);
          const cls = classes[ci];
          const color = colorBy === 'class'
            ? (cls.isCenter ? 'var(--accent-2)' : CLASS_COLORS[ci % CLASS_COLORS.length])
            : orderColor(orders[ei]);
          return (
            <g>
              <rect x={1} y={ROWS * CELL_H + 4} width={W - 2} height={30} rx={4}
                fill="var(--bg-elev)" stroke={color} strokeWidth={1} />
              <text x={W / 2} y={ROWS * CELL_H + 14} textAnchor="middle"
                style={{ fontFamily: 'var(--mono)', fontSize: 9, pointerEvents: 'none' }}
                fill={color}>
                {lang === 'zh'
                  ? `${labels[ei]}: 阶=${orders[ei]}, 类${ci + 1}(大小${cls.size})`
                  : `${labels[ei]}: ord=${orders[ei]}, class ${ci + 1} (size ${cls.size})`}
              </text>
              <text x={W / 2} y={ROWS * CELL_H + 28} textAnchor="middle"
                style={{ fontFamily: 'var(--mono)', fontSize: 8, pointerEvents: 'none' }}
                fill="var(--ink-faint)">
                {lang === 'zh' ? `|C_G(a)|=${cls.centralizerOrder}` : `|C_G(a)|=${cls.centralizerOrder}`}
              </text>
            </g>
          );
        })()}
      </svg>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-faint)', marginTop: 4 }}>
        {classEq}
      </div>
    </div>
  );
}
