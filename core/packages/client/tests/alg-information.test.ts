// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
vi.mock('@/i18n/tr', () => ({ tr: (value: { en: string }) => value.en }));
import AlgInformation from '@/components/AlgInformation';

it('updates generators and full move counts together as the selection changes', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  const root = createRoot(host);
  const show = async (algorithm?: string) => {
    await act(async () => root.render(createElement(AlgInformation, { puzzle: '3x3', algorithm })));
    return [...host.querySelectorAll('.alg-meta-val')].map(value => value.textContent);
  };
  try {
    expect(await show("F2 L' U' L U F2")).toEqual(['FLU', '6', '8']);
    // A grouped insertion uses its full prefix; rotations do not add steps.
    expect(await show("U' L U L' U2 L U' L' y2")).toEqual(['LU', '8', '9']);
    expect(await show("U R U' R'")).toEqual(['RU', '4', '4']);
    expect(await show()).toEqual(['—', '—', '—']);
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
