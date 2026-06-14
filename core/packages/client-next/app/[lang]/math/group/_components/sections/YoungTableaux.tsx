'use client';

import { useState, useMemo, useCallback } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { tr } from '@/i18n/tr';

// ── Pure math helpers ──────────────────────────────────────────────────────────

function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

/** Conjugate partition: lambda'[j] = #{i : lambda[i] >= j+1} (0-indexed j) */
function conjugate(lambda: number[]): number[] {
  if (lambda.length === 0) return [];
  const maxCol = lambda[0];
  const conj: number[] = [];
  for (let j = 0; j < maxCol; j++) {
    conj.push(lambda.filter(r => r >= j + 1).length);
  }
  return conj;
}

/**
 * Hook lengths matrix. lambda and lambdaConj are 0-indexed.
 * Returns hooks[i][j] for cell (i,j) 0-indexed.
 * h(i,j) = (lambda[i] - j - 1) + (lambdaConj[j] - i - 1) + 1
 *         = lambda[i] + lambdaConj[j] - i - j - 1
 */
function hookMatrix(lambda: number[], lambdaConj: number[]): number[][] {
  return lambda.map((rowLen, i) =>
    Array.from({ length: rowLen }, (_, j) => rowLen + lambdaConj[j] - i - j - 1)
  );
}

/** Hook Length Formula: f^lambda = n! / prod(all hooks) */
function hookLengthFormula(lambda: number[]): number {
  if (lambda.length === 0) return 1;
  const lc = conjugate(lambda);
  const hooks = hookMatrix(lambda, lc);
  let prod = 1;
  for (const row of hooks) for (const h of row) prod *= h;
  const n = lambda.reduce((a, b) => a + b, 0);
  return factorial(n) / prod;
}

/** Generate all partitions of n as sorted arrays (weakly decreasing). */
function partitionsOf(n: number): number[][] {
  if (n === 0) return [[]];
  const result: number[][] = [];
  function gen(remaining: number, maxPart: number, current: number[]): void {
    if (remaining === 0) { result.push([...current]); return; }
    for (let k = Math.min(remaining, maxPart); k >= 1; k--) {
      current.push(k);
      gen(remaining - k, k, current);
      current.pop();
    }
  }
  gen(n, n, []);
  return result;
}

/**
 * Enumerate Standard Young Tableaux of shape lambda up to `limit`.
 * Returns an array of tableaux, each a flat array of length n
 * where tableau[i*colCount + j] = entry at row i col j (1-indexed entry).
 * We represent as number[][] (rows).
 */
function enumerateSYT(lambda: number[], limit: number): number[][][] {
  const n = lambda.reduce((a, b) => a + b, 0);
  const results: number[][][] = [];

  // grid[i][j] = entry (0 = unfilled)
  const grid: number[][] = lambda.map(len => new Array(len).fill(0));

  // A cell (i,j) is "addable" (can receive next value) if:
  // - grid[i][j] === 0 (unfilled)
  // - i===0 or grid[i-1][j] > 0 (cell above filled)
  // - j===0 or grid[i][j-1] > 0 (cell to left filled)
  function addable(): Array<[number, number]> {
    const cells: Array<[number, number]> = [];
    for (let i = 0; i < lambda.length; i++) {
      for (let j = 0; j < lambda[i]; j++) {
        if (grid[i][j] === 0 &&
            (i === 0 || grid[i - 1][j] > 0) &&
            (j === 0 || grid[i][j - 1] > 0)) {
          cells.push([i, j]);
        }
      }
    }
    return cells;
  }

  function backtrack(next: number): void {
    if (results.length >= limit) return;
    if (next > n) {
      results.push(grid.map(row => [...row]));
      return;
    }
    for (const [i, j] of addable()) {
      grid[i][j] = next;
      backtrack(next + 1);
      if (results.length >= limit) { grid[i][j] = 0; return; }
      grid[i][j] = 0;
    }
  }

  backtrack(1);
  return results;
}

/** Render partition as string like "(3,2,1)" */
function partLabel(lambda: number[]): string {
  return `(${lambda.join(',')})`;
}

// ── Palette for sum-of-squares bar ────────────────────────────────────────────
const PALETTE = [
  '#8B2E3C', '#2A4D69', '#3F7050', '#B8860B',
  '#6B4E9C', '#C2410C', '#5C7CA0', '#9C4E6B',
  '#4E7C5C', '#7C4E4E', '#4E5C7C', '#7C7C4E',
];

// ── Cell size for Young diagram SVG ──────────────────────────────────────────
const CELL = 32;

// ═════════════════════════════════════════════════════════════════════════════
// §52 YoungTableaux — main export
// ═════════════════════════════════════════════════════════════════════════════

