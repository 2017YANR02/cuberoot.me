import { useCallback, useRef } from 'react';

/**
 * 高精度计时器 hook
 * 使用 performance.now() 提供毫秒级精度
 */
export function useTimer() {
  const startRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const callbackRef = useRef<((ms: number) => void) | null>(null);

  const start = useCallback((onTick?: (ms: number) => void) => {
    startRef.current = performance.now();
    callbackRef.current = onTick ?? null;

    const tick = () => {
      elapsedRef.current = Math.round(performance.now() - startRef.current);
      callbackRef.current?.(elapsedRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stop = useCallback((): number => {
    cancelAnimationFrame(rafRef.current);
    const final = Math.round(performance.now() - startRef.current);
    elapsedRef.current = final;
    return final;
  }, []);

  const reset = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    startRef.current = 0;
    elapsedRef.current = 0;
  }, []);

  return { start, stop, reset, elapsed: elapsedRef };
}
