'use client';
import { useSyncExternalStore, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { installedContentUnavailable } from '@cuberoot/shared/installed-content';
import { isInstalledWebsiteSurface } from '@/lib/installed-content';
import { tr } from '@/i18n/tr';
import AppLink from '@/components/AppLink';
import { useDouyinToolSurface } from '@/lib/douyin-content';
import { douyinContentAvailable } from '@cuberoot/shared/douyin-content';
const subscribe = () => () => {};
export default function InstalledContentBoundary({ children }: { children: ReactNode }) {
  const path = usePathname();
  const douyin = useDouyinToolSurface();
  const installed = useSyncExternalStore(subscribe, isInstalledWebsiteSurface, () => false);
  if (douyin && !douyinContentAvailable(path)) return <main role="status"><p>{tr({ zh: '此功能不在抖音小程序中提供。', en: 'This feature is not available in the Douyin Mini Program.' })}</p><AppLink href="/">{tr({ zh: '工具首页', en: 'Tools' })}</AppLink></main>;
  if (installed && installedContentUnavailable(path)) return <main role="status"><p>{tr({ zh: '此内容暂不在 App 中提供。', en: 'This content is not available in the app.' })}</p></main>;
  return <div data-installed-route="" data-douyin-checked={douyin ? 'true' : undefined} data-installed-reviewed={installed ? 'true' : undefined}>{children}</div>;
}
