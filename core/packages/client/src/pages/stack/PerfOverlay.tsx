/**
 * PerfOverlay — DEV-only render perf HUD for /stack.
 * Samples every 250ms from a stats ref written by StackPage's render loop.
 * 包含一个 stress-test 按钮:在当前阶数跑 60 个连续 twist,记录 avg FPS。
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

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
  /** JS heap in MB (Chrome only, 100MB quantized 不精确). 0 = 不支持 */
  jsHeapMB: number;
  /** 估算 GPU instance buffer (instanceMatrix + instanceColor) in MB.
   * 不含 geometry/texture,只是 InstancedRenderer 的大头开销 */
  gpuBufMB: number;
  /** 上一次打乱:state 应用 + 渲染 + paint 的端到端 ms。0 = 还没打乱过 */
  scrambleMs: number;
}

interface Props {
  statsRef: { current: PerfStats };
  onStress: () => Promise<{ avgFps: number; minFps: number; durationMs: number; frames: number }>;
}

const COLLAPSE_KEY = 'stack.perfOverlay.collapsed';

export default function PerfOverlay({ statsRef, onStress }: Props) {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const [snapshot, setSnapshot] = useState<PerfStats>(statsRef.current);
  const [stressResult, setStressResult] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
  });
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch { /* private mode */ }
  }, [collapsed]);

  useEffect(() => {
    if (collapsed) return;
    tickRef.current = window.setInterval(() => {
      setSnapshot({ ...statsRef.current });
    }, 250);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [statsRef, collapsed]);

  const runStress = async () => {
    setRunning(true);
    setStressResult('…');
    const r = await onStress();
    setStressResult(
      isZh
        ? `平均 ${r.avgFps.toFixed(1)} fps · 最低 ${r.minFps.toFixed(1)} fps · ${r.frames}帧 / ${r.durationMs.toFixed(0)}ms`
        : `avg ${r.avgFps.toFixed(1)} fps · min ${r.minFps.toFixed(1)} fps · ${r.frames}f / ${r.durationMs.toFixed(0)}ms`
    );
    setRunning(false);
  };

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        title={isZh ? '显示性能面板' : 'Show perf overlay'}
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          padding: '4px 8px',
          background: 'rgba(0,0,0,0.55)',
          color: '#fff',
          font: '11px ui-monospace, monospace',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 4,
          zIndex: 10,
          pointerEvents: 'auto',
          cursor: 'pointer',
        }}
      >
        {isZh ? '性能' : 'perf'}
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        padding: '6px 26px 6px 10px',
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
      <button
        onClick={() => setCollapsed(true)}
        title={isZh ? '隐藏' : 'Hide'}
        aria-label={isZh ? '隐藏性能面板' : 'Hide perf overlay'}
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
          width: 18,
          height: 18,
          padding: 0,
          background: 'transparent',
          color: '#bbb',
          border: 'none',
          borderRadius: 3,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <X size={12} />
      </button>
      <div>
        {isZh ? '阶数' : 'order'} <b>{snapshot.order}</b> · {isZh ? '格数' : 'cubelets'} <b>{snapshot.cubeletCount}</b> · {isZh ? '场景网格' : 'scene meshes'} <b>{snapshot.meshCount}</b>
      </div>
      <div>
        {isZh ? '绘制' : 'draw'} <b>{snapshot.drawCalls}</b> · {isZh ? '三角形' : 'tris'} <b>{snapshot.triangles.toLocaleString()}</b> · {isZh ? '几何' : 'geos'} <b>{snapshot.geometries}</b>
      </div>
      <div>
        {isZh ? '帧率' : 'fps'} <b>{snapshot.fps.toFixed(1)}</b> · {isZh ? '帧时长' : 'frame'} <b>{snapshot.frameMs.toFixed(2)}ms</b>
      </div>
      <div>
        {snapshot.jsHeapMB > 0 ? (
          <>{isZh ? 'JS 堆' : 'JS heap'} <b>{snapshot.jsHeapMB.toFixed(0)}M</b> · </>
        ) : null}
        {isZh ? 'GPU 缓冲' : 'GPU buf'} <b>{snapshot.gpuBufMB.toFixed(0)}M</b>
      </div>
      {snapshot.scrambleMs > 0 ? (
        <div>
          {isZh ? '出图' : 'scramble'} <b>{snapshot.scrambleMs.toFixed(0)}ms</b>
        </div>
      ) : null}
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
        {running ? (isZh ? '运行中…' : 'running…') : (isZh ? '压测 60 转' : 'stress 60 twists')}
      </button>
      {stressResult ? <div style={{ marginTop: 2 }}>{stressResult}</div> : null}
    </div>
  );
}
