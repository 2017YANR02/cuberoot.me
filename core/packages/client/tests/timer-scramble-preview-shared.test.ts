// @vitest-environment jsdom

import { renderMegaScrambleSvg as webMega } from '@/app/[lang]/scramble/gen/_svg/mega_svg';
import { renderSq1ScrambleSvg as webSq1 } from '@/lib/sq1-svg';
import { renderMegaScrambleSvg as sharedMega } from '@cuberoot/puzzle-render-core/mega-svg';
import { renderSq1ScrambleSvg as sharedSq1 } from '@cuberoot/puzzle-render-core/sq1-svg';
import { renderPyraminxDuoSvg, DUO_SVG_ASPECT } from '@cuberoot/puzzle-render-core/pyraminx-duo-svg';
import { TimerCubePreview } from '@cuberoot/timer-ui';
import { act, createElement } from 'react';
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

  it.each([
    ['sq1', '(1,0) / (0,-1)'],
    ['mega', "R++ D-- U'"],
    ['pyraminx_duo', "R U'"],
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

    for (const [event, scramble] of [['sq1', '(1,0) /'], ['mega', 'R++'], ['pyraminx_duo', "R U'"]] as const) {
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
});
