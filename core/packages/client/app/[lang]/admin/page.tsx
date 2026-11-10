'use client';

import MoreToggle from '@/components/MoreToggle';
import { useEffect, useState, type ComponentType } from 'react';
import { useEntryRouter as useRouter } from '@/hooks/useEntryRouter';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import { BadgeCheck, BellRing, BookOpen, Clapperboard, Compass, Gift, GraduationCap, Grid3X3, HardDrive, HeartHandshake, History, Images, Inbox, Layers, Library, ListChecks, MessageSquare, Music, Pin, Presentation, ScanSearch, ShieldCheck, ShoppingBag, Users, Wrench } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { loginHref, useAuthStore, useIsAdmin } from '@/lib/auth-store';
import BootDiagnostics from './BootDiagnostics';
import Dashboard from './Dashboard';
import UsersManagement from './users/UsersManagement';
import DiskManagement from './disk/DiskManagement';
import WorkResources from './WorkResources';
import AssistantMonitoring from './AssistantMonitoring';
import { ADMIN_SECTIONS, ADMIN_SECTION_LABELS, DESTINATION_SECTIONS, SYSTEM_DESTINATION_VIEWS, SYSTEM_VIEWS, SYSTEM_VIEW_LABELS } from './sections';
import './admin.css';

interface AdminDestination {
  href: string;
  Icon: ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;
  title: [string, string];
}

// Order snapshot: product analytics, 28 days / public audience, read 2026-11-09 (Pacific).
// Rank by sessions for the managed public feature; use exact page sessions for standalone pages.
// Content leaders: alg 1868, recon 609, sim 227; commerce: platform 6, org 3, teachers 1.
// Unmeasured admin-only destinations retain their relative order after measured entries.
const DESTINATIONS: AdminDestination[] = [
  { href: '/admin/careers', Icon: Users, title: ['招聘申请', 'Career applications'] },
  { href: '/admin/interview', Icon: MessageSquare, title: ['采访准备', 'Interview preparation'] },
  { href: '/admin/disk', Icon: HardDrive, title: ['磁盘空间', 'Disk space'] },
  { href: '/admin/users', Icon: Users, title: ['用户、增长与权限', 'Users, growth, and access'] },
  { href: '/admin/releases', Icon: Wrench, title: ['应用版本管理', 'App releases'] },
  { href: '/platform/admin', Icon: ShoppingBag, title: ['课程与商城后台', 'Courses and commerce'] },
  { href: '/org#enterprise-admin', Icon: BadgeCheck, title: ['企业认证与收款设置', 'Enterprise verification and payments'] },
  { href: '/support', Icon: HeartHandshake, title: ['赞助管理', 'Sponsorships'] },
  { href: '/alg', Icon: Library, title: ['公式库管理', 'Algorithm library'] },
  { href: '/recon', Icon: Clapperboard, title: ['精选复盘管理', 'Featured reconstructions'] },
  { href: '/sim', Icon: Layers, title: ['模拟器遮罩管理', 'Simulator masks'] },
  { href: '/dev/ops', Icon: Wrench, title: ['运维工具', 'Operations'] },
  { href: '/music/manage', Icon: Music, title: ['音乐审核与管理', 'Music review and management'] },
  { href: '/quiz/manage', Icon: ListChecks, title: ['社区题管理', 'Community questions'] },
  { href: '/site', Icon: Compass, title: ['网站导航管理', 'Site directory'] },
  { href: '/about/ruimin', Icon: Images, title: ['创作者作品管理', 'Creator gallery'] },
  { href: '/membership', Icon: Users, title: ['会员方案与权益', 'Membership plans and benefits'] },
  { href: '/forum/review', Icon: ShieldCheck, title: ['论坛审核', 'Forum moderation'] },
  { href: '/wiki', Icon: BookOpen, title: ['词条管理', 'Wiki entries'] },
  { href: '/feedback/admin', Icon: MessageSquare, title: ['反馈处理', 'Feedback'] },
  { href: '/regulation/post', Icon: Pin, title: ['公告首页置顶', 'Featured announcements'] },
  { href: '/scramble/pattern/search', Icon: Grid3X3, title: ['图案示例管理', 'Pattern examples'] },
  { href: '/account?view=submissions', Icon: Inbox, title: ['公式投稿', 'Algorithm submissions'] },
  { href: '/teachers', Icon: GraduationCap, title: ['教师资料管理', 'Teacher profiles'] },
  { href: '/recon/ground-truth', Icon: ScanSearch, title: ['复盘回归样本', 'Reconstruction samples'] },
  { href: '/wca/result-watch', Icon: History, title: ['成绩变更', 'Result changes'] },
  { href: '/platform/admin/invites', Icon: Gift, title: ['课程兑换码', 'Course redemption codes'] },
  { href: '/docs', Icon: Wrench, title: ['协作文档', 'Collaborative Docs'] },
  { href: '/courses', Icon: Presentation, title: ['教学课程内容', 'Teaching course content'] },
  { href: '/account', Icon: BellRing, title: ['页面通知与公式校验', 'Page notices and algorithm validation'] },
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

  if (section === 'system' && view === 'workspace') return <WorkResources />;
  if (section === 'users') return <UsersManagement />;
  if (section === 'system' && view === 'tools') return <DiskManagement />;

  return (
    <main className="admin-hub admin-hub--dashboard">
      <header className="admin-hub__heading">
        <h1>{section === 'system' ? t(...SYSTEM_VIEW_LABELS[view]) : t(...ADMIN_SECTION_LABELS[section])}</h1>
      </header>
      {section === 'overview' && <Dashboard />}
      {section !== 'overview' && (section !== 'system' || view === 'tools' || view === 'workspace') && <nav className="admin-hub__nav" aria-label={t('管理工具', 'Administration tools')}>
        {DESTINATIONS.filter(({ href }) => DESTINATION_SECTIONS[href] === section && (section !== 'system' || SYSTEM_DESTINATION_VIEWS[href] === view)).map(({ href, Icon, title }) => (
          <AppLink key={href} href={href} prefetch={false} className="admin-hub__link">
            <Icon size={20} aria-hidden />
            <span className="admin-hub__destination-label">
              <strong>{t(title[0], title[1])}</strong>
              <small dir="ltr">{href.split(/[?#]/)[0]}</small>
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
          <MoreToggle as="summary">{t('报税教程（待补充）', 'Tax filing guide (coming soon)')}</MoreToggle>
          {/* Add the verified filing steps here once the actual workflow is documented. */}
        </details>
      </section>
      }
    </main>
  );
}
