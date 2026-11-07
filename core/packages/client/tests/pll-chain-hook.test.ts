// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import pll from '@cuberoot/shared/data/pll.json';
import type { Solve } from '@cuberoot/shared/timer';
import { usePllChain } from '@/app/[lang]/timer/_shared/usePllChain';

vi.mock('@/lib/auth-store', () => ({ useAuthUser: () => null }));
vi.mock('@cuberoot/shared/alg', async importOriginal => ({
  ...await importOriginal<typeof import('@cuberoot/shared/alg')>(),
  loadAlg: async () => ({ cases: Object.keys(pll).map(name => ({ subgroup: '', name })) }),
}));

it('updates progress in the host, freezes order, and distinguishes manual input from interrupted cube input', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  localStorage.clear();
  let chain!: ReturnType<typeof usePllChain>;
  function Host({ enabled }: { enabled: boolean }) { chain = usePllChain(enabled); return null; }
  const root = createRoot(document.createElement('div'));
  const solve = (): Solve => ({ id: 'test', event: 'pll-chain', scramble: '', ts: 1, timeMs: 1000, penalty: 'ok' });
  try {
    await act(async () => root.render(createElement(Host, { enabled: true })));
    expect(chain.ready).toBe(true);
    await act(async () => { chain.begin(false); chain.interrupt(); });
    expect(chain.interrupted).toBe(false);
    const manual = solve(); chain.finish(manual);
    expect(manual.penalty).toBe('ok');
    expect(manual.pllChain?.verified).toBe(false);

    await act(async () => chain.begin(true));
    const pinned = [...chain.shownOrder];
    const first = pinned[0] as keyof typeof pll;
    await act(async () => {
      for (const move of pll[first].noAuf.split(' ')) chain.observe(move, null);
    });
    expect(chain.completed).toBe(1);
    expect(chain.shownOrder).toEqual(pinned);
    await act(async () => chain.interrupt());
    expect(chain.interrupted).toBe(true);
    const interrupted = solve(); chain.finish(interrupted);
    expect(interrupted.penalty).toBe('DNF');
    expect(interrupted.pllChain?.splits).toHaveLength(1);
    await act(async () => root.render(createElement(Host, { enabled: false })));
    expect(chain.completed).toBe(0);
    expect(chain.interrupted).toBe(false);
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
