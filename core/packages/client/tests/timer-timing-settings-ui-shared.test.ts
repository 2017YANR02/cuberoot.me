// @vitest-environment jsdom

import BoolToggle from '@/components/BoolToggle';
import {
  DEFAULT_TIMER_TIMING_SETTINGS,
  TIMER_SETTING_FIELD_CONTRACTS,
  type TimerSettingCopy,
  type TimerTimingSettings,
} from '@cuberoot/shared/timer';
import {
  TIMER_TIMING_SETTING_FIELD_IDS,
  TimerTimingSettingsSections,
  type TimerBooleanControlProps,
} from '@cuberoot/timer-ui';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const localizeEn = (copy: TimerSettingCopy) => copy.en;
const localizeZh = (copy: TimerSettingCopy) => copy.zh;

function renderWebBooleanControl({
  disabled,
  label,
  onChange,
  value,
}: TimerBooleanControlProps) {
  return createElement(BoolToggle, { disabled, label, onChange, value });
}

describe('shared Timer Timing settings UI', () => {
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

  async function render({
    active = true,
    localize = localizeEn,
    onChange = vi.fn<(patch: Partial<TimerTimingSettings>) => void>(),
    value = DEFAULT_TIMER_TIMING_SETTINGS,
  }: {
    active?: boolean;
    localize?: (copy: TimerSettingCopy) => string;
    onChange?: (patch: Partial<TimerTimingSettings>) => void;
    value?: TimerTimingSettings;
  } = {}) {
    await act(async () => root.render(createElement(TimerTimingSettingsSections, {
      active,
      localize,
      onChange,
      renderBooleanControl: renderWebBooleanControl,
      value,
    })));
    return onChange;
  }

  it('renders the exact eight contract fields, Web DOM classes, labels, and value policies', async () => {
    await render();

    expect(TIMER_TIMING_SETTING_FIELD_IDS).toEqual(
      TIMER_SETTING_FIELD_CONTRACTS
        .filter((field) => field.category === 'timer')
        .map((field) => field.id),
    );
    expect([...host.querySelectorAll<HTMLElement>('[data-setting-id]')]
      .map((element) => element.dataset.settingId)).toEqual(TIMER_TIMING_SETTING_FIELD_IDS);
    expect(host.querySelectorAll('.settings-section')).toHaveLength(4);
    expect([...host.querySelectorAll<HTMLElement>('.settings-section-head h4')]
      .map((heading) => heading.textContent)).toEqual([
        'Events and sessions',
        'Timing display',
        'Result precision',
      ]);

    const enabled = host.querySelector<HTMLElement>('[data-setting-id="settings.timer.enabled"]')!;
    expect(enabled.matches('.settings-row')).toBe(false);
    expect(enabled.parentElement?.className).toBe('settings-section-head');
    expect(enabled.querySelector('.bool-toggle > .pill-toggle.pill-toggle--switch')).not.toBeNull();

    const expectedBooleanRows = [
      'settings.timer.inspection',
      'settings.timer.auto-session-for-event',
      'settings.timer.auto-event-for-session',
      'settings.timer.hide-running-time',
    ];
    expect([...host.querySelectorAll<HTMLElement>('.settings-row-boolean')]
      .map((row) => row.dataset.settingId)).toEqual(expectedBooleanRows);

    for (const field of TIMER_SETTING_FIELD_CONTRACTS.filter((entry) => entry.category === 'timer')) {
      const setting = host.querySelector<HTMLElement>(`[data-setting-id="${field.id}"]`)!;
      expect(setting.textContent).toContain(field.copy.en);
      expect(setting.querySelector<HTMLElement>('[role="switch"]')?.getAttribute('aria-label')
        ?? setting.querySelector<HTMLElement>('.settings-row-control')?.getAttribute('aria-labelledby'))
        .toBeTruthy();
    }

    const hold = host.querySelector<HTMLInputElement>(
      '[data-setting-id="settings.timer.hold-threshold"] input[type="number"]',
    )!;
    expect({ max: hold.max, min: hold.min, step: hold.step, value: hold.value }).toEqual({
      max: '2000', min: '100', step: '50', value: '550',
    });
    const holdGroup = hold.closest<HTMLElement>('.settings-row-control')!;
    expect(holdGroup.getAttribute('role')).toBe('group');
    expect(document.getElementById(holdGroup.getAttribute('aria-labelledby')!)).not.toBeNull();

    const running = host.querySelector<HTMLSelectElement>(
      '[data-setting-id="settings.timer.running-precision"] select',
    )!;
    const result = host.querySelector<HTMLSelectElement>(
      '[data-setting-id="settings.timer.result-precision"] select',
    )!;
    expect([...running.options].map((option) => [option.value, option.text])).toEqual([
      ['0', 'x'], ['1', 'x.x'], ['2', 'x.xx'], ['3', 'x.xxx'],
    ]);
    expect([...result.options].map((option) => [option.value, option.text])).toEqual([
      ['2', 'x.xx'], ['3', 'x.xxx'],
    ]);
  });

  it('localizes every shared field and section without a host-owned copy list', async () => {
    await render({ localize: localizeZh });
    expect([...host.querySelectorAll<HTMLElement>('.settings-section-head h4')]
      .map((heading) => heading.textContent)).toEqual(['项目与分组', '计时显示', '成绩精度']);
    for (const field of TIMER_SETTING_FIELD_CONTRACTS.filter((entry) => entry.category === 'timer')) {
      expect(host.querySelector(`[data-setting-id="${field.id}"]`)?.textContent).toContain(field.copy.zh);
    }
  });

  it('routes every interaction through shared normalization and exact field patches', async () => {
    const onChange = vi.fn<(patch: Partial<TimerTimingSettings>) => void>();
    await render({ onChange });

    const clickSwitch = async (id: string) => {
      await act(async () => host.querySelector<HTMLButtonElement>(
        `[data-setting-id="${id}"] [role="switch"]`,
      )!.click());
    };
    await clickSwitch('settings.timer.enabled');
    await clickSwitch('settings.timer.inspection');
    await clickSwitch('settings.timer.auto-session-for-event');
    await clickSwitch('settings.timer.auto-event-for-session');
    await clickSwitch('settings.timer.hide-running-time');

    const hold = host.querySelector<HTMLInputElement>(
      '[data-setting-id="settings.timer.hold-threshold"] input',
    )!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(hold, '50');
      hold.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const running = host.querySelector<HTMLSelectElement>(
      '[data-setting-id="settings.timer.running-precision"] select',
    )!;
    const result = host.querySelector<HTMLSelectElement>(
      '[data-setting-id="settings.timer.result-precision"] select',
    )!;
    await act(async () => {
      running.value = '0';
      running.dispatchEvent(new Event('change', { bubbles: true }));
      result.value = '2';
      result.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(onChange.mock.calls.map(([patch]) => patch)).toEqual([
      { timingEnabled: false },
      { inspectionSec: 15 },
      { autoSessionForEvent: true },
      { autoEventForSession: true },
      { hideTime: true },
      { holdMs: 100 },
      { runningPrecision: 0 },
      { precision: 2 },
    ]);
  });

  it('keeps the Timing category absent instead of leaving hidden duplicate controls', async () => {
    await render({ active: false });
    expect(host.childElementCount).toBe(0);
    expect(host.querySelector('[data-setting-id]')).toBeNull();
  });
});
