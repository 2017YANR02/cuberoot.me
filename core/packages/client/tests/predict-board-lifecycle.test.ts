// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PredictBoard from '@/app/[lang]/predict/_components/PredictBoard';
import type { PredictPuzzle } from '@/app/[lang]/predict/_lib/puzzles';

const mocks = vi.hoisted(() => {
  let finishImport!: () => void;
  const pendingImport = new Promise<void>(resolve => { finishImport = resolve; });
  return {
    pendingImport, finishImport, failSetup: false,
    mount: vi.fn(), dispose: vi.fn(), collect: vi.fn(() => []),
    transparency: vi.fn(), detach: vi.fn(), timing: { frames: 30 },
  };
});
vi.mock('@/components/sim-embed/SimStage', () => ({ afterFirstPaint: async () => {} }));
vi.mock('@/components/sim-embed/mountSimWorld', () => ({ mountSimWorld: mocks.mount }));
vi.mock('@/app/[lang]/sim/Toucher', () => ({ default: class {} }));
vi.mock('@/app/[lang]/sim/engine/viewControls', () => ({ ORBIT_K: 1, orbitSceneFree() {}, resetSceneView() {} }));
vi.mock('@/app/[lang]/sim/engine/tweenTiming', () => ({ timing: mocks.timing }));
vi.mock('@/app/[lang]/sim/engine/coreOpacity', () => ({ applyPuzzleTransparency: mocks.transparency }));
vi.mock('@/components/Spinner/Spinner', () => ({ Spinner: () => null }));
vi.mock('@/i18n/tr', () => ({ tr: ({ en }: { en: string }) => en }));
vi.mock('@/components/sim-embed/orbitTapGesture', () => ({ attachOrbitTap: () => mocks.detach }));
vi.mock('@/app/[lang]/predict/_components/engineSlotMap', async () => {
  await mocks.pendingImport;
  return { collectStickerMeshes: mocks.collect };
});
vi.mock('@/app/[lang]/predict/_components/solidOutline', () => ({ attachStickerFrame: vi.fn() }));
vi.mock('@/app/[lang]/sim/engine/face_hints', () => ({ default: class {} }));
vi.mock('@/app/[lang]/sim/engine/define', () => ({ SIZE: 1 }));

const puzzle = { id: 'ivy', sim: 'ivy', cubeLike: false } as PredictPuzzle;
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mocks.failSetup = false;
  mocks.timing.frames = 30;
  vi.clearAllMocks();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  mocks.mount.mockImplementation(() => ({
    world: {
      cube: {}, scene: { add() {} },
      faceHints: { setCameraOverlay() { if (mocks.failSetup) throw new Error('setup failed'); } },
    },
    renderer: { domElement: document.createElement('canvas') },
    dispose: mocks.dispose, invalidate() {},
  }));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function renderBoard() {
  await act(async () => {
    root.render(React.createElement(PredictBoard, { puzzle, labels: [], onSticker() {} }));
  });
  // The production loader uses dynamic imports; wait for its mock mount, not
  // the painter import intentionally left pending by the first regression.
  await vi.waitFor(() => expect(mocks.mount).toHaveBeenCalledOnce());
}

it('releases the world immediately on exit while painter imports are pending', async () => {
  await renderBoard();
  expect(mocks.collect).not.toHaveBeenCalled();
  act(() => root.render(null));
  expect(mocks.dispose).toHaveBeenCalledOnce();

  await act(async () => {
    mocks.finishImport();
    await mocks.pendingImport;
  });
  expect(mocks.collect).not.toHaveBeenCalled();
  expect(mocks.transparency).not.toHaveBeenCalled();
  expect(mocks.timing.frames).toBe(30);
  expect(mocks.dispose).toHaveBeenCalledOnce();
});

it('releases an acquired world when initialization fails before a painter is ready', async () => {
  mocks.failSetup = true;
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  await renderBoard();
  expect(error).toHaveBeenCalledOnce();
  expect(mocks.dispose).toHaveBeenCalledOnce();
  act(() => root.render(null));
  expect(mocks.dispose).toHaveBeenCalledOnce();
  expect(mocks.timing.frames).toBe(30);
});
