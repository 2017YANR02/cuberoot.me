'use client';

import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { ClearButton } from '@/components/ClearButton';
import { useT } from '@/hooks/useT';

const FILMSTRIP_DRAG_THRESHOLD_PX = 20;
const FILMSTRIP_REVEAL_DISTANCE_PX = 64;

interface Props {
  position: number;
  total: number;
  buffered: number;
  step: number;
  time: string;
  filmstrip?: ReactNode;
  onSeek: (position: number) => void;
}

export function VideoSeekBar({ position, total, buffered, step, time, filmstrip, onSeek }: Props) {
  const t = useT();
  const range = useRef<HTMLInputElement>(null);
  const drag = useRef<{ id: number; y: number; initial: number; reveal: number; last: number; rail: boolean } | null>(null);
  const [reveal, setReveal] = useState(0);
  const [visited, setVisited] = useState(false);
  const value = Math.max(0, Math.min(total, position));

  function track(event: PointerEvent<HTMLElement>) {
    const active = drag.current;
    if (!active || event.pointerId !== active.id) return;
    const bounds = range.current!.getBoundingClientRect();
    if (bounds.width > 0) {
      const fraction = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
      const next = fraction === 1 ? total : Math.min(total, Math.round(fraction * total / step) * step);
      if (next !== active.last) {
        active.last = next;
        onSeek(next);
      }
    }
    if (active.rail && filmstrip) {
      const dy = active.y - event.clientY;
      const beyondThreshold = Math.sign(dy) * Math.max(0, Math.abs(dy) - FILMSTRIP_DRAG_THRESHOLD_PX);
      active.reveal = Math.min(1, Math.max(0, active.initial + beyondThreshold / FILMSTRIP_REVEAL_DISTANCE_PX));
      if (active.reveal > 0) setVisited(true);
      setReveal(active.reveal);
    }
  }

  function start(event: PointerEvent<HTMLElement>, rail: boolean) {
    if (!total || event.button !== 0 || event.isPrimary === false || drag.current) return;
    event.preventDefault();
    event.stopPropagation();
    range.current?.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, y: event.clientY, initial: reveal, reveal, last: -1, rail };
    track(event);
  }

  function finish(event: PointerEvent<HTMLElement>) {
    const active = drag.current;
    if (!active || active.id !== event.pointerId) return;
    if (event.type === 'pointerup') track(event);
    setReveal(event.type === 'pointerup' ? Number(active.reveal >= 0.5) : active.initial);
    drag.current = null;
  }

  function close() {
    setReveal(0);
    range.current?.focus({ preventScroll: true });
  }

  const tracking = { onPointerMove: track, onPointerUp: finish, onPointerCancel: finish, onLostPointerCapture: finish };
  return <div className="video-scrubber" data-expanded={reveal > 0} style={{
    '--played': `${total ? value / total * 100 : 0}%`,
    '--buffered': `${total ? Math.min(1, buffered / total) * 100 : 0}%`,
  } as CSSProperties} onKeyDown={event => {
    if (event.key === 'Escape' && reveal > 0) { event.stopPropagation(); close(); }
  }}>
    <div className="lesson-video-progress">
      <input ref={range} className="lesson-video-range" type="range" aria-label={t('播放进度', 'Playback position')} aria-valuetext={time} aria-keyshortcuts={filmstrip ? 'Enter Escape' : undefined}
        min={0} max={total || 1} step={step} value={value} disabled={!total}
        onChange={event => onSeek(event.currentTarget.valueAsNumber)} onPointerDown={event => start(event, true)} {...tracking}
        onKeyDown={event => {
          if (filmstrip && event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            setVisited(true);
            setReveal(reveal ? 0 : 1);
          }
        }} />
    </div>
    {filmstrip && visited && <div className="video-scrubber-reveal" inert={reveal === 0}
      style={{ gridTemplateRows: `${reveal}fr`, opacity: reveal }}>
      <div className="video-scrubber-clip">
        <div className="video-scrubber-frames" onPointerDown={event => {
          if (!(event.target as Element).closest('.video-timeline-trimmer,button')) start(event, false);
        }} {...tracking}>
          {filmstrip}
        </div>
      </div>
    </div>}
    {reveal === 1 && <ClearButton variant="standalone" className="lesson-video-button video-scrubber-close"
      ariaLabel={t('收起缩略图', 'Collapse thumbnails')} onClick={close} />}
  </div>;
}
