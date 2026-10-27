// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import ReconCaseLink from '@/components/ReconCaseLink';

vi.mock('@/components/AppLink', () => ({ default: ({ href, children, ...props }: any) => createElement('a', { href, ...props }, children) }));
vi.mock('@/hooks/useModalDismiss', () => ({ useModalDismiss: () => ({}) }));
vi.mock('@/components/ClearButton', () => ({ ClearButton: ({ onClick }: any) => createElement('button', { onClick }, 'Close') }));
vi.mock('@cuberoot/shared/alg', () => ({ loadAlg: vi.fn(async () => ({ cases: [{ name: 'A' }, { name: 'B' }] })) }));
vi.mock('@/lib/alg_case_link', () => ({ resolveCaseSlug: (cases: { name: string }[], slug: string) => cases.find(c => c.name === slug) }));
vi.mock('@/app/[lang]/alg/[puzzle]/[set]/[subgroup]/AlgCaseView', () => ({ default: ({ caseObj, onEmbeddedCaseChange }: any) => createElement('div', null,
  createElement('span', null, caseObj.name), createElement('button', { onClick: () => onEmbeddedCaseChange('/alg/3x3/f2l/B') }, 'Switch')) }));

afterEach(() => vi.unstubAllGlobals());

it('keeps the case dialog open when switching and updates its full-page link', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(createElement(ReconCaseLink, { href: '/alg/3x3/f2l/A', children: 'Open' })));
  await act(async () => host.querySelector('a')!.click());
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Switch'));
  await act(async () => [...document.querySelectorAll('button')].find(button => button.textContent === 'Switch')!.click());
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(dialog.textContent).toContain('B');
  expect(dialog.querySelector('a')?.getAttribute('href')).toBe('/alg/3x3/f2l/B');
  expect(host.querySelector('a')?.getAttribute('href')).toBe('/alg/3x3/f2l/A');
  await act(async () => root.unmount()); host.remove();
});
