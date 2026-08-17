import { describe, expect, it, vi } from 'vitest';
import {
  resolveRenderPixelRatio,
  syncSimHintBackdrop,
} from '@/components/sim-embed/mountSimWorld';

describe('sim embed render pixel ratio', () => {
  it('supersamples a 1x desktop display at 2x', () => {
    expect(resolveRenderPixelRatio(1, 2)).toBe(2);
  });

  it('keeps the device ratio between the 2x floor and caller cap', () => {
    expect(resolveRenderPixelRatio(2.25, 2.5)).toBe(2.25);
  });

  it('caps high-DPR screens and honors an explicit low-cost cap', () => {
    expect(resolveRenderPixelRatio(3, 2.5)).toBe(2.5);
    expect(resolveRenderPixelRatio(3, 1)).toBe(1);
  });

  it('falls back safely for invalid browser values', () => {
    expect(resolveRenderPixelRatio(0, 2)).toBe(2);
    expect(resolveRenderPixelRatio(Number.NaN, Number.NaN)).toBe(2);
  });
});

describe('sim embed hint backdrop', () => {
  it('injects the resolved page token into an NxN renderer', () => {
    const setHintBackdrop = vi.fn();
    const renderer = { setHintBackdrop };

    expect(syncSimHintBackdrop(3, { instancedRenderer: renderer }, '  rgb(23, 23, 23)  '))
      .toBe(renderer);
    expect(setHintBackdrop).toHaveBeenCalledWith('rgb(23, 23, 23)');
  });

  it('ignores non-NxN puzzles, missing renderers, and unresolved tokens', () => {
    const setHintBackdrop = vi.fn();

    expect(syncSimHintBackdrop('sq1', { instancedRenderer: { setHintBackdrop } }, '#171717'))
      .toBeNull();
    expect(syncSimHintBackdrop(3, {}, '#171717')).toBeNull();
    expect(syncSimHintBackdrop(3, { instancedRenderer: { setHintBackdrop } }, '   '))
      .toBeNull();
    expect(setHintBackdrop).not.toHaveBeenCalled();
  });
});
