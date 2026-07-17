'use client';

import { useState, useMemo, useEffect } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { tr } from '@/i18n/tr';

function PermutationVisualiser() {
  const lang = useLang();
  const [input, setInput] = useState('2 3 1 5 4 6');
  const parsed = useMemo(() => {
    const tokens = input.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (!tokens.every(t => Number.isInteger(t) && t >= 1)) {
      return { valid: false, perm: [] as number[], error: tr({ zh: '请输入正整数序列', en: 'enter positive integers'
    }) };
    }
    const n = tokens.length;
    const sorted = [...tokens].sort((a, b) => a - b);
    for (let i = 0; i < n; i++) if (sorted[i] !== i + 1) {
      return { valid: false, perm: [] as number[], error: lang === 'zh' ? `必须是 1..${n} 的排列` : `must be a permutation of 1..${n}` };
    }
    return { valid: true, perm: tokens };
  }, [input, lang]);

  if (!parsed.valid) {
    return (
      <div className="gt-permvis">
        <div className="gt-permvis-input-row">
          <label>{tr({ zh: '排列 σ', en: 'permutation σ' })}</label>
          <input type="text" className="gt-input" value={input} onChange={e => setInput(e.target.value)} />
        </div>
        <div className="gt-permvis-error">{parsed.error}</div>
      </div>
    );
  }

  const perm = parsed.perm;
  const n = perm.length;
  // Cycle decomposition (1-indexed)
  const cycles: number[][] = [];
  const seen = new Set<number>();
  for (let i = 1; i <= n; i++) {
    if (seen.has(i)) continue;
    const cyc: number[] = [i];
    seen.add(i);
    let cur = perm[i - 1];
    while (cur !== i) {
      cyc.push(cur);
      seen.add(cur);
      cur = perm[cur - 1];
    }
    cycles.push(cyc);
  }
  // Crossing number: count inversions when drawing lines from top to bottom
  let crossings = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    // Line i goes to position perm[i]-1 (0-indexed)
    // Cross with line j (goes to perm[j]-1) iff perm[i] > perm[j]
    if (perm[i] > perm[j]) crossings++;
  }
  const parity = crossings % 2 === 0 ? '+1' : '−1';
  const lcm = (a: number, b: number): number => (a * b) / gcdInt(a, b);
  function gcdInt(a: number, b: number): number { return b === 0 ? a : gcdInt(b, a % b); }
  const order = cycles.reduce((acc, c) => lcm(acc, c.length), 1);

  // Layout: 2 rows of n nodes, draw lines i -> perm[i]
  const W = Math.max(220, n * 44);
  const H = 110;
  const xOf = (i: number) => (i + 0.5) * (W / n);

  const cycleColor = ['#8B2E3C', '#2A4D69', '#3F7050', '#B8860B', '#6B4E9C', '#C2410C', '#5C7CA0', '#9C4E6B'];
  const cycleOfPos = new Map<number, number>();
  cycles.forEach((cyc, ci) => cyc.forEach(v => cycleOfPos.set(v, ci)));

  return (
    <div className="gt-permvis">
      <div className="gt-permvis-input-row">
        <label>{tr({ zh: '排列 σ', en: 'permutation σ' })}</label>
        <input
          type="text"
          className="gt-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          spellCheck={false}
          placeholder="2 3 1 5 4 6"
        />
        <div className="gt-permvis-presets">
          <button type="button" className="gt-chip" onClick={() => setInput('2 3 1 5 4 6')}>{tr({ zh: '示例 1', en: 'ex 1' })}</button>
          <button type="button" className="gt-chip" onClick={() => setInput('2 1')}>{tr({ zh: '对换', en: 'swap'
        })}</button>
          <button type="button" className="gt-chip" onClick={() => setInput('5 4 3 2 1')}>{tr({ zh: '反序', en: 'reverse' })}</button>
          <button type="button" className="gt-chip" onClick={() => setInput('2 3 4 5 6 7 1')}>{tr({ zh: '7-循环', en: '7-cycle'
        })}</button>
        </div>
      </div>
      <svg className="gt-permvis-svg" viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="xMidYMid meet">
        {perm.map((dest, i) => {
          const colorIdx = cycleOfPos.get(i + 1) ?? 0;
          const color = cycleColor[colorIdx % cycleColor.length];
          return (
            <line
              key={i}
              x1={xOf(i)} y1={20}
              x2={xOf(dest - 1)} y2={H - 20}
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
            />
          );
        })}
        {Array.from({ length: n }, (_, i) => (
          <g key={`top-${i}`}>
            <circle cx={xOf(i)} cy={20} r={10} fill="var(--bg-elev)" stroke="var(--ink)" strokeWidth={1.2} />
            <text x={xOf(i)} y={24} textAnchor="middle" fontSize={11} fontFamily="var(--mono)" fill="var(--ink)">{i + 1}</text>
          </g>
        ))}
        {Array.from({ length: n }, (_, i) => (
          <g key={`bot-${i}`}>
            <circle cx={xOf(i)} cy={H - 20} r={10} fill="var(--bg-elev)" stroke="var(--ink)" strokeWidth={1.2} />
            <text x={xOf(i)} y={H - 16} textAnchor="middle" fontSize={11} fontFamily="var(--mono)" fill="var(--ink)">{i + 1}</text>
          </g>
        ))}
      </svg>
      <div className="gt-permvis-results">
        <div className="gt-result-row">
          <div className="gt-result-label">{tr({ zh: '两行记号', en: 'two-line'
        })}</div>
          <div className="gt-result-val">
            ({Array.from({ length: n }, (_, i) => i + 1).join(' ')} / {perm.join(' ')})
          </div>
        </div>
        <div className="gt-result-row">
          <div className="gt-result-label">{tr({ zh: '循环分解', en: 'cycle decomp.'
        })}</div>
          <div className="gt-result-val">
            {cycles.filter(c => c.length > 1).map((c, i) => (
              <span key={i} style={{ color: cycleColor[cycles.indexOf(c) % cycleColor.length] }}>
                ({c.join(' ')})
              </span>
            )) || tr({ zh: '恒等', en: 'identity'
                                      })}
            {cycles.every(c => c.length === 1) && tr({ zh: '恒等 (e)', en: 'identity (e)'
                                  })}
          </div>
        </div>
        <div className="gt-result-row">
          <div className="gt-result-label">{tr({ zh: '交叉数', en: 'crossings'
        })}</div>
          <div className="gt-result-val">{crossings}</div>
        </div>
        <div className="gt-result-row">
          <div className="gt-result-label">{tr({ zh: '奇偶性 sgn(σ)', en: 'parity sgn(σ)' })}</div>
          <div className="gt-result-val" style={{ color: parity === '+1' ? 'var(--green)' : 'var(--accent)' }}>
            {parity} ({parity === '+1' ? tr({ zh: '偶', en: 'even' }) : tr({ zh: '奇', en: 'odd' })})
          </div>
        </div>
        <div className="gt-result-row">
          <div className="gt-result-label">{tr({ zh: '阶 ord(σ)', en: 'order ord(σ)'
        })}</div>
          <div className="gt-result-val">
            {order} = lcm({cycles.filter(c => c.length > 1).map(c => c.length).join(', ') || '1'})
          </div>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════
function parsePerm(input: string, fallbackN?: number): { perm: number[]; n: number; error?: string } {
  const trimmed = input.trim();
  if (!trimmed) return { perm: [], n: 0, error: 'empty' };
  // Cycle notation: extract groups in parentheses.
  if (/[()]/.test(trimmed)) {
    const cycleGroups = [...trimmed.matchAll(/\(([^)]*)\)/g)].map(m =>
      m[1].trim().split(/[\s,]+/).filter(Boolean).map(Number)
    );
    if (cycleGroups.some(g => g.some(x => !Number.isInteger(x) || x < 1))) {
      return { perm: [], n: 0, error: 'bad cycle tokens' };
    }
    const maxVal = Math.max(0, ...cycleGroups.flat());
    const n = fallbackN ?? maxVal;
    if (n < 1) return { perm: [], n: 0, error: 'no elements' };
    const perm = Array.from({ length: n }, (_, i) => i + 1);
    for (const cyc of cycleGroups) {
      for (let i = 0; i < cyc.length; i++) {
        const from = cyc[i];
        const to = cyc[(i + 1) % cyc.length];
        if (from > n || to > n) return { perm: [], n: 0, error: `out of range (>${n})` };
        perm[from - 1] = to;
      }
    }
    return { perm, n };
  }
  // Two-line: just the bottom row, top assumed 1..n.
  const toks = trimmed.split(/[\s,]+/).filter(Boolean).map(Number);
  if (toks.some(t => !Number.isInteger(t) || t < 1)) {
    return { perm: [], n: 0, error: 'positive integers only' };
  }
  const sorted = [...toks].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] !== i + 1) return { perm: [], n: 0, error: `must be permutation of 1..${sorted.length}` };
  }
  return { perm: toks, n: toks.length };
}

/** Decompose a 1-indexed permutation into disjoint cycles. */

function decomposeCycles(perm: number[]): number[][] {
  const n = perm.length;
  const seen = new Set<number>();
  const cycles: number[][] = [];
  for (let i = 1; i <= n; i++) {
    if (seen.has(i)) continue;
    const cyc: number[] = [i];
    seen.add(i);
    let cur = perm[i - 1];
    while (cur !== i) {
      cyc.push(cur);
      seen.add(cur);
      cur = perm[cur - 1];
    }
    cycles.push(cyc);
  }
  return cycles;
}

/** Format cycle list as "(1 2 3)(4 5)"; identity prints as "e". */

function fmtCycles(cycles: number[][]): string {
  const nontriv = cycles.filter(c => c.length > 1);
  if (nontriv.length === 0) return 'e';
  return nontriv.map(c => `(${c.join(' ')})`).join('');
}

/** Compose two 1-indexed perms.  (a∘b)(i) = a(b(i))  — "first b, then a". */

function composePerm(a: number[], b: number[]): number[] {
  const n = Math.max(a.length, b.length);
  const aExt = Array.from({ length: n }, (_, i) => a[i] ?? i + 1);
  const bExt = Array.from({ length: n }, (_, i) => b[i] ?? i + 1);
  return Array.from({ length: n }, (_, i) => aExt[bExt[i] - 1]);
}

/** Invert a 1-indexed perm. */

function invertPerm(p: number[]): number[] {
  const n = p.length;
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) out[p[i] - 1] = i + 1;
  return out;
}

function gcdInt(a: number, b: number): number { return b === 0 ? a : gcdInt(b, a % b); }

function lcmInt(a: number, b: number): number { return (a * b) / gcdInt(a, b); }

function permOrder(perm: number[]): number {
  return decomposeCycles(perm).reduce((acc, c) => lcmInt(acc, c.length), 1);
}

function permParitySign(perm: number[]): 1 | -1 {
  // (-1)^(n - #cycles incl. fixed points)
  const c = decomposeCycles(perm).length;
  return ((perm.length - c) % 2 === 0 ? 1 : -1);
}

