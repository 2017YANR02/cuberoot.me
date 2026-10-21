// @vitest-environment jsdom

import BoolToggle from '@/components/BoolToggle';
import SharedBoolToggle from '@cuberoot/timer-ui/BoolToggle';
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
    timingRequired = false,
    localize = localizeEn,
    onChange = vi.fn<(patch: Partial<TimerTimingSettings>) => void>(),
    value = DEFAULT_TIMER_TIMING_SETTINGS,
  }: {
    active?: boolean;
    timingRequired?: boolean;
    localize?: (copy: TimerSettingCopy) => string;
    onChange?: (patch: Partial<TimerTimingSettings>) => void;
    value?: TimerTimingSettings;
  } = {}) {
    await act(async () => root.render(createElement(TimerTimingSettingsSections, {
      active,
      timingRequired,
      localize,
      onChange,
      renderBooleanControl: renderWebBooleanControl,
      value,
    })));
    return onChange;
  }

  it('omits the timing switch for mandatory-timing hosts while retaining inspection and display controls', async () => {
    await render({ timingRequired: true });
    expect(host.querySelector('[data-setting-id="settings.timer.enabled"]')).toBeNull();
    expect([...host.querySelectorAll<HTMLElement>('[data-setting-id]')].map(row => row.dataset.settingId))
      .toEqual(TIMER_TIMING_SETTING_FIELD_IDS.filter(id => id !== 'settings.timer.enabled'));
  });

  it.each([
    ['Web', BoolToggle],
    ['shared App', SharedBoolToggle],
  ] as const)('%s puts the label before the switch and preserves click/disabled behavior', async (_name, Toggle) => {
    const onChange = vi.fn();
    await act(async () => root.render(createElement(Toggle, { label: 'Algorithms', value: false, onChange })));
    const label = host.querySelector<HTMLButtonElement>('.bool-toggle-label')!;
    const control = host.querySelector<HTMLButtonElement>('[role="switch"]')!;
    expect(label.nextElementSibling).toBe(control);
    expect(control.getAttribute('aria-label')).toBe('Algorithms');
    expect(control.getAttribute('aria-checked')).toBe('false');
    await act(async () => { label.click(); control.click(); });
    expect(onChange.mock.calls).toEqual([[true], [true]]);
    onChange.mockClear();
    await act(async () => root.render(createElement(Toggle, { label: 'Algorithms', value: true, onChange, disabled: true })));
    expect(control.getAttribute('aria-checked')).toBe('true');
    await act(async () => { label.click(); control.click(); });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders the exact eight contract fields, Web DOM classes, labels, and value policies', async () => {
    await render();

    expect(TIMER_TIMING_SETTING_FIELD_IDS).toEqual([
      'settings.timer.enabled',
      'settings.timer.inspection',
      'settings.timer.hold-threshold',
      'settings.timer.hide-running-time',
      'settings.timer.running-precision',
      'settings.timer.result-precision',
      'settings.timer.auto-session-for-event',
      'settings.timer.auto-event-for-session',
    ]);
    expect([...host.querySelectorAll<HTMLElement>('[data-setting-id]')]
      .map((element) => element.dataset.settingId)).toEqual(TIMER_TIMING_SETTING_FIELD_IDS);
    expect(host.querySelectorAll('.settings-section')).toHaveLength(3);
    expect([...host.querySelectorAll<HTMLElement>('.settings-section-head h4')]
      .map((heading) => heading.textContent)).toEqual([
        'Timing display',
        'Events and sessions',
      ]);

    const enabled = host.querySelector<HTMLElement>('[data-setting-id="settings.timer.enabled"]')!;
    expect(enabled.matches('.settings-row-boolean')).toBe(true);
    expect(enabled.querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('true');
    expect(host.querySelector('.settings-section-note')).toBeNull();
    expect(enabled.parentElement?.className).toBe('settings-section');
    expect(enabled.querySelector('.bool-toggle > .pill-toggle.pill-toggle--switch')).not.toBeNull();

    const expectedBooleanRows = [
      'settings.timer.enabled',
      'settings.timer.inspection',
      'settings.timer.hide-running-time',
      'settings.timer.auto-session-for-event',
      'settings.timer.auto-event-for-session',
    ];
    expect([...host.querySelectorAll<HTMLElement>('.settings-row-boolean')]
      .map((row) => row.dataset.settingId)).toEqual(expectedBooleanRows);

    for (const field of TIMER_SETTING_FIELD_CONTRACTS.filter((entry) => TIMER_TIMING_SETTING_FIELD_IDS.includes(entry.id))) {
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
      .map((heading) => heading.textContent)).toEqual(['计时显示', '项目与分组']);
    for (const field of TIMER_SETTING_FIELD_CONTRACTS.filter((entry) => TIMER_TIMING_SETTING_FIELD_IDS.includes(entry.id))) {
      expect(host.querySelector(`[data-setting-id="${field.id}"]`)?.textContent)
        .toContain(field.copy.zh);
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
    expect(hold.value).toBe('50');
    expect(onChange).not.toHaveBeenCalledWith({ holdMs: 100 });
    await act(async () => hold.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));

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

  it('shows timing mode as off when timing is disabled and can restore timing', async () => {
    const onChange = await render({ value: { ...DEFAULT_TIMER_TIMING_SETTINGS, timingEnabled: false } });
    const control = host.querySelector<HTMLButtonElement>('[aria-label="Timing mode"][role="switch"]')!;
    expect(control.getAttribute('aria-checked')).toBe('false');
    await act(async () => control.click());
    expect(onChange).toHaveBeenCalledWith({ timingEnabled: true });
  });
});
