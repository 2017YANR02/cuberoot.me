// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Alg, Move, Pause } from 'cubing/alg';
import { TwistyPlayer } from 'cubing/twisty';
import { uniformSimTimeline } from '@/lib/sim_timing';
import {
  createTwistyPlayback, EMPTY_TWISTY_PLAYBACK_STATE,
  type TwistyPlaybackPlayer, type TwistyPlaybackState,
} from '@/lib/twisty-playback';

const GROUPED_ALG = '(R U2)2 . [F, R]';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function setTimeline(player: TwistyPlayer, alg: string): void {
  player.alg = alg;
  const leaves = [...new Alg(alg).expand().childAlgNodes()]
    .filter((leaf) => leaf instanceof Move || leaf instanceof Pause);
  type NativeTimeline = NonNullable<Awaited<ReturnType<typeof player.experimentalModel.animationTimelineLeavesRequest.get>>>;
  // The shared helper emits millisecond numbers; cubing brands those same values.
  player.experimentalModel.animationTimelineLeavesRequest.set(uniformSimTimeline(leaves) as NativeTimeline);
}

describe('shared playback bar with the real detached Twisty model', () => {
  const cleanup: (() => void)[] = [];

  beforeEach(() => {
    // The real model/indexer stays active; no canvas or browser renderer is needed.
    vi.stubGlobal('requestAnimationFrame', () => 0);
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  afterEach(() => {
    for (const dispose of cleanup.splice(0)) dispose();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function create(alg = GROUPED_ALG, anchor: 'start' | 'end' = 'start') {
    const player = new TwistyPlayer({
      puzzle: '2x2x2', alg, experimentalSetupAlg: 'F',
      experimentalSetupAnchor: anchor,
      visualization: '2D', controlPanel: 'none',
    });
    player.timestamp = 'start';
    setTimeline(player, alg);
    let state: TwistyPlaybackState = EMPTY_TWISTY_PLAYBACK_STATE;
    const changed = vi.fn((next: TwistyPlaybackState) => { state = next; });
    const control = createTwistyPlayback(player, changed);
    cleanup.push(() => { control.dispose(); player.pause(); });
    return { player, control, changed, state: () => state };
  }

  it.each(['start', 'end'] as const)('seeks expanded groups and pauses while preserving the %s anchor', async (anchor) => {
    const { player, control, state } = create(GROUPED_ALG, anchor);
    await vi.waitFor(() => expect(state()).toEqual({ step: 0, total: 9, playing: false, ready: true }));
    const model = player.experimentalModel;
    const kpuzzle = await model.kpuzzle.get();
    const setup = kpuzzle.defaultPattern().applyAlg('F');
    const start = anchor === 'start' ? setup : setup.applyAlg(new Alg(GROUPED_ALG).invert());

    control.seek(1);
    await vi.waitFor(() => expect(state().step).toBe(1));
    expect((await model.detailedTimelineInfo.get()).timestamp).toBe(1000);
    expect((await model.currentPattern.get()).isIdentical(start.applyAlg('R'))).toBe(true);

    control.seek(100);
    await vi.waitFor(() => expect(state().step).toBe(9));
    expect((await model.detailedTimelineInfo.get()).timestamp).toBe(9000);
    const end = anchor === 'end' ? setup : setup.applyAlg(GROUPED_ALG);
    expect((await model.currentPattern.get()).isIdentical(end)).toBe(true);
    control.stepBack(false);
    await vi.waitFor(() => expect(state().step).toBe(8));
    control.seek(-10);
    await vi.waitFor(() => expect(state().step).toBe(0));
    expect((await model.currentPattern.get()).isIdentical(start)).toBe(true);
    expect(await model.setupAnchor.get()).toBe(anchor);
  });

  it('stops an animated step at a Pause boundary using the model TPS, then replays from the end', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const { player, control, state } = create();
    await vi.waitFor(() => expect(state().ready).toBe(true));
    player.tempoScale = 2;
    control.seek(4);
    await vi.waitFor(() => expect(state().step).toBe(4));
    control.stepForward(true);
    await vi.waitFor(() => expect(state().playing).toBe(true));
    const animation = player.controller.animationController;
    await animation.animFrame(450 as Parameters<typeof animation.animFrame>[0]);
    await vi.waitFor(() => expect(state()).toEqual({ step: 5, total: 9, playing: true, ready: true }));
    expect((await player.experimentalModel.detailedTimelineInfo.get()).timestamp).toBe(4900);
    // Native move-only stepping would continue across the Pause into the next
    // move. The adapter caps the real timestamp at this leaf's 5000ms endpoint.
    await animation.animFrame(510 as Parameters<typeof animation.animFrame>[0]);
    await vi.waitFor(() => expect(state().playing).toBe(false));
    expect((await player.experimentalModel.detailedTimelineInfo.get()).timestamp).toBe(5000);
    expect(state().step).toBe(5);

    control.seek(9);
    await vi.waitFor(() => expect(state().step).toBe(9));
    control.togglePlay();
    await vi.waitFor(() => expect(state()).toEqual({ step: 0, total: 9, playing: true, ready: true }));
    control.togglePlay();
    await vi.waitFor(() => expect(state().playing).toBe(false));
  });

  it('drops a queued seek when a new algorithm replaces its indexer', async () => {
    const { player, control, state } = create();
    await vi.waitFor(() => expect(state().ready).toBe(true));
    const oldIndexer = await player.experimentalModel.indexer.get();
    const pending = deferred<typeof oldIndexer>();
    vi.spyOn(player.experimentalModel.indexer, 'get').mockImplementationOnce(() => pending.promise);
    control.seek(9);
    setTimeline(player, 'U');
    await vi.waitFor(() => expect(state()).toEqual({ step: 0, total: 1, playing: false, ready: true }));
    pending.resolve(oldIndexer);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((await player.experimentalModel.detailedTimelineInfo.get()).timestamp).toBe(0);
    expect(state().total).toBe(1);
  });

  it('disposes listeners, pauses playback and ignores late command/state reads', async () => {
    const { player, control, state, changed } = create();
    await vi.waitFor(() => expect(state().ready).toBe(true));
    const indexer = await player.experimentalModel.indexer.get();
    const pending = deferred<typeof indexer>();
    vi.spyOn(player.experimentalModel.indexer, 'get').mockImplementationOnce(() => pending.promise);
    const remove = vi.spyOn(player.experimentalModel.playingInfo, 'removeFreshListener');
    const pause = vi.spyOn(player, 'pause');
    control.seek(7);
    control.dispose();
    const callsAtDisposal = changed.mock.calls.length;
    pending.resolve(indexer);
    const typedPlayer: TwistyPlaybackPlayer = player;
    typedPlayer.timestamp = 2000;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(remove).toHaveBeenCalledOnce();
    expect(pause).toHaveBeenCalledTimes(2);
    expect(changed).toHaveBeenCalledTimes(callsAtDisposal);
    expect((await player.experimentalModel.detailedTimelineInfo.get()).timestamp).toBe(2000);
    expect((await player.experimentalModel.playingInfo.get()).playing).toBe(false);
  });

  it('keeps an empty timeline at zero and ignores non-finite seeks', async () => {
    const { player, control, state } = create('');
    await vi.waitFor(() => expect(state()).toEqual({ step: 0, total: 0, playing: false, ready: true }));
    const play = vi.spyOn(player.controller.animationController, 'play');
    control.seek(500);
    control.stepBack(true);
    control.stepForward(true);
    control.togglePlay();
    control.seek(Number.NaN);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(play).not.toHaveBeenCalled();
    expect((await player.experimentalModel.detailedTimelineInfo.get()).timestamp).toBe(0);
    expect(state()).toEqual({ step: 0, total: 0, playing: false, ready: true });
  });

  it('does not restart an old player when native play preparation resolves after disposal', async () => {
    const { player, control, state } = create();
    await vi.waitFor(() => expect(state().ready).toBe(true));
    const info = await player.experimentalModel.coarseTimelineInfo.get();
    const pending = deferred<typeof info>();
    const get = vi.spyOn(player.experimentalModel.coarseTimelineInfo, 'get')
      .mockImplementation(() => pending.promise);
    control.togglePlay();
    await vi.waitFor(() => expect(get).toHaveBeenCalled());
    control.dispose();
    pending.resolve(info);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((await player.experimentalModel.playingInfo.get()).playing).toBe(false);
  });

  it('preserves a newer seek when an earlier replay resolves its old end-of-timeline snapshot', async () => {
    const { player, control, state } = create();
    await vi.waitFor(() => expect(state().ready).toBe(true));
    control.seek(9);
    await vi.waitFor(() => expect(state().step).toBe(9));
    const info = await player.experimentalModel.coarseTimelineInfo.get();
    expect(info.atEnd).toBe(true);
    const pending = deferred<typeof info>();
    const get = vi.spyOn(player.experimentalModel.coarseTimelineInfo, 'get')
      .mockImplementation(() => pending.promise);
    control.togglePlay();
    await vi.waitFor(() => expect(get).toHaveBeenCalled());
    control.seek(3);
    await vi.waitFor(() => expect(state().step).toBe(3));
    pending.resolve(info);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((await player.experimentalModel.detailedTimelineInfo.get()).timestamp).toBe(3000);
    expect((await player.experimentalModel.playingInfo.get()).playing).toBe(false);
    expect(state().step).toBe(3);
  });
});
