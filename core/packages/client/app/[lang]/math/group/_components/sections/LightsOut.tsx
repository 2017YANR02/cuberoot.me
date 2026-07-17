'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { tr } from '@/i18n/tr';

function gf2Reduce(A: number[][], b: number[]): { x: number[]; kernel: number[][]; solvable: boolean } {
  const n = A.length;        // # rows
  const m = A[0]?.length ?? 0;  // # cols
  // Augmented matrix [A | b]
  const M: number[][] = A.map((row, i) => [...row, b[i]]);
  const pivotCol: number[] = []; // column index per pivot row
  let r = 0;
  for (let c = 0; c < m && r < n; c++) {
    let p = -1;
    for (let i = r; i < n; i++) if (M[i][c] === 1) { p = i; break; }
    if (p < 0) continue;
    [M[r], M[p]] = [M[p], M[r]];
    for (let i = 0; i < n; i++) if (i !== r && M[i][c] === 1) {
      for (let j = c; j <= m; j++) M[i][j] ^= M[r][j];
    }
    pivotCol.push(c);
    r++;
  }
  // Check solvability: rows past r with non-zero last col → inconsistent
  for (let i = r; i < n; i++) if (M[i][m] === 1) {
    return { x: new Array(m).fill(0), kernel: [], solvable: false };
  }
  const x = new Array(m).fill(0);
  for (let i = 0; i < r; i++) x[pivotCol[i]] = M[i][m];
  // Kernel basis: one vector per free column
  const pivSet = new Set(pivotCol);
  const kernel: number[][] = [];
  for (let c = 0; c < m; c++) {
    if (pivSet.has(c)) continue;
    const k = new Array(m).fill(0);
    k[c] = 1;
    for (let i = 0; i < r; i++) {
      if (M[i][c] === 1) k[pivotCol[i]] = 1;
    }
    kernel.push(k);
  }
  return { x, kernel, solvable: true };
}

// ── §27 Lights Out — interactive board ──────────────────────────────────────

// ── §27 Lights Out — interactive board ──────────────────────────────────────
function lightsMatrix(rows: number, cols: number): number[][] {
  const n = rows * cols;
  const A: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = r * cols + c;
    A[i][i] = 1;
    if (r > 0) A[i][(r - 1) * cols + c] = 1;
    if (r < rows - 1) A[i][(r + 1) * cols + c] = 1;
    if (c > 0) A[i][r * cols + (c - 1)] = 1;
    if (c < cols - 1) A[i][r * cols + (c + 1)] = 1;
  }
  return A;
}

function LightsOutBoard({ size }: { size: number }) {
  const n = size * size;
  const matrix = useMemo(() => lightsMatrix(size, size), [size]);
  const [state, setState] = useState<number[]>(() => new Array(n).fill(0));
  const [solveSteps, setSolveSteps] = useState<number[] | null>(null);
  const [stepIdx, setStepIdx] = useState(0);

  const { x: minSolution, kernel, solvable } = useMemo(() => {
    const res = gf2Reduce(matrix, state);
    if (!res.solvable) return res;
    // Find min-weight solution among all 2^|kernel| cosets
    let best = res.x;
    const K = res.kernel.length;
    if (K > 0 && K <= 6) {
      for (let mask = 1; mask < (1 << K); mask++) {
        const cand = [...res.x];
        for (let k = 0; k < K; k++) if ((mask >> k) & 1) {
          for (let j = 0; j < n; j++) cand[j] ^= res.kernel[k][j];
        }
        if (cand.reduce((a, b) => a + b, 0) < best.reduce((a, b) => a + b, 0)) best = cand;
      }
    }
    return { x: best, kernel: res.kernel, solvable: true };
  }, [matrix, state, n]);

  const press = useCallback((i: number) => {
    setState(prev => {
      const next = [...prev];
      for (let j = 0; j < n; j++) if (matrix[i][j] === 1) next[j] ^= 1;
      return next;
    });
    setSolveSteps(null);
  }, [matrix, n]);

  const randomize = () => {
    // Random *reachable* state: random presses from solved
    const presses = Math.floor(Math.random() * (size * size));
    const next = new Array(n).fill(0);
    for (let k = 0; k < presses; k++) {
      const i = Math.floor(Math.random() * n);
      for (let j = 0; j < n; j++) if (matrix[i][j] === 1) next[j] ^= 1;
    }
    setState(next);
    setSolveSteps(null);
  };
  const clear = () => { setState(new Array(n).fill(0)); setSolveSteps(null); };
  const showSolution = () => {
    if (!solvable) return;
    const steps: number[] = [];
    for (let i = 0; i < n; i++) if (minSolution[i] === 1) steps.push(i);
    setSolveSteps(steps);
    setStepIdx(0);
  };

  // Animation step
  useEffect(() => {
    if (!solveSteps || stepIdx >= solveSteps.length) return;
    const t = setTimeout(() => {
      press(solveSteps[stepIdx]);
      setStepIdx(i => i + 1);
    }, 280);
    return () => clearTimeout(t);
  }, [solveSteps, stepIdx, press]);

  const cellSize = size <= 3 ? 60 : size <= 5 ? 48 : 36;
  const litCount = state.reduce((a, b) => a + b, 0);
  const moveCount = minSolution.reduce((a, b) => a + b, 0);

  return (
    <div className="gt-lights">
      <div className="gt-lights-grid" style={{ gridTemplateColumns: `repeat(${size}, ${cellSize}px)` }}>
        {state.map((cell, i) => {
          const isInSolution = solveSteps != null && solveSteps.slice(stepIdx).includes(i);
          return (
            <button
              key={i}
              type="button"
              className={`gt-lights-cell ${cell ? 'on' : 'off'} ${isInSolution ? 'hint' : ''}`}
              style={{ width: cellSize, height: cellSize }}
              onClick={() => press(i)}
              aria-label={`cell ${i}`}
            />
          );
        })}
      </div>
      <div className="gt-lights-info">
        <div className="gt-lights-stat">
          <div className="gt-lights-stat-label">{tr({ zh: '亮灯', en: 'lit'
        })}</div>
          <div className="gt-lights-stat-val">{litCount} / {n}</div>
        </div>
        <div className="gt-lights-stat">
          <div className="gt-lights-stat-label">{tr({ zh: '可解', en: 'solvable' })}</div>
          <div className="gt-lights-stat-val" style={{ color: solvable ? 'var(--green)' : 'var(--accent)' }}>
            {solvable ? tr({ zh: '是', en: 'yes' }) : tr({ zh: '否', en: 'no' })}
          </div>
        </div>
        <div className="gt-lights-stat">
          <div className="gt-lights-stat-label">{tr({ zh: '最短步数', en: 'min moves'
        })}</div>
          <div className="gt-lights-stat-val">{solvable ? moveCount : '—'}</div>
        </div>
        <div className="gt-lights-stat">
          <div className="gt-lights-stat-label">{tr({ zh: '解的数量', en: '# solutions'
        })}</div>
          <div className="gt-lights-stat-val">{solvable ? (1 << kernel.length) : 0}</div>
        </div>
        <div className="gt-lights-stat">
          <div className="gt-lights-stat-label">{tr({ zh: '安静图案', en: 'quiet patterns'
        })}</div>
          <div className="gt-lights-stat-val">{kernel.length}</div>
        </div>
      </div>
      <div className="gt-lights-actions">
        <button type="button" className="gt-btn gt-btn-ghost" onClick={randomize}>{tr({ zh: '随机', en: 'randomize'
        })}</button>
        <button type="button" className="gt-btn gt-btn-ghost" onClick={clear}>{tr({ zh: '全灭', en: 'clear'
        })}</button>
        <button type="button" className="gt-btn" onClick={showSolution} disabled={!solvable || litCount === 0}>
          {tr({ zh: '演示最短解', en: 'animate solution' })}
        </button>
      </div>
    </div>
  );
}

// 5×5 Lights Out quiet patterns Q1, Q2 (known constants)

// 5×5 Lights Out quiet patterns Q1, Q2 (known constants)
const LIGHTS5_Q1 = [
  1, 0, 1, 0, 1,
  1, 0, 1, 0, 1,
  0, 0, 0, 0, 0,
  1, 0, 1, 0, 1,
  1, 0, 1, 0, 1,
];

const LIGHTS5_Q2 = [
  1, 1, 0, 1, 1,
  0, 0, 0, 0, 0,
  1, 1, 0, 1, 1,
  0, 0, 0, 0, 0,
  1, 1, 0, 1, 1,
];

function QuietPatternViewer() {
  const [board, setBoard] = useState<number[]>(() => new Array(25).fill(0));
  const toggle = (i: number) => setBoard(b => b.map((v, j) => j === i ? (v ^ 1) : v));
  const random = () => {
    const presses = Math.floor(Math.random() * 25);
    const A = lightsMatrix(5, 5);
    const next = new Array(25).fill(0);
    for (let k = 0; k < presses; k++) {
      const i = Math.floor(Math.random() * 25);
      for (let j = 0; j < 25; j++) if (A[i][j] === 1) next[j] ^= 1;
    }
    setBoard(next);
  };
  const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s ^ (v & b[i]), 0);
  const p1 = dot(board, LIGHTS5_Q1);
  const p2 = dot(board, LIGHTS5_Q2);
  const isSolvable = p1 === 0 && p2 === 0;
  return (
    <div className="gt-quiet">
      <div className="gt-quiet-side">
        <div className="gt-quiet-label">{tr({ zh: '你的图案 p', en: 'your pattern p'
        })}</div>
        <div className="gt-quiet-grid">
          {board.map((cell, i) => (
            <button
              key={i}
              type="button"
              className={`gt-lights-cell ${cell ? 'on' : 'off'}`}
              style={{ width: 32, height: 32 }}
              onClick={() => toggle(i)}
              aria-label={`p${i}`}
            />
          ))}
        </div>
        <button type="button" className="gt-btn gt-btn-ghost" onClick={random} style={{ marginTop: 12 }}>
          {tr({ zh: '随机可解', en: 'random solvable'
        })}
        </button>
      </div>
      <div className="gt-quiet-side">
        <div className="gt-quiet-label">Q₁ <span style={{ color: p1 === 0 ? 'var(--green)' : 'var(--accent)' }}>· p·Q₁ = {p1}</span></div>
        <div className="gt-quiet-grid">
          {LIGHTS5_Q1.map((cell, i) => (
            <div key={i} className={`gt-quiet-mark ${cell ? 'on' : 'off'} ${board[i] && cell ? 'pair' : ''}`} />
          ))}
        </div>
      </div>
      <div className="gt-quiet-side">
        <div className="gt-quiet-label">Q₂ <span style={{ color: p2 === 0 ? 'var(--green)' : 'var(--accent)' }}>· p·Q₂ = {p2}</span></div>
        <div className="gt-quiet-grid">
          {LIGHTS5_Q2.map((cell, i) => (
            <div key={i} className={`gt-quiet-mark ${cell ? 'on' : 'off'} ${board[i] && cell ? 'pair' : ''}`} />
          ))}
        </div>
      </div>
      <div className="gt-quiet-verdict">
        <div className="gt-quiet-verdict-label">{tr({ zh: '判定', en: 'verdict' })}</div>
        <div className="gt-quiet-verdict-val" style={{ color: isSolvable ? 'var(--green)' : 'var(--accent)' }}>
          {isSolvable
            ? tr({ zh: '可解 — 两个安静图案的内积都为 0', en: 'solvable — orthogonal to both quiet patterns'
                                  })
            : tr({ zh: '不可解 — 不在 im A 中', en: 'unreachable — not in im A' })}
        </div>
      </div>
    </div>
  );
}

