'use client';

/**
 * SimCubeView — a real 3D cube built by the /sim engine, driven by a move log,
 * optionally posed by the cube's gyroscope.
 *
 * Two callers, one component, because they are the same picture:
 *   - the LIVE mirror while timing (LiveCubeState), posed by the BLE gyro feed;
 *   - the post-solve REPLAY (PlaybackPanel), where the gyro track is optional —
 *     with a pose it shows how the cube sat in the hands, without one it just
 *     shows the state, which is still the /sim cube and not a second renderer.
 *
 * `quat = null` is not an error state: the frame hook simply never writes an
 * orientation, and the engine's own iso view is what you see.
 *
 * Stickers come from the move log the caller maintains; orientation comes from
 * the quaternion feed. The two are independent channels and they stay
 * independent here:
 *
 *   - STICKERS  → the engine's twister — layer twists applied to child
 *     CubeGroups and per-instance matrices. `setup()` snaps the whole log;
 *     `push()` plays the new turns. See the `animate` prop for which is used
 *     when and why the default is to snap.
 *
 * The engine is alg-driven — it has no facelet setter — so the move log MUST
 * be anchored at a solved cube for this to be truthful. LiveCubeState owns
 * that rule (`algAnchored`) and falls back to the flat facelet view when the
 * anchor is missing; do not paper over it with a synthetic setup alg here.
 *   - POSE      → `world.cube.quaternion` — the cube group's own transform,
 *     which the engine never writes, so it is ours to own outright.
 *
 * Two things this deliberately does NOT do:
 *   - It does not attach the /sim pointer Controller. A gyro view is driven by
 *     the physical cube; a drag handler would fight it for the same transform.
 *   - It does not put orientation on `world.scene.rotation`. That is the orbit
 *     channel, and the lights live under the scene — rotating it would drag the
 *     lighting around with the cube and kill every shading cue that makes the
 *     rotation readable. `scene.rotation` keeps the engine's fixed iso viewer
 *     tilt; the lights stay put; only the cube turns.
 *
 * Frame budget: this renders on the timing surface while the user is timing, so
 * a cube sitting still on the table must not burn 60 fps of GPU. The frame hook
 * marks the world dirty only when the smoothed quaternion actually moved past
 * ~1e-4 rad; a resting cube settles and the loop goes quiet within a few frames.
 *
 * Size comes from the host box, which `mountSimWorld` measures with a
 * ResizeObserver — see `.timer-live-cube-3d` in timer.css.
 *
 * The orientation math (calibration / sensor basis / mirror / smoothing) is
 * pure and lives in ../_lib/bluetooth/orientation.ts — read its header before
 * touching any of these props.
 */

import { useEffect, useRef, useState, type JSX } from 'react';

import { tr } from '@/i18n/tr';
import type World from '@/app/[lang]/sim/engine/world';
import type NxnCube from '@/app/[lang]/sim/engine/nxn/cube';
import type { SimMount } from '@/components/sim-embed/mountSimWorld';
import {
  advanceStillMs,
  applyOrientation,
  calibrate,
  quatAngleTo,
  slerpTowards,
  snapWhenSettled,
  type Quat,
  type SensorBasisName,
} from '../_lib/bluetooth/orientation';

/** Below this the pose is "unchanged" and we skip the render entirely. */
const STILL_EPS_RAD = 1e-4;

/** Turns allowed to be mid-flight before the next one snaps what is playing.
 *  Two is enough to keep a fast solve looking continuous and short enough that
 *  the mirror is never meaningfully behind the cube in the user's hands. */
const MAX_ANIM_QUEUE = 2;

