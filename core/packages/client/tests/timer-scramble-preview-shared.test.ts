// @vitest-environment jsdom

import { renderMegaScrambleSvg as webMega } from '@/app/[lang]/scramble/gen/_svg/mega_svg';
import { renderSq1ScrambleSvg as webSq1 } from '@/lib/sq1-svg';
import { renderMegaScrambleSvg as sharedMega } from '@cuberoot/puzzle-render-core/mega-svg';
import { renderSq1ScrambleSvg as sharedSq1 } from '@cuberoot/puzzle-render-core/sq1-svg';
import { renderPyraminxDuoSvg, DUO_SVG_ASPECT } from '@cuberoot/puzzle-render-core/pyraminx-duo-svg';
import { renderMagicSvg, magicSvgAspect } from '@cuberoot/puzzle-render-core/magic-svg';
import { renderSphereScrambleSvg } from '@cuberoot/puzzle-render-core/sphere-svg';
import { TimerCubePreview, TimingSurface, timerCubePreviewAspect } from '@cuberoot/timer-ui';
import { act, createElement, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('cubing/twisty', () => {
  class MockTwistyPlayer extends HTMLElement {
    constructor(init: Record<string, unknown>) {
      super();
      this.dataset.puzzle = String(init.puzzle ?? '');
      this.dataset.visualization = String(init.visualization ?? '');
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
    ["UR D F L R'", "UR D F L R'"],
    ["R L' x R'", "F UL' x F'"],
  ])('renders Redi instead of no-preview: %s', async (scramble, canonical) => {
    await act(async () => root.render(createElement(TimerCubePreview, { event: 'redi', scramble })));
    await vi.waitFor(() => expect(host.querySelector<HTMLElement>('mock-twisty-player')?.dataset.scramble).toBe(canonical));
    expect(host.querySelector<HTMLElement>('mock-twisty-player')?.dataset.puzzle).toBe('redi_cube');
    expect(host.textContent).not.toContain('no preview');
  });

  it('renders Kilominx through the named model with its csTimer face convention', async () => {
    await act(async () => root.render(createElement(TimerCubePreview, {
      event: 'kilominx', scramble: "R DR DL' DBL2 DBR2' U",
    })));
    await vi.waitFor(() => expect(host.querySelector<HTMLElement>('mock-twisty-player')?.dataset.scramble)
      .toBe("R FR FL' DL2 DR2' U"));
    expect(host.querySelector<HTMLElement>('mock-twisty-player')?.dataset.puzzle).toBe('kilominx');
    expect(host.textContent).not.toContain('no preview');
    expect(timerCubePreviewAspect('kilominx')).toBe(18 / 14);
  });

  it('renders the six-face Sphere net, updates state and hides invalid input', async () => {
    const render = async (scramble: string) => act(async () => root.render(createElement(TimerCubePreview, {
      event: 'sphere', scramble, visualization: '3D', height: 240, ariaLabel: 'Sphere state',
    })));
    await render('');
    const solved = host.innerHTML;
    await render("R U' F2");
    const expected = document.createElement('div');
    expected.innerHTML = renderSphereScrambleSvg("R U' F2")!;
    const preview = host.querySelector<HTMLElement>('[aria-label="Sphere state"]');
    expect(preview?.innerHTML).toBe(expected.innerHTML);
    expect(preview?.style.aspectRatio).toBe('12 / 9');
    expect(host.querySelector('svg')).not.toBeNull();
    expect(host.querySelectorAll('svg rect')).toHaveLength(54);
    expect(host.querySelector('mock-twisty-player')).toBeNull();
    expect(host.innerHTML).not.toBe(solved);
    expect(timerCubePreviewAspect('sphere')).toBe(4 / 3);
    await render('invalid');
    expect(host.querySelector('svg')).toBeNull();
    await render('R');
    expect(host.querySelector('svg')).not.toBeNull();
  });

  it.each([
    ['sq1', '(1,0) / (0,-1)'],
    ['mega', "R++ D-- U'"],
    ['pyraminx_duo', "R U'"],
    ['magic', 'Forward'],
    ['mmagic', 'M Backward'],
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

  it('rebuilds the same shared player for 2D/3D while inline puzzles stay on SVG', async () => {
    await act(async () => root.render(createElement(TimerCubePreview, {
      event: '333',
      scramble: 'R',
      visualization: '2D',
    })));
    await vi.waitFor(() => expect(host.querySelector<HTMLElement>('mock-twisty-player')).not.toBeNull());
    const twoD = host.querySelector<HTMLElement>('mock-twisty-player')!;
    expect(twoD.dataset.visualization).toBe('2D');

    await act(async () => root.render(createElement(TimerCubePreview, {
      event: '333',
      scramble: 'R',
      visualization: '3D',
    })));
    const threeD = host.querySelector<HTMLElement>('mock-twisty-player')!;
    expect(threeD).not.toBe(twoD);
    expect(threeD.dataset.visualization).toBe('3D');

    for (const [event, scramble] of [['sq1', '(1,0) /'], ['mega', 'R++'], ['pyraminx_duo', "R U'"], ['magic', 'Backward'], ['mmagic', 'M Forward']] as const) {
      await act(async () => root.render(createElement(TimerCubePreview, {
        event,
        scramble,
        visualization: '3D',
      })));
      expect(host.querySelector('mock-twisty-player')).toBeNull();
      expect(host.querySelector('svg')).not.toBeNull();
    }
  });

  it('renders the canonical Duo state at its own aspect and recovers from invalid input', async () => {
    const render = async (scramble: string) => act(async () => root.render(createElement(TimerCubePreview, {
      event: 'pyraminx_duo', scramble, height: 240, ariaLabel: 'Duo state',
    })));
    await render("R U'");
    const expected = document.createElement('div');
    expected.innerHTML = renderPyraminxDuoSvg("R U'");
    const preview = host.querySelector<HTMLElement>('[aria-label="Duo state"]');
    expect(preview?.innerHTML).toBe(expected.innerHTML);
    expect(preview?.style.aspectRatio).toBe(`${10 * DUO_SVG_ASPECT} / 10`);
    expect(renderPyraminxDuoSvg("R U'")).not.toBe(renderPyraminxDuoSvg(''));
    expect(host.querySelector('mock-twisty-player')).toBeNull();

    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await render('invalid');
      expect(host.querySelector('svg')).toBeNull();
      expect(host.querySelector('[role="img"]')).toBeNull();
      await render('');
      expected.innerHTML = renderPyraminxDuoSvg('');
      expect(host.querySelector('[role="img"]')?.innerHTML).toBe(expected.innerHTML);
    } finally {
      warning.mockRestore();
    }
  });

  it('shows a valid Duo SVG after a failed cubing preview hid the same host', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await act(async () => root.render(createElement(TimerCubePreview, {
        event: '333', scramble: 'invalid',
      })));
      await vi.waitFor(() => expect(host.querySelector('mock-twisty-player')).not.toBeNull());
      expect(host.querySelector<HTMLElement>('[role="img"]')?.style.visibility).toBe('hidden');

      await act(async () => root.render(createElement(TimerCubePreview, {
        event: 'pyraminx_duo', scramble: 'R',
      })));
      expect(host.querySelector('mock-twisty-player')).toBeNull();
      expect(host.querySelector('svg')).not.toBeNull();
      expect(host.querySelector<HTMLElement>('[role="img"]')?.style.visibility).toBe('visible');
    } finally {
      warning.mockRestore();
    }
  });

  it.each([
    ['magic', 'Forward', 'Backward'],
    ['mmagic', 'M Forward', 'M Backward'],
  ] as const)('replaces no-preview with the current %s pattern and preserves its aspect', async (event, forward, backward) => {
    const render = async (scramble: string) => act(async () => root.render(createElement(TimerCubePreview, {
      event, scramble, height: 160, ariaLabel: 'Practice start',
    })));
    for (const scramble of [forward, backward]) {
      await render(scramble);
      const expected = document.createElement('div');
      expected.innerHTML = renderMagicSvg(event, scramble);
      const preview = host.querySelector<HTMLElement>('[aria-label="Practice start"]');
      expect(preview?.innerHTML).toBe(expected.innerHTML);
      expect(preview?.style.aspectRatio).toBe(`${10 * magicSvgAspect(event, scramble)} / 10`);
      expect(host.querySelector('mock-twisty-player')).toBeNull();
      expect(host.textContent).not.toContain('no preview');
    }

    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await render('R U');
      expect(host.querySelector('svg')).toBeNull();
      await render(forward);
      expect(host.querySelector('svg')).not.toBeNull();
    } finally {
      warning.mockRestore();
    }
  });

  it.each([
    ['magic', 'Forward', 'Backward'],
    ['mmagic', 'M Forward', 'M Backward'],
  ] as const)('keeps %s inside the shared frame as the starting shape changes', async (event, forward, backward) => {
    const surfaceRef = createRef<HTMLDivElement>();
    for (const scramble of [forward, backward]) {
      const aspect = timerCubePreviewAspect(event, scramble);
      await act(async () => root.render(createElement(TimingSurface, {
        surfaceRef, layout: 'solo', phase: 'idle', colorClass: '', digits: '0.00',
        cornerAspect: aspect,
        cornerSlot: createElement(TimerCubePreview, { event, scramble, fill: true, ariaLabel: 'Bounded practice preview' }),
      })));
      const frame = host.querySelector<HTMLElement>('.timing-surface-cube-frame')!;
      const preview = host.querySelector<HTMLElement>('[aria-label="Bounded practice preview"]')!;
      expect(Number(frame.style.getPropertyValue('--timer-cube-aspect'))).toBe(magicSvgAspect(event, scramble));
      expect(preview.parentElement).toBe(frame);
      expect(preview.style.width).toBe('100%');
      expect(preview.style.height).toBe('100%');
      expect(preview.style.aspectRatio).toBe('');
      expect(preview.querySelector('svg')?.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
      expect(preview.querySelectorAll('[data-tile]')).toHaveLength(event === 'magic' ? 8 : 12);
    }
    expect(timerCubePreviewAspect(event, forward)).not.toBe(timerCubePreviewAspect(event, backward));
  });

  it('keeps frame metadata aligned with actual NxN, relay and fallback routing', () => {
    for (const event of ['333oh', '444bld', 'r3', 'r4', 'r5', 'custom'] as const) {
      expect(timerCubePreviewAspect(event)).toBe(4 / 3);
    }
    expect(timerCubePreviewAspect('sq1')).toBe(0.5);
    expect(timerCubePreviewAspect('pyraminx_duo', "R U'")).toBe(DUO_SVG_ASPECT);
    expect(timerCubePreviewAspect('mmagic', null)).toBe(magicSvgAspect('mmagic'));
    expect(timerCubePreviewAspect('ivy')).toBe(8 / 5);
    expect(timerCubePreviewAspect('magic', 'M Forward')).toBe(8 / 5);
    expect(timerCubePreviewAspect('mmagic', 'R U')).toBe(8 / 5);
  });
});
