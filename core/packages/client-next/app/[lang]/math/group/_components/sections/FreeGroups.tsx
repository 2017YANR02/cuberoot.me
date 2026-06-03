'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import type { Lang } from '../primitives';

// ── Constants ─────────────────────────────────────────────────────────────────

// Sphere sizes (radius 0..10) for:
//   F_2:         4·3^(L-1) for L>=1, 1 for L=0
//   Z/4*Z/4:     from direct BFS (free product, syllable normal forms)
//   ⟨R,U⟩ cube:  from direct BFS of cubie states

const F2_SPHERE = [1, 4, 12, 36, 108, 324, 972, 2916, 8748, 26244, 78732] as const;
const FREE_PROD_SPHERE = [1, 4, 10, 24, 58, 140, 338, 816, 1970, 4756, 11482] as const;
const CUBE_RU_SPHERE   = [1, 4, 10, 24, 58, 140, 338, 816, 1970, 4756, 11448] as const;

// Prefix sums (ball sizes) — used for tree-depth sphere count display
function buildBalls(spheres: readonly number[]): number[] {
  const b: number[] = [];
  let sum = 0;
  for (const s of spheres) { sum += s; b.push(sum); }
  return b;
}
// Ball sizes (cumulative sums); exported as a comment reference for §61 cross-reference.
// β_{F_2}(L) = 2·3^L − 1, β_{Z/4*Z/4}(L) = sum of FREE_PROD_SPHERE[0..L], etc.
const _F2_BALL        = buildBalls(F2_SPHERE);
const _FREE_PROD_BALL = buildBalls(FREE_PROD_SPHERE);
const _CUBE_RU_BALL   = buildBalls(CUBE_RU_SPHERE);
// Use them to compute beta(L) for the tree-walker depth label
function ballSize(L: number, which: 'f2' | 'fp' | 'cube'): number {
  const arr = which === 'f2' ? _F2_BALL : which === 'fp' ? _FREE_PROD_BALL : _CUBE_RU_BALL;
  return L >= 0 && L < arr.length ? arr[L] : 0;
}

// Colors — from the palette
const COLOR_F2        = '#8B2E3C'; // accent red  — F_2 (idealized free group)
const COLOR_FREE_PROD = '#2A4D69'; // accent blue — Z/4*Z/4
const COLOR_CUBE_RU   = '#3F7050'; // green       — cube ⟨R,U⟩

// ── Word reducer logic ────────────────────────────────────────────────────────

type Letter = 'a' | 'A' | 'b' | 'B';
const ALL_LETTERS: Letter[] = ['a', 'A', 'b', 'B'];

function isInverse(x: Letter, y: Letter): boolean {
  return (x === 'a' && y === 'A') || (x === 'A' && y === 'a') ||
         (x === 'b' && y === 'B') || (x === 'B' && y === 'b');
}

interface ReduceResult {
  reduced: Letter[];
  /** Pairs (i, j) of raw-word indices that cancel */
  cancelledPairs: [number, number][];
}

function reduceWord(raw: Letter[]): ReduceResult {
  // Scan left-to-right with a stack; record which raw indices get cancelled.
  const stack: { letter: Letter; rawIdx: number }[] = [];
  const cancelledPairs: [number, number][] = [];

  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (stack.length > 0 && isInverse(stack[stack.length - 1].letter, c)) {
      const popped = stack.pop()!;
      cancelledPairs.push([popped.rawIdx, i]);
    } else {
      stack.push({ letter: c, rawIdx: i });
    }
  }
  return { reduced: stack.map(s => s.letter), cancelledPairs };
}

function letterColor(l: Letter): string {
  if (l === 'a') return COLOR_F2;
  if (l === 'A') return '#B8680B'; // gold-ish for a^{-1}
  if (l === 'b') return COLOR_FREE_PROD;
  return '#6B4E9C'; // purple for b^{-1}
}

function letterLabel(l: Letter): string {
  if (l === 'a') return 'a';
  if (l === 'A') return 'a⁻¹'; // a⁻¹
  if (l === 'b') return 'b';
  return 'b⁻¹'; // b⁻¹
}

// ── Tree walker data structures ───────────────────────────────────────────────

// Direction labels for the 4-regular F_2 tree
// a=East, A=West, b=North, B=South (at depth 1)
// We track current vertex as a reduced word.

type NodeKey = string; // reduced word joined, e.g. 'abaA'

interface TreeNode {
  key: NodeKey;
  word: Letter[];
  depth: number;
  parent: NodeKey | null;
  parentDir: Letter | null;
  x: number;
  y: number;
  children: { dir: Letter; childKey: NodeKey }[];
}

const MAX_TREE_DEPTH = 6;

// Build the tree lazily up to a depth around the current word
function buildTree(_currentWord: Letter[]): Map<NodeKey, TreeNode> {
  const nodes = new Map<NodeKey, TreeNode>();

  // Root
  const rootNode: TreeNode = {
    key: '',
    word: [],
    depth: 0,
    parent: null,
    parentDir: null,
    x: 0,
    y: 0,
    children: [],
  };
  nodes.set('', rootNode);

  // BFS up to MAX_TREE_DEPTH
  const queue: { key: NodeKey; depth: number }[] = [{ key: '', depth: 0 }];
  while (queue.length > 0) {
    const { key, depth } = queue.shift()!;
    if (depth >= MAX_TREE_DEPTH) continue;
    const node = nodes.get(key)!;

    for (const dir of ALL_LETTERS) {
      // Extend: avoid immediate backtracking (would not be reduced)
      if (node.parentDir !== null && isInverse(dir, node.parentDir)) continue;
      const newWord = [...node.word, dir];
      const childKey = newWord.join('');
      if (!nodes.has(childKey)) {
        const childNode: TreeNode = {
          key: childKey,
          word: newWord,
          depth: depth + 1,
          parent: key,
          parentDir: dir,
          x: 0,
          y: 0,
          children: [],
        };
        nodes.set(childKey, childNode);
        node.children.push({ dir, childKey });
        queue.push({ key: childKey, depth: depth + 1 });
      }
    }
  }
  return nodes;
}

// Layout the tree using polar coordinates
function layoutTree(nodes: Map<NodeKey, TreeNode>, svgW: number, svgH: number): void {
  const CX = svgW / 2;
  const CY = svgH / 2;
  const R0 = Math.min(svgW, svgH) * 0.13; // depth-1 radius
  const DECAY = 0.58;

  const root = nodes.get('')!;
  root.x = CX;
  root.y = CY;

  // For each child of root, assign angle based on direction
  function dirAngle(dir: Letter): number {
    if (dir === 'a') return 0;
    if (dir === 'A') return Math.PI;
    if (dir === 'b') return -Math.PI / 2;
    return Math.PI / 2; // B
  }

  // BFS layout
  const layoutQueue: { key: NodeKey; baseAngle: number; halfSpan: number; depth: number }[] = [];
  for (const { dir, childKey } of root.children) {
    const angle = dirAngle(dir);
    layoutQueue.push({ key: childKey, baseAngle: angle, halfSpan: Math.PI / 4, depth: 1 });
  }

  while (layoutQueue.length > 0) {
    const { key, baseAngle, halfSpan, depth } = layoutQueue.shift()!;
    const node = nodes.get(key)!;
    const parent = nodes.get(node.parent!)!;
    const r = R0 * Math.pow(DECAY, depth - 1);
    node.x = parent.x + r * Math.cos(baseAngle);
    node.y = parent.y + r * Math.sin(baseAngle);

    const nonBackChildren = node.children; // already filtered during build
    const nc = nonBackChildren.length;
    if (nc === 0) continue;
    // Fan children in a sector around baseAngle, excluding back direction
    const spread = halfSpan * 2 * 0.9;
    nonBackChildren.forEach(({ childKey }, ci) => {
      const t = nc === 1 ? 0.5 : ci / (nc - 1);
      const childAngle = baseAngle - spread / 2 + t * spread;
      layoutQueue.push({
        key: childKey,
        baseAngle: childAngle,
        halfSpan: halfSpan * 0.7,
        depth: depth + 1,
      });
    });
  }
}

