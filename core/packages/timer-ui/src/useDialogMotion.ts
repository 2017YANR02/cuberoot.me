'use client';

import { useCallback, useEffect, useRef } from 'react';

/** Keep dismissal/focus/scroll owners mounted through exit. Never fade a glass
 * ancestor: animate the scrim's color and the panel's geometry independently. */
export function useDialogMotion(onClose: () => void, {
  enabled = true, surface = false, sheet = false,
}: { enabled?: boolean; surface?: boolean; sheet?: boolean } = {}) {
  const motionRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ onClose, enabled, surface, sheet });
  latest.current = { onClose, enabled, surface, sheet };
  const animations = useRef<Animation[]>([]);
  const closing = useRef(false);
  const mounted = useRef(false);
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = useCallback(() => {
    animations.current.forEach(animation => animation.cancel());
    animations.current = [];
    if (fallback.current !== null) clearTimeout(fallback.current);
    fallback.current = null;
  }, []);
  const play = useCallback((exit: boolean) => {
    const root = motionRef.current;
    if (!root || !latest.current.enabled || typeof root.animate !== 'function' || typeof window.matchMedia !== 'function'
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return [];
    const panel = latest.current.surface ? root : root.firstElementChild;
    if (!(panel instanceof HTMLElement)) return [];
    const sheetMotion = latest.current.sheet && window.matchMedia('(max-width: 900px)').matches;
    const rest = { translate: '0 0', scale: '1' };
    const offset = { translate: sheetMotion ? '0 100%' : '0 8px', scale: sheetMotion ? '1' : '.985' };
    const options: KeyframeAnimationOptions = { duration: exit ? 160 : 180,
      easing: exit ? 'ease-in' : 'cubic-bezier(.2,.8,.2,1)', fill: exit ? 'forwards' : 'none' };
    const running = [panel.animate(exit ? [rest, offset] : [offset, rest], options)];
    if (panel !== root) {
      const backgroundColor = getComputedStyle(root).backgroundColor;
      const frames = [{ backgroundColor: 'transparent' }, { backgroundColor }];
      running.push(root.animate(exit ? frames.reverse() : frames, options));
    }
    return running;
  }, []);
  useEffect(() => {
    mounted.current = true;
    closing.current = false;
    animations.current = play(false);
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const reduce = () => { if (media?.matches) cancel(); };
    media?.addEventListener?.('change', reduce);
    return () => {
      mounted.current = false;
      media?.removeEventListener?.('change', reduce);
      cancel();
    };
  }, [enabled, cancel, play]);
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    cancel();
    const running = play(true);
    animations.current = running;
    let completed = false;
    const finish = () => {
      if (!mounted.current || !closing.current || completed) return;
      completed = true;
      if (fallback.current !== null) clearTimeout(fallback.current);
      fallback.current = null;
      // Keep the exit's final frame until React removes/hides the dialog.
      // Cancelling here restores the visible scrim and panel before that commit.
      // The effect cleanup owns cancellation (including enabled -> false).
      latest.current.onClose();
    };
    if (!running.length) { finish(); return; }
    // A bounded fallback also covers a background tab with suspended animations.
    fallback.current = setTimeout(finish, 220);
    void Promise.allSettled(running.map(animation => animation.finished)).then(finish);
  }, [cancel, play]);
  return { motionRef, close };
}
