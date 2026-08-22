import type {
  PlatformArea,
  PlatformRouteDefinition,
  PlatformRouteMatch,
} from './platform-types';

const text = (zh: string, en: string) => ({ zh, en } as const);
const PUBLIC = text('浏览可公开访问的内容与服务。', 'Browse content and services available to everyone.');
const ACCOUNT = text('查看并管理与你的账号关联的数据。', 'Review and manage data connected to your account.');
const INSTRUCTOR = text('面向讲师的课程、学员和结算工作区。', 'Workspace for instructor courses, learners, and payouts.');
const ADMIN = text('需要管理员权限的运营与审核工作区。', 'Operations and review workspace requiring administrator access.');
const CANONICAL = text('这项能力已由主站维护，Platform 保留入口并直接复用主站体验。', 'This capability is maintained by the main site; Platform keeps the entry and reuses that canonical experience.');

type RouteInput = Omit<PlatformRouteDefinition, 'description'> & { description?: PlatformRouteDefinition['description'] };

function route(input: RouteInput): PlatformRouteDefinition {
  const fallback = input.kind === 'canonical'
    ? CANONICAL
    : input.access === 'admin'
      ? ADMIN
      : input.access === 'instructor'
        ? INSTRUCTOR
        : input.access === 'account'
          ? ACCOUNT
          : PUBLIC;
  return { ...input, description: input.description ?? fallback };
}

const canonical = (
  id: string,
  pattern: string,
  area: PlatformArea,
  access: PlatformRouteDefinition['access'],
  title: PlatformRouteDefinition['title'],
  canonicalHref: string,
): PlatformRouteDefinition => route({
  id,
  pattern,
  area,
  access,
  kind: 'canonical',
  title,
  canonicalHref,
  canonicalLabel: text('打开主站功能', 'Open the main-site feature'),
});

/**
 * Platform 产品 surface 的唯一前端路由表。静态段优先于参数段，避免 `new` 被当作 id。
 * 旧独立前端的每一个页面都必须在这里有明确归属：Platform 原生资源或主站 canonical 深链。
 */
