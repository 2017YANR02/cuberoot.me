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
vi.mock('next/navigation', () => ({ useParams: () => ({ lang: 'en' }), usePathname: () => '/sim' }));
vi.mock('@/lib/cubing-scramble', () => ({ tnoodleRandomScramble: vi.fn() }));
vi.mock('@/lib/pg-scramble', () => ({ pgRandomScramble: vi.fn() }));

import PlayerControls from '@/app/[lang]/sim/PlayerControls';
import { DEFAULT_SETTINGS } from '@/app/[lang]/sim/SettingDrawer';
import { DEFAULT_KEYMAP } from '@/app/[lang]/sim/keymap';
import { tnoodleRandomScramble } from '@/lib/cubing-scramble';
import { pgRandomScramble } from '@/lib/pg-scramble';
import { generateNativePuzzleScramble, type NativePuzzleId } from '@cuberoot/puzzle-solvers/native-puzzles';
import { nativePuzzleKPuzzle, parseNativePuzzleAlg, simplifyNativePuzzleAlg } from '@cuberoot/puzzle-solvers/native-puzzle-model';

const CASES = [
  { id: 'superz', setup: 'R', alg: 'UFR F2', manual: 'DRF', typed: "DRF' UFR" },
  { id: 'dogic', setup: 'FREGU', alg: "HIERC2 FLACR'", manual: '2NALPO', typed: "FLACRw' HIERC" },
  { id: 'octahedron4', setup: 'DBRRF', alg: "DFLBL2 DBLBBBR'", manual: '2DBRRF', typed: "DFLBLw' DBLBBBR" },
  { id: 'dinoskewb', setup: 'DRF', alg: "UFR DBR'", manual: '2DFL', typed: "DRFw' UFR" },
] as const;
type Fixture = typeof CASES[number];

