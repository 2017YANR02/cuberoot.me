'use client';

import { useState, useMemo, useCallback } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';

// ── Group definitions ─────────────────────────────────────────────────────────

type GroupEl = { label: string };

interface SmallGroup {
  id: string;
  labelZh: string;
  labelEn: string;
  order: number;
  elements: GroupEl[];
  /** op(i,j) = index of E[i]*E[j] in the element list */
  op: (i: number, j: number) => number;
}

// C4 = Z/4Z under addition mod 4
const C4: SmallGroup = {
  id: 'C4',
  labelZh: 'C₄ (4阶循环群)',
  labelEn: 'C₄ (cyclic order 4)',
  order: 4,
  elements: [{ label: 'e' }, { label: 'g' }, { label: 'g²' }, { label: 'g³' }],
  op: (i, j) => (i + j) % 4,
};

// V4 = C2 x C2, elements (0,0),(0,1),(1,0),(1,1) bitwise XOR
const V4_LABELS = ['e', 'a', 'b', 'c'];
const V4: SmallGroup = {
  id: 'V4',
  labelZh: 'V₄ = C₂×C₂ (Klein四元群)',
  labelEn: 'V₄ = C₂×C₂ (Klein four-group)',
  order: 4,
  elements: V4_LABELS.map(l => ({ label: l })),
  op: (i, j) => i ^ j, // bitwise XOR on {0,1,2,3}
};

// S3: permutations of {1,2,3}
// Represent each element as a perm array [p(0),p(1),p(2)] on 0-based {0,1,2}
const S3_PERMS: number[][] = [
  [0, 1, 2], // e
  [0, 2, 1], // (23)
  [1, 0, 2], // (12)
  [2, 1, 0], // (13)
  [1, 2, 0], // (123)
  [2, 0, 1], // (132)
];
const S3_LABELS = ['e', '(23)', '(12)', '(13)', '(123)', '(132)'];
function s3Compose(a: number[], b: number[]): number[] {
  return a.map(x => b[x]);
}
function s3Idx(p: number[]): number {
  return S3_PERMS.findIndex(q => q[0] === p[0] && q[1] === p[1] && q[2] === p[2]);
}
const S3: SmallGroup = {
  id: 'S3',
  labelZh: 'S₃ (3阶对称群, 6阶)',
  labelEn: 'S₃ (symmetric group on 3, order 6)',
  order: 6,
  elements: S3_LABELS.map(l => ({ label: l })),
  op: (i, j) => s3Idx(s3Compose(S3_PERMS[i], S3_PERMS[j])),
};

// Q8: quaternion group {±1,±i,±j,±k}
// Encode: 0=1,1=-1,2=i,3=-i,4=j,5=-j,6=k,7=-k
const Q8_LABELS = ['1', '-1', 'i', '-i', 'j', '-j', 'k', '-k'];
// Multiplication table (hardcoded, verified)
// q8op[i][j] = index of E[i]*E[j]
const Q8_TABLE: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7], // 1 * ...
  [1, 0, 3, 2, 5, 4, 7, 6], // -1 * ...
  [2, 3, 1, 0, 6, 7, 5, 4], // i * ...
  [3, 2, 0, 1, 7, 6, 4, 5], // -i * ...
  [4, 5, 7, 6, 1, 0, 2, 3], // j * ...
  [5, 4, 6, 7, 0, 1, 3, 2], // -j * ...
  [6, 7, 4, 5, 3, 2, 1, 0], // k * ...
  [7, 6, 5, 4, 2, 3, 0, 1], // -k * ...
];
const Q8: SmallGroup = {
  id: 'Q8',
  labelZh: 'Q₈ (四元数群, 8阶)',
  labelEn: 'Q₈ (quaternion group, order 8)',
  order: 8,
  elements: Q8_LABELS.map(l => ({ label: l })),
  op: (i, j) => Q8_TABLE[i][j],
};

const GROUPS: SmallGroup[] = [C4, V4, S3, Q8];

// ── Math helpers ──────────────────────────────────────────────────────────────

/** Compute the element order of index g in the group */
function elementOrder(g: SmallGroup, idx: number): number {
  let cur = idx;
  for (let k = 1; k <= g.order; k++) {
    if (cur === 0) return k;
    cur = g.op(idx, cur);
  }
  return g.order;
}

/** Compute the permutation L_g: x -> g*x for each x in {0..n-1} */
function leftRegPerm(g: SmallGroup, gIdx: number): number[] {
  return Array.from({ length: g.order }, (_, x) => g.op(gIdx, x));
}

/** Decompose a permutation into cycles (0-based indices) */
function cycleDecomp(perm: number[]): number[][] {
  const seen = new Set<number>();
  const cycles: number[][] = [];
  for (let start = 0; start < perm.length; start++) {
    if (seen.has(start)) continue;
    const cycle: number[] = [];
    let cur = start;
    while (!seen.has(cur)) {
      seen.add(cur);
      cycle.push(cur);
      cur = perm[cur];
    }
    cycles.push(cycle);
  }
  return cycles;
}

/** Format cycle decomposition as cycle notation string */
function cycleNotation(perm: number[], elLabels: string[]): string {
  const cycles = cycleDecomp(perm);
  const parts = cycles
    .filter(c => c.length > 1)
    .map(c => '(' + c.map(i => elLabels[i]).join(' ') + ')');
  return parts.length === 0 ? 'id' : parts.join('');
}

function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

// Minimal faithful degree data (verified from spec)
const MINIMAL_DEGREE: Record<string, number> = {
  C4: 4,
  V4: 4,
  S3: 3,
  Q8: 8,
};

// Categorical colors
const CYCLE_COLORS = ['#8B2E3C', '#2A4D69', '#3F7050', '#B8860B', '#6B4E9C', '#C2410C', '#5C7CA0', '#9C4E6B'];

// ── Widget: Cayley Table + L_g permutation ────────────────────────────────────

