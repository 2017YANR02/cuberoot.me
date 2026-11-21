// @vitest-environment jsdom
import { act, createElement, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { PlatformActionId, PlatformActionResult } from '@/lib/platform-types';

const state = vi.hoisted(() => ({
  user: null as null | { uid: number }, admin: false, load: vi.fn(), execute: vi.fn(), learning: vi.fn(), entry: vi.fn((path: string) => path), t: (zh: string) => zh,
  myDirectory: vi.fn(), updateDirectory: vi.fn(), createDirectory: vi.fn(), replace: vi.fn(), prepareImage: vi.fn(), uploadImage: vi.fn(), managedQuizzes: vi.fn(), createUpload: vi.fn(), chunk: vi.fn(),
  action: null as null | ((action: PlatformActionId, id?: string, payload?: Record<string, unknown>) => Promise<PlatformActionResult | undefined>),
}));
vi.mock('@/hooks/useT', () => ({ useT: () => state.t }));
vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('@/hooks/useEntryRouter', () => ({ useEntryRouter: () => ({ push: vi.fn(), replace: state.replace }) }));
vi.mock('@/i18n/tr', () => ({ useLang: () => 'zh', tr: ({ zh }: { zh: string }) => zh }));
vi.mock('@/lib/auth-store', () => ({ useAuthUser: () => state.user, useIsAdmin: () => state.admin, nextQuery: () => '' }));
vi.mock('@/lib/entry-navigation', () => ({ currentEntryHref: state.entry, readEntryNavigationBack: () => null }));
vi.mock('nuqs', async original => {
  const { useState } = await import('react');
  return { ...await original<object>(), useQueryState: (_key: string, parser: { defaultValue?: unknown }) => useState(parser.defaultValue ?? null) };
});
vi.mock('@/lib/platform-gateway', async original => ({ ...await original<object>(), loadPlatformResource: state.load, executePlatformAction: state.execute, loadPlatformManagedQuizzes: state.managedQuizzes }));
vi.mock('@/lib/platform-learning', async original => ({ ...await original<object>(), platformLearningRequest: state.learning }));
vi.mock('@/components/platform/InstructorPayoutSettings', () => ({ InstructorPayoutSettings: () => createElement('div', {}, '收款方式') }));
vi.mock('@/lib/teacher-directory-api', async original => ({ ...await original<object>(), fetchMyTeacherDirectory: state.myDirectory, updateTeacherDirectoryEntry: state.updateDirectory, createTeacherDirectoryEntry: state.createDirectory, deleteTeacherDirectoryEntry: vi.fn() }));
vi.mock('@/lib/image-upload', () => ({ prepareImageUpload: state.prepareImage, uploadImageBlob: state.uploadImage }));
vi.mock('@/lib/drive-api', async original => ({ ...await original<object>(), createDriveUpload: state.createUpload, uploadDriveChunk: state.chunk }));
vi.mock('@/components/AppLink', () => ({ default: ({ children, href }: { children: ReactNode; href: string }) => createElement('a', { href }, children) }));
vi.mock('@/components/PageBackLink', () => ({ default: ({ fallback, label }: { fallback: string; label?: string }) => createElement('a', { href: fallback, className: 'back-home', 'aria-label': label }) }));
vi.mock('@/components/LangToggle', () => ({ default: () => createElement('button', { type: 'button' }, 'Language') }));
vi.mock('@/components/platform/PlatformDomainActions', async () => {
  const { PlatformInstructorApplication, PlatformInstructorReview } = await import('@/components/platform/PlatformInstructorApplication');
  const { PlatformInstructorActions } = await import('@/components/platform/PlatformInstructorActions');
  return { PlatformDomainActions: (props: import('@/components/platform/PlatformActionTypes').CommonProps) => {
    state.action = props.runAction;
    if (['teacher-apply','teacher-apply-start'].includes(props.definition.id)) return createElement(PlatformInstructorApplication, props);
    if (props.definition.id === 'admin-application') return createElement(PlatformInstructorReview, props);
    if (['instructor-course-new', 'instructor-course', 'instructor-lesson-new'].includes(props.definition.id)) return createElement(PlatformInstructorActions, props);
    return createElement('button', {}, '操作');
  } };
});
vi.mock('@/components/platform/PlatformDomainContent', async () => {
  const { InstructorApplicationDetails } = await import('@/components/platform/PlatformInstructorApplication');
  return { PlatformDomainContent: (props: Pick<import('@/components/platform/PlatformActionTypes').CommonProps, 'definition' | 'entity'>) => props.definition.id === 'admin-application' && props.entity ? createElement(InstructorApplicationDetails, { entity: props.entity, admin: true }) : null };
});
vi.mock('@/components/platform/PlatformEntityList', () => ({ PlatformEntityList: ({ items }: { items: { title: string }[] }) => createElement('div', {}, items.map(item => item.title).join(',')) }));
vi.mock('@/components/platform/PlatformLanding', () => ({ PlatformLanding: () => null }));
vi.mock('@/components/platform/PlatformInfoViews', () => ({ PlatformAboutView: () => null, PlatformOfflineView: () => null, PlatformAccountView: () => null, PlatformCanonicalView: () => null }));
vi.mock('@/components/platform/PlatformOrderPayment', () => ({ PlatformOrderPayment: () => null }));
vi.mock('@/components/platform/PlatformQrAdmin', () => ({ PlatformQrAdmin: () => null }));
vi.mock('@/components/platform/OnlineCompetitions', () => ({ OnlineCompetitions: () => null }));
vi.mock('@/components/platform/OnlineCompetitionPreview', () => ({ OnlineCompetitionPreview: () => null }));
import { PlatformRouteView } from '@/components/platform/PlatformRouteView';
import { PlatformLearningPath } from '@/components/platform/PlatformLearningWorkspace';
import { PLATFORM_ROUTES } from '@/lib/platform-routes';
import { PlatformNavigationContext, PlatformInstructorAccessRefreshContext, PlatformSearchContext, type PlatformSearchBinding } from '@/lib/platform-navigation-context';
import { PlatformScopedSearch } from '@/components/platform/PlatformScopedSearch';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
const params = {};
const clickFilterButton = async (label: string) => act(async () => {
  const button = [...host.querySelectorAll<HTMLButtonElement>('.platform-filter-panel button')].find(item => item.textContent?.trim() === label);
  expect(button).toBeDefined();
  button!.click();
});
const openFilters = async () => act(async () => host.querySelector<HTMLButtonElement>('.platform-filter-trigger')!.click());
const render = async (id: string) => {
  await act(async () => root.render(createElement(PlatformRouteView, { definition: PLATFORM_ROUTES.find(route => route.id === id)!, params })));
  await act(async () => { await vi.dynamicImportSettled(); });
};
const renderInShell = async (id: string, routeParams = params) => act(async () => root.render(createElement(PlatformNavigationContext, { value: true },
  createElement(PlatformRouteView, { definition: PLATFORM_ROUTES.find(route => route.id === id)!, params: routeParams }))));
beforeEach(() => { vi.clearAllMocks(); state.user = { uid: 1 }; state.admin = false; state.action = null; state.load.mockResolvedValue({ items: [] }); for (const uid of [1, 2]) localStorage.removeItem(`cuberoot:platform:course-create:v1:${uid}`); host = document.createElement('div'); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); });

