import { useMemo, useState } from 'react';
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
  onSeek: (time: number) => void;
}

const NO_STEPS: readonly MoveStep[] = [];
const WIDTH = 640;
const HEIGHT = 142;
const LEFT = 30;
const RIGHT = 624;
const BASE = 118;

export function TpsGraph({ steps = NO_STEPS, turns, moves, fps, start, end, solveSeconds, cursor, complete, onSeek }: Props) {
  const t = useT();
  const [hover, setHover] = useState<number>();
  const points = useMemo(() => {
    const events = complete ? turns ?? turnEvents(steps, fps) : [];
    const curve = tpsCurve(events, start, end);
    const ceiling = Math.max(5, Math.ceil(curve.reduce((max, row) => Math.max(max, row.tps), 0) / 5) * 5);
    const count = events.length || turnEvents([{ frame_index: 0, state_moves: [...(moves ?? [])] }], 1).length;
    return { events, curve, ceiling, summary: tpsSummary(events, solveSeconds ?? committedTurnSpan(steps, fps), count) };
  }, [complete, turns, steps, fps, start, end, moves, solveSeconds]);
  const duration = Math.max(0, end - start);
  const x = (time: number) => LEFT + (time - start) / Math.max(0.001, duration) * (RIGHT - LEFT);
  const y = (rate: number) => BASE - rate / points.ceiling * (BASE - 10);
  const line = points.curve.map((point, index) => `${index ? 'L' : 'M'}${x(point.timestamp)},${y(point.tps)}`).join(' ');
  const time = Math.max(start, Math.min(end, hover ?? cursor ?? start));
  const seek = (next: number) => onSeek(Math.max(start, Math.min(end, next)));
  return <section className="video-recon-panel video-recon-tps" data-site-surface="panel">
    <div className="video-recon-section-heading">
      <h2>{t('转速曲线', 'Turns per second')}</h2>
      {complete && points.events.length > 0 && <span>{gaussianTpsAt(points.events, time).toFixed(1)} TPS</span>}
    </div>
    {complete ? <>
      {points.events.length > 0 ? <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="slider" tabIndex={0}
        aria-label={t('按转速曲线跳转', 'Seek on TPS graph')}
        aria-valuemin={0} aria-valuemax={duration} aria-valuenow={time - start}
        onPointerLeave={() => setHover(undefined)}
        onPointerMove={event => {
          const rect = event.currentTarget.getBoundingClientRect();
          const ratio = ((event.clientX - rect.left) / rect.width * WIDTH - LEFT) / (RIGHT - LEFT);
          setHover(start + Math.max(0, Math.min(1, ratio)) * duration);
        }}
        onClick={() => seek(time)}
        onKeyDown={event => {
          const offsets = { ArrowLeft: -0.05, ArrowRight: 0.05 };
          if (!(event.key in offsets) && !['Home', 'End', 'Enter', ' '].includes(event.key)) return;
          event.preventDefault();
          event.stopPropagation();
          if (event.key === 'Home') seek(start);
          else if (event.key === 'End') seek(end);
          else seek(time + (offsets[event.key as keyof typeof offsets] ?? 0));
        }}>
        {[0, points.ceiling / 2, points.ceiling].map(rate => <g key={rate}>
          <line className="video-recon-graph-grid" x1={LEFT} x2={RIGHT} y1={y(rate)} y2={y(rate)} />
          <text x={LEFT - 5} y={y(rate) + 4} textAnchor="end">{rate}</text>
        </g>)}
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => <text key={ratio} x={x(start + duration * ratio)} y={HEIGHT - 5}
          textAnchor={ratio === 0 ? 'start' : ratio === 1 ? 'end' : 'middle'}>{(duration * ratio).toFixed(1)}s</text>)}
        <path className="video-recon-graph-area" d={`${line} L${RIGHT},${BASE} L${LEFT},${BASE} Z`} />
        <path className="video-recon-graph-line" d={line} />
        <line className="video-recon-graph-grid" x1={x(time)} x2={x(time)} y1={10} y2={BASE} />
        <circle cx={x(time)} cy={y(gaussianTpsAt(points.events, time))} r="3" />
      </svg> : <p className="video-recon-muted">{points.summary.moves ? t('暂无动作时间戳。', 'Turn timestamps are unavailable.') : t('暂无已识别动作。', 'No reconstructed turns yet.')}</p>}
      <dl className="video-recon-stats">
        <div><dt>{t('还原用时', 'Solve time')}</dt><dd>{formatTimer(points.summary.seconds === undefined ? undefined : points.summary.seconds * 1000)}</dd></div>
        <div><dt>{t('步数', 'Moves')}</dt><dd>{points.summary.moves}</dd></div>
        <div><dt>{t('平均 TPS', 'Average TPS')}</dt><dd>{points.summary.averageTps?.toFixed(2) ?? '—'}</dd></div>
      </dl>
    </> : <p className="video-recon-muted">{t('完整复盘后显示转速。', 'TPS is available after a full reconstruction.')}</p>}
  </section>;
}
