'use client';

import { useState, useMemo, useCallback } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { permSign } from '../cube_state';
import { tr } from '@/i18n/tr';
import BoolToggle from '@/components/BoolToggle';

// ── BigInt helpers (all math done in BigInt to avoid precision loss) ──────────
function bigFactorial(n: number): bigint {
  let r = 1n;
  for (let i = 2n; i <= BigInt(n); i++) r *= i;
  return r;
}
function wreathOrder(groupOrder: bigint, n: number): bigint {
  return groupOrder ** BigInt(n) * bigFactorial(n);
}
function gcd(a: number, b: number): number {
  while (b) { const t = b; b = a % b; a = t; }
  return a;
}
function lcm(a: number, b: number): number { return (a / gcd(a, b)) * b; }
function elementOrderBase(twists: number[], mod: number): number {
  if (twists.every(t => t === 0)) return 1;
  let o = 1;
  for (const t of twists) {
    if (t === 0) continue;
    o = lcm(o, mod / gcd(t, mod));
  }
  return o;
}
function formatBig(n: bigint): string {
  return n.toLocaleString();
}

// Identity permutation
function idPerm(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

// Wreath multiplication law (f1,h1)·(f2,h2) over Z/mod:
//   f[x] = f1[x] + f2[h1^{-1}[x]]   mod m,    h = h1∘h2.
// The builder below demonstrates the resulting action on tokens directly.

// Apply (f, h) to tokens: token[i] = {origin, orient}
// Move: token at slot i goes to slot h[i], accumulating twist f[h[i]] mod m
function applyWreathToTokens(
  tokens: { origin: number; orient: number }[],
  f: number[], h: number[], mod: number
): { origin: number; orient: number }[] {
  const n = h.length;
  const result: { origin: number; orient: number }[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const dest = h[i];
    result[dest] = { origin: tokens[i].origin, orient: (tokens[i].orient + f[dest]) % mod };
  }
  return result;
}

// Categorical colour palette
const PALETTE = ['#8B2E3C','#2A4D69','#3F7050','#B8860B','#6B4E9C','#C2410C','#5C7CA0','#9C4E6B'];

// ── Widget 1: Wreath Element Builder ─────────────────────────────────────────
type WreathMode = 'corners' | 'edges' | 'demo';
const MODES: { key: WreathMode; A: number; n: number; labelZh: string; labelEn: string
 }[] = [
  { key: 'corners', A: 3, n: 8,  labelZh: '角块 (C₃≀S₈)',  labelEn: 'Corners (C₃≀S₈)'
},
  { key: 'edges',   A: 2, n: 12, labelZh: '棱块 (C₂≀S₁₂)', labelEn: 'Edges (C₂≀S₁₂)'
},
  { key: 'demo',    A: 3, n: 3,  labelZh: '演示 (C₃≀S₃)',  labelEn: 'Demo (C₃≀S₃)' },
];

function WreathBuilder() {
  const lang = useLang();
  const [modeKey, setModeKey] = useState<WreathMode>('demo');
  const mode = MODES.find(m => m.key === modeKey)!;
  const { A: mod, n } = mode;

  const [base, setBase] = useState<number[]>(() => Array(12).fill(0));
  const [perm, setPerm] = useState<number[]>(() => idPerm(12));
  // accumulated state (tokens): initially token[i] = {origin:i, orient:0}
  const [tokens, setTokens] = useState<{ origin: number; orient: number }[]>(() =>
    Array.from({ length: 12 }, (_, i) => ({ origin: i, orient: 0 }))
  );

  const currentBase = base.slice(0, n);
  // normalise perm to be a valid permutation within [0,n)
  const normPerm = useMemo(() => {
    const p = perm.slice(0, n).map(v => v % n);
    // repair: if duplicates, reset to identity
    const seen = new Set(p);
    if (seen.size !== n) return idPerm(n);
    return p;
  }, [perm, n]);
  const currentTokens = tokens.slice(0, n);

  const order = useMemo(() => wreathOrder(BigInt(mod), n), [mod, n]);

  const setBaseAt = useCallback((i: number, v: number) => {
    setBase(prev => {
      const next = [...prev];
      next[i] = ((v % mod) + mod) % mod;
      return next;
    });
  }, [mod]);

  const swapPerm = useCallback((i: number, j: number) => {
    setPerm(prev => {
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }, []);

  const applyOnce = useCallback(() => {
    setTokens(prev => {
      const tok = prev.slice(0, n);
      const newTok = applyWreathToTokens(tok, currentBase, normPerm, mod);
      return [...newTok, ...prev.slice(n)];
    });
  }, [currentBase, normPerm, n, mod]);

  const resetTokens = useCallback(() => {
    setTokens(Array.from({ length: 12 }, (_, i) => ({ origin: i, orient: 0 })));
  }, []);

  const resetElement = useCallback(() => {
    setBase(Array(12).fill(0));
    setPerm(idPerm(12));
  }, []);

  // SVG layout
  const slotW = 52, slotH = 52, gap = 8;
  const totalW = n * (slotW + gap) - gap;
  const svgH = 180;

  // Orientation visual: for C₃ = equilateral triangle arrows; for C₂ = binary flip indicator
  const orientAngle = (orient: number, modulo: number) =>
    modulo === 3 ? orient * 120 : orient * 180;

  return (
    <div className="gt-panel" style={{ marginTop: 32 }}>
      <div className="gt-panel-title">
        <L zh="圈积元素构造器" en="Wreath Element Builder" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="选择一组底元素 f(x) 和顶置换 h，观察圈积元素 (f,h) 如何作用于带标记的槽位。"
          en="Choose base values f(x) and a top permutation h, then watch how the wreath element (f, h) acts on labelled slots."
        />
      </div>
      {/* Mode chips */}
      <div className="gt-panel-input-row" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {MODES.map(m => (
          <button
            key={m.key}
            className={`gt-chip${modeKey === m.key ? ' gt-chip-active' : ''}`}
            onClick={() => { setModeKey(m.key); resetTokens(); resetElement(); }}
          >
            {lang === 'zh' ? m.labelZh : m.labelEn}
          </button>
        ))}
      </div>
      {/* SVG */}
      <div style={{ overflowX: 'auto', width: '100%' }}>
        <svg viewBox={`-4 0 ${totalW + 8} ${svgH}`} width="100%" style={{ display: 'block', minWidth: Math.min(totalW + 8, 340), maxWidth: totalW + 8 }}>
          {/* Permutation arrows (curved, above slots) */}
          {normPerm.map((dest, i) => {
            if (dest === i) return null;
            const x1 = i * (slotW + gap) + slotW / 2;
            const x2 = dest * (slotW + gap) + slotW / 2;
            const y = 48;
            const mid = (x1 + x2) / 2;
            const dy = Math.min(40, Math.abs(x2 - x1) * 0.4 + 10);
            const d = `M ${x1} ${y} Q ${mid} ${y - dy} ${x2} ${y}`;
            return (
              <g key={i}>
                <path d={d} fill="none" stroke="var(--accent-2)" strokeWidth={1.5} markerEnd="url(#arrowBlue)" opacity={0.7} />
              </g>
            );
          })}
          <defs>
            <marker id="arrowBlue" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L0,6 L6,3 z" fill="var(--accent-2)" />
            </marker>
          </defs>
          {/* Slots */}
          {Array.from({ length: n }, (_, i) => {
            const tok = currentTokens[i] ?? { origin: i, orient: 0 };
            const cx = i * (slotW + gap);
            const cy = 60;
            const angle = orientAngle(tok.orient, mod);
            const color = PALETTE[tok.origin % PALETTE.length];
            const baseVal = currentBase[i] ?? 0;
            return (
              <g key={i} transform={`translate(${cx}, ${cy})`}>
                {/* Slot box */}
                <rect x={0} y={0} width={slotW} height={slotH} rx={7}
                  fill="var(--bg-elev)" stroke="var(--rule)" strokeWidth={1.2} />
                {/* Origin colour indicator */}
                <rect x={2} y={2} width={slotW - 4} height={6} rx={3} fill={color} opacity={0.85} />
                {/* Orientation indicator: rotated triangle */}
                <g transform={`translate(${slotW / 2}, ${slotH / 2 + 4}) rotate(${angle})`}>
                  {mod === 3
                    ? <polygon points="0,-11 9,7 -9,7" fill={color} opacity={0.8} />
                    : <rect x={-9} y={-5} width={18} height={10} rx={3}
                        fill={color} opacity={tok.orient === 1 ? 0.9 : 0.3} />
                  }
                </g>
                {/* Slot label */}
                <text x={slotW / 2} y={slotH - 4} textAnchor="middle"
                  fontSize={10} fill="var(--ink-dim)">{i}</text>
                {/* Origin label */}
                <text x={3} y={22} fontSize={10} fill={color} fontWeight={600}>{tok.origin}</text>
                {/* Base value stepper */}
                <g>
                  <rect x={0} y={slotH} width={slotW} height={20} rx={0} fill="none" />
                  <text x={slotW / 2} y={slotH + 14} textAnchor="middle"
                    fontSize={11} fill="var(--ink-dim)">f={baseVal}</text>
                </g>
              </g>
            );
          })}
          {/* Perm dest labels */}
          {Array.from({ length: n }, (_, i) => {
            const cx = i * (slotW + gap) + slotW / 2;
            return (
              <text key={i} x={cx} y={svgH - 4} textAnchor="middle" fontSize={11} fill="var(--accent-2)">
                →{normPerm[i]}
              </text>
            );
          })}
        </svg>
      </div>
      {/* Base value controls */}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginBottom: 4 }}>
          <L zh={`底元素 f(x) ∈ {0,…,${mod - 1}}`} en={`Base values f(x) ∈ {0,…,${mod - 1}}`} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {Array.from({ length: n }, (_, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 10, color: 'var(--ink-dim)' }}>{i}</span>
              <input
                type="number" min={0} max={mod - 1}
                value={currentBase[i] ?? 0}
                onChange={e => setBaseAt(i, parseInt(e.target.value, 10) || 0)}
                className="gt-input"
                style={{ width: 40, textAlign: 'center', padding: '2px 4px' }}
              />
            </div>
          ))}
        </div>
      </div>
      {/* Perm swap controls */}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginBottom: 4 }}>
          <L zh="顶置换 h：相邻对换按钮" en="Top permutation h: adjacent transposition buttons" />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {Array.from({ length: n - 1 }, (_, i) => (
            <button key={i} className="gt-btn-ghost"
              style={{ fontSize: 12, padding: '2px 8px' }}
              onClick={() => swapPerm(i, i + 1)}>
              ({i} {i + 1})
            </button>
          ))}
          <button className="gt-btn-ghost" style={{ fontSize: 12, padding: '2px 8px', color: 'var(--warn)' }}
            onClick={resetElement}>
            <L zh="重置" en="Reset" />
          </button>
        </div>
      </div>
      {/* Apply / reset buttons */}
      <div className="gt-panel-input-row" style={{ gap: 8, marginTop: 12 }}>
        <button className="gt-btn" onClick={applyOnce}>
          <L zh="应用 (f,h) 一次" en="Apply (f,h) once" />
        </button>
        <button className="gt-btn-ghost" onClick={resetTokens}>
          <L zh="重置令牌" en="Reset tokens" />
        </button>
      </div>
      {/* Order readout */}
      <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg-deep)', borderRadius: 8, fontSize: 13 }}>
        <div className="gt-result-row">
          <span className="gt-result-label">|A|</span>
          <span className="gt-result-val-strong">{mod}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label">n</span>
          <span className="gt-result-val-strong">{n}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label">|A ≀ Sₙ| = |A|ⁿ · n!</span>
          <span className="gt-result-val-strong">{formatBig(order)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Widget 2: Index-12 Sieve ──────────────────────────────────────────────────
const W_ORDER = 519024039293878272000n;

function IndexSieve() {
  const [cornerTwists, setCornerTwists] = useState<number[]>([0,0,0,0,0,0,0,0]);
  const [edgeFlips, setEdgeFlips] = useState<number[]>([0,0,0,0,0,0,0,0,0,0,0,0]);
  const [cornerParity, setCornerParity] = useState<1|-1>(1);
  const [edgeParity, setEdgeParity] = useState<1|-1>(1);
  const [enforceAll, setEnforceAll] = useState<boolean[]>([true, true, true]);

  const twistSum = cornerTwists.reduce((a, b) => a + b, 0) % 3;
  const flipSum = edgeFlips.reduce((a, b) => a + b, 0) % 2;
  const parityMatch = cornerParity === edgeParity;
  const ok0 = twistSum === 0;
  const ok1 = flipSum === 0;
  const ok2 = parityMatch;
  const legal = ok0 && ok1 && ok2;

  // Compute displayed order depending on which constraints are active
  const displayedOrder = useMemo(() => {
    let denom = 1n;
    if (enforceAll[0]) denom *= 3n;
    if (enforceAll[1]) denom *= 2n;
    if (enforceAll[2]) denom *= 2n;
    return W_ORDER / denom;
  }, [enforceAll]);

  const lamp = (ok: boolean, active: boolean) => (
    <span style={{
      display: 'inline-block', width: 14, height: 14, borderRadius: 7,
      background: !active ? 'var(--rule)' : ok ? 'var(--green)' : 'var(--warn)',
      verticalAlign: 'middle', marginRight: 6
    }} />
  );

  const setCornerTwistAt = (i: number, v: number) => {
    setCornerTwists(prev => { const n = [...prev]; n[i] = ((v % 3) + 3) % 3; return n; });
  };
  const setEdgeFlipAt = (i: number, v: number) => {
    setEdgeFlips(prev => { const n = [...prev]; n[i] = ((v % 2) + 2) % 2; return n; });
  };

  // SVG funnel diagram
  const funnelW = 340, funnelH = 120;

  return (
    <div className="gt-panel" style={{ marginTop: 32 }}>
      <div className="gt-panel-title">
        <L zh="指数 12 筛：W → G" en="Index-12 Sieve: W → G" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="调整角扭转和棱翻转，观察三条不变量约束如何把 W 的阶除以 12，得到合法魔方状态数。"
          en="Adjust corner twists and edge flips to see how the three invariant constraints divide |W| by 12, yielding the count of legal cube states."
        />
      </div>
      {/* Corner twists */}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginBottom: 6 }}>
          <L zh="8 个角块扭转量 (0–2)" en="8 corner twists (0–2)" />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {cornerTwists.map((v, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 10, color: 'var(--ink-dim)' }}>c{i}</span>
              <input type="number" min={0} max={2} value={v}
                onChange={e => setCornerTwistAt(i, parseInt(e.target.value, 10) || 0)}
                className="gt-input" style={{ width: 42, textAlign: 'center', padding: '2px 4px' }} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 6, fontSize: 12 }}>
          <L zh="∑ 角扭转 mod 3 = " en="∑ corner twists mod 3 = " />
          <strong style={{ color: ok0 ? 'var(--green)' : 'var(--warn)' }}>{twistSum}</strong>
          <span style={{ color: 'var(--ink-dim)', marginLeft: 6 }}>{ok0 ? '✓' : '✗'}</span>
        </div>
      </div>
      {/* Edge flips */}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginBottom: 6 }}>
          <L zh="12 条棱块翻转量 (0–1)" en="12 edge flips (0–1)" />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {edgeFlips.map((v, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 10, color: 'var(--ink-dim)' }}>e{i}</span>
              <input type="number" min={0} max={1} value={v}
                onChange={e => setEdgeFlipAt(i, parseInt(e.target.value, 10) || 0)}
                className="gt-input" style={{ width: 42, textAlign: 'center', padding: '2px 4px' }} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 6, fontSize: 12 }}>
          <L zh="∑ 棱翻转 mod 2 = " en="∑ edge flips mod 2 = " />
          <strong style={{ color: ok1 ? 'var(--green)' : 'var(--warn)' }}>{flipSum}</strong>
          <span style={{ color: 'var(--ink-dim)', marginLeft: 6 }}>{ok1 ? '✓' : '✗'}</span>
        </div>
      </div>
      {/* Parity toggles */}
      <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <span style={{ fontSize: 12, color: 'var(--ink-dim)' }}>
            <L zh="角置换奇偶性" en="Corner perm parity" />:
          </span>
          <button className={`gt-chip${cornerParity === 1 ? ' gt-chip-active' : ''}`}
            style={{ marginLeft: 8 }} onClick={() => setCornerParity(1)}>
            <L zh="偶" en="Even" />
          </button>
          <button className={`gt-chip${cornerParity === -1 ? ' gt-chip-active' : ''}`}
            style={{ marginLeft: 4 }} onClick={() => setCornerParity(-1)}>
            <L zh="奇" en="Odd" />
          </button>
        </div>
        <div>
          <span style={{ fontSize: 12, color: 'var(--ink-dim)' }}>
            <L zh="棱置换奇偶性" en="Edge perm parity" />:
          </span>
          <button className={`gt-chip${edgeParity === 1 ? ' gt-chip-active' : ''}`}
            style={{ marginLeft: 8 }} onClick={() => setEdgeParity(1)}>
            <L zh="偶" en="Even" />
          </button>
          <button className={`gt-chip${edgeParity === -1 ? ' gt-chip-active' : ''}`}
            style={{ marginLeft: 4 }} onClick={() => setEdgeParity(-1)}>
            <L zh="奇" en="Odd" />
          </button>
        </div>
      </div>
      <div style={{ marginTop: 6, fontSize: 12 }}>
        <L zh="奇偶性匹配" en="Parity match" />:
        <strong style={{ marginLeft: 6, color: ok2 ? 'var(--green)' : 'var(--warn)' }}>
          {ok2 ? tr({ zh: '是', en: 'Yes' }) : tr({ zh: '否', en: 'No' })}
        </strong>
        <span style={{ color: 'var(--ink-dim)', marginLeft: 6 }}>{ok2 ? '✓' : '✗'}</span>
      </div>
      {/* Enforce checkboxes */}
      <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {[
          { zh: '启用约束 1: ∑twist≡0', en: 'Enforce: ∑twist≡0'
        },
          { zh: '启用约束 2: ∑flip≡0',  en: 'Enforce: ∑flip≡0'
        },
          { zh: '启用约束 3: 奇偶匹配',  en: 'Enforce: parity match'
        },
        ].map((c, i) => (
          <BoolToggle
            key={i}
            value={enforceAll[i]}
            onChange={() => setEnforceAll(prev => { const n = [...prev]; n[i] = !n[i]; return n; })}
            label={<span style={{ fontSize: 13 }}>{tr(c)}</span>}
            ariaLabel={tr(c)}
          />
        ))}
      </div>
      {/* Funnel SVG */}
      <div style={{ overflowX: 'auto', marginTop: 16 }}>
        <svg viewBox={`0 0 ${funnelW} ${funnelH}`} width="100%" style={{ display: 'block', minWidth: 280, maxWidth: funnelW }}>
          {/* W box */}
          <rect x={10} y={10} width={80} height={40} rx={6} fill="var(--bg-deep)" stroke="var(--accent-2)" strokeWidth={1.5} />
          <text x={50} y={28} textAnchor="middle" fontSize={11} fill="var(--accent-2)" fontWeight={600}>W</text>
          <text x={50} y={43} textAnchor="middle" fontSize={8} fill="var(--ink-dim)">≈5.19×10²⁰</text>
          {/* Gates */}
          {[
            { x: 110, label: '÷3 twist', active: enforceAll[0], ok: ok0 },
            { x: 185, label: '÷2 flip',  active: enforceAll[1], ok: ok1 },
            { x: 255, label: '÷2 parity', active: enforceAll[2], ok: ok2 },
          ].map((g, i) => (
            <g key={i}>
              <line x1={90 + i * 70} y1={30} x2={g.x} y2={30} stroke="var(--rule)" strokeWidth={1.5} />
              <rect x={g.x} y={15} width={60} height={30} rx={5}
                fill={g.active ? 'var(--bg-elev)' : 'var(--bg-deep)'}
                stroke={g.active ? (g.ok ? 'var(--green)' : 'var(--warn)') : 'var(--rule)'}
                strokeWidth={1.2} />
              <text x={g.x + 30} y={28} textAnchor="middle" fontSize={10}
                fill={g.active ? (g.ok ? 'var(--green)' : 'var(--warn)') : 'var(--ink-dim)'}>
                {g.label}
              </text>
              <line x1={g.x + 60} y1={30} x2={g.x + 70} y2={30} stroke="var(--rule)" strokeWidth={1.5} />
            </g>
          ))}
          {/* G box */}
          <rect x={260} y={10} width={74} height={40} rx={6} fill="var(--bg-deep)" stroke="var(--green)" strokeWidth={1.5} />
          <text x={297} y={28} textAnchor="middle" fontSize={11} fill="var(--green)" fontWeight={600}>G</text>
          <text x={297} y={43} textAnchor="middle" fontSize={8} fill="var(--ink-dim)">≈4.33×10¹⁹</text>
          {/* Status lamps */}
          {[
            { x: 140, ok: ok0, active: enforceAll[0] },
            { x: 215, ok: ok1, active: enforceAll[1] },
            { x: 285, ok: ok2, active: enforceAll[2] },
          ].map((l, i) => (
            <circle key={i} cx={l.x} cy={65} r={5}
              fill={!l.active ? 'var(--rule)' : l.ok ? 'var(--green)' : 'var(--warn)'}
              opacity={0.9} />
          ))}
        </svg>
      </div>
      {/* Order display */}
      <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg-deep)', borderRadius: 8, fontSize: 13 }}>
        <div className="gt-result-row">
          <span className="gt-result-label">|W|</span>
          <span className="gt-result-val">{formatBig(W_ORDER)}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="当前约束下的阶" en="Order after active constraints" />
          </span>
          <span className="gt-result-val-strong">{formatBig(displayedOrder)}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="状态" en="Status" />
          </span>
          <span style={{ fontWeight: 700, color: legal ? 'var(--green)' : 'var(--warn)' }}>
            {legal
              ? tr({ zh: '合法魔方状态', en: 'Legal cube state'
                                      })
              : tr({ zh: '不可达（非法）', en: 'Unreachable (illegal)'
                                      })}
          </span>
        </div>
      </div>
      {/* Three invariant lamps */}
      <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13 }}>
        {[
          { zh: '约束①: ∑角扭转≡0 (mod 3)', en: 'Constraint ①: ∑corner twist ≡ 0 (mod 3)', ok: ok0
        },
          { zh: '约束②: ∑棱翻转≡0 (mod 2)', en: 'Constraint ②: ∑edge flip ≡ 0 (mod 2)', ok: ok1
        },
          { zh: '约束③: 角置换奇偶 = 棱置换奇偶', en: 'Constraint ③: corner perm parity = edge perm parity', ok: ok2
        },
        ].map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
            {lamp(c.ok, true)}
            <span style={{ color: 'var(--ink-dim)' }}>{tr(c)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Widget 3: Element order explorer ──────────────────────────────────────────
function OrderExplorer() {
  const [mod, setMod] = useState<number>(3);
  const [vals, setVals] = useState<number[]>([1,0,0,0,0,0,0,0]);

  const order = useMemo(() => elementOrderBase(vals, mod), [vals, mod]);
  const twistOk = vals.reduce((a, b) => a + b, 0) % mod === 0;

  const setVal = (i: number, v: number) => {
    setVals(prev => { const next = [...prev]; next[i] = ((v % mod) + mod) % mod; return next; });
  };

  const ringR = 30, ringCx = 40, ringCy = 40;
  const pts = Array.from({ length: mod }, (_, i) => {
    const a = (2 * Math.PI * i) / mod - Math.PI / 2;
    return { x: ringCx + ringR * Math.cos(a), y: ringCy + ringR * Math.sin(a) };
  });

  return (
    <div className="gt-panel" style={{ marginTop: 32 }}>
      <div className="gt-panel-title">
        <L zh="底元素阶计算器" en="Base-element order calculator" />
      </div>
      <div className="gt-panel-sub">
        <L
          zh="对纯底元素 (f, id)：其阶 = lcm_{x} (m / gcd(f(x), m))。调整各槽位的扭转量，查看阶如何变化，以及总扭转是否为零（魔方合法性）。"
          en="For a pure base element (f, id): order = lcm_{x}(m / gcd(f(x), m)). Adjust slot values and see how the order changes, and whether the twist sum vanishes (cube legality)."
        />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start', marginTop: 12 }}>
        {/* Modulus selector */}
        <div>
          <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginBottom: 6 }}>
            <L zh="群阶 m (C₂ 或 C₃)" en="Group order m (C₂ or C₃)" />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[2, 3].map(m => (
              <button key={m} className={`gt-chip${mod === m ? ' gt-chip-active' : ''}`}
                onClick={() => { setMod(m); setVals(Array(8).fill(0)); }}>
                C<sub>{m}</sub> (m={m})
              </button>
            ))}
          </div>
        </div>
        {/* Ring diagram */}
        <svg viewBox="0 0 80 80" width={80} height={80} style={{ flexShrink: 0 }}>
          {pts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={8}
              fill={i === 0 ? 'var(--green)' : 'var(--bg-elev)'}
              stroke="var(--rule)" strokeWidth={1} />
          ))}
          {pts.map((p, i) => (
            <text key={i} x={p.x} y={p.y + 4} textAnchor="middle" fontSize={10}
              fill={i === 0 ? 'var(--bg)' : 'var(--ink)'}>{i}</text>
          ))}
          <text x={ringCx} y={ringCy + 4} textAnchor="middle" fontSize={9} fill="var(--ink-dim)">
            Z/{mod}
          </text>
        </svg>
      </div>
      {/* Slot values */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginBottom: 6 }}>
          <L zh="各槽位扭转值 f(x)" en="Slot twist values f(x)" />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {vals.map((v, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 10, color: 'var(--ink-dim)' }}>x{i}</span>
              <input type="number" min={0} max={mod - 1} value={v}
                onChange={e => setVal(i, parseInt(e.target.value, 10) || 0)}
                className="gt-input" style={{ width: 42, textAlign: 'center', padding: '2px 4px' }} />
            </div>
          ))}
        </div>
      </div>
      {/* Results */}
      <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg-deep)', borderRadius: 8, fontSize: 13 }}>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="元素阶" en="Element order" />
          </span>
          <span className="gt-result-val-strong">{order}</span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="∑f(x) mod m" en="∑f(x) mod m" />
          </span>
          <span style={{ color: twistOk ? 'var(--green)' : 'var(--warn)', fontWeight: 700 }}>
            {vals.reduce((a, b) => a + b, 0) % mod}
            {twistOk
              ? ` — ${tr({ zh: '合法（和为零）', en: 'legal (sum = 0)'
            })}`
              : ` — ${tr({ zh: '违反约束①', en: 'violates constraint ①'
            })}`}
          </span>
        </div>
        <div className="gt-result-row">
          <span className="gt-result-label">
            <L zh="非交换说明" en="Non-commutativity note" />
          </span>
          <span className="gt-result-val" style={{ fontSize: 11 }}>
            <L
              zh="底群 (Z/m)^n 本身是阿贝尔的，但顶置换 h 非平凡时整个圈积非阿贝尔，因为 h 会混洗底元素。"
              en="The base group (Z/m)^n is abelian, but with non-trivial top h the whole wreath product is non-abelian because h permutes the base factors."
            />
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Data table ────────────────────────────────────────────────────────────────
function WreathTable() {
  const lang = useLang();
  const rows: { A: string; n: number; mod: bigint; nameZh: string; nameEn: string; order: bigint; note: string
 }[] = [
    { A: 'C₂', n: 3,  mod: 2n, nameZh: '超八面体群 B₃', nameEn: 'Hyperoctahedral B₃', order: 48n, note: tr({ zh: '普通正方体对称群', en: 'Symmetry of the geometric cube'
    })
    },
    { A: 'C₃', n: 8,  mod: 3n, nameZh: '角块圈积',  nameEn: 'Corner wreath',  order: wreathOrder(3n, 8),  note: tr({ zh: '8 角×3 朝向', en: '8 corners × 3 orientations' })
    },
    { A: 'C₂', n: 12, mod: 2n, nameZh: '棱块圈积',  nameEn: 'Edge wreath',    order: wreathOrder(2n, 12), note: tr({ zh: '12 棱×2 翻转', en: '12 edges × 2 flips'
    })
    },
    { A: 'C₂', n: 12, mod: 2n, nameZh: '超八面体 B₁₂', nameEn: 'Hyperoctahedral B₁₂', order: wreathOrder(2n, 12), note: tr({ zh: '12维符号置换群', en: 'Signed permutations of 12 things'
    })
    },
  ];

  return (
    <table className="gt-compare" style={{ marginTop: 24, fontSize: 13 }}>
      <thead>
        <tr>
          <th><L zh="群" en="Group" /></th>
          <th><L zh="名称" en="Name" /></th>
          <th><L zh="阶 |A ≀ Sₙ|" en="Order |A ≀ Sₙ|" /></th>
          <th><L zh="说明" en="Note" /></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td><span className="gt-mono">{r.A} ≀ S{r.n}</span></td>
            <td>{lang === 'zh' ? r.nameZh : r.nameEn}</td>
            <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatBig(r.order)}</td>
            <td style={{ fontSize: 11, color: 'var(--ink-dim)' }}>{r.note}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Main section ──────────────────────────────────────────────────────────────
export default function WreathProduct() {
  // suppress unused-import lint for permSign (used for reference in prose)
  void permSign;

  return (
    <GTSec id="wreath-product" className="gt-sec">
      <div className="gt-sec-num">§33</div>
      <h2 className="gt-sec-title">
        <L zh="圈积  Wreath product" en="Wreath products" />
      </h2>

      <p className="gt-lede">
        <L
          zh={<>魔方群的精确阶——那个「43 京」——不是偶然凑出来的数字，而是两个圈积群在三条独立约束下的指数。角块给出 <TeX src={String.raw`C_3 \wr S_8`} />，棱块给出 <TeX src={String.raw`C_2 \wr S_{12}`} />，二者的直积 W 被三道筛子除以 12，剩下合法状态。</>}
          en={<>The exact order of the Rubik's cube group — those '43 quintillion' states — is not a coincidence. It is the index-12 subgroup of a direct product of two wreath products: corners give <TeX src={String.raw`C_3 \wr S_8`} />, edges give <TeX src={String.raw`C_2 \wr S_{12}`} />, and three independent invariants cut the product down by exactly a factor of 12.</>}
        />
      </p>

      {/* Definition box */}
      <div className="gt-def">
        <div className="gt-def-title">
          <L zh="定义：圈积（非本原版）" en="Definition: Wreath product (imprimitive version)" />
        </div>
        <div className="gt-def-body">
          <p>
            <L
              zh={<>设 <TeX src={String.raw`A`} /> 是一个群，<TeX src={String.raw`X`} /> 是有限集，<TeX src={String.raw`H \leq \operatorname{Sym}(X)`} /> 是作用在 <TeX src={String.raw`X`} /> 上的置换群。<strong>圈积</strong> <TeX src={String.raw`A \wr_X H`} /> 定义为半直积</>}
              en={<>Let <TeX src={String.raw`A`} /> be a group, <TeX src={String.raw`X`} /> a finite set, and <TeX src={String.raw`H \leq \operatorname{Sym}(X)`} /> a permutation group acting on <TeX src={String.raw`X`} />. The <strong>wreath product</strong> <TeX src={String.raw`A \wr_X H`} /> is defined as the semidirect product</>}
            />
          </p>
          <TeXBlock src={String.raw`A \wr_X H \;=\; A^X \rtimes H,`} />
          <p>
            <L
              zh={<>其中 <TeX src={String.raw`A^X = \{f : X \to A\}`} /> 是底群（<TeX src={String.raw`|X|`} /> 个 <TeX src={String.raw`A`} /> 的直积），<TeX src={String.raw`H`} /> 是顶群，<TeX src={String.raw`H`} /> 通过置换坐标作用于 <TeX src={String.raw`A^X`} />：</>}
              en={<>where <TeX src={String.raw`A^X = \{f : X \to A\}`} /> is the base group (a direct product of <TeX src={String.raw`|X|`} /> copies of <TeX src={String.raw`A`} />), <TeX src={String.raw`H`} /> is the top group, and <TeX src={String.raw`H`} /> acts on <TeX src={String.raw`A^X`} /> by permuting coordinates:</>}
            />
          </p>
          <TeXBlock src={String.raw`(h \cdot f)(x) = f(h^{-1} \cdot x), \quad h \in H,\; f \in A^X,\; x \in X.`} />
          <p>
            <L
              zh={<>元素是有序对 <TeX src={String.raw`(f, h)`} />；群乘法为半直积法则：</>}
              en={<>Elements are pairs <TeX src={String.raw`(f, h)`} />; multiplication follows the semidirect product law:</>}
            />
          </p>
          <TeXBlock src={String.raw`(f_1, h_1)(f_2, h_2) = \bigl(f_1 \cdot (h_1 \cdot f_2),\; h_1 h_2\bigr),`} />
          <p style={{ fontSize: 13, color: 'var(--ink-dim)' }}>
            <L
              zh={<>即第 <TeX src={String.raw`x`} /> 坐标处的值为 <TeX src={String.raw`f_1(x) \cdot f_2(h_1^{-1} \cdot x)`} />。注意这<em>不是</em>直积：顶置换的作用是整个定义的核心。</>}
              en={<>i.e. the value at coordinate <TeX src={String.raw`x`} /> is <TeX src={String.raw`f_1(x) \cdot f_2(h_1^{-1} \cdot x)`} />. This is <em>not</em> a direct product: the action of the top group is the whole point.</>}
            />
          </p>
          <p>
            <L
              zh={<>当 <TeX src={String.raw`H = S_n`} />（<TeX src={String.raw`X = \{1,\ldots,n\}`} />）时写作 <TeX src={String.raw`A \wr S_n`} />，称为<strong>标准圈积</strong>。阶公式：</>}
              en={<>When <TeX src={String.raw`H = S_n`} /> (<TeX src={String.raw`X = \{1,\ldots,n\}`} />) one writes <TeX src={String.raw`A \wr S_n`} /> (the standard wreath product). Order formula:</>}
            />
          </p>
          <TeXBlock src={String.raw`|A \wr_X H| = |A|^{|X|} \cdot |H|.`} />
        </div>
      </div>

      <p style={{ marginTop: 20 }}>
        <L
          zh={<>圈积是半直积，不是直积：<TeX src={String.raw`C_3 \wr S_8 \neq C_3 \times S_8`} />。底群 <TeX src={String.raw`(C_3)^8`} /> 虽然交换，但 <TeX src={String.raw`S_8`} /> 对它的作用使整个圈积不交换。两个元素 <TeX src={String.raw`(f_1, h_1)`} /> 和 <TeX src={String.raw`(f_2, h_2)`} /> 相乘时，第二个因子的底值会被第一个因子的置换「混洗」再相加——这正是下方演示器展示的行为。</>}
          en={<>The wreath product is a semidirect product, not a direct product: <TeX src={String.raw`C_3 \wr S_8 \neq C_3 \times S_8`} />. The base group <TeX src={String.raw`(C_3)^8`} /> is abelian, but the action of <TeX src={String.raw`S_8`} /> on it makes the entire wreath product non-abelian. When multiplying <TeX src={String.raw`(f_1, h_1) \cdot (f_2, h_2)`} />, the second base vector gets shuffled by the first permutation before the componentwise addition — this is exactly what the builder below demonstrates.</>}
        />
      </p>

      {/* Theorem box */}
      <div className="gt-thm" style={{ marginTop: 28 }}>
        <div className="gt-thm-title">
          <L zh="定理：魔方群是 W 的指数 12 子群" en="Theorem: The cube group is an index-12 subgroup of W" />
        </div>
        <div className="gt-thm-body">
          <p>
            <L
              zh={<>令 <TeX src={String.raw`W = (C_3 \wr S_8) \times (C_2 \wr S_{12})`} />（角块圈积直积棱块圈积），其阶为</>}
              en={<>Let <TeX src={String.raw`W = (C_3 \wr S_8) \times (C_2 \wr S_{12})`} /> (corner wreath product times edge wreath product), with order</>}
            />
          </p>
          <TeXBlock src={String.raw`|W| = 3^8 \cdot 8! \cdot 2^{12} \cdot 12! = 519\,024\,039\,293\,878\,272\,000.`} />
          <p>
            <L
              zh={<>魔方群 <TeX src={String.raw`G`} /> 是 <TeX src={String.raw`W`} /> 中满足以下三条约束的子群：</>}
              en={<>The Rubik's cube group <TeX src={String.raw`G`} /> is the subgroup of <TeX src={String.raw`W`} /> satisfying three constraints:</>}
            />
          </p>
          <ol style={{ paddingLeft: 22, lineHeight: 1.8, fontSize: 14 }}>
            <li>
              <L zh={<><strong>约束①</strong> 总角扭转 <TeX src={String.raw`\equiv 0 \pmod{3}`} />（8 个角扭转量之和 mod 3 = 0）</>}
                  en={<><strong>Constraint ①</strong> Total corner twist <TeX src={String.raw`\equiv 0 \pmod{3}`} /> (sum of 8 corner orientation values mod 3 = 0)</>} />
            </li>
            <li>
              <L zh={<><strong>约束②</strong> 总棱翻转 <TeX src={String.raw`\equiv 0 \pmod{2}`} />（12 个棱翻转量之和 mod 2 = 0）</>}
                  en={<><strong>Constraint ②</strong> Total edge flip <TeX src={String.raw`\equiv 0 \pmod{2}`} /> (sum of 12 edge orientation values mod 2 = 0)</>} />
            </li>
            <li>
              <L zh={<><strong>约束③</strong> 角置换奇偶性 = 棱置换奇偶性（<TeX src={String.raw`\operatorname{sgn}(\sigma_c) = \operatorname{sgn}(\sigma_e)`} />）</>}
                  en={<><strong>Constraint ③</strong> Corner permutation parity equals edge permutation parity (<TeX src={String.raw`\operatorname{sgn}(\sigma_c) = \operatorname{sgn}(\sigma_e)`} />)</>} />
            </li>
          </ol>
          <p>
            <L
              zh={<>这三条约束各自是 W 到 <TeX src={String.raw`C_3,\,C_2,\,C_2`} /> 的满同态的核，且三者相互独立（联合像恰为 <TeX src={String.raw`C_3 \times C_2 \times C_2`} />），因此 <TeX src={String.raw`[W:G] = 3 \cdot 2 \cdot 2 = 12`} />，从而</>}
              en={<>These three constraints are kernels of independent surjective homomorphisms <TeX src={String.raw`W \to C_3,\,C_2,\,C_2`} /> with joint image all of <TeX src={String.raw`C_3 \times C_2 \times C_2`} />, so <TeX src={String.raw`[W:G] = 3 \cdot 2 \cdot 2 = 12`} />, giving</>}
            />
          </p>
          <TeXBlock src={String.raw`|G| = \frac{|W|}{12} = 43\,252\,003\,274\,489\,856\,000.`} />
          <p style={{ fontSize: 13, color: 'var(--ink-dim)' }}>
            <L
              zh="这就是「43 京」——你无法单独扭转一个角块、单独翻转一条棱或单独对换两块，因为每种操作都会违反上述某条不变量。"
              en="This is the '43 quintillion'. You cannot twist a single corner, flip a single edge, or swap only two pieces in isolation, because each such operation violates one of the three invariants above."
            />
          </p>
        </div>
      </div>

      {/* Aside: hyperoctahedral */}
      <div className="gt-aside" style={{ marginTop: 24 }}>
        <L
          zh={<><strong>超八面体群 <TeX src={String.raw`B_n = C_2 \wr S_n`} /></strong>——阶 <TeX src={String.raw`2^n \cdot n!`} />——是 <TeX src={String.raw`n`} /> 维超立方体的对称群，也叫「符号置换群」。<TeX src={String.raw`B_3`} />（阶 48）是普通正方体作为几何固体的完整对称群；棱块因子 <TeX src={String.raw`C_2 \wr S_{12} = B_{12}`} />（阶约 1.96 万亿）则与魔方的棱块模型对应。两者不要混淆。</>}
          en={<><strong>The hyperoctahedral group <TeX src={String.raw`B_n = C_2 \wr S_n`} /></strong> of order <TeX src={String.raw`2^n \cdot n!`} /> is the symmetry group of the <TeX src={String.raw`n`} />-dimensional hypercube (also called the signed-permutation group). <TeX src={String.raw`B_3`} /> (order 48) is the full symmetry group of the geometric cube as a solid; the edge wreath factor <TeX src={String.raw`C_2 \wr S_{12} = B_{12}`} /> (order ≈ 1.96 trillion) models the Rubik's cube edge pieces. Do not conflate the two.</>}
        />
      </div>

      {/* Subsection heading: imprimitive action */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="非本原作用与块系" en="Imprimitive action and blocks of imprimitivity" />
      </h3>
      <p>
        <L
          zh={<>圈积 <TeX src={String.raw`A \wr_X H`} /> 自然地作用在集合 <TeX src={String.raw`X \times A`} /> 上（当 A 作用在自身时）：</>}
          en={<>The wreath product <TeX src={String.raw`A \wr_X H`} /> acts naturally on <TeX src={String.raw`X \times A`} /> (when <TeX src={String.raw`A`} /> acts on itself) via</>}
        />
      </p>
      <TeXBlock src={String.raw`(f, h) \cdot (x, a) = \bigl(h \cdot x,\; f(h \cdot x) \cdot a\bigr).`} />
      <p>
        <L
          zh={<>块 <TeX src={String.raw`\{x\} \times A`} />（对每个 <TeX src={String.raw`x \in X`} />）构成一个块系：<TeX src={String.raw`H`} /> 将整块映到整块，<TeX src={String.raw`A`} /> 在每块内部旋转。这正是魔方贴纸的结构：8 个「角槽」各含 3 张贴纸，12 个「棱槽」各含 2 张贴纸——圈积恰好是保持这种块分解结构的置换群。</>}
          en={<>The blocks <TeX src={String.raw`\{x\} \times A`} /> (one for each <TeX src={String.raw`x \in X`} />) form a system of imprimitivity: <TeX src={String.raw`H`} /> maps each block to a whole block, while <TeX src={String.raw`A`} /> rotates within each block. This is exactly the structure of the Rubik's cube facelets: 8 corner slots with 3 facelets each, 12 edge slots with 2 facelets each — the wreath product is precisely the group of permutations preserving this block decomposition.</>}
        />
      </p>
      <p>
        <L
          zh={<><strong>Krasner–Kaloujnine 嵌入定理（1951）</strong>：若 <TeX src={String.raw`1 \to A \to E \to H \to 1`} /> 正合，则 <TeX src={String.raw`E`} /> 可嵌入正则圈积 <TeX src={String.raw`A \wr H`} />。因此任何以 <TeX src={String.raw`A`} /> 为核、<TeX src={String.raw`H`} /> 为商的群扩张，都可在圈积内实现——圈积是扩张的「通用上界」。</>}
          en={<><strong>The Krasner–Kaloujnine embedding theorem (1951)</strong>: if <TeX src={String.raw`1 \to A \to E \to H \to 1`} /> is exact, then <TeX src={String.raw`E`} /> embeds in the regular wreath product <TeX src={String.raw`A \wr H`} />. Thus any group extension with kernel <TeX src={String.raw`A`} /> and quotient <TeX src={String.raw`H`} /> can be realised inside a wreath product — the wreath product is the universal upper bound for such extensions.</>}
        />
      </p>

      {/* Wreath order table */}
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 14, color: 'var(--ink)' }}>
        <L zh="阶数一览" en="Order table" />
      </h3>
      <WreathTable />

      {/* Widget 1 */}
      <WreathBuilder />

      {/* Widget 2 */}
      <IndexSieve />

      {/* Widget 3 */}
      <OrderExplorer />

      {/* Pullquote */}
      <blockquote className="gt-pullquote" style={{ marginTop: 40 }}>
        <L
          zh="为什么扭转单个角块是不可能的？因为在 C₃≀S₈ 的语言里，那需要一个总和不为零的底元素，而这样的元素不在合法子群里。圈积把物理约束翻译成代数语言。"
          en="Why is it impossible to twist a single corner? Because in the language of C₃≀S₈, that requires a base element whose sum is nonzero — and such elements are not in the legal subgroup. The wreath product translates the physical constraint into algebra."
        />
        <div className="gt-pullquote-cite">
          <L zh="— 圈积与魔方群" en="— Wreath products and the cube group" />
        </div>
      </blockquote>

      {/* References */}
      <div className="gt-aside" style={{ marginTop: 32 }}>
        <strong><L zh="参考文献" en="References" /></strong>
        <ol style={{ paddingLeft: 20, marginTop: 8, fontSize: 13, color: 'var(--ink-dim)', lineHeight: 1.7 }}>
          <li>David Joyner, <em>Adventures in Group Theory</em>, 2nd ed., Johns Hopkins UP, 2008 (ISBN 978-0-8018-9012-3) — cube group as index-12 subgroup of <TeX src={String.raw`(C_3 \wr S_8)\times(C_2 \wr S_{12})`} />.</li>
          <li>Christoph Bandelow, <em>Inside Rubik's Cube and Beyond</em>, Birkhäuser, 1982 (ISBN 978-3-7643-3078-2) — fundamental theorem of cubology, the three invariants.</li>
          <li>J. D. P. Meldrum, <em>Wreath Products of Groups and Semigroups</em>, Pitman Monographs 74, Longman, 1995 (ISBN 978-0-582-02693-3) — rigorous treatment, order formula, Krasner–Kaloujnine theorem.</li>
        </ol>
      </div>
    </GTSec>
  );
}