export const PLATFORM_ROUTES: readonly PlatformRouteDefinition[] = [
  route({ id: 'home', pattern: '', area: 'discover', access: 'public', kind: 'landing', title: text('Platform', 'Platform'), description: text('课程、学习、讲师服务和交易在主站中的统一入口。', 'The unified main-site entry for courses, learning, instructor services, and commerce.') }),
  route({ id: 'about', pattern: 'about', area: 'discover', access: 'public', kind: 'landing', title: text('关于 Platform', 'About Platform'), description: text('了解迁移后的产品边界、账号体系和服务入口。', 'Understand the migrated product boundary, account system, and service entry points.') }),
  route({ id: 'offline', pattern: 'offline', area: 'discover', access: 'public', kind: 'landing', title: text('离线说明', 'Offline access'), description: text('网络中断时仍可确认已缓存内容和重新连接方式。', 'Review cached-content and reconnection guidance while offline.') }),
  canonical('login', 'login', 'account', 'public', text('登录', 'Sign in'), '/account'),
  canonical('account', 'account', 'account', 'account', text('账号', 'Account'), '/account'),
  route({ id: 'membership', pattern: 'membership', area: 'commerce', access: 'public', kind: 'collection', title: text('课程权益套餐', 'Course entitlement plans'), resource: 'membership-plans', actions: ['create-order'], description: text('公开查看课程权益套餐；登录后可购买或续期。这里不复用主站的支持型会员。', 'Browse course-entitlement plans publicly, then sign in to purchase or renew. This is separate from the main-site supporter membership.') }),
  route({ id: 'me-membership', pattern: 'account/membership', area: 'account', access: 'account', kind: 'dashboard', title: text('我的课程会员', 'My course memberships'), resource: 'account-memberships', actions: ['create-order'], description: text('查看本人课程会员状态、有效期并续期。', 'Review your course membership status and validity, then renew it.') }),
  route({ id: 'notifications', pattern: 'notifications', area: 'account', access: 'account', kind: 'collection', title: text('消息', 'Notifications'), resource: 'notifications', canonicalHref: '/notifications', canonicalLabel: text('打开完整消息中心', 'Open the full notification center') }),
  canonical('timer', 'timer', 'learning', 'public', text('计时器', 'Timer'), '/timer'),
  canonical('algorithms', 'algorithms', 'learning', 'public', text('公式库', 'Algorithms'), '/alg'),
  route({ id: 'algorithm-detail', pattern: 'algorithms/:id', area: 'learning', access: 'public', kind: 'canonical', title: text('旧公式详情', 'Legacy algorithm details'), canonicalHref: '/alg', canonicalLabel: text('在主站公式库中查找', 'Find it in the main-site library'), description: text('旧 Platform 的公式 ID 来自自动播种的演示数据，未作为稳定产品标识迁移；请在主站公式库按公式或分类查找。', 'Legacy Platform algorithm IDs came from auto-seeded demo data and were not migrated as stable product identifiers. Find the algorithm by notation or category in the main-site library.') }),
  route({ id: 'courses', pattern: 'courses', area: 'learning', access: 'public', kind: 'collection', title: text('课程', 'Courses'), resource: 'courses' }),
  route({ id: 'course-detail', pattern: 'courses/:id', area: 'learning', access: 'public', kind: 'detail', title: text('课程详情', 'Course details'), resource: 'courses', actions: ['enroll', 'favorite', 'submit-review'] }),
  route({ id: 'course-lesson', pattern: 'courses/:id/learn/:lessonId', area: 'learning', access: 'account', kind: 'detail', title: text('课程学习', 'Course lesson'), resource: 'course-lesson', actions: ['update-progress', 'save-note', 'submit-quiz'] }),
  route({ id: 'teachers', pattern: 'teachers', area: 'discover', access: 'public', kind: 'collection', title: text('讲师', 'Teachers'), resource: 'teachers', canonicalHref: '/teachers', canonicalLabel: text('打开讲师名录', 'Open the teacher directory') }),
  route({ id: 'teacher-detail', pattern: 'teachers/:id', area: 'discover', access: 'public', kind: 'detail', title: text('讲师详情', 'Teacher details'), resource: 'teachers', canonicalHref: '/teachers', canonicalLabel: text('打开讲师名录', 'Open the teacher directory'), description: text('直接读取主站讲师名录；旧 Platform 自动播种的演示讲师未导入，找不到时请返回主站名录。', 'This reads the main-site teacher directory directly. Auto-seeded demo teachers from the legacy Platform were not imported; use the main-site directory when an entry is not found.') }),
  route({ id: 'teacher-apply', pattern: 'teachers/apply', area: 'instructor', access: 'account', kind: 'form', title: text('申请成为讲师', 'Apply as an instructor'), resource: 'instructor-application', actions: ['apply-instructor'], description: text('提交教学经历、擅长方向和联系方式，申请进度与主站账号绑定。', 'Submit teaching experience, specialties, and contact details; application status follows the main-site account.') }),
  route({ id: 'community', pattern: 'community', area: 'community', access: 'public', kind: 'collection', title: text('社区', 'Community'), resource: 'community', canonicalHref: '/forum', canonicalLabel: text('打开完整论坛', 'Open the full forum') }),
  route({ id: 'community-circle', pattern: 'community/circles/:id', area: 'community', access: 'public', kind: 'collection', title: text('圈子', 'Circle'), resource: 'community-circle', canonicalHref: '/forum/f/:id', canonicalLabel: text('打开完整圈子', 'Open the full circle') }),
  canonical('community-post-new', 'community/posts/new', 'community', 'account', text('发布帖子', 'Create post'), '/forum/new'),
  route({ id: 'community-post', pattern: 'community/posts/:id', area: 'community', access: 'public', kind: 'detail', title: text('帖子', 'Post'), resource: 'community-post', canonicalHref: '/forum/t/:id', canonicalLabel: text('参与完整讨论', 'Join the full discussion') }),

  route({ id: 'search', pattern: 'search', area: 'discover', access: 'public', kind: 'collection', title: text('Platform 搜索', 'Platform search'), resource: 'search' }),
  route({ id: 'leaderboard', pattern: 'leaderboard', area: 'community', access: 'public', kind: 'collection', title: text('排行榜', 'Leaderboard'), resource: 'leaderboard' }),
  route({ id: 'paths', pattern: 'paths', area: 'learning', access: 'public', kind: 'collection', title: text('学习路径', 'Learning paths'), resource: 'paths' }),
  route({ id: 'path-detail', pattern: 'paths/:id', area: 'learning', access: 'public', kind: 'detail', title: text('学习路径详情', 'Learning path details'), resource: 'paths' }),
  route({ id: 'events', pattern: 'events', area: 'discover', access: 'public', kind: 'collection', title: text('活动', 'Events'), resource: 'events' }),
  route({ id: 'event-detail', pattern: 'events/:id', area: 'discover', access: 'public', kind: 'detail', title: text('活动详情', 'Event details'), resource: 'events', actions: ['create-order', 'favorite'] }),
  route({ id: 'news', pattern: 'news', area: 'discover', access: 'public', kind: 'collection', title: text('资讯', 'News'), resource: 'news' }),
  route({ id: 'news-detail', pattern: 'news/:id', area: 'discover', access: 'public', kind: 'detail', title: text('资讯详情', 'News details'), resource: 'news' }),
  route({ id: 'shop', pattern: 'shop', area: 'commerce', access: 'public', kind: 'collection', title: text('商店', 'Shop'), resource: 'products', actions: ['create-order', 'wishlist'] }),
  route({ id: 'product-detail', pattern: 'shop/:id', area: 'commerce', access: 'public', kind: 'detail', title: text('商品详情', 'Product details'), resource: 'products', actions: ['create-order', 'wishlist'] }),
  route({ id: 'orders', pattern: 'orders', area: 'commerce', access: 'account', kind: 'collection', title: text('订单', 'Orders'), resource: 'orders' }),
  route({ id: 'order-detail', pattern: 'orders/:id', area: 'commerce', access: 'account', kind: 'detail', title: text('订单详情', 'Order details'), resource: 'orders', actions: ['start-payment', 'cancel-order'] }),
  route({ id: 'progress', pattern: 'progress', area: 'learning', access: 'account', kind: 'dashboard', title: text('学习进度', 'Learning progress'), resource: 'account-progress', actions: ['update-progress', 'check-in'] }),
  route({ id: 'account-courses', pattern: 'account/courses', area: 'account', access: 'account', kind: 'collection', title: text('我的课程', 'My courses'), resource: 'account-courses' }),
  route({ id: 'account-badges', pattern: 'account/badges', area: 'account', access: 'account', kind: 'collection', title: text('我的徽章', 'My badges'), resource: 'account-badges' }),
  route({ id: 'account-favorites', pattern: 'account/favorites', area: 'account', access: 'account', kind: 'collection', title: text('我的收藏', 'My favorites'), resource: 'account-favorites', actions: ['favorite'] }),
  route({ id: 'account-notes', pattern: 'account/notes', area: 'account', access: 'account', kind: 'collection', title: text('我的笔记', 'My notes'), resource: 'account-notes', actions: ['save-note', 'delete-note'] }),
  route({ id: 'account-wishlist', pattern: 'account/wishlist', area: 'account', access: 'account', kind: 'collection', title: text('心愿单', 'Wishlist'), resource: 'account-wishlist', actions: ['wishlist'] }),
  route({ id: 'account-invites', pattern: 'account/invites', area: 'account', access: 'account', kind: 'collection', title: text('邀请', 'Invitations'), resource: 'account-invites', actions: ['redeem-invite'] }),
  route({ id: 'account-privacy', pattern: 'account/privacy', area: 'account', access: 'account', kind: 'form', title: text('隐私设置', 'Privacy settings'), resource: 'account-privacy', actions: ['save-privacy-consent'], description: text('管理可选的 Platform 产品分析授权；未明确授权时不会记录分析事件。', 'Manage optional Platform product analytics consent; analytics events are not recorded without explicit consent.') }),
  route({ id: 'account-shipping', pattern: 'account/shipping', area: 'account', access: 'account', kind: 'collection', title: text('收货地址', 'Shipping addresses'), resource: 'shipping-addresses', actions: ['save-shipping-address', 'delete-shipping-address'], description: text('管理实物商品订单使用的收货地址。', 'Manage shipping addresses used by physical-product orders.') }),

  route({ id: 'instructor', pattern: 'instructor', area: 'instructor', access: 'instructor', kind: 'dashboard', title: text('讲师工作台', 'Instructor workspace'), resource: 'instructor-courses' }),
  route({ id: 'instructor-courses', pattern: 'instructor/courses', area: 'instructor', access: 'instructor', kind: 'collection', title: text('讲师课程', 'Instructor courses'), resource: 'instructor-courses', actions: ['save-instructor-course', 'delete-course'] }),
  route({ id: 'instructor-course', pattern: 'instructor/courses/:id', area: 'instructor', access: 'instructor', kind: 'detail', title: text('管理课程', 'Manage course'), resource: 'instructor-courses', actions: ['save-instructor-course', 'delete-course', 'save-course-lesson', 'delete-course-lesson', 'save-course-quiz', 'delete-course-quiz'] }),
  route({ id: 'instructor-students', pattern: 'instructor/students', area: 'instructor', access: 'instructor', kind: 'collection', title: text('学员', 'Learners'), resource: 'instructor-students', actions: ['issue-certificate'] }),
  route({ id: 'instructor-earnings', pattern: 'instructor/earnings', area: 'instructor', access: 'instructor', kind: 'dashboard', title: text('讲师收入', 'Instructor earnings'), resource: 'instructor-earnings' }),

  route({ id: 'certificate', pattern: 'cert/:code', area: 'learning', access: 'public', kind: 'detail', title: text('证书验证', 'Certificate verification'), resource: 'certificate' }),
  route({ id: 'qr', pattern: 'qr/:code', area: 'discover', access: 'public', kind: 'detail', title: text('二维码入口', 'QR entry'), resource: 'qr' }),

  canonical('org', 'org', 'organization', 'account', text('教学机构', 'Teaching organizations'), '/org'),
  canonical('org-home', 'org/:orgSlug', 'organization', 'account', text('机构工作台', 'Organization workspace'), '/org/:orgSlug'),
  canonical('org-campuses', 'org/:orgSlug/campuses', 'organization', 'account', text('校区', 'Campuses'), '/org/:orgSlug/campuses'),
  canonical('org-classes', 'org/:orgSlug/classes', 'organization', 'account', text('班级', 'Classes'), '/org/:orgSlug/classes'),
  canonical('org-class', 'org/:orgSlug/classes/:groupId', 'organization', 'account', text('班级详情', 'Class details'), '/org/:orgSlug/classes/:groupId'),
  canonical('org-members', 'org/:orgSlug/members', 'organization', 'account', text('成员', 'Members'), '/org/:orgSlug/members'),
  canonical('org-packages', 'org/:orgSlug/packages', 'organization', 'account', text('课包', 'Packages'), '/org/:orgSlug/packages'),
  canonical('org-schedule', 'org/:orgSlug/schedule', 'organization', 'account', text('排课', 'Schedule'), '/org/:orgSlug/sessions'),
  canonical('org-session', 'org/:orgSlug/sessions/:sessionId', 'organization', 'account', text('课次详情', 'Session details'), '/org/:orgSlug/sessions/:sessionId'),
  canonical('org-students', 'org/:orgSlug/students', 'organization', 'account', text('学员管理', 'Student management'), '/org/:orgSlug/students'),
  canonical('org-student-credits', 'org/:orgSlug/students/:studentId/credits', 'organization', 'account', text('学员课时', 'Student credits'), '/org/:orgSlug/students/:studentId/packages'),
  canonical('org-student-responsibilities', 'org/:orgSlug/students/:studentId/responsibilities', 'organization', 'account', text('学员责任关系', 'Student responsibilities'), '/org/:orgSlug/students/:studentId'),

  route({ id: 'admin', pattern: 'admin', area: 'admin', access: 'admin', kind: 'dashboard', title: text('Platform 管理', 'Platform administration'), resource: 'admin-analytics' }),
  canonical('admin-algorithms', 'admin/algorithms', 'admin', 'admin', text('公式内容管理', 'Algorithm content'), '/alg'),
  canonical('admin-algorithm-new', 'admin/algorithms/new', 'admin', 'admin', text('新建公式内容', 'Create algorithm content'), '/alg'),
  canonical('admin-algorithm-detail', 'admin/algorithms/:id', 'admin', 'admin', text('编辑公式内容', 'Edit algorithm content'), '/alg'),
  route({ id: 'admin-application', pattern: 'admin/teacher-applications/:id', area: 'admin', access: 'admin', kind: 'detail', title: text('讲师申请审核', 'Instructor application review'), resource: 'admin-applications', actions: ['admin-review'] }),
  route({ id: 'admin-applications', pattern: 'admin/teacher-applications', area: 'admin', access: 'admin', kind: 'collection', title: text('讲师申请', 'Instructor applications'), resource: 'admin-applications' }),
  route({ id: 'admin-coupons', pattern: 'admin/coupons', area: 'admin', access: 'admin', kind: 'collection', title: text('优惠券', 'Coupons'), resource: 'admin-coupons', actions: ['admin-save', 'admin-delete'] }),
  route({ id: 'admin-course-new', pattern: 'admin/courses/new', area: 'admin', access: 'admin', kind: 'form', title: text('新建课程', 'New course'), resource: 'admin-courses', actions: ['admin-save'] }),
  route({ id: 'admin-course', pattern: 'admin/courses/:id', area: 'admin', access: 'admin', kind: 'detail', title: text('编辑课程', 'Edit course'), resource: 'admin-courses', actions: ['admin-save', 'delete-course', 'save-course-lesson', 'delete-course-lesson', 'save-course-quiz', 'delete-course-quiz'] }),
  route({ id: 'admin-courses', pattern: 'admin/courses', area: 'admin', access: 'admin', kind: 'collection', title: text('课程管理', 'Course management'), resource: 'admin-courses', actions: ['delete-course'] }),
  route({ id: 'admin-paths', pattern: 'admin/paths', area: 'admin', access: 'admin', kind: 'collection', title: text('学习路径管理', 'Learning path management'), resource: 'admin-paths', actions: ['admin-save'] }),
  route({ id: 'admin-event-new', pattern: 'admin/events/new', area: 'admin', access: 'admin', kind: 'form', title: text('新建活动', 'New event'), resource: 'admin-events', actions: ['admin-save'] }),
  route({ id: 'admin-event', pattern: 'admin/events/:id', area: 'admin', access: 'admin', kind: 'detail', title: text('编辑活动', 'Edit event'), resource: 'admin-events', actions: ['admin-save'] }),
  route({ id: 'admin-events', pattern: 'admin/events', area: 'admin', access: 'admin', kind: 'collection', title: text('活动管理', 'Event management'), resource: 'admin-events' }),
  route({ id: 'admin-event-analytics', pattern: 'admin/analytics', area: 'admin', access: 'admin', kind: 'dashboard', title: text('活动追踪', 'Event analytics'), resource: 'admin-analytics' }),
  route({ id: 'admin-logs', pattern: 'admin/logs', area: 'admin', access: 'admin', kind: 'collection', title: text('操作日志', 'Audit logs'), resource: 'admin-logs' }),
  route({ id: 'admin-payouts', pattern: 'admin/payouts', area: 'admin', access: 'admin', kind: 'collection', title: text('讲师结算', 'Instructor payouts'), resource: 'admin-payouts', actions: ['admin-payout-generate', 'admin-payout-approve', 'admin-payout'] }),
  route({ id: 'admin-teacher-new', pattern: 'admin/teachers/new', area: 'admin', access: 'admin', kind: 'form', title: text('新建讲师', 'New instructor'), resource: 'admin-teachers', actions: ['admin-save'], description: text('把现有主站账号接入 Platform 讲师工作区，可同时关联公开讲师名录。', 'Connect an existing main-site account to the Platform instructor workspace and optionally link its public teacher profile.') }),
  route({ id: 'admin-teacher', pattern: 'admin/teachers/:id', area: 'admin', access: 'admin', kind: 'detail', title: text('编辑讲师', 'Edit instructor'), resource: 'admin-teachers', actions: ['admin-save', 'admin-delete'] }),
  route({ id: 'admin-teachers', pattern: 'admin/teachers', area: 'admin', access: 'admin', kind: 'collection', title: text('讲师管理', 'Instructor management'), resource: 'admin-teachers', actions: ['admin-delete'] }),
  route({ id: 'admin-invites', pattern: 'admin/invites', area: 'admin', access: 'admin', kind: 'collection', title: text('邀请管理', 'Invitation management'), resource: 'admin-invites', actions: ['admin-save', 'admin-delete'] }),
  route({ id: 'admin-news-new', pattern: 'admin/news/new', area: 'admin', access: 'admin', kind: 'form', title: text('新建资讯', 'New article'), resource: 'admin-news', actions: ['admin-save'] }),
  route({ id: 'admin-news-detail', pattern: 'admin/news/:id', area: 'admin', access: 'admin', kind: 'detail', title: text('编辑资讯', 'Edit article'), resource: 'admin-news', actions: ['admin-save'] }),
  route({ id: 'admin-news', pattern: 'admin/news', area: 'admin', access: 'admin', kind: 'collection', title: text('资讯管理', 'News management'), resource: 'admin-news' }),
  canonical('admin-community', 'admin/community', 'admin', 'admin', text('社区管理', 'Community management'), '/forum/review'),
  route({ id: 'admin-order', pattern: 'admin/orders/:id', area: 'admin', access: 'admin', kind: 'detail', title: text('订单履约', 'Order fulfillment'), resource: 'admin-orders', actions: ['admin-refund', 'admin-ship-order-item', 'admin-deliver-order-item', 'admin-return-order-item'] }),
  route({ id: 'admin-orders', pattern: 'admin/orders', area: 'admin', access: 'admin', kind: 'collection', title: text('订单管理', 'Order management'), resource: 'admin-orders' }),
  route({ id: 'admin-reconcile', pattern: 'admin/reconcile', area: 'admin', access: 'admin', kind: 'dashboard', title: text('交易对账', 'Payment reconciliation'), resource: 'admin-reconcile', actions: ['admin-reconcile-run', 'admin-reconcile'] }),
  route({ id: 'admin-product-new', pattern: 'admin/products/new', area: 'admin', access: 'admin', kind: 'form', title: text('新建商品', 'New product'), resource: 'admin-products', actions: ['admin-save'] }),
  route({ id: 'admin-product', pattern: 'admin/products/:id', area: 'admin', access: 'admin', kind: 'detail', title: text('编辑商品', 'Edit product'), resource: 'admin-products', actions: ['admin-save'] }),
  route({ id: 'admin-products', pattern: 'admin/products', area: 'admin', access: 'admin', kind: 'collection', title: text('商品管理', 'Product management'), resource: 'admin-products' }),
  route({ id: 'admin-qr-detail', pattern: 'admin/qr/:code', area: 'admin', access: 'admin', kind: 'detail', title: text('二维码详情', 'QR details'), resource: 'admin-qr', actions: ['admin-save', 'qr-duplicate', 'qr-toggle'] }),
  route({ id: 'admin-qr-cards', pattern: 'admin/qr/cards', area: 'admin', access: 'admin', kind: 'collection', title: text('二维码卡片', 'QR cards'), resource: 'admin-qr', actions: ['admin-save', 'admin-delete', 'qr-template-restore', 'qr-template-purge', 'qr-template-reorder'] }),
  route({ id: 'admin-qr-prompts', pattern: 'admin/qr/prompts', area: 'admin', access: 'admin', kind: 'collection', title: text('二维码提示词', 'QR prompts'), resource: 'admin-qr', actions: ['admin-save', 'admin-delete', 'qr-template-restore', 'qr-template-purge', 'qr-template-reorder'] }),
  route({ id: 'admin-qr-stats', pattern: 'admin/qr/stats', area: 'admin', access: 'admin', kind: 'dashboard', title: text('二维码统计', 'QR analytics'), resource: 'admin-qr' }),
  route({ id: 'admin-qr', pattern: 'admin/qr', area: 'admin', access: 'admin', kind: 'collection', title: text('二维码管理', 'QR management'), resource: 'admin-qr', actions: ['admin-save'] }),
] as const;