export interface SimCubeViewProps {
  /** Moves since the cube was last known SOLVED — see the note above. */
  moves: string[];
  /** Latest orientation sample, or null when none has arrived. */
  quat: Quat | null;
  /**
   * Preferred over `quat` when given: a mutable box the owner writes each BLE
   * sample into. Orientation lands at 20-50 Hz; routing it through props would
   * re-render whoever owns the timer that often, for a value only this
   * component's frame loop ever reads. `quat` stays for the synthetic/dev feed
   * and for tests, where the re-render cost is irrelevant.
   */
  quatRef?: { current: Quat | null };
  /** Bump to capture the current sample as the upright reference. */
  calibrateToken?: number;
  /** Per-brand sensor axis remap. See orientation.ts — all brands currently
   *  default to 'identity' because we have verified none of them. */
  sensorBasis?: SensorBasisName;
  /** Reverse the sense of rotation (handedness fix). Calibration cannot do
   *  this — see orientation.ts. */
  mirror?: boolean;
  /**
   * Play the turns instead of snapping to the new state.
   *
   * Only ever applies to a pure APPEND — the new log starting with the old one.
   * Anything else (a seek, a rewind, a re-anchor) still snaps, because there is
   * no honest animation for "the state jumped". And an append longer than
   * `MAX_ANIM_QUEUE` finishes what is playing first: the point of the animation
   * is to make one turn readable, not to let the screen fall behind the hands.
   */
  animate?: boolean;
  /** Fired once the WebGL context is up and the first cube state is applied. */
  onReady?: () => void;
  /** Screen-reader label. Defaults to the live-mirror wording; the replay
   *  passes its own, since "实时" is a lie there. */
  ariaLabel?: string;
}

