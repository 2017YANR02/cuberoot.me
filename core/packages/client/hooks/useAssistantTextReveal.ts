'use client';
import { useEffect } from 'react';

/** Show the real streamed prefix immediately. Notify after a paint, with no simulated typing queue. */
export function useAssistantTextReveal(text: string, animate: boolean, id?: string, onComplete?: (id: string, text: string) => void, complete = true) {
  useEffect(() => {
    if (!id || !onComplete) return;
    let second = 0;
    const first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() => onComplete(id, text));
    });
    return () => { window.cancelAnimationFrame(first); window.cancelAnimationFrame(second); };
  }, [text, animate, id, onComplete, complete]);
  return text;
}
