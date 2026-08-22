// @vitest-environment jsdom

import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomCodeInput } from '@/components/RoomCodeInput';

describe('RoomCodeInput', () => {
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

  it('keeps four digits including a leading zero and submits once', async () => {
    const complete = vi.fn();
    function Harness() {
      const [value, setValue] = useState('');
      return createElement(RoomCodeInput, { value, onValueChange: setValue, onComplete: complete });
    }

    await act(async () => root.render(createElement(Harness)));
    const input = host.querySelector('input') as HTMLInputElement;
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      valueSetter?.call(input, 'a0b-12c3');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(input.value).toBe('0123');
    expect(input.inputMode).toBe('numeric');
    expect(input.pattern).toBe('[0-9]*');
    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith('0123');

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(complete).toHaveBeenCalledTimes(1);

    await act(async () => root.render(createElement(Harness)));
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('does not resubmit a completed code when callbacks or disabled state rerender', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const render = async (value: string, onComplete: (code: string) => void, disabled = false) => {
      await act(async () => root.render(createElement(RoomCodeInput, {
        value,
        onValueChange: vi.fn(),
        onComplete,
        disabled,
      })));
    };

    await render('0123', first);
    expect(first).toHaveBeenCalledOnce();

    await render('0123', second);
    await render('0123', second, true);
    await render('0123', second);
    expect(second).not.toHaveBeenCalled();

    // Editing below four characters deliberately arms the same code for a new attempt.
    await render('012', second);
    await render('0123', second);
    expect(second).toHaveBeenCalledOnce();
  });
});
