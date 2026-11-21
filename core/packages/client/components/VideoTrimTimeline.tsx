'use client';

import { useRef, type PointerEvent, type ReactNode, type RefObject } from 'react';
import { ChevronLeft, ChevronRight } from '@app-foundation/icons/lucide';
import './video-tools.css';

export type VideoTimelineEdge = 'left' | 'right' | 'seek';
type Drag = { side: VideoTimelineEdge; startX: number; startVal: number };

export function VideoTrimTimeline({
  total, start, end, position, timeLabel, thumbnails, children, trackRef, playheadRef, tooltipRef,
  onSeek, onTrim, onDragStart, labels, step = 1,
}: {
  total: number;
  start: number;
  end: number;
  position: number;
  timeLabel: string;
  thumbnails: ReactNode;
  children?: ReactNode;
  trackRef?: RefObject<HTMLDivElement | null>;
  playheadRef?: RefObject<HTMLDivElement | null>;
  tooltipRef?: RefObject<HTMLSpanElement | null>;
  onSeek: (value: number) => void;
  onTrim: (edge: 'left' | 'right', value: number) => void;
  onDragStart?: (drag: Drag) => void;
  labels: { start: string; end: string; seek: string };
  step?: number;
}) {
  const fallbackRef = useRef<HTMLDivElement>(null);
  const track = trackRef ?? fallbackRef;
  const drag = useRef<(Drag & { pointer: number }) | null>(null);
  const percentage = (value: number) => total > 0 ? value * 100 / total : 0;
  const clamp = (value: number, from: number, to: number) => Math.min(to, Math.max(from, value));
  const snap = (value: number) => Math.round(value / step) * step;

  function setValue(side: VideoTimelineEdge, value: number) {
    if (side === 'seek') onSeek(clamp(value, start, end));
    else onTrim(side, clamp(value, 0, total));
  }

  function begin(event: PointerEvent<HTMLDivElement>, side: VideoTimelineEdge, startVal: number) {
    const bounds = track.current?.getBoundingClientRect();
    if (!total || !bounds?.width || event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    event.stopPropagation();
    const { clientX, pointerId } = event;
    const value = side === 'seek' ? clamp(snap((clientX - bounds.left) / bounds.width * total), start, end) : startVal;
    if (side === 'seek') onSeek(value);
    const next = { side, startX: clientX, startVal: value };
    if (onDragStart) onDragStart(next);
    else {
      drag.current = { ...next, pointer: pointerId };
      event.currentTarget.setPointerCapture(pointerId);
    }
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const active = drag.current;
    const bounds = track.current?.getBoundingClientRect();
    if (!active || active.pointer !== event.pointerId || !bounds?.width) return;
    const value = active.side === 'seek' ? (event.clientX - bounds.left) * total / bounds.width
      : active.startVal + (event.clientX - active.startX) * total / bounds.width;
    setValue(active.side, snap(value));
  }

  function control(side: VideoTimelineEdge, value: number, label: string, min: number, max: number) {
    return {
      role: 'slider',
      tabIndex: total > 0 ? 0 : -1,
      'aria-label': label,
      'aria-valuemin': min,
      'aria-valuemax': max,
      'aria-valuenow': value,
      'aria-disabled': total <= 0,
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => begin(event, side, value),
      onPointerMove: move,
      onLostPointerCapture: (event: PointerEvent<HTMLDivElement>) => {
        if (drag.current?.pointer === event.pointerId) drag.current = null;
      },
      onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (!total) return;
        const next = { ArrowLeft: value - step, ArrowDown: value - step, ArrowRight: value + step,
          ArrowUp: value + step, Home: min, End: max }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        setValue(side, clamp(next, min, max));
      },
    };
  }

  const playhead = clamp(position, start, end);
  return <div className="video-timeline-trimmer" ref={track}>
    <div className="video-timeline-filmstrip" aria-hidden="true">{thumbnails}</div>
    <div className="video-timeline-dim video-timeline-dim-left" style={{ width: `${percentage(start)}%` }} />
    <div className="video-timeline-dim video-timeline-dim-right" style={{ width: `${percentage(total - end)}%` }} />
    <div className="video-timeline-border" style={{ left: `${percentage(start)}%`, width: `${percentage(end - start)}%` }} />
    <div className="video-timeline-handle video-timeline-handle-left" style={{ left: `calc(${percentage(start)}% - 14px)` }}
      {...control('left', start, labels.start, 0, end)}><ChevronLeft size={14} aria-hidden /></div>
    <div className="video-timeline-handle video-timeline-handle-right" style={{ left: `${total ? percentage(end) : 100}%` }}
      {...control('right', end, labels.end, start, total)}><ChevronRight size={14} aria-hidden /></div>
    {total > 0 && <div ref={playheadRef} className="video-timeline-playhead" style={{ left: `${percentage(playhead)}%` }}>
      <span ref={tooltipRef} className="video-timeline-time">{timeLabel}</span>
    </div>}
    <div className="video-timeline-seek-area" {...control('seek', playhead, labels.seek, start, end)} aria-valuetext={timeLabel} />
    {children}
  </div>;
}
