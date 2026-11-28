'use client';

import { ChevronLeft, ChevronRight, FastForward, Rewind } from '@app-foundation/icons/lucide';
import { useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export type VideoFrameStep = -10 | -1 | 1 | 10;

const frameSteps = [
  { delta: -10, interval: 150, action: 'back10', Icon: Rewind },
  { delta: -1, interval: 80, action: 'back1', Icon: ChevronLeft },
  { delta: 1, interval: 80, action: 'forward1', Icon: ChevronRight },
  { delta: 10, interval: 150, action: 'forward10', Icon: FastForward },
] as const;

export function VideoFrameStepButtons({ onStep, active = true, atStart = false, atEnd = false, showShortcuts = false }: {
  onStep: (delta: VideoFrameStep) => void;
  active?: boolean;
  atStart?: boolean;
  atEnd?: boolean;
  showShortcuts?: boolean;
}) {
  const { t } = useTranslation();
  const repeat = useRef<number | undefined>(undefined);
  const step = useRef<(delta: VideoFrameStep) => boolean>(() => false);

  useLayoutEffect(() => {
    step.current = delta => {
      if (!active || (delta < 0 ? atStart : atEnd)) return false;
      onStep(delta);
      return true;
    };
  }, [onStep, active, atStart, atEnd]);

  function stopRepeating() {
    window.clearTimeout(repeat.current);
  }

  useLayoutEffect(() => stopRepeating, [active]);

  const labels = showShortcuts ? 'frameCount.controls' : 'frameCount.shortcutsModal.action';
  return frameSteps.map(({ delta, interval, action, Icon }) => (
    <button key={delta} type="button" className="lesson-video-button lesson-video-icon" aria-label={t(`${labels}.${action}`)}
      disabled={!active || (delta < 0 ? atStart : atEnd)}
      onPointerDown={event => {
        if (!event.isPrimary || event.button !== 0) return;
        event.preventDefault();
        stopRepeating();
        function repeatStep() {
          if (step.current(delta)) repeat.current = window.setTimeout(repeatStep, interval);
        }
        if (step.current(delta)) repeat.current = window.setTimeout(repeatStep, 400);
      }}
      onPointerUp={stopRepeating} onPointerLeave={stopRepeating} onPointerCancel={stopRepeating}
      onLostPointerCapture={stopRepeating}
      onClick={event => { if (event.detail === 0) step.current(delta); }}>
      <Icon aria-hidden />
    </button>
  ));
}
