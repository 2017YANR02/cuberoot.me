export interface BootDeadline {
  /** Settle once and cancel the spawn-to-READY timer. */
  finish(effect: () => void): boolean;
}

/**
 * Start the daemon boot deadline before spawn(), so synchronous process
 * creation time and asynchronous table loading share one spawn-to-READY budget.
 */
export function createBootDeadline(timeoutMs: number, onTimeout: () => void): BootDeadline {
  let settled = false;
  const timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    onTimeout();
  }, timeoutMs);
  timer.unref();

  return {
    finish(effect) {
      if (settled) return false;
      settled = true;
      clearTimeout(timer);
      effect();
      return true;
    },
  };
}
