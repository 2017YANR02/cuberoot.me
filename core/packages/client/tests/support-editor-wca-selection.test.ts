/** @vitest-environment jsdom */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';

const { createSponsor } = vi.hoisted(() => ({ createSponsor: vi.fn() }));
vi.mock('@cuberoot/shared/persons-index', () => ({
  isPersonsIndexReady: () => true,
  loadPersonsIndex: () => Promise.resolve(),
  searchLocalPersons: () => [{ wcaId: '2016RONG02', name: 'Hao Rong Chen (陈浩荣)', iso2: 'SG' }],
}));
vi.mock('@/lib/account-api', () => ({ fetchAdminUsers: vi.fn() }));
vi.mock('@/lib/wca-api', () => ({
  fetchPersonCard: () => Promise.resolve(null),
  getPerson: () => Promise.resolve(null),
  searchPersons: () => Promise.resolve([]),
}));
vi.mock('@/lib/sponsors-api', () => ({
  createSponsor,
  updateSponsor: vi.fn(),
  createContributor: vi.fn(),
  updateContributor: vi.fn(),
}));
import SupportEditor from '@/app/[lang]/support/SupportEditor';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  vi.clearAllMocks();
});

it('keeps the WCA selection after clicking the result name and saves its identity', async () => {
  createSponsor.mockResolvedValue({ id: 1 });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root?.render(createElement(SupportEditor, {
    target: { kind: 'sponsor', initial: null },
    onClose: () => {},
    onSaved: () => {},
  })));
  const input = host.querySelector('input');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '陈浩荣');
    input?.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const resultName = host.querySelector<HTMLElement>('.cuber-search-item-name');
  expect(resultName).not.toBeNull();
  await act(async () => resultName?.click());
  // jsdom does not forward the same result click as WebKit does. A later click
  // on the field caption also exposes the label's accidental clear activation.
  const caption = host.querySelector<HTMLElement>('.sponsor-editor-row > span');
  await act(async () => caption?.click());
  expect(host.querySelector('.cuber-search-chip-name')?.textContent).toBe('Hao Rong Chen');
  expect(host.querySelector('.cuber-search-chip-id')?.textContent).toBe('2016RONG02');
  const save = [...host.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Save');
  await act(async () => save?.click());
  expect(createSponsor).toHaveBeenCalledWith(expect.objectContaining({
    name: 'Hao Rong Chen (陈浩荣)', wcaId: '2016RONG02',
  }));
  await act(async () => host?.querySelector<HTMLButtonElement>('.cuber-search-chip .clear-btn')?.click());
  expect(host.querySelector('.cuber-search-chip')).toBeNull();
  expect(host.querySelector('input')?.value).toBe('');
});
