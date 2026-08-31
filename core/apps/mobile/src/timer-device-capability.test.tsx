// @vitest-environment jsdom

import { TimerDeviceActions } from '@cuberoot/timer-ui';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Mobile timer device capability surface', () => {
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

  it('does not render a fake Stackmat button when the host has no microphone adapter', () => {
    const onConnect = vi.fn();
    act(() => {
      root.render(
        <TimerDeviceActions
          connectAriaLabel="Connect Bluetooth device"
          connectLabel="Connect"
          onConnect={onConnect}
        />,
      );
    });

    const buttons = host.querySelectorAll('button');
    expect(buttons).toHaveLength(1);
    expect(host.querySelector('.shell-stackmat-connect')).toBeNull();

    act(() => buttons[0]!.click());
    expect(onConnect).toHaveBeenCalledOnce();
  });
});
