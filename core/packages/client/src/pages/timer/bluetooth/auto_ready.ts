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
 *   'double-flick'  The last 4 moves (in order) match `U U' U U'`.  Any
 *                   quarter-turn / inverse pair pattern is accepted only on
 *                   U / U'; other faces don't count.  We require the moves to
 *                   be exact face notation (U, U', U2 doesn't qualify).
 *
 * onReady is called at most once per hook lifetime (re-arm by toggling
 * `enabled` off→on).  enabled=false unsubscribes immediately.
 */

import { useEffect, useRef } from 'react';

const STILL_THRESHOLD_MS = 2000;
const DOUBLE_FLICK_PATTERN = ["U", "U'", "U", "U'"] as const;

export interface AutoReadyOpts {
  enabled: boolean;
  mode: 'still' | 'double-flick';
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

    let firedOnce = false;
    const fire = () => {
      if (firedOnce) return;
      firedOnce = true;
      try {
        onReadyRef.current();
      } catch (err) {
        console.error('[auto-ready] onReady threw', err);
      }
    };

    if (mode === 'still') {
      let timer: number | null = null;
      // Don't arm until the user has actually touched the cube — otherwise a
      // user who just connected and never moved could be auto-readied without
      // any signal of intent.
      let hasSeenMove = false;
      const armTimer = () => {
        if (!hasSeenMove) return;
        if (timer !== null) window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          timer = null;
          fire();
        }, STILL_THRESHOLD_MS);
      };
      const cb = (_move: string, _ts: number) => {
        if (firedOnce) return;
        hasSeenMove = true;
        armTimer();
      };
      const unsub = onMoveSubRef.current(cb);
      return () => {
        unsub();
        if (timer !== null) window.clearTimeout(timer);
      };
    }

    // double-flick mode: keep a rolling buffer of the last 4 moves.
    const buf: string[] = [];
    const cb = (move: string, _ts: number) => {
      if (firedOnce) return;
      buf.push(move);
      if (buf.length > DOUBLE_FLICK_PATTERN.length) buf.shift();
      if (buf.length === DOUBLE_FLICK_PATTERN.length) {
        let match = true;
        for (let i = 0; i < DOUBLE_FLICK_PATTERN.length; i++) {
          if (buf[i] !== DOUBLE_FLICK_PATTERN[i]) { match = false; break; }
        }
        if (match) fire();
      }
    };
    const unsub = onMoveSubRef.current(cb);
    return () => { unsub(); };
  }, [enabled, mode]);
}
