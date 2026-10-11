// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { FloatTrainer, BLD_TIMER_SCRAMBLES_KEY } from '@/app/[lang]/alg/3bld/_components/FloatTrainer';

const mocks = vi.hoisted(() => ({ solve: vi.fn(), persist: vi.fn() }));
vi.mock('@/app/[lang]/alg/3bld/_lib/m2p-bridge', () => ({ m2pSolve: mocks.solve, prewarm: vi.fn() }));
vi.mock('@/lib/safe-storage', () => ({ persistItem: mocks.persist }));
vi.mock('@/app/[lang]/alg/3bld/_store/bld-config-store', () => ({ useBldConfigHydrated: () => true }));
vi.mock('@/hooks/useDocumentTitle', () => ({ useDocumentTitle() {} }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en' } }) }));
vi.mock('@/i18n/tr', () => ({ tr: ({ en }: { en: string }) => en }));
vi.mock('@/components/AppLink', () => ({ default: () => null }));
vi.mock('@/components/BoolToggle', () => ({ default: () => null }));
vi.mock('@/components/ClearButton', () => ({ ClearButton: () => null }));
vi.mock('@/app/[lang]/alg/3bld/_components/BldConfigBar', () => ({ BldConfigBar: () => null }));
vi.mock('@/app/[lang]/alg/3bld/_components/ScrambleOutput', () => ({ ScrambleOutput: () => null }));
vi.mock('@/app/[lang]/alg/3bld/_lib/state-gen', () => ({
  algSetGenerator: () => [],
  codeTrans: (_code: string, state: string) => state,
  randomEdge: () => '', randomEdge1: () => '', randomCorner: () => '', randomCorner1: () => '',
  mergeState: () => '', shuffle: (items: unknown[]) => items,
  posChichu: (code: string) => code.charCodeAt(0), globalState: '',
}));

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mocks.solve.mockReset().mockResolvedValue('R U');
  mocks.persist.mockReset();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(React.createElement(FloatTrainer, { piece: 'edge' })));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function click(text: string) {
  const button = Array.from(host.querySelectorAll('button')).find(item => item.textContent?.trim() === text);
  expect(button, text).toBeDefined();
  await act(async () => button!.click());
}

async function changeInput(selector: string, value: string) {
  const input = host.querySelector<HTMLInputElement>(selector)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

it('does not overwrite the next trainer timer list when an old padded handoff resolves late', async () => {
  await click('Generate float training');
  expect(mocks.solve).toHaveBeenCalledTimes(1);
  await click('Practice timer');
  await changeInput('#bld-percent', '50');
  let deliver!: (value: string) => void;
  mocks.solve.mockImplementationOnce(() => new Promise<string>(resolve => { deliver = resolve; }));
  await click('Build & go to timer');
  expect(mocks.solve).toHaveBeenCalledTimes(2);
  expect(mocks.persist).not.toHaveBeenCalled();

  act(() => root.render(null));
  act(() => root.render(React.createElement(FloatTrainer, { piece: 'edge' })));
  await click('Generate float training');
  await click('Practice timer');
  await click('Build & go to timer');
  expect(mocks.persist).toHaveBeenCalledExactlyOnceWith(BLD_TIMER_SCRAMBLES_KEY, JSON.stringify(['R U']));

  await act(async () => deliver('OLD'));
  expect(mocks.persist).toHaveBeenCalledExactlyOnceWith(BLD_TIMER_SCRAMBLES_KEY, JSON.stringify(['R U']));
});

it('stops scheduling the remaining eject-mode solves after departure', async () => {
  await changeInput('#bld-floatorder', '');
  let deliver!: (value: string) => void;
  mocks.solve.mockImplementationOnce(() => new Promise<string>(resolve => { deliver = resolve; }));
  await click('Generate float training');
  expect(mocks.solve).toHaveBeenCalledTimes(1);
  act(() => root.render(null));
  await act(async () => deliver('OLD'));
  expect(mocks.solve).toHaveBeenCalledTimes(1);
  expect(mocks.persist).not.toHaveBeenCalled();
});
