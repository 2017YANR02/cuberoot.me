import { describe, expect, it, vi } from 'vitest';
import Toucher from '@/app/[lang]/sim/Toucher';

describe('sim touch completion', () => {
  it.each([true, false])('releases a touch with cancelable=%s without rejecting the gesture', cancelable => {
    const toucher = new Toucher();
    const dom = { focus: vi.fn(), getBoundingClientRect: () => ({ left: 10, top: 20 }) };
    toucher.dom = dom as unknown as HTMLElement;
    toucher.callback = vi.fn();
    const touch = { identifier: 1, clientX: 30, clientY: 50 };
    toucher.target = toucher.dom;
    toucher.last = touch as Touch;
    const preventDefault = vi.fn();
    toucher.touch({ type: 'touchend', changedTouches: [touch], cancelable, preventDefault } as unknown as TouchEvent);
    expect(toucher.callback).toHaveBeenCalledWith(expect.objectContaining({ type: 'touchend', x: 20, y: 30 }));
    expect(toucher.target).toBeNull();
    expect(preventDefault).toHaveBeenCalledTimes(cancelable ? 1 : 0);
  });
});
