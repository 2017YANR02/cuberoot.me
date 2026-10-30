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
vi.mock('@/components/ClearButton', () => ({ ClearButton: () => null }));
let root: Root | undefined;
let host: HTMLDivElement;
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  host?.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});
it('expands a group without selecting it and reopens the selected child group', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  const onChange = vi.fn();
  const group = { value: 'moyu', label: 'MoYu' };
  const props = { value: '', allLabel: 'None', clearable: false, onChange,
    items: [{ value: '', label: 'None' }, { value: 'team', label: 'Team', group }, { value: 'dream', label: 'Dream Team', group }] };
  await act(async () => root!.render(createElement(ListSelect, props)));
  await act(async () => host.querySelector<HTMLButtonElement>('.list-select-trigger')!.click());
  expect(host.querySelectorAll('.list-select-item--child')).toHaveLength(0);
  await act(async () => host.querySelector<HTMLButtonElement>('.list-select-item[aria-expanded]')!.click());
  expect(onChange).not.toHaveBeenCalled();
  expect(host.querySelectorAll('.list-select-item--child')).toHaveLength(2);
  await act(async () => host.querySelectorAll<HTMLButtonElement>('.list-select-item--child')[1].click());
  expect(onChange).toHaveBeenCalledWith('dream');
  expect(host.querySelector('.list-select-popup')).toBeNull();
  await act(async () => root!.render(createElement(ListSelect, { ...props, value: 'dream' })));
  await act(async () => host.querySelector<HTMLButtonElement>('.list-select-trigger')!.click());
  expect(host.querySelectorAll('.list-select-item--child')).toHaveLength(2);
  expect(host.querySelector('.list-select-item--active')?.textContent).toBe('Dream Team');
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
it('renders header choices outside a clipped table and selects through the shared popup', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); host.style.overflow = 'hidden'; document.body.append(host); root = createRoot(host);
  const onChange = vi.fn();
  await act(async () => root!.render(createElement(ListSelect, { portal: true, value: '', allLabel: 'Team', onChange,
    items: [{ value: '', label: 'Team' }, { value: 'gan', label: 'GAN' }] })));
  await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
  const panel = document.querySelector('.wca-relation-filter-popup')!;
  expect(panel).not.toBeNull();
  expect(host.contains(panel)).toBe(false);
  await act(async () => [...panel.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'GAN')!.click());
  expect(onChange).toHaveBeenCalledWith('gan');
  expect(document.querySelector('.wca-relation-filter-popup')).toBeNull();
});
