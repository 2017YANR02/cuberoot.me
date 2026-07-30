'use client';

/**
 * Drilling an alg set with a real cube in your hands.
 *
 * The loop, and why each piece is where it is:
 *
 *   1. A case comes up. `hijackTo` makes the cube REPORT that case, so the user
 *      does not have to apply a scramble by hand — which is the difference
 *      between drilling PLL and administering PLL. The cube itself is left
 *      wherever the previous rep put it and never needs resetting.
 *   2. The first turn starts the clock. No space bar, no inspection: with a
 *      smart cube, "started" is not something the user should have to declare.
 *   3. The set's own finish line stops it (`smartcube.ts`), so an OLL drill ends
 *      when the last layer is oriented rather than making the user finish the
 *      cube.
 *   4. The store's `stopTimer` already draws the next case, which loops back to
 *      (1) — so the whole thing runs hands-free until the user stops.
 *
 * Two deliberate non-features:
 *
 *   - No "ready" state. csTimer's `giiMode='at'` auto-arms 500 ms after a new
 *     scramble because its timer needs arming. Ours doesn't, and skipping it
 *     leaves the previous rep's time on screen until the user actually starts
 *     the next one — which is what you want when you are reading your own times.
 *   - Nothing is written to the /timer session. The trainer's own solve list is
 *     the training log, and a drill has no business appearing among WCA solves.
 *     That is csTimer's "training reps are not results" requirement, met by
 *     living in a different store rather than by suppressing a write.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AlgCase, AlgPuzzle } from '@cuberoot/shared';

import { useBluetoothCube, type BluetoothCubeHandle } from '../../timer/_lib/bluetooth';
import { installFakeCube } from '../../timer/_lib/bluetooth/fake_cube';
import type { CubeStep } from '../../timer/_lib/cube/steps';
import { TimerState, useTrainerStore } from '@/lib/trainer-store';
import { autoStopStep, caseTargetFacelets, puzzleHasSmartCube } from './smartcube';

export type TrainerCubeReason =
  | 'off' | 'unsupported-puzzle' | 'disconnected'
  | 'no-case' | 'unreadable-case' | 'not-aimed'
  | 'settling' | 'ready' | 'running';

export interface TrainerCubeState {
  cube: BluetoothCubeHandle;
  /** True while the cube is presenting the current case and driving the clock. */
  armed: boolean;
  /**
   * What will stop the clock, or null when nothing will and the user has to.
   * Worth surfacing in the UI: "it stops when OLL is done" is not guessable.
   */
  stopStep: CubeStep | null;
  /** Where the loop stands, for one line of status text. */
  reason: TrainerCubeReason;
  /** Prompt the picker. Rejects with a descriptive Error off Web Bluetooth. */
  connect(): Promise<void>;
  /**
   * Set while `connect()` is blocked waiting for a MAC address the browser
   * wouldn't hand over. Owned here rather than by the view because it is the
   * cube's business and it has to resolve a promise the driver is awaiting; a
   * connect left hanging on it decodes nothing and looks like a dead cube.
   */
  macPrompt: { deviceName: string; isWrongKey?: boolean } | null;
  submitMac(mac: string): void;
  cancelMac(): void;
}

export interface UseTrainerCubeOpts {
  /** User switch. False leaves the connection alone but stops driving the drill. */
  enabled: boolean;
  /**
   * Is the trainer timing? Separate from `enabled` because handing the user each
   * case on the cube is worth having on its own — with the clock off, finishing a
   * case simply draws the next one, and nothing is recorded.
   */
  timing: boolean;
  puzzle: AlgPuzzle | null;
  /** Session set slug — a single set, or `mix:a+b` for a combined drill. */
  sessionSet: string | null;
  /** The case on screen, for its `srcSet` in a mixed drill. */
  currentCase: AlgCase | null;
  /** The scramble on screen. This is what the cube is made to report. */
  currentScramble: string | null;
  /** Identity of the case on screen — a re-draw of the SAME case must re-aim. */
  currentKey: string | null;
}

/** Epoch ms for a `performance.now()` reading, so device times can reach the store. */
function toEpochMs(perfMs: number): number {
  return performance.timeOrigin + perfMs;
}