export default function YoungTableaux() {
  const lang = useLang();

  // Shared state: n and selected partition index
  const [n, setN] = useState(4);
  const [partIdx, setPartIdx] = useState(1); // default (3,1) for n=4

  const allParts = useMemo(() => partitionsOf(n), [n]);
  const safePIdx = Math.min(partIdx, allParts.length - 1);
  const lambda = allParts[safePIdx] ?? [n];

  const handleN = useCallback((newN: number) => {
    setN(newN);
    setPartIdx(0);
  }, []);

  return (
    <GTSec id="young-tableaux" className="gt-sec">
      <div className="gt-sec-num">§52</div>
      <h2 className="gt-sec-title">
        <L zh="Young 图与 S_n 表示" en="Young tableaux & representations of S_n" />
      </h2>

      <p className="gt-lede">
        <L
          zh={<>
            对称群 <TeX src={String.raw`S_n`} /> 的复不可约表示有多少个？恰好与 <TeX src={String.raw`n`} /> 的划分等数，每个划分对应一个 Young 图，每个 Young 图刻画一个 Specht 模。更神奇的是：这个表示的维数等于把 <TeX src={String.raw`1,2,\ldots,n`} /> 填入 Young 图使各行各列严格递增的方案数，而这个方案数又可以用一个极美的公式——钩长公式——一步算出。
          </>}
          en={<>
            How many complex irreducible representations does the symmetric group <TeX src={String.raw`S_n`} /> have? Exactly as many as the number of partitions of <TeX src={String.raw`n`} />, one for each Young diagram. More remarkably, the dimension of each such representation equals the number of ways to fill the diagram with <TeX src={String.raw`1,2,\ldots,n`} /> so that entries increase along every row and down every column — and this count admits a single elegant formula, the Hook Length Formula.
          </>}
        />
      </p>

      {/* ── Definitions ── */}
      <div className="gt-def">
        <div className="gt-def-title">
          <L zh="定义: 划分与 Young 图" en="Definitions: Partition and Young diagram" />
        </div>
        <div className="gt-def-body">
          <p>
            <L
              zh={<>
                正整数 <TeX src={String.raw`n`} /> 的一个<strong>划分</strong> <TeX src={String.raw`\lambda\vdash n`} /> 是满足 <TeX src={String.raw`\lambda_1\ge\lambda_2\ge\cdots\ge\lambda_k>0`} /> 且 <TeX src={String.raw`\sum\lambda_i=n`} /> 的正整数序列。划分数记为 <TeX src={String.raw`p(n)`} />（<TeX src={String.raw`p(1)=1,p(2)=2,\ldots,p(7)=15`} />，见 OEIS A000041）。
              </>}
              en={<>
                A <strong>partition</strong> of a positive integer <TeX src={String.raw`n`} />, written <TeX src={String.raw`\lambda\vdash n`} />, is a weakly-decreasing sequence <TeX src={String.raw`\lambda_1\ge\lambda_2\ge\cdots\ge\lambda_k>0`} /> with <TeX src={String.raw`\sum\lambda_i=n`} />. The number of partitions is <TeX src={String.raw`p(n)`} /> (<TeX src={String.raw`p(1)=1,p(2)=2,\ldots,p(7)=15`} />; see OEIS A000041).
              </>}
            />
          </p>
          <p>
            <L
              zh={<>
                <strong>Young 图</strong>（英式惯例）将 <TeX src={String.raw`n`} /> 个格子左对齐排成 <TeX src={String.raw`k`} /> 行，第 <TeX src={String.raw`i`} /> 行有 <TeX src={String.raw`\lambda_i`} /> 格，自上而下堆叠。格子用 <TeX src={String.raw`(i,j)`} /> 标记，<TeX src={String.raw`1\le i\le k,\;1\le j\le\lambda_i`} />。<strong>共轭划分</strong> <TeX src={String.raw`\lambda'`} /> 满足 <TeX src={String.raw`\lambda'_j=\#\{i:\lambda_i\ge j\}`} />，即将图沿主对角线翻转所得。
              </>}
              en={<>
                The <strong>Young diagram</strong> of <TeX src={String.raw`\lambda`} /> (English convention) is <TeX src={String.raw`n`} /> left-justified boxes arranged in <TeX src={String.raw`k`} /> rows, with <TeX src={String.raw`\lambda_i`} /> boxes in row <TeX src={String.raw`i`} />. The <strong>conjugate partition</strong> <TeX src={String.raw`\lambda'`} /> is defined by <TeX src={String.raw`\lambda'_j=\#\{i:\lambda_i\ge j\}`} /> — equivalently, reflect the diagram across its main diagonal.
              </>}
            />
          </p>
          <p>
            <L
              zh={<>
                格 <TeX src={String.raw`(i,j)`} /> 的<strong>钩</strong>由该格本身、其右侧同行所有格（臂），以及下方同列所有格（腿）组成。<strong>钩长</strong>为
              </>}
              en={<>
                The <strong>hook</strong> of cell <TeX src={String.raw`(i,j)`} /> consists of that cell, all cells strictly to its right in row <TeX src={String.raw`i`} /> (the arm), and all cells strictly below in column <TeX src={String.raw`j`} /> (the leg). The <strong>hook length</strong> is
              </>}
            />
            <TeXBlock src={String.raw`h(i,j)\;=\;\underbrace{(\lambda_i-j)}_{\text{arm}}+\underbrace{(\lambda'_j-i)}_{\text{leg}}+1.`} />
          </p>
          <p>
            <L
              zh={<>
                形状为 <TeX src={String.raw`\lambda`} /> 的<strong>标准 Young 表</strong>（SYT）是将 <TeX src={String.raw`1,\ldots,n`} /> 各用一次填入 Young 图的各格，使各行从左到右、各列从上到下均严格递增的填法，共有 <TeX src={String.raw`f^\lambda`} /> 种。
              </>}
              en={<>
                A <strong>Standard Young Tableau</strong> (SYT) of shape <TeX src={String.raw`\lambda`} /> is a filling of the Young diagram with each of <TeX src={String.raw`1,\ldots,n`} /> exactly once, such that entries strictly increase along every row (left-to-right) and down every column. The count is denoted <TeX src={String.raw`f^\lambda`} />.
              </>}
            />
          </p>
        </div>
      </div>

      {/* ── Theorem: Hook Length Formula ── */}
      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理 (Frame-Robinson-Thrall, 1954): 钩长公式" en="Theorem (Frame-Robinson-Thrall, 1954): Hook Length Formula" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>
              对任意划分 <TeX src={String.raw`\lambda\vdash n`} />，形状为 <TeX src={String.raw`\lambda`} /> 的标准 Young 表数为
            </>}
            en={<>
              For any partition <TeX src={String.raw`\lambda\vdash n`} />, the number of standard Young tableaux of shape <TeX src={String.raw`\lambda`} /> is
            </>}
          />
          <TeXBlock src={String.raw`f^\lambda\;=\;\frac{n!}{\displaystyle\prod_{(i,j)\in\lambda}h(i,j)}.`} />
          <L
            zh={<>
              分母为所有 <TeX src={String.raw`n`} /> 个钩长之积，它整除 <TeX src={String.raw`n!`} />，商为正整数。此数同时等于 Specht 模 <TeX src={String.raw`S^\lambda`} /> 的维数，即 <TeX src={String.raw`S_n`} /> 对应不可约表示的维数（在特征 0 域上）。
            </>}
            en={<>
              The denominator is the product of all <TeX src={String.raw`n`} /> hook lengths, which always divides <TeX src={String.raw`n!`} />, yielding a positive integer. This count equals the dimension of the Specht module <TeX src={String.raw`S^\lambda`} /> — the dimension of the corresponding irreducible representation of <TeX src={String.raw`S_n`} /> over a field of characteristic zero.
            </>}
          />
        </div>
      </div>

      {/* ── Theorem: Classification + Sum of Squares ── */}
      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理: S_n 的分类 + 维数平方和" en="Theorem: Classification of irreps + sum of squares" />
        </div>
        <div className="gt-thm-body">
          <p>
            <L
              zh={<>
                在复数域（特征 0）上，<TeX src={String.raw`S_n`} /> 的不可约表示类与 <TeX src={String.raw`n`} /> 的划分一一对应（映射 <TeX src={String.raw`\lambda\mapsto S^\lambda`} />）。共有 <TeX src={String.raw`p(n)`} /> 个不可约表示，等于 <TeX src={String.raw`S_n`} /> 的共轭类数（循环类型也由划分给出）。
              </>}
              en={<>
                Over the complex numbers (characteristic 0), the irreducible representations of <TeX src={String.raw`S_n`} /> are in canonical bijection with partitions of <TeX src={String.raw`n`} /> via <TeX src={String.raw`\lambda\mapsto S^\lambda`} />. There are exactly <TeX src={String.raw`p(n)`} /> irreps, matching the number of conjugacy classes of <TeX src={String.raw`S_n`} /> (whose types are also given by partitions).
              </>}
            />
          </p>
          <p>
            <L
              zh={<>
                对所有 <TeX src={String.raw`n`} /> 的划分 <TeX src={String.raw`\lambda`} /> 求和，维数的平方和等于群的阶：
              </>}
              en={<>
                Summing over all partitions of <TeX src={String.raw`n`} />, the sum of squared dimensions equals the group order:
              </>}
            />
          </p>
          <TeXBlock src={String.raw`\sum_{\lambda\vdash n}(f^\lambda)^2\;=\;n!`} />
          <L
            zh={<>
              这是任意有限群的一般事实（维数平方和等于群阶）的特例。对 <TeX src={String.raw`S_n`} /> 还有组合证明：Robinson-Schensted 对应给出 <TeX src={String.raw`S_n`} /> 的元素与等形状的 <TeX src={String.raw`(P,Q)`} /> SYT 对之间的双射，从而 <TeX src={String.raw`n!=\sum_\lambda (f^\lambda)^2`} />。
            </>}
            en={<>
              This is a special case of the general fact that the sum of squared dimensions of all irreps of a finite group equals its order. For <TeX src={String.raw`S_n`} /> there is also a combinatorial proof: the Robinson-Schensted correspondence gives a bijection between permutations and pairs <TeX src={String.raw`(P,Q)`} /> of SYT of equal shape, showing <TeX src={String.raw`n!=\sum_\lambda(f^\lambda)^2`} /> directly.
            </>}
          />
        </div>
      </div>

      <p>
        <L
          zh={<>
            <strong>示例</strong>：<TeX src={String.raw`n=3`} /> 有 <TeX src={String.raw`p(3)=3`} /> 个划分，维数分别为 1, 2, 1，<TeX src={String.raw`1^2+2^2+1^2=6=3!`} />。<TeX src={String.raw`n=4`} /> 有 5 个划分，维数 1, 3, 2, 3, 1，<TeX src={String.raw`1+9+4+9+1=24=4!`} />。
          </>}
          en={<>
            <strong>Examples</strong>: For <TeX src={String.raw`n=3`} />, <TeX src={String.raw`p(3)=3`} /> partitions give dimensions 1, 2, 1 and <TeX src={String.raw`1^2+2^2+1^2=6=3!`} />. For <TeX src={String.raw`n=4`} />, five partitions give 1, 3, 2, 3, 1 and <TeX src={String.raw`1+9+4+9+1=24=4!`} />.
          </>}
        />
      </p>

      {/* ── Shared n + partition selector ── */}
      <SharedControls
        n={n}
        setN={handleN}
        allParts={allParts}
        partIdx={safePIdx}
        setPartIdx={setPartIdx}
        lang={lang}
      />

      {/* ── Panel 1: Hook Length Explorer ── */}
      <HookExplorer lambda={lambda} lang={lang} />

      {/* ── Panel 2: SYT Enumerator ── */}
      <SYTEnumerator lambda={lambda} lang={lang} />

      {/* ── Panel 3: Sum-of-squares verifier ── */}
      <SumOfSquaresPanel n={n} allParts={allParts} onSelectPart={setPartIdx} lang={lang} />

      {/* ── Panel 4: Conjugate + Parity / Cube tie-in ── */}
      <ConjugateParityPanel lambda={lambda} lang={lang} />

      {/* ── Cube connection callout ── */}
      <div className="gt-aside" style={{ marginTop: 32 }}>
        <L
          zh={<>
            <strong>与魔方的联系（谨慎表述）</strong>：魔方群 <em>不是</em>对称群，它的不可约表示并不以 Young 图为指标。但它嵌入 <TeX src={String.raw`(\mathbb{Z}_3\wr S_8)\times(\mathbb{Z}_2\wr S_{12})`} /> 的一个指数 12 子群，其中 <TeX src={String.raw`S_8`} />（角块位置）和 <TeX src={String.raw`S_{12}`} />（棱块位置）都是对称群——它们的表示论正好用 Young 图描述。最直接的联系是<strong>符号表示</strong>：单列 Young 图 <TeX src={String.raw`(1^n)`} /> 对应 <TeX src={String.raw`S_n`} /> 的符号（奇偶）同态 <TeX src={String.raw`\sigma\mapsto\operatorname{sgn}(\sigma)\in\{\pm1\}`} />，这正是魔方可解性定律的数学本质——角块置换与棱块置换的符号之积必须为 <TeX src={String.raw`+1`} />，即二者奇偶性相同。
          </>}
          en={<>
            <strong>Cube connection (stated carefully)</strong>: The Rubik&apos;s Cube group is <em>not</em> a symmetric group, and its irreducible representations are not indexed by Young diagrams. However, it embeds in an index-12 subgroup of <TeX src={String.raw`(\mathbb{Z}_3\wr S_8)\times(\mathbb{Z}_2\wr S_{12})`} />, where <TeX src={String.raw`S_8`} /> (corner positions) and <TeX src={String.raw`S_{12}`} /> (edge positions) are symmetric groups whose representation theory is naturally described by Young diagrams. The most direct tie is the <strong>sign representation</strong>: the single-column diagram <TeX src={String.raw`(1^n)`} /> corresponds to the sign homomorphism <TeX src={String.raw`\sigma\mapsto\operatorname{sgn}(\sigma)\in\{\pm1\}`} /> — the exact mathematical content of the cube&apos;s solvability law: the product of the signs of the corner permutation and the edge permutation must equal <TeX src={String.raw`+1`} />, i.e. the two permutations must have the same parity.
          </>}
        />
      </div>

      {/* ── References ── */}
      <div style={{ marginTop: 40, borderTop: '1px solid var(--rule)', paddingTop: 20 }}>
        <div className="gt-panel-title" style={{ marginBottom: 10 }}>
          <L zh="参考文献" en="References" />
        </div>
        <ol style={{ fontFamily: 'var(--serif)', fontSize: 14, color: 'var(--ink-dim)', lineHeight: 1.7, paddingLeft: 22, margin: 0 }}>
          <li>B. E. Sagan, <em>The Symmetric Group</em>, 2nd ed., Springer GTM 203, 2001. Ch. 2 (Specht modules), §3.1 (Robinson-Schensted), Thm 3.10.2 (Hook Length Formula).</li>
          <li>W. Fulton, <em>Young Tableaux</em>, Cambridge LMS Student Texts 35, 1997. Ch. 4, §7 (hook length formula, dimensions).</li>
          <li>J. S. Frame, G. de B. Robinson, R. M. Thrall, &ldquo;The hook graphs of the symmetric group,&rdquo; <em>Canadian J. Math.</em> 6 (1954), 316–324.</li>
          <li>OEIS A000041 (partition numbers p(n)).</li>
        </ol>
      </div>
    </GTSec>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Shared n + partition controls (used by multiple panels)
// ═════════════════════════════════════════════════════════════════════════════

function SharedControls({
  n, setN, allParts, partIdx, setPartIdx, lang: _lang,
}: {
  n: number;
  setN: (n: number) => void;
  allParts: number[][];
  partIdx: number;
  setPartIdx: (i: number) => void;
  lang: 'zh' | 'en';
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', margin: '24px 0 0', padding: '16px', background: 'var(--bg-elev)', border: '1px solid var(--rule)', borderRadius: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-faint)', letterSpacing: '.06em' }}>
          <L zh="选 n" en="Pick n" />
        </span>
        <input
          type="range" min={1} max={8} value={n}
          onChange={e => setN(Number(e.target.value))}
          style={{ width: 120 }}
        />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--accent)', minWidth: 18 }}>{n}</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)' }}>
          p({n})={allParts.length}
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-faint)', alignSelf: 'center', marginRight: 4 }}>
          <L zh="划分" en="partition" /> &lambda;:
        </span>
        {allParts.map((p, i) => (
          <button
            key={i}
            className={`gt-chip${i === partIdx ? ' gt-chip-active' : ''}`}
            onClick={() => setPartIdx(i)}
          >
            {partLabel(p)}
          </button>
        ))}
      </div>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-dim)' }}>
        f<sup>&lambda;</sup> = {hookLengthFormula(allParts[partIdx] ?? [n])}
      </span>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Panel 1: Hook Length Explorer
