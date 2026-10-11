// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { timerTrainingHref } from '@/lib/timer-training-location';
import { resolveTrainingTarget } from '@/lib/timer-training-catalog';
import { TrainingHostProvider } from '@/lib/training-host';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', async original => ({
  ...await original<typeof import('next/navigation')>(),
  useRouter: () => ({ push }),
}));
vi.mock('@/hooks/useDocumentTitle', () => ({ useDocumentTitle: vi.fn() }));
vi.mock('@/components/TrainingStatsPanel', () => ({ TrainingManualPractice: () => null }));
vi.mock('@/i18n/tr', () => ({ T: () => null }));
import IframePage from '@/components/IframePage';

it('keeps legacy trainer links hosted without changing upstream files, and releases navigation on unmount', async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const mapHref = (href: string) => timerTrainingHref(href, {
    timerPathname: '/zh/timer', currentSearch: 'event=333&training=/cross_trainer',
    acceptsPath: path => !!resolveTrainingTarget(path),
  });
  await act(async () => root.render(createElement(TrainingHostProvider, {
    value: { path: '/cross_trainer', params: {}, mapHref },
    children: createElement(IframePage, { src: '/tools/cross_trainer/', title: 'Cross', syncDocumentTitle: false }),
  })));
  const frame = container.querySelector('iframe')!;
  const doc = frame.contentDocument!;
  doc.open();
  doc.write('<a id="training" href="/xcross_trainer/">XCross</a><a id="solver" href="/solver/">Solver</a><a id="local" href="/tools/cross_trainer/help.html">Help</a>');
  doc.close();
  await act(async () => { frame.dispatchEvent(new Event('load')); });
  const anchor = doc.querySelector<HTMLAnchorElement>('#training')!;
  expect(anchor.getAttribute('href')).toBe('/zh/timer?event=333&training=%2Fxcross_trainer%2F');
  expect(anchor.target).toBe('_top');
  expect(doc.querySelector<HTMLAnchorElement>('#solver')!.getAttribute('href')).toBe('/solver/');
  expect(doc.querySelector<HTMLAnchorElement>('#local')!.target).toBe('');
  await act(async () => { anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
  expect(push).toHaveBeenCalledExactlyOnceWith(anchor.getAttribute('href'), undefined);
  await act(async () => root.unmount());
  push.mockClear();
  anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  expect(push).not.toHaveBeenCalled();
  container.remove();
});
