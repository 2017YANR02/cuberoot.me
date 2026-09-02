// @vitest-environment jsdom

import {
  DEFAULT_TIMER_RANDOM_DIFFICULTY_SETTINGS,
  type TimerRandomDifficultySettings,
} from '@cuberoot/shared/timer';
import {
  TimerRandomDifficultyCaseBar,
  TimerRandomDifficultyConfig,
} from '@cuberoot/timer-ui';
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function ConfigHarness() {
  const [settings, setSettings] = useState<TimerRandomDifficultySettings>({
    ...DEFAULT_TIMER_RANDOM_DIFFICULTY_SETTINGS,
    genDiffOn: true,
  });
  return createElement('div', null,
    createElement(TimerRandomDifficultyConfig, {
      language: 'en',
      onChange: (patch: Partial<TimerRandomDifficultySettings>) => (
        setSettings((current) => ({ ...current, ...patch }))
      ),
      settings,
    }),
    createElement('output', null, JSON.stringify(settings)),
  );
}

describe('shared random-difficulty timer UI', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  it('uses visual colors, method, stage, slot and range in one controlled component', async () => {
    await act(async () => root.render(createElement(ConfigHarness)));
    expect(host.querySelector('[role="switch"][aria-label="Generate by difficulty"]'))
      .not.toBeNull();
    expect(host.querySelector('select[aria-label="Method"]')).not.toBeNull();
    expect(host.querySelector('select[aria-label="Stage"]')).not.toBeNull();
    expect(host.querySelectorAll('input[type="range"]')).toHaveLength(2);
    expect(host.querySelector('.timer-random-difficulty-config')?.textContent).not.toContain('BGORWY');
    expect(host.querySelector('select[aria-label="F2L slot"]')).toBeNull();

    await act(async () => host.querySelector<HTMLButtonElement>('.subset-picker-mode')!.click());
    const white = [...host.querySelectorAll<HTMLButtonElement>('.subset-swatch')]
      .find((button) => button.getAttribute('aria-label') === 'White')!;
    await act(async () => white.click());
    const stage = host.querySelector<HTMLSelectElement>('select[aria-label="Stage"]')!;
    await act(async () => {
      stage.value = 'xcross';
      stage.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await vi.waitFor(() => expect(host.querySelector('select[aria-label="F2L slot"]')).not.toBeNull());
    expect(JSON.parse(host.querySelector('output')!.textContent!).genDiffColors).toBe('W');
  });

  it('disables every setting control while a solve is running', async () => {
    const onChange = vi.fn();
    await act(async () => root.render(createElement(TimerRandomDifficultyConfig, {
      disabled: true,
      language: 'en',
      onChange,
      settings: {
        ...DEFAULT_TIMER_RANDOM_DIFFICULTY_SETTINGS,
        genDiffOn: true,
        genDiffSteps: [4, 5, 6],
      },
    })));
    const selector = '[role="switch"], .subset-picker-mode, select, input[type="range"]';
    await vi.waitFor(() => expect(host.querySelectorAll(selector)).not.toHaveLength(0));
    const before = onChange.mock.calls.length;
    for (const control of host.querySelectorAll<HTMLButtonElement | HTMLSelectElement | HTMLInputElement>(
      selector,
    )) {
      expect(control.disabled).toBe(true);
      await act(async () => control.click());
    }
    expect(onChange).toHaveBeenCalledTimes(before);
  });

  it('returns the color picker to persisted settings after a failed write', async () => {
    const onChange = vi.fn();
    const settings = {
      ...DEFAULT_TIMER_RANDOM_DIFFICULTY_SETTINGS,
      genDiffOn: true,
    };
    const render = () => root.render(createElement(TimerRandomDifficultyConfig, {
      language: 'en',
      onChange,
      settings,
    }));
    await act(async () => render());
    await act(async () => host.querySelector<HTMLButtonElement>('.subset-picker-mode')!.click());
    const white = [...host.querySelectorAll<HTMLButtonElement>('.subset-swatch')]
      .find((button) => button.getAttribute('aria-label') === 'White')!;
    await act(async () => white.click());
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith({ genDiffColors: 'W' }));

    await act(async () => render());
    await vi.waitFor(() => expect(host.querySelector('.subset-picker-mode')?.getAttribute('aria-label'))
      .toContain('Color-neutral, all six'));
  });

  it('drops a late answer when the displayed history occurrence changes', async () => {
    let resolveOld!: (value: { frame: string; notation: string }) => void;
    let oldSignal!: AbortSignal;
    const oldSolve = vi.fn((signal: AbortSignal) => new Promise<{ frame: string; notation: string }>((resolve) => {
      oldSignal = signal;
      resolveOld = resolve;
    }));
    const spec = { variant: 'std', stage: 'cross', colors: 'W', slot: 0, lo: 4, hi: 6 };
    await act(async () => root.render(createElement(TimerRandomDifficultyCaseBar, {
      depth: 5,
      language: 'en',
      occurrenceKey: 1,
      solve: oldSolve,
      spec,
    })));
    await act(async () => host.querySelector<HTMLButtonElement>('.trainer-case-reveal')!.click());
    expect(host.textContent).toContain('Solving');

    const currentSolve = vi.fn(async () => ({ frame: 'white', notation: "R U R'" }));
    await act(async () => root.render(createElement(TimerRandomDifficultyCaseBar, {
      depth: 6,
      language: 'en',
      occurrenceKey: 2,
      solve: currentSolve,
      spec,
    })));
    expect(oldSignal.aborted).toBe(true);
    await act(async () => resolveOld({ frame: 'old', notation: 'OLD' }));
    expect(host.textContent).not.toContain('OLD');

    await act(async () => host.querySelector<HTMLButtonElement>('.trainer-case-reveal')!.click());
    await vi.waitFor(() => expect(host.textContent).toContain("R U R'"));
    expect(currentSolve).toHaveBeenCalledTimes(1);
  });

  it('does not reveal an answer while the timer is running', async () => {
    const solve = vi.fn(async () => ({ frame: 'white', notation: "R U R'" }));
    await act(async () => root.render(createElement(TimerRandomDifficultyCaseBar, {
      depth: 5,
      disabled: true,
      language: 'en',
      occurrenceKey: 1,
      solve,
      spec: { variant: 'std', stage: 'cross', colors: 'W', slot: 0, lo: 4, hi: 6 },
    })));
    const answer = host.querySelector<HTMLButtonElement>('.trainer-case-reveal')!;
    expect(answer.disabled).toBe(true);
    await act(async () => answer.click());
    expect(solve).not.toHaveBeenCalled();
  });

  it('drops a late answer when the language changes', async () => {
    let resolveOld!: (value: { frame: string; notation: string }) => void;
    let oldSignal!: AbortSignal;
    const solve = vi.fn((signal: AbortSignal) => new Promise<{ frame: string; notation: string }>((resolve) => {
      oldSignal = signal;
      resolveOld = resolve;
    }));
    const spec = { variant: 'std', stage: 'cross', colors: 'W', slot: 0, lo: 4, hi: 6 };
    await act(async () => root.render(createElement(TimerRandomDifficultyCaseBar, {
      depth: 5,
      language: 'en',
      occurrenceKey: 1,
      solve,
      spec,
    })));
    await act(async () => host.querySelector<HTMLButtonElement>('.trainer-case-reveal')!.click());
    await act(async () => root.render(createElement(TimerRandomDifficultyCaseBar, {
      depth: 5,
      language: 'zh',
      occurrenceKey: 1,
      solve,
      spec,
    })));
    expect(oldSignal.aborted).toBe(true);
    await act(async () => resolveOld({ frame: 'white', notation: 'OLD' }));
    expect(host.textContent).not.toContain('OLD');
    expect(host.textContent).toContain('答案');
  });
});
