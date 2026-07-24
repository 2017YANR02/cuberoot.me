'use client';

/**
 * LiveCubeGyroView — the live smart-cube mirror as a real 3D cube whose
 * orientation follows the cube's gyroscope.
 *
 * State comes from the same (scramble + streamed moves) contract LiveCubeState
 * has always used; orientation comes from the BLE quaternion feed. The two are
 * independent channels and they stay independent here:
 *
 *   - STICKERS  → `twister.setup(scramble + moves)` — layer twists, applied by
 *     the engine to child CubeGroups and per-instance matrices.
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
 * Frame budget: this renders in a corner overlay while the user is timing, so
 * a cube sitting still on the table must not burn 60 fps of GPU. The frame hook
 * marks the world dirty only when the smoothed quaternion actually moved past
 * ~1e-4 rad; a resting cube settles and the loop goes quiet within a few frames.
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
  applyOrientation,
  calibrate,
  quatAngleTo,
  slerpTowards,
  type Quat,
  type SensorBasisName,
} from '../_lib/bluetooth/orientation';

/** Below this the pose is "unchanged" and we skip the render entirely. */
const STILL_EPS_RAD = 1e-4;

export interface LiveCubeGyroViewProps {
  /** Scramble the solve started from. */
  scramble: string;
  /** Moves streamed from the cube since the scramble was set. */
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
  /** Rendered edge, px. */
  size?: number;
  /** Bump to capture the current sample as the upright reference. */
  calibrateToken?: number;
  /** Per-brand sensor axis remap. See orientation.ts — all brands currently
   *  default to 'identity' because we have verified none of them. */
  sensorBasis?: SensorBasisName;
  /** Reverse the sense of rotation (handedness fix). Calibration cannot do
   *  this — see orientation.ts. */
  mirror?: boolean;
  /** Fired once the WebGL context is up and the first cube state is applied. */
  onReady?: () => void;
}

export default function LiveCubeGyroView(props: LiveCubeGyroViewProps): JSX.Element {
  const {
    scramble,
    moves,
    quat,
    quatRef,
    size = 140,
    calibrateToken = 0,
    sensorBasis = 'identity',
    mirror = false,
    onReady,
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
    // longer means anything.
    smoothedRef.current = null;
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
          const target = applyOrientation(raw, referenceRef.current, {
            basis: basisRef.current,
            mirror: mirrorRef.current,
          });
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

  // ── Sticker state: scramble + streamed moves, snapped (not animated) so the
  //    mirror can never lag behind the physical cube. ──
  const composed = moves.length > 0 ? `${scramble} ${moves.join(' ')}`.trim() : scramble.trim();
  useEffect(() => {
    const world = mountRef.current?.world;
    if (!ready || !world) return;
    (world.cube as NxnCube).twister.setup(composed);
    mountRef.current?.invalidate();
  }, [ready, composed]);

  return (
    <div
      ref={hostRef}
      className="timer-live-cube-3d"
      style={{ width: size, height: size, lineHeight: 0 }}
      role="img"
      aria-label={tr({
        zh: '智能魔方实时三维状态（跟随陀螺仪朝向）',
        en: 'Live 3D smart-cube state (follows the gyroscope orientation)',
      })}
    />
  );
}
