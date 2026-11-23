'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Building2, CalendarDays, ExternalLink, UsersRound } from '@app-foundation/icons/lucide';
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
        <h2>{t('练习与活动', 'Practice and events')}</h2>
        <p>{t('使用计时器和公式库练习，参加平台发布的比赛和活动。', 'Practise with the timer and algorithm library, and take part in competitions and events.')}</p>
      </section>
      <div className="platform-write-actions">
        <AppLink className="platform-button platform-button-primary" href="/platform/courses">{t('浏览课程', 'Browse courses')}</AppLink>
        <AppLink className="platform-button" href="/platform/account/courses">{t('我的学习', 'My learning')}</AppLink>
      </div>
    </div>
  );
}

export function PlatformOrganizationAdmission() {
  const t = useT();
  const benefits = [
    { icon: Building2, title: t('机构与校区', 'Schools and campuses'), text: t('统一管理机构、校区和成员权限。', 'Manage your organization, campuses and member permissions.') },
    { icon: UsersRound, title: t('学员与班级', 'Learners and classes'), text: t('管理学员、班级和家长责任关系。', 'Manage learners, classes and guardian relationships.') },
    { icon: CalendarDays, title: t('课包与排课', 'Packages and scheduling'), text: t('安排课次、管理课时权益和请假。', 'Schedule lessons, manage lesson credits and leave.') },
    { icon: BookOpen, title: t('训练与教学反馈', 'Training and feedback'), text: t('发布训练任务、教学周报及课后反馈。', 'Publish training assignments, weekly reports and lesson feedback.') },
  ];
  return <div className="platform-admission-intro">
    <section className="platform-admission-hero" data-site-surface="panel">
      <div className="platform-admission-hero-copy"><h2>{t('让魔方教学更有条理', 'Make cubing education easier to manage')}</h2><p>{t('为教学机构提供统一的学员、课包、排课和训练管理工具。', 'Manage learners, lesson packages, schedules and training in one teaching workspace.')}</p>
        <AppLink className="platform-button platform-button-primary platform-admission-start" href="/platform/org" prefetch={false}>{t('开始机构入驻', 'Get started')}</AppLink>
        <AppLink className="platform-home-secondary" href="/contact" prefetch={false}>{t('咨询机构合作', 'Contact us about partnerships')}</AppLink></div>
    </section>
    <section className="platform-admission-benefits"><h2>{t('机构教学能力', 'Teaching capabilities')}</h2><div className="platform-admission-benefit-grid">{benefits.map(({ icon: Icon, title, text }) => <article key={title} data-site-surface="panel"><span className="platform-admission-benefit-icon"><Icon size={24} aria-hidden /></span><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <section className="platform-admission-process"><h2>{t('入驻流程', 'Onboarding')}</h2><ol>{[[t('创建企业', 'Create an enterprise'), t('填写企业名称与基本资料。', 'Enter your organization details.')], [t('申请认证', 'Apply for verification'), t('提交企业认证资料并等待审核。', 'Submit verification details and await review.')], [t('开始使用', 'Start teaching'), t('认证后管理机构与教学业务。', 'Manage teaching after verification.')]].map(([title, detail], index) => <li key={title}><span className="platform-admission-step-number">{index + 1}</span><div><h3>{title}</h3><p>{detail}</p></div></li>)}</ol></section>
  </div>;
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
