// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import type { PlatformRouteDefinition } from '@/lib/platform-types';
vi.mock('@/hooks/useT', () => ({ useT: () => (zh: string) => zh }));
const state = vi.hoisted(() => ({ user: null as { uid: number } | null, load: vi.fn() }));
vi.mock('@/lib/auth-store', () => ({
  useAuthUser: () => state.user, nextQuery: (path: string) => '?next=' + encodeURIComponent(path),
}));
vi.mock('@/components/AppLink', () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => createElement('a', { href }, children) }));
vi.mock('@/components/platform/PlatformFavoriteButton', () => ({ PlatformFavoriteButton: () => null }));
vi.mock('@/lib/platform-gateway', async original => ({ ...await original<object>(), loadPlatformResource: state.load }));

import { PlatformLearningActions } from '@/components/platform/PlatformDomainActions';

it('requires a star rating and allows an optional title without using the course title', async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div');
  const root = createRoot(host);
  const runAction = vi.fn().mockResolvedValue(undefined);
  state.user = { uid: 1 };
  try {
    await act(async () => root.render(createElement(PlatformLearningActions, {
      definition: { id: 'course-detail' } as PlatformRouteDefinition,
      entity: { id: 'course', title: '课程标题', data: { title: '课程标题' } },
      params: { id: 'course' }, busy: null, runAction,
    })));
    expect(host.querySelector('form')).toBeNull();
    await act(async () => (host.querySelector('.platform-review-actions button') as HTMLButtonElement).click());
    const form = host.querySelector('form')!;
    expect(form.querySelectorAll('input[type="radio"]')).toHaveLength(5);
    expect(form.querySelector('input[type="number"]')).toBeNull();
    expect(form.textContent).toContain('标题（选填）');
    const title = form.querySelector('input[type="text"]') as HTMLInputElement;
    expect(title.value).toBe('');
    expect(title.required).toBe(false);
    expect(title.maxLength).toBe(160);
    expect(form.checkValidity()).toBe(false);
    await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(runAction).not.toHaveBeenCalled();
    expect(form.textContent).toContain('请先选择星级评分');
    for (const rating of [1, 5, 3]) {
      await act(async () => (form.querySelector(`input[value="${rating}"]`) as HTMLInputElement).click());
      expect(form.querySelectorAll('[data-filled="true"]')).toHaveLength(rating);
      expect(form.checkValidity()).toBe(true);
      await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
      // Editable copy uses an explicit empty string so saving can clear a previous title.
      expect(runAction).toHaveBeenLastCalledWith('submit-review', 'course', { rating, title: '', body: null });
    }
  } finally { state.user = null; await act(async () => root.unmount()); }
});

it.each([
  { summary: { count: 5, average: 4.8 }, score: '4.8', message: '5 个评分' },
  { summary: { count: 0, average: null }, score: undefined, message: '还没有文字评价' },
  { summary: undefined, score: undefined, message: '评分暂未加载' },
])('renders real rating totals or an honest empty state: $message', async ({ summary, score, message }) => {
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(PlatformLearningActions, {
      definition: { id: 'course-detail' } as PlatformRouteDefinition,
      params: { id: 'course' }, busy: null, runAction: vi.fn(),
      entity: { id: 'course', title: '课程', data: { reviewSummary: summary, reviews: [] } },
    })));
    expect(host.querySelector('.platform-review-score')?.textContent).toBe(score);
    expect(host.textContent).toContain(message);
    expect(host.querySelectorAll('.platform-review-card')).toHaveLength(0);
  } finally { await act(async () => root.unmount()); }
});

