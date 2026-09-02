// @vitest-environment jsdom

import { act, createElement, useState, type ChangeEvent } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_TIMER_WCA_SOURCE_CORE_SETTINGS,
  type TimerWcaSourceCoreSettings,
} from '@cuberoot/shared/timer';
import {
  TIMER_OVERLAY_IDS,
  TimerWcaSourceConfig,
  type TimerWcaSourceDataAdapter,
} from '@cuberoot/timer-ui';

const adapter: TimerWcaSourceDataAdapter = {
  loadCompetitions: vi.fn(async () => [{
    id: 'Example2026',
    name: 'Example Open 2026',
    displayName: '示例公开赛',
    selectedDisplayName: '示例公开赛 2026',
    city: 'Example City',
    country: 'US',
    startDate: '2026-04-05',
    endDate: '2026-04-06',
  }]),
  loadCompetitionScrambles: vi.fn(async () => [
    { eventId: '333', roundTypeId: 'f', groupId: 'B' },
    { eventId: '333', roundTypeId: '1', groupId: 'AA' },
    { eventId: '333', roundTypeId: '1', groupId: 'A' },
    { eventId: '222', roundTypeId: '1', groupId: 'C' },
  ]),
};

function Harness({
  initialSettings = DEFAULT_TIMER_WCA_SOURCE_CORE_SETTINGS,
  onOpenChange,
  open,
  sourceAdapter = adapter,
}: {
  initialSettings?: TimerWcaSourceCoreSettings;
  onOpenChange?: Parameters<typeof TimerWcaSourceConfig>[0]['onOpenChange'];
  open?: boolean;
  sourceAdapter?: TimerWcaSourceDataAdapter;
}) {
  const [settings, setSettings] = useState<TimerWcaSourceCoreSettings>(
    initialSettings,
  );
  return createElement(TimerWcaSourceConfig, {
      adapter: sourceAdapter,
      competitionDisplayName: (_id, name) => name,
      labels: {
        all: 'All',
        clearCompetition: 'Clear competition',
        comp: 'Comp',
        competitionListFailed: 'Competition list failed',
        competitionListLoading: 'Loading competitions',
        competitionSearch: 'Search competition',
        competitionScramblesFailed: 'Competition scrambles failed',
        competitionScramblesLoading: 'Loading competition scrambles',
        date: 'Date',
        dateRange: 'Date range',
        group: 'Group',
        groupOption: (group) => `Group ${group}`,
        noEventScrambles: 'No event scrambles',
        noMatchingCompetitions: 'No matching competitions',
        retry: 'Try again',
        round: 'Round',
        sourceMode: 'Real-scramble range',
      },
      maxDate: '2026-08-30',
      minDate: '1982-06-05',
      onChange: (patch) => setSettings((current) => ({ ...current, ...patch })),
      onOpenChange,
      open,
      renderCountry: (country) => createElement('span', null, country),
      renderDateRange: (props) => createElement('input', {
        'aria-label': props.ariaLabel,
        onChange: (event: ChangeEvent<HTMLInputElement>) => (
          props.onChange(event.target.value, props.to)
        ),
        type: 'date',
        value: props.from,
      }),
      roundLabel: (round) => `round-${round}`,
      settings,
      wcaEventId: '333',
    });
}

function setSearchValue(input: HTMLInputElement, value: string): void {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function competition(id: string, name = `${id} Open`): {
  id: string;
  name: string;
  country: string;
  startDate: string;
  endDate: string;
} {
  return {
    id,
    name,
    country: 'US',
    startDate: '2026-08-30',
    endDate: '2026-08-30',
  };
}

function domRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}

