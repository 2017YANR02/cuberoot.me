/** Navigation and destination groups shared by the admin shell and overview. */
export const ADMIN_SECTIONS = ['overview', 'users', 'content', 'commerce', 'system'] as const;
export type AdminSection = typeof ADMIN_SECTIONS[number];
export const SYSTEM_VIEWS = ['tools', 'workspace', 'monitoring', 'tax'] as const;
export type SystemView = typeof SYSTEM_VIEWS[number];
export const SYSTEM_VIEW_LABELS: Record<SystemView, [string, string]> = {
  tools: ['系统工具', 'System tools'],
  workspace: ['工作资料', 'Work resources'],
  monitoring: ['助手与诊断', 'Assistant and diagnostics'],
  tax: ['税务办理', 'Tax filing'],
};
export const SYSTEM_DESTINATION_VIEWS: Record<string, SystemView> = {
  '/admin/disk': 'tools', '/admin/releases': 'tools', '/dev/ops': 'tools',
  '/admin/careers': 'workspace', '/admin/interview': 'workspace', '/docs': 'workspace', '/sheets': 'workspace',
};

export const ADMIN_SECTION_LABELS: Record<AdminSection, [string, string]> = {
  overview: ['总览', 'Overview'],
  users: ['用户与会员', 'Users and memberships'],
  content: ['内容与社区', 'Content and community'],
  commerce: ['课程与商业', 'Courses and commerce'],
  system: ['运营与系统', 'Operations and system'],
};

export const DESTINATION_SECTIONS: Record<string, Exclude<AdminSection, 'overview'>> = {
  '/admin/careers': 'system', '/admin/interview': 'system', '/admin/disk': 'system', '/admin/users': 'users',
  '/admin/releases': 'system', '/platform/admin': 'commerce', '/platform/admin/invites': 'commerce',
  '/support': 'users', '/feedback/admin': 'content', '/forum/review': 'content',
  '/account?view=submissions': 'content', '/dev/ops': 'system', '/quiz/manage': 'content',
  '/music/manage': 'content', '/recon/ground-truth': 'content', '/wca/result-watch': 'content',
  '/membership': 'users', '/site': 'content', '/scramble/pattern/search': 'content',
  '/sim': 'content', '/alg': 'content', '/account': 'content', '/recon': 'content',
  '/teachers': 'commerce', '/wiki': 'content', '/about/ruimin': 'content',
  '/org#enterprise-admin': 'commerce', '/docs': 'system', '/sheets': 'system',
  '/courses': 'commerce', '/regulation/post': 'content',
};

export function adminSectionForPath(pathname: string, section: string | null): AdminSection {
  const path = pathname.replace(/^\/zh(?=\/|$)/, '').replace(/\/$/, '');
  if (path === '/admin/users' || path.startsWith('/admin/users/')) return 'users';
  if (path !== '/admin') return 'system';
  return ADMIN_SECTIONS.find(value => value === section) ?? 'overview';
}
