// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { DeskPetCatalog } from '@cuberoot/shared/deskpet';
import PetsPage from '@/app/[lang]/pets/PetsPage';

const { getCatalog } = vi.hoisted(() => ({ getCatalog: vi.fn() }));
vi.mock('@/lib/deskpet-api', () => ({ getDeskPetCatalog: getCatalog }));
vi.mock('@/lib/auth-store', () => ({ useAuthStore: () => null, hasAdminAccess: () => false }));
vi.mock('@/i18n/tr', () => ({ tr: (text: { en: string }) => text.en, useLang: () => 'en' }));
vi.mock('@/components/AppLink', () => ({ default: () => null }));
vi.mock('@/components/HomeLink', () => ({ default: () => null }));
vi.mock('@/components/DeskPetHome', () => ({ default: () => null }));
vi.mock('@/components/Spinner/Spinner', () => ({ Spinner: () => null }));
vi.mock('@/components/DeskPetGallery', () => ({ default: ({ character }: { character: string }) => createElement('div', { 'data-gallery': character }) }));

let host: HTMLDivElement;
let root: Root;
const catalog = { revision: 1, entries: [] };
function deferred() {
  let resolve!: (value: DeskPetCatalog) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<DeskPetCatalog>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
async function render() {
  await act(async () => root.render(createElement(NuqsTestingAdapter, { children: createElement(PetsPage, { gallery: true }) })));
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.useFakeTimers();
  getCatalog.mockReset();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('shows a readable loading state and waits for valid visibility settings', async () => {
  const pending = deferred();
  getCatalog.mockReturnValue(pending.promise);
  await render();
  expect(host.querySelector('.pets-loading')?.textContent).toBe('Loading pets…');
  expect(host.querySelector('[data-gallery]')).toBeNull();
  await act(async () => pending.resolve(catalog));
  expect(host.querySelector('.pets-loading')).toBeNull();
  expect(host.querySelector('[data-gallery]')?.getAttribute('data-gallery')).toBe('rootbeast');
});

it('shows an error and returns to loading while a manual retry is pending', async () => {
  getCatalog.mockRejectedValueOnce(new Error('Timeout'));
  await render();
  expect(host.querySelector('[role=alert]')).not.toBeNull();
  const pending = deferred();
  getCatalog.mockReturnValueOnce(pending.promise);
  await act(async () => (host.querySelector('.pets-retry-action') as HTMLButtonElement).click());
  expect(host.querySelector('[role=alert]')).toBeNull();
  expect(host.querySelector('.pets-loading')).not.toBeNull();
  await act(async () => pending.resolve(catalog));
  expect(host.querySelector('[data-gallery]')).not.toBeNull();
});

it('retains loaded content after a failed background refresh and accepts newer visibility', async () => {
  getCatalog.mockResolvedValueOnce(catalog).mockRejectedValueOnce(new Error('Offline'));
  await render();
  await act(async () => vi.advanceTimersByTimeAsync(60000));
  expect(host.querySelector('[data-gallery]')).not.toBeNull();
  expect(host.querySelector('[role=alert], .pets-loading')).toBeNull();
  getCatalog.mockResolvedValueOnce({ revision: 2, entries: [{ id: 'rootbeast', removed: true, locked: false }] });
  await act(async () => window.dispatchEvent(new Event('focus')));
  expect(host.querySelector('[data-gallery]')?.getAttribute('data-gallery')).toBe('clawd');
  expect(host.querySelector('.pets-roster')?.textContent).not.toContain('Root Beast');
});

it('ignores responses after unmount and removes polling and focus listeners', async () => {
  const pending = deferred();
  getCatalog.mockReturnValue(pending.promise);
  await render();
  await act(async () => root.render(null));
  await act(async () => pending.resolve(catalog));
  await act(async () => { window.dispatchEvent(new Event('focus')); await vi.advanceTimersByTimeAsync(60000); });
  expect(getCatalog).toHaveBeenCalledOnce();
  expect(host.innerHTML).toBe('');
  expect(vi.getTimerCount()).toBe(0);
});
