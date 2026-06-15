'use client';

import { useState, useMemo, useCallback } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import type { Lang } from '../primitives';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

// ── Rotation matrices for the cube rotation group (order 24) ──────────────────
// Each rotation is a 3×3 signed-permutation matrix with det = +1.
// Represented as a flat row-major 9-integer array.

type Mat3 = readonly [
  number, number, number,
  number, number, number,
  number, number, number,
];

type Vec3 = readonly [number, number, number];

function matMul(A: Mat3, B: Mat3): Mat3 {
  return [
    A[0]*B[0]+A[1]*B[3]+A[2]*B[6], A[0]*B[1]+A[1]*B[4]+A[2]*B[7], A[0]*B[2]+A[1]*B[5]+A[2]*B[8],
    A[3]*B[0]+A[4]*B[3]+A[5]*B[6], A[3]*B[1]+A[4]*B[4]+A[5]*B[7], A[3]*B[2]+A[4]*B[5]+A[5]*B[8],
    A[6]*B[0]+A[7]*B[3]+A[8]*B[6], A[6]*B[1]+A[7]*B[4]+A[8]*B[7], A[6]*B[2]+A[7]*B[5]+A[8]*B[8],
  ] as unknown as Mat3;
}

function matVec(M: Mat3, v: Vec3): Vec3 {
  return [
    M[0]*v[0]+M[1]*v[1]+M[2]*v[2],
    M[3]*v[0]+M[4]*v[1]+M[5]*v[2],
    M[6]*v[0]+M[7]*v[1]+M[8]*v[2],
  ] as Vec3;
}

function det3(M: Mat3): number {
  return M[0]*(M[4]*M[8]-M[5]*M[7])
        -M[1]*(M[3]*M[8]-M[5]*M[6])
        +M[2]*(M[3]*M[7]-M[4]*M[6]);
}

const ID: Mat3 = [1,0,0, 0,1,0, 0,0,1];
// 90° rotation about +X axis: y->z, z->-y
const Rx: Mat3 = [1,0,0, 0,0,-1, 0,1,0];
// 90° rotation about +Y axis: z->x, x->-z
const Ry: Mat3 = [0,0,1, 0,1,0, -1,0,0];
// 90° rotation about +Z axis: x->y, y->-x
const Rz: Mat3 = [0,-1,0, 1,0,0, 0,0,1];

// Generate all 24 rotation matrices by BFS over generator set {Rx,Ry,Rz}
function generateRotations(): Mat3[] {
  const gens = [Rx, Ry, Rz];
  const mats: Mat3[] = [ID];
  const seen = new Set<string>();
  const key = (M: Mat3) => M.join(',');
  seen.add(key(ID));
  let frontier = [ID];
  while (frontier.length > 0) {
    const next: Mat3[] = [];
    for (const M of frontier) {
      for (const G of gens) {
        for (const P of [G, ...([1,2,3] as const).map(k => {
          let R = G;
          for (let i = 1; i < k; i++) R = matMul(R, G);
          return R;
        })]) {
          const NM = matMul(M, P);
          const k2 = key(NM);
          if (!seen.has(k2)) {
            seen.add(k2);
            mats.push(NM);
            next.push(NM);
          }
        }
      }
    }
    frontier = next;
  }
  return mats.filter(M => det3(M) > 0).slice(0, 24);
}

const ALL_ROTATIONS: Mat3[] = (() => {
  const rots = generateRotations();
  // Ensure exactly 24 (all rotation matrices)
  return rots;
})();

function vecKey(v: Vec3): string { return v.map(x => Math.round(x)).join(','); }

// For "unoriented" (diagonal / axis): treat {v, -v} as equal
function unorientedKey(v: Vec3): string {
  const k1 = v.map(x => Math.round(x)).join(',');
  const k2 = v.map(x => -Math.round(x)).join(',');
  return k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1;
}

type ObjectType = 'face' | 'edge' | 'vertex' | 'diagonal' | 'axis';

// Representative points for each object type
const REPS: Record<ObjectType, Vec3> = {
  face:     [1, 0, 0],
  edge:     [1, 1, 0],      // midpoint of an edge (two coords ±1, one 0) — normalised below
  vertex:   [1, 1, 1],
  diagonal: [1, 1, 1],      // same as vertex but treated as unoriented line
  axis:     [1, 0, 0],      // same as face but treated as unoriented pair of opposite faces
};

// Is the action "unoriented" (stabilizer fixes set {rep, -rep} not just rep)?
const UNORIENTED: Record<ObjectType, boolean> = {
  face: false,
  edge: false,
  vertex: false,
  diagonal: true,
  axis: true,
};

function computeOrbitAndStab(type: ObjectType): {
  orbitVecs: Vec3[];
  stabIndices: number[];
  orbitSize: number;
  stabSize: number;
  product: number;
} {
  const rep = REPS[type];
  const unoriented = UNORIENTED[type];
  const pointKey = unoriented ? unorientedKey : vecKey;

  const repKey = pointKey(rep);
  const orbitMap = new Map<string, Vec3>();
  const stabIndices: number[] = [];

  ALL_ROTATIONS.forEach((M, idx) => {
    const img = matVec(M, rep);
    const ik = pointKey(img);
    if (!orbitMap.has(ik)) orbitMap.set(ik, img);
    if (ik === repKey) stabIndices.push(idx);
  });

  const orbitVecs = Array.from(orbitMap.values());
  return {
    orbitVecs,
    stabIndices,
    orbitSize: orbitVecs.length,
    stabSize: stabIndices.length,
    product: orbitVecs.length * stabIndices.length,
  };
}

// Lookup table (all values deterministic, computed from matrices)
const OBJECT_INFO: Record<ObjectType, { orbitSize: number; stabSize: number; structuralDesc: { zh: string; en: string
 } }> = {
  face:     { orbitSize: 6,  stabSize: 4, structuralDesc: { zh: 'C₄（面轴四转）', en: 'C₄ (four rotations about the face axis)'
} },
  edge:     { orbitSize: 12, stabSize: 2, structuralDesc: { zh: 'C₂（绕棱中点 180°）', en: 'C₂ (180° about the edge midpoint axis)'
} },
  vertex:   { orbitSize: 8,  stabSize: 3, structuralDesc: { zh: 'C₃（绕顶点体对角线三转）', en: 'C₃ (three rotations about the vertex diagonal)'
} },
  diagonal: { orbitSize: 4,  stabSize: 6, structuralDesc: { zh: 'S₃（对角线三转 + 三个 180° 交换两端）', en: 'S₃ (three rotations + three 180° swaps of endpoints)'
} },
  axis:     { orbitSize: 3,  stabSize: 8, structuralDesc: { zh: 'D₄（面轴四转 + 四个 180° 交换两面）', en: 'D₄ (four rotations + four 180° swaps of the two faces)'
} },
};