function LineLightsSlider() {
  const lang = useLang();
  const [n, setN] = useState(7);
  const data = useMemo(() => {
    const A = Array.from({ length: n }, (_, i) => {
      const row = new Array(n).fill(0);
      row[i] = 1;
      if (i > 0) row[i - 1] = 1;
      if (i < n - 1) row[i + 1] = 1;
      return row;
    });
    const res = gf2Reduce(A, new Array(n).fill(0));
    return { kernelDim: res.kernel.length, quiet: res.kernel[0] ?? null };
  }, [n]);
  const isBad = n % 3 === 2;
  return (
    <div className="gt-line-lights">
      <div className="gt-line-lights-controls">
        <label className="gt-line-lights-label">n = {n}</label>
        <input
          type="range"
          min={2}
          max={15}
          value={n}
          onChange={e => setN(parseInt(e.target.value, 10))}
          className="gt-line-lights-slider"
        />
      </div>
      <div className="gt-line-lights-row">
        {Array.from({ length: n }, (_, i) => {
          const inKernel = data.quiet && data.quiet[i] === 1;
          return (
            <div
              key={i}
              className={`gt-lights-cell ${inKernel ? 'on' : 'off'}`}
              style={{ width: 28, height: 28 }}
            />
          );
        })}
      </div>
      <div className="gt-line-lights-status">
        {lang === 'zh' ? (
          <>核维度 dim ker A = <strong style={{ color: isBad ? 'var(--accent)' : 'var(--green)' }}>{data.kernelDim}</strong>
          {isBad ? <>· n ≡ 2 (mod 3),存在安静图案 <strong>11 0 11 0 11 …</strong> — 一半图案不可解</>
                : <>· n ≢ 2 (mod 3),任意图案都可解</>}</>
        ) : (
          <>kernel dim ker A = <strong style={{ color: isBad ? 'var(--accent)' : 'var(--green)' }}>{data.kernelDim}</strong>
          {isBad ? <> · n ≡ 2 (mod 3): quiet pattern <strong>11 0 11 0 11 …</strong> exists — half of patterns unreachable</>
                : <> · n ≢ 2 (mod 3): every pattern solvable</>}</>
        )}
      </div>
    </div>
  );
}

// ── §28 Peg Solitaire ──────────────────────────────────────────────────────
// English 33-cell board layout: 7 rows × 7 cols with corners cut off

// and lets the user step through GF(2) row reduction one pivot at a time.
function GaussianEliminationStepper() {
  const lang = useLang();
  // Random solvable target (3×3 is full-rank, so any b works)
  const [b, setB] = useState<number[]>(() => Array.from({ length: 9 }, () => Math.random() < 0.5 ? 1 : 0));
  // The matrix is fixed once chosen; recompute on b change for reproducibility
  const A0 = useMemo(() => lightsMatrix(3, 3), []);

  // Build full elimination history: snapshot of [A | b] before each pivot step
  type Snap = { M: number[][]; pivotRow: number; pivotCol: number; eliminating: number[] };
  const history = useMemo<Snap[]>(() => {
    const M = A0.map((row, i) => [...row, b[i]]);
    const snaps: Snap[] = [];
    let r = 0;
    for (let c = 0; c < 9 && r < 9; c++) {
      let p = -1;
      for (let i = r; i < 9; i++) if (M[i][c] === 1) { p = i; break; }
      if (p < 0) continue;
      if (p !== r) { const t = M[r]; M[r] = M[p]; M[p] = t; }
      const elim: number[] = [];
      for (let i = 0; i < 9; i++) if (i !== r && M[i][c] === 1) elim.push(i);
      // Snapshot before XOR
      snaps.push({ M: M.map(row => [...row]), pivotRow: r, pivotCol: c, eliminating: elim });
      for (const i of elim) for (let j = c; j <= 9; j++) M[i][j] ^= M[r][j];
      r++;
    }
    // Final snapshot (fully reduced)
    snaps.push({ M: M.map(row => [...row]), pivotRow: -1, pivotCol: -1, eliminating: [] });
    return snaps;
  }, [A0, b]);

  const [step, setStep] = useState(0);
  const snap = history[Math.min(step, history.length - 1)];
  const done = step >= history.length - 1;
  // Read off solution x from final reduced form (last column)
  const x = done ? snap.M.map(row => row[9]) : null;
  const xWeight = x ? x.reduce((a, v) => a + v, 0) : null;

  const reset = () => {
    setB(Array.from({ length: 9 }, () => Math.random() < 0.5 ? 1 : 0));
    setStep(0);
  };
  const next = () => setStep(s => Math.min(s + 1, history.length - 1));
  const prev = () => setStep(s => Math.max(s - 1, 0));
  const fastForward = () => setStep(history.length - 1);

  return (
    <div className="gt-lights-gauss">
      <div className="gt-lights-gauss-head">
        <div className="gt-lights-gauss-step">
          {tr({ zh: '步骤', en: 'step'
        })} {step} / {history.length - 1}
          {snap.pivotRow >= 0 && (
            <span className="gt-lights-gauss-hint">
              {lang === 'zh'
                ? <>主元 <strong>r{snap.pivotRow}, c{snap.pivotCol}</strong> · 消去 {snap.eliminating.length} 行</>
                : <>pivot <strong>r{snap.pivotRow}, c{snap.pivotCol}</strong> · clearing {snap.eliminating.length} rows</>}
            </span>
          )}
          {done && (
            <span className="gt-lights-gauss-hint">
              {tr({ zh: '完全约简 · 解 x 在最右列', en: 'fully reduced · solution x in last column'
            })}
            </span>
          )}
        </div>
        <div className="gt-lights-gauss-actions">
          <button type="button" className="gt-btn gt-btn-ghost" onClick={prev} disabled={step === 0}>◀</button>
          <button type="button" className="gt-btn gt-btn-ghost" onClick={next} disabled={done}>▶</button>
          <button type="button" className="gt-btn gt-btn-ghost" onClick={fastForward} disabled={done}>{tr({ zh: '直达', en: 'finish'
        })}</button>
          <button type="button" className="gt-btn" onClick={reset}>{tr({ zh: '新目标', en: 'new target'
        })}</button>
        </div>
      </div>
      <div className="gt-lights-gauss-matrix">
        {snap.M.map((row, i) => (
          <div key={i} className={`gt-lights-gauss-row ${i === snap.pivotRow ? 'pivot' : ''} ${snap.eliminating.includes(i) ? 'elim' : ''}`}>
            {row.slice(0, 9).map((v, j) => (
              <span key={j} className={`gt-lights-gauss-cell ${v ? 'on' : 'off'} ${j === snap.pivotCol && i === snap.pivotRow ? 'pivot-cell' : ''}`}>{v}</span>
            ))}
            <span className="gt-lights-gauss-bar">|</span>
            <span className={`gt-lights-gauss-cell aug ${row[9] ? 'on' : 'off'}`}>{row[9]}</span>
          </div>
        ))}
      </div>
      {x && (
        <div className="gt-lights-gauss-solution">
          <div className="gt-lights-gauss-solution-label">
            {tr({ zh: '解 x — 按这些按钮即可熄灭目标 b', en: 'solution x — press these buttons to clear b'
            })}
          </div>
          <div className="gt-lights-gauss-solution-grid">
            {x.map((v, i) => (
              <div key={i} className={`gt-lights-cell ${v ? 'on' : 'off'}`} style={{ width: 32, height: 32 }} />
            ))}
          </div>
          <div className="gt-lights-gauss-solution-sum">
            {lang === 'zh' ? `汉明权 |x| = ${xWeight}` : `Hamming weight |x| = ${xWeight}`}
          </div>
        </div>
      )}
    </div>
  );
}

// ── §27 NEW · Light-chasing animator (5×5) ─────────────────────────────────
// "Chase the lights": fix top row, then for every row below, press the cell
// directly under each lit cell in the row above. After the sweep, the bottom-row
// residual must be one of 8 vectors in the column space of the dependency map.

