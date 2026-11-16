// @vitest-environment jsdom
import { act, createElement, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { AlgCase } from '@cuberoot/shared/alg';

const mocks = vi.hoisted(() => ({ copy: vi.fn(), load: vi.fn(), prefer: vi.fn(), changeKind: vi.fn() }));
vi.mock('@/i18n/tr', () => ({ tr: (value: { en: string }) => value.en }));
vi.mock('@/components/AppLink', () => ({ default: ({ prefetch: _prefetch, ...props }: ComponentProps<'a'> & { prefetch?: boolean }) => createElement('a', props) }));
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
  const scramble = host.querySelector<HTMLElement>('.alg-meta-scramble-row .alg-case-standard-detail[role="button"]')!;
  const solution = host.querySelector<HTMLElement>('.alg-alg-row[role="button"]')!;
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

it('keeps scramble settings independent of playback and shares F2L row controls', async () => {
  await render();
  expect(host.querySelector('.alg-meta-copy, .alg-meta-primary, .alg-meta-algline')).toBeNull();
  expect(host.querySelectorAll('.alg-formula-row')).toHaveLength(1);
  await act(async () => {
    const select = toolbar.querySelector<HTMLSelectElement>('select')!;
    select.value = 'rand';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(mocks.changeKind).toHaveBeenCalledWith('rand');
  expect(player().playRequest).toBe(0);
});

it('expands mirrors on explicit PLL selection and collapses without replaying', async () => {
  await render();
  const solution = host.querySelector<HTMLElement>('.alg-alg-row[role="button"]')!;
  expect(solution.getAttribute('aria-expanded')).toBe('false');
  expect(host.querySelector('.alg-mirror-panel')).toBeNull();
  await act(async () => solution.click());
  expect(solution.getAttribute('aria-expanded')).toBe('true');
  expect(host.querySelectorAll('.alg-mirror-line')).toHaveLength(2);
  expect(player().alg).toBe(example.algs[0][0].alg);
  expect(player().playRequest).toBe(1);
  await act(async () => solution.click());
  expect(solution.getAttribute('aria-expanded')).toBe('false');
  expect(host.querySelector('.alg-case-detail-ori-algs .more-toggle-panel')?.getAttribute('aria-hidden')).toBe('true');
  expect(player().playRequest).toBe(1);
});

it('unmounts animation in diagram-only mode while keeping the shared mirror interaction', async () => {
  await render();
  expect(host.querySelector('output')).not.toBeNull();
  await render(true);
  expect(host.querySelector('output')).toBeNull();
  expect(host.querySelector('[aria-label="Case diagram"]')).not.toBeNull();
  expect(host.querySelector('.alg-meta-scramble-row .alg-case-standard-detail[role="button"]')).toBeNull();
  const solution = host.querySelector<HTMLElement>('.alg-alg-row[role="button"]')!;
  await act(async () => solution.click());
  expect(solution.getAttribute('aria-expanded')).toBe('true');
  expect(host.querySelector('output')).toBeNull();
  await render();
  expect(host.querySelector('[aria-label="Case diagram"]')).toBeNull();
  expect(player()).toMatchObject({ alg: example.algs[0][0].alg, startSolved: false });
});

it('links PLL mirrors through the existing case relationship and navigation URL', async () => {
  const partner: AlgCase = { ...example, id: 99, name: 'Ga', meta: { no: 7 } };
  const current: AlgCase = { ...example, name: 'Gc', meta: { no: 1, mirror: 7 }, algs: [[{ alg: "R' F R F'" }]] };
  await act(async () => root.render(createElement(AlgCaseMetaContent, {
    caseObj: current, puzzle: '3x3', set: 'pll', byNo: new Map([[7, partner]]), playable: true,
    jump: { kind: 'link', href: c => `/alg/3x3/pll/${c.name.toLowerCase()}?angle=y2` },
  })));
  await act(async () => host.querySelector<HTMLElement>('.alg-alg-row')!.click());
  const link = host.querySelector<HTMLAnchorElement>('.alg-mirror-line')!;
  expect(link.tagName).toBe('A');
  expect(link.getAttribute('href')).toBe('/alg/3x3/pll/ga?angle=y2');
  expect(link.getAttribute('aria-label')).toBe("LR-mirror Ga L F' L' F");
  expect(host.querySelectorAll('.alg-mirror-line')).toHaveLength(1);
});

it('uses the host callback for embedded mirror navigation', async () => {
  const partner: AlgCase = { ...example, id: 99, name: 'Ga', meta: { no: 7 } };
  const current: AlgCase = { ...example, meta: { no: 1, mirror: 7 } };
  const onJump = vi.fn();
  await act(async () => root.render(createElement(AlgCaseMetaContent, {
    caseObj: current, puzzle: '3x3', set: 'pll', byNo: new Map([[7, partner]]), playable: true,
    jump: { kind: 'callback', onJump },
  })));
  await act(async () => host.querySelector<HTMLElement>('.alg-alg-row')!.click());
  await act(async () => host.querySelector<HTMLButtonElement>('button.alg-mirror-line')!.click());
  expect(onJump).toHaveBeenCalledExactlyOnceWith(partner);
  expect(player().playRequest).toBe(1);
});
