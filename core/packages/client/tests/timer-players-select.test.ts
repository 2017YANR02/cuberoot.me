// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimerPlayersSelect, type TimerPlayersValue } from '@cuberoot/timer-ui';

describe('shared timer players select', () => {
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

  it('exposes every player mode and emits the selected value', () => {
    const onChange = vi.fn<(value: TimerPlayersValue) => void>();
    act(() => {
      root.render(createElement(TimerPlayersSelect, {
        ariaLabel: 'Players',
        onlineLabel: 'Online',
        onChange,
        playerLabel: (count) => `${count}P`,
        value: 1,
      }));
    });

    const select = host.querySelector('select');
    expect(select).not.toBeNull();
    expect([...select!.options].map((option) => option.textContent)).toEqual(['1P', '2P', '3P', '4P', 'Online']);

    act(() => {
      select!.value = '3';
      select!.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith(3);

    act(() => {
      select!.value = 'net';
      select!.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onChange).toHaveBeenLastCalledWith('net');
  });

  it('renders a non-interactive mode label when a host has not implemented mode switching', () => {
    act(() => {
      root.render(createElement(TimerPlayersSelect, {
        ariaLabel: 'One-player timer',
        onlineLabel: 'Online',
        playerLabel: (count) => `${count}P`,
        readOnly: true,
        value: 1,
      }));
    });

    expect(host.querySelector('select')).toBeNull();
    expect(host.querySelector('.shell-players-select--readonly')?.textContent).toBe('1P');
  });
});
