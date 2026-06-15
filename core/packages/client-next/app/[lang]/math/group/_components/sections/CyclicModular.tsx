'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { orderOf } from '../cube_state';
import { tr } from '@/i18n/tr';

// ── Math helpers ─────────────────────────────────────────────────────────────

function gcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a;
}

function phi(n: number): number {
  if (n === 1) return 1;
  let result = n;
  let m = n;
  for (let p = 2; p * p <= m; p++) {
    if (m % p === 0) {
      while (m % p === 0) m = Math.floor(m / p);
      result -= Math.floor(result / p);
    }
  }
  if (m > 1) result -= Math.floor(result / m);
  return result;
}

function divisors(n: number): number[] {
  const divs: number[] = [];
  for (let d = 1; d * d <= n; d++) {
    if (n % d === 0) {
      divs.push(d);
      if (d !== n / d) divs.push(n / d);
    }
  }
  return divs.sort((a, b) => a - b);
}

function orbit(n: number, k: number): number[] {
  const result: number[] = [];
  let cur = 0;
  do {
    result.push(cur);
    cur = (cur + k) % n;
  } while (cur !== 0);
  return result;
}

/** Order of a in (Z/nZ)^x under multiplication. Returns 0 if a is not a unit. */
function multOrder(a: number, n: number): number {
  if (gcd(a, n) !== 1) return 0;
  let x = 1;
  for (let m = 1; m <= n; m++) {
    x = (x * a) % n;
    if (x === 1) return m;
  }
  return 0; // unreachable for valid units
}

function units(n: number): number[] {
  const result: number[] = [];
  for (let a = 1; a < n; a++) {
    if (gcd(a, n) === 1) result.push(a);
  }
  return result;
}

function primitiveRoots(n: number): number[] {
  const ph = phi(n);
  return units(n).filter(a => multOrder(a, n) === ph);
}

// Is (Z/nZ)^x cyclic? = primitive root exists
function hasePrimitiveRoot(n: number): boolean {
  if (n === 1 || n === 2 || n === 4) return true;
  // Check n = p^k or 2p^k for odd prime p
  let m = n;
  if (m % 2 === 0) m = m / 2;
  if (m % 2 === 0) return false; // divisible by 4 and m/2 is even means >=8
  // m must be a prime power
  for (let p = 3; p * p <= m; p += 2) {
    if (m % p === 0) {
      while (m % p === 0) m = Math.floor(m / p);
      if (m > 1) return false; // two distinct odd prime factors
      return true;
    }
  }
  return true; // m is 1 or an odd prime
}

// Count of prime factors with multiplicity (big omega)
function bigOmega(n: number): number {
  let count = 0;
  for (let p = 2; p * p <= n; p++) {
    while (n % p === 0) { n = Math.floor(n / p); count++; }
  }
  if (n > 1) count++;
  return count;
}

// Preset cube move orders (precomputed; verified by cube_state.orderOf)
const MOVE_PRESETS: { label: string; alg: string; order: number }[] = [
  { label: 'U', alg: 'U', order: 4 },
  { label: "U'", alg: "U'", order: 4 },
  { label: 'U2', alg: 'U2', order: 2 },
  { label: 'R U', alg: 'R U', order: 105 },
  { label: "R U R' U'", alg: "R U R' U'", order: 6 },
  { label: 'R2 U', alg: 'R2 U', order: 30 },
];

// ── Widget 1: Modular Clock ──────────────────────────────────────────────────

