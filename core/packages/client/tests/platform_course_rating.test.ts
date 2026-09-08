// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import type { PlatformRouteDefinition } from '@/lib/platform-types';
vi.mock('@/hooks/useT', () => ({ useT: () => (zh: string) => zh }));
vi.mock('@/components/AppLink', () => ({ default: ({ children }: { children: ReactNode }) => children }));
import { PlatformLearningActions } from '@/components/platform/PlatformDomainActions';

it('requires a star rating and allows an optional title without using the course title', async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div');
  const root = createRoot(host);
  const runAction = vi.fn().mockResolvedValue(undefined);
  try {
    await act(async () => root.render(createElement(PlatformLearningActions, {
      definition: { id: 'course-detail' } as PlatformRouteDefinition,
      entity: { id: 'course', title: '课程标题', data: { title: '课程标题' } },
      params: { id: 'course' }, busy: null, runAction,
    })));
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
      expect(runAction).toHaveBeenLastCalledWith('submit-review', 'course', { rating, title: null, body: null });
    }
  } finally { await act(async () => root.unmount()); }
});

it.each([
  { summary: { count: 5, average: 4.8 }, score: '4.8', message: '5 个评分' },
  { summary: { count: 0, average: null }, score: '—', message: '还没有评价' },
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
        reviewSummary: { count: 5, average: 4.8 },
        reviews: [{ id: 'review', title: '讲得清楚', rating: 5, authorName: null, createdAt: '2026-09-08T10:00:00Z', body: '跟着练习学会了。' }],
      } },
    })));
    const card = host.querySelector('.platform-review-card')!;
    expect(card.querySelector('h4')?.textContent).toBe('讲得清楚');
    expect(card.textContent).toContain('学员');
    expect(card.textContent).toContain('跟着练习学会了。');
    expect(card.querySelector('time')?.textContent).toBe('2026-09-08');
    expect(card.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('5 分，满分 5 分');
    const last = host.querySelector('.platform-review-total .platform-review-star:last-child > span') as HTMLElement;
    expect(parseFloat(last.style.width)).toBeCloseTo(80);
  } finally { await act(async () => root.unmount()); }
});
