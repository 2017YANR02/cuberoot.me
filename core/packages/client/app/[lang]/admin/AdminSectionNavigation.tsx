'use client';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
const sections = {
  operations: {
    title: ['运维', 'Operations'],
    tabs: [
      { id: 'disk', href: '/admin/disk', label: ['磁盘空间', 'Disk space'] },
      { id: 'releases', href: '/admin/releases', label: ['应用版本', 'App releases'] },
    ],
    link: { href: '/dev/ops', label: ['运维工具', 'Operations tools'] },
  },
  work: {
    title: ['工作资料', 'Work resources'],
    tabs: [
      { id: 'careers', href: '/admin?section=system&view=workspace', label: ['招聘申请', 'Career applications'] },
      { id: 'interview', href: '/admin?section=system&view=workspace&tab=interview', label: ['采访准备', 'Interview preparation'] },
    ],
    link: { href: '/docs', label: ['协作文档', 'Collaborative documents'] },
  },
} as const;
type Props = { group: 'operations'; active: 'disk' | 'releases' } | { group: 'work'; active: 'careers' | 'interview' };
export default function AdminSectionNavigation({ group, active }: Props) {
  const t = useT();
  const config = sections[group];
  return <><header className="admin-hub__heading"><h1>{t(config.title[0], config.title[1])}</h1></header>
    <div className="admin-section-toolbar"><nav className="admin-section-switch" aria-label={t(config.title[0], config.title[1])}>
      {config.tabs.map(tab => <AppLink key={tab.id} href={tab.href} prefetch={false} aria-current={active === tab.id ? 'page' : undefined}>{t(tab.label[0], tab.label[1])}</AppLink>)}
    </nav><AppLink href={config.link.href} prefetch={false}>{t(config.link.label[0], config.link.label[1])} ↗</AppLink></div></>;
}
