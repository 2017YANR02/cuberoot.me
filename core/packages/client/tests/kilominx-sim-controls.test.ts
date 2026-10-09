// @vitest-environment jsdom

import { act, createElement, useEffect, useState, type ComponentProps } from 'react';
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
vi.mock('@/lib/cubing-scramble', () => ({ tnoodleRandomScramble: vi.fn() }));

import PlayerControls, { type SimPuzzle } from '@/app/[lang]/sim/PlayerControls';
import { DEFAULT_SETTINGS } from '@/app/[lang]/sim/SettingDrawer';
import { DEFAULT_KEYMAP } from '@/app/[lang]/sim/keymap';
import World from '@/app/[lang]/sim/engine/world';
import Cube from '@/app/[lang]/sim/engine/nxn/cube';
import { attachInteraction } from '@/app/[lang]/sim/worldInteraction';
import { tnoodleRandomScramble } from '@/lib/cubing-scramble';
import { toCubingKilominx, type KilominxNotation } from '@/lib/kilominx-notation';

const SCRAMBLE = "FR U2 DL' R'";
const EDITOR_SCRAMBLE = "DR U2 DBL' R'";

describe('Kilominx simulator controls', () => {
  let host: HTMLDivElement;
  let root: Root;
  let world: World | null;
  let frames: Map<number, FrameRequestCallback>;
  let nextFrame: number;
  let switchToNxn: (nextWorld: World) => void;
  const setupChanges = vi.fn();
  const algChanges = vi.fn();
  const notationChanges = vi.fn();
  const settingsChanges = vi.fn();
  const playStates = vi.fn();
  const seekAnchors = vi.fn();
  const copyLinks = vi.fn<(setup: string, alg: string) => Promise<void>>().mockResolvedValue(undefined);
  const userMoveRef: NonNullable<ComponentProps<typeof PlayerControls>['userMoveRef']> = { current: null };
  const player = {
    experimentalSetupAlg: '',
    experimentalSetupAnchor: 'start' as 'start' | 'end',
    alg: '',
    pause: vi.fn(),
    jumpToStart: vi.fn(() => seekAnchors(player.experimentalSetupAnchor)),
    jumpToEnd: vi.fn(() => seekAnchors(player.experimentalSetupAnchor)),
    play: vi.fn(() => playStates({ setup: player.experimentalSetupAlg, alg: player.alg, anchor: player.experimentalSetupAnchor })),
  };
  const playerRef = { current: player as typeof player | null };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(tnoodleRandomScramble).mockReset().mockResolvedValue(SCRAMBLE);
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('matchMedia', (media: string) => ({
      matches: false, media,
      addEventListener: () => {}, removeEventListener: () => {},
    }));
    frames = new Map();
    nextFrame = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
    player.experimentalSetupAlg = '';
    player.experimentalSetupAnchor = 'start';
    player.alg = '';
    playerRef.current = player;
    userMoveRef.current = null;
    world = null;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    world?.controller.stop();
    world?.cube.dispose();
    host.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function mount(deferUrlUpdates = false, initialAlg = 'U R2', initialPlaybackMode: 'moves' | 'algorithm' = 'moves') {
    function Harness() {
      const [kind, setKind] = useState<SimPuzzle>('kilominx');
      const [activeWorld, setWorld] = useState<World | null>(null);
      const [setup, setSetup] = useState('R');
      const [alg, setAlg] = useState(initialAlg);
      const [notation, setNotation] = useState<KilominxNotation>();
      const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS, animatePlayback: false, playbackMode: initialPlaybackMode });
      switchToNxn = (nextWorld) => {
        playerRef.current = null;
        setWorld(nextWorld);
        setKind(3);
        setSetup('F');
        setAlg('L');
      };
      // TwistySection owns this prop-to-player bridge in production. The controls
      // and their scheduling are real; only the WebGL-backed player is structural.
      useEffect(() => {
        if (kind !== 'kilominx') return;
        player.experimentalSetupAlg = toCubingKilominx(setup, notation);
        player.alg = toCubingKilominx(alg, notation);
        player.experimentalSetupAnchor = settings.playbackMode === 'algorithm' ? 'end' : 'start';
      }, [kind, setup, alg, notation, settings.playbackMode]);
      return createElement(PlayerControls, {
        world: activeWorld, activeCube: activeWorld?.cube ?? null,
        clearFrozen: () => activeWorld?.controller.clearFrozen(),
        setup, alg,
        onSetupChange: (text) => { setupChanges(text); if (!deferUrlUpdates) setSetup(text); },
        onAlgChange: (text) => { algChanges(text); if (!deferUrlUpdates) setAlg(text); },
        onCopyLink: copyLinks,
        kilominxNotation: notation,
        onKilominxNotationChange: (next, nextSetup, nextAlg) => {
          notationChanges(next, nextSetup, nextAlg);
          setNotation(next);
          setSetup(nextSetup);
          setAlg(nextAlg);
        },
        order: 3, onOrderChange: setKind,
        puzzleKind: kind, onPuzzleChange: setKind,
        // Bare simulator URLs default to group, but Kilominx has no local engine.
        renderer: 'group', twistyPlayerRef: playerRef, userMoveRef,
        settings, onSettingsChange: (next) => { settingsChanges(next); setSettings(next); }, canUseCustomLogo: false,
        keymap: DEFAULT_KEYMAP, onKeymapChange: () => {}, onResetKeymap: () => {},
      });
    }
    await act(async () => root.render(createElement(Harness)));
  }

  function button(title: string) {
    const element = host.querySelector<HTMLButtonElement>(`button[title="${title}"]`);
    expect(element, title).not.toBeNull();
    return element!;
  }

  function text(placeholder: string) {
    return host.querySelector<HTMLTextAreaElement>(`textarea[placeholder="${placeholder}"]`)?.value;
  }

  async function enter(placeholder: string, value: string, inputType = 'insertFromPaste') {
    const element = host.querySelector<HTMLTextAreaElement>(`textarea[placeholder="${placeholder}"]`)!;
    await act(async () => {
      element.focus();
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(element, value);
      element.setSelectionRange(value.length, value.length);
      element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType }));
    });
  }

  async function selectNotation(value: KilominxNotation) {
    const select = host.querySelector<HTMLSelectElement>('select[aria-label="Kilominx notation"]');
    expect(select).not.toBeNull();
    await act(async () => {
      select!.focus();
      select!.value = value;
      select!.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(select!.value).toBe(value);
  }

  async function nextAnimationFrame() {
    const pending = [...frames.values()];
    frames.clear();
    await act(async () => { for (const callback of pending) callback(0); });
  }

  function anchorSelect() {
    const select = host.querySelector<HTMLSelectElement>('select[title="Anchor: keep the scramble start or the solve end fixed"]');
    expect(select).not.toBeNull();
    return select!;
  }

  function expectNxnState(algorithm: string) {
    const expected = new Cube(3);
    try {
      expected.twister.setup(algorithm);
      expect((world!.cube as Cube).serialize()).toBe(expected.serialize());
    } finally { expected.dispose(); }
  }

  it('scrambles without a World and animates the current scramble through the Twisty player', async () => {
    let resolveScramble!: (scramble: string) => void;
    vi.mocked(tnoodleRandomScramble).mockReturnValueOnce(new Promise((resolve) => {
      resolveScramble = resolve;
    }));
    await mount(false, 'U R2', 'algorithm');
    expect(world).toBeNull();
    expect(anchorSelect().value).toBe('algorithm');
    expect(player.experimentalSetupAnchor).toBe('end');
    await act(async () => button('Random scramble').click());
    expect(tnoodleRandomScramble).toHaveBeenCalledExactlyOnceWith('kilominx');
    await act(async () => resolveScramble(SCRAMBLE));
    expect(setupChanges).toHaveBeenLastCalledWith(EDITOR_SCRAMBLE);
    expect(text('Scramble')).toBe(EDITOR_SCRAMBLE);
    expect(text('Solution')).toBe('U R2');
    expect(player.experimentalSetupAlg).toBe(SCRAMBLE);
    expect(player.pause).toHaveBeenCalled();
    expect(player.jumpToEnd).toHaveBeenCalledWith({ flash: false });
    expect(player.jumpToStart).not.toHaveBeenCalled();
    expect(settingsChanges).not.toHaveBeenCalled();
    expect(anchorSelect().value).toBe('algorithm');
    expect(seekAnchors).toHaveBeenCalledWith('end');
    expect(player.experimentalSetupAnchor).toBe('end');
    expect(player.play).not.toHaveBeenCalled();
    await nextAnimationFrame();
    await nextAnimationFrame();

    // Animation must switch to start anchoring; otherwise it plays the inverse
    // into solved instead of applying the scramble forward from solved.
    player.jumpToStart.mockClear();
    await act(async () => button('Animate scramble').click());
    expect(settingsChanges).toHaveBeenLastCalledWith(expect.objectContaining({ playbackMode: 'moves' }));
    expect(anchorSelect().value).toBe('moves');
    expect(text('Scramble')).toBe('');
    expect(text('Solution')).toBe(EDITOR_SCRAMBLE);
    expect(player.play).not.toHaveBeenCalled();
    await nextAnimationFrame();
    await nextAnimationFrame();
    expect(player.jumpToStart).toHaveBeenCalledExactlyOnceWith({ flash: false });
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(playStates).toHaveBeenCalledExactlyOnceWith({ setup: '', alg: SCRAMBLE, anchor: 'start' });
  });

  it('switches notation from current drafts atomically and keeps multi-letter moves intact while typing', async () => {
    // URL updates can lag typing. Switching modes must consume the live drafts,
    // not the older setup/alg props, then publish all three values together.
    await mount(true);
    const setup = 'DR DL DBL DBR';
    const alg = "DR2 DL' DBL DBR2'";
    const native = { setup: 'FR FL DL DR', alg: "FR2 FL' DL DR2'" };
    await enter('Scramble', setup);
    await enter('Solution', '', 'deleteContentBackward');
    for (const character of alg) {
      await enter('Solution', text('Solution') + character, 'insertText');
    }
    expect(text('Solution')).toBe(alg);
    setupChanges.mockClear();
    algChanges.mockClear();

    await selectNotation('cubing');
    expect(notationChanges).toHaveBeenCalledExactlyOnceWith('cubing', native.setup, native.alg);
    expect(text('Scramble')).toBe(native.setup);
    expect(text('Solution')).toBe(native.alg);
    expect({ setup: player.experimentalSetupAlg, alg: player.alg }).toEqual(native);
    expect(setupChanges).not.toHaveBeenCalled();
    expect(algChanges).not.toHaveBeenCalled();

    await selectNotation('cstimer');
    expect(notationChanges).toHaveBeenCalledTimes(2);
    expect(notationChanges).toHaveBeenLastCalledWith('cstimer', setup, alg);
    expect(text('Scramble')).toBe(setup);
    expect(text('Solution')).toBe(alg);
    expect({ setup: player.experimentalSetupAlg, alg: player.alg }).toEqual(native);
    expect(setupChanges).not.toHaveBeenCalled();
    expect(algChanges).not.toHaveBeenCalled();
  });

  it('records a manual turn on a new line after a retained solution comment', async () => {
    await mount(false, 'R // note');
    expect(userMoveRef.current).toBeTypeOf('function');
    await act(async () => userMoveRef.current?.('DR'));
    expect(text('Solution')?.trimEnd()).toBe('R // note\nDR');
  });

  it('does not consume solution typing through the hidden mobile QWERTY keyboard', async () => {
    vi.stubGlobal('matchMedia', (media: string) => ({
      matches: true, media,
      addEventListener: () => {}, removeEventListener: () => {},
    }));
    await mount();
    const input = host.querySelector<HTMLTextAreaElement>('textarea[placeholder="Solution"]')!;
    for (const key of ['D', 'R']) {
      const event = new KeyboardEvent('keydown', { key, code: `Key${key}`, bubbles: true, cancelable: true });
      await act(async () => {
        input.focus();
        input.dispatchEvent(event);
      });
      expect(event.defaultPrevented, key).toBe(false);
    }
    expect(text('Solution')).toBe('U R2');
  });

  it('copies current drafts immediately after a manual move without waiting for the URL debounce', async () => {
    await mount(true);
    await enter('Scramble', 'DR2');
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await act(async () => userMoveRef.current?.('DR'));
    const latestAlg = text('Solution');
    expect(latestAlg?.trimEnd()).toBe('U R2 DR');
    expect(algChanges).not.toHaveBeenCalled();
    await act(async () => button('Copy this page link (with scramble / solution)').click());
    expect(copyLinks).toHaveBeenCalledExactlyOnceWith('DR2', latestAlg);
    expect(writeText).not.toHaveBeenCalled();
  });

  it('discards a pending Kilominx scramble after switching back to a real NxN cube', async () => {
    let resolveScramble!: (scramble: string) => void;
    vi.mocked(tnoodleRandomScramble).mockReturnValueOnce(new Promise((resolve) => {
      resolveScramble = resolve;
    }));
    await mount();
    await act(async () => button('Random scramble').click());
    expect(tnoodleRandomScramble).toHaveBeenCalledExactlyOnceWith('kilominx');

    // Keep real World/Cube/controller state; omit only canvas-backed letter textures.
    const dom = document;
    vi.stubGlobal('document', undefined);
    try { world = attachInteraction(new World()); }
    finally { vi.stubGlobal('document', dom); }
    await act(async () => switchToNxn(world!));
    expectNxnState('F');
    await act(async () => resolveScramble(SCRAMBLE));
    await nextAnimationFrame();
    await nextAnimationFrame();
    expect(text('Scramble')).toBe('F');
    expect(text('Solution')).toBe('L');
    expect(setupChanges).not.toHaveBeenCalled();
    expect(player.pause).not.toHaveBeenCalled();
    expect(player.jumpToStart).not.toHaveBeenCalled();
    expectNxnState('F');
    await act(async () => button('Step forward').click());
    expectNxnState('F L');
  });
});