it('shows review titles, stars, public names and dates with a fractional aggregate', async () => {
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(PlatformLearningActions, {
      definition: { id: 'course-detail' } as PlatformRouteDefinition,
      params: { id: 'course' }, busy: null, runAction: vi.fn(),
      entity: { id: 'course', title: '课程', data: {
        reviewSummary: { count: 5, average: 4.8, distribution: [0, 0, 0, 1, 4] },
        reviews: [{ id: 'review', title: '讲得清楚', rating: 5, authorName: null, createdAt: '2026-09-08T10:00:00Z', body: '跟着练习学会了。' }],
      } },
    })));
    const card = host.querySelector('.platform-review-card')!;
    expect(card.querySelector('h4')?.textContent).toBe('讲得清楚');
    expect(card.textContent).toContain('学员');
    expect(card.textContent).toContain('跟着练习学会了。');
    expect(card.querySelector('time')?.textContent).toBe('2026-09-08');
    expect(card.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('5 分，满分 5 分');
    expect(host.querySelectorAll('.platform-review-distribution li')).toHaveLength(5);
    expect(host.querySelector('.platform-review-distribution li')?.textContent).toContain('80%');
    const last = host.querySelector('.platform-review-total .platform-review-star:last-child > span') as HTMLElement;
    expect(parseFloat(last.style.width)).toBeCloseTo(80);
  } finally { await act(async () => root.unmount()); }
});


it('offers a login return link to guests and loads further reviews without replacing the first page', async () => {
  const host = document.createElement('div');
  const root = createRoot(host);
  state.load.mockResolvedValueOnce({ items: [{ data: {
    reviews: [{ id: 'next', rating: 4, body: '第二条评价' }], reviewsHasMore: false,
  } }] });
  try {
    await act(async () => root.render(createElement(PlatformLearningActions, {
      definition: { id: 'course-detail' } as PlatformRouteDefinition,
      params: { id: 'course' }, busy: null, runAction: vi.fn(),
      entity: { id: 'course', title: '课程', data: {
        reviewSummary: { count: 2, average: 4.5 },
        reviews: [{ id: 'first', rating: 5, body: '第一条评价' }], reviewsHasMore: true,
      } },
    })));
    expect(host.querySelector('form')).toBeNull();
    const login = host.querySelector('.platform-review-actions a')!;
    expect(decodeURIComponent(login.getAttribute('href')!)).toContain('/platform/courses/course#platform-course-reviews');
    await act(async () => (host.querySelector('.platform-review-more') as HTMLButtonElement).click());
    expect(state.load).toHaveBeenCalledWith('courses', expect.objectContaining({ params: { id: 'course' }, reviewPage: 2 }));
    expect([...host.querySelectorAll('.platform-review-card p')].map(row => row.textContent)).toEqual(['第一条评价', '第二条评价']);
    expect(host.querySelector('.platform-review-more')).toBeNull();
  } finally { await act(async () => root.unmount()); }
});

it('shows an editor with the existing review only to an eligible signed-in viewer', async () => {
  const host = document.createElement('div');
  const root = createRoot(host);
  const render = (canReview: boolean) => act(async () => root.render(createElement(PlatformLearningActions, {
    definition: { id: 'course-detail' } as PlatformRouteDefinition,
    params: { id: 'course' }, busy: null, runAction: vi.fn(),
    entity: { id: 'course', title: '课程', data: {
      reviewSummary: { count: 0 }, canReview, myReview: { id: 'own', rating: 4, title: '已有标题', body: '已有评价' },
    } },
  })));
  state.user = { uid: 1 };
  try {
    await render(false);
    expect(host.querySelector('form')).toBeNull();
    expect(host.textContent).toContain('解锁课程后可评价');
    await render(true);
    const edit = host.querySelector('.platform-review-actions button') as HTMLButtonElement;
    expect(edit.textContent).toBe('编辑评价');
    await act(async () => edit.click());
    expect(host.querySelector<HTMLInputElement>('form input[type="radio"]:checked')?.value).toBe('4');
    expect(host.querySelector<HTMLInputElement>('form input[type="text"]')?.value).toBe('已有标题');
    expect(host.querySelector<HTMLTextAreaElement>('form textarea')?.value).toBe('已有评价');
  } finally { state.user = null; await act(async () => root.unmount()); }
});
