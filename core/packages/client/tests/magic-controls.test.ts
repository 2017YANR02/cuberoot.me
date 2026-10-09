// @vitest-environment jsdom

import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', async (importOriginal) => ({
  ...await importOriginal<typeof import('react-i18next')>(),
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ lang: 'en' }),
  usePathname: () => '/sim',
}));

import PlayerControls from '@/app/[lang]/sim/PlayerControls';
import { DEFAULT_SETTINGS, type SimSettings } from '@/app/[lang]/sim/SettingDrawer';
import type World from '@/app/[lang]/sim/engine/world';
import MagicCube from '@cuberoot/puzzle-render-core/engine/magic/MagicCube';
import tweener from '@cuberoot/puzzle-render-core/engine/tweener';
import { timing } from '@cuberoot/puzzle-render-core/engine/tweenTiming';
import {
  magicStateFromMoves, magicStepCount, type MagicDirection, type MagicPuzzle,
} from '@cuberoot/puzzle-solvers/magic';

describe.each<MagicPuzzle>(['magic', 'mmagic'])('%s player controls', (puzzle) => {
  let host: HTMLDivElement;
  let root: Root;
  let cube: MagicCube;
  let previousPaused: boolean;
  let previousFrames: number;
  const setupFor = (direction: MagicDirection) => `${puzzle === 'mmagic' ? 'M ' : ''}${direction}`;
  const folds = (count: number) => Array.from({ length: count }, () => 'F').join(' ');

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('matchMedia', (media: string) => ({
      matches: false, media,
      addEventListener: () => {}, removeEventListener: () => {},
    }));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    previousPaused = tweener.paused;
    previousFrames = timing.frames;
    tweener.paused = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    cube = new MagicCube(puzzle);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    cube.dispose();
    host.remove();
    tweener.paused = previousPaused;
    timing.frames = previousFrames;
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function mount(setup = setupFor('Forward'), alg = '', overrides: Partial<SimSettings> = {}) {
    // Only the scene host is structural. React, route controls, parser, tile
    // model, history and the actual shared tween runner all remain live.
    const world = { cube, puzzleKind: puzzle, controller: {}, hands: null, dirty: true } as unknown as World;
    function Harness() {
      const [setupText, setSetupText] = useState(setup);
      const [algText, setAlgText] = useState(alg);
      const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS, animatePlayback: false, ...overrides });
      return createElement(PlayerControls, {
        world, clearFrozen: () => {},
        setup: setupText, alg: algText,
        onSetupChange: setSetupText, onAlgChange: setAlgText,
        order: 3, onOrderChange: () => {},
        puzzleKind: puzzle, onPuzzleChange: () => {},
        settings, onSettingsChange: setSettings,
        canUseCustomLogo: false, keymap: {},
        onKeymapChange: () => {}, onResetKeymap: () => {},
      });
    }
    await act(async () => root.render(createElement(Harness)));
  }

  function button(label: string) {
    const element = [...host.querySelectorAll<HTMLButtonElement>('button')]
      .find(candidate => candidate.title === label || candidate.textContent === label);
    expect(element, label).toBeDefined();
    return element!;
  }

  function textarea(placeholder: string) {
    const element = host.querySelector<HTMLTextAreaElement>(`textarea[placeholder="${placeholder}"]`);
    expect(element, placeholder).not.toBeNull();
    return element!;
  }

  async function click(label: string) {
    await act(async () => button(label).click());
  }

  async function enter(placeholder: string, text: string) {
    await act(async () => {
      const element = textarea(placeholder);
      element.focus();
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(element, text);
      element.setSelectionRange(text.length, text.length);
      element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
    });
  }

  async function direction(value: MagicDirection) {
    await act(async () => {
      const select = host.querySelector<HTMLSelectElement>('select[aria-label="Practice direction"]')!;
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  function expectTextState() {
    expect(cube.state).toEqual(magicStateFromMoves(puzzle, `${textarea('Scramble').value} ${textarea('Solution').value}`));
  }

  it('loads the whole route, waits for real folds to finish, and gives each practice direction its own start', async () => {
    const count = magicStepCount(puzzle);
    await mount(setupFor('Forward'), 'F F', { animatePlayback: true, playbackMode: 'algorithm' });
    const anchor = host.querySelector<HTMLSelectElement>('select[title="Anchor: keep the scramble start or the solve end fixed"]')!;
    expect(anchor.disabled).toBe(true);
    expect(anchor.value).toBe('moves');
    expect(cube.state).toEqual({ direction: 'Forward', step: 0 });
    expect(cube.positionOnRoute).toBe(0);

    await click('Load folding route');
    expect(textarea('Solution').value).toBe(folds(count));
    await click('Step forward');
    expect(cube.state.step).toBe(1);
    await click('Step back');
    expect(cube.state.step).toBe(0);
    await click('Play');

    // The player may poll while a fold is moving, but it must not skip a fold
    // or begin the next one before the real twister commits the current step.
    for (let step = 0; step < count; step++) {
      await act(async () => vi.advanceTimersByTimeAsync(16));
      expect(cube.twister.busy).toBe(true);
      expect(cube.state.step).toBe(step);
      if (step === 0) {
        await act(async () => {
          tweener.update(timing.frames / 2);
          await vi.advanceTimersByTimeAsync(32);
        });
        expect(cube.state.step).toBe(0);
        expect(cube.positionOnRoute).toBe(0.75);
        expect(button('Fold one step').disabled).toBe(true);
      }
      await act(async () => { tweener.update(timing.frames); });
      expect(cube.state.step).toBe(step + 1);
    }
    await act(async () => vi.advanceTimersByTimeAsync(16));
    expect(cube.complete).toBe(true);
    expect(cube.positionOnRoute).toBe(count);
    expect(host.querySelector('.sim-player-status output')?.textContent).toBe(`${count} / ${count} · Complete`);
    expect(button('Fold one step').disabled).toBe(true);
    expect(button('Play').disabled).toBe(false);

    await direction('Backward');
    expect(textarea('Scramble').value).toBe(setupFor('Backward'));
    expect(textarea('Solution').value).toBe(folds(count));
    expect(cube.state).toEqual({ direction: 'Backward', step: 0 });
    expect(cube.positionOnRoute).toBe(count);
    await click('Step forward');
    expect(cube.state).toEqual({ direction: 'Backward', step: 1 });
    expect(cube.positionOnRoute).toBe(count - 1);
    await click('Skip to end');
    expect(cube.complete).toBe(true);
    expect(cube.positionOnRoute).toBe(0);
  });

  it('branches manual folds at the current timeline step and keeps undo-folds and subsequent edits in sync', async () => {
    await mount();
    await click('Load folding route');
    await click('Step forward');
    await click('Step forward');
    await click('Fold one step');
    expect(cube.state.step).toBe(3);
    expect(textarea('Solution').value.trim()).toBe('F F F');
    expectTextState();

    await click('Unfold one step');
    expect(cube.state.step).toBe(2);
    expect(textarea('Solution').value.trim()).toBe('F F');
    expectTextState();
    await click('Step back');
    expect(cube.state.step).toBe(1);
    await click('Unfold one step');
    expect(textarea('Solution').value).toBe('');
    expect(cube.state.step).toBe(0);
    expect(button('Unfold one step').disabled).toBe(true);
    expectTextState();

    await click('Fold one step');
    await act(async () => vi.advanceTimersByTimeAsync(120));
    expect(cube.state.step).toBe(1);
    expect(textarea('Solution').value.trim()).toBe('F');
    await enter('Solution', 'F F F');
    expect(cube.state.step).toBe(3);
    expectTextState();
  });

  it('rejects invalid tokens and endpoint-crossing pastes atomically, then can reload a valid route', async () => {
    await mount(setupFor('Forward'), 'F F');
    await click('Skip to end');
    const legalState = { ...cube.state };
    const legalPose = cube.positionOnRoute;

    await enter('Solution', 'F R');
    expect(textarea('Solution').parentElement!.querySelector('.bad')?.textContent).toBe('R');
    expect(button('Play').disabled).toBe(true);
    expect(button('Fold one step').disabled).toBe(true);
    expect(cube.state).toEqual(legalState);
    expect(cube.positionOnRoute).toBe(legalPose);

    for (const invalid of ["F'", folds(magicStepCount(puzzle) + 1)]) {
      await enter('Solution', invalid);
      expect(button('Play').disabled).toBe(true);
      expect(button('Step forward').disabled).toBe(true);
      expect(cube.state).toEqual(legalState);
      expect(cube.positionOnRoute).toBe(legalPose);
    }
    await enter('Solution', 'F F');
    await enter('Scramble', `${setupFor('Forward')} X`);
    expect(textarea('Scramble').parentElement!.querySelector('.bad')?.textContent).toBe('X');
    expect(button('Play').disabled).toBe(true);
    expect(button('Animate scramble').disabled).toBe(true);
    expect(cube.state).toEqual(legalState);
    expect(cube.positionOnRoute).toBe(legalPose);

    await click('Load folding route');
    expect(textarea('Scramble').value).toBe(setupFor('Forward'));
    expect(cube.state).toEqual({ direction: 'Forward', step: 0 });
    expect(button('Play').disabled).toBe(false);
  });

  it('settles an active fold before history undo/redo without letting an orphan tween overwrite it', async () => {
    await mount(setupFor('Backward'), '', { animatePlayback: true });
    await click('Fold one step');
    expect(cube.twister.busy).toBe(true);
    await act(async () => { tweener.update(timing.frames / 2); });
    expect(cube.state.step).toBe(0);
    expect(cube.positionOnRoute).toBe(magicStepCount(puzzle) - 0.75);
    await act(async () => cube.twister.undo());
    expect(cube.state).toEqual({ direction: 'Backward', step: 0 });
    expect(cube.positionOnRoute).toBe(magicStepCount(puzzle));
    expect(cube.twister.busy).toBe(false);
    expect(cube.history.redoStack).toEqual(['F']);
    await act(async () => { tweener.update(timing.frames * 2); });
    expect(cube.state.step).toBe(0);
    await act(async () => cube.twister.redo());
    expect(cube.state).toEqual({ direction: 'Backward', step: 1 });
    expect(cube.history.moves).toEqual(['F']);
    expect(cube.history.redoStack).toEqual([]);
    expectTextState();
  });
});
