// @vitest-environment jsdom

import { renderMegaScrambleSvg as webMega } from '@/app/[lang]/scramble/gen/_svg/mega_svg';
import { renderSq1ScrambleSvg as webSq1 } from '@/lib/sq1-svg';
import { renderMegaScrambleSvg as sharedMega } from '@cuberoot/puzzle-render-core/mega-svg';
import { renderSq1ScrambleSvg as sharedSq1 } from '@cuberoot/puzzle-render-core/sq1-svg';
import { TimerCubePreview } from '@cuberoot/timer-ui';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('cubing/twisty', () => {
  class MockTwistyPlayer extends HTMLElement {
    constructor(init: Record<string, unknown>) {
      super();
      this.dataset.puzzle = String(init.puzzle ?? '');
    }

    set experimentalSetupAlg(value: string) {
      if (value === 'invalid') throw new Error('invalid scramble');
      this.dataset.scramble = value;
    }
  }
  customElements.define('mock-twisty-player', MockTwistyPlayer);
  return { TwistyPlayer: MockTwistyPlayer };
});

describe('shared timer scramble preview', () => {
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

  it('keeps Web renderer imports as identity re-exports', () => {
    expect(webMega).toBe(sharedMega);
    expect(webSq1).toBe(sharedSq1);
  });

  it.each([
    ['sq1', '(1,0) / (0,-1)'],
    ['mega', "R++ D-- U'"],
  ] as const)('renders %s from the canonical installed-client component', async (event, scramble) => {
    await act(async () => root.render(createElement(TimerCubePreview, {
      ariaLabel: 'Cube state',
      event,
      scramble,
    })));

    expect(host.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Cube state');
    expect(host.querySelector('svg')).not.toBeNull();
  });

  it('never leaves the previous Twisty puzzle visible after an invalid manual scramble', async () => {
    await act(async () => root.render(createElement(TimerCubePreview, {
      event: '333',
      scramble: "R U R'",
    })));
    await vi.waitFor(() => expect(host.querySelector<HTMLElement>('mock-twisty-player')?.dataset.scramble).toBe("R U R'"));
    expect(host.querySelector<HTMLElement>('mock-twisty-player')?.dataset.puzzle).toBe('3x3x3');

    await act(async () => root.render(createElement(TimerCubePreview, {
      event: '333',
      scramble: 'invalid',
    })));
    expect(host.querySelector<HTMLElement>('[role="img"]')?.style.visibility).toBe('hidden');

    await act(async () => root.render(createElement(TimerCubePreview, {
      event: '333',
      scramble: 'R2',
    })));
    expect(host.querySelector<HTMLElement>('[role="img"]')?.style.visibility).toBe('');
    expect(host.querySelector<HTMLElement>('mock-twisty-player')?.dataset.scramble).toBe('R2');
  });

  it('recovers when the first manual scramble is invalid and maps non-cube events', async () => {
    await act(async () => root.render(createElement(TimerCubePreview, {
      event: 'pyra',
      scramble: 'invalid',
    })));
    await vi.waitFor(() => expect(host.querySelector<HTMLElement>('mock-twisty-player')?.dataset.puzzle).toBe('pyraminx'));
    expect(host.querySelector<HTMLElement>('[role="img"]')?.style.visibility).toBe('hidden');

    await act(async () => root.render(createElement(TimerCubePreview, {
      event: 'pyra',
      scramble: "R U' L",
    })));
    expect(host.querySelector<HTMLElement>('[role="img"]')?.style.visibility).toBe('');
    expect(host.querySelector<HTMLElement>('mock-twisty-player')?.dataset.scramble).toBe("R U' L");
  });
});
