// @vitest-environment jsdom
import { act, createElement, Suspense, useContext } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { usePathname } from 'next/navigation';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: vi.fn(() => '/zh/platform/teachers') }));
vi.mock('@/hooks/useT', () => ({ useT: () => (zh: string) => zh }));
vi.mock('@/i18n/tr', () => ({ useLang: () => 'zh', tr: ({ zh }: { zh: string }) => zh, T: ({ zh }: { zh: string }) => zh }));
const auth = vi.hoisted(() => ({ admin: false, user: null as null | { uid: number; name?: string; avatar?: string }, loadInstructor: vi.fn() }));
const access = vi.hoisted(() => ({ organization: false, learner: false, organizer: false, supervisor: false }));
vi.mock('@/lib/teaching-saas-api', () => ({
  listTeachingOrganizations: async () => access.organization ? [{ status: 'active' }] : [],
  listTeachingLearningContexts: async () => access.learner ? [{}] : [],
}));
vi.mock('@/lib/online-competition-api', () => ({
  listOrganizerApplications: async () => ({ eligibleOrganizationIds: access.organizer ? ['org'] : [] }),
  listSupervisedCompetitions: async () => ({ competitions: access.supervisor ? [{}] : [] }),
}));
const navigate = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth-store', () => ({ useAuthUser: () => auth.user, useIsAdmin: () => auth.admin }));
vi.mock('@/lib/platform-gateway', async original => ({ ...await original<object>(), loadPlatformResource: auth.loadInstructor }));
vi.mock('@/hooks/useEntryRouter', () => ({ useEntryRouter: () => ({ push: navigate }) }));
vi.mock('@/lib/landing-sections', () => ({ SEARCH_CARDS: [], isLandingSearchCardVisible: () => true }));
vi.mock('@/components/LandingSearch', () => ({ default: () => createElement('input', { 'aria-label': '搜索' }) }));
vi.mock('@/components/PageBackLink', () => ({ default: ({ fallback = '/platform', label }: { fallback?: string; label?: string }) => createElement('a', { href: fallback, className: 'back-home', 'aria-label': label }) }));
vi.mock('@/components/CubeRootLogo', () => ({ default: ({className, children}:{className?:string; children?:React.ReactNode}) => createElement('a', {className, href:'/zh', 'aria-label':'主页'}, createElement('img',{alt:'',src:'/icons/CubeRoot.png'}), children) }));
vi.mock('@/components/CompactSelect', () => ({ CompactSelect: ({ open, onOpenChange, panelContent, ariaLabel, label }: { open?: boolean; onOpenChange?: (open: boolean) => void; panelContent?: React.ReactNode; ariaLabel: string; label: React.ReactNode }) => createElement('div', null, createElement('button', { 'aria-label': ariaLabel, onClick: () => onOpenChange?.(!open) }, label), open ? panelContent : null) }));
vi.mock('@/components/LangToggle', () => ({ default: () => null }));
vi.mock('@/components/WcaAuth', () => ({ default: () => null }));
vi.mock('@/components/AppLink', () => ({
  default: ({ prefetch: _prefetch, scroll, ...props }: React.ComponentProps<'a'> & { prefetch?: boolean; scroll?: boolean }) => createElement('a', { ...props, 'data-scroll': scroll === false ? 'false' : undefined }),
}));

