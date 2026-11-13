// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ group: vi.fn() }));
vi.mock('@/lib/f2l-solution-groups', () => ({ groupF2lSolutions: mocks.group }));
vi.mock('@/i18n/tr', () => ({ tr: (text: { en: string }) => text.en }));
import F2lSolutionGroups from '@/components/F2lSolutionGroups';

it('shows editable rows directly and preserves drafts when the library refreshes', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const render = () => root.render(createElement(F2lSolutionGroups, {
    cases: [], entries: [{ alg: 'R' }], setup: '', orientation: 0,
    onSelect: vi.fn(), editing: true,
    children: createElement('input', { defaultValue: 'R' }),
  }));
  try {
    await act(async () => render());
    const input = host.querySelector('input')!;
    input.value = 'unsaved draft';
    await act(async () => render());
    expect(host.querySelector('input')).toBe(input);
    expect(input.value).toBe('unsaved draft');
    expect(host.querySelector('details')).toBeNull();
    expect(host.querySelector('.f2l-solution-groups')).toBeNull();
    expect(mocks.group).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
  }
});

it('groups source rows without remounting or rewriting drafts', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mocks.group.mockResolvedValue({ groups: [{ key: 'pair', prefix: 'R', sourceIndices: [0, 2],
    options: [{ sourceIndices: [2] }, { sourceIndices: [0] }] }], ungrouped: [1] });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const render = () => root.render(createElement(F2lSolutionGroups, {
    cases: [], entries: [{ alg: 'R U' }, { alg: 'F' }, { alg: 'R U2' }], setup: '', orientation: 0,
    onSelect: vi.fn(), editing: true, children: null,
    editableRows: ['R U', 'F', 'R U2'].map((alg, i) => ({ key: String(i), node: createElement('input', { defaultValue: alg }) })),
  }));
  try {
    await act(async () => render());
    const inputs = [...host.querySelectorAll('input')];
    expect(inputs.map(input => input.value)).toEqual(['R U', 'F', 'R U2']);
    expect(inputs.map(input => input.parentElement!.style.gridRow)).toEqual(['1', '3', '2']);
    expect(host.querySelectorAll('.f2l-solution-brace')).toHaveLength(1);
    expect(host.querySelector<HTMLElement>('.f2l-edit-group-prefix')!.style.gridRow).toBe('1 / 3');
    inputs[0].value = 'unsaved draft';
    await act(async () => render());
    expect(host.querySelector('input')).toBe(inputs[0]);
    expect(inputs[0].value).toBe('unsaved draft');
    expect(host.querySelector('.f2l-solution-brace')).not.toBeNull();
  } finally {
    await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
  }
});

it('keeps a moved standalone row above the brace in both modes and preserves mounted drafts', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mocks.group.mockImplementation(async (_cases, _setup, entries) => {
    const sourceIndices = entries.flatMap((e: { alg: string }, i: number) => e.alg.startsWith('R ') ? [i] : []);
    return { groups: [{ key: 'pair', prefix: 'R', sourceIndices,
      options: ['R U', 'R U2'].map(fullAlg => ({ fullAlg, alg: fullAlg.slice(2),
        sourceIndices: [entries.findIndex((e: { alg: string }) => e.alg === fullAlg)] })) }], ungrouped: [] };
  });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const cases: never[] = [];
  let order = ['R U', 'R U2', 'F'];
  const render = (editing = true) => root.render(createElement(F2lSolutionGroups, {
    cases, entries: order.map(alg => ({ alg })), setup: '', orientation: 0,
    onSelect: vi.fn(), editing, children: null,
    editableRows: order.map(alg => ({ key: alg, node: createElement('input', { defaultValue: alg }) })),
  }));
  try {
    await act(async () => render());
    const draft = host.querySelectorAll('input')[2];
    draft.value = 'unsaved F';
    order = ['F', 'R U2', 'R U'];
    await act(async () => render());
    expect(host.querySelector('input')).toBe(draft);
    expect(draft.value).toBe('unsaved F');
    expect(draft.parentElement!.style.gridRow).toBe('1');
    expect(draft.parentElement!.style.gridColumn).toBe('1 / -1');
    expect(host.querySelector<HTMLElement>('.f2l-edit-group-prefix')!.style.gridRow).toBe('2 / 4');
    await act(async () => render(false));
    expect([...host.querySelectorAll('.f2l-solution-play')].map(el => el.textContent)).toEqual(['F', 'U2', 'U']);
    order = ['R U2', 'F', 'R U'];
    await act(async () => render(false));
    expect([...host.querySelectorAll('.f2l-solution-play')].map(el => el.textContent)).toEqual(['U2', 'U', 'F']);
    expect(host.querySelectorAll('.f2l-solution-brace')).toHaveLength(1);
  } finally {
    await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
  }
});
