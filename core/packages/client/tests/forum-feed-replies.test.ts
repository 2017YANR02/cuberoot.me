// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ForumPost, ThreadPageData } from '@/lib/forum-api';

const mocks = vi.hoisted(() => ({ fetchThread: vi.fn() }));
vi.mock('@/lib/forum-api', () => ({ fetchThread: mocks.fetchThread }));
vi.mock('@/i18n/tr', () => ({ useLang: () => 'zh', tr: ({ zh }: { zh: string }) => zh }));
vi.mock('@/components/AppLink', () => ({ default: ({ children, href }: { children: ReactNode; href: string }) => createElement('a', { href }, children) }));
vi.mock('@/components/PersonLink', () => ({ default: () => null }));
vi.mock('@/components/UserIdLabel', () => ({ UserContactLink: () => null }));
vi.mock('@/components/LoadingIndicator', () => ({ LoadingIndicator: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/lib/article-markdown', () => ({ renderArticleMarkdown: (text: string) => text }));
vi.mock('@/components/forum/ForumVideoPlayer', () => ({ ForumVideoPlayer: () => 'video' }));

import ForumFeedReplies from '@/components/forum/ForumFeedReplies';

let root: Root, host: HTMLDivElement;
const post = (id: number, patch: Partial<ForumPost> = {}): ForumPost => ({
  id, postNo: id, authorId: 'test-user', authorName: 'Reader', content: `body-${id}`,
  createdAt: '2026-11-08T00:00:00Z', editedAt: null, isDeleted: false,
  status: 'approved', reviewNote: null, reactions: [], videos: [], ...patch,
});
const page = (number: number, posts: ForumPost[], total = 7): ThreadPageData => ({
  thread: { id: 1 } as ThreadPageData['thread'],
  forum: { slug: 'help', nameZh: '求助', nameEn: 'Help' },
  category: { slug: 'help', nameZh: '求助', nameEn: 'Help' },
  posts, authors: {}, myReactions: {}, page: number, size: 5, total,
});
const render = async (open: boolean, key = 'viewer') => {
  await act(async () => root.render(createElement(ForumFeedReplies, { key, threadId: 1, open, onCollapse: vi.fn() })));
};
const click = async (text: string) => {
  await act(async () => Array.from(host.querySelectorAll('button')).find(button => button.textContent === text)!.click());
};
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mocks.fetchThread.mockReset().mockResolvedValue(page(1, [1, 2, 3, 4, 5].map(id => post(id))));
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
});

it('loads on expansion, skips the first post and retains pages when collapsed', async () => {
  await render(false);
  expect(mocks.fetchThread).not.toHaveBeenCalled();
  await render(true);
  expect(host.querySelectorAll('article')).toHaveLength(4);
  expect(host.textContent).not.toContain('body-1');
  await render(false); await render(true);
  expect(mocks.fetchThread).toHaveBeenCalledTimes(1);
  mocks.fetchThread.mockResolvedValueOnce(page(2, [post(5), post(6), post(7)]));
  await click('展开更多');
  expect(mocks.fetchThread.mock.calls[1].slice(0, 3)).toEqual([1, 2, 5]);
  expect(host.querySelectorAll('article')).toHaveLength(6);
  expect(host.textContent).not.toContain('展开更多');
});

it('keeps loaded replies on failure and retries the failed page', async () => {
  await render(true);
  mocks.fetchThread.mockRejectedValueOnce(new Error('network'));
  await click('展开更多');
  expect(host.querySelectorAll('article')).toHaveLength(4);
  expect(host.textContent).toContain('回复加载失败');
  mocks.fetchThread.mockResolvedValueOnce(page(2, [post(6), post(7)]));
  await click('重试');
  expect(mocks.fetchThread.mock.calls[2][1]).toBe(2);
  expect(host.querySelectorAll('article')).toHaveLength(6);
});

it('preserves masked and deleted placeholders without exposing their content', async () => {
  mocks.fetchThread.mockResolvedValueOnce(page(1, [post(1),
    post(2, { isDeleted: true, content: 'secret' }),
    post(3, { status: 'pending', content: '' }),
    post(4, { status: 'rejected', content: '', reviewNote: 'private' }),
  ], 4));
  await render(true);
  expect(host.textContent).toContain('该帖待审核');
  expect(host.textContent).toContain('该帖已删除');
  expect(host.textContent).not.toMatch(/secret|private/);
  expect(host.querySelectorAll('article')).toHaveLength(3);
  expect(host.textContent).not.toContain('展开更多');
});

it('aborts the old viewer request and ignores its late response', async () => {
  let resolveOld!: (data: ThreadPageData) => void;
  mocks.fetchThread.mockImplementationOnce(() => new Promise<ThreadPageData>(resolve => { resolveOld = resolve; }));
  await render(true, 'admin');
  const signal: AbortSignal = mocks.fetchThread.mock.calls[0][3];
  mocks.fetchThread.mockResolvedValueOnce(page(1, [post(1)], 1));
  await render(true, 'guest');
  expect(signal.aborted).toBe(true);
  await act(async () => resolveOld(page(1, [post(1), post(2, { content: 'private' })], 2)));
  expect(host.textContent).not.toContain('private');
  expect(host.textContent).toContain('暂无回复');
});
