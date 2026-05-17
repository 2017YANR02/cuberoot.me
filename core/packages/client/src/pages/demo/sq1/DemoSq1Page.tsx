/**
 * /demo/sq1 — Square-1 立体动画演示。
 * cubedb.net 的视觉/动画复刻（three.js 自渲染，不走 cubing.js TwistyPlayer）。
 */
import { useEffect, useRef, useState } from 'react';
import {
  Sq1Renderer, solvedState, parseSq1Scramble, applySq1Move, type Sq1Move, type Sq1State,
} from './sq1_renderer';
import './demo_sq1.css';

const DEFAULT_SCRAMBLE = '(0, -4) / (0, -3) / (-3, 0) / (-5, -2) / (-1, -4) / (3, 0) / (-5, 0) / (0, -3) / (5, -2) / (2, -2) / (2, 0) / (0, -2) / (-1, 0)';

export default function DemoSq1Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<Sq1Renderer | null>(null);
  const [scramble, setScramble] = useState(DEFAULT_SCRAMBLE);
  const [moves, setMoves] = useState<Sq1Move[]>([]);
  const [progress, setProgress] = useState({ idx: 0, total: 0 });

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

  // Parse moves whenever scramble changes (preview state).
  useEffect(() => {
    setMoves(parseSq1Scramble(scramble));
  }, [scramble]);

  const onReset = () => {
    const r = rendererRef.current;
    if (!r) return;
    r.resetTo(solvedState());
    setProgress({ idx: 0, total: 0 });
  };

  const onPlay = async () => {
    const r = rendererRef.current;
    if (!r) return;
    r.resetTo(solvedState());
    await r.playScramble(moves);
  };

  const onShowFinal = () => {
    const r = rendererRef.current;
    if (!r) return;
    let s: Sq1State = solvedState();
    for (const m of moves) s = applySq1Move(s, m);
    r.resetTo(s);
    setProgress({ idx: moves.length, total: moves.length });
  };

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
            value={scramble}
            onChange={e => setScramble(e.target.value)}
            rows={2}
            placeholder="(t, b) / (t, b) / ..."
          />
        </label>
        <div className="demo-sq1-btnrow">
          <button onClick={onReset}>Reset</button>
          <button onClick={onPlay}>Play scramble</button>
          <button onClick={onShowFinal}>Jump to end</button>
        </div>
        <div className="demo-sq1-progress">
          {progress.total > 0 ? `Move ${progress.idx} / ${progress.total}` : 'Idle'}
        </div>
      </div>
    </div>
  );
}
