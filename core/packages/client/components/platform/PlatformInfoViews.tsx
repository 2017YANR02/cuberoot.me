'use client';

import { useEffect, useState } from 'react';
import { ExternalLink } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import dynamic from 'next/dynamic';
import { useT } from '@/hooks/useT';
import { useAuthUser } from '@/lib/auth-store';
import { fillPlatformParams, PLATFORM_ROUTES } from '@/lib/platform-routes';
import type { PlatformRouteDefinition } from '@/lib/platform-types';
import { titleFor } from './PlatformRouteHelpers';
import { PlatformState } from './PlatformState';

const LoginForm = dynamic(() => import('@/components/AuthPanel').then(module => module.LoginForm),
  { loading: () => <PlatformState kind="loading" /> });
const AccountPanel = dynamic(() => import('@/components/AuthPanel').then(module => module.AccountPanel),
  { loading: () => <PlatformState kind="loading" /> });

export function PlatformAboutView() {
  const t = useT();
  return (
    <div className="platform-static-view">
      <section>
        <h2>{t('在魔方根学习', 'Learn with CubeRoot')}</h2>
        <p>{t('从入门复原到进阶竞速，课程、学习记录和订单都与魔方根账号同步。', 'From your first solve to advanced speedcubing, courses, learning records and orders stay connected to your CubeRoot account.')}</p>
      </section>
      <section>
        <h2>{t('练习、交流与教学', 'Practice, community and teaching')}</h2>
        <p>{t('使用计时器和公式库练习，在社区交流经验，或通过讲师与机构工作台开展教学。', 'Practise with the timer and algorithm library, share experience in the community, or teach through instructor and organization workspaces.')}</p>
      </section>
      <div className="platform-write-actions">
        <AppLink className="platform-button platform-button-primary" href="/platform/courses">{t('浏览课程', 'Browse courses')}</AppLink>
        <AppLink className="platform-button" href="/platform/account/courses">{t('我的学习', 'My learning')}</AppLink>
      </div>
    </div>
  );
}

export function PlatformOfflineView() {
  const t = useT();
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  return (
    <div className="platform-static-view">
      <section>
        <h2>{online === null ? t('正在检测连接', 'Checking connection') : online ? t('当前已联网', 'You are online') : t('当前处于离线状态', 'You are offline')}</h2>
        <p>{t('课程目录、订单、学习进度和后台操作需要实时连接。已经由浏览器缓存的主站工具可能仍可打开，但离线期间不会伪造同步成功。', 'Course catalogs, orders, progress, and administration require a live connection. Main-site tools already cached by the browser may still open, but no synchronization is presented as successful while offline.')}</p>
      </section>
      <div className="platform-write-actions">
        <button type="button" className="platform-button platform-button-primary" onClick={() => window.location.reload()}>{t('重新连接', 'Reconnect')}</button>
        <AppLink className="platform-button" href="/timer">{t('打开计时器', 'Open timer')}</AppLink>
        <AppLink className="platform-button" href="/alg">{t('打开公式库', 'Open algorithms')}</AppLink>
      </div>
    </div>
  );
}

export function PlatformAccountView({ loginOnly }: { loginOnly: boolean }) {
  const user = useAuthUser();
  const t = useT();
  if (!user || loginOnly) {
    return (
      <div className="platform-auth-view">
        <p>{t('使用现有魔方根账号即可学习，无需重复注册。', 'Use your existing CubeRoot account to start learning.')}</p>
        <LoginForm onDone={() => window.location.reload()} />
      </div>
    );
  }
  return <AccountPanel />;
}

export function PlatformCanonicalView({
  definition,
  params,
}: {
  definition: PlatformRouteDefinition;
  params: Record<string, string>;
}) {
  const t = useT();
  const href = fillPlatformParams(definition.canonicalHref ?? '/', params);
  const related = PLATFORM_ROUTES
    .filter((item) => item.area === definition.area && item.id !== definition.id)
    .filter((item) => !item.pattern.includes(':'))
    .slice(0, 4);
  return (
    <div className="platform-canonical">
      <div className="platform-canonical-status">
        <strong>{t('共享主站能力', 'Shared main-site capability')}</strong>
        <p>{t('账号、数据和权限均为同一套；此页提供 Platform 上下文，具体交互使用主站的唯一实现。', 'Account, data, and permissions are shared. This page provides Platform context while the interaction uses the main site’s single implementation.')}</p>
      </div>
      <AppLink href={href} className="platform-button platform-button-primary" prefetch={false}>
        {t(definition.canonicalLabel?.zh ?? '打开功能', definition.canonicalLabel?.en ?? 'Open feature')}
        <ExternalLink aria-hidden />
      </AppLink>
      {related.length ? (
        <section className="platform-related">
          <h2>{t('同一区域', 'In this area')}</h2>
          <div>
            {related.map((item) => (
              <AppLink key={item.id} href={`/platform${item.pattern ? `/${item.pattern}` : ''}`} prefetch={false}>
                {titleFor(t, item)}
              </AppLink>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
