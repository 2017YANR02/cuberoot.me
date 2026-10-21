'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/** External simulator frames contain only their player, without site overlays. */
export default function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return /^\/(?:en\/|zh\/)?sim\/embed\/?$/.test(pathname ?? '') ? null : children;
}
