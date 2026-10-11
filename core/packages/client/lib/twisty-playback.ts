import type { TwistyPlayer } from 'cubing/twisty';

type Model = TwistyPlayer['experimentalModel'];
type Indexer = Awaited<ReturnType<Model['indexer']['get']>>;
type Timeline = Awaited<ReturnType<Model['detailedTimelineInfo']['get']>>;
type Playing = Awaited<ReturnType<Model['playingInfo']['get']>>;
type PlayOptions = NonNullable<Parameters<TwistyPlayer['controller']['animationController']['play']>[0]>;

interface Observable<T> {
  get(): Promise<T>;
  addFreshListener(listener: (value: T) => void): void;
  removeFreshListener(listener: (value: T) => void): void;
}

/** Only the public model/controller surface used by the shared /sim bar. */
export interface TwistyPlaybackPlayer {
  readonly experimentalModel: {
    indexer: Observable<Indexer>;
    detailedTimelineInfo: Observable<Timeline>;
    playingInfo: Observable<Playing>;
    coarseTimelineInfo: Pick<Model['coarseTimelineInfo'], 'get'>;
  };
  readonly controller: { animationController: { play(options?: PlayOptions): void } };
  set timestamp(value: number);
  pause(): void;
}

export interface TwistyPlaybackState {
  step: number;
  total: number;
  playing: boolean;
  ready: boolean;
}

export const EMPTY_TWISTY_PLAYBACK_STATE: TwistyPlaybackState = Object.freeze({
  step: 0, total: 0, playing: false, ready: false,
});

// cubing.js exposes the controller but not its BoundaryType enum. These are the
// installed controller's exact wire values; the model retains its own timing.
const MOVE_BOUNDARY = 'move' as PlayOptions['untilBoundary'];
const ENTIRE_TIMELINE = 'entire-timeline' as PlayOptions['untilBoundary'];

function totalSteps(indexer: Indexer): number {
  return Math.max(0, Math.trunc(indexer.numAnimatedLeaves()));
}

function boundary(indexer: Indexer, step: number): number {
  if (step >= totalSteps(indexer)) return indexer.algDuration();
  return indexer.indexToMoveStartTimestamp(step as Parameters<Indexer['indexToMoveStartTimestamp']>[0]);
}

/** First boundary at/after the current timestamp. Unlike timestampToIndex(),
 * this handles exact boundaries in cubing's SimultaneousMoveIndexer correctly.
 * The displayed step advances when its animation starts, as on the engine bar. */
function currentStep(indexer: Indexer, timestamp: number): number {
  let low = 0;
  let high = totalSteps(indexer);
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (boundary(indexer, mid) < timestamp) low = mid + 1;
    else high = mid;
  }
  return low;
}

/** Adapt a live Twisty timeline to PlaybackBar without parsing a second alg.
 * All model reads and commands are invalidated when superseded or disposed.
 * One-step playback also stops at indexed Pause boundaries, which cubing's
 * native move-only boundary controller otherwise skips.
 */
