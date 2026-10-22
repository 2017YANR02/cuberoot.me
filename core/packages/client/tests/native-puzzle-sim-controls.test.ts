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

import type { TwistyPlaybackPlayer } from '@/lib/twisty-playback';

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
  { id: 'lattice', setup: '3DRF', alg: "3DFLw UFR'", manual: '3UFR', typed: "3DRFw' DFL" },
  { id: 'hyperx', setup: 'F', alg: 'DRFw U2', manual: '2UFR', typed: "2DRF' F" },
  { id: 'latticex', setup: 'F', alg: '3DRFw U2', manual: '3UFRw', typed: "3DRF' UFR" },
  { id: 'masterbrilic', setup: '1-2U', alg: '3F L2', manual: '1-3U', typed: "1-3F' 3L" },
  { id: 'masterftov2', setup: '1-2F', alg: "D L'", manual: '2F', typed: "1-2D' L" },
  { id: 'quadx', setup: 'UFw', alg: "FL DR'", manual: '2UF', typed: "FLw' DR", reducedTyped: 'FLw DR' },
  { id: 'dinoocta', setup: '1-2F', alg: "D L'", manual: '2F', typed: "1-2D' L" },
  { id: 'fto5', setup: '1-3F', alg: "3D L'", manual: '3F', typed: "1-3D' L" },
  { id: 'eto', setup: 'FDw', alg: "FL BLD'", manual: '2FD', typed: "FLw' BLD", reducedTyped: 'FLw BLD' },
  { id: 'radiocrystal', setup: 'Rw', alg: "G U'", manual: '2R', typed: "Gw' U" },
  { id: 'cube3skewb', setup: 'F', alg: "DRF U'", manual: '2U', typed: "Lw' UFR" },
  { id: 'heliskewb', setup: 'DRF', alg: "DF UFR'", manual: '2DF', typed: "FLw' UFR", reducedTyped: 'FLw UFR' },
  { id: 'comboctahedron', setup: 'F', alg: "D_BR_R_F B'", manual: '2D_F_L_BL', typed: "1-3U_B_BL_L' D" },
  { id: 'circoradiolarian', setup: 'Rw', alg: "G U'", manual: '2R', typed: "Gw' U" },
  { id: 'radiojewel', setup: 'Rw', alg: "G U'", manual: '2R', typed: "Gw' U" },
  { id: 'radioweb', setup: 'Rw', alg: "G U'", manual: '2R', typed: "Gw' U" },
  { id: 'radiojam', setup: 'Rw', alg: "G U'", manual: '2R', typed: "Gw' U" },
  { id: 'catscradle', setup: 'Rw', alg: "G U'", manual: '2R', typed: "Gw' U" },
  { id: 'icosababyface', setup: 'FREGU', alg: "HIERC2 FLACR'", manual: '2NALPO', typed: "FLACRw' HIERC" },
  { id: 'cube2heli', setup: 'F', alg: "DF U'", manual: '2DF', typed: "FLw' U", reducedTyped: 'FLw U' },
  { id: 'cube3heli', setup: 'F', alg: "DF U'", manual: '2DF', typed: "FLw' U", reducedTyped: 'FLw U' },
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
    experimentalModel: {
      setupAlg: { get: vi.fn(async () => ({ alg: player.experimentalSetupAlg })) },
      alg: { get: vi.fn(async () => ({ alg: player.alg })) },
      setupAnchor: { get: vi.fn(async () => player.experimentalSetupAnchor) },
      detailedTimelineInfo: { get: vi.fn(async () => ({ timestamp: 0 })), addFreshListener: vi.fn(), removeFreshListener: vi.fn() },
      playingInfo: { get: vi.fn(async () => ({ playing: false })), addFreshListener: vi.fn(), removeFreshListener: vi.fn() },
      indexer: { get: vi.fn<() => Promise<null>>(async () => null), addFreshListener: vi.fn(), removeFreshListener: vi.fn() },
      coarseTimelineInfo: { get: vi.fn(async () => null) },
    },
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
        order: 3, puzzleKind: spec.id,
        renderer: 'group', twistyPlayerRef: playerRef, userMoveRef,
        twistyPlaybackPlayer: player as unknown as TwistyPlaybackPlayer,
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
    expect(input('Scramble').value).toBe(scramble);
    expect(input('Solution').value).toBe(spec.alg);
    expect(settingsChanges).not.toHaveBeenCalled();
    await nextAnimationFrame();
    await nextAnimationFrame();
    expect(player.jumpToStart).toHaveBeenCalledExactlyOnceWith({ flash: false });
    expect(player.play).toHaveBeenCalledOnce();
    expect(playStates).toHaveBeenCalledExactlyOnceWith({ setup: '', alg: scramble, anchor: 'start' });
    await act(async () => button('Return to algorithm').click());
    expect(player.experimentalSetupAlg).toBe(scramble);
    expect(player.alg).toBe(spec.alg);
    expect(player.experimentalSetupAnchor).toBe('end');
    expect(input('Scramble').value).toBe(scramble);
    expect(input('Solution').value).toBe(spec.alg);
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
    // With live reduction enabled an order-two inverse has canonical amount 1.
    const reduced = 'reducedTyped' in spec ? `${spec.reducedTyped} // retained note` : typed;
    expect(latest.trimEnd()).toBe(`${reduced}\n${spec.manual}`);
    expect(algChanges).not.toHaveBeenCalled();
    expect(() => parseNativePuzzleAlg(spec.id, latest)).not.toThrow();
    await act(async () => button('Copy this page link (with scramble / solution)').click());
    expect(copyLinks).toHaveBeenCalledExactlyOnceWith(draftSetup, latest);
    expect(writeText).not.toHaveBeenCalled();
  });

  it.each(CASES.filter(({ id }) => id === 'quadx' || id === 'eto' || id === 'heliskewb' || id === 'cube2heli' || id === 'cube3heli'))('$id preserves the chosen half-turn directions when live reduction is off', async (spec) => {
    const typed = `${spec.typed} // keep turn direction`;
    await mount(spec, { alg: typed, liveReduce: false });
    await act(async () => { userMoveRef.current?.(`${spec.manual}'`); });
    const latest = input('Solution').value;
    expect(latest.trimEnd()).toBe(`${typed}\n${spec.manual}'`);
    expect(nativePuzzleKPuzzle(spec.id).algToTransformation(latest).isIdentical(
      nativePuzzleKPuzzle(spec.id).algToTransformation(`${spec.typed} ${spec.manual}'`),
    )).toBe(true);
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
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Playback settings"]')!.click());
    expect(host.querySelector('button[aria-label="Anchor: keep the scramble start or the solve end fixed"]')?.textContent).toBe('End');
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

  it.each(CASES)('$id blocks animation for invalid input and random scrambles for an invalid solution until corrected', async (spec) => {
    await mount(spec);
    for (const [placeholder, invalid] of [
      ['Scramble', `${spec.setup} notAMove`],
      ['Solution', `${spec.alg} INVALID`],
      ['Solution', `(${spec.setup})1000000000`],
    ]) {
      const prior = { setup: player.experimentalSetupAlg, alg: player.alg, anchor: player.experimentalSetupAnchor };
      await enter(placeholder, invalid);
      expect(input(placeholder).closest('.sim-player-hlwrap')?.querySelector('.bad')?.textContent).toBe(invalid);
      expect(button('Animate scramble').disabled).toBe(true);
      expect(button('Random scramble').disabled).toBe(placeholder === 'Solution');
      setupChanges.mockClear();
      algChanges.mockClear();
      player.pause.mockClear();
      player.jumpToStart.mockClear();
      player.jumpToEnd.mockClear();
      await act(async () => button('Animate scramble').click());
      if (placeholder === 'Solution') await act(async () => button('Random scramble').click());
      await nextAnimationFrame();
      await nextAnimationFrame();
      expect(player.play).not.toHaveBeenCalled();
      expect(player.pause).not.toHaveBeenCalled();
      expect(player.jumpToStart).not.toHaveBeenCalled();
      expect(player.jumpToEnd).not.toHaveBeenCalled();
      expect({ setup: player.experimentalSetupAlg, alg: player.alg, anchor: player.experimentalSetupAnchor }).toEqual(prior);
      expect(setupChanges).not.toHaveBeenCalled();
      expect(algChanges).not.toHaveBeenCalled();
      expect(input(placeholder).value).toBe(invalid);
      await enter(placeholder, placeholder === 'Scramble' ? spec.setup : spec.alg);
      expect(host.querySelector('.sim-player-hl .bad')).toBeNull();
      expect(button('Animate scramble').disabled).toBe(false);
      expect(button('Random scramble').disabled).toBe(false);
    }
    vi.spyOn(Math, 'random').mockReturnValue(0.375);
    const scramble = generateNativePuzzleScramble(spec.id, () => 0.375);
    setupChanges.mockClear();
    algChanges.mockClear();
    await act(async () => button('Random scramble').click());
    await nextAnimationFrame();
    await nextAnimationFrame();
    expect(setupChanges).toHaveBeenCalledExactlyOnceWith(scramble);
    expect(algChanges).not.toHaveBeenCalled();
    expect(input('Scramble').value).toBe(scramble);
    expect(input('Solution').value).toBe(spec.alg);
    expect(player.experimentalSetupAlg).toBe(scramble);
    expect(player.alg).toBe(spec.alg);
    expect(player.play).not.toHaveBeenCalled();
  });

  it.each(CASES)('$id replaces an invalid setup with a random scramble while retaining its valid solution and anchor', async (spec) => {
    await mount(spec, { playbackMode: 'algorithm' });
    await enter('Scramble', `${spec.setup} INVALID`);
    expect(input('Scramble').closest('.sim-player-hlwrap')?.querySelector('.bad')).not.toBeNull();
    expect(button('Animate scramble').disabled).toBe(true);
    expect(button('Random scramble').disabled).toBe(false);
    expect(player.experimentalSetupAlg).toBe(spec.setup);
    expect(player.alg).toBe(spec.alg);
    vi.spyOn(Math, 'random').mockReturnValue(0.375);
    const scramble = generateNativePuzzleScramble(spec.id, () => 0.375);
    setupChanges.mockClear();
    algChanges.mockClear();
    await act(async () => button('Random scramble').click());
    await nextAnimationFrame();
    await nextAnimationFrame();
    expect(setupChanges).toHaveBeenCalledExactlyOnceWith(scramble);
    expect(algChanges).not.toHaveBeenCalled();
    expect(input('Scramble').value).toBe(scramble);
    expect(input('Solution').value).toBe(spec.alg);
    expect(host.querySelector('.sim-player-hl .bad')).toBeNull();
    expect(button('Animate scramble').disabled).toBe(false);
    expect({ setup: player.experimentalSetupAlg, alg: player.alg, anchor: player.experimentalSetupAnchor })
      .toEqual({ setup: scramble, alg: spec.alg, anchor: 'end' });
    expect(player.jumpToEnd).toHaveBeenCalledWith({ flash: false });
    expect(player.jumpToStart).not.toHaveBeenCalled();
    expect(player.play).not.toHaveBeenCalled();
  });

  it.each(CASES)('$id inverts only the solution when the setup ends with a line comment', async (spec) => {
    await mount(spec, { deferUrlUpdates: true });
    const setup = `${spec.setup} // keep the separate solution field`;
    await enter('Scramble', setup);
    const puzzle = nativePuzzleKPuzzle(spec.id);
    const solution = puzzle.algToTransformation(spec.alg);
    const combined = puzzle.algToTransformation(spec.setup).applyTransformation(solution);
    setupChanges.mockClear();
    await act(async () => button('Invert').click());
    expect(input('Scramble').value).toBe(setup);
    expect(setupChanges).toHaveBeenCalledExactlyOnceWith(setup);
    const inverse = puzzle.algToTransformation(parseNativePuzzleAlg(spec.id, input('Solution').value));
    expect(inverse.isIdentical(solution.invert())).toBe(true);
    expect(solution.applyTransformation(inverse).isIdentityTransformation()).toBe(true);
    // The independent solution transform must not absorb the scramble or its comment.
    expect(inverse.isIdentical(combined.invert())).toBe(false);
  });

  it('cancels a queued native animation when input becomes invalid before its model is ready', async () => {
    await mount(CASES[0]);
    let ready!: (value: null) => void;
    player.experimentalModel.indexer.get.mockImplementationOnce(() => new Promise(resolve => { ready = resolve; }));
    await act(async () => button('Animate scramble').click());
    expect(player.play).not.toHaveBeenCalled();
    await enter('Solution', '(UFR)1000000000');
    expect(input('Solution').closest('.sim-player-hlwrap')?.querySelector('.bad')).not.toBeNull();
    await act(async () => ready(null));
    expect(player.play).not.toHaveBeenCalled();
  });

  it.each(['Scramble', 'Solution'].flatMap((placeholder) => [0, 1].map((elapsedFrames) => ({ placeholder, elapsedFrames }))))(
    'cancels delayed random-scramble settling when $placeholder becomes invalid after $elapsedFrames frames without a URL echo',
    async ({ placeholder, elapsedFrames }) => {
      const spec = CASES.find(({ id }) => id === 'masterbrilic')!;
      await mount(spec, { playbackMode: 'algorithm', deferUrlUpdates: true });
      vi.spyOn(Math, 'random').mockReturnValue(0.375);
      const scramble = generateNativePuzzleScramble(spec.id, () => 0.375);
      await act(async () => button('Random scramble').click());
      expect(player.experimentalSetupAlg).toBe(scramble);
      expect(frames.size).toBeGreaterThan(0);
      for (let frame = 0; frame < elapsedFrames; frame++) await nextAnimationFrame();
      const prior = { setup: player.experimentalSetupAlg, alg: player.alg, anchor: player.experimentalSetupAnchor };
      const invalid = `${input(placeholder).value} INVALID`;
      await enter(placeholder, invalid);
      expect(input(placeholder).closest('.sim-player-hlwrap')?.querySelector('.bad')).not.toBeNull();
      expect(button('Random scramble').disabled).toBe(placeholder === 'Solution');
      setupChanges.mockClear();
      algChanges.mockClear();
      player.pause.mockClear();
      player.jumpToStart.mockClear();
      player.jumpToEnd.mockClear();
      // The queued callback must be cancelled even though the external setup/alg
      // props still contain their old valid values. No late setter/seek may run.
      await nextAnimationFrame();
      await nextAnimationFrame();
      expect({ setup: player.experimentalSetupAlg, alg: player.alg, anchor: player.experimentalSetupAnchor }).toEqual(prior);
      expect(input(placeholder).value).toBe(invalid);
      expect(setupChanges).not.toHaveBeenCalled();
      expect(algChanges).not.toHaveBeenCalled();
      expect(player.pause).not.toHaveBeenCalled();
      expect(player.jumpToStart).not.toHaveBeenCalled();
      expect(player.jumpToEnd).not.toHaveBeenCalled();
      expect(player.play).not.toHaveBeenCalled();
    },
  );

  it.each([
    { id: 'superz', move: 'R', order: 4 },
    { id: 'superz', move: 'UFR', order: 3 },
    { id: 'dogic', move: 'FREGU', order: 5 },
    { id: 'octahedron4', move: 'DBRRF', order: 4 },
    { id: 'dinoskewb', move: 'DRF', order: 3 },
    { id: 'quadx', move: 'UF', order: 2 },
    { id: 'eto', move: 'FD', order: 2 },
    { id: 'cube3skewb', move: 'F', order: 4 },
    { id: 'cube3skewb', move: 'DRF', order: 3 },
    { id: 'heliskewb', move: 'DRF', order: 3 },
    { id: 'heliskewb', move: 'DF', order: 2 },
    { id: 'comboctahedron', move: 'F', order: 3 },
    { id: 'comboctahedron', move: 'D_BR_R_F', order: 4 },
    { id: 'circoradiolarian', move: 'R', order: 3 },
    { id: 'icosababyface', move: 'FREGU', order: 5 },
    { id: 'radiojewel', move: 'R', order: 3 },
    { id: 'radioweb', move: 'R', order: 3 },
    { id: 'radiojam', move: 'R', order: 3 },
    { id: 'catscradle', move: 'R', order: 3 },
    { id: 'cube2heli', move: 'F', order: 4 },
    { id: 'cube2heli', move: 'DF', order: 2 },
    { id: 'cube3heli', move: 'F', order: 4 },
    { id: 'cube3heli', move: 'DF', order: 2 },
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