// ── Word Reducer Widget ───────────────────────────────────────────────────────

function WordReducerWidget({ lang, onWordChange }: { lang: Lang; onWordChange: (w: Letter[]) => void }) {
  const [raw, setRaw] = useState<Letter[]>([]);

  const { reduced, cancelledPairs } = useMemo(() => reduceWord(raw), [raw]);

  const cancelledRawIndices = useMemo(() => {
    const s = new Set<number>();
    for (const [i, j] of cancelledPairs) { s.add(i); s.add(j); }
    return s;
  }, [cancelledPairs]);

  useEffect(() => {
    onWordChange(reduced);
  }, [reduced, onWordChange]);

  const appendLetter = useCallback((l: Letter) => {
    setRaw(prev => [...prev, l]);
  }, []);

  const backspace = useCallback(() => {
    setRaw(prev => prev.slice(0, -1));
  }, []);

  const clear = useCallback(() => {
    setRaw([]);
  }, []);

  const TILE_W = 28;
  const TILE_H = 30;
  const GAP = 3;
  const ROW_H = TILE_H + 8;
  const SVG_H = raw.length === 0 ? 60 : 120;
  const MAX_VISIBLE = 20;
  const showRaw = raw.slice(0, MAX_VISIBLE);
  const showReduced = reduced.slice(0, MAX_VISIBLE);

  function tileX(i: number): number { return 4 + i * (TILE_W + GAP); }

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="约简字构造器" en="Word reducer" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh={<>用下方按钮逐步输入自由群 <TeX src={String.raw`F_2 = \langle a, b \rangle`} /> 中的字，实时观察约简过程：相邻逆对被删去，红线划去的字母成对消去。约简形式唯一（Church–Rosser 性）。</>}
          en={<>Use the buttons below to build a word in <TeX src={String.raw`F_2 = \langle a,b \rangle`} /> letter by letter and watch live reduction: adjacent inverse pairs are deleted; struck-out tiles cancel. The reduced form is unique (Church–Rosser confluence).</>}
        />
      </div>

      {/* Buttons */}
      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {ALL_LETTERS.map(l => (
          <button
            key={l}
            className="gt-btn"
            style={{
              fontFamily: 'var(--mono)',
              fontWeight: 700,
              fontSize: 15,
              minWidth: 38,
              background: `color-mix(in srgb, ${letterColor(l)} 18%, var(--bg-elev))`,
              borderColor: letterColor(l),
              color: letterColor(l),
            }}
            onClick={() => appendLetter(l)}
          >
            {letterLabel(l)}
          </button>
        ))}
        <button className="gt-btn gt-btn-ghost" onClick={backspace} style={{ fontFamily: 'var(--mono)' }}>
          ←
        </button>
        <button className="gt-btn gt-btn-ghost" onClick={clear}>
          <L zh="清空" en="Clear" />
        </button>
      </div>

      {/* Visualization SVG */}
      <svg
        viewBox={`0 0 ${4 + MAX_VISIBLE * (TILE_W + GAP) + 4} ${SVG_H}`}
        width="100%"
        style={{ display: 'block', overflow: 'visible', minHeight: 60, maxWidth: 4 + MAX_VISIBLE * (TILE_W + GAP) + 4 }}
      >
        {raw.length === 0 ? (
          <text x={80} y={36} fill="var(--ink-faint)" fontSize={12} style={{ fontFamily: 'var(--sans)', fontStyle: 'italic' }}>
            {lang === 'zh' ? '输入字母…' : 'Start typing…'}
          </text>
        ) : (
          <>
            {/* Row 1: raw word */}
            <text x={4} y={14} fill="var(--ink-dim)" fontSize={10} style={{ fontFamily: 'var(--mono)' }}>
              {lang === 'zh' ? '原字 |w| = ' : 'raw |w| = '}{raw.length}
            </text>
            {showRaw.map((l, i) => {
              const cx = tileX(i);
              const cancelled = cancelledRawIndices.has(i);
              return (
                <g key={i} transform={`translate(${cx}, 20)`}>
                  <rect x={0} y={0} width={TILE_W} height={TILE_H} rx={4}
                    fill={cancelled
                      ? 'color-mix(in srgb, var(--warn) 15%, var(--bg-elev))'
                      : `color-mix(in srgb, ${letterColor(l)} 18%, var(--bg-elev))`}
                    stroke={cancelled ? 'var(--warn)' : letterColor(l)}
                    strokeWidth={1.5}
                    opacity={cancelled ? 0.5 : 1}
                  />
                  <text x={TILE_W / 2} y={TILE_H / 2 + 1} textAnchor="middle" dominantBaseline="middle"
                    fontSize={11} fill={cancelled ? 'var(--ink-faint)' : letterColor(l)}
                    style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>
                    {l === 'A' ? 'a⁻¹' : l === 'B' ? 'b⁻¹' : l}
                  </text>
                  {/* Strikethrough for cancelled pairs */}
                  {cancelled && (
                    <line x1={2} y1={TILE_H / 2} x2={TILE_W - 2} y2={TILE_H / 2}
                      stroke="var(--warn)" strokeWidth={2} opacity={0.8} />
                  )}
                </g>
              );
            })}
            {raw.length > MAX_VISIBLE && (
              <text x={tileX(MAX_VISIBLE)} y={20 + TILE_H / 2 + 4} fill="var(--ink-faint)" fontSize={10}>
                +{raw.length - MAX_VISIBLE}
              </text>
            )}

            {/* Cancellation arcs between paired tiles */}
            {cancelledPairs.map(([i, j], pi) => {
              if (i >= MAX_VISIBLE || j >= MAX_VISIBLE) return null;
              const x1 = tileX(i) + TILE_W / 2;
              const x2 = tileX(j) + TILE_W / 2;
              const midX = (x1 + x2) / 2;
              const arcH = Math.min(14, Math.max(8, (j - i) * 5));
              return (
                <path key={pi}
                  d={`M${x1},20 Q${midX},${20 - arcH} ${x2},20`}
                  fill="none" stroke="var(--warn)" strokeWidth={1.2} opacity={0.7}
                  strokeDasharray="3 2"
                />
              );
            })}

            {/* Row 2: reduced word */}
            <text x={4} y={20 + ROW_H + 2} fill="var(--ink-dim)" fontSize={10} style={{ fontFamily: 'var(--mono)' }}>
              {lang === 'zh' ? '约简 |w̄| = ' : 'reduced |w̄| = '}{reduced.length}
            </text>
            {showReduced.map((l, i) => {
              const cx = tileX(i);
              return (
                <g key={i} transform={`translate(${cx}, ${20 + ROW_H + 10})`}>
                  <rect x={0} y={0} width={TILE_W} height={TILE_H} rx={4}
                    fill={`color-mix(in srgb, ${letterColor(l)} 28%, var(--bg-elev))`}
                    stroke={letterColor(l)} strokeWidth={2}
                  />
                  <text x={TILE_W / 2} y={TILE_H / 2 + 1} textAnchor="middle" dominantBaseline="middle"
                    fontSize={11} fill={letterColor(l)}
                    style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>
                    {l === 'A' ? 'a⁻¹' : l === 'B' ? 'b⁻¹' : l}
                  </text>
                </g>
              );
            })}
            {reduced.length === 0 && raw.length > 0 && (
              <text x={4} y={20 + ROW_H + 10 + TILE_H / 2 + 4} fill="var(--green)" fontSize={12}
                style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>
                ε {lang === 'zh' ? '(空字, 即单位元)' : '(empty word = identity)'}
              </text>
            )}
          </>
        )}
      </svg>

      {/* Readout */}
      <div className="gt-panel-result" style={{ marginTop: 6 }}>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="原字长度 |w|" en="Raw length |w|" /></span>
          <span className="gt-result-val-strong" style={{ fontFamily: 'var(--mono)' }}>{raw.length}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="约简后长度 |w̄|" en="Reduced length |w̄|" /></span>
          <span className="gt-result-val-strong" style={{ fontFamily: 'var(--mono)', color: 'var(--green)' }}>
            {reduced.length}
            {reduced.length === 0 && raw.length > 0 && ' = ε'}
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="消去对数" en="Cancellation pairs" /></span>
          <span className="gt-result-val">{cancelledPairs.length}</span>
        </div>
        {raw.length > 0 && (
          <div className="gt-result-row">
            <span className="gt-result-label"><L zh="约简形式 (Cayley 图中的测地线)" en="Reduced form (geodesic in Cayley graph)" /></span>
            <span className="gt-result-val" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
              {reduced.length === 0
                ? 'ε'
                : reduced.map(l => (l === 'A' ? 'a⁻¹' : l === 'B' ? 'b⁻¹' : l)).join('')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tree Walker Widget ────────────────────────────────────────────────────────

function TreeWalkerWidget({ lang: _lang, currentWord }: { lang: Lang; currentWord: Letter[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 400, h: 360 });
  const [dragging, setDragging] = useState(false);
  const [lastPt, setLastPt] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const lastTouchDist = useRef<number | null>(null);

  const SVG_W = 400;
  const SVG_H = 360;

  const nodes = useMemo(() => {
    const m = buildTree(currentWord);
    layoutTree(m, SVG_W, SVG_H);
    return m;
  }, [currentWord]);

  const currentKey = currentWord.join('');
  const currentNode = nodes.get(currentKey) ?? nodes.get('')!;

  // Geodesic path: ancestors of currentKey up to root
  const geodesicKeys = useMemo(() => {
    const path: string[] = [];
    let k: string | null = currentKey;
    while (k !== null) {
      path.unshift(k);
      const n = nodes.get(k);
      if (!n) break;
      k = n.parent;
    }
    return new Set(path);
  }, [currentKey, nodes]);

  const geodesicEdges = useMemo(() => {
    const edges: [string, string][] = [];
    let k: string | null = currentKey;
    while (k !== null) {
      const n = nodes.get(k);
      if (!n || n.parent === null) break;
      edges.push([n.parent, k]);
      k = n.parent;
    }
    return new Set(edges.map(([a, b]) => `${a}|${b}`));
  }, [currentKey, nodes]);

  const recenter = useCallback(() => {
    const cx = currentNode.x;
    const cy = currentNode.y;
    setViewBox({ x: cx - SVG_W / 2, y: cy - SVG_H / 2, w: SVG_W / scale, h: SVG_H / scale });
  }, [currentNode.x, currentNode.y, scale]);

  // Pan handlers
  function handleMouseDown(e: React.MouseEvent) {
    setDragging(true);
    setLastPt({ x: e.clientX, y: e.clientY });
  }
  function handleMouseMove(e: React.MouseEvent) {
    if (!dragging) return;
    const dx = (e.clientX - lastPt.x) * (viewBox.w / SVG_W);
    const dy = (e.clientY - lastPt.y) * (viewBox.h / SVG_H);
    setViewBox(v => ({ ...v, x: v.x - dx, y: v.y - dy }));
    setLastPt({ x: e.clientX, y: e.clientY });
  }
  function handleMouseUp() { setDragging(false); }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    setViewBox(v => ({
      x: v.x + (v.w * (1 - factor)) / 2,
      y: v.y + (v.h * (1 - factor)) / 2,
      w: v.w * factor,
      h: v.h * factor,
    }));
    setScale(s => s / factor);
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDist.current = Math.sqrt(dx * dx + dy * dy);
    } else if (e.touches.length === 1) {
      setDragging(true);
      setLastPt({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && lastTouchDist.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const d = Math.sqrt(dx * dx + dy * dy);
      const factor = lastTouchDist.current / d;
      lastTouchDist.current = d;
      setViewBox(v => ({
        x: v.x + (v.w * (1 - factor)) / 2,
        y: v.y + (v.h * (1 - factor)) / 2,
        w: v.w * factor,
        h: v.h * factor,
      }));
    } else if (e.touches.length === 1 && dragging) {
      const dx = (e.touches[0].clientX - lastPt.x) * (viewBox.w / SVG_W);
      const dy = (e.touches[0].clientY - lastPt.y) * (viewBox.h / SVG_H);
      setViewBox(v => ({ ...v, x: v.x - dx, y: v.y - dy }));
      setLastPt({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  }
  function handleTouchEnd() {
    setDragging(false);
    lastTouchDist.current = null;
  }

  const vb = `${viewBox.x.toFixed(1)} ${viewBox.y.toFixed(1)} ${viewBox.w.toFixed(1)} ${viewBox.h.toFixed(1)}`;

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="F₂ 的 Cayley 树漫步" en="Walker on the F₂ Cayley tree" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh={<>约简字对应 Cayley 树中从根 <TeX src={String.raw`\varepsilon`} /> 到当前顶点的唯一测地线（绿色路径）。输入某字母的逆会沿同一条边折回，几何上就是消去。支持拖拽平移和捏合缩放。</>}
          en={<>The reduced word labels the unique geodesic from root <TeX src={String.raw`\varepsilon`} /> to the current vertex (green path). Typing an inverse retraces the same edge — geometrically, that is cancellation. Drag to pan, pinch or scroll to zoom.</>}
        />
      </div>

      <div className="gt-panel-input-row" style={{ gap: 8 }}>
        <button className="gt-btn gt-btn-ghost" onClick={recenter} style={{ fontSize: 12 }}>
          <L zh="居中当前顶点" en="Center current vertex" />
        </button>
        <button className="gt-btn gt-btn-ghost" onClick={() => setViewBox({ x: 0, y: 0, w: SVG_W, h: SVG_H })} style={{ fontSize: 12 }}>
          <L zh="重置视图" en="Reset view" />
        </button>
      </div>

      <svg
        ref={svgRef}
        viewBox={vb}
        width="100%"
        style={{ display: 'block', height: SVG_H, cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none', maxWidth: SVG_W }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Edges */}
        {Array.from(nodes.values()).map(node => {
          if (node.parent === null) return null;
          const parent = nodes.get(node.parent);
          if (!parent) return null;
          const edgeKey = `${node.parent}|${node.key}`;
          const onGeodesic = geodesicEdges.has(edgeKey);
          return (
            <line
              key={`edge-${node.key}`}
              x1={parent.x} y1={parent.y}
              x2={node.x} y2={node.y}
              stroke={onGeodesic ? 'var(--green)' : 'var(--rule)'}
              strokeWidth={onGeodesic ? 2.2 : 1}
              opacity={onGeodesic ? 1 : 0.5}
            />
          );
        })}

        {/* Edge direction labels at depth 1 */}
        {nodes.get('')!.children.map(({ dir, childKey }) => {
          const child = nodes.get(childKey)!;
          const root = nodes.get('')!;
          const midX = (root.x + child.x) / 2;
          const midY = (root.y + child.y) / 2;
          return (
            <text key={`dirlabel-${dir}`} x={midX} y={midY - 6}
              textAnchor="middle" fontSize={9}
              fill={letterColor(dir)}
              style={{ fontFamily: 'var(--mono)', fontWeight: 700, userSelect: 'none' }}>
              {dir === 'A' ? 'a⁻¹' : dir === 'B' ? 'b⁻¹' : dir}
            </text>
          );
        })}

        {/* Nodes */}
        {Array.from(nodes.values()).map(node => {
          const isRoot = node.key === '';
          const isCurrent = node.key === currentKey;
          const onPath = geodesicKeys.has(node.key) && !isCurrent;
          const r = isRoot ? 11 : isCurrent ? 13 : onPath ? 8 : 6;
          const fill = isCurrent ? 'var(--green)'
            : onPath ? 'color-mix(in srgb, var(--green) 35%, var(--bg-elev))'
            : isRoot ? 'var(--bg-elev)'
            : 'var(--bg)';
          const stroke = isCurrent ? 'var(--green)' : onPath ? 'var(--green)' : 'var(--rule)';
          const sw = isCurrent ? 2.5 : onPath ? 1.8 : 0.8;
          return (
            <g key={`node-${node.key}`}>
              <circle cx={node.x} cy={node.y} r={r}
                fill={fill} stroke={stroke} strokeWidth={sw} />
              {(isRoot || isCurrent || node.depth <= 1) && (
                <text x={node.x} y={node.y + 1}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={isRoot ? 8 : 7}
                  fill={isCurrent ? 'white' : isRoot ? 'var(--ink-dim)' : 'var(--ink-faint)'}
                  style={{ fontFamily: 'var(--mono)', pointerEvents: 'none', userSelect: 'none' }}>
                  {isRoot ? 'ε' : node.key.length > 4 ? node.key.slice(0, 3) + '…' : node.key}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="gt-panel-result" style={{ marginTop: 6 }}>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="当前顶点 (约简字)" en="Current vertex (reduced word)" /></span>
          <span className="gt-result-val-strong" style={{ fontFamily: 'var(--mono)', color: 'var(--green)' }}>
            {currentKey === '' ? 'ε' : currentKey}
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="距根的距离 d(ε, w)" en="Distance from root d(ε, w)" /></span>
          <span className="gt-result-val">{currentWord.length}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label"><L zh="4-正则树：每顶点度数" en="4-regular tree: degree of each vertex" /></span>
          <span className="gt-result-val">4 = 2|S| <L zh="（|S|=2）" en="(|S|=2)" /></span>
        </div>
        {currentWord.length <= 10 && (
          <div className="gt-result-row">
            <span className="gt-result-label">
              <L zh="半径内的 F₂ 球大小 β(d)" en="F₂ ball size β(d)" />
            </span>
            <span className="gt-result-val" style={{ fontFamily: 'var(--mono)' }}>
              {ballSize(currentWord.length, 'f2').toLocaleString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sphere size comparison widget ─────────────────────────────────────────────

function SphereSizePanel({ lang }: { lang: Lang }) {
  const [maxL, setMaxL] = useState(10);
  const [showF2, setShowF2] = useState(true);
  const [showFP, setShowFP] = useState(true);
  const [showCube, setShowCube] = useState(true);
  const [logScale, setLogScale] = useState(false);
  const [tappedL, setTappedL] = useState<number | null>(null);

  const W = 480;
  const H = 220;
  const PAD = { top: 16, right: 16, bottom: 44, left: 52 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const nBars = maxL + 1;
  const nSeries = [showF2, showFP, showCube].filter(Boolean).length;
  const barGroupW = plotW / nBars;
  const barPad = 2;
  const barW = nSeries === 0 ? 0 : (barGroupW - barPad * 2) / nSeries;

  const series = useMemo(() => {
    const arr: { id: string; data: readonly number[]; color: string; labelZh: string; labelEn: string }[] = [];
    if (showF2)   arr.push({ id: 'f2',        data: F2_SPHERE,        color: COLOR_F2,        labelZh: 'F₂ (自由群)', labelEn: 'F₂ (free group)' });
    if (showFP)   arr.push({ id: 'fp',        data: FREE_PROD_SPHERE, color: COLOR_FREE_PROD, labelZh: 'Z/4*Z/4 (自由积)', labelEn: 'Z/4*Z/4 (free product)' });
    if (showCube) arr.push({ id: 'cube',      data: CUBE_RU_SPHERE,   color: COLOR_CUBE_RU,   labelZh: '⟨R,U⟩ 魔方子群', labelEn: '⟨R,U⟩ cube subgroup' });
    return arr;
  }, [showF2, showFP, showCube]);

  const visibleMax = useMemo(() => {
    let m = 1;
    for (let l = 0; l <= maxL; l++) {
      if (showF2)   m = Math.max(m, F2_SPHERE[l]);
      if (showFP)   m = Math.max(m, FREE_PROD_SPHERE[l]);
      if (showCube) m = Math.max(m, CUBE_RU_SPHERE[l]);
    }
    return m;
  }, [maxL, showF2, showFP, showCube]);

  function barH(val: number): number {
    if (val <= 0) return 0;
    if (logScale) {
      const logMax = Math.log10(visibleMax + 1);
      const logVal = Math.log10(val + 1);
      return (logVal / logMax) * plotH;
    }
    return (val / visibleMax) * plotH;
  }

  function groupX(l: number): number {
    return PAD.left + l * barGroupW;
  }

  function handleBarClick(l: number) {
    setTappedL(prev => prev === l ? null : l);
  }

  const tappedData = tappedL !== null ? {
    l: tappedL,
    f2:   F2_SPHERE[tappedL],
    fp:   FREE_PROD_SPHERE[tappedL],
    cube: CUBE_RU_SPHERE[tappedL],
    deficit: FREE_PROD_SPHERE[tappedL] - CUBE_RU_SPHERE[tappedL],
  } : null;

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">
        <L zh="球面大小对比：F₂ vs Z/4*Z/4 vs ⟨R,U⟩" en="Sphere sizes: F₂ vs Z/4*Z/4 vs ⟨R,U⟩" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh={<>
            ⟨R,U⟩ 不是自由群（因为 R⁴=U⁴=1 是长度 4 的关系），正确的理想化模型是自由积
            <TeX src={String.raw`\mathbb{Z}/4 * \mathbb{Z}/4`} />。它们在半径 0–9 球面完全一致，
            首次在半径 10 分离（亏量 34）。点击柱子读取精确数值。
          </>}
          en={<>
            ⟨R,U⟩ is NOT free (R⁴=U⁴=1 are length-4 relations); the correct idealized model is the free product
            <TeX src={String.raw`\mathbb{Z}/4 * \mathbb{Z}/4`} />.
            They agree exactly at radii 0–9 and first diverge at radius 10 (deficit 34). Click a group of bars to read exact counts.
          </>}
        />
      </div>

      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 6 }}>
        <label style={{ fontSize: 12, color: 'var(--ink-dim)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <L zh={`最大半径 ${maxL}`} en={`max radius ${maxL}`} />
          <input type="range" min={1} max={10} value={maxL}
            onChange={e => setMaxL(Number(e.target.value))} style={{ width: 80 }} />
        </label>
        <button className={`gt-chip${logScale ? ' gt-chip-active' : ''}`} onClick={() => setLogScale(s => !s)}>
          <L zh={logScale ? '对数轴' : '线性轴'} en={logScale ? 'Log' : 'Linear'} />
        </button>
      </div>
      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {[
          { val: showF2,   set: setShowF2,   color: COLOR_F2,        labelZh: 'F₂', labelEn: 'F₂' },
          { val: showFP,   set: setShowFP,   color: COLOR_FREE_PROD, labelZh: 'Z/4*Z/4', labelEn: 'Z/4*Z/4' },
          { val: showCube, set: setShowCube, color: COLOR_CUBE_RU,   labelZh: '⟨R,U⟩', labelEn: '⟨R,U⟩' },
        ].map(({ val, set, color, labelZh, labelEn }) => (
          <button
            key={labelEn}
            className={`gt-chip${val ? ' gt-chip-active' : ''}`}
            style={val ? { borderColor: color, color, background: `color-mix(in srgb, ${color} 12%, var(--bg))` } : {}}
            onClick={() => set((s: boolean) => !s)}
          >
            <L zh={labelZh} en={labelEn} />
          </button>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%"
        style={{ display: 'block', overflow: 'visible', cursor: 'pointer', maxWidth: W }}>
        {/* Plot background */}
        <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH}
          fill="var(--bg-elev)" rx={3} />
        {/* Grid */}
        {[0.25, 0.5, 0.75, 1].map(f => (
          <line key={f}
            x1={PAD.left} y1={PAD.top + plotH - f * plotH}
            x2={PAD.left + plotW} y2={PAD.top + plotH - f * plotH}
            stroke="var(--rule)" strokeWidth={0.5} />
        ))}

        {/* Bars */}
        {Array.from({ length: maxL + 1 }, (_, l) => {
          const gx = groupX(l);
          const isTapped = l === tappedL;
          return (
            <g key={l} onClick={() => handleBarClick(l)} style={{ cursor: 'pointer' }}>
              {/* Tap highlight */}
              {isTapped && (
                <rect x={gx + barPad} y={PAD.top} width={barGroupW - barPad * 2} height={plotH}
                  fill="var(--gold)" opacity={0.1} rx={2} />
              )}
              {series.map(({ id, data, color }, si) => {
                const bh = barH(data[l]);
                const bx = gx + barPad + si * barW;
                const by = PAD.top + plotH - bh;
                // Special: deficit mark at L=10
                const showDeficit = id === 'cube' && l === 10 && showFP;
                return (
                  <g key={id}>
                    {bh > 0 && (
                      <rect x={bx} y={by} width={barW} height={bh}
                        fill={color} opacity={0.8} rx={1}
                      />
                    )}
                    {/* Deficit cap at radius 10 */}
                    {showDeficit && (() => {
                      const fpH = barH(FREE_PROD_SPHERE[l]);
                      const defH = barH(FREE_PROD_SPHERE[l]) - barH(CUBE_RU_SPHERE[l]);
                      if (defH <= 0) return null;
                      const defY = PAD.top + plotH - fpH;
                      return (
                        <rect x={bx} y={defY} width={barW} height={defH}
                          fill={COLOR_FREE_PROD} opacity={0.35} rx={1}
                          strokeDasharray="2 1" stroke={COLOR_FREE_PROD} strokeWidth={0.8}
                        />
                      );
                    })()}
                  </g>
                );
              })}
              {/* X label */}
              <text x={gx + barGroupW / 2} y={PAD.top + plotH + 14}
                textAnchor="middle" fontSize={9} fill="var(--ink-dim)"
                style={{ fontFamily: 'var(--mono)' }}>
                {l}
              </text>
              {/* Mismatch marker at L=10 */}
              {l === 10 && showFP && showCube && (
                <line x1={gx + barGroupW / 2} y1={PAD.top + plotH - 2} x2={gx + barGroupW / 2} y2={PAD.top + plotH + 7}
                  stroke="var(--warn)" strokeWidth={2} />
              )}
            </g>
          );
        })}

        {/* Annotation at radius 10 */}
        {maxL >= 10 && showFP && showCube && (
          <text x={groupX(10) + barGroupW / 2} y={PAD.top - 4}
            textAnchor="middle" fontSize={8} fill="var(--warn)"
            style={{ fontFamily: 'var(--mono)' }}>
            {lang === 'zh' ? '首次分离 ▼' : '1st split ▼'}
          </text>
        )}

        {/* Axis border */}
        <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH}
          fill="none" stroke="var(--rule)" strokeWidth={1} />
        <text x={PAD.left + plotW / 2} y={H - 4}
          textAnchor="middle" fontSize={9} fill="var(--ink-dim)"
          style={{ fontFamily: 'var(--mono)' }}>
          <L zh="半径 L" en="radius L" />
        </text>

        {/* Legend */}
        {series.map(({ id, color, labelZh, labelEn }, si) => (
          <g key={id} transform={`translate(${PAD.left + 6}, ${PAD.top + 8 + si * 15})`}>
            <rect x={0} y={-6} width={12} height={9} fill={color} opacity={0.8} rx={1} />
            <text x={16} y={1} fontSize={8} fill="var(--ink)" style={{ fontFamily: 'var(--mono)' }}>
              {lang === 'zh' ? labelZh : labelEn}
            </text>
          </g>
        ))}
      </svg>

      {/* Readout */}
      {tappedData ? (
        <div className="gt-panel-result" style={{ marginTop: 6 }}>
          <div className="gt-result-row">
            <span className="gt-result-label"><L zh={`半径 L = ${tappedData.l}`} en={`radius L = ${tappedData.l}`} /></span>
            <span className="gt-result-val" />
          </div>
          {showF2 && (
            <div className="gt-result-row">
              <span className="gt-result-label" style={{ color: COLOR_F2 }}>
                F₂ σ({tappedData.l})
              </span>
              <span className="gt-result-val-strong" style={{ color: COLOR_F2, fontFamily: 'var(--mono)' }}>
                {F2_SPHERE[tappedData.l].toLocaleString()}
                {tappedData.l > 0 && ` = 4·3^${tappedData.l - 1}`}
              </span>
            </div>
          )}
          {showFP && (
            <div className="gt-result-row">
              <span className="gt-result-label" style={{ color: COLOR_FREE_PROD }}>
                Z/4*Z/4 σ({tappedData.l})
              </span>
              <span className="gt-result-val-strong" style={{ color: COLOR_FREE_PROD, fontFamily: 'var(--mono)' }}>
                {FREE_PROD_SPHERE[tappedData.l].toLocaleString()}
              </span>
            </div>
          )}
          {showCube && (
            <div className="gt-result-row">
              <span className="gt-result-label" style={{ color: COLOR_CUBE_RU }}>
                ⟨R,U⟩ σ({tappedData.l})
              </span>
              <span className="gt-result-val-strong" style={{ color: COLOR_CUBE_RU, fontFamily: 'var(--mono)' }}>
                {CUBE_RU_SPHERE[tappedData.l].toLocaleString()}
              </span>
            </div>
          )}
          {tappedData.l === 10 && showFP && showCube && (
            <div className="gt-result-row">
              <span className="gt-result-label" style={{ color: 'var(--warn)' }}>
                <L zh="亏量 (Z/4*Z/4 − ⟨R,U⟩)" en="deficit (Z/4*Z/4 − ⟨R,U⟩)" />
              </span>
              <span className="gt-result-val-strong" style={{ color: 'var(--warn)', fontFamily: 'var(--mono)' }}>
                {tappedData.deficit}
                <L zh=" (首次非零)" en=" (first nonzero)" />
              </span>
            </div>
          )}
          {tappedData.l < 10 && showFP && showCube && (
            <div className="gt-result-row">
              <span className="gt-result-label" style={{ color: 'var(--green)' }}>
                <L zh="亏量" en="deficit" />
              </span>
              <span className="gt-result-val" style={{ color: 'var(--green)', fontFamily: 'var(--mono)' }}>
                0 <L zh="（完全一致）" en="(exact match)" />
              </span>
            </div>
          )}
        </div>
      ) : (
        <p style={{ color: 'var(--ink-faint)', fontSize: 12, fontStyle: 'italic', margin: '6px 0 0' }}>
          <L zh="点击柱子查看精确数值。" en="Click a bar group to inspect exact counts." />
        </p>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function FreeGroups() {
  const lang = useLang();
  const [currentWord, setCurrentWord] = useState<Letter[]>([]);

  const handleWordChange = useCallback((w: Letter[]) => {
    setCurrentWord(w);
  }, []);

  return (
    <GTSec id="free-groups" className="gt-sec">
      <div className="gt-sec-num">§56</div>
      <h2 className="gt-sec-title">
        <L zh="自由群与约简字" en="Free groups &amp; word reduction" />
      </h2>

      <p className="gt-lede">
        <L
          zh={<>
            自由群 <TeX src={String.raw`F_S`} /> 是所有群中最"不受约束"的：它的元素是字母表 <TeX src={String.raw`S \cup S^{-1}`} /> 上的<strong>约简字</strong>，乘法是拼接后消去相邻逆对，唯一的关系仅是平凡消去
            <TeX src={String.raw`s s^{-1} = \varepsilon`} />。
            正因为没有额外关系，每个群都是某个自由群的商：呈示 <TeX src={String.raw`G = \langle S \mid R \rangle`} /> 意味着
            <TeX src={String.raw`G \cong F_S / N`} />，其中 <TeX src={String.raw`N`} /> 是关系集 <TeX src={String.raw`R`} /> 的<strong>正规闭包</strong>。
            魔方的两个面转 <TeX src={String.raw`\langle R, U \rangle`} /> 在约 10 步深度以内几乎自由地组合——下方交互面板将带你一探究竟。
          </>}
          en={<>
            The free group <TeX src={String.raw`F_S`} /> is the most unconstrained of all groups: its elements are <strong>reduced words</strong> over the alphabet <TeX src={String.raw`S \cup S^{-1}`} />, with multiplication by concatenation-then-cancellation of adjacent inverse pairs, and the only relations being the trivial ones <TeX src={String.raw`s s^{-1} = \varepsilon`} />.
            Because there are no extra relations, every group is a quotient of some free group: a presentation <TeX src={String.raw`G = \langle S \mid R \rangle`} /> means
            <TeX src={String.raw`G \cong F_S / N`} /> where <TeX src={String.raw`N`} /> is the <strong>normal closure</strong> of the relator set <TeX src={String.raw`R`} />.
            The two single-face generators <TeX src={String.raw`\langle R, U \rangle`} /> of the Rubik&apos;s Cube combine almost freely for about 10 quarter-turns — the interactive panels below let you explore exactly how and when this breaks down.
          </>}
        />
      </p>

      {/* ── Definitions ────────────────────────────────────────────────────────── */}

      <div className="gt-def">
        <div className="gt-def-title">
          <L zh="定义：自由群 F_S" en="Definition: Free group F_S" />
        </div>
        <div className="gt-def-body">
          <L
            zh={<>
              设 <TeX src={String.raw`S`} /> 是集合，<TeX src={String.raw`S^{-1} = \{ s^{-1} : s \in S \}`} /> 与之不相交（形式逆元集）。
              字母表 <TeX src={String.raw`S \cup S^{-1}`} /> 上的<strong>字</strong>（word）是有限序列（允许空字 <TeX src={String.raw`\varepsilon`} />）；若字中相邻两字母互为逆（<TeX src={String.raw`s s^{-1}`} /> 或 <TeX src={String.raw`s^{-1} s`} />），则称之为<strong>不约简的</strong>。
              <strong>约简字</strong>（reduced word）是不含这类相邻逆对的字。
            </>}
            en={<>
              Let <TeX src={String.raw`S`} /> be a set and <TeX src={String.raw`S^{-1} = \{ s^{-1} : s \in S \}`} /> a disjoint set of formal inverses. A <strong>word</strong> over the alphabet <TeX src={String.raw`S \cup S^{-1}`} /> is a finite sequence (the empty word <TeX src={String.raw`\varepsilon`} /> is allowed); a word is <strong>unreduced</strong> if it contains adjacent letters that are mutual inverses (<TeX src={String.raw`s s^{-1}`} /> or <TeX src={String.raw`s^{-1} s`} /> for some <TeX src={String.raw`s`} />).
              A <strong>reduced word</strong> contains no such adjacent inverse pair.
            </>}
          />
          <p style={{ margin: '10px 0 4px' }}>
            <L
              zh={<>
                <strong>自由群</strong> <TeX src={String.raw`F_S`} /> 是所有约简字的集合，乘法定义为拼接后反复删去相邻逆对直至约简；
                单位元为 <TeX src={String.raw`\varepsilon`} />，逆元为
                <TeX src={String.raw`(s_1 s_2 \cdots s_k)^{-1} = s_k^{-1} \cdots s_2^{-1} s_1^{-1}`} />。
                秩（rank）<TeX src={String.raw`= |S|`} />，当 <TeX src={String.raw`|S| = n`} /> 时记作 <TeX src={String.raw`F_n`} />。
              </>}
              en={<>
                The <strong>free group</strong> <TeX src={String.raw`F_S`} /> is the set of all reduced words, with multiplication defined by concatenation followed by repeated deletion of adjacent inverse pairs until reduced; the identity is <TeX src={String.raw`\varepsilon`} /> and the inverse is
                <TeX src={String.raw`(s_1 s_2 \cdots s_k)^{-1} = s_k^{-1} \cdots s_2^{-1} s_1^{-1}`} />.
                The rank is <TeX src={String.raw`|S|`} />; one writes <TeX src={String.raw`F_n`} /> when <TeX src={String.raw`|S| = n`} />.
              </>}
            />
          </p>
          <TeXBlock src={String.raw`F_2 = \langle a, b \rangle,\quad \text{elements: } \varepsilon,\; a,\; b,\; a^{-1},\; b^{-1},\; ab,\; a^{-1}b,\; aba^{-1},\;\ldots`} />
        </div>
      </div>

      <div className="gt-def">
        <div className="gt-def-title">
          <L zh="定义：泛性质与群呈示" en="Definition: Universal property and group presentations" />
        </div>
        <div className="gt-def-body">
          <L
            zh={<>
              <strong>泛性质</strong>：设 <TeX src={String.raw`\iota : S \to F_S`} /> 是包含映射。对任意群 <TeX src={String.raw`G`} /> 和任意集合映射 <TeX src={String.raw`f : S \to G`} />，存在<strong>唯一</strong>的群同态 <TeX src={String.raw`\varphi : F_S \to G`} /> 使 <TeX src={String.raw`\varphi \circ \iota = f`} />。
              这等价于说 <TeX src={String.raw`F_S`} /> 是遗忘函子 <TeX src={String.raw`\mathbf{Grp} \to \mathbf{Set}`} /> 的左伴随。
            </>}
            en={<>
              <strong>Universal property</strong>: let <TeX src={String.raw`\iota : S \to F_S`} /> be the inclusion. For every group <TeX src={String.raw`G`} /> and every set map <TeX src={String.raw`f : S \to G`} />, there exists a <strong>unique</strong> group homomorphism <TeX src={String.raw`\varphi : F_S \to G`} /> with <TeX src={String.raw`\varphi \circ \iota = f`} />.
              Equivalently, <TeX src={String.raw`F_S`} /> is the left adjoint of the forgetful functor <TeX src={String.raw`\mathbf{Grp} \to \mathbf{Set}`} />.
            </>}
          />
          <p style={{ margin: '10px 0 4px' }}>
            <L
              zh={<>
                <strong>群呈示</strong> <TeX src={String.raw`\langle S \mid R \rangle`} />：给定生成集 <TeX src={String.raw`S`} /> 和关系子集 <TeX src={String.raw`R \subseteq F_S`} />（称为<em>定义关系子</em>），呈示给出的群为
                <TeXBlock src={String.raw`\langle S \mid R \rangle := F_S \big/ N, \quad N = \text{正规闭包}(R) \subseteq F_S.`} />
                注意必须商去 <TeX src={String.raw`R`} /> 的<strong>正规闭包</strong> <TeX src={String.raw`N = \langle \langle R \rangle \rangle`} />（即 <TeX src={String.raw`F_S`} /> 中包含 <TeX src={String.raw`R`} /> 的最小正规子群），而非仅仅 <TeX src={String.raw`\langle R \rangle`} />；否则商可能不是正规子群，从而商集不构成群。
              </>}
              en={<>
                A <strong>group presentation</strong> <TeX src={String.raw`\langle S \mid R \rangle`} />: given a generating set <TeX src={String.raw`S`} /> and a relator set <TeX src={String.raw`R \subseteq F_S`} />, the presented group is
                <TeXBlock src={String.raw`\langle S \mid R \rangle := F_S \big/ N, \quad N = \text{normal closure of } R \text{ in } F_S.`} />
                One must quotient by the <strong>normal closure</strong> <TeX src={String.raw`N = \langle\langle R \rangle\rangle`} /> (smallest normal subgroup of <TeX src={String.raw`F_S`} /> containing <TeX src={String.raw`R`} />), not merely <TeX src={String.raw`\langle R \rangle`} />; otherwise the quotient may not be a normal subgroup and the quotient set would not be a group.
              </>}
            />
          </p>
        </div>
      </div>

      {/* ── Theorems ─────────────────────────────────────────────────────────── */}

      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理（正规形式定理）" en="Theorem (Normal form / Church–Rosser)" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>
              <TeX src={String.raw`F_S`} /> 中每个元素有<strong>唯一</strong>的约简字表示。
              等价地，"删去相邻逆对"这一改写系统是<strong>汇合且终止</strong>的（Church–Rosser 性质）：无论以何种顺序删去相邻逆对，最终得到的约简字相同。
              因此，约简运算是良定义的，"拼接后约简"构成的乘法是结合的，<TeX src={String.raw`F_S`} /> 是一个群。
            </>}
            en={<>
              Every element of <TeX src={String.raw`F_S`} /> has a <strong>unique</strong> reduced word representative.
              Equivalently, the rewriting system &ldquo;delete an adjacent inverse pair&rdquo; is <strong>confluent and terminating</strong> (Church–Rosser): regardless of the order in which pairs are deleted, the result is the same reduced word.
              Hence reduction is well-defined, multiplication by &ldquo;concatenate-then-reduce&rdquo; is associative, and <TeX src={String.raw`F_S`} /> is a group.
            </>}
          />
        </div>
      </div>

      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理：F_n 非交换（n ≥ 2）且中心平凡" en="Theorem: F_n is non-abelian (n ≥ 2) with trivial centre" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>
              若 <TeX src={String.raw`|S| \geq 2`} />，则 <TeX src={String.raw`F_S`} /> 非交换，中心 <TeX src={String.raw`Z(F_S) = \{e\}`} />。
              取两个不同的生成元 <TeX src={String.raw`a, b \in S`} />，约简字 <TeX src={String.raw`ab`} /> 与 <TeX src={String.raw`ba`} /> 不同，故 <TeX src={String.raw`ab \neq ba`} />。
              例外：<TeX src={String.raw`F_1 \cong \mathbb{Z}`} /> 是交换群（无限循环群）。
            </>}
            en={<>
              If <TeX src={String.raw`|S| \geq 2`} />, then <TeX src={String.raw`F_S`} /> is non-abelian and its centre is <TeX src={String.raw`Z(F_S) = \{e\}`} />.
              For distinct generators <TeX src={String.raw`a, b \in S`} />, the reduced words <TeX src={String.raw`ab`} /> and <TeX src={String.raw`ba`} /> are distinct, so <TeX src={String.raw`ab \neq ba`} />.
              Exception: <TeX src={String.raw`F_1 \cong \mathbb{Z}`} /> is abelian (infinite cyclic).
            </>}
          />
        </div>
      </div>

      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理：F_n 的 Cayley 图是 2n-正则无限树" en="Theorem: Cayley graph of F_n is the infinite 2n-regular tree" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>
              取自由基 <TeX src={String.raw`S`} />（<TeX src={String.raw`|S|=n`} />），带对称生成集 <TeX src={String.raw`S \cup S^{-1}`} /> 的 Cayley 图
              <TeX src={String.raw`\mathrm{Cay}(F_S,\, S \cup S^{-1})`} /> 是无限 <TeX src={String.raw`2n`} />-正则<strong>树</strong>（无圈连通图）。
              这是因为 <TeX src={String.raw`F_S`} /> 没有非平凡关系：一条圈等价于一个约简的闭路，即一个非平凡关系；自由群没有这样的关系。
              对 <TeX src={String.raw`F_2`} />（<TeX src={String.raw`n=2`} />），Cayley 树是 4-正则树：每个顶点有 4 条边，分别指向 <TeX src={String.raw`a, a^{-1}, b, b^{-1}`} /> 方向。
            </>}
            en={<>
              With the free basis <TeX src={String.raw`S`} /> (<TeX src={String.raw`|S|=n`} />), the Cayley graph
              <TeX src={String.raw`\mathrm{Cay}(F_S,\, S \cup S^{-1})`} /> with the <em>symmetric</em> generating set is an infinite <TeX src={String.raw`2n`} />-regular <strong>tree</strong> (connected acyclic graph).
              This holds precisely because <TeX src={String.raw`F_S`} /> has no nontrivial relations: a cycle would be a nonempty reduced closed loop, i.e. a nontrivial relator, which the free group lacks.
              For <TeX src={String.raw`F_2`} /> (<TeX src={String.raw`n=2`} />), the Cayley tree is 4-regular: every vertex has 4 edges pointing in the directions <TeX src={String.raw`a, a^{-1}, b, b^{-1}`} />.
            </>}
          />
        </div>
      </div>

      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理（Nielsen–Schreier）" en="Theorem (Nielsen–Schreier)" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>
              自由群的每个子群也是自由群。若 <TeX src={String.raw`F`} /> 的秩为 <TeX src={String.raw`n`} />，子群 <TeX src={String.raw`H \leq F`} /> 的指数为有限的 <TeX src={String.raw`e`} />，则
              <TeX src={String.raw`H`} /> 是秩为 <TeX src={String.raw`1 + e(n-1)`} /> 的自由群（Schreier 指数公式）。
              例：<TeX src={String.raw`F_2`} /> 的指数为 2 的子群（如 <TeX src={String.raw`F_2`} /> 中所有偶字长元素构成的子群）是秩 <TeX src={String.raw`1+2(2-1)=3`} /> 的自由群。
              特别地，<TeX src={String.raw`F_2`} /> 的有限生成子群可以有任意大的秩，这是自由群复杂性的一个体现。
            </>}
            en={<>
              Every subgroup of a free group is itself free. If <TeX src={String.raw`F`} /> has rank <TeX src={String.raw`n`} /> and <TeX src={String.raw`H \leq F`} /> has finite index <TeX src={String.raw`e`} />, then <TeX src={String.raw`H`} /> is free of rank <TeX src={String.raw`1 + e(n-1)`} /> (Schreier index formula).
              Example: an index-2 subgroup of <TeX src={String.raw`F_2`} /> is free of rank <TeX src={String.raw`1+2(2-1)=3`} />.
              In particular, finitely generated subgroups of <TeX src={String.raw`F_2`} /> can have arbitrarily large rank — a reflection of the richness of free groups.
            </>}
          />
        </div>
      </div>

      {/* ── Sphere size formula ─────────────────────────────────────────────── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="树的计数：球与球面大小" en="Counting in the tree: ball and sphere sizes" />
      </h3>

      <p>
        <L
          zh={<>
            在 4-正则树（<TeX src={String.raw`F_2`} /> 的 Cayley 图）中，从根 <TeX src={String.raw`\varepsilon`} /> 出发：
            长度恰为 <TeX src={String.raw`L`} /> 的约简字有 <TeX src={String.raw`\sigma(L) = 4 \cdot 3^{L-1}`} /> 个（<TeX src={String.raw`L \geq 1`} />）——
            第一步有 4 种选择，此后每步排除回头方向（逆），剩 3 种。
            闭球大小为 <TeX src={String.raw`\beta(L) = 2 \cdot 3^L - 1`} />（等比数列求和）。
            这是<strong>指数增长</strong>，增长速率为 3——这正是自由群与幂零群的根本区别（见 §61 增长理论）。
          </>}
          en={<>
            In the 4-regular tree (Cayley graph of <TeX src={String.raw`F_2`} />), from the root <TeX src={String.raw`\varepsilon`} />:
            there are <TeX src={String.raw`\sigma(L) = 4 \cdot 3^{L-1}`} /> reduced words of length exactly <TeX src={String.raw`L`} /> (<TeX src={String.raw`L \geq 1`} />) — first step has 4 choices, each subsequent step excludes the backtracking direction, leaving 3.
            The closed ball has size <TeX src={String.raw`\beta(L) = 2 \cdot 3^L - 1`} /> (geometric series).
            This is <strong>exponential growth</strong> with rate 3 — the fundamental contrast with nilpotent groups (see §61).
          </>}
        />
      </p>
      <TeXBlock src={String.raw`\sigma_{F_2}(L) = 4 \cdot 3^{L-1}\;(L \geq 1),\qquad \beta_{F_2}(L) = 2 \cdot 3^L - 1.`} />

      {/* ── Cube connection ─────────────────────────────────────────────────── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="魔方 ⟨R,U⟩：树折叠的时机" en="Cube ⟨R,U⟩: when does the tree fold?" />
      </h3>

      <p>
        <L
          zh={<>
            魔方群的子群 <TeX src={String.raw`\langle R, U \rangle`} /> 由两个面转生成，阶为 <TeX src={String.raw`73{,}483{,}200 = 2^6 \cdot 3^8 \cdot 5^2 \cdot 7`} />。
            注意 <TeX src={String.raw`R^4 = U^4 = 1`} /> 是长度 4 的关系，因此 <TeX src={String.raw`\langle R, U \rangle`} /> <strong>不是自由群</strong>
            <TeX src={String.raw`F_2`} />。正确的"无额外关系"理想化模型是<strong>自由积</strong>
            <TeX src={String.raw`\mathbb{Z}/4 * \mathbb{Z}/4 = \langle a, b \mid a^4, b^4 \rangle`} />。
          </>}
          en={<>
            The Rubik&apos;s Cube subgroup <TeX src={String.raw`\langle R, U \rangle`} />, generated by two face turns, has order <TeX src={String.raw`73{,}483{,}200 = 2^6 \cdot 3^8 \cdot 5^2 \cdot 7`} />.
            Since <TeX src={String.raw`R^4 = U^4 = 1`} /> are length-4 relations, <TeX src={String.raw`\langle R, U \rangle`} /> is <strong>not</strong> the free group
            <TeX src={String.raw`F_2`} />. The correct idealized model — with no relations beyond the obvious — is the <strong>free product</strong>
            <TeX src={String.raw`\mathbb{Z}/4 * \mathbb{Z}/4 = \langle a, b \mid a^4, b^4 \rangle`} />.
          </>}
        />
      </p>

      <div className="gt-aside">
        <L
          zh={<>
            <strong>实验验证（BFS）</strong>。对两个群各做宽度优先搜索：在 <TeX src={String.raw`\langle R, U \rangle`} /> 中，状态是魔方角块/棱块元组；在 <TeX src={String.raw`\mathbb{Z}/4 * \mathbb{Z}/4`} /> 中，状态是音节正规形（syllable normal form）。
            对比半径 0–10 的球面大小，结果如下：
            <strong>两者在半径 0–9 完全一致，在半径 10 首次分离</strong>，亏量为 <TeX src={String.raw`11482 - 11448 = 34`} />。
            这意味着在 <TeX src={String.raw`\langle R, U \rangle`} /> 中，除了 <TeX src={String.raw`R^4 = U^4 = 1`} /> 之外的最短"额外关系"在字度量意义下出现于大约 10 步处。
            确切地说：<em>任意不超过 9 步的 R/U 转序列之间，没有除 <TeX src={String.raw`R^4 = U^4 = 1`} /> 所推导出以外的关系</em>。
          </>}
          en={<>
            <strong>Computational verification (BFS)</strong>. We ran two breadth-first searches: in <TeX src={String.raw`\langle R, U \rangle`} /> the states are cubie corner/edge tuples; in <TeX src={String.raw`\mathbb{Z}/4 * \mathbb{Z}/4`} /> the states are syllable normal forms. Comparing sphere sizes at radii 0–10:
            <strong>both agree exactly at radii 0–9 and first diverge at radius 10</strong>, with deficit <TeX src={String.raw`11482 - 11448 = 34`} />.
            This means the shortest &ldquo;extra&rdquo; relation in <TeX src={String.raw`\langle R,U \rangle`} /> beyond <TeX src={String.raw`R^4 = U^4 = 1`} /> appears around word-length 10.
            Precisely: <em>no relation among sequences of at most 9 R/U moves is forced beyond those implied by</em> <TeX src={String.raw`R^4 = U^4 = 1`} />.
          </>}
        />
      </div>

      <p>
        <L
          zh={<>
            素数 7 整除 <TeX src={String.raw`|\langle R, U \rangle|`} /> 也印证了著名结论：<TeX src={String.raw`\mathrm{ord}(RU) = 105 = 3 \cdot 5 \cdot 7`} />（可由角块/棱块模型直接计算验证）。
            这正是 7 整除群阶的必要性——由 Lagrange 定理，<TeX src={String.raw`\mathrm{ord}(g)`} /> 必须整除 <TeX src={String.raw`|G|`} />。
          </>}
          en={<>
            The prime 7 dividing <TeX src={String.raw`|\langle R, U \rangle|`} /> is required by the celebrated result <TeX src={String.raw`\mathrm{ord}(RU) = 105 = 3 \cdot 5 \cdot 7`} /> (verifiable by direct cubie-model computation). By Lagrange&apos;s theorem, <TeX src={String.raw`\mathrm{ord}(g)`} /> must divide <TeX src={String.raw`|G|`} />, so 7 must divide the group order.
          </>}
        />
      </p>

      {/* ── Interactive panels ────────────────────────────────────────────────── */}

      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="交互面板" en="Interactive panels" />
      </h3>

      <p style={{ color: 'var(--ink-dim)', fontSize: 13, marginBottom: 20 }}>
        <L
          zh="下方两个面板共用同一组字母按钮：在约简字构造器中输入字母，树漫步面板会实时追踪当前顶点在 Cayley 树上的位置。"
          en="The two panels below share a word: type letters in the word reducer and the tree walker traces the current vertex in real time."
        />
      </p>

      {/* Panel 1: Word Reducer */}
      <WordReducerWidget lang={lang} onWordChange={handleWordChange} />

      {/* Panel 2: Tree Walker */}
      <TreeWalkerWidget lang={lang} currentWord={currentWord} />

      {/* Panel 3: Sphere size comparison */}
      <SphereSizePanel lang={lang} />

      {/* ── References ───────────────────────────────────────────────────────── */}
      <div className="gt-refs" style={{ marginTop: 40 }}>
        <div className="gt-def-title" style={{ marginBottom: 10 }}>
          <L zh="参考文献" en="References" />
        </div>
        <ol style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--ink-dim)' }}>
          <li>
            D. S. Dummit &amp; R. M. Foote, <em>Abstract Algebra</em> (3rd ed.), §6.3 — free groups, presentations, normal closure.
          </li>
          <li>
            A. Hatcher, <em>Algebraic Topology</em>, §1.2 (free groups, van Kampen) &amp; §1.A (Nielsen–Schreier via covering spaces). Free online:{' '}
            <a href="https://pi.math.cornell.edu/~hatcher/AT/AT.pdf" target="_blank" rel="noopener noreferrer">
              pi.math.cornell.edu/~hatcher/AT/AT.pdf
            </a>
          </li>
          <li>
            J.-P. Serre, <em>Trees</em>, §I.3 (free groups act freely on trees; Cayley graph of <TeX src={String.raw`F_n`} /> is the 2n-regular tree) &amp; §I.5 (free products, Bass–Serre theory).
          </li>
          <li>
            Wikipedia, &ldquo;Free group&rdquo; (reduced words, universal property, Nielsen–Schreier) and &ldquo;Rubik&apos;s Cube group&rdquo; (<TeX src={String.raw`\langle R,U \rangle`} /> order, <TeX src={String.raw`\mathrm{ord}(RU)=105`} />):{' '}
            <a href="https://en.wikipedia.org/wiki/Free_group" target="_blank" rel="noopener noreferrer">
              en.wikipedia.org/wiki/Free_group
            </a>
          </li>
        </ol>
      </div>
    </GTSec>
  );
}
