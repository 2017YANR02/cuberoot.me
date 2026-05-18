/**
 * /demo/sq1 — Square-1 立体动画演示。
 * cubedb.net 的视觉/动画复刻（three.js 自渲染，不走 cubing.js TwistyPlayer）。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sq1Renderer, solvedState, parseSq1Scramble, applySq1Move, type Sq1State,
} from './sq1_renderer';
import './demo_sq1.css';

const DEFAULT_SCRAMBLE = '(0, -4) / (0, -3) / (-3, 0) / (-5, -2) / (-1, -4) / (3, 0) / (-5, 0) / (0, -3) / (5, -2) / (2, -2) / (2, 0) / (0, -2) / (-1, 0)';

function readUrlScramble(): string | null {
  if (typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search).get('scramble');
  return q && q.length > 0 ? q : null;
}

export default function DemoSq1Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const rendererRef = useRef<Sq1Renderer | null>(null);
  const [scramble, setScramble] = useState(() => readUrlScramble() ?? DEFAULT_SCRAMBLE);
  const [caretIdx, setCaretIdx] = useState<number | null>(null);
  const [progress, setProgress] = useState({ idx: 0, total: 0 });
  const [speed, setSpeed] = useState(1.0);
  const lastMoveCountRef = useRef(0);

  const moves = useMemo(() => parseSq1Scramble(scramble), [scramble]);
  const movesBeforeCaret = useMemo(() => {
    if (caretIdx === null) return null;
    return parseSq1Scramble(scramble.slice(0, caretIdx)).length;
  }, [scramble, caretIdx]);

  // Init renderer once.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const r = new Sq1Renderer(canvas, { width: rect.width, height: rect.height });
    rendererRef.current = r;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__sq1 = r;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    import('three').then(THREE => { (window as any).THREE = THREE; });
    const unsub = r.onMoveProgress((idx, total) => setProgress({ idx, total }));

    const ro = new ResizeObserver(() => {
      const b = wrap.getBoundingClientRect();
      r.resize(b.width, b.height);
    });
    ro.observe(wrap);

    return () => {
      ro.disconnect();
      unsub();
      r.dispose();
      rendererRef.current = null;
    };
  }, []);

  // Reflect scramble back into ?scramble= so the URL stays shareable.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (scramble === DEFAULT_SCRAMBLE) url.searchParams.delete('scramble');
    else url.searchParams.set('scramble', scramble);
    const next = url.pathname + (url.search ? url.search : '') + url.hash;
    const cur = window.location.pathname + window.location.search + window.location.hash;
    if (next !== cur) window.history.replaceState(null, '', next);
  }, [scramble]);

  // Sync renderer's speed continuously (used by both caret-driven and Play).
  useEffect(() => {
    const r = rendererRef.current;
    if (r) r.durationPerMoveMs = Math.round(220 / speed);
  }, [speed]);

  // Drive the cube from caret position: +1 move forward → animate that move,
  // any other jump (multi-step, backward, scramble text change) → snap.
  useEffect(() => {
    const r = rendererRef.current;
    if (!r || movesBeforeCaret === null) return;
    const prev = lastMoveCountRef.current;
    const target = Math.min(movesBeforeCaret, moves.length);
    if (target === prev) return;
    lastMoveCountRef.current = target;
    if (target === prev + 1) {
      r.playScramble([moves[prev]]);
    } else {
      let s: Sq1State = solvedState();
      for (let i = 0; i < target; i++) s = applySq1Move(s, moves[i]);
      r.resetTo(s);
    }
    setProgress({ idx: target, total: moves.length });
  }, [movesBeforeCaret, moves]);

  const setCaretAt = (pos: number) => {
    const el = textareaRef.current;
    if (el) {
      el.focus();
      el.setSelectionRange(pos, pos);
    }
    setCaretIdx(pos);
  };

  const updateCaret = () => {
    const el = textareaRef.current;
    if (el) setCaretIdx(el.selectionStart ?? 0);
  };

  const onReset = () => setCaretAt(0);

  const onPlay = async () => {
    const r = rendererRef.current;
    if (!r) return;
    r.resetTo(solvedState());
    lastMoveCountRef.current = moves.length;
    setProgress({ idx: 0, total: moves.length });
    await r.playScramble(moves);
    setCaretAt(scramble.length);
  };

  const onShowFinal = () => setCaretAt(scramble.length);

  return (
    <div className="demo-sq1-page">
      <div className="demo-sq1-toolbar">
        <h1>Square-1 3D Demo</h1>
        <p>
          复刻 <a href="https://cubedb.net/?puzzle=Square1" target="_blank" rel="noreferrer">cubedb.net</a> 的立体魔方演示。
        </p>
      </div>

      <div className="demo-sq1-stage" ref={wrapRef}>
        <canvas ref={canvasRef} />
      </div>

      <div className="demo-sq1-controls">
        <label>
          Scramble:
          <textarea
            ref={textareaRef}
            value={scramble}
            onChange={e => { setScramble(e.target.value); updateCaret(); }}
            onSelect={updateCaret}
            onKeyUp={updateCaret}
            onClick={updateCaret}
            onFocus={updateCaret}
            rows={2}
            placeholder="(t, b) / (t, b) / ..."
          />
        </label>
        <div className="demo-sq1-btnrow">
          <button onClick={onReset}>Reset</button>
          <button onClick={onPlay}>Play scramble</button>
          <button onClick={onShowFinal}>Jump to end</button>
          <label className="demo-sq1-speed">
            Speed: {speed.toFixed(1)}×
            <input
              type="range"
              min={0.25}
              max={4}
              step={0.25}
              value={speed}
              onChange={e => setSpeed(parseFloat(e.target.value))}
            />
          </label>
        </div>
        <div className="demo-sq1-progress">
          {progress.total > 0
            ? `Move ${progress.idx} / ${progress.total} — drag to rotate, scroll to zoom`
            : `${moves.length} moves parsed — drag to rotate, scroll to zoom`}
        </div>
      </div>
    </div>
  );
}
