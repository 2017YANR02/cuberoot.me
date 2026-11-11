// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { AlgCase } from '@cuberoot/shared/alg';

const mocks = vi.hoisted(() => ({ copy: vi.fn(), load: vi.fn(), prefer: vi.fn(), changeKind: vi.fn() }));
vi.mock('@/i18n/tr', () => ({ tr: (value: { en: string }) => value.en }));
vi.mock('@/hooks/useCopy', () => ({ useCopy: () => ({ copied: false, copy: mocks.copy }) }));
vi.mock('@/components/AlgCaseRelationCards', () => ({ AlgCaseRelationCards: () => null }));
vi.mock('@/components/AlgPlayer', () => ({
  default: (props: { alg: string; setup?: string; startSolved?: boolean; playRequest?: number }) =>
    createElement('output', { 'data-player': JSON.stringify(props) }),
}));
vi.mock('@/lib/alg-preferred-algs', () => ({
  usePreferredAlgs: (select: (state: unknown) => unknown) => select({ snapshots: {}, load: mocks.load, setPreferred: mocks.prefer }),
  preferredAlgSlot: () => '1', preferredAlgRef: () => 'ref', findPreferredAlg: () => undefined,
  sortPreferredAlgs: (entries: AlgCase['algs'][number]) => entries.map((entry, originalIndex) => ({ entry, originalIndex })),
}));
vi.mock('@/lib/alg_scramble', () => ({
  caseScramble: () => ({ text: "R U R' y", fromInvCase: false }),
  alignScrambleToSetup: (_p: string, text: string) => text,
}));
vi.mock('@/lib/trainer-scramble', () => ({
  availableKinds: () => ['inv', 'rand'], cstimerStyleScramble: vi.fn(),
  SCRAMBLE_KINDS: [{ id: 'inv', label: () => 'Inverse' }, { id: 'rand', label: () => 'Randomized' }],
}));

import AlgCaseMetaContent from '@/components/AlgCaseMetaContent';

let host: HTMLDivElement;
let toolbar: HTMLDivElement;
let root: Root;
const example: AlgCase = {
  id: 1, name: 'A+', subgroup: '', setup: "R U R' y", meta: { no: 1 },
  sticker: { kind: 'face', us: 'yyyyyyyyy', ub: '', uf: '', ul: '', ur: '' },
  algs: [[{ alg: "y' R U' R'" }]],
};
const player = () => JSON.parse(host.querySelector('output')!.dataset.player!);
const render = async (diagramOnly = false) => act(async () => root.render(createElement(AlgCaseMetaContent, {
  caseObj: example, puzzle: '3x3', set: 'pll', byNo: new Map([[1, example]]),
  jump: { kind: 'callback', onJump: vi.fn() }, playable: true, onScrambleKindChange: mocks.changeKind, scrambleSettingsContainer: toolbar,
  previewImage: diagramOnly ? createElement('div', { role: 'img', 'aria-label': 'Case diagram' }) : undefined,
})));
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  host = document.createElement('div');
  toolbar = document.createElement('div');
  document.body.append(host, toolbar);
  root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); toolbar.remove(); });

it('plays the full raw scramble from solved, replays it, and restores the solution setup', async () => {
  await render();
  const scramble = host.querySelector<HTMLElement>('.alg-meta-scramble-row [role="button"]')!;
  const solution = host.querySelector<HTMLElement>('.alg-meta-playable-row [role="button"]')!;
  // Top-layer display rewrites the trailing rotation; playback must keep the raw y.
  expect(scramble.querySelector('code')!.textContent).toBe("R U R' U");
  expect(player()).toMatchObject({ alg: example.algs[0][0].alg, setup: example.setup, startSolved: false });
  await act(async () => scramble.click());
  expect(player()).toMatchObject({ alg: example.setup, startSolved: true, playRequest: 1 });
  expect(player().setup).toBeUndefined();
  expect(scramble.getAttribute('aria-pressed')).toBe('true');
  expect(solution.getAttribute('aria-pressed')).toBe('false');
  await act(async () => { scramble.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
  expect(player().playRequest).toBe(2);
  await act(async () => solution.click());
  expect(player()).toMatchObject({ alg: example.algs[0][0].alg, setup: example.setup, startSolved: false, playRequest: 3 });
});

it('keeps copy and scramble-type controls independent of playback', async () => {
  await render();
  const row = host.querySelector<HTMLElement>('.alg-meta-scramble-row [role="button"]')!;
  const copy = row.querySelector<HTMLButtonElement>('.alg-meta-copy')!;
  await act(async () => {
    copy.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    copy.click();
    const select = toolbar.querySelector<HTMLSelectElement>('select')!;
    select.click();
    select.value = 'rand';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(mocks.copy).toHaveBeenCalledWith("R U R' U");
  expect(mocks.changeKind).toHaveBeenCalledWith('rand');
  expect(player().playRequest).toBe(0);
  expect(player().startSolved).toBe(false);
});

it('unmounts animation in diagram-only mode while preserving algorithms and copy controls', async () => {
  await render();
  expect(host.querySelector('output')).not.toBeNull();
  await render(true);
  expect(host.querySelector('output')).toBeNull();
  expect(host.querySelector('[aria-label="Case diagram"]')).not.toBeNull();
  expect(host.querySelector('.alg-meta-scramble-row [role="button"]')).toBeNull();
  expect(host.querySelector('.alg-meta-playable-row [role="button"]')).toBeNull();
  const copy = host.querySelector<HTMLButtonElement>('.alg-meta-scramble-row .alg-meta-copy')!;
  await act(async () => copy.click());
  expect(mocks.copy).toHaveBeenCalledWith("R U R' U");
  await render();
  expect(host.querySelector('[aria-label="Case diagram"]')).toBeNull();
  expect(player()).toMatchObject({ alg: example.algs[0][0].alg, startSolved: false });
});
