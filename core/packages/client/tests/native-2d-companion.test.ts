// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Alg, Move } from 'cubing/alg';
import {
  ExperimentalSVGAnimator,
  TwistyPlayer,
  type ExperimentalLeafIndex,
  type ExperimentalMillisecondTimestamp,
} from 'cubing/twisty';
import { NATIVE_PUZZLES, type NativePuzzleId } from '@cuberoot/puzzle-solvers/native-puzzles';
import {
  attachNative2DCompanion,
  type Native2DCompanionFrame,
  type Native2DCompanionPlayer,
} from '@/lib/puzzle-image/native-2d-companion';

const CASES = [
  { id: 'superz', setup: 'R', alg: 'UFR F2', move: 'UFR', facelets: 48 },
  { id: 'dogic', setup: 'FREGU', alg: "HIERC2 FLACR'", move: 'HIERC2', facelets: 80 },
  { id: 'octahedron4', setup: 'DBRRF', alg: "DFLBL2 DBLBBBR'", move: 'DFLBL2', facelets: 32 },
  { id: 'dinoskewb', setup: 'DRF', alg: "UFR DBR'", move: 'UFR', facelets: 72 },
] as const;

type Model = Native2DCompanionPlayer['experimentalModel'];
type Loader = Awaited<ReturnType<Model['puzzleLoader']['get']>>;
type Position = Awaited<ReturnType<Model['legacyPosition']['get']>>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

/** Resolve visible paints instead of comparing animator-specific gradient IDs.
 * Overlapping orientation polygons describe one physical facelet; only the last
 * painted polygon is visible. Stops beyond an opaque 100% stop are invisible. */
