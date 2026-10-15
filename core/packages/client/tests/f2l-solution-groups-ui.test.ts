// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import type { AlgCase } from '@cuberoot/shared/alg';
import type { F2lGroupedSolutions } from '@/lib/f2l-solution-groups';

const mocks = vi.hoisted(() => ({ group: vi.fn() }));
vi.mock('@/lib/f2l-solution-groups', () => ({ groupF2lSolutions: mocks.group }));
vi.mock('@/i18n/tr', () => ({ tr: (text: { en: string }) => text.en }));
vi.mock('@/components/AppLink', () => ({ default: ({ children }: { children: React.ReactNode }) => createElement('span', {}, children) }));
import F2lSolutionGroups from '@/components/F2lSolutionGroups';

it('keeps uncontrolled editor drafts mounted through regrouping and library refreshes', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const result: F2lGroupedSolutions = { groups: [{ key: 'group', prefix: "U' R U R'", standardName: 'A+', standardId: 1,
    orientation: 0, sourceIndices: [0], options: [{ alg: "U2 R U' R'", fullAlg: "U' R U R' U2 R U' R'", source: 'standard' }] }], ungrouped: [] };
  let complete: (value: F2lGroupedSolutions) => void = () => {};
  mocks.group.mockImplementation(() => new Promise<F2lGroupedSolutions>(resolve => { complete = resolve; }));
  const render = () => root.render(createElement(F2lSolutionGroups, {
    cases: [{ id: 1, name: 'A+', algs: [], setup: '', subgroup: 'Free Pairs', sticker: { kind: 'f2l', fl: '' } }] as AlgCase[],
    entries: [{ alg: 'R' }], setup: '', orientation: 0, onSelect: vi.fn(), editing: true,
    children: createElement('input', { defaultValue: 'original' }),
  }));
  try {
    await act(async () => render());
    const input = host.querySelector('input')!;
    input.value = 'unsaved draft';
    await act(async () => complete(result));
    expect(host.querySelector('input')).toBe(input);
    expect(input.value).toBe('unsaved draft');
    await act(async () => render());
    expect(host.querySelector('input')).toBe(input);
    await act(async () => complete({ groups: [], ungrouped: [0] }));
    expect(host.querySelector('input')).toBe(input);
    expect(input.value).toBe('unsaved draft');
    expect(host.querySelector('details.f2l-solution-originals')?.hasAttribute('open')).toBe(true);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});

it('plays and copies the full selected algorithm, including the hidden final rotation', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { clipboard: { writeText } });
  const fullAlg = "U' L U L' U2 L U' L' y2";
  mocks.group.mockResolvedValue({ groups: [{ key: 'group', prefix: "U' L U L'", standardName: 'A+', standardId: 1,
    orientation: 2, sourceIndices: [0], options: [{ alg: "U2 L U' L' y2", fullAlg, source: 'standard' }] }], ungrouped: [] });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const onSelect = vi.fn();
  try {
    await act(async () => root.render(createElement(F2lSolutionGroups, {
      cases: [], entries: [{ alg: fullAlg }], setup: '', orientation: 2, onSelect,
      children: createElement('span', {}, 'Original'),
    })));
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Play complete algorithm"]')!.click());
    expect(onSelect).toHaveBeenLastCalledWith({ alg: fullAlg });
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Copy complete algorithm"]')!.click());
    expect(writeText).toHaveBeenLastCalledWith(fullAlg);
    expect(host.querySelector('.f2l-solution-play')!.textContent).not.toContain('y2');
  } finally {
    await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
  }
});
