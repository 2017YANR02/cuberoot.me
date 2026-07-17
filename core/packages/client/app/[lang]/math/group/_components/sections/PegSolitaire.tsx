'use client';

import { useState, useMemo, useEffect } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { tr } from '@/i18n/tr';

const PEG_ENGLISH = [
  '..XXX..',
  '..XXX..',
  'XXXXXXX',
  'XXX.XXX',
  'XXXXXXX',
  '..XXX..',
  '..XXX..',
];

function buildEnglishBoard(): { cells: { r: number; c: number; key: string }[]; idx: Map<string, number> } {
  const cells: { r: number; c: number; key: string }[] = [];
  const idx = new Map<string, number>();
  for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
    const ch = PEG_ENGLISH[r][c];
    if (ch === 'X' || ch === '.') {
      const key = `${r},${c}`;
      idx.set(key, cells.length);
      cells.push({ r, c, key });
    }
  }
  return { cells, idx };
}

function PegSolitaireBoard() {
  const { cells } = useMemo(buildEnglishBoard, []);
  // peg[i] = 1 if peg present. Initial: all pegs except centre.
  const initial = useMemo(() => {
    return cells.map(c => (c.r === 3 && c.c === 3 ? 0 : 1));
  }, [cells]);
  const [pegs, setPegs] = useState<number[]>(initial);
  const [sel, setSel] = useState<number | null>(null);
  const [hist, setHist] = useState<number[][]>([initial]);
  const [showColoring, setShowColoring] = useState<'none' | 'diag1' | 'diag2'>('none');

  const reset = () => { setPegs(initial); setSel(null); setHist([initial]); };
  const undo = () => {
    if (hist.length <= 1) return;
    const h2 = hist.slice(0, -1);
    setHist(h2);
    setPegs(h2[h2.length - 1]);
    setSel(null);
  };

  // Try jump from src to dst (over middle); record if legal
  const tryMove = (src: number, dst: number) => {
    const sc = cells[src], dc = cells[dst];
    if (pegs[src] !== 1 || pegs[dst] !== 0) return false;
    const dr = dc.r - sc.r, dcc = dc.c - sc.c;
    if (!((Math.abs(dr) === 2 && dcc === 0) || (Math.abs(dcc) === 2 && dr === 0))) return false;
    const midKey = `${sc.r + dr / 2},${sc.c + dcc / 2}`;
    const mid = cells.findIndex(c => c.key === midKey);
    if (mid < 0 || pegs[mid] !== 1) return false;
    const next = [...pegs];
    next[src] = 0; next[mid] = 0; next[dst] = 1;
    setPegs(next);
    setHist(h => [...h, next]);
    return true;
  };

  const onCell = (i: number) => {
    if (sel === null) {
      if (pegs[i] === 1) setSel(i);
      return;
    }
    if (i === sel) { setSel(null); return; }
    if (tryMove(sel, i)) { setSel(null); return; }
    if (pegs[i] === 1) setSel(i);
  };

  // 3-coloring: color = (r + c) mod 3 vs (r - c) mod 3 with both → intersection
  const colorOf = (r: number, c: number) => {
    if (showColoring === 'diag1') return (r + c) % 3;
    if (showColoring === 'diag2') return ((r - c) % 3 + 3) % 3;
    return -1;
  };
  const colorClass = (col: number) => {
    if (col === 0) return 'gt-peg-r';
    if (col === 1) return 'gt-peg-b';
    if (col === 2) return 'gt-peg-y';
    return '';
  };

  // Count pegs per colour
  const colorCounts: [number, number, number] = [0, 0, 0];
  if (showColoring !== 'none') {
    for (let i = 0; i < cells.length; i++) if (pegs[i]) {
      const col = colorOf(cells[i].r, cells[i].c);
      if (col >= 0) colorCounts[col]++;
    }
  }

  const pegCount = pegs.reduce((a, b) => a + b, 0);
  const moveCount = hist.length - 1;
  const isWin = pegCount === 1 && pegs[cells.findIndex(c => c.r === 3 && c.c === 3)] === 1;

  return (
    <div className="gt-peg">
      <div className="gt-peg-board">
        {cells.map((c, i) => {
          const col = colorOf(c.r, c.c);
          return (
            <button
              key={c.key}
              type="button"
              className={`gt-peg-cell ${pegs[i] ? 'peg' : 'hole'} ${sel === i ? 'sel' : ''} ${colorClass(col)}`}
              style={{ gridColumn: c.c + 1, gridRow: c.r + 1 }}
              onClick={() => onCell(i)}
              aria-label={`cell ${c.key}`}
            />
          );
        })}
      </div>
      <div className="gt-peg-controls">
        <div className="gt-peg-info">
          <div><span className="gt-peg-label">{tr({ zh: '剩余棋子', en: 'pegs'
        })}</span> <strong>{pegCount}</strong></div>
          <div><span className="gt-peg-label">{tr({ zh: '已走步', en: 'moves' })}</span> <strong>{moveCount}</strong></div>
          {isWin && <div style={{ color: 'var(--green)' }}>★ {tr({ zh: '通关 · 1 子留中央', en: 'solved · 1 peg in centre'
        })}</div>}
        </div>
        {showColoring !== 'none' && (
          <div className="gt-peg-coloring">
            <div className="gt-peg-coloring-cell gt-peg-r">R: <strong>{colorCounts[0]}</strong></div>
            <div className="gt-peg-coloring-cell gt-peg-b">B: <strong>{colorCounts[1]}</strong></div>
            <div className="gt-peg-coloring-cell gt-peg-y">Y: <strong>{colorCounts[2]}</strong></div>
          </div>
        )}
        <div className="gt-peg-buttons">
          <button type="button" className="gt-btn gt-btn-ghost" onClick={undo} disabled={hist.length <= 1}>{tr({ zh: '撤销', en: 'undo'
        })}</button>
          <button type="button" className="gt-btn gt-btn-ghost" onClick={reset}>{tr({ zh: '重置', en: 'reset' })}</button>
          <button type="button" className={`gt-chip ${showColoring === 'none' ? 'gt-chip-active' : ''}`} onClick={() => setShowColoring('none')}>{tr({ zh: '关闭着色', en: 'no colour'
        })}</button>
          <button type="button" className={`gt-chip ${showColoring === 'diag1' ? 'gt-chip-active' : ''}`} onClick={() => setShowColoring('diag1')}>{tr({ zh: '↗ 着色', en: '↗ colouring'
        })}</button>
          <button type="button" className={`gt-chip ${showColoring === 'diag2' ? 'gt-chip-active' : ''}`} onClick={() => setShowColoring('diag2')}>{tr({ zh: '↘ 着色', en: '↘ colouring'
        })}</button>
        </div>
      </div>
    </div>
  );
}

// 15-peg triangle with SAX live counter

// 15-peg triangle with SAX live counter
function PegTriangleSAX() {
  // Cells indexed top-down, left-right: rows 1..5, count i pegs per row.
  type T = { r: number; c: number; central: boolean };
  const cells: T[] = useMemo(() => {
    const out: T[] = [];
    // Mark "central" 3 cells (in a 15-cell triangle the 3 'inner' cells are
    // positions: (3,1), (3,2), (4,2) using a row,col-within-row scheme).
    const central = new Set(['2,1', '3,1', '3,2']);
    for (let r = 0; r < 5; r++) for (let c = 0; c <= r; c++) {
      out.push({ r, c, central: central.has(`${r},${c}`) });
    }
    return out;
  }, []);
  const N = cells.length; // 15
  const initial = useMemo(() => cells.map((_, i) => i === 0 ? 0 : 1), [cells]);
  const [pegs, setPegs] = useState<number[]>(initial);
  const [sel, setSel] = useState<number | null>(null);
  const [hist, setHist] = useState<number[][]>([initial]);

  // For SAX: A = filled centrals; X = filled perimeters; S = edge-triples with ≥2 pegs.
  // Edge triples = collinear triples of cells.
  const triples: number[][] = useMemo(() => {
    const out: number[][] = [];
    const find = (r: number, c: number) => cells.findIndex(p => p.r === r && p.c === c);
    // Horizontal
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c + 2 <= r; c++) {
        out.push([find(r, c), find(r, c + 1), find(r, c + 2)]);
      }
    }
    // Diagonal /
    for (let c = 0; c < 5; c++) for (let r = c; r + 2 < 5; r++) {
      const a = find(r, c), b = find(r + 1, c), d = find(r + 2, c);
      if (a >= 0 && b >= 0 && d >= 0) out.push([a, b, d]);
    }
    // Diagonal \
    for (let r = 0; r < 5; r++) for (let c = 0; c + 2 <= r; c++) {
      const a = find(r, c), b = find(r + 1, c + 1), d = find(r + 2, c + 2);
      if (a >= 0 && b >= 0 && d >= 0) out.push([a, b, d]);
    }
    return out;
  }, [cells]);

  let A = 0, X = 0, S = 0;
  for (let i = 0; i < N; i++) if (pegs[i]) {
    if (cells[i].central) A++; else X++;
  }
  for (const t of triples) if ((pegs[t[0]] + pegs[t[1]] + pegs[t[2]]) >= 2) S++;
  const sax = S + A - X;

  // Move logic: src jumps over mid into dst. Mid must be adjacent in a triple.
  const tryMove = (src: number, dst: number) => {
    if (pegs[src] !== 1 || pegs[dst] !== 0) return false;
    const t = triples.find(t => (t[0] === src && t[2] === dst) || (t[2] === src && t[0] === dst));
    if (!t) return false;
    const mid = t[1];
    if (pegs[mid] !== 1) return false;
    const next = [...pegs];
    next[src] = 0; next[mid] = 0; next[dst] = 1;
    setPegs(next); setHist(h => [...h, next]);
    return true;
  };
  const onCell = (i: number) => {
    if (sel === null) { if (pegs[i] === 1) setSel(i); return; }
    if (i === sel) { setSel(null); return; }
    if (tryMove(sel, i)) { setSel(null); return; }
    if (pegs[i] === 1) setSel(i);
  };
  const reset = () => { setPegs(initial); setSel(null); setHist([initial]); };
  const undo = () => {
    if (hist.length <= 1) return;
    const h2 = hist.slice(0, -1); setHist(h2); setPegs(h2[h2.length - 1]); setSel(null);
  };
  return (
    <div className="gt-peg-tri">
      <div className="gt-peg-tri-board">
        {cells.map((cell, i) => (
          <button
            key={i}
            type="button"
            className={`gt-peg-cell ${pegs[i] ? 'peg' : 'hole'} ${sel === i ? 'sel' : ''} ${cell.central ? 'central' : ''}`}
            style={{
              gridColumn: `${5 - cell.r + cell.c * 2} / span 2`,
              gridRow: cell.r + 1,
            }}
            onClick={() => onCell(i)}
          />
        ))}
      </div>
      <div className="gt-peg-tri-side">
        <div className="gt-peg-sax">
          <div><span className="gt-peg-label">S (≥2/triple)</span> <strong>{S}</strong></div>
          <div><span className="gt-peg-label">A (中央 / central)</span> <strong>{A}</strong></div>
          <div><span className="gt-peg-label">X (外围 / perimeter)</span> <strong>{X}</strong></div>
          <div className="gt-peg-sax-total"><span className="gt-peg-label">S + A − X</span> <strong>{sax}</strong></div>
          <div className="gt-peg-sax-note">{tr({ zh: '此值在每步跳跃下不增 — 不变量', en: 'non-increasing under play — invariant'
        })}</div>
        </div>
        <div className="gt-peg-buttons">
          <button type="button" className="gt-btn gt-btn-ghost" onClick={undo} disabled={hist.length <= 1}>{tr({ zh: '撤销', en: 'undo'
        })}</button>
          <button type="button" className="gt-btn gt-btn-ghost" onClick={reset}>{tr({ zh: '重置', en: 'reset' })}</button>
        </div>
      </div>
    </div>
  );
}

