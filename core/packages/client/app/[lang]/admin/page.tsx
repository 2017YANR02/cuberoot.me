'use client';

import { useEffect, useState, type ComponentType } from 'react';
import { useRouter } from 'next/navigation';
import { Gift, HardDrive, HeartHandshake, Inbox, MessageSquare, ShieldCheck, Users, Wrench } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { loginHref, useAuthStore, useIsAdmin } from '@/lib/auth-store';
import BootDiagnostics from './BootDiagnostics';
import Dashboard from './Dashboard';
import AssistantMonitoring from './AssistantMonitoring';
import './admin.css';

interface AdminDestination {
  href: string;
  Icon: ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;
  title: [string, string];
}

const DESTINATIONS: AdminDestination[] = [
  { href: '/admin/interview', Icon: MessageSquare, title: ['采访准备', 'Interview preparation'] },
  { href: '/admin/disk', Icon: HardDrive, title: ['磁盘空间', 'Disk space'] },
  { href: '/admin/users', Icon: Users, title: ['用户、增长与权限', 'Users, growth, and access'] },
  { href: '/platform/admin/invites', Icon: Gift, title: ['课程兑换码', 'Course redemption codes'] },
  { href: '/support', Icon: HeartHandshake, title: ['赞助管理', 'Sponsorships'] },
  { href: '/feedback/admin', Icon: MessageSquare, title: ['反馈处理', 'Feedback'] },
  { href: '/forum/review', Icon: ShieldCheck, title: ['论坛审核', 'Forum moderation'] },
  { href: '/account?view=submissions', Icon: Inbox, title: ['公式投稿', 'Algorithm submissions'] },
  { href: '/dev/ops', Icon: Wrench, title: ['运维工具', 'Operations'] },
];

export default function AdminPage() {
  const t = useT();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isAdmin = useIsAdmin();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (mounted && !user) router.replace(loginHref());
  }, [mounted, user, router]);

  if (!mounted || !user) return <main className="admin-hub" />;
  if (!isAdmin) {
    return (
      <main className="admin-hub">
        <p className="admin-hub__eyebrow">{t('管理', 'Administration')}</p>
        <h1>{t('管理后台', 'Administration')}</h1>
        <p className="admin-hub__status">{t('只有管理员可以进入此页面。', 'Only administrators can access this page.')}</p>
        <AppLink className="admin-hub__account-link" href="/account" prefetch={false}>{t('前往账号页', 'Go to account')}</AppLink>
      </main>
    );
  }

  return (
    <main className="admin-hub admin-hub--dashboard">
      <header className="admin-hub__heading">
        <p className="admin-hub__eyebrow">{t('管理', 'Administration')}</p>
        <h1>{t('管理后台', 'Administration')}</h1>
        <p>{t('集中查看用户增长、访问量、收入和待处理事项。', 'User growth, traffic, revenue and pending work in one place.')}</p>
      </header>
      <Dashboard />
      <AssistantMonitoring />
      <h2 className="admin-dashboard__tools-title">{t('管理工具', 'Management tools')}</h2>
      <nav className="admin-hub__nav" aria-label={t('管理工具', 'Administration tools')}>
        {DESTINATIONS.map(({ href, Icon, title }) => (
          <AppLink key={href} href={href} prefetch={false} className="admin-hub__link">
            <Icon size={20} aria-hidden />
            <span>
              <strong>{t(title[0], title[1])}</strong>
            </span>
          </AppLink>
        ))}
      </nav>
      <section aria-labelledby="admin-tax-title">
        <h2 id="admin-tax-title" className="admin-dashboard__tools-title">{t('税务办理', 'Tax filing')}</h2>
        <nav className="admin-hub__nav" aria-label={t('官方办税入口', 'Official tax portals')}>
          <a className="admin-hub__link" href="https://etax.shanghai.chinatax.gov.cn/" target="_blank" rel="noopener noreferrer">
            <ShieldCheck size={20} aria-hidden />
            <span>
              <strong>{t('上海市电子税务局', 'Shanghai Electronic Tax Bureau')}</strong>
              <small>{t('企业办税', 'Business tax services')}</small>
            </span>
          </a>
          <a className="admin-hub__link" href="https://etax.chinatax.gov.cn/" target="_blank" rel="noopener noreferrer">
            <Users size={20} aria-hidden />
            <span>
              <strong>{t('自然人电子税务局', 'Individual Electronic Tax Bureau')}</strong>
              <small>{t('个人所得税、企业代扣代缴', 'Individual income tax and employer withholding')}</small>
            </span>
          </a>
        </nav>
        <details className="admin-dashboard__table">
          <summary>{t('报税教程（待补充）', 'Tax filing guide (coming soon)')}</summary>
          {/* Add the verified filing steps here once the actual workflow is documented. */}
        </details>
      </section>
      <BootDiagnostics />
    </main>
  );
}
