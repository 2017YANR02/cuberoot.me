import { mountNxN, mountOtherPuzzle, resolvePuzzle, type Renderer } from './backend.js';
import { parseNxNReplay, replaySteps } from './algorithm.js';
import { STEP_DURATION_MS } from './replay-timing.js';

export { supportedPuzzles } from './backend.js';

export interface PlayerAlgorithm {
  setupAlg?: string;
  alg?: string;
}

export interface PlayerOptions extends PlayerAlgorithm {
  /** A /sim puzzle ID, NxN order, or size such as '4x4x4'. Defaults to order 3. */
  puzzle?: string | number;
  /** NxN order when puzzle is omitted or 'nxn'. */
  order?: number;
  /** PuzzleGeometry description for the 'custom' puzzle. */
  puzzleDescription?: string;
  /** Playback speed relative to the default of 400 ms per step. */
  playbackRate?: number;
  /** Allow the viewer to orbit the cube with a pointer. Defaults to true. */
  interactive?: boolean;
}

export interface PlayerState {
  readonly ready: boolean;
  /** Number of completed steps. An in-progress turn does not count yet. */
  readonly step: number;
  /** Number of expanded turns and explicit pauses. */
  readonly moveCount: number;
  readonly playing: boolean;
  readonly playbackRate: number;
}

export interface Player {
  readonly puzzle: string | number;
  /** Wait for the initial model and sequence to load. NxN loads synchronously. */
  readonly ready: Promise<void>;
  readonly state: PlayerState;
  /** Replace the setup and replay, return to step zero, and pause. */
  setAlgorithm(sequence: PlayerAlgorithm): void;
  /** Resume playback, restart from setup at the end, or queue play while loading. */
  play(): void;
  /** Freeze playback, including any partially animated turn. */
  pause(): void;
  /** Pause and show the exact state after the given number of steps. */
  seek(step: number): void;
  setPlaybackRate(rate: number): void;
  /** Read the last completed NxN state, in URFDLB face order. */
  getFacelets(): string;
  /** Receive the current state immediately and again whenever it changes. */
  subscribe(listener: (state: PlayerState) => void): () => void;
  /** Release rendering resources. May be called more than once. */
  dispose(): void;
}

function validRate(rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) throw new RangeError('Playback rate must be finite and greater than zero');
  return rate;
}

interface Sequence {
  setup: string[];
  steps: string[];
}

function readSequence({ setupAlg = '', alg = '' }: PlayerAlgorithm, parse: Renderer['parse']): Sequence {
  return {
    setup: replaySteps(setupAlg, 'setup algorithm', parse).filter(move => move !== '.'),
    steps: replaySteps(alg, 'replay algorithm', parse),
  };
}

