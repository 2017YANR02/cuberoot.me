/**
 * PerfOverlay — DEV-only render perf HUD for /stack.
 * Samples every 250ms from a stats ref written by StackPage's render loop.
 * 包含一个 stress-test 按钮:在当前阶数跑 60 个连续 twist,记录 avg FPS。
 */
import { useEffect, useRef, useState } from 'react';

export interface PerfStats {
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  meshCount: number;
  cubeletCount: number;
  fps: number;
  frameMs: number;
  order: number;
}

interface Props {
  statsRef: { current: PerfStats };
  onStress: () => Promise<{ avgFps: number; minFps: number; durationMs: number; frames: number }>;
}

export default function PerfOverlay({ statsRef, onStress }: Props) {
  const [snapshot, setSnapshot] = useState<PerfStats>(statsRef.current);
  const [stressResult, setStressResult] = useState<string>('');
  const [running, setRunning] = useState(false);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    tickRef.current = window.setInterval(() => {
      setSnapshot({ ...statsRef.current });
    }, 250);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [statsRef]);

  const runStress = async () => {
    setRunning(true);
    setStressResult('…');
    const r = await onStress();
    setStressResult(
      `avg ${r.avgFps.toFixed(1)} fps · min ${r.minFps.toFixed(1)} fps · ${r.frames}f / ${r.durationMs.toFixed(0)}ms`
    );
    setRunning(false);
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        padding: '6px 10px',
        background: 'rgba(0,0,0,0.65)',
        color: '#fff',
        font: '11px ui-monospace, monospace',
        lineHeight: 1.5,
        borderRadius: 4,
        zIndex: 10,
        pointerEvents: 'auto',
        userSelect: 'text',
        minWidth: 220,
      }}
    >
      <div>
        order <b>{snapshot.order}</b> · cubelets <b>{snapshot.cubeletCount}</b> · scene meshes <b>{snapshot.meshCount}</b>
      </div>
      <div>
        draw <b>{snapshot.drawCalls}</b> · tris <b>{snapshot.triangles.toLocaleString()}</b> · geos <b>{snapshot.geometries}</b>
      </div>
      <div>
        fps <b>{snapshot.fps.toFixed(1)}</b> · frame <b>{snapshot.frameMs.toFixed(2)}ms</b>
      </div>
      <button
        onClick={runStress}
        disabled={running}
        style={{
          marginTop: 4,
          padding: '2px 8px',
          background: '#444',
          color: '#fff',
          border: '1px solid #666',
          borderRadius: 3,
          font: 'inherit',
          cursor: running ? 'not-allowed' : 'pointer',
        }}
      >
        {running ? 'running…' : 'stress 60 twists'}
      </button>
      {stressResult ? <div style={{ marginTop: 2 }}>{stressResult}</div> : null}
    </div>
  );
}
