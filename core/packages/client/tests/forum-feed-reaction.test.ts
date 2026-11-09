import { createElement, type AnchorHTMLAttributes, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ForumFeedList } from '@/components/forum/ForumFeedList';
import type { ForumFeedThread } from '@/lib/forum-api';

vi.mock('next/link', () => ({
  useLinkStatus: () => ({ pending: false }),
  default: ({ children, prefetch: _prefetch, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { children?: ReactNode; prefetch?: boolean }) => (
    createElement('a', props, children)
  ),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ lang: 'zh' }),
}));

vi.mock('@/i18n/tr', () => ({
  tr: ({ zh }: { zh: string }) => zh,
  useLang: () => 'zh',
}));

const THREAD: ForumFeedThread = {
  id: 1,
  title: '测试主题',
  authorId: 'u1',
  authorName: '测试用户',
  authorUserId: 1,
  createdAt: '2026-08-26T00:00:00.000Z',
  replyCount: 0,
  viewCount: 1,
  lastPostAt: '2026-08-26T00:00:00.000Z',
  lastPostAuthorId: 'u1',
  lastPostAuthorName: '测试用户',
  lastPostAuthorUserId: 1,
  isPinned: false,
  isLocked: false,
  status: 'approved',
  postTotal: 1,
  forumSlug: 'help',
  forumNameEn: 'Help',
  forumNameZh: '求助',
  firstPostId: 1,
  excerpt: '',
  imageUrls: [],
  videos: [],
  reactions: [{ kind: 'like', count: 1, names: ['测试用户'] }],
  myReaction: 'like',
  author: {
    name: '测试用户',
    avatarUrl: null,
    avatarPreset: null,
    joinedAt: null,
    postCount: 1,
    wcaId: null,
    userId: 1,
    isAdmin: false,
    forumBanned: false,
  },
};

describe('ForumFeedList reaction button', () => {
  it('keeps the heart icon and marks it as filled when the user has reacted', () => {
    const html = renderToStaticMarkup(createElement(ForumFeedList, { threads: [THREAD], compact: true }));

    expect(html).toContain('community-feed-reaction-action is-mine');
    expect(html).toContain('community-feed-heart');
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain('👍');
  });
});

describe('ForumFeedList timestamps', () => {
  const lastPostAt = '2026-10-12T00:00:00.000Z';

  it.each([
    ['activity', 1, lastPostAt, true],
    ['published', 1, lastPostAt, false],
    ['activity', 0, THREAD.createdAt, false],
    ['activity', 1, THREAD.createdAt, false],
  ] as const)('uses %s time for a thread with %i replies at %s', (timeMode, replyCount, replyTime, showReplyTime) => {
    const html = renderToStaticMarkup(createElement(ForumFeedList, {
      threads: [{ ...THREAD, replyCount, lastPostAt: replyTime }], timeMode, compact: true,
    }));
    expect(html).toContain(`<time dateTime="${showReplyTime ? replyTime : THREAD.createdAt}">`);
    expect(html.includes('最近回复')).toBe(showReplyTime);
    expect(html).not.toContain('发布于');
  });
});