export default function SimCubeView(props: SimCubeViewProps): JSX.Element {
  const {
    moves,
    quat,
    quatRef,
    calibrateToken = 0,
    sensorBasis = 'identity',
    mirror = false,
    animate = false,
    onReady,
    ariaLabel,
  } = props;

  const hostRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<SimMount | null>(null);
  const [ready, setReady] = useState(false);

  // ── Live values the rAF hook reads. Refs, not state: the frame loop must not
  //    re-subscribe (and the component must not re-render) per BLE sample. ──
  const rawRef = useRef<Quat | null>(null);
  const referenceRef = useRef<Quat | null>(null);
  const smoothedRef = useRef<Quat | null>(null);
  const appliedRef = useRef<Quat | null>(null);
  // Settling: the last measured (un-smoothed, un-snapped) pose and how long it
  // has held still. See the snap block in orientation.ts.
  const measuredRef = useRef<Quat | null>(null);
  const stillMsRef = useRef(0);
  const pendingCalibrationRef = useRef(false);
  const basisRef = useRef<SensorBasisName>(sensorBasis);
  const mirrorRef = useRef(mirror);
  const onReadyRef = useRef(onReady);
  // A ref to the caller's ref — the mount effect runs once, so it must not
  // close over whichever box happened to be passed on the first render.
  const externalQuatRef = useRef(quatRef);

  // Effect order matters and follows declaration order: the sample lands before
  // the calibration arming below can consume it.
  useEffect(() => {
    // A null sample means "nothing new" (e.g. the cube went quiet), not "reset";
    // keep showing the last known pose rather than snapping back to solved.
    if (quat) rawRef.current = quat;
  }, [quat]);

  useEffect(() => {
    basisRef.current = sensorBasis;
    mirrorRef.current = mirror;
    onReadyRef.current = onReady;
    externalQuatRef.current = quatRef;
  });

  // Calibration: capture the live sample the moment the token changes. If none
  // has landed yet, stay armed so the first one that does becomes the reference.
  // The initial token value is not a calibration request.
  const seenTokenRef = useRef(calibrateToken);
  useEffect(() => {
    if (seenTokenRef.current === calibrateToken) return;
    seenTokenRef.current = calibrateToken;
    pendingCalibrationRef.current = true;
    // Re-derive from the new reference rather than easing out of a pose that no
    // longer means anything. The settle timer restarts with it: stillness
    // measured against the OLD reference says nothing about the new one.
    smoothedRef.current = null;
    measuredRef.current = null;
    stillMsRef.current = 0;
  }, [calibrateToken]);

  // ── Mount: lazy-load the shared embed lifecycle (which pulls in three + the
  //    /sim engine), then drive the cube's own transform every frame. ──
  useEffect(() => {
    let cancelled = false;
    let mount: SimMount | null = null;

    void (async () => {
      const { mountSimWorld } = await import('@/components/sim-embed/mountSimWorld');
      if (cancelled) return;
      const host = hostRef.current;
      if (!host) return;

      mount = mountSimWorld({
        host,
        puzzle: 3,
        interactive: false, // gyro-driven: a pointer Controller would fight it
        faceHints: false,
        pixelRatioCap: 2,
        onFrame: (world: World, dtMs: number): boolean => {
          const raw = externalQuatRef.current?.current ?? rawRef.current;
          if (!raw) return false;
          if (pendingCalibrationRef.current) {
            referenceRef.current = calibrate(raw);
            pendingCalibrationRef.current = false;
          }
          const measured = applyOrientation(raw, referenceRef.current, {
            basis: basisRef.current,
            mirror: mirrorRef.current,
          });
          // A cube that has stopped moving near a whole orientation IS at it;
          // the leftover few degrees are grip and sensor zero, and leaving them
          // in is what makes the cube on screen read as permanently crooked.
          // Stillness is measured on the MEASURED pose, never on the smoothed
          // one — the smoothed pose is still converging on the snap target and
          // would keep re-arming the timer against itself.
          stillMsRef.current = advanceStillMs(measuredRef.current, measured, stillMsRef.current, dtMs);
          measuredRef.current = measured;
          const target = snapWhenSettled(measured, stillMsRef.current);
          // BLE lands at 20-50 Hz, under the 60 fps loop — ease between samples
          // so the cube glides instead of stepping.
          const next = smoothedRef.current
            ? slerpTowards(smoothedRef.current, target, dtMs)
            : target;
          smoothedRef.current = next;
          const prev = appliedRef.current;
          if (prev && quatAngleTo(prev, next) <= STILL_EPS_RAD) return false;
          appliedRef.current = next;
          // three is x,y,z,w; our wire/math order is w-first.
          world.cube.quaternion.set(next.x, next.y, next.z, next.w);
          // cube.matrixAutoUpdate is false throughout the engine — without this
          // the write is invisible.
          world.cube.updateMatrix();
          return true;
        },
      });
      mountRef.current = mount;
      setReady(true);
      onReadyRef.current?.();
      if (cancelled) {
        mount.dispose();
        mount = null;
        mountRef.current = null;
      }
    })();

    return () => {
      cancelled = true;
      mount?.dispose();
      mountRef.current = null;
    };
  }, []);

  // ── Sticker state. ──
  //
  // `setup()` snaps: it drops the play queue, resets and re-applies the whole
  // log. That is the only honest answer to a state that JUMPED (a seek, a
  // rewind, a re-anchored live log), and it stays the default.
  //
  // `push()` plays the turn. It is used only when the new log literally starts
  // with the old one — the one case where "what changed" is a sequence of
  // turns and animating them is showing what happened rather than inventing it.
  // The queue is capped: fall more than MAX_ANIM_QUEUE behind and the pending
  // turns are finished instantly before the new one is pushed, so the screen
  // can drift a couple of turns behind the hands and no further.
  const composed = moves.join(' ');
  const shownRef = useRef('');
  useEffect(() => {
    const world = mountRef.current?.world;
    if (!ready || !world) return;
    const twister = (world.cube as NxnCube).twister;
    const prev = shownRef.current;
    shownRef.current = composed;
    // An empty `prev` is the first mount, where the whole scramble would
    // otherwise "play" — that is a state jump too, not a sequence of turns.
    const appended = animate && prev !== '' && composed.startsWith(`${prev} `);
    if (appended) {
      if (twister.length > MAX_ANIM_QUEUE) twister.finish();
      twister.push(composed.slice(prev.length).trim());
    } else {
      twister.setup(composed);
    }
    mountRef.current?.invalidate();
  }, [ready, composed, animate]);

  return (
    <div
      ref={hostRef}
      className="timer-live-cube-3d"
      role="img"
      aria-label={ariaLabel ?? tr({
        zh: '智能魔方实时三维状态（跟随陀螺仪朝向）',
        en: 'Live 3D smart-cube state (follows the gyroscope orientation)',
      })}
    />
  );
}
