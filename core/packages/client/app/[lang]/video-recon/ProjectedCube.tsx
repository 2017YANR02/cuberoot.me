import { useEffect, useId, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import { Copy, RotateCcw } from '@app-foundation/icons/lucide';
import { useT } from '@/hooks/useT';
import { dragCubeView, nudgeCubeView, type CubeDragKind, type DragPoint } from '@/lib/video-recon/engine/cube-drag';
import { layerTransition, type CubePose, type Quaternion } from '@/lib/video-recon/engine/cube-motion';
import {
  CAMERA_ORIENTATION, displayMoveTokens, initialGripMoves, reorientedCubePose, reorientedMoveTimeline,
} from '@/lib/video-recon/engine/cube-orientation';
import type { MoveStep } from '@/lib/video-recon/engine/move-search-types';
import { playbackTiming } from '@/lib/video-recon/engine/playback-timing';
import type { ProjectedCubeFrame } from '@/lib/video-recon/engine/projected-cube';
import { mountVideoCubingView, mountVideoThreeView, VIDEO_CUBE_ENGINES, type VideoCubeViewEngine } from './cube-view-engines';

interface Props {
  pose?: CubePose;
  sourceTimestamp: number;
  timestamp: string;
  solved: boolean;
  steps: readonly MoveStep[];
  timeline: readonly ProjectedCubeFrame[];
  sourceFrame: number;
  sourceFps: number;
  playbackSpeed: number;
  analysis?: ReactNode;
  controls?: ReactNode;
}

type Drag = { id: number; kind: CubeDragKind; start: DragPoint; view: Quaternion; x: number; y: number; radius: number };

export function ProjectedCube({ pose, sourceTimestamp, timestamp, solved, steps, timeline, sourceFrame, sourceFps, playbackSpeed, analysis, controls }: Props) {
  const t = useT();
  const instructions = useId();
  const engineHost = useRef<HTMLDivElement>(null);
  const renderer = useRef<VideoCubeViewEngine | null>(null);
  const [engine, setEngine] = useQueryState('renderer', parseAsStringEnum([...VIDEO_CUBE_ENGINES]).withDefault('three'));
  const rendered = useRef<CubePose | undefined>(undefined);
  const previousTimestamp = useRef<number | undefined>(undefined);
  const drag = useRef<Drag | null>(null);
  const [orientation, setOrientation] = useState(CAMERA_ORIENTATION);
  const view = useRef(orientation);
  const [engineState, setEngineState] = useState<{ engine: typeof engine; ready: boolean }>();
  const [retry, setRetry] = useState(0);
  const ready = engineState?.engine === engine && engineState.ready;
  const unavailable = engineState?.engine === engine && !engineState.ready;
  const [copy, setCopy] = useState<{ algorithm: string; ok: boolean }>();
  const notationView = analysis ? CAMERA_ORIENTATION : orientation;
  const tokens = useMemo(() => displayMoveTokens(timeline.length
    ? reorientedMoveTimeline(timeline, steps, notationView, { fps: sourceFps })
    : steps.map(step => ({ frame: step.frame_index, moves: step.state_moves, rotation: false }))),
  [timeline, steps, notationView, sourceFps]);
  const setup = useMemo(() => initialGripMoves(timeline, notationView), [timeline, notationView]);
  const algorithm = [...setup, ...tokens.map(token => token.move)].join(' ');
  const activeFrame = tokens.findLast(token => token.frame <= sourceFrame)?.frame;

  function draw() {
    if (!renderer.current) return;
    const current = rendered.current;
    renderer.current.draw(current ? reorientedCubePose(current, view.current) : undefined);
  }

  useEffect(() => {
    const host = engineHost.current;
    if (!host) return;
    const abort = new AbortController();
    const mount = engine === 'three' ? mountVideoThreeView : mountVideoCubingView;
    setEngineState(undefined);
    void mount(host, abort.signal).then(instance => {
      if (abort.signal.aborted) { instance.dispose(); return; }
      renderer.current = instance;
      draw();
      setEngineState({ engine, ready: true });
    }).catch(() => {
      if (abort.signal.aborted) return;
      renderer.current?.dispose();
      renderer.current = null;
      setEngineState({ engine, ready: false });
    });
    return () => {
      abort.abort();
      renderer.current?.dispose();
      renderer.current = null;
    };
  }, [engine, retry]);

  useEffect(() => {
    view.current = orientation;
    draw();
  }, [orientation]);

  useEffect(() => {
    const previous = rendered.current;
    const adjacent = previousTimestamp.current !== undefined && Math.abs(sourceTimestamp - previousTimestamp.current) <= 0.15;
    previousTimestamp.current = sourceTimestamp;
    if (!previous || !pose || !adjacent) {
      rendered.current = pose;
      draw();
      return;
    }
    const transition = layerTransition(previous, pose);
    const start = performance.now();
    const duration = playbackTiming(sourceFps, playbackSpeed).transitionMs;
    let animation = requestAnimationFrame(function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      rendered.current = transition.sample(progress);
      draw();
      if (progress < 1) animation = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(animation);
  }, [pose, sourceTimestamp, sourceFps, playbackSpeed]);

  function beginDrag(event: PointerEvent<HTMLDivElement>) {
    if (!pose || !ready || !event.isPrimary || event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const radius = Math.min(rect.width, rect.height) * 0.42;
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const start: DragPoint = [(event.clientX - x) / radius, (event.clientY - y) / radius];
    drag.current = { id: event.pointerId, kind: Math.hypot(...start) >= 0.85 ? 'roll' : 'orbit', start, view: orientation, x, y, radius };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
    event.preventDefault();
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const point: DragPoint = [(event.clientX - current.x) / current.radius, (event.clientY - current.y) / current.radius];
    setOrientation(dragCubeView(current.view, current.start, point, current.kind));
  }

  async function copyAlgorithm() {
    try { await navigator.clipboard.writeText(algorithm); setCopy({ algorithm, ok: true }); }
    catch { setCopy({ algorithm, ok: false }); }
  }

  const sourceNotation = (pose || steps.length > 0) && <div className="video-recon-notation">
    <strong>{solved ? t('完整复盘', 'Full reconstruction') : t('部分复盘', 'Partial reconstruction')}</strong>
    {timeline.length > 0 && <>
      <span className="video-recon-muted">{t('记号轴向', 'Notation axes')} U ↑ · F ↙ · R ↘</span>
      <span>{t('打乱后的起手转体', 'Initial grip after scramble')} <code>{setup.join(' ') || t('无需转体', 'No rotation')}</code></span>
    </>}
    <div className="video-recon-moves" aria-label={t('动作序列', 'Move sequence')}>
      {tokens.map((token, index) => <code key={index} data-future={token.frame > sourceFrame}
        aria-current={token.frame === activeFrame ? 'step' : undefined}>{token.move}</code>)}
    </div>
    {algorithm && <div className="video-recon-actions">
      <button type="button" className="btn-secondary" onClick={() => void copyAlgorithm()}>
        <Copy size={15} aria-hidden />{t('复制复盘公式', 'Copy reconstruction')}
      </button>
      <span role="status">{copy?.algorithm === algorithm ? (copy.ok ? t('已复制', 'Copied') : t('无法复制，请手动选择公式。', 'Clipboard unavailable. Select the moves to copy them.')) : ''}</span>
    </div>}
  </div>;

  return <section className="video-recon-panel video-recon-cube" data-site-surface="panel">
    <div className="video-recon-section-heading">
      <h2>{t('复盘结果', 'Reconstruction')}</h2>
      <div className="video-recon-actions">
        <label className="video-recon-inline-label">
          {t('渲染引擎', 'Rendering engine')}
          <select value={engine} onChange={event => void setEngine(event.currentTarget.value as typeof engine)}>
            <option value="three">{t('本站引擎（Three.js）', 'CubeRoot engine (Three.js)')}</option>
            <option value="cubing">cubing.js</option>
          </select>
        </label>
        <span className="video-recon-muted">{timestamp}</span>
      </div>
    </div>
    <div className="video-recon-orbit" tabIndex={pose && ready ? 0 : -1} role="application"
      aria-label={t('调整魔方视角', 'Adjust cube view')} aria-describedby={instructions}
      aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Q E"
      onPointerDown={beginDrag} onPointerMove={moveDrag} onLostPointerCapture={() => { drag.current = null; }}
      onKeyDown={event => {
        if (!pose || !ready || event.altKey || event.ctrlKey || event.metaKey) return;
        const next = nudgeCubeView(orientation, event.key, event.shiftKey);
        if (!next) return;
        event.preventDefault();
        event.stopPropagation();
        setOrientation(next);
      }}>
      <div className="video-recon-cube-renderer" ref={engineHost} data-engine={engine}
        role="img" aria-label={t('复盘的三维魔方', 'Reconstructed 3D cube')} aria-hidden={!pose || !ready} />
      {pose && ready && <span className="video-recon-roll-ring" aria-hidden="true" />}
      {!pose && <p>{t('此帧暂无复盘状态', 'No reconstructed cube state for this frame')}</p>}
      {pose && !ready && <div className="video-recon-orbit-status" role="status">
        {unavailable ? <>
          <p>{t('无法加载此渲染引擎。', 'Could not load this rendering engine.')}</p>
          <button type="button" className="btn-secondary" onClick={() => setRetry(value => value + 1)}>{t('重试', 'Retry')}</button>
        </> : <p>{t('正在加载三维魔方…', 'Loading the 3D cube…')}</p>}
      </div>}
    </div>
    {pose && ready && <div className="video-recon-section-heading">
      <span id={instructions} className="video-recon-muted">
        {t('拖动魔方调整视角，拖动外圈旋转。方向键和 Q / E 也可操作。', 'Drag the cube to orbit or the ring to roll. Arrow keys and Q / E also work.')}
      </span>
      <button type="button" className="btn-secondary" onClick={() => setOrientation(CAMERA_ORIENTATION)}>
        <RotateCcw size={15} aria-hidden />{t('重置视角', 'Reset view')}
      </button>
    </div>}
    {controls}
    {analysis ? <>
      {analysis}
      {sourceNotation && <details>
        <summary>{t('查看相机视角动作', 'View camera-relative moves')}</summary>
        {sourceNotation}
      </details>}
    </> : sourceNotation}
  </section>;
}
