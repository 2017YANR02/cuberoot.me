'use client';

/**
 * LiveCubeState — corner mirror of the user's smart cube.
 *
 * Composes the active scramble with the moves that have streamed in from BLE
 * since the scramble was set, then renders it one of two ways:
 *
 *   mode '2d' (default) — the flat net via CubePreview. Works for every event
 *     and needs nothing but the move stream.
 *   mode '3d'           — a live 3D cube whose orientation follows the cube's
 *     gyroscope (LiveCubeGyroView). 3x3 only, and only once a real orientation
 *     sample has arrived.
 *
 * The 2D fallback is not a nicety, it is the contract: a 3D cube that is not
 * being told which way it is pointing is worse than no 3D cube at all, because
 * it looks alive while being wrong. So we stay on the net until the first
 * quaternion lands, and the caller can drop `mode` back to '2d' at any time.
 *
 * The next/dynamic boundary lives HERE rather than in SoloView on purpose:
 * three.js + the /sim engine is a heavy chunk, and this is the single place
 * that knows whether it is actually going to be needed. Callers just pass props.
 */

import dynamic from 'next/dynamic';
import { useEffect, useState, type JSX } from 'react';

import { Spinner } from '@/components/Spinner/Spinner';
import { useIsMobile } from '@/hooks/useIsMobile';
import { tr } from '@/i18n/tr';
import type { EventId } from '../_lib/types';
import CubePreview from '../_lib/cube/CubePreview';
import { readDevQuatSource, type Quat, type SensorBasisName } from '../_lib/bluetooth/orientation';

/** three + the /sim engine only load when a 3D view is actually mounted. */
const LiveCubeGyroView = dynamic(() => import('./LiveCubeGyroView'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Spinner size={16} label={tr({ zh: '加载中', en: 'Loading' })} />
    </div>
  ),
});

/** Synthetic-sample cadence, ms. ~30 Hz sits in the middle of the 20-50 Hz a
 *  real BLE gyro delivers, so the dev path exercises the same "samples arrive
 *  slower than frames" behaviour the smoothing exists for. */
const DEV_SAMPLE_MS = 33;

/** How often to check whether the first `quatRef` sample has landed. Only ever
 *  runs before the 2D→3D switch, so it can afford to be lazy. */
const LATCH_POLL_MS = 250;

/**
 * Dev-only synthetic orientation source.
 *
 * We own no smart cube, so this is how the 3D path gets exercised at all —
 * `window.__cuberootFakeQuat` (a Quat or a `(tMs) => Quat`) is polled at BLE
 * cadence and fed in exactly where a real sample would go. Compiled out of
 * production builds; see orientation.ts for the shape and a usage snippet.
 */
function useSyntheticQuat(enabled: boolean): Quat | null {
  const [q, setQ] = useState<Quat | null>(null);
  useEffect(() => {
    if (!enabled) return;
    if (process.env.NODE_ENV === 'production') return;
    const id = setInterval(() => {
      const sample = readDevQuatSource(performance.now());
      if (sample) setQ(sample);
    }, DEV_SAMPLE_MS);
    return () => clearInterval(id);
  }, [enabled]);
  return q;
}

export interface LiveCubeStateProps {
  event: EventId;
  scramble: string;
  moves: string[];
  /** 2D only: CubePreview's base unit (final net is `size * facelets`). */
  size?: number;
  /** '3d' renders the gyro-driven cube; anything else keeps the flat net. */
  mode?: '2d' | '3d';
  /** 3D only: rendered edge in px. */
  size3d?: number;
  /** Latest orientation sample from the cube, or null when none has arrived. */
  quat?: Quat | null;
  /**
   * Preferred over `quat`: a mutable box the owner writes each BLE sample into.
   * Samples land at 20-50 Hz and only the 3D frame loop reads them, so routing
   * them through props would re-render the whole timer shell for nothing.
   */
  quatRef?: { current: Quat | null };
  /** Bump to capture the current sample as the upright reference. */
  calibrateToken?: number;
  /** Per-brand sensor axis remap — see _lib/bluetooth/orientation.ts. */
  sensorBasis?: SensorBasisName;
  /** Reverse the sense of rotation (handedness fix; calibration cannot do it). */
  mirror?: boolean;
}

export default function LiveCubeState(props: LiveCubeStateProps): JSX.Element {
  const {
    event,
    scramble,
    moves,
    size = 10,
    mode = '2d',
    size3d = 140,
    quat = null,
    quatRef,
    calibrateToken = 0,
    sensorBasis = 'identity',
    mirror = false,
  } = props;

  // timer.css hides .timer-live-cube outright below 480px. Mirror that here so
  // the 3D branch is never mounted at all — a display:none host has a zero
  // client box, which would leave a live WebGL context rendering into nothing.
  // Keep this breakpoint in sync with the @media rule in timer.css.
  const hiddenByViewport = useIsMobile(480);
  const wants3d = mode === '3d' && !hiddenByViewport;
  const devQuat = useSyntheticQuat(wants3d);
  const liveQuat = quat ?? devQuat;

  // Latch: once any sample has landed we stay in 3D even across momentary
  // gaps in the feed (the view holds its last pose rather than flickering
  // between renderers).
  const [everOriented, setEverOriented] = useState(false);
  useEffect(() => {
    if (liveQuat && !everOriented) setEverOriented(true);
  }, [liveQuat, everOriented]);

  // `quatRef` deliberately does not re-render on each sample, so nothing would
  // ever trip the latch above. Poll it — slowly, and only until the first
  // sample lands. A cube with no gyro simply never satisfies this and we stay
  // on the net, which is the intended outcome rather than a failure mode.
  useEffect(() => {
    if (!wants3d || everOriented || !quatRef) return;
    if (quatRef.current) { setEverOriented(true); return; }
    const id = setInterval(() => {
      if (quatRef.current) setEverOriented(true);
    }, LATCH_POLL_MS);
    return () => clearInterval(id);
  }, [wants3d, everOriented, quatRef]);

  const composed = moves.length > 0 ? `${scramble} ${moves.join(' ')}` : scramble;

  if (wants3d && everOriented) {
    return (
      <div style={{ width: size3d, height: size3d, lineHeight: 0 }}>
        <LiveCubeGyroView
          scramble={scramble}
          moves={moves}
          quat={liveQuat}
          quatRef={quatRef}
          size={size3d}
          calibrateToken={calibrateToken}
          sensorBasis={sensorBasis}
          mirror={mirror}
        />
      </div>
    );
  }

  return <CubePreview event={event} scramble={composed} size={size} />;
}
