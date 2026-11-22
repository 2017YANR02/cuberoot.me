import { Alg, Move, Pause } from 'cubing/alg';
import { parsePuzzleDescription } from 'cubing/puzzle-geometry';
import type { ExperimentalMillisecondTimestamp, TwistyPlayer, TwistyPlayerConfig } from 'cubing/twisty';
import { parseKpuzzleAlg } from '@cuberoot/puzzle-solvers/native-puzzle-model';
import { toCubingKilominx, type KilominxNotation } from '@cuberoot/shared/kilominx-notation';
import WebGL from 'three/addons/capabilities/WebGL.js';
import { uniformSimTimeline } from '../support/sim-timing';

export interface PgReplayOptions {
  puzzle: string;
  puzzleDescription?: string;
  interactive?: boolean;
  kilominxNotation?: KilominxNotation;
  signal?: AbortSignal;
}

export interface PgReplay {
  parse(input: string): string[];
  timeline: {
    setSequence(setup: readonly string[], moves: readonly string[]): void;
    seek(step: number, fraction: number): void;
  };
  dispose(): void;
}

type Vantage = Awaited<ReturnType<TwistyPlayer['experimentalCurrentVantages']>> extends Iterable<infer T> ? T : never;
type VisualizationWrapper = Element & {
  disconnect?(): void;
  experimentalVantages?(): Iterable<Vantage>;
  removeVantage?(vantage: Vantage): void;
};

const webglSupport = new WeakMap<Window, boolean>();

function supportsWebgl(view: Window): boolean {
  const cached = webglSupport.get(view);
  if (cached !== undefined) return cached;
  const supported = WebGL.isWebGL2Available();
  webglSupport.set(view, supported);
  return supported;
}

function releaseVisualization(player: TwistyPlayer): void {
  // experimentalCurrentVantages reconnects the player first. Inspect the live
  // wrapper instead so teardown never re-registers its intersection observer.
  const wrapper = player.contentWrapper.querySelector('.visualization-wrapper')?.firstElementChild as VisualizationWrapper | undefined;
  if (!wrapper) return;
  const vantages = wrapper.experimentalVantages?.();
  if (vantages) {
    for (const vantage of vantages) {
      wrapper.removeVantage?.(vantage);
      // A pooled renderer is shared across players. Its vantage rejects
      // renderer() rather than returning that renderer.
      void vantage.renderer().then(renderer => {
        renderer.dispose();
        renderer.forceContextLoss();
      }).catch(() => {});
    }
  }
  wrapper.disconnect?.();
}

function loaderConfig(puzzle: string, puzzleDescription: string | undefined): TwistyPlayerConfig {
  // Keep the named loaders' piece orbits and sticker masks. A description
  // equivalent to their visible shape does not preserve those details.
  if (puzzle === 'kilominx' || puzzle === 'baby_fto') return { puzzle };
  const tokens = (puzzleDescription ?? '').trim().split(/\s+/);
  const description = tokens.join(' ');
  const parsed = parsePuzzleDescription(description);
  if (!parsed || parsed.cuts.some((cut, i) =>
    !Number.isFinite(cut.distance) || !Number.isFinite(Number(tokens[2 + i * 2])),
  )) {
    throw new SyntaxError(`Invalid PuzzleGeometry description for ${puzzle}`);
  }
  return { experimentalPuzzleDescription: description };
}

/** Mount the same described or named PG puzzle used in the simulator. */
export async function mountPgReplay(host: HTMLElement, options: PgReplayOptions): Promise<PgReplay> {
  const view = host.ownerDocument.defaultView;
  if (!view) throw new TypeError('The replay host must belong to a browser document');
  const config = loaderConfig(options.puzzle, options.puzzleDescription);
  options.signal?.throwIfAborted();
  const { TwistyPlayer } = await import('cubing/twisty');
  options.signal?.throwIfAborted();
  const visualization = supportsWebgl(view) ? 'PG3D' : '2D';
  const player = new TwistyPlayer({
    ...config,
    visualization,
    experimentalSetupAnchor: 'start',
    experimentalMovePressInput: 'none',
    experimentalDragInput: options.interactive === false ? 'none' : 'auto',
    controlPanel: 'none',
    background: 'none',
    hintFacelets: 'none',
    backView: 'none',
    viewerLink: 'none',
  });
  const model = player.experimentalModel;
  const puzzle = await model.kpuzzle.get();
  options.signal?.throwIfAborted();
  player.experimentalSetFlashLevel('none');
  player.timestamp = 'start';
  player.style.width = '100%';
  player.style.height = '100%';
  const resize = new view.ResizeObserver(([entry]) => {
    if (!entry) return;
    const { width, height } = entry.contentRect;
    if (width > 0) player.style.width = `${width}px`;
    if (height > 0) player.style.height = `${height}px`;
  });
  resize.observe(host);
  try {
    host.appendChild(player);
  } catch (error) {
    resize.disconnect();
    throw error;
  }
  let disposed = false;
  return {
    parse(input) {
      const source = input.replace(/[‘’′]/g, "'");
      const normalized = options.puzzle === 'kilominx'
        ? toCubingKilominx(source, options.kilominxNotation)
        : source;
      return [...parseKpuzzleAlg(puzzle, normalized).experimentalExpand()]
        .flatMap(node => node instanceof Move ? [node.toString()] : node instanceof Pause ? ['.'] : []);
    },
    timeline: {
      setSequence(setup, moves) {
        if (disposed) return;
        const leaves = moves.map(step => step === '.' ? new Pause() : new Move(step));
        player.experimentalSetupAlg = new Alg(setup.filter(step => step !== '.').map(step => new Move(step)));
        player.alg = new Alg(leaves);
        model.animationTimelineLeavesRequest.set(uniformSimTimeline(leaves).map(({ animLeaf, start, end }) => ({
          animLeaf, start: start as ExperimentalMillisecondTimestamp, end: end as ExperimentalMillisecondTimestamp,
        })));
        player.timestamp = 'start';
      },
      seek(step, fraction) {
        if (!disposed) player.timestamp = ((step + fraction) * 1000) as ExperimentalMillisecondTimestamp;
      },
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      resize.disconnect();
      releaseVisualization(player);
      player.remove();
    },
  };
}
