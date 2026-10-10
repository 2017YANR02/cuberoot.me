// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScrambleSourceBar from '@/app/[lang]/timer/_components/ScrambleSourceBar';
import type { EventId } from '@/app/[lang]/timer/_lib/types';

const state = vi.hoisted(() => ({
  settings: {
    scrambleSource: 'wca' as 'wca' | 'random' | 'manual',
    manualScrambles: "UFR UFL'",
    syncSeed: false,
  },
  updateSettings: vi.fn(),
}));

vi.mock('@/app/[lang]/timer/_lib/settings', () => ({
  useSettings: () => state.settings,
  updateSettings: state.updateSettings,
}));
vi.mock('@/components/WcaSourceConfig', () => ({
  default: () => createElement('div', { 'data-testid': 'wca-source-config' }, 'Competition controls'),
}));
vi.mock('@/app/[lang]/timer/_components/GenStepsConfig', () => ({ default: () => null }));
vi.mock('@/app/[lang]/timer/_components/GenDiffConfig', () => ({ default: () => null }));
vi.mock('@/components/Scramble222ModePicker', () => ({ default: () => null }));
vi.mock('@/lib/scramble-222-mode', () => ({ use222Type: () => ['full', vi.fn()] }));
vi.mock('@/i18n/tr', () => ({ tr: (copy: { en: string }) => copy.en }));

describe('Timer source controls follow puzzle capabilities', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    state.settings.scrambleSource = 'wca';
    state.settings.manualScrambles = "UFR UFL'";
    state.updateSettings.mockClear();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  function render(event: EventId) {
    act(() => root.render(createElement(ScrambleSourceBar, { event, isZh: false })));
  }

  it.each([
    'superz', 'dogic', 'octahedron4', 'dinoskewb', 'cube3dino',
    'lattice', 'hyperx', 'latticex', 'masterbrilic', 'masterftov2',
  ] as const)(
    'hides competition controls for %s and restores them on returning to 333 without changing settings',
    (event) => {
      render('333');
      expect(host.querySelector('[data-testid="wca-source-config"]')).not.toBeNull();
      render(event);
      expect(host.querySelector('[data-testid="wca-source-config"]')).toBeNull();
      render('333');
      expect(host.querySelector('[data-testid="wca-source-config"]')).not.toBeNull();
      expect(state.updateSettings).not.toHaveBeenCalled();
    },
  );

  it('retains the native puzzle manual queue and persists edits without changing its source', () => {
    state.settings.scrambleSource = 'manual';
    render('dogic');
    expect(host.querySelector('[data-testid="wca-source-config"]')).toBeNull();
    const textarea = host.querySelector<HTMLTextAreaElement>('textarea[aria-label="Manual scrambles"]');
    expect(textarea?.value).toBe("UFR UFL'");
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
        ?.call(textarea, "UFR UFL'\nUBR");
      textarea?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(state.updateSettings).toHaveBeenCalledExactlyOnceWith({ manualScrambles: "UFR UFL'\nUBR" });
  });
});