const fillCourseField = async (name: string, value: string) => act(async () => {
  const label = [...host.querySelectorAll('label')].find(item => item.querySelector('span')?.textContent === name && item.querySelector('input, textarea'));
  const input = label?.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea');
  expect(input).toBeDefined();
  Object.getOwnPropertyDescriptor(input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input!.dispatchEvent(new Event('input', { bubbles: true }));
});
const advanceCourse = async () => act(async () => host.querySelector('form.platform-course-wizard')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
const advanceApplication = async () => act(async () => host.querySelector('form.platform-admission-wizard, .platform-admission-homepage-step form.directory-form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
const currentCourseStep = () => host.querySelector('.platform-wizard-progress [aria-current="step"]')?.getAttribute('aria-label');

it('combines real catalog facets with the masthead and applies or resets them together', async () => {
  state.user = null;
  state.load.mockResolvedValue({ items: [
    { id: 'course-1', title: '三阶入门课程', data: { presentation: { tags: ['puzzle:333', 'topic:beginner'] }, instructors: [{ displayName: 'legacy', displayNameZh: '示例讲师', displayNameEn: 'Example teacher' }], lessonCount: 3 } },
    { id: 'course-2', title: '二阶进阶课程', data: { presentation: { tags: ['puzzle:222', 'topic:speed'] } } },
  ] });
  function Embedded() {
    const [binding, setBinding] = useState<PlatformSearchBinding | null>(null);
    return createElement('div', null, createElement(PlatformScopedSearch, { lang: 'zh', scope: 'courses', binding }),
      createElement(PlatformNavigationContext, { value: true }, createElement(PlatformSearchContext, { value: { scope: 'courses', routeId: 'courses', bind: setBinding } },
        createElement(PlatformRouteView, { definition: PLATFORM_ROUTES.find(route => route.id === 'courses')!, params }))));
  }
  await act(async () => root.render(createElement(Embedded)));
  expect(host.querySelector('.platform-course-toolbar')).toBeNull();
  expect(host.querySelector('.platform-filter-panel')).toBeNull();
  expect(host.querySelectorAll('.platform-course-card')).toHaveLength(2);
  expect(host.querySelector('.platform-course-card-byline')?.textContent).toContain('示例讲师');
  expect(host.querySelector('.platform-course-card-byline')?.textContent).toContain('3 课时');
  expect(host.querySelector('.platform-course-card-byline')?.textContent).not.toContain('legacy');
  await openFilters();
  expect(host.querySelector('.platform-filter-panel')?.textContent).toContain('全部项目');
  expect(host.querySelector('.platform-filter-panel')?.textContent).toContain('全部学习方向');
  expect(host.querySelector('.platform-filter-panel')?.textContent).toContain('最近更新');
  const projectSearch = host.querySelector<HTMLInputElement>('.platform-filter-search input')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(projectSearch, '三阶');
    projectSearch.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(host.querySelector('.platform-filter-scroll')?.textContent).not.toContain('二阶');
  await clickFilterButton('三阶');
  expect(host.querySelector('.platform-filter-panel')?.textContent).not.toContain('速度提升');
  await clickFilterButton('入门复原');
  expect(host.querySelectorAll('.platform-course-card')).toHaveLength(2);
  await clickFilterButton('应用筛选');
  expect(host.querySelector('.platform-filter-panel')).toBeNull();
  expect(host.querySelector('.platform-filter-count')?.textContent).toBe('2');
  expect(host.querySelectorAll('.platform-course-card')).toHaveLength(1);
  await openFilters();
  await clickFilterButton('重置');
  await clickFilterButton('应用筛选');
  expect(host.querySelector('.platform-filter-count')).toBeNull();
  expect(host.querySelectorAll('.platform-course-card')).toHaveLength(2);
  const input = host.querySelector<HTMLInputElement>('.platform-scoped-search input')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '三阶');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(host.querySelectorAll('.platform-course-card')).toHaveLength(1);
  expect(host.querySelector('.platform-course-card')?.textContent).toContain('三阶入门课程');
  expect(state.load.mock.calls.filter(call => call[0] === 'courses')).toHaveLength(1);
});

it('searches and sorts learning paths from the same masthead', async () => {
  state.user = null;
  state.load.mockImplementation(async (_resource, options) => ({
    items: options.query
      ? [{ id: 'path-1', title: '三阶入门路径' }]
      : [{ id: 'path-1', title: '三阶入门路径' }, { id: 'path-2', title: '进阶学习路径' }],
  }));
  function Embedded() {
    const [binding, setBinding] = useState<PlatformSearchBinding | null>(null);
    return createElement('div', null, createElement(PlatformScopedSearch, { lang: 'zh', scope: 'paths', binding }),
      createElement(PlatformNavigationContext, { value: true }, createElement(PlatformSearchContext, { value: { scope: 'paths', routeId: 'paths', bind: setBinding } },
        createElement(PlatformRouteView, { definition: PLATFORM_ROUTES.find(route => route.id === 'paths')!, params }))));
  }
  await act(async () => root.render(createElement(Embedded)));
  expect(host.querySelector('.platform-toolbar')).toBeNull();
  await openFilters();
  expect(host.querySelector('.platform-filter-panel')?.textContent).toContain('最近更新');
  expect(host.querySelector('.platform-filter-panel')?.textContent).toContain('标题');
  await clickFilterButton('标题');
  await clickFilterButton('应用筛选');
  expect(state.load).toHaveBeenLastCalledWith('paths', expect.objectContaining({ sort: 'title', page: 1 }));
  expect(host.textContent).toContain('进阶学习路径');
  const input = host.querySelector<HTMLInputElement>('.platform-scoped-search input')!;
  expect(input.placeholder).toBe('搜索学习路径');
  vi.useFakeTimers();
  try {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '三阶');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(state.load).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(state.load).toHaveBeenLastCalledWith('paths', expect.objectContaining({ query: '三阶', sort: 'title', page: 1 }));
    expect(host.textContent).toContain('三阶入门路径');
    expect(host.textContent).not.toContain('进阶学习路径');
    await act(async () => host.querySelector<HTMLButtonElement>('.platform-scoped-search button[aria-label="清除"]')!.click());
    expect(state.load).toHaveBeenLastCalledWith('paths', expect.objectContaining({ query: null, page: 1 }));
    expect(host.textContent).toContain('进阶学习路径');
  } finally { vi.useRealTimers(); }
});

it('searches and sorts the instructor-owned course collection from the compact page heading without hiding course creation', async () => {
  state.user = { uid: 1 };
  state.load.mockImplementation(async (_resource, options) => ({ items: options.query
    ? [{ id: 'managed-1', title: '三阶入门课' }]
    : [{ id: 'managed-1', title: '三阶入门课' }, { id: 'managed-2', title: '进阶课程' }] }));
  await act(async () => root.render(createElement(PlatformNavigationContext, { value: true },
    createElement(PlatformRouteView, { definition: PLATFORM_ROUTES.find(route => route.id === 'instructor-courses')!, params }))));
  await act(async () => { await vi.dynamicImportSettled(); });
  expect(host.querySelectorAll('[data-search-scope="instructor-courses"]')).toHaveLength(1);
  expect(host.querySelector('.platform-route-header .platform-scoped-search--compact')).not.toBeNull();
  expect(host.querySelector('.platform-toolbar')).toBeNull();
  expect(host.querySelector('a[href="/platform/instructor/courses/new"]')?.textContent).toBe('创建课程');
  expect(host.querySelector('.platform-domain-form')).toBeNull();
  expect(host.textContent).toContain('进阶课程');
  await openFilters(); await clickFilterButton('标题'); await clickFilterButton('应用筛选');
  expect(state.load).toHaveBeenLastCalledWith('instructor-courses', expect.objectContaining({ sort: 'title', page: 1 }));
  const input = host.querySelector<HTMLInputElement>('.platform-scoped-search input')!;
  expect(input.placeholder).toBe('搜索讲师课程');
  vi.useFakeTimers();
  try {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '三阶');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(state.load).toHaveBeenLastCalledWith('instructor-courses', expect.objectContaining({ query: '三阶', sort: 'title', page: 1 }));
    expect(host.textContent).not.toContain('进阶课程');
    expect(host.querySelector('a[href="/platform/instructor/courses/new"]')).not.toBeNull();
    expect(host.querySelector('.platform-domain-form')).toBeNull();
    await act(async () => host.querySelector<HTMLButtonElement>('.platform-scoped-search button[aria-label="清除"]')!.click());
    expect(state.load).toHaveBeenLastCalledWith('instructor-courses', expect.objectContaining({ query: null, page: 1 }));
    expect(host.textContent).toContain('进阶课程');
  } finally { vi.useRealTimers(); }
});

it('uses smaller course-list page sizes and resets the page when the size changes', async () => {
  state.user = { uid: 1 };
  state.load.mockImplementation(async (_resource, options) => ({ items: [{id:'managed-1',title:'课程示例'}], total:24, page:options.page, pageSize:options.pageSize }));
  await render('instructor-courses');
  expect(state.load).toHaveBeenLastCalledWith('instructor-courses',expect.objectContaining({page:1,pageSize:5}));
  const pager=host.querySelector('.platform-instructor-course-list-page > .platform-pagination:last-child');
  expect(pager).not.toBeNull();
  const select=pager!.querySelector<HTMLSelectElement>('select')!;
  expect([...select.options].map(option=>option.value)).toEqual(['5','10','20']);
  expect(select.value).toBe('5');
  await act(async()=>pager!.querySelector<HTMLButtonElement>('button[aria-label="下一页"]')!.click());
  expect(state.load).toHaveBeenLastCalledWith('instructor-courses',expect.objectContaining({page:2,pageSize:5}));
  const size=host.querySelector<HTMLSelectElement>('.platform-pagination select')!;
  await act(async()=>{size.value='10';size.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(state.load).toHaveBeenLastCalledWith('instructor-courses',expect.objectContaining({page:1,pageSize:10}));
});

it('opens the dedicated creation form only for an active instructor and navigates to the new course after saving', async () => {
  state.load.mockResolvedValue({ items: [{ id: 'fixture', title: 'Instructor', data: { instructorStatus: 'archived' } }] });
  await render('instructor-course-new');
  expect(host.querySelector('form.platform-domain-form')).toBeNull();
  expect(host.textContent).toContain('当前账号没有可用的讲师权限');
  state.user = { uid: 2 };
  state.load.mockResolvedValue({ items: [{ id: 'fixture', title: 'Instructor', data: { instructorStatus: 'active' } }] });
  await render('instructor-course-new');
  expect(host.querySelector('form.platform-domain-form')).not.toBeNull();
  const back = host.querySelector('.platform-route-header .back-home');
  expect(back?.getAttribute('aria-label')).toBe('返回讲师工作台');
  expect(back?.getAttribute('href')).toBe('/platform/instructor');
  expect(host.querySelectorAll('.platform-wizard-progress li')).toHaveLength(7);
  expect(currentCourseStep()).toBe('基本信息');
  expect(host.querySelector('button[aria-label="币种"]')).toBeNull();
  await advanceCourse();
  expect(currentCourseStep()).toBe('基本信息');
  await fillCourseField('课程链接标识（选填）', 'fixture-course');
  await fillCourseField('中文标题', '测试课程');
  await fillCourseField('英文标题', 'Fixture Course');
  for (const step of ['课程定位', '课程介绍', '课程封面', '课程大纲', '报名与定价']) {
    await advanceCourse();
    expect(currentCourseStep()).toBe(step);
  }
  const currency = host.querySelector<HTMLButtonElement>('button[aria-label="币种"]')!;
  expect(currency.textContent).toContain('人民币（CNY）');
  expect(host.querySelectorAll('form .platform-form-select')).toHaveLength(2);
  await act(async () => currency.click());
  const currencies = [...document.body.querySelectorAll<HTMLButtonElement>('.compact-select-popup[aria-label="币种"] [role="option"]')];
  expect(currencies.map(item => item.textContent)).toEqual(['人民币（CNY）', '美元（USD）']);
  await act(async () => currencies[1].click());
  expect(currency.textContent).toContain('美元（USD）');
  state.execute.mockResolvedValue({ course: { id: 'new-course' } });
  await fillCourseField('基础价格（美元）', '12.34');
  await advanceCourse();
  expect(currentCourseStep()).toBe('确认创建');
  expect(host.querySelector('.platform-wizard-review')?.textContent).toContain('USD 12.34');
  expect(state.execute).not.toHaveBeenCalled();
  await advanceCourse();
  expect(state.execute).toHaveBeenCalledWith(expect.objectContaining({ id: 'instructor-course-new' }), expect.objectContaining({ action: 'save-instructor-course', resourceId: undefined, payload: expect.objectContaining({ slug: 'fixture-course', titleZh: '测试课程', currency: 'USD', baseAmountMinor: 1234 }) }));
  expect(state.replace).toHaveBeenCalledWith('/zh/platform/instructor/courses/new-course');
  expect(localStorage.getItem('cuberoot:platform:course-create:v1:2')).toBeNull();
});

it('uploads both course covers without dropping other form edits and waits for uploads before creating the course', async () => {
  state.load.mockResolvedValue({ items: [{ id: 'fixture', title: 'Instructor', data: { instructorStatus: 'active' } }] });
  state.prepareImage.mockImplementation(async (file: File) => ({ dataB64: file.name, mime: 'image/webp' }));
  const resolve = new Map<string, (image: { id: number; url: string }) => void>();
  state.uploadImage.mockImplementation((name: string) => new Promise(done => resolve.set(name, done)));
  await render('instructor-course-new');
  await fillCourseField('中文标题', '测试课程');
  await fillCourseField('英文标题', 'Fixture Course');
  await advanceCourse();
  await fillCourseField('适合水平', '入门');
  await advanceCourse();
  await advanceCourse();
  expect(currentCourseStep()).toBe('课程封面');
  const form = host.querySelector<HTMLFormElement>('form.platform-domain-form')!;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const files = [...form.querySelectorAll<HTMLInputElement>('input[type="file"]')];
  expect(files).toHaveLength(2);
  await act(async () => {
    files.forEach((input, index) => {
      Object.defineProperty(input, 'files', { configurable: true, value: [new File(['test'], `cover-${index}.webp`, { type: 'image/webp' })] });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
  expect(submit.disabled).toBe(true);
  await advanceCourse();
  expect(currentCourseStep()).toBe('课程封面');
  expect(state.execute).not.toHaveBeenCalled();
  await act(async () => { resolve.get('cover-1.webp')!({ id: 2, url: 'https://api.example.com/portrait.webp' }); });
  expect(submit.disabled).toBe(true);
  await act(async () => { resolve.get('cover-0.webp')!({ id: 1, url: 'https://api.example.com/landscape.webp' }); });
  expect(submit.disabled).toBe(false);
  expect([...form.querySelectorAll('.platform-cover-preview img')].map(image => image.getAttribute('src'))).toEqual(['https://api.example.com/landscape.webp', 'https://api.example.com/portrait.webp']);
  await advanceCourse();
  expect(currentCourseStep()).toBe('课程大纲');
  await act(async () => [...form.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === '添加章节')!.click());
  await fillCourseField('章节', '第一章');
  await act(async () => [...form.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === '添加章节')!.click());
  expect([...form.querySelectorAll('label')].filter(label => label.querySelector('span')?.textContent === '章节')).toHaveLength(1);
  await advanceCourse();
  expect(currentCourseStep()).toBe('课程大纲');
  await fillCourseField('章节', '第二章');
  await advanceCourse();
  await advanceCourse();
  state.execute.mockResolvedValue({ course: { id: 'created' } });
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(state.execute).toHaveBeenCalledWith(expect.objectContaining({ id: 'instructor-course-new' }), expect.objectContaining({ payload: expect.objectContaining({
    titleZh: '测试课程', slug: expect.stringMatching(/^fixture-course-[a-f0-9-]+$/), baseAmountMinor: 0,
    presentation: expect.objectContaining({ level: '入门', coverUrl: 'https://api.example.com/landscape.webp', mobileCoverUrl: 'https://api.example.com/portrait.webp', outline: [{ label: '第一章' }, { label: '第二章' }] }),
  }) }));
});

it('restores the current step and both course introduction languages from an account-scoped local draft', async () => {
  state.load.mockResolvedValue({ items: [{ id: 'fixture', title: 'Instructor', data: { instructorStatus: 'active' } }] });
  await render('instructor-course-new');
  await fillCourseField('中文标题', '草稿课程');
  await fillCourseField('英文标题', 'Draft Course');
  await advanceCourse();
  await advanceCourse();
  await fillCourseField('中文摘要', '中文介绍');
  await act(async () => [...host.querySelectorAll<HTMLButtonElement>('.platform-wizard-copy-languages button')].find(button => button.textContent === 'English')!.click());
  await fillCourseField('英文摘要', 'English introduction');
  await act(async () => root.render(null));
  await render('instructor-course-new');
  expect(currentCourseStep()).toBe('课程介绍');
  expect([...host.querySelectorAll('textarea')].map(input => input.value)).toContain('中文介绍');
  await act(async () => [...host.querySelectorAll<HTMLButtonElement>('.platform-wizard-copy-languages button')].find(button => button.textContent === 'English')!.click());
  expect([...host.querySelectorAll('textarea')].map(input => input.value)).toContain('English introduction');
  await act(async () => [...host.querySelectorAll<HTMLButtonElement>('.platform-wizard-footer button')].find(button => button.textContent?.includes('上一步'))!.click());
  expect(currentCourseStep()).toBe('课程定位');
  await act(async () => root.render(null));
  state.user = { uid: 2 };
  await render('instructor-course-new');
  expect(currentCourseStep()).toBe('基本信息');
  expect([...host.querySelectorAll('input')].map(input => input.value)).not.toContain('草稿课程');
});

it('renders the managed course as a standalone editor without a redundant entity overview', async () => {
  state.managedQuizzes.mockResolvedValue({ items: [] });
  state.load.mockResolvedValue({ items: [{ id: 'course-test', title: '正在编辑的课程', data: {
    titleZh: '正在编辑的课程', titleEn: 'Editing course', slug: 'editing-course', currency: 'CNY', lessons: [
      { id: 'lesson-1', titleZh: '第一课', titleEn: 'First lesson', ordinal: 1, status: 'published', accessScope: 'public', slug: 'first-lesson' },
      { id: 'lesson-2', titleZh: '第二课', titleEn: 'Second lesson', ordinal: 2, status: 'draft', accessScope: 'entitled', slug: 'second-lesson' },
    ],
  } }] });
  await renderInShell('instructor-course', { id: 'course-test' });
  await act(async () => { await vi.dynamicImportSettled(); });
  const header = host.querySelector('.platform-instructor-course-editor-page .platform-route-header');
  expect(header?.querySelector('.back-home')?.getAttribute('aria-label')).toBe('返回讲师课程');
  expect(header?.querySelector('.back-home')?.getAttribute('href')).toBe('/platform/instructor/courses');
  expect(header?.querySelector('h1')?.classList.contains('sr-only')).toBe(true);
  expect(host.textContent).not.toContain('正在编辑的课程');
  expect([...host.querySelectorAll<HTMLInputElement>('form input')].some(input => input.value === '正在编辑的课程')).toBe(true);
  expect(host.querySelector('.platform-course-editor-heading')?.textContent).toContain('课时与测验');
  const manager = host.querySelector('.platform-instructor-lesson-manager')!;
  const courseInfo = host.querySelector('.platform-instructor-course-info')!;
  expect(manager.compareDocumentPosition(courseInfo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(manager.querySelector('.platform-course-editor-heading a')).toBeNull();
  expect(manager.textContent).not.toContain('新增课时');
  expect(manager.querySelector('form')).toBeNull();
  const lessonRows = [...manager.querySelectorAll('.platform-instructor-lesson-row')];
  expect(lessonRows).toHaveLength(2);
  expect(lessonRows[0].textContent).toContain('已发布');
  expect(state.managedQuizzes).not.toHaveBeenCalled();
  await act(async () => lessonRows[0].querySelector<HTMLButtonElement>('.platform-instructor-lesson-toggle')!.click());
  expect(lessonRows[0].querySelector('form')).not.toBeNull();
  expect(lessonRows[1].querySelector('form')).toBeNull();
  expect(state.managedQuizzes).toHaveBeenCalledTimes(1);
  expect(state.managedQuizzes).toHaveBeenCalledWith(expect.objectContaining({ lessonId: 'lesson-1' }));
  expect(courseInfo.textContent).toContain('归档课程');
  expect(state.execute).not.toHaveBeenCalled();
});

it('shows only course information when the managed course has no lessons', async () => {
  state.load.mockResolvedValue({ items: [{ id: 'empty-course', title: '空课程', data: { titleZh: '空课程', titleEn: 'Empty course', lessons: [] } }] });
  await renderInShell('instructor-course', { id: 'empty-course' });
  await act(async () => { await vi.dynamicImportSettled(); });
  expect(host.querySelector('.platform-instructor-lesson-manager')).toBeNull();
  expect(host.querySelector('.platform-instructor-course-info form')).not.toBeNull();
  expect(host.textContent).not.toContain('新增课时');
});

it('selects trial lessons from course information and saves the selection with the course', async () => {
  state.load.mockResolvedValue({ items: [{ id: 'trial-course', title: '课程', data: { titleZh: '课程', titleEn: 'Course', slug: 'trial-course', status: 'published', baseAmountMinor: 100, currency: 'CNY', enrollmentMode: 'purchase', presentation: { level: 'beginner' }, lessons: [
    { id: 'intro', slug: 'intro-1', titleZh: '引言', accessScope: 'public', status: 'published' },
    { id: 'first', slug: 'lesson-1', titleZh: '第一课', accessScope: 'entitled', status: 'published' },
    { id: 'second', slug: 'lesson-2', titleZh: '第二课', accessScope: 'public', status: 'published' },
    { id: 'archived', titleZh: '已归档课时', accessScope: 'entitled', status: 'archived' },
  ] } }] });
  state.execute.mockResolvedValue({ course: { id: 'trial-course' } });
  await renderInShell('instructor-course', { id: 'trial-course' });
  await act(async () => { await vi.dynamicImportSettled(); });
  const settings = host.querySelector('.platform-course-trial-settings')!;
  const switches = [...settings.querySelectorAll<HTMLButtonElement>('[role="switch"]')];
  expect(switches).toHaveLength(2);
  expect(switches.map(button => button.getAttribute('aria-checked'))).toEqual(['false', 'true']);
  await act(async () => switches[0].click());
  await act(async () => switches[1].click());
  expect(state.execute).not.toHaveBeenCalled();
  await act(async () => host.querySelector('.platform-instructor-course-info form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(state.execute).toHaveBeenCalledWith(expect.objectContaining({ id: 'instructor-course' }), expect.objectContaining({ action: 'save-instructor-course', resourceId: 'trial-course', payload: expect.objectContaining({ presentation: expect.objectContaining({ level: 'beginner', trialLessonIds: ['first'] }) }) }));
});

it('uploads a video before publishing an independent lesson and keeps its course scope', async () => {
  const key = 'cuberoot:platform:lesson-create:v1:1:course-upload-test';
  localStorage.setItem(key, JSON.stringify({ slug: 'lesson-draft', ordinal: 1, accessScope: 'public', titleZh: '', titleEn: '', bodyZh: '', bodyEn: '', mode: 'video' }));
  state.load.mockResolvedValue({ items: [{ id: 'course-upload-test', title: '测试课程', data: { enrollmentMode: 'purchase', lessons: [{ ordinal: 2 }, { ordinal: 9 }, { ordinal: 4 }] } }] });
  state.createUpload.mockResolvedValue({ id: 'upload-fixture', nodeId: 'node-fixture', receivedBytes: 0, chunkBytes: 4 });
  state.chunk.mockResolvedValue({ offset: 4, complete: true, nodeId: 'node-fixture' });
  state.execute.mockResolvedValue({ lesson: { id: 'new-lesson' } });
  await renderInShell('instructor-lesson-new', { id: 'course-upload-test' });
  await act(async () => { await vi.dynamicImportSettled(); });
  expect(host.querySelector('.back-home')?.getAttribute('aria-label')).toBe('返回讲师课程');
  expect(host.querySelector('.back-home')?.getAttribute('href')).toBe('/platform/instructor/courses');
  expect([...host.querySelectorAll('.platform-lesson-create-details label span')].map(label => label.textContent)).toEqual(['中文标题', '英文标题']);
  expect(host.querySelector('.platform-lesson-create-details select')).toBeNull();
  expect(host.querySelector('.platform-lesson-create-details input[type=number]')).toBeNull();
  const publish = [...host.querySelectorAll('button')].find(button => button.textContent === '提交审核')!;
  expect(publish.disabled).toBe(true);
  const input = host.querySelector<HTMLInputElement>('input[type=file]')!;
  await act(async () => {
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['mock'], 'lesson.mp4', { type: 'video/mp4', lastModified: 1 })] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(state.createUpload).toHaveBeenCalledWith(expect.objectContaining({ size: 4, type: 'video/mp4' }), null, expect.any(AbortSignal), expect.any(Object));
  expect(state.chunk).toHaveBeenCalledWith('upload-fixture', 0, expect.any(Blob), expect.any(AbortSignal), expect.any(Function), expect.any(Object));
  expect(publish.disabled).toBe(false);
  expect(state.execute).not.toHaveBeenCalled();
  await fillCourseField('中文标题', '新课时');
  expect(JSON.parse(localStorage.getItem(key)!).titleZh).toBe('新课时');
  await act(async () => publish.click());
  expect(state.execute).toHaveBeenCalledWith(expect.objectContaining({ id: 'instructor-lesson-new' }), expect.objectContaining({ action: 'save-course-lesson', resourceId: 'course-upload-test', payload: expect.objectContaining({ titleZh: '新课时', titleEn: '新课时', ordinal: 10, appendToCourse: true, driveVideo: 'node-fixture', status: 'published' }) }));
  expect(state.execute.mock.calls.at(-1)?.[1].payload).not.toHaveProperty('accessScope');
  expect(state.replace).toHaveBeenCalledWith('/zh/platform/instructor/courses');
  expect(localStorage.getItem(key)).toBeNull();
});

it('shows a submitted publication as pending and gives administrators explicit decision controls', async () => {
  const { PlatformContentReview } = await import('@/components/platform/PlatformContentReview');
  const runAction = vi.fn().mockResolvedValue({});
  const entity = { id: 'review-course', title: '待审核课程', status: 'draft', data: {
    reviewId: 'review-1', reviewStatus: 'pending', titleZh: '待审核课程', reviewTargetStatus: 'published',
    reviewMetadata: { currency: 'CNY', baseAmountMinor: 1000 }, descriptionZh: '课程介绍',
  } };
  await act(async () => root.render(createElement(PlatformContentReview, { entity, courseId: entity.id, admin: false, busy: null, runAction })));
  expect(host.textContent).toContain('待审核');
  expect(host.textContent).toContain('撤回审核');
  expect(host.textContent).not.toContain('审核通过并发布');
  await act(async () => root.render(createElement(PlatformContentReview, { entity, courseId: entity.id, admin: true, busy: null, runAction })));
  expect(host.textContent).toContain('课程介绍');
  const reject = [...host.querySelectorAll('button')].find(button => button.textContent === '驳回')!;
  expect(reject.disabled).toBe(true);
  const approve = [...host.querySelectorAll('button')].find(button => button.textContent === '审核通过并发布')!;
  await act(async () => approve.click());
  expect(runAction).toHaveBeenCalledWith('decide-content-review', entity.id, { reviewId: 'review-1', decision: 'approved', note: '' });
});

it.each([
  ['events', '搜索活动', '筛选活动'],
  ['news', '搜索资讯', '筛选资讯'],
] as const)('combines the %s collection query, real categories and sorting in the masthead', async (id, placeholder, filterTitle) => {
  state.user = null;
  state.load.mockImplementation(async (_resource, options) => ({
    categories: ['教学', '比赛'],
    items: options.query
      ? [{ id: 'item-1', title: '魔方比赛' }]
      : [{ id: 'item-1', title: '魔方比赛' }, { id: 'item-2', title: '教学内容' }],
  }));
  function Embedded() {
    const [binding, setBinding] = useState<PlatformSearchBinding | null>(null);
    return createElement('div', null, createElement(PlatformScopedSearch, { lang: 'zh', scope: id, binding }),
      createElement(PlatformNavigationContext, { value: true }, createElement(PlatformSearchContext, { value: { scope: id, routeId: id, bind: setBinding } },
        createElement(PlatformRouteView, { definition: PLATFORM_ROUTES.find(route => route.id === id)!, params }))));
  }
  await act(async () => root.render(createElement(Embedded)));
  expect(host.querySelector('.platform-toolbar')).toBeNull();
  expect(host.querySelector('.platform-scoped-search input')?.getAttribute('placeholder')).toBe(placeholder);
  await openFilters();
  expect(host.querySelector('.platform-filter-panel')?.getAttribute('aria-label')).toBe(filterTitle);
  expect(host.querySelector('.platform-filter-panel')?.textContent).toContain('教学');
  expect(host.querySelector('.platform-filter-panel')?.textContent).toContain('比赛');
  await clickFilterButton('比赛');
  await clickFilterButton('标题');
  expect(state.load).toHaveBeenCalledTimes(1);
  await clickFilterButton('应用筛选');
  expect(state.load).toHaveBeenLastCalledWith(id, expect.objectContaining({ category: '比赛', sort: 'title', page: 1 }));
  expect(host.querySelector('.platform-filter-count')?.textContent).toBe('2');
  vi.useFakeTimers();
  try {
    const input = host.querySelector<HTMLInputElement>('.platform-scoped-search input')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '魔方');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(state.load).toHaveBeenLastCalledWith(id, expect.objectContaining({ query: '魔方', category: '比赛', sort: 'title', page: 1 }));
    expect(host.textContent).not.toContain('教学内容');
    await openFilters();
    await clickFilterButton('重置');
    await clickFilterButton('应用筛选');
    expect(state.load).toHaveBeenLastCalledWith(id, expect.objectContaining({ query: '魔方', category: null, sort: 'updated', page: 1 }));
    expect(host.querySelector('.platform-filter-count')).toBeNull();
  } finally { vi.useRealTimers(); }
});

it.each(['events', 'news', 'paths', 'membership', 'leaderboard', 'teacher-apply'])('keeps the selected navigation as the visible section heading on %s', async id => {
  await renderInShell(id);
  expect(host.querySelector('h1')?.classList.contains('sr-only')).toBe(true);
  expect(host.querySelector('.platform-route-labels')).toBeNull();
  if (id === 'events') expect(host.querySelector('.platform-route-actions a[href="/platform/events/preview"]')).not.toBeNull();
  if (id === 'membership') expect(host.querySelector('.platform-route-header p')?.textContent).toContain('课程会员用于解锁课程');
});

it('preserves detail titles and visible headings when the corresponding workspace navigation is unavailable', async () => {
  state.admin = false;
  await renderInShell('admin-courses');
  expect(host.querySelector('h1')?.classList.contains('sr-only')).toBe(false);
  state.admin = true;
  await renderInShell('admin-courses');
  expect(host.querySelector('h1')?.classList.contains('sr-only')).toBe(true);
  state.load.mockResolvedValue({ items: [{ id: 'example', title: '实际活动名称', summary: '活动说明' }] });
  await renderInShell('event-detail', { id: 'example' });
  expect(host.querySelector('h1')?.textContent).toBe('实际活动名称');
  expect(host.querySelector('h1')?.classList.contains('sr-only')).toBe(false);
  expect(host.querySelector('.platform-route-labels')).toBeNull();
});

it.each(['course-section-introduction', 'course-section-trial', 'course-section-core', 'course-lesson'])('shows a fixed course detail back link in the classroom on %s', async id => {
  state.load.mockImplementation(async (resource: string) => ({ items: resource === 'courses'
    ? [{ id: 'course-1', title: 'Cube course', data: { titleZh: '三阶入门课程', titleEn: 'Cube course', lessonAccess: [] } }]
    : [{ id: 'lesson-1', title: '十字' }] }));
  await renderInShell(id, { id: 'course-1', lessonId: 'lesson-1' });
  const heading = host.querySelector('.platform-course-classroom .platform-route-header h1');
  expect(heading?.textContent).toBe(id === 'course-lesson' ? '十字' : '三阶入门课程');
  expect(heading?.classList.contains('sr-only')).toBe(true);
  const back = host.querySelector('.platform-course-classroom .platform-route-header .back-home');
  expect(back?.getAttribute('aria-label')).toBe('返回课程详情');
  expect(back?.getAttribute('href')).toBe('/platform/courses/course-1');
});

it.each([
  ['teacher-apply', undefined, '申请已提交，等待审核'],
  ['admin-applications', '张三', '张三'],
  ['admin-application', undefined, '未知申请人'],
] as const)('uses a human-readable application title on %s', async (id, applicantDisplayName, title) => {
  state.admin = id !== 'teacher-apply';
  const applicationId = '00000000-0000-4000-8000-000000000001';
  state.load.mockResolvedValue({ items: [{ id: applicationId, title: applicationId, status: 'pending', data: { applicantDisplayName } }] });
  await renderInShell(id, { id: applicationId });
  await act(async () => { await vi.dynamicImportSettled(); });
  expect(host.textContent).toContain(title);
  expect(host.textContent).not.toContain(applicationId);
});

it('introduces instructor benefits before the independent application flow, including for guests', async () => {
  state.user=null;
  await renderInShell('teacher-apply');
  expect(host.querySelector('.platform-admission-benefit-grid')?.children).toHaveLength(4);
  expect(host.querySelector('.platform-admission-cta a')?.getAttribute('href')).toBe('/account');
  expect(host.querySelector('form')).toBeNull();
  expect(state.load).not.toHaveBeenCalled();
  state.user={uid:1};
  await renderInShell('teacher-apply');
  await act(async()=>{await vi.dynamicImportSettled();});
  expect(host.querySelector('.platform-admission-cta a')?.getAttribute('href')).toBe('/platform/teachers/apply/start');
  expect(host.querySelector('form')).toBeNull();
});

it('keeps four application steps private until one final submission and preserves edits', async () => {
  state.execute.mockRejectedValueOnce(new Error('Connection interrupted'));
  state.execute.mockResolvedValueOnce({ok:true});
  await render('teacher-apply-start');
  expect(currentCourseStep()).toBe('基本资料');
  await advanceApplication();
  expect(currentCourseStep()).toBe('基本资料');
  expect(state.execute).not.toHaveBeenCalled();
  await fillCourseField('公开姓名（也用于课程作者）','测试讲师');
  await fillCourseField('所在城市（公开，线下授课必填）','上海');
  await advanceApplication();
  expect(currentCourseStep()).toBe('教学能力');
  const pickPuzzle=async(label:string)=>{
    await act(async()=>host.querySelector<HTMLButtonElement>('.platform-admission-specialty-options button[aria-haspopup="menu"]')!.click());
    await act(async()=>[...host.querySelectorAll<HTMLButtonElement>('.platform-admission-specialty-options .pp-item')].find(button=>button.querySelector('.pp-item-label')?.textContent===label)!.click());
  };
  const chooseTopic=async(label:string)=>act(async()=>[...host.querySelectorAll<HTMLButtonElement>('.platform-admission-specialty-options .platform-filter-option')].find(button=>button.textContent===label)!.click());
  const selectedSpecialties=()=>host.querySelector<HTMLTextAreaElement>('.platform-admission-specialties textarea')!.value;
  expect(host.querySelector<HTMLButtonElement>('.platform-admission-specialty-options .platform-filter-option')?.disabled).toBe(true);
  await pickPuzzle('三阶');
  expect(selectedSpecialties()).toBe('');
  await chooseTopic('入门复原');
  expect(selectedSpecialties()).toBe('三阶：入门复原');
  await chooseTopic('速度提升');
  await pickPuzzle('二阶');await chooseTopic('入门复原');
  expect(selectedSpecialties()).toBe('三阶：入门复原\n三阶：速度提升\n二阶：入门复原');
  await chooseTopic('入门复原');
  expect(selectedSpecialties()).toBe('三阶：入门复原\n三阶：速度提升');
  await pickPuzzle('三阶');await chooseTopic('速度提升');
  expect(selectedSpecialties()).toBe('三阶：入门复原');
  await fillCourseField('教学经历（审核专用）','私密教学经历');
  await advanceApplication();
  expect(currentCourseStep()).toBe('公开主页');
  await fillCourseField('中文介绍','欢迎学习三阶魔方');
  await fillCourseField('英文介绍','Learn the cube');
  await fillCourseField('邮箱','public@example.test');
  expect(host.querySelector('.directory-profile-preview')?.textContent).toContain('测试讲师');
  expect(host.querySelector('.directory-profile-preview')?.textContent).toContain('欢迎学习三阶魔方');
  expect(host.querySelector('.directory-profile-preview')?.textContent).not.toContain('私密教学经历');
  await advanceApplication();
  expect(currentCourseStep()).toBe('确认提交');
  await fillCourseField('审核联系信息（不公开）','demo@example.test');
  await act(async()=>host.querySelector<HTMLButtonElement>('.platform-admission-review-heading button')!.click());
  expect(currentCourseStep()).toBe('基本资料');
  expect([...host.querySelectorAll('input')].some(input=>input.value==='测试讲师')).toBe(true);
  await advanceApplication();await advanceApplication();await advanceApplication();
  expect([...host.querySelectorAll('textarea')].some(input=>input.value==='demo@example.test')).toBe(true);
  expect(state.execute).not.toHaveBeenCalled();
  await advanceApplication();
  expect(state.execute).toHaveBeenCalledTimes(1);
  expect(state.replace).not.toHaveBeenCalled();
  expect(currentCourseStep()).toBe('确认提交');
  expect([...host.querySelectorAll('textarea')].some(input=>input.value==='demo@example.test')).toBe(true);
  await advanceApplication();
  expect(state.execute).toHaveBeenCalledTimes(2);
  expect(state.execute).toHaveBeenCalledWith(expect.objectContaining({id:'teacher-apply-start'}),expect.objectContaining({action:'apply-instructor',payload:expect.objectContaining({publicName:'测试讲师',city:'上海',specialties:['三阶：入门复原'],experience:'私密教学经历',publicBio:'欢迎学习三阶魔方',contact:'demo@example.test',profileVisible:false,homepage:expect.objectContaining({descriptionZh:'欢迎学习三阶魔方',descriptionEn:'Learn the cube',contacts:{email:'public@example.test'}})})}));
  expect(state.createDirectory).not.toHaveBeenCalled();expect(state.updateDirectory).not.toHaveBeenCalled();
  expect(state.replace).toHaveBeenCalledWith('/platform/teachers/apply');
});

it.each([true,false])('can defer the public homepage without a biography and protects older APIs (supported=%s)',async supported=>{
  state.load.mockResolvedValue({items:[],instructorHomepageDraft:supported});
  if(supported)state.execute.mockResolvedValueOnce({ok:true});
  await render('teacher-apply-start');
  await fillCourseField('公开姓名（也用于课程作者）','待完善讲师');
  await fillCourseField('所在城市（公开，线下授课必填）','上海');
  await advanceApplication();
  await fillCourseField('擅长方向（公开，每行一项）','三阶：入门复原');
  await fillCourseField('教学经历（审核专用）','私密经历');
  await advanceApplication();
  expect(host.querySelector('.directory-editor-layout')).not.toBeNull();
  await act(async()=>[...host.querySelectorAll('button')].find(button=>button.textContent==='以后再设置')!.click());
  expect(currentCourseStep()).toBe('确认提交');
  expect(host.textContent).toContain('暂不公开');
  await fillCourseField('审核联系信息（不公开）','review@example.test');
  await advanceApplication();
  if(!supported){expect(state.execute).not.toHaveBeenCalled();expect(host.textContent).toContain('新版讲师申请需要更新服务');expect([...host.querySelectorAll('textarea')].some(field=>field.value==='review@example.test')).toBe(true);return;}
  const payload=state.execute.mock.calls[0][1].payload;
  expect(payload).toMatchObject({publicName:'待完善讲师',profileDeferred:true,profileVisible:false,publicBio:null,contact:'review@example.test'});
  expect(payload.homepage).toBeUndefined();
});

it('locks pending applications, restores rejected drafts and opens the approved instructor workspace', async () => {
  const id = 'demo-app';
  const data = { application: { publicName:'测试讲师',publicBio:'简介',city: '上海', teachingMode: 'both', experience: '教学经历样例', specialties: ['三阶'], contact: 'demo@example.test' }, createdAt: '2026-11-19T00:00:00Z' };
  const show = async (status: string, extra: Record<string, unknown> = {}) => {
    state.load.mockResolvedValue({ items: [{ id, title: id, status, data: { ...data, ...extra } }] });
    await renderInShell('teacher-apply', { id: status });
    await act(async () => { await vi.dynamicImportSettled(); });
  };
  await show('pending');
  expect(host.textContent).toContain('等待审核');
  expect(host.querySelector('form')).toBeNull();
  await show('rejected', { decisionNote: '补充教学成果' });
  expect(host.textContent).toContain('补充教学成果');
  expect(host.querySelector('a[href="/platform/teachers/apply/start"]')).not.toBeNull();
  await render('teacher-apply-start');await advanceApplication();
  expect([...host.querySelectorAll('textarea')].some(textarea => textarea.value === '教学经历样例')).toBe(true);
  await show('approved', { instructorStatus: 'active', teacherEntryId: 42, profileVisible: false });
  expect(host.querySelector('a[href="/platform/instructor"]')).toBeNull();
  expect(host.textContent).toContain('注销讲师身份');
  expect(host.textContent).toContain('当前资料已隐藏');
  expect(host.querySelector('form')).toBeNull();
});

it('lets archived instructors apply again, preserves pending review and blocks suspended instructors', async () => {
  const id = 'demo-archived-app';
  const data = { application: { publicName:'测试讲师',publicBio:'简介',city: '上海', teachingMode: 'both', experience: '原教学经历', specialties: ['三阶'], contact: 'demo@example.test' } };
  const show = async (status: string, instructorStatus: string) => {
    state.load.mockResolvedValue({ items: [{ id, title: id, status, data: { ...data, instructorStatus } }] });
    await renderInShell('teacher-apply', { id: `${status}-${instructorStatus}` });
    await act(async () => { await vi.dynamicImportSettled(); });
  };
  await show('approved', 'archived');
  expect(host.textContent).toContain('讲师身份已结束');
  expect(host.querySelector('a[href="/platform/teachers/apply/start"]')).not.toBeNull();
  await render('teacher-apply-start');await advanceApplication();
  expect([...host.querySelectorAll('textarea')].some(textarea => textarea.value === '原教学经历')).toBe(true);
  await show('pending', 'archived');
  expect(host.textContent).toContain('等待审核');
  expect(host.querySelector('form')).toBeNull();
  await show('approved', 'suspended');
  expect(host.textContent).toContain('讲师权限已暂停');
  expect(host.querySelector('form')).toBeNull();
  await show('approved', 'active');
  expect(host.querySelector('a[href="/platform/instructor"]')).toBeNull();
  expect(host.textContent).toContain('注销讲师身份');
});

it('confirms self-archival, refreshes the workspace entry and shows the reapplication state', async () => {
  const refresh = vi.fn();
  const active = { id: 'application', title: 'application', status: 'approved', data: { instructorStatus: 'active' } };
  state.load.mockResolvedValue({ items: [active] });
  state.execute.mockImplementationOnce(async () => {
    state.load.mockResolvedValue({ items: [{ ...active, data: { instructorStatus: 'archived' } }] });
    return { ok: true };
  });
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  try {
    await act(async () => root.render(createElement(PlatformNavigationContext, { value: true },
      createElement(PlatformInstructorAccessRefreshContext, { value: refresh }, createElement(PlatformRouteView, {
        definition: PLATFORM_ROUTES.find(route => route.id === 'teacher-apply')!, params: {},
      })))));
    await act(async () => { await vi.dynamicImportSettled(); });
    const button = [...host.querySelectorAll('button')].find(item => item.textContent === '注销讲师身份')!;
    await act(async () => button.click());
    expect(state.execute).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    await act(async () => button.click());
    expect(state.execute).toHaveBeenCalledWith(expect.objectContaining({ id: 'teacher-apply' }), expect.objectContaining({ action: 'archive-instructor', resourceId: undefined }));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('讲师身份已结束');
    expect(host.textContent).not.toContain('注销讲师身份');
  } finally { confirm.mockRestore(); }
});

it('shows the actual owned teaching profile within the instructor workspace and denies inactive accounts', async () => {
  const profile = { id: 42, kind: 'teacher', nameZh: '演示讲师', nameEn: 'Demo instructor', locationZh: '上海', locationEn: 'Shanghai', specialtiesZh: ['三阶'], specialtiesEn: ['3x3'], teachingMode: 'both', descriptionZh: '教学履历', descriptionEn: '', contacts: { wechat: 'demo' }, website: '', wcaId: '', isVisible: false, images: [{ id: 1, url: '/test-photo.png', kind: 'portrait', captionZh: '形象照', captionEn: '' }] };
  state.myDirectory.mockReset().mockResolvedValue([profile]);
  state.load.mockResolvedValue({ items: [{ id: 'fixture', title: 'fixture', data: { instructorStatus: 'active', instructorDisplayName: '示例账号', teacherEntryId: 42 } }] });
  await renderInShell('instructor-profile');
  await act(async () => { await vi.dynamicImportSettled(); });
  expect(host.textContent).toContain('演示讲师');
  expect(host.textContent).toContain('教学履历');
  expect(host.textContent).toContain('仅自己可见');
  expect(host.querySelector('form.directory-form')).not.toBeNull();
  expect(host.querySelector('.directory-preview-photo')?.getAttribute('src')).toBe('/test-photo.png');
  expect([...host.querySelectorAll('form.directory-form input')].some(input => (input as HTMLInputElement).value === 'demo')).toBe(true);
  state.updateDirectory.mockResolvedValue({ ...profile, nameZh: '更新讲师' });
  await fillCourseField('中文名称', '更新讲师');
  await act(async () => host.querySelector('form.directory-form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(state.updateDirectory).toHaveBeenCalledWith(42, expect.objectContaining({ nameZh: '更新讲师', contacts: { wechat: 'demo' }, images: profile.images }));
  expect(state.createDirectory).not.toHaveBeenCalled();
  expect(host.textContent).toContain('个人主页已保存');
  expect(host.querySelector('form.directory-form')).not.toBeNull();
  expect(host.querySelector('a[href="/platform/teachers/apply"]')).toBeNull();
  state.myDirectory.mockClear();
  state.load.mockResolvedValue({ items: [{ id: 'fixture', title: 'fixture', data: { instructorStatus: 'archived' } }] });
  await renderInShell('instructor-profile', { id: 'archived' });
  await act(async () => { await vi.dynamicImportSettled(); });
  expect(host.textContent).toContain('当前账号没有可用的讲师权限');
  expect(host.textContent).not.toContain('演示讲师');
  expect(state.myDirectory).not.toHaveBeenCalled();
});

it('automatically connects a uniquely owned legacy profile and does not offer editing for ambiguous records', async () => {
  const profile = { id: 42, kind: 'teacher', nameZh: '历史资料', nameEn: '', locationZh: '', locationEn: '', specialtiesZh: [], specialtiesEn: [], teachingMode: 'both', descriptionZh: '教学简介', descriptionEn: '', contacts: {}, website: '', wcaId: '', isVisible: false, images: [] };
  state.myDirectory.mockResolvedValue([profile]);
  const active = { id: 'fixture', title: 'fixture', data: { instructorStatus: 'active', directoryProfiles: [{ id: 42 }] } };
  state.load.mockResolvedValue({ items: [active] });
  state.execute.mockImplementationOnce(async () => {
    state.load.mockResolvedValue({ items: [{ ...active, data: { ...active.data, teacherEntryId: 42 } }] });
    return { ok: true };
  });
  await renderInShell('instructor-profile');
  await act(async () => { await vi.dynamicImportSettled(); });
  expect(host.textContent).not.toContain('接入已有个人主页');
  expect(state.execute).toHaveBeenCalledWith(expect.objectContaining({ id: 'instructor-profile' }), expect.objectContaining({ action: 'link-instructor-profile', payload: { teacherEntryId: 42 } }));
  expect(host.querySelector('form.directory-form')).not.toBeNull();
  state.myDirectory.mockResolvedValue([profile, { ...profile, id: 43 }]);
  state.load.mockResolvedValue({ items: [{ ...active, data: { instructorStatus: 'active', directoryProfiles: [{ id: 42 }, { id: 43 }] } }] });
  await renderInShell('instructor-profile', { id: 'ambiguous' });
  await act(async () => { await vi.dynamicImportSettled(); });
  expect(host.querySelector('form.directory-form')).toBeNull();
  expect(host.textContent).toContain('请联系管理员');
  state.myDirectory.mockResolvedValue([profile]);
  state.load.mockResolvedValue({ items: [{ ...active, data: { instructorStatus: 'active', instructorProfileKnown: false } }] });
  await renderInShell('instructor-profile', { id: 'legacy-api' });
  await act(async () => { await vi.dynamicImportSettled(); });
  expect(host.querySelector('form.directory-form')).not.toBeNull();
  expect(host.textContent).not.toContain('接入已有个人主页');
});

it('automatically creates a hidden homepage for an active instructor with no legacy profile', async () => {
  const active = { id: 'fixture', title: 'fixture', data: { instructorStatus: 'active', teacherEntryId: null, directoryProfiles: [] } };
  state.myDirectory.mockResolvedValue([]);
  state.load.mockResolvedValue({ items: [active] });
  state.execute.mockImplementationOnce(async () => {
    state.myDirectory.mockResolvedValue([{ id: 42, kind: 'teacher', nameZh: '新讲师', nameEn: '', locationZh: '', locationEn: '', specialtiesZh: [], specialtiesEn: [], teachingMode: 'both', descriptionZh: '', descriptionEn: '', contacts: {}, website: '', wcaId: '', isVisible: false, images: [] }]);
    state.load.mockResolvedValue({ items: [{ ...active, data: { ...active.data, teacherEntryId: 42 } }] });
    return { ok: true, teacherEntryId: 42 };
  });
  await renderInShell('instructor-profile');
  await act(async () => { await vi.dynamicImportSettled(); });
  expect(host.textContent).not.toContain('创建个人主页');
  expect(host.textContent).not.toContain('请联系管理员');
  expect(state.execute).toHaveBeenCalledTimes(1);
  expect(state.execute).toHaveBeenCalledWith(expect.objectContaining({ id: 'instructor-profile' }), expect.objectContaining({ action: 'initialize-instructor-profile' }));
  expect(host.querySelector('form.directory-form')).not.toBeNull();
  expect(host.textContent).toContain('仅自己可见');
});

it('does not continuously retry a failed automatic profile repair', async () => {
  state.myDirectory.mockResolvedValue([]);
  state.load.mockResolvedValue({ items: [{ id: 'fixture', title: 'fixture', data: { instructorStatus: 'active', teacherEntryId: null, directoryProfiles: [] } }] });
  state.execute.mockRejectedValueOnce(new Error('Profile unavailable'));
  await renderInShell('instructor-profile');
  await act(async () => { await vi.dynamicImportSettled(); });
  expect(state.execute).toHaveBeenCalledTimes(1);
  expect(host.textContent).toContain('个人主页暂时无法同步');
  expect(host.querySelector('form.directory-form')).toBeNull();
});

it('blocks guests and ordinary accounts before requesting admin resources, then permits admin loading', async () => {
  state.user = null;
  await render('admin-courses');
  expect(state.load).not.toHaveBeenCalled();
  expect(host.textContent).toContain('请先登录');
  state.user = { uid: 1 };
  await render('admin-courses');
  expect(state.load).not.toHaveBeenCalled();
  state.admin = true;
  state.load.mockResolvedValue({ items: [{ id: 'course', title: '管理课程 fixture' }] });
  await render('admin-courses');
  expect(state.load).toHaveBeenCalledWith('admin-courses', expect.anything());
  expect(host.textContent).toContain('管理课程 fixture');
});

it('shows instructor data only after a successful instructor response and handles denial', async () => {
  state.learning.mockResolvedValueOnce({ courseCount: 3, studentCount: 5, currentMonth:'2026-11',availableMinor:1200,availableCurrency:'CNY',recentCourses:[{id:'course-1',titleZh:'近期课程示例',status:'published',publishedLessons:2,learnerCount:3}], months: [{month:'2026-10',currency:'CNY',netAmountMinor:1000},{month:'2026-11',currency:'CNY',netAmountMinor:2500},{month:'2026-11',currency:'USD',netAmountMinor:3500}], payouts: [], recent: [{id:'preview-order',studentName:'示例学员',currency:'CNY',amountMinor:2500,createdAt:'2026-11-21T00:00:00Z'}] });
  await render('instructor');
  expect(state.learning).toHaveBeenCalledWith('/instructor/dashboard?view=overview&v=2', undefined, 'GET', expect.any(AbortSignal));
  expect(host.textContent).toContain('课程管理');
  expect(host.querySelector('.platform-instructor-metrics')?.textContent).toContain('2026-11');
  expect(host.querySelector('.platform-instructor-metrics')?.textContent).not.toContain('2026-10');
  expect(host.querySelector('.platform-instructor-metrics')?.textContent).toContain('可提现金额');
  expect(host.querySelector('.platform-studio-course-list')?.textContent).toContain('近期课程示例');
  expect(host.querySelector('.platform-instructor-activity-list')?.textContent).toContain('示例学员');
  expect([...host.querySelectorAll('.platform-instructor-task-grid a')].map(link=>link.getAttribute('href'))).toEqual(['/platform/instructor/courses','/platform/instructor/students','/platform/instructor/earnings','/platform/instructor/profile']);
  expect(host.textContent).not.toContain('月度收入');
  state.user = { uid: 2 };
  state.learning.mockRejectedValueOnce(new Error('Instructor access required'));
  await render('instructor');
  expect(host.textContent).toContain('Instructor access required');
  expect(host.textContent).not.toContain('课程管理');
});

it('opens the earnings task with financial details and payout controls, without repeating the workspace overview', async () => {
  state.learning.mockResolvedValueOnce({ courseCount:3,studentCount:5,months:[],payouts:[],recent:[],currentMonth:'2026-11',availableMinor:0,availableCurrency:'CNY' });
  await render('instructor-earnings');
  expect(host.textContent).toContain('月度收入');
  expect(host.textContent).not.toContain('收款方式');
  expect(host.querySelector('.platform-instructor-task-grid')).toBeNull();
  expect(host.textContent).not.toContain('有效学员');
  expect(host.textContent).toContain('暂无收入记录');
  const transactionButton=[...host.querySelectorAll('button')].find(button=>button.textContent==='交易明细')!;
  state.learning.mockResolvedValueOnce({items:[],total:0});
  await act(async()=>transactionButton.click());
  expect(state.learning).toHaveBeenCalledWith('/instructor/earnings?page=1&pageSize=5&v=2',undefined,'GET',expect.any(AbortSignal));
  expect(host.textContent).toContain('暂无交易记录');
  const select=host.querySelector<HTMLSelectElement>('.platform-instructor-earnings > .platform-pagination:last-child select')!;
  expect([...select.options].map(option=>option.value)).toEqual(['5','10','20']);
  expect(select.value).toBe('5');
  state.learning.mockResolvedValueOnce({items:[],total:0});
  await act(async()=>{select.value='10';select.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(state.learning).toHaveBeenLastCalledWith('/instructor/earnings?page=1&pageSize=10&v=2',undefined,'GET',expect.any(AbortSignal));
  await act(async()=>[...host.querySelectorAll('button')].find(button=>button.textContent==='收款与结算')!.click());
  expect(host.textContent).toContain('收款方式');
  state.learning.mockResolvedValueOnce({items:[],total:0});
  await act(async()=>[...host.querySelectorAll('button')].find(button=>button.textContent==='交易明细')!.click());
  expect(host.querySelector('.platform-instructor-earnings > .platform-pagination:last-child')).not.toBeNull();
});

it('uses actual older API data when overview extensions are not deployed yet', async () => {
  state.learning.mockResolvedValueOnce({courseCount:2,studentCount:1,months:[{month:'2026-10',currency:'CNY',netAmountMinor:1200}],recent:[]});
  state.learning.mockResolvedValueOnce({courses:[{id:'old',titleZh:'已归档示例',status:'archived'},{id:'live',titleZh:'当前课程',status:'published',lessons:[{status:'published'},{status:'draft'}]}]});
  state.learning.mockResolvedValueOnce({availableMinor:300,payouts:[]});
  await render('instructor');
  expect(host.textContent).toContain('最近月净收入');
  expect(host.querySelector('.platform-studio-course-list')?.textContent).toContain('当前课程');
  expect(host.querySelector('.platform-studio-course-list')?.textContent).toContain('1 节已发布课时');
  expect(host.querySelector('.platform-studio-course-list')?.textContent).not.toContain('已归档示例');
  expect(host.querySelector('.platform-studio-course-list')?.textContent).not.toContain('位有效学员');
  expect(host.querySelector('.platform-studio-metrics')?.textContent).toContain('3.00');
});

it('draws negative ledger months on the negative side and keeps all recorded months', async () => {
  const months=Array.from({length:13},(_,index)=>({month:`${index===12?'2025':'2026'}-${String(index===12?12:12-index).padStart(2,'0')}`,currency:'CNY',orders:1,saleAmountMinor:1000,refundAmountMinor:index===0?-1500:0,netAmountMinor:index===0?-500:1000}));
  state.learning.mockResolvedValueOnce({months,payouts:[],currentMonth:'2026-12',availableMinor:0,availableCurrency:'CNY'});
  await render('instructor-earnings');
  expect(host.querySelectorAll('.platform-studio-chart-row')).toHaveLength(12);
  expect(host.querySelector('.platform-studio-chart-negative i')).not.toBeNull();
  expect(host.querySelectorAll('.platform-studio-month-table tbody tr')).toHaveLength(13);
});

it('shows learner progress, retries certificate issuance with the same operation key, and prevents another issuance after success', async () => {
  state.learning.mockResolvedValueOnce({ items: [{ id:'entitlement',userId:'12',title:'测试学员',courseId:'course',courseTitle:'测试课程',status:'active',completedLessons:2,totalLessons:3,hasCertificate:false }], total:1 });
  state.learning.mockRejectedValueOnce(new Error('Connection interrupted'));
  state.learning.mockResolvedValueOnce({ id:'certificate',verificationCode:'verification-code' });
  await render('instructor-students');
  expect(state.learning).toHaveBeenCalledWith('/instructor/students?page=1&pageSize=5&v=2',undefined,'GET',expect.any(AbortSignal));
  const select=host.querySelector<HTMLSelectElement>('.platform-learning-workspace > .platform-pagination:last-child select')!;
  expect([...select.options].map(option=>option.value)).toEqual(['5','10','20']);
  expect(select.value).toBe('5');
  expect(host.querySelector('progress')?.value).toBe(2);
  const issue=[...host.querySelectorAll('button')].find(button=>button.textContent==='签发证书')!;
  await act(async()=>issue.click());
  expect(host.textContent).toContain('签发结果未确认');
  await act(async()=>[...host.querySelectorAll('button')].find(button=>button.textContent==='重试签发')!.click());
  const writes=state.learning.mock.calls.filter(args=>args[0]==='/instructor/certificates');
  expect(writes).toHaveLength(2);expect(writes[0][4]).toBe(writes[1][4]);
  expect(host.textContent).toContain('已签发证书');
  expect(host.querySelector('a[href="/platform/cert/verification-code"]')).not.toBeNull();
  expect([...host.querySelectorAll('button')].some(button=>button.textContent==='签发证书')).toBe(false);
});

it('does not continue a former account redemption after its response arrives', async () => {
  let finish!: (result: PlatformActionResult) => void;
  state.execute.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await render('account-invites');
  let pending!: Promise<PlatformActionResult | undefined>;
  await act(async () => { pending = state.action!('redeem-invite', undefined, { code: 'OLD-ACCOUNT' }); });
  state.user = { uid: 2 };
  await render('account-invites');
  await act(async () => { finish({ entitlementId: 'old-entitlement' }); await pending; });
  expect(state.load).not.toHaveBeenCalled();
  expect(state.entry).not.toHaveBeenCalled();
  expect(await pending).toBeUndefined();
});

it('drops old account data even when a resource ignores its aborted signal', async () => {
  let finish!: (result: unknown) => void;
  state.load.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockResolvedValueOnce({ items: [{ id: 'new', title: '当前账号订单' }] });
  await render('orders');
  const oldSignal = state.load.mock.calls[0][1].signal as AbortSignal;
  state.user = { uid: 2 };
  await render('orders');
  expect(oldSignal.aborted).toBe(true);
  await act(async () => finish({ items: [{ id: 'old', title: '旧账号订单' }] }));
  expect(host.textContent).toContain('当前账号订单');
  expect(host.textContent).not.toContain('旧账号订单');
});

it('discards cancelled path progress and clears a previous error after account refresh', async () => {
  let finish!: (value: unknown) => void;
  const entity = { id: 'path', title: '路径', data: { items: [{ courseId: 'course', title: '课程', totalLessons: 10 }] } };
  state.learning.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockResolvedValueOnce({ items: [] })
    .mockRejectedValueOnce(new Error('网络暂不可用'))
    .mockResolvedValueOnce({ items: [] });
  const renderPath = () => root.render(createElement(PlatformLearningPath, { entity }));
  await act(async () => renderPath());
  const oldSignal = state.learning.mock.calls[0][3] as AbortSignal;
  state.user = { uid: 1 };
  await act(async () => renderPath());
  expect(oldSignal.aborted).toBe(true);
  expect(host.textContent).toContain('网络暂不可用');
  state.learning.mockResolvedValueOnce({ items: [{ id: 'course', completedLessons: 2, totalLessons: 10, progressBps: 2000 }] })
    .mockResolvedValueOnce({ items: [] });
  state.user = { uid: 1 };
  await act(async () => renderPath());
  expect(host.textContent).not.toContain('网络暂不可用');
  await act(async () => finish({ items: [{ id: 'course', completedLessons: 10, totalLessons: 10, progressBps: 10000 }] }));
  expect(host.textContent).toContain('整体进度 2/10');
  expect(host.textContent).not.toContain('整体进度 10/10');
});