// ── Isometric projection of the cube ─────────────────────────────────────────
// Project from 3D to 2D with an isometric-ish matrix
function project(v: Vec3, scale: number, cx: number, cy: number): [number, number] {
  const cos30 = Math.sqrt(3) / 2;
  const sin30 = 0.5;
  const px = (v[0] - v[2]) * cos30;
  const py = -v[1] + (v[0] + v[2]) * sin30;
  return [cx + scale * px, cy + scale * py];
}

// Cube vertices (±1, ±1, ±1)
const CUBE_VERTS: Vec3[] = [
  [ 1, 1, 1], [-1, 1, 1], [-1,-1, 1], [ 1,-1, 1],
  [ 1, 1,-1], [-1, 1,-1], [-1,-1,-1], [ 1,-1,-1],
];

// Cube faces (vertex indices for each face, outward-facing order)
// Visible faces for our isometric view: top (+Y), front (+Z), right (+X)
const CUBE_FACES: { verts: number[]; normal: Vec3 }[] = [
  { verts: [0,1,2,3], normal: [0,0,1] },  // front
  { verts: [4,0,3,7], normal: [1,0,0] },  // right
  { verts: [4,5,1,0], normal: [0,1,0] },  // top
  { verts: [5,6,2,1], normal: [-1,0,0] }, // left (partially visible)
  { verts: [3,2,6,7], normal: [0,-1,0] }, // bottom
  { verts: [7,6,5,4], normal: [0,0,-1] }, // back
];

// ── Burnside face-cycle counts ────────────────────────────────────────────────
// 5 conjugacy classes of the rotation group acting on 6 faces:
// 1. Identity (×1): 6 cycles (each face fixed)
// 2. Face 90°/270° rotations (×6): 3 cycles each
// 3. Face 180° rotations (×3): 4 cycles each
// 4. Vertex 120°/240° rotations (×8): 2 cycles each
// 5. Edge 180° rotations (×6): 3 cycles each

interface RotClass {
  name: { zh: string; en: string
 };
  count: number;
  cycles: number;
}

const ROT_CLASSES: RotClass[] = [
  { name: { zh: '恒等 (×1)', en: 'Identity (×1)'
}, count: 1, cycles: 6 },
  { name: { zh: '面轴 90°/270° (×6)', en: 'Face 90°/270° (×6)'
}, count: 6, cycles: 3 },
  { name: { zh: '面轴 180° (×3)', en: 'Face 180° (×3)'
}, count: 3, cycles: 4 },
  { name: { zh: '顶点轴 120°/240° (×8)', en: 'Vertex 120°/240° (×8)'
}, count: 8, cycles: 2 },
  { name: { zh: '棱轴 180° (×6)', en: 'Edge 180° (×6)'
}, count: 6, cycles: 3 },
];

const PALETTE = ['#8B2E3C','#2A4D69','#3F7050','#B8860B','#6B4E9C','#C2410C','#5C7CA0','#9C4E6B'];

// ── Coset grid helper ─────────────────────────────────────────────────────────
function computeCosetGrid(type: ObjectType): {
  cosets: number[][];
  targets: Vec3[];
} {
  const rep = REPS[type];
  const unoriented = UNORIENTED[type];
  const pointKey = unoriented ? unorientedKey : vecKey;

  // Map from target key to list of rotation indices
  const cosetMap = new Map<string, number[]>();
  ALL_ROTATIONS.forEach((M, idx) => {
    const img = matVec(M, rep);
    const ik = pointKey(img);
    if (!cosetMap.has(ik)) cosetMap.set(ik, []);
    cosetMap.get(ik)!.push(idx);
  });

  const cosets: number[][] = [];
  const targets: Vec3[] = [];
  const repKey = pointKey(rep);
  // Put rep's coset first
  const entries = Array.from(cosetMap.entries());
  entries.sort(([a], [b]) => (a === repKey ? -1 : b === repKey ? 1 : 0));
  for (const [, idxs] of entries) {
    cosets.push(idxs);
  }
  for (const [, idxs] of entries) {
    const M = ALL_ROTATIONS[idxs[0]];
    targets.push(matVec(M, rep));
  }
  return { cosets, targets };
}

// ══════════════════════════════════════════════════════════════════════════════
// Main section component
// ══════════════════════════════════════════════════════════════════════════════