// ═════════════════════════════════════════════════════════════════════════════

function HookExplorer({ lambda, lang: _lang }: { lambda: number[]; lang: 'zh' | 'en' }) {
  const [hoveredCell, setHoveredCell] = useState<[number, number] | null>(null);

  const lc = useMemo(() => conjugate(lambda), [lambda]);
  const hooks = useMemo(() => hookMatrix(lambda, lc), [lambda, lc]);
  const n = lambda.reduce((a, b) => a + b, 0);
  const f = hookLengthFormula(lambda);

  // Hook cells for hovered cell (arm + leg + self)
  const hookSet = useMemo((): Set<string> => {
    if (!hoveredCell) return new Set();
    const [hi, hj] = hoveredCell;
    const s = new Set<string>();
    // self
    s.add(`${hi},${hj}`);
    // arm: same row, j > hj
    for (let j2 = hj + 1; j2 < lambda[hi]; j2++) s.add(`${hi},${j2}`);
    // leg: same col, i > hi
    for (let i2 = hi + 1; i2 < lambda.length; i2++) {
      if (hj < lambda[i2]) s.add(`${i2},${hj}`);
    }
    return s;
  }, [hoveredCell, lambda]);

  const maxCols = lambda[0] ?? 0;
  const svgW = maxCols * CELL + 2;
  const svgH = lambda.length * CELL + 2;

  // Product breakdown for display
  const hookList: number[] = [];
  for (const row of hooks) for (const h of row) hookList.push(h);

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="钩长探索器" en="Hook Length Explorer" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="每格显示其钩长。悬停或点击一格，高亮它的钩（臂 + 腿 + 自身）。"
          en="Each cell shows its hook length. Hover or tap a cell to highlight its hook (arm + leg + self)."
        />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
        {/* SVG Young diagram */}
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          width={Math.min(svgW, 320)}
          style={{ display: 'block', flexShrink: 0, touchAction: 'none' }}
          onMouseLeave={() => setHoveredCell(null)}
        >
          {lambda.map((rowLen, i) =>
            Array.from({ length: rowLen }, (_, j) => {
              const key = `${i},${j}`;
              const isHovered = hoveredCell?.[0] === i && hoveredCell?.[1] === j;
              const inHook = hookSet.has(key);
              const isSelf = isHovered;
              const isArm = inHook && !isSelf && hoveredCell?.[0] === i;
              const isLeg = inHook && !isSelf && hoveredCell?.[0] !== i;

              let fill = 'var(--bg)';
              let stroke = 'var(--rule)';
              let textColor = 'var(--ink)';
              if (isSelf) { fill = 'var(--accent)'; stroke = 'var(--accent)'; textColor = 'white'; }
              else if (isArm) { fill = 'color-mix(in srgb, var(--accent) 20%, var(--bg-elev))'; stroke = 'var(--accent)'; textColor = 'var(--accent)'; }
              else if (isLeg) { fill = 'color-mix(in srgb, var(--accent-2) 20%, var(--bg-elev))'; stroke = 'var(--accent-2)'; textColor = 'var(--accent-2)'; }

              return (
                <g
                  key={key}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredCell([i, j])}
                  onClick={() => setHoveredCell(c => (c?.[0] === i && c?.[1] === j ? null : [i, j]))}
                >
                  <rect
                    x={1 + j * CELL} y={1 + i * CELL}
                    width={CELL - 1} height={CELL - 1}
                    fill={fill} stroke={stroke} strokeWidth={1}
                  />
                  <text
                    x={1 + j * CELL + CELL / 2}
                    y={1 + i * CELL + CELL / 2 + 5}
                    textAnchor="middle"
                    style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: isSelf ? 700 : 400, pointerEvents: 'none' }}
                    fill={textColor}
                  >
                    {hooks[i][j]}
                  </text>
                </g>
              );
            })
          )}
        </svg>

        {/* Formula display */}
        <div style={{ flex: 1, minWidth: 180 }}>
          {hoveredCell && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-dim)', marginBottom: 12, lineHeight: 1.7 }}>
              <div style={{ color: 'var(--accent)', fontWeight: 700 }}>
                <L zh={`格 (${hoveredCell[0]+1},${hoveredCell[1]+1})`} en={`Cell (${hoveredCell[0]+1},${hoveredCell[1]+1})`} />
              </div>
              <div>
                <L zh="臂" en="arm" /> = {lambda[hoveredCell[0]] - hoveredCell[1] - 1}
              </div>
              <div>
                <L zh="腿" en="leg" /> = {(hoveredCell[1] < lc.length ? lc[hoveredCell[1]] : 0) - hoveredCell[0] - 1}
              </div>
              <div style={{ fontWeight: 700, color: 'var(--accent)' }}>
                <L zh="钩长" en="hook" /> = {hooks[hoveredCell[0]][hoveredCell[1]]}
              </div>
            </div>
          )}

          <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-dim)', lineHeight: 1.8 }}>
            <div style={{ marginBottom: 6 }}>
              <L zh="钩长列表:" en="All hooks:" />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {hookList.map((h, idx) => (
                <span key={idx} style={{ background: 'var(--bg-deep)', border: '1px solid var(--rule)', borderRadius: 3, padding: '1px 6px', fontSize: 11 }}>{h}</span>
              ))}
            </div>
            <div style={{ marginTop: 10, borderTop: '1px solid var(--rule)', paddingTop: 10 }}>
              <div>{n}! / ({hookList.join(' × ')})</div>
              <div>= {factorial(n)} / {hookList.reduce((a, b) => a * b, 1)}</div>
              <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 15 }}>
                = f<sup>&lambda;</sup> = {f}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Panel 2: SYT Enumerator
