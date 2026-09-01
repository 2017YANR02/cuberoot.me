// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  timerSmallPuzzleHintCopy,
  timerSupportsSmallPuzzleHints,
} from '@cuberoot/shared/timer';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MobileSmallPuzzleHints } from './MobileSmallPuzzleHints';

const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
const css = readFileSync(resolve(process.cwd(), 'src/app.css'), 'utf8');

describe('Mobile Timer small-puzzle hints integration', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true,
      value: 320,
    });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  it('mounts the event-only host after timing/stats and before device actions', () => {
    const timingIndex = appSource.indexOf('<TimingSurface');
    const statsIndex = appSource.indexOf('<TimerStatRail', timingIndex);
    const hintsIndex = appSource.indexOf('<MobileSmallPuzzleHints', statsIndex);
    const deviceIndex = appSource.indexOf('<TimerDeviceActions', hintsIndex);
    expect(timingIndex).toBeGreaterThan(-1);
    expect(statsIndex).toBeGreaterThan(timingIndex);
    expect(hintsIndex).toBeGreaterThan(statsIndex);
    expect(deviceIndex).toBeGreaterThan(hintsIndex);

    const hintCall = appSource.slice(hintsIndex, appSource.indexOf('/>', hintsIndex));
    expect(hintCall).toContain('event={activeEvent}');
    expect(hintCall).toContain('phase={timer.machine.phase}');
    expect(hintCall).toContain('scramble={scramble}');
    expect(hintCall).not.toContain('scrambleAvailability');
    expect(hintCall).not.toContain('scramble.length');
    expect(appSource).not.toContain('timer-solution-row');
    expect(appSource).not.toContain('copy.solution');
  });

  it('keeps the exact supported/unsupported event boundary and bilingual copy', () => {
    expect(['222', 'pyra', 'skewb'].filter(timerSupportsSmallPuzzleHints))
      .toEqual(['222', 'pyra', 'skewb']);
    expect(['333', 'sq1', 'mega', 'oll'].some(timerSupportsSmallPuzzleHints)).toBe(false);
    expect(timerSmallPuzzleHintCopy('222', 'en').title).toBe('2x2 solver hints');
    expect(timerSmallPuzzleHintCopy('222', 'zh').title).toBe('二阶解法提示');
  });

  it('keeps the real control visible for an empty manual/loading slot and exposes errors', async () => {
    await act(async () => root.render(createElement(MobileSmallPuzzleHints, {
      event: '222',
      language: 'en',
      phase: 'idle',
      scramble: '',
    })));
    expect(host.querySelector<HTMLButtonElement>('button')?.textContent).toContain('2x2 solver hints');
    await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
    await vi.waitFor(() => expect(host.querySelectorAll('.timer-small-hints-row')).toHaveLength(7));
    expect(host.textContent).toContain('already solved');
    expect(host.textContent).toContain('no solution');

    await act(async () => root.render(createElement(MobileSmallPuzzleHints, {
      event: '222',
      language: 'en',
      phase: 'idle',
      scramble: 'D',
    })));
    await vi.waitFor(() => expect(host.querySelector('[role="alert"]')?.textContent)
      .toBe('Unable to compute hints'));
  });

  it('resolves and computes the canonical 2x2 answer inside the Mobile runtime', async () => {
    await act(async () => root.render(createElement(MobileSmallPuzzleHints, {
      event: '222',
      language: 'en',
      phase: 'idle',
      scramble: "R U R' U' F2",
    })));
    await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
    await vi.waitFor(() => expect(host.querySelectorAll('.timer-small-hints-row')).toHaveLength(7));

    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.textContent).toContain('Full solve');
    expect(host.textContent).toContain('Per-face');

    await act(async () => root.render(createElement(MobileSmallPuzzleHints, {
      event: '222',
      language: 'en',
      phase: 'running',
      scramble: "R U R' U' F2",
    })));
    expect(host.querySelector('.timer-small-hints')?.getAttribute('data-timing')).toBe('true');
    expect(host.querySelector<HTMLButtonElement>('button')?.disabled).toBe(true);
  });

  it('keeps the hint host narrow-safe without hard-coded colors', () => {
    const block = css.match(/\.mobile-solution-hints\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(block).toContain('width: 100%');
    expect(block).toContain('min-width: 0');
    expect(block).toContain('env(safe-area-inset-right)');
    expect(block).not.toMatch(/#[0-9a-f]{3,8}|rgba?\(/i);
  });
});