export function createTwistyPlayback(
  player: TwistyPlaybackPlayer,
  onState: (state: TwistyPlaybackState) => void,
) {
  const model = player.experimentalModel;
  let live = true;
  let readRevision = 0;
  let commandRevision = 0;
  let indexer: Indexer | null = null;
  let state = EMPTY_TWISTY_PLAYBACK_STATE;
  let stopAt: { indexer: Indexer; timestamp: number; direction: 1 | -1 } | null = null;

  const publish = (next: TwistyPlaybackState): void => {
    if (!live) return;
    if (next.step !== state.step || next.total !== state.total || next.playing !== state.playing || next.ready !== state.ready) {
      state = next;
      onState(next);
    }
  };
  const read = () => Promise.all([
    model.indexer.get(), model.detailedTimelineInfo.get(), model.playingInfo.get(),
  ]);

  const refresh = (): void => {
    if (!live) return;
    const revision = ++readRevision;
    void read().then(([nextIndexer, timeline, playing]) => {
      if (!live || revision !== readRevision) return;
      if (indexer !== nextIndexer) {
        indexer = nextIndexer;
        commandRevision++;
        stopAt = null;
      }
      let timestamp: number = timeline.timestamp;
      let isPlaying = playing.playing;
      if (stopAt?.indexer === nextIndexer && (
        stopAt.direction === 1 ? timestamp >= stopAt.timestamp : timestamp <= stopAt.timestamp
      )) {
        timestamp = stopAt.timestamp;
        stopAt = null;
        player.pause();
        player.timestamp = timestamp;
        isPlaying = false;
      }
      const total = totalSteps(nextIndexer);
      publish({ step: currentStep(nextIndexer, timestamp), total, playing: total > 0 && isPlaying, ready: true });
    }).catch(() => {
      if (live && revision === readRevision) {
        indexer = null;
        stopAt = null;
        commandRevision++;
        publish(EMPTY_TWISTY_PLAYBACK_STATE);
      }
    });
  };

  model.indexer.addFreshListener(refresh);
  model.detailedTimelineInfo.addFreshListener(refresh);
  model.playingInfo.addFreshListener(refresh);
  onState(state);

  const command = (run: (current: Indexer, timeline: Timeline, playing: Playing) => void): void => {
    if (!live || !state.ready || !indexer) return;
    const expectedIndexer = indexer;
    const revision = ++commandRevision;
    void read().then(([current, timeline, playing]) => {
      if (!live || revision !== commandRevision || expectedIndexer !== current) return;
      run(current, timeline, playing);
    }).catch(() => { /* A newly edited puzzle/alg is not ready for a command. */ });
  };

  const startPlayback = (options: PlayOptions): void => {
    const revision = commandRevision;
    // Position changes belong to the guarded command, never to native play's
    // delayed preparation: a stale atEnd snapshot must not erase a newer seek.
    player.controller.animationController.play({ ...options, autoSkipToOtherEndIfStartingAtBoundary: false });
    // Native play() returns void and sets playing=true only after awaiting this
    // derived prop. Read the same cached preparation after it, so a later seek
    // or disposal can also cancel that delayed start instead of being undone.
    void model.coarseTimelineInfo.get().then(() => {
      if (!live || revision !== commandRevision) player.pause();
    }).catch(() => { /* A replaced invalid model cannot begin playback. */ });
  };

  const seek = (step: number): void => {
    if (!live || !Number.isFinite(step)) return;
    stopAt = null;
    player.pause();
    command((current) => {
      const target = Math.max(0, Math.min(totalSteps(current), Math.round(step)));
      player.timestamp = boundary(current, target);
    });
  };

  const stepBy = (direction: 1 | -1, animate: boolean): void => {
    if (!live) return;
    stopAt = null;
    player.pause();
    command((current, timeline) => {
      const count = totalSteps(current);
      if (!count || (direction === 1 ? timeline.atEnd : timeline.atStart)) return;
      const at = currentStep(current, timeline.timestamp);
      const target = direction === -1 ? at - 1 : at + (boundary(current, at) <= timeline.timestamp ? 1 : 0);
      const timestamp = boundary(current, Math.max(0, Math.min(count, target)));
      if (!animate) { player.timestamp = timestamp; return; }
      stopAt = { indexer: current, timestamp, direction };
      startPlayback({ direction, untilBoundary: MOVE_BOUNDARY });
    });
  };

  return {
    seek,
    stepBack: (animate = true) => stepBy(-1, animate),
    stepForward: (animate = true) => stepBy(1, animate),
    togglePlay: (): void => command((current, timeline, playing) => {
      stopAt = null;
      if (playing.playing) { player.pause(); return; }
      if (!totalSteps(current)) return;
      if (timeline.atEnd) player.timestamp = boundary(current, 0);
      startPlayback({ direction: 1, untilBoundary: ENTIRE_TIMELINE });
    }),
    dispose: (): void => {
      if (!live) return;
      live = false;
      readRevision++;
      commandRevision++;
      stopAt = null;
      model.indexer.removeFreshListener(refresh);
      model.detailedTimelineInfo.removeFreshListener(refresh);
      model.playingInfo.removeFreshListener(refresh);
      player.pause();
    },
  };
}