function patternParts(pattern: string): string[] {
  return pattern ? pattern.split('/') : [];
}

function matchDefinition(definition: PlatformRouteDefinition, segments: readonly string[]): PlatformRouteMatch | null {
  const parts = patternParts(definition.pattern);
  if (parts.length !== segments.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    const segment = segments[i];
    if (part.startsWith(':')) params[part.slice(1)] = segment;
    else if (part !== segment) return null;
  }
  return { definition, params };
}

export function matchPlatformRoute(segments: readonly string[]): PlatformRouteMatch | null {
  const candidates = PLATFORM_ROUTES
    .map((definition) => ({ definition, score: patternParts(definition.pattern).filter((part) => !part.startsWith(':')).length }))
    .sort((a, b) => b.score - a.score);
  for (const candidate of candidates) {
    const match = matchDefinition(candidate.definition, segments);
    if (match) return match;
  }
  return null;
}

export function fillPlatformParams(template: string, params: Record<string, string>): string {
  return template.replace(/:([A-Za-z][A-Za-z0-9]*)/g, (_, name: string) => encodeURIComponent(params[name] ?? ''));
}

export const PLATFORM_NAV: ReadonlyArray<{
  area: PlatformArea;
  label: PlatformRouteDefinition['title'];
  href: string;
}> = [
  { area: 'discover', label: text('发现', 'Discover'), href: '/platform' },
  { area: 'learning', label: text('学习', 'Learn'), href: '/platform/courses' },
  { area: 'community', label: text('社区', 'Community'), href: '/platform/community' },
  { area: 'commerce', label: text('商店', 'Shop'), href: '/platform/shop' },
  { area: 'account', label: text('我的', 'My account'), href: '/platform/account/courses' },
  { area: 'instructor', label: text('讲师', 'Instructor'), href: '/platform/instructor' },
  { area: 'organization', label: text('机构', 'Organization'), href: '/platform/org' },
  { area: 'admin', label: text('管理', 'Admin'), href: '/platform/admin' },
];