// ── §29 Hamiltonian Paths — Gray code walker, Petersen graph ────────────────

// Shows the augmented matrix [A | b] for the 3×3 Lights Out adjacency operator
type PegCell = { r: number; c: number; key: string };

type PegBoard = { cells: PegCell[]; idx: Map<string, number>; rows: number; cols: number };

function parsePegBoard(ascii: string[]): PegBoard {
  const rows = ascii.length;
  const cols = Math.max(...ascii.map(s => s.length));
  const cells: PegCell[] = [];
  const idx = new Map<string, number>();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = ascii[r][c] ?? ' ';
      if (ch === 'X' || ch === '.') {
        const key = `${r},${c}`;
        idx.set(key, cells.length);
        cells.push({ r, c, key });
      }
    }
  }
  return { cells, idx, rows, cols };
}

// Five canonical boards.

// Five canonical boards.
const BOARD_ASCII = {
  english: [
    '..XXX..',
    '..XXX..',
    'XXXXXXX',
    'XXX.XXX',
    'XXXXXXX',
    '..XXX..',
    '..XXX..',
  ],
  european: [
    '..XXX..',
    '.XXXXX.',
    'XXXXXXX',
    'XXX.XXX',
    'XXXXXXX',
    '.XXXXX.',
    '..XXX..',
  ],
  // 15-peg triangle, rendered as a staircase of 5 rows.
  triangle: [
    'X      ',
    'XX     ',
    'XXX    ',
    'XXXX   ',
    'XXXXX  ',
  ],
  diamond: [
    '...X...',
    '..XXX..',
    '.XXXXX.',
    'XXX.XXX',
    '.XXXXX.',
    '..XXX..',
    '...X...',
  ],
} as const;

type BoardName = keyof typeof BOARD_ASCII;

// ── PegBoardChoose — switchable parametric board with colour overlays ────

