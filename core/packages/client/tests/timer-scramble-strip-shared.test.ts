// @vitest-environment jsdom

import LegacyScrambleHintText from '@/app/[lang]/timer/_components/ScrambleHintText';
import {
  TimerScrambleHintText,
  TimerScrambleStrip,
  shouldIgnoreTimerTarget,
  type TimerScrambleStripProps,
} from '@cuberoot/timer-ui';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const labels: TimerScrambleStripProps['verificationLabels'] = {
  copiedCorrection: 'Copied the scramble',
  correction: 'Back to scramble',
  correctionTitle: 'Correction path explanation',
  mismatch: 'Doesn’t match',
  ready: 'Scrambled',
};

describe('shared TimerScrambleStrip', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  function render(overrides: Partial<TimerScrambleStripProps> = {}) {
    const props: TimerScrambleStripProps = {
      copiedLabel: 'Copied',
      scramble: "R U R' U' F2",
      verificationLabels: labels,
      ...overrides,
    };
    act(() => root.render(createElement(TimerScrambleStrip, props)));
    return host.querySelector<HTMLElement>('.scramble-strip')!;
  }

  it('keeps Web classes, font tiers, final-move copy feedback, match chip and suffix slot', () => {
    const activate = vi.fn();
    const strip = render({
      children: createElement('div', { className: 'scramble-src-row' }, 'source'),
      compact: true,
      copied: true,
      font: 'sans',
      fontScale: 1.25,
      match: true,
      nonOptimal: { label: 'non-optimal', title: 'Original WCA scramble' },
      onActivate: activate,
    });

    expect(strip.className).toBe('scramble-strip sf-sans compact');
    expect(strip.getAttribute('data-scramble-match')).toBe('ok');
    expect(strip.style.getPropertyValue('--scramble-scale')).toBe('1.25');
    expect(strip.querySelector('.scramble-text')?.textContent).toContain("R U R' U' F2");
    expect(strip.querySelector('.scramble-copied-tail')?.textContent).toBe('F2');
    expect(strip.querySelector('.scramble-copied-check')?.getAttribute('aria-label')).toBe('Copied');
    expect(strip.querySelector('.scramble-nonopt')?.textContent).toBe('non-optimal');
    expect(strip.querySelector('.scramble-verify[data-ok="true"]')?.textContent).toBe('Scrambled');
    expect(strip.lastElementChild?.className).toBe('scramble-src-row');
    expect(shouldIgnoreTimerTarget(strip.querySelector('.scramble-moves'))).toBe(true);

    act(() => strip.click());
    act(() => strip.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' })));
    act(() => strip.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: ' ' })));
    expect(activate).toHaveBeenCalledTimes(3);
  });

  it('renders current-turn progress and correction-copy feedback without a false tail check', () => {
    const strip = render({
      copied: true,
      correctionActive: true,
      hint: {
        complete: false,
        current: "R'",
        done: ['U', 'F2'],
        pending: ['D', 'L2'],
      },
    });

    expect([...strip.querySelectorAll<HTMLElement>('.scramble-move')].map((move) => [
      move.textContent,
      move.dataset.hint,
    ])).toEqual([
      ['U', 'done'],
      ['F2', 'done'],
      ["R'", 'current'],
      ['D', 'pending'],
      ['L2', 'pending'],
    ]);
    expect(strip.querySelector('.scramble-copied-check')).toBeNull();
    expect([...strip.querySelectorAll<HTMLElement>('.scramble-verify')]
      .map((chip) => [chip.dataset.ok, chip.textContent])).toEqual([
      ['fix', 'Back to scramble'],
      ['true', 'Copied the scramble'],
    ]);
  });

  it('owns the empty-state wrapper and does not let a nested retry key activate the strip', () => {
    const activate = vi.fn();
    const retry = vi.fn();
    const strip = render({
      fallback: createElement('button', {
        className: 'scramble-empty-retry',
        onClick: (event) => {
          event.stopPropagation();
          retry();
        },
        type: 'button',
      }, 'Try again'),
      onActivate: activate,
      scramble: '',
    });
    const button = strip.querySelector<HTMLButtonElement>('button')!;

    expect(strip.querySelector('.scramble-empty')?.textContent).toBe('Try again');
    act(() => button.click());
    act(() => button.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' })));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(activate).not.toHaveBeenCalled();
  });

  it('keeps the legacy hint import as the shared implementation identity', () => {
    expect(LegacyScrambleHintText).toBe(TimerScrambleHintText);
  });

  it('keeps Solo and NetBattle as real consumers instead of private strip renderers', () => {
    for (const file of ['SoloView.tsx', 'NetBattleView.tsx']) {
      const source = readFileSync(join(process.cwd(), 'app', '[lang]', 'timer', '_shell', file), 'utf8');
      expect(source).toContain('<TimerScrambleStrip');
      expect(source).not.toMatch(/<div\s+className=\{`scramble-strip/);
      expect(source).not.toContain('import ScrambleHintText');
    }
  });

  it('locks narrow-screen wrapping for long, unbroken scramble content', () => {
    const cssUrl = import.meta.resolve('@cuberoot/timer-ui/scramble-strip.css');
    const css = readFileSync(new URL(cssUrl), 'utf8');
    const rootRule = css.match(/\.scramble-strip,[\s\S]*?\{([^}]+)\}/)?.[1] ?? '';
    expect(rootRule).not.toBe('');
    expect(css).toMatch(/\.scramble-strip[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;/);
    expect(css).toMatch(/\.scramble-strip[\s\S]*?overflow-wrap:\s*anywhere;/);
    expect(css).toMatch(/\.scramble-strip \.scramble-text[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;/);
    expect(rootRule).not.toContain('word-spacing');
    expect(css).toMatch(/\.scramble-strip \.scramble-moves,[\s\S]*?word-spacing:\s*0\.25em;/);
    expect(css).toMatch(/\.timer-scramble-source-meta[\s\S]*?word-spacing:\s*normal;/);
    expect(css).toMatch(/@media \(max-width: 540px\)[\s\S]*?overflow-x:\s*clip;/);

    const strip = render({ scramble: 'R'.repeat(500) });
    expect(strip.querySelector('.scramble-moves')?.textContent).toHaveLength(500);
  });
});
