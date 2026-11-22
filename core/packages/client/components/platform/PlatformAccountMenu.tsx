'use client';

import { useEffect, useRef } from 'react';
import AppLink from '@/components/AppLink';
import LangToggle from '@/components/LangToggle';
import MoreToggle from '@/components/MoreToggle';
import { useT } from '@/hooks/useT';
import { PLATFORM_PERSONAL_ROUTES } from '@/lib/platform-navigation';
import { SHOP_ROOT } from '@/lib/shop';

interface Props {
  name?: string;
  signedIn: boolean;
  admin: boolean;
  instructor: boolean;
  organization: boolean;
  organizer: boolean;
  supervisor: boolean;
  learner: boolean;
  applicationLabel: string;
  close: () => void;
}

export function PlatformAccountMenu({ name, signedIn, admin, instructor, organization, organizer, supervisor, learner, applicationLabel, close }: Props) {
  const t = useT();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => panel.current?.querySelector('a')?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, []);
  const link = (href: string, label: string) => <AppLink key={href} href={href} prefetch={false} onClick={close}>{label}</AppLink>;
  const workspaces = [
    (admin || instructor) && link('/platform/instructor', t('讲师工作台', 'Instructor workspace')),
    organization && link('/platform/org', t('机构工作台', 'Organization workspace')),
    organizer && link('/platform/events/online?view=manage', t('我管理的赛事', 'Competitions I manage')),
    supervisor && link('/platform/events/online?view=supervise', t('我的执场', 'My supervision assignments')),
  ].filter(Boolean);

  return <div className="platform-account-content" ref={panel}>
    {name && <strong className="platform-home-account-name">{name}</strong>}
    <div className="platform-account-primary">
      {admin && link('/platform/admin', t('平台管理', 'Platform admin'))}
      {signedIn ? link('/platform/account/courses', t('我的学习', 'My learning')) : link('/account', t('登录 / 注册', 'Sign in / register'))}
      {learner && link('/learn', t('学习档案', 'Learning records'))}
      {link('/platform/account/invites', t('兑换码', 'Redemption codes'))}
    </div>
    <div className="platform-account-sections">
      {workspaces.length === 1 ? workspaces : workspaces.length > 1 && <details name="platform-account-section">
        <MoreToggle as="summary">{t('我的工作台', 'My workspaces')}</MoreToggle>
        {workspaces}
      </details>}
      {admin && <details name="platform-account-section">
        <MoreToggle as="summary">{t('平台运营', 'Platform operations')}</MoreToggle>
        {link('/platform/community/review', t('社区审核', 'Community review'))}
        {link('/platform/org?view=admin', t('机构认证审核', 'Organization verification review'))}
        {link(SHOP_ROOT, t('商店', 'Shop'))}
      </details>}
      {signedIn && <details name="platform-account-section">
        <MoreToggle as="summary">{t('个人空间', 'Personal space')}</MoreToggle>
        {PLATFORM_PERSONAL_ROUTES.filter(item => !['account-courses', 'account-invites'].includes(item.id))
          .map(item => link(`/platform/${item.pattern}`, t(item.title.zh, item.title.en)))}
      </details>}
      {link('/platform/teachers/apply', applicationLabel)}
    </div>
    <div className="platform-account-preferences">
      {signedIn && link('/account', t('账号设置', 'Account settings'))}
      <LangToggle variant="row" showLabel />
    </div>
  </div>;
}
