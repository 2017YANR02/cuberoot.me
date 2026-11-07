import { describe, expect, it, vi } from 'vitest';
import { createPadInput, requiredPads } from '@/app/[lang]/timer/_lib/stackmat/pad-input';
import { effectiveStackmatInput, usesStackmatPads } from '@/components/stackmat-catalog';

describe('StackMat generation input compatibility', () => {
  for (const generation of [1, 2, 3, 4, 5]) {
    it(`G${generation}: supports two pads and safely resolves a saved four-pad choice`, () => {
      const settings = { timerDisplayMode: `stackmat-g${generation}`, stackmatInputMode: '4-pad' as const };
      expect(effectiveStackmatInput(settings)).toBe(generation === 5 ? '4-pad' : '2-pad');
      expect(usesStackmatPads({ ...settings, stackmatInputMode: '2-pad' })).toBe(true);
      expect(usesStackmatPads({ ...settings, stackmatInputMode: 'normal' })).toBe(false);
    });
  }
  it('keeps ordinary input for digits and the tournament display', () => {
    for (const timerDisplayMode of ['digits', 'stackmat']) {
      expect(usesStackmatPads({ timerDisplayMode, stackmatInputMode: '4-pad' })).toBe(false);
    }
  });
});

describe('StackMat multi-contact input', () => {
  for (const mode of ['2-pad', '4-pad'] as const) {
    it(`${mode}: requires every distinct pad, releases once, then stops once`, () => {
      let running = false;
      const host = { down: vi.fn(), up: vi.fn(), cancel: vi.fn(), running: () => running };
      const input = createPadInput(requiredPads(mode), host);
      const pads = requiredPads(mode);
      pads.slice(0, -1).forEach((pad, i) => input.down(String(i), pad));
      input.down('duplicate', pads[0]);
      expect(host.down).toHaveBeenCalledTimes(0);
      input.down(String(pads.length - 1), pads.at(-1)!);
      expect(host.down).toHaveBeenCalledTimes(1);
      input.up(String(pads.length - 1));
      expect(host.up).toHaveBeenCalledTimes(1);
      running = true;
      input.down('return', pads.at(-1)!);
      expect(host.down).toHaveBeenCalledTimes(2);
      running = false;
      input.up('return');
      input.down('return', pads.at(-1)!);
      expect(host.down).toHaveBeenCalledTimes(2);
      expect(host.up).toHaveBeenCalledTimes(1);
      [...pads.map((_, i) => String(i)), 'duplicate', 'return'].forEach(id => input.up(id));
      pads.forEach((pad, i) => input.down(String(i), pad));
      expect(host.down).toHaveBeenCalledTimes(3);
    });
  }
  it('cancellation never releases a ready timer into a run', () => {
    const host = { down: vi.fn(), up: vi.fn(), cancel: vi.fn(), running: () => false };
    const input = createPadInput(requiredPads('2-pad'), host);
    input.down('left', 'left-palm'); input.down('right', 'right-palm');
    input.lost('left'); input.up('right');
    expect(host.cancel).toHaveBeenCalledTimes(1);
    expect(host.up).toHaveBeenCalledTimes(0);
    expect(input.pressed().size).toBe(0);
  });
  it('a single contact cannot cover multiple sensors', () => {
    const host = { down: vi.fn(), up: vi.fn(), cancel: vi.fn(), running: () => false };
    const input = createPadInput(requiredPads('4-pad'), host);
    requiredPads('4-pad').forEach(pad => input.down('one-finger', pad));
    expect(host.down).toHaveBeenCalledTimes(0);
  });
});