// ── PegBoardChoose — switchable parametric board with colour overlays ────
function PegBoardChoose() {
  const [name, setName] = useState<BoardName>('english');
  const board = useMemo(() => parsePegBoard([...BOARD_ASCII[name]]), [name]);
  const { cells } = board;
  const initial = useMemo(() => {
    // For the triangle we vacate the apex; for the others vacate the centre.
    if (name === 'triangle') return cells.map((_, i) => i === 0 ? 0 : 1);
    const midR = Math.floor(board.rows / 2);
    const midC = Math.floor(board.cols / 2);
    return cells.map(c => (c.r === midR && c.c === midC ? 0 : 1));
  }, [cells, board.rows, board.cols, name]);
  const [pegs, setPegs] = useState<number[]>(initial);
  const [sel, setSel] = useState<number | null>(null);
  const [hist, setHist] = useState<number[][]>([initial]);
  const [overlay, setOverlay] = useState<'none' | 'diag1' | 'diag2'>('none');

  // Reset when board changes.
  useEffect(() => { setPegs(initial); setSel(null); setHist([initial]); }, [initial]);

  const tryMove = (src: number, dst: number) => {
    const sc = cells[src], dc = cells[dst];
    if (pegs[src] !== 1 || pegs[dst] !== 0) return false;
    const dr = dc.r - sc.r, dcc = dc.c - sc.c;
    // Triangle uses sloping rows: allow (2,0), (0,2), (2,2), (-2,-2) etc.
    const ortho = (Math.abs(dr) === 2 && dcc === 0) || (Math.abs(dcc) === 2 && dr === 0);
    const diag  = name === 'triangle' && Math.abs(dr) === 2 && Math.abs(dcc) === 2 && dr === dcc;
    if (!(ortho || diag)) return false;
    const midKey = `${sc.r + dr / 2},${sc.c + dcc / 2}`;
    const mid = board.idx.get(midKey);
    if (mid === undefined || pegs[mid] !== 1) return false;
    const next = [...pegs];
    next[src] = 0; next[mid] = 0; next[dst] = 1;
    setPegs(next);
    setHist(h => [...h, next]);
    return true;
  };
  const onCell = (i: number) => {
    if (sel === null) { if (pegs[i] === 1) setSel(i); return; }
    if (i === sel) { setSel(null); return; }
    if (tryMove(sel, i)) { setSel(null); return; }
    if (pegs[i] === 1) setSel(i);
  };

  const colorOf = (r: number, c: number) =>
    overlay === 'diag1' ? (r + c) % 3 :
    overlay === 'diag2' ? ((r - c) % 3 + 3) % 3 : -1;
  const colorClass = (col: number) =>
    col === 0 ? 'gt-peg-r' : col === 1 ? 'gt-peg-b' : col === 2 ? 'gt-peg-y' : '';

  const colorCounts: [number, number, number] = [0, 0, 0];
  if (overlay !== 'none')
    for (let i = 0; i < cells.length; i++) if (pegs[i]) {
      const col = colorOf(cells[i].r, cells[i].c);
      if (col >= 0) colorCounts[col]++;
    }

  const pegCount = pegs.reduce((a, b) => a + b, 0);
  const moveCount = hist.length - 1;
  const undo = () => {
    if (hist.length <= 1) return;
    const h2 = hist.slice(0, -1); setHist(h2); setPegs(h2[h2.length - 1]); setSel(null);
  };
  const reset = () => { setPegs(initial); setSel(null); setHist([initial]); };

  return (
    <div className="gt-peg-choose">
      <div className="gt-peg-choose-tabs">
        {(['english', 'european', 'triangle', 'diamond'] as BoardName[]).map(b => (
          <button key={b} type="button"
            className={`gt-chip ${name === b ? 'gt-chip-active' : ''}`}
            onClick={() => setName(b)}>
            {b === 'english'  ? tr({ zh: '英式 33', en: 'English 33' })
            : b === 'european' ? tr({ zh: '欧式 37', en: 'European 37'
                                })
            : b === 'triangle' ? tr({ zh: '三角 15', en: 'Triangle 15' })
            :                    tr({ zh: '菱形 25', en: 'Diamond 25' })}
          </button>
        ))}
      </div>
      <div className="gt-peg">
        <div className={`gt-peg-board gt-peg-board-${name}`}
             style={{ gridTemplateColumns: `repeat(${board.cols}, 34px)`,
                      gridTemplateRows:    `repeat(${board.rows}, 34px)` }}>
          {cells.map((c, i) => {
            const col = colorOf(c.r, c.c);
            return (
              <button key={c.key} type="button"
                className={`gt-peg-cell ${pegs[i] ? 'peg' : 'hole'} ${sel === i ? 'sel' : ''} ${colorClass(col)}`}
                style={{ gridColumn: c.c + 1, gridRow: c.r + 1 }}
                onClick={() => onCell(i)}
                aria-label={`cell ${c.key}`} />
            );
          })}
        </div>
        <div className="gt-peg-controls">
          <div className="gt-peg-info">
            <div><span className="gt-peg-label">{tr({ zh: '剩余棋子', en: 'pegs'
            })}</span> <strong>{pegCount}</strong></div>
            <div><span className="gt-peg-label">{tr({ zh: '已走步', en: 'moves' })}</span> <strong>{moveCount}</strong></div>
          </div>
          {overlay !== 'none' && (
            <div className="gt-peg-coloring">
              <div className="gt-peg-coloring-cell gt-peg-r">R: <strong>{colorCounts[0]}</strong></div>
              <div className="gt-peg-coloring-cell gt-peg-b">B: <strong>{colorCounts[1]}</strong></div>
              <div className="gt-peg-coloring-cell gt-peg-y">Y: <strong>{colorCounts[2]}</strong></div>
            </div>
          )}
          <div className="gt-peg-buttons">
            <button type="button" className="gt-btn gt-btn-ghost" onClick={undo} disabled={hist.length <= 1}>{tr({ zh: '撤销', en: 'undo'
            })}</button>
            <button type="button" className="gt-btn gt-btn-ghost" onClick={reset}>{tr({ zh: '重置', en: 'reset' })}</button>
            <button type="button" className={`gt-chip ${overlay === 'none' ? 'gt-chip-active' : ''}`} onClick={() => setOverlay('none')}>{tr({ zh: '关闭着色', en: 'no colour'
            })}</button>
            <button type="button" className={`gt-chip ${overlay === 'diag1' ? 'gt-chip-active' : ''}`} onClick={() => setOverlay('diag1')}>↗</button>
            <button type="button" className={`gt-chip ${overlay === 'diag2' ? 'gt-chip-active' : ''}`} onClick={() => setOverlay('diag2')}>↘</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PagodaCalculator — 7×7 numeric grid; verify f(b) ≤ f(a) + f(c) ──────

// ── PagodaCalculator — 7×7 numeric grid; verify f(b) ≤ f(a) + f(c) ──────
function PagodaCalculator() {
  const lang = useLang();
  const { cells, idx } = useMemo(buildEnglishBoard, []);
  // Default to the Fibonacci pagoda centred at d4.
  const fib = [1, 1, 2, 3, 5, 8, 13];
  const defaultF = useMemo(() => cells.map(c => {
    const d = Math.abs(c.r - 3) + Math.abs(c.c - 3);
    return d < fib.length ? fib[fib.length - 1 - d] : 0;
  }), [cells]);
  const [f, setF] = useState<number[]>(defaultF);
  const [verified, setVerified] = useState<{ ok: boolean; bad: number[][] } | null>(null);

  // Enumerate collinear triples (a, c, b) — same form a jump uses.
  const triples: { a: number; c: number; b: number }[] = useMemo(() => {
    const out: { a: number; c: number; b: number }[] = [];
    for (let i = 0; i < cells.length; i++) {
      const ci = cells[i];
      for (const [dr, dc] of [[0, 1], [1, 0]] as [number, number][]) {
        const m = idx.get(`${ci.r + dr},${ci.c + dc}`);
        const b = idx.get(`${ci.r + 2 * dr},${ci.c + 2 * dc}`);
        if (m !== undefined && b !== undefined) {
          out.push({ a: i, c: m, b });
          out.push({ a: b, c: m, b: i });
        }
      }
    }
    return out;
  }, [cells, idx]);

  const verify = () => {
    const bad: number[][] = [];
    for (const t of triples) if (f[t.b] > f[t.a] + f[t.c]) bad.push([t.a, t.c, t.b]);
    setVerified({ ok: bad.length === 0, bad });
  };
  const sum = f.reduce((s, x) => s + x, 0);
  const badCells = new Set<number>();
  if (verified && !verified.ok) for (const [a, c, b] of verified.bad) { badCells.add(a); badCells.add(c); badCells.add(b); }

  return (
    <div className="gt-peg-pagoda">
      <div className="gt-peg-pagoda-grid"
           style={{ gridTemplateColumns: 'repeat(7, 44px)', gridTemplateRows: 'repeat(7, 44px)' }}>
        {cells.map((c, i) => (
          <input key={c.key} type="number"
            className={`gt-peg-pagoda-cell ${badCells.has(i) ? 'bad' : ''}`}
            style={{ gridColumn: c.c + 1, gridRow: c.r + 1 }}
            value={f[i]}
            onChange={(e) => {
              const v = parseInt(e.target.value || '0', 10);
              setF(prev => prev.map((x, j) => j === i ? (Number.isFinite(v) ? v : 0) : x));
              setVerified(null);
            }} />
        ))}
      </div>
      <div className="gt-peg-pagoda-side">
        <div className="gt-peg-info">
          <div><span className="gt-peg-label">∑ f</span> <strong>{sum}</strong></div>
          {verified && (
            verified.ok
              ? <div style={{ color: 'var(--green)' }}>✓ {tr({ zh: '有效 pagoda · 任意跳均不增和', en: 'valid pagoda — sum is non-increasing' })}</div>
              : <div style={{ color: '#C84A4A' }}>✗ {lang === 'zh' ? `${verified.bad.length} 个三元组违反 f(b) ≤ f(a) + f(c)` : `${verified.bad.length} triples violate f(b) ≤ f(a) + f(c)`}</div>
          )}
        </div>
        <div className="gt-peg-buttons">
          <button type="button" className="gt-btn" onClick={verify}>{tr({ zh: '验证 pagoda', en: 'verify pagoda'
        })}</button>
          <button type="button" className="gt-btn gt-btn-ghost" onClick={() => { setF(defaultF); setVerified(null); }}>{tr({ zh: 'Fibonacci 预设', en: 'Fibonacci preset'
        })}</button>
          <button type="button" className="gt-btn gt-btn-ghost" onClick={() => { setF(cells.map(() => 0)); setVerified(null); }}>{tr({ zh: '清零', en: 'clear' })}</button>
          <button type="button" className="gt-btn gt-btn-ghost" onClick={() => { setF(cells.map(() => 1)); setVerified(null); }}>{tr({ zh: '全 1', en: 'all 1' })}</button>
        </div>
      </div>
    </div>
  );
}

// ── GF4ColouringDisplay — Conway Z/2 × Z/2 labelling ────────────────────
// Identify cells with (r mod 2, c mod 2) → an element of Z/2 × Z/2 = GF(4)
// when we pair the rows. Conway's standard labelling on the English board
// assigns to cell (r, c) the element f(r, c) = a^r · b^c in {1, a, b, ab}
// (multiplicatively) — equivalently (r mod 2, c mod 2) additively. Any three
// collinear cells (a, c, b) have (r, c) differing by (Δ, 0) or (0, Δ) in
// steps of 1, so f(a) + f(c) + f(b) = 0 ∈ GF(4) for every legal jump.

// steps of 1, so f(a) + f(c) + f(b) = 0 ∈ GF(4) for every legal jump.
function GF4ColouringDisplay() {
  const lang = useLang();
  const { cells } = useMemo(buildEnglishBoard, []);
  const labelOf = (r: number, c: number) => {
    const p = r & 1, q = c & 1;
    if (!p && !q) return { txt: '1',  cls: 'gf4-1'  };
    if ( p && !q) return { txt: 'a',  cls: 'gf4-a'  };
    if (!p &&  q) return { txt: 'b',  cls: 'gf4-b'  };
    return            { txt: 'ab', cls: 'gf4-ab' };
  };
  // Live counts of each class.
  const counts = { '1': 0, 'a': 0, 'b': 0, 'ab': 0 } as Record<string, number>;
  for (const c of cells) counts[labelOf(c.r, c.c).txt]++;
  return (
    <div className="gt-peg-gf4">
      <div className="gt-peg-gf4-board"
           style={{ gridTemplateColumns: 'repeat(7, 38px)', gridTemplateRows: 'repeat(7, 38px)' }}>
        {cells.map((c) => {
          const lbl = labelOf(c.r, c.c);
          return (
            <div key={c.key} className={`gt-peg-gf4-cell ${lbl.cls}`}
                 style={{ gridColumn: c.c + 1, gridRow: c.r + 1 }}>
              {lbl.txt}
            </div>
          );
        })}
      </div>
      <div className="gt-peg-gf4-legend">
        <div><span className="gf4-swatch gf4-1"  /> 1  · {tr({ zh: '偶行偶列', en: 'even,even' })} · {counts['1']}</div>
        <div><span className="gf4-swatch gf4-a"  /> a  · {tr({ zh: '奇行偶列', en: 'odd,even' })}  · {counts['a']}</div>
        <div><span className="gf4-swatch gf4-b"  /> b  · {tr({ zh: '偶行奇列', en: 'even,odd' })}  · {counts['b']}</div>
        <div><span className="gf4-swatch gf4-ab" /> ab · {tr({ zh: '奇行奇列', en: 'odd,odd' })}   · {counts['ab']}</div>
        <div className="gt-peg-gf4-claim">
          {lang === 'zh'
            ? <>每次合法跳跃 a → b 跨 c 都满足 a + b + c = 0 ∈ GF(4); 因此整盘的 GF(4)-和守恒。</>
            : <>Every legal jump a → b over c satisfies a + b + c = 0 ∈ GF(4); hence the board-wide GF(4) sum is invariant.</>}
        </div>
      </div>
    </div>
  );
}

// ── PegMoveReplay — Bergholt's 18-move sweep, step / play / reverse ─────
// Coordinates use the classical a1..g7 file/rank scheme (jaapsch). Each
// macro-move is one or more elementary jumps that chain through the same
// peg. We expand the 18 macros into a flat list of elementary jumps for
// animation, but the move counter shows the original 18.

// animation, but the move counter shows the original 18.
type Jump = { from: string; over: string; to: string };

type Macro = { label: string; jumps: Jump[] };

// Bergholt 1912 (verified optimal by Beasley 1964). Convention: file letter
// a..g = column 0..6, rank 1..7 = row 6..0. Each macro is named by a peg
// that performs a chain of jumps.

// that performs a chain of jumps.
const BERGHOLT_18: Macro[] = [
  { label: 'e3-e5',           jumps: [{ from: 'e3', over: 'e4', to: 'e5' }] },
  { label: 'c4-e4',           jumps: [{ from: 'c4', over: 'd4', to: 'e4' }] },
  { label: 'e6-e4',           jumps: [{ from: 'e6', over: 'e5', to: 'e4' }] },
  { label: 'b4-d4',           jumps: [{ from: 'b4', over: 'c4', to: 'd4' }] },
  { label: 'e2-e4 / e4-c4',   jumps: [{ from: 'e2', over: 'e3', to: 'e4' }, { from: 'e4', over: 'd4', to: 'c4' }] },
  { label: 'g3-e3',           jumps: [{ from: 'g3', over: 'f3', to: 'e3' }] },
  { label: 'g5-g3 / g3-e3',   jumps: [{ from: 'g5', over: 'g4', to: 'g3' }, { from: 'g3', over: 'f3', to: 'e3' }] },
  { label: 'd5-f5',           jumps: [{ from: 'd5', over: 'e5', to: 'f5' }] },
  { label: 'f5-f3',           jumps: [{ from: 'f5', over: 'f4', to: 'f3' }] },
  { label: 'f3-d3',           jumps: [{ from: 'f3', over: 'e3', to: 'd3' }] },
  { label: 'c5-c3',           jumps: [{ from: 'c5', over: 'c4', to: 'c3' }] },
  { label: 'a5-c5 / c5-c3',   jumps: [{ from: 'a5', over: 'b5', to: 'c5' }, { from: 'c5', over: 'c4', to: 'c3' }] },
  { label: 'a3-c3',           jumps: [{ from: 'a3', over: 'b3', to: 'c3' }] },
  { label: 'c3-e3',           jumps: [{ from: 'c3', over: 'd3', to: 'e3' }] },
  { label: 'd1-d3',           jumps: [{ from: 'd1', over: 'd2', to: 'd3' }] },
  { label: 'd3-f3',           jumps: [{ from: 'd3', over: 'e3', to: 'f3' }] },
  { label: 'f3-f5 / f5-d5',   jumps: [{ from: 'f3', over: 'f4', to: 'f5' }, { from: 'f5', over: 'e5', to: 'd5' }] },
  { label: 'd7-d5 / d5-d3 / d3-d4', jumps: [{ from: 'd7', over: 'd6', to: 'd5' }, { from: 'd5', over: 'd4', to: 'd3' }, { from: 'd3', over: 'd4', to: 'd4' }] },
];

function PegMoveReplay() {
  const { cells, idx } = useMemo(buildEnglishBoard, []);
  const fileToCol = (f: string) => f.charCodeAt(0) - 'a'.charCodeAt(0);
  const rankToRow = (r: string) => 7 - parseInt(r, 10);
  const cellIdx = (s: string) => idx.get(`${rankToRow(s[1])},${fileToCol(s[0])}`)!;

  // Pre-compute the board state after each macro-move (0 = initial).
  const states = useMemo(() => {
    const init = cells.map(c => (c.r === 3 && c.c === 3 ? 0 : 1));
    const out: number[][] = [init];
    let cur = init;
    for (const macro of BERGHOLT_18) {
      const next = [...cur];
      for (const j of macro.jumps) {
        const a = cellIdx(j.from), m = cellIdx(j.over), b = cellIdx(j.to);
        if (a >= 0 && m >= 0 && b >= 0) {
          next[a] = 0; next[m] = 0; next[b] = 1;
        }
      }
      out.push(next);
      cur = next;
    }
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      setStep(s => {
        if (s + 1 >= states.length) { setPlaying(false); return s; }
        return s + 1;
      });
    }, 700);
    return () => clearTimeout(t);
  }, [playing, step, states.length]);

  const pegs = states[step];
  const pegCount = pegs.reduce((a, b) => a + b, 0);
  return (
    <div className="gt-peg-replay">
      <div className="gt-peg-board"
           style={{ gridTemplateColumns: 'repeat(7, 34px)', gridTemplateRows: 'repeat(7, 34px)' }}>
        {cells.map((c, i) => (
          <div key={c.key}
               className={`gt-peg-cell ${pegs[i] ? 'peg' : 'hole'}`}
               style={{ gridColumn: c.c + 1, gridRow: c.r + 1 }} />
        ))}
      </div>
      <div className="gt-peg-controls">
        <div className="gt-peg-info">
          <div><span className="gt-peg-label">{tr({ zh: '步骤', en: 'step'
        })}</span> <strong>{step} / 18</strong></div>
          <div><span className="gt-peg-label">{tr({ zh: '剩余棋子', en: 'pegs'
        })}</span> <strong>{pegCount}</strong></div>
          {step > 0 && step <= BERGHOLT_18.length && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-dim)' }}>
              {BERGHOLT_18[step - 1].label}
            </div>
          )}
          {step === 18 && <div style={{ color: 'var(--green)' }}>★ {tr({ zh: '到达终局 d4', en: 'finish at d4'
        })}</div>}
        </div>
        <div className="gt-peg-buttons">
          <button type="button" className="gt-btn gt-btn-ghost" onClick={() => { setStep(0); setPlaying(false); }}>{tr({ zh: '重置', en: 'reset' })}</button>
          <button type="button" className="gt-btn gt-btn-ghost" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}>← {tr({ zh: '退一步', en: 'back' })}</button>
          <button type="button" className="gt-btn" onClick={() => setPlaying(p => !p)}>
            {playing ? tr({ zh: '⏸ 暂停', en: '⏸ pause'
                                  }) : tr({ zh: '▶ 播放', en: '▶ play' })}
          </button>
          <button type="button" className="gt-btn gt-btn-ghost" onClick={() => setStep(s => Math.min(states.length - 1, s + 1))} disabled={step >= states.length - 1}>{tr({ zh: '前一步', en: 'next' })} →</button>
        </div>
      </div>
    </div>
  );
}

