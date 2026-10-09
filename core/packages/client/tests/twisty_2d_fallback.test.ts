// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TwistySection from '@/components/TwistySection';
import SimCaptureGroup from '@/components/puzzle-image/SimCaptureGroup';

const probe = vi.hoisted(() => ({
  webglAvailable: vi.fn(() => false),
  construct: vi.fn<(options: Record<string, unknown>) => void>(),
  publicAddMove: vi.fn<(move: string) => void>(),
  modelAddMove: vi.fn<(move: string, options?: unknown) => void>(),
  algWrite: vi.fn<(alg: string) => void>(),
  threeObject: vi.fn().mockResolvedValue(null),
  vantage: vi.fn().mockResolvedValue(null),
  coreOpacity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('three/addons/capabilities/WebGL.js', () => ({
  default: { isWebGL2Available: probe.webglAvailable },
}));

vi.mock('@/hooks/useT', () => ({ useT: () => (_zh: string, en: string) => en }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en' } }) }));
vi.mock('@/components/twistyCoreOpacity', () => ({ applyTwistyCoreOpacity: probe.coreOpacity }));

vi.mock('cubing/twisty', () => ({
  TwistyPlayer: vi.fn(function (options: Record<string, unknown>) {
    probe.construct({ ...options });
    // Keep the real wrapper's player -> model -> onUserMove path. Only the
    // renderer boundary is structural; React effects and cubing Move are real.
    const model = {
      experimentalAddMove: (move: string, opts?: unknown) => probe.modelAddMove(move, opts),
      animationTimelineLeavesRequest: { set: vi.fn() },
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
    let currentAlg = '';
    Object.defineProperty(player, 'alg', {
      get: () => currentAlg,
      set: (value: string) => { currentAlg = value; probe.algWrite(value); },
    });
    Object.assign(player, {
      alg: options.alg,
      experimentalSetupAlg: options.experimentalSetupAlg,
      experimentalModel: model,
      experimentalCurrentThreeJSPuzzleObject: probe.threeObject,
      experimentalCurrentVantage: probe.vantage,
      experimentalAddMove: (move: string) => {
        probe.publicAddMove(move);
        model.experimentalAddMove(move);
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
});
