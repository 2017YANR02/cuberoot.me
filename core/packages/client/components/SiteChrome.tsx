'use client';

import { usePathname } from 'next/navigation';
import { useSyncExternalStore, type ReactNode } from 'react';

import { isContractReaderPath } from '@/lib/contract-reader-route';

const subscribe = () => () => {};

/** Suppress global overlays on dedicated reading and embedded player surfaces. */
export default function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const videoFrame = useSyncExternalStore(subscribe,
    () => window.parent !== window && window.name === 'cuberoot-timer-video-review', () => false);
  return videoFrame || isContractReaderPath(pathname) || /^\/(?:en\/|zh\/)?sim\/embed\/?$/.test(pathname ?? '') ? null : children;
}
