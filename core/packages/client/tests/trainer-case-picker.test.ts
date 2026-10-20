// @vitest-environment jsdom
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { AlgCase } from '@cuberoot/shared/alg';
import { caseKey } from '@/lib/trainer-case-key';
import { CaseTreePicker } from '@/app/[lang]/alg/_trainer/trainer-components';

vi.mock('@/components/VisualCube', () => ({
  VisualCube: () => createElement('svg', { 'data-thumb': 'top' }),
}));
vi.mock('@/components/CaseThumb', () => ({
  CaseThumb: () => createElement('svg', { 'data-thumb': 'case' }),
}));
vi.mock('@cuberoot/timer-ui', () => ({ TimerRoomDialog: () => null }));

const cases: AlgCase[] = ['U/UR', 'U/UL', 'L/LR', 'T/TR', 'H/HR', 'Pi/PiR'].map((subgroup, i) => ({
  name: `Case ${i}`, subgroup, setup: 'R U', standard: "U' R'",
  algs: [[{ alg: "U' R'" }]],
  sticker: { kind: 'face', us: '', ub: '', uf: '', ul: '', ur: '' },
}));
let host: HTMLDivElement;
let root: Root;
let resize: (width: number) => void;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: ResizeObserverCallback) {
      resize = width => callback([{ contentRect: { width } } as ResizeObserverEntry], {} as ResizeObserver);
    }
    observe() {}
    disconnect() {}
  });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function render(items = cases) {
  function Picker() {
    const [selected, setSelected] = useState(new Set(items.map(caseKey)));
    return createElement(CaseTreePicker, {
      puzzle: '3x3', set: 'zbll', cases: items, selected, onChange: setSelected, isZh: false,
    });
  }
  await act(async () => root.render(createElement(Picker)));
  await act(async () => resize(1152));
}
function top(label: string) {
  return host.querySelector<HTMLButtonElement>(`.trainer-subgroup-header button[aria-expanded][aria-label$=" ${label}"]`)!;
}
function sub(label: string) {
  return host.querySelector<HTMLButtonElement>(`.trainer-sub-subgroup-header button[aria-expanded][aria-label$=" ${label}"]`)!;
}
async function click(button: HTMLButtonElement) {
  expect(button).not.toBeNull();
  await act(async () => button.click());
}

it('keeps separate column stacks and one expanded group per level', async () => {
  await render();
  const columns = host.querySelectorAll('.trainer-picker-column');
  expect(columns).toHaveLength(4);
  expect(columns[0].querySelectorAll('.trainer-subgroup')).toHaveLength(2);
  const firstColumn = columns[0].innerHTML;
  await click(top('L'));
  expect(columns[0].innerHTML).toBe(firstColumn);
  await click(top('U'));
  expect(top('L').getAttribute('aria-expanded')).toBe('false');
  expect(top('U').getAttribute('aria-expanded')).toBe('true');
  await click(sub('UR'));
  await click(sub('UL'));
  expect(sub('UR').getAttribute('aria-expanded')).toBe('false');
  expect(sub('UL').getAttribute('aria-expanded')).toBe('true');
  await act(async () => resize(900));
  expect(host.querySelectorAll('.trainer-picker-column')).toHaveLength(3);
  await act(async () => resize(375));
  expect(host.querySelectorAll('.trainer-picker-column')).toHaveLength(1);
});

it('keeps thumbnail nodes across repeated open, close and selection changes', async () => {
  await render();
  const topImage = top('U').parentElement!.querySelector('[data-thumb]');
  expect(host.querySelectorAll('.trainer-case-cell')).toHaveLength(0);
  await click(top('U'));
  await click(sub('UR'));
  const caseImage = host.querySelector('.trainer-case-cell [data-thumb]');
  expect(caseImage).not.toBeNull();
  await click(host.querySelector<HTMLButtonElement>('.trainer-case-cell')!);
  expect(host.querySelector('.trainer-case-cell')!.getAttribute('aria-pressed')).toBe('false');
  await click(top('L'));
  const panel = document.getElementById(top('U').getAttribute('aria-controls')!)!;
  expect(panel.hasAttribute('inert')).toBe(true);
  await click(top('U'));
  await click(sub('UR'));
  expect(top('U').parentElement!.querySelector('[data-thumb]')).toBe(topImage);
  expect(host.querySelector('.trainer-case-cell [data-thumb]')).toBe(caseImage);
  expect(panel.hasAttribute('inert')).toBe(false);
});

it('leaves cases without a category visible and supports selecting all', async () => {
  await render([{ ...cases[0], subgroup: '' }]);
  expect(host.querySelectorAll('.trainer-case-cell')).toHaveLength(1);
  await click(host.querySelector<HTMLButtonElement>('.trainer-set-header')!);
  expect(host.querySelector('.trainer-case-cell')!.getAttribute('aria-pressed')).toBe('false');
});

it('expands from row whitespace and changes selection only through the checkbox', async () => {
  await render();
  const row = top('U').parentElement!;
  const checkbox = row.querySelector<HTMLButtonElement>('.trainer-bulk-toggle')!;
  expect(row.firstElementChild).toBe(checkbox);
  expect(top('U').lastElementChild?.classList.contains('trainer-group-chevron')).toBe(true);
  await act(async () => row.click());
  expect(top('U').getAttribute('aria-expanded')).toBe('true');
  expect(checkbox.getAttribute('aria-pressed')).toBe('true');
  await click(checkbox);
  expect(checkbox.getAttribute('aria-pressed')).toBe('false');
  expect(top('U').getAttribute('aria-expanded')).toBe('true');
  const subRow = sub('UR').parentElement!;
  await act(async () => subRow.click());
  expect(sub('UR').getAttribute('aria-expanded')).toBe('true');
  expect(host.querySelector('.trainer-case-cell')!.getAttribute('aria-pressed')).toBe('false');
  await click(subRow.querySelector<HTMLButtonElement>('.trainer-bulk-toggle')!);
  expect(sub('UR').getAttribute('aria-expanded')).toBe('true');
  expect(host.querySelector('.trainer-case-cell')!.getAttribute('aria-pressed')).toBe('true');
});
