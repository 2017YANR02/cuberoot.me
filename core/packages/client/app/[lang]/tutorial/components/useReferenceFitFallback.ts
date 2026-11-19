'use client';

import { useCallback, useEffect, useState } from 'react';

/** Retry the larger layout only after the viewport grows, so a compact layout
 * cannot immediately switch itself back by reducing its own content height. */
export default function useReferenceFitFallback(minimumScale = .995, lessonKey = '') {
  const [failedViewport, setFailedViewport] = useState<{ width: number; height: number; lessonKey: string }>();
  const onReferenceFit = useCallback((scale: number) => {
    if (scale < minimumScale) setFailedViewport(previous => previous?.lessonKey === lessonKey
      ? previous : { width: innerWidth, height: innerHeight, lessonKey });
  }, [minimumScale, lessonKey]);
  useEffect(() => {
    if (!failedViewport) return;
    const retryIfLarger = () => {
      if (innerWidth > failedViewport.width || innerHeight > failedViewport.height) setFailedViewport(undefined);
    };
    window.addEventListener('resize', retryIfLarger);
    return () => window.removeEventListener('resize', retryIfLarger);
  }, [failedViewport]);
  return { compactFallback: failedViewport?.lessonKey === lessonKey, onReferenceFit };
}
