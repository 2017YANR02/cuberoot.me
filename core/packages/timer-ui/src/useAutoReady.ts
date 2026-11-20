/**
 * useAutoReady — observe a bluetooth move stream and call onReady() once when
 * the user signals "I'm ready to start" via one of two gestures:
 *
 *   'still'         The cube has been solved and no move has arrived for
 *                   STILL_THRESHOLD_MS (2000ms).  We don't actually inspect
 *                   solved-state here — the caller is expected to enable the
 *                   hook only while the cube is solved (e.g. status.solved or
 *                   directly after a previous solve).  In practice "no moves
 *                   for 2s" after the user finished resetting works well.
 *
 *   'double-flick'  Legacy stored name for one turn followed by its inverse,
 *                   on any layer (e.g. U U' or R' R). Half turns and rotations
 *                   cannot express the direction of this back-and-forth gesture.
 *
 * onReady is called at most once per hook lifetime (re-arm by toggling
 * `enabled` off→on).  enabled=false unsubscribes immediately.
 */

import { useEffect, useRef } from 'react';
import { createTimerAutoReadyController, type TimerAutoReadyMode } from '@cuberoot/shared/timer/auto-ready';

export interface AutoReadyOpts {
  enabled: boolean;
  mode: TimerAutoReadyMode;
  onReady: () => void;
  /**
   * Called once on subscribe.  Should register `cb` against the upstream
   * bluetooth move broadcast and return an unsubscribe function.
   */
  onMoveSubscriber: (cb: (move: string, ts: number) => void) => () => void;
}

export function useAutoReady(opts: AutoReadyOpts): void {
  const { enabled, mode, onReady, onMoveSubscriber } = opts;

  // Stash the dynamic bits in refs so we don't tear down the subscription
  // every render — we only re-subscribe on enabled / mode changes.
  const onReadyRef = useRef(onReady);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);
  const onMoveSubRef = useRef(onMoveSubscriber);
  useEffect(() => { onMoveSubRef.current = onMoveSubscriber; }, [onMoveSubscriber]);

  useEffect(() => {
    if (!enabled) return;

    const controller = createTimerAutoReadyController(() => onReadyRef.current());
    controller.setMode(mode);
    const unsubscribe = onMoveSubRef.current(controller.move);
    return () => { unsubscribe(); controller.dispose(); };
  }, [enabled, mode]);
}
