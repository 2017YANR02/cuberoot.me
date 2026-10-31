// Shared snapshot crossfade for discrete UI changes; rapid changes cancel the old animation.
type ViewTransitionHandle = {
  ready?: Promise<unknown>;
  finished?: Promise<unknown>;
  skipTransition?: () => void;
};

type DocumentWithViewTransition = Document & {
  startViewTransition?: (cb: () => void) => ViewTransitionHandle;
};

let activeTransition: ViewTransitionHandle | null = null;

export function runViewTransition(commit: () => void, animate: boolean) {
  const doc = document as DocumentWithViewTransition;
  const reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (animate && typeof doc.startViewTransition === 'function' && !reducedMotion) {
    activeTransition?.skipTransition?.();
    const transition = doc.startViewTransition(commit);
    activeTransition = transition;
    // skipTransition() 会按规范拒绝 ready；快速扫过选项时这是预期取消，不应冒泡到错误层。
    void transition.ready?.catch(() => undefined);
    const clear = () => {
      if (activeTransition === transition) activeTransition = null;
    };
    void transition.finished?.then(clear, clear);
  } else {
    activeTransition?.skipTransition?.();
    activeTransition = null;
    commit();
  }
}
