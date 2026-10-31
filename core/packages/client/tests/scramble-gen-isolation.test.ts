// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import QuickMode from '@/app/[lang]/scramble/gen/QuickMode';

const engines = vi.hoisted(() => ({ wca: vi.fn(), exotic: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en' } }) }));
vi.mock('@/hooks/useIvyMode', () => ({ useIvyMode: () => ['default'] }));
vi.mock('@/lib/scramble-redi-mode', () => ({ useRediMode: () => ['default'] }));
vi.mock('@/lib/cubing-scramble', () => ({ TNOODLE_WCA_EVENTS: ['333'], TWIZZLE_NONWCA_EVENTS: [], TWIZZLE_NONWCA_APPEND: [], tnoodleRandomScramble: engines.wca }));
vi.mock('@/lib/cstimer-scramble', () => ({ CSTIMER_EVENTS: [{ id: 'gear' }], CSTIMER_EVENT_IDS: new Set(['gear']), CSTIMER_NONWCA_APPEND: [], isCstimerEvent: (id: string) => id === 'gear', cstimerScramble: engines.exotic }));
vi.mock('@/lib/native-scramble', () => ({ NATIVE_SCRAMBLE_EVENTS: [], NATIVE_SCRAMBLE_EVENT_IDS: [], NATIVE_SCRAMBLE_APPEND: [], isNativeScrambleEvent: () => false, nativeScramblePracticeHint: () => null }));
vi.mock('@/lib/shape-mod-scramble', () => ({ SHAPE_MOD_EVENTS: [], SHAPE_MOD_EVENT_IDS: [], SHAPE_MOD_APPEND: [], isShapeModEvent: () => false }));
vi.mock('@/lib/wca-events', () => ({ eventDisplayName: (id: string) => id }));
vi.mock('@/components/PuzzlePicker/PuzzlePicker', () => ({ default: (props: { onToggle?: (id: string) => void }) => props.onToggle ? createElement('button', { onClick: () => props.onToggle?.('gear'), 'data-add-gear': true }, 'gear') : null }));
vi.mock('@/components/EventIcon', () => ({ EventIcon: () => null }));
vi.mock('@/components/ScramblePreview2D', () => ({ ScramblePreview2D: () => null, eventHasScramblePreview: () => false }));
vi.mock('@/components/ScrambleImageDownload', () => ({ default: () => null }));
vi.mock('@/app/[lang]/scramble/gen/_event-picker', () => ({ scrambleEventPickerGroups: () => [] }));
vi.mock('@/app/[lang]/scramble/gen/EventScrambleOptions', () => ({ default: () => null }));
vi.mock('@/app/[lang]/scramble/gen/CopyAllScramblesButton', () => ({ default: () => null, scrambleClipboardText: (s: string) => s }));
vi.mock('@/app/[lang]/scramble/gen/ScrambleLines', () => ({ default: (props: unknown) => createElement('pre', null, JSON.stringify(props)) }));

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  engines.wca.mockReset().mockResolvedValue('R U');
  engines.exotic.mockReset().mockRejectedValue(new Error('broken exotic'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });

it('keeps successful WCA output when an exotic fails during full regeneration', async () => {
  await act(async () => root.render(createElement(QuickMode, {
    t: (_zh: string, en: string) => en, subMode: 'batch', showPreview: false,
    onTogglePreview() {}, sq1Compact: false, onSq1CompactChange() {},
  })));
  await act(async () => host.querySelector<HTMLButtonElement>('[data-add-gear]')!.click());
  await act(async () => host.querySelector<HTMLButtonElement>('button[title="Regenerate"]')!.click());
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('gear');
  expect(host.textContent).toContain('R U');
  expect(host.querySelector<HTMLButtonElement>('button[title="Regenerate"]')!.disabled).toBe(false);
  // A failed event is retriable; a previous rejection does not leave loading stuck.
  engines.exotic.mockResolvedValue('U R');
  await act(async () => host.querySelector<HTMLButtonElement>('button[title="Regenerate"]')!.click());
  expect(host.querySelector('[role="alert"]')).toBeNull();
});

it('shows a completed project while another is pending and ignores the removed project\'s late result', async () => {
  let finish!: (value: string) => void;
  engines.exotic.mockImplementation(() => new Promise<string>((resolve) => { finish = resolve; }));
  await act(async () => root.render(createElement(QuickMode, {
    t: (_zh: string, en: string) => en, subMode: 'batch', showPreview: false,
    onTogglePreview() {}, sq1Compact: false, onSq1CompactChange() {},
  })));
  await act(async () => host.querySelector<HTMLButtonElement>('[data-add-gear]')!.click());
  expect(host.textContent).toContain('R U');
  await act(async () => host.querySelector<HTMLButtonElement>('[data-add-gear]')!.click());
  expect(host.querySelector<HTMLButtonElement>('button[title="Regenerate"]')!.disabled).toBe(false);
  await act(async () => finish('late gear result'));
  expect(host.textContent).not.toContain('late gear result');
  expect(host.textContent).toContain('R U');
});
