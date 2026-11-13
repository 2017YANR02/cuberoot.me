// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
vi.mock('@/i18n/tr', () => ({ tr: (value: { en: string }) => value.en }));
vi.mock('@/components/AppLink', () => ({ default: 'a' }));
import AlgMirrorPanel from '@/components/AlgMirrorPanel';

it('updates corresponding LR marks and clears them without changing the moves', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  const root = createRoot(host);
  const render = async (algHtml?: string) => act(async () => root.render(createElement(AlgMirrorPanel, {
    alg: "F U F' y", algHtml, puzzle: '3x3', set: 'f2l', ori: 1,
  })));
  try {
    for (const [open, close, selector] of [
      ['<s>', '</s>', 's'], ['<u>', '</u>', 'u'], ['<u class="wavy">', '</u>', 'u.wavy'],
      ['<em>', '</em>', 'em'], ['<strong>', '</strong>', 'strong'],
      ['<sub>', '</sub>', 'sub'], ['<sup>', '</sup>', 'sup'],
    ]) {
      await render(`F ${open}U${close} F' y`);
      const alg = host.querySelector('.alg-mirror-alg')!;
      expect(alg.textContent).toBe("F' U' F");
      expect(alg.querySelector(selector)?.textContent).toBe("U'");
    }
    await render();
    expect(host.querySelector('.alg-mirror-alg')?.textContent).toBe("F' U' F");
    expect(host.querySelector('.alg-mirror-alg :is(s,u,em,strong,sub,sup)')).toBeNull();
    await render('F <s>D</s> F\' y');
    expect(host.querySelector('.alg-mirror-alg s')).toBeNull();
    expect(host.querySelector('.alg-mirror-alg')?.textContent).toBe("F' U' F");
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