describe('shared controlled WCA source UI', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('closes competition, round, group, and date as one controlled flow', async () => {
    await act(async () => root.render(createElement(Harness)));
    const search = host.querySelector<HTMLInputElement>('input[aria-label="Search competition"]')!;
    await act(async () => {
      search.focus();
    });
    await vi.waitFor(() => expect(adapter.loadCompetitions).toHaveBeenCalledOnce());
    await act(async () => {
      setSearchValue(search, 'Example');
    });
    await vi.waitFor(() => expect(document.querySelector('[role="option"]')).not.toBeNull());

    await act(async () => {
      document.querySelector<HTMLButtonElement>('[role="option"]')!.click();
    });
    await vi.waitFor(() => expect(host.textContent).toContain('示例公开赛 2026'));
    await vi.waitFor(() => expect(host.querySelector('select[aria-label="Round"]')).not.toBeNull());

    const round = host.querySelector<HTMLSelectElement>('select[aria-label="Round"]')!;
    expect([...round.options].map((option) => option.value)).toEqual(['', '1', 'f']);
    await act(async () => {
      round.value = '1';
      round.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const group = host.querySelector<HTMLSelectElement>('select[aria-label="Group"]')!;
    expect([...group.options].map((option) => option.value)).toEqual(['', 'A', 'AA']);
    await act(async () => {
      group.value = 'AA';
      group.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(group.value).toBe('AA');

    const mode = host.querySelector<HTMLSelectElement>('select[aria-label="Real-scramble range"]')!;
    await act(async () => {
      mode.value = 'date';
      mode.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(host.querySelector('input[aria-label="Date range"]')).not.toBeNull();
  });

  it('shows a retryable competition-index failure instead of caching an empty list', async () => {
    const loadCompetitions = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([{
        id: 'Recovered2026',
        name: 'Recovered Open 2026',
        country: 'US',
        startDate: '2026-08-30',
        endDate: '2026-08-30',
      }]);
    const sourceAdapter: TimerWcaSourceDataAdapter = {
      ...adapter,
      loadCompetitions,
    };
    await act(async () => root.render(createElement(Harness, { sourceAdapter })));
    await act(async () => host.querySelector<HTMLInputElement>(
      'input[aria-label="Search competition"]',
    )!.focus());
    await vi.waitFor(() => expect(host.textContent).toContain('Competition list failed'));
    expect(host.querySelector('.timer-wca-source-config')?.hasAttribute('data-no-timer')).toBe(true);

    await act(async () => {
      [...host.querySelectorAll('button')]
        .find((button) => button.textContent === 'Try again')!.click();
    });
    await vi.waitFor(() => expect(loadCompetitions).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(host.textContent).not.toContain('Competition list failed'));
  });

  it('distinguishes round/group transport failure from an authoritative empty event', async () => {
    const loadCompetitionScrambles = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([{ eventId: '333', roundTypeId: '1', groupId: 'A' }]);
    const sourceAdapter: TimerWcaSourceDataAdapter = {
      ...adapter,
      loadCompetitionScrambles,
    };
    await act(async () => root.render(createElement(Harness, {
      initialSettings: {
        ...DEFAULT_TIMER_WCA_SOURCE_CORE_SETTINGS,
        wcaComp: 'Recovered2026',
        wcaCompName: 'Recovered Open 2026',
      },
      sourceAdapter,
    })));
    await vi.waitFor(() => expect(host.textContent).toContain('Competition scrambles failed'));

    await act(async () => {
      [...host.querySelectorAll('button')]
        .find((button) => button.textContent === 'Try again')!.click();
    });
    await vi.waitFor(() => expect(loadCompetitionScrambles).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(
      host.querySelector('select[aria-label="Round"]'),
    ).not.toBeNull());
  });

  it('invalidates localized competition data when the host adapter changes', async () => {
    const englishAdapter: TimerWcaSourceDataAdapter = {
      ...adapter,
      loadCompetitions: vi.fn(async () => [{
        id: 'LocaleOpen2026',
        name: 'Locale Open 2026',
        displayName: 'English Open',
        selectedDisplayName: 'English Open 2026',
        country: 'US',
        startDate: '2026-08-30',
        endDate: '2026-08-30',
      }]),
    };
    const chineseAdapter: TimerWcaSourceDataAdapter = {
      ...adapter,
      loadCompetitions: vi.fn(async () => [{
        id: 'LocaleOpen2026',
        name: 'Locale Open 2026',
        displayName: '中文公开赛',
        selectedDisplayName: '中文公开赛 2026',
        country: 'US',
        startDate: '2026-08-30',
        endDate: '2026-08-30',
      }]),
    };

    await act(async () => root.render(createElement(Harness, { sourceAdapter: englishAdapter })));
    const search = host.querySelector<HTMLInputElement>('input[aria-label="Search competition"]')!;
    await act(async () => search.focus());
    await act(async () => {
      setSearchValue(search, 'Open');
    });
    await vi.waitFor(() => expect(document.body.textContent).toContain('English Open'));
    await act(async () => document.querySelector<HTMLButtonElement>('[role="option"]')!.click());
    await vi.waitFor(() => expect(host.textContent).toContain('English Open 2026'));

    await act(async () => root.render(createElement(Harness, { sourceAdapter: chineseAdapter })));
    await vi.waitFor(() => expect(chineseAdapter.loadCompetitions).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(host.textContent).toContain('中文公开赛 2026'));
    expect(host.textContent).not.toContain('English Open 2026');
  });

  it('implements the active-descendant combobox keyboard and focus contract', async () => {
    const competitions = Array.from({ length: 24 }, (_, index) => (
      competition(`Open${String(index).padStart(2, '0')}2026`)
    ));
    const sourceAdapter: TimerWcaSourceDataAdapter = {
      ...adapter,
      loadCompetitions: vi.fn(async () => competitions),
    };
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    try {
      await act(async () => root.render(createElement(Harness, { sourceAdapter })));
      const search = host.querySelector<HTMLInputElement>('[role="combobox"]')!;
      expect(search.getAttribute('aria-expanded')).toBe('false');
      expect(search.getAttribute('aria-busy')).toBe('false');

      await act(async () => search.focus());
      await vi.waitFor(() => expect(sourceAdapter.loadCompetitions).toHaveBeenCalledOnce());
      await act(async () => setSearchValue(search, 'Open'));
      await vi.waitFor(() => expect(document.querySelectorAll('[role="option"]')).toHaveLength(20));

      const listbox = document.querySelector<HTMLElement>('[role="listbox"]')!;
      expect(search.getAttribute('aria-expanded')).toBe('true');
      expect(search.getAttribute('aria-controls')).toBe(listbox.id);
      expect(search.getAttribute('aria-activedescendant')).toBeNull();

      await act(async () => {
        search.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowUp' }));
      });
      const options = [...document.querySelectorAll<HTMLElement>('[role="option"]')];
      expect(search.getAttribute('aria-activedescendant')).toBe(options[19]!.id);
      expect(options[19]!.getAttribute('aria-selected')).toBe('true');
      expect(scrollIntoView).toHaveBeenCalled();

      await act(async () => {
        search.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
      });
      expect(document.querySelector('[role="listbox"]')).toBeNull();
      expect(search.getAttribute('aria-expanded')).toBe('false');
      expect(search.getAttribute('aria-controls')).toBeNull();
      expect(search.getAttribute('aria-activedescendant')).toBeNull();
      expect(document.activeElement).toBe(search);

      await act(async () => {
        search.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown' }));
      });
      await vi.waitFor(() => expect(document.querySelector('[role="listbox"]')).not.toBeNull());
      expect(search.getAttribute('aria-activedescendant')).toBe(
        document.querySelectorAll<HTMLElement>('[role="option"]')[0]!.id,
      );
      await act(async () => {
        search.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
      });
      await vi.waitFor(() => expect(host.textContent).toContain('Open002026 Open'));
      const clear = host.querySelector<HTMLButtonElement>('[aria-label="Clear competition"]')!;
      await vi.waitFor(() => expect(document.activeElement).toBe(clear));
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it('dismisses on an outside pointer without stealing the outside target focus', async () => {
    await act(async () => root.render(createElement(Harness)));
    const search = host.querySelector<HTMLInputElement>('[role="combobox"]')!;
    await act(async () => search.focus());
    await vi.waitFor(() => expect(adapter.loadCompetitions).toHaveBeenCalledOnce());
    await act(async () => setSearchValue(search, 'Example'));
    await vi.waitFor(() => expect(document.querySelector('[role="listbox"]')).not.toBeNull());

    const outside = document.createElement('button');
    document.body.appendChild(outside);
    await act(async () => {
      outside.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      outside.focus();
    });
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    expect(search.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it('lets a host close the competition overlay from the shared overlay id', async () => {
    const onOpenChange = vi.fn();
    const initialSettings = {
      ...DEFAULT_TIMER_WCA_SOURCE_CORE_SETTINGS,
      wcaCompName: 'Example',
    };
    const render = (open: boolean) => root.render(createElement(Harness, {
      initialSettings,
      onOpenChange,
      open,
    }));
    await act(async () => render(true));
    const search = host.querySelector<HTMLInputElement>('[role="combobox"]')!;
    await act(async () => search.focus());
    await vi.waitFor(() => expect(document.querySelector('[role="listbox"]')).not.toBeNull());

    await act(async () => document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })));
    expect(onOpenChange).toHaveBeenLastCalledWith(false, {
      id: TIMER_OVERLAY_IDS.wcaCompetition,
      reason: 'outside',
    });
    expect(document.querySelector('[role="listbox"]')).not.toBeNull();

    await act(async () => render(false));
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    expect(search.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(search);
  });

  it('announces busy and no-match states through the combobox relationship', async () => {
    let resolveCompetitions!: (value: readonly ReturnType<typeof competition>[]) => void;
    const loadCompetitions = vi.fn(() => new Promise<readonly ReturnType<typeof competition>[]>((resolve) => {
      resolveCompetitions = resolve;
    }));
    const sourceAdapter: TimerWcaSourceDataAdapter = {
      ...adapter,
      loadCompetitions,
    };
    await act(async () => root.render(createElement(Harness, { sourceAdapter })));
    const search = host.querySelector<HTMLInputElement>('[role="combobox"]')!;
    await act(async () => {
      search.focus();
      setSearchValue(search, 'Missing');
    });
    expect(search.getAttribute('aria-busy')).toBe('true');
    expect(host.textContent).toContain('Loading competitions');

    await act(async () => resolveCompetitions([]));
    await vi.waitFor(() => expect(search.getAttribute('aria-busy')).toBe('false'));
    const noMatches = [...host.querySelectorAll<HTMLElement>('[role="status"]')]
      .find((element) => element.textContent === 'No matching competitions')!;
    expect(noMatches).not.toBeUndefined();
    expect(noMatches.getAttribute('aria-live')).toBe('polite');
    expect(search.getAttribute('aria-describedby')).toBe(noMatches.id);
    expect(search.getAttribute('aria-expanded')).toBe('false');
  });

  it('clamps a portaled list inside an extremely small visual and clipping viewport', async () => {
    const originalVisualViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: {
        addEventListener: vi.fn(),
        height: 80,
        offsetLeft: 4,
        offsetTop: 10,
        removeEventListener: vi.fn(),
        width: 120,
      },
    });
    host.style.overflow = 'auto';
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      if (this === host) return domRect(10, 18, 100, 54);
      if (this.classList.contains('timer-wca-competition')) return domRect(76, 43, 45, 18);
      return originalGetBoundingClientRect.call(this);
    };

    try {
      await act(async () => root.render(createElement(Harness)));
      const search = host.querySelector<HTMLInputElement>('[role="combobox"]')!;
      await act(async () => search.focus());
      await vi.waitFor(() => expect(adapter.loadCompetitions).toHaveBeenCalledOnce());
      await act(async () => setSearchValue(search, 'Example'));
      const popup = await vi.waitFor(() => {
        const value = document.querySelector<HTMLElement>('[role="listbox"]');
        expect(value).not.toBeNull();
        expect(value!.style.visibility).toBe('visible');
        return value!;
      });

      expect(parseFloat(popup.style.left)).toBe(18);
      expect(parseFloat(popup.style.top)).toBe(26);
      expect(parseFloat(popup.style.width)).toBe(84);
      expect(parseFloat(popup.style.maxHeight)).toBe(13);
      expect(parseFloat(popup.style.width)).toBeLessThan(240);
      expect(parseFloat(popup.style.maxHeight)).toBeLessThan(96);
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
      if (originalVisualViewport) {
        Object.defineProperty(window, 'visualViewport', originalVisualViewport);
      } else {
        Reflect.deleteProperty(window, 'visualViewport');
      }
      host.style.overflow = '';
    }
  });
});
