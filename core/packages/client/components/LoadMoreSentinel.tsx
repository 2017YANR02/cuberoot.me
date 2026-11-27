'use client';

import { useEffect, useEffectEvent, useRef } from 'react';

export function LoadMoreSentinel({ onLoadMore }: { onLoadMore: () => void }) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMore = useEffectEvent(onLoadMore);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(entries => {
      if (entries[entries.length - 1]?.isIntersecting) loadMore();
    }, { rootMargin: '200px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return <div ref={sentinelRef} style={{ height: 1 }} aria-hidden="true" />;
}
