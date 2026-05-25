/**
 * ErdosGridHero — full-resolution static reproduction of the classical
 * Erdős 1946 rescaled-grid construction (the figure on OpenAI's blog post).
 *
 * Mathematically exact: for an s × s integer grid we draw a segment between
 * (x₁, y₁) and (x₂, y₂) iff (x₁−x₂)² + (y₁−y₂)² = k. The k is chosen with a
 * large r₂(k) (number of representations as a sum of two squares) — that's
 * the entire reason this lower bound beats the trivial 2s(s−1).
 *
 * User can flip between a few notable k values to feel how r₂(k) drives the
 * density. Default k = 65 has r₂(65) = 16 — close to the OpenAI image.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

const S = 20;                 // 20 × 20 grid → 400 points
const PAD = 18;
const VIEW = 720;
const CELL = (VIEW - 2 * PAD) / (S - 1);

// Preset k values, each with its r₂(k) and a brief shape description.
const K_PRESETS: ReadonlyArray<{ k: number; reps: number; zh: string; en: string }> = [
  { k: 1,   reps: 4,  zh: '只有水平/垂直',  en: 'horizontal/vertical only' },
  { k: 5,   reps: 8,  zh: '加入 (1,2) 族', en: 'adds the (1,2) family' },
  { k: 25,  reps: 12, zh: '(3,4) + (0,5)', en: '(3,4) + (0,5)' },
  { k: 65,  reps: 16, zh: '(1,8) + (4,7)', en: '(1,8) + (4,7)' },
  { k: 125, reps: 16, zh: '(2,11) + (5,10)', en: '(2,11) + (5,10)' },
  { k: 325, reps: 24, zh: '(1,18) + (6,17) + (10,15)', en: '(1,18) + (6,17) + (10,15)' },
];

interface Edge { a: number; b: number }
function buildEdges(k: number): Edge[] {
  const edges: Edge[] = [];
  for (let x1 = 0; x1 < S; x1++) {
    for (let y1 = 0; y1 < S; y1++) {
      const i = y1 * S + x1;
      for (let x2 = 0; x2 < S; x2++) {
        for (let y2 = 0; y2 < S; y2++) {
          const j = y2 * S + x2;
          if (j <= i) continue;
          if ((x1 - x2) ** 2 + (y1 - y2) ** 2 === k) edges.push({ a: i, b: j });
        }
      }
    }
  }
  return edges;
}

export default function ErdosGridHero() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  const [k, setK] = useState(65);

  const pts = useMemo(() => {
    const out: { x: number; y: number }[] = [];
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        out.push({ x: PAD + x * CELL, y: PAD + y * CELL });
      }
    }
    return out;
  }, []);

  const edges = useMemo(() => buildEdges(k), [k]);
  const preset = K_PRESETS.find(p => p.k === k)!;

  return (
    <div className="ud-hero-figure">
      <div className="ud-hero-figure-stage">
        <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="ud-hero-figure-svg">
          <rect width={VIEW} height={VIEW} fill="#000" />
          {/* edges first (behind points) */}
          {edges.map((e, i) => {
            const a = pts[e.a], b = pts[e.b];
            return (
              <line key={i}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="#ffffff"
                strokeWidth="0.6"
                strokeOpacity={0.35}
              />
            );
          })}
          {/* points on top */}
          {pts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={3.4}
              fill="#ffffff" />
          ))}
        </svg>
      </div>

      <div className="ud-hero-figure-controls">
        <span className="ud-hero-figure-caption">
          {isZh
            ? <>20 × 20 整数网格,所有距离恰好 <span className="ud-mono">√{k} ≈ {Math.sqrt(k).toFixed(2)}</span> 的对子。</>
            : <>20 × 20 integer grid, every pair at distance <span className="ud-mono">√{k} ≈ {Math.sqrt(k).toFixed(2)}</span>.</>
          }
          {' '}
          <span className="ud-mono">ν = {edges.length}</span>,{' '}
          <span className="ud-mono">r₂({k}) = {preset.reps}</span>
        </span>

        <div className="ud-hero-figure-presets">
          {K_PRESETS.map(p => (
            <button key={p.k}
              className={`ud-hero-k-btn ${p.k === k ? 'is-on' : ''}`}
              onClick={() => setK(p.k)}
              title={isZh ? p.zh : p.en}
            >
              k = {p.k}
              <span className="ud-hero-k-reps">r₂={p.reps}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