/**
 * How long the cube has to be still before a turn counts as starting the next
 * rep instead of finishing the last one.
 *
 * This window is not decoration, it is what makes sub-step drills work at all.
 * An OLL rep ends the moment the last layer is oriented — and the user is
 * mid-alg at that moment, with two or three turns still to come. Without a
 * window those turns land on the case that was just drawn, so the cube reports
 * something that is not the case on screen, and the alg the user then executes
 * can never finish it: the drill jams on rep two and stays jammed. Turns inside
 * the window re-aim instead of counting, which throws them away.
 *
 * 500 ms is csTimer's number for the same problem (`giiMode='at'` waits exactly
 * that long before arming). Ours restarts on every turn rather than counting
 * from the draw, so a slow finisher's tail is absorbed however long it takes.
 * The one case that leaves is a user who never stops turning at all — for them
 * the window never closes, so `reason` reports `settling` and the UI says to let
 * the cube come to rest. A visible wait beats a drill that silently won't start.
 */
const SETTLE_MS = 500;

export function useTrainerCube(opts: UseTrainerCubeOpts): TrainerCubeState {
  const { enabled, timing, puzzle, sessionSet, currentCase, currentScramble, currentKey } = opts;

  const startTimer = useTrainerStore((s) => s.startTimer);
  const stopTimer = useTrainerStore((s) => s.stopTimer);
  const setTimerState = useTrainerStore((s) => s.setTimerState);
  const nextScramble = useTrainerStore((s) => s.nextScramble);
  const timerState = useTrainerStore((s) => s.timerState);

  const target = puzzleHasSmartCube(puzzle) ? caseTargetFacelets(currentScramble) : null;
  const stopStep = autoStopStep(puzzle, sessionSet, currentCase, target);
  /**
   * What completion is judged by. `stopStep` is null either because the set has
   * no statable finish or because this case starts where it would end; in both
   * cases a full solve is still an unambiguous finish, so judge by that — it can
   * never fire early, and it does fire for anyone who solves the cube out.
   */
  const judgeStep: CubeStep = stopStep ?? 'solved';

  // The move and solved callbacks fire from a BLE notification, outside React's
  // world, so everything they read comes from a ref.
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const timingRef = useRef(timing);
  timingRef.current = timing;
  const [armed, setArmed] = useState(false);
  const armedRef = useRef(false);
  /** Dates the finish by the cube's clock rather than by when React noticed. */
  const lastMoveEpochRef = useRef<number | null>(null);
  /** See `SETTLE_MS`. True while turns still belong to the previous rep. */
  const settlingRef = useRef(false);
  const [settling, setSettling] = useState(false);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** What to re-aim at from inside the move handler, where render values are stale. */
  const aimRef = useRef<{ target: string; step: CubeStep } | null>(null);

  const beginSettle = useCallback(() => {
    settlingRef.current = true;
    setSettling(true);
    if (settleTimerRef.current !== null) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(() => {
      settleTimerRef.current = null;
      settlingRef.current = false;
      setSettling(false);
    }, SETTLE_MS);
  }, []);

  /**
   * MAC prompt. A GAN / MoYu / QiYi cube is decrypted with a key derived from
   * its MAC, and Chrome only hands the address over via advertisement data that
   * some platforms strip — when every automatic source comes up empty the driver
   * waits on this promise, and a connect that never resolves it decodes nothing.
   */
  const macResolveRef = useRef<((mac: string | null) => void) | null>(null);
  const [macPrompt, setMacPrompt] = useState<{ deviceName: string; isWrongKey?: boolean } | null>(null);
  const onNeedMac = useCallback(
    (deviceName: string, isWrongKey?: boolean) => new Promise<string | null>((resolve) => {
      macResolveRef.current = resolve;
      setMacPrompt({ deviceName, isWrongKey });
    }),
    [],
  );
  const answerMac = useCallback((mac: string | null) => {
    macResolveRef.current?.(mac);
    macResolveRef.current = null;
    setMacPrompt(null);
  }, []);
  const submitMac = useCallback((mac: string) => answerMac(mac), [answerMac]);
  const cancelMac = useCallback(() => answerMac(null), [answerMac]);

  const cube = useBluetoothCube({
    onNeedMac,
    onMove: (_move, ts) => {
      lastMoveEpochRef.current = toEpochMs(ts);
      if (!enabledRef.current || !armedRef.current) return;
      // Still settling: this turn is the tail of the last rep, not the start of
      // this one. Re-aim so the case stays presented despite it, and give the
      // cube another window to come to rest.
      const aim = aimRef.current;
      if (settlingRef.current && aim) {
        cubeRef.current.hijackTo(aim.target, aim.step);
        beginSettle();
        return;
      }
      if (!timingRef.current) return;
      const st = useTrainerStore.getState();
      // Any turn while the case is up starts the rep. STOPPING is where the
      // store parks after a keyboard stop, so treat it as idle too — reaching
      // for the cube is the same intent as pressing space.
      if (st.timerState === TimerState.NOT_RUNNING || st.timerState === TimerState.STOPPING) {
        startTimer(lastMoveEpochRef.current);
      }
    },
    onSolved: () => {
      if (!enabledRef.current || !armedRef.current) return;
      if (!timingRef.current) {
        // Not timing: finishing a case just moves the drill on. Nothing is
        // recorded, which is the whole point of having the clock off.
        nextScramble();
        return;
      }
      if (useTrainerStore.getState().timerState !== TimerState.RUNNING) return;
      // The solved edge is decided from the state AFTER a move, so that move's
      // own timestamp IS the moment the cube reached it.
      stopTimer(lastMoveEpochRef.current ?? undefined);
      // The store parks in STOPPING waiting for a key release that will never
      // come, and both `getTimerReady` and a fresh draw refuse to run from there.
      // `stopTimer` has already queued the next case.
      setTimerState(TimerState.NOT_RUNNING);
    },
  });

  const cubeRef = useRef(cube);
  cubeRef.current = cube;
  const setAimed = useCallback((on: boolean) => {
    armedRef.current = on;
    setArmed(on);
  }, []);

  /**
   * Aim the cube at the case on screen.
   *
   * Keyed on the case identity AND the scramble string: re-drawing the same case
   * with a fresh scramble has to re-aim, and so does moving to a different case
   * that happens to share a scramble. Never while the clock is running — that
   * would move the finish line out from under a rep in progress.
   */
  const connected = cube.status.connected;
  useEffect(() => {
    if (!enabled || !connected || !target) {
      if (armedRef.current) {
        setAimed(false);
        aimRef.current = null;
        cubeRef.current.clearHijack();
      }
      return;
    }
    if (useTrainerStore.getState().timerState === TimerState.RUNNING) return;
    aimRef.current = { target, step: judgeStep };
    setAimed(cubeRef.current.hijackTo(target, judgeStep));
    beginSettle();
  }, [enabled, connected, target, judgeStep, currentKey, setAimed, beginSettle]);

  /**
   * Dev-only: publish the fake-cube console API with the trainer's own scramble,
   * so the whole loop — connect, case presented, first turn, finish, next case —
   * can be walked without hardware. No-op in production builds.
   */
  const scrambleForFakeRef = useRef(currentScramble);
  scrambleForFakeRef.current = currentScramble;
  useEffect(() => { installFakeCube(() => scrambleForFakeRef.current ?? ''); }, []);

  // Give the cube back when the drill is left, so the next page — or a WCA solve
  // in /timer — sees the cube in the user's hands and not a training frame.
  useEffect(() => () => {
    if (settleTimerRef.current !== null) clearTimeout(settleTimerRef.current);
    cubeRef.current.clearHijack();
  }, []);

  const connect = useCallback(async () => { await cubeRef.current.connect(); }, []);

  const reason: TrainerCubeReason =
    !enabled ? 'off'
    : !puzzleHasSmartCube(puzzle) ? 'unsupported-puzzle'
    : !connected ? 'disconnected'
    : !currentScramble ? 'no-case'
    : !target ? 'unreadable-case'
    : timerState === TimerState.RUNNING ? 'running'
    : !armed ? 'not-aimed'
    : settling ? 'settling'
    : 'ready';

  return { cube, armed, stopStep, reason, connect, macPrompt, submitMac, cancelMac };
}
