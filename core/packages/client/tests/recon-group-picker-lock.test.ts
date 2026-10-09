// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import GroupScramblePicker from '@/app/[lang]/recon/submit/GroupScramblePicker';

vi.mock('next/navigation', () => ({ useRouter: () => ({}), useParams: () => ({ lang: 'zh' }) }));
vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'zh' } }) }));
vi.mock('@/hooks/useT', () => ({ useT: () => (zh: string) => zh }));
vi.mock('@/i18n/tr', () => ({ tr: ({ zh }: { zh: string }) => zh }));
vi.mock('@/lib/wca-results-api', () => ({
  fetchGroupScrambles: async () => ['A', 'B', 'C', 'D', 'E'].map(group => ({ group, scrambles: ['R', 'U', 'F'] })),
}));
vi.mock('@/components/EventIcon', () => ({ EventIcon: () => null }));
vi.mock('@/components/ScramblePreview2D', () => ({ ScramblePreview2D: () => null, eventHasScramblePreview: () => false }));
vi.mock('@/lib/cross-solver', () => ({ isAnalysableScramble: () => false }));
vi.mock('@/app/[lang]/scramble/gen/ScrambleLines', () => ({ default: ({ scramble }: { scramble: string }) => scramble }));

let root: Root;
let host: HTMLDivElement;
const onPick = vi.fn();
const onClose = vi.fn();
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  Element.prototype.scrollIntoView = vi.fn();
  onPick.mockClear();
  onClose.mockClear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function render(selectableGroups?: readonly string[]) {
  await act(async () => root.render(createElement(GroupScramblePicker, {
    compWcaId: 'GuangzhouGrandOpen2026', event: '3x3', round: '2', solveNum: 3,
    currentGroup: 'C', selectableGroups, onPick, onClose,
  })));
}
const rows = () => [...host.querySelectorAll<HTMLTableRowElement>('tbody tr')];

it('keeps all groups visible but only permits the matched C group', async () => {
  await render(['C']);
  expect(rows()).toHaveLength(5);
  expect(host.textContent).toContain('已有打乱对应 C 组');
  for (const row of rows().filter(row => row.textContent?.startsWith('C') === false)) {
    expect(row.getAttribute('aria-disabled')).toBe('true');
    await act(async () => row.click());
  }
  expect(onPick).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  await act(async () => rows()[2].click());
  expect(onPick).toHaveBeenCalledExactlyOnceWith('C');
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('blocks clicks during matching and releases the restriction when no match applies', async () => {
  await render([]);
  for (const row of rows()) await act(async () => row.click());
  expect(onPick).not.toHaveBeenCalled();
  await render();
  await act(async () => rows()[0].click());
  expect(onPick).toHaveBeenCalledExactlyOnceWith('A');
});

it('updates the permitted group in an already-open comparison dialog', async () => {
  await render(['C']);
  await render(['D']);
  await act(async () => rows()[2].click());
  expect(onPick).not.toHaveBeenCalled();
  await act(async () => rows()[3].click());
  expect(onPick).toHaveBeenCalledExactlyOnceWith('D');
});
