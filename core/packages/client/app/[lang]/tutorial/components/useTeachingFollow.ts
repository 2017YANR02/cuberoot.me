'use client';

import { useCallback, useEffect, useRef, useState, type SyntheticEvent, type KeyboardEvent } from 'react';
import './teaching-follow.css';

/** Follow the active teaching stage, yielding to manual reading until a playback/step action. */
export default function useTeachingFollow(position: number | string, lessonKey: string) {
  const pane = useRef<HTMLElement | null>(null);
  const following = useRef(true);
  const lastRow = useRef<HTMLElement | null>(null);
  const [revision, setRevision] = useState(0);
  const ref = useCallback((node: HTMLElement | null) => { pane.current = node; }, []);
  useEffect(() => {
    following.current = true;
    lastRow.current = null;
    pane.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [lessonKey]);
  useEffect(() => {
    const container = pane.current;
    if (!container || !matchMedia('(max-width: 760px)').matches) return;
    // Keep the scroll viewport above the mobile footer, including taller translated copy.
    const footer = container.closest('.f2l-page')?.querySelector('.f2l-study-dock');
    if (footer) {
      const available = `${Math.max(140, Math.floor(footer.getBoundingClientRect().top - container.getBoundingClientRect().top - 8))}px`;
      if (container.style.getPropertyValue('--tutorial-pane-available-height') !== available) {
        container.style.setProperty('--tutorial-pane-available-height', available);
      }
    }
    if (!following.current) return;
    const active = container.querySelector<HTMLElement>('[data-current-step="true"], [aria-current="step"]');
    const row = active?.closest<HTMLElement>('li') ?? active;
    if (!row || row === lastRow.current || container.scrollHeight <= container.clientHeight) return;
    lastRow.current = row;
    const bounds = container.getBoundingClientRect();
    const target = row.getBoundingClientRect();
    const top = bounds.top + 12, bottom = bounds.bottom - 12;
    if (target.top >= top && target.bottom <= bottom) return;
    const offset = target.top < top || target.height > bottom - top ? target.top - top : target.bottom - bottom;
    container.scrollBy({ top: offset, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [position, lessonKey, revision]);
  const pause = () => {
    if (!following.current) return;
    following.current = false;
    pane.current?.scrollTo({ top: pane.current.scrollTop, behavior: 'instant' });
  };
  const resume = () => {
    if (following.current) return;
    following.current = true;
    lastRow.current = null;
    setRevision(value => value + 1);
  };
  const playbackAction = (event: SyntheticEvent) => {
    if (event.target instanceof Element && event.target.closest('.playback-bar button:not(:disabled):not(.playback-bar-reset-view), .playback-bar [role="slider"], .playback-bar input')) resume();
  };
  return {
    resume,
    paneProps: {
      ref, tabIndex: 0, onTouchMove: pause, onWheel: pause,
      onPointerDown: (event: SyntheticEvent) => { if (event.target === event.currentTarget) pause(); },
      onKeyDownCapture: (event: KeyboardEvent) => {
        if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) {
          pause();
          event.stopPropagation();
        }
      },
      onClickCapture: (event: SyntheticEvent) => {
        if (event.target instanceof Element && event.target.closest('button')) resume();
      },
    },
    playbackProps: { onPointerDownCapture: playbackAction, onClickCapture: playbackAction, onKeyDownCapture: playbackAction },
  };
}
