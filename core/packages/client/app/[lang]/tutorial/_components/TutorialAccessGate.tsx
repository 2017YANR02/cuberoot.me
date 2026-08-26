'use client';

import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { tr } from '@/i18n/tr';
import { useIsAdmin } from '@/lib/auth-store';

export default function TutorialAccessGate({ children }: { children: React.ReactNode }) {
  const isAdmin = useIsAdmin();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // 鉴权状态恢复前不挂载教程内容,避免非管理员首帧看到内容或触发教程数据请求。
  if (!mounted) {
    return <main className="tutorial-root" aria-busy="true" />;
  }

  if (!isAdmin) {
    return (
      <main className="tutorial-root">
        <div className="tutorial-empty-state">
          <Lock size={28} strokeWidth={1.6} aria-hidden="true" />
          <h1>{tr({ zh: '教程维护中', en: 'Tutorials under maintenance' })}</h1>
          <p>{tr({
            zh: '这些页面暂时仅供管理员访问。',
            en: 'These pages are temporarily available to administrators only.',
          })}</p>
        </div>
      </main>
    );
  }

  return children;
}
