'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Fit the complete shot into the available space without scaling the transport. */
export default function VideoStage({ children }: { children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const scale = String(Math.min(1, Math.max(0, entry.contentRect.height / 496)));
      if (element.style.getPropertyValue('--f2l-video-scale') !== scale) element.style.setProperty('--f2l-video-scale', scale);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div className="f2l-video-viewport" ref={viewport}><div className="f2l-video-stage">{children}</div></div>;
}
