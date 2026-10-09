// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TwistyPlayer } from 'cubing/twisty';
import { NATIVE_PUZZLES, type NativePuzzleId } from '@cuberoot/puzzle-solvers/native-puzzles';
import { attachNativePgMoveAppend } from '@/components/puzzle-models/gestures/nativePgMoveAppend';

const CASES = [
  { id: 'superz', setup: 'R', alg: 'UFR F2', moves: ['DRF', "UBL'"] },
  { id: 'dogic', setup: 'FREGU', alg: "HIERC2 FLACR'", moves: ['2NALPO', "FLACRw'"] },
  { id: 'octahedron4', setup: 'DBRRF', alg: "DFLBL2 DBLBBBR'", moves: ['2DBRRF', "DFLBLw'"] },
  { id: 'dinoskewb', setup: 'DRF', alg: "UFR DBR'", moves: ['2DFL', "DRFw'"] },
] as const;
type Anchor = 'start' | 'end';

describe('native manual turns with a real detached TwistyPlayer model', () => {
  const players: TwistyPlayer[] = [];
  const detach: (() => void)[] = [];

  beforeEach(() => {
    // No player is connected to the document and no renderer is constructed.
    // State promises remain real; only render/animation frame scheduling is idle.
    vi.stubGlobal('requestAnimationFrame', () => 0);
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const release of detach.splice(0)) release();
    for (const player of players.splice(0)) player.pause();
    vi.unstubAllGlobals();
  });

  function createPlayer(id: NativePuzzleId, setup: string, alg: string, anchor: Anchor) {
    const player = new TwistyPlayer({
      experimentalPuzzleDescription: NATIVE_PUZZLES[id].description,
      experimentalSetupAlg: setup, alg, experimentalSetupAnchor: anchor,
      visualization: '2D', controlPanel: 'none',
    });
    players.push(player);
    expect(player.isConnected).toBe(false);
    return player;
  }

  function attach(player: TwistyPlayer, id: NativePuzzleId) {
    const onMove = vi.fn<(move: string, anchoredSetup?: { setup: string }) => string | void>();
    const release = attachNativePgMoveAppend(player.experimentalModel, id, {
      enabled: () => true, current: () => true, onMove,
    });
    detach.push(release);
    return { onMove, release };
  }

  async function finishedPattern(player: TwistyPlayer, timestamp: Anchor) {
    // Complete the catch-up animation without invoking a canvas or a fake state
    // engine. currentPattern itself is the real cubing.js derived model property.
    player.experimentalModel.catchUpMove.set({ move: null, amount: 0 });
    player.timestamp = timestamp;
    return player.experimentalModel.currentPattern.get();
  }

  it.each(CASES.flatMap((spec) => (['start', 'end'] as const).map((anchor) => ({ ...spec, anchor }))))(
    '$id keeps the $anchor anchor, advances the end, preserves the start and reloads the shared state',
    async ({ id, setup, alg, moves, anchor }) => {
      const player = createPlayer(id, `${setup} // setup note`, `${alg} // solution note`, anchor);
      const model = player.experimentalModel;
      const beforeStart = await finishedPattern(player, 'start');
      const beforeEnd = await finishedPattern(player, 'end');
      const { onMove } = attach(player, id);
      const append = vi.spyOn(model, 'experimentalAddMove');
      // The public player method is void. Observe its real model promise solely
      // to await completion; the production append helper performs every mutation.
      const completed = moves.map((move) => {
        player.experimentalAddMove(move);
        return Promise.resolve(append.mock.results.at(-1)!.value);
      });
      expect(await Promise.all(completed)).toEqual([true, true]);
      expect(append).toHaveBeenCalledTimes(2);
      expect(onMove.mock.calls.map(([move]) => move)).toEqual([...moves]);
      expect((await model.catchUpMove.get()).move?.toString()).toBe(moves[1]);
      const afterEnd = await finishedPattern(player, 'end');
      expect(afterEnd.isIdentical(beforeEnd.applyAlg(moves.join(' ')))).toBe(true);
      expect(afterEnd.isIdentical(beforeEnd)).toBe(false);
      expect((await finishedPattern(player, 'start')).isIdentical(beforeStart)).toBe(true);
      expect(await model.setupAnchor.get()).toBe(anchor);

      const puzzle = await model.kpuzzle.get();
      const actualSetup = (await model.setupAlg.get()).alg.toString();
      const actualAlg = (await model.alg.get()).alg.toString();
      expect(puzzle.algToTransformation(actualAlg).isIdentical(puzzle.algToTransformation(`${alg} ${moves.join(' ')}`))).toBe(true);
      const sharedSetup = onMove.mock.calls.at(-1)![1]?.setup;
      if (anchor === 'end') {
        expect(sharedSetup).toBe(actualSetup);
        expect(onMove.mock.calls.every(([, value]) => typeof value?.setup === 'string')).toBe(true);
        expect(puzzle.algToTransformation(actualSetup).isIdentical(puzzle.algToTransformation(`${setup} ${moves.join(' ')}`))).toBe(true);
      } else {
        expect(onMove.mock.calls.every(([, value]) => value === undefined)).toBe(true);
        expect(puzzle.algToTransformation(actualSetup).isIdentical(puzzle.algToTransformation(setup))).toBe(true);
      }
      const reloaded = createPlayer(id, sharedSetup ?? actualSetup, actualAlg, anchor);
      expect((await finishedPattern(reloaded, 'end')).patternData).toEqual(afterEnd.patternData);
      expect((await finishedPattern(reloaded, 'start')).patternData).toEqual(beforeStart.patternData);
    },
  );

  it('rejects an invalid or over-budget append atomically without recording a manual move', async () => {
    const setup = `R // ${'x'.repeat(16_384 - 5)}`;
    const player = createPlayer('superz', setup, 'UFR', 'end');
    const model = player.experimentalModel;
    const before = await finishedPattern(player, 'end');
    const priorSetup = (await model.setupAlg.get()).alg.toString();
    const priorAlg = (await model.alg.get()).alg.toString();
    const { onMove } = attach(player, 'superz');
    for (const move of ['notAMove', 'F']) {
      expect(await model.experimentalAddMove(move)).toBe(false);
      expect((await model.setupAlg.get()).alg.toString()).toBe(priorSetup);
      expect((await model.alg.get()).alg.toString()).toBe(priorAlg);
      expect((await finishedPattern(player, 'end')).isIdentical(before)).toBe(true);
    }
    expect(onMove).not.toHaveBeenCalled();
  });

  it('allows a start-anchored move when the unchanged setup is already at its text budget', async () => {
    const setup = `R // ${'x'.repeat(16_384 - 5)}`;
    const player = createPlayer('superz', setup, 'UFR', 'start');
    const model = player.experimentalModel;
    const before = await finishedPattern(player, 'end');
    const priorSetup = (await model.setupAlg.get()).alg.toString();
    const { onMove } = attach(player, 'superz');
    expect(await model.experimentalAddMove('F')).toBe(true);
    expect((await model.setupAlg.get()).alg.toString()).toBe(priorSetup);
    expect((await finishedPattern(player, 'end')).isIdentical(before.applyMove('F'))).toBe(true);
    expect(onMove).toHaveBeenCalledExactlyOnceWith('F');
  });

  it('keeps queued turns when an editor echo simplifies the already accepted state', async () => {
    const player = createPlayer('superz', 'R', 'UFR UFR', 'end');
    const model = player.experimentalModel;
    const beforeStart = await finishedPattern(player, 'start');
    const beforeEnd = await finishedPattern(player, 'end');
    const { onMove } = attach(player, 'superz');
    const editorTexts = ['', 'F '];
    onMove.mockImplementation((_move, anchoredSetup) => {
      // The first UFR completes a three-turn cycle. The real editor can echo its
      // reduced empty algorithm while the next physical turn is already queued.
      const editorText = editorTexts[onMove.mock.calls.length - 1];
      queueMicrotask(() => {
        player.experimentalSetupAlg = anchoredSetup!.setup;
        player.alg = editorText;
      });
      return editorText;
    });
    const first = model.experimentalAddMove('UFR');
    const second = model.experimentalAddMove('F');
    expect(await Promise.all([first, second])).toEqual([true, true]);
    expect(onMove.mock.calls.map(([move]) => move)).toEqual(['UFR', 'F']);
    expect((await finishedPattern(player, 'end')).isIdentical(beforeEnd.applyAlg('UFR F'))).toBe(true);
    expect((await finishedPattern(player, 'start')).isIdentical(beforeStart)).toBe(true);
    expect((await model.alg.get()).alg.toString()).toBe('F');
  });

  it('keeps the next queued turn when live reduction is off and the editor echoes native UFR2 literally', async () => {
    const player = createPlayer('superz', 'R', '', 'end');
    const model = player.experimentalModel;
    const beforeStart = await finishedPattern(player, 'start');
    const beforeEnd = await finishedPattern(player, 'end');
    const { onMove } = attach(player, 'superz');
    const editorTexts = ['UFR2 ', 'UFR2 F '];
    onMove.mockImplementation((_move, anchoredSetup) => {
      // Native UFR has order three, so its append can normalize UFR2 to UFR'.
      // With liveReduce=false the actual editor retains the user's raw spelling.
      const editorText = editorTexts[onMove.mock.calls.length - 1];
      queueMicrotask(() => {
        player.experimentalSetupAlg = anchoredSetup!.setup;
        player.alg = editorText;
      });
      return editorText;
    });
    const first = model.experimentalAddMove('UFR2');
    const second = model.experimentalAddMove('F');
    expect(await Promise.all([first, second])).toEqual([true, true]);
    expect(onMove.mock.calls.map(([move]) => move)).toEqual(['UFR2', 'F']);
    expect((await finishedPattern(player, 'end')).isIdentical(beforeEnd.applyAlg('UFR2 F'))).toBe(true);
    expect((await finishedPattern(player, 'start')).isIdentical(beforeStart)).toBe(true);
  });

  it('keeps a third queued turn when a batched editor echo preserves the first raw UFR2 spelling', async () => {
    const player = createPlayer('superz', 'R', '', 'end');
    const model = player.experimentalModel;
    const beforeStart = await finishedPattern(player, 'start');
    const beforeEnd = await finishedPattern(player, 'end');
    const { onMove } = attach(player, 'superz');
    const editorTexts = ['UFR2 ', 'UFR2 F ', 'UFR2 F D '];
    onMove.mockImplementation((_move, anchoredSetup) => {
      const index = onMove.mock.calls.length - 1;
      const editorText = editorTexts[index];
      // nuqs/React may batch the first two writes. The helper's second native
      // algorithm starts with UFR', but the actual editor still contains UFR2.
      if (index === 1) queueMicrotask(() => {
        player.experimentalSetupAlg = anchoredSetup!.setup;
        player.alg = editorText;
      });
      return editorText;
    });
    const requests = ['UFR2', 'F', 'D'].map((move) => model.experimentalAddMove(move));
    expect(await Promise.all(requests)).toEqual([true, true, true]);
    expect(onMove.mock.calls.map(([move]) => move)).toEqual(['UFR2', 'F', 'D']);
    expect(onMove.mock.results.map((result) => result.value)).toEqual(editorTexts);
    expect((await finishedPattern(player, 'end')).isIdentical(beforeEnd.applyAlg('UFR2 F D'))).toBe(true);
    expect((await finishedPattern(player, 'start')).isIdentical(beforeStart)).toBe(true);
  });

  it.each(['setupAlg', 'alg'] as const)('preserves a new %s comment and rejects the old move awaiting that field', async (field) => {
    const player = createPlayer('superz', 'R', 'UFR', 'end');
    const model = player.experimentalModel;
    const { onMove } = attach(player, 'superz');
    expect(await model.experimentalAddMove('F')).toBe(true);
    const afterFirst = await finishedPattern(player, 'end');
    const priorSetup = (await model.setupAlg.get()).alg.toString();
    const priorAlg = (await model.alg.get()).alg.toString();
    const source = model[field];
    const snapshot = await source.get();
    let markReading!: () => void;
    let releaseRead!: () => void;
    const reading = new Promise<void>((resolve) => { markReading = resolve; });
    const heldRead = new Promise<typeof snapshot>((resolve) => { releaseRead = () => resolve(snapshot); });
    // Pause only the next real source read. No pattern or transformation is
    // mocked; this creates the same await boundary as an in-flight model update.
    const get = vi.spyOn(source, 'get').mockImplementationOnce(() => {
      markReading();
      return heldRead;
    });
    const pending = model.experimentalAddMove('D');
    await reading;
    const edited = `${snapshot.alg.toString()} // new user note`;
    if (field === 'setupAlg') player.experimentalSetupAlg = edited;
    else player.alg = edited;
    releaseRead();
    expect(await pending).toBe(false);
    get.mockRestore();
    expect((await model.setupAlg.get()).alg.toString()).toBe(field === 'setupAlg' ? edited : priorSetup);
    expect((await model.alg.get()).alg.toString()).toBe(field === 'alg' ? edited : priorAlg);
    expect((await finishedPattern(player, 'end')).isIdentical(afterFirst)).toBe(true);
    expect(onMove.mock.calls.map(([move]) => move)).toEqual(['F']);
  });

  it('does not overwrite a newer editor state when a queued move resolves', async () => {
    const player = createPlayer('superz', 'R', 'UFR', 'end');
    const model = player.experimentalModel;
    const { onMove } = attach(player, 'superz');
    const pending = model.experimentalAddMove('F');
    player.experimentalSetupAlg = 'D';
    player.alg = 'UBL';
    expect(await pending).toBe(false);
    expect((await model.setupAlg.get()).alg.toString()).toBe('D');
    expect((await model.alg.get()).alg.toString()).toBe('UBL');
    expect((await finishedPattern(player, 'end')).isIdentical((await model.kpuzzle.get()).defaultPattern().applyMove('D'))).toBe(true);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('cancels a queued move on detach without modifying either field', async () => {
    const player = createPlayer('superz', 'R', 'UFR', 'end');
    const model = player.experimentalModel;
    const { onMove, release } = attach(player, 'superz');
    const pending = model.experimentalAddMove('F');
    release();
    expect(await pending).toBe(false);
    expect((await model.setupAlg.get()).alg.toString()).toBe('R');
    expect((await model.alg.get()).alg.toString()).toBe('UFR');
    expect(onMove).not.toHaveBeenCalled();
  });
});
