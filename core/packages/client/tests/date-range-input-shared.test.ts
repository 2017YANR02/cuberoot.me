// @vitest-environment jsdom

import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DateRangeInput,
  type DateRangeInputLabels,
} from '@cuberoot/timer-ui';

const LABELS: DateRangeInputLabels = {
  dateInput: {
    clearDate: 'Clear date',
    chooseDate: 'Choose date',
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    year: 'Year',
    month: 'Month',
    monthOption: (month) => `Month ${month}`,
    weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    today: 'Today',
    calendarDate: (year, month, day) => `${year}-${month}-${day}`,
  },
  dateRange: 'Date range',
  startDate: 'Start date',
  endDate: 'End date',
  clearDateRange: 'Clear date range',
};

function setDateValue(input: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('shared DateRangeInput', () => {
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

  it('couples bounds, rejects reversed edits, and clears both ends in one action', async () => {
    const changes = vi.fn();
    function Harness() {
      const [range, setRange] = useState<[string, string]>(['2026-08-10', '2026-08-20']);
      return createElement(DateRangeInput, {
        labels: LABELS,
        from: range[0],
        to: range[1],
        min: '1982-06-05',
        max: '2026-08-30',
        onChange: (from, to) => {
          changes(from, to);
          setRange([from, to]);
        },
      });
    }

    await act(async () => root.render(createElement(Harness)));
    const group = host.querySelector<HTMLElement>('[role="group"]');
    const inputs = Array.from(host.querySelectorAll<HTMLInputElement>('input[type="date"]'));
    expect(group?.getAttribute('aria-label')).toBe('Date range');
    expect(group?.textContent).toContain('~');
    expect(inputs).toHaveLength(2);
    expect(inputs[0]?.min).toBe('1982-06-05');
    expect(inputs[0]?.max).toBe('2026-08-20');
    expect(inputs[1]?.min).toBe('2026-08-10');
    expect(inputs[1]?.max).toBe('2026-08-30');
    expect(inputs[0]?.getAttribute('aria-label')).toBe('Start date');
    expect(inputs[1]?.getAttribute('aria-label')).toBe('End date');

    await act(async () => setDateValue(inputs[0]!, '2026-08-25'));
    expect(changes).not.toHaveBeenCalled();

    await act(async () => setDateValue(inputs[0]!, '2026-08-12'));
    expect(changes).toHaveBeenLastCalledWith('2026-08-12', '2026-08-20');
    expect(inputs[1]?.min).toBe('2026-08-12');

    changes.mockClear();
    await act(async () => setDateValue(inputs[1]!, '2026-08-11'));
    expect(changes).not.toHaveBeenCalled();

    const clear = host.querySelector<HTMLButtonElement>('button[aria-label="Clear date range"]');
    await act(async () => clear?.click());
    expect(changes).toHaveBeenLastCalledWith('', '');
    expect(inputs.map(input => input.value)).toEqual(['', '']);
  });

  it('disables both date controls and withholds the clear action', async () => {
    await act(async () => root.render(createElement(DateRangeInput, {
      labels: LABELS,
      from: '2026-08-10',
      to: '2026-08-20',
      disabled: true,
      onChange: vi.fn(),
    })));
    const inputs = Array.from(host.querySelectorAll<HTMLInputElement>('input[type="date"]'));
    expect(inputs.map(input => input.disabled)).toEqual([true, true]);
    expect(host.querySelector('button[aria-label="Clear date range"]')).toBeNull();
  });
});