describe('native PG simulator controls', () => {
  let host: HTMLDivElement;
  let root: Root;
  let frames: Map<number, FrameRequestCallback>;
  let nextFrame: number;
  const setupChanges = vi.fn();
  const algChanges = vi.fn();
  const settingsChanges = vi.fn();
  const copyLinks = vi.fn<(setup: string, alg: string) => Promise<void>>().mockResolvedValue(undefined);
  const playStates = vi.fn();
  const userMoveRef: NonNullable<ComponentProps<typeof PlayerControls>['userMoveRef']> = { current: null };
  const player = {
    experimentalSetupAlg: '',
    experimentalSetupAnchor: 'start' as 'start' | 'end',
    alg: '',
    pause: vi.fn(),
    jumpToStart: vi.fn(),
    jumpToEnd: vi.fn(),
    play: vi.fn(() => playStates({ setup: player.experimentalSetupAlg, alg: player.alg, anchor: player.experimentalSetupAnchor })),
  };
  const playerRef = { current: player };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('matchMedia', (media: string) => ({
      matches: false, media, addEventListener: () => {}, removeEventListener: () => {},
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
    userMoveRef.current = null;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function mount(spec: Fixture, options: {
    deferUrlUpdates?: boolean; setup?: string; alg?: string; playbackMode?: 'moves' | 'algorithm'; liveReduce?: boolean;
  } = {}) {
    function Harness() {
      const [setup, setSetup] = useState(options.setup ?? spec.setup);
      const [alg, setAlg] = useState(options.alg ?? spec.alg);
      const [settings, setSettings] = useState({
        ...DEFAULT_SETTINGS, animatePlayback: false,
        playbackMode: options.playbackMode ?? 'moves', liveReduce: options.liveReduce ?? false,
      });
      // Only the WebGL player boundary is structural. TwistySection's validation,
      // timeline quarantine and public/manual move wrapper have separate tests.
      useEffect(() => {
        try {
          parseNativePuzzleAlg(spec.id, setup);
          parseNativePuzzleAlg(spec.id, alg);
          player.experimentalSetupAlg = setup;
          player.alg = alg;
          player.experimentalSetupAnchor = settings.playbackMode === 'algorithm' ? 'end' : 'start';
        } catch { /* Keep the last valid player inputs as TwistySection does. */ }
      }, [setup, alg, settings.playbackMode]);
      return createElement(PlayerControls, {
        world: null, activeCube: null, clearFrozen: () => {}, setup, alg,
        onSetupChange: (text) => { setupChanges(text); if (!options.deferUrlUpdates) setSetup(text); },
        onAlgChange: (text) => { algChanges(text); if (!options.deferUrlUpdates) setAlg(text); },
        onCopyLink: copyLinks,
        order: 3, onOrderChange: () => {}, puzzleKind: spec.id, onPuzzleChange: () => {},
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

  function input(placeholder: string) {
    const element = host.querySelector<HTMLTextAreaElement>(`textarea[placeholder="${placeholder}"]`);
    expect(element, placeholder).not.toBeNull();
    return element!;
  }

  async function enter(placeholder: string, value: string, inputType = 'insertFromPaste') {
    const element = input(placeholder);
    await act(async () => {
      element.focus();
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(element, value);
      element.setSelectionRange(value.length, value.length);
      element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType }));
    });
  }

  async function nextAnimationFrame() {
    const pending = [...frames.values()];
    frames.clear();
    await act(async () => { for (const callback of pending) callback(0); });
  }

  it.each(CASES)('$id scrambles without a World, preserves the solution, and animates only on request', async (spec) => {
    await mount(spec, { playbackMode: 'algorithm' });
    vi.spyOn(Math, 'random').mockReturnValue(0.375);
    const scramble = generateNativePuzzleScramble(spec.id, () => 0.375);
    await act(async () => button('Random scramble').click());
    expect(tnoodleRandomScramble).not.toHaveBeenCalled();
    expect(pgRandomScramble).not.toHaveBeenCalled();
    expect(input('Scramble').value).toBe(scramble);
    expect(input('Solution').value).toBe(spec.alg);
    expect(setupChanges).toHaveBeenLastCalledWith(scramble);
    expect(player.experimentalSetupAlg).toBe(scramble);
    expect(player.experimentalSetupAnchor).toBe('end');
    expect(player.pause).toHaveBeenCalled();
    expect(player.jumpToEnd).toHaveBeenCalledWith({ flash: false });
    expect(player.jumpToStart).not.toHaveBeenCalled();
    expect(player.play).not.toHaveBeenCalled();
    const puzzle = nativePuzzleKPuzzle(spec.id);
    expect(puzzle.defaultPattern().applyAlg(parseNativePuzzleAlg(spec.id, scramble)).isIdentical(puzzle.defaultPattern())).toBe(false);
    await nextAnimationFrame();
    await nextAnimationFrame();
    expect(player.play).not.toHaveBeenCalled();

    await act(async () => button('Animate scramble').click());
    expect(input('Scramble').value).toBe('');
    expect(input('Solution').value).toBe(scramble);
    expect(settingsChanges).toHaveBeenLastCalledWith(expect.objectContaining({ playbackMode: 'moves' }));
    expect(player.play).not.toHaveBeenCalled();
    await nextAnimationFrame();
    await nextAnimationFrame();
    expect(player.jumpToStart).toHaveBeenCalledExactlyOnceWith({ flash: false });
    expect(player.play).toHaveBeenCalledOnce();
    expect(playStates).toHaveBeenCalledExactlyOnceWith({ setup: '', alg: scramble, anchor: 'start' });
  });

  it.each(CASES)('$id preserves typed multi-letter tokens and copies a manual move after a comment before URL debounce', async (spec) => {
    await mount(spec, { deferUrlUpdates: true, alg: '', liveReduce: true });
    const draftSetup = `${spec.setup}2`;
    await enter('Scramble', draftSetup);
    const typed = `${spec.typed} // retained note`;
    for (const character of typed) await enter('Solution', input('Solution').value + character, 'insertText');
    expect(input('Solution').value).toBe(typed);
    expect(host.querySelector('.sim-player-hl .bad')).toBeNull();
    algChanges.mockClear();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let returned: string | void = undefined;
    await act(async () => { returned = userMoveRef.current?.(spec.manual); });
    const latest = input('Solution').value;
    expect(returned).toBe(latest);
    expect(latest.trimEnd()).toBe(`${typed}\n${spec.manual}`);
    expect(algChanges).not.toHaveBeenCalled();
    expect(() => parseNativePuzzleAlg(spec.id, latest)).not.toThrow();
    await act(async () => button('Copy this page link (with scramble / solution)').click());
    expect(copyLinks).toHaveBeenCalledExactlyOnceWith(draftSetup, latest);
    expect(writeText).not.toHaveBeenCalled();
  });

  it.each(CASES)('$id immediately commits and shares both updated fields after an end-anchored manual turn', async (spec) => {
    await mount(spec, { deferUrlUpdates: true, playbackMode: 'algorithm' });
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const nextSetup = `${spec.setup} ${spec.manual}`;
    let returned: string | void = undefined;
    await act(async () => { returned = userMoveRef.current?.(spec.manual, { setup: nextSetup }); });
    const nextAlg = input('Solution').value;
    expect(returned).toBe(nextAlg);
    expect(input('Scramble').value).toBe(nextSetup);
    expect(nextAlg.trimEnd()).toBe(`${spec.alg} ${spec.manual}`);
    expect(setupChanges).toHaveBeenCalledExactlyOnceWith(nextSetup);
    expect(algChanges).toHaveBeenCalledExactlyOnceWith(nextAlg);
    expect(settingsChanges).not.toHaveBeenCalled();
    expect(host.querySelector<HTMLSelectElement>('select[title="Anchor: keep the scramble start or the solve end fixed"]')!.value).toBe('algorithm');
    await act(async () => button('Copy this page link (with scramble / solution)').click());
    expect(copyLinks).toHaveBeenCalledExactlyOnceWith(nextSetup, nextAlg);
    expect(writeText).not.toHaveBeenCalled();

    // Reloading the shared two-field state retains the old start and applies the
    // turn to the old end. Compare physical transformations, not concatenated text.
    const puzzle = nativePuzzleKPuzzle(spec.id);
    const oldSetup = puzzle.algToTransformation(spec.setup);
    const oldAlg = puzzle.algToTransformation(spec.alg);
    const sharedSetup = puzzle.algToTransformation(nextSetup);
    const sharedAlg = puzzle.algToTransformation(nextAlg);
    expect(sharedSetup.isIdentical(oldSetup.applyMove(spec.manual))).toBe(true);
    expect(sharedSetup.applyTransformation(sharedAlg.invert()).isIdentical(
      oldSetup.applyTransformation(oldAlg.invert()),
    )).toBe(true);
  });

  it.each(CASES)('$id marks invalid setup/solution text and blocks animation until corrected', async (spec) => {
    await mount(spec);
    for (const [placeholder, invalid] of [
      ['Scramble', `${spec.setup} notAMove`],
      ['Solution', `(${spec.setup})1000000000`],
    ]) {
      await enter(placeholder, invalid);
      expect(input(placeholder).closest('.sim-player-hlwrap')?.querySelector('.bad')?.textContent).toBe(invalid);
      expect(button('Animate scramble').disabled).toBe(true);
      await act(async () => button('Animate scramble').click());
      await nextAnimationFrame();
      await nextAnimationFrame();
      expect(player.play).not.toHaveBeenCalled();
      expect(input(placeholder).value).toBe(invalid);
      await enter(placeholder, placeholder === 'Scramble' ? spec.setup : spec.alg);
      expect(host.querySelector('.sim-player-hl .bad')).toBeNull();
      expect(button('Animate scramble').disabled).toBe(false);
    }
  });

  it.each(CASES)('$id inverts both fields when the setup ends with a line comment', async (spec) => {
    await mount(spec, { deferUrlUpdates: true });
    await enter('Scramble', `${spec.setup} // keep the separate solution field`);
    const puzzle = nativePuzzleKPuzzle(spec.id);
    // Compose each field independently so the expected state cannot reproduce
    // the UI bug that joined the solution into the setup's line comment.
    const setupState = puzzle.algToTransformation(spec.setup);
    const original = setupState.applyTransformation(puzzle.algToTransformation(spec.alg));
    expect(original.isIdentical(setupState)).toBe(false);
    await act(async () => button('Invert').click());
    expect(input('Scramble').value).toBe('');
    const inverse = puzzle.algToTransformation(parseNativePuzzleAlg(spec.id, input('Solution').value));
    expect(inverse.isIdentical(original.invert())).toBe(true);
    expect(original.applyTransformation(inverse).isIdentityTransformation()).toBe(true);
    // Negative control: losing the second field produces a different inverse.
    expect(inverse.isIdentical(setupState.invert())).toBe(false);
  });

  it('cancels a queued native animation when input becomes invalid before its animation frame', async () => {
    await mount(CASES[0]);
    await act(async () => button('Animate scramble').click());
    expect(player.play).not.toHaveBeenCalled();
    await enter('Solution', '(UFR)1000000000');
    expect(input('Solution').closest('.sim-player-hlwrap')?.querySelector('.bad')).not.toBeNull();
    await nextAnimationFrame();
    await nextAnimationFrame();
    expect(player.play).not.toHaveBeenCalled();
  });

  it.each([
    { id: 'superz', move: 'R', order: 4 },
    { id: 'superz', move: 'UFR', order: 3 },
    { id: 'dogic', move: 'FREGU', order: 5 },
    { id: 'octahedron4', move: 'DBRRF', order: 4 },
    { id: 'dinoskewb', move: 'DRF', order: 3 },
  ] satisfies { id: NativePuzzleId; move: string; order: number }[])('$id $move live cancellation uses its physical order $order and inversion preserves state', async ({ id, move, order }) => {
    const spec = CASES.find((candidate) => candidate.id === id)!;
    await mount(spec, { setup: '', alg: '', liveReduce: true });
    const puzzle = nativePuzzleKPuzzle(id);
    for (let i = 1; i < order; i++) await act(async () => userMoveRef.current?.(move));
    const almostCycle = input('Solution').value.trim();
    expect(puzzle.algToTransformation(almostCycle).isIdentityTransformation()).toBe(false);
    expect(puzzle.algToTransformation(almostCycle).isIdentical(puzzle.moveToTransformation(`${move}'`))).toBe(true);
    await act(async () => userMoveRef.current?.(move));
    expect(input('Solution').value).toBe('');
    expect(simplifyNativePuzzleAlg(id, `${move}${order}`)).toBe('');
    await enter('Solution', spec.alg);
    const original = puzzle.algToTransformation(spec.alg);
    await act(async () => button('Invert').click());
    const inverse = puzzle.algToTransformation(input('Solution').value);
    expect(inverse.isIdentical(original.invert())).toBe(true);
    expect(original.applyTransformation(inverse).isIdentityTransformation()).toBe(true);
  });
});
