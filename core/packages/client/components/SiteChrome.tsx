'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { isContractReaderPath } from '@/lib/contract-reader-route';

/** Suppress global overlays on dedicated reading and embedded player surfaces. */
export default function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return isContractReaderPath(pathname) || /^\/(?:en\/|zh\/)?sim\/embed\/?$/.test(pathname ?? '') ? null : children;
}
