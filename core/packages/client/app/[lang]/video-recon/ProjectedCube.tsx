import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import { Copy, RotateCcw } from '@app-foundation/icons/lucide';
import { SkeletonBlock } from '@/components/ContentSkeleton';
import MoreToggle from '@/components/MoreToggle';
import { Tooltip } from '@/components/Tooltip';
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
  solved: boolean;
  steps: readonly MoveStep[];
  timeline: readonly ProjectedCubeFrame[];
  sourceFrame: number;
  sourceFps: number;
  playbackSpeed: number;
  live?: boolean;
  analysis?: (onOpeningView: (view: Quaternion) => void) => ReactNode;
  controls?: ReactNode;
}

type Drag = { id: number; kind: CubeDragKind; start: DragPoint; view: Quaternion; x: number; y: number; radius: number };

export function ProjectedCube({ pose, sourceTimestamp, solved, steps, timeline, sourceFrame, sourceFps, playbackSpeed, live, analysis, controls }: Props) {
  const t = useT();
  const resetLabel = t('重置视角', 'Reset view');
  const engineHost = useRef<HTMLDivElement>(null);
  const renderer = useRef<VideoCubeViewEngine | null>(null);
  const [engine, setEngine] = useQueryState('renderer', parseAsStringEnum([...VIDEO_CUBE_ENGINES]).withDefault('three'));
  const rendered = useRef<CubePose | undefined>(undefined);
  const previousTimestamp = useRef<number | undefined>(undefined);
  const drag = useRef<Drag | null>(null);
  const [orientation, setOrientation] = useState(CAMERA_ORIENTATION);
  const openingView = useRef(CAMERA_ORIENTATION);
  const applyOpeningView = useCallback((next: Quaternion) => {
    openingView.current = next;
    setOrientation(next);
  }, []);
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
  const liveMove = live ? steps.findLast(step => step.frame_index <= sourceFrame && step.state_moves.length) : undefined;

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
    if (live || !previous || !pose || !adjacent) {
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
  }, [pose, sourceTimestamp, sourceFps, playbackSpeed, live]);

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

  return <section className="video-recon-panel video-recon-cube" data-site-surface="panel" aria-label={t('复盘结果', 'Reconstruction')}>
    <div className="video-recon-orbit">
      <div className="video-recon-orbit-interaction" tabIndex={pose && ready ? 0 : -1} role="application"
        aria-label={t('调整魔方视角', 'Adjust cube view')}
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
        {!pose && !live && <p>{t('此帧暂无复盘状态', 'No reconstructed cube state for this frame')}</p>}
        {(live || pose) && (!ready || !pose) && (unavailable
          ? <div className="video-recon-orbit-status" role="status">
            <p>{t('无法加载此渲染引擎。', 'Could not load this rendering engine.')}</p>
            <button type="button" className="btn-secondary" onClick={() => setRetry(value => value + 1)}>{t('重试', 'Retry')}</button>
          </div>
          : <>
            <SkeletonBlock className="video-recon-orbit-shimmer" />
            <span className="sr-only" role="status">{t('正在加载三维魔方…', 'Loading the 3D cube…')}</span>
          </>)}
      </div>
      <select className="video-recon-orbit-engine" aria-label={t('渲染引擎', 'Rendering engine')}
        value={engine} onChange={event => void setEngine(event.currentTarget.value as typeof engine)}>
        <option value="three">{t('本站引擎（Three.js）', 'CubeRoot engine (Three.js)')}</option>
        <option value="cubing">cubing.js</option>
      </select>
      {pose && ready && <Tooltip content={resetLabel}>{tip =>
        <button {...tip} type="button" className="playback-bar-btn video-recon-orbit-reset"
          aria-label={resetLabel} onClick={() => setOrientation(openingView.current)}>
          <RotateCcw size={16} aria-hidden="true" />
        </button>
      }</Tooltip>}
    </div>
    {controls}
    {live ? <div className="video-recon-section-heading">
      <span className="video-recon-muted">{t('实时预览', 'Live preview')}</span>
      {liveMove && <code aria-label={t('最近识别的动作', 'Latest detected moves')}>{liveMove.state_moves.join(' ')}</code>}
    </div> : analysis ? <>
      {analysis(applyOpeningView)}
      {sourceNotation && <details>
        <MoreToggle as="summary">{t('查看相机视角动作', 'View camera-relative moves')}</MoreToggle>
        {sourceNotation}
      </details>}
    </> : sourceNotation}
  </section>;
}