// residual must be one of 8 vectors in the column space of the dependency map.
function LightChasingAnimator() {
  const lang = useLang();
  const A = useMemo(() => lightsMatrix(5, 5), []);
  const [pattern, setPattern] = useState<number[]>(() => {
    const next = new Array(25).fill(0);
    for (let k = 0; k < 12; k++) {
      const i = Math.floor(Math.random() * 25);
      for (let j = 0; j < 25; j++) if (A[i][j] === 1) next[j] ^= 1;
    }
    return next;
  });
  const [state, setState] = useState<number[]>(pattern);
  const [presses, setPresses] = useState<number[]>([]);
  const [phase, setPhase] = useState<'idle' | 'chasing' | 'done'>('idle');
  const [stepIdx, setStepIdx] = useState(0);

  // Pre-compute the chase: for r = 1..4, for each c in 0..4, press (r, c) if (r-1, c) is lit
  const chaseSteps = useMemo(() => {
    const sim = [...pattern];
    const steps: number[] = [];
    for (let r = 1; r < 5; r++) for (let c = 0; c < 5; c++) {
      if (sim[(r - 1) * 5 + c] === 1) {
        const i = r * 5 + c;
        steps.push(i);
        for (let j = 0; j < 25; j++) if (A[i][j] === 1) sim[j] ^= 1;
      }
    }
    return steps;
  }, [pattern, A]);

  useEffect(() => {
    if (phase !== 'chasing') return;
    if (stepIdx >= chaseSteps.length) { setPhase('done'); return; }
    const t = setTimeout(() => {
      const i = chaseSteps[stepIdx];
      setState(prev => {
        const next = [...prev];
        for (let j = 0; j < 25; j++) if (A[i][j] === 1) next[j] ^= 1;
        return next;
      });
      setPresses(p => [...p, chaseSteps[stepIdx]]);
      setStepIdx(s => s + 1);
    }, 220);
    return () => clearTimeout(t);
  }, [phase, stepIdx, chaseSteps, A]);

  const start = () => {
    setState(pattern);
    setPresses([]);
    setStepIdx(0);
    setPhase('chasing');
  };
  const newPattern = () => {
    const next = new Array(25).fill(0);
    for (let k = 0; k < 12; k++) {
      const i = Math.floor(Math.random() * 25);
      for (let j = 0; j < 25; j++) if (A[i][j] === 1) next[j] ^= 1;
    }
    setPattern(next);
    setState(next);
    setPresses([]);
    setStepIdx(0);
    setPhase('idle');
  };

  const bottomRow = state.slice(20, 25);
  const topRowResidual = state.slice(0, 5);
  const allClear = state.every(v => v === 0);

  return (
    <div className="gt-lights-chase">
      <div className="gt-lights-chase-board">
        <div className="gt-lights-grid" style={{ gridTemplateColumns: 'repeat(5, 40px)' }}>
          {state.map((cell, i) => {
            const row = Math.floor(i / 5);
            const isCurrent = phase === 'chasing' && stepIdx < chaseSteps.length && chaseSteps[stepIdx] === i;
            const wasPressed = presses.includes(i);
            return (
              <div
                key={i}
                className={`gt-lights-cell ${cell ? 'on' : 'off'} ${isCurrent ? 'hint' : ''} ${wasPressed ? 'pressed' : ''}`}
                style={{ width: 40, height: 40, position: 'relative' }}
              >
                {wasPressed && <span className="gt-lights-chase-dot" />}
                {row === 0 && phase !== 'idle' && <span className="gt-lights-chase-row-tag">{tr({ zh: '顶', en: 'top'
                })}</span>}
              </div>
            );
          })}
        </div>
        <div className="gt-lights-chase-meta">
          <div>{tr({ zh: '已按', en: 'pressed' })}: <strong>{presses.length}</strong></div>
          <div>{tr({ zh: '剩余亮', en: 'still lit'
        })}: <strong>{state.reduce((a, v) => a + v, 0)}</strong></div>
        </div>
      </div>
      <div className="gt-lights-chase-side">
        <div className="gt-lights-chase-explain">
          {phase === 'idle' && (lang === 'zh'
            ? <>顶行不动。逐行下行:若 <strong>(r−1, c)</strong> 亮,就按 <strong>(r, c)</strong>。 这一定能把第 r 行清光。</>
            : <>Top row stays. Sweep downward: if cell <strong>(r−1, c)</strong> is lit, press <strong>(r, c)</strong>. That always clears row r.</>)}
          {phase === 'chasing' && (lang === 'zh'
            ? <>正在追光… 注意每按一格,把上一行的对应灯熄灭,代价是搅动当前行和下一行。</>
            : <>Chasing… each press kills one light in the row above, at the cost of stirring up the current and next row.</>)}
          {phase === 'done' && allClear && (lang === 'zh'
            ? <strong style={{ color: 'var(--green)' }}>底行恰好全灭 — 不用回顶行重选,纯单向追光就够了。</strong>
            : <strong style={{ color: 'var(--green)' }}>Bottom row landed at all-off — pure one-pass chase sufficed; no top-row backtrack needed.</strong>)}
          {phase === 'done' && !allClear && (lang === 'zh'
            ? <>底行残留 <strong>[{bottomRow.join(' ')}]</strong>。 这把对应到顶行需要的 「翻转向量」 — 必须重选一种顶行起手,只有 <strong>4 种</strong> 顶行能让追光收尾(因为 dim ker = 2)。 顶行残留 <strong>[{topRowResidual.join(' ')}]</strong>。</>
            : <>Bottom-row residual <strong>[{bottomRow.join(' ')}]</strong>. This dictates which top-row "kick" you should have started with — only <strong>4 of 32</strong> top rows let the chase finish (dim ker = 2). Top residual <strong>[{topRowResidual.join(' ')}]</strong>.</>)}
        </div>
        <div className="gt-lights-chase-actions">
          <button type="button" className="gt-btn" onClick={start} disabled={phase === 'chasing'}>
            {tr({ zh: '开始追光', en: 'start chase'
            })}
          </button>
          <button type="button" className="gt-btn gt-btn-ghost" onClick={newPattern}>
            {tr({ zh: '新图案', en: 'new pattern'
            })}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── §27 NEW · Kernel-dimension table for m×n Lights Out, m,n ∈ 1..8 ────────

// ── §27 NEW · Kernel-dimension table for m×n Lights Out, m,n ∈ 1..8 ────────
function KernelDimTable() {
  const lang = useLang();
  const N = 8;
  const dims = useMemo(() => {
    const out: number[][] = [];
    for (let m = 1; m <= N; m++) {
      const row: number[] = [];
      for (let n = 1; n <= N; n++) {
        const A = lightsMatrix(m, n);
        const res = gf2Reduce(A, new Array(m * n).fill(0));
        row.push(res.kernel.length);
      }
      out.push(row);
    }
    return out;
  }, []);
  // Hover state — show (m,n) header
  const [hover, setHover] = useState<{ m: number; n: number } | null>(null);

  return (
    <div className="gt-lights-kdim">
      <div className="gt-lights-kdim-caption">
        {lang === 'zh'
          ? <>dim ker A<sub>m×n</sub> — 「安静图案」 维度。 金色 = 有非平凡核 ⇒ 该尺寸 「不是任意图案都可解」 。 5×5 是金色 (dim = 2),正是商业 Lights Out 选的最小有趣尺寸。</>
          : <>dim ker A<sub>m×n</sub> — the dimension of the "quiet pattern" subspace. Gold = non-trivial kernel ⇒ that board has unreachable patterns. 5×5 is gold (dim = 2), exactly the smallest non-trivial size — which is why Tiger chose it.</>}
      </div>
      <table className="gt-lights-kdim-tbl">
        <thead>
          <tr>
            <th></th>
            {Array.from({ length: N }, (_, i) => <th key={i}>{i + 1}</th>)}
          </tr>
        </thead>
        <tbody>
          {dims.map((row, m) => (
            <tr key={m}>
              <th>{m + 1}</th>
              {row.map((d, n) => (
                <td
                  key={n}
                  className={`gt-lights-kdim-cell ${d > 0 ? 'nonzero' : ''} ${hover && hover.m === m && hover.n === n ? 'hover' : ''}`}
                  onMouseEnter={() => setHover({ m, n })}
                  onMouseLeave={() => setHover(null)}
                >{d}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="gt-lights-kdim-legend">
        {hover && (
          <span>
            {tr({ zh: '尺寸', en: 'size' })} <strong>{hover.m + 1} × {hover.n + 1}</strong>
            {' · '}
            dim ker = <strong>{dims[hover.m][hover.n]}</strong>
            {' · '}
            {tr({ zh: '可解图案占比', en: 'solvable fraction'
            })} = <strong>1 / {1 << dims[hover.m][hover.n]}</strong>
          </span>
        )}
        {!hover && tr({ zh: '把鼠标移到格子上看细节。', en: 'Hover any cell for details.'
                      })}
      </div>
    </div>
  );
}

// ── §27 NEW · σ-game on small graphs ────────────────────────────────────────
// 5 preset graphs: P_5 (path), C_5 (cycle), K_4 (complete), K_5, Petersen.
// In the σ-game, pressing node v toggles v AND all its neighbours.
// Sutner (1989): in σ⁺-game on ANY simple graph, the all-ones pattern is solvable.
// We show the solution for "make every light = 1" starting from all-zero.

// We show the solution for "make every light = 1" starting from all-zero.
type GraphSpec = {
  id: 'P5' | 'C5' | 'K4' | 'K5' | 'Petersen';
  label: string;
  nodes: { x: number; y: number }[]; // SVG coords
  edges: [number, number][];
};

const SIGMA_GRAPHS: GraphSpec[] = [
  {
    id: 'P5', label: 'P₅',
    nodes: [{ x: 40, y: 110 }, { x: 100, y: 110 }, { x: 160, y: 110 }, { x: 220, y: 110 }, { x: 280, y: 110 }],
    edges: [[0,1],[1,2],[2,3],[3,4]],
  },
  {
    id: 'C5', label: 'C₅',
    nodes: [
      { x: 160, y: 30 }, { x: 252, y: 92 }, { x: 220, y: 195 },
      { x: 100, y: 195 }, { x: 68, y: 92 },
    ],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,0]],
  },
  {
    id: 'K4', label: 'K₄',
    nodes: [{ x: 80, y: 50 }, { x: 240, y: 50 }, { x: 240, y: 180 }, { x: 80, y: 180 }],
    edges: [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]],
  },
  {
    id: 'K5', label: 'K₅',
    nodes: [
      { x: 160, y: 30 }, { x: 252, y: 92 }, { x: 220, y: 195 },
      { x: 100, y: 195 }, { x: 68, y: 92 },
    ],
    edges: [[0,1],[0,2],[0,3],[0,4],[1,2],[1,3],[1,4],[2,3],[2,4],[3,4]],
  },
  {
    id: 'Petersen', label: 'Petersen',
    nodes: [
      // outer 5-gon
      { x: 160, y: 24 }, { x: 280, y: 110 }, { x: 234, y: 234 }, { x: 86, y: 234 }, { x: 40, y: 110 },
      // inner 5-gon (rotated)
      { x: 160, y: 78 }, { x: 224, y: 124 }, { x: 200, y: 196 }, { x: 120, y: 196 }, { x: 96, y: 124 },
    ],
    edges: [
      [0,1],[1,2],[2,3],[3,4],[4,0], // outer
      [5,7],[7,9],[9,6],[6,8],[8,5], // inner pentagram
      [0,5],[1,6],[2,7],[3,8],[4,9], // spokes
    ],
  },
];

function SigmaGameOnGraph() {
  const [gIdx, setGIdx] = useState(0);
  const G = SIGMA_GRAPHS[gIdx];

  // σ-game matrix: A[i][j] = 1 iff j == i OR j ~ i  (reflexive adjacency)
  const A = useMemo(() => {
    const n = G.nodes.length;
    const M: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) M[i][i] = 1;
    for (const [u, v] of G.edges) { M[u][v] = 1; M[v][u] = 1; }
    return M;
  }, [G]);
  const n = G.nodes.length;

  // Solve A x = 1 (all-ones target = σ⁺-game all-lit objective)
  const ones = useMemo(() => new Array(n).fill(1), [n]);
  const { x: sol, kernel, solvable } = useMemo(() => gf2Reduce(A, ones), [A, ones]);

  // Live state: what is currently lit (we let user click to apply x)
  const [lit, setLit] = useState<number[]>(() => new Array(n).fill(0));
  const [pressed, setPressed] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    setLit(new Array(n).fill(0));
    setPressed(new Set());
  }, [gIdx, n]);

  const press = (i: number) => {
    setLit(prev => {
      const next = [...prev];
      for (let j = 0; j < n; j++) if (A[i][j] === 1) next[j] ^= 1;
      return next;
    });
    setPressed(prev => {
      const s = new Set(prev);
      if (s.has(i)) s.delete(i); else s.add(i);
      return s;
    });
  };

  const showSolution = () => {
    // Reset and apply Sutner solution
    setLit(new Array(n).fill(0));
    setPressed(new Set());
    if (!solvable) return;
    // Apply each pressed-in-sol button to lit
    const next = new Array(n).fill(0);
    const sp = new Set<number>();
    for (let i = 0; i < n; i++) if (sol[i] === 1) {
      for (let j = 0; j < n; j++) if (A[i][j] === 1) next[j] ^= 1;
      sp.add(i);
    }
    setLit(next);
    setPressed(sp);
  };
  const reset = () => { setLit(new Array(n).fill(0)); setPressed(new Set()); };

  const allLit = lit.every(v => v === 1);
  const litCount = lit.reduce((a, v) => a + v, 0);

  return (
    <div className="gt-lights-sigma">
      <div className="gt-lights-sigma-pick">
        {SIGMA_GRAPHS.map((g, i) => (
          <button
            key={g.id}
            type="button"
            className={`gt-btn ${i === gIdx ? '' : 'gt-btn-ghost'}`}
            onClick={() => setGIdx(i)}
          >{g.label}</button>
        ))}
      </div>
      <svg className="gt-lights-sigma-svg" viewBox="0 0 320 260" width="100%">
        {G.edges.map(([u, v], k) => (
          <line
            key={k}
            x1={G.nodes[u].x} y1={G.nodes[u].y}
            x2={G.nodes[v].x} y2={G.nodes[v].y}
            stroke="var(--ink-dim)" strokeWidth="1.5" opacity="0.5"
          />
        ))}
        {G.nodes.map((p, i) => (
          <g key={i} onClick={() => press(i)} style={{ cursor: 'pointer' }}>
            <circle
              cx={p.x} cy={p.y} r={18}
              fill={lit[i] ? 'var(--accent)' : 'var(--bg-elev)'}
              stroke={pressed.has(i) ? 'var(--green)' : 'var(--ink-dim)'}
              strokeWidth={pressed.has(i) ? 3 : 1.5}
            />
            <text
              x={p.x} y={p.y + 5}
              textAnchor="middle" fontSize="14"
              fill={lit[i] ? 'white' : 'var(--ink)'}
              fontWeight="600"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >{i}</text>
          </g>
        ))}
      </svg>
      <div className="gt-lights-sigma-info">
        <div className="gt-lights-sigma-stat">
          <span className="gt-lights-sigma-stat-label">{tr({ zh: '点亮', en: 'lit'
        })}</span>
          <strong>{litCount} / {n}</strong>
        </div>
        <div className="gt-lights-sigma-stat">
          <span className="gt-lights-sigma-stat-label">{tr({ zh: '按了', en: 'pressed' })}</span>
          <strong>{pressed.size}</strong>
        </div>
        <div className="gt-lights-sigma-stat">
          <span className="gt-lights-sigma-stat-label">dim ker A</span>
          <strong>{kernel.length}</strong>
        </div>
        <div className="gt-lights-sigma-stat">
          <span className="gt-lights-sigma-stat-label">{tr({ zh: '全亮可解', en: 'all-ones reachable' })}</span>
          <strong style={{ color: solvable ? 'var(--green)' : 'var(--accent)' }}>
            {solvable ? tr({ zh: '是', en: 'yes' }) : tr({ zh: '否', en: 'no' })}
          </strong>
        </div>
      </div>
      <div className="gt-lights-sigma-actions">
        <button type="button" className="gt-btn" onClick={showSolution} disabled={!solvable}>
          {tr({ zh: '显示全亮解', en: 'show all-ones solution'
        })}
        </button>
        <button type="button" className="gt-btn gt-btn-ghost" onClick={reset}>
          {tr({ zh: '清空', en: 'reset' })}
        </button>
        {allLit && pressed.size > 0 && (
          <span className="gt-lights-sigma-verdict" style={{ color: 'var(--green)' }}>
            {tr({ zh: '全亮 — Sutner 定理保证总能做到 (σ⁺ 游戏)。', en: 'all on — Sutner\'s theorem guarantees this is always possible (σ⁺-game).'
            })}
          </span>
        )}
      </div>
    </div>
  );
}




// ═══════════════════════════════════════════════════════════════════════
// §28 NEW · Peg Solitaire additions
// ═══════════════════════════════════════════════════════════════════════
// ── §28 Peg Solitaire — extended helpers ──────────────────────────────────

// Generic ASCII board → {cells, idx}. 'X' = peg cell, '.' = empty cell,
// ' ' or '#' = off-board (not rendered).

export default function LightsOut() {
  return (
      <GTSec id="lights-out" className="gt-sec">
        <div className="gt-sec-num">§27</div>
        <h2 className="gt-sec-title">
          <L zh="Lights Out — GF(2) 线性代数" en="Lights Out — Linear algebra over GF(2)" />
        </h2>
        <p className="gt-lede">
          <L
            zh={<>1995 年 Tiger Electronics 推出的电子玩具 <em>Lights Out</em>: 5×5 方阵的按钮,按一下会同时翻转 <strong>该按钮 + 上下左右</strong> 共 5 个灯的状态。 从一个随机点亮的图案出发,目标是让所有灯熄灭。 看似童玩,背后是一道干净漂亮的 <strong>𝔽₂ 上的线性代数</strong> 题: 每个图案 p 对应一个向量 <TeX src="p \in \mathbb{F}_2^{25}" />, 按钮 i 对应一个固定向量 <TeX src="A_i \in \mathbb{F}_2^{25}" />, 而按钮可交换、 且按两次抵消 (<TeX src="2 \equiv 0 \pmod 2" />), 所以 「按哪些按钮」 也是一个向量 <TeX src="x \in \mathbb{F}_2^{25}" />, 目标方程就是</>}
            en={<>The 1995 Tiger Electronics toy <em>Lights Out</em>: a 5×5 grid of buttons; pressing one toggles itself and its four orthogonal neighbours. Reach all-off from a given lit pattern. Behind this children's puzzle is one of the cleanest examples of <strong>linear algebra over <TeX src="\mathbb{F}_2" /></strong>: a pattern p is a vector in <TeX src="\mathbb{F}_2^{25}" />, each button is a fixed "press vector" <TeX src="A_i \in \mathbb{F}_2^{25}" />, and since presses commute and self-cancel mod 2, "which buttons to press" is itself a vector <TeX src="x \in \mathbb{F}_2^{25}" /> solving</>}
          />
        </p>
        <TeXBlock src="A x = p \quad \text{over } \mathbb{F}_2," />
        <p>
          <L
            zh={<>其中 A 是 25 × 25 的对称 0/1 矩阵: <TeX src="A_{ij} = 1" /> 当且仅当按按钮 i 会切换灯 j。 A 是分块三对角的,在行向坐标里:</>}
            en={<>where A is the symmetric 25 × 25 binary matrix with <TeX src="A_{ij}=1" /> iff pressing button i toggles light j. In row-major coordinates, A is block tridiagonal:</>}
          />
        </p>
        <TeXBlock src="A_{m \times n} = \begin{pmatrix} B_n & I_n & & \\ I_n & B_n & I_n & \\ & I_n & B_n & \ddots \\ & & \ddots & \ddots \end{pmatrix}, \qquad B_n = I_n + T_n," />
        <p>
          <L
            zh={<>其中 <TeX src="T_n" /> 是 n × n 「相邻 1」 三对角矩阵 (无主对角线)。 把 A 当作图算子: <strong>它就是 m × n 方格图的反射式邻接矩阵</strong> (一个顶点 + 它的邻居)。 整张 §27 都在追问一件事 — 这个矩阵在 𝔽₂ 上的核长什么样, 因为</>}
            en={<>where <TeX src="T_n" /> is the n × n off-diagonal "adjacency" tridiagonal matrix. View A as a graph operator: <strong>it is the reflexive adjacency matrix of the m × n grid graph</strong> (a vertex plus its neighbours). All of §27 chases one question — what does this matrix's kernel look like over <TeX src="\mathbb{F}_2" />, because</>}
          />
        </p>
        <TeXBlock src="\dim \ker A \;=\; m\cdot n - \mathrm{rank}\, A \;=\; \log_2 \frac{|\mathbb{F}_2^{mn}|}{|\mathrm{im}\, A|}" />
        <p>
          <L
            zh={<>直接决定 「<strong>多少图案能解</strong>」 (<TeX src="2^{\mathrm{rank}\, A} = 2^{mn - \dim \ker A}" /> 个), 以及 「<strong>每个可解图案有几个解</strong>」 (恰好 <TeX src="2^{\dim \ker A}" /> 个)。</>}
            en={<>completely determines both <strong>how many patterns are solvable</strong> (<TeX src="2^{\mathrm{rank}\, A} = 2^{mn - \dim \ker A}" />) and <strong>how many solutions each solvable pattern has</strong> (exactly <TeX src="2^{\dim \ker A}" />).</>}
          />
        </p>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 24, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="27.1  互动:3 × 3 与 5 × 5 求解器" en="27.1  Interactive: 3 × 3 and 5 × 5 solvers" />
        </h3>
        <p>
          <L
            zh={<>3 × 3 的 A 满秩, 任何图案都可解, 直径 9 步 (一定可在 9 步内熄灭)。 5 × 5 的 A <strong>不满秩</strong>: <TeX src="\mathrm{rank}\, A = 23, \dim \ker A = 2" />, 所以可解图案恰好占 <TeX src="2^{23} = 8\,388\,608" /> 个 (全部 <TeX src="2^{25}" /> 的 1/4), 每个可解图案有 <TeX src="2^2 = 4" /> 个不同的解。 下面两块板子自动跑高斯消元 + 在 4 个解中选汉明权最小的那个 — 5 × 5 上直径 = 15 步。</>}
            en={<>The 3 × 3 board's A is full rank — every pattern is solvable in at most 9 presses. The 5 × 5 board has <TeX src="\mathrm{rank}\, A = 23, \dim \ker A = 2" />: exactly <TeX src="2^{23} = 8\,388\,608" /> patterns are solvable (a quarter of all <TeX src="2^{25}" />), each in <TeX src="2^2 = 4" /> distinct ways. Both boards below run Gaussian elimination and then pick the minimum-Hamming-weight coset representative. Diameter = 15 on 5 × 5.</>}
          />
        </p>
        <div className="gt-panel">
          <div className="gt-panel-title">3 × 3</div>
          <div className="gt-panel-sub">{tr({ zh: '满秩 · 任何图案可解 · 直径 9', en: 'full rank · every pattern solvable · diameter 9'
        })}</div>
          <LightsOutBoard size={3} />
        </div>
        <div className="gt-panel">
          <div className="gt-panel-title">5 × 5</div>
          <div className="gt-panel-sub">{tr({ zh: '秩 23 · 2 个安静图案 · 每个可解图案 4 种解 · 直径 15', en: 'rank 23 · 2 quiet patterns · 4 solutions per solvable · diameter 15'
        })}</div>
          <LightsOutBoard size={5} />
        </div>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="27.2  安静图案 (Quiet Patterns)" en="27.2  Quiet patterns" />
        </h3>
        <p>
          <L
            zh={<>5 × 5 的核空间有 2 个基向量 <TeX src="Q_1, Q_2 \in \ker A" />。 几何意义: <strong>把这些标记的按钮全按一遍, 整个网格回到全灭</strong>。 因此一个解再加上任意安静图案,得到另一个解 — 这正是 「4 个解」 的由来。 它们也立刻给出 <strong>可解判据</strong>:</>}
            en={<>The 5 × 5 kernel has basis <TeX src="Q_1, Q_2 \in \ker A" />. Geometric meaning: <strong>pressing exactly the marked buttons restores the all-off board</strong>. Adding any quiet pattern to a solution yields another valid solution — that is where the "4 solutions" come from. They also give the <strong>solvability test</strong>:</>}
          />
        </p>
        <TeXBlock src="p \text{ solvable} \iff p \cdot Q_1 \equiv 0 \pmod 2 \;\;\text{and}\;\; p \cdot Q_2 \equiv 0 \pmod 2." />
        <p>
          <L
            zh={<>(证明: A 对称, 所以 <TeX src="\mathrm{im}\,A = (\ker A)^{\perp}" /> — 这是有限维内积空间的标准事实, 在 𝔽₂ 上一样成立。)  点击下面的格子翻转, 实时观察两个内积。 任意可解图案必然同时正交于 <TeX src="Q_1" /> 与 <TeX src="Q_2" />。</>}
            en={<>(Proof: A is symmetric, hence <TeX src="\mathrm{im}\,A = (\ker A)^{\perp}" /> — the standard finite-dimensional fact, which still holds over <TeX src="\mathbb{F}_2" />.) Toggle cells and watch the two dot products update. A pattern is solvable iff it is orthogonal to both <TeX src="Q_1" /> and <TeX src="Q_2" />.</>}
          />
        </p>
        <div className="gt-panel">
          <div className="gt-panel-title">{tr({ zh: '内积判据', en: 'orthogonality test'
        })}</div>
          <QuietPatternViewer />
        </div>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '观察 27.1 — 「安静」 的几何', en: 'Observation 27.1 — geometry of quiet'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<><TeX src="Q_1" /> 是棋盘式的 「四角块」 图案; <TeX src="Q_2" /> 是 「四象限块」 图案。 两者都有 D₄ (8 阶) 对称性, 这不是巧合 — 5 × 5 网格自身有 D₄ 对称, 因此 A 在 D₄ 表示下分解, 核必然落入某个不变子空间。 这是 「<strong>对称对子空间分解</strong>」 (representation theory of finite groups) 给出的硬约束: 5 × 5 上只有两个非平凡 D₄ 不变向量满足 <TeX src="Ax = 0" />, 就是 <TeX src="Q_1, Q_2" />。</>}
              en={<><TeX src="Q_1" /> is the four-corner-block pattern, <TeX src="Q_2" /> is the four-quadrant-block pattern. Both have D₄ symmetry (the 8-element dihedral group) — no coincidence. The 5 × 5 grid itself is D₄-symmetric, so A decomposes under the D₄ representation, and ker A must sit in some isotypic component. Only two non-trivial D₄-invariant solutions to <TeX src="Ax = 0" /> exist on 5 × 5, namely <TeX src="Q_1, Q_2" />. This is "<strong>representation-theoretic subspace decomposition</strong>" giving a hard constraint.</>}
            />
          </div>
        </div>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="27.3  高斯消元 — 一步一步走完 3 × 3" en="27.3  Gaussian elimination — stepping through 3 × 3" />
        </h3>
        <p>
          <L
            zh={<>抽象的 「A 满秩 ⇒ 可解」 一句话不解释 「<em>怎么解</em>」 。 真正的求解器跑的是 𝔽₂ 上的 <strong>行约简</strong>:  把 <TeX src="[A \mid b]" /> 通过行交换 + 行加法 (𝔽₂ 上 = 异或) 约简到 <TeX src="[I \mid x]" />。  每一步:  在第 c 列从第 r 行往下找一个非零项, 换上来当主元;  然后把所有其它行的 c 列翻成 0。  9 个主元走完, b 就被换成了解 x。</>}
            en={<>The abstract sentence "A is full rank ⇒ solvable" does not tell you <em>how</em> to solve. Real solvers run <strong>row reduction</strong> over <TeX src="\mathbb{F}_2" />: starting from <TeX src="[A \mid b]" />, swap rows and add rows (XOR over <TeX src="\mathbb{F}_2" />) until reaching <TeX src="[I \mid x]" />. Each step: in column c, find a non-zero entry at or below row r and swap it up as pivot; then XOR-clear every other row's c-column. After 9 pivots, b has been transformed into the solution x.</>}
          />
        </p>
        <div className="gt-panel">
          <div className="gt-panel-title">{tr({ zh: '3 × 3 高斯消元逐步演示', en: '3 × 3 Gaussian elimination, step by step' })}</div>
          <div className="gt-panel-sub">{tr({ zh: '增广矩阵 [A | b]  — 9 列 A + 1 列 b · 高亮主元行与正在消去的行', en: 'augmented matrix [A | b] — 9 cols of A + 1 col of b · pivot row and eliminating rows highlighted'
        })}</div>
          <GaussianEliminationStepper />
        </div>
        <p>
          <L
            zh={<>整个过程的复杂度是 <TeX src="O((mn)^3)" /> 比特运算 — 在 25 × 25 上就是 <TeX src="\sim 25^3 = 15{,}625" /> 次异或, 现代 CPU 一两个 μs。 这跟魔方天差地别: 魔方群是非阿贝尔的, 「最短解」 已经是 NP-hard (§16); Lights Out 因为阿贝尔, 落进了 P。</>}
            en={<>The whole process costs <TeX src="O((mn)^3)" /> bit operations — on 25 × 25 that is about <TeX src="\sim 25^3 = 15\,625" /> XORs, microseconds on a modern CPU. This contrasts sharply with the cube: the cube group is non-Abelian and optimal solving is NP-hard (§16); Lights Out, being Abelian, sits comfortably in P.</>}
          />
        </p>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="27.4  追光启发式 (Light Chasing)" en="27.4  The light-chasing heuristic" />
        </h3>
        <p>
          <L
            zh={<>玩 Lights Out 的人都会 「<strong>追光</strong>」 (light chasing / chase-the-lights): 假设顶行就这样,逐行往下扫 — <strong>若 (r−1, c) 还亮, 就按 (r, c)</strong> 把它熄掉。 这是单向消元, 必然把上方所有行清光。 但底行的结果 <em>未必</em> 全灭 — 它取决于顶行起手。 顶行只有 <strong>32 种</strong> 选择, 而 5 × 5 上只有 <strong>4 种</strong> 顶行 (因为 dim ker = 2 + 顶行残留必须落在 ker 在底行的投影中) 能让追光收尾。 在 「追光 + 重选顶行」 这两层迭代后, 任何可解图案在 ≤ 15 步内灭。</>}
            en={<>Every Lights Out player learns to <strong>chase the lights</strong>: hold the top row, then scan downward — <strong>if (r−1, c) is still lit, press (r, c)</strong> to kill it. This is one-pass forward elimination; it always clears every row above. But the bottom row's residual <em>need not</em> be zero — it depends on the top-row "kick". The top row has 32 possible kicks; on 5 × 5, exactly <strong>4 of them</strong> (because dim ker = 2 and the bottom-row residual must land in the projection of ker onto the bottom row) let the chase finish. Two passes — "chase + correct top row + chase again" — solves any solvable pattern in ≤ 15 moves.</>}
          />
        </p>
        <div className="gt-panel">
          <div className="gt-panel-title">{tr({ zh: '追光动画 (5 × 5)', en: 'light-chasing animator (5 × 5)'
        })}</div>
          <div className="gt-panel-sub">{tr({ zh: '点击「开始追光」看单向消元;若底行不全灭,需要回顶行重选 (4 种可行起手)', en: 'click "start chase" to run forward elimination; non-zero bottom row means you must restart with a different top-row kick (4 valid choices)'
        })}</div>
          <LightChasingAnimator />
        </div>
        <p>
          <L
            zh={<>追光的本质是 「<strong>对块上三角化</strong>」: 把分块矩阵 A 用前 m − 1 行写成 <TeX src="\begin{pmatrix} U & * \\ 0 & S \end{pmatrix}" /> 形式, 其中 S 是 <em>Schur 补</em>。 顶行的可解空间就是 <TeX src="\ker S" />。 在 5 × n 上: <TeX src="S" /> 是 5 × 5 的, 它的核维就是整个 A 的核维 (dim = 2 当 n = 5)。 这就是 「为什么 5 × 5 有 4 种合法顶行起手」 的代数解释。</>}
            en={<>Chase-the-lights is essentially <strong>block upper-triangulation</strong>: write A using the first m − 1 rows as <TeX src="\begin{pmatrix} U & * \\ 0 & S \end{pmatrix}" /> where S is the <em>Schur complement</em>. The space of admissible top-row kicks is exactly <TeX src="\ker S" />. On a 5 × n board, S is 5 × 5 and its kernel dimension equals dim ker A (so dim = 2 when n = 5). That is the algebraic reason "4 of the 32 top rows work".</>}
          />
        </p>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="27.5  1 × n 通路与 n-环面" en="27.5  The 1 × n line, and the n-cycle" />
        </h3>
        <p>
          <L
            zh={<>把 Lights Out 退化到一条直线 1 × n。 这时 A 是 n × n 的反射式三对角对称矩阵 <TeX src="A = I + T_n" />。 它的特征多项式遵循切比雪夫式递推 (Sutner 的核心观察):</>}
            en={<>Reduce Lights Out to a 1 × n line. Now A is the n × n reflexive tridiagonal-symmetric matrix <TeX src="A = I + T_n" />. Its characteristic polynomial obeys a Chebyshev-style recurrence — Sutner's key observation:</>}
          />
        </p>
        <TeXBlock src="c_n(x) \;=\; x\,c_{n-1}(x) \;-\; c_{n-2}(x), \qquad c_0 = 1,\; c_1 = x." />
        <p>
          <L
            zh={<>在 𝔽₂ 上, <TeX src="c_n(x)" /> 退化成 <strong>Fibonacci 多项式</strong> (mod 2)。 它告诉我们 <TeX src="\dim \ker A_{1 \times n} = \deg \gcd(c_n(x), \text{something trivial}) = 1" /> 当 <TeX src="n \equiv 2 \pmod 3" />,否则为 0。 也就是说:</>}
            en={<>Over <TeX src="\mathbb{F}_2" />, <TeX src="c_n(x)" /> reduces to the <strong>Fibonacci polynomial</strong> mod 2. Consequence: <TeX src="\dim \ker A_{1 \times n} = 1" /> if <TeX src="n \equiv 2 \pmod 3" />, else 0. Concretely:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L zh={<>n = 2: 安静图案 (1, 1) — 按两按钮 ⇒ 复原。 一半图案不可解。</>} en={<>n = 2: quiet pattern (1, 1) — pressing both buttons restores all-off. Half of patterns unsolvable.</>} /></li>
          <li><L zh={<>n = 5: 安静图案 (1, 1, 0, 1, 1)。 一半不可解。</>} en={<>n = 5: quiet pattern (1, 1, 0, 1, 1). Half unsolvable.</>} /></li>
          <li><L zh={<>n = 8: 安静图案 (1, 1, 0, 1, 1, 0, 1, 1)。 — 注意周期 3 的节奏。</>} en={<>n = 8: quiet pattern (1, 1, 0, 1, 1, 0, 1, 1). Period-3 rhythm visible.</>} /></li>
          <li><L zh={<>n = 3, 4, 6, 7, 9, …: 任意图案可解。</>} en={<>n = 3, 4, 6, 7, 9, …: every pattern solvable.</>} /></li>
        </ul>
        <div className="gt-panel">
          <div className="gt-panel-title">{tr({ zh: 'n 滑动 · 高亮安静图案', en: 'slide n · highlight quiet pattern'
        })}</div>
          <LineLightsSlider />
        </div>
        <p>
          <L
            zh={<>把直线 <em>合上</em> 变成环 (索引 mod n 加 1, mod n 减 1) — 即在循环图 <TeX src="C_n" /> 上的 σ⁺ 游戏。 现在 A 是 <strong>循环对称</strong> 的 (它是 n × n 循环矩阵 = <em>circulant</em>)。 用循环矩阵的离散 Fourier 对角化, 在 𝔽₂ 上可证:</>}
            en={<>Now <em>close</em> the line into a ring (index mod n addition) — the σ⁺ game on the cycle <TeX src="C_n" />. The matrix A becomes <strong>cyclic-symmetric</strong> (an n × n <em>circulant</em>). Diagonalising over its discrete Fourier basis, one proves over <TeX src="\mathbb{F}_2" />:</>}
          />
        </p>
        <TeXBlock src="\dim \ker A_{C_n} \;=\; \begin{cases} 2 & n \equiv 0 \pmod 3 \\ 0 & \text{otherwise}.\end{cases}" />
        <p>
          <L
            zh={<>对比 <strong>直线</strong> (mod 3 ≡ 2 才有核) 与 <strong>圆环</strong> (mod 3 ≡ 0 才有核, 而且维度 2 不是 1) — 同样的局部规则, 不同拓扑给出完全不同的核维度。 这是 「<em>边界条件改变全局解空间</em>」 的最干净的小例子。</>}
            en={<>Contrast: the <strong>line</strong> needs n ≡ 2 (mod 3) for a non-trivial kernel; the <strong>cycle</strong> needs n ≡ 0 (mod 3) and gives dimension 2 (not 1). Same local rule, different topology, completely different kernel. The cleanest small example of "<em>boundary conditions change the global solution space</em>".</>}
          />
        </p>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="27.6  Sutner 递推 + gcd 核公式" en="27.6  Sutner's recurrence + gcd kernel formula" />
        </h3>
        <p>
          <L
            zh={<>一般 m × n 板的核维度有一条 <em>极漂亮</em> 的代数公式 — Sutner (1989) 与 Anderson–Feil (1998) 整理出来。 用 §27.5 的多项式 <TeX src="c_n(x)" />, 定理是:</>}
            en={<>For a general m × n board, the kernel dimension has a strikingly elegant algebraic formula — due to Sutner (1989) and crystallised by Anderson & Feil (1998). With <TeX src="c_n(x)" /> from §27.5:</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 27.2 (Sutner 1989)', en: 'Theorem 27.2 (Sutner 1989)' })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>对 m × n 网格 Lights Out, <TeX src="\dim \ker A_{m \times n} = \deg \gcd\bigl(c_m(x),\; c_n(-x - 1)\bigr)" /> over <TeX src="\mathbb{F}_2" />, 其中 <TeX src="c_k" /> 由 <TeX src="c_k(x) = x\,c_{k-1}(x) - c_{k-2}(x)" />, <TeX src="c_0 = 1,\, c_1 = x" /> 定义。</>}
              en={<>For the m × n Lights Out grid, <TeX src="\dim \ker A_{m \times n} = \deg \gcd\bigl(c_m(x),\; c_n(-x - 1)\bigr)" /> over <TeX src="\mathbb{F}_2" />, where <TeX src="c_k" /> satisfies <TeX src="c_k(x) = x\,c_{k-1}(x) - c_{k-2}(x)" /> with <TeX src="c_0 = 1,\, c_1 = x" />.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>关键观察: <strong>A 是 <TeX src="I_m \otimes (I_n + T_n) + T_m \otimes I_n" /></strong> (Kronecker 和)。 对 <TeX src="T_n" /> 在 𝔽₂ 上的每个特征值 λ, 整个 A 在那一支上变成 <TeX src="(I_m + T_m) + \lambda I_m = \lambda I_m + B_m" />, 这是 <TeX src="B_m" /> 在 x = λ + 1 (== −λ − 1 在 𝔽₂ 上) 的求值。 所以 A 是奇异 ⇔ 某个 λ 满足 <TeX src="c_n(\lambda) = 0" /> 且 <TeX src="c_m(-\lambda - 1) = 0" /> — 即两多项式有公共根 — 即它们有 gcd {'>'} 1。</>}
            en={<>Key observation: <strong>A is the Kronecker sum <TeX src="I_m \otimes (I_n + T_n) + T_m \otimes I_n" /></strong>. For each eigenvalue λ of <TeX src="T_n" /> over <TeX src="\mathbb{F}_2" />, A restricts on that eigenblock to <TeX src="(I_m + T_m) + \lambda I_m = \lambda I_m + B_m" />, which is <TeX src="B_m" /> evaluated at x = λ + 1 (≡ −λ − 1 over <TeX src="\mathbb{F}_2" />). So A is singular iff some λ satisfies <TeX src="c_n(\lambda) = 0" /> and <TeX src="c_m(-\lambda - 1) = 0" /> — i.e. the two polynomials share a root — i.e. their gcd has positive degree.</>}
          />
        </p>
        <p>
          <L
            zh={<>把 m, n = 1..8 的核维数算出来 (下面的表格用 <code>gf2Reduce</code> 在浏览器里实时跑) — 你立刻看到 「金色斜纹」: 大约三分之一的尺寸有非平凡核。</>}
            en={<>Compute dim ker for m, n = 1..8 (the table below runs <code>gf2Reduce</code> live in your browser) — a "gold-band" pattern appears: roughly one-third of sizes carry a non-trivial kernel.</>}
          />
        </p>
        <div className="gt-panel">
          <div className="gt-panel-title">{tr({ zh: 'dim ker A_{m×n} 表 — 浏览器实时计算', en: 'dim ker A_{m×n} table — computed live in your browser'
        })}</div>
          <KernelDimTable />
        </div>
        <div className="gt-aside" style={{ marginTop: 8 }}>
          <L
            zh={<>5 × 5 的 dim = 2 (Tiger 商业版选这个尺寸不是偶然 — 太小没有 「核」 也就没有 「不可解图案」, 失去趣味; 太大手指点不过来。 5 × 5 刚好。)。 4 × 4 在 𝔽₂ 上居然是满秩的 (dim = 0) — 所以 mini-Lights Out 没有 quiet patterns。 6 × 6 也是满秩。 7 × 7 上 dim = 0,但 9 × 9 上 dim = 8 — 跳得相当突兀。</>}
            en={<>5 × 5 has dim = 2 (Tiger's commercial choice was not coincidental — too small means no kernel, no "unreachable patterns", no flavour; too large and fingers can't keep up. 5 × 5 hits the sweet spot.). The 4 × 4 board is full rank over <TeX src="\mathbb{F}_2" /> (dim = 0) — mini-Lights Out has no quiet patterns. 6 × 6 is full rank too. 7 × 7 has dim = 0, but 9 × 9 has dim = 8 — a striking jump.</>}
          />
        </div>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="27.7  σ-game — Lights Out 的图论推广" en="27.7  σ-game — graph-theoretic generalisation" />
        </h3>
        <p>
          <L
            zh={<>Sutner 1989 年的 <em>σ-game</em> 把 Lights Out 推广到任意简单图 G = (V, E)。 顶点 = 灯。 按顶点 v 的规则:</>}
            en={<>Sutner's 1989 paper introduced the <em>σ-game</em> on an arbitrary simple graph G = (V, E). Vertices are lights. Pressing vertex v:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L zh={<><strong>σ-game</strong>: 翻转 v 的 <em>邻居</em> (不含 v 自己)。 邻接矩阵 = A(G)。</>} en={<><strong>σ-game</strong>: toggles the <em>neighbours</em> of v (excluding v itself). Operator = A(G), the adjacency matrix.</>} /></li>
          <li><L zh={<><strong>σ⁺-game</strong>: 翻转 v 与所有邻居 (自反式)。 算子 = A(G) + I = 「闭邻居矩阵」。 这才是 Lights Out。</>} en={<><strong>σ⁺-game</strong>: toggles v <em>and</em> all neighbours (reflexive). Operator = A(G) + I — the "closed neighbourhood" matrix. This is Lights Out.</>} /></li>
        </ul>
        <p>
          <L
            zh={<>Sutner 的招牌定理 — 一个 「<em>每个图上都能点亮一切</em>」 的奇迹结果:</>}
            en={<>Sutner's signature theorem — an "<em>every graph can be all-lit</em>" miracle:</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 27.3 (Sutner 1989 — σ⁺ 全亮)', en: 'Theorem 27.3 (Sutner 1989 — universal σ⁺ solvability)' })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>对 <em>任意</em> 有限简单图 G, σ⁺ 游戏中的 「全亮目标」 <TeX src="\mathbf{1} = (1, 1, \ldots, 1)" /> 总是可解 — 即存在按钮选择 <TeX src="x \in \mathbb{F}_2^{|V|}" /> 满足 <TeX src="(A(G) + I)\,x = \mathbf{1}" />。</>}
              en={<>For <em>every</em> finite simple graph G, the σ⁺-game's "all-lit" target <TeX src="\mathbf{1} = (1, 1, \ldots, 1)" /> is solvable — there exists <TeX src="x \in \mathbb{F}_2^{|V|}" /> with <TeX src="(A(G) + I)\,x = \mathbf{1}" />.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>证明思路: <TeX src="A(G) + I" /> 在 𝔽₂ 上对称, 所以 <TeX src="\mathrm{im}\,(A+I) = (\ker(A+I))^{\perp}" />。 关键引理: <strong>任何核向量 v ∈ ker(A + I) 都有偶汉明权</strong> (因为 v 的支持集是 G 的某种 「奇数封闭邻居子集」, 由握手引理得偶), 于是 <TeX src="v \cdot \mathbf{1} = |v|_1 \equiv 0 \pmod 2" />, 故 <TeX src="\mathbf{1} \perp \ker(A+I)" />, 故 <TeX src="\mathbf{1} \in \mathrm{im}\,(A+I)" />。 QED. 这是个 <em>纯组合</em> 引理被代数化的漂亮范例。</>}
            en={<>Proof sketch: A + I is symmetric over <TeX src="\mathbb{F}_2" />, so <TeX src="\mathrm{im}\,(A+I) = (\ker(A+I))^{\perp}" />. Key lemma: <strong>every kernel vector v ∈ ker(A + I) has even Hamming weight</strong> — its support is an "odd closed-neighbourhood subset" of G, and the handshake lemma forces it to be even. Therefore <TeX src="v \cdot \mathbf{1} = |v|_1 \equiv 0 \pmod 2" />, so <TeX src="\mathbf{1} \perp \ker(A+I)" />, so <TeX src="\mathbf{1} \in \mathrm{im}\,(A+I)" />. QED. A delicious example of a <em>combinatorial</em> lemma getting algebraised.</>}
          />
        </p>
        <p>
          <L
            zh={<>下面是 5 个小图上的实战。 P₅ 是路径, C₅ 是 5-环, K₄ 与 K₅ 完全图, Petersen 是 10-顶点 3-正则的著名图。 点 「显示全亮解」 看 Sutner 定理选的按钮集 (绿圈)。</>}
            en={<>Here are 5 small graphs. P₅ is a path, C₅ a 5-cycle, K₄ and K₅ complete, Petersen the famous 10-vertex 3-regular graph. Click "show all-ones solution" to see the press set Sutner's theorem guarantees (green ring).</>}
          />
        </p>
        <div className="gt-panel">
          <div className="gt-panel-title">σ⁺ {tr({ zh: '游戏 · 5 个预设小图', en: 'game · 5 preset small graphs'
        })}</div>
          <div className="gt-panel-sub">{tr({ zh: '点顶点 = 按按钮 · 看灯阵实时反应 · 也可让程序展示 Sutner 解', en: 'click vertex = press button · live lit-state · or auto-show the Sutner solution'
        })}</div>
          <SigmaGameOnGraph />
        </div>
        <p>
          <L
            zh={<>注意 Petersen 在 σ⁺ 上 dim ker = 0 (满秩), 所以全亮解唯一。 K₅ 的 <TeX src="A + I" /> 是全 1 5 × 5 矩阵, 它在 𝔽₂ 上秩 1, 核维 4 — 全亮解一共 <TeX src="2^4 = 16" /> 种 (每种按 1 个或 3 个或 5 个顶点都行)。</>}
            en={<>Note Petersen has dim ker = 0 in σ⁺ (full rank), so its all-ones solution is unique. K₅'s A + I is the all-ones 5 × 5 matrix, rank 1 over <TeX src="\mathbb{F}_2" /> with nullity 4 — the all-ones target has <TeX src="2^4 = 16" /> different solutions (pressing any 1, 3, or 5 of the vertices works).</>}
          />
        </p>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="27.8  变种 — 不同拓扑、不同字母表" en="27.8  Variants — different topologies, different alphabets" />
        </h3>
        <p>
          <L
            zh={<>Tiger 与各家厂商把 Lights Out 改造过很多次, 每个变种都是 「换一个 (G, k)」 — 换图 G 或换数域 <TeX src="\mathbb{F}_k" />。 已经研究透的几例:</>}
            en={<>Tiger and others have re-issued Lights Out many times; each variant is "swap (G, k)" — change graph G or coefficient ring <TeX src="\mathbb{F}_k" />. The well-studied ones:</>}
          />
        </p>
        <div className="gt-pattern-table">
          <table className="gt-pattern-tbl">
            <thead>
              <tr>
                <th>{tr({ zh: '变种', en: 'variant'
                })}</th>
                <th>{tr({ zh: '图 G', en: 'graph G'
                })}</th>
                <th>{tr({ zh: '数域', en: 'ring'
                })}</th>
                <th>{tr({ zh: '状态空间', en: 'state space'
                })}</th>
                <th>dim ker</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Lights Out</strong> (1995)</td>
                <td>5 × 5 {tr({ zh: '方格', en: 'grid' })}</td>
                <td><TeX src="\mathbb{F}_2" /></td>
                <td>2²³ = 8.4 M</td>
                <td className="num">2</td>
              </tr>
              <tr>
                <td><strong>Mini Lights Out</strong></td>
                <td>4 × 4 {tr({ zh: '环面', en: 'torus'
                })}</td>
                <td><TeX src="\mathbb{F}_2" /></td>
                <td>2¹⁶ = 65 K</td>
                <td className="num">0</td>
              </tr>
              <tr>
                <td><strong>Lights Out 2000</strong></td>
                <td>5 × 5 {tr({ zh: '方格', en: 'grid' })}</td>
                <td><TeX src="\mathbb{F}_3" /></td>
                <td>3²² ≈ 31 G</td>
                <td className="num">3</td>
              </tr>
              <tr>
                <td><strong>Lights Out Cube</strong></td>
                <td>3 × 3 × 3 {tr({ zh: '表面 (54 灯)', en: 'surface (54 lights)'
                })}</td>
                <td><TeX src="\mathbb{F}_2" /></td>
                <td>2⁴⁸ ≈ 281 T</td>
                <td className="num">6</td>
              </tr>
              <tr>
                <td><strong>Lights Out Deluxe</strong></td>
                <td>6 × 6 {tr({ zh: '方格 + 对角邻居', en: 'grid + diag neighbours'
                })}</td>
                <td><TeX src="\mathbb{F}_2" /></td>
                <td>2³⁶ ≈ 69 G</td>
                <td className="num">0</td>
              </tr>
              <tr>
                <td>XL-25 (1983, Vulcan)</td>
                <td>5 × 5 {tr({ zh: '方格 (商业最早)', en: 'grid (earliest commercial)'
                })}</td>
                <td><TeX src="\mathbb{F}_2" /></td>
                <td>2²³</td>
                <td className="num">2</td>
              </tr>
              <tr>
                <td>{tr({ zh: '六边形 Lights Out', en: 'hex Lights Out'
                })}</td>
                <td>{tr({ zh: '六边形蜂窝', en: 'hexagonal honeycomb'
                })}</td>
                <td><TeX src="\mathbb{F}_2" /></td>
                <td>{tr({ zh: '依尺寸', en: 'size-dependent' })}</td>
                <td>{tr({ zh: '依尺寸', en: 'varies' })}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          <L
            zh={<>Lights Out Cube 的 dim ker = 6 来自 3 × 3 × 3 表面图的对称性: 24 个外部立方旋转对称给出 6 个独立的 「面对称」 安静图案。 这跟魔方群的 24 个外部对称 (§14) 是 <em>同一组对称作用在同一个 3 × 3 × 3 表面</em> — 但作用在不同的代数对象 (邻接 vs 置换) 上, 结果完全不同。</>}
            en={<>The Cube variant's dim ker = 6 stems from the 3 × 3 × 3 surface graph's symmetry: the 24 outer cube rotations give 6 independent "face-symmetric" quiet patterns. The 24-rotation group is the same as the cube symmetries from §14 — but acting on a different algebraic object (adjacency vs permutation), the outcome is completely different.</>}
          />
        </p>
        <p>
          <L
            zh={<><strong>Lights Out 2000</strong> 走 mod 3: 灯有 3 个状态 (灰 / 绿 / 红), 按一下 +1 mod 3。 算子矩阵 <em>同一个</em> <TeX src="A_{5 \times 5}" />, 但在 <TeX src="\mathbb{F}_3" /> 上。 它的核维变成 3 — 多出来的 「mod 3 安静图案」 在 <TeX src="\mathbb{F}_2" /> 视角下是看不见的。 一般定理: <TeX src="\dim_{\mathbb{F}_p} \ker A" /> 跟 p 有关; <TeX src="\det A" /> 决定哪些素数 p 让 A 在 <TeX src="\mathbb{F}_p" /> 上奇异。 在 5 × 5 上, <TeX src="\det A_{5 \times 5} = 0" /> over <TeX src="\mathbb{Z}" />, 但用 Smith 标准型可看出它的 「elementary divisors」 在 mod 2 与 mod 3 上都贡献奇异。</>}
            en={<><strong>Lights Out 2000</strong> moves to mod 3: lights cycle through grey / green / red on each press. The <em>same</em> matrix <TeX src="A_{5 \times 5}" /> now lives over <TeX src="\mathbb{F}_3" />. Its kernel dimension jumps to 3 — the extra "mod 3 quiet patterns" are invisible from the <TeX src="\mathbb{F}_2" /> viewpoint. General fact: <TeX src="\dim_{\mathbb{F}_p} \ker A" /> depends on p; the integer determinant <TeX src="\det A" /> tells you exactly which primes make A singular. On 5 × 5, <TeX src="\det A = 0" /> over <TeX src="\mathbb{Z}" />, and the Smith normal form shows the elementary divisors contribute singular behaviour at both mod 2 and mod 3.</>}
          />
        </p>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="27.9  与编码理论的桥" en="27.9  Bridge to coding theory" />
        </h3>
        <p>
          <L
            zh={<>Lights Out 实际上是一个 <strong>𝔽₂ 上的线性编码问题</strong>。 把 「按钮配置」 看作明文 <TeX src="x \in \mathbb{F}_2^{25}" />, 「亮灯图案」 看作密文 <TeX src="y = Ax \in \mathbb{F}_2^{25}" />, 那么:</>}
            en={<>Lights Out is literally a <strong>linear coding problem over <TeX src="\mathbb{F}_2" /></strong>. Think of "button configuration" as plaintext <TeX src="x \in \mathbb{F}_2^{25}" /> and "lit pattern" as codeword <TeX src="y = Ax \in \mathbb{F}_2^{25}" />, then:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L zh={<>编码矩阵 = A · 编码长度 25 · 信息长度 23 ( = rank A) · 冗余 2 ( = dim ker A)。</>} en={<>Encoding matrix = A · code length 25 · message length 23 ( = rank A) · 2 parity bits ( = dim ker A).</>} /></li>
          <li><L zh={<>「可解判据 = p ⊥ ker A」 是经典 <strong>校验子解码</strong>: 拿 ker A 的基当 「校验矩阵」 H, 看 <TeX src="Hp = 0" /> 是否成立。</>} en={<>"Solvable iff p ⊥ ker A" is classic <strong>syndrome decoding</strong>: use a basis of ker A as a parity-check matrix H, test <TeX src="Hp = 0" />.</>} /></li>
          <li><L zh={<>「最短解」 = <strong>最小汉明权陪集代表</strong> = 「最近码字」 — 一般 NP-hard (Berlekamp–McEliece–Tilborg 1978), 但 25 × 25 的实例小到能枚举 ker A 的 4 个余类。</>} en={<>"Minimum-length solve" = <strong>minimum-Hamming-weight coset representative</strong> = "nearest codeword" — NP-hard in general (Berlekamp–McEliece–Tilborg 1978), but the 25 × 25 instance is small enough to enumerate the 4 cosets of ker A.</>} /></li>
        </ul>
        <p>
          <L
            zh={<>这把 「玩具谜题」 与 「LDPC / 编码理论」 接在了一起。 反过来, 任何 𝔽₂ 上的可解线性方程组都可以重写为某种 Lights Out 实例。</>}
            en={<>This links the toy puzzle to LDPC / coding theory. Conversely, any solvable <TeX src="\mathbb{F}_2" />-linear system can be re-cast as some Lights Out instance.</>}
          />
        </p>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="27.10  复杂度 — 为什么 Lights Out ≪ 魔方" en="27.10  Complexity — why Lights Out ≪ Rubik's cube" />
        </h3>
        <p>
          <L
            zh={<>三件事让 Lights Out 「容易」:</>}
            en={<>Three facts make Lights Out "easy":</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L zh={<><strong>阿贝尔</strong>: 按按钮的顺序不重要 (任意 i, j: <TeX src="A_i + A_j = A_j + A_i" />)。 状态空间是个群 <TeX src="\mathbb{F}_2^{mn}" />, 而 「解谜」 = 「在群里找代表」 — 线性代数即可。</>} en={<><strong>Abelian</strong>: press order is irrelevant (<TeX src="A_i + A_j = A_j + A_i" />). The state space is the group <TeX src="\mathbb{F}_2^{mn}" />, and solving = "find a representative" — linear algebra suffices.</>} /></li>
          <li><L zh={<><strong>线性</strong>: 算子 <TeX src="x \mapsto Ax" /> 是线性的, 所以 「叠加原理」 可用 — 任意目标分解为基目标。</>} en={<><strong>Linear</strong>: the operator <TeX src="x \mapsto Ax" /> is linear, so superposition works — decompose any target into a basis.</>} /></li>
          <li><L zh={<><strong>对合</strong>: 每个按钮按两次抵消, 即 <TeX src="x \in \mathbb{F}_2^{mn}" /> 而非 <TeX src="\mathbb{Z}^{mn}" />。 限制状态空间到 「最多按一次」 是免费的。</>} en={<><strong>Involutive</strong>: each button squares to identity, so <TeX src="x \in \mathbb{F}_2^{mn}" /> instead of <TeX src="\mathbb{Z}^{mn}" />. Restricting to "press at most once" is free.</>} /></li>
        </ul>
        <p>
          <L
            zh={<>结果: 大小为 N = mn 的 Lights Out 上, 「<em>有没有解</em>」 与 「<em>最短解</em>」 都在 <TeX src="O(N^3)" /> 时间内可决, 实际上 <TeX src="O(N^\omega)" />, <TeX src="\omega \approx 2.37" /> (最快矩阵乘法)。 对比魔方:  「<em>最短解</em>」 在 n × n × n 上是 <strong>NP-完备</strong> (Demaine et al. 2018)。 取消上面任一个性质 (e.g. 按钮顺序变重要 → 非阿贝尔, 或灯有 4 个状态 + 非线性规则), Lights Out 立刻进入 NP-hard 领域。</>}
            en={<>Consequence: on an N = mn-cell Lights Out board, <em>is it solvable?</em> and <em>what is a shortest solve?</em> are both in <TeX src="O(N^3)" /> time, or <TeX src="O(N^\omega)" /> with <TeX src="\omega \approx 2.37" /> (fastest known matrix multiplication). Contrast: optimal-solving the n × n × n Rubik's cube is <strong>NP-complete</strong> (Demaine et al. 2018). Drop any of the three properties above (press order matters → non-Abelian; or 4-state lights with non-linear rule), and Lights Out lands in NP-hard immediately.</>}
          />
        </p>
        <div className="gt-pullquote">
          <L
            zh={<>「阿贝尔的玩具靠线性代数, 非阿贝尔的玩具靠 NP-硬度证明。 Lights Out 与魔方分立这道分水岭的两侧。」</>}
            en={<>"Abelian toys yield to linear algebra; non-Abelian toys yield NP-hardness proofs. Lights Out and Rubik's cube sit on opposite sides of this watershed."</>}
          />
        </div>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="27.11  历史小注" en="27.11  Historical note" />
        </h3>
        <p>
          <L
            zh={<>商业最早是 1983 年匈牙利 László Mérő 设计的 <strong>XL-25</strong> (Vulcan Electronics) — 5 × 5 + 标准与马步两种规则。 1978 年的 <em>Merlin</em> 已用 3 × 3 + 不同规则。 1995 年 Tiger Electronics 推出 <strong>Lights Out</strong>, 在大众市场普及, 后续 Lights Out 2000 (1997) / Cube / Deluxe 都是 Tiger 出的。  数学方面: <strong>Sutner (1989)</strong> 在 σ-game 框架下给出递推与 gcd 公式, 是奠基论文; <strong>Anderson & Feil (1998)</strong> <em>Mathematics Magazine</em> 「Turning Lights Out with Linear Algebra」 把它编成本科教材级别的标准例; <strong>Goldwasser, Klostermeyer, Trapp (1995–1997)</strong> 给出 「dominos / monominos 计数」 的可解判据。 这是 「<em>一道童玩问题, 半世纪学术工作</em>」 的标本之一。</>}
            en={<>The earliest commercial release was <strong>XL-25</strong> (Vulcan Electronics 1983), invented by Hungarian László Mérő — 5 × 5 with both standard and knight's-move rules. <em>Merlin</em> (1978) had used a 3 × 3 with a different rule. Tiger Electronics released <strong>Lights Out</strong> in 1995 and made it a household toy; Lights Out 2000 (1997) / Cube / Deluxe followed. On the math side: <strong>Sutner (1989)</strong> introduced the σ-game framework with the recurrence and gcd formula — the foundational paper; <strong>Anderson & Feil (1998)</strong>, "Turning Lights Out with Linear Algebra" in <em>Mathematics Magazine</em>, made it an undergraduate-textbook standard; <strong>Goldwasser, Klostermeyer, Trapp (1995–1997)</strong> gave the domino/monomino tiling characterisation. A specimen of "<em>one toy puzzle, half a century of academic work</em>".</>}
          />
        </p>
        <p>
          <L
            zh={<>与魔方放在一起看: 两者都在 1980 年前后从匈牙利 / 美国进入大众视野, 都是 <strong>对称、 可逆、 群论的离散系统</strong>。 区别就是阿贝尔 / 非阿贝尔。 这两个属性决定了 「线性代数能不能搞定」 — 它把它们送进了不同的复杂度类 (P vs NP-hard)。 而正因为 Lights Out 是 P, 它在小学奥数和本科线性代数课里都讲得动; 魔方进不去, 因为还原它需要的算法太特殊。</>}
            en={<>Side by side with the cube: both emerged into popular culture around 1980 from Hungary / the US, both are <strong>symmetric, reversible, group-theoretic discrete systems</strong>. The single difference is Abelian vs non-Abelian — and that single bit determines whether linear algebra suffices, planting the two puzzles in different complexity classes (P vs NP-hard). Because Lights Out is in P, it lectures cleanly in elementary olympiad and undergrad linear algebra; the cube cannot, because the algorithms it needs are too special-purpose.</>}
          />
        </p>
      </GTSec>
  );
}
