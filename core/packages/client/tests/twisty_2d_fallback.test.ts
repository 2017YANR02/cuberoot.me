// @vitest-environment jsdom

import { act, createElement, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Alg } from 'cubing/alg';
import TwistySection from '@/components/TwistySection';
import SimCaptureGroup from '@/components/puzzle-image/SimCaptureGroup';
import { NATIVE_PUZZLES } from '@cuberoot/puzzle-solvers/native-puzzles';

const probe = vi.hoisted(() => ({
  webglAvailable: vi.fn(() => false),
  construct: vi.fn<(options: Record<string, unknown>) => void>(),
  publicAddMove: vi.fn<(move: string) => void>(),
  modelAddMove: vi.fn<(move: string, options?: unknown) => void>(),
  algWrite: vi.fn<(alg: string) => void>(),
  setupWrite: vi.fn<(alg: string) => void>(),
  timelineWrite: vi.fn(),
  controlPanelWrite: vi.fn<(value: string) => void>(),
  pause: vi.fn(),
  togglePlay: vi.fn(),
  threeObject: vi.fn().mockResolvedValue(null),
  vantage: vi.fn().mockResolvedValue(null),
  coreOpacity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('three/addons/capabilities/WebGL.js', () => ({
  default: { isWebGL2Available: probe.webglAvailable },
}));

vi.mock('@/hooks/useT', () => ({ useT: () => (_zh: string, en: string) => en }));
vi.mock('@/i18n/tr', () => ({ tr: ({ en }: { en: string }) => en }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en' } }) }));
vi.mock('@/components/twistyCoreOpacity', () => ({ applyTwistyCoreOpacity: probe.coreOpacity }));

vi.mock('cubing/twisty', () => ({
  TwistyPlayer: vi.fn(function (options: Record<string, unknown>) {
    probe.construct({ ...options });
    // Keep the real wrapper's player -> model -> onUserMove path. These storage
    // props are structural; native-puzzle-manual-anchor tests use a real model.
    let currentAlg = new Alg();
    let currentSetup = new Alg();
    let currentAnchor = 'start';
    const model = {
      experimentalAddMove: (_move: string, _opts?: unknown): unknown => undefined,
      alg: {
        get: async () => ({ alg: currentAlg }),
        set: (value: string | Alg) => { currentAlg = typeof value === 'string' ? new Alg(value) : value; },
      },
      setupAlg: {
        get: async () => ({ alg: currentSetup }),
        set: (value: string | Alg) => { currentSetup = typeof value === 'string' ? new Alg(value) : value; },
      },
      setupAnchor: {
        get: async () => currentAnchor,
        set: (value: string) => { currentAnchor = value; },
      },
      timestampRequest: { set: vi.fn() },
      catchUpMove: { set: vi.fn() },
      animationTimelineLeavesRequest: { set: probe.timelineWrite },
      twistySceneModel: {
        orbitCoordinates: {
          addFreshListener: vi.fn(),
          removeFreshListener: vi.fn(),
          get: vi.fn().mockResolvedValue({ latitude: 0, longitude: 0, distance: 6 }),
        },
        orbitCoordinatesRequest: { set: vi.fn() },
      },
    };
    const player = document.createElement('div');
    let currentControlPanel = '';
    Object.defineProperty(player, 'alg', {
      get: () => currentAlg.toString(),
      set: (value: string) => { probe.algWrite(value); model.alg.set(value); },
    });
    Object.defineProperty(player, 'experimentalSetupAlg', {
      get: () => currentSetup.toString(),
      set: (value: string) => { probe.setupWrite(value); model.setupAlg.set(value); },
    });
    Object.defineProperty(player, 'experimentalSetupAnchor', {
      get: () => currentAnchor,
      set: (value: string) => model.setupAnchor.set(value),
    });
    Object.defineProperty(player, 'controlPanel', {
      get: () => currentControlPanel,
      set: (value: string) => { currentControlPanel = value; probe.controlPanelWrite(value); },
    });
    Object.assign(player, {
      alg: options.alg,
      experimentalSetupAlg: options.experimentalSetupAlg,
      controlPanel: options.controlPanel,
      pause: probe.pause,
      togglePlay: probe.togglePlay,
      experimentalModel: model,
      experimentalCurrentThreeJSPuzzleObject: probe.threeObject,
      experimentalCurrentVantage: probe.vantage,
      experimentalAddMove: (move: string) => {
        probe.publicAddMove(move);
        probe.modelAddMove(move, undefined);
        return model.experimentalAddMove(move);
      },
    });
    return player;
  }),
}));

describe('TwistySection without WebGL', () => {
  let host: HTMLDivElement;
  let root: Root;
  const onUserMove = vi.fn<(move: string) => void>();

  beforeEach(() => {
    vi.clearAllMocks();
    probe.webglAvailable.mockReturnValue(false);
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function mount() {
    await act(async () => {
      root.render(createElement(TwistySection, {
        puzzle: 'kilominx',
        scramble: 'FR U2',
        alg: 'R',
        twistOnClick: true,
        fallbackMoves: [{ move: 'DL', label: 'DBL' }],
        onUserMove,
        settings: {
          scale: 50, viewAngle: 50, viewGradient: 50, speed: 50,
          hint: false, coreOpacity: 55, dragEmpty: 'view',
        },
      }));
    });
    await act(async () => { await vi.dynamicImportSettled(); });
  }

  it('constructs named Kilominx as 2D immediately and sends fallback face turns through the normal move wrapper', async () => {
    await mount();

    expect(probe.construct).toHaveBeenCalledOnce();
    expect(probe.construct).toHaveBeenCalledWith(expect.objectContaining({
      puzzle: 'kilominx', visualization: '2D', experimentalSetupAlg: 'FR U2', alg: 'R',
    }));
    expect(probe.construct.mock.calls[0][0]).not.toHaveProperty('experimentalPuzzleDescription');
    expect(probe.threeObject).not.toHaveBeenCalled();
    expect(probe.vantage).not.toHaveBeenCalled();
    expect(probe.coreOpacity).not.toHaveBeenCalled();

    const angle = host.querySelector<HTMLSelectElement>('select[aria-label="Turn angle"]');
    const face = [...host.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.trim() === 'DBL');
    expect(angle).not.toBeNull();
    expect(face).toBeDefined();
    expect([...angle!.options].some((option) => option.value === '-2')).toBe(true);

    await act(async () => {
      angle!.value = '-2';
      angle!.dispatchEvent(new Event('change', { bubbles: true }));
    });
    probe.algWrite.mockClear();
    await act(async () => face!.click());

    expect(probe.publicAddMove).toHaveBeenCalledExactlyOnceWith("DL2'");
    expect(probe.modelAddMove).toHaveBeenCalledExactlyOnceWith("DL2'", undefined);
    expect(onUserMove).toHaveBeenCalledExactlyOnceWith("DL2'");
    expect(probe.algWrite).not.toHaveBeenCalled();
  });

  it('retains the 3D renderer and omits fallback controls when WebGL is available', async () => {
    probe.webglAvailable.mockReturnValue(true);
    await mount();

    expect(probe.construct).toHaveBeenCalledOnce();
    const options = probe.construct.mock.calls[0][0];
    expect(options.puzzle).toBe('kilominx');
    expect(options.visualization ?? '3D').toBe('3D');
    expect(options).not.toHaveProperty('experimentalPuzzleDescription');
    expect(host.querySelector('select[aria-label="Turn angle"]')).toBeNull();
    expect([...host.querySelectorAll('button')].some((button) => button.textContent?.trim() === 'DBL')).toBe(false);
    expect(probe.coreOpacity).toHaveBeenCalled();
  });

  it('downloads the native 2D image for both capture buttons without requesting WebGL screenshots or vantages', async () => {
    const download = vi.fn().mockResolvedValue(undefined);
    const screenshot = vi.fn().mockResolvedValue('data:image/png;base64,');
    const vantages = vi.fn().mockResolvedValue([]);
    const player = {
      experimentalModel: { visualizationStrategy: { get: vi.fn().mockResolvedValue('2D') } },
      experimentalDownloadScreenshot: download,
      experimentalScreenshot: screenshot,
      experimentalCurrentVantages: vantages,
    };
    await act(async () => {
      root.render(createElement(SimCaptureGroup, {
        simBridge: {
          getCanvas: () => null,
          getWorld: () => null,
          getRenderer: () => null,
          getTwistyPlayer: () => player,
          setup: 'FR U2',
          alg: 'R',
        },
      }));
    });

    for (const label of ['Snapshot', 'SVG']) {
      const button = [...host.querySelectorAll<HTMLButtonElement>('button')]
        .find((candidate) => candidate.textContent?.trim() === label);
      expect(button).toBeDefined();
      await act(async () => button!.click());
    }

    expect(download).toHaveBeenCalledTimes(2);
    for (const [filename] of download.mock.calls) expect(filename).toMatch(/^sim-\d+$/);
    expect(screenshot).not.toHaveBeenCalled();
    expect(vantages).not.toHaveBeenCalled();
  });

  const addedNativeCases = [
    {
      id: 'lattice', setup: 'DRF', alg: '3DFLw', move: '3DRF', order: 3,
      controls: [{ move: '3DRF', order: 3 }, { move: '3DFLw', order: 3 }],
      invalid: '6DRF', absent: ['6DRF'],
    },
    {
      id: 'hyperx', setup: 'F', alg: 'DRFw', move: '2UFR', order: 3,
      controls: [{ move: 'F', order: 4 }, { move: '2DRF', order: 3 }, { move: 'UFRw', order: 3 }],
      invalid: 'Fw', absent: ['2F', 'Fw', '2D', 'Dw', '2L', 'Lw'],
    },
    {
      id: 'latticex', setup: 'F', alg: '3DRFw', move: '3UFRw', order: 3,
      controls: [{ move: 'F', order: 4 }, { move: '3DRF', order: 3 }, { move: '3UFRw', order: 3 }],
      invalid: 'Fw', absent: ['2F', '3F', 'Fw', '3Fw', '2D', '3D', 'Dw', '3Dw', '2L', '3L', 'Lw', '3Lw'],
    },
    {
      id: 'masterbrilic', setup: 'U', alg: '1-3F', move: '3U', order: 5,
      controls: [{ move: '3U', order: 5 }, { move: '1-2F', order: 5 }, { move: '1-3L', order: 5 }],
      invalid: 'Uw', absent: ['Uw', '3Uw', 'Fw', '3Fw'],
    },
    {
      id: 'masterftov2', setup: 'F', alg: '1-2D', move: '1-2F', order: 3,
      controls: [{ move: '2F', order: 3 }, { move: '1-2D', order: 3 }],
      invalid: 'Fw', absent: ['Fw', 'Dw'],
    },
  ] as const;

  const nativeCases = [
    { id: 'superz', setup: 'R', alg: 'UFR', move: 'UFR', order: 3 },
    { id: 'dogic', setup: 'FREGU', alg: 'HIERCw', move: '2FLACR', order: 5 },
    { id: 'octahedron4', setup: 'DBRRF', alg: 'DFLBLw', move: '2DBLBBBR', order: 4 },
    { id: 'dinoskewb', setup: 'DRF', alg: 'UFRw', move: '2DFL', order: 3 },
    ...addedNativeCases,
  ] as const;

  async function mountNative(spec: typeof nativeCases[number], options: {
    scramble?: string; alg?: string; hideControls?: boolean; pointerTurns?: boolean;
    externalControls?: boolean;
    fillPane?: boolean;
    onPlayerChange?: ComponentProps<typeof TwistySection>['onPlayerChange'];
  } = {}) {
    await act(async () => root.render(createElement(TwistySection, {
      puzzle: spec.id,
      puzzleDescription: NATIVE_PUZZLES[spec.id].description,
      nativePuzzleId: spec.id,
      scramble: options.scramble ?? spec.setup,
      alg: options.alg ?? spec.alg,
      hideControls: options.hideControls,
      externalControls: options.externalControls,
      fillPane: options.fillPane,
      onPlayerChange: options.onPlayerChange,
      twistOnClick: true,
      onUserMove,
      settings: {
        scale: 50, viewAngle: 50, viewGradient: 50, speed: 50,
        hint: false, coreOpacity: 55, dragEmpty: 'view', pointerTurns: options.pointerTurns,
      },
    })));
    await act(async () => { await vi.dynamicImportSettled(); });
  }

  it.each(nativeCases)('$id constructs directly in 2D and sends a selected native move/angle through the public wrapper once', async (spec) => {
    await mountNative(spec);
    expect(probe.construct).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      experimentalPuzzleDescription: NATIVE_PUZZLES[spec.id].description,
      visualization: '2D', experimentalSetupAlg: spec.setup, alg: spec.alg,
    }));
    expect(probe.construct.mock.calls[0][0]).not.toHaveProperty('puzzle');
    expect(probe.threeObject).not.toHaveBeenCalled();
    expect(probe.vantage).not.toHaveBeenCalled();
    expect(probe.coreOpacity).not.toHaveBeenCalled();
    expect(host.querySelector('[role="status"]')?.textContent).toContain('2D net');
    expect(host.querySelector('select[aria-label="Drag layer"]')).toBeNull();
    const move = host.querySelector<HTMLSelectElement>('select[aria-label="Move notation"]')!;
    const angle = host.querySelector<HTMLSelectElement>('select[aria-label="Turn angle"]')!;
    await act(async () => {
      move.value = spec.move;
      move.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(angle.options[0].textContent).toBe(`${360 / spec.order}°`);
    await act(async () => {
      angle.value = '-2';
      angle.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const turn = host.querySelector<HTMLButtonElement>('.twisty-native-controls .twisty-fallback-move')!;
    expect(turn.textContent).toBe(`Turn ${spec.move}2'`);
    probe.algWrite.mockClear();
    probe.setupWrite.mockClear();
    await act(async () => turn.click());
    expect(probe.publicAddMove).toHaveBeenCalledExactlyOnceWith(`${spec.move}2'`);
    expect(probe.modelAddMove).toHaveBeenCalledExactlyOnceWith(`${spec.move}2'`, undefined);
    expect(onUserMove).toHaveBeenCalledExactlyOnceWith(`${spec.move}2'`);
    expect(probe.algWrite).not.toHaveBeenCalled();
    expect(probe.setupWrite).not.toHaveBeenCalled();
  });

  it.each(nativeCases)('$id quarantines invalid updates from setters/timeline and retains its last valid player state', async (spec) => {
    await mountNative(spec);
    const player = host.querySelector('.twisty-container')!.firstElementChild as HTMLElement & {
      alg: string; experimentalSetupAlg: string; controlPanel: string;
    };
    expect(player.controlPanel).toBe('bottom-row');
    expect(probe.timelineWrite).toHaveBeenCalled();
    const prior = { setup: player.experimentalSetupAlg, alg: player.alg };
    probe.algWrite.mockClear();
    probe.setupWrite.mockClear();
    probe.timelineWrite.mockClear();
    for (const options of [
      { scramble: 'notAMove', alg: spec.alg },
      { scramble: spec.setup, alg: `(${spec.alg})1000000000` },
      ...('invalid' in spec ? [{ scramble: spec.setup, alg: `${spec.alg} ${spec.invalid}` }] : []),
    ]) {
      await mountNative(spec, options);
      expect(probe.construct).toHaveBeenCalledOnce();
      expect(probe.algWrite).not.toHaveBeenCalled();
      expect(probe.setupWrite).not.toHaveBeenCalled();
      expect(probe.timelineWrite).not.toHaveBeenCalled();
      expect({ setup: player.experimentalSetupAlg, alg: player.alg }).toEqual(prior);
      expect(player.controlPanel).toBe('none');
      expect(probe.pause).toHaveBeenCalled();
      expect(host.querySelector('[role="alert"]')).not.toBeNull();
      const turn = host.querySelector<HTMLButtonElement>('.twisty-native-controls .twisty-fallback-move')!;
      expect(turn.disabled).toBe(true);
      await act(async () => turn.click());
      expect(probe.publicAddMove).not.toHaveBeenCalled();
      expect(probe.modelAddMove).not.toHaveBeenCalled();
      expect(onUserMove).not.toHaveBeenCalled();
    }
    await mountNative(spec, { scramble: `${spec.setup}'`, alg: `${spec.alg}'` });
    expect(probe.construct).toHaveBeenCalledOnce();
    expect(probe.setupWrite).toHaveBeenLastCalledWith(`${spec.setup}'`);
    expect(probe.algWrite).toHaveBeenLastCalledWith(`${spec.alg}'`);
    expect(probe.timelineWrite).toHaveBeenCalledOnce();
    expect(player.controlPanel).toBe('bottom-row');
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.querySelector<HTMLButtonElement>('.twisty-native-controls .twisty-fallback-move')!.disabled).toBe(false);
  });

  it.each([false, true])('keeps external playback exclusive through invalid input and recovery (hideControls=%s)', async (hideControls) => {
    const spec = nativeCases[0];
    host.style.colorScheme = 'dark';
    await mountNative(spec, { externalControls: true, hideControls });
    const player = host.querySelector('.twisty-container')!.firstElementChild as HTMLElement & {
      controlPanel: string;
    };
    expect(probe.construct).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      controlPanel: 'none', background: 'none',
    }));
    expect(player.controlPanel).toBe('none');
    expect(player.style.colorScheme).toBe('');
    expect(host.querySelector('.recon-play-overlay')).toBeNull();

    await mountNative(spec, { externalControls: true, hideControls, alg: 'notAMove' });
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(player.controlPanel).toBe('none');
    expect(host.querySelector('.recon-play-overlay')).toBeNull();

    await mountNative(spec, { externalControls: true, hideControls, alg: `${spec.alg}'` });
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(probe.construct).toHaveBeenCalledOnce();
    expect(player.controlPanel).toBe('none');
    expect(host.querySelector('.recon-play-overlay')).toBeNull();
    expect(probe.togglePlay).not.toHaveBeenCalled();
  });

  it.each([false, true])('publishes attached replacements and clears them on unmount (fillPane=%s)', async (fillPane) => {
    const observer = { observe: vi.fn(), disconnect: vi.fn() };
    vi.stubGlobal('ResizeObserver', vi.fn(function () { return observer; }));
    const onPlayerChange = vi.fn<NonNullable<ComponentProps<typeof TwistySection>['onPlayerChange']>>((player) => {
      if (player) expect(host.querySelector('.twisty-container')!.firstElementChild).toBe(player);
    });
    const options = { externalControls: true, onPlayerChange, fillPane };
    await mountNative(nativeCases[0], options);
    const firstPlayer = host.querySelector('.twisty-container')!.firstElementChild!;
    expect(onPlayerChange.mock.calls).toEqual([[firstPlayer]]);

    await mountNative(nativeCases[0], { ...options, alg: `${nativeCases[0].alg}'` });
    expect(onPlayerChange.mock.calls).toEqual([[firstPlayer]]);

    await mountNative(nativeCases[1], options);
    const secondPlayer = host.querySelector('.twisty-container')!.firstElementChild!;
    expect(secondPlayer).not.toBe(firstPlayer);
    expect(firstPlayer.isConnected).toBe(false);
    expect(onPlayerChange.mock.calls).toEqual([[firstPlayer], [null], [secondPlayer]]);
    expect(probe.construct).toHaveBeenCalledTimes(2);

    await act(async () => root.render(null));
    expect(onPlayerChange.mock.calls).toEqual([[firstPlayer], [null], [secondPlayer], [null]]);
    expect(secondPlayer.isConnected).toBe(false);
    expect(observer.disconnect).toHaveBeenCalledTimes(fillPane ? 2 : 0);
  });

  it.each(addedNativeCases)('$id exposes its supported layer notation and sends each selected inverse through the actual controls', async (spec) => {
    await mountNative(spec);
    const move = host.querySelector<HTMLSelectElement>('select[aria-label="Move notation"]')!;
    const angle = host.querySelector<HTMLSelectElement>('select[aria-label="Turn angle"]')!;
    const available = [...move.options].map(({ value }) => value);
    for (const absent of spec.absent) expect(available).not.toContain(absent);
    // These spellings are independent fixtures, so the public move catalog and
    // the component cannot agree on an incorrect third-layer or range spelling.
    probe.algWrite.mockClear();
    probe.setupWrite.mockClear();
    for (const expected of spec.controls) {
      expect(available).toContain(expected.move);
      await act(async () => {
        move.value = expected.move;
        move.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(angle.options[0].textContent).toBe(`${360 / expected.order}°`);
      await act(async () => {
        angle.value = '-1';
        angle.dispatchEvent(new Event('change', { bubbles: true }));
      });
      const turn = host.querySelector<HTMLButtonElement>('.twisty-native-controls .twisty-fallback-move')!;
      expect(turn.textContent).toBe(`Turn ${expected.move}'`);
      await act(async () => turn.click());
    }
    const expectedMoves = spec.controls.map(({ move: notation }) => `${notation}'`);
    expect(probe.publicAddMove.mock.calls.map(([notation]) => notation)).toEqual(expectedMoves);
    expect(probe.modelAddMove.mock.calls.map(([notation]) => notation)).toEqual(expectedMoves);
    expect(onUserMove.mock.calls.map(([notation]) => notation)).toEqual(expectedMoves);
    expect(probe.algWrite).not.toHaveBeenCalled();
    expect(probe.setupWrite).not.toHaveBeenCalled();
  });

  it.each(nativeCases)('$id keeps oversized initial input out of constructor options and overlay playback, then recovers', async (spec) => {
    await mountNative(spec, { alg: `(${spec.alg})1000000000`, hideControls: true });
    expect(probe.construct).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      experimentalSetupAlg: '', alg: '', visualization: '2D', controlPanel: 'none',
    }));
    expect(probe.algWrite.mock.calls.every(([alg]) => alg === '')).toBe(true);
    expect(probe.setupWrite.mock.calls.every(([alg]) => alg === '')).toBe(true);
    expect(probe.timelineWrite).not.toHaveBeenCalled();
    expect(host.querySelector('.recon-play-overlay')).toBeNull();
    expect(probe.togglePlay).not.toHaveBeenCalled();
    await mountNative(spec, { hideControls: true });
    expect(probe.construct).toHaveBeenCalledOnce();
    expect(probe.algWrite).toHaveBeenLastCalledWith(spec.alg);
    expect(probe.setupWrite).toHaveBeenLastCalledWith(spec.setup);
    expect(probe.timelineWrite).toHaveBeenCalledOnce();
    const play = host.querySelector<HTMLButtonElement>('.recon-play-overlay button')!;
    expect(play).not.toBeNull();
    await act(async () => play.click());
    expect(probe.togglePlay).toHaveBeenCalledOnce();
  });
});
