// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { expect, it, vi } from 'vitest';
import type { TeacherDirectoryEntry } from '@/lib/teacher-directory-api';

const mocks = vi.hoisted(() => ({ publicEntries: vi.fn(), ownedEntries: vi.fn() }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('Not found'); } }));
vi.mock('@/components/platform/PlatformRouteView', () => ({ PlatformRouteView: () => { throw new Error('Unexpected generic route'); } }));
vi.mock('@/lib/platform-metadata', () => ({ platformPageMetadata: () => ({}) }));
vi.mock('@/lib/teacher-directory-api', async original => ({ ...await original<object>(), fetchTeacherDirectory: mocks.publicEntries, fetchMyTeacherDirectory: mocks.ownedEntries }));
vi.mock('@/lib/teacher-live-scripts-api', () => ({ fetchTeacherLiveScripts: async () => [] }));
vi.mock('@/lib/auth-store', () => ({ useOwnerKey: () => 'user-1', useIsAdmin: () => true }));
vi.mock('@/i18n/tr', () => ({ tr: ({ zh }: { zh: unknown }) => zh }));
vi.mock('@/hooks/useT', () => ({ useT: () => (zh: string) => zh }));
vi.mock('@/components/AppLink', () => ({ default: ({ href, className, children }: React.ComponentProps<'a'>) => createElement('a', { href, className }, children) }));
vi.mock('@/components/BackHome', () => ({ default: () => null }));
vi.mock('@/components/PersonLink', () => ({ default: () => null }));
vi.mock('@/components/SearchInput', () => ({ default: () => null }));
vi.mock('@/components/platform/PlatformTeacherCourses', () => ({ PlatformTeacherCourses: () => null }));

import TeachersPage from '@/app/[lang]/teachers/page';
import PlatformSubpage from '@/app/[lang]/platform/[...segments]/page';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function entry(id: number, nameZh: string, overrides: Partial<TeacherDirectoryEntry> = {}): TeacherDirectoryEntry {
  return { id, nameZh, nameEn: '', kind: 'teacher', instructorStatus: 'active', isVisible: true, isCurated: false,
    locationZh: '', locationEn: '', specialtiesZh: [], specialtiesEn: [], teachingMode: 'both', descriptionZh: '', descriptionEn: '',
    contacts: {}, website: '', wcaId: '', images: [], createdAt: '', updatedAt: '', ...overrides };
}

it('keeps the Platform instructor catalog public and read-only even for a signed-in administrator', async () => {
  mocks.publicEntries.mockResolvedValue([
    entry(1, '公开讲师'), entry(2, '隐藏讲师', { isVisible: false }),
    entry(3, '未认证讲师', { instructorStatus: 'unverified' }), entry(4, '公开机构', { kind: 'organization' }),
  ]);
  mocks.ownedEntries.mockResolvedValue([entry(5, '本人隐藏资料', { isVisible: false })]);
  const host = document.createElement('div'), root = createRoot(host);
  try {
    const page = await PlatformSubpage({params:Promise.resolve({segments:['teachers']})});
    const tree = createElement(NuqsTestingAdapter, null, page);
    const firstPaint=renderToString(tree);
    expect(firstPaint).toContain('teachers-page--platform');
    expect(firstPaint).not.toContain('teachers-hero');
    expect(firstPaint).not.toContain('魔方老师与机构');
    expect(firstPaint).not.toContain('directory-toolbar');
    await act(async () => root.render(tree));
    expect([...host.querySelectorAll('.platform-instructor-card h2')].map(node => node.textContent)).toEqual(['公开讲师']);
    expect(host.querySelector('.platform-instructor-card')?.getAttribute('href')).toBe('/platform/teachers/1');
    expect(host.querySelector('.directory-entry')).toBeNull();
    expect(mocks.ownedEntries).not.toHaveBeenCalled();
    expect(host.querySelector('.teachers-hero-actions')).toBeNull();
    expect(host.querySelector('.directory-toolbar')).toBeNull();
    expect(host.querySelector('.directory-owner-actions')).toBeNull();
  } finally { await act(async () => root.unmount()); }
});

it('opens a full public instructor profile without exposing management actions', async () => {
  mocks.publicEntries.mockResolvedValue([entry(1, '公开讲师', { descriptionZh: '真实教学经历' }), entry(2, '其他讲师')]);
  const host = document.createElement('div'), root = createRoot(host);
  try {
    const page=await PlatformSubpage({params:Promise.resolve({segments:['teachers','1']})});
    const tree=createElement(NuqsTestingAdapter, null,page);
    const firstPaint=renderToString(tree);
    expect(firstPaint).toContain('teachers-page--platform');
    expect(firstPaint).not.toContain('teachers-hero');
    await act(async () => root.render(tree));
    expect([...host.querySelectorAll('.directory-entry h2')].map(node => node.textContent)).toEqual(['公开讲师']);
    expect(host.querySelector('.directory-description')?.textContent).toBe('真实教学经历');
    expect(host.querySelector('.directory-owner-actions')).toBeNull();
    expect(host.querySelector('.platform-instructor-card')).toBeNull();
  } finally { await act(async () => root.unmount()); }
});

it('keeps the standalone directory interface on its original route', async () => {
  mocks.publicEntries.mockResolvedValue([entry(4,'机构',{kind:'organization'})]);
  mocks.ownedEntries.mockResolvedValue([entry(5,'本人资料',{isVisible:false})]);
  const host=document.createElement('div'),root=createRoot(host);
  const tree=createElement(NuqsTestingAdapter,null,createElement(TeachersPage));
  try {
    expect(renderToString(tree)).toContain('魔方老师与机构');
    await act(async()=>root.render(tree));
    expect(host.querySelector('.teachers-hero')).not.toBeNull();
    expect(host.querySelector('.directory-toolbar')).not.toBeNull();
    expect(host.textContent).toContain('本人资料');
  } finally {await act(async()=>root.unmount());}
});
