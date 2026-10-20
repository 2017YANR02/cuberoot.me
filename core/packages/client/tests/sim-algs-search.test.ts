// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import AlgsPanel from '@/app/[lang]/sim/AlgsPanel';

vi.mock('@/hooks/useT', () => ({ useT: () => (_zh: string, en: string) => en }));
vi.mock('@/i18n/tr', () => ({ tr: (copy: { en: string }) => copy.en }));
vi.mock('@/lib/alg_case_alignment', () => ({ loadTrainingAlg: async () => ({
  cases: [
    { name: 'First', setup: 'U', algs: [[{ alg: 'R U R\'' }]] },
    { name: 'Second', setup: 'D', algs: [[{ alg: 'F R F\'' }]] },
  ],
}) }));

it('filters by case or formula while preserving the original selected case', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const onSelect = vi.fn();
  const search = async (value: string) => {
    const input = host.querySelector('input')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  try {
    await act(async () => root.render(createElement(AlgsPanel, { activePuzzle: 3, onSelect })));
    await search('second');
    expect(host.querySelectorAll('.sim-algs-item')).toHaveLength(1);
    await act(async () => host.querySelector<HTMLButtonElement>('.sim-algs-item')!.click());
    expect(onSelect).toHaveBeenCalledWith('D', "F R F'", 'Second');
    await search("R U R'");
    expect(host.querySelector('.sim-algs-name')?.textContent).toBe('First');
    await search('missing');
    expect(host.textContent).toContain('No matching algorithms');
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
