// @vitest-environment jsdom
import { act, createElement, useLayoutEffect, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { TeachingLearningContext } from '@cuberoot/shared/teaching';

const mocks = vi.hoisted(() => ({ user: null as null | { uid: number }, contexts: vi.fn(), orgContexts: vi.fn(), organization: vi.fn(), organizations: vi.fn(), createOrganization: vi.fn(), t: (zh: string) => zh }));
vi.mock('@/hooks/useT', () => ({ useT: () => mocks.t }));
vi.mock('@/lib/auth-store', () => ({ useAuthUser: () => mocks.user, getSessionToken: () => mocks.user ? `fixture-${mocks.user.uid}` : '', nextQuery: () => '', hasAdminAccess: () => false }));
vi.mock('@/lib/teaching-saas-api', () => ({ listTeachingLearningContexts: mocks.contexts, listTeachingOrganizationLearningContexts: mocks.orgContexts, getTeachingOrganization: mocks.organization, listTeachingOrganizations: mocks.organizations, createTeachingOrganization: mocks.createOrganization }));
vi.mock('next/navigation', () => ({ usePathname: () => '/org/fixture' }));
vi.mock('@/components/AppLink', () => ({ default: ({ children, href }: { children: ReactNode; href: string }) => createElement('a', { href }, children) }));
vi.mock('@/components/PageHeading', () => ({ default: ({ children }: { children: ReactNode }) => createElement('h1', {}, children) }));
vi.mock('@/components/BackHome', () => ({ default: () => null }));
vi.mock('@/components/PageBackLink', () => ({ default: () => null }));
vi.mock('@/components/teaching/TeachingUi', () => ({ MutationMessage: ({ message }: { message: string }) => message, teachingErrorMessage: (reason: Error) => reason.message }));
vi.mock('@/app/[lang]/org/_components/OrgUi', () => ({ MutationMessage: ({ message }: { message: string }) => message, teachingErrorMessage: (reason: Error) => reason.message, teachingRoleLabel: (role: string) => role, useOperationKey: () => ({ get: () => 'fixture-key', reset: vi.fn() }) }));
vi.mock('@/app/[lang]/org/_components/EnterpriseVerificationAdmin', () => ({ default: () => null }));
import LearningCenterPage from '@/app/[lang]/learn/page';
import OrganizationsPage from '@/app/[lang]/org/page';
import OrgWorkspace from '@/app/[lang]/org/_components/OrgWorkspace';
import LearnerWorkspace from '@/components/teaching/LearnerWorkspace';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement;
beforeEach(() => { vi.clearAllMocks(); mocks.user = { uid: 1 }; host = document.createElement('div'); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); });
const context = (kind: 'student' | 'guardian', name: string): TeachingLearningContext => ({
  organization: { id: `org-${name}`, slug: name, name: `机构 ${name}`, timezone: 'Asia/Shanghai', status: 'active' },
  student: { id: `student-${name}`, displayName: `学员 ${name}`, status: 'active' },
  relationships: kind === 'student' ? [{ kind: 'student' }] : [{ kind: 'guardian', guardianLinkId: 'guardian', relationship: '家长' }],
} as TeachingLearningContext);

it('renders student training access and guardian learner links from their own contexts', async () => {
  mocks.contexts.mockResolvedValueOnce([context('student', 'self')]).mockResolvedValueOnce([context('guardian', 'child')]);
  await act(async () => root.render(createElement(LearningCenterPage)));
  expect(host.querySelector('a[href="/training/self"]')).not.toBeNull();
  expect(host.textContent).toContain('本人');
  mocks.user = { uid: 2 };
  await act(async () => root.render(createElement(LearningCenterPage)));
  expect(host.querySelector('a[href="/learn/child/students/student-child"]')).not.toBeNull();
  expect(host.textContent).toContain('监护人：家长');
  expect(host.querySelector('a[href^="/training/"]')).toBeNull();
});

it('removes previous student training links immediately while the next account loads', async () => {
  let finish!: (value: TeachingLearningContext[]) => void;
  mocks.contexts.mockResolvedValueOnce([context('student', 'private')]).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => root.render(createElement(LearningCenterPage)));
  expect(host.textContent).toContain('机构 private');
  mocks.user = { uid: 2 };
  await act(async () => root.render(createElement(LearningCenterPage)));
  expect(host.textContent).not.toContain('机构 private');
  expect(host.querySelector('a[href="/training/private"]')).toBeNull();
  await act(async () => finish([context('guardian', 'current')]));
  expect(host.textContent).toContain('学员 current');
});

