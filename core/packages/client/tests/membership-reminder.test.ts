// @vitest-environment jsdom
import { act, createElement, type ComponentProps, type MouseEvent } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import MembershipReminder from '@/components/MembershipReminder';
import type { Membership } from '@/lib/membership-api';

const { useMembership } = vi.hoisted(() => ({ useMembership: vi.fn() }));
vi.mock('@/hooks/useMembership', () => ({ useMembership }));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('@/i18n/tr', () => ({ tr: (text: { en: string }) => text.en }));
vi.mock('@/components/AppLink', () => ({
  default: ({ onClick, ...props }: ComponentProps<'a'>) => createElement('a', {
    ...props,
    onClick(event: MouseEvent<HTMLAnchorElement>) {
      event.preventDefault();
      onClick?.(event);
    },
  }),
}));

const expiredMembership: Membership = {
  wcaId: '2020TEST01',
  name: 'Test Member',
  planSlug: 'monthly',
  startedAt: '2020-01-01',
  expiresAt: '2020-02-01',
  lifetime: false,
  active: false,
  source: 'test',
};

let host: HTMLDivElement;
let root: Root;

async function render(membership = expiredMembership) {
  useMembership.mockReturnValue({ membership });
  await act(async () => root.render(createElement(MembershipReminder)));
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  localStorage.clear();
  host = document.createElement('div');
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  vi.unstubAllGlobals();
});

it('remembers closing after remounting and after a later expiry for the same member', async () => {
  await render();
  const close = host.querySelector<HTMLButtonElement>('button[aria-label="Dismiss"]')!;
  await act(async () => close.click());
  expect(host.querySelector('[role="status"]')).toBeNull();

  await act(async () => root.unmount());
  root = createRoot(host);
  await render();
  expect(host.querySelector('[role="status"]')).toBeNull();

  await render({ ...expiredMembership, expiresAt: '2020-03-01' });
  expect(host.querySelector('[role="status"]')).toBeNull();

  await render({ ...expiredMembership, wcaId: '2020TEST02' });
  expect(host.querySelector('[role="status"]')).not.toBeNull();
});

it('keeps renewal dismissal tied to the current expiry', async () => {
  await render();
  const renew = host.querySelector<HTMLAnchorElement>('a[href="/membership?renew=1"]')!;
  await act(async () => renew.click());
  expect(host.querySelector('[role="status"]')).toBeNull();

  await render({ ...expiredMembership, expiresAt: '2020-03-01' });
  expect(host.querySelector('[role="status"]')).not.toBeNull();
});

it('updates an already mounted App page when another page dismisses the reminder', async () => {
  await render();
  const key = 'cuberoot_mem_reminder_dismissed:' + expiredMembership.wcaId;
  await act(async () => {
    localStorage.setItem(key, '1');
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: '1', storageArea: localStorage }));
  });
  expect(host.querySelector('[role="status"]')).toBeNull();
});

it('rechecks dismissal when restoring a page that missed the storage event', async () => {
  await render();
  localStorage.setItem('cuberoot_mem_reminder_dismissed:' + expiredMembership.wcaId, '1');
  await act(async () => { window.dispatchEvent(new Event('pageshow')); });
  expect(host.querySelector('[role="status"]')).toBeNull();
});