function ModularClock({ n, step, animStep, lang }: { n: number; step: number; animStep: number; lang: 'zh' | 'en' }) {
  const CX = 140, CY = 140, R = 110, NODE_R = 13;
  const orb = useMemo(() => orbit(n, step), [n, step]);
  const orbitSet = useMemo(() => new Set(orb), [orb]);
  const g = gcd(step, n);
  const subgroupSize = step === 0 ? 1 : n / g;
  const isGenerator = step !== 0 && g === 1;
  const phiN = phi(n);
  const generators = useMemo(() => {
    const gens: number[] = [];
    for (let k = 1; k < n; k++) if (gcd(k, n) === 1) gens.push(k);
    return gens;
  }, [n]);

  // Current visited positions up to animStep
  const visitedUpTo = useMemo(() => {
    if (step === 0) return new Set([0]);
    const visited = new Set<number>();
    for (let i = 0; i <= animStep; i++) visited.add((i * step) % n);
    return visited;
  }, [n, step, animStep]);

  const currentPos = step === 0 ? 0 : (animStep * step) % n;

  function nodeAngle(j: number) {
    return -Math.PI / 2 + (2 * Math.PI * j) / n;
  }
  function nodeXY(j: number) {
    const a = nodeAngle(j);
    return { x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) };
  }

  // Build the chord polyline for visited nodes in order
  const chordPoints = useMemo(() => {
    if (step === 0) return '';
    const pts: string[] = [];
    for (let i = 0; i <= animStep; i++) {
      const pos = (i * step) % n;
      const { x, y } = nodeXY(pos);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(' ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, step, animStep]);

  return (
    <svg viewBox={`0 0 280 280`} width="100%" style={{ maxWidth: 320, display: 'block', margin: '0 auto' }}>
      {/* Rim */}
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--rule)" strokeWidth={1.5} />
      {/* Chord path */}
      {chordPoints && (
        <polyline points={chordPoints} fill="none" stroke="var(--accent)" strokeWidth={2} strokeOpacity={0.55} strokeLinecap="round" strokeLinejoin="round" />
      )}
      {/* Nodes */}
      {Array.from({ length: n }, (_, j) => {
        const { x, y } = nodeXY(j);
        const inOrbit = orbitSet.has(j);
        const isVisited = visitedUpTo.has(j);
        const isCurrent = j === currentPos;
        const isGen = generators.includes(j) && j !== 0;
        let fill = 'var(--bg-elev)';
        let stroke = 'var(--rule)';
        if (isCurrent) { fill = 'var(--accent)'; stroke = 'var(--accent)'; }
        else if (isVisited) { fill = 'color-mix(in srgb, var(--accent) 22%, var(--bg-elev))'; stroke = 'var(--accent)'; }
        else if (inOrbit && !isVisited) { fill = 'var(--bg-elev)'; stroke = 'color-mix(in srgb, var(--accent) 45%, var(--rule))'; }
        else if (isGen) { stroke = 'var(--accent-2)'; }
        const textFill = isCurrent ? 'white' : (isVisited || inOrbit) ? 'var(--accent)' : 'var(--ink-dim)';
        const textSize = n > 24 ? 7 : n > 16 ? 8 : 9;
        return (
          <g key={j}>
            <circle cx={x} cy={y} r={NODE_R} fill={fill} stroke={stroke} strokeWidth={isCurrent ? 2.5 : 1.5} />
            <text x={x} y={y + 0.5} textAnchor="middle" dominantBaseline="middle" fontSize={textSize} fill={textFill} style={{ fontFamily: 'var(--mono)', fontWeight: isCurrent ? 700 : 400 }}>{j}</text>
          </g>
        );
      })}
      {/* Center label */}
      <text x={CX} y={CY - 10} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="var(--ink-faint)" style={{ fontFamily: 'var(--mono)' }}>
        {`ℤ/${n}ℤ`}
      </text>
      <text x={CX} y={CY + 8} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="var(--ink-faint)" style={{ fontFamily: 'var(--mono)' }}>
        {step === 0 ? (isGenerator ? '' : `{0}`) : `+${step} mod ${n}`}
      </text>
      {/* φ(n) label */}
      <text x={CX} y={CY + 24} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="var(--accent-2)" style={{ fontFamily: 'var(--mono)' }}>
        {`φ(${n})=${phiN}`}
      </text>
      {/* subgroup size at bottom */}
      <text x={CX} y={270} textAnchor="middle" fontSize={10} fill={isGenerator ? 'var(--green)' : 'var(--ink-dim)'} style={{ fontFamily: 'var(--mono)' }}>
        {step === 0
          ? tr({ zh: `⟨0⟩ = {0}, 阶 1`, en: `⟨0⟩ = {0}, order 1`
                          })
          : isGenerator
            ? (lang === 'zh' ? `⟨${step}⟩ = ℤ/${n}ℤ (生成元)` : `⟨${step}⟩ = ℤ/${n}ℤ (generator)`)
            : `|⟨${step}⟩| = ${n}/${g} = ${subgroupSize}`}
      </text>
    </svg>
  );
}

// ── Widget 2: Multiplication table ──────────────────────────────────────────

function MulTable({ n, selectedUnit }: { n: number; selectedUnit: number | null }) {
  // Only render for small n to avoid perf issues
  const MAX_N = 16;
  const displayN = Math.min(n, MAX_N);
  const unitSet = useMemo(() => new Set(units(displayN)), [displayN]);

  const selectedOrbit = useMemo(() => {
    if (selectedUnit === null || !unitSet.has(selectedUnit)) return new Set<number>();
    const orbit = new Set<number>();
    let x = 1;
    for (let i = 1; i <= displayN; i++) {
      x = (x * selectedUnit) % displayN;
      orbit.add(x);
      if (x === 1) break;
    }
    return orbit;
  }, [selectedUnit, displayN, unitSet]);

  const cellSize = Math.max(22, Math.min(34, Math.floor(280 / (displayN + 1))));
  const w = cellSize * (displayN + 1);
  const h = cellSize * (displayN + 1);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: w, display: 'block', margin: '0 auto', overflow: 'visible' }}>
      {/* Row/col headers */}
      {Array.from({ length: displayN }, (_, i) => {
        const a = i + 1;
        const isUnit = unitSet.has(a);
        const isSelected = a === selectedUnit;
        return (
          <g key={`hdr-${a}`}>
            {/* Column header */}
            <rect x={(a) * cellSize} y={0} width={cellSize} height={cellSize}
              fill={isSelected ? 'color-mix(in srgb, var(--accent) 30%, var(--bg-elev))' : isUnit ? 'color-mix(in srgb, var(--accent) 10%, var(--bg-elev))' : 'var(--bg-elev)'}
              stroke="var(--rule)" strokeWidth={0.5} />
            <text x={(a) * cellSize + cellSize / 2} y={cellSize / 2 + 1} textAnchor="middle" dominantBaseline="middle"
              fontSize={cellSize > 28 ? 10 : 8}
              fill={isUnit ? 'var(--accent)' : 'var(--ink-dim)'}
              style={{ fontFamily: 'var(--mono)', fontWeight: isUnit ? 600 : 400 }}>{a}</text>
            {/* Row header */}
            <rect x={0} y={(a) * cellSize} width={cellSize} height={cellSize}
              fill={isSelected ? 'color-mix(in srgb, var(--accent) 30%, var(--bg-elev))' : isUnit ? 'color-mix(in srgb, var(--accent) 10%, var(--bg-elev))' : 'var(--bg-elev)'}
              stroke="var(--rule)" strokeWidth={0.5} />
            <text x={cellSize / 2} y={(a) * cellSize + cellSize / 2 + 1} textAnchor="middle" dominantBaseline="middle"
              fontSize={cellSize > 28 ? 10 : 8}
              fill={isUnit ? 'var(--accent)' : 'var(--ink-dim)'}
              style={{ fontFamily: 'var(--mono)', fontWeight: isUnit ? 600 : 400 }}>{a}</text>
          </g>
        );
      })}
      {/* Table header corner */}
      <rect x={0} y={0} width={cellSize} height={cellSize} fill="var(--bg-deep)" stroke="var(--rule)" strokeWidth={0.5} />
      <text x={cellSize / 2} y={cellSize / 2 + 1} textAnchor="middle" dominantBaseline="middle"
        fontSize={8} fill="var(--ink-faint)" style={{ fontFamily: 'var(--mono)' }}>×</text>
      {/* Cells */}
      {Array.from({ length: displayN }, (_, ri) => {
        const row = ri + 1;
        return Array.from({ length: displayN }, (_, ci) => {
          const col = ci + 1;
          const product = (row * col) % displayN;
          const isOne = product === 1;
          const inSelOrbit = selectedOrbit.has(row === selectedUnit ? product : (col === selectedUnit ? product : -1));
          const bothUnits = unitSet.has(row) && unitSet.has(col);
          let fill = 'var(--bg)';
          if (selectedUnit !== null && (row === selectedUnit || col === selectedUnit) && selectedOrbit.has(product)) {
            fill = 'color-mix(in srgb, var(--gold) 20%, var(--bg))';
          } else if (isOne && bothUnits) {
            fill = 'color-mix(in srgb, var(--green) 14%, var(--bg))';
          } else if (bothUnits) {
            fill = 'color-mix(in srgb, var(--accent) 5%, var(--bg))';
          }
          const stroke = isOne && bothUnits ? 'var(--green)' : inSelOrbit ? 'var(--gold)' : 'var(--rule)';
          const textFill = isOne && bothUnits ? 'var(--green)' : bothUnits ? 'var(--ink)' : 'var(--ink-faint)';
          return (
            <g key={`cell-${row}-${col}`}>
              <rect x={col * cellSize} y={row * cellSize} width={cellSize} height={cellSize}
                fill={fill} stroke={stroke} strokeWidth={isOne && bothUnits ? 1 : 0.5} />
              <text x={col * cellSize + cellSize / 2} y={row * cellSize + cellSize / 2 + 1}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={cellSize > 28 ? 10 : 8}
                fill={textFill}
                style={{ fontFamily: 'var(--mono)' }}>{product}</text>
            </g>
          );
        });
      })}
    </svg>
  );
}

// ── Hasse diagram of subgroup lattice ───────────────────────────────────────