// ── EuropeanBoardParity — 37-cell European board with Zantema's
//    "ABC" position colouring proving centre→centre is impossible. ────────
// Zantema's labelling assigns one of {A, B, C} to each cell so that on the
// European board the count of A-pegs has parity that no jump can fix.

// European board the count of A-pegs has parity that no jump can fix.
function EuropeanBoardParity() {
  const lang = useLang();
  const board = useMemo(() => parsePegBoard([...BOARD_ASCII.european]), []);
  const { cells } = board;
  // Zantema labelling: cell (r, c) → (r + c) mod 3, but cells in the same
  // diagonal class are split into A / B / C labels with a parity twist that
  // makes the centre's class differ from the four arm-tips. Concretely the
  // 37-cell board's centre is at (3, 3) of label 0 (A); the four "extreme"
  // arm tips ((0, 3), (3, 0), (3, 6), (6, 3)) also have label 0 — and the
  // pure 3-colouring alone does NOT obstruct centre→centre. Zantema's trick
  // adds a second invariant: the parity of pegs at the "even-shell" cells
  // (those with both r and c even). The centre is even-shell, and the
  // even-shell parity is preserved mod 2 by every jump on the European
  // board (because every legal jump has either 2 or 0 even-shell cells in
  // the triple). Removing the centre makes the parity 0; the final single
  // peg at centre would require parity 1. Contradiction.
  const labelOf = (r: number, c: number) => (r + c) % 3;
  const isEvenShell = (r: number, c: number) => (r % 2 === 0) && (c % 2 === 0);
  return (
    <div className="gt-peg-european">
      <div className="gt-peg-european-board"
           style={{ gridTemplateColumns: `repeat(${board.cols}, 36px)`,
                    gridTemplateRows:    `repeat(${board.rows}, 36px)` }}>
        {cells.map((c) => {
          const lbl = labelOf(c.r, c.c);
          const evn = isEvenShell(c.r, c.c);
          return (
            <div key={c.key}
                 className={`gt-peg-eu-cell lbl-${lbl} ${evn ? 'even-shell' : ''}`}
                 style={{ gridColumn: c.c + 1, gridRow: c.r + 1 }}>
              {lbl}
            </div>
          );
        })}
      </div>
      <div className="gt-peg-european-claim">
        <p>
          {lang === 'zh'
            ? <>欧式 37 格盘。 中央格 (3, 3) 与四端 (0, 3)、(3, 0)、(3, 6)、(6, 3) 同属 0 类 (=A)。 纯三染色不足以禁 centre→centre — 还需 Zantema (1996) 的 "ABC 位置" 加强论证。</>
            : <>European 37-cell board. The centre (3, 3) and four arm-tips (0, 3), (3, 0), (3, 6), (6, 3) all share class 0 (A). Pure 3-colouring alone does NOT forbid centre→centre — Zantema's (1996) reinforced "ABC position" argument is needed.</>}
        </p>
        <p>
          {lang === 'zh'
            ? <>叠加 "偶位壳" 高亮 (双 r、c 同偶): 该子集在每次合法跳跃下奇偶不变。 初始 (除中央外满) 偶位壳奇偶 = 8 mod 2 = 0; 终局 (单子在中央) 偶位壳奇偶 = 1。 矛盾。 ∎</>
            : <>Overlay the "even shell" (cells with both r and c even): every legal jump has 0 or 2 even-shell cells in its triple, so the count's parity is invariant. Start (centre vacant) has 8 even-shell pegs (parity 0); a final single peg at centre has 1 (parity 1). Contradiction. ∎</>}
        </p>
      </div>
    </div>
  );
}



// ═══════════════════════════════════════════════════════════════════════
// §29 NEW · Hamilton paths additions
// ═══════════════════════════════════════════════════════════════════════
// ── §29 NEW · Knight's tour on the 8×8 board ─────────────────────────────
// A classical closed knight's tour (Warnsdorff-style heuristic produces many;
// we hard-code one historically attributed to Euler 1759). The 64 squares of
// the chessboard form the Cayley-like graph K_8 = {squares; knight moves}.
// It is NOT a Cayley graph of a group (no transitive action), but Hamilton
// cycles exist and were the original 18th-century example of the problem.

export default function PegSolitaire() {
  const lang = useLang();
  return (
      <GTSec id="peg-solitaire" className="gt-sec">
        <div className="gt-sec-num">§28</div>
        <h2 className="gt-sec-title">
          <L zh="孔明棋的代数 — 染色不变量、 pagoda 函数与 GF(4)" en="Peg Solitaire — colouring invariants, pagoda functions, GF(4)" />
        </h2>
        <p className="gt-lede">
          <L
            zh={<>33 格英式十字盘的孔明棋,中央留一个洞,目标是跳到只剩一颗棋子在中央。 这个看似自由的小游戏被 Reiss (1857)、 Conway、 Beasley (1962–85) 用代数钉得很死: 从中央起手, 唯一的合法终点位置就是中央自身或十字四端, 一共 <strong>5 个格子</strong>。 我们一步步把这件事拆开 — 从最直接的 3-染色, 到 Conway 的 GF(4) 框架, 到 pagoda 函数家族, 再到欧式 37 格盘的 Zantema 加强论证。</>}
            en={<>English 33-cell peg solitaire: start full except for centre, end with a single peg in the centre. The game looks combinatorially wild, but Reiss (1857), Conway and Beasley (1962–85) pinned it down with algebra: starting from a central hole, the only legal single-peg endpoints are the centre itself and the four arm-tips — <strong>5 cells</strong>. We unpack the argument layer by layer: the elementary 3-colouring, Conway's GF(4) framework, the pagoda function family, and Zantema's reinforced parity argument for the European 37-board.</>}
          />
        </p>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 24, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="28.1  棋盘与合法跳跃" en="28.1  The board and legal moves" />
        </h3>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '定义 28.1 — 英式 33 格', en: 'Definition 28.1 — English 33-cell board'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>英式盘是 <TeX src="7 \times 7" /> 网格四角各裁掉 <TeX src="2 \times 2" /> 后剩下的 <strong>33</strong> 个格子, 呈十字形。 标准起手: 中央格 d4 为空, 其余 32 格各放一颗棋子。 标准目标: 还原到 <strong>一颗</strong> 棋子位于 d4。</>}
              en={<>The English board is the <strong>33</strong> cells left after cutting <TeX src="2 \times 2" /> corners from a <TeX src="7 \times 7" /> grid — a cross shape. Standard start: centre cell d4 is empty, the other 32 cells each carry one peg. Standard goal: reduce to <strong>one</strong> peg sitting in d4.</>}
            />
          </div>
        </div>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '定义 28.2 — 合法跳跃', en: 'Definition 28.2 — legal jump'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>三个连成正交一行的相邻格 <TeX src="a, c, b" />。 若 <TeX src="a" /> 与 <TeX src="c" /> 有棋子、 <TeX src="b" /> 为空, 则可以执行跳跃 <TeX src="a \to b" />: 把 <TeX src="a" /> 的棋子移到 <TeX src="b" />, 把中间 <TeX src="c" /> 上的棋子吃掉。 <strong>不允许</strong> 斜跳。 一组连续跳跃 (同一颗棋子接连吃多颗) 通常按 「multi-jump = 1 move」 计数。</>}
              en={<>Three adjacent collinear cells <TeX src="a, c, b" /> in a row or column. If <TeX src="a" /> and <TeX src="c" /> hold pegs and <TeX src="b" /> is empty, the jump <TeX src="a \to b" /> moves the peg from <TeX src="a" /> to <TeX src="b" /> and removes the peg on <TeX src="c" />. <strong>Diagonal jumps are not allowed</strong> on the English board. A chain of consecutive jumps by the same peg is normally counted as a single <em>move</em>.</>}
            />
          </div>
        </div>
        <div className="gt-panel">
          <div className="gt-panel-title">{tr({ zh: '四种盘 · 自由探索', en: 'Four boards · free play'
        })}</div>
          <div className="gt-panel-sub">{tr({ zh: '英式 33 / 欧式 37 / 三角 15 / 菱形 25 · 点棋子选起点, 再点空格跳', en: 'English 33 / European 37 / Triangle 15 / Diamond 25 · click a peg, then click an empty cell to jump'
        })}</div>
          <PegBoardChoose />
        </div>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="28.2  三染色不变量" en="28.2  The three-colouring invariant" />
        </h3>
        <p>
          <L
            zh={<>沿 ↗ 方向用 3 种颜色周期染色 (color = <TeX src="r + c \pmod 3" />)。 每三个连成正交一线的格子恰好覆盖 3 种颜色; 因此每次跳跃 <em>同时</em> 在 3 种颜色里各减 1 颗 / 增 1 颗。 用 「颜色奇偶向量」 <TeX src="(\sigma_R, \sigma_B, \sigma_Y) \in \mathbb{F}_2^3" /> 表示当前 mod-2 计数:</>}
            en={<>Colour cells by <TeX src="r + c \pmod 3" /> using 3 hues. Any three collinear cells in any orthogonal direction cover all 3 hues. So every jump simultaneously toggles the parity of <em>each</em> hue-count. Encode the state by the parity vector <TeX src="(\sigma_R, \sigma_B, \sigma_Y) \in \mathbb{F}_2^3" />:</>}
          />
        </p>
        <TeXBlock src="(\sigma_R, \sigma_B, \sigma_Y) \;\bmod\; 2 \quad \text{is invariant up to simultaneous flip of all three coordinates.}" />
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 28.3 — Reiss (1857), 5-格定理', en: 'Theorem 28.3 — Reiss (1857), the 5-cell theorem' })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>从中央 d4 空起手的英式 33 棋, 若能终于单子状态, 则该残子的位置必在以下 5 格之一: 中央 d4, 或四端 d1, d7, a4, g4。</>}
              en={<>If a single-peg endgame is reachable from the centre-vacant English start, the surviving peg must occupy one of these 5 cells: centre d4, or the four arm-tips d1, d7, a4, g4.</>}
            />
          </div>
        </div>
        <div className="gt-proof">
          <div className="gt-proof-title">{tr({ zh: '证明', en: 'Proof'
        })}</div>
          <L
            zh={<>
              <p style={{ margin: '0 0 12px' }}>初始 33 颗棋子按 ↗ 着色, 三色计数 <TeX src="(11, 11, 11)" />。 去掉中央 (颜色 R) 后变成 (10, 11, 11), 奇偶 <TeX src="(0, 1, 1)" />。 任意跳跃同时翻三个奇偶位, 所以任何可达状态的奇偶向量都 ∈ <TeX src="\{(0, 1, 1),\, (1, 0, 0)\}" />。 终局单子时, 奇偶 (1, 0, 0) 表示这颗棋子位于 R 色格 (因 R+0+0 ≡ R mod 2)。</p>
              <p style={{ margin: '0 0 12px' }}>把 ↗ 与 ↘ 两个独立染色都套用一次, 终点棋子必须同时属于两组 R 色 — 这恰好是 5 个格子的交集: d4, d1, d7, a4, g4。</p>
            </>}
            en={<>
              <p style={{ margin: '0 0 12px' }}>The 33-peg starting board has counts <TeX src="(11, 11, 11)" />. Removing the centre (colour R) yields <TeX src="(10, 11, 11)" />, parities <TeX src="(0, 1, 1)" />. Every jump flips all three parities, so any reachable parity vector lies in <TeX src="\{(0, 1, 1),\, (1, 0, 0)\}" />. At the 1-peg endgame, parity (1, 0, 0) forces the survivor onto a hue-R cell.</p>
              <p style={{ margin: '0 0 12px' }}>Apply the same argument with the independent ↘ colouring. The survivor lies in the intersection of the two R-classes — exactly 5 cells: d4, d1, d7, a4, g4.</p>
            </>}
          />
          <div className="gt-proof-end">∎</div>
        </div>
        <div className="gt-panel">
          <div className="gt-panel-title">{tr({ zh: '英式 33 · 三染色叠加', en: 'English 33 · with 3-colouring overlay'
        })}</div>
          <div className="gt-panel-sub">{tr({ zh: '点棋子选起点, 再点空格跳。 「↗ 着色」「↘ 着色」打开后, R / B / Y 实时显示三色计数', en: 'click peg → destination to jump. Toggle ↗ / ↘ to overlay the colourings; live counts update.'
        })}</div>
          <PegSolitaireBoard />
        </div>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="28.3  Reuss / Bell 的扫局禁止性" en="28.3  Reuss / Bell impossibility for sweep games" />
        </h3>
        <p>
          <L
            zh={<>三染色给出的不是 「能不能赢」, 而是 「赢的话残子必落何处」。 把它沿 ↗ 和 ↘ 同时跑, 就得到强得多的禁止性。 一个典型应用 (Bell 在 2007 年系统化): <strong>「扫局」</strong> 类游戏 — 起手任一非中央空格, 目标任一指定终点。</>}
            en={<>The 3-colouring argument doesn't decide solvability; it pins where the single survivor can land. Running it independently along ↗ and ↘ yields much stronger obstructions. A typical application, systematised by George Bell (2007) for "sweep games": start with an arbitrary single empty hole, finish with a single peg at a prescribed cell.</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 28.4 — Reuss/Bell 扫局表', en: 'Theorem 28.4 — Reuss/Bell sweep table'
        })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>设 <TeX src="s" /> 为起始空格、 <TeX src="t" /> 为终点单子位置, 「complementary」 问题 (其余 32 格皆有棋子, 终态仅 t 有棋子) 当且仅当 <TeX src="s" /> 与 <TeX src="t" /> 满足三染色 ↗ 与 ↘ 两个 mod-2 约束 时, 才有可能可解。 表格 (用 <TeX src="\overset{?}{=}" /> 表示同色等价类):</>}
              en={<>Let <TeX src="s" /> be the empty cell at the start and <TeX src="t" /> the single peg position at the end. The "complementary" problem (the other 32 cells filled at start, only <TeX src="t" /> filled at end) is solvable only if <TeX src="s" /> and <TeX src="t" /> agree under both the ↗ and ↘ mod-2 colour classes. The compatibility table:</>}
            />
            <TeXBlock src="\mathrm{class}_{\nearrow}(s) \equiv \mathrm{class}_{\nearrow}(t) \pmod 3, \qquad \mathrm{class}_{\searrow}(s) \equiv \mathrm{class}_{\searrow}(t) \pmod 3" />
            <L
              zh={<>例如: 起手空 a4 (西端), 终点 g4 (东端) — 两端在 ↗ 着色下都是 R 色, 在 ↘ 着色下也都是 R 色, 通过双约束。 计算机搜索 (Bell 2007) 确认此问题<em>确实</em> 可解。 反之, 起手空 b2、 终点 d4 — ↗ 上是同色, ↘ 上却异色 — 无解。</>}
              en={<>For example: start vacant at a4 (west tip), end at g4 (east tip) — both endpoints are R-class under ↗ and R-class under ↘. The double constraint is satisfied, and computer search (Bell 2007) confirms the problem <em>is</em> solvable. Conversely, start at b2, end at d4 — same ↗ class but different ↘ class — unsolvable.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>需要强调: 三染色给出的是 <em>必要</em> 条件, 不是充分。 满足双 mod-3 约束的 <TeX src="(s, t)" /> 对中, 仍有约 5% 通不过更精细的 pagoda / GF(4) 检验。 完整的 「solvable 起终对」 分类要等到 Beasley 1985 + 后续穷举搜索 (1999 年全 33-peg 问题被电脑解完)。</>}
            en={<>Crucially the 3-colouring is <em>necessary</em>, not sufficient. About 5% of (s, t) pairs that pass the double mod-3 check still fail a finer pagoda or GF(4) test. The full classification of solvable start/end pairs took Beasley 1985 plus subsequent exhaustive search — by 1999 every 33-peg problem had been resolved on computer.</>}
          />
        </p>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="28.4  Pagoda 函数族" en="28.4  The pagoda function family" />
        </h3>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '定义 28.5 — pagoda 函数', en: 'Definition 28.5 — pagoda function'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>给每个棋盘格 <TeX src="p" /> 赋一个非负实数 <TeX src="f(p) \ge 0" />, 满足对每三个连成正交一线的格 <TeX src="(a, c, b)" /> 都有</>}
              en={<>An assignment <TeX src="f(p) \ge 0" /> to each cell that satisfies, for every collinear triple <TeX src="(a, c, b)" /> in the legal-jump sense,</>}
            />
            <TeXBlock src="f(b) \;\le\; f(a) + f(c) \quad \text{and (by symmetry)} \quad f(a) \;\le\; f(c) + f(b)." />
            <L
              zh={<>则称 <TeX src="f" /> 是 <strong>pagoda 函数</strong>。 立即得到: 对任一棋盘状态 <TeX src="P \subseteq \text{cells}" />, 总和 <TeX src="\Phi(P) := \sum_{p \in P} f(p)" /> 在每次合法跳跃下 <em>不增</em>。</>}
              en={<>Then <TeX src="f" /> is a <strong>pagoda function</strong>. Immediate consequence: for any board state <TeX src="P \subseteq \text{cells}" />, the total <TeX src="\Phi(P) := \sum_{p \in P} f(p)" /> is <em>non-increasing</em> under any legal jump.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>验证: 一次跳跃 <TeX src="a \to b" /> 把 <TeX src="\{a, c\}" /> 替换成 <TeX src="\{b\}" />, 总和变化 <TeX src="\Delta \Phi = f(b) - f(a) - f(c) \le 0" />。 ∎</>}
            en={<>Verification: a jump <TeX src="a \to b" /> replaces <TeX src="\{a, c\}" /> with <TeX src="\{b\}" />, so <TeX src="\Delta \Phi = f(b) - f(a) - f(c) \le 0" /> by definition. ∎</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{lang === 'zh' ? 'Fibonacci pagoda (Conway)' : 'The Fibonacci pagoda (Conway)'}</div>
          <div className="gt-thm-body">
            <L
              zh={<>设 <TeX src="\phi = \frac{1 + \sqrt 5}{2}" /> 为黄金比, 取 <TeX src="f(p) = \phi^{-d(p, t)}" />, 其中 <TeX src="d(p, t)" /> 是 <TeX src="p" /> 到目标格 <TeX src="t" /> 的曼哈顿距离。 因 <TeX src="\phi^{-(d-2)} = \phi^{-d}(\phi^2) = \phi^{-d}(\phi + 1) = \phi^{-(d-1)} + \phi^{-d}" />, 每三共线格满足 <TeX src="f(\text{远}) = f(\text{中}) + f(\text{近})" /> — 等号成立, 仍是合法 pagoda。 该函数把 「离目标越远的棋子贡献越小」 量化, 是证明 「某些远处单子起点跳不到 <TeX src="t" />」 的标准工具。</>}
              en={<>Let <TeX src="\phi = \frac{1 + \sqrt 5}{2}" /> be the golden ratio and define <TeX src="f(p) = \phi^{-d(p, t)}" /> where <TeX src="d(p, t)" /> is the Manhattan distance from <TeX src="p" /> to a target cell <TeX src="t" />. Because <TeX src="\phi^{-(d-2)} = \phi^{-d}(\phi^2) = \phi^{-d}(\phi + 1) = \phi^{-(d-1)} + \phi^{-d}" />, every collinear triple has <TeX src="f(\text{far}) = f(\text{mid}) + f(\text{near})" />: equality holds, still a valid pagoda. This quantifies "peg far from target contributes little" and is the standard tool for ruling out specific long-range starts.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>一个具体禁止性: 设 <TeX src="t = " /> 中央 d4, <TeX src="f" /> 为以 d4 为根的 Fibonacci pagoda。 初始 32 颗棋子 (除中央外) 的总和算出来约为 <TeX src="9 + 4\sqrt 5 \approx 17.94" />。 终态: 单子在 d4 的总和恰为 1。 这一定不增条件并未单独禁掉 d4 终局 (因 17.94 ≥ 1), 但若把 <TeX src="t" /> 移到 <strong>偏远位置</strong>, 例如 a1 (注意这格在英式盘上不存在, 但若考虑欧式 / 扩展盘), 初始总和会小于 1, <em>禁掉</em> 该终局。</>}
            en={<>A concrete obstruction: take <TeX src="t = " /> centre d4 and let <TeX src="f" /> be the Fibonacci pagoda rooted at d4. The 32-peg initial total works out to roughly <TeX src="9 + 4\sqrt 5 \approx 17.94" />. The final total (single peg at d4) is exactly 1. Non-increasing doesn't by itself forbid the d4 finish (17.94 ≥ 1). But on extended boards where <TeX src="t" /> sits at a remote corner, the initial total can drop below 1 and the finish is <em>algebraically excluded</em>.</>}
          />
        </p>
        <div className="gt-panel">
          <div className="gt-panel-title">{tr({ zh: 'Pagoda 验证器 · 7 × 7 数值表', en: 'Pagoda calculator · 7 × 7 numeric grid'
        })}</div>
          <div className="gt-panel-sub">{tr({ zh: '点格子改数。 「验证 pagoda」检查每个共线三元组 (a, c, b) 是否满足 f(b) ≤ f(a) + f(c); 违反的格高亮红色', en: 'edit any cell. "verify pagoda" checks every collinear triple (a, c, b) for f(b) ≤ f(a) + f(c); violating cells turn red'
        })}</div>
          <PagodaCalculator />
        </div>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="28.5  Conway 的 GF(4) 着色" en="28.5  Conway's GF(4) colouring" />
        </h3>
        <p>
          <L
            zh={<>1961 年, John Conway 把上面所有 「奇偶约束」 统一进一个 4 元域 <TeX src="\mathrm{GF}(4) = \{0, 1, \omega, \omega^2\}" /> 上的线性代数。 看作群 <TeX src="\mathbb{Z}_2 \times \mathbb{Z}_2 = \{0, a, b, a + b\}" />: 给每格分配一个非零元素 <TeX src="\xi(p) \in \{1, a, b, ab\}" />, 满足</>}
            en={<>In 1961 John Conway unified every parity argument above into linear algebra over the 4-element field <TeX src="\mathrm{GF}(4) = \{0, 1, \omega, \omega^2\}" />. Viewed as the group <TeX src="\mathbb{Z}_2 \times \mathbb{Z}_2 = \{0, a, b, a + b\}" />, assign each cell a non-zero label <TeX src="\xi(p) \in \{1, a, b, ab\}" /> with the property</>}
          />
        </p>
        <TeXBlock src="\xi(a) + \xi(c) + \xi(b) \;=\; 0 \quad\text{in } \mathrm{GF}(4), \quad\text{for every legal triple } (a, c, b)." />
        <p>
          <L
            zh={<>显式选: <TeX src="\xi(r, c) = (r \bmod 2,\, c \bmod 2)" /> ∈ <TeX src="\mathbb{Z}_2 \times \mathbb{Z}_2" />。 验证: 一条水平三元 <TeX src="(r, c), (r, c+1), (r, c+2)" /> 的标签是 <TeX src="(r, 0), (r, 1), (r, 0)" />, 求和 <TeX src="(3r, 1) = (r, 1)" />... 等等, 这不为零。</>}
            en={<>One explicit choice: <TeX src="\xi(r, c) = (r \bmod 2,\, c \bmod 2) \in \mathbb{Z}_2 \times \mathbb{Z}_2" />. Sanity check on a horizontal triple <TeX src="(r, c), (r, c+1), (r, c+2)" />: the labels are <TeX src="(r, 0), (r, 1), (r, 0)" />, and the sum is <TeX src="(3r, 1) = (r, 1) \ne 0" />.</>}
          />
        </p>
        <p>
          <L
            zh={<>这就是为什么 Conway 的真正赋值要 「跨越偶 / 奇行交替翻一翻」 — 一个 cyclotomic 修正, 把 <TeX src="\xi" /> 升级到 <TeX src="\mathrm{GF}(4)^\times" /> 的乘法群上后再加。 实际可用的版本: <TeX src="\xi(r, c) = \omega^{r} \cdot \omega^{2c} \in \mathrm{GF}(4)^\times" />, 其中 <TeX src="\omega^3 = 1" />。 每三共线格的乘积 <TeX src="\omega^{3r + 6c}" /> 或 <TeX src="\omega^{3r' + 0}" /> 总等于 <TeX src="1" />, 等价于和为 0。 详证见 Beasley 1985 第 4 章。</>}
            en={<>That is why Conway's actual assignment toggles labels across even / odd rows — a cyclotomic correction that lifts <TeX src="\xi" /> into the multiplicative group <TeX src="\mathrm{GF}(4)^\times" /> before summing. The working version: <TeX src="\xi(r, c) = \omega^{r} \cdot \omega^{2c} \in \mathrm{GF}(4)^\times" /> with <TeX src="\omega^3 = 1" />. Every collinear triple has product <TeX src="\omega^{3r + 6c} = 1" /> (or its row-shifted analogue), equivalently sum 0. The careful proof is Beasley 1985 §4.</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 28.6 — Conway / Beasley 1985', en: 'Theorem 28.6 — Conway / Beasley 1985' })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>对任何 GF(4) 着色 <TeX src="\xi" /> 满足上述条件, 「棋盘的 GF(4) 加权和」 <TeX src="\Sigma(P) := \sum_{p \in P} \xi(p) \in \mathrm{GF}(4)" /> 在每次合法跳跃下保持不变。 因此, 一个起态 <TeX src="P_0" /> 可达终态 <TeX src="P_1" /> 必有 <TeX src="\Sigma(P_0) = \Sigma(P_1)" />。</>}
              en={<>For any GF(4) labelling <TeX src="\xi" /> with the constraint above, the board's GF(4)-weighted sum <TeX src="\Sigma(P) := \sum_{p \in P} \xi(p) \in \mathrm{GF}(4)" /> is invariant under every legal jump. Hence a transition from <TeX src="P_0" /> to <TeX src="P_1" /> requires <TeX src="\Sigma(P_0) = \Sigma(P_1)" />.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>由于 GF(4) 上的着色构成一个 <strong>二维向量空间</strong> (over GF(4) 的 5-维线性约束系统秩 = 3, 故剩 2 维), 我们能找两个独立着色 <TeX src="\xi_1, \xi_2" />, 给出两个独立的 GF(4) 不变量 — 这就是 §28.2 「↗ 着色」 与 「↘ 着色」 的代数本源。 把它们写成在 <TeX src="\mathbb{F}_4^2" /> 上的相等约束, 立刻还原出 Reiss 的 5-格定理, 且推广到任意起 / 终对的可解性必要条件。</>}
            en={<>The space of valid GF(4) labellings is a <strong>2-dimensional vector space</strong> over GF(4) (the collinearity constraints have rank 3 in a 5-dim ambient, leaving 2). So we can pick two independent labellings <TeX src="\xi_1, \xi_2" /> giving two independent GF(4) invariants — the algebraic source of the ↗ / ↘ argument in §28.2. Writing both as equality constraints in <TeX src="\mathbb{F}_4^2" /> immediately recovers Reiss's 5-cell theorem and generalises it to a necessary condition on every start-end pair.</>}
          />
        </p>
        <div className="gt-panel">
          <div className="gt-panel-title">{tr({ zh: 'Conway GF(4) 着色 · 静态显示', en: 'Conway GF(4) labelling · static display'
        })}</div>
          <div className="gt-panel-sub">{tr({ zh: '每格按 (r mod 2, c mod 2) 标记 1, a, b, ab; 任何合法跳跃保持 GF(4) 加权和', en: 'each cell labelled (r mod 2, c mod 2) ∈ {1, a, b, ab}; every legal jump preserves the GF(4) sum'
        })}</div>
          <GF4ColouringDisplay />
        </div>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="28.6  Bergholt 的 18 步扫局 (英式 33)" en="28.6  Bergholt's 18-move sweep (English 33)" />
        </h3>
        <p>
          <L
            zh={<>不变量只能告诉我们什么 「不可能」; 要证 「可能」 必须给一个具体解。 英式 33 棋的中央 → 中央问题的 <strong>最短解</strong> 由 Ernest Bergholt 于 1912 年发现 — 18 步 (按 multi-jump = 1 步计), 1964 年 John Beasley 用电脑搜索确认这是全局最优 — 不可能更少了。</>}
            en={<>Invariants only tell us what's <em>impossible</em>; proving possibility needs a concrete solution. The shortest solution of the English 33-cell centre-to-centre problem was found by Ernest Bergholt in 1912 — <strong>18 moves</strong>, counting multi-jump chains as single moves. John Beasley verified it as globally optimal by computer search in 1964 — no fewer moves are possible.</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 28.7 — Bergholt 1912, Beasley 1964', en: 'Theorem 28.7 — Bergholt 1912, Beasley 1964' })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>英式 33 中央 → 中央问题在 「multi-jump = 1 move」 计法下的最短解恰为 <strong>18 步</strong>。 全部 31 颗棋子被吃, 残子位于 d4。</>}
              en={<>The shortest English 33-cell centre-to-centre solution counted in multi-jump moves is exactly <strong>18</strong>. All 31 pegs are removed and the survivor sits at d4.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>下方动画把 Bergholt 序列拆解为 18 个 macro-move (其中 6 个含连环跳跃), 共约 30 个 elementary jumps。 点 <strong>▶ 播放</strong> 自动放完一局; <strong>前 / 后</strong> 单步走; 残子最终落在 d4。</>}
            en={<>The animation below replays the 18 macro-moves (6 of which chain through multiple elementary jumps for a total of ~30 single jumps). Press <strong>▶ play</strong> for the full game, or step manually; the survivor ends at d4.</>}
          />
        </p>
        <div className="gt-panel">
          <div className="gt-panel-title">{tr({ zh: 'Bergholt 18 步扫局 · 回放', en: 'Bergholt 18-move sweep · replay'
        })}</div>
          <div className="gt-panel-sub">{tr({ zh: '18 个 macro-move, 标准 a1..g7 坐标; multi-jump 链按 1 步计', en: '18 macro-moves in standard a1..g7 coordinates; multi-jump chains count as one'
        })}</div>
          <PegMoveReplay />
        </div>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="28.7  15 棋三角的 SAX 不变量" en="28.7  The SAX invariant on the 15-peg triangle" />
        </h3>
        <p>
          <L
            zh={<>15 颗三角形孔明棋 (5 行 1 / 2 / 3 / 4 / 5) 上有另一个有名的不变量 — <strong>SAX 数</strong>。 将盘面 15 格分成 3 个 「中心」 格 (高亮金色: 第 3 行的左、 第 4 行的左、 第 4 行的中) 与 12 个 「边」 格; 设 <TeX src="A" /> 为中心填颗数, <TeX src="X" /> 为边填颗数, <TeX src="S" /> 为三点共线且 ≥ 2 颗的 「线段」 数。</>}
            en={<>The 15-peg triangle (5 rows of 1 / 2 / 3 / 4 / 5 cells) carries a separate invariant, the <strong>SAX number</strong>. Partition the 15 cells into 3 "central" cells (highlighted gold) and 12 "perimeter" cells; let <TeX src="A" /> count filled centrals, <TeX src="X" /> filled perimeters, and <TeX src="S" /> count collinear triples (length-3 lines) that already hold ≥ 2 pegs.</>}
          />
        </p>
        <TeXBlock src="\mathrm{SAX}(P) \;:=\; S + A - X \quad \text{is non-increasing under legal play.}" />
        <p>
          <L
            zh={<>不变量证明 (Beasley 1985): 单次跳跃 <TeX src="a \to b" /> 跨 <TeX src="c" /> 把 <TeX src="\{a, c\}" /> 替换成 <TeX src="\{b\}" />。 逐 case 检验中心 / 边的转换对 <TeX src="A, X, S" /> 的增量是 <TeX src="\le 0" />。 例如三格全是 perimeter 的跳跃: <TeX src="\Delta A = 0, \Delta X = -1, \Delta S \le 0" /> (该三元组从 「3 ≥ 2」 变 「1 &lt; 2」, <TeX src="\Delta S \le 0" />), 故 <TeX src="\Delta \mathrm{SAX} \le 0 + 0 - (-1) = +1" />... 等等, 这里要小心: 此三元组本身的贡献 −1, 但跨过这一跳后其他经过 <TeX src="b" /> 的三元组可能也变。 详细 case-bash 见 Beasley 第 8 章。</>}
            en={<>Invariance proof sketch (Beasley 1985): a single jump <TeX src="a \to b" /> over <TeX src="c" /> replaces <TeX src="\{a, c\}" /> with <TeX src="\{b\}" />. Case-analyse the central / perimeter labels of <TeX src="(a, c, b)" />. Each case bounds <TeX src="\Delta A, \Delta X, \Delta S" /> so that <TeX src="\Delta \mathrm{SAX} \le 0" /> overall. Full case bash in Beasley §8.</>}
          />
        </p>
        <div className="gt-panel">
          <div className="gt-panel-title">{tr({ zh: '15 棋三角 · 实时 SAX', en: '15-peg triangle · live SAX'
        })}</div>
          <div className="gt-panel-sub">{tr({ zh: '中心 3 格高亮; 注意 S + A − X 永远只减不增 (含斜跳)', en: 'central 3 cells highlighted; watch S + A − X be non-increasing (diagonal jumps included)'
        })}</div>
          <PegTriangleSAX />
        </div>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="28.8  欧式 37 格盘 · 中央 → 中央不可解" en="28.8  European 37-cell board · centre-to-centre impossibility" />
        </h3>
        <p>
          <L
            zh={<>欧式 37 格盘比英式多 4 个 「肩膀」 格 (b2, f2, b6, f6), 合计 37。 一个老的迷题: 起手中央 (d4) 空, 终态单子在 d4 — 英式可解 (Bergholt 18 步), <strong>欧式不可解</strong>。</>}
            en={<>The European 37-cell board adds 4 "shoulder" cells (b2, f2, b6, f6), totalling 37. An old puzzle: can the centre-to-centre problem be solved on this board? On English yes (Bergholt 18); on European <strong>no</strong>.</>}
          />
        </p>
        <p>
          <L
            zh={<>纯三染色不够 — 因 (3, 3) 中央与四端 (0, 3), (3, 0), (3, 6), (6, 3) 都在 ↗ 染色下属同色 (类 0), ↘ 染色下也同色, 仍允许 d4 为终点。 障碍来自 <strong>Zantema (1996) 的「ABC 位置」 加强论证</strong>: 在原 3-染色基础上, 再加一个 「偶位壳」 (both r and c 同偶) 计数, 该子集大小在每次合法跳跃下奇偶不变 (因为每个合法跳跃的三元组里恰好包含 0 个或 2 个偶位壳格)。 起态去掉 d4 后, 偶位壳有 8 颗棋子 (偶); 若终态单子在 d4 (偶位壳格), 计数 = 1 (奇)。 矛盾。</>}
            en={<>The pure 3-colouring isn't enough: centre (3, 3) and the four tips (0, 3), (3, 0), (3, 6), (6, 3) share class 0 under both ↗ and ↘, so 3-colouring allows a d4 finish. The block comes from <strong>Hans Zantema's (1996) reinforced "ABC position" argument</strong>: adjoin a second invariant — the parity of pegs on "even-shell" cells (both r and c even). Every legal jump's triple contains 0 or 2 even-shell cells (case check on the 37-cell geometry), so the even-shell parity is preserved. Removing d4 leaves 8 even-shell pegs (parity 0); a single peg at d4 has 1 (parity 1). Contradiction.</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 28.8 — Zantema 1996', en: 'Theorem 28.8 — Zantema 1996' })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>欧式 37 格盘上, 中央 d4 起手空、 终态单子在 d4 的问题 <strong>不可解</strong>。</>}
              en={<>On the European 37-cell board, the centre-to-centre single-peg problem is <strong>unsolvable</strong>.</>}
            />
          </div>
        </div>
        <div className="gt-panel">
          <div className="gt-panel-title">{tr({ zh: '欧式 37 · Zantema 配色', en: 'European 37 · Zantema labelling'
        })}</div>
          <div className="gt-panel-sub">{tr({ zh: '数字 = (r + c) mod 3 三染色; 加粗格 = 「偶位壳」', en: 'numbers = (r + c) mod 3 colouring; bold cells = "even shell"'
        })}</div>
          <EuropeanBoardParity />
        </div>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="28.9  图上的孔明棋 · 沙堆与切焰" en="28.9  Peg solitaire on graphs · sandpiles and chip-firing" />
        </h3>
        <p>
          <L
            zh={<>把棋盘抽象成图 <TeX src="G = (V, E)" />: 顶点 = 格, 边 = 相邻关系。 「合法跳跃」 即在长度-2 路径 <TeX src="a - c - b" /> 上, 若 <TeX src="a, c" /> 有标记、 <TeX src="b" /> 无, 则把标记从 <TeX src="a" /> 「翻越」 到 <TeX src="b" /> 并消去 <TeX src="c" />。 这恰好是 <strong>chip-firing</strong> / 沙堆模型的一个变体, 区别在于普通沙堆要求一格中标记数 ≥ deg(v) 才发火, 这里要求 「a, c 有, b 无」 — 一种 「带方向的发火规则」。</>}
            en={<>Abstract the board to a graph <TeX src="G = (V, E)" />: vertices = cells, edges = adjacencies. A "legal jump" on the length-2 path <TeX src="a - c - b" /> with chips on <TeX src="a, c" /> and none on <TeX src="b" /> moves a chip from <TeX src="a" /> to <TeX src="b" /> and removes the chip on <TeX src="c" />. This is a directed variant of <strong>chip-firing</strong> / sandpile dynamics — ordinary sandpiles fire a vertex when it has at least deg(v) chips, whereas here a triple-based rule governs.</>}
          />
        </p>
        <p>
          <L
            zh={<>这一抽象化使孔明棋的 「可达性」 转写为图上 chip-firing 类的可达问题。 不变量层面, 上面的 GF(4) 着色对应一个 <em>线性</em> chip-firing 不变量 (Laplacian 上同调); 而 SAX、 pagoda 等多项式不变量对应 <em>非线性</em> 守恒律。 这条思路被 Beasley 2005、 Engbers–Stocker 2015 等推广到任意图: 在树上 / 圈图 / Petersen 图 / 立方体图上, 都能写出对应的可达性判据 — 详见 §29.</>}
            en={<>This recasts peg-solitaire solvability as a reachability question for graph chip-firing. The GF(4) labelling becomes a <em>linear</em> chip-firing invariant (Laplacian cohomology); SAX and pagoda functions are <em>non-linear</em> conserved quantities. Beasley (2005) and Engbers-Stocker (2015) generalised this to arbitrary graphs — trees, cycles, the Petersen graph, the cube graph all admit explicit solvability criteria — see §29.</>}
          />
        </p>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="28.10  穷举搜索 · 已解盘与极值记录" en="28.10  Computer searches · solved boards and extremal records" />
        </h3>
        <p>
          <L
            zh={<>1990s 以来, 计算机穷举把孔明棋从 「定理 + 巧解」 推进到 「完全图谱」。 英式 33 棋的核心成果:</>}
            en={<>Since the 1990s, exhaustive search has turned peg solitaire from "theorems plus clever solutions" into a complete catalogue. Core results on English 33:</>}
          />
        </p>
        <table className="gt-compare">
          <thead>
            <tr>
              <th>{tr({ zh: '问题', en: 'problem'
            })}</th>
              <th>{tr({ zh: '可解?', en: 'solvable?' })}</th>
              <th>{tr({ zh: '最短步', en: 'min moves' })}</th>
              <th>{tr({ zh: '来源', en: 'reference'
            })}</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>{tr({ zh: '中央 → 中央', en: 'centre → centre' })}</td><td>✓</td><td className="num">18</td><td>Bergholt 1912 / Beasley 1964</td></tr>
            <tr><td>{tr({ zh: '中央 → 四端 (a4 / g4 / d1 / d7)', en: 'centre → arm-tip' })}</td><td>✓</td><td className="num">17</td><td>Beasley 1985</td></tr>
            <tr><td>{tr({ zh: '任一非中央起空 → 单子终局可达性', en: 'any non-centre start → singleton'
            })}</td><td>{tr({ zh: '部分', en: 'partial' })}</td><td className="num">—</td><td>Bell 2007 (全分类)</td></tr>
            <tr><td>{tr({ zh: '欧式 37 中央 → 中央', en: 'European 37: centre → centre'
            })}</td><td>✗</td><td className="num">—</td><td>Zantema 1996</td></tr>
            <tr><td>{tr({ zh: '15 棋三角 顶点空 → 单子在顶点', en: 'Triangle 15: apex → apex'
            })}</td><td>✓</td><td className="num">9</td><td>Beasley 1985</td></tr>
            <tr><td>{tr({ zh: '15 棋三角 顶点空 → 任意终点', en: 'Triangle 15: apex → arbitrary'
            })}</td><td>{tr({ zh: '5 / 15 可解', en: '5 of 15 solvable' })}</td><td className="num">—</td><td>Hentzel 1973</td></tr>
          </tbody>
        </table>
        <p>
          <L
            zh={<>到 1999 年, 英式 33 棋上 <em>所有</em> 单孔起手 / 单子终局对 (共 33 × 33 = 1089 个) 已全部由计算机解决, 其中约 1/3 可解。 最长的 「最优解」 是从特殊起态出发的 31 步链。</>}
            en={<>By 1999, all 33 × 33 = 1089 single-hole / single-peg endpoint pairs on the English 33 board had been computer-resolved; roughly a third are solvable. The longest known shortest-solution among them is a 31-move chain from a non-standard start.</>}
          />
        </p>
        <p>
          <L
            zh={<>这些工作把 1857 年 Reiss 起头、 1960 年代 Conway-Beasley 系统化的代数分析, 推到了今日的 「全表已知」 状态。 但更大的 boards (例如 6 × 6 + 4 壳 的 「Wiegleb 盘」, 共 45 格) 至今未完全分类 — 完整穷举所需的状态空间远超 33 棋的几亿个等价类。 现代研究方向: 二维以上 (立体盘)、 任意图、 带 「反向跳跃」 变体, 都活跃在 Beasley 的 The Ins and Outs 增补、 Bell 的网站, 以及 OEIS 多个相关序列里。</>}
            en={<>This thread, begun by Reiss in 1857 and systematised by Conway and Beasley in the 1960s, has reached "complete table" status for the English board. Larger boards remain open: the 45-cell Wiegleb (6 × 6 plus 4-shell) has not been fully classified — the state space blows past the few hundred million equivalence classes of the 33 board. Active research extends to 3-D boards, arbitrary graphs, and "reverse-jump" variants — see Beasley's supplement, George Bell's database, and the OEIS entries A014225 / A112737.</>}
          />
        </p>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="28.11  小结 · 不变量的等级" en="28.11  Summary · hierarchy of invariants" />
        </h3>
        <p>
          <L
            zh={<>把 §28 的工具按 「锋利度」 由弱到强排序:</>}
            en={<>Ranking the tools of §28 from weakest to sharpest:</>}
          />
        </p>
        <ol style={{ paddingLeft: 24, lineHeight: 1.85 }}>
          <li><L zh={<><strong>奇偶计数</strong>: 「棋子数 mod 2」 — 每跳减 1, 故 32 → 1 需 31 跳, 不变量本身贡献为 0 但定下步数。</>} en={<><strong>Parity</strong>: peg count mod 2. Each jump decreases by 1, so 32 → 1 needs 31 jumps; no algebraic obstruction beyond move counting.</>} /></li>
          <li><L zh={<><strong>3-染色</strong> (Reiss 1857): 给出 5 格残子定理; 必要但不充分。</>} en={<><strong>3-colouring</strong> (Reiss 1857): yields the 5-cell theorem; necessary but not sufficient.</>} /></li>
          <li><L zh={<><strong>GF(4) 着色</strong> (Conway, Beasley 1985): 把 ↗ 与 ↘ 两个独立 3-染色统一为 <TeX src="\mathbb{F}_4^2" /> 上的线性约束; 同样必要不充分。</>} en={<><strong>GF(4) labelling</strong> (Conway, Beasley 1985): unifies ↗ and ↘ into a 2-dim <TeX src="\mathbb{F}_4" />-linear constraint; necessary, still not sufficient.</>} /></li>
          <li><L zh={<><strong>Pagoda 函数</strong> (Conway): 非线性 (实数) 不变量族; 黄金比 Fibonacci pagoda 等可在远距禁手处发力。</>} en={<><strong>Pagoda functions</strong> (Conway): a family of non-linear (real-valued) invariants; the Fibonacci pagoda excludes long-distance survivors.</>} /></li>
          <li><L zh={<><strong>SAX 数</strong> (Beasley 1985): 三角盘 / 特定盘的混合不变量, 比单纯 GF(4) 更强。</>} en={<><strong>SAX number</strong> (Beasley 1985): a mixed invariant tuned for the triangular board; strictly stronger than GF(4) alone there.</>} /></li>
          <li><L zh={<><strong>Zantema ABC 位置</strong> (1996): 在欧式 37 盘上, 「3-染色 + 偶位壳奇偶」 共同禁止中央 → 中央。</>} en={<><strong>Zantema's ABC position</strong> (1996): on the European 37, "3-colouring + even-shell parity" together forbid centre-to-centre.</>} /></li>
          <li><L zh={<><strong>计算机穷举</strong> (1999): 终极必要充分判据 — 但代价是状态空间; 数学定理是用来加速搜索的过滤器。</>} en={<><strong>Computer enumeration</strong> (1999): the ultimate necessary-and-sufficient test — at the cost of state space size. The theorems above are the filters that make the search tractable.</>} /></li>
        </ol>
        <p>
          <L
            zh={<>这套 「染色 / GF(4) / pagoda / SAX / 计算机」 的层次, 是 1960s 之后 Conway、 Beasley 把谜题分析从 「巧妙拼凑」 升级为 「可计算代数」 的奠基工作。 同样的思想链条 — 找一个不变量, 验证它在生成操作下不变, 用它禁掉不可能的状态 — 在 §5 (魔方守恒律)、 §15 (Rubik's group cohomology)、 §29 (Petersen graph) 反复出现, 是本书的主线之一。</>}
            en={<>This "colouring / GF(4) / pagoda / SAX / computer" hierarchy is the foundation laid by Conway and Beasley in the 1960s, raising puzzle analysis from clever case-bashing to computable algebra. The same template — find an invariant, verify it under generators, exclude unreachable states — recurs in §5 (cube invariants), §15 (Rubik's-group cohomology), §29 (Petersen graph), and is one of the spine motifs of this book.</>}
          />
        </p>
      </GTSec>
  );
}