// ═════════════════════════════════════════════════════════════════════════════

const SYT_PAGE_SIZE = 12;

function SYTEnumerator({ lambda, lang: _lang }: { lambda: number[]; lang: 'zh' | 'en' }) {
  const [page, setPage] = useState(0);
  const [showConj, setShowConj] = useState(false);

  const f = useMemo(() => hookLengthFormula(lambda), [lambda]);
  const lambdaConj = useMemo(() => conjugate(lambda), [lambda]);
  const fConj = useMemo(() => hookLengthFormula(lambdaConj), [lambdaConj]);

  const activeLambda = showConj ? lambdaConj : lambda;
  const activeF = showConj ? fConj : f;

  // Generate SYT for current shape, limited to show page
  const maxGen = Math.min(activeF, (page + 2) * SYT_PAGE_SIZE);
  const tableaux = useMemo(() => enumerateSYT(activeLambda, maxGen), [activeLambda, maxGen]);

  const totalPages = Math.ceil(activeF / SYT_PAGE_SIZE);
  const pageSYTs = tableaux.slice(page * SYT_PAGE_SIZE, (page + 1) * SYT_PAGE_SIZE);

  // Reset page when lambda changes
  const [prevLambda, setPrevLambda] = useState<string>('');
  const key = JSON.stringify(activeLambda);
  if (key !== prevLambda) { setPrevLambda(key); if (page !== 0) setPage(0); }

  const maxCols = activeLambda[0] ?? 0;
  const miniCell = 22;
  const miniW = maxCols * miniCell + 1;
  const miniH = activeLambda.length * miniCell + 1;

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="标准 Young 表枚举" en="SYT Enumerator" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh={`枚举形状为 ${partLabel(activeLambda)} 的所有标准 Young 表。共 ${activeF} 个，与钩长公式吻合。`}
          en={`Enumerate all SYT of shape ${partLabel(activeLambda)}. Total: ${activeF}, confirming the Hook Length Formula.`}
        />
      </div>

      <div className="gt-panel-input-row">
        <button
          className={`gt-chip${!showConj ? ' gt-chip-active' : ''}`}
          onClick={() => { setShowConj(false); setPage(0); }}
        >
          &lambda; = {partLabel(lambda)}
        </button>
        <button
          className={`gt-chip${showConj ? ' gt-chip-active' : ''}`}
          onClick={() => { setShowConj(true); setPage(0); }}
        >
          &lambda;&prime; = {partLabel(lambdaConj)}
        </button>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)' }}>
          <L
            zh={`f^λ = f^λ' = ${f}${f === fConj ? ' (相等)' : ''}`}
            en={`f^λ = ${f}, f^λ' = ${fConj}${f === fConj ? ' (equal)' : ''}`}
          />
        </span>
      </div>

      {/* Counter */}
      <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-dim)', marginBottom: 12 }}>
        <L zh="总数" en="Total" />: <strong style={{ color: 'var(--accent)' }}>{activeF}</strong>
        {' = '}n! / &prod;(<L zh="钩" en="hooks" />) = {factorial(activeLambda.reduce((a, b) => a + b, 0))} / {factorial(activeLambda.reduce((a, b) => a + b, 0)) / activeF}
        {activeF > SYT_PAGE_SIZE && (
          <span style={{ marginLeft: 12, color: 'var(--ink-faint)' }}>
            <L zh={`(显示第 ${page + 1}/${totalPages} 页)`} en={`(page ${page + 1}/${totalPages})`} />
          </span>
        )}
      </div>

      {/* Grid of mini SYT */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {pageSYTs.map((t, idx) => (
          <svg
            key={idx}
            viewBox={`0 0 ${miniW} ${miniH}`}
            width={miniW}
            height={miniH}
            style={{ display: 'block', flexShrink: 0 }}
          >
            {activeLambda.map((rowLen, i) =>
              Array.from({ length: rowLen }, (_, j) => {
                const entry = t[i][j];
                const isFirst = entry === 1;
                const isLast = entry === activeLambda.reduce((a, b) => a + b, 0);
                return (
                  <g key={`${i},${j}`}>
                    <rect
                      x={j * miniCell} y={i * miniCell}
                      width={miniCell} height={miniCell}
                      fill={isFirst ? 'color-mix(in srgb, var(--green) 15%, var(--bg))' : isLast ? 'color-mix(in srgb, var(--accent) 15%, var(--bg))' : 'var(--bg)'}
                      stroke="var(--rule)" strokeWidth={0.5}
                    />
                    <text
                      x={j * miniCell + miniCell / 2}
                      y={i * miniCell + miniCell / 2 + 4}
                      textAnchor="middle"
                      style={{ fontFamily: 'var(--mono)', fontSize: 10, pointerEvents: 'none' }}
                      fill={isFirst ? 'var(--green)' : isLast ? 'var(--accent)' : 'var(--ink)'}
                    >
                      {entry}
                    </text>
                  </g>
                );
              })
            )}
          </svg>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <button
            className="gt-btn-ghost gt-btn"
            style={{ fontSize: 11 }}
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
          >
            <L zh="上一页" en="Prev" />
          </button>
          {Array.from({ length: Math.min(totalPages, 8) }, (_, i) => (
            <button
              key={i}
              className={`gt-chip${i === page ? ' gt-chip-active' : ''}`}
              onClick={() => setPage(i)}
            >
              {i + 1}
            </button>
          ))}
          {totalPages > 8 && <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', alignSelf: 'center' }}>…{totalPages}</span>}
          <button
            className="gt-btn-ghost gt-btn"
            style={{ fontSize: 11 }}
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
          >
            <L zh="下一页" en="Next" />
          </button>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Panel 3: Sum-of-Squares Verifier
// ═════════════════════════════════════════════════════════════════════════════

function SumOfSquaresPanel({
  n, allParts, onSelectPart, lang,
}: {
  n: number;
  allParts: number[][];
  onSelectPart: (i: number) => void;
  lang: 'zh' | 'en';
}) {
  const nFact = factorial(n);

  const rows = useMemo(() => allParts.map(p => {
    const f = hookLengthFormula(p);
    return { lambda: p, f, f2: f * f };
  }), [allParts]);

  const totalF2 = rows.reduce((a, r) => a + r.f2, 0);
  const matches = totalF2 === nFact;

  // For the stacked bar: bar width 100%
  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="维数平方和验证" en="Sum-of-Squares Verifier" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh={`对 n=${n} 的所有 ${allParts.length} 个划分求和，验证 Σ(f^λ)² = n!`}
          en={`For all ${allParts.length} partitions of n=${n}, verify that Σ(f^λ)² = n!`}
        />
      </div>

      {/* Stacked bar */}
      <div style={{ position: 'relative', height: 28, border: '1px solid var(--rule)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
        {rows.map((r, i) => (
          <div
            key={i}
            title={`${partLabel(r.lambda)}: (f^λ)²=${r.f2}`}
            style={{
              position: 'absolute',
              top: 0, bottom: 0,
              left: `${(rows.slice(0, i).reduce((a, x) => a + x.f2, 0) / nFact) * 100}%`,
              width: `${(r.f2 / nFact) * 100}%`,
              background: PALETTE[i % PALETTE.length],
              opacity: 0.85,
              cursor: 'pointer',
              transition: 'opacity .15s',
            }}
            onClick={() => onSelectPart(i)}
          />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 16, fontSize: 11 }}>
        {rows.map((r, i) => (
          <span
            key={i}
            style={{ fontFamily: 'var(--mono)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={() => onSelectPart(i)}
          >
            <span style={{ width: 10, height: 10, background: PALETTE[i % PALETTE.length], display: 'inline-block', borderRadius: 2, flexShrink: 0 }} />
            <span style={{ color: 'var(--ink-dim)' }}>{partLabel(r.lambda)}</span>
          </span>
        ))}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="gt-compare" style={{ width: '100%', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', padding: '6px 8px', borderBottom: '1px solid var(--rule)' }}>
                &lambda;
              </th>
              <th style={{ textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', padding: '6px 8px', borderBottom: '1px solid var(--rule)' }}>
                f<sup>&lambda;</sup>
              </th>
              <th style={{ textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', padding: '6px 8px', borderBottom: '1px solid var(--rule)' }}>
                (f<sup>&lambda;</sup>)²
              </th>
              <th style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', padding: '6px 8px', borderBottom: '1px solid var(--rule)' }}>
                <L zh="色块" en="bar" />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={i}
                style={{ cursor: 'pointer', transition: 'background .1s' }}
                onClick={() => onSelectPart(i)}
                onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-deep)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = ''; }}
              >
                <td style={{ fontFamily: 'var(--mono)', fontSize: 13, padding: '5px 8px', borderBottom: '1px solid var(--rule)' }}>
                  {partLabel(r.lambda)}
                </td>
                <td style={{ textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, color: 'var(--accent)', padding: '5px 8px', borderBottom: '1px solid var(--rule)' }}>
                  {r.f}
                </td>
                <td style={{ textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink)', padding: '5px 8px', borderBottom: '1px solid var(--rule)' }}>
                  {r.f2}
                </td>
                <td style={{ textAlign: 'right', padding: '5px 8px', borderBottom: '1px solid var(--rule)' }}>
                  <span style={{ display: 'inline-block', width: Math.max(6, Math.round((r.f2 / nFact) * 80)), height: 10, background: PALETTE[i % PALETTE.length], borderRadius: 2, verticalAlign: 'middle' }} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: 'var(--bg-elev)' }}>
              <td style={{ fontFamily: 'var(--mono)', fontSize: 12, padding: '6px 8px', color: 'var(--ink-dim)' }}>
                <L zh="合计" en="Total" />
              </td>
              <td />
              <td style={{ textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, padding: '6px 8px', color: matches ? 'var(--green)' : 'var(--warn)' }}>
                {totalF2}
              </td>
              <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, padding: '6px 8px', color: matches ? 'var(--green)' : 'var(--warn)' }}>
                {matches ? `= ${n}! ` : `≠ ${n}!`}
                {matches
                  ? (tr({ zh: '✓ 验证', en: '✓ verified'
                }))
                  : (lang === 'zh' ? '!' : '!')}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div style={{ marginTop: 10, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)' }}>
        <L
          zh={`Σ(f^λ)² = ${totalF2} = ${n}! ${matches ? '✓' : '✗'}`}
          en={`Σ(f^λ)² = ${totalF2} = ${n}! ${matches ? '✓' : '✗'}`}
        />
        {' — '}
        <L
          zh="点击任意行跳转至该划分的 Young 图和 SYT"
          en="click any row to select that partition in the widgets above"
        />
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Panel 4: Conjugate / Parity Spotlight
// ═════════════════════════════════════════════════════════════════════════════

function ConjugateParityPanel({ lambda, lang }: { lambda: number[]; lang: 'zh' | 'en' }) {
  const [showConj, setShowConj] = useState(false);
  const [highlightSign, setHighlightSign] = useState(false);

  const lambdaConj = useMemo(() => conjugate(lambda), [lambda]);
  const f = useMemo(() => hookLengthFormula(lambda), [lambda]);
  const fConj = useMemo(() => hookLengthFormula(lambdaConj), [lambdaConj]);
  const n = lambda.reduce((a, b) => a + b, 0);

  // Sign rep: single column (1,1,...,1) = n ones
  const signLambda = Array.from({ length: n }, () => 1);
  const fSign = hookLengthFormula(signLambda); // always 1

  // Displayed right lambda
  const rightLambda = showConj ? lambdaConj : lambda;

  const svgH = Math.max(lambda.length, lambdaConj.length) * CELL + 2;

  // Draw a single Young diagram as SVG content, at offset x
  function DiagramCells({ lam, xOffset, accent }: { lam: number[]; xOffset: number; accent: string }) {
    return (
      <>
        {lam.map((rowLen, i) =>
          Array.from({ length: rowLen }, (_, j) => (
            <g key={`${i},${j}`}>
              <rect
                x={xOffset + 1 + j * CELL} y={1 + i * CELL}
                width={CELL - 1} height={CELL - 1}
                fill={`color-mix(in srgb, ${accent} 12%, var(--bg))`}
                stroke={accent} strokeWidth={0.8}
              />
            </g>
          ))
        )}
      </>
    );
  }

  const GAP = 32; // gap between two diagrams
  const leftW = (lambda[0] ?? 0) * CELL;
  const rightW = (rightLambda[0] ?? 0) * CELL;
  const totalW = leftW + GAP + rightW + 4;

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="共轭划分与符号表示" en="Conjugate Partition & Sign Representation" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="将 Young 图沿对角线翻转得共轭划分，二者的 SYT 数相等。单列图 (1^n) 是符号表示，与魔方奇偶律直接对应。"
          en="Reflecting a Young diagram across its diagonal gives the conjugate partition — both have the same number of SYT. The single-column shape (1^n) is the sign representation, directly corresponding to the Rubik's cube parity law."
        />
      </div>

      <div className="gt-panel-input-row">
        <button
          className={`gt-chip${!showConj ? ' gt-chip-active' : ''}`}
          onClick={() => setShowConj(false)}
        >
          <L zh="显示原图" en="Show original" />
        </button>
        <button
          className={`gt-chip${showConj ? ' gt-chip-active' : ''}`}
          onClick={() => setShowConj(true)}
        >
          <L zh="显示共轭 λ'" en="Show conjugate λ'" />
        </button>
        <button
          className={`gt-chip${highlightSign ? ' gt-chip-active' : ''}`}
          onClick={() => setHighlightSign(h => !h)}
        >
          <L zh="高亮符号表示 (1^n)" en="Highlight sign rep (1^n)" />
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
        {/* Side-by-side diagrams */}
        <svg
          viewBox={`0 0 ${totalW} ${svgH + 24}`}
          width={Math.min(totalW, 400)}
          style={{ display: 'block', flexShrink: 0 }}
        >
          {/* Left: lambda */}
          <DiagramCells lam={lambda} xOffset={0} accent="var(--accent)" />
          <text x={leftW / 2} y={svgH + 18} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 11 }} fill="var(--accent)">
            {partLabel(lambda)}
          </text>

          {/* Arrow / label */}
          <text
            x={leftW + 2 + GAP / 2} y={svgH / 2 + 4}
            textAnchor="middle"
            style={{ fontFamily: 'var(--mono)', fontSize: 13 }}
            fill="var(--ink-faint)"
          >
            {showConj ? '↔' : '→'}
          </text>
          <text
            x={leftW + 2 + GAP / 2} y={svgH / 2 + 16}
            textAnchor="middle"
            style={{ fontFamily: 'var(--mono)', fontSize: 9 }}
            fill="var(--ink-faint)"
          >
            {tr({ zh: '转置', en: 'transpose'
            })}
          </text>

          {/* Right: rightLambda */}
          <DiagramCells lam={rightLambda} xOffset={leftW + GAP + 2} accent="var(--accent-2)" />
          <text x={leftW + GAP + 2 + rightW / 2} y={svgH + 18} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 11 }} fill="var(--accent-2)">
            {partLabel(rightLambda)}
          </text>
        </svg>

        {/* Info column */}
        <div style={{ flex: 1, minWidth: 160, fontFamily: 'var(--mono)', fontSize: 13, lineHeight: 1.8 }}>
          <div>
            <L zh="f^λ" en="f^λ" /> = <strong style={{ color: 'var(--accent)' }}>{f}</strong>
          </div>
          <div>
            <L zh="f^{λ'}" en="f^{λ'}" /> = <strong style={{ color: 'var(--accent-2)' }}>{fConj}</strong>
          </div>
          <div style={{ color: f === fConj ? 'var(--green)' : 'var(--warn)', fontSize: 12, marginTop: 4 }}>
            {f === fConj
              ? (tr({ zh: '✓ 相等 (S^{λ\'} ≅ S^λ ⊗ sgn)', en: '✓ equal (S^{λ\'} ≅ S^λ ⊗ sgn)' }))
              : (tr({ zh: '不等 (计算有误)', en: 'unequal (computation error)'
            }))}
          </div>
        </div>
      </div>

      {/* Sign rep highlight */}
      {highlightSign && (
        <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
          <svg
            viewBox={`0 0 ${CELL + 2} ${n * CELL + 2}`}
            width={CELL + 2}
            height={Math.min(n * CELL + 2, 200)}
            style={{ display: 'block', flexShrink: 0 }}
          >
            {signLambda.map((_, i) => (
              <g key={i}>
                <rect
                  x={1} y={1 + i * CELL}
                  width={CELL - 1} height={CELL - 1}
                  fill="color-mix(in srgb, var(--gold) 20%, var(--bg))"
                  stroke="var(--gold)" strokeWidth={1.2}
                />
                <text
                  x={1 + (CELL - 1) / 2} y={1 + i * CELL + CELL / 2 + 4}
                  textAnchor="middle"
                  style={{ fontFamily: 'var(--mono)', fontSize: 11 }}
                  fill="var(--gold)"
                >
                  {n - i}
                </text>
              </g>
            ))}
          </svg>

          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--gold)', fontWeight: 700, marginBottom: 8 }}>
              (1<sup>{n}</sup>) — <L zh="符号表示" en="Sign representation" />
            </div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 14, color: 'var(--ink-dim)', lineHeight: 1.7 }}>
              <L
                zh={<>
                  钩长为 {n}, {n-1}, &hellip;, 1，乘积 = {n}! ，故 f<sup>(1^{n})</sup> = {n}! / {n}! = {fSign}（一维表示）。
                  它将 <TeX src={String.raw`\sigma\in S_n`} /> 映射到 <TeX src={String.raw`\operatorname{sgn}(\sigma)\in\{+1,-1\}`} />。
                  <br />
                  <strong>魔方联系</strong>：S_8（角块位置）与 S_12（棱块位置）各自的符号同态之积必须为 +1，即两者置换奇偶性相同——这是魔方可解的必要条件之一，根本来源正是这个最简单的 Young 图。
                </>}
                en={<>
                  Hook lengths are {n}, {n-1}, &hellip;, 1, product = {n}!, so f<sup>(1^{n})</sup> = {n}!/{n}! = {fSign} (one-dimensional). It sends
                  <TeX src={String.raw`\sigma\in S_n`} /> to <TeX src={String.raw`\operatorname{sgn}(\sigma)\in\{+1,-1\}`} />.
                  <br />
                  <strong>Cube connection</strong>: The product of the sign homomorphisms for S_8 (corner positions) and S_12 (edge positions) must equal +1 — both permutations must have the same parity. This is one of the cube&apos;s solvability conditions, and its mathematical source is precisely this simplest Young diagram.
                </>}
              />
            </div>
          </div>
        </div>
      )}

      {/* Conjugate symmetry formula */}
      <div className="gt-panel-result" style={{ marginTop: 16 }}>
        <div className="gt-result-row">
          <span className="gt-result-label">&lambda;</span>
          <span className="gt-result-val">{partLabel(lambda)}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label">&lambda;&prime; <L zh="(共轭)" en="(conjugate)" /></span>
          <span className="gt-result-val">{partLabel(lambdaConj)}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label">f<sup>&lambda;</sup></span>
          <span className="gt-result-val-strong">{f}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label">f<sup>&lambda;&prime;</sup></span>
          <span className="gt-result-val-strong">{fConj}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="相等?" en="Equal?" /></span>
          <span className="gt-result-val" style={{ color: f === fConj ? 'var(--green)' : 'var(--warn)' }}>
            {f === fConj
              ? (lang === 'zh' ? `是，均为 ${f}` : `Yes, both ${f}`)
              : (lang === 'zh' ? `否 (${f} ≠ ${fConj})` : `No (${f} ≠ ${fConj})`)}
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="符号表示维数" en="Sign rep dim" /></span>
          <span className="gt-result-val">f<sup>(1^{n})</sup> = {fSign}</span>
        </div>
      </div>
    </div>
  );
}