function HasseSubgroups({ n, highlightD }: { n: number; highlightD: number | null }) {
  const divs = useMemo(() => divisors(n), [n]);
  // Level = bigOmega(d)
  const maxLevel = useMemo(() => Math.max(...divs.map(bigOmega)), [divs]);
  // Group divisors by level
  const byLevel = useMemo(() => {
    const map: Map<number, number[]> = new Map();
    for (const d of divs) {
      const lv = bigOmega(d);
      if (!map.has(lv)) map.set(lv, []);
      map.get(lv)!.push(d);
    }
    return map;
  }, [divs]);

  const W = 320, H = Math.max(180, (maxLevel + 1) * 60 + 40);
  // Position each node
  const nodePos = useMemo(() => {
    const pos: Map<number, { x: number; y: number }> = new Map();
    for (const [lv, ds] of byLevel) {
      const y = H - 30 - lv * ((H - 60) / Math.max(maxLevel, 1));
      ds.forEach((d, i) => {
        const x = W / 2 + (i - (ds.length - 1) / 2) * (W / (ds.length + 1));
        pos.set(d, { x, y });
      });
    }
    return pos;
  }, [byLevel, W, H, maxLevel]);

  // Edges: d1 -> d2 if d2/d1 is prime and d1 | d2
  const edges = useMemo(() => {
    const result: { a: number; b: number }[] = [];
    for (const d1 of divs) {
      for (const d2 of divs) {
        if (d2 > d1 && d2 % d1 === 0) {
          const ratio = d2 / d1;
          // ratio is prime iff it's not divisible by any smaller factor
          let isPrime = ratio >= 2;
          for (let p = 2; p * p <= ratio; p++) {
            if (ratio % p === 0) { isPrime = false; break; }
          }
          if (isPrime) result.push({ a: d1, b: d2 });
        }
      }
    }
    return result;
  }, [divs]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
      {edges.map(({ a, b }) => {
        const pa = nodePos.get(a)!;
        const pb = nodePos.get(b)!;
        if (!pa || !pb) return null;
        const highlighted = highlightD === a || highlightD === b;
        return (
          <line key={`e-${a}-${b}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
            stroke={highlighted ? 'var(--accent)' : 'var(--rule)'} strokeWidth={highlighted ? 2 : 1.2} />
        );
      })}
      {divs.map(d => {
        const p = nodePos.get(d);
        if (!p) return null;
        const isHighlighted = highlightD === d;
        const generator = d === 1 ? 0 : n / d; // generator of subgroup of order d
        return (
          <g key={`node-${d}`}>
            <circle cx={p.x} cy={p.y} r={20}
              fill={isHighlighted ? 'color-mix(in srgb, var(--accent) 18%, var(--bg-elev))' : 'var(--bg-elev)'}
              stroke={isHighlighted ? 'var(--accent)' : 'var(--rule)'}
              strokeWidth={isHighlighted ? 2.5 : 1.5} />
            <text x={p.x} y={p.y - 4} textAnchor="middle" dominantBaseline="middle"
              fontSize={11} fill={isHighlighted ? 'var(--accent)' : 'var(--ink)'}
              style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>|·|={d}</text>
            <text x={p.x} y={p.y + 8} textAnchor="middle" dominantBaseline="middle"
              fontSize={9} fill={isHighlighted ? 'var(--accent)' : 'var(--ink-faint)'}
              style={{ fontFamily: 'var(--mono)' }}>⟨{generator}⟩</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function CyclicModular() {
  const lang = useLang();

  // Widget 1 state
  const [clockN, setClockN] = useState(12);
  const [clockStep, setClockStep] = useState(5);
  const [animStep, setAnimStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const orb = useMemo(() => orbit(clockN, clockStep), [clockN, clockStep]);
  const g_gcd = clockStep === 0 ? clockN : gcd(clockStep, clockN);
  const subgroupSize = clockStep === 0 ? 1 : clockN / g_gcd;
  const isGenerator = clockStep !== 0 && g_gcd === 1;
  const phiClockN = phi(clockN);
  const allGens = useMemo(() => Array.from({ length: clockN - 1 }, (_, i) => i + 1).filter(k => gcd(k, clockN) === 1), [clockN]);

  // Divisor lattice state
  const [latticeN, setLatticeN] = useState(12);
  const [highlightD, setHighlightD] = useState<number | null>(null);

  // Widget 2 state
  const [mulN, setMulN] = useState(9);
  const [selectedUnit, setSelectedUnit] = useState<number | null>(null);
  const mulUnits = useMemo(() => units(mulN), [mulN]);
  const phiMulN = phi(mulN);
  const isCyclic = hasePrimitiveRoot(mulN);
  const primRoots = useMemo(() => primitiveRoots(mulN), [mulN]);

  const selectedOrd = useMemo(() => {
    if (selectedUnit === null) return null;
    return multOrder(selectedUnit, mulN);
  }, [selectedUnit, mulN]);
  const selectedPowers = useMemo(() => {
    if (selectedUnit === null || !new Set(mulUnits).has(selectedUnit)) return [];
    const pows: number[] = [];
    let x = 1;
    for (let i = 1; i <= mulN; i++) {
      x = (x * selectedUnit) % mulN;
      pows.push(x);
      if (x === 1) break;
    }
    return pows;
  }, [selectedUnit, mulN, mulUnits]);

  // Widget 3: cube move order
  const [presetIdx, setPresetIdx] = useState(0);
  const [cubeRep, setCubeRep] = useState(0);
  const preset = MOVE_PRESETS[presetIdx];
  // Verify order using cube_state for a safety check (cached)
  const [verifiedOrder, setVerifiedOrder] = useState<number>(preset.order);
  useEffect(() => {
    const computed = orderOf(preset.alg, 1260);
    setVerifiedOrder(computed > 0 ? computed : preset.order);
    setCubeRep(0);
  }, [preset.alg, preset.order]);

  const cubeN = verifiedOrder;
  const cubePos = cubeRep % cubeN;

  // Animation
  const startAnim = useCallback(() => {
    if (animRef.current) clearInterval(animRef.current);
    setAnimStep(0);
    setPlaying(true);
  }, []);

  useEffect(() => {
    if (!playing) return;
    animRef.current = setInterval(() => {
      setAnimStep(prev => {
        const orbitLen = orb.length;
        if (prev >= orbitLen - 1) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 400);
    return () => { if (animRef.current) clearInterval(animRef.current); };
  }, [playing, orb.length]);

  // Reset anim when n or step changes
  useEffect(() => { setAnimStep(0); setPlaying(false); }, [clockN, clockStep]);
  useEffect(() => { setSelectedUnit(null); }, [mulN]);

  return (
    <GTSec id="cyclic-modular" className="gt-sec">
      <div className="gt-sec-num">§40</div>
      <h2 className="gt-sec-title">
        <L zh="循环群与模算术" en="Cyclic groups & modular arithmetic" />
      </h2>

      <p className="gt-lede">
        <L
          zh={<>魔方玩家每天都在不知不觉中使用循环群:转动 U 面四次, 魔方回到原位;这个最小的正整数 4 就是 U 的<em>阶</em>,而由 U 生成的子群 <TeX src={String.raw`\langle U \rangle = \{e, U, U^2, U^3\}`} /> 同构于 <TeX src={String.raw`\mathbb{Z}/4\mathbb{Z}`} />。循环群是群论中最简洁的一类,却与数论中的模算术、Euler 函数、原根理论深度交织。</>}
          en={<>Every cuber uses cyclic groups daily without realising it: applying U four times returns the cube to start; that minimal positive integer 4 is the <em>order</em> of U, and the subgroup <TeX src={String.raw`\langle U \rangle = \{e, U, U^2, U^3\}`} /> it generates is isomorphic to <TeX src={String.raw`\mathbb{Z}/4\mathbb{Z}`} />. Cyclic groups are the simplest class in group theory, yet they interweave deeply with modular arithmetic, Euler's totient, and the theory of primitive roots.</>}
        />
      </p>

      {/* ── Definition box ── */}
      <div className="gt-def">
        <div className="gt-def-title"><L zh="定义" en="Definition" /> — <L zh="循环群" en="Cyclic group" /></div>
        <div className="gt-def-body">
          <p><L
            zh={<>群 <TeX src={String.raw`G`} /> 是<strong>循环群</strong>, 若存在 <TeX src={String.raw`g \in G`} /> 使得 <TeX src={String.raw`G = \{g^k : k \in \mathbb{Z}\}`} />, 记作 <TeX src={String.raw`G = \langle g \rangle`} />。有限循环群 <TeX src={String.raw`C_n`} /> 同构于加法群 <TeX src={String.raw`(\mathbb{Z}/n\mathbb{Z},+)`} />, 对应关系为 <TeX src={String.raw`g^k \leftrightarrow k \bmod n`} />。无限循环群 <TeX src={String.raw`C_\infty \cong (\mathbb{Z},+)`} />。</>}
            en={<>A group <TeX src={String.raw`G`} /> is <strong>cyclic</strong> if some <TeX src={String.raw`g \in G`} /> satisfies <TeX src={String.raw`G = \{g^k : k \in \mathbb{Z}\}`} />, written <TeX src={String.raw`G = \langle g \rangle`} />. The finite cyclic group <TeX src={String.raw`C_n`} /> is isomorphic to the additive group <TeX src={String.raw`(\mathbb{Z}/n\mathbb{Z},+)`} /> via <TeX src={String.raw`g^k \leftrightarrow k \bmod n`} />. The infinite cyclic group is <TeX src={String.raw`C_\infty \cong (\mathbb{Z},+)`} />.</>}
          /></p>
          <p><L
            zh={<><TeX src={String.raw`\mathbb{Z}/n\mathbb{Z}`} /> 中元素 <TeX src={String.raw`k`} /> 的阶是使 <TeX src={String.raw`mk \equiv 0 \pmod{n}`} /> 的最小正整数 <TeX src={String.raw`m`} />, 等于 <TeX src={String.raw`n / \gcd(k,n)`} />。<TeX src={String.raw`k`} /> 生成 <TeX src={String.raw`\mathbb{Z}/n\mathbb{Z}`} /> 当且仅当 <TeX src={String.raw`\gcd(k,n)=1`} />, 生成元个数恰好是 <TeX src={String.raw`\varphi(n)`} />。</>}
            en={<>The order of element <TeX src={String.raw`k`} /> in <TeX src={String.raw`\mathbb{Z}/n\mathbb{Z}`} /> is the least positive <TeX src={String.raw`m`} /> with <TeX src={String.raw`mk \equiv 0 \pmod{n}`} />, equal to <TeX src={String.raw`n/\gcd(k,n)`} />. Element <TeX src={String.raw`k`} /> generates <TeX src={String.raw`\mathbb{Z}/n\mathbb{Z}`} /> if and only if <TeX src={String.raw`\gcd(k,n)=1`} />, and exactly <TeX src={String.raw`\varphi(n)`} /> such generators exist.</>}
          /></p>
        </div>
      </div>

      <p>
        <L
          zh={<><strong>Euler 函数</strong> <TeX src={String.raw`\varphi(n)`} /> 计算 <TeX src={String.raw`1,\ldots,n`} /> 中与 <TeX src={String.raw`n`} /> 互素的整数个数。乘积公式为</>}
          en={<>The <strong>Euler totient</strong> <TeX src={String.raw`\varphi(n)`} /> counts integers in <TeX src={String.raw`1,\ldots,n`} /> coprime to <TeX src={String.raw`n`} />. Its product formula is</>}
        />
      </p>
      <TeXBlock src={String.raw`\varphi(n) = n \prod_{p \mid n} \!\left(1 - \tfrac{1}{p}\right)`} />
      <p>
        <L
          zh={<>其中乘积遍历 <TeX src={String.raw`n`} /> 的所有不同质因子。<TeX src={String.raw`\varphi`} /> 对互素参数乘性: <TeX src={String.raw`\gcd(m,n)=1 \Rightarrow \varphi(mn)=\varphi(m)\varphi(n)`} />。<strong>注意</strong>: 这要求互素, 例如 <TeX src={String.raw`\varphi(4)=2 \neq \varphi(2)\varphi(2)=1`} />。Gauss 恒等式给出了一个漂亮的求和:</>}
          en={<>where the product is over all distinct prime divisors of <TeX src={String.raw`n`} />. The function <TeX src={String.raw`\varphi`} /> is multiplicative for coprime arguments: <TeX src={String.raw`\gcd(m,n)=1 \Rightarrow \varphi(mn)=\varphi(m)\varphi(n)`} />. <strong>Caution</strong>: this requires coprimality; e.g. <TeX src={String.raw`\varphi(4)=2 \neq \varphi(2)\varphi(2)=1`} />. A beautiful sum identity (Gauss) holds:</>}
        />
      </p>
      <TeXBlock src={String.raw`\sum_{d \mid n} \varphi(d) = n`} />

      {/* ── Theorem box ── */}
      <div className="gt-thm">
        <div className="gt-thm-title"><L zh="定理" en="Theorem" /> — <L zh="循环群基本定理" en="Fundamental Theorem of Cyclic Groups" /></div>
        <div className="gt-thm-body">
          <L
            zh={<>设 <TeX src={String.raw`G = \langle g \rangle`} /> 为 <TeX src={String.raw`n`} /> 阶有限循环群。(1) <TeX src={String.raw`G`} /> 的每个子群都是循环群。(2) 对 <TeX src={String.raw`n`} /> 的每个正因子 <TeX src={String.raw`d`} />, 恰有一个 <TeX src={String.raw`d`} /> 阶子群, 即 <TeX src={String.raw`\langle g^{n/d} \rangle`} />。(3) 这就是 <em>全部</em> 子群: 子群与因子之间存在保序的双射。<br /><strong>加法形式</strong>: 在 <TeX src={String.raw`\mathbb{Z}/n\mathbb{Z}`} /> 中, 子群恰好是 <TeX src={String.raw`\langle n/d \rangle`} /> (<TeX src={String.raw`d \mid n`} />), 其阶为 <TeX src={String.raw`d`} />, 生成元是余数 <TeX src={String.raw`n/d`} />。对 <TeX src={String.raw`n=12`} />: 6 个因子 1,2,3,4,6,12 对应 6 个子群。</>}
            en={<>Let <TeX src={String.raw`G = \langle g \rangle`} /> be a finite cyclic group of order <TeX src={String.raw`n`} />. (1) Every subgroup of <TeX src={String.raw`G`} /> is cyclic. (2) For each positive divisor <TeX src={String.raw`d`} /> of <TeX src={String.raw`n`} /> there is exactly one subgroup of order <TeX src={String.raw`d`} />, namely <TeX src={String.raw`\langle g^{n/d} \rangle`} />. (3) These are <em>all</em> subgroups: subgroups biject order-reversingly with divisors. <br /><strong>Additive form</strong>: in <TeX src={String.raw`\mathbb{Z}/n\mathbb{Z}`} /> the subgroups are exactly <TeX src={String.raw`\langle n/d \rangle`} /> for <TeX src={String.raw`d \mid n`} />, each of order <TeX src={String.raw`d`} />, generated by residue <TeX src={String.raw`n/d`} />. For <TeX src={String.raw`n=12`} />: 6 divisors 1,2,3,4,6,12 give 6 subgroups.</>}
          />
        </div>
      </div>

      <div className="gt-aside">
        <L
          zh={<>易错点: 阶为 <TeX src={String.raw`d`} /> 的子群是 <TeX src={String.raw`\langle n/d \rangle`} /> (<em>生成元是 <TeX src={String.raw`n/d`} /></em>), 而非 <TeX src={String.raw`\langle d \rangle`} />。反之 <TeX src={String.raw`\langle m \rangle`} /> 的阶是 <TeX src={String.raw`n/\gcd(m,n)`} />。</>}
          en={<>Common pitfall: the subgroup of order <TeX src={String.raw`d`} /> is <TeX src={String.raw`\langle n/d \rangle`} /> (<em>generator is the residue <TeX src={String.raw`n/d`} /></em>), not <TeX src={String.raw`\langle d \rangle`} />. Conversely <TeX src={String.raw`\langle m \rangle`} /> has order <TeX src={String.raw`n/\gcd(m,n)`} />.</>}
        />
      </div>

      {/* ── WIDGET 1: Modular Clock ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="模数时钟:轨道与子群" en="Modular clock: orbits & subgroups" />
      </h3>

      <div className="gt-panel">
        <div className="gt-panel-title">
          <L zh="Widget 1 — 循环轨道拨盘" en="Widget 1 — Cyclic orbit dial" />
        </div>
        <div className="gt-panel-sub">
          <L
            zh={<>选择模数 <TeX src={String.raw`n`} /> 和步长 <TeX src={String.raw`k`} />, 观察从 0 出发按 +k 的轨道 <TeX src={String.raw`0, k, 2k, \ldots`} /> 如何描绘子群 <TeX src={String.raw`\langle k \rangle \leq \mathbb{Z}/n\mathbb{Z}`} />。</>}
            en={<>Choose modulus <TeX src={String.raw`n`} /> and step <TeX src={String.raw`k`} /> to see how the orbit <TeX src={String.raw`0, k, 2k, \ldots`} /> from 0 traces the subgroup <TeX src={String.raw`\langle k \rangle \leq \mathbb{Z}/n\mathbb{Z}`} />.</>}
          />
        </div>
        <div className="gt-panel-input-row">
          <label htmlFor="clock-n-range"><L zh={`n = ${clockN}`} en={`n = ${clockN}`} /></label>
          <input id="clock-n-range" type="range" min={2} max={36} value={clockN}
            onChange={e => setClockN(Number(e.target.value))}
            className="gt-input" style={{ minWidth: 120, flex: 1 }} />
          <label htmlFor="clock-k-range"><L zh={`k = ${clockStep}`} en={`k = ${clockStep}`} /></label>
          <input id="clock-k-range" type="range" min={0} max={clockN - 1} value={clockStep}
            onChange={e => setClockStep(Number(e.target.value))}
            className="gt-input" style={{ minWidth: 120, flex: 1 }} />
        </div>
        <div className="gt-panel-input-row">
          <button className="gt-btn" onClick={startAnim} disabled={playing}>
            <L zh="播放轨道" en="Play orbit" />
          </button>
          <button className="gt-btn gt-btn-ghost" onClick={() => { setPlaying(false); setAnimStep(orb.length - 1); }}>
            <L zh="显示全部" en="Show all" />
          </button>
          <button className="gt-btn gt-btn-ghost" onClick={() => { setPlaying(false); setAnimStep(0); }}>
            <L zh="重置" en="Reset" />
          </button>
        </div>

        <ModularClock n={clockN} step={clockStep} animStep={animStep} lang={lang} />

        <div className="gt-panel-result">
          <div className="gt-result-row">
            <span className="gt-result-label"><L zh="gcd(k, n)" en="gcd(k, n)" /></span>
            <span className="gt-result-val-strong">gcd({clockStep}, {clockN}) = {g_gcd}</span>
          </div>
          <div className="gt-result-row">
            <span className="gt-result-label"><L zh="子群阶 |⟨k⟩|" en="subgroup order |⟨k⟩|" /></span>
            <span className="gt-result-val-strong">{clockN}/{g_gcd} = {subgroupSize}</span>
          </div>
          <div className="gt-result-row">
            <span className="gt-result-label"><L zh="k 是生成元?" en="k is a generator?" /></span>
            <span className="gt-result-val" style={{ color: isGenerator ? 'var(--green)' : 'var(--warn)' }}>
              {clockStep === 0 ? tr({ zh: '否 (k=0)', en: 'No (k=0)' }) : isGenerator ? tr({ zh: '是 — ⟨k⟩ = ℤ/nℤ', en: 'Yes — ⟨k⟩ = ℤ/nℤ' }) : tr({ zh: '否', en: 'No' })}
            </span>
          </div>
          <div className="gt-result-row">
            <span className="gt-result-label"><TeX src={String.raw`\varphi(n)`} /></span>
            <span className="gt-result-val">φ({clockN}) = {phiClockN} &nbsp;
              <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>
                [{tr({ zh: '生成元', en: 'generators' })}: {allGens.join(', ')}]
              </span>
            </span>
          </div>
          <div className="gt-result-row">
            <span className="gt-result-label"><L zh="轨道元素" en="orbit elements" /></span>
            <span className="gt-result-val" style={{ wordBreak: 'break-word' }}>
              {clockStep === 0 ? '{0}' : `{${orb.join(', ')}}`}
            </span>
          </div>
        </div>
      </div>

      {/* ── WIDGET 1b: Subgroup lattice ── */}
      <div className="gt-panel">
        <div className="gt-panel-title">
          <L zh="Widget 1b — 子群 Hasse 图" en="Widget 1b — Subgroup Hasse diagram" />
        </div>
        <div className="gt-panel-sub">
          <L
            zh={<><TeX src={String.raw`\mathbb{Z}/n\mathbb{Z}`} /> 的子群恰好与 <TeX src={String.raw`n`} /> 的因子一一对应;悬停某个因子节点可高亮该子群。</>}
            en={<>Subgroups of <TeX src={String.raw`\mathbb{Z}/n\mathbb{Z}`} /> correspond exactly to divisors of <TeX src={String.raw`n`} />; hover/tap a divisor node to highlight that subgroup.</>}
          />
        </div>
        <div className="gt-panel-input-row">
          <label htmlFor="lattice-n-range"><L zh={`n = ${latticeN}`} en={`n = ${latticeN}`} /></label>
          <input id="lattice-n-range" type="range" min={2} max={36} value={latticeN}
            onChange={e => { setLatticeN(Number(e.target.value)); setHighlightD(null); }}
            className="gt-input" style={{ minWidth: 120, flex: 1 }} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {divisors(latticeN).map(d => (
            <button key={d}
              className={`gt-chip${highlightD === d ? ' gt-chip-active' : ''}`}
              onClick={() => setHighlightD(highlightD === d ? null : d)}>
              {lang === 'zh' ? `阶${d} 子群` : `order-${d}`}
            </button>
          ))}
        </div>
        {highlightD !== null && (
          <p style={{ fontSize: 13, color: 'var(--ink-dim)', marginBottom: 12, fontStyle: 'italic' }}>
            <L
              zh={<>阶为 {highlightD} 的子群由 {latticeN}/{highlightD} = {latticeN / highlightD} 生成, 元素: {'{' + Array.from({ length: highlightD }, (_, t) => (t * (latticeN / highlightD)) % latticeN).join(', ') + '}'}</>}
              en={<>The order-{highlightD} subgroup is generated by {latticeN}/{highlightD} = {latticeN / highlightD}; elements: {'{' + Array.from({ length: highlightD }, (_, t) => (t * (latticeN / highlightD)) % latticeN).join(', ') + '}'}</>}
            />
          </p>
        )}
        <HasseSubgroups n={latticeN} highlightD={highlightD} />
        <div className="gt-panel-result" style={{ marginTop: 12 }}>
          <div className="gt-result-row">
            <span className="gt-result-label"><L zh="因子个数" en="number of divisors" /></span>
            <span className="gt-result-val">{divisors(latticeN).length} &nbsp;
              <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>
                [{divisors(latticeN).join(', ')}]
              </span>
            </span>
          </div>
          <div className="gt-result-row">
            <span className="gt-result-label"><L zh="Gauss 恒等式验证" en="Gauss identity check" /></span>
            <span className="gt-result-val" style={{ color: 'var(--green)' }}>
              Σφ(d) = {divisors(latticeN).reduce((s, d) => s + phi(d), 0)} = n ✓
            </span>
          </div>
        </div>
      </div>

      {/* ── Prose on unit group and primitive roots ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="单位群与原根" en="Unit group & primitive roots" />
      </h3>

      <p>
        <L
          zh={<>除了加法群 <TeX src={String.raw`(\mathbb{Z}/n\mathbb{Z}, +)`} />, 还有乘法<strong>单位群</strong> <TeX src={String.raw`(\mathbb{Z}/n\mathbb{Z})^\times`} />, 它由所有与 <TeX src={String.raw`n`} /> 互素的余数在乘法 mod <TeX src={String.raw`n`} /> 下构成, 阶为 <TeX src={String.raw`\varphi(n)`} />。</>}
          en={<>Alongside the additive group <TeX src={String.raw`(\mathbb{Z}/n\mathbb{Z}, +)`} /> there is the multiplicative <strong>unit group</strong> <TeX src={String.raw`(\mathbb{Z}/n\mathbb{Z})^\times`} />, consisting of all residues coprime to <TeX src={String.raw`n`} /> under multiplication mod <TeX src={String.raw`n`} />, with order <TeX src={String.raw`\varphi(n)`} />.</>}
        />
      </p>
      <p>
        <L
          zh={<><TeX src={String.raw`(\mathbb{Z}/n\mathbb{Z})^\times`} /> 的<strong>原根</strong>是该群的生成元, 即乘法阶等于 <TeX src={String.raw`\varphi(n)`} /> 的元素。Gauss 证明: 原根存在当且仅当 <TeX src={String.raw`n \in \{1, 2, 4, p^k, 2p^k\}`} /> (<TeX src={String.raw`p`} /> 为奇质数, <TeX src={String.raw`k \geq 1`} />)。原根存在时, 其个数为 <TeX src={String.raw`\varphi(\varphi(n))`} />。</>}
          en={<>A <strong>primitive root</strong> mod <TeX src={String.raw`n`} /> is a generator of <TeX src={String.raw`(\mathbb{Z}/n\mathbb{Z})^\times`} />, i.e. an element of multiplicative order <TeX src={String.raw`\varphi(n)`} />. Gauss proved: a primitive root exists if and only if <TeX src={String.raw`n \in \{1, 2, 4, p^k, 2p^k\}`} /> (<TeX src={String.raw`p`} /> an odd prime, <TeX src={String.raw`k \geq 1`} />). When one exists, there are exactly <TeX src={String.raw`\varphi(\varphi(n))`} /> primitive roots.</>}
        />
      </p>

      <div className="gt-aside">
        <L
          zh={<>关键区分: <TeX src={String.raw`\mathbb{Z}/n\mathbb{Z}`} /> (加法) 永远是循环群, 生成元有 <TeX src={String.raw`\varphi(n)`} /> 个; <TeX src={String.raw`(\mathbb{Z}/n\mathbb{Z})^\times`} /> (乘法) 仅当 <TeX src={String.raw`n \in \{1,2,4,p^k,2p^k\}`} /> 时才是循环群。例如 <TeX src={String.raw`(\mathbb{Z}/8\mathbb{Z})^\times = \{1,3,5,7\} \cong C_2 \times C_2`} /> (Klein 四元群), 每个非幺元素阶为 2, <em>无</em>原根。</>}
          en={<>Key distinction: <TeX src={String.raw`\mathbb{Z}/n\mathbb{Z}`} /> (additive) is always cyclic with <TeX src={String.raw`\varphi(n)`} /> generators; <TeX src={String.raw`(\mathbb{Z}/n\mathbb{Z})^\times`} /> (multiplicative) is cyclic only for <TeX src={String.raw`n \in \{1,2,4,p^k,2p^k\}`} />. E.g. <TeX src={String.raw`(\mathbb{Z}/8\mathbb{Z})^\times = \{1,3,5,7\} \cong C_2 \times C_2`} /> (Klein four group): every non-identity element has order 2, and there is <em>no</em> primitive root.</>}
        />
      </div>

      {/* ── WIDGET 2: Multiplication table ── */}
      <div className="gt-panel">
        <div className="gt-panel-title">
          <L zh="Widget 2 — 乘法表与单位群" en="Widget 2 — Multiplication table & unit group" />
        </div>
        <div className="gt-panel-sub">
          <L
            zh={<>加亮单位 (与 n 互素的余数) 及原根; 点击某个单位查看其幂次轨道。<TeX src={String.raw`n > 16`} /> 时只展示 <TeX src={String.raw`n=16`} /> 的表格以保证可读性。</>}
            en={<>Units (residues coprime to n) and primitive roots are highlighted; click a unit to see its power orbit. For <TeX src={String.raw`n > 16`} /> the table is clipped to n=16 for readability.</>}
          />
        </div>
        <div className="gt-panel-input-row">
          <label htmlFor="mul-n-range"><TeX src={String.raw`n`} /> = {mulN}</label>
          <input id="mul-n-range" type="range" min={2} max={30} value={mulN}
            onChange={e => setMulN(Number(e.target.value))}
            className="gt-input" style={{ minWidth: 120, flex: 1 }} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-dim)', alignSelf: 'center' }}>
            <L zh="点击单位:" en="Click a unit:" />
          </span>
          {mulUnits.map(u => (
            <button key={u}
              className={`gt-chip${selectedUnit === u ? ' gt-chip-active' : ''}`}
              style={{ borderColor: primRoots.includes(u) ? 'var(--gold)' : undefined }}
              onClick={() => setSelectedUnit(selectedUnit === u ? null : u)}>
              {u}{primRoots.includes(u) ? '*' : ''}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic', margin: '0 0 14px' }}>
          <L
            zh={<>* 标注原根。深色列/行 = 单位。绿色格 = 乘积为 1 (逆元对)。</>}
            en={<>* marks primitive roots. Shaded cols/rows = units. Green cells = product 1 (inverse pairs).</>}
          />
        </p>
        <MulTable n={mulN} selectedUnit={selectedUnit} />
        <div className="gt-panel-result">
          <div className="gt-result-row">
            <span className="gt-result-label"><TeX src={String.raw`\varphi(n)`} /></span>
            <span className="gt-result-val-strong">φ({mulN}) = {phiMulN}</span>
          </div>
          <div className="gt-result-row">
            <span className="gt-result-label"><L zh="单位" en="units" /></span>
            <span className="gt-result-val" style={{ wordBreak: 'break-word', fontSize: 12 }}>{`{${mulUnits.join(', ')}}`}</span>
          </div>
          <div className="gt-result-row">
            <span className="gt-result-label"><L zh="(ℤ/nℤ)× 是循环群?" en="(ℤ/nℤ)× cyclic?" /></span>
            <span className="gt-result-val" style={{ color: isCyclic ? 'var(--green)' : 'var(--warn)' }}>
              {isCyclic ? tr({ zh: '是', en: 'Yes' }) : (lang === 'zh' ? `否 (n=${mulN} 不在 {1,2,4,pᵏ,2pᵏ})` : `No (n=${mulN} ∉ {1,2,4,pᵏ,2pᵏ})`)}
            </span>
          </div>
          <div className="gt-result-row">
            <span className="gt-result-label"><L zh="原根" en="primitive roots" /></span>
            <span className="gt-result-val" style={{ wordBreak: 'break-word' }}>
              {isCyclic
                ? (primRoots.length > 0
                  ? `{${primRoots.join(', ')}}  (${tr({ zh: '共', en: 'count:' }) } φ(φ(${mulN}))=${phi(phiMulN)})`
                  : tr({ zh: '（退化情形）', en: '(degenerate)' }))
                : tr({ zh: '不存在', en: 'none' })}
            </span>
          </div>
          {selectedUnit !== null && mulUnits.includes(selectedUnit) && (
            <>
              <div className="gt-result-row">
                <span className="gt-result-label"><L zh={`ord(${selectedUnit})`} en={`ord(${selectedUnit})`} /></span>
                <span className="gt-result-val-strong">{selectedOrd}</span>
              </div>
              <div className="gt-result-row">
                <span className="gt-result-label"><L zh="幂次轨道" en="power orbit" /></span>
                <span className="gt-result-val" style={{ wordBreak: 'break-word', fontSize: 12 }}>
                  {selectedPowers.map((p, i) => (
                    <span key={i} style={{ marginRight: 6 }}>
                      <span style={{ color: 'var(--ink-faint)', fontSize: 11 }}>{selectedUnit}<sup>{i + 1}</sup>=</span>
                      <span style={{ color: p === 1 ? 'var(--green)' : 'var(--ink)' }}>{p}</span>
                    </span>
                  ))}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Cube connection ── */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="魔方中的循环群" en="Cyclic groups on the cube" />
      </h3>

      <p>
        <L
          zh={<>魔方的每个单步走法都生成一个有限循环子群: 把它重复执行若干次总能回到原位。一个走法的阶等于它对 20 个活动块的置换 (分解为不相交轮换) 的各轮换长度的最小公倍数。<TeX src={String.raw`U`} /> 在 4 个 U 层棱和 4 个 U 层角各作一个 4-轮换, 所以 <TeX src={String.raw`\text{ord}(U) = \text{lcm}(4,4) = 4`} />, 给出 <TeX src={String.raw`\langle U \rangle \cong C_4 \cong \mathbb{Z}/4\mathbb{Z}`} />。<TeX src={String.raw`\varphi(4)=2`} /> 与此对应: <TeX src={String.raw`C_4`} /> 的生成元恰好是 1 和 3 (即 U 和 U'), 而 <TeX src={String.raw`U^2`} /> 只生成 2 阶子群。</>}
          en={<>Every single move on the cube generates a finite cyclic subgroup: repeating it always returns to start. The order of a move equals the lcm of the cycle lengths of its permutation on the 20 movable cubies. <TeX src={String.raw`U`} /> acts as a 4-cycle on the 4 U-layer edges and a 4-cycle on the 4 U-layer corners, so <TeX src={String.raw`\text{ord}(U) = \text{lcm}(4,4) = 4`} />, giving <TeX src={String.raw`\langle U \rangle \cong C_4 \cong \mathbb{Z}/4\mathbb{Z}`} />. The totient connection: <TeX src={String.raw`\varphi(4)=2`} /> matches exactly — the generators of <TeX src={String.raw`C_4`} /> are 1 and 3 (i.e. U and U'), while <TeX src={String.raw`U^2`} /> generates only the order-2 subgroup.</>}
        />
      </p>

      {/* ── WIDGET 3: Cube move order explorer ── */}
      <div className="gt-panel">
        <div className="gt-panel-title">
          <L zh="Widget 3 — 走法阶探索器" en="Widget 3 — Move order explorer" />
        </div>
        <div className="gt-panel-sub">
          <L
            zh={<>选择一个预设走法, 查看它的阶和生成的循环拨盘。重复 +1 次模 ord(A) 即是 <TeX src={String.raw`\mathbb{Z}/\text{ord}(A)\mathbb{Z}`} /> 的加法结构。</>}
            en={<>Choose a preset move/alg to see its order and the cyclic dial it generates. Stepping +1 mod ord(A) is exactly the additive structure of <TeX src={String.raw`\mathbb{Z}/\text{ord}(A)\mathbb{Z}`} />.</>}
          />
        </div>
        <div className="gt-panel-input-row" style={{ flexWrap: 'wrap' }}>
          {MOVE_PRESETS.map((p, i) => (
            <button key={p.alg}
              className={`gt-chip${presetIdx === i ? ' gt-chip-active' : ''}`}
              onClick={() => setPresetIdx(i)}>
              {p.label}
            </button>
          ))}
        </div>
        {/* Mini modular clock for cube move, showing n = cubeN ticks */}
        <div style={{ margin: '16px 0 8px' }}>
          {cubeN <= 36 ? (
            <ModularClock n={cubeN} step={1} animStep={cubePos} lang={lang} />
          ) : (
            /* For large orders (e.g. 105) show a linear tick strip */
            <div style={{ overflowX: 'auto' }}>
              <svg viewBox={`0 0 ${Math.min(cubeN * 8, 600)} 60`} width="100%" style={{ maxWidth: '100%', display: 'block' }}>
                {Array.from({ length: Math.min(cubeN, 72) }, (_, i) => {
                  const x = 8 + i * (Math.min(600, cubeN * 8) - 16) / (Math.min(cubeN, 72) - 1);
                  const isCur = i === cubePos % Math.min(cubeN, 72);
                  const isZero = i === 0;
                  return (
                    <g key={i}>
                      <circle cx={x} cy={30} r={isCur ? 7 : 4}
                        fill={isCur ? 'var(--accent)' : isZero ? 'var(--green)' : 'var(--rule)'}
                        stroke={isCur ? 'var(--accent)' : 'var(--rule)'} strokeWidth={1} />
                      {(i % 10 === 0 || i === cubeN - 1) && (
                        <text x={x} y={50} textAnchor="middle" fontSize={9} fill="var(--ink-faint)" style={{ fontFamily: 'var(--mono)' }}>{i}</text>
                      )}
                    </g>
                  );
                })}
                {cubeN > 72 && (
                  <text x={590} y={32} textAnchor="end" fontSize={10} fill="var(--ink-faint)" style={{ fontFamily: 'var(--mono)' }}>…{cubeN}</text>
                )}
              </svg>
            </div>
          )}
        </div>
        <div className="gt-panel-input-row">
          <button className="gt-btn" onClick={() => setCubeRep(r => (r + 1) % cubeN)}>
            <L zh="+1 次" en="+1 rep" />
          </button>
          <button className="gt-btn gt-btn-ghost" onClick={() => setCubeRep(0)}>
            <L zh="重置 (k=0)" en="Reset (k=0)" />
          </button>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-dim)' }}>
            k = {cubePos} / ord = {cubeN}
          </span>
        </div>
        <div className="gt-panel-result">
          <div className="gt-result-row">
            <span className="gt-result-label"><L zh="走法" en="alg" /></span>
            <span className="gt-result-val gt-mono">{preset.alg}</span>
          </div>
          <div className="gt-result-row">
            <span className="gt-result-label"><L zh="阶 ord(A)" en="order ord(A)" /></span>
            <span className="gt-result-val-strong">{cubeN}</span>
          </div>
          <div className="gt-result-row">
            <span className="gt-result-label"><L zh="生成子群" en="generated subgroup" /></span>
            <span className="gt-result-val"><TeX src={String.raw`\langle A \rangle \cong C_{` + cubeN + String.raw`} \cong \mathbb{Z}/` + cubeN + String.raw`\mathbb{Z}`} /></span>
          </div>
          <div className="gt-result-row">
            <span className="gt-result-label"><TeX src={`k \\bmod ${cubeN}`} /></span>
            <span className="gt-result-val" style={{ color: cubePos === 0 ? 'var(--green)' : 'var(--ink)' }}>
              {cubePos} {cubePos === 0 ? tr({ zh: '— 复原!', en: '— solved!'
                                      }) : ''}
            </span>
          </div>
          <div className="gt-result-row">
            <span className="gt-result-label"><TeX src={`\\varphi(${cubeN})`} /></span>
            <span className="gt-result-val">φ({cubeN}) = {phi(cubeN)} &nbsp;
              <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
                <L zh="个生成元" en="generators" />
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Final aside / references ── */}
      <div className="gt-aside" style={{ marginTop: 32 }}>
        <L
          zh={<><strong>结构定理</strong>: 任意两个同阶循环群同构 (最多一个 <TeX src={String.raw`C_n`} />);中国剩余定理给出 <TeX src={String.raw`C_m \times C_n \cong C_{mn}`} /> 当且仅当 <TeX src={String.raw`\gcd(m,n)=1`} />。Lagrange 定理保证每个元素的阶整除群的阶, 但非循环群未必对群阶的每个因子都有对应阶的元素, 循环群恰好相反: 每个因子 <TeX src={String.raw`d \mid n`} /> 恰对应 <TeX src={String.raw`\varphi(d)`} /> 个 <TeX src={String.raw`d`} /> 阶元素。</>}
          en={<><strong>Structure theorem</strong>: any two cyclic groups of equal order are isomorphic (there is at most one <TeX src={String.raw`C_n`} />); CRT gives <TeX src={String.raw`C_m \times C_n \cong C_{mn}`} /> iff <TeX src={String.raw`\gcd(m,n)=1`} />. Lagrange forces every element's order to divide the group order, but in a non-cyclic group not every divisor of <TeX src={String.raw`|G|`} /> need be realised; in a cyclic group every divisor <TeX src={String.raw`d \mid n`} /> is realised by exactly <TeX src={String.raw`\varphi(d)`} /> elements.</>}
        />
      </div>

      <div className="gt-refs" style={{ marginTop: 40 }}>
        <ol>
          <li>Dummit &amp; Foote, <em>Abstract Algebra</em>, 3rd ed., §2.3 (cyclic groups, Fundamental Theorem, Thm 7).</li>
          <li>Ireland &amp; Rosen, <em>A Classical Introduction to Modern Number Theory</em>, 2nd ed., Ch. 3–4 (Euler phi, primitive roots).</li>
          <li>D. Joyner, <em>Adventures in Group Theory</em> (Johns Hopkins UP) — move orders, cube group structure.</li>
        </ol>
      </div>
    </GTSec>
  );
}
