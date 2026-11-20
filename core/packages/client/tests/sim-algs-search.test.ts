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
    { name: 'Second', setup: 'D', algs: [[{ alg: "F R F'" }, { alg: "R' D F2" }], [{ alg: "F2 U'", setup: 'U F2' }]] },
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
    await search('F2');
    const matches = Array.from(host.querySelectorAll<HTMLButtonElement>('.sim-algs-item'));
    expect(matches.map(row => row.querySelector('.sim-algs-alg')?.textContent)).toEqual(["R' D F2", "F2 U'"]);
    await act(async () => matches[1].click());
    expect(onSelect).toHaveBeenLastCalledWith('U F2', "F2 U'", 'Second');
    expect(matches[1].classList.contains('active')).toBe(true);
    expect(matches[0].classList.contains('active')).toBe(false);
    await search('missing');
    expect(host.textContent).toContain('No matching algorithms');
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
