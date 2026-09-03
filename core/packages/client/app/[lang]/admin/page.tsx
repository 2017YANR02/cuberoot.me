'use client';

import { useEffect, useState, type ComponentType } from 'react';
import { Crown, HeartHandshake, Inbox, MessageSquare, ShieldCheck, Users, Wrench } from 'lucide-react';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { useIsAdmin } from '@/lib/auth-store';
import './admin.css';

interface AdminDestination {
  href: string;
  Icon: ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;
  title: [string, string];
  description: [string, string];
}

const DESTINATIONS: AdminDestination[] = [
  { href: '/admin/users', Icon: Users, title: ['用户、增长与权限', 'Users, growth, and access'], description: ['注册趋势、会员新增、账号资料与管理员权限', 'Registration trends, membership joins, account records, and administrator access'] },
  { href: '/membership', Icon: Crown, title: ['会员管理', 'Memberships'], description: ['个人和企业会员、套餐、订单与手动开通', 'Individual and enterprise members, plans, orders, and manual grants'] },
  { href: '/support', Icon: HeartHandshake, title: ['赞助管理', 'Sponsorships'], description: ['赞助记录、新增赞助与认领审核', 'Sponsorship records, new entries, and claim review'] },
  { href: '/feedback/admin', Icon: MessageSquare, title: ['反馈处理', 'Feedback'], description: ['查看、回复和跟进站内反馈', 'Review, reply to, and follow up on site feedback'] },
  { href: '/forum/review', Icon: ShieldCheck, title: ['论坛审核', 'Forum moderation'], description: ['处理待审核内容和社区举报', 'Review pending content and community reports'] },
  { href: '/account?view=submissions', Icon: Inbox, title: ['公式投稿', 'Algorithm submissions'], description: ['审核用户提交的公式与修改建议', 'Review user-submitted algorithms and edits'] },
  { href: '/dev/ops', Icon: Wrench, title: ['运维工具', 'Operations'], description: ['常用运维命令和管理员提示词', 'Operational commands and administrator prompts'] },
];

export default function AdminPage() {
  const t = useT();
  const isAdmin = useIsAdmin();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <main className="admin-hub" />;
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
    <main className="admin-hub">
      <header className="admin-hub__heading">
        <p className="admin-hub__eyebrow">{t('管理', 'Administration')}</p>
        <h1>{t('管理后台', 'Administration')}</h1>
        <p>{t('用户、收入和内容审核的统一入口。', 'One place for users, revenue, and content moderation.')}</p>
      </header>
      <nav className="admin-hub__nav" aria-label={t('管理工具', 'Administration tools')}>
        {DESTINATIONS.map(({ href, Icon, title, description }) => (
          <AppLink key={href} href={href} prefetch={false} className="admin-hub__link">
            <Icon size={20} aria-hidden />
            <span>
              <strong>{t(title[0], title[1])}</strong>
              <small>{t(description[0], description[1])}</small>
            </span>
          </AppLink>
        ))}
      </nav>
    </main>
  );
}