function physicalPaints(source: string) {
  const svg = new DOMParser().parseFromString(source, 'image/svg+xml');
  expect(svg.querySelector('parsererror')).toBeNull();
  const gradients = new Map([...svg.querySelectorAll('defs > [id]')].map((node) => [node.id, node]));
  const paints = new Map<string, unknown>();
  for (const polygon of svg.querySelectorAll<SVGPolygonElement>('polygon')) {
    const coordinates = polygon.getAttribute('points')!.trim().split(/[,\s]+/);
    const points = Array.from({ length: coordinates.length / 2 }, (_, index) => (
      coordinates.slice(index * 2, index * 2 + 2).join(',')
    )).sort().join(' ');
    const fill = polygon.style.fill || polygon.getAttribute('fill') || '';
    const gradientId = /^url\((["']?)#([^"')]+)\1\)$/.exec(fill)?.[2];
    if (!gradientId) {
      paints.set(points, fill);
      continue;
    }
    const gradient = gradients.get(gradientId);
    expect(gradient, `gradient for ${polygon.id}`).toBeDefined();
    const stops = [...gradient!.children].map((stop) => ({
      color: stop.getAttribute('stop-color'),
      offset: stop.getAttribute('offset'),
    }));
    for (const stop of stops) expect(stop.color).not.toMatch(/^(undefined|null)?$/);
    paints.set(points, stops.every((stop) => stop.offset === '100%') ? stops[0].color : stops);
  }
  return [...paints].sort(([left], [right]) => left.localeCompare(right));
}

function freshSource<T>(initial: T) {
  let value = initial;
  const listeners = new Set<(next: T) => void>();
  return {
    get: vi.fn(async () => value),
    addFreshListener: vi.fn((listener: (next: T) => void) => {
      listeners.add(listener);
      // The public props can finish an initial async callback after removal.
      queueMicrotask(() => listener(value));
    }),
    removeFreshListener: vi.fn((listener: (next: T) => void) => { listeners.delete(listener); }),
    emit(next: T) {
      value = next;
      for (const listener of listeners) listener(value);
    },
    listeners,
  };
}

describe('native 2D companion uses the public player position', () => {
  const players: TwistyPlayer[] = [];
  const cleanups: (() => void)[] = [];

  beforeEach(() => {
    // Keep native model promises/listeners real without starting a renderer.
    vi.stubGlobal('requestAnimationFrame', () => 0);
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup();
    for (const player of players.splice(0)) player.pause();
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function createPlayer(id: NativePuzzleId, setup = '', alg = '') {
    const player = new TwistyPlayer({
      experimentalPuzzleDescription: NATIVE_PUZZLES[id].description,
      experimentalSetupAlg: setup,
      alg,
      visualization: '2D',
      controlPanel: 'none',
    });
    players.push(player);
    expect(player.isConnected).toBe(false);
    return player;
  }

  async function assets(player: TwistyPlayer) {
    const loader = await player.experimentalModel.puzzleLoader.get();
    const [kpuzzle, svg] = await Promise.all([loader.kpuzzle(), loader.svg()]);
    return { loader, kpuzzle, svg, animator: new ExperimentalSVGAnimator(kpuzzle, svg) };
  }

  function attach(player: Native2DCompanionPlayer, current = () => true, timeoutMs?: number) {
    const frames: Native2DCompanionFrame[] = [];
    const onUpdate = vi.fn((frame: Native2DCompanionFrame) => { frames.push(frame); });
    const cleanup = attachNative2DCompanion(player, { current, onUpdate, timeoutMs });
    cleanups.push(cleanup);
    return { frames, onUpdate, cleanup };
  }

  async function expectPaints(frames: Native2DCompanionFrame[], animator: ExperimentalSVGAnimator, facelets: number) {
    const expected = physicalPaints(animator.svgElement.outerHTML);
    expect(expected).toHaveLength(facelets);
    await vi.waitFor(() => {
      const frame = frames.at(-1);
      expect(frame?.status).toBe('ready');
      if (frame?.status === 'ready') expect(physicalPaints(frame.svg)).toEqual(expected);
    }, { timeout: 3_000, interval: 10 });
  }

  it.each(CASES)('$id follows both setup anchors at the start and end', async ({ id, setup, alg, facelets }) => {
    const player = createPlayer(id, setup, alg);
    const { kpuzzle, animator } = await assets(player);
    const { frames } = attach(player);
    const setupPattern = kpuzzle.defaultPattern().applyAlg(setup);
    for (const anchor of ['start', 'end'] as const) {
      player.experimentalSetupAnchor = anchor;
      player.timestamp = 'start';
      const start = anchor === 'start' ? setupPattern : setupPattern.applyAlg(new Alg(alg).invert());
      expect((await player.experimentalModel.legacyPosition.get()).pattern.isIdentical(start)).toBe(true);
      animator.drawPattern(start);
      await expectPaints(frames, animator, facelets);

      player.timestamp = 'end';
      const end = anchor === 'end' ? setupPattern : setupPattern.applyAlg(alg);
      expect((await player.experimentalModel.legacyPosition.get()).pattern.isIdentical(end)).toBe(true);
      animator.drawPattern(end);
      await expectPaints(frames, animator, facelets);
    }
  });

  it.each(CASES)('$id follows forward timeline fractions and native backwards catch-up', async ({ id, setup, alg, move, facelets }) => {
    const player = createPlayer(id, setup, alg);
    player.experimentalSetupAnchor = 'start';
    const { kpuzzle, animator } = await assets(player);
    const { frames } = attach(player);
    const start = kpuzzle.defaultPattern().applyAlg(setup);
    const indexer = await player.experimentalModel.indexer.get();
    const index = 0 as ExperimentalLeafIndex;
    const fraction = 0.35;
    player.timestamp = (indexer.indexToMoveStartTimestamp(index)
      + indexer.moveDuration(index) * fraction) as ExperimentalMillisecondTimestamp;
    const forward = await player.experimentalModel.legacyPosition.get();
    expect(forward.pattern.isIdentical(start)).toBe(true);
    expect(forward.movesInProgress).toHaveLength(1);
    expect(forward.movesInProgress[0].direction).toBe(1);
    expect(forward.movesInProgress[0].fraction).toBeCloseTo(fraction);
    animator.drawPattern(start, start.applyMove(move), fraction);
    await expectPaints(frames, animator, facelets);

    // This is the real public source used by manual appends. It derives the
    // backwards position; no legacyPosition or currentPattern is replaced.
    player.timestamp = 'end';
    player.experimentalModel.catchUpMove.set({ move: new Move(move), amount: 1 - fraction });
    const backwards = await player.experimentalModel.legacyPosition.get();
    const end = start.applyAlg(alg);
    expect(backwards.pattern.isIdentical(end)).toBe(true);
    expect(backwards.movesInProgress).toHaveLength(1);
    expect(backwards.movesInProgress[0].direction).toBe(-1);
    expect(backwards.movesInProgress[0].fraction).toBeCloseTo(fraction);
    animator.drawPattern(end, end.applyMove(new Move(move).invert()), fraction);
    await expectPaints(frames, animator, facelets);
  });

  async function structuralPlayer(id: NativePuzzleId = 'superz') {
    const player = createPlayer(id);
    const reference = await assets(player);
    const model = {
      visualizationStrategy: freshSource<string>('2D'),
      puzzleLoader: freshSource<Loader>(reference.loader),
      legacyPosition: freshSource<Position>(await player.experimentalModel.legacyPosition.get()),
    };
    return { model, player: { experimentalModel: model }, ...reference };
  }

  it('replaces a deferred old loader with the new puzzle and ignores its late SVG', async () => {
    const old = await structuralPlayer('superz');
    const next = await structuralPlayer('dogic');
    const held = deferred<string>();
    const started = deferred<void>();
    old.model.puzzleLoader.emit({
      kpuzzle: async () => old.kpuzzle,
      svg: () => { started.resolve(); return held.promise; },
    });
    const { frames, onUpdate } = attach(old.player);
    await started.promise;
    old.model.legacyPosition.emit(await next.model.legacyPosition.get());
    old.model.puzzleLoader.emit(next.loader);
    next.animator.drawPattern(next.kpuzzle.defaultPattern());
    await expectPaints(frames, next.animator, 80);
    const accepted = onUpdate.mock.calls.length;
    held.resolve(old.svg);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(onUpdate).toHaveBeenCalledTimes(accepted);
    await expectPaints(frames, next.animator, 80);
  });

  it.each(['dispose', 'stale player'] as const)('does not publish a deferred SVG after %s', async (reason) => {
    const fixture = await structuralPlayer();
    const held = deferred<string>();
    const started = deferred<void>();
    let current = true;
    fixture.model.puzzleLoader.emit({
      kpuzzle: async () => fixture.kpuzzle,
      svg: () => { started.resolve(); return held.promise; },
    });
    const { onUpdate, cleanup } = attach(fixture.player, () => current);
    await started.promise;
    if (reason === 'dispose') cleanup();
    else current = false;
    const accepted = onUpdate.mock.calls.length;
    held.resolve(fixture.svg);
    fixture.model.legacyPosition.emit(await fixture.model.legacyPosition.get());
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(onUpdate).toHaveBeenCalledTimes(accepted);
    cleanup();
    for (const prop of Object.values(fixture.model)) expect(prop.listeners.size).toBe(0);
  });

  it('becomes inactive when visualization changes while SVG loading is pending', async () => {
    const fixture = await structuralPlayer();
    const held = deferred<string>();
    const started = deferred<void>();
    fixture.model.puzzleLoader.emit({
      kpuzzle: async () => fixture.kpuzzle,
      svg: () => { started.resolve(); return held.promise; },
    });
    const { frames } = attach(fixture.player);
    await started.promise;
    fixture.model.visualizationStrategy.emit('PG3D');
    expect(frames.at(-1)).toEqual({ status: 'inactive', svg: null });
    held.resolve(fixture.svg);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(frames.at(-1)).toEqual({ status: 'inactive', svg: null });
  });

  it.each(['failure', 'timeout'] as const)('reports unavailable on SVG %s and stays disposed after a late completion', async (reason) => {
    const fixture = await structuralPlayer();
    const held = deferred<string>();
    const started = deferred<void>();
    fixture.model.puzzleLoader.emit({
      kpuzzle: async () => fixture.kpuzzle,
      svg: () => { started.resolve(); return held.promise; },
    });
    vi.useFakeTimers();
    const { frames, onUpdate, cleanup } = attach(fixture.player, () => true, 25);
    await started.promise;
    if (reason === 'failure') held.reject(new Error('SVG loading failed'));
    await vi.advanceTimersByTimeAsync(reason === 'timeout' ? 26 : 0);
    expect(frames.at(-1)).toEqual({ status: 'unavailable', svg: null });
    cleanup();
    const accepted = onUpdate.mock.calls.length;
    if (reason === 'timeout') held.resolve(fixture.svg);
    await vi.advanceTimersByTimeAsync(0);
    expect(onUpdate).toHaveBeenCalledTimes(accepted);
  });
});
