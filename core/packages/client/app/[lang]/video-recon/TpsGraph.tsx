import { useId, useMemo, useState, type MouseEvent } from 'react';
import { SkeletonBlock } from '@/components/ContentSkeleton';
import { useT } from '@/hooks/useT';
import { formatTimer } from '@/lib/video-recon/engine/cube-timer';
import type { MoveStep } from '@/lib/video-recon/engine/move-search-types';
import { committedTurnSpan, gaussianTpsAt, tpsCurve, tpsSummary, turnEvents, type TurnEvent } from '@/lib/video-recon/engine/tps';

interface Props {
  steps?: readonly MoveStep[];
  turns?: readonly TurnEvent[];
  moves?: readonly string[];
  fps: number;
  start: number;
  end: number;
  solveSeconds?: number;
  cursor?: number;
  complete: boolean;
  live?: boolean;
  compact?: boolean;
  pending?: boolean;
  onSeek?: (time: number) => void;
}

const NO_STEPS: readonly MoveStep[] = [];
const HEIGHT = 142;
const LEFT = 30;
const BASE = 118;

export function TpsGraph({ steps = NO_STEPS, turns, moves, fps, start, end, solveSeconds, cursor, complete, live, compact, pending, onSeek }: Props) {
  const t = useT();
  const clipId = useId();
  const [hover, setHover] = useState<number>();
  const width = compact ? 400 : 640;
  const right = width - 16;
  const points = useMemo(() => {
    const events = complete || live ? turns ?? turnEvents(steps, fps) : [];
    const curve = tpsCurve(events, start, end);
    const ceiling = Math.max(5, Math.ceil(curve.reduce((max, row) => Math.max(max, row.tps), 0) / 5) * 5);
    const count = events.length || turnEvents([{ frame_index: 0, state_moves: [...(moves ?? [])] }], 1).length;
    return { events, curve, ceiling, summary: tpsSummary(events, solveSeconds ?? committedTurnSpan(steps, fps), count) };
  }, [complete, live, turns, steps, fps, start, end, moves, solveSeconds]);
  const duration = Math.max(0, end - start);
  const x = (time: number) => LEFT + (time - start) / Math.max(0.001, duration) * (right - LEFT);
  const y = (rate: number) => BASE - rate / points.ceiling * (BASE - 10);
  const line = points.curve.map((point, index) => `${index ? 'L' : 'M'}${x(point.timestamp)},${y(point.tps)}`).join(' ');
  const time = Math.max(start, Math.min(end, (live ? cursor : hover ?? cursor) ?? start));
  const rate = gaussianTpsAt(points.events, time);
  const showPlaceholder = pending || (live && points.events.length === 0);
  const seek = (next: number) => onSeek?.(Math.max(start, Math.min(end, next)));
  function timeAtPointer({ currentTarget, clientX, clientY }: MouseEvent<SVGSVGElement>) {
    const matrix = currentTarget.getScreenCTM();
    if (!matrix) return time;
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    const ratio = Math.max(0, Math.min(1, (point.x - LEFT) / (right - LEFT)));
    return start + ratio * duration;
  }
  return <section className={`video-recon-panel video-recon-tps${compact ? ' video-recon-tps--compact' : ''}`}
    data-site-surface="panel" aria-busy={showPlaceholder || undefined}>
    <div className="video-recon-section-heading">
      <h2>{t('转速曲线', 'Turns per second')}</h2>
      {(complete || live) && points.events.length > 0 && <span>{rate.toFixed(1)} TPS</span>}
    </div>
    {showPlaceholder ? <SkeletonBlock className="video-recon-tps-shimmer" style={{ aspectRatio: `${width} / ${HEIGHT}` }} /> : complete || live ? <>
      {points.events.length > 0 ? <svg viewBox={`0 0 ${width} ${HEIGHT}`} role={onSeek ? 'slider' : 'img'} tabIndex={onSeek ? 0 : undefined}
        aria-label={onSeek ? t('按转速曲线跳转', 'Seek on TPS graph') : t('实时转速曲线', 'Live TPS graph')}
        aria-valuemin={onSeek ? 0 : undefined} aria-valuemax={onSeek ? duration : undefined} aria-valuenow={onSeek ? time - start : undefined}
        onPointerLeave={() => setHover(undefined)}
        onPointerMove={onSeek ? event => { if (event.pointerType === 'mouse') setHover(timeAtPointer(event)); } : undefined}
        onClick={onSeek ? event => seek(timeAtPointer(event)) : undefined}
        onKeyDown={onSeek ? event => {
          const offsets = { ArrowLeft: -0.05, ArrowRight: 0.05 };
          if (!(event.key in offsets) && !['Home', 'End', 'Enter', ' '].includes(event.key)) return;
          event.preventDefault();
          event.stopPropagation();
          if (event.key === 'Home') seek(start);
          else if (event.key === 'End') seek(end);
          else seek(time + (offsets[event.key as keyof typeof offsets] ?? 0));
        } : undefined}>
        {[0, points.ceiling / 2, points.ceiling].map(rate => <g key={rate}>
          <line className="video-recon-graph-grid" x1={LEFT} x2={right} y1={y(rate)} y2={y(rate)} />
          <text x={LEFT - 5} y={y(rate) + 4} textAnchor="end">{rate}</text>
        </g>)}
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => <text key={ratio} x={x(start + duration * ratio)} y={HEIGHT - 5}
          textAnchor={ratio === 0 ? 'start' : ratio === 1 ? 'end' : 'middle'}>{(duration * ratio).toFixed(1)}s</text>)}
        {live && <defs><clipPath id={clipId}><rect x={LEFT} y={0} width={Math.max(0, x(time) - LEFT)} height={HEIGHT} /></clipPath></defs>}
        <g clipPath={live ? `url(#${clipId})` : undefined}>
          <path className="video-recon-graph-area" d={`${line} L${right},${BASE} L${LEFT},${BASE} Z`} />
          <path className="video-recon-graph-line" d={line} />
        </g>
        <line className="video-recon-graph-grid" x1={x(time)} x2={x(time)} y1={10} y2={BASE} />
        <circle cx={x(time)} cy={y(rate)} r="3" />
      </svg> : <p className="video-recon-muted">{points.summary.moves ? t('暂无动作时间戳。', 'Turn timestamps are unavailable.') : t('暂无已识别动作。', 'No reconstructed turns yet.')}</p>}
      <dl className="video-recon-stats">
        <div><dt>{live ? t('已分析时长', 'Analyzed time') : t('还原用时', 'Solve time')}</dt>
          <dd>{formatTimer(live ? (time - start) * 1000 : points.summary.seconds === undefined ? undefined : points.summary.seconds * 1000)}</dd></div>
        <div><dt>{t('步数', 'Moves')}</dt><dd>{points.summary.moves}</dd></div>
        <div><dt>{t('平均 TPS', 'Average TPS')}</dt><dd>{points.summary.averageTps?.toFixed(2) ?? '—'}</dd></div>
      </dl>
    </> : <p className="video-recon-muted">{t('完整复盘后显示转速。', 'TPS is available after a full reconstruction.')}</p>}
  </section>;
}
