// @vitest-environment jsdom

import { DateRangeInput } from '@cuberoot/timer-ui';
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { dateRangeInputLabels } from './copy';

function setDateValue(input: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('mobile WCA DateRangeInput integration', () => {
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

  it('uses the bilingual app labels, coupled limits, rejection, and range clear action', async () => {
    const changes = vi.fn();
    function Harness() {
      const [range, setRange] = useState<[string, string]>(['2025-01-02', '2025-01-10']);
      return createElement(DateRangeInput, {
        labels: dateRangeInputLabels('zh'),
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
    expect(group?.getAttribute('aria-label')).toBe('日期范围');
    expect(group?.textContent).toContain('~');
    expect(inputs[0]?.getAttribute('aria-label')).toBe('开始日期');
    expect(inputs[1]?.getAttribute('aria-label')).toBe('结束日期');
    expect(inputs[0]?.max).toBe('2025-01-10');
    expect(inputs[1]?.min).toBe('2025-01-02');

    await act(async () => setDateValue(inputs[0]!, '2025-01-11'));
    expect(changes).not.toHaveBeenCalled();

    await act(async () => setDateValue(inputs[0]!, '2025-01-03'));
    expect(changes).toHaveBeenLastCalledWith('2025-01-03', '2025-01-10');
    expect(inputs[1]?.min).toBe('2025-01-03');

    const clear = host.querySelector<HTMLButtonElement>('button[aria-label="清除日期范围"]');
    await act(async () => clear?.click());
    expect(changes).toHaveBeenLastCalledWith('', '');
  });

  it('keeps English calendar aria labels available to the same component', () => {
    const labels = dateRangeInputLabels('en');
    expect(labels.dateRange).toBe('Date range');
    expect(labels.dateInput.chooseDate).toBe('Choose date');
    expect(labels.dateInput.calendarDate(2026, 8, 30)).toBe('Aug 30, 2026');
  });
});
