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

it('shows a single insertion as one complete algorithm without a brace', async () => {
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
    entries: [{ alg: "U' R U R' U2 R U' R'" }], setup: '', orientation: 0, onSelect: vi.fn(),
    children: createElement('input', { defaultValue: 'original' }),
  }));
  try {
    await act(async () => render());
    expect(host.querySelector('input')).not.toBeNull();
    await act(async () => complete(result));
    expect(host.querySelector('input')).toBeNull();
    expect(host.querySelector('details')).toBeNull();
    expect(host.querySelectorAll('.f2l-edit-group-prefix')).toHaveLength(0);
    expect(host.querySelector('.f2l-prefix-spacer')).toBeNull();
    expect(host.querySelector('.f2l-solution-play')?.textContent).toBe("U' R U R' U2 R U' R'");
    await act(async () => render());
    await act(async () => complete({ groups: [], ungrouped: [0] }));
    expect(host.querySelector('input')).toBeNull();
    expect(host.querySelector('.f2l-solution-play')?.textContent).toBe("U' R U R' U2 R U' R'");
    expect(host.querySelector('details')).toBeNull();
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});

it('plays the full selected algorithm without duplicate rows or copy buttons', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { clipboard: { writeText } });
  const fullAlg = "U' L U L' U2 L U' L' y2";
  mocks.group.mockResolvedValue({ groups: [{ key: 'group', prefix: "U' L U L'", standardName: 'A+', standardId: 1,
    orientation: 2, sourceIndices: [0, 1], options: [{ alg: "U2 L U' L' y2", fullAlg, source: 'standard' }] }], ungrouped: [2] });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const onSelect = vi.fn();
  try {
    await act(async () => root.render(createElement(F2lSolutionGroups, {
      cases: [], entries: [{ alg: fullAlg, tags: ['beginner'] }, { alg: "U' L U L' U L U' L'" }, { alg: 'F' }], setup: '', orientation: 2, onSelect,
      children: createElement('span', {}, 'Original'),
    })));
    expect(host.querySelector('.alg-formula-generator')).toBeNull();
    await act(async () => host.querySelector<HTMLButtonElement>('.f2l-solution-play')!.click());
    expect(host.querySelector('.alg-formula-generator')).toBeNull();
    expect(onSelect).toHaveBeenLastCalledWith({ alg: fullAlg, tags: ['beginner'] });
    expect(host.querySelectorAll('.alg-tag-beginner')).toHaveLength(1);
    expect(host.querySelector('.alg-tag-beginner .sr-only')?.textContent).toBe('Beginner pick');
    expect(host.querySelector('[aria-label="Copy complete algorithm"]')).toBeNull();
    expect(host.textContent).not.toContain('Original');
    expect(host.querySelector('.f2l-solution-play')!.textContent).not.toContain('y2');
    expect(host.querySelector('.f2l-edit-group-prefix')!.classList.contains('is-selected')).toBe(true);
    await act(async () => host.querySelectorAll<HTMLButtonElement>('.f2l-solution-play')[2].click());
    expect(host.querySelector('.f2l-edit-group-prefix')!.classList.contains('is-selected')).toBe(false);
    expect(host.querySelector('.f2l-solution-play')!.getAttribute('aria-pressed')).toBe('false');
  } finally {
    await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
  }
});
