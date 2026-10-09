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
import { DEFAULT_SETTINGS } from '@/app/[lang]/sim/SettingDrawer';
import type World from '@/app/[lang]/sim/engine/world';
import DuoCube from '@cuberoot/puzzle-render-core/engine/duo/DuoCube';
import {
  duoApply, generatePyraminxDuoScramble, parseDuoMoves,
} from '@cuberoot/puzzle-solvers/pyraminx-duo';

describe('Pyraminx Duo player controls', () => {
  let host: HTMLDivElement;
  let root: Root;
  let cube: DuoCube;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('matchMedia', (media: string) => ({
      matches: false, media,
      addEventListener: () => {}, removeEventListener: () => {},
    }));
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    cube = new DuoCube();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    cube.dispose();
    host.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function mount(setup = '', alg = '') {
    // Keep the real puzzle/twister and all controls. Only the scene host is
    // structural: this DOM test does not create a WebGL canvas or a camera.
    const world = { cube, puzzleKind: 'pyraminx_duo', controller: {}, hands: null, dirty: true } as unknown as World;
    function Harness() {
      const [setupText, setSetupText] = useState(setup);
      const [algText, setAlgText] = useState(alg);
      const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS, animatePlayback: false });
      return createElement(PlayerControls, {
        world, clearFrozen: () => {},
        setup: setupText, alg: algText,
        onSetupChange: setSetupText, onAlgChange: setAlgText,
        order: 3, onOrderChange: () => {},
        puzzleKind: 'pyraminx_duo', onPuzzleChange: () => {},
        settings, onSettingsChange: setSettings,
        canUseCustomLogo: false, keymap: {},
        onKeymapChange: () => {}, onResetKeymap: () => {},
      });
    }
    await act(async () => root.render(createElement(Harness)));
  }

  function button(label: string) {
    const element = host.querySelector<HTMLButtonElement>(`button[title="${label}"]`);
    expect(element, label).not.toBeNull();
    return element!;
  }

  function textarea(placeholder: string) {
    const element = host.querySelector<HTMLTextAreaElement>(`textarea[placeholder="${placeholder}"]`);
    expect(element, placeholder).not.toBeNull();
    return element!;
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

  it('marks invalid tokens in both inputs, disables playback, and retains the last legal state', async () => {
    await mount('L', 'U');
    await act(async () => button('Step forward').click());
    expect(cube.state).toEqual(duoApply('L U'));

    await enter('Solution', 'U2');
    expect(textarea('Solution').parentElement!.querySelector('.bad')?.textContent).toBe('U2');
    expect(button('Play').disabled).toBe(true);
    expect(button('Step forward').disabled).toBe(true);
    expect(cube.state).toEqual(duoApply('L U'));

    await enter('Solution', 'U');
    expect(button('Play').disabled).toBe(false);
    expect(cube.state).toEqual(duoApply('L U'));
    await enter('Scramble', 'u');
    expect(textarea('Scramble').parentElement!.querySelector('.bad')?.textContent).toBe('u');
    expect(button('Play').disabled).toBe(true);
    expect(button('Animate scramble').disabled).toBe(true);
    expect(cube.state).toEqual(duoApply('L U'));
  });

  it('advances legal Duo moves and inverts them through the real controls', async () => {
    await mount('', "U L'");
    await act(async () => button('Step forward').click());
    expect(cube.state).toEqual(duoApply('U'));
    await act(async () => button('Step forward').click());
    expect(cube.state).toEqual(duoApply("U L'"));

    await act(async () => button('Invert').click());
    expect(textarea('Solution').value).toBe("L U'");
    expect(parseDuoMoves(textarea('Solution').value)).toHaveLength(2);
    await act(async () => button('Skip to start').click());
    expect(cube.complete).toBe(true);
    await act(async () => button('Skip to end').click());
    expect(cube.state).toEqual(duoApply("L U'"));
  });

  it('applies its native random scramble immediately with the same strict parser', async () => {
    await mount();
    vi.spyOn(Math, 'random').mockReturnValue(0.375);
    await act(async () => button('Random scramble').click());
    const text = textarea('Scramble').value;
    expect(text).toBe(generatePyraminxDuoScramble(() => 0.375));
    expect(parseDuoMoves(text)).toHaveLength(3);
    expect(cube.state).toEqual(duoApply(text));
    expect(cube.twister.busy).toBe(false);
    expect(cube.complete).toBe(false);
  });
});
