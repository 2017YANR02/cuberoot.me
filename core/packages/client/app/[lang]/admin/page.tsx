'use client';

import { useEffect, useState, type ComponentType } from 'react';
import { useRouter } from 'next/navigation';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import { Gift, HardDrive, HeartHandshake, Inbox, MessageSquare, ShieldCheck, Users, Wrench } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { loginHref, useAuthStore, useIsAdmin } from '@/lib/auth-store';
import BootDiagnostics from './BootDiagnostics';
import Dashboard from './Dashboard';
import AssistantMonitoring from './AssistantMonitoring';
import { ADMIN_SECTIONS, ADMIN_SECTION_LABELS, DESTINATION_SECTIONS, SYSTEM_DESTINATION_VIEWS, SYSTEM_VIEWS, SYSTEM_VIEW_LABELS } from './sections';
import './admin.css';

interface AdminDestination {
  href: string;
  Icon: ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;
  title: [string, string];
}

const DESTINATIONS: AdminDestination[] = [
  { href: '/admin/careers', Icon: Users, title: ['招聘申请', 'Career applications'] },
  { href: '/admin/interview', Icon: MessageSquare, title: ['采访准备', 'Interview preparation'] },
  { href: '/admin/disk', Icon: HardDrive, title: ['磁盘空间', 'Disk space'] },
  { href: '/admin/users', Icon: Users, title: ['用户、增长与权限', 'Users, growth, and access'] },
  { href: '/admin/releases', Icon: Wrench, title: ['应用版本管理', 'App releases'] },
  { href: '/platform/admin', Icon: Wrench, title: ['课程与商城后台', 'Courses and commerce'] },
  { href: '/platform/admin/invites', Icon: Gift, title: ['课程兑换码', 'Course redemption codes'] },
  { href: '/support', Icon: HeartHandshake, title: ['赞助管理', 'Sponsorships'] },
  { href: '/feedback/admin', Icon: MessageSquare, title: ['反馈处理', 'Feedback'] },
  { href: '/forum/review', Icon: ShieldCheck, title: ['论坛审核', 'Forum moderation'] },
  { href: '/account?view=submissions', Icon: Inbox, title: ['公式投稿', 'Algorithm submissions'] },
  { href: '/dev/ops', Icon: Wrench, title: ['运维工具', 'Operations'] },
  { href: '/quiz/manage', Icon: ShieldCheck, title: ['社区题管理', 'Community questions'] },
  { href: '/music/manage', Icon: ShieldCheck, title: ['音乐审核与管理', 'Music review and management'] },
  { href: '/recon/ground-truth', Icon: ShieldCheck, title: ['复盘回归样本', 'Reconstruction samples'] },
  { href: '/wca/result-watch', Icon: ShieldCheck, title: ['成绩变更', 'Result changes'] },
  { href: '/membership', Icon: Users, title: ['会员方案与权益', 'Membership plans and benefits'] },
  { href: '/site', Icon: Wrench, title: ['网站导航管理', 'Site directory'] },
  { href: '/scramble/pattern/search', Icon: Wrench, title: ['图案示例管理', 'Pattern examples'] },
  { href: '/sim', Icon: Wrench, title: ['模拟器遮罩管理', 'Simulator masks'] },
  { href: '/alg', Icon: Wrench, title: ['公式库管理', 'Algorithm library'] },
  { href: '/account', Icon: Wrench, title: ['页面通知与公式校验', 'Page notices and algorithm validation'] },
  { href: '/recon', Icon: Wrench, title: ['精选复盘管理', 'Featured reconstructions'] },
  { href: '/teachers', Icon: Users, title: ['教师资料管理', 'Teacher profiles'] },
  { href: '/wiki', Icon: Wrench, title: ['词条管理', 'Wiki entries'] },
  { href: '/about/ruimin', Icon: Wrench, title: ['创作者作品管理', 'Creator gallery'] },
  { href: '/org#enterprise-admin', Icon: Wrench, title: ['企业认证与收款设置', 'Enterprise verification and payments'] },
  { href: '/docs', Icon: Wrench, title: ['文档管理', 'Documents'] },
  { href: '/sheets', Icon: Wrench, title: ['表格管理', 'Spreadsheets'] },
  { href: '/courses', Icon: Wrench, title: ['教学课程内容', 'Teaching course content'] },
  { href: '/regulation/post', Icon: Wrench, title: ['公告首页置顶', 'Featured announcements'] },
];

export default function AdminPage() {
  const t = useT();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isAdmin = useIsAdmin();
  const [mounted, setMounted] = useState(false);
  const [section] = useQueryState('section', parseAsStringEnum([...ADMIN_SECTIONS]).withDefault('overview'));
  const [view] = useQueryState('view', parseAsStringEnum([...SYSTEM_VIEWS]).withDefault('tools'));
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (mounted && !user) router.replace(loginHref());
  }, [mounted, user, router]);

  if (!mounted || !user) return <main className="admin-hub" />;
  if (!isAdmin) {
    return (
      <main className="admin-hub">
        <h1>{t('管理后台', 'Administration')}</h1>
        <p className="admin-hub__status">{t('只有管理员可以进入此页面。', 'Only administrators can access this page.')}</p>
        <AppLink className="admin-hub__account-link" href="/account" prefetch={false}>{t('前往账号页', 'Go to account')}</AppLink>
      </main>
    );
  }

  return (
    <main className="admin-hub admin-hub--dashboard">
      <header className="admin-hub__heading">
        <h1>{section === 'system' ? t(...SYSTEM_VIEW_LABELS[view]) : t(...ADMIN_SECTION_LABELS[section])}</h1>
        {section === 'overview' && <p>{t('查看用户增长、访问量、收入和待处理事项。', 'Review user growth, traffic, revenue and pending work.')}</p>}
        {section === 'system' && view === 'monitoring' && <p>{t('查看助手状态和应用启动诊断。', 'Review assistant status and app startup diagnostics.')}</p>}
        {section === 'system' && view === 'tax' && <p>{t('访问官方办税服务。', 'Open official tax services.')}</p>}
      </header>
      {section === 'overview' && <Dashboard />}
      {section !== 'overview' && (section !== 'system' || view === 'tools' || view === 'workspace') && <nav className="admin-hub__nav" aria-label={t('管理工具', 'Administration tools')}>
        {DESTINATIONS.filter(({ href }) => DESTINATION_SECTIONS[href] === section && (section !== 'system' || SYSTEM_DESTINATION_VIEWS[href] === view)).map(({ href, Icon, title }) => (
          <AppLink key={href} href={href} prefetch={false} className="admin-hub__link">
            <Icon size={20} aria-hidden />
            <span>
              <strong>{t(title[0], title[1])}</strong>
            </span>
          </AppLink>
        ))}
      </nav>}
      {section === 'system' && view === 'monitoring' && <><AssistantMonitoring /><BootDiagnostics /></>}
      {section === 'system' && view === 'tax' && <section aria-labelledby="admin-tax-title">
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
      }
    </main>
  );
}
