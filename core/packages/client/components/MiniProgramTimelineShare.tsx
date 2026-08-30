'use client';

import { useEffect, useState } from 'react';
import { Share2 } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { T, tr } from '@/i18n/tr';
import { resolveVerifiedMiniProgramNavigationApi } from '@/lib/miniprogram-bridge';
import { resolveMiniProgramShareRouteKey } from '@/lib/miniprogram-share';
import type { WeChatMiniProgramApi } from '@/lib/wechat-js-sdk';
import './miniprogram-timeline-share.css';

type OpenStatus = 'idle' | 'opening' | 'failed';

export default function MiniProgramTimelineShare() {
  const pathname = usePathname();
  const routeKey = resolveMiniProgramShareRouteKey(pathname);
  const [miniProgram, setMiniProgram] = useState<WeChatMiniProgramApi | null>(null);
  const [status, setStatus] = useState<OpenStatus>('idle');

  useEffect(() => {
    let active = true;
    setMiniProgram(null);
    setStatus('idle');
    if (!routeKey) return () => { active = false; };

    void resolveVerifiedMiniProgramNavigationApi().then((api) => {
      if (active) setMiniProgram(api);
    });
    return () => { active = false; };
  }, [routeKey]);

  if (!routeKey || !miniProgram) return null;

  const label = status === 'opening'
    ? tr({ en: 'Opening Moments share', zh: '正在打开朋友圈分享' })
    : status === 'failed'
      ? tr({ en: 'Retry Moments share', zh: '重试朋友圈分享' })
      : tr({ en: 'Share to Moments', zh: '分享到朋友圈' });

  const openSharePage = (): void => {
    setStatus('opening');
    try {
      miniProgram.navigateTo({
        url: `/pages/share/index?key=${encodeURIComponent(routeKey)}`,
        fail: () => setStatus('failed'),
        success: () => setStatus('idle'),
      });
    } catch {
      setStatus('failed');
    }
  };

  return (
    <button
      type="button"
      className={`mini-program-timeline-share${status === 'failed' ? ' mini-program-timeline-share--failed' : ''}`}
      aria-label={label}
      title={label}
      disabled={status === 'opening'}
      onClick={openSharePage}
    >
      <Share2 aria-hidden="true" size={17} strokeWidth={2} />
      <span>
        {status === 'opening'
          ? <T en="Opening" zh="正在打开" />
          : status === 'failed'
            ? <T en="Retry" zh="重试" />
            : <T en="Moments" zh="朋友圈" />}
      </span>
    </button>
  );
}
