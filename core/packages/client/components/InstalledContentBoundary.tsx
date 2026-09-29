'use client';
import { useSyncExternalStore, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { installedContentUnavailable } from '@cuberoot/shared/installed-content';
import { isInstalledWebsiteSurface } from '@/lib/installed-content';
import { tr } from '@/i18n/tr';
const subscribe = () => () => {};
export default function InstalledContentBoundary({ children }: { children: ReactNode }) {
  const path = usePathname();
  const installed = useSyncExternalStore(subscribe, isInstalledWebsiteSurface, () => false);
  if (installed && installedContentUnavailable(path)) return <main role="status"><p>{tr({ zh: '此内容暂不在 App 中提供。', en: 'This content is not available in the app.' })}</p></main>;
  return <div data-installed-route="" data-installed-reviewed={installed ? 'true' : undefined}>{children}</div>;
}