import { PlatformShell } from '@/components/platform/PlatformShell';
import { PlatformSharedSurface } from '@/components/platform/PlatformSharedSurface';
import { ForumHeader } from '@/app/[lang]/forum/_components/ForumHeader';
import { PlatformNavigationContext, PlatformInstructorAccessRefreshContext } from '@/lib/platform-navigation-context';
import { isPlatformCourseClassroom, isPlatformInstructorApplication, isPlatformInstructorCourseEditor, PLATFORM_ROUTES } from '@/lib/platform-routes';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe('Platform shell ownership during shared-page navigation', () => {
  it('shows public navigation only outside dedicated workspaces and focused pages', () => {
    const pathname = vi.mocked(usePathname);
    try {
      auth.user = null; auth.admin = false;
      for (const route of PLATFORM_ROUTES) {
        pathname.mockReturnValue(`/zh/platform${route.pattern ? '/' + route.pattern.replace(/:[a-zA-Z]+\*?/g, 'sample') : ''}`);
        const host = document.createElement('div');
        host.innerHTML = renderToString(createElement(PlatformShell, { children: createElement('article', null, route.id) }));
        const privatePage = isPlatformCourseClassroom(route.id) || isPlatformInstructorCourseEditor(route.id) || route.id === 'teacher-apply-start' || (route.area === 'instructor' && !isPlatformInstructorApplication(route.id)) || route.area === 'admin' || route.area === 'organization' || route.id.startsWith('competition-');
        expect(host.querySelectorAll('.platform-home-header'), route.id).toHaveLength(privatePage ? 0 : 1);
        expect(host.querySelectorAll('.platform-shared-footer'), route.id).toHaveLength(privatePage ? 0 : 1);
        expect(host.querySelector('.platform-site-search'), route.id).toBeNull();
        expect(host.querySelector('.platform-admin-group-nav'), route.id).toBeNull();
        if (!privatePage) expect(host.querySelector('.platform-home-header a[aria-label="搜索"]')?.getAttribute('href'), route.id).toBe('/search');
      }
    } finally { pathname.mockReturnValue('/zh/platform/teachers'); }
  });
  it('uses four homepage links and hides the management entry from guests and ordinary users', async () => {
    const host = document.createElement('div'), root = createRoot(host);
    const pathname = vi.mocked(usePathname);
    pathname.mockReturnValue('/zh/platform');
    auth.loadInstructor.mockResolvedValue({ items: [] });
    try {
      for (const user of [null, { uid: 6, name: '根根', avatar: '/broken-avatar.webp' }]) {
        auth.user = user; auth.admin = false;
        await act(async () => root.render(createElement(PlatformShell, { children: null })));
        expect([...host.querySelectorAll('.platform-home-nav a')].map(link => link.textContent)).toEqual(['学习', '课程', '讲师', '活动']);
        expect(host.querySelector('.platform-site-search')).toBeNull();
        expect(host.querySelector('.platform-home-logo')?.textContent).toBe('魔方根 CubeRoot');
        expect(host.querySelector('a[href="/platform/admin"]')).toBeNull();
        if (user) {
          expect(host.querySelector('.platform-home-avatar')?.textContent).toBe('根');
          const img = host.querySelector<HTMLImageElement>('.platform-home-avatar img')!;
          const initial = host.querySelector<HTMLElement>('.platform-home-avatar > span')!;
          expect(initial.hidden).toBe(false);
          expect(img.hidden).toBe(true);
          Object.defineProperty(img, 'naturalWidth', { configurable: true, value: 36 });
          await act(async () => img.dispatchEvent(new Event('load')));
          expect(img.hidden).toBe(false);
          expect(initial.hidden).toBe(true);
          await act(async () => img.dispatchEvent(new Event('error')));
          expect(img.hidden).toBe(true);
          expect(initial.hidden).toBe(false);
        }
        await act(async () => host.querySelector<HTMLButtonElement>(`button[aria-label="${user ? '我的账号' : '登录与账号'}"]`)!.click());
        expect(host.querySelector('a[href="/platform/admin"]')).toBeNull();
        expect(host.querySelector('a[href="/platform/account/invites"]')).not.toBeNull();
        expect(host.querySelector('a[href="/platform/account/invites"]')?.textContent).toBe('兑换码');
        expect(host.querySelector('a[href="/platform/org"]')).toBeNull();
        expect(host.querySelector('a[href="/platform/organizations/join"]')).not.toBeNull();
        if (user) {
          expect(host.querySelector('a[href="/platform/account/courses"]')?.textContent).toBe('我的学习');
          expect(host.querySelector('a[href="/account"]')?.textContent).toBe('账号设置');
        }
        await act(async () => host.querySelector<HTMLButtonElement>(`button[aria-label="${user ? '我的账号' : '登录与账号'}"]`)!.click());
      }
    } finally { auth.user = null; auth.admin = false; auth.loadInstructor.mockReset(); pathname.mockReturnValue('/zh/platform/teachers'); await act(async () => root.unmount()); }
  });
  it('shows only the workspaces of the current account even for administrators', async () => {
    const host = document.createElement('div'), root = createRoot(host);
    const paths = { organization: '/platform/org', learner: '/learn', organizer: '/platform/competitions/manage', supervisor: '/platform/competitions/supervise' };
    const roles = Object.keys(paths) as (keyof typeof paths)[];
    auth.loadInstructor.mockResolvedValue({ items: [] });
    try {
      let uid = 20;
      for (const role of [...roles, 'ordinary', 'admin'] as const) {
        auth.user = { uid: uid++ }; auth.admin = role === 'admin';
        for (const key of roles) access[key] = key === role;
        await act(async () => root.render(createElement(PlatformShell, { children: null })));
        const menu = host.querySelector<HTMLButtonElement>('button[aria-label="我的账号"]')!;
        await act(async () => menu.click());
        await act(async () => { await vi.dynamicImportSettled(); });
        for (const key of roles) {
          expect(!!host.querySelector(`.platform-home-header a[href="${paths[key]}"]`), role + '/' + key).toBe(key === role);
        }
        const panel = host.querySelector('.platform-account-content')!;
        expect(panel.querySelector('details[open]')).toBeNull();
        expect(panel.querySelector('a')?.textContent).toBe(auth.admin ? '平台管理' : '我的学习');
        expect(panel.querySelector('a[href="/platform/orders"]')?.closest('details')?.querySelector('summary')?.textContent).toBe('个人空间');
        const membership = panel.querySelector('.platform-account-primary a[href="/platform/membership"]');
        expect(membership?.textContent).toBe('课程会员');
        expect(membership?.nextElementSibling?.textContent).toBe('兑换码');
        expect(panel.querySelector('a[href="/platform/account/membership"]')).toBeNull();
        const orgLink = panel.querySelector('a[href="/platform/org"]');
        if (role === 'organization') expect(orgLink?.closest('details')).toBeNull();
        if (auth.admin) {
          expect(orgLink).toBeNull();
          expect(panel.querySelector('a[href="/platform/admin"]')).not.toBeNull();
          expect(panel.querySelector('a[href="/platform/community/review"]')).toBeNull();
        }
        expect(host.querySelector('.platform-home-admin-link')).toBeNull();
        await act(async () => menu.click());
      }
    } finally {
      for (const key of roles) access[key] = false;
      auth.user = null; auth.admin = false; auth.loadInstructor.mockReset();
      await act(async () => root.unmount());
    }
  });
  it('keeps the instructor directory in the primary header without a secondary navigation row', async () => {
    const host = document.createElement('div'), root = createRoot(host);
    const pathname = vi.mocked(usePathname);
    try {
      for (const path of ['/zh/platform/teachers', '/zh/platform/teachers/apply']) {
        pathname.mockReturnValue(path);
        await act(async () => root.render(createElement(PlatformShell, { children: null })));
        expect(host.querySelector('.platform-context-nav')).toBeNull();
        expect(host.querySelector('.platform-home-header a[href="/platform/teachers"]')).not.toBeNull();
        expect(host.querySelector('[data-search-scope="teachers"]')).toBeNull();
        expect(host.querySelector('.platform-home-header a[aria-label="搜索"]')).not.toBeNull();
      }
      pathname.mockReturnValue('/zh/platform/teachers/apply/start');
      await act(async()=>root.render(createElement(PlatformShell,{children:null})));
      expect(host.querySelector('.platform-masthead')).toBeNull();
      expect(host.querySelector('.platform-nav')).toBeNull();
      expect(host.querySelector('.platform-instructor-studio')).toBeNull();
    } finally { pathname.mockReturnValue('/zh/platform/teachers'); await act(async () => root.unmount()); }
  });
  it('keeps the same home logo in public sections independently of the selected tab', async () => {
    const host = document.createElement('div'), root = createRoot(host);
    const pathname=vi.mocked(usePathname);
    try {
      for(const path of ['/zh/platform','/zh/platform/courses','/zh/platform/membership','/zh/platform/events','/zh/platform/teachers','/zh/platform/teachers/apply','/zh/platform/organizations/join']) {
        pathname.mockReturnValue(path);
        await act(async()=>root.render(createElement(PlatformShell,{children:null})));
        if (path === '/zh/platform/courses' || path === '/zh/platform/membership') expect(host.querySelector('.platform-context-nav')).toBeNull();
        const brand=host.querySelector('.platform-masthead-brand');
        expect(brand?.querySelector('a.platform-home-logo img')).not.toBeNull();
        expect(brand?.querySelector('a')?.getAttribute('href')).toBe('/zh');
        expect(brand?.querySelectorAll('a')).toHaveLength(1);
      }
      pathname.mockReturnValue('/zh/platform/account/courses');
      await act(async()=>root.render(createElement(PlatformShell,{children:null})));
      expect(host.querySelector('.platform-masthead-brand .platform-home-logo')).not.toBeNull();
    } finally { pathname.mockReturnValue('/zh/platform/teachers');await act(async()=>root.unmount()); }
  });
  it('shows one persistent publishing entry for active instructors, including admins who teach', async () => {
    const host = document.createElement('div'), root = createRoot(host);
    const pathname = vi.mocked(usePathname);
    pathname.mockReturnValue('/zh/platform/teachers');
    const render = async () => {
      await act(async () => root.render(createElement(PlatformShell, { children: null })));
      await act(async () => { await vi.dynamicImportSettled(); });
    };
    try {
      auth.loadInstructor.mockReset();
      auth.user = null; await render();
      expect(auth.loadInstructor).not.toHaveBeenCalled();
      expect(host.querySelector('.platform-instructor-entry')).toBeNull();
      for (const [uid, role, admin] of [[1, 'active', false], [2, 'archived', false], [3, 'suspended', false], [4, 'unknown', true], [5, 'active', true]] as const) {
        auth.user = { uid }; auth.admin = admin;
        auth.loadInstructor.mockResolvedValue({ items: [{ data: { instructorStatus: role } }] });
        await render();
        await vi.waitFor(() => expect(auth.loadInstructor).toHaveBeenCalledWith('instructor-application', expect.objectContaining({ params: {} })));
        await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="我的账号"]')!.click());
        expect(host.querySelector('a[href="/platform/instructor"]')?.getAttribute('href') ?? null).toBe(role === 'active' ? '/platform/instructor' : null);
        await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="我的账号"]')!.click());
        expect(host.querySelector('.platform-masthead .platform-instructor-entry')).toBeNull();
      }
      const lookupCount = auth.loadInstructor.mock.calls.length;
      for (const path of ['/zh/platform', '/zh/platform/courses', '/zh/platform/community', '/zh/platform/teachers/apply']) {
        pathname.mockReturnValue(path); await render();
        expect(host.querySelector('.platform-instructor-entry')).toBeNull();
        await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="我的账号"]')!.click());
        expect(host.querySelectorAll('a[href="/platform/instructor"]')).toHaveLength(1);
        expect(host.querySelector('a[href="/platform/admin"]')).not.toBeNull();
        await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="我的账号"]')!.click());
      }
      expect(auth.loadInstructor).toHaveBeenCalledTimes(lookupCount);
      pathname.mockReturnValue('/zh/platform/instructor'); await render();
      expect(host.querySelector('.platform-instructor-entry')).toBeNull();
    } finally { auth.user = null; auth.admin = false; auth.loadInstructor.mockReset(); pathname.mockReturnValue('/zh/platform/teachers'); await act(async () => root.unmount()); }
  });
  it('removes the persistent workspace entry when self-archival refreshes instructor access', async () => {
    const host = document.createElement('div'), root = createRoot(host);
    const pathname = vi.mocked(usePathname);
    function RefreshAction() {
      const refresh = useContext(PlatformInstructorAccessRefreshContext);
      return createElement('button', { id: 'refresh-access', onClick: refresh }, 'Refresh');
    }
    try {
      pathname.mockReturnValue('/zh/platform/teachers/apply');
      auth.user = { uid: 7 };
      auth.loadInstructor.mockResolvedValue({ items: [{ data: { instructorStatus: 'active' } }] });
      await act(async () => root.render(createElement(PlatformShell, { children: createElement(RefreshAction) })));
      await act(async () => { await vi.dynamicImportSettled(); });
      await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="我的账号"]')!.click());
      expect(host.querySelector('a[href="/platform/instructor"]')).not.toBeNull();
      auth.loadInstructor.mockResolvedValue({ items: [{ data: { instructorStatus: 'archived' } }] });
      await act(async () => host.querySelector<HTMLButtonElement>('#refresh-access')!.click());
      await act(async () => { await vi.dynamicImportSettled(); });
      expect(host.querySelector('a[href="/platform/instructor"]')).toBeNull();
    } finally { auth.user = null; auth.loadInstructor.mockReset(); pathname.mockReturnValue('/zh/platform/teachers'); await act(async () => root.unmount()); }
  });
  it.each([false, true])('shows an isolated instructor studio sidebar and focused editors (admin=%s)', async admin => {
    auth.user = { uid: 1 }; auth.admin = admin;
    auth.loadInstructor.mockResolvedValue({ items: [{ data: { instructorStatus: 'active' } }] });
    const host = document.createElement('div'), root = createRoot(host);
    const pathname = vi.mocked(usePathname);
    try {
      for (const path of ['instructor','instructor/courses','instructor/students','instructor/earnings','instructor/profile']) {
        pathname.mockReturnValue(`/zh/platform/${path}`);
        await act(async () => root.render(createElement(PlatformShell, { children: null })));
        await act(async () => { await vi.dynamicImportSettled(); });
        expect(host.querySelector('.platform-masthead')).toBeNull();
        expect(host.querySelector('.platform-nav')).toBeNull();
        expect(host.querySelector('.platform-instructor-masthead .platform-site-search')).toBeNull();
        expect(host.querySelector('.platform-home-header')).toBeNull();
        expect(host.querySelector('.platform-shared-footer')).toBeNull();
        expect(host.querySelector('.platform-instructor-studio-brand .back-home')).not.toBeNull();
        expect(host.querySelector('.af-nav-sidebar > .af-nav-toggle')).not.toBeNull();
        expect(host.querySelector('.platform-instructor-masthead .back-home')?.getAttribute('aria-label')).toBe(path === 'instructor' ? '返回学习空间' : '返回讲师工作台');
        expect(host.querySelector('.platform-instructor-masthead .back-home')?.getAttribute('href')).toBe(path === 'instructor' ? '/platform' : '/platform/instructor');
        expect(host.querySelector('[data-search-scope="instructor-courses"]')).toBeNull();
        expect(host.querySelector('.platform-workspace-nav')).toBeNull();
        const sidebar=host.querySelector('nav[aria-label="讲师工作台导航"]');
        expect(sidebar?.querySelectorAll('a')).toHaveLength(5);
        expect(sidebar?.querySelector('a[aria-current="page"]')?.getAttribute('href')).toBe(`/platform/${path}`);
        if(path==='instructor'){
          await act(async()=>host.querySelector<HTMLButtonElement>('.af-nav-sidebar > .af-nav-toggle')!.click());
          expect(host.querySelector('.platform-instructor-studio')?.getAttribute('data-collapsed')).toBe('true');
        }else{
          expect(host.querySelector('.platform-instructor-studio')?.getAttribute('data-collapsed')).toBe('true');
        }
      }
      for (const path of ['instructor/courses/new', 'instructor/courses/course-1']) {
        pathname.mockReturnValue(`/zh/platform/${path}`);
        await act(async () => root.render(createElement(PlatformShell, { children: null })));
        expect(host.querySelector('.platform-instructor-navigation')).toBeNull();
        expect(host.querySelector('.platform-site-search')).toBeNull();
        expect(host.querySelector('.platform-workspace-nav')).toBeNull();
        expect(host.querySelector('.platform-nav')).toBeNull();
        expect(host.querySelector('.platform-instructor-studio')).toBeNull();
      }
    } finally { auth.user = null; auth.admin = false; auth.loadInstructor.mockReset(); pathname.mockReturnValue('/zh/platform/teachers'); await act(async () => root.unmount()); }
  });
  it('uses one global search entry across every public route, without a scoped masthead', async () => {
    const host = document.createElement('div'), root = createRoot(host);
    const pathname = vi.mocked(usePathname);
    try {
      for (const path of ['/zh/platform', '/zh/platform/community/feed', '/zh/platform/courses', '/zh/platform/paths', '/zh/platform/events/event-1', '/zh/platform/news/news-1', '/zh/platform/teachers']) {
        pathname.mockReturnValue(path);
        await act(async () => root.render(createElement(PlatformShell, { children: null })));
        expect(host.querySelectorAll('a[aria-label="搜索"]')).toHaveLength(1);
        expect(host.querySelector('a[aria-label="搜索"]')?.getAttribute('href')).toBe('/search');
        expect(host.querySelector('.platform-site-search')).toBeNull();
        expect(host.querySelector('.platform-scoped-search')).toBeNull();
        expect(host.querySelectorAll('.platform-shared-footer')).toHaveLength(1);
      }
    } finally { pathname.mockReturnValue('/zh/platform/teachers'); await act(async () => root.unmount()); }
  });
  it('renders the native admin layout on the server without preloading the lazy shared shell', () => {
    const pathname = vi.mocked(usePathname);
    pathname.mockReturnValue('/zh/platform/admin/courses');
    try {
      const html = renderToString(createElement(PlatformSharedSurface, {
        children: createElement(PlatformShell, { children: createElement('article', null, '管理页面') }),
      }));
      const host = document.createElement('div'); host.innerHTML = html;
      expect(host.querySelectorAll('.platform-shell')).toHaveLength(1);
      expect(host.querySelector('.platform-shell--shared')).toBeNull();
      expect(host.querySelector('main article')?.textContent).toBe('管理页面');
    } finally { pathname.mockReturnValue('/zh/platform/teachers'); }
  });
  it('keeps the same admin masthead and two-tier navigation when changing native and rewritten pages', async () => {
    auth.admin = true; auth.user = { uid: 1 };
    const host = document.createElement('div'), root = createRoot(host);
    const pathname = vi.mocked(usePathname);
    const render = async (path: string, native: boolean) => {
      pathname.mockReturnValue(path);
      const content = createElement('article', null, path);
      await act(async () => root.render(createElement(Suspense, { fallback: null }, createElement(PlatformSharedSurface, { children: native ? createElement(PlatformShell, { children: content }) : content }))));
      await vi.waitFor(() => expect(host.querySelector('.platform-admin-group-nav')).not.toBeNull());
    };
    try {
      await render('/zh/platform/admin/courses', true);
      const masthead = host.querySelector('.platform-home-header');
      expect(host.querySelectorAll('.platform-admin-group-nav a')).toHaveLength(6);
      expect(host.querySelector('.platform-admin-group-nav [aria-current]')?.textContent).toBe('课程');
      expect(host.querySelector('.platform-admin-context-nav [aria-current]')?.getAttribute('href')).toBe('/platform/admin/courses');
      expect(host.querySelector('.platform-workspace-nav')).toBeNull();
      expect([...host.querySelectorAll('.platform-nav a, .platform-context-nav a')].every(link => link.getAttribute('data-scroll') === 'false')).toBe(true);
      await render('/zh/platform/admin/courses/new', true);
      expect(host.querySelector('.platform-home-header')).toBe(masthead);
      expect(host.querySelector('.platform-admin-context-nav [aria-current]')?.getAttribute('href')).toBe('/platform/admin/courses');
      await render('/zh/platform/admin/community', false);
      expect(host.querySelector('.platform-home-header')).toBe(masthead);
      expect(host.querySelector('.platform-admin-context-nav [aria-current]')?.getAttribute('href')).toBe('/platform/admin/community');
      await render('/zh/platform/admin/qr/cards', true);
      expect(host.querySelector('.platform-home-header')).toBe(masthead);
      expect(host.querySelectorAll('.platform-shell')).toHaveLength(1);
      expect(host.querySelector('.platform-admin-context-nav [aria-current]')?.getAttribute('href')).toBe('/platform/admin/qr/cards');
      auth.admin = false;
      pathname.mockReturnValue('/zh/platform/admin/community');
      await act(async () => root.render(createElement(Suspense, { fallback: null }, createElement(PlatformSharedSurface, { children: createElement('article', null, 'private admin content') }))));
      expect(host.querySelector('.platform-admin-group-nav')).toBeNull();
      expect(host.querySelector('article')).toBeNull();
      expect(host.querySelector('.platform-state-permission')).not.toBeNull();
    } finally { auth.admin = false; auth.user = null; pathname.mockReturnValue('/zh/platform/teachers'); await act(async () => root.unmount()); }
  });
  it.each([false, true])('renders one frame when a retained layout is already inside a shell (shared=%s)', async shared => {
    const host = document.createElement('div');
    const root = createRoot(host);
    try {
      await act(async () => root.render(createElement(PlatformShell, {
        shared,
        children: createElement(PlatformShell, { children: createElement('article', null, '讲师内容') }),
      })));
      expect(host.querySelectorAll('.platform-shell')).toHaveLength(1);
      expect(host.querySelectorAll('.platform-home-header')).toHaveLength(1);
      expect(host.querySelectorAll('.platform-site-search')).toHaveLength(0);
      expect(host.querySelectorAll('.platform-home-nav')).toHaveLength(1);
      expect(host.querySelector('article')?.textContent).toBe('讲师内容');
    } finally {
      await act(async () => root.unmount());
    }
  });

  it('keeps forum actions, removes duplicate views in Platform and preserves the standalone forum header', async () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    try {
      const render = (inPlatform: boolean) => act(async () => root.render(createElement(PlatformNavigationContext, { value: inPlatform },
        createElement(ForumHeader, { activeView: 'boards' }))));
      await render(true);
      expect(host.querySelector('h1')?.classList.contains('sr-only')).toBe(true);
      expect(host.querySelector('.forum-view-nav')).toBeNull();
      expect(host.querySelector('.forum-view-toolbar')).toBeNull();
      expect(host.querySelector('a[href="/forum/new"]')).not.toBeNull();
      expect(host.querySelector('a[href="/forum/search"]')).toBeNull();
      await render(false);
      expect(host.querySelector('h1')?.classList.contains('sr-only')).toBe(false);
      expect(host.querySelectorAll('.forum-view-nav a')).toHaveLength(3);
      expect(host.querySelector('a[href="/forum/search"]')).not.toBeNull();
    } finally {
      await act(async () => root.unmount());
    }
  });

  it('keeps the shared header on course details and removes it in classrooms', async () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    const pathname = vi.mocked(usePathname);
    const render = (path: string, heading: string) => {
      pathname.mockReturnValue(path);
      return act(async () => root.render(createElement(PlatformShell, {
        children: createElement('h1', null, heading),
      })));
    };
    const chrome = '.platform-home-header';

    try {
      await render('/zh/platform/courses', '全部课程');
      expect(host.querySelectorAll(chrome)).toHaveLength(1);

      await render('/zh/platform/courses/example', '课程名称');
      expect(host.querySelector(chrome)).not.toBeNull();
      expect(host.querySelector('main h1')?.textContent).toBe('课程名称');

      for (const path of ['sections/introduction', 'sections/trial', 'sections/core', 'learn/lesson-1']) {
        await render(`/zh/platform/courses/example/${path}`, '课程内容');
        expect(host.querySelector(chrome)).toBeNull();
        expect(host.querySelector('.platform-shared-footer')).toBeNull();
        expect(host.querySelector('main h1')?.textContent).toBe('课程内容');
      }

      await render('/zh/platform/courses', '全部课程');
      expect(host.querySelectorAll(chrome)).toHaveLength(1);
    } finally {
      pathname.mockReset();
      await act(async () => root.unmount());
    }
  });
});
