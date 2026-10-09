// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TIMER_OVERLAY_IDS, TimerScrambleSourceSelect } from '@cuberoot/timer-ui';
import { TIMER_333_SCRAMBLE_TYPES, TIMER_333_TRAINING_GROUPS } from '@cuberoot/shared/timer';

const LABELS = {
  ariaLabel: 'Scramble source',
  real: 'Real',
  realOption: 'WCA real',
  random: 'Random',
  randomOption: 'Random state',
  manual: 'Manual',
  manualOption: 'Manual input',
};

const WEB_SHELL_CSS = readFileSync(
  join(process.cwd(), 'app', '[lang]', 'timer', '_shell', 'shell.css'),
  'utf8',
);

describe('shared timer scramble-source select', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('opens WCA settings at a second level and returns without changing an active source', () => {
    const onChange = vi.fn();
    act(() => root.render(createElement(TimerScrambleSourceSelect<'wca'>, {
      labels: LABELS, realValue: 'wca', value: 'wca', onChange,
      realMenuContent: createElement('input', { 'aria-label': 'Competition search' }),
    })));
    act(() => host.querySelector('button')!.click());
    act(() => document.querySelector<HTMLButtonElement>('[role="option"]')!.click());
    expect(document.querySelector('.timer-scramble-source-secondary input')).not.toBeNull();
    expect(document.querySelectorAll('[role="option"]')).toHaveLength(3);
    expect(onChange).not.toHaveBeenCalled();
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(document.querySelector('.timer-scramble-source-secondary')).toBeNull();
    expect(document.querySelectorAll('[role="option"]')).toHaveLength(3);
    act(() => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });

  it('applies the shared topbar hooks without keeping duplicate rules in the Web shell', () => {
    const selectors = [
      '.shell-topbar-left .shell-scramble-source-select',
      '.shell-scramble-source-select .timer-scramble-source-trigger',
      '.shell-scramble-source-popup',
    ];
    for (const selector of selectors) expect(WEB_SHELL_CSS).not.toContain(selector);

    act(() => {
      root.render(createElement(TimerScrambleSourceSelect<'wca'>, {
        className: 'shell-scramble-source-select',
        labels: LABELS,
        onChange: vi.fn(),
        popupClassName: 'shell-scramble-source-popup',
        realValue: 'wca',
        triggerClassName: 'shell-players-select',
        value: 'wca',
      }));
    });
    const control = host.querySelector('.timer-scramble-source-select');
    const trigger = host.querySelector('.timer-scramble-source-trigger');
    expect(control?.classList.contains('shell-scramble-source-select')).toBe(true);
    expect(trigger?.classList.contains('shell-players-select')).toBe(true);

    act(() => (trigger as HTMLButtonElement | null)?.click());
    const popup = document.body.querySelector('.timer-scramble-source-popup');
    expect(popup?.classList.contains('shell-scramble-source-popup')).toBe(true);
  });

  it('renders the fixed three-source menu and adapts real to the Web wca value', () => {
    const onChange = vi.fn<(value: 'wca' | 'random' | 'manual') => void>();
    act(() => {
      root.render(createElement(TimerScrambleSourceSelect<'wca'>, {
        labels: LABELS,
        onChange,
        realValue: 'wca',
        value: 'wca',
      }));
    });

    const trigger = host.querySelector<HTMLButtonElement>('.timer-scramble-source-trigger');
    expect(trigger?.textContent).toContain('Real');
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector('.timer-scramble-source-select')?.hasAttribute('data-no-timer')).toBe(true);

    act(() => trigger?.click());
    const popup = document.body.querySelector<HTMLElement>('.timer-scramble-source-popup');
    const options = [...document.body.querySelectorAll<HTMLButtonElement>('.timer-scramble-source-option')];
    expect(popup?.hasAttribute('data-no-timer')).toBe(true);
    expect(options.map((option) => option.textContent)).toEqual(['WCA real', 'Random state', 'Manual input']);
    expect(options[0]?.getAttribute('aria-selected')).toBe('true');

    act(() => options[1]?.click());
    expect(onChange).toHaveBeenCalledWith('random');
    expect(document.body.querySelector('.timer-scramble-source-popup')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('adapts the canonical real option to the Mobile real value', () => {
    const onChange = vi.fn<(value: 'real' | 'random' | 'manual') => void>();
    act(() => {
      root.render(createElement(TimerScrambleSourceSelect<'real'>, {
        labels: LABELS,
        onChange,
        realValue: 'real',
        value: 'manual',
      }));
    });
    const trigger = host.querySelector<HTMLButtonElement>('.timer-scramble-source-trigger');
    expect(trigger?.textContent).toContain('Manual');
    act(() => trigger?.click());
    const realOption = document.body.querySelector<HTMLButtonElement>('.timer-scramble-source-option');
    act(() => realOption?.click());
    expect(onChange).toHaveBeenCalledWith('real');
  });

  it('keeps random and manual as runtime-neutral values and exposes one labelled listbox', () => {
    const onChange = vi.fn<(value: 'wca' | 'random' | 'manual') => void>();
    act(() => {
      root.render(createElement(TimerScrambleSourceSelect<'wca'>, {
        labels: LABELS,
        onChange,
        realValue: 'wca',
        value: 'random',
      }));
    });

    const trigger = host.querySelector<HTMLButtonElement>('.timer-scramble-source-trigger');
    expect(trigger?.type).toBe('button');
    act(() => trigger?.click());

    const popup = document.body.querySelector<HTMLElement>('.timer-scramble-source-popup');
    const options = [...document.body.querySelectorAll<HTMLButtonElement>('.timer-scramble-source-option')];
    expect(trigger?.getAttribute('aria-controls')).toBe(popup?.id);
    expect(popup?.getAttribute('role')).toBe('dialog');
    expect(popup?.querySelector('[role="listbox"]')?.getAttribute('aria-label')).toBe(LABELS.ariaLabel);
    expect(popup?.getAttribute('aria-label')).toBe(LABELS.ariaLabel);
    expect(options).toHaveLength(3);
    expect(options.map((option) => option.type)).toEqual(['button', 'button', 'button']);
    expect(options.map((option) => option.getAttribute('aria-selected'))).toEqual([
      'false',
      'true',
      'false',
    ]);

    act(() => options[2]?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })));
    expect(document.body.querySelector('.timer-scramble-source-popup')).toBe(popup);
    expect(onChange).not.toHaveBeenCalled();

    act(() => options[2]?.click());
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('manual');
    expect(trigger?.getAttribute('aria-controls')).toBeNull();
  });

  it('toggles closed from its trigger without emitting a source change', () => {
    const onChange = vi.fn<(value: 'real' | 'random' | 'manual') => void>();
    act(() => {
      root.render(createElement(TimerScrambleSourceSelect<'real'>, {
        labels: LABELS,
        onChange,
        realValue: 'real',
        value: 'random',
      }));
    });
    const trigger = host.querySelector<HTMLButtonElement>('.timer-scramble-source-trigger');
    act(() => trigger?.click());
    expect(document.body.querySelector('.timer-scramble-source-popup')).not.toBeNull();
    act(() => trigger?.click());
    expect(document.body.querySelector('.timer-scramble-source-popup')).toBeNull();
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('closes on Escape or an outside pointer and restores focus for Escape', () => {
    act(() => {
      root.render(createElement(TimerScrambleSourceSelect<'real'>, {
        labels: LABELS,
        onChange: vi.fn(),
        realValue: 'real',
        value: 'random',
      }));
    });
    const trigger = host.querySelector<HTMLButtonElement>('.timer-scramble-source-trigger');
    act(() => trigger?.click());
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })));
    expect(document.body.querySelector('.timer-scramble-source-popup')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    act(() => trigger?.click());
    act(() => document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })));
    expect(document.body.querySelector('.timer-scramble-source-popup')).toBeNull();
  });

  it('reports stable overlay identity and obeys host-controlled close', () => {
    const onOpenChange = vi.fn();
    const render = (open: boolean) => root.render(createElement(TimerScrambleSourceSelect<'wca'>, {
      labels: LABELS,
      onChange: vi.fn(),
      onOpenChange,
      open,
      realValue: 'wca',
      value: 'wca',
    }));
    act(() => render(true));
    expect(document.body.querySelector('.timer-scramble-source-popup')).not.toBeNull();
    act(() => document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })));
    expect(onOpenChange).toHaveBeenLastCalledWith(false, {
      id: TIMER_OVERLAY_IDS.scrambleSource,
      reason: 'outside',
    });
    expect(document.body.querySelector('.timer-scramble-source-popup')).not.toBeNull();
    act(() => render(false));
    expect(document.body.querySelector('.timer-scramble-source-popup')).toBeNull();
    expect(document.activeElement).toBe(host.querySelector('.timer-scramble-source-trigger'));
  });

  it('closes immediately when disabled and cannot emit changes', () => {
    const onChange = vi.fn<(value: 'real' | 'random' | 'manual') => void>();
    const render = (disabled: boolean) => {
      root.render(createElement(TimerScrambleSourceSelect<'real'>, {
        disabled,
        labels: LABELS,
        onChange,
        realValue: 'real',
        value: 'random',
      }));
    };
    act(() => render(false));
    const trigger = host.querySelector<HTMLButtonElement>('.timer-scramble-source-trigger');
    act(() => trigger?.click());
    expect(document.body.querySelector('.timer-scramble-source-popup')).not.toBeNull();

    act(() => render(true));
    expect(trigger?.disabled).toBe(true);
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
    expect(trigger?.getAttribute('aria-controls')).toBeNull();
    expect(document.body.querySelector('.timer-scramble-source-popup')).toBeNull();
    act(() => trigger?.click());
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clamps below the trigger at the left edge of a 320px viewport', () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(320);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(700);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function offsetWidth(this: HTMLElement) {
      return this.classList.contains('timer-scramble-source-popup') ? 200 : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function offsetHeight(this: HTMLElement) {
      return this.classList.contains('timer-scramble-source-popup') ? 120 : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function rect(this: HTMLElement) {
      if (this.classList.contains('timer-scramble-source-trigger')) {
        return {
          bottom: 52,
          height: 32,
          left: -24,
          right: 30,
          top: 20,
          width: 54,
          x: -24,
          y: 20,
          toJSON: () => ({}),
        };
      }
      return {
        bottom: 0, height: 0, left: 0, right: 0, top: 0, width: 0, x: 0, y: 0,
        toJSON: () => ({}),
      };
    });

    act(() => {
      root.render(createElement(TimerScrambleSourceSelect<'real'>, {
        labels: LABELS,
        onChange: vi.fn(),
        realValue: 'real',
        value: 'real',
      }));
    });
    act(() => host.querySelector<HTMLButtonElement>('.timer-scramble-source-trigger')?.click());
    const popup = document.body.querySelector<HTMLElement>('.timer-scramble-source-popup');
    expect(popup?.style.left).toBe('8px');
    expect(popup?.style.top).toBe('58px');
    expect(Number.parseFloat(popup?.style.left ?? '0') + 200).toBeLessThanOrEqual(312);
  });

  it('clamps the body portal beside the viewport edge and flips it above the trigger', () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(360);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(740);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function offsetWidth(this: HTMLElement) {
      return this.classList.contains('timer-scramble-source-popup') ? 200 : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function offsetHeight(this: HTMLElement) {
      return this.classList.contains('timer-scramble-source-popup') ? 150 : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function rect(this: HTMLElement) {
      if (this.classList.contains('timer-scramble-source-trigger')) {
        return {
          bottom: 722,
          height: 32,
          left: 330,
          right: 360,
          top: 690,
          width: 30,
          x: 330,
          y: 690,
          toJSON: () => ({}),
        };
      }
      return {
        bottom: 0, height: 0, left: 0, right: 0, top: 0, width: 0, x: 0, y: 0,
        toJSON: () => ({}),
      };
    });

    act(() => {
      root.render(createElement(TimerScrambleSourceSelect<'real'>, {
        labels: LABELS,
        onChange: vi.fn(),
        realValue: 'real',
        value: 'random',
      }));
    });
    act(() => host.querySelector<HTMLButtonElement>('.timer-scramble-source-trigger')?.click());
    const popup = document.body.querySelector<HTMLElement>('.timer-scramble-source-popup');
    expect(popup?.style.left).toBe('152px');
    expect(popup?.style.top).toBe('534px');
    expect(popup?.style.visibility).toBe('visible');
  });
  it('orders training after sources, selects exactly one option, and restores document scrolling', () => {
    const onTrainingChange = vi.fn();
    const onChange = vi.fn();
    document.body.style.overflow = 'auto';
    act(() => root.render(createElement(TimerScrambleSourceSelect<'wca'>, {
      labels: LABELS, onChange, realValue: 'wca', value: 'random',
      trainingItems: [{ value: 'cross', label: 'Cross' }, { value: 'f2l', label: 'F2L' }],
      trainingValue: 'cross', onTrainingChange,
    })));
    const trigger = host.querySelector<HTMLButtonElement>('.timer-scramble-source-trigger')!;
    expect(trigger.textContent).toBe('Cross');
    act(() => trigger.click());
    const options = [...document.body.querySelectorAll<HTMLButtonElement>('[role="option"]')];
    expect(options.map((item) => item.textContent)).toEqual(['WCA real', 'Random state', 'Manual input', 'CFOP']);
    expect(options.map((item) => item.getAttribute('aria-selected'))).toEqual(['false', 'false', 'false', 'true']);
    expect(document.body.style.overflow).toBe('hidden');
    act(() => options[3].click());
    expect(onTrainingChange).not.toHaveBeenCalled();
    const children = [...document.body.querySelectorAll<HTMLButtonElement>('.timer-scramble-source-secondary [role="option"]')];
    expect(children.map(item => item.textContent)).toEqual(['Cross', 'F2L']);
    act(() => children[1].click());
    expect(onTrainingChange).toHaveBeenCalledWith('f2l');
    expect(onChange).not.toHaveBeenCalled();
    expect(document.body.style.overflow).toBe('auto');
    document.body.style.overflow = '';
  });

  it('covers every training type once and supports all groups, back and dismissal', () => {
    const allEvents = TIMER_333_TRAINING_GROUPS.flatMap(group => [...group.events]);
    expect([...allEvents].sort()).toEqual(TIMER_333_SCRAMBLE_TYPES.filter(type => type.event !== '333').map(type => type.event).sort());
    expect(new Set(allEvents).size).toBe(allEvents.length);
    const onTrainingChange = vi.fn();
    act(() => root.render(createElement(TimerScrambleSourceSelect<'wca'>, {
      labels: LABELS, onChange: vi.fn(), realValue: 'wca', value: 'random', language: 'zh',
      trainingItems: allEvents.map(value => ({ value, label: value })), onTrainingChange,
    })));
    const trigger = host.querySelector<HTMLButtonElement>('.timer-scramble-source-trigger')!;
    act(() => trigger.click());
    for (const group of TIMER_333_TRAINING_GROUPS) {
      const parent = [...document.body.querySelectorAll<HTMLButtonElement>('[role="option"]')].find(item => item.textContent === group.label.zh)!;
      act(() => parent.click());
      expect([...document.body.querySelectorAll<HTMLButtonElement>('.timer-scramble-source-secondary [role="option"]')].map(item => item.textContent)).toEqual(group.events);
      expect(document.activeElement?.textContent).toBe(group.events[0]);
      expect(document.body.querySelector('.timer-scramble-source-options')?.textContent).toContain('WCA real');
      act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
      expect(document.body.querySelector('.timer-scramble-source-popup')).not.toBeNull();
    }
    expect(onTrainingChange).not.toHaveBeenCalled();
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(document.body.querySelector('.timer-scramble-source-popup')).toBeNull();
  });

});
