// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@/components/Flag', () => ({ Flag: () => null }));
vi.mock('@/components/CountryPinButton', () => ({ CountryPinButton: () => null }));
vi.mock('@/hooks/usePinnedCountries', () => ({ usePinnedCountries: () => [[], vi.fn()] }));
vi.mock('@/hooks/usePanelClamp', () => ({ usePanelClamp: vi.fn() }));
vi.mock('@/i18n/tr', () => ({ tr: ({ en }: { en: string }) => en }));
import { ListSelect } from '@/components/ListSelect';
let root: Root | undefined;
let host: HTMLDivElement;
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  host?.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});
it('flips a bottom-edge menu up and updates when the available viewport changes', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('innerHeight', 800);
  let anchorTop = 600;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    return { x: 0, y: anchorTop, top: anchorTop, bottom: anchorTop + 44, left: 0, right: 200, width: 200, height: 44, toJSON: () => ({}) };
  });
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(308);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(createElement(ListSelect, { value: 'none', allLabel: 'None', clearable: false,
    items: [{ value: 'none', label: 'None' }, { value: 'weekly', label: 'Weekly' }], onChange: vi.fn() })));
  await act(async () => host.querySelector<HTMLButtonElement>('.list-select-trigger')!.click());
  const panel = host.querySelector<HTMLElement>('.list-select-popup')!;
  expect(panel.style.top).toBe('auto');
  expect(panel.style.bottom).toBe('calc(100% + 4px)');
  expect(panel.style.maxHeight).toBe('588px');
  anchorTop = 20;
  await act(async () => window.dispatchEvent(new Event('resize')));
  expect(panel.style.top).toBe('calc(100% + 4px)');
  expect(panel.style.bottom).toBe('auto');
  expect(panel.style.maxHeight).toBe('724px');
});
