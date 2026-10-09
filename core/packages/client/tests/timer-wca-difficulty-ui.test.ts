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
      language: 'en',
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

  const open = async () => {
    await act(async () => host.querySelector<HTMLButtonElement>('.timer-difficulty-trigger')!.click());
  };
  const apply = async () => {
    await act(async () => document.querySelector<HTMLButtonElement>('.timer-difficulty-actions [data-primary]')!.click());
  };

  it('edits colors, stage and range as a draft, including the last range input', async () => {
    await act(async () => root.render(createElement(Harness, { sourceAdapter: adapter() })));
    expect(host.querySelector('select[aria-label="Difficulty switch"]')).toBeNull();
    expect(document.querySelector('select[aria-label="Method"]')).toBeNull();
    await open();
    const colors = document.querySelector<HTMLButtonElement>('.subset-picker-mode')!;
    await act(async () => colors.click());
    await act(async () => document.querySelector<HTMLButtonElement>('.subset-picker-panel button[aria-label="White+Yellow"]')!.click());
    const stage = document.querySelector<HTMLSelectElement>('select[aria-label="Stage"]')!;
    await act(async () => {
      stage.value = 'xcross'; stage.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(JSON.parse(host.querySelector('output')!.textContent!).wcaDiffStage).toBe('cross');
    await apply();
    expect(JSON.parse(host.querySelector('output')!.textContent!)).toMatchObject({ wcaDiffColors: 'WY', wcaDiffStage: 'xcross' });
    await open();
    const method = document.querySelector<HTMLSelectElement>('select[aria-label="Method"]')!;
    await act(async () => {
      method.value = 'length'; method.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(document.querySelector('select[aria-label="Stage"]')).toBeNull();
    const min = document.querySelector<HTMLInputElement>('input[aria-label="Scramble length range — min"]')!;
    await act(async () => setRangeValue(min, '19'));
    await apply();
    expect(JSON.parse(host.querySelector('output')!.textContent!).wcaDiffSteps).toEqual([19, 20]);
  });

  it('explains an unindexed competition inside the dialog without changing settings', async () => {
    const onChange = vi.fn();
    await act(async () => root.render(createElement(TimerWcaDifficultyConfig, {
      adapter: adapter(false), language: 'en', labels, onChange,
      settings: { ...DEFAULT_TIMER_WCA_SOURCE_SETTINGS, wcaComp: 'Unindexed2026', wcaCompName: 'Unindexed', wcaDifficultyOn: true, wcaDiffSteps: [4, 5, 6] },
      wcaEventId: '333',
    })));
    onChange.mockClear();
    await open();
    expect(document.querySelector('[role="status"]')?.textContent).toBe('This competition is not indexed.');
    expect(document.querySelector<HTMLButtonElement>('[data-primary]')!.disabled).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
    const method = document.querySelector<HTMLSelectElement>('select[aria-label="Method"]')!;
    expect(method.disabled).toBe(false);
    expect(document.querySelector<HTMLSelectElement>('select[aria-label="Stage"]')!.disabled).toBe(true);
    expect(document.querySelector('input[aria-label="Difficulty range — min"]')).toBeNull();
    await act(async () => {
      method.value = 'length'; method.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(document.querySelector('[role="status"]')).toBeNull();
    expect(document.querySelector('input[aria-label="Scramble length range — min"]')).not.toBeNull();
    expect(document.querySelector<HTMLButtonElement>('[data-primary]')!.disabled).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
    await apply();
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ wcaDifficultyOn: true, wcaDiffVariant: 'length' }));
  });

  it('discards pending edits on close and unmount; applies only an explicit clear', async () => {
    await act(async () => root.render(createElement(Harness, { sourceAdapter: adapter() })));
    const before = host.querySelector('output')!.textContent;
    await open();
    await act(async () => setRangeValue(document.querySelector<HTMLInputElement>('input[aria-label="Difficulty range — max"]')!, '7'));
    await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click());
    expect(host.querySelector('output')!.textContent).toBe(before);
    await open();
    expect(document.querySelector<HTMLInputElement>('input[aria-label="Difficulty range — max"]')!.value).toBe('6');
    await act(async () => document.querySelector<HTMLButtonElement>('.timer-difficulty-actions button')!.click());
    expect(JSON.parse(host.querySelector('output')!.textContent!).wcaDifficultyOn).toBe(false);
    const onChange = vi.fn();
    await act(async () => root.render(createElement(TimerWcaDifficultyConfig, {
      adapter: adapter(), language: 'en', labels, onChange,
      settings: { ...DEFAULT_TIMER_WCA_SOURCE_SETTINGS, wcaScrambleMode: 'date', wcaDifficultyOn: true, wcaDiffSteps: [4, 5, 6] }, wcaEventId: '333',
    })));
    onChange.mockClear();
    await open();
    await act(async () => setRangeValue(document.querySelector<HTMLInputElement>('input[aria-label="Difficulty range — max"]')!, '7'));
    await act(async () => root.unmount());
    expect(onChange).not.toHaveBeenCalled();
    root = createRoot(host);
  });
});
