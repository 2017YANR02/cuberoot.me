'use client';

import { useEffect, useRef, useState } from 'react';
import type { SimCubeViewProps } from './SimCubeView';
import { mountTwistyPlayer, type MountedTwistyPlayer } from './mount-twisty-player';
import type { LiveSmartCubeDisplayEvent } from '@cuberoot/shared/smart-cube/anchor';
import { LiveTurnCadence, planLiveSimUpdate } from '@cuberoot/shared/timer/sim-log';
import { normalizeWcaScramble } from '@cuberoot/shared/normalize-wca-scramble';
import { invertAlg } from '@cuberoot/shared/alg-transform';
import {
  applyOrientation, calibrate, mirrorForBrand, sensorBasisForBrand,
  quatAngleTo, quatConjugate, quatMul, QUAT_IDENTITY, slerpTowards, type Quat,
} from '@cuberoot/shared/smart-cube/orientation';
import { rotationQuaternionForToken } from '@cuberoot/shared/timer/reconstruct/rotation-detect';
import './live-cube.css';

/** The same cubing.js Cube3D renderer and append animation used by Twizzle.
 * Only the selected renderer mounts. Timing/recording never depend on this view.
 */
export default function TwizzleCubeView(props: SimCubeViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  const updateMoves = useRef<((moves: readonly string[]) => void) | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const tr = (copy: { en: string; zh: string }) => copy[props.language ?? 'en'];
  useEffect(() => { latest.current = props; });

  useEffect(() => {
    const abort = new AbortController();
    let mounted: MountedTwistyPlayer | undefined;
    let unsubscribe: (() => void) | undefined;
    let frameId = 0;
    setFailed(false);
    const fail = (error: unknown) => {
      if (abort.signal.aborted) return;
      console.warn('[TwizzleCubeView]', error);
      abort.abort();
      unsubscribe?.();
      cancelAnimationFrame(frameId);
      mounted?.dispose();
      setFailed(true);
    };
    void (async () => {
      const host = hostRef.current;
      if (!host) return;
      mounted = await mountTwistyPlayer(host, {
        puzzle: '3x3x3', visualization: '3D', alg: '',
        controlPanel: 'none', background: 'none', hintFacelets: 'none', backView: 'none',
        experimentalSetupAnchor: 'start', cameraLatitude: 30, cameraLongitude: 30,
        experimentalDragInput: 'auto', experimentalMovePressInput: 'none',
      }, { signal: abort.signal });
      const { player } = mounted;
      const cadence = new LiveTurnCadence();
      // cubing.js append is asynchronous. Serialize resyncs with appends so an
      // old pending BLE turn cannot overwrite a reconnect's new authoritative state.
      let pending = Promise.resolve();
      const enqueue = (operation: () => void) => {
        pending = pending.then(async () => {
          if (abort.signal.aborted || !player.isConnected) return;
          operation();
          await player.experimentalModel.alg.get();
        }).catch(fail);
      };
      const reset = (exp: string) => enqueue(() => {
        player.pause();
        player.experimentalModel.catchUpMove.set({ move: null, amount: 0 });
        player.experimentalSetupAlg = exp;
        player.alg = '';
        player.timestamp = 'end';
        cadence.reset();
      });
      const append = (exp: string, timestamp?: number) => {
        const durationMs = cadence.durationMs(timestamp, performance.now());
        enqueue(() => {
          // cubing.js uses a 500 ms catch-up turn at tempoScale=1.
          player.tempoScale = 500 / durationMs;
          for (const move of exp.trim().split(/\s+/).filter(Boolean)) player.experimentalAddMove(move);
        });
      };
      let shown: string | null = null;
      let rebaseOnNextAppend: string | null = null;
      updateMoves.current = (moves) => {
        const turns = moves.join(' ');
        if (shown === turns) return;
        const plan = planLiveSimUpdate({ turns: shown ?? '', pose: '' }, { turns, pose: '' }, true, 0, shown !== null);
        if (plan.mode === 'push') {
          if (rebaseOnNextAppend !== null) reset(rebaseOnNextAppend);
          append(plan.exp);
        }
        else reset(plan.mode === 'catch-up' ? plan.fallbackExp : plan.exp);
        rebaseOnNextAppend = shown !== null && turns.length < shown.length ? turns : null;
        shown = turns;
      };
      const source = latest.current.liveSource;
      if (source) {
        let verified = false;
        const orient = (exp: string) => props.gyroOrientation
          ? normalizeWcaScramble(`${invertAlg(props.gyroOrientation)} ${exp}`) ?? exp : exp;
        const apply = (event: LiveSmartCubeDisplayEvent) => {
          if (!event.snapshot.algAnchored) { verified = false; return; }
          if (verified && event.move) {
            if (rebaseOnNextAppend !== null) reset(rebaseOnNextAppend);
            append(orient(event.move), event.timestamp);
          }
          else reset(`${props.gyroOrientation ?? ''} ${orient(event.snapshot.moves.join(' '))}`.trim());
          // Keep the final turn visible, then discard completed solves before
          // the next scramble. The Twizzle alg must not grow for the whole session.
          rebaseOnNextAppend = event.move && event.snapshot.moves.length === 0 ? props.gyroOrientation ?? '' : null;
          verified = true;
        };
        apply({ snapshot: source.getSnapshot() });
        unsubscribe = source.subscribe(apply);
      } else updateMoves.current(latest.current.moves);

      const puzzle = await player.experimentalCurrentThreeJSPuzzleObject();
      if (abort.signal.aborted) return;
      const vantages = [...await player.experimentalCurrentVantages()];
      if (abort.signal.aborted) return;
      latest.current.onReady?.();
      let reference = props.calibrationReference ? calibrate(props.calibrationReference) : null;
      let token = props.calibrateToken;
      let pendingCalibration = false;
      let smoothed: Quat | null = null;
      let applied: Quat | null = null;
      let raw: Quat | null = null;
      let hasGyro = false;
      let lastMs = performance.now();
      const grip = (props.gyroOrientation ?? '').trim().split(/\s+/).reduce((q, move) => {
        const rotation = rotationQuaternionForToken(move);
        return rotation ? quatMul(quatConjugate(rotation), q) : q;
      }, QUAT_IDENTITY);
      const frame = (now: number) => {
        if (abort.signal.aborted) return;
        const current = latest.current;
        raw = current.quatRef?.current ?? current.quat ?? raw;
        if (token !== current.calibrateToken) {
          token = current.calibrateToken;
          reference = current.calibrationReference ? calibrate(current.calibrationReference) : reference;
          pendingCalibration = !current.calibrationReference;
          smoothed = null;
        }
        if (raw && [raw.w, raw.x, raw.y, raw.z].every(Number.isFinite)
          && Math.hypot(raw.w, raw.x, raw.y, raw.z) > 1e-6) {
          if (!hasGyro) { player.cameraLongitude = 0; hasGyro = true; }
          if (pendingCalibration) { reference = calibrate(raw); pendingCalibration = false; }
          const measured = applyOrientation(raw, reference, {
            basis: current.sensorBasis ?? sensorBasisForBrand(null),
            mirror: current.mirror ?? mirrorForBrand(null),
          });
          const target = quatMul(quatMul(grip, measured), quatConjugate(grip));
          const next = smoothed ? slerpTowards(smoothed, target, now - lastMs) : target;
          smoothed = next;
          if (!applied || quatAngleTo(applied, next) > 1e-4) {
            puzzle.quaternion.set(next.x, next.y, next.z, next.w);
            puzzle.updateMatrix();
            for (const vantage of vantages) vantage.scheduleRender();
            applied = next;
          }
        }
        lastMs = now;
        frameId = requestAnimationFrame(frame);
      };
      frameId = requestAnimationFrame(frame);
    })().catch(fail);
    return () => {
      abort.abort();
      unsubscribe?.();
      cancelAnimationFrame(frameId);
      updateMoves.current = null;
      mounted?.dispose();
    };
  }, [attempt, props.liveSource, props.gyroOrientation]);

  useEffect(() => {
    if (!props.liveSource) updateMoves.current?.(props.moves);
  }, [props.moves, props.liveSource]);

  return <div className={props.className ?? 'timer-live-cube-3d'}
    role={failed ? undefined : 'img'} aria-label={props.ariaLabel} data-cube-engine="twizzle">
    <div ref={hostRef} style={{ width: '100%', height: failed ? 0 : '100%' }} />
    {failed && <>
      <p role="status">{tr({ en: 'Could not load Twizzle.', zh: 'Twizzle 加载失败。' })}</p>
      <button type="button" className="live-cube-calibrate" onClick={() => setAttempt(value => value + 1)}>
        {tr({ en: 'Retry', zh: '重试' })}
      </button>
    </>}
  </div>;
}
