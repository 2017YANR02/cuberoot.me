// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  parseManualScrambleQueue,
  takeManualScramble,
} from '@cuberoot/shared/timer';
import { ManualScrambleQueueEditor } from '@cuberoot/timer-ui';

describe('shared manual scramble queue', () => {
  it('keeps each non-empty trimmed line opaque and in order', () => {
    expect(parseManualScrambleQueue("  R U R'  \r\n\nnot validated\n  F2  \n"))
      .toEqual(["R U R'", 'not validated', 'F2']);
  });

  it('walks in order, wraps, and handles an empty queue', () => {
    const queue = parseManualScrambleQueue('first\nsecond');
    const first = takeManualScramble(queue, 0);
    const second = takeManualScramble(queue, first.nextCursor);
    const wrapped = takeManualScramble(queue, second.nextCursor);

    expect(first).toEqual({ scramble: 'first', nextCursor: 1 });
    expect(second).toEqual({ scramble: 'second', nextCursor: 0 });
    expect(wrapped).toEqual(first);
    expect(takeManualScramble([], 99)).toEqual({ scramble: '', nextCursor: 0 });
    expect(takeManualScramble(queue, Number.NaN)).toEqual(first);
  });
});

describe('shared manual scramble editor', () => {
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

  it('uses the website textarea contract and persists every edit immediately', () => {
    const onChange = vi.fn<(value: string) => void>();
    act(() => {
      root.render(createElement(ManualScrambleQueueEditor, {
        ariaLabel: 'Manual scrambles',
        onChange,
        value: "R U R'",
      }));
    });

    const wrapper = host.querySelector<HTMLElement>('.scramble-src-manual');
    const textarea = host.querySelector<HTMLTextAreaElement>('.scramble-src-manual-input');
    expect(wrapper?.hasAttribute('data-no-timer')).toBe(true);
    expect(textarea?.rows).toBe(3);
    expect(textarea?.value).toBe("R U R'");
    expect(textarea?.getAttribute('aria-label')).toBe('Manual scrambles');
    expect(textarea?.getAttribute('autocapitalize')).toBe('none');
    expect(textarea?.getAttribute('autocorrect')).toBe('off');
    expect(textarea?.getAttribute('spellcheck')).toBe('false');
    expect(host.querySelector('button')).toBeNull();

    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value',
      )?.set;
      valueSetter?.call(textarea, 'first\nsecond');
      textarea?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith('first\nsecond');
  });
});
