'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useQueryState } from 'nuqs';
import { LogIn } from 'lucide-react';
import AppLink from '@/components/AppLink';
import { ClientLoadStatus } from '@/components/StartupStatus';
import { nextQuery, useAuthUser } from '@/lib/auth-store';
import { getVideoConfig, normalizeMeetCode, type VideoConfig } from '@/lib/video-room-api';
import { tr } from '@/i18n/tr';
import '@/components/video/video-call.css';
import './meet.css';

// Media, device capture and conference controls are only needed after sign-in.
const MeetClient = dynamic(() => import('./MeetClient'), {
  ssr: false,
  loading: () => <ClientLoadStatus />,
});

export default function MeetPage() {
  const user = useAuthUser();
  const pathname = usePathname();
  const [roomParam] = useQueryState('room', { history: 'push' });
  const urlCode = roomParam ? normalizeMeetCode(roomParam) : '';
  const [mounted, setMounted] = useState(false);
  const [cfg, setCfg] = useState<VideoConfig | null>(null);
  useEffect(() => {
    setMounted(true);
    let dead = false;
    void getVideoConfig().then(value => { if (!dead) setCfg(value); });
    return () => { dead = true; };
  }, []);

  if (!mounted) return <main className="meet-page" />;

  if (cfg && !cfg.enabled) {
    return (
      <main className="meet-page">
        <h1 className="meet-title">{tr({ zh: '会议', en: 'Meeting' })}</h1>
        <p className="vc-err">{tr({ zh: '本站未启用视频', en: 'Video is not enabled on this site' })}</p>
      </main>
    );
  }

  // ── 未登录 ───────────────────────────────────────────────
  if (!user) {
    return (
      <main className="meet-page">
        <h1 className="meet-title">{tr({ zh: '会议', en: 'Meeting' })}</h1>
        <p className="meet-sub">
          {tr({ zh: '多人视频会议,支持屏幕共享和文字聊天。', en: 'Group video meetings with screen sharing and chat.' })}
        </p>
        {/* 会议码必须跟着一起去登录页再回来 —— usePathname() 不含 query,直接喂它的话
            每一个第一次点邀请链接的人登录完都会落在空荡荡的大厅里,还得回聊天记录里
            再翻一次链接。而这恰恰是收到邀请的人**必经**的一条路(会议要求登录)。 */}
        <AppLink
          href={`/account${nextQuery(urlCode ? `${pathname}?room=${urlCode}` : pathname)}`}
          className="meet-go"
          prefetch={false}
        >
          <LogIn size={15} />
          {tr({ zh: '登录后使用', en: 'Sign in to continue' })}
        </AppLink>
      </main>
    );
  }

  return <MeetClient user={user} cfg={cfg} />;
}