// ── 32.3 widget: TwoLineNotationDemo ────────────────────────────────────────

// ── 32.3 widget: TwoLineNotationDemo ────────────────────────────────────────
function TwoLineNotationDemo() {
  const [input, setInput] = useState('3 1 4 5 2');
  const [showCycle, setShowCycle] = useState(false);
  const parsed = useMemo(() => parsePerm(input), [input]);
  if (parsed.error || parsed.n === 0) {
    return (
      <div className="gt-useful-twoline">
        <div className="gt-panel-input-row">
          <label>{tr({ zh: '排列 (输入下行)', en: 'permutation (bottom row)'
        })}</label>
          <input className="gt-input" value={input} onChange={e => setInput(e.target.value)} spellCheck={false} />
        </div>
        <div className="gt-permvis-error">{parsed.error}</div>
      </div>
    );
  }
  const perm = parsed.perm;
  const n = parsed.n;
  const cycles = decomposeCycles(perm);
  return (
    <div className="gt-useful-twoline">
      <div className="gt-panel-input-row">
        <label>{tr({ zh: '下行 σ(1)..σ(n)', en: 'bottom row σ(1)..σ(n)' })}</label>
        <input className="gt-input" value={input} onChange={e => setInput(e.target.value)} spellCheck={false} />
        <button type="button" className="gt-chip" onClick={() => setShowCycle(s => !s)}>
          {showCycle ? tr({ zh: '看两行', en: 'show two-line'
                          }) : tr({ zh: '看循环', en: 'show cycles'
                              })}
        </button>
      </div>
      <div className="gt-useful-twoline-eq">
        {!showCycle ? (
          <table className="gt-useful-twoline-tbl">
            <tbody>
              <tr>{Array.from({ length: n }, (_, i) => <td key={`t${i}`} className="gt-useful-twoline-top">{i + 1}</td>)}</tr>
              <tr>{perm.map((v, i) => <td key={`b${i}`} className="gt-useful-twoline-bot">{v}</td>)}</tr>
            </tbody>
          </table>
        ) : (
          <div className="gt-useful-twoline-cycles">{fmtCycles(cycles)}</div>
        )}
      </div>
    </div>
  );
}

// ── 32.4 widget: CycleDecomposer (with animated trace) ──────────────────────

