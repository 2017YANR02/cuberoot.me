// @vitest-environment jsdom

import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_TIMER_WCA_SOURCE_SETTINGS,
  type TimerWcaDifficultyDataAdapter,
  type TimerWcaDifficultySettings,
  type TimerWcaSourceSettings,
} from '@cuberoot/shared/timer';
import {
  TimerWcaDifficultyConfig,
  type TimerWcaDifficultyLabels,
} from '@cuberoot/timer-ui';

const catalog = {
  distribution: {
    sets: {
      wca: {
        variants: {
          std: { data: { cross: { BGORWY: { min: 4, max: 8 } } } },
        },
      },
    },
  },
  eventLengths: { events: { 333: { counts: { 18: 1, 20: 1 } } } },
  // A 404 steps-layout uses the shared static method/stage catalog.
  layout: null,
};

const labels: TimerWcaDifficultyLabels = {
  colorMode: { cn: 'CN', dual: 'Dual', quad: 'Quad', single: 'Single' },
  colorName: (color) => color,
  colorSubsetAriaLabel: 'Color subset',
  difficulty: 'Difficulty',
  difficultyAriaLabel: 'Difficulty switch',
  merge: 'Merge',
  mergeAriaLabel: 'Merge switch',
  mergeHelp: 'Merge family events',
  methodAriaLabel: 'Method',
  methodLabel: (key) => `method-${key}`,
  rangeAriaLabel: 'Difficulty range',
  scrambleLengthRangeAriaLabel: 'Scramble length range',
  stageAriaLabel: 'Stage',
  stageLabel: (key) => `stage-${key}`,
  unindexedCompetition: 'This competition is not indexed.',
};

function adapter(coverage: boolean | null = null): TimerWcaDifficultyDataAdapter {
  return {
    loadCatalog: vi.fn(async () => catalog),
    loadDistribution: vi.fn(async () => catalog.distribution),
    loadEventLengths: vi.fn(async () => catalog.eventLengths),
    loadLayout: vi.fn(async () => null),
    fetchByDifficulty: vi.fn(async () => null),
    getCompetitionCoverage: vi.fn(() => coverage),
    probeCompetitionCoverage: vi.fn(async () => coverage),
  };
}

function Harness({ sourceAdapter }: { sourceAdapter: TimerWcaDifficultyDataAdapter }) {
  const [settings, setSettings] = useState<TimerWcaSourceSettings>({
    ...DEFAULT_TIMER_WCA_SOURCE_SETTINGS,
    wcaScrambleMode: 'date',
    wcaDifficultyOn: true,
    wcaDiffSteps: [4, 5, 6],
  });
  return createElement('div', null,
    createElement(TimerWcaDifficultyConfig, {
      adapter: sourceAdapter,
      labels,
      onChange: (patch: Partial<TimerWcaDifficultySettings>) => (
        setSettings((current) => ({ ...current, ...patch }))
      ),
      settings,
      wcaEventId: '333',
    }),
    createElement('output', { 'data-settings': true }, JSON.stringify(settings)),
  );
}