export default function OrbitStabilizer() {
  const lang = useLang();

  return (
    <GTSec id="orbit-stabilizer" className="gt-sec">
      <div className="gt-sec-num">§58</div>
      <h2 className="gt-sec-title">
        <L zh="轨道–稳定子定理" en="The orbit-stabiliser theorem" />
      </h2>

      <p className="gt-lede">
        <L
          zh={<>
            群作用将抽象的群元素变成一组具体的"对称操作"，把集合 <TeX src={String.raw`X`} /> 中的点搬来搬去。
            每个点 <TeX src={String.raw`x`} /> 都留下两个痕迹：它能被送往的所有位置（<strong>轨道</strong>），以及让它纹丝不动的所有操作（<strong>稳定子</strong>）。
            轨道–稳定子定理说：这两个量之积恰好等于群的阶——
            <TeX src={String.raw`|\mathrm{Orb}(x)|\cdot|\mathrm{Stab}(x)|=|G|`} />，
            没有一个对称性被浪费。正方体的 24 个旋转作用于每类几何元素，恰好给出 <TeX src={String.raw`6\times4=8\times3=12\times2=4\times6=24`} />。
          </>}
          en={<>
            A group action turns abstract group elements into concrete symmetry operations that shuffle points of a set <TeX src={String.raw`X`} /> around.
            Every point <TeX src={String.raw`x`} /> leaves two traces: all positions it can be sent to (its <strong>orbit</strong>), and all operations that leave it unmoved (its <strong>stabiliser</strong>).
            The orbit-stabiliser theorem says these two quantities multiply to the group order:
            <TeX src={String.raw`|\mathrm{Orb}(x)|\cdot|\mathrm{Stab}(x)|=|G|`} />,
            with no symmetry wasted. The 24 rotations of a cube acting on each type of geometric element give exactly <TeX src={String.raw`6\times4=8\times3=12\times2=4\times6=24`} />.
          </>}
        />
      </p>

      {/* ── Definitions ── */}
      <div className="gt-def">
        <div className="gt-def-title">
          <L zh="定义: 群作用、轨道与稳定子" en="Definitions: Group action, orbit, and stabiliser" />
        </div>
        <div className="gt-def-body">
          <L
            zh={<>
              群 <TeX src={String.raw`G`} /> 在集合 <TeX src={String.raw`X`} /> 上的（左）<strong>群作用</strong>是映射 <TeX src={String.raw`G\times X\to X`} />，记作 <TeX src={String.raw`(g,x)\mapsto g\cdot x`} />，满足
              (i) <TeX src={String.raw`e\cdot x=x`} />（单位元不动任何点）；
              (ii) <TeX src={String.raw`g\cdot(h\cdot x)=(gh)\cdot x`} />（相容性）。
              等价地，它是群同态 <TeX src={String.raw`G\to\mathrm{Sym}(X)`} />。
              <br />
              对 <TeX src={String.raw`x\in X`} />，<strong>轨道</strong>是 <TeX src={String.raw`\mathrm{Orb}(x)=\{g\cdot x:g\in G\}\subseteq X`} />；
              <strong>稳定子</strong>（迷向子群）是 <TeX src={String.raw`\mathrm{Stab}_G(x)=\{g\in G:g\cdot x=x\}`} />，它是 <TeX src={String.raw`G`} /> 的子群。
              <br />
              轨道将 <TeX src={String.raw`X`} /> 划分成等价类（<TeX src={String.raw`x\sim y\Leftrightarrow\exists g,\,g\cdot x=y`} />）；同一轨道上各点的稳定子互为共轭：<TeX src={String.raw`\mathrm{Stab}(g\cdot x)=g\,\mathrm{Stab}(x)\,g^{-1}`} />。
            </>}
            en={<>
              A (left) <strong>group action</strong> of <TeX src={String.raw`G`} /> on <TeX src={String.raw`X`} /> is a map <TeX src={String.raw`G\times X\to X`} />, written <TeX src={String.raw`(g,x)\mapsto g\cdot x`} />, satisfying
              (i) <TeX src={String.raw`e\cdot x=x`} /> (the identity fixes every point);
              (ii) <TeX src={String.raw`g\cdot(h\cdot x)=(gh)\cdot x`} /> (compatibility). Equivalently, it is a group homomorphism <TeX src={String.raw`G\to\mathrm{Sym}(X)`} />.
              <br />
              For <TeX src={String.raw`x\in X`} />, the <strong>orbit</strong> is <TeX src={String.raw`\mathrm{Orb}(x)=\{g\cdot x:g\in G\}\subseteq X`} />;
              the <strong>stabiliser</strong> (isotropy subgroup) is <TeX src={String.raw`\mathrm{Stab}_G(x)=\{g\in G:g\cdot x=x\}`} />, a subgroup of <TeX src={String.raw`G`} />.
              <br />
              Orbits partition <TeX src={String.raw`X`} /> into equivalence classes (<TeX src={String.raw`x\sim y\Leftrightarrow\exists g,\,g\cdot x=y`} />); stabilisers of points in the same orbit are conjugate: <TeX src={String.raw`\mathrm{Stab}(g\cdot x)=g\,\mathrm{Stab}(x)\,g^{-1}`} />.
            </>}
          />
        </div>
      </div>

      {/* ── Main theorem ── */}
      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理: 轨道–稳定子定理" en="Theorem: The orbit-stabiliser theorem" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>
              设 <TeX src={String.raw`G`} /> 作用在集合 <TeX src={String.raw`X`} /> 上，<TeX src={String.raw`x\in X`} />。映射
            </>}
            en={<>
              Let <TeX src={String.raw`G`} /> act on <TeX src={String.raw`X`} /> and fix <TeX src={String.raw`x\in X`} />. The map
            </>}
          />
          <TeXBlock src={String.raw`G/\mathrm{Stab}(x)\;\longrightarrow\;\mathrm{Orb}(x),\qquad g\cdot\mathrm{Stab}(x)\;\longmapsto\;g\cdot x`} />
          <L
            zh={<>
              是良定义的 <TeX src={String.raw`G`} />-等变双射。因此 <TeX src={String.raw`|\mathrm{Orb}(x)|=[G:\mathrm{Stab}(x)]`} />。
              若 <TeX src={String.raw`G`} /> 有限，则
            </>}
            en={<>
              is a well-defined <TeX src={String.raw`G`} />-equivariant bijection. Hence <TeX src={String.raw`|\mathrm{Orb}(x)|=[G:\mathrm{Stab}(x)]`} />.
              When <TeX src={String.raw`G`} /> is finite,
            </>}
          />
          <TeXBlock src={String.raw`|\mathrm{Orb}(x)|\cdot|\mathrm{Stab}(x)|=|G|.`} />
          <L
            zh={<>
              特别地，<TeX src={String.raw`|\mathrm{Orb}(x)|`} /> 整除 <TeX src={String.raw`|G|`} />（这是 Lagrange 定理在群作用上的直接推论）。
              这个双射是典范的和 <TeX src={String.raw`G`} />-等变的，而非仅仅是一个计数巧合——它对任意（有限或无限）<TeX src={String.raw`G`} /> 都成立，乘积形式则需要 <TeX src={String.raw`|G|<\infty`} />。
            </>}
            en={<>
              In particular, <TeX src={String.raw`|\mathrm{Orb}(x)|`} /> divides <TeX src={String.raw`|G|`} /> (a direct corollary of Lagrange&rsquo;s theorem applied to <TeX src={String.raw`H=\mathrm{Stab}(x)`} />).
              The bijection is canonical and <TeX src={String.raw`G`} />-equivariant, not merely a counting coincidence — it holds for arbitrary (possibly infinite) <TeX src={String.raw`G`} />; the product form requires <TeX src={String.raw`|G|`} /> finite.
            </>}
          />
        </div>
      </div>

      <div className="gt-proof">
        <div className="gt-proof-title">
          <L zh="证明思路" en="Proof sketch" />
        </div>
        <L
          zh={<>
            映射良定义：若 <TeX src={String.raw`g\,\mathrm{Stab}(x)=g'\,\mathrm{Stab}(x)`} />，则 <TeX src={String.raw`g^{-1}g'\in\mathrm{Stab}(x)`} />，故 <TeX src={String.raw`g'\cdot x=g\cdot(g^{-1}g')\cdot x=g\cdot x`} />。
            单射：<TeX src={String.raw`g\cdot x=g'\cdot x\Rightarrow g^{-1}g'\in\mathrm{Stab}(x)\Rightarrow g\mathrm{Stab}(x)=g'\mathrm{Stab}(x)`} />。
            满射：由轨道定义显然。双射完毕；陪集空间的大小 <TeX src={String.raw`[G:\mathrm{Stab}(x)]=|G|/|\mathrm{Stab}(x)|`} />（Lagrange）给出乘积式。
          </>}
          en={<>
            Well-defined: if <TeX src={String.raw`g\,\mathrm{Stab}(x)=g'\,\mathrm{Stab}(x)`} /> then <TeX src={String.raw`g^{-1}g'\in\mathrm{Stab}(x)`} />, so <TeX src={String.raw`g'\cdot x=g\cdot(g^{-1}g')\cdot x=g\cdot x`} />.
            Injective: <TeX src={String.raw`g\cdot x=g'\cdot x\Rightarrow g^{-1}g'\in\mathrm{Stab}(x)\Rightarrow g\mathrm{Stab}(x)=g'\mathrm{Stab}(x)`} />.
            Surjective: immediate from the definition of the orbit. This gives the bijection; Lagrange then gives <TeX src={String.raw`[G:\mathrm{Stab}(x)]=|G|/|\mathrm{Stab}(x)|`} /> and hence the product formula.
          </>}
        />
        <div className="gt-proof-end">∎</div>
      </div>

      <p>
        <L
          zh={<>
            <strong>注意区分两个易混淆的集合：</strong>
            稳定子 <TeX src={String.raw`\mathrm{Stab}(x)\subseteq G`} /> 是<em>群元素</em>的集合；
            不动点集 <TeX src={String.raw`\mathrm{Fix}(g)=\{x\in X:g\cdot x=x\}\subseteq X`} /> 是<em>点</em>的集合。
            它们通过对偶 <TeX src={String.raw`x\in\mathrm{Fix}(g)\Leftrightarrow g\in\mathrm{Stab}(x)`} /> 相联系，
            这正是 Burnside 引理的核心引擎。
          </>}
          en={<>
            <strong>Two easily-confused sets:</strong>
            the stabiliser <TeX src={String.raw`\mathrm{Stab}(x)\subseteq G`} /> is a set of <em>group elements</em>;
            the fixed-point set <TeX src={String.raw`\mathrm{Fix}(g)=\{x\in X:g\cdot x=x\}\subseteq X`} /> is a set of <em>points</em>.
            They are linked by the duality <TeX src={String.raw`x\in\mathrm{Fix}(g)\Leftrightarrow g\in\mathrm{Stab}(x)`} />,
            which is the engine of Burnside&rsquo;s lemma.
          </>}
        />
      </p>

      {/* ── Burnside box ── */}
      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="推论: Burnside 引理（Cauchy–Frobenius）" en="Corollary: Burnside's Lemma (Cauchy–Frobenius)" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>
              设有限群 <TeX src={String.raw`G`} /> 作用在有限集 <TeX src={String.raw`X`} /> 上，轨道数等于不动点的平均：
            </>}
            en={<>
              Let a finite group <TeX src={String.raw`G`} /> act on a finite set <TeX src={String.raw`X`} />. The number of orbits equals the average number of fixed points:
            </>}
          />
          <TeXBlock src={String.raw`|X/G| = \frac{1}{|G|}\sum_{g\in G}|\mathrm{Fix}(g)|.`} />
          <L
            zh={<>
              推导：<TeX src={String.raw`\sum_g|\mathrm{Fix}(g)|=|\{(g,x):g\cdot x=x\}|=\sum_x|\mathrm{Stab}(x)|`} />，而由轨道–稳定子定理每个轨道对 <TeX src={String.raw`\sum_x|G|/|\mathrm{Orb}(x)|`} /> 的贡献恰为 <TeX src={String.raw`|G|`} />，故总和为 <TeX src={String.raw`|G|\cdot(\text{轨道数})`} />。
              历史注：此结果实为 Cauchy 和 Frobenius 所得，Burnside 不过引用之，故有时称 <em>Cauchy–Frobenius 引理</em>。
            </>}
            en={<>
              Derivation: <TeX src={String.raw`\sum_g|\mathrm{Fix}(g)|=|\{(g,x):g\cdot x=x\}|=\sum_x|\mathrm{Stab}(x)|`} />; orbit–stabiliser gives <TeX src={String.raw`|\mathrm{Stab}(x)|=|G|/|\mathrm{Orb}(x)|`} />, and each orbit contributes <TeX src={String.raw`|G|`} /> to <TeX src={String.raw`\sum_x|\mathrm{Stab}(x)|`} />, giving <TeX src={String.raw`|G|\cdot(\text{orbit count})`} />.
              Historical note: the result is due to Cauchy and Frobenius; Burnside merely cited it. Some texts use the name <em>Cauchy–Frobenius lemma</em> or <em>orbit-counting theorem</em>.
            </>}
          />
        </div>
      </div>

      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="正方体的旋转群" en="The rotation group of the cube" />
      </h3>

      <p>
        <L
          zh={<>
            正方体（三维）的旋转群（保向对称群，阶为 24，同构于 <TeX src={String.raw`S_4`} />）作用在几何部件上，轨道–稳定子定理给出精确的等式。
            <strong>注意：</strong>这里说的是整块正方体在空间中的重新定向（24 个刚体旋转），而<em>不是</em>魔方的操作群（阶约 <TeX src={String.raw`4.3\times10^{19}`} />，由面旋转 R、U、F 等生成）。
          </>}
          en={<>
            The rotation group of the cube (orientation-preserving symmetries, order 24, isomorphic to <TeX src={String.raw`S_4`} />) acts on its geometric parts, and orbit–stabiliser gives an exact identity in each case.
            <strong>Important:</strong> we are talking about re-orienting the solid cube in space (24 rigid rotations), <em>not</em> the Rubik&rsquo;s Cube move group (order <TeX src={String.raw`\approx4.3\times10^{19}`} />, generated by face turns R, U, F, &hellip;).
          </>}
        />
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table className="gt-compare" style={{ minWidth: 380 }}>
          <thead>
            <tr>
              <th><L zh="几何元素" en="Geometric object" /></th>
              <th><L zh="轨道大小" en="Orbit size" /></th>
              <th><L zh="稳定子大小" en="Stabiliser size" /></th>
              <th><L zh="结构" en="Structure" /></th>
              <th><L zh="乘积" en="Product" /></th>
            </tr>
          </thead>
          <tbody>
            {(Object.entries(OBJECT_INFO) as [ObjectType, typeof OBJECT_INFO[ObjectType]][]).map(([type, info]) => (
              <tr key={type}>
                <td><L zh={typeNameZh(type)} en={typeNameEn(type)} /></td>
                <td style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{info.orbitSize}</td>
                <td style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{info.stabSize}</td>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-dim)' }}>
                  {tr(info.structuralDesc)}
                </td>
                <td style={{ textAlign: 'center', color: 'var(--green)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {info.orbitSize * info.stabSize}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Panel 1: Cube Explorer ── */}
      <CubeExplorerPanel lang={lang} />

      {/* ── Panel 2: Coset grid ── */}
      <CosetGridPanel lang={lang} />

      {/* ── Panel 3: Burnside counter ── */}
      <BurnsidePanel lang={lang} />

      {/* ── Cautions ── */}
      <div className="gt-aside" style={{ marginTop: 40 }}>
        <L
          zh={<>
            <strong>常见误区。</strong>
            (1) 轨道–稳定子是集合之间的双射，不只是数字等式——对无限群也成立。
            (2) 同一轨道上各点的稳定子<em>大小</em>相等，但它们是不同的子群（互为共轭）。
            (3) 正方体旋转群（阶 24）与魔方操作群（阶 <TeX src={String.raw`\approx4.3\times10^{19}`} />）是两回事；6×4、8×3、12×2 的计数针对前者。
            (4) Burnside 引理里 <TeX src={String.raw`c(g)`} /> 是 <TeX src={String.raw`g`} /> 在 6 个面上的置换圈数，而非在 24 个群元素上的圈数——两者不同。
          </>}
          en={<>
            <strong>Common pitfalls.</strong>
            (1) Orbit–stabiliser is a bijection of sets, not just a numerical identity — it holds for infinite groups too.
            (2) Stabilisers of points in the same orbit have the same <em>size</em> but are distinct (conjugate) subgroups.
            (3) The rotation group of the cube (order 24) is not the Rubik&rsquo;s Cube move group (order <TeX src={String.raw`\approx4.3\times10^{19}`} />); the 6×4, 8×3, 12×2 counts are about the former.
            (4) In Burnside&rsquo;s lemma, <TeX src={String.raw`c(g)`} /> counts cycles of <TeX src={String.raw`g`} /> acting on the 6 faces, not on the 24 group elements.
          </>}
        />
      </div>

      {/* ── References ── */}
      <div style={{ marginTop: 40 }}>
        <div className="gt-def-title" style={{ marginBottom: 10 }}>
          <L zh="参考文献" en="References" />
        </div>
        <ol style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-dim)' }}>
          <li>M. A. Armstrong, <em>Groups and Symmetry</em>, Springer UTM (1988), Ch. 17 (Orbit–Stabiliser Theorem) and Ch. 13 (Burnside&rsquo;s Counting Theorem).</li>
          <li>J. B. Fraleigh, <em>A First Course in Abstract Algebra</em>, 7th ed., §16 (Orbits, Cosets, and the Counting Theorem).</li>
          <li>D. S. Dummit &amp; R. M. Foote, <em>Abstract Algebra</em>, 3rd ed., §4.1 (Proposition 2: orbit–stabiliser); §4.3 (class equation).</li>
          <li>Wikipedia, <a href="https://en.wikipedia.org/wiki/Burnside%27s_lemma" target="_blank" rel="noopener noreferrer">Burnside&rsquo;s lemma</a> (history and statement).</li>
        </ol>
      </div>
    </GTSec>
  );
}

function typeNameZh(type: ObjectType): string {
  return { face: '面（面心）', edge: '棱（棱中点）', vertex: '顶点', diagonal: '体对角线（无向）', axis: '面对轴（无向）' }[type];
}
function typeNameEn(type: ObjectType): string {
  return { face: 'Face (face centre)', edge: 'Edge (edge midpoint)', vertex: 'Vertex', diagonal: 'Body diagonal (unoriented)', axis: 'Face-axis (unoriented)' }[type];
}

// ══════════════════════════════════════════════════════════════════════════════
// Panel 1: Cube Explorer — pick an object type, see orbit on isometric SVG
// ══════════════════════════════════════════════════════════════════════════════

function CubeExplorerPanel({ lang }: { lang: Lang }) {
  const [type, setType] = useState<ObjectType>('face');

  const result = useMemo(() => computeOrbitAndStab(type), [type]);
  const isVerified = result.product === 24;

  const CX = 130, CY = 110, SCALE = 50;

  // Project all cube vertices
  const projVerts = CUBE_VERTS.map(v => project(v, SCALE, CX, CY));

  // Face fill colors (light for visible, muted for back)
  const viewDir: Vec3 = [1, 1, 1]; // rough view direction
  const faceFills = CUBE_FACES.map(f => {
    const dot = f.normal[0]*viewDir[0] + f.normal[1]*viewDir[1] + f.normal[2]*viewDir[2];
    return dot > 0 ? 'color-mix(in srgb, var(--bg-elev) 80%, var(--rule))' : 'color-mix(in srgb, var(--bg-deep) 85%, var(--rule))';
  });

  // Draw orbit elements
  const orbitVecs = result.orbitVecs;

  const orbitColors = PALETTE;

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="正方体旋转轨道探索器" en="Cube Rotation Orbit Explorer" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="选择一类几何元素，实时计算其在 24 个旋转下的轨道与稳定子大小，并在等角投影图上高亮整个轨道。"
          en="Choose a geometric part of the cube; the widget computes orbit and stabiliser sizes live under all 24 rotations and highlights the full orbit on an isometric view."
        />
      </div>

      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {(['face', 'edge', 'vertex', 'diagonal', 'axis'] as ObjectType[]).map(t => (
          <button
            key={t}
            className={`gt-chip${type === t ? ' gt-chip-active' : ''}`}
            onClick={() => setType(t)}
          >
            <L zh={typeNameZh(t)} en={typeNameEn(t)} />
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start', marginTop: 16 }}>
        {/* SVG cube */}
        <svg viewBox="0 0 260 220" width="100%" style={{ flex: '1 1 220px', maxWidth: 300, display: 'block' }}>
          {/* Draw cube faces */}
          {CUBE_FACES.map((face, fi) => {
            const pts = face.verts.map(vi => projVerts[vi]);
            return (
              <polygon
                key={fi}
                points={pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}
                fill={faceFills[fi]}
                stroke="var(--rule)"
                strokeWidth={1}
              />
            );
          })}

          {/* Draw orbit elements */}
          {orbitVecs.map((v, oi) => {
            const col = orbitColors[oi % orbitColors.length];
            const isFirst = oi === 0;
            if (type === 'face' || type === 'axis') {
              // Draw as a dot at the face center
              const p = project(v, SCALE, CX, CY);
              return (
                <circle key={oi} cx={p[0]} cy={p[1]} r={isFirst ? 9 : 7}
                  fill={col} fillOpacity={0.85}
                  stroke={isFirst ? 'var(--ink)' : 'none'} strokeWidth={2} />
              );
            } else if (type === 'vertex') {
              const p = project(v, SCALE, CX, CY);
              return (
                <circle key={oi} cx={p[0]} cy={p[1]} r={isFirst ? 8 : 6}
                  fill={col} fillOpacity={0.9}
                  stroke={isFirst ? 'var(--ink)' : 'none'} strokeWidth={2} />
              );
            } else if (type === 'edge') {
              // Draw a thick dot at edge midpoint
              const p = project(v, SCALE, CX, CY);
              return (
                <rect key={oi} x={p[0]-5} y={p[1]-4} width={10} height={8} rx={3}
                  fill={col} fillOpacity={0.9}
                  stroke={isFirst ? 'var(--ink)' : 'none'} strokeWidth={1.5} />
              );
            } else {
              // diagonal: draw a dashed line through body
              const p1 = project(v, SCALE, CX, CY);
              const neg: Vec3 = [-v[0], -v[1], -v[2]];
              const p2 = project(neg, SCALE, CX, CY);
              return (
                <line key={oi} x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]}
                  stroke={col} strokeWidth={isFirst ? 3 : 2}
                  strokeDasharray={isFirst ? 'none' : '5 3'}
                  strokeOpacity={0.85} />
              );
            }
          })}

          {/* Legend dot */}
          <circle cx={12} cy={12} r={5} fill={orbitColors[0]} />
          <text x={20} y={16} style={{ fontSize: 9, fontFamily: 'var(--mono)' }} fill="var(--ink-dim)">
            {tr({ zh: '代表元', en: 'rep.' })}
          </text>
          {orbitVecs.length > 1 && <>
            <circle cx={12} cy={26} r={5} fill={orbitColors[1]} />
            <text x={20} y={30} style={{ fontSize: 9, fontFamily: 'var(--mono)' }} fill="var(--ink-dim)">
              {tr({ zh: '其余轨道', en: 'orbit'
            })}
            </text>
          </>}
        </svg>

        {/* Result panel */}
        <div style={{ flex: '1 1 180px', minWidth: 180 }}>
          <div className="gt-panel-result">
            <div className="gt-result-row">
              <span className="gt-result-label">|G|</span>
              <span className="gt-result-val-strong" style={{ color: 'var(--accent-2)' }}>24</span>
            </div>
            <div className="gt-result-row">
              <span className="gt-result-label"><L zh="轨道大小" en="Orbit size" /></span>
              <span className="gt-result-val-strong" style={{ color: PALETTE[2] }}>{result.orbitSize}</span>
            </div>
            <div className="gt-result-row">
              <span className="gt-result-label"><L zh="稳定子大小" en="Stabiliser size" /></span>
              <span className="gt-result-val-strong" style={{ color: PALETTE[0] }}>{result.stabSize}</span>
            </div>
            <div className="gt-result-row" style={{ borderTop: '1px solid var(--rule)', paddingTop: 8, marginTop: 4 }}>
              <span className="gt-result-label">
                <L zh="乘积验证" en="Product check" />
              </span>
              <span className="gt-result-val-strong" style={{ color: isVerified ? 'var(--green)' : 'var(--warn)' }}>
                {result.orbitSize} × {result.stabSize} = {result.product} {isVerified ? '= 24 ✓' : '≠ 24'}
              </span>
            </div>
            <div className="gt-result-row">
              <span className="gt-result-label"><L zh="稳定子结构" en="Stabiliser structure" /></span>
              <span className="gt-result-val" style={{ fontSize: 12 }}>
                {tr(OBJECT_INFO[type].structuralDesc)}
              </span>
            </div>
          </div>

          <div style={{ marginTop: 14, fontSize: 13, color: 'var(--ink-dim)', lineHeight: 1.6 }}>
            <L
              zh={<>
                轨道 <TeX src={String.raw`\cong G/\mathrm{Stab}`} />：<TeX src={String.raw`|G|=24`} /> 个旋转按目标分成 <strong>{result.orbitSize}</strong> 个陪集，每个陪集恰好含 <strong>{result.stabSize}</strong> 个旋转（即稳定子的陪集）。
              </>}
              en={<>
                Orbit <TeX src={String.raw`\cong G/\mathrm{Stab}`} />: the <TeX src={String.raw`|G|=24`} /> rotations partition into <strong>{result.orbitSize}</strong> cosets by target, each coset containing exactly <strong>{result.stabSize}</strong> rotations (the stabiliser coset).
              </>}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Panel 2: Coset Grid — visualises G partitioned into |Orbit| equal cosets
// ══════════════════════════════════════════════════════════════════════════════

function CosetGridPanel({ lang }: { lang: Lang }) {
  const [type, setType] = useState<ObjectType>('face');
  const [selectedCoset, setSelectedCoset] = useState<number>(0);

  const { cosets, targets } = useMemo(() => {
    const data = computeCosetGrid(type);
    return data;
  }, [type]);

  const orbitSize = cosets.length;
  const stabSize = cosets[0]?.length ?? 0;

  const handleTypeChange = useCallback((t: ObjectType) => {
    setType(t);
    setSelectedCoset(0);
  }, []);

  // Grid layout: orbitSize columns × stabSize rows, each cell = one rotation index
  const CELL = 28;
  const PAD = 8;
  const gridW = orbitSize * (CELL + 2) + PAD * 2;
  const gridH = stabSize * (CELL + 2) + PAD * 2 + 30;

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="轨道 ≅ 陪集商 G/Stab" en="Orbit ≅ Coset space G/Stab" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="24 个旋转按目标元素分组：每列是一个陪集，列数 = 轨道大小，每列格数 = 稳定子大小。点击一列高亮该陪集。"
          en="The 24 rotations are grouped by which orbit element they send the representative to. Each column is a coset; the number of columns equals the orbit size and each column has exactly |Stab| cells. Click a column to highlight its coset."
        />
      </div>

      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {(['face', 'edge', 'vertex', 'diagonal', 'axis'] as ObjectType[]).map(t => (
          <button
            key={t}
            className={`gt-chip${type === t ? ' gt-chip-active' : ''}`}
            onClick={() => handleTypeChange(t)}
          >
            <L zh={typeNameZh(t)} en={typeNameEn(t)} />
          </button>
        ))}
      </div>

      <div style={{ overflowX: 'auto', marginTop: 16 }}>
        <svg
          viewBox={`0 0 ${Math.max(gridW, 260)} ${gridH}`}
          width="100%"
          style={{ display: 'block', minWidth: 200, maxWidth: Math.max(gridW, 260) }}
        >
          {/* Column labels (orbit elements) */}
          {cosets.map((_, ci) => {
            const cx = PAD + ci * (CELL + 2) + CELL / 2;
            const isSelected = ci === selectedCoset;
            const tv = targets[ci];
            const label = tv
              ? `(${tv.map(x => Math.round(x) === 0 ? '0' : Math.round(x) > 0 ? '+' : '-').join('')})`
              : `C${ci}`;
            return (
              <g key={ci} style={{ cursor: 'pointer' }} onClick={() => setSelectedCoset(ci)}>
                <rect
                  x={PAD + ci * (CELL + 2)}
                  y={0}
                  width={CELL}
                  height={gridH - 10}
                  rx={4}
                  fill={isSelected
                    ? `color-mix(in srgb, ${PALETTE[ci % PALETTE.length]} 18%, var(--bg-elev))`
                    : 'transparent'}
                  stroke={isSelected ? PALETTE[ci % PALETTE.length] : 'transparent'}
                  strokeWidth={1.5}
                />
                <text
                  x={cx}
                  y={18}
                  textAnchor="middle"
                  style={{ fontFamily: 'var(--mono)', fontSize: 8 }}
                  fill={isSelected ? PALETTE[ci % PALETTE.length] : 'var(--ink-faint)'}
                >
                  {label}
                </text>
                {/* Cells */}
                {cosets[ci].map((_rotIdx, ri) => (
                  <rect
                    key={ri}
                    x={PAD + ci * (CELL + 2) + 3}
                    y={24 + ri * (CELL + 2) + 3}
                    width={CELL - 6}
                    height={CELL - 6}
                    rx={3}
                    fill={isSelected
                      ? `color-mix(in srgb, ${PALETTE[ci % PALETTE.length]} 30%, var(--bg-elev))`
                      : 'var(--bg-elev)'}
                    stroke={isSelected ? PALETTE[ci % PALETTE.length] : 'var(--rule)'}
                    strokeWidth={isSelected ? 1.5 : 1}
                  />
                ))}
                {cosets[ci].map((rotIdx, ri) => (
                  <text
                    key={`t${ri}`}
                    x={cx}
                    y={24 + ri * (CELL + 2) + CELL / 2 + 2}
                    textAnchor="middle"
                    style={{ fontFamily: 'var(--mono)', fontSize: 9, pointerEvents: 'none' }}
                    fill={isSelected ? PALETTE[ci % PALETTE.length] : 'var(--ink-dim)'}
                  >
                    R{rotIdx}
                  </text>
                ))}
              </g>
            );
          })}

          {/* Bottom labels */}
          <text
            x={PAD}
            y={gridH - 1}
            style={{ fontFamily: 'var(--mono)', fontSize: 9 }}
            fill="var(--ink-faint)"
          >
            {lang === 'zh'
              ? `${orbitSize} 列 × ${stabSize} 行 = 24 个旋转`
              : `${orbitSize} cols × ${stabSize} rows = 24 rotations`}
          </text>
        </svg>
      </div>

      <div className="gt-panel-result" style={{ marginTop: 8 }}>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="已选陪集" en="Selected coset" />
          </span>
          <span className="gt-result-val-strong" style={{ color: PALETTE[selectedCoset % PALETTE.length] }}>
            #{selectedCoset + 1} / {orbitSize}
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="陪集大小 = |Stab|" en="Coset size = |Stab|" />
          </span>
          <span className="gt-result-val">{stabSize}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="轨道大小 × |Stab|" en="Orbit size × |Stab|" />
          </span>
          <span className="gt-result-val-strong" style={{ color: 'var(--green)' }}>
            {orbitSize} × {stabSize} = 24 ✓
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="说明" en="Interpretation" />
          </span>
          <span className="gt-result-val" style={{ fontSize: 12 }}>
            <L
              zh={<>每列的 {stabSize} 个旋转都将代表元送到同一目标——这就是陪集 <TeX src={String.raw`g\,\mathrm{Stab}(x)`} /> 的含义。</>}
              en={<>The {stabSize} rotations in each column all send the representative to the same target — that is what the coset <TeX src={String.raw`g\,\mathrm{Stab}(x)`} /> means.</>}
            />
          </span>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Panel 3: Burnside face-colouring counter
// ══════════════════════════════════════════════════════════════════════════════

function BurnsidePanel({ lang }: { lang: Lang }) {
  const [k, setK] = useState(2);
  const [highlightedClass, setHighlightedClass] = useState<number | null>(null);

  const { total, orbits, sanityOk } = useMemo(() => {
    let sum = 0;
    for (const cls of ROT_CLASSES) {
      sum += cls.count * Math.pow(k, cls.cycles);
    }
    const orbits = sum / 24;
    return { total: sum, orbits, sanityOk: Number.isInteger(orbits) };
  }, [k]);

  const CELL_H = 36, COL_GAP = 4;
  const colX = [0, 120, 170, 220, 290];
  const SVG_W = 380;
  const SVG_H = 30 + ROT_CLASSES.length * (CELL_H + COL_GAP) + 60;

  const colHeaders = lang === 'zh'
    ? ['旋转类型', '类大小', 'c(g)', `k^c(g)`, '贡献']
    : ['Rotation class', 'Count', 'c(g)', `k^c(g)`, 'Contribution'];

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="Burnside 计数: 正方体面染色" en="Burnside counting: cube face-colourings" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh={`用 k 种颜色给正方体 6 个面染色，旋转等价的方案算同一种，共有多少种？答：(1/24)·Σ_g k^{c(g)}。`}
          en={`How many distinct ways to colour the 6 faces of a cube with k colours, counting rotations as equivalent? Answer: (1/24)·Σ_g k^{c(g)}.`}
        />
      </div>

      <div className="gt-panel-input-row">
        <label><L zh="颜色数 k" en="Colours k" /></label>
        <input
          type="range" min={1} max={8} value={k}
          onChange={e => setK(+e.target.value)}
          style={{ flex: 1 }}
          className="gt-input"
        />
        <span className="gt-result-val-strong" style={{ minWidth: 32, color: 'var(--accent)' }}>{k}</span>
      </div>

      <div style={{ overflowX: 'auto', marginTop: 16 }}>
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%" style={{ display: 'block', maxWidth: SVG_W }}>
          {/* Header row */}
          {colHeaders.map((h, ci) => (
            <text
              key={ci}
              x={colX[ci] + 4}
              y={18}
              style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700 }}
              fill="var(--ink-faint)"
            >{h}</text>
          ))}

          {/* Data rows */}
          {ROT_CLASSES.map((cls, ri) => {
            const y = 24 + ri * (CELL_H + COL_GAP);
            const contrib = cls.count * Math.pow(k, cls.cycles);
            const isHL = highlightedClass === ri;
            const rowColor = PALETTE[ri % PALETTE.length];
            return (
              <g
                key={ri}
                style={{ cursor: 'pointer' }}
                onClick={() => setHighlightedClass(isHL ? null : ri)}
              >
                <rect
                  x={0} y={y} width={SVG_W} height={CELL_H} rx={4}
                  fill={isHL
                    ? `color-mix(in srgb, ${rowColor} 16%, var(--bg-elev))`
                    : ri % 2 === 0 ? 'var(--bg-elev)' : 'transparent'}
                  stroke={isHL ? rowColor : 'none'}
                  strokeWidth={1.5}
                />
                <text x={colX[0]+4} y={y+CELL_H/2+4} style={{ fontSize: 10, fontFamily: 'var(--mono)' }} fill={isHL ? rowColor : 'var(--ink-dim)'}>
                  {tr(cls.name)}
                </text>
                <text x={colX[1]+4} y={y+CELL_H/2+4} style={{ fontSize: 12, fontFamily: 'var(--mono)' }} fill={isHL ? rowColor : 'var(--ink)'}>
                  {cls.count}
                </text>
                <text x={colX[2]+4} y={y+CELL_H/2+4} style={{ fontSize: 12, fontFamily: 'var(--mono)' }} fill={isHL ? rowColor : 'var(--ink)'}>
                  {cls.cycles}
                </text>
                <text x={colX[3]+4} y={y+CELL_H/2+4} style={{ fontSize: 12, fontFamily: 'var(--mono)' }} fill={isHL ? rowColor : 'var(--ink)'}>
                  {k}^{cls.cycles}={Math.pow(k,cls.cycles)}
                </text>
                <text x={colX[4]+4} y={y+CELL_H/2+4} style={{ fontSize: 12, fontFamily: 'var(--mono)', fontWeight: 700 }} fill={isHL ? rowColor : 'var(--ink)'}>
                  {contrib}
                </text>
              </g>
            );
          })}

          {/* Sum row */}
          {(() => {
            const y = 24 + ROT_CLASSES.length * (CELL_H + COL_GAP) + 8;
            return (
              <g>
                <line x1={0} y1={y-4} x2={SVG_W} y2={y-4} stroke="var(--rule)" strokeWidth={1}/>
                <text x={colX[0]+4} y={y+20} style={{ fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 700 }} fill="var(--ink)">
                  {tr({ zh: '总和 / 24', en: 'Sum / 24'
                })}
                </text>
                <text x={colX[4]+4} y={y+20} style={{ fontSize: 14, fontFamily: 'var(--mono)', fontWeight: 700 }} fill={sanityOk ? 'var(--green)' : 'var(--warn)'}>
                  {total} / 24 = {orbits}
                </text>
                {sanityOk && (
                  <text x={colX[4]+4} y={y+36} style={{ fontSize: 10, fontFamily: 'var(--mono)' }} fill="var(--green)">
                    {tr({ zh: `整除 ✓ (恰为整数)`, en: `divisible by 24 ✓`
                    })}
                  </text>
                )}
              </g>
            );
          })()}
        </svg>
      </div>

      <div className="gt-panel-result" style={{ marginTop: 8 }}>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="颜色数 k" en="Colours k" /></span>
          <span className="gt-result-val-strong" style={{ color: 'var(--accent)' }}>{k}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="不等价染色数" en="Distinct colourings" /></span>
          <span className="gt-result-val-strong" style={{ color: 'var(--green)', fontSize: 18 }}>{orbits}</span>
        </div>
        {k === 2 && (
          <div className="gt-result-row">
            <span className="gt-result-label"><L zh="验证 (k=2)" en="Check (k=2)" /></span>
            <span className="gt-result-val" style={{ color: orbits === 10 ? 'var(--green)' : 'var(--warn)' }}>
              {orbits === 10 ? tr({ zh: '= 10 ✓ (经典结果)', en: '= 10 ✓ (classic result)'
                                      }) : `≠ 10`}
            </span>
          </div>
        )}
        {k === 6 && (
          <div className="gt-result-row">
            <span className="gt-result-label"><L zh="验证 (k=6)" en="Check (k=6)" /></span>
            <span className="gt-result-val" style={{ color: orbits === 2226 ? 'var(--green)' : 'var(--warn)' }}>
              {orbits === 2226 ? (lang === 'zh' ? '= 2226 ✓' : '= 2226 ✓') : `≠ 2226`}
            </span>
          </div>
        )}
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="公式" en="Formula" /></span>
          <span className="gt-result-val" style={{ fontSize: 12, fontFamily: 'var(--mono)' }}>
            (k⁶ + 6k³ + 3k⁴ + 8k² + 6k³) / 24
          </span>
        </div>
      </div>

      {highlightedClass !== null && (
        <div className="gt-aside" style={{ marginTop: 12, fontSize: 13 }}>
          <L
            zh={<>
              <strong>{ROT_CLASSES[highlightedClass].name.zh}：</strong>
              在 6 个面的置换中形成 {ROT_CLASSES[highlightedClass].cycles} 个圈，
              所以 {k}<sup>{ROT_CLASSES[highlightedClass].cycles}</sup> = {Math.pow(k, ROT_CLASSES[highlightedClass].cycles)} 个面的着色方案对这类旋转来说不动，
              类中有 {ROT_CLASSES[highlightedClass].count} 个这样的旋转，贡献 {ROT_CLASSES[highlightedClass].count} × {Math.pow(k, ROT_CLASSES[highlightedClass].cycles)} = {ROT_CLASSES[highlightedClass].count * Math.pow(k, ROT_CLASSES[highlightedClass].cycles)}。
            </>}
            en={<>
              <strong>{ROT_CLASSES[highlightedClass].name.en}:</strong>
              acts on the 6 faces with {ROT_CLASSES[highlightedClass].cycles} cycles,
              so {k}<sup>{ROT_CLASSES[highlightedClass].cycles}</sup> = {Math.pow(k, ROT_CLASSES[highlightedClass].cycles)} colourings are fixed by each such rotation;
              there are {ROT_CLASSES[highlightedClass].count} rotations in this class,
              contributing {ROT_CLASSES[highlightedClass].count} × {Math.pow(k, ROT_CLASSES[highlightedClass].cycles)} = {ROT_CLASSES[highlightedClass].count * Math.pow(k, ROT_CLASSES[highlightedClass].cycles)}.
            </>}
          />
        </div>
      )}
    </div>
  );
}
