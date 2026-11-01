// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mine: vi.fn(), visibility: vi.fn(), requests: vi.fn(), review: vi.fn(), save: vi.fn(), fetch: vi.fn(),
  user: { current: { wcaId: '2000TEST01', uid: 1 } as { wcaId: string; uid: number } | null },
}));
vi.mock('@/lib/gallery-api', () => ({ listMyGalleryPhotos: mocks.mine, setGalleryVisibility: mocks.visibility, listGalleryRequests: mocks.requests, reviewGalleryPhoto: mocks.review }));
vi.mock('@/lib/membership-api', () => ({ setMyProfileIntro: mocks.save }));
vi.mock('@/lib/session-fetch', () => ({ sessionFetch: mocks.fetch }));
vi.mock('@/lib/admin-api', () => ({ authHeaders: () => ({ Authorization: 'Bearer fixture' }) }));
vi.mock('@/lib/auth-store', () => ({ useAuthUser: () => mocks.user.current }));
vi.mock('@/i18n/tr', () => ({ useLang: () => 'zh', tr: ({ zh }: { zh: string }) => zh }));
vi.mock('@/components/BoolToggle', () => ({ default: () => null }));
import MemberProfileEditor from '@/components/MemberProfileEditor';
import GalleryReviewPanel from '@/components/GalleryReviewPanel';
import GalleryImage from '@/components/GalleryImage';

describe('gallery publication controls and private previews', () => {
  let host: HTMLDivElement, root: Root;
  const button = (text: string) => [...host.querySelectorAll('button')].find(node => node.textContent?.trim() === text)!;
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    mocks.user.current = { wcaId: '2000TEST01', uid: 1 };
    mocks.mine.mockResolvedValue([{ id: 1, status: 'private' }]);
    mocks.visibility.mockImplementation(async (id, status) => ({ id, status }));
    mocks.requests.mockResolvedValue([{ id: 1, memberName: 'Owner', wcaId: '2000TEST01' }]);
    mocks.review.mockResolvedValue({ id: 1, status: 'public' });
    mocks.fetch.mockResolvedValue({ ok: true, blob: async () => new Blob(['photo'], { type: 'image/png' }) });
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:gallery-test'), revokeObjectURL: vi.fn() }));
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

  it('starts private, requests publication explicitly, and lets the owner withdraw', async () => {
    const saved = vi.fn();
    await act(async () => root.render(createElement(MemberProfileEditor, { profile: { profileImageIds: [1] }, onSaved: saved })));
    expect(host.textContent).toContain('仅自己可见');
    expect(mocks.visibility).not.toHaveBeenCalled();
    await act(async () => button('申请公开').click());
    expect(mocks.visibility).toHaveBeenLastCalledWith(1, 'pending');
    expect(host.textContent).toContain('待管理员审核');
    await act(async () => button('撤回申请').click());
    expect(mocks.visibility).toHaveBeenLastCalledWith(1, 'private');
    expect(host.textContent).toContain('仅自己可见');
  });

  it('offers making a public image private and reports failed changes without changing its status', async () => {
    mocks.mine.mockResolvedValue([{ id: 1, status: 'public' }]);
    mocks.visibility.mockRejectedValueOnce(new Error('offline'));
    await act(async () => root.render(createElement(MemberProfileEditor, { profile: { profileImageIds: [1] }, onSaved: vi.fn() })));
    await act(async () => button('设为私密').click());
    expect(host.textContent).toContain('所有人可见');
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('更新失败');
    await act(async () => button('设为私密').click());
    expect(host.textContent).toContain('仅自己可见');
  });

  it('approves the selected immutable photo and refreshes the queue', async () => {
    const reviewed = vi.fn();
    await act(async () => root.render(createElement(GalleryReviewPanel, { onReviewed: reviewed })));
    mocks.requests.mockResolvedValue([]);
    await act(async () => button('通过').click());
    expect(mocks.review).toHaveBeenCalledWith(1, 'public');
    expect(reviewed).toHaveBeenCalledOnce();
    expect(host.textContent).toContain('暂无待审核申请');
  });

  it('authenticates private images and revokes the preview immediately on logout', async () => {
    await act(async () => root.render(createElement(GalleryImage, { id: 1 })));
    expect(mocks.fetch).toHaveBeenCalledWith(expect.stringContaining('/article/img/1?v=2'), expect.objectContaining({ cache: 'no-store', headers: { Authorization: 'Bearer fixture' } }));
    expect(host.querySelector('img')?.getAttribute('src')).toBe('blob:gallery-test');
    mocks.user.current = null;
    await act(async () => root.render(createElement(GalleryImage, { id: 1 })));
    expect(host.querySelector('img')?.hasAttribute('src')).toBe(false);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:gallery-test');
  });
});
