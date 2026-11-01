'use client';
import { useEffect, useRef, useState } from 'react';

/** Only the visible prefix enters Markdown/layout; the full answer stays in storage. */
export function useAssistantTextReveal(text: string, animate: boolean, id?: string, onComplete?: (id: string, text: string) => void) {
  const [visible, setVisible] = useState(animate ? '' : text);
  const target = useRef(text);
  const prefix = text.startsWith(visible) ? visible : '';
  const caughtUp = prefix === text;
  useEffect(() => { target.current = text; }, [text]);
  useEffect(() => {
    if (!animate || caughtUp) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const segmenter = new Intl.Segmenter(undefined, {granularity: 'grapheme'});
    // Incoming chunks do not reset the clock, even when they arrive every frame.
    const timer = window.setInterval(() => {
      setVisible(previous => {
        const answer = target.current;
        if (reduced.matches) return answer;
        const start = answer.startsWith(previous) ? previous : '';
        if (start === answer) return start;
        const count = Math.max(1, Math.ceil((answer.length - start.length) / 120));
        let next = start, taken = 0;
        for (const {segment} of segmenter.segment(answer.slice(start.length))) {
          next += segment;
          if (++taken >= count) break;
        }
        return next;
      });
    }, 16);
    return () => window.clearInterval(timer);
  }, [animate, caughtUp]);
  useEffect(() => {
    if (animate && prefix !== text) return;
    const timer = window.setTimeout(() => { if (id) onComplete?.(id, text); }, animate ? 280 : 0);
    return () => window.clearTimeout(timer);
  }, [text, prefix, animate, id, onComplete]);
  return animate ? prefix : text;
}