// ── 32.4 widget: CycleDecomposer (with animated trace) ──────────────────────
function CycleDecomposer() {
  const [input, setInput] = useState('4 5 2 1 3 7 6');
  const [step, setStep] = useState(0);
  const parsed = useMemo(() => parsePerm(input), [input]);
  // Build a flat step list: each step adds one element to the running cycle.
  const trace = useMemo(() => {
    if (!parsed.perm.length) return [] as { cycleIdx: number; val: number; closes: boolean }[];
    const cyc = decomposeCycles(parsed.perm);
    const out: { cycleIdx: number; val: number; closes: boolean }[] = [];
    cyc.forEach((c, ci) => c.forEach((v, j) => out.push({ cycleIdx: ci, val: v, closes: j === c.length - 1 })));
    return out;
  }, [parsed.perm]);
  const total = trace.length;
  const visibleCycles: number[][] = [];
  for (let i = 0; i <= step && i < total; i++) {
    const { cycleIdx, val } = trace[i];
    if (!visibleCycles[cycleIdx]) visibleCycles[cycleIdx] = [];
    visibleCycles[cycleIdx].push(val);
  }
  return (
    <div className="gt-useful-decompose">
      <div className="gt-panel-input-row">
        <label>{tr({ zh: '排列', en: 'permutation' })}</label>
        <input className="gt-input" value={input} onChange={e => { setInput(e.target.value); setStep(0); }} spellCheck={false} />
      </div>
      {parsed.error && <div className="gt-permvis-error">{parsed.error}</div>}
      {!parsed.error && (
        <>
          <div className="gt-useful-decompose-controls">
            <button type="button" className="gt-chip" onClick={() => setStep(0)} disabled={step === 0}>{tr({ zh: '重置', en: 'reset' })}</button>
            <button type="button" className="gt-chip" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}>← {tr({ zh: '上一步', en: 'prev' })}</button>
            <button type="button" className="gt-chip" onClick={() => setStep(s => Math.min(total - 1, s + 1))} disabled={step >= total - 1}>{tr({ zh: '下一步', en: 'next' })} →</button>
            <button type="button" className="gt-chip" onClick={() => setStep(total - 1)} disabled={step >= total - 1}>{tr({ zh: '全部', en: 'all' })}</button>
            <span className="gt-useful-decompose-counter">{step + 1} / {total}</span>
          </div>
          <div className="gt-useful-decompose-cycles">
            {visibleCycles.map((c, i) => (
              <span key={i} className="gt-useful-decompose-cycle">({c.join(' → ')}{c.length > 1 && trace[step] && trace[step].cycleIdx === i && trace[step].closes ? ` → ${c[0]}` : ''})</span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── 32.5 widget: ComposeConventions ────────────────────────────────────────

// ── 32.5 widget: ComposeConventions ────────────────────────────────────────
function ComposeConventions() {
  const [aInput, setAInput] = useState('(1 2)(3 4)');
  const [bInput, setBInput] = useState('(1 3)');
  const N = 4;
  const aP = parsePerm(aInput, N);
  const bP = parsePerm(bInput, N);
  if (aP.error || bP.error) {
    return (
      <div className="gt-useful-compose">
        <div className="gt-panel-input-row"><label>σ</label><input className="gt-input" value={aInput} onChange={e => setAInput(e.target.value)} /></div>
        <div className="gt-panel-input-row"><label>τ</label><input className="gt-input" value={bInput} onChange={e => setBInput(e.target.value)} /></div>
        <div className="gt-permvis-error">{aP.error ?? bP.error}</div>
      </div>
    );
  }
  // Pad both to N so values match.
  const pad = (p: number[]) => Array.from({ length: N }, (_, i) => p[i] ?? i + 1);
  const a = pad(aP.perm);
  const b = pad(bP.perm);
  const mathStTau = composePerm(a, b);      // σ∘τ: first τ then σ
  const cubeAfterB = composePerm(b, a);      // "alg A B": first A then B  -> b∘a
  return (
    <div className="gt-useful-compose">
      <div className="gt-panel-input-row"><label>σ</label><input className="gt-input" value={aInput} onChange={e => setAInput(e.target.value)} spellCheck={false} /></div>
      <div className="gt-panel-input-row"><label>τ</label><input className="gt-input" value={bInput} onChange={e => setBInput(e.target.value)} spellCheck={false} /></div>
      <div className="gt-useful-compose-grid">
        <div className="gt-useful-compose-cell">
          <div className="gt-useful-compose-head">{tr({ zh: '数学约定 σ∘τ', en: 'math σ∘τ'
        })}</div>
          <div className="gt-useful-compose-sub">{tr({ zh: '先 τ 后 σ — (σ∘τ)(i) = σ(τ(i))', en: 'first τ then σ — (σ∘τ)(i) = σ(τ(i))'
        })}</div>
          <div className="gt-useful-compose-result">{fmtCycles(decomposeCycles(mathStTau))}</div>
        </div>
        <div className="gt-useful-compose-cell">
          <div className="gt-useful-compose-head">{tr({ zh: '魔方约定 "σ τ"', en: 'cuber "σ τ"'
        })}</div>
          <div className="gt-useful-compose-sub">{tr({ zh: '先 σ 后 τ — 跟读法一致', en: 'first σ then τ — read left to right'
        })}</div>
          <div className="gt-useful-compose-result">{fmtCycles(decomposeCycles(cubeAfterB))}</div>
        </div>
      </div>
    </div>
  );
}

// ── 32.6 widget: ParityFromTranspositions ──────────────────────────────────

// ── 32.6 widget: ParityFromTranspositions ──────────────────────────────────
function ParityFromTranspositions() {
  const lang = useLang();
  const [input, setInput] = useState('(1 2)(2 3)(3 4)(1 4)');
  // Each parenthesised group must be a 2-cycle.
  const parsed = useMemo(() => {
    const groups = [...input.matchAll(/\(([^)]*)\)/g)].map(m => m[1].trim().split(/[\s,]+/).filter(Boolean).map(Number));
    if (groups.length === 0) return { ok: false as const, error: 'no transpositions found' };
    for (const g of groups) {
      if (g.length !== 2 || !g.every(Number.isInteger) || g.some(x => x < 1)) return { ok: false as const, error: 'each group must be a 2-cycle (a b)' };
    }
    return { ok: true as const, groups };
  }, [input]);
  if (!parsed.ok) {
    return (
      <div className="gt-useful-parity">
        <div className="gt-panel-input-row"><label>{tr({ zh: '对换序列', en: 'transpositions'
        })}</label><input className="gt-input" value={input} onChange={e => setInput(e.target.value)} spellCheck={false} /></div>
        <div className="gt-permvis-error">{parsed.error}</div>
      </div>
    );
  }
  const k = parsed.groups.length;
  const maxV = Math.max(...parsed.groups.flat());
  // Apply right-to-left as math convention.
  let acc = Array.from({ length: maxV }, (_, i) => i + 1);
  for (const g of [...parsed.groups].reverse()) {
    const t = Array.from({ length: maxV }, (_, i) => i + 1);
    [t[g[0] - 1], t[g[1] - 1]] = [g[1], g[0]];
    acc = composePerm(t, acc);
  }
  const sign = permParitySign(acc);
  return (
    <div className="gt-useful-parity">
      <div className="gt-panel-input-row">
        <label>{tr({ zh: '对换序列', en: 'transpositions'
        })}</label>
        <input className="gt-input" value={input} onChange={e => setInput(e.target.value)} spellCheck={false} />
      </div>
      <div className="gt-useful-parity-results">
        <div><b>{tr({ zh: '个数 k', en: 'count k'
        })}:</b> {k}</div>
        <div><b>{tr({ zh: '乘积', en: 'product'
        })}:</b> {fmtCycles(decomposeCycles(acc))}</div>
        <div><b>(−1)<sup>k</sup>:</b> {k % 2 === 0 ? '+1' : '−1'}</div>
        <div><b>sgn(σ):</b> <span style={{ color: sign === 1 ? 'var(--green)' : 'var(--accent)' }}>{sign === 1 ? '+1' : '−1'} ({sign === 1 ? tr({ zh: '偶', en: 'even' }) : tr({ zh: '奇', en: 'odd' })})</span></div>
        <div className="gt-useful-parity-match">{((k % 2 === 0 ? 1 : -1) === sign) ? (lang === 'zh' ? '✓ (−1)ᵏ = sgn(σ)' : '✓ (−1)ᵏ = sgn(σ)') : '✗'}</div>
      </div>
    </div>
  );
}

// ── 32.7 widget: OrderCalculator ────────────────────────────────────────────

// ── 32.7 widget: OrderCalculator ────────────────────────────────────────────
function OrderCalculator() {
  const [input, setInput] = useState('(1 2 3)(4 5)(6 7 8 9 10 11)');
  const parsed = useMemo(() => parsePerm(input), [input]);
  if (parsed.error) {
    return (
      <div className="gt-useful-order">
        <div className="gt-panel-input-row"><label>{tr({ zh: '排列', en: 'permutation' })}</label><input className="gt-input" value={input} onChange={e => setInput(e.target.value)} spellCheck={false} /></div>
        <div className="gt-permvis-error">{parsed.error}</div>
      </div>
    );
  }
  const cycles = decomposeCycles(parsed.perm).filter(c => c.length > 1);
  const lens = cycles.map(c => c.length);
  const ord = lens.length === 0 ? 1 : lens.reduce(lcmInt, 1);
  return (
    <div className="gt-useful-order">
      <div className="gt-panel-input-row">
        <label>{tr({ zh: '排列', en: 'permutation' })}</label>
        <input className="gt-input" value={input} onChange={e => setInput(e.target.value)} spellCheck={false} />
      </div>
      <div className="gt-useful-order-formula">
        ord(σ) = lcm({lens.length === 0 ? '1' : lens.join(', ')}) = <b>{ord}</b>
      </div>
    </div>
  );
}

// ── 32.7b widget: LandauTable ──────────────────────────────────────────────

// ── 32.7b widget: LandauTable ──────────────────────────────────────────────
function LandauTable() {
  // Landau's function g(n) for n = 1..20.
  const g: { n: number; gn: number; example: string }[] = [
    { n: 1, gn: 1, example: '(1)' },
    { n: 2, gn: 2, example: '(1 2)' },
    { n: 3, gn: 3, example: '(1 2 3)' },
    { n: 4, gn: 4, example: '(1 2 3 4)' },
    { n: 5, gn: 6, example: '(1 2)(3 4 5)' },
    { n: 6, gn: 6, example: '(1 2 3)(4 5 6) / (1 2 3 4 5 6)' },
    { n: 7, gn: 12, example: '(1 2 3)(4 5 6 7)' },
    { n: 8, gn: 15, example: '(1 2 3)(4 5 6 7 8)' },
    { n: 9, gn: 20, example: '(1 2 3 4)(5 6 7 8 9)' },
    { n: 10, gn: 30, example: '(1 2)(3 4 5)(6 7 8 9 10)' },
    { n: 11, gn: 30, example: '(1 2 3)(4..8)(9 10 11) → 30' },
    { n: 12, gn: 60, example: '(1..3)(4..7)(8..12) — 3·4·5 ⇒ 60' },
    { n: 13, gn: 60, example: '+ fixed point' },
    { n: 14, gn: 84, example: '(1..3)(4..7)(8..14) — 3·4·7' },
    { n: 15, gn: 105, example: '(1..3)(4..8)(9..15) — 3·5·7' },
    { n: 16, gn: 140, example: '(1..4)(5..9)(10..16) — 4·5·7' },
    { n: 17, gn: 210, example: '(1..2)(3..5)(6..10)(11..17) — 2·3·5·7' },
    { n: 18, gn: 210, example: 'same partition + fixed' },
    { n: 19, gn: 420, example: '(1..4)(5..7)(8..12)(13..19) — 4·3·5·7' },
    { n: 20, gn: 420, example: 'same partition + fixed' },
  ];
  return (
    <table className="gt-useful-landau">
      <thead>
        <tr>
          <th>n</th>
          <th>g(n) = max ord</th>
          <th>{tr({ zh: '达到的循环结构', en: 'extremal cycle type'
        })}</th>
        </tr>
      </thead>
      <tbody>
        {g.map(r => (
          <tr key={r.n}>
            <td className="num">{r.n}</td>
            <td className="num"><b>{r.gn}</b></td>
            <td>{r.example}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── 32.8 widget: ConjugationVisualiser ──────────────────────────────────────

// ── 32.8 widget: ConjugationVisualiser ──────────────────────────────────────
function ConjugationVisualiser() {
  const [sigmaInput, setSigmaInput] = useState('(1 2 3 4 5)');
  const [tauInput, setTauInput] = useState('(1 2)(3 4)');
  const sP = parsePerm(sigmaInput);
  const tP = parsePerm(tauInput);
  if (sP.error || tP.error) {
    return (
      <div className="gt-conj-vis">
        <div className="gt-panel-input-row"><label>σ</label><input className="gt-input" value={sigmaInput} onChange={e => setSigmaInput(e.target.value)} spellCheck={false} /></div>
        <div className="gt-panel-input-row"><label>τ</label><input className="gt-input" value={tauInput} onChange={e => setTauInput(e.target.value)} spellCheck={false} /></div>
        <div className="gt-permvis-error">{sP.error ?? tP.error}</div>
      </div>
    );
  }
  const N = Math.max(sP.n, tP.n);
  const pad = (p: number[]) => Array.from({ length: N }, (_, i) => p[i] ?? i + 1);
  const sigma = pad(sP.perm);
  const tau = pad(tP.perm);
  const sigmaInv = invertPerm(sigma);
  const conj = composePerm(composePerm(sigma, tau), sigmaInv);   // σ τ σ⁻¹
  // Relabel rule: if τ has cycle (a b c …), then σ τ σ⁻¹ has cycle (σ(a) σ(b) σ(c) …).
  const tauCycles = decomposeCycles(tau).filter(c => c.length > 1);
  const relabelled = tauCycles.map(c => c.map(v => sigma[v - 1]));
  return (
    <div className="gt-conj-vis">
      <div className="gt-panel-input-row"><label>σ</label><input className="gt-input" value={sigmaInput} onChange={e => setSigmaInput(e.target.value)} spellCheck={false} /></div>
      <div className="gt-panel-input-row"><label>τ</label><input className="gt-input" value={tauInput} onChange={e => setTauInput(e.target.value)} spellCheck={false} /></div>
      <div className="gt-conj-vis-row">
        <span className="gt-conj-vis-label">σ τ σ⁻¹ =</span>
        <span className="gt-conj-vis-result">{fmtCycles(decomposeCycles(conj))}</span>
      </div>
      <div className="gt-conj-vis-relabel">
        <div className="gt-conj-vis-relabel-head">{tr({ zh: '重命名规则', en: 'relabel rule'
        })}</div>
        {tauCycles.length === 0 ? (
          <div className="gt-conj-vis-relabel-cyc">τ = e ⇒ σ τ σ⁻¹ = e</div>
        ) : tauCycles.map((c, i) => (
          <div key={i} className="gt-conj-vis-relabel-cyc">
            ({c.join(' ')}) <span className="gt-conj-vis-arrow">↦</span> ({relabelled[i].join(' ')})
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 32.9 widget: CommutatorComputer ─────────────────────────────────────────

// ── 32.9 widget: CommutatorComputer ─────────────────────────────────────────
function CommutatorComputer() {
  const [aInput, setAInput] = useState('(1 2 3 4 5)');
  const [bInput, setBInput] = useState('(3 4 5 6 7)');
  const aP = parsePerm(aInput);
  const bP = parsePerm(bInput);
  if (aP.error || bP.error) {
    return (
      <div className="gt-comm-comp">
        <div className="gt-panel-input-row"><label>A</label><input className="gt-input" value={aInput} onChange={e => setAInput(e.target.value)} spellCheck={false} /></div>
        <div className="gt-panel-input-row"><label>B</label><input className="gt-input" value={bInput} onChange={e => setBInput(e.target.value)} spellCheck={false} /></div>
        <div className="gt-permvis-error">{aP.error ?? bP.error}</div>
      </div>
    );
  }
  const N = Math.max(aP.n, bP.n);
  const pad = (p: number[]) => Array.from({ length: N }, (_, i) => p[i] ?? i + 1);
  const A = pad(aP.perm);
  const B = pad(bP.perm);
  const Ai = invertPerm(A);
  const Bi = invertPerm(B);
  // [A,B] = A B A⁻¹ B⁻¹ — math convention: apply right to left.
  const comm = composePerm(composePerm(composePerm(A, B), Ai), Bi);
  const commCycles = decomposeCycles(comm).filter(c => c.length > 1);
  const is3Cycle = commCycles.length === 1 && commCycles[0].length === 3;
  return (
    <div className="gt-comm-comp">
      <div className="gt-panel-input-row"><label>A</label><input className="gt-input" value={aInput} onChange={e => setAInput(e.target.value)} spellCheck={false} /></div>
      <div className="gt-panel-input-row"><label>B</label><input className="gt-input" value={bInput} onChange={e => setBInput(e.target.value)} spellCheck={false} /></div>
      <div className={`gt-comm-comp-result ${is3Cycle ? 'gt-comm-comp-3cycle' : ''}`}>
        <span className="gt-comm-comp-label">[A, B] = A B A⁻¹ B⁻¹ =</span>
        <span className="gt-comm-comp-value">{fmtCycles(decomposeCycles(comm))}</span>
        {is3Cycle && <span className="gt-comm-comp-badge">{tr({ zh: '✓ 干净 3-循环', en: '✓ clean 3-cycle'
        })}</span>}
      </div>
      <div className="gt-comm-comp-meta">
        ord([A,B]) = {permOrder(comm)} · sgn([A,B]) = +1 ({tr({ zh: '换位子始终是偶置换', en: 'commutators are always even'
        })})
      </div>
    </div>
  );
}

// ── 32.10 widget: PowerSlider ───────────────────────────────────────────────

// ── 32.10 widget: PowerSlider ───────────────────────────────────────────────
function PowerSlider() {
  const [input, setInput] = useState('(1 2 3)(4 5)');
  const parsed = useMemo(() => parsePerm(input), [input]);
  const ord = useMemo(() => parsed.error ? 1 : permOrder(parsed.perm), [parsed]);
  const [k, setK] = useState(1);
  useEffect(() => { if (k > ord) setK(ord); }, [ord, k]);
  if (parsed.error) {
    return (
      <div className="gt-useful-power">
        <div className="gt-panel-input-row"><label>{tr({ zh: '排列', en: 'permutation' })}</label><input className="gt-input" value={input} onChange={e => setInput(e.target.value)} spellCheck={false} /></div>
        <div className="gt-permvis-error">{parsed.error}</div>
      </div>
    );
  }
  let pow = Array.from({ length: parsed.n }, (_, i) => i + 1);
  for (let i = 0; i < k; i++) pow = composePerm(parsed.perm, pow);
  const isIdentity = pow.every((v, i) => v === i + 1);
  return (
    <div className="gt-useful-power">
      <div className="gt-panel-input-row">
        <label>{tr({ zh: '排列 σ', en: 'permutation σ' })}</label>
        <input className="gt-input" value={input} onChange={e => { setInput(e.target.value); setK(1); }} spellCheck={false} />
      </div>
      <div className="gt-useful-power-slider-row">
        <label>k = <b>{k}</b></label>
        <input type="range" min={0} max={ord} value={k} onChange={e => setK(Number(e.target.value))} className="gt-useful-power-slider" />
        <span className="gt-useful-power-ord">ord(σ) = {ord}</span>
      </div>
      <div className={`gt-useful-power-result ${isIdentity ? 'gt-useful-power-identity' : ''}`}>
        σ<sup>{k}</sup> = {fmtCycles(decomposeCycles(pow))}
        {isIdentity && k > 0 && <span className="gt-useful-power-badge">{tr({ zh: '恒等', en: 'identity'
        })}</span>}
      </div>
    </div>
  );
}

// ── 32.11 widget: SubgroupGenerator ─────────────────────────────────────────

// ── 32.11 widget: SubgroupGenerator ─────────────────────────────────────────
function SubgroupGenerator() {
  const lang = useLang();
  const [gen1, setGen1] = useState('(1 2 3 4 5)');
  const [gen2, setGen2] = useState('(1 2)');
  const g1 = parsePerm(gen1);
  const g2 = parsePerm(gen2);
  const result = useMemo(() => {
    if (g1.error || g2.error) return null;
    const N = Math.max(g1.n, g2.n);
    if (N > 9) return { error: 'enumeration limited to n ≤ 9' };
    const pad = (p: number[]) => Array.from({ length: N }, (_, i) => p[i] ?? i + 1);
    const gens = [pad(g1.perm), pad(g2.perm)];
    const key = (p: number[]) => p.join(',');
    const seen = new Map<string, number[]>();
    const idStr = key(Array.from({ length: N }, (_, i) => i + 1));
    seen.set(idStr, Array.from({ length: N }, (_, i) => i + 1));
    const frontier: number[][] = [seen.get(idStr)!];
    let factorial = 1;
    for (let i = 1; i <= N; i++) factorial *= i;
    while (frontier.length > 0 && seen.size <= factorial) {
      const cur = frontier.shift()!;
      for (const g of gens) {
        const next = composePerm(g, cur);
        const k = key(next);
        if (!seen.has(k)) { seen.set(k, next); frontier.push(next); }
      }
    }
    // Determine common named groups.
    let name = '';
    if (seen.size === factorial) name = `S_${N}`;
    else if (seen.size === factorial / 2) name = `A_${N}`;
    else if (seen.size === N) name = `Z/${N}`;
    else if (seen.size === 2 * N) name = `D_${N}`;
    return { order: seen.size, N, name };
  }, [g1.perm, g2.perm, g1.n, g2.n, g1.error, g2.error]);
  return (
    <div className="gt-useful-subgrp">
      <div className="gt-panel-input-row"><label>g₁</label><input className="gt-input" value={gen1} onChange={e => setGen1(e.target.value)} spellCheck={false} /></div>
      <div className="gt-panel-input-row"><label>g₂</label><input className="gt-input" value={gen2} onChange={e => setGen2(e.target.value)} spellCheck={false} /></div>
      {g1.error && <div className="gt-permvis-error">g₁: {g1.error}</div>}
      {g2.error && <div className="gt-permvis-error">g₂: {g2.error}</div>}
      {result && 'error' in result && <div className="gt-permvis-error">{result.error}</div>}
      {result && 'order' in result && (
        <div className="gt-useful-subgrp-result">
          ⟨g₁, g₂⟩ ⊆ S<sub>{result.N}</sub>, |⟨g₁, g₂⟩| = <b>{result.order}</b>
          {result.name && <span className="gt-useful-subgrp-name"> ≅ {result.name}</span>}
        </div>
      )}
      <div className="gt-useful-subgrp-presets">
        <button type="button" className="gt-chip" onClick={() => { setGen1('(1 2)'); setGen2('(2 3)'); }}>{lang === 'zh' ? 'S₃' : 'S₃'}</button>
        <button type="button" className="gt-chip" onClick={() => { setGen1('(1 2 3 4 5)'); setGen2('(1 2)'); }}>{lang === 'zh' ? 'S₅' : 'S₅'}</button>
        <button type="button" className="gt-chip" onClick={() => { setGen1('(1 2 3 4 5)'); setGen2('(1 3)'); }}>?</button>
        <button type="button" className="gt-chip" onClick={() => { setGen1('(1 2 3 4)'); setGen2('(1 3)'); }}>D₄</button>
      </div>
    </div>
  );
}

// ── 32.12 widget: CycleIndexPoly ────────────────────────────────────────────

// ── 32.12 widget: CycleIndexPoly ────────────────────────────────────────────
function CycleIndexPoly() {
  // D_4 acting on 4 vertices. 8 elements: 4 rotations (id, 90, 180, 270),
  // 4 reflections (2 through edge midpoints, 2 through vertices).
  // Cycle structures on the 4 vertices:
  //   e          → 1^4         z_1^4
  //   r (90)     → (1234)      z_4
  //   r² (180)   → (13)(24)    z_2^2
  //   r³ (270)   → (1432)      z_4
  //   2 vertex-flips  → (1)(24)(3) ⇒ z_1^2 z_2  ×2
  //   2 edge-flips    → (12)(34) ⇒ z_2^2         ×2
  const elements: { name: string; cycle: string; mono: string }[] = [
    { name: 'e', cycle: '(1)(2)(3)(4)', mono: 'z_1^4' },
    { name: 'r', cycle: '(1 2 3 4)', mono: 'z_4' },
    { name: 'r²', cycle: '(1 3)(2 4)', mono: 'z_2^2' },
    { name: 'r³', cycle: '(1 4 3 2)', mono: 'z_4' },
    { name: 'v₁ (through 1,3)', cycle: '(1)(3)(2 4)', mono: 'z_1^2 z_2' },
    { name: 'v₂ (through 2,4)', cycle: '(2)(4)(1 3)', mono: 'z_1^2 z_2' },
    { name: 'e₁ (edge 12-34)', cycle: '(1 2)(3 4)', mono: 'z_2^2' },
    { name: 'e₂ (edge 14-23)', cycle: '(1 4)(2 3)', mono: 'z_2^2' },
  ];
  return (
    <div className="gt-useful-poly">
      <table className="gt-useful-poly-tbl">
        <thead>
          <tr><th>g</th><th>{tr({ zh: '在 4 顶点上的圈型', en: 'cycles on 4 vertices'
        })}</th><th>{tr({ zh: '单项', en: 'monomial'
        })}</th></tr>
        </thead>
        <tbody>
          {elements.map((el, i) => (
            <tr key={i}><td>{el.name}</td><td className="mono">{el.cycle}</td><td><TeX src={el.mono} /></td></tr>
          ))}
        </tbody>
      </table>
      <div className="gt-useful-poly-sum">
        <TeXBlock src="Z_{D_4}(z_1,z_2,z_3,z_4) = \tfrac{1}{8}\bigl(z_1^4 + 2z_4 + 3z_2^2 + 2z_1^2 z_2\bigr)" />
      </div>
      <div className="gt-useful-poly-cap">
        <L
          zh={<>用 c 种颜色染 4 顶点, 在 D₄ 等价下不同染色数 = <TeX src="Z_{D_4}(c, c, c, c) = \tfrac{1}{8}(c^4 + 3c^2 + 2c^3 + 2c^2) = \tfrac{1}{8}(c^4 + 2c^3 + 5c^2)" />。 取 c = 2 得 6, c = 3 得 21 — 这是经典的「项链问题」 D₄ 版本。</>}
          en={<>Number of distinct c-colourings of 4 vertices up to D₄: <TeX src="Z_{D_4}(c, c, c, c) = \tfrac{1}{8}(c^4 + 2c^3 + 5c^2)" />. At c = 2: 6 patterns; at c = 3: 21 patterns — the classical D₄ "necklace" count.</>}
        />
      </div>
    </div>
  );
}




// ── Index landing panels (only rendered on /math/group, not sub-slugs) ─────

export default function UsefulMath() {
  return (
            <GTSec id="useful-math" className="gt-sec">
              <div className="gt-sec-num">§32</div>
              <h2 className="gt-sec-title">
                <L zh="有用数学 — 立方爱好者的工具箱" en="Useful mathematics — the cuber's toolbox" />
              </h2>
              <p className="gt-lede">
                <L
                  zh={<>jaapsch.net 那份 <em>Useful Mathematics</em> 短文里, Jaap Scherphuis 主张:魔方爱好者真正用到的不是抽象群论, 而是一两个 <strong>可视化技巧</strong> —— 两行记号、 循环分解、 交叉数判奇偶、 lcm 算阶。 整本数学小册都用这几招过来。 本节把这些「日常工具」全部集成进互动控件: 任意输入排列, 实时看到全部信息; 任意写 A、 B, 实时算 σ A σ⁻¹、 [A, B]、 σ<sup>k</sup>、 ⟨A, B⟩ 阶数。 它是整篇文章的实用速查手册。</>}
                  en={<>The <em>Useful Mathematics</em> note on jaapsch.net argues that cube enthusiasts rarely need abstract group theory — just a handful of <strong>visual tricks</strong>: two-line notation, cycle decomposition, crossing-number-as-parity, and lcm-as-order. This section rolls those tricks (and ten more) into a single practical reference: type any permutation and see all the structural data live; type A, B and watch σ A σ⁻¹, [A, B], σ<sup>k</sup>, ⟨A, B⟩ computed on the spot. Think of it as the essay's pocket handbook.</>}
                />
              </p>

              <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 24, marginBottom: 12, color: 'var(--ink)' }}>
                <L zh="32.1  四个等价信息 — 一图四读法" en="32.1  Four equivalent views" />
              </h3>
              <p>
                <L
                  zh={<>给定一个 <TeX src="n" /> 元排列 <TeX src="\sigma" />, 同一个对象至少有 4 种等价记法:</>}
                  en={<>For a permutation <TeX src="\sigma" /> of <TeX src="n" /> elements, the same object can be written four equivalent ways:</>}
                />
              </p>
              <ul>
                <li><L zh={<><strong>两行</strong>: 上行 1..n, 下行 σ(1)..σ(n)。 Cauchy 1815 的原始记号, 适合「查表」。</>} en={<><strong>Two-line</strong>: top row 1..n, bottom row σ(1)..σ(n). Cauchy's 1815 original, ideal for table look-ups.</>} /></li>
                <li><L zh={<><strong>循环</strong>: (1 a₁ a₂ …)(b₁ b₂ …)…, 把 σ 的轨道列出来。 Cauchy 1844 引入, 是计算的「乘法表」。</>} en={<><strong>Cycles</strong>: (1 a₁ a₂ …)(b₁ b₂ …)…, listing σ's orbits. Introduced by Cauchy in 1844; the format of choice for multiplication.</>} /></li>
                <li><L zh={<><strong>交叉数</strong>: 从上一行连线到下一行, 数有几对线相交。 相交数 mod 2 = sgn(σ)。 几何直观的奇偶判别。</>} en={<><strong>Crossings</strong>: draw lines from top row to bottom; count pairwise intersections. Parity of crossings = sgn(σ). The geometric parity test.</>} /></li>
                <li><L zh={<><strong>阶</strong>: ord(σ) = 各循环长度的最小公倍数 lcm。 「σ 还原自身需要做几次」的答案。</>} en={<><strong>Order</strong>: ord(σ) = lcm of cycle lengths. "How many times do I apply σ to get back to identity?"</>} /></li>
              </ul>
              <TeXBlock src="\mathrm{sgn}(\sigma) \;=\; (-1)^{\,\#\,\mathrm{crossings}(\sigma)} \;=\; \prod_{c \in \text{cycles}}\,(-1)^{|c|-1}." />
              <p>
                <L
                  zh={<>例如 5 阶轮换 (1 2 3 4 5) 的阶是 5, 奇偶 (5−1) = 4 偶。 (a b) 类对换的阶是 2, 奇偶 (2−1) = 1 奇。 魔方上 R 的角块作用是 4-循环 (奇), 棱块作用也是 4-循环 (奇), 乘积奇偶 = 偶 — 跟第 5 节那「角棱奇偶相同」守恒律完全一致。</>}
                  en={<>The 5-cycle (1 2 3 4 5) has order 5 and parity (5−1) = 4, even. A transposition (a b) has order 2 and parity (2−1) = 1, odd. On the cube, R acts as a 4-cycle on corners (odd) and a 4-cycle on edges (odd) — product is even, matching §5's "joint parity = +1" invariant.</>}
                />
              </p>
              <div className="gt-panel">
                <div className="gt-panel-title">{tr({ zh: '可视化器', en: 'visualiser'
                })}</div>
                <div className="gt-panel-sub">{tr({ zh: '输入一行 1..n 的某个排列; 实时显示连线 + 循环 + 奇偶 + 阶', en: 'type any permutation of 1..n; live lines + cycles + parity + order'
                })}</div>
                <PermutationVisualiser />
              </div>

              <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
                <L zh="32.2  跟魔方关联" en="32.2  Connection to the cube" />
              </h3>
              <p>
                <L
                  zh={<>魔方公式 FR 在角块上是 5 阶, 在棱块上是 7 阶 (Singmaster <em>Cubic Circular</em> 2/3 列出过), 所以 FR 的总阶 = lcm(5, 7) = 35。 任何公式的阶都按这个法子算: 看角/棱的循环长度, 取 lcm。 已知 G 上元素阶集合恰好有 <strong>73 个不同值</strong> (§7.2), 最大阶 = 1260 (Singmaster, §13 图案画廊里的「阶-1260」即 R U2 D' B D')。</>}
                  en={<>The cube alg FR acts as a 5-cycle on corners and a 7-cycle on edges (per Singmaster's <em>Cubic Circular</em> issue 2/3), so order(FR) = lcm(5, 7) = 35. Every alg's order follows this recipe: look at corner/edge cycle lengths and take the lcm. G has exactly <strong>73 distinct element orders</strong> (§7.2); maximum is 1260, realised by R U2 D' B D' (in the pattern gallery as "Order-1260").</>}
                />
              </p>

              <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
                <L zh="32.3  两行记号 — Cauchy 的原始想法" en="32.3  Two-line notation — Cauchy's original idea" />
              </h3>
              <p>
                <L
                  zh={<>1815 年, 23 岁的 Augustin-Louis Cauchy 在 <em>Mémoire sur le nombre des valeurs qu'une fonction peut acquérir</em> 里第一次把「置换」当成独立的数学对象。 他的记号 (Cauchy 1844 <em>Mémoire sur les arrangements</em> 整理成今天的形式):</>}
                  en={<>In 1815, 23-year-old Augustin-Louis Cauchy treated "permutation" as a free-standing mathematical object for the first time in his <em>Mémoire sur le nombre des valeurs qu'une fonction peut acquérir</em>. His two-line notation (made standard in the 1844 <em>Mémoire sur les arrangements</em>) is</>}
                />
              </p>
              <TeXBlock src="\sigma \;=\; \begin{pmatrix} 1 & 2 & 3 & \cdots & n \\ \sigma(1) & \sigma(2) & \sigma(3) & \cdots & \sigma(n) \end{pmatrix}" />
              <div className="gt-def">
                <div className="gt-def-title">{tr({ zh: '观察 32.1 — 双射 ↔ 排列', en: 'Observation 32.1 — bijection ↔ permutation'
                })}</div>
                <div className="gt-def-body">
                  <L
                    zh={<>下行必须是上行的<em>双射重排</em>: 每个 1..n 的数恰好出现一次。 这等价地说 <TeX src="\sigma : \{1, \ldots, n\} \to \{1, \ldots, n\}" /> 是<strong>双射</strong>。 所以「两行记号 = 1..n 的某个双射」, 这正是 <TeX src="S_n" /> 的元素。</>}
                    en={<>The bottom row must be a <em>bijective rearrangement</em> of the top row: each integer 1..n appears exactly once. Equivalently, <TeX src="\sigma : \{1, \ldots, n\} \to \{1, \ldots, n\}" /> is a <strong>bijection</strong>. So "two-line notation" = an element of <TeX src="S_n" />.</>}
                  />
                </div>
              </div>
              <p>
                <L
                  zh={<>计算规则: <TeX src="\sigma \cdot \tau" /> 的下行是「把 τ 的下行<em>当成索引</em>送进 σ 的下行」。 即<TeXBlock src="(\sigma \tau)(i) \;=\; \sigma(\tau(i))." />— 注意 σ 在外层 (先 τ 再 σ), 这是数学约定。 魔方里我们经常反过来用 (见 32.5)。</>}
                  en={<>Computation rule: the bottom row of <TeX src="\sigma \cdot \tau" /> is obtained by feeding τ's bottom row <em>as indices</em> into σ's bottom row. That is<TeXBlock src="(\sigma \tau)(i) \;=\; \sigma(\tau(i))." />Note σ is outer (apply τ first, then σ): this is the mathematician's convention. Cubers reverse it (see 32.5).</>}
                />
              </p>
              <div className="gt-panel">
                <div className="gt-panel-title">{tr({ zh: '两行 ↔ 循环 互转', en: 'two-line ↔ cycle toggle'
                })}</div>
                <TwoLineNotationDemo />
              </div>

              <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
                <L zh="32.4  循环分解 — 算法与「相同形状」" en="32.4  Cycle decomposition — algorithm and shape" />
              </h3>
              <p>
                <L
                  zh={<>给定 σ, <strong>循环分解算法</strong> 是个 1 分钟可手算的过程:</>}
                  en={<>Given σ, the <strong>cycle decomposition algorithm</strong> is one you can do by hand in a minute:</>}
                />
              </p>
              <ol style={{ paddingLeft: 26, lineHeight: 1.9 }}>
                <li><L zh={<>找最小未访问的 i (开始 i = 1)。</>} en={<>Find the smallest unvisited i (start at i = 1).</>} /></li>
                <li><L zh={<>反复施 σ: i → σ(i) → σ(σ(i)) → ……, 直到回到 i, 这是一个循环, 标记所有访问过的元素。</>} en={<>Iterate σ: i → σ(i) → σ(σ(i)) → …, stopping when you return to i. Mark all visited.</>} /></li>
                <li><L zh={<>重复直到所有元素都被访问。</>} en={<>Repeat until every element has been visited.</>} /></li>
              </ol>
              <p>
                <L
                  zh={<>结果是 σ 的 <strong>不交圈分解</strong>, 唯一到「每个圈的旋转写法」和「圈的列出顺序」 (不同循环之间显然不交, 所以可交换)。 圈型 (cycle type) 这一组无序的长度列表是 σ 的本质指纹, 决定 σ 在 <TeX src="S_n" /> 里的共轭类 (§21.4)。</>}
                  en={<>The result is σ's <strong>disjoint cycle decomposition</strong>, unique up to (a) rotating each cycle and (b) reordering disjoint cycles (which trivially commute). The unordered multiset of cycle lengths — the <strong>cycle type</strong> — is σ's fundamental fingerprint, and determines σ's conjugacy class in <TeX src="S_n" /> (§21.4).</>}
                />
              </p>
              <div className="gt-thm">
                <div className="gt-thm-title">{tr({ zh: '定理 32.2 — 共轭 = 重命名', en: 'Theorem 32.2 — conjugation = relabelling'
                })}</div>
                <div className="gt-thm-body">
                  <L
                    zh={<>对任意 <TeX src="\sigma, \tau \in S_n" />, <TeXBlock src="\sigma \tau \sigma^{-1} \;=\; \tau\text{ with every entry relabelled by } \sigma." />即, 若 τ = (a b c …)(d e …)…, 则 σ τ σ⁻¹ = (σ(a) σ(b) σ(c) …)(σ(d) σ(e) …)…。 共轭只是<em>换名字</em>, 不改形状。</>}
                    en={<>For any <TeX src="\sigma, \tau \in S_n" />, <TeXBlock src="\sigma \tau \sigma^{-1} \;=\; \tau \text{ with every entry relabelled by } \sigma." />Concretely, if τ = (a b c …)(d e …)…, then σ τ σ⁻¹ = (σ(a) σ(b) σ(c) …)(σ(d) σ(e) …)…. Conjugation only <em>renames</em>; it never changes the shape.</>}
                  />
                </div>
              </div>
              <p>
                <L
                  zh={<>这条定理是 §8 共轭和 §21.4 共轭类的灵魂, 也是盲拧 setup 的代数依据 —— 「用 σ 把目标块带过来, 做 τ, 再 σ⁻¹ 送回去」对应的 cube 操作就是 σ τ σ⁻¹, 跟 τ 形状一致, 只是「位置不同」。</>}
                  en={<>This theorem is the soul of §8 (conjugation) and §21.4 (conjugacy classes), and the algebraic basis of blindsolving setups: "use σ to bring the target piece into position, apply τ, then σ⁻¹ to restore" corresponds exactly to σ τ σ⁻¹, which has the same cycle shape as τ but moved to new locations.</>}
                />
              </p>
              <div className="gt-panel">
                <div className="gt-panel-title">{tr({ zh: '逐步循环分解器', en: 'step-by-step cycle decomposer'
                })}</div>
                <div className="gt-panel-sub">{tr({ zh: '点「下一步」看算法如何从 i = 1 开始追踪每条轨道', en: 'click "next" to watch the algorithm trace each orbit starting from i = 1'
                })}</div>
                <CycleDecomposer />
              </div>

              <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
                <L zh="32.5  合成顺序 — 数学家 vs 速拧选手的「坑」" en="32.5  Composition order — the math-vs-cuber trap" />
              </h3>
              <p>
                <L
                  zh={<>这是<strong>所有初学者都会踩</strong>的坑: 同一个表达式 σ τ, 数学家和速拧选手读出来是<em>不同的乘积</em>。</>}
                  en={<>Here is the trap <strong>every beginner falls into</strong>: the same string "σ τ" denotes <em>different products</em> for a mathematician and for a cuber.</>}
                />
              </p>
              <div className="gt-thm">
                <div className="gt-thm-title">{tr({ zh: '两种约定', en: 'Two conventions'
                })}</div>
                <div className="gt-thm-body">
                  <L
                    zh={<>
                      <p style={{ margin: '0 0 12px' }}><strong>数学约定</strong>: σ τ 表示函数复合 σ∘τ, 即「先 τ 后 σ」, (σ τ)(i) = σ(τ(i))。 受函数右作用启发。</p>
                      <p style={{ margin: '0 0 12px' }}><strong>魔方约定</strong>: 公式 "R U" 表示「先转 R 后转 U」, 跟书写顺序<em>一致</em>。 也称为 <em>左作用</em> 或 <em>diagram order</em>。</p>
                      <p style={{ margin: '0 0 0' }}>结果: 在魔方书里写 [A, B] = A B A⁻¹ B⁻¹ 表示「先 A 然后 B 然后 A⁻¹ 然后 B⁻¹」; 同样四个字母在群论书里 A B A⁻¹ B⁻¹ 表示「先 B⁻¹ 然后 A⁻¹ 然后 B 然后 A」 (反过来)。 计算结果通过把 A、 B 替换成 <em>逆方向</em> 来对齐。</p>
                    </>}
                    en={<>
                      <p style={{ margin: '0 0 12px' }}><strong>Math convention</strong>: σ τ denotes function composition σ∘τ — "first τ, then σ" — so (σ τ)(i) = σ(τ(i)). Comes from right-action on functions.</p>
                      <p style={{ margin: '0 0 12px' }}><strong>Cuber convention</strong>: the alg "R U" means "do R, then U" — matching the writing order. Also called the <em>left action</em> or <em>diagram order</em>.</p>
                      <p style={{ margin: '0 0 0' }}>Consequence: in a cube book, [A, B] = A B A⁻¹ B⁻¹ means "do A, then B, then A⁻¹, then B⁻¹"; in a group theory book the same four letters mean "do B⁻¹, then A⁻¹, then B, then A" (the reverse). Translating between conventions is a matter of inverting the order.</p>
                    </>}
                  />
                </div>
              </div>
              <p>
                <L
                  zh={<>具体例子: σ = (1 2)(3 4), τ = (1 3)。 试着算 σ τ 两种约定:</>}
                  en={<>Concrete example: σ = (1 2)(3 4), τ = (1 3). Compute σ τ under both conventions:</>}
                />
              </p>
              <ul>
                <li><L zh={<>数学: στ = σ∘τ. (στ)(1) = σ(τ(1)) = σ(3) = 4。 (στ)(3) = σ(1) = 2。 (στ)(2) = σ(2) = 1。 (στ)(4) = σ(4) = 3。 结果 = (1 4 3 2)。</>} en={<>Math: στ = σ∘τ. (στ)(1) = σ(τ(1)) = σ(3) = 4. (στ)(3) = σ(1) = 2. (στ)(2) = σ(2) = 1. (στ)(4) = σ(4) = 3. Result = (1 4 3 2).</>} /></li>
                <li><L zh={<>魔方: στ 表「先 σ 再 τ」 = τ∘σ。 算同样 4 个值, 得 (1 3 2 4) (上面的逆)。</>} en={<>Cuber: στ means "first σ then τ" = τ∘σ. Run through the same four values: result = (1 3 2 4) (the inverse of the above).</>} /></li>
              </ul>
              <p>
                <L
                  zh={<><strong>本文怎么约定?</strong> 本文沿用<em>魔方约定</em> (因为讨论的是魔方)。 但本节的 widget「合成约定对比」让你两种结果同屏看到, 帮你切换思维。</>}
                  en={<><strong>What does this essay use?</strong> The <em>cuber convention</em> (since the subject is the cube). But the widget below shows both results side by side so you can flip mentally between them.</>}
                />
              </p>
              <div className="gt-panel">
                <div className="gt-panel-title">{tr({ zh: '合成约定对比', en: 'composition convention comparator'
                })}</div>
                <ComposeConventions />
              </div>

              <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
                <L zh="32.6  奇偶性 — 三种定义、 一个不变量" en="32.6  Parity — three definitions, one invariant" />
              </h3>
              <p>
                <L
                  zh={<>排列的「奇偶」 sgn(σ) ∈ {`{`}+1, −1{`}`} 是 <TeX src="S_n" /> 上最有用的不变量。 它有 <strong>三个等价定义</strong>, 每个都给出一种验证手段:</>}
                  en={<>The sign sgn(σ) ∈ {`{`}+1, −1{`}`} is the most useful invariant on <TeX src="S_n" />. It admits <strong>three equivalent definitions</strong>, each useful in a different setting:</>}
                />
              </p>
              <ol style={{ paddingLeft: 26, lineHeight: 1.9 }}>
                <li><L zh={<><strong>(i) 交叉数</strong>: 画两行线, 数 σ 让多少对线相交。 sgn(σ) = (−1)<sup>#crossings</sup>。 几何, 适合手工速判。</>} en={<><strong>(i) Crossings</strong>: draw the two-line diagram and count line crossings. sgn(σ) = (−1)<sup>#crossings</sup>. Geometric, ideal for visual quick checks.</>} /></li>
                <li><L zh={<><strong>(ii) 循环长度</strong>: <TeX src="\mathrm{sgn}(\sigma) = (-1)^{n - c(\sigma)}" />, 其中 c(σ) 是 σ 的<em>圈数</em> (含 1-圈)。 等价地, sgn(σ) = ∏ (−1)<sup>|cᵢ|−1</sup>。 代数, 适合循环已知时。</>} en={<><strong>(ii) Cycle count</strong>: <TeX src="\mathrm{sgn}(\sigma) = (-1)^{n - c(\sigma)}" />, where c(σ) is the cycle count (including fixed points). Equivalently sgn(σ) = ∏ (−1)<sup>|cᵢ|−1</sup>. Algebraic — best when cycles are known.</>} /></li>
                <li><L zh={<><strong>(iii) 对换分解</strong>: 把 σ 写成对换的乘积 σ = t₁ t₂ … t_k。 sgn(σ) = (−1)<sup>k</sup>, 且这个 <em>k 的奇偶不取决于分解方式</em>。 这是「奇偶是良定的」最非平凡的事实。</>} en={<><strong>(iii) Transposition decomposition</strong>: write σ = t₁ t₂ … t_k as a product of transpositions. sgn(σ) = (−1)<sup>k</sup>, and crucially <em>the parity of k is independent of the decomposition</em>. The fact that "parity is well-defined" is the most non-trivial of the three.</>} /></li>
              </ol>
              <div className="gt-def">
                <div className="gt-def-title">{tr({ zh: '为什么三个定义等价?', en: 'Why all three agree'
                })}</div>
                <div className="gt-def-body">
                  <L
                    zh={<>关键引理: 一个对换 (a b) 跟在 σ 之后<em>恰好</em>把 σ 的圈数改变 ±1 (取决于 a, b 是否在同一个圈)。 所以「σ 加一次对换」 = 「圈数加减 1」 = 「sgn 反号」。 把 σ 写成 k 个对换, 等价于「从 e 出发 k 步翻奇偶 k 次」, 终态的奇偶完全由 k 决定。 这正是 (ii) ↔ (iii) 的桥梁; (i) ↔ (ii) 则可由「冒泡排序的逆序对 = 交叉数」 (Knuth TAOCP 5.1) 直接对应。</>}
                    en={<>Key lemma: composing σ with one transposition (a b) <em>exactly</em> changes the cycle count by ±1 (depending on whether a, b lie in the same cycle of σ). So "add one transposition" = "flip cycle count by 1" = "flip sgn". Writing σ as k transpositions amounts to "k sign flips starting from e," and the final parity depends only on k. This bridges (ii) and (iii); (i) ↔ (ii) follows from "inversion count = crossing count" (Knuth, TAOCP §5.1).</>}
                  />
                </div>
              </div>
              <div className="gt-panel">
                <div className="gt-panel-title">{tr({ zh: '对换序列 → 奇偶对账', en: 'transposition sequence → parity check'
                })}</div>
                <div className="gt-panel-sub">{tr({ zh: '随意打几个 (a b) 对换, 同时算出 k 与 sgn(乘积) — 它们必然一致。', en: 'type any sequence of (a b) transpositions; the count k and sgn(product) always agree.'
                })}</div>
                <ParityFromTranspositions />
              </div>

              <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
                <L zh="32.7  阶 — lcm 法则与 Landau 函数" en="32.7  Order — the lcm rule and Landau's function" />
              </h3>
              <p>
                <L
                  zh={<>排列 σ 的阶 ord(σ) 是「最小的正整数 k 使得 σ<sup>k</sup> = e」。 公式:</>}
                  en={<>The order ord(σ) is the smallest positive integer k with σ<sup>k</sup> = e. Formula:</>}
                />
              </p>
              <TeXBlock src="\operatorname{ord}(\sigma) \;=\; \operatorname{lcm}\bigl(|c_1|, |c_2|, \ldots, |c_r|\bigr)," />
              <p>
                <L
                  zh={<>其中 c_i 跑过 σ 的不交圈。 道理简单: σ<sup>k</sup> 在每个圈 c 上的作用是「c 旋转 k 次」, 这等于 e 当且仅当 |c| 整除 k。 所有圈同时满足 ⇔ k 是所有 |c_i| 的公倍数 ⇔ 最小这样的 k = lcm。</>}
                  en={<>where c_i ranges over σ's disjoint cycles. The reasoning is simple: σ<sup>k</sup> rotates each cycle c by k steps, which equals identity iff |c| divides k. All cycles satisfy this simultaneously iff k is a common multiple of every |c_i| iff the smallest such k = lcm.</>}
                />
              </p>
              <div className="gt-panel">
                <div className="gt-panel-title">{tr({ zh: '阶计算器', en: 'order calculator'
                })}</div>
                <OrderCalculator />
              </div>
              <h3 style={{ fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, marginTop: 28, marginBottom: 10, color: 'var(--ink)' }}>
                <L zh="32.7.1  Landau 函数 — Sₙ 上的最大阶" en="32.7.1  Landau's function — maximum order in Sₙ" />
              </h3>
              <p>
                <L
                  zh={<>对 <TeX src="S_n" /> 里所有元素, 最大可能的阶记为 <strong>Landau 函数</strong> g(n) (Edmund Landau 1903 <em>Über die Maximalordnung der Permutationen gegebenen Grades</em>)。 它就是「把 n 拆成 n = n₁ + n₂ + … + n_r, 使 lcm(n₁, …, n_r) 最大」这个组合优化问题的答案。</>}
                  en={<>Across all of <TeX src="S_n" />, the largest possible order is <strong>Landau's function</strong> g(n) (Edmund Landau 1903, <em>Über die Maximalordnung der Permutationen gegebenen Grades</em>). It is the answer to the combinatorial optimisation "partition n = n₁ + n₂ + … + n_r so that lcm(n₁, …, n_r) is maximal".</>}
                />
              </p>
              <p>
                <L
                  zh={<>极值组合奇怪有趣: g(5) = 6 来自 2 + 3, g(7) = 12 来自 3 + 4, g(11) = 30 来自 2 + 3 + 5 + 1 (注意空出 1 个固定点)。 g 的渐近行为是 <TeX src="\ln g(n) \sim \sqrt{n \ln n}" /> (Landau)。</>}
                  en={<>The extremal partitions are surprisingly delicate: g(5) = 6 from 2 + 3; g(7) = 12 from 3 + 4; g(11) = 30 from 2 + 3 + 5 + 1 (note the spare fixed point). Asymptotically <TeX src="\ln g(n) \sim \sqrt{n \ln n}" /> (Landau).</>}
                />
              </p>
              <p>
                <L
                  zh={<>对魔方: 角块 cp ∈ S₈, 棱块 ep ∈ S₁₂。 g(8) = 15 (来自 3 + 5), g(12) = 60 (来自 3 + 4 + 5)。 但加上朝向 (CO ∈ ℤ/3 ×7, EO ∈ ℤ/2 ×11), 让阶变成「(各圈长 × 朝向阶) 的 lcm」, 因此 G 上最大阶 1260 = lcm(4, 5, 7, 9) 远超 g(8) 和 g(12) — 见 §13。</>}
                  en={<>For the cube: corners cp ∈ S₈, edges ep ∈ S₁₂. g(8) = 15 (from 3 + 5) and g(12) = 60 (from 3 + 4 + 5). With orientations layered on (CO ∈ ℤ/3<sup>7</sup>, EO ∈ ℤ/2<sup>11</sup>), orders become lcm of "(cycle length × orientation order)" — pushing the maximum on G to 1260 = lcm(4, 5, 7, 9), far above either g(8) or g(12). See §13.</>}
                />
              </p>
              <div className="gt-panel">
                <div className="gt-panel-title">{tr({ zh: 'Landau 函数表 (n = 1..20)', en: "Landau's function (n = 1..20)"
                })}</div>
                <LandauTable />
              </div>

              <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
                <L zh="32.8  共轭可视化 — 重命名规则" en="32.8  Conjugation visualiser — the relabel rule" />
              </h3>
              <p>
                <L
                  zh={<>定理 32.2 说共轭就是「按 σ 改名」, 但口头说不够直观。 下面 widget 让你随便输入 σ 和 τ, 实时算 σ τ σ⁻¹, 并 <em>逐圈展示</em> τ 的循环如何被 σ 重命名为 σ τ σ⁻¹ 的循环。</>}
                  en={<>Theorem 32.2 says conjugation is "rename via σ", but the verbal statement is hard to internalise. The widget below lets you type σ and τ, computes σ τ σ⁻¹ live, and shows <em>cycle by cycle</em> how each cycle of τ is relabelled into a cycle of σ τ σ⁻¹.</>}
                />
              </p>
              <p>
                <L
                  zh={<><strong>魔方含义</strong>: τ 是「我已经会的 alg」 (例如一个棱块 3-循环), σ 是「把目标块运到 τ 习惯位置的 setup 移动」, σ τ σ⁻¹ 是「把 τ 的效果<em>搬到新位置</em>」。 这是盲拧、 FMC、 ZBLL setup 三大场合的共同语法。</>}
                  en={<><strong>Cube interpretation</strong>: τ is "an alg you already know" (e.g. an edge 3-cycle); σ is "a setup move that brings the target pieces into τ's home position"; σ τ σ⁻¹ then "relocates τ's effect to the new spot". This is the shared grammar of BLD, FMC and ZBLL setup work.</>}
                />
              </p>
              <div className="gt-panel">
                <div className="gt-panel-title">{tr({ zh: '共轭可视化器', en: 'conjugation visualiser'
                })}</div>
                <div className="gt-panel-sub">{tr({ zh: 'σ τ σ⁻¹ — 圈型不变, 每个 entry 被 σ 重命名', en: 'σ τ σ⁻¹ — same cycle shape, every entry relabelled by σ'
                })}</div>
                <ConjugationVisualiser />
              </div>

              <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
                <L zh="32.9  换位子可视化 — 何时 [A, B] 是 3-循环" en="32.9  Commutator visualiser — when [A, B] is a 3-cycle" />
              </h3>
              <p>
                <L
                  zh={<>已知 [A, B] = A B A⁻¹ B⁻¹ 衡量 A、 B「不交换的程度」。 它在魔方上的核心用法 (§9): 当 A 和 B 的 <em>影响域</em> 恰好<strong>共享一个块</strong>时, [A, B] 是一个干净的 <strong>3-循环</strong> —— 把那一个共享块, 加上它在 A 下、 B 下各拉过来的一个伴, 三块互相循环, 其余全部回到原位。</>}
                  en={<>Recall [A, B] = A B A⁻¹ B⁻¹ measures how badly A and B fail to commute. Its key cube application (§9): when A and B affect <em>almost</em> disjoint regions but <strong>share exactly one piece</strong>, [A, B] is a clean <strong>3-cycle</strong> — that shared piece, plus one companion each from A's and B's region, cycle among themselves while everything else returns home.</>}
                />
              </p>
              <p>
                <L
                  zh={<>用纯排列也能感受这一点: A = (1 2 3 4 5), B = (3 4 5 6 7), 共享 {`{`}3, 4, 5{`}`}; [A, B] 是一个 5-循环。 若改 B 为 (5 6 7), 共享 {`{`}5{`}`}; [A, B] 简洁为单一 3-循环。 这是 commutator-为-3-cycle 的精确判据 — 见 §9.1 那 4 个魔方原子。</>}
                  en={<>Pure permutations show this too: A = (1 2 3 4 5), B = (3 4 5 6 7) — overlap {`{`}3, 4, 5{`}`}, and [A, B] is a 5-cycle. Switch B to (5 6 7) so overlap shrinks to {`{`}5{`}`}, and [A, B] reduces to a clean 3-cycle. This is the precise criterion for "commutator = 3-cycle" — the same arithmetic that backs the four atom algs in §9.1.</>}
                />
              </p>
              <div className="gt-thm">
                <div className="gt-thm-title">{tr({ zh: '事实 32.3 — [A, B] 永远是偶置换', en: 'Fact 32.3 — [A, B] is always even'
                })}</div>
                <div className="gt-thm-body">
                  <L
                    zh={<>sgn([A, B]) = sgn(A) sgn(B) sgn(A⁻¹) sgn(B⁻¹) = sgn(A)² sgn(B)² = +1。 所以换位子从不引入奇偶, 它们「住在交错群 <TeX src="A_n" /> 里」。 在魔方上, <TeX src="A_8 \times A_{12}" /> 投影下任何换位子都在 ker(sgn) 内 — 这正是 [G, G] = G' 的源头 (§9.2)。</>}
                    en={<>sgn([A, B]) = sgn(A) sgn(B) sgn(A⁻¹) sgn(B⁻¹) = sgn(A)² sgn(B)² = +1. So commutators never carry parity — they live inside the alternating group <TeX src="A_n" />. On the cube, every commutator lies in the kernel of (sgn ∘ cp, sgn ∘ ep), which is why the cube's derived subgroup [G, G] = G' has index 2 (§9.2).</>}
                  />
                </div>
              </div>
              <div className="gt-panel">
                <div className="gt-panel-title">{tr({ zh: '换位子计算器', en: 'commutator computer'
                })}</div>
                <div className="gt-panel-sub">{tr({ zh: '改变 A、B 的重叠位置, 看 [A, B] 变化; 单点重叠通常给 3-循环。', en: 'change A, B overlap and watch [A, B] react; single-point overlap usually yields a 3-cycle.'
                })}</div>
                <CommutatorComputer />
              </div>

              <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
                <L zh="32.10  幂 — σ^k 与还原节奏" en="32.10  Powers — σ^k and the loop home" />
              </h3>
              <p>
                <L
                  zh={<>σ 的幂 σ<sup>k</sup> 的循环结构有简单公式: 一个长度 L 的圈在 σ<sup>k</sup> 下分成 gcd(k, L) 个长度 L / gcd(k, L) 的圈。 当 k 是 L 的倍数时, 该圈退化为 L 个固定点。 所以 σ<sup>ord(σ)</sup> = e 是显然的。</>}
                  en={<>The cycle structure of σ<sup>k</sup> follows a simple rule: a cycle of length L breaks into gcd(k, L) cycles of length L / gcd(k, L) under σ<sup>k</sup>. When k is a multiple of L, that cycle splinters into L fixed points. So σ<sup>ord(σ)</sup> = e is automatic.</>}
                />
              </p>
              <p>
                <L
                  zh={<>魔方应用: 任何公式 X 反复执行最终回到原状, 步数 = ord(X)。 例如 R 的阶为 4 (4 次 R 等于 e), R U 的阶为 105 (5-cycle 角块 × 7-cycle 棱块 × 翻转 → lcm 105), 一根普通的 "R U R'" 反复执行回原状需要 6 次。 拖动下面滑条手感这件事。</>}
                  en={<>Cube application: applying any alg X repeatedly eventually returns the cube to its start, after ord(X) repetitions. R has order 4 (R⁴ = e); R U has order 105 (5-cycle corners × 7-cycle edges × flips → lcm 105); a typical "R U R'" repeats back in 6. Drag the slider below to feel the cycle.</>}
                />
              </p>
              <div className="gt-panel">
                <div className="gt-panel-title">{tr({ zh: '幂滑条', en: 'power slider'
                })}</div>
                <PowerSlider />
              </div>

              <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
                <L zh="32.11  生成子群 — 两个元素能撑多大?" en="32.11  Generated subgroups — how big do two elements get?" />
              </h3>
              <p>
                <L
                  zh={<>给两个排列 g₁、 g₂ ∈ <TeX src="S_n" />, 它们生成的子群 ⟨g₁, g₂⟩ 多大? 这是个看似简单、 实际深刻的问题。 经典例子:</>}
                  en={<>Given two permutations g₁, g₂ ∈ <TeX src="S_n" />, how large is the subgroup ⟨g₁, g₂⟩? An apparently elementary question with deep consequences. Classical examples:</>}
                />
              </p>
              <ul>
                <li><L zh={<>⟨(1 2)⟩ = ℤ/2 (2 个元素)。</>} en={<>⟨(1 2)⟩ = ℤ/2 (2 elements).</>} /></li>
                <li><L zh={<>⟨(1 2), (2 3)⟩ = <TeX src="S_3" /> (6 个元素, 因为相邻对换生成 <TeX src="S_n" />)。</>} en={<>⟨(1 2), (2 3)⟩ = <TeX src="S_3" /> (6 elements, since adjacent transpositions generate <TeX src="S_n" />).</>} /></li>
                <li><L zh={<>⟨(1 2 3 4 5), (1 2)⟩ = <TeX src="S_5" /> (120 个元素 — 经典「一对换 + 长循环 ⇒ <TeX src="S_n" />」)。</>} en={<>⟨(1 2 3 4 5), (1 2)⟩ = <TeX src="S_5" /> (120 elements — the classic "one transposition + one n-cycle generate <TeX src="S_n" />").</>} /></li>
                <li><L zh={<>⟨(1 2 3 4 5), (1 3)⟩ = ? 试着猜, 然后用 widget 验证 — 答案不是 <TeX src="S_5" />! 因为 (1 3) 不是相邻于 5-循环 (1 2 3 4 5) 的 「邻位」 — 但实际仍生成 <TeX src="S_5" />, 因为 (1 3) 与 (1 2 3 4 5) 的共轭轨道仍能拼出所有相邻对换。</>} en={<>⟨(1 2 3 4 5), (1 3)⟩ = ? Guess first, then check with the widget — the answer is not obvious. (In fact, it still equals <TeX src="S_5" />, because conjugates of (1 3) by powers of the 5-cycle cover all transpositions on {`{1..5}`}.)</>} /></li>
              </ul>
              <div className="gt-def">
                <div className="gt-def-title">{tr({ zh: '定理 32.4 (Jordan)', en: 'Theorem 32.4 (Jordan)' })}</div>
                <div className="gt-def-body">
                  <L
                    zh={<>对 n ≥ 5: ⟨n-循环, 对换⟩ = <TeX src="S_n" /> 当且仅当对换的两个元素之间在 n-循环上的「距离」与 n 互素。 若距离与 n 有公因子 d &gt; 1, 子群退化为「d 个 n/d-顶点的对称群直积里再加一个 ℤ/d 旋转」 (一个不平凡的子群, 较 <TeX src="S_n" /> 小)。</>}
                    en={<>For n ≥ 5: ⟨n-cycle, transposition⟩ = <TeX src="S_n" /> iff the "distance" between the two transposition elements (along the n-cycle) is coprime to n. If they share a factor d &gt; 1, the subgroup collapses to a wreath-style product strictly smaller than <TeX src="S_n" />.</>}
                  />
                </div>
              </div>
              <p>
                <L
                  zh={<>本节 widget 用最朴素的 BFS 枚举 (n ≤ 9 时<em>可行</em>, n ≥ 10 状态空间 3.6M+ 太大), 但思路一致。 大规模情况 (魔方 |G| = 4.3 × 10¹⁹) 必须用 <strong>Schreier-Sims 算法</strong> (Sims 1970) 或更现代的随机算法 — GAP 系统在毫秒内能算 |⟨U, R⟩| 之类。</>}
                  en={<>The widget below uses the most naive BFS (works for n ≤ 9; n ≥ 10 has &gt; 3.6M states, too big). The same idea scales via the <strong>Schreier-Sims algorithm</strong> (Sims 1970) — GAP can compute |⟨U, R⟩| in milliseconds despite |G| = 4.3 × 10¹⁹.</>}
                />
              </p>
              <div className="gt-panel">
                <div className="gt-panel-title">{tr({ zh: '⟨g₁, g₂⟩ 阶数计算 (BFS)', en: 'order of ⟨g₁, g₂⟩ (BFS)'
                })}</div>
                <SubgroupGenerator />
              </div>

              <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
                <L zh="32.12  循环指数多项式 — 染色计数的「公式发生器」" en="32.12  Cycle index polynomial — the colouring formula" />
              </h3>
              <p>
                <L
                  zh={<>群 G 作用于 n 个对象时, <strong>循环指数多项式</strong> Z<sub>G</sub>(z₁, …, z<sub>n</sub>) 把 G 的每个元素的「在 n 对象上的圈型」 编码成单项, 再除以 |G|:</>}
                  en={<>When a group G acts on n objects, the <strong>cycle index polynomial</strong> Z<sub>G</sub>(z₁, …, z<sub>n</sub>) encodes the cycle type of each element on the n-object action, averaged over G:</>}
                />
              </p>
              <TeXBlock src="Z_G(z_1, z_2, \ldots, z_n) \;=\; \frac{1}{|G|} \sum_{g \in G} z_1^{c_1(g)} z_2^{c_2(g)} \cdots z_n^{c_n(g)}" />
              <p>
                <L
                  zh={<>其中 c_k(g) 是 g 在 n 对象上作用的长度-k 循环数。 Pólya 列举定理: 用 c 种颜色染这 n 对象, 在 G 等价下不同染色数 = Z<sub>G</sub>(c, c, …, c)。</>}
                  en={<>where c_k(g) is the number of length-k cycles in g's action on the n objects. Pólya's enumeration theorem: the number of distinct c-colourings up to G-equivalence equals Z<sub>G</sub>(c, c, …, c).</>}
                />
              </p>
              <p>
                <L
                  zh={<>具体例子: 二面体群 D₄ (8 元素) 作用于正方形 4 顶点。 列出 8 个元素的「在 4 顶点上的圈型」, 平均得 Z<sub>D₄</sub>。 这是「方形项链问题」 的根源。</>}
                  en={<>Worked example: the dihedral group D₄ (8 elements) acting on the 4 vertices of a square. List the cycle structure of each of the 8 elements on those 4 vertices, then average to get Z<sub>D₄</sub>. This is the root of the "square necklace" counting problem.</>}
                />
              </p>
              <div className="gt-panel">
                <div className="gt-panel-title">{tr({ zh: 'D₄ 在 4 顶点上的循环指数', en: 'cycle index of D₄ on 4 vertices'
                })}</div>
                <CycleIndexPoly />
              </div>
              <p style={{ marginTop: 14 }}>
                <L
                  zh={<>对魔方的「外部对称」 O<sub>h</sub> (48 阶, 24 旋转 + 24 镜像旋转) 作用于 <em>6 个面</em>, 类似计算给出 Z<sub>O<sub>h</sub></sub>(c, …, c) = (c⁶ + 3c⁴ + 12c³ + 8c² + 6c² + 12c² + 6c²) / 48 = (c⁶ + 3c⁴ + …) / 48。 取 c = 6 (六色), 得 30 — 即 6 种颜色染立方体 6 面的本质不同方案数 (§21.7)。</>}
                  en={<>For the cube's outer symmetry O<sub>h</sub> (48 elements, 24 rotations + 24 mirror rotations) acting on <em>6 faces</em>, a similar computation gives Z<sub>O<sub>h</sub></sub>(c, …, c) = (c⁶ + 3c⁴ + …) / 48. At c = 6 the count is exactly 30 — the number of essentially distinct 6-colour cubes (§21.7).</>}
                />
              </p>

              <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
                <L zh="32.13  把魔方算法当数学对象记" en="32.13  Memorising algs as math objects" />
              </h3>
              <p>
                <L
                  zh={<>本节最后一个实用建议: 记 PLL / OLL / ZBLL 这类长公式不要硬背手指动作, 而是把它们识为<strong>数学对象</strong>。</>}
                  en={<>One last practical takeaway: don't memorise PLL / OLL / ZBLL by finger sequence — recognise them as <strong>mathematical objects</strong>.</>}
                />
              </p>
              <ul>
                <li><L zh={<><strong>PLL = 顶层 cp ∘ ep 的<em>循环积</em></strong>。 21 个 PLL 案例对应顶层「角圈型 + 棱圈型」 的 21 个非平凡组合 (含 H、 Z、 Ua、 Ub、 …)。 看到 scramble 顶层, 心里画一个连线图: 哪 3 个角块要循环、 哪 3 个棱块要循环。 名字对应循环型。</>} en={<><strong>PLL = a cycle product on top-layer cp ∘ ep</strong>. The 21 PLL cases correspond exactly to the 21 non-trivial combinations of "corner-cycle shape + edge-cycle shape" on the top layer (H, Z, Ua, Ub, …). Look at a scramble's top layer and visualise the connection graph: which 3 corners cycle, which 3 edges. Names = cycle shapes.</>} /></li>
                <li><L zh={<><strong>OLL = 顶层 (co, eo) 朝向向量</strong>。 57 个 OLL 案例对应 (co ∈ {`(ℤ/3)`}<sup>4</sup>, eo ∈ {`(ℤ/2)`}<sup>4</sup>) 满足 Σco ≡ 0 mod 3 的所有方向。 cross 形状 vs 反三角形 vs T 形 ↔ 不同的 eo 向量; 角朝向 ↔ co 向量。</>} en={<><strong>OLL = an orientation vector (co, eo) on the top layer</strong>. The 57 OLL cases correspond to all (co ∈ {`(ℤ/3)`}<sup>4</sup>, eo ∈ {`(ℤ/2)`}<sup>4</sup>) consistent with Σco ≡ 0 mod 3. The cross / antisune / T-shape iconography labels distinct eo vectors; corner-orientation icons label co vectors.</>} /></li>
                <li><L zh={<><strong>ZBLL = (PLL × OLL) 同时识别</strong>。 算法表 ≈ 493 个组合 ↔ 顶层 (cp, ep, co) 在 ep 已正向、 eo = 0 的子集上的全部状态。 用代数记 ZBLL: 「先看 cp 圈型 (21 PLL 之一), 再看 co 向量 (8 OLL-on-cp-fixed 之一)」, 你只需 21 + 8 ≈ 29 个原始模式, 不是 493 个独立 finger sequence。</>} en={<><strong>ZBLL = simultaneous (PLL × OLL) recognition</strong>. Roughly 493 cases ↔ all (cp, ep, co) states with ep already oriented and eo = 0. Memorise algebraically: "identify cp cycle type (one of 21 PLL); then co vector (one of 8 fixed-cp OLLs)" — only 21 + 8 ≈ 29 primitive patterns instead of 493 independent finger sequences.</>} /></li>
              </ul>
              <p>
                <L
                  zh={<>这就是为什么 §22 那条 「先 cycle 后 orientation」 的子群链 (CF → F2L → OLL → PLL) 是<strong>记忆架构</strong> 而不仅是<strong>解法架构</strong>: 它把 4.3 × 10¹⁹ 个状态分层, 每层只剩几十个等价类, 人脑能装得下。</>}
                  en={<>This is why §22's "cycle then orientation" subgroup chain (CF → F2L → OLL → PLL) is as much a <strong>memory architecture</strong> as a <strong>solving architecture</strong>: it stratifies 4.3 × 10¹⁹ states so that each layer has only tens of equivalence classes — a count the human brain can hold.</>}
                />
              </p>
              <div className="gt-aside" style={{ marginTop: 24 }}>
                <L
                  zh={<><strong>本节小结</strong>: 11 个新 widget 跟 32.1 的 PermutationVisualiser 一起, 覆盖了 cuber 99% 用得着的「群论日常」 — 两行 ↔ 循环 ↔ 交叉 ↔ 阶 ↔ 共轭 ↔ 换位子 ↔ 幂 ↔ 生成子群 ↔ Pólya 计数。 后续阅读: D. Joyner, <em>Adventures in Group Theory</em> (Johns Hopkins 2008), 第 4-7 章把这些工具完整地搬到魔方上, 是本节的「教科书版」 [<a href="#ref-joyner">joyner</a>]。</>}
                  en={<><strong>Section summary</strong>: the 11 new widgets plus 32.1's PermutationVisualiser cover 99% of the "everyday group theory" a cuber uses — two-line ↔ cycles ↔ crossings ↔ order ↔ conjugation ↔ commutator ↔ powers ↔ generated subgroups ↔ Pólya counting. Follow-up reading: D. Joyner, <em>Adventures in Group Theory</em> (Johns Hopkins 2008), chapters 4–7 — the textbook treatment of exactly these tools on the cube [<a href="#ref-joyner">joyner</a>].</>}
                />
              </div>
            </GTSec>
  );
}
