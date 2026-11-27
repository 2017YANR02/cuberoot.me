/** Navigation and destination groups shared by the admin shell and overview. */
import { ListChecks, ShieldCheck, Video } from '@app-foundation/icons/lucide';
import { COMPETITION_WORKSPACES, competitionWorkspaceHref } from '@/lib/competition-links';
import { ADMIN_USERS_TITLE } from '@cuberoot/shared/page-catalog';

export const ADMIN_SECTIONS = ['overview', 'users', 'content', 'commerce', 'system'] as const;
export type AdminSection = typeof ADMIN_SECTIONS[number];
export const SYSTEM_VIEWS = ['tools', 'workspace', 'monitoring', 'tax'] as const;
export type SystemView = typeof SYSTEM_VIEWS[number];
export const SYSTEM_VIEW_LABELS: Record<SystemView, [string, string]> = {
  tools: ['运维', 'Operations'],
  workspace: ['工作资料', 'Work resources'],
  monitoring: ['AI 聊天', 'AI chat'],
  tax: ['税务', 'Tax'],
};
export const SYSTEM_DESTINATION_VIEWS: Record<string, SystemView> = {
  '/admin/disk': 'tools', '/admin/releases': 'tools', '/dev/ops': 'tools',
  '/admin/careers': 'workspace', '/admin/interview': 'workspace', '/docs': 'workspace',
};

export const ADMIN_SECTION_LABELS: Record<AdminSection, [string, string]> = {
  overview: ['总览', 'Overview'],
  users: [ADMIN_USERS_TITLE.zh, ADMIN_USERS_TITLE.en],
  content: ['内容 / 社区', 'Content / Community'],
  commerce: ['课程 / 商业', 'Courses / Commerce'],
  system: ['运营与系统', 'Operations and system'],
};

export const COMPETITION_ADMIN_DESTINATIONS = ([
  ['manage', ListChecks], ['review', ShieldCheck], ['supervise', Video],
] as const).map(([mode, Icon]) => {
  const { zh, en } = COMPETITION_WORKSPACES[mode].title;
  return { href: competitionWorkspaceHref(mode), Icon, title: [zh, en] as const };
});

export const DESTINATION_SECTIONS: Record<string, Exclude<AdminSection, 'overview'>> = {
  '/admin/careers': 'system', '/admin/interview': 'system', '/admin/disk': 'system', '/admin/users': 'users',
  '/admin/releases': 'system', '/platform/admin': 'commerce', '/platform/admin/invites': 'commerce',
  '/support': 'users', '/feedback/admin': 'content', '/forum/review': 'content',
  '/account?view=submissions': 'content', '/dev/ops': 'system', '/quiz/manage': 'content',
  '/music/manage': 'content', '/recon/ground-truth': 'content', '/wca/result-watch': 'content',
  '/membership': 'users', '/site': 'content', '/scramble/pattern/search': 'content',
  '/sim': 'content', '/alg': 'content', '/account': 'content', '/recon': 'content',
  '/teachers': 'commerce', '/wiki': 'content', '/ruimin-yan': 'content',
  '/org#enterprise-admin': 'commerce', '/docs': 'system',
  ...Object.fromEntries(COMPETITION_ADMIN_DESTINATIONS.map(({ href }) => [href, 'commerce' as const])),
  '/courses': 'commerce', '/regulation/post': 'content',
};

export function adminSectionForPath(pathname: string, section: string | null): AdminSection {
  const path = pathname.replace(/^\/zh(?=\/|$)/, '').replace(/\/$/, '');
  if (path === '/admin/users' || path.startsWith('/admin/users/')) return 'users';
  if (path !== '/admin') return 'system';
  return ADMIN_SECTIONS.find(value => value === section) ?? 'overview';
}
