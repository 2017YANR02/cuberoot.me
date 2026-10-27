'use client';

import { useCallback, useLayoutEffect, useRef, type ReactNode } from 'react';
import { TimerRoomDialog } from '@cuberoot/timer-ui';
import { tr } from '@/i18n/tr';
import './visual-cube.css';

/** Kept mounted while returning to the thumbnail, preserving the modal's focus trap. */
export function DiagramPreview({ source, title, onClose, children }: {
  source: HTMLButtonElement; title: string; onClose: () => void; children: ReactNode;
}) {
  const body = useRef<HTMLDivElement>(null);
  const animation = useRef<Animation | null>(null);
  const thumbnailFade = useRef<Animation | null>(null);
  const sourceOpacity = useRef(source.style.opacity);
  const closing = useRef(false);
  const finish = useRef(onClose);
  finish.current = onClose;
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const image = body.current?.querySelector<HTMLElement>('.puzzle-art');
    const target = source.getBoundingClientRect();
    if (!image || !source.isConnected || !target.width || target.bottom <= 0 || target.top >= innerHeight || target.right <= 0 || target.left >= innerWidth ||
      matchMedia('(prefers-reduced-motion: reduce)').matches || typeof image.animate !== 'function') {
      finish.current();
      return;
    }
    // Read the live transform first so Escape during opening reverses smoothly.
    const currentTransform = getComputedStyle(image).transform;
    animation.current?.cancel();
    const rect = image.getBoundingClientRect();
    const returning = image.animate([
      { transform: currentTransform, transformOrigin: '0 0', opacity: 1 },
      { offset: 0.7, opacity: 1 },
      { transform: `translate(${target.left - rect.left}px, ${target.top - rect.top}px) scale(${target.width / rect.width})`, transformOrigin: '0 0', opacity: 0 },
    ], { duration: 220, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'forwards' });
    animation.current = returning;
    // Fade into the original projection if the enlarged cube was rotated.
    source.style.opacity = sourceOpacity.current;
    thumbnailFade.current = source.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 80, delay: 140, fill: 'backwards' });
    void returning.finished.then(() => finish.current(), () => {});
  }, [source]);

  useLayoutEffect(() => {
    const image = body.current?.querySelector<HTMLElement>('.puzzle-art');
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const originalOpacity = source.style.opacity;
    if (image && !media.matches && typeof image.animate === 'function') {
      const from = source.getBoundingClientRect(), to = image.getBoundingClientRect();
      animation.current = image.animate([
        { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width})`, transformOrigin: '0 0' },
        { transform: 'none', transformOrigin: '0 0' },
      ], { duration: 280, easing: 'cubic-bezier(.22, 1, .36, 1)' });
    }
    source.style.opacity = '0';
    const settle = () => {
      animation.current?.cancel();
      thumbnailFade.current?.cancel();
      if (closing.current) finish.current();
    };
    window.addEventListener('resize', settle);
    media.addEventListener('change', settle);
    return () => {
      animation.current?.cancel();
      thumbnailFade.current?.cancel();
      source.style.opacity = originalOpacity;
      window.removeEventListener('resize', settle);
      media.removeEventListener('change', settle);
    };
  }, [source]);

  return <TimerRoomDialog title={title} hideHeader className="visualcube-preview" language={tr({ zh: 'zh', en: 'en' }) as 'zh' | 'en'} onClose={close}>
    <div ref={body} className="visualcube-preview-body" onKeyDownCapture={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    }}>{children}</div>
  </TimerRoomDialog>;
}
