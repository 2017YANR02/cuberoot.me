import type { Move } from 'cubing/alg';
import type { KPattern, KPuzzle } from 'cubing/kpuzzle';

interface FreshProp<T> {
  get(): Promise<T>;
  addFreshListener(listener: (value: T) => void): void;
  removeFreshListener(listener: (value: T) => void): void;
}

interface Native2DLoader {
  kpuzzle(): Promise<KPuzzle>;
  svg(): Promise<string>;
}

interface Native2DPosition {
  pattern: KPattern;
  movesInProgress: readonly { move: Move; direction: number; fraction: number }[];
}

/** Public model properties used by cubing.js's own Twisty2DPuzzle. */
export interface Native2DCompanionPlayer {
  experimentalModel: {
    visualizationStrategy: FreshProp<string>;
    puzzleLoader: FreshProp<Native2DLoader>;
    legacyPosition: FreshProp<Native2DPosition>;
  };
}

export type Native2DCompanionFrame =
  | { status: 'inactive' | 'pending' | 'unavailable'; svg: null }
  | { status: 'ready'; svg: string };

/** Mirror the native 2D timeline without a WebGL scene or private shadow DOM.
 * The host restricts this adapter to the four independent native PG puzzles. */
export function attachNative2DCompanion(
  player: Native2DCompanionPlayer,
  options: {
    current: () => boolean;
    onUpdate: (frame: Native2DCompanionFrame) => void;
    timeoutMs?: number;
  },
): () => void {
  const model = player.experimentalModel;
  let disposed = false;
  let generation = 0;
  let positionRevision = 0;
  let strategy: string | null = null;
  let loader: Native2DLoader | null = null;
  let position: Native2DPosition | null = null;
  let kpuzzle: KPuzzle | null = null;
  let animator: InstanceType<typeof import('cubing/twisty').ExperimentalSVGAnimator> | null = null;
  let pendingTimer: ReturnType<typeof setTimeout> | undefined;
  const subscriptions: (() => void)[] = [];
  const live = () => !disposed && options.current();
  const clearPendingTimer = () => {
    if (pendingTimer !== undefined) clearTimeout(pendingTimer);
    pendingTimer = undefined;
  };
  const publish = (frame: Native2DCompanionFrame) => {
    if (!live()) return;
    if (frame.status !== 'pending') clearPendingTimer();
    options.onUpdate(frame);
  };
  const pending = () => {
    clearPendingTimer();
    publish({ status: 'pending', svg: null });
    pendingTimer = setTimeout(() => {
      publish({ status: 'unavailable', svg: null });
    }, options.timeoutMs ?? 10_000);
  };

  const renderPosition = async () => {
    const ownRevision = ++positionRevision;
    const ownGeneration = generation;
    const sourceLoader = loader;
    const sourcePosition = position;
    const sourceAnimator = animator;
    if (strategy !== '2D' || !sourceLoader || !sourcePosition || !sourceAnimator
      || sourcePosition.pattern.kpuzzle !== kpuzzle) return;
    try {
      // Fresh listeners are asynchronous. A loader/strategy setter may already
      // have invalidated their last notification while the SVG was loading.
      const [currentLoader, currentStrategy] = await Promise.all([
        model.puzzleLoader.get(), model.visualizationStrategy.get(),
      ]);
      if (!live() || ownGeneration !== generation || ownRevision !== positionRevision
        || currentLoader !== sourceLoader || currentStrategy !== '2D') return;
      const activeMove = sourcePosition.movesInProgress[0];
      if (activeMove) {
        if (!Number.isFinite(activeMove.fraction)) throw new Error('Invalid native 2D position');
        // This is Twisty2DPuzzle.onPositionChange's native transition: its
        // backwards catch-up frame starts at the accepted end pattern.
        const move = activeMove.direction === -1 ? activeMove.move.invert() : activeMove.move;
        sourceAnimator.draw(
          sourcePosition.pattern,
          sourcePosition.pattern.applyMove(move),
          activeMove.fraction,
        );
      } else {
        sourceAnimator.draw(sourcePosition.pattern);
      }
      publish({ status: 'ready', svg: new XMLSerializer().serializeToString(sourceAnimator.svgElement) });
    } catch {
      if (ownGeneration === generation && ownRevision === positionRevision) {
        publish({ status: 'unavailable', svg: null });
      }
    }
  };

  const configure = () => {
    const ownGeneration = ++generation;
    animator = null;
    kpuzzle = null;
    if (!live()) return;
    if (strategy !== '2D') {
      publish({ status: 'inactive', svg: null });
      return;
    }
    pending();
    const sourceLoader = loader;
    if (!sourceLoader) return;
    void (async () => {
      try {
        const [{ ExperimentalSVGAnimator }, sourcePuzzle, svg] = await Promise.all([
          import('cubing/twisty'), sourceLoader.kpuzzle(), sourceLoader.svg(),
        ]);
        if (!live() || ownGeneration !== generation || sourceLoader !== loader) return;
        kpuzzle = sourcePuzzle;
        animator = new ExperimentalSVGAnimator(sourcePuzzle, svg);
        await renderPosition();
      } catch {
        if (ownGeneration === generation) publish({ status: 'unavailable', svg: null });
      }
    })();
  };
  const onStrategy = (next: string) => {
    if (!live() || strategy === next) return;
    strategy = next;
    configure();
  };
  const onLoader = (next: Native2DLoader) => {
    if (!live() || loader === next) return;
    loader = next;
    configure();
  };
  const onPosition = (next: Native2DPosition) => {
    if (!live()) return;
    position = next;
    void renderPosition();
  };
  const subscribe = <T>(prop: FreshProp<T>, listener: (value: T) => void) => {
    prop.addFreshListener(listener);
    subscriptions.push(() => prop.removeFreshListener(listener));
  };

  pending();
  void (async () => {
    try {
      // Read first so rejected/missing model properties become an explicit
      // unavailable state, rather than an unhandled initial listener rejection.
      const initial = await Promise.all([
        model.visualizationStrategy.get(), model.puzzleLoader.get(), model.legacyPosition.get(),
      ]);
      if (!live()) return;
      [strategy, loader, position] = initial;
      configure();
      subscribe(model.visualizationStrategy, onStrategy);
      subscribe(model.puzzleLoader, onLoader);
      subscribe(model.legacyPosition, onPosition);
    } catch {
      publish({ status: 'unavailable', svg: null });
    }
  })();

  return () => {
    disposed = true;
    generation++;
    clearPendingTimer();
    for (const unsubscribe of subscriptions) unsubscribe();
    animator = null;
  };
}