/** Mount a replay onto a browser element with a measurable width and height. */
export function createPlayer(host: HTMLElement, options: PlayerOptions = {}): Player {
  const ownerWindow = host.ownerDocument.defaultView;
  if (!ownerWindow) throw new TypeError('The player host must belong to a browser document');
  const view = ownerWindow;
  const config = resolvePuzzle(options);
  const loading = new view.AbortController();
  const interactive = options.interactive ?? true;
  let renderer: Renderer | undefined;
  let sequence: Sequence = { setup: [], steps: [] };
  let state: PlayerState = Object.freeze({
    ready: false,
    step: 0,
    moveCount: 0,
    playing: false,
    playbackRate: validRate(options.playbackRate ?? 1),
  });
  const listeners = new Set<(state: PlayerState) => void>();
  let frame: number | null = null;
  let lastFrame = 0;
  let elapsed = 0;
  let disposed = false;
  let playOnReady = false;

  function assertMounted(): void {
    if (disposed) throw new Error('The player has been disposed');
  }

  function requireRenderer(): Renderer {
    assertMounted();
    if (!renderer) throw new Error('Wait for player.ready before changing or reading the replay');
    return renderer;
  }

  function publish(next: Partial<PlayerState>): void {
    const snapshot = Object.freeze({ ...state, ...next });
    state = snapshot;
    for (const listener of [...listeners]) {
      if (state !== snapshot || disposed) break;
      if (!listeners.has(listener)) continue;
      try {
        listener(snapshot);
      } catch (error) {
        view.reportError(error);
      }
    }
  }

  function cancelFrame(): void {
    if (frame !== null) view.cancelAnimationFrame(frame);
    frame = null;
  }

  function showStep(current: Renderer, step: number): void {
    if ('timeline' in current) current.timeline.seek(step, 0);
    else current.setup([...sequence.setup, ...sequence.steps.slice(0, step).filter(move => move !== '.')]);
    elapsed = 0;
  }

  function prepare(current: Renderer, next: Sequence): void {
    current.validate?.([...next.setup, ...next.steps.filter(move => move !== '.')]);
    if ('timeline' in current) current.timeline.setSequence(next.setup, next.steps);
    else current.setup(next.setup);
    sequence = next;
    elapsed = 0;
  }

  function scheduleFrame(): void {
    if (!disposed && state.playing && frame === null) frame = view.requestAnimationFrame(tick);
  }

  function tick(timestamp: number): void {
    frame = null;
    if (disposed || !state.playing || !renderer) return;

    const remaining = state.moveCount - state.step;
    const delta = Math.max(0, timestamp - lastFrame) * state.playbackRate;
    elapsed = Math.min(remaining * STEP_DURATION_MS, elapsed + delta);
    lastFrame = timestamp;
    const completed = Math.floor(elapsed / STEP_DURATION_MS);
    const step = state.step + completed;
    const playing = step < state.moveCount;
    const carriedTime = elapsed - completed * STEP_DURATION_MS;

    const progress = carriedTime / STEP_DURATION_MS;
    try {
      if ('timeline' in renderer) {
        renderer.timeline.seek(step, progress);
      } else {
        if (completed === 1) {
          const move = sequence.steps[state.step];
          if (move !== '.') renderer.commit(move);
        } else if (completed > 1) {
          // A background tab can skip several frames. Reconstruct only the final position.
          showStep(renderer, step);
        }
        const nextMove = sequence.steps[step];
        if (playing && nextMove !== '.' && progress > 0) {
          renderer.animate(nextMove, progress * progress * (3 - 2 * progress));
        }
      }
    } catch (error) {
      publish({ playing: false });
      view.reportError(error);
      return;
    }
    elapsed = carriedTime;
    if (completed > 0) publish({ step, playing });
    scheduleFrame();
  }

  function play(): void {
    assertMounted();
    if (!renderer) {
      playOnReady = true;
      return;
    }
    if (state.playing || state.moveCount === 0) return;
    const step = state.step === state.moveCount ? 0 : state.step;
    if (step !== state.step) showStep(renderer, step);
    lastFrame = view.performance.now();
    publish({ step, playing: true });
    scheduleFrame();
  }

  function initialize(current: Renderer, initial?: Sequence): void {
    if (disposed) {
      current.dispose();
      return;
    }
    try {
      prepare(current, initial ?? readSequence(options, current.parse));
    } catch (error) {
      current.dispose();
      throw error;
    }
    renderer = current;
    publish({ ready: true, moveCount: sequence.steps.length });
    if (playOnReady && !disposed) play();
  }

  let ready: Promise<void>;
  if (config.kind === 'nxn') {
    const initial = readSequence(options, input => parseNxNReplay(input, config.order));
    initialize(mountNxN(host, config, interactive), initial);
    ready = Promise.resolve();
  } else {
    ready = mountOtherPuzzle(host, config, interactive, loading.signal).then(current => initialize(current));
    // Caller code can observe failures via `ready`, including after disposal.
    void ready.catch(() => {});
  }

  return {
    puzzle: config.puzzle,
    ready,
    get state() { return state; },
    setAlgorithm(input) {
      const current = requireRenderer();
      prepare(current, readSequence(input, current.parse));
      cancelFrame();
      publish({ step: 0, moveCount: sequence.steps.length, playing: false });
    },
    play,
    pause() {
      assertMounted();
      playOnReady = false;
      if (!state.playing) return;
      cancelFrame();
      publish({ playing: false });
    },
    seek(requestedStep) {
      const current = requireRenderer();
      if (!Number.isFinite(requestedStep)) throw new RangeError('Seek step must be finite');
      const step = Math.min(state.moveCount, Math.max(0, Math.round(requestedStep)));
      if (step !== state.step || elapsed !== 0) showStep(current, step);
      if (step === state.step && !state.playing) return;
      cancelFrame();
      publish({ step, playing: false });
    },
    setPlaybackRate(rate) {
      assertMounted();
      const playbackRate = validRate(rate);
      if (playbackRate !== state.playbackRate) publish({ playbackRate });
    },
    getFacelets() {
      const current = requireRenderer();
      if (!current.getFacelets) throw new TypeError('Facelet strings are available for NxN puzzles');
      return current.getFacelets();
    },
    subscribe(listener) {
      assertMounted();
      // Use a distinct subscription for each call, even for the same callback.
      const subscription = (snapshot: PlayerState) => listener(snapshot);
      listeners.add(subscription);
      try {
        subscription(state);
      } catch (error) {
        listeners.delete(subscription);
        throw error;
      }
      return () => { listeners.delete(subscription); };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      loading.abort();
      cancelFrame();
      listeners.clear();
      state = Object.freeze({ ...state, ready: false, playing: false });
      renderer?.dispose();
      renderer = undefined;
    },
  };
}