function setRangeValue(input: HTMLInputElement, value: string): void {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('shared WCA difficulty UI', () => {
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
  });

  it('keeps method, stage, colors, range and merge in one controlled interaction flow', async () => {
    await act(async () => root.render(createElement(Harness, { sourceAdapter: adapter() })));
    await vi.waitFor(() => expect(
      host.querySelector<HTMLSelectElement>('select[aria-label="Method"]'),
    ).not.toBeNull());

    const method = host.querySelector<HTMLSelectElement>('select[aria-label="Method"]')!;
    expect([...method.options].map((option) => option.value)).toContain('length');
    expect(host.querySelector('select[aria-label="Stage"]')).not.toBeNull();
    const colors = host.querySelector<HTMLSelectElement>('select[aria-label="Color subset"]')!;
    expect(colors.selectedOptions[0]?.textContent).toBe('CN · BGORWY');
    const stage = host.querySelector<HTMLSelectElement>('select[aria-label="Stage"]')!;
    const merge = host.querySelector<HTMLButtonElement>(
      '[role="switch"][aria-label="Merge switch"]',
    )!;

    await act(async () => {
      colors.value = 'WY';
      colors.dispatchEvent(new Event('change', { bubbles: true }));
      stage.value = 'xcross';
      stage.dispatchEvent(new Event('change', { bubbles: true }));
      merge.click();
    });
    await vi.waitFor(() => expect(
      JSON.parse(host.querySelector('output')!.textContent!),
    ).toMatchObject({
      wcaDiffColors: 'WY',
      wcaDiffMerged: false,
      wcaDiffStage: 'xcross',
    }));

    await act(async () => {
      method.value = 'length';
      method.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await vi.waitFor(() => expect(
      JSON.parse(host.querySelector('output')!.textContent!).wcaDiffVariant,
    ).toBe('length'));
    expect(host.querySelector('select[aria-label="Stage"]')).toBeNull();
    expect(host.querySelector('select[aria-label="Color subset"]')).toBeNull();

    const min = host.querySelector<HTMLInputElement>(
      'input[aria-label="Scramble length range — min"]',
    )!;
    const max = host.querySelector<HTMLInputElement>(
      'input[aria-label="Scramble length range — max"]',
    )!;
    expect(min.type).toBe('range');
    expect(max.type).toBe('range');
    await act(async () => {
      setRangeValue(min, '19');
    });
    await new Promise((resolve) => setTimeout(resolve, 370));
    await vi.waitFor(() => expect(
      JSON.parse(host.querySelector('output')!.textContent!).wcaDiffSteps,
    ).toEqual([19, 20]));
  });

  it('explains an unindexed competition without mutating persisted difficulty', async () => {
    const sourceAdapter = adapter(false);
    const onChange = vi.fn();
    await act(async () => root.render(createElement(TimerWcaDifficultyConfig, {
      adapter: sourceAdapter,
      labels,
      onChange,
      settings: {
        ...DEFAULT_TIMER_WCA_SOURCE_SETTINGS,
        wcaComp: 'Unindexed2026',
        wcaCompName: 'Unindexed Open 2026',
        wcaDifficultyOn: true,
        wcaDiffSteps: [4, 5, 6],
      },
      wcaEventId: '333',
    })));
    await vi.waitFor(() => expect(
      host.querySelector('[role="switch"][aria-label="Difficulty switch"]'),
    ).not.toBeNull());
    expect(host.querySelector('.timer-wca-difficulty-body')).toBeNull();

    await act(async () => {
      host.querySelector<HTMLButtonElement>(
        '[role="switch"][aria-label="Difficulty switch"]',
      )!.click();
    });
    expect(host.querySelector('[role="status"]')?.textContent)
      .toBe('This competition is not indexed.');
    expect(onChange).not.toHaveBeenCalledWith({ wcaDifficultyOn: false });
  });

  it('flushes a pending range change on unmount instead of losing the last keyboard input', async () => {
    const onChange = vi.fn();
    await act(async () => root.render(createElement(TimerWcaDifficultyConfig, {
      adapter: adapter(),
      labels,
      onChange,
      settings: {
        ...DEFAULT_TIMER_WCA_SOURCE_SETTINGS,
        wcaScrambleMode: 'date',
        wcaDifficultyOn: true,
        wcaDiffSteps: [4, 5, 6],
      },
      wcaEventId: '333',
    })));
    await vi.waitFor(() => expect(
      host.querySelector<HTMLInputElement>('input[aria-label="Difficulty range — max"]'),
    ).not.toBeNull());
    const max = host.querySelector<HTMLInputElement>('input[aria-label="Difficulty range — max"]')!;
    await act(async () => {
      setRangeValue(max, '7');
    });
    await act(async () => root.unmount());
    expect(onChange).toHaveBeenCalledWith({ wcaDiffSteps: [4, 5, 6, 7] });
    root = createRoot(host);
  });
});