it('does not let an old institution request overwrite a later account', async () => {
  let finish!: (value: unknown[]) => void;
  mocks.organizations.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockResolvedValueOnce([{ id: 'new', slug: 'new', name: '新机构', role: 'owner', status: 'active' }]);
  await act(async () => root.render(createElement(OrganizationsPage)));
  mocks.user = { uid: 2 };
  await act(async () => root.render(createElement(OrganizationsPage)));
  expect(host.textContent).toContain('新机构');
  await act(async () => finish([{ id: 'old', slug: 'old', name: '旧账号私有机构', role: 'owner', status: 'active' }]));
  expect(host.textContent).not.toContain('旧账号私有机构');
  expect(host.textContent).toContain('新机构');
});

it('does not request private learner or institution resources for guests', async () => {
  mocks.user = null;
  await act(async () => root.render(createElement(LearningCenterPage)));
  expect(mocks.contexts).not.toHaveBeenCalled();
  expect(host.textContent).toContain('登录');
  await act(async () => root.render(createElement(OrganizationsPage)));
  expect(mocks.organizations).not.toHaveBeenCalled();
});

it('remounts organization children before loading a different account or organization', async () => {
  let finish!: (value: unknown) => void;
  mocks.organization.mockResolvedValueOnce({ id: 'old', slug: 'fixture', name: '原账号机构', role: 'owner', status: 'active' })
    .mockResolvedValueOnce({ id: 'old', slug: 'fixture', name: '原账号机构', role: 'owner', status: 'active' })
    .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockResolvedValueOnce({ id: 'other', slug: 'other', name: '另一个机构', role: 'teacher', status: 'active' });
  let mounts = 0;
  function PrivateDraft() {
    const [owner] = useState(() => { mounts++; return mocks.user?.uid; });
    return createElement('p', {}, `私有草稿 ${owner}`);
  }
  const render = (orgSlug = 'fixture') => root.render(createElement(OrgWorkspace, { orgSlug, children: () => createElement(PrivateDraft) }));
  await act(async () => render());
  expect(host.textContent).toContain('私有草稿 1');
  mocks.user = { uid: 1 };
  await act(async () => render());
  expect(mounts).toBe(1);
  mocks.user = { uid: 2 };
  await act(async () => render());
  expect(host.textContent).not.toContain('原账号机构');
  expect(host.textContent).not.toContain('私有草稿 1');
  await act(async () => render('other'));
  await act(async () => finish({ id: 'stale', slug: 'fixture', name: '延迟机构', role: 'owner', status: 'active' }));
  expect(host.textContent).toContain('另一个机构');
  expect(host.textContent).toContain('私有草稿 2');
  expect(host.textContent).not.toContain('延迟机构');
});

it('never commits the former learner context or child draft after account changes', async () => {
  const commits: string[] = [];
  let finish!: (value: TeachingLearningContext[]) => void;
  mocks.orgContexts.mockResolvedValueOnce([context('student', 'self')])
    .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  function PrivateView({ isSelf }: { isSelf: boolean }) {
    const [draftOwner] = useState(() => mocks.user?.uid);
    useLayoutEffect(() => { commits.push(`${mocks.user?.uid}:${isSelf}:${draftOwner}`); });
    return createElement('p', {}, `草稿 ${draftOwner}`);
  }
  const render = () => root.render(createElement(LearnerWorkspace, {
    orgSlug: 'self', studentId: 'student-self', children: (_context, isSelf) => createElement(PrivateView, { isSelf }),
  }));
  await act(async () => render());
  expect(host.textContent).toContain('学员本人');
  mocks.user = { uid: 2 };
  await act(async () => render());
  expect(commits).not.toContain('2:true:1');
  expect(host.textContent).not.toContain('草稿 1');
  await act(async () => finish([context('guardian', 'self')]));
  expect(host.textContent).toContain('监护人：家长');
  expect(host.textContent).toContain('草稿 2');
  expect(host.querySelector('a[href^="/training/"]')).toBeNull();
});
