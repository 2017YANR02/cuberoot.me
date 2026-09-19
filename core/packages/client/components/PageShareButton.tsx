'use client';

import { lazy, Suspense, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Share2 } from 'lucide-react';
import { publicPageSharePath } from '@cuberoot/shared/page-share';
import { currentPageShare, syncMiniProgramPageShare } from '@/lib/page-share';
import { tr } from '@/i18n/tr';
import './page-share-button.css';

const PageShareModal = lazy(() => import('./WeChatPcShareModal').then(module => ({ default: module.PageShareModal })));

export default function PageShareButton({ className = '', labelClassName }: { className?: string; labelClassName?: string }) {
  const pathname = usePathname();
  const [share, setShare] = useState<ReturnType<typeof currentPageShare>>(null);
  useEffect(() => { setShare(null); }, [pathname]);
  if (!publicPageSharePath(pathname)) return null;
  return <>
    <button type="button" className={`page-share-button ${className}`}
      title={tr({ zh: '分享当前页面', en: 'Share this page' })}
      aria-label={tr({ zh: '分享当前页面', en: 'Share this page' })}
      onClick={() => { setShare(currentPageShare()); void syncMiniProgramPageShare(); }}>
      <Share2 size={16} aria-hidden />
      <span className={labelClassName}>{tr({ zh: '分享', en: 'Share' })}</span>
    </button>
    {share && <Suspense fallback={null}><PageShareModal share={share} onClose={() => setShare(null)} /></Suspense>}
  </>;
}