function CayleyTableWidget({ group }: { group: SmallGroup }) {
  const lang = useLang();
  const [selected, setSelected] = useState<number | null>(null);
  const [showRight, setShowRight] = useState(false);

  const n = group.order;
  const opTable = useMemo(() => {
    const t: number[][] = [];
    for (let i = 0; i < n; i++) {
      t.push(Array.from({ length: n }, (_, j) => group.op(i, j)));
    }
    return t;
  }, [group, n]);

  const permData = useMemo(() => {
    if (selected === null) return null;
    const perm = showRight
      ? Array.from({ length: n }, (_, x) => group.op(x, selected)) // R_g(x)=x*g
      : leftRegPerm(group, selected); // L_g(x)=g*x
    const cycles = cycleDecomp(perm);
    const notation = cycleNotation(perm, group.elements.map(e => e.label));
    const ord = elementOrder(group, selected);
    return { perm, cycles, notation, ord };
  }, [selected, group, n, showRight]);

  // SVG layout
  const cellSz = n <= 4 ? 46 : 36;
  const headerSz = cellSz;
  const W = (n + 1) * cellSz;
  const H = (n + 1) * cellSz;

  const handleCellClick = useCallback((rowIdx: number) => {
    setSelected(prev => prev === rowIdx ? null : rowIdx);
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--ink-dim)', fontFamily: 'var(--sans)' }}>
          <L zh="点击行头或元素选择 g:" en="Click a row header or element to select g:" />
        </span>
        <button
          className={`gt-chip${!showRight ? ' gt-chip-active' : ''}`}
          onClick={() => setShowRight(false)}
        >
          <L zh="左乘 L_g(x)=g·x" en="Left mult L_g(x)=g·x" />
        </button>
        <button
          className={`gt-chip${showRight ? ' gt-chip-active' : ''}`}
          onClick={() => setShowRight(true)}
        >
          <L zh="右乘 R_g(x)=x·g" en="Right mult R_g(x)=x·g" />
        </button>
      </div>

      {/* Cayley table SVG */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ maxWidth: W, display: 'block', margin: '0 auto', cursor: 'pointer', overflow: 'visible' }}
        role="img"
        aria-label={lang === 'zh' ? `${group.labelZh} 的 Cayley 表` : `Cayley table of ${group.labelEn}`}
      >
        {/* Corner */}
        <rect x={0} y={0} width={headerSz} height={headerSz} fill="var(--bg-deep)" stroke="var(--rule)" strokeWidth={0.8} />
        <text x={headerSz / 2} y={headerSz / 2 + 1} textAnchor="middle" dominantBaseline="middle"
          fontSize={10} fill="var(--ink-faint)" style={{ fontFamily: 'var(--mono)' }}>·</text>

        {/* Column headers */}
        {Array.from({ length: n }, (_, j) => (
          <g key={`ch-${j}`}>
            <rect x={(j + 1) * cellSz} y={0} width={cellSz} height={headerSz}
              fill={selected === j ? 'color-mix(in srgb, var(--accent-2) 22%, var(--bg-elev))' : 'var(--bg-elev)'}
              stroke="var(--rule)" strokeWidth={0.8} />
            <text x={(j + 1) * cellSz + cellSz / 2} y={headerSz / 2 + 1}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={n > 6 ? 9 : 11}
              fill={selected === j ? 'var(--accent-2)' : 'var(--ink)'}
              style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>
              {group.elements[j].label}
            </text>
          </g>
        ))}

        {/* Row headers + cells */}
        {Array.from({ length: n }, (_, i) => {
          const isSelectedRow = selected === i;
          return (
            <g key={`row-${i}`} onClick={() => handleCellClick(i)} style={{ cursor: 'pointer' }}>
              {/* Row header */}
              <rect x={0} y={(i + 1) * cellSz} width={headerSz} height={cellSz}
                fill={isSelectedRow ? 'color-mix(in srgb, var(--accent) 22%, var(--bg-elev))' : 'var(--bg-elev)'}
                stroke="var(--rule)" strokeWidth={0.8} />
              <text x={headerSz / 2} y={(i + 1) * cellSz + cellSz / 2 + 1}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={n > 6 ? 9 : 11}
                fill={isSelectedRow ? 'var(--accent)' : 'var(--ink)'}
                style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>
                {group.elements[i].label}
              </text>

              {/* Data cells */}
              {Array.from({ length: n }, (_, j) => {
                const val = opTable[i][j];
                const isHighlighted = isSelectedRow;
                const isIdentity = val === 0;
                let fill = 'var(--bg)';
                if (isHighlighted) {
                  fill = 'color-mix(in srgb, var(--accent) 12%, var(--bg))';
                }
                if (permData && isHighlighted) {
                  // highlight cell if this is where j maps to under L_g
                  fill = 'color-mix(in srgb, var(--accent) 18%, var(--bg))';
                }
                const borderColor = isIdentity ? 'var(--green)' : 'var(--rule)';
                const textColor = isIdentity ? 'var(--green)' : isHighlighted ? 'var(--accent)' : 'var(--ink-dim)';
                return (
                  <g key={`cell-${i}-${j}`}>
                    <rect
                      x={(j + 1) * cellSz} y={(i + 1) * cellSz}
                      width={cellSz} height={cellSz}
                      fill={fill} stroke={borderColor}
                      strokeWidth={isIdentity ? 1.2 : 0.6}
                    />
                    <text
                      x={(j + 1) * cellSz + cellSz / 2}
                      y={(i + 1) * cellSz + cellSz / 2 + 1}
                      textAnchor="middle" dominantBaseline="middle"
                      fontSize={n > 6 ? 9 : 11}
                      fill={textColor}
                      style={{ fontFamily: 'var(--mono)' }}>
                      {group.elements[val].label}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* Permutation result panel */}
      <div style={{ marginTop: 16, minHeight: 72 }}>
        {permData && selected !== null ? (
          <div className="gt-panel-result">
            <div className="gt-result-row">
              <span className="gt-result-label">
                {showRight
                  ? <L zh={`R_${group.elements[selected].label}(x) = x·${group.elements[selected].label}`} en={`R_${group.elements[selected].label}(x) = x·${group.elements[selected].label}`} />
                  : <L zh={`L_${group.elements[selected].label}(x) = ${group.elements[selected].label}·x`} en={`L_${group.elements[selected].label}(x) = ${group.elements[selected].label}·x`} />
                }
              </span>
              <span className="gt-result-val-strong" style={{ fontFamily: 'var(--mono)', letterSpacing: 1 }}>
                {permData.notation}
              </span>
            </div>
            <div className="gt-result-row">
              <span className="gt-result-label"><L zh="元素的阶" en="element order" /></span>
              <span className="gt-result-val">ord({group.elements[selected].label}) = {permData.ord}</span>
            </div>
            <div className="gt-result-row">
              <span className="gt-result-label"><L zh="置换 (映射列)" en="permutation (image vector)" /></span>
              <span className="gt-result-val" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                [{permData.perm.map(k => group.elements[k].label).join(', ')}]
              </span>
            </div>
            {showRight && (
              <div className="gt-result-row">
                <span className="gt-result-label" style={{ color: 'var(--warn)' }}>
                  <L zh="注意" en="Note" />
                </span>
                <span className="gt-result-val" style={{ color: 'var(--warn)', fontSize: 12 }}>
                  <L
                    zh="右乘 R_g 是反同态 (R_g∘R_h=R_{hg}),不是 Cayley 嵌入所用的映射。"
                    en="Right mult R_g is an anti-homomorphism (R_g∘R_h=R_{hg}), not the Cayley embedding."
                  />
                </span>
              </div>
            )}
          </div>
        ) : (
          <p style={{ color: 'var(--ink-faint)', fontSize: 13, fontStyle: 'italic', margin: 0 }}>
            <L zh="点击某一行来选择群元素 g, 查看对应的置换 L_g。" en="Click a row to select a group element g and view its permutation L_g." />
          </p>
        )}
      </div>
    </div>
  );
}

// ── Widget: Cycle visualizer ──────────────────────────────────────────────────

function CycleVisualizer({ group }: { group: SmallGroup }) {
  const lang = useLang();
  const [gIdx, setGIdx] = useState(1);
  const [animStep, setAnimStep] = useState<number>(-1);

  const n = group.order;
  const perm = useMemo(() => leftRegPerm(group, gIdx), [group, gIdx]);
  const cycles = useMemo(() => cycleDecomp(perm), [perm]);
  const ord = useMemo(() => elementOrder(group, gIdx), [group, gIdx]);

  // Layout: arrange cycles side by side in SVG
  const SVG_H = 220;
  const SVG_W = 400;

  // Position each cycle as a regular polygon
  const cycleLayouts = useMemo(() => {
    const result: Array<{
      cycle: number[];
      cx: number;
      cy: number;
      r: number;
      colorIdx: number;
    }> = [];

    const nonTrivial = cycles.filter(c => c.length > 1);
    const trivial = cycles.filter(c => c.length === 1);

    const totalCycles = nonTrivial.length + (trivial.length > 0 ? 1 : 0);
    const colW = totalCycles === 0 ? SVG_W : SVG_W / Math.max(totalCycles, 1);
    const cy = SVG_H / 2;
    const r = Math.min(colW * 0.38, 70);

    nonTrivial.forEach((cycle, ci) => {
      result.push({
        cycle,
        cx: colW * (ci + 0.5),
        cy,
        r,
        colorIdx: ci % CYCLE_COLORS.length,
      });
    });

    // Group trivial cycles (fixed points) together in a row at top
    trivial.forEach((cycle, ti) => {
      result.push({
        cycle,
        cx: (SVG_W / (trivial.length + 1)) * (ti + 1),
        cy: 22,
        r: 12,
        colorIdx: CYCLE_COLORS.length - 1,
      });
    });

    return result;
  }, [cycles]);

  // Animation: highlight which node is "current" in walk
  const handleAnimate = useCallback(() => {
    setAnimStep(0);
    let step = 0;
    const totalSteps = n * 2;
    const iv = setInterval(() => {
      step++;
      setAnimStep(step % (n + 1));
      if (step >= totalSteps) {
        clearInterval(iv);
        setAnimStep(-1);
      }
    }, 380);
  }, [n]);

  function nodeAngle(posInCycle: number, cycleLen: number): number {
    return -Math.PI / 2 + (2 * Math.PI * posInCycle) / cycleLen;
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--ink-dim)' }}>
          <L zh="选择 g:" en="Select g:" />
        </span>
        {Array.from({ length: n }, (_, i) => (
          <button
            key={i}
            className={`gt-chip${gIdx === i ? ' gt-chip-active' : ''}`}
            onClick={() => { setGIdx(i); setAnimStep(-1); }}
          >
            {group.elements[i].label}
          </button>
        ))}
        <button className="gt-btn gt-btn-ghost" onClick={handleAnimate} style={{ marginLeft: 8 }}>
          <L zh="动画漫步" en="Animate walk" />
        </button>
      </div>

      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        width="100%"
        style={{ display: 'block', maxWidth: SVG_W }}
        role="img"
        aria-label={lang === 'zh'
          ? `L_${group.elements[gIdx].label} 的轮换图`
          : `Cycle diagram of L_${group.elements[gIdx].label}`}
      >
        <defs>
          {CYCLE_COLORS.map((c, ci) => (
            <marker
              key={ci}
              id={`arr-${ci}`}
              viewBox="0 0 6 6"
              refX="5"
              refY="3"
              markerWidth="5"
              markerHeight="5"
              orient="auto"
            >
              <polygon points="0 0 6 3 0 6" fill={c} />
            </marker>
          ))}
          <marker id="arr-id" viewBox="0 0 6 6" refX="5" refY="3"
            markerWidth="5" markerHeight="5" orient="auto">
            <polygon points="0 0 6 3 0 6" fill="var(--ink-faint)" />
          </marker>
        </defs>

        {cycleLayouts.map(({ cycle, cx, cy, r, colorIdx }) => {
          const color = CYCLE_COLORS[colorIdx];
          const isTrivial = cycle.length === 1;

          if (isTrivial) {
            // Fixed point: self-loop
            const el = cycle[0];
            const isActive = animStep >= 0 && animStep % n === el;
            return (
              <g key={`cyc-triv-${el}`}>
                <circle cx={cx} cy={cy} r={13}
                  fill={isActive ? 'color-mix(in srgb, var(--ink-faint) 15%, var(--bg-elev))' : 'var(--bg-elev)'}
                  stroke="var(--ink-faint)" strokeWidth={1.2} />
                <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
                  fontSize={9} fill="var(--ink-faint)" style={{ fontFamily: 'var(--mono)' }}>
                  {group.elements[el].label}
                </text>
                {/* Self-loop arc */}
                <path d={`M${cx + 8},${cy - 8} A 9 9 0 1 1 ${cx + 8},${cy + 8}`}
                  fill="none" stroke="var(--ink-faint)" strokeWidth={1}
                  markerEnd="url(#arr-id)" />
              </g>
            );
          }

          const L2 = cycle.length;
          const nodePositions = cycle.map((_, pos) => {
            const a = nodeAngle(pos, L2);
            return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
          });
          const NODE_R = Math.max(12, Math.min(18, r * 0.32));

          return (
            <g key={`cyc-${cycle[0]}`}>
              {/* Edges */}
              {cycle.map((el, pos) => {
                const from = nodePositions[pos];
                const to = nodePositions[(pos + 1) % L2];
                const dx = to.x - from.x;
                const dy = to.y - from.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                const ux = dx / len;
                const uy = dy / len;
                const sx = from.x + ux * NODE_R;
                const sy = from.y + uy * NODE_R;
                const ex = to.x - ux * (NODE_R + 3);
                const ey = to.y - uy * (NODE_R + 3);
                const isActive = animStep >= 0 && cycle[pos] === (animStep - 1 + n) % n;
                return (
                  <line key={`edge-${el}`}
                    x1={sx} y1={sy} x2={ex} y2={ey}
                    stroke={isActive ? 'var(--accent)' : color}
                    strokeWidth={isActive ? 2.5 : 1.5}
                    markerEnd={`url(#arr-${colorIdx})`}
                    strokeOpacity={isActive ? 1 : 0.7}
                  />
                );
              })}
              {/* Nodes */}
              {cycle.map((el, pos) => {
                const { x, y } = nodePositions[pos];
                const isActive = animStep >= 0 && el === animStep % n;
                return (
                  <g key={`node-${el}`}>
                    <circle cx={x} cy={y} r={NODE_R}
                      fill={isActive ? color : 'color-mix(in srgb,' + color + ' 16%, var(--bg-elev))'}
                      stroke={color}
                      strokeWidth={isActive ? 2.5 : 1.5} />
                    <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle"
                      fontSize={NODE_R > 14 ? 10 : 8}
                      fill={isActive ? 'white' : color}
                      style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>
                      {group.elements[el].label}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* If identity (no non-trivial cycles) — all self-loops already rendered */}
        {cycles.every(c => c.length === 1) && (
          <text x={SVG_W / 2} y={SVG_H - 12}
            textAnchor="middle" fontSize={12}
            fill="var(--green)" style={{ fontFamily: 'var(--mono)' }}>
            {lang === 'zh' ? '恒等元 — 每个元素均为不动点' : 'Identity — every element is a fixed point'}
          </text>
        )}
      </svg>

      <div className="gt-panel-result" style={{ marginTop: 12 }}>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="轮换分解" en="Cycle decomposition" />
          </span>
          <span className="gt-result-val-strong" style={{ fontFamily: 'var(--mono)' }}>
            {cycleNotation(perm, group.elements.map(e => e.label))}
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="ord(g)" en="ord(g)" />
          </span>
          <span className="gt-result-val">
            {ord}
            {gIdx !== 0 && (
              <span style={{ color: 'var(--ink-faint)', fontSize: 12, marginLeft: 8 }}>
                — {n}/{ord} <L zh="个长度为" en="cycles of length" /> {ord}
              </span>
            )}
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="正则性验证" en="Regularity check" />
          </span>
          <span className="gt-result-val" style={{ color: 'var(--green)', fontSize: 12 }}>
            {gIdx === 0
              ? (lang === 'zh' ? '恒等元 — n 个不动点 (唯一例外)' : 'Identity — n fixed points (only exception)')
              : (lang === 'zh'
                ? `无不动点 — 每个轮换长度均为 ${ord} ✓`
                : `Fixed-point-free — every cycle has length ${ord} ✓`)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Widget: Embedding-degree comparator ──────────────────────────────────────

const CUBE_ORDER_STR = '43,252,003,274,489,856,000';
const CUBE_ORDER_LOG = Math.log10(43252003274489856000);

function EmbeddingComparator({ group }: { group: SmallGroup }) {
  const lang = useLang();
  const [showCube, setShowCube] = useState(false);

  const n = group.order;
  const mu = MINIMAL_DEGREE[group.id] ?? n;
  const cayleyLog = Math.log10(n);
  const muLog = Math.log10(mu);
  const cubeNatLog = Math.log10(48);
  const index = factorial(n) / n; // (n-1)!

  const W = 360;
  const H = 130;
  const BAR_Y1 = 30;
  const BAR_Y2 = 75;
  const BAR_H = 28;
  const LABEL_X = 90;
  const BAR_START = LABEL_X + 10;
  const BAR_MAX = W - 20;
  const maxLog = showCube ? Math.max(CUBE_ORDER_LOG, 1) : Math.max(cayleyLog, 1);

  function barWidth(logVal: number): number {
    return Math.max(4, ((logVal) / maxLog) * (BAR_MAX - BAR_START));
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <button
          className={`gt-chip${!showCube ? ' gt-chip-active' : ''}`}
          onClick={() => setShowCube(false)}
        >
          <L zh="当前群" en="Current group" />
        </button>
        <button
          className={`gt-chip${showCube ? ' gt-chip-active' : ''}`}
          onClick={() => setShowCube(true)}
        >
          <L zh="魔方群" en="Rubik's cube group" />
        </button>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%"
        style={{ display: 'block', maxWidth: W }}
        role="img"
        aria-label={lang === 'zh' ? 'Cayley 嵌入度对比' : 'Embedding degree comparison'}>

        {showCube ? (
          <>
            {/* Cayley degree for cube */}
            <text x={LABEL_X - 4} y={BAR_Y1 + BAR_H / 2 + 1}
              textAnchor="end" dominantBaseline="middle" fontSize={10} fill="var(--ink-dim)"
              style={{ fontFamily: 'var(--mono)' }}>
              {lang === 'zh' ? 'Cayley 度' : 'Cayley deg'}
            </text>
            <rect x={BAR_START} y={BAR_Y1} width={barWidth(CUBE_ORDER_LOG)} height={BAR_H}
              fill="color-mix(in srgb, var(--accent) 40%, var(--bg-deep))" rx={3} />
            <text x={BAR_START + barWidth(CUBE_ORDER_LOG) + 4} y={BAR_Y1 + BAR_H / 2 + 1}
              dominantBaseline="middle" fontSize={9} fill="var(--accent)" style={{ fontFamily: 'var(--mono)' }}>
              |G| ≈ 4.3×10¹⁹
            </text>

            {/* Natural degree (48 facelets) */}
            <text x={LABEL_X - 4} y={BAR_Y2 + BAR_H / 2 + 1}
              textAnchor="end" dominantBaseline="middle" fontSize={10} fill="var(--ink-dim)"
              style={{ fontFamily: 'var(--mono)' }}>
              {lang === 'zh' ? '面块嵌入' : 'Facelet'}
            </text>
            <rect x={BAR_START} y={BAR_Y2} width={barWidth(cubeNatLog)} height={BAR_H}
              fill="color-mix(in srgb, var(--green) 45%, var(--bg-deep))" rx={3} />
            <text x={BAR_START + barWidth(cubeNatLog) + 4} y={BAR_Y2 + BAR_H / 2 + 1}
              dominantBaseline="middle" fontSize={9} fill="var(--green)" style={{ fontFamily: 'var(--mono)' }}>
              48 (S₄₈)
            </text>

            <text x={W / 2} y={H - 8} textAnchor="middle" fontSize={9} fill="var(--ink-faint)"
              style={{ fontFamily: 'var(--sans)', fontStyle: 'italic' }}>
              {lang === 'zh' ? '对数坐标轴' : 'Log scale'}
            </text>
          </>
        ) : (
          <>
            {/* Cayley degree */}
            <text x={LABEL_X - 4} y={BAR_Y1 + BAR_H / 2 + 1}
              textAnchor="end" dominantBaseline="middle" fontSize={10} fill="var(--ink-dim)"
              style={{ fontFamily: 'var(--mono)' }}>
              {lang === 'zh' ? 'Cayley 度 |G|' : 'Cayley deg |G|'}
            </text>
            <rect x={BAR_START} y={BAR_Y1} width={barWidth(cayleyLog)} height={BAR_H}
              fill="color-mix(in srgb, var(--accent) 40%, var(--bg-deep))" rx={3} />
            <text x={BAR_START + barWidth(cayleyLog) + 6} y={BAR_Y1 + BAR_H / 2 + 1}
              dominantBaseline="middle" fontSize={10} fill="var(--accent)" style={{ fontFamily: 'var(--mono)' }}>
              {n}
            </text>

            {/* Minimal degree */}
            <text x={LABEL_X - 4} y={BAR_Y2 + BAR_H / 2 + 1}
              textAnchor="end" dominantBaseline="middle" fontSize={10} fill="var(--ink-dim)"
              style={{ fontFamily: 'var(--mono)' }}>
              {lang === 'zh' ? '最小忠实度 μ' : 'Min faithful μ'}
            </text>
            <rect x={BAR_START} y={BAR_Y2} width={barWidth(muLog)} height={BAR_H}
              fill="color-mix(in srgb, var(--green) 45%, var(--bg-deep))" rx={3} />
            <text x={BAR_START + barWidth(muLog) + 6} y={BAR_Y2 + BAR_H / 2 + 1}
              dominantBaseline="middle" fontSize={10} fill="var(--green)" style={{ fontFamily: 'var(--mono)' }}>
              {mu}
            </text>

            <text x={W / 2} y={H - 8} textAnchor="middle" fontSize={9} fill="var(--ink-faint)"
              style={{ fontFamily: 'var(--sans)', fontStyle: 'italic' }}>
              {n === mu
                ? (lang === 'zh' ? `μ = |G| — Cayley 度已是最优` : `μ = |G| — Cayley degree is already optimal`)
                : (lang === 'zh' ? `μ = ${mu} < ${n} = |G| — Cayley 给出上界, 非最优` : `μ = ${mu} < ${n} = |G| — Cayley gives upper bound, not optimal`)}
            </text>
          </>
        )}
      </svg>

      <div className="gt-panel-result" style={{ marginTop: 10 }}>
        {showCube ? (
          <>
            <div className="gt-result-row">
              <span className="gt-result-label"><L zh="|G| (魔方群)" en="|G| (cube group)" /></span>
              <span className="gt-result-val-strong" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                {CUBE_ORDER_STR}
              </span>
            </div>
            <div className="gt-result-row">
              <span className="gt-result-label"><L zh="面块集合大小" en="Facelet set size" /></span>
              <span className="gt-result-val">
                48 = 54 − 6 <L zh=" (6 个中心不动)" en=" (6 centres fixed)" />
              </span>
            </div>
            <div className="gt-result-row">
              <span className="gt-result-label"><L zh="|G| 分解" en="|G| factored" /></span>
              <span className="gt-result-val" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                2²⁷ · 3¹⁴ · 5³ · 7² · 11
              </span>
            </div>
            <div className="gt-result-row">
              <span className="gt-result-label"><L zh="S₄₈ 中的指数" en="Index in S₄₈" /></span>
              <span className="gt-result-val" style={{ fontSize: 12 }}>
                48! / |G| ≈ 2.9×10⁴¹
                <span style={{ color: 'var(--ink-faint)', fontSize: 11, marginLeft: 6 }}>
                  <L zh="(G 是 S₄₈ 中极小的子群)" en="(G is a vanishingly small subgroup of S₄₈)" />
                </span>
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="gt-result-row">
              <span className="gt-result-label"><L zh="|G|" en="|G|" /></span>
              <span className="gt-result-val-strong">{n}</span>
            </div>
            <div className="gt-result-row">
              <span className="gt-result-label">
                <L zh={`|S_${n}| = ${n}!`} en={`|S_${n}| = ${n}!`} />
              </span>
              <span className="gt-result-val">{factorial(n).toLocaleString()}</span>
            </div>
            <div className="gt-result-row">
              <span className="gt-result-label">
                <L zh={`λ(G) 的指数 [S_${n} : λ(G)]`} en={`Index [S_${n} : λ(G)]`} />
              </span>
              <span className="gt-result-val">{index.toLocaleString()} = ({n}−1)!</span>
            </div>
            <div className="gt-result-row">
              <span className="gt-result-label">μ(G)</span>
              <span className="gt-result-val" style={{ color: mu < n ? 'var(--green)' : 'var(--ink-dim)' }}>
                {mu}
                {group.id === 'S3' && (
                  <span style={{ fontSize: 11, color: 'var(--ink-faint)', marginLeft: 6 }}>
                    <L zh="(S₃ 天然作用于 3 点)" en="(S₃ acts naturally on 3 points)" />
                  </span>
                )}
                {group.id === 'Q8' && (
                  <span style={{ fontSize: 11, color: 'var(--ink-faint)', marginLeft: 6 }}>
                    <L zh="(Q₈ 唯一的 2 阶子群迫使 μ=8)" en="(Q₈'s unique subgroup of order 2 forces μ=8)" />
                  </span>
                )}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function CayleyTheorem() {
  const [groupId, setGroupId] = useState<string>('C4');

  const group = useMemo(() => GROUPS.find(g => g.id === groupId) ?? C4, [groupId]);

  return (
    <GTSec id="cayley-theorem" className="gt-sec">
      <div className="gt-sec-num">§57</div>
      <h2 className="gt-sec-title">
        <L zh="Cayley 定理" en="Cayley's theorem" />
      </h2>

      <p className="gt-lede">
        <L
          zh={<>
            每个群, 无论多么抽象, 都隐藏着一张具体的置换表——这是 Cayley 定理的核心洞见: 群 <TeX src={String.raw`G`} /> 同构于某个对称群 <TeX src={String.raw`\mathrm{Sym}(G)`} /> 的子群, 嵌入由最自然的动作给出: <TeX src={String.raw`G`} /> 对自身的左乘作用 <TeX src={String.raw`L_g(x)=g \cdot x`} />。换句话说, 置换群不只是群论中的一个例子——它包含了群论的全部。
          </>}
          en={<>
            Every group, no matter how abstract, conceals a concrete table of permutations — this is the central insight of Cayley's theorem: the group <TeX src={String.raw`G`} /> is isomorphic to a subgroup of the symmetric group <TeX src={String.raw`\mathrm{Sym}(G)`} />, via the most natural action imaginable: <TeX src={String.raw`G`} /> acting on itself by left multiplication <TeX src={String.raw`L_g(x)=g\cdot x`} />. In other words, permutation groups are not merely one example of a group — they contain all of group theory.
          </>}
        />
      </p>

      {/* ── Definition boxes ── */}
      <div className="gt-def">
        <div className="gt-def-title">
          <L zh="定义" en="Definition" /> — <L zh="群作用与忠实作用" en="Group action & faithful action" />
        </div>
        <div className="gt-def-body">
          <p>
            <L
              zh={<>
                群 <TeX src={String.raw`G`} /> 在集合 <TeX src={String.raw`X`} /> 上的<strong>左作用</strong>是映射 <TeX src={String.raw`G \times X \to X,\; (g,x)\mapsto g\cdot x`} />, 满足: (1) <TeX src={String.raw`e\cdot x = x`} /> 对所有 <TeX src={String.raw`x\in X`} />; (2) <TeX src={String.raw`g\cdot(h\cdot x)=(gh)\cdot x`} /> 对所有 <TeX src={String.raw`g,h\in G,\, x\in X`} />。等价地, 这是一个同态 <TeX src={String.raw`\varphi\colon G\to\mathrm{Sym}(X)`} />, 其中 <TeX src={String.raw`\mathrm{Sym}(X)`} /> 是 <TeX src={String.raw`X`} /> 上所有双射在复合下构成的群。
              </>}
              en={<>
                A <strong>left action</strong> of a group <TeX src={String.raw`G`} /> on a set <TeX src={String.raw`X`} /> is a map <TeX src={String.raw`G \times X \to X,\; (g,x)\mapsto g\cdot x`} /> satisfying: (1) <TeX src={String.raw`e\cdot x = x`} /> for all <TeX src={String.raw`x\in X`} />; (2) <TeX src={String.raw`g\cdot(h\cdot x)=(gh)\cdot x`} /> for all <TeX src={String.raw`g,h\in G,\, x\in X`} />. Equivalently, a homomorphism <TeX src={String.raw`\varphi\colon G\to\mathrm{Sym}(X)`} /> where <TeX src={String.raw`\mathrm{Sym}(X)`} /> is the group of all bijections of <TeX src={String.raw`X`} /> under composition.
              </>}
            />
          </p>
          <p>
            <L
              zh={<>
                作用 <TeX src={String.raw`\varphi`} /> 是<strong>忠实的</strong>, 若 <TeX src={String.raw`\varphi`} /> 单射, 即 <TeX src={String.raw`\ker\varphi = \{e\}`} />——唯一在 <TeX src={String.raw`X`} /> 的每个点上都不动的元素是 <TeX src={String.raw`e`} />。忠实作用将 <TeX src={String.raw`G`} /> 具体化为 <TeX src={String.raw`\mathrm{Sym}(X)`} /> 的一个同构子群。
              </>}
              en={<>
                The action <TeX src={String.raw`\varphi`} /> is <strong>faithful</strong> if <TeX src={String.raw`\varphi`} /> is injective, i.e. <TeX src={String.raw`\ker\varphi = \{e\}`} /> — the only element fixing every point of <TeX src={String.raw`X`} /> is <TeX src={String.raw`e`} />. A faithful action realises <TeX src={String.raw`G`} /> as an isomorphic copy (subgroup) of <TeX src={String.raw`\mathrm{Sym}(X)`} />.
              </>}
            />
          </p>
        </div>
      </div>

      {/* ── Theorem box ── */}
      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理 (Cayley, 1854)" en="Theorem (Cayley, 1854)" />
        </div>
        <div className="gt-thm-body">
          <p>
            <L
              zh={<>
                每个群 <TeX src={String.raw`G`} /> 同构于其自身上对称群 <TeX src={String.raw`\mathrm{Sym}(G)`} /> 的一个子群。具体地, <strong>左正则表示</strong> <TeX src={String.raw`\lambda\colon G\to\mathrm{Sym}(G)`} />, <TeX src={String.raw`\lambda(g)=L_g`} />, 其中 <TeX src={String.raw`L_g(x)=g\cdot x`} />, 是一个单同态。因此 <TeX src={String.raw`G\cong\lambda(G)\leq\mathrm{Sym}(G)`} />。特别地, 每个 <TeX src={String.raw`n`} /> 阶有限群同构于 <TeX src={String.raw`S_n`} /> 的某个子群。
              </>}
              en={<>
                Every group <TeX src={String.raw`G`} /> is isomorphic to a subgroup of the symmetric group <TeX src={String.raw`\mathrm{Sym}(G)`} /> on its underlying set. Concretely, the <strong>left-regular representation</strong> <TeX src={String.raw`\lambda\colon G\to\mathrm{Sym}(G)`} />, <TeX src={String.raw`\lambda(g)=L_g`} /> with <TeX src={String.raw`L_g(x)=g\cdot x`} />, is an injective homomorphism. Hence <TeX src={String.raw`G\cong\lambda(G)\leq\mathrm{Sym}(G)`} />. In particular, every finite group of order <TeX src={String.raw`n`} /> is isomorphic to a subgroup of <TeX src={String.raw`S_n`} />.
              </>}
            />
          </p>
        </div>
      </div>

      <div className="gt-proof">
        <div className="gt-proof-title">
          <L zh="证明思路" en="Proof sketch" />
        </div>
        <p>
          <L
            zh={<>
              <strong>同态性:</strong> <TeX src={String.raw`(L_g\circ L_h)(x)=g\cdot(h\cdot x)=(gh)\cdot x = L_{gh}(x)`} />, 故 <TeX src={String.raw`\lambda(g)\lambda(h)=\lambda(gh)`} />。
              <strong>单射性 (忠实性):</strong> 若 <TeX src={String.raw`L_g=\mathrm{id}`} />, 则 <TeX src={String.raw`g=g\cdot e=L_g(e)=e`} />, 故 <TeX src={String.raw`\ker\lambda=\{e\}`} />。注意这里必须用<em>左</em>乘——右乘 <TeX src={String.raw`R_g(x)=x\cdot g`} /> 满足 <TeX src={String.raw`R_g\circ R_h=R_{hg}`} /> (顺序颠倒), 是<em>反同态</em>, 不是同态。
            </>}
            en={<>
              <strong>Homomorphism:</strong> <TeX src={String.raw`(L_g\circ L_h)(x)=g\cdot(h\cdot x)=(gh)\cdot x = L_{gh}(x)`} />, so <TeX src={String.raw`\lambda(g)\lambda(h)=\lambda(gh)`} />.
              <strong>Injectivity (faithfulness):</strong> If <TeX src={String.raw`L_g=\mathrm{id}`} /> then <TeX src={String.raw`g=g\cdot e=L_g(e)=e`} />, so <TeX src={String.raw`\ker\lambda=\{e\}`} />. Note that <em>left</em> multiplication is essential — right multiplication <TeX src={String.raw`R_g(x)=x\cdot g`} /> satisfies <TeX src={String.raw`R_g\circ R_h=R_{hg}`} /> (order reversed), making it an <em>anti-homomorphism</em>, not a homomorphism.
            </>}
          />
        </p>
        <div className="gt-proof-end" />
      </div>

      <p>
        <L
          zh={<>
            左正则作用还有一个特殊的结构性质——它是<strong>正则作用</strong>: 既传递 (对任意 <TeX src={String.raw`x,y\in G`} />, <TeX src={String.raw`L_{yx^{-1}}`} /> 将 <TeX src={String.raw`x`} /> 映到 <TeX src={String.raw`y`} />), 又是无不动点的 (<TeX src={String.raw`g\neq e`} /> 时 <TeX src={String.raw`g\cdot x\neq x`} />)。由此得到置换 <TeX src={String.raw`L_g`} /> 的精确轮换结构:
          </>}
          en={<>
            The left-regular action has an additional structural property — it is a <strong>regular action</strong>: both transitive (for any <TeX src={String.raw`x,y\in G`} />, <TeX src={String.raw`L_{yx^{-1}}`} /> sends <TeX src={String.raw`x`} /> to <TeX src={String.raw`y`} />) and free (for <TeX src={String.raw`g\neq e`} />, <TeX src={String.raw`g\cdot x\neq x`} />). This gives the exact cycle structure of <TeX src={String.raw`L_g`} />:
          </>}
        />
      </p>

      <div className="gt-thm">
        <div className="gt-thm-title">
          <L zh="定理 — 正则表示的轮换结构" en="Theorem — cycle structure of the regular representation" />
        </div>
        <div className="gt-thm-body">
          <L
            zh={<>
              设 <TeX src={String.raw`g\in G`} />, <TeX src={String.raw`\mathrm{ord}(g)=m`} />。则置换 <TeX src={String.raw`L_g`} /> 的轮换分解由恰好 <TeX src={String.raw`|G|/m`} /> 个长度均为 <TeX src={String.raw`m`} /> 的不相交轮换组成 (<TeX src={String.raw`g=e`} /> 时为 <TeX src={String.raw`|G|`} /> 个不动点)。特别地, <TeX src={String.raw`g\neq e`} /> 时 <TeX src={String.raw`L_g`} /> 无不动点。
            </>}
            en={<>
              Let <TeX src={String.raw`g\in G`} /> with <TeX src={String.raw`\mathrm{ord}(g)=m`} />. Then the permutation <TeX src={String.raw`L_g`} /> decomposes into exactly <TeX src={String.raw`|G|/m`} /> disjoint cycles each of length <TeX src={String.raw`m`} /> (for <TeX src={String.raw`g=e`} />: <TeX src={String.raw`|G|`} /> fixed points). In particular, <TeX src={String.raw`L_g`} /> is fixed-point-free for every <TeX src={String.raw`g\neq e`} />.
            </>}
          />
        </div>
      </div>

      <p>
        <L
          zh={<>
            例如在 <TeX src={String.raw`C_4=\{e,g,g^2,g^3\}`} /> 中: <TeX src={String.raw`e`} /> 的像是恒等置换; <TeX src={String.raw`g`} /> 和 <TeX src={String.raw`g^3`} /> 各给出一个 4-轮换 (因为 <TeX src={String.raw`\mathrm{ord}=4`} />); <TeX src={String.raw`g^2`} /> 给出两个 2-轮换 (因为 <TeX src={String.raw`\mathrm{ord}=2`} />, <TeX src={String.raw`4/2=2`} /> 个轮换)。在 <TeX src={String.raw`Q_8`} /> 中, <TeX src={String.raw`-1`} /> 的阶为 2, 所以 <TeX src={String.raw`L_{-1}`} /> 由 <TeX src={String.raw`8/2=4`} /> 个 2-轮换组成; <TeX src={String.raw`\pm i, \pm j, \pm k`} /> 的阶为 4, 各给出 <TeX src={String.raw`8/4=2`} /> 个 4-轮换。
          </>}
          en={<>
            For example in <TeX src={String.raw`C_4=\{e,g,g^2,g^3\}`} />: <TeX src={String.raw`e`} /> maps to the identity; <TeX src={String.raw`g`} /> and <TeX src={String.raw`g^3`} /> each give one 4-cycle (order 4); <TeX src={String.raw`g^2`} /> gives two 2-cycles (order 2, <TeX src={String.raw`4/2=2`} /> cycles). In <TeX src={String.raw`Q_8`} />, the element <TeX src={String.raw`-1`} /> has order 2, so <TeX src={String.raw`L_{-1}`} /> consists of <TeX src={String.raw`8/2=4`} /> two-cycles; each of <TeX src={String.raw`\pm i,\pm j,\pm k`} /> has order 4, giving <TeX src={String.raw`8/4=2`} /> four-cycles.
          </>}
        />
      </p>

      {/* Group selector shared across widgets */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '32px 0 0', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--serif)' }}>
          <L zh="选择群:" en="Choose group:" />
        </span>
        {GROUPS.map(g => (
          <button
            key={g.id}
            className={`gt-chip${groupId === g.id ? ' gt-chip-active' : ''}`}
            onClick={() => setGroupId(g.id)}
          >
            {g.id}
          </button>
        ))}
        <span style={{ fontSize: 12, color: 'var(--ink-faint)', fontFamily: 'var(--mono)', marginLeft: 4 }}>
          |G| = {group.order}, <L zh="嵌入到" en="embeds in" /> S<sub>{group.order}</sub>
        </span>
      </div>

      {/* ── WIDGET 1: Cayley table + left-regular permutation ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 28, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="Cayley 表与左正则置换" en="Cayley table and left-regular permutation" />
      </h3>

      <div className="gt-panel">
        <div className="gt-panel-title">
          <L zh="交互面板 1 — 乘法表与嵌入映射" en="Interactive panel 1 — multiplication table and embedding map" />
        </div>
        <div className="gt-panel-sub">
          <L
            zh={<>
              点击行头 (或任意行中的格) 选择群元素 <TeX src={String.raw`g`} />。高亮行即是置换 <TeX src={String.raw`L_g`} /> 的单行记法 (one-line notation): 第 <TeX src={String.raw`j`} /> 列显示 <TeX src={String.raw`L_g(E_j)=g\cdot E_j`} /> 的结果。切换到"右乘"可观察反同态, 对比左乘的同态性。
            </>}
            en={<>
              Click a row header (or any cell in the row) to select group element <TeX src={String.raw`g`} />. The highlighted row is the one-line notation of permutation <TeX src={String.raw`L_g`} />: column <TeX src={String.raw`j`} /> shows <TeX src={String.raw`L_g(E_j)=g\cdot E_j`} />. Switch to right multiplication to see the anti-homomorphism, contrasting with the homomorphism property of left mult.
            </>}
          />
        </div>
        <CayleyTableWidget group={group} />
      </div>

      {/* ── WIDGET 2: Cycle visualizer ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="轮换结构可视化" en="Cycle structure visualizer" />
      </h3>

      <div className="gt-panel">
        <div className="gt-panel-title">
          <L zh="交互面板 2 — 正则作用的轮换图" en="Interactive panel 2 — cycle diagram of the regular action" />
        </div>
        <div className="gt-panel-sub">
          <L
            zh={<>
              选择群元素 <TeX src={String.raw`g`} />, 观察置换 <TeX src={String.raw`L_g`} /> 如何将群元素组织成等长轮换。每个轮换环的长度等于 <TeX src={String.raw`\mathrm{ord}(g)`} />, 环数等于 <TeX src={String.raw`|G|/\mathrm{ord}(g)`} />。点击"动画漫步"可逐步追踪每条轮换。
            </>}
            en={<>
              Select group element <TeX src={String.raw`g`} /> to see how the permutation <TeX src={String.raw`L_g`} /> organises the group elements into equal-length cycles. Each cycle ring has length <TeX src={String.raw`\mathrm{ord}(g)`} /> and there are <TeX src={String.raw`|G|/\mathrm{ord}(g)`} /> rings. Click "Animate walk" to trace each cycle step by step.
            </>}
          />
        </div>
        <CycleVisualizer group={group} />
      </div>

      {/* ── WIDGET 3: Embedding degree comparator ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="嵌入度对比: Cayley 上界 vs 最小忠实度" en="Embedding degrees: Cayley upper bound vs minimal faithful degree" />
      </h3>

      <p>
        <L
          zh={<>
            Cayley 定理给出嵌入度的<em>上界</em> <TeX src={String.raw`\mu(G)\leq|G|`} />, 但并非最优。最小忠实置换度 <TeX src={String.raw`\mu(G)`} /> 是使 <TeX src={String.raw`G\hookrightarrow S_n`} /> 成立的最小 <TeX src={String.raw`n`} />。对 <TeX src={String.raw`S_3`} />: Cayley 给出度 6 (嵌入到 <TeX src={String.raw`S_6`} />), 但 <TeX src={String.raw`S_3`} /> 本身就是 <TeX src={String.raw`\{1,2,3\}`} /> 上的置换群, 给出 <TeX src={String.raw`\mu(S_3)=3`} />。对 <TeX src={String.raw`Q_8`} />: <TeX src={String.raw`\mu(Q_8)=8`} /> 与 <TeX src={String.raw`|Q_8|`} /> 相等, Cayley 度已最优——原因是 <TeX src={String.raw`Q_8`} /> 的唯一 2 阶子群 <TeX src={String.raw`\{1,-1\}`} /> 包含在每个非平凡子群中, 使任何更小集合上的忠实作用都不可能存在。
          </>}
          en={<>
            Cayley's theorem gives an <em>upper bound</em> <TeX src={String.raw`\mu(G)\leq|G|`} /> on the embedding degree, but not the optimal one. The minimal faithful permutation degree <TeX src={String.raw`\mu(G)`} /> is the smallest <TeX src={String.raw`n`} /> for which <TeX src={String.raw`G\hookrightarrow S_n`} />. For <TeX src={String.raw`S_3`} />: Cayley gives degree 6 (embedding in <TeX src={String.raw`S_6`} />), but <TeX src={String.raw`S_3`} /> itself is the permutation group of <TeX src={String.raw`\{1,2,3\}`} />, giving <TeX src={String.raw`\mu(S_3)=3`} />. For <TeX src={String.raw`Q_8`} />: <TeX src={String.raw`\mu(Q_8)=8`} /> matches <TeX src={String.raw`|Q_8|`} />, so Cayley's degree is already optimal — because the unique subgroup of order 2, <TeX src={String.raw`\{1,-1\}`} />, is contained in every non-trivial subgroup, making any faithful action on a smaller set impossible.
          </>}
        />
      </p>

      <div className="gt-panel">
        <div className="gt-panel-title">
          <L zh="交互面板 3 — 嵌入度对比图" en="Interactive panel 3 — embedding degree comparison" />
        </div>
        <div className="gt-panel-sub">
          <L
            zh="切换查看当前小群或魔方群的 Cayley 度与最小忠实度对比 (对数坐标)。"
            en="Toggle between the current small group and the Rubik's cube group to compare Cayley degree vs minimal faithful degree (log scale)."
          />
        </div>
        <EmbeddingComparator group={group} />
      </div>

      {/* ── Cube connection ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="魔方群与 S₄₈" en="The Rubik's cube group and S₄₈" />
      </h3>

      <p>
        <L
          zh={<>
            3×3×3 魔方有 54 个贴片, 其中 6 个中心贴片在任意面转操作下位置不变, 剩余 48 个<em>活动面块</em>构成一个被群作用的集合。将这 48 个面块编号为 <TeX src={String.raw`1,\ldots,48`} />, 六个面的四分之一转 <TeX src={String.raw`\{U,D,L,R,F,B\}`} /> 各诱导这 48 个面块上的一个置换, 由它们生成的子群即<strong>魔方群</strong> <TeX src={String.raw`G\leq S_{48}`} />, 阶为
          </>}
          en={<>
            A 3×3×3 Rubik's cube has 54 stickers, of which 6 centres do not change position under any face turn; the remaining 48 <em>movable facelets</em> form the set acted upon. Labelling these 48 facelets <TeX src={String.raw`1,\ldots,48`} />, the six face quarter-turns <TeX src={String.raw`\{U,D,L,R,F,B\}`} /> each induce a permutation of these 48 facelets, and the subgroup they generate is the <strong>cube group</strong> <TeX src={String.raw`G\leq S_{48}`} />, with order
          </>}
        />
      </p>
      <TeXBlock src={String.raw`|G| = 43{,}252{,}003{,}274{,}489{,}856{,}000 = 2^{27}\cdot 3^{14}\cdot 5^3\cdot 7^2\cdot 11.`} />

      <p>
        <L
          zh={<>
            这个作用是忠实的 (不同魔方状态对应不同置换), 所以魔方群具体地嵌入到 <TeX src={String.raw`S_{48}`} /> 中。这正是 Cayley 定理精神的完美体现——抽象群变成了具体的置换群。但要注意: 这个 <TeX src={String.raw`S_{48}`} /> 嵌入<em>不是</em> Cayley 的左正则表示。左正则表示要求群作用在其<em>自身</em>上 (集合大小 = <TeX src={String.raw`|G|\approx 4.3\times10^{19}`} />, 嵌入到 <TeX src={String.raw`S_{4.3\times10^{19}}`} />); 而魔方通过<em>几何</em>给出了一个更小的忠实作用 (度 48)。两者都证明同一个结论——群可以具体化为置换群——但作用方式截然不同。
          </>}
          en={<>
            This action is faithful (distinct cube states correspond to distinct permutations), so the cube group embeds concretely into <TeX src={String.raw`S_{48}`} />. This is a perfect illustration of the spirit of Cayley's theorem — an abstract group made concrete as a permutation group. However, note carefully: this <TeX src={String.raw`S_{48}`} /> embedding is <em>not</em> Cayley's left-regular representation. The left-regular representation acts on <em>itself</em> (set of size <TeX src={String.raw`|G|\approx 4.3\times10^{19}`} />, landing in <TeX src={String.raw`S_{4.3\times10^{19}}`} />); geometry hands us a far smaller faithful action of degree 48. Both prove the same conclusion — the group is concretely a permutation group — via completely different actions.
          </>}
        />
      </p>

      <div className="gt-aside">
        <L
          zh={<>
            <strong>常见误区清单:</strong>
            (1) 右乘 <TeX src={String.raw`R_g(x)=x\cdot g`} /> <em>不是</em>同态 (它是反同态); Cayley 嵌入必须用左乘。
            (2) Cayley 定理是 <TeX src={String.raw`G\cong`} /> <em>S_n 的某个子群</em>, 而非 <TeX src={String.raw`G\cong S_n`} />; 对 <TeX src={String.raw`n\geq 3`} /> 的非平凡群 <TeX src={String.raw`\lambda(G)`} /> 是 <TeX src={String.raw`S_n`} /> 的指数 <TeX src={String.raw`(n-1)!`} /> 的真子群。
            (3) Cayley 度 <TeX src={String.raw`n`} /> 是上界, 通常远非最优: 对 <TeX src={String.raw`S_3`} /> 有 <TeX src={String.raw`\mu(S_3)=3\ll 6`} />。
            (4) 魔方的 <TeX src={String.raw`S_{48}`} /> 嵌入是几何作用, 不是左正则表示。
            (5) 对无限群 Cayley 定理同样成立 (只有"子群在 <TeX src={String.raw`S_n`} /> 中"这个推论需要有限性)。
          </>}
          en={<>
            <strong>Common pitfalls:</strong>
            (1) Right multiplication <TeX src={String.raw`R_g(x)=x\cdot g`} /> is <em>not</em> a homomorphism (it is an anti-homomorphism); the Cayley embedding must use left multiplication.
            (2) Cayley's theorem says <TeX src={String.raw`G\cong`} /> <em>a subgroup of</em> <TeX src={String.raw`S_n`} />, not <TeX src={String.raw`G\cong S_n`} />; for non-trivial groups of order <TeX src={String.raw`n\geq 3`} />, <TeX src={String.raw`\lambda(G)`} /> is a proper subgroup of <TeX src={String.raw`S_n`} /> with index <TeX src={String.raw`(n-1)!`} />.
            (3) The Cayley degree <TeX src={String.raw`n`} /> is an upper bound, generally far from optimal: for <TeX src={String.raw`S_3`} />, <TeX src={String.raw`\mu(S_3)=3\ll 6`} />.
            (4) The cube's <TeX src={String.raw`S_{48}`} /> embedding is a geometric action, not the left-regular representation.
            (5) Cayley's theorem holds for infinite <TeX src={String.raw`G`} /> as well (only the "<TeX src={String.raw`S_n`} />" corollary requires finiteness).
          </>}
        />
      </div>

      <div className="gt-refs" style={{ marginTop: 40 }}>
        <ol>
          <li>Dummit &amp; Foote, <em>Abstract Algebra</em>, 3rd ed., §4.2 — Cayley's theorem, left-regular representation, action on cosets.</li>
          <li>Cayley's theorem — <em>Wikipedia</em>: injective homomorphism, infinite case, historical attribution (Cayley 1854; Jordan; Burnside).</li>
          <li>Rubik's Cube group — <em>Wikipedia</em>: subgroup of <TeX src={String.raw`S_{48}`} />, order <TeX src={String.raw`2^{27}\cdot 3^{14}\cdot 5^3\cdot 7^2\cdot 11`} />.</li>
          <li>J. J. Rotman, <em>An Introduction to the Theory of Groups</em>, 4th ed., §3 — regular representation, free/regular actions, cycle structure of <TeX src={String.raw`L_g`} />.</li>
        </ol>
      </div>
    </GTSec>
  );
}
